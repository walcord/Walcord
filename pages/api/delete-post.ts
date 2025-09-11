// pages/api/delete-post.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

/**
 * Este endpoint usa:
 * - ANON KEY + Bearer token del usuario (Authorization: Bearer <jwt>)
 * - RLS en Supabase: el dueño puede borrar su post
 * - Limpieza de likes/comments/reports si no tienes ON DELETE CASCADE
 * - Borrado de archivos en el bucket si las URLs pertenecen al Storage
 *
 * No requiere SUPABASE_SERVICE_ROLE_KEY.
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null
    if (!token) return res.status(401).json({ error: 'Missing auth token' })

    const { postId } = (req.body || {}) as { postId?: string }
    if (!postId) return res.status(400).json({ error: 'Missing postId' })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      {
        auth: { persistSession: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    )

    // 0) Comprueba usuario (opcional, ayuda a devolver 401 si token inválido)
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid user' })

    // 1) Carga el post (para verificar ownership y obtener image_urls)
    const { data: post, error: postErr } = await supabase
      .from('posts')
      .select('id, user_id, image_urls')
      .eq('id', postId)
      .single()
    if (postErr || !post) return res.status(404).json({ error: 'Post not found' })

    if (post.user_id !== userData.user.id) {
      return res.status(403).json({ error: 'Forbidden: not the owner' })
    }

    // 2) Si no tienes ON DELETE CASCADE en likes/comments/reports, límpialos aquí
    await supabase.from('post_likes').delete().eq('post_id', postId)
    await supabase.from('post_comments').delete().eq('post_id', postId)
    await supabase.from('reports').delete().eq('post_id', postId)

    // 3) Borrar archivos del bucket si las URLs son de tu Storage
    const bucket = 'posts' // <-- cambia si usas otro
    const imageUrls: string[] = Array.isArray(post.image_urls) ? post.image_urls : []
    const keys: string[] = []
    for (const url of imageUrls) {
      const marker = `/object/public/${bucket}/`
      const idx = url.indexOf(marker)
      if (idx !== -1) {
        const key = url.slice(idx + marker.length).split('?')[0]
        if (key) keys.push(key)
      }
    }
    if (keys.length) {
      // Nota: borrar en Storage también funciona con token de usuario si la política de bucket lo permite.
      // Si no, simplemente omite esta parte o configura una policy para que el dueño pueda borrar sus ficheros.
      await supabase.storage.from(bucket).remove(keys)
    }

    // 4) Borrar el post (RLS permite borrar solo al dueño)
    const { error: delErr } = await supabase.from('posts').delete().eq('id', postId)
    if (delErr) return res.status(400).json({ error: delErr.message })

    return res.status(200).json({ ok: true })
  } catch (e: any) {
    console.error('delete-post API error:', e)
    return res.status(500).json({ error: e?.message || 'Unexpected error' })
  }
}

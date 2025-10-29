import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

/**
 * Igual que delete-post, pero para la tabla `concerts`.
 * Usa ANON KEY + Bearer <jwt> y confía en las RLS (el dueño borra su concierto).
 * Limpia tablas hijas si no tienes ON DELETE CASCADE y borra ficheros del Storage.
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null
    if (!token) return res.status(401).json({ error: 'Missing auth token' })

    const { concertId } = (req.body || {}) as { concertId?: string }
    if (!concertId) return res.status(400).json({ error: 'Missing concertId' })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      {
        auth: { persistSession: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    )

    // 0) Validar usuario (opcional, nos da un 401 limpio si el token es inválido)
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid user' })

    // 1) Cargar concierto para comprobar ownership y obtener media
    const { data: concert, error: concertErr } = await supabase
      .from('concerts')
      .select('id, user_id')
      .eq('id', concertId)
      .single()
    if (concertErr || !concert) return res.status(404).json({ error: 'Concert not found' })
    if (concert.user_id !== userData.user.id) {
      return res.status(403).json({ error: 'Forbidden: not the owner' })
    }

    // 2) Obtener media asociada (por si quieres borrar del Storage)
    const { data: media } = await supabase
      .from('concert_media')
      .select('url')
      .eq('concert_id', concertId)

    // 3) Borrar tablas hijas si no tienes ON DELETE CASCADE
    await supabase.from('concerts_atendees').delete().eq('concert_id', concertId)
    await supabase.from('concert_media').delete().eq('concert_id', concertId)
    // Si usas la misma tabla de reports para posts y conciertos con post_id:
    await supabase.from('reports').delete().eq('post_id', concertId)

    // 4) Borrar ficheros del Storage si las URLs pertenecen a tu bucket
    const bucket = 'concerts' // <-- cambia si usas otro bucket
    const keys: string[] = []
    for (const m of media || []) {
      const url = m.url as string
      const marker = `/object/public/${bucket}/`
      const idx = url.indexOf(marker)
      if (idx !== -1) {
        const key = url.slice(idx + marker.length).split('?')[0]
        if (key) keys.push(key)
      }
    }
    if (keys.length) {
      // Necesitas una policy en el bucket que permita borrar al dueño o usa service role si prefieres
      await supabase.storage.from(bucket).remove(keys)
    }

    // 5) Borrar el concierto (RLS: solo dueño)
    const { error: delErr } = await supabase.from('concerts').delete().eq('id', concertId)
    if (delErr) return res.status(400).json({ error: delErr.message })

    return res.status(200).json({ ok: true })
  } catch (e: any) {
    console.error('delete-concert API error:', e)
    return res.status(500).json({ error: e?.message || 'Unexpected error' })
  }
}

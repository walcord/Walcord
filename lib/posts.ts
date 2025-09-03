import { supabase } from './supabaseClient'

export type Post = {
  id: string
  user_id: string
  record_id: string
  era: string
  caption: string | null
  image_urls: string[]
  created_at: string
}

export type PostWithCounts = Post & {
  likes_count: number
  comments_count: number
  record?: {
    id: string
    title: string
    artist_name?: string
    cover_url?: string | null
    vibe_color?: string | null
    cover_color?: string | null
  }
  author?: { username?: string | null; avatar_url?: string | null }
}

/* ------------------------- Helpers: normalizar imágenes ------------------------- */
/**
 * Convierte una URL pública de Supabase Storage a la ruta de render con ancho limitado.
 * No cambia tu esquema: sólo transforma la URL para servir una versión más ligera.
 * Ej.: /object/public/...  ->  /render/image/public/... ?width=1080&quality=80
 */
function normalizeImageUrl(url: string, width = 1080, quality = 80): string {
  try {
    if (!url) return url
    const u = new URL(url)
    // Reemplaza /object/public/ por /render/image/public/
    u.pathname = u.pathname.replace('/object/public/', '/render/image/public/')
    // Evita duplicar query si ya hay parámetros
    u.searchParams.set('width', String(width))
    u.searchParams.set('quality', String(quality))
    return u.toString()
  } catch {
    return url
  }
}

function normalizeImageArray(urls: string[] | null | undefined, width = 1080): string[] {
  if (!urls?.length) return []
  return urls.map(u => normalizeImageUrl(u, width))
}

/* -------------------------- Upload imágenes (Storage) -------------------------- */
export async function uploadPostImages(files: File[]): Promise<string[]> {
  if (!files?.length) return []
  const { data: { user }, error: uerr } = await supabase.auth.getUser()
  if (uerr || !user) throw new Error('Not authenticated')

  const urls: string[] = []
  for (const f of files) {
    const filename = `${crypto.randomUUID()}-${f.name.replace(/\s+/g, '_')}`
    const path = `${user.id}/${filename}`
    const { error } = await supabase.storage.from('post_images').upload(path, f, {
      cacheControl: '3600', upsert: false
    })
    if (error) throw error
    const { data } = supabase.storage.from('post_images').getPublicUrl(path)
    // Guardamos ya normalizada para móvil
    urls.push(normalizeImageUrl(data.publicUrl, 1280))
  }
  return urls
}

/* --------------------------------- Crear post -------------------------------- */
export async function createPost(input: {
  record_id: string
  era: string
  caption?: string
  image_urls?: string[]
}) {
  const { data: authData, error: authErr } = await supabase.auth.getSession()
  if (authErr || !authData?.session?.user) throw new Error('Not authenticated')
  const user = authData.session.user

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: user.id,
      record_id: input.record_id,
      era: input.era,
      caption: input.caption ?? null,
      // si vienen URLs desde otro flujo, las normalizamos también
      image_urls: normalizeImageArray(input.image_urls, 1280)
    })
    .select(`
      *,
      record:records(id, title, cover_url, artist_name, vibe_color, cover_color),
      author:profiles(username, avatar_url),
      post_likes(count),
      post_comments(count)
    `)
    .single()

  if (error) throw error

  return {
    ...(data as any),
    // garantizamos URLs normalizadas al devolver
    image_urls: normalizeImageArray((data as any)?.image_urls, 1080),
    likes_count: (data as any)?.post_likes?.[0]?.count ?? 0,
    comments_count: (data as any)?.post_comments?.[0]?.count ?? 0
  } as PostWithCounts
}

/* ------------------------------- Likes & comments ------------------------------ */
export async function toggleLike(post_id: string) {
  const { data, error } = await supabase.rpc('toggle_post_like', { p_post_id: post_id })
  if (error) throw error
  return data?.[0] ?? { liked: false, total_likes: 0 }
}

export async function addComment(post_id: string, comment: string) {
  const { error } = await supabase.from('post_comments').insert({ post_id, comment })
  if (error) throw error
}

export async function listComments(post_id: string) {
  const { data, error } = await supabase
    .from('post_comments')
    .select(`id, comment, created_at, author:profiles(username, avatar_url)`)
    .eq('post_id', post_id)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

/* ----------------------------------- Queries ---------------------------------- */
export async function searchRecords(q: string) {
  const term = q.trim()
  if (!term) return []
  // Busca por título O artista; trae siempre los colores para la mini-cover
  const { data, error } = await supabase
    .from('records')
    .select('id, title, artist_name, cover_url, vibe_color, cover_color')
    .or(`title.ilike.%${term}%,artist_name.ilike.%${term}%`)
    .order('title', { ascending: true })
    .limit(12)

  if (error) {
    console.error('searchRecords error:', error)
    return []
  }
  return data || []
}

export async function getPostsByRecordId(recordId: string) {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      record:records(id, title, cover_url, artist_name, vibe_color, cover_color),
      author:profiles(username, avatar_url),
      post_likes(count),
      post_comments(count)
    `)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false })
  if (error) throw error

  return (data ?? []).map((p: any) => ({
    ...p,
    image_urls: normalizeImageArray(p?.image_urls, 1080),
    likes_count: p?.post_likes?.[0]?.count ?? 0,
    comments_count: p?.post_comments?.[0]?.count ?? 0
  })) as PostWithCounts[]
}

export async function getPostsByUsernameGroupedByEra(username: string) {
  const { data: prof, error: perr } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('username', username)
    .single()
  if (perr || !prof) throw perr ?? new Error('profile not found')

  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      record:records(id, title, cover_url, artist_name, vibe_color, cover_color),
      author:profiles(username, avatar_url),
      post_likes(count),
      post_comments(count)
    `)
    .eq('user_id', prof.user_id)
    .order('created_at', { ascending: false })
  if (error) throw error

  const grouped: Record<string, PostWithCounts[]> = {}
  ;(data ?? []).forEach((p: any) => {
    const key = p.era || 'From my twenties'
    const item: PostWithCounts = {
      ...p,
      image_urls: normalizeImageArray(p?.image_urls, 1080),
      likes_count: p?.post_likes?.[0]?.count ?? 0,
      comments_count: p?.post_comments?.[0]?.count ?? 0
    }
    grouped[key] = grouped[key] ? [...grouped[key], item] : [item]
  })
  return grouped
}

export async function getUserPostsGroupedByEra(user_id: string) {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      record:records(id, title, cover_url, artist_name, vibe_color, cover_color),
      author:profiles(username, avatar_url),
      post_likes(count),
      post_comments(count)
    `)
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
  if (error) throw error

  const grouped: Record<string, PostWithCounts[]> = {}
  ;(data ?? []).forEach((p: any) => {
    const key = p.era || 'From my twenties'
    const item: PostWithCounts = {
      ...p,
      image_urls: normalizeImageArray(p?.image_urls, 1080),
      likes_count: p?.post_likes?.[0]?.count ?? 0,
      comments_count: p?.post_comments?.[0]?.count ?? 0
    }
    grouped[key] = grouped[key] ? [...grouped[key], item] : [item]
  })
  return grouped
}

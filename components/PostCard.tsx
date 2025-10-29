'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type Props = { post: any }

const cap = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')

/** Línea 18–22 — UTIL: confirm seguro para web/app */
function safeConfirm(message: string): boolean {
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm(message)
  }
  // En apps/WebView donde no existe window.confirm, seguimos adelante.
  return true
}

/** Líneas 24–28 — NUEVO: alert seguro para web/app */
function safeAlert(message: string) {
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(message)
  } else {
    // En entornos sin alert, al menos registramos
    // eslint-disable-next-line no-console
    console.warn('ALERT:', message)
  }
}

export default function PostCard({ post }: Props) {
  const isConcert =
    !!post?.artist_id || !!post?.country_code || !!post?.event_date || !!post?.cover_url

  const [bgUrl, setBgUrl] = useState<string | null>(post?.cover_url ?? post?.image_urls?.[0] ?? null)
  const [vibe, setVibe] = useState<string | null>(post?.record?.vibe_color ?? null)
  const [cover, setCover] = useState<string | null>(post?.record?.cover_color ?? null)
  const [artistName, setArtistName] = useState<string | null>(post?.artist_name ?? null)
  const [countryName, setCountryName] = useState<string | null>(post?.country_name ?? null)

  const [menuOpen, setMenuOpen] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reported, setReported] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    let alive = true
    async function hydrateConcert() {
      if (!isConcert) return
      const concertId = post?.id

      if (!bgUrl && concertId) {
        const { data: m } = await supabase
          .from('concert_media')
          .select('url, media_type')
          .eq('concert_id', concertId)
          .order('created_at', { ascending: true })
          .limit(1)
        if (alive && m?.length) setBgUrl(m[0].url)
      }

      if (!artistName && post?.artist_id) {
        const { data: a } = await supabase.from('artists').select('name').eq('id', post.artist_id).single()
        if (alive && a?.name) setArtistName(a.name)
      }

      if (!countryName && post?.country_code) {
        const { data: c } = await supabase.from('countries').select('name').eq('code', post.country_code).single()
        if (alive && c?.name) setCountryName(c.name)
      }

      if ((!vibe || !cover) && (post?.artist_id || artistName)) {
        let rc = (await supabase
          .from('records')
          .select('vibe_color, cover_color')
          .eq('artist_id', post.artist_id || '00000000-0000-0000-0000-000000000000')
          .not('vibe_color', 'is', null)
          .limit(1)).data

        if ((!rc || !rc.length) && (artistName || post?.artist_name)) {
          const like = artistName || post?.artist_name
          rc = (await supabase
            .from('records')
            .select('vibe_color, cover_color')
            .ilike('artist_name', `%${like}%`)
            .not('vibe_color', 'is', null)
            .limit(1)).data
        }

        if (alive && rc?.length) {
          if (!vibe && rc[0].vibe_color) setVibe(rc[0].vibe_color)
          if (!cover && rc[0].cover_color) setCover(rc[0].cover_color)
        }
      }
    }
    hydrateConcert()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConcert, post?.id, post?.artist_id, artistName, countryName, bgUrl])

  // Compat: posts antiguos (por record_id)
  useEffect(() => {
    let active = true
    ;(async () => {
      if (vibe && cover) return
      if (!post?.record_id) return
      const { data } = await supabase.from('records').select('vibe_color, cover_color').eq('id', post.record_id).single()
      if (!active) return
      if (data) {
        if (!vibe && data.vibe_color) setVibe(data.vibe_color)
        if (!cover && data.cover_color) setCover(data.cover_color)
      }
    })()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.record_id])

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const ownerId = (post as any).user_id ?? (post as any).author_id ?? (post as any).profile_id ?? null
      if (user && ownerId && user.id === ownerId) setIsOwner(true)
    })()
  }, [post])

  const href = `/post/${post.id}`
  const vibeSafe = useMemo(() => vibe || '#0E1A3A', [vibe])
  const coverSafe = useMemo(() => cover || '#FFFFFF', [cover])

  function toggleMenu(e: React.MouseEvent) { e.preventDefault(); e.stopPropagation(); setMenuOpen(s => !s) }

  /** Línea 92 — usar safeConfirm en report */
  async function handleReport(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (reported || reporting) return
    const ok = safeConfirm('Report this post?')  // <— cambio
    if (!ok) return
    try {
      setReporting(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { safeAlert('Please sign in to report.'); return } // <— línea 108
      await supabase.from('reports').insert({ user_id: user.id, post_id: post.id, reason: 'inappropriate' })
      setReported(true); setMenuOpen(false)
    } catch { safeAlert('Could not send report. Please try again.') } // <— línea 116
    finally { setReporting(false) }
  }

  /** Línea 103 — usar safeConfirm en delete */
  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (!isOwner || deleting) return
    const ok = safeConfirm('Delete this post? This cannot be undone.') // <— cambio
    if (!ok) return
    try {
      setDeleting(true)
      const { data: { session } } = await supabase.auth.getSession()

      // ⬇️ Corrección: endpoint y payload según sea post o concert
      const endpoint = isConcert ? '/api/delete-concert' : '/api/delete-post'
      const payload = isConcert ? { concertId: post.id } : { postId: post.id }

      // ⬇️ LÍNEA 122 — Construir URL ABSOLUTA para app/web
      const base =
        typeof window !== 'undefined'
          ? window.location.origin
          : (process.env.NEXT_PUBLIC_SITE_URL || '')
      const fullUrl = `${base}${endpoint}`

      const resp = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify(payload)
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        // eslint-disable-next-line no-console
        console.error('delete error:', json)
        safeAlert((json as any)?.error || 'Could not delete this post.') // <— línea 126
        return
      }
      setMenuOpen(false)
      if (typeof window !== 'undefined') window.location.reload()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err)
      safeAlert('Could not delete this post.') // <— línea 130
    } finally {
      setDeleting(false)
    }
  }

  // 👇 Encabezado: usar categoría cuando exista (post.experience || post.experience_type)
  const experience = post?.experience || post?.experience_type || null
  const headerLeft = experience ? cap(experience) : (artistName || 'Concert')

  return (
    <Link href={href} aria-label={`Open post ${post.id}`}>
      <article className="group relative aspect-square overflow-hidden rounded-2xl bg-neutral-100 shadow-sm hover:shadow transition-all hover:scale-[1.01] cursor-pointer w-full">
        {/* ⋯ */}
        <button type="button" onClick={toggleMenu} aria-label={menuOpen ? 'Close menu' : 'More options'}
          className="absolute z-20 top-2 right-2 h-8 w-8 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/40 text-white text-base backdrop-blur-sm">
          {menuOpen ? '×' : '⋯'}
        </button>

        {menuOpen && (
          <div className="absolute z-20 top-10 right-2 rounded-md bg-black/70 text-white text-xs backdrop-blur-sm shadow-sm overflow-hidden"
               onClick={(e)=>{e.preventDefault();e.stopPropagation();}}>
            <button type="button" onClick={handleReport} className="block w-full px-3 py-2 text-left hover:bg-white/10">
              {reported ? 'Reported ✓' : (reporting ? 'Reporting…' : 'Report')}
            </button>
            {isOwner && (
              <button type="button" onClick={handleDelete} className="block w-full px-3 py-2 text-left hover:bg-white/10">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
        )}

        {bgUrl && <img src={bgUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-black/10" />

        {/* Bloque colores */}
        <div className="absolute bottom-2 right-2 md:bottom-3 md:right-3 rounded-xl shadow-md"
             style={{ width: '80px', height: '80px', backgroundColor: vibeSafe }}>
          <div className="absolute rounded-[6px]" style={{ inset: '26%', backgroundColor: coverSafe }} />
        </div>

        {/* Overlay Artist / Country */}
        {(headerLeft || countryName) && (
          <div className="pointer-events-none absolute left-2 bottom-2 md:left-3 md:bottom-3 rounded-lg bg-black/55 text-white px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
               style={{ fontFamily: 'Roboto, Arial, sans-serif' }}>
            {headerLeft && <div className="text-[0.82rem] leading-[1.1]">{headerLeft}</div>}
            {countryName && <div className="mt-0.5 text-[0.7rem] opacity-90">{countryName}</div>}
          </div>
        )}
      </article>
    </Link>
  )
}

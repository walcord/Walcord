'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { PostWithCounts } from '../lib/posts'
import { supabase } from '../lib/supabaseClient'

type Props = { post: PostWithCounts }

export default function PostCard({ post }: Props) {
  const [vibe, setVibe] = useState<string | null>(post.record?.vibe_color ?? null)
  const [cover, setCover] = useState<string | null>(post.record?.cover_color ?? null)

  // --- minimal report/delete state ---
  const [menuOpen, setMenuOpen] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reported, setReported] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    let active = true
    async function ensureColors() {
      if (vibe && cover) return
      if (!post.record_id) return
      const { data, error } = await supabase
        .from('records')
        .select('vibe_color, cover_color')
        .eq('id', post.record_id)
        .single()
      if (!active) return
      if (!error && data) {
        if (!vibe && data.vibe_color) setVibe(data.vibe_color)
        if (!cover && data.cover_color) setCover(data.cover_color)
      }
    }
    ensureColors()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.record_id])

  // detectar si el post es del usuario actual (intenta varias claves comunes)
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const ownerId =
        (post as any).user_id ??
        (post as any).author_id ??
        (post as any).profile_id ??
        null
      if (user && ownerId && user.id === ownerId) setIsOwner(true)
    })()
  }, [post])

  const bg = post.image_urls?.[0] || null
  const href = `/post/${post.id}`

  const vibeSafe = useMemo(() => vibe || '#222222', [vibe])
  const coverSafe = useMemo(() => cover || '#FFFFFF', [cover])

  // --- actions (paran navegación del Link) ---
  function toggleMenu(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen((s) => !s)
  }

  async function handleReport(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (reported || reporting) return
    const ok = window.confirm('Report this post?')
    if (!ok) return
    try {
      setReporting(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Please sign in to report.')
        return
      }
      await supabase.from('reports').insert({
        user_id: user.id,
        post_id: post.id,
        reason: 'inappropriate'
      })
      setReported(true)
      setMenuOpen(false)
    } catch {
      alert('Could not send report. Please try again.')
    } finally {
      setReporting(false)
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!isOwner || deleting) return
    const ok = window.confirm('Delete this post? This cannot be undone.')
    if (!ok) return
    try {
      setDeleting(true)
      // 🔒 Server-side: borra post + dependencias + archivos de Storage (si aplica)
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/api/delete-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ postId: post.id })
      })
      const json = await resp.json()
      if (!resp.ok) {
        console.error('delete-post error:', json)
        alert(json?.error || 'Could not delete this post.')
        return
      }
      setMenuOpen(false)
      // refresco simple del feed
      window.location.reload()
    } catch (err) {
      console.error(err)
      alert('Could not delete this post.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Link href={href} aria-label={`Open post ${post.id}`}>
      <article
        className="
          relative aspect-square overflow-hidden rounded-2xl
          bg-neutral-100 shadow-sm hover:shadow transition-all
          hover:scale-[1.01] cursor-pointer
          w-full
        "
      >
        {/* Botón minimal (⋯) */}
        <button
          type="button"
          onClick={toggleMenu}
          aria-label={menuOpen ? 'Close menu' : 'More options'}
          className="
            absolute z-20 top-2 right-2 h-8 w-8
            flex items-center justify-center
            rounded-full bg-black/30 hover:bg-black/40
            text-white text-base backdrop-blur-sm
          "
        >
          {menuOpen ? '×' : '⋯'}
        </button>

        {/* Mini-menú minimalista */}
        {menuOpen && (
          <div
            className="
              absolute z-20 top-10 right-2
              rounded-md bg-black/70 text-white text-xs
              backdrop-blur-sm shadow-sm overflow-hidden
            "
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <button
              type="button"
              onClick={handleReport}
              className="block w-full px-3 py-2 text-left hover:bg-white/10"
              aria-label="Report post"
            >
              {reported ? 'Reported ✓' : (reporting ? 'Reporting…' : 'Report')}
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={handleDelete}
                className="block w-full px-3 py-2 text-left hover:bg-white/10"
                aria-label="Delete post"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
        )}

        {/* Fondo (foto) */}
        {bg && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bg} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {/* Velo sutil para contraste */}
        <div className="absolute inset-0 bg-black/10" />

        {/* COVER del disco */}
        <div
          className="absolute bottom-2 right-2 md:bottom-3 md:right-3 rounded-xl shadow-md"
          style={{ width: '80px', height: '80px', backgroundColor: vibeSafe }}
          title={post.record?.title || 'record'}
        >
          <div
            className="absolute rounded-[6px]"
            style={{ inset: '26%', backgroundColor: coverSafe }}
          />
        </div>
      </article>
    </Link>
  )
}

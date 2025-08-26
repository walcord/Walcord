'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { PostWithCounts } from '../lib/posts'
import { supabase } from '../lib/supabaseClient'

type Props = { post: PostWithCounts }

export default function PostCard({ post }: Props) {
  const [vibe, setVibe] = useState<string | null>(post.record?.vibe_color ?? null)
  const [cover, setCover] = useState<string | null>(post.record?.cover_color ?? null)

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

  const bg = post.image_urls?.[0] || null
  const href = `/post/${post.id}`

  const vibeSafe = useMemo(() => vibe || '#222222', [vibe])
  const coverSafe = useMemo(() => cover || '#FFFFFF', [cover])

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

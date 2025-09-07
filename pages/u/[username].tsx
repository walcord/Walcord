'use client';

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import PostCard from '../../components/PostCard'
import PublicUserHeader from '../../components/profile/PublicUserHeader'

type EraMap = Record<string, any[]>

export default function ExternalProfilePage() {
  const router = useRouter()
  const { username } = router.query as { username?: string }

  const [targetUserId, setTargetUserId] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const [postsLoading, setPostsLoading] = useState(true)
  const [posts, setPosts] = useState<any[]>([])
  const [eraOrder] = useState([
    'From my childhood','From my teenage years','From my twenties','From my thirties','From my forties',
    'From my fifties','From my sixties','From my seventies','From my eighties','From my nineties',
  ])

  // username → id
  useEffect(() => {
    if (!username) return
    const run = async () => {
      const { data, error } = await supabase.from('profiles').select('id').eq('username', username).single()
      if (error || !data?.id) return router.replace('/feed')
      setTargetUserId(data.id)
      setProfileLoading(false)
    }
    run()
  }, [username, router])

  // posts
  useEffect(() => {
    if (!targetUserId) return

    const fetchPosts = async () => {
      setPostsLoading(true)
      const { data } = await supabase
        .from('posts')
        .select(`
          *,
          record:records(id, title, cover_url, artist_name),
          author:profiles(username, avatar_url),
          post_likes(count),
          post_comments(count)
        `)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })

      const normalized = (data || []).map((p: any) => ({
        ...p,
        likes_count: p?.post_likes?.[0]?.count ?? 0,
        comments_count: p?.post_comments?.[0]?.count ?? 0,
      }))
      setPosts(normalized)
      setPostsLoading(false)
    }

    void fetchPosts() // ✅ evita devolver promesas en useEffect

    const ch = supabase
      .channel('external-profile-posts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts', filter: `user_id=eq.${targetUserId}` },
        () => { void fetchPosts() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
  }, [targetUserId])

  const groupedByEra: EraMap = useMemo(() => {
    const g: EraMap = {}
    for (const p of posts) {
      const key = p.era || 'From my twenties'
      g[key] = g[key] ? [...g[key], p] : [p]
    }
    const ordered: EraMap = {}
    const seen = new Set<string>()
    for (const label of eraOrder) if (g[label]) { ordered[label] = g[label]; seen.add(label) }
    Object.keys(g).filter((k) => !seen.has(k)).sort().forEach((k) => (ordered[k] = g[k]))
    return ordered
  }, [posts, eraOrder])

  if (profileLoading || !targetUserId) {
    return <div className="min-h-screen flex items-center justify-center text-black bg-white"><p>Loading profile…</p></div>
  }

  return (
    <main className="min-h-screen bg-white text-black font-[Roboto]">
      {/* Banner azul con flecha minimalista pegada abajo (h-24, sin logo) */}
      <header className="w-full h-24 bg-[#1F48AF] flex items-end px-4 sm:px-6 pb-2">
        <button
          onClick={() => history.back()}
          aria-label="Go back"
          className="p-2 rounded-full hover:bg-[#1A3A95] transition"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </header>

      {/* Título */}
      <div className="w-full px-10 sm:px-12 mt-6 mb-8 relative">
        <h1 className="text-[clamp(1.8rem,4.5vw,2.375rem)] font-normal" style={{ fontFamily: 'Times New Roman, serif' }}>Profile</h1>
        <hr className="mt-2 border-t border-black/50" />
      </div>

      {/* Layout */}
      <div className="px-10 sm:px-12 grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-10 items-start">
        <div className="m-0 p-0">
          <PublicUserHeader userId={targetUserId} />
        </div>

        <aside className="m-0 p-0">
          <h2 className="text-[clamp(1.1rem,2vw,1.5rem)] font-light mb-1">Memories</h2>

          {postsLoading ? (
            <div className="mt-4 text-sm text-neutral-600">Loading posts…</div>
          ) : Object.keys(groupedByEra).length === 0 ? (
            <div className="mt-4 text-sm text-neutral-600">No memories yet.</div>
          ) : (
            Object.keys(groupedByEra).map((era) => (
              <section key={era} className="mt-7">
                <div className="flex items-center">
                  <div className="text-[0.78rem] tracking-[0.14em] uppercase text-neutral-500">{era}</div>
                  <div className="h-px flex-1 ml-6 bg-black/10" />
                </div>
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-7">
                  {groupedByEra[era].map((p) => (
                    <PostCard key={p.id} post={p} />
                  ))}
                </div>
              </section>
            ))
          )}
        </aside>
      </div>
    </main>
  )
}

// --- SSR para evitar getStaticPaths/getStaticProps ---
export async function getServerSideProps() { return { props: {} }; }

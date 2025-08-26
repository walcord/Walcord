'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Image from 'next/image';
import { useRouter } from 'next/router';
import UserHeader from '../UserHeader';
import PostCard from '../../components/PostCard';
import { useAuthReady } from '../../lib/useAuthReady';

export default function ProfilePage() {
  const router = useRouter();
  const { ready: authReady, user: authUser } = useAuthReady();

  // Perfil visto (por username de la URL)
  const [viewedProfile, setViewedProfile] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Posts del perfil visto
  const [postsLoading, setPostsLoading] = useState(true);
  const [posts, setPosts] = useState<any[]>([]);

  const [eraOrder] = useState([
    'From my childhood',
    'From my teenage years',
    'From my twenties',
    'From my thirties',
    'From my forties',
    'From my fifties',
    'From my sixties',
    'From my seventies',
    'From my eighties',
    'From my nineties',
  ]);

  const usernameParam = (router.isReady ? router.query.username : undefined) as string | undefined;

  // ===== 1) Cargar perfil por username (público) =====
  useEffect(() => {
    if (!router.isReady || !usernameParam) return;
    let alive = true;

    (async () => {
      setProfileLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, genre1, genre2, favourite_color_1, favourite_color_2')
        .ilike('username', usernameParam)
        .maybeSingle();

      if (!alive) return;
      if (error || !data) {
        setViewedProfile(null);
        setProfileLoading(false);
        return;
      }
      setViewedProfile(data);
      setProfileLoading(false);
    })();

    return () => { alive = false; };
  }, [router.isReady, usernameParam]);

  // ===== 2) Cargar posts del usuario visto =====
  useEffect(() => {
    if (!viewedProfile?.id) return;
    let alive = true;

    const fetchPosts = async () => {
      setPostsLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          record:records(id, title, cover_url, artist_name),
          author:profiles(username, avatar_url),
          post_likes(count),
          post_comments(count)
        `)
        .eq('user_id', viewedProfile.id)
        .order('created_at', { ascending: false });

      if (!alive) return;

      if (error) {
        setPosts([]);
      } else {
        const normalized = (data || []).map((p: any) => ({
          ...p,
          likes_count: p?.post_likes?.[0]?.count ?? 0,
          comments_count: p?.post_comments?.[0]?.count ?? 0,
        }));
        setPosts(normalized);
      }
      setPostsLoading(false);
    };

    fetchPosts();

    const channel = supabase
      .channel('posts-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts', filter: `user_id=eq.${viewedProfile.id}` },
        () => fetchPosts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      alive = false;
    };
  }, [viewedProfile?.id]);

  // Agrupar por era
  const groupedByEra = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const p of posts) {
      const key = p.era || 'From my twenties';
      g[key] = g[key] ? [...g[key], p] : [p];
    }
    const ordered: Record<string, any[]> = {};
    const seen = new Set<string>();
    for (const label of eraOrder) {
      if (g[label]) {
        ordered[label] = g[label];
        seen.add(label);
      }
    }
    Object.keys(g)
      .filter((k) => !seen.has(k))
      .sort()
      .forEach((k) => (ordered[k] = g[k]));
    return ordered;
  }, [posts, eraOrder]);

  // ==== Derivados: dueño o visitante ====
  const isOwner = !!(authReady && authUser?.id && viewedProfile?.id && authUser.id === viewedProfile.id);

  // ===== Render =====
  if (!router.isReady || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black bg-white">
        <p>Loading profile...</p>
      </div>
    );
  }

  if (!viewedProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black bg-white">
        <p>Profile not found.</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black font-[Roboto]">
      {/* Banner */}
      <div className="w-full h-20 flex items-center justify-between px-12 bg-[#1F48AF]">
        <Image src="/logotipo.png" alt="Walcord Logo" width={62} height={62} />
        {/* Botón The Wall a la derecha — enlace simple */}
        <a
          href="/feed"
          aria-label="Back to The Wall"
          className="inline-flex items-center gap-2 rounded-full bg-white/95 text-black px-3 py-1.5 text-xs border border-white/60 hover:bg-white transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M19 12H5m6 7l-7-7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="hidden sm:inline">The Wall</span>
        </a>
      </div>

      {/* Título + línea + botón (+ condicional) */}
      <div className="w-full px-10 sm:px-12 mt-6 mb-8 relative">
        <h1
          className="text-[clamp(1.8rem,4.5vw,2.375rem)] font-normal"
          style={{ fontFamily: 'Times New Roman, serif' }}
        >
          Profile
        </h1>
        <hr className="mt-2 border-t border-black/50" />
        {isOwner && (
          <a
            href="/post/new"
            className="absolute right-10 sm:right-12 top-full mt-7 h-10 w-10 rounded-full bg-[#1F48AF] text-white flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 transition-transform duration-300 z-10"
            aria-label="Create post"
            title="Create post"
          >
            <span className="text-2xl leading-none font-light">+</span>
          </a>
        )}
      </div>

      {/* Layout */}
      <div className="px-10 sm:px-12 grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-10 items-start">
        <div className="m-0 p-0">
          <UserHeader {...({ viewedUserId: viewedProfile.id, isOwner } as any)} />
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
                  <div className="text-[0.78rem] tracking-[0.14em] uppercase text-neutral-500">
                    {era}
                  </div>
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
  );
}

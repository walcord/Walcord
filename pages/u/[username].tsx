'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/router';
import PublicUserHeader from '../../components/profile/PublicUserHeader';
import PostCard from '../../components/PostCard';
import MusicCollectionPostCard from '../../components/MusicCollectionPostCard';

type CardRow = {
  id: string; // concert_id
  user_id: string;
  artist_id: string | null;
  artist_name: string | null;
  country_code: string | null;
  country_name: string | null;
  city: string | null;
  event_date: string | null; // ISO
  cover_url: string | null;
};

export default function ExternalProfilePage() {
  const router = useRouter();
  const { username } = router.query as { username?: string };

  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [concertsLoading, setConcertsLoading] = useState(true);
  const [concerts, setConcerts] = useState<CardRow[]>([]);

  const [collectionLoading, setCollectionLoading] = useState(true);
  const [collectionPosts, setCollectionPosts] = useState<any[]>([]);

  // Tabs internas del perfil (Musical Memories / Music Collection)
  const [activeTab, setActiveTab] = useState<'memories' | 'collection'>('memories');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollSyncTimeout = useRef<any>(null);
  const isAutoScrolling = useRef(false);

  // Sincronizar scroll horizontal con el tab activo
  useEffect(() => {
    if (!scrollRef.current) return;

    isAutoScrolling.current = true;

    if (activeTab === 'memories') {
      scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      const width = scrollRef.current.clientWidth;
      scrollRef.current.scrollTo({ left: width, behavior: 'smooth' });
    }

    const reset = setTimeout(() => {
      isAutoScrolling.current = false;
    }, 350);

    return () => clearTimeout(reset);
  }, [activeTab]);

  const handleHorizontalScroll = () => {
    const el = scrollRef.current;
    if (!el) return;

    // Si el scroll lo ha provocado el click del tab (scrollTo smooth), no resincro
    if (isAutoScrolling.current) return;

    if (scrollSyncTimeout.current) clearTimeout(scrollSyncTimeout.current);

    scrollSyncTimeout.current = setTimeout(() => {
      const width = el.clientWidth || 1;
      const next = el.scrollLeft >= width / 2 ? 'collection' : 'memories';

      setActiveTab((prev) => (prev === next ? prev : (next as any)));
    }, 80);
  };

  useEffect(() => {
    return () => {
      if (scrollSyncTimeout.current) clearTimeout(scrollSyncTimeout.current);
    };
  }, []);

  /* ===== username → user_id ===== */
  useEffect(() => {
    if (!username) return;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();

      if (error || !data?.id) {
        router.replace('/feed');
        return;
      }

      setTargetUserId(data.id);
      setProfileLoading(false);
    })();
  }, [username, router]);

  /* ===== cargar CONCERTS del usuario (DESC por fecha) ===== */
  useEffect(() => {
    if (!targetUserId) return;

    const fetchConcerts = async () => {
      setConcertsLoading(true);

      const { data, error } = await supabase
        .from('concerts')
        .select(
          `
            id, user_id, artist_id, country_code, city, event_date,
            artists(name),
            countries(name),
            concert_media(url, created_at)
          `
        )
        .eq('user_id', targetUserId)
        .order('event_date', { ascending: false });

      if (error) {
        console.error('Error loading concerts (external profile)', error.message);
        setConcerts([]);
        setConcertsLoading(false);
        return;
      }

      const normalized: CardRow[] = (data || []).map((c: any) => {
        const latest =
          (c.concert_media || [])
            .filter((m: any) => !!m?.url)
            .sort(
              (a: any, b: any) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0]?.url ?? null;

        return {
          id: c.id,
          user_id: c.user_id,
          artist_id: c.artist_id,
          artist_name: c.artists?.name ?? null,
          country_code: c.country_code ?? null,
          country_name: c.countries?.name ?? null,
          city: c.city ?? null,
          event_date: c.event_date ?? null,
          cover_url: latest,
        };
      });

      setConcerts(normalized);
      setConcertsLoading(false);
    };

    void fetchConcerts();

    const ch = supabase
      .channel('external-profile-concerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'concerts', filter: `user_id=eq.${targetUserId}` },
        () => void fetchConcerts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [targetUserId]);

  /* ===== cargar MUSIC COLLECTION del usuario ===== */
  useEffect(() => {
    if (!targetUserId) return;

    const fetchCollection = async () => {
      setCollectionLoading(true);

      const { data, error } = await supabase
        .from('music_collections')
        .select('id, user_id, record_id, photo_url, caption, created_at')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading music collection', error.message);
        setCollectionPosts([]);
        setCollectionLoading(false);
        return;
      }

      setCollectionPosts(data ?? []);
      setCollectionLoading(false);
    };

    void fetchCollection();

    const ch = supabase
      .channel('external-profile-collection')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'music_collections', filter: `user_id=eq.${targetUserId}` },
        () => void fetchCollection()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [targetUserId]);

  /* ===== agrupar por año ===== */
  const groupsOrdered = useMemo(() => {
    const map = new Map<string, CardRow[]>();

    for (const c of concerts) {
      const year = c?.event_date ? new Date(c.event_date).getFullYear() : null;
      const key = year && year >= 1950 && year <= 2050 ? String(year) : 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }

    for (const [, arr] of map) {
      arr.sort(
        (a, b) => new Date(b.event_date || 0).getTime() - new Date(a.event_date || 0).getTime()
      );
    }

    const years = Array.from(map.keys())
      .filter((k) => k !== 'Unknown')
      .map(Number)
      .sort((a, b) => b - a)
      .map((n) => String(n));

    const ordered = years.map((y) => ({
      yearLabel: y,
      items: map.get(y)!,
    }));

    if (map.has('Unknown')) ordered.push({ yearLabel: 'Unknown', items: map.get('Unknown')! });

    return ordered;
  }, [concerts]);

  if (profileLoading || !targetUserId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black bg-white">
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black font-[Roboto] pb-[calc(env(safe-area-inset-bottom)+96px)]">
      {/* TOP — en móvil sin márgenes enormes (sin botón/settings en external) */}
      <div className="w-full px-5 sm:px-12 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-4 flex justify-end" />

      {/* MAIN LAYOUT — en móvil pegado a bordes, en desktop mantiene aire */}
      <div className="px-5 sm:px-12 grid grid-cols-1 lg:grid-cols-[1fr_1.35fr] gap-10 items-start">
        <div className="m-0 p-0">
          <PublicUserHeader userId={targetUserId} />
        </div>

        <div className="m-0 p-0">
          {/* Tabs: Musical Memories / Music Collection */}
          <div className="flex gap-6 text-[1rem] font-light mb-4 pl-1">
            <button
              className={`transition-all ${
                activeTab === 'memories'
                  ? 'text-black underline underline-offset-8'
                  : 'text-neutral-400'
              }`}
              onClick={() => setActiveTab('memories')}
            >
              Musical Memories
            </button>

            <button
              className={`transition-all ${
                activeTab === 'collection'
                  ? 'text-black underline underline-offset-8'
                  : 'text-neutral-400'
              }`}
              onClick={() => setActiveTab('collection')}
            >
              Music Collection
            </button>
          </div>

          {/* Contenedor horizontal tipo Instagram */}
          <div
            ref={scrollRef}
            onScroll={handleHorizontalScroll}
            className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar transition-all"
          >
            {/* PANEL 1 — MUSICAL MEMORIES */}
            <div className="snap-center min-w-full pr-0 sm:pr-10">
              <aside className="m-0 p-0">
                <div className="mt-[1.1rem]" />

                {concertsLoading ? (
                  <div className="mt-4 text-sm text-neutral-600">Loading memories…</div>
                ) : groupsOrdered.length === 0 ? (
                  <div className="mt-4 text-sm text-neutral-600">No musical memories yet.</div>
                ) : (
                  groupsOrdered.map(({ yearLabel, items }) => (
                    <section key={yearLabel} className="mt-6">
                      <div className="flex items-center">
                        <div className="text-[0.75rem] tracking-[0.14em] uppercase text-neutral-500">
                          {yearLabel}
                        </div>
                        <div className="h-px flex-1 ml-6 bg-black/10" />
                      </div>

                      {/* ✅ 2 por fila en móvil, estilo IG */}
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-7">
                        {items.map((c) => (
                          <PostCard
                            key={c.id}
                            post={{
                              id: c.id,
                              user_id: c.user_id,
                              artist_id: c.artist_id,
                              artist_name: c.artist_name,
                              country_code: c.country_code,
                              country_name: c.country_name,
                              event_date: c.event_date,
                              cover_url: c.cover_url,
                            }}
                          />
                        ))}
                      </div>
                    </section>
                  ))
                )}
              </aside>
            </div>

            {/* PANEL 2 — MUSIC COLLECTION */}
            <div className="snap-center min-w-full pl-0 sm:pl-10">
              <aside className="m-0 p-0">
                <div className="mt-[1.1rem]" />

                {collectionLoading ? (
                  <div className="mt-4 text-sm text-neutral-600">Loading collection…</div>
                ) : collectionPosts.length === 0 ? (
                  <div className="mt-4 text-sm text-neutral-600">
                    No posts in your collection yet.
                  </div>
                ) : (
                  /* ✅ 2 por fila en móvil, 3 en desktop */
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6">
                    {collectionPosts.map((p) => (
                      <MusicCollectionPostCard key={p.id} post={p} />
                    ))}
                  </div>
                )}
              </aside>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// --- SSR para evitar getStaticPaths/getStaticProps ---
export async function getServerSideProps() {
  return { props: {} };
}

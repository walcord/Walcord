'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';
import UserHeader from './UserHeader';
import PostCard from '../components/PostCard';
import MusicCollectionPostCard from '../components/MusicCollectionPostCard';

export default function ProfilePage() {
  const router = useRouter();

  const [selectedGenres, setSelectedGenres] = useState([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  const [concertsLoading, setConcertsLoading] = useState(true);
  const [concerts, setConcerts] = useState([]);

  const [collectionLoading, setCollectionLoading] = useState(true);
  const [collectionPosts, setCollectionPosts] = useState([]);

  // Tabs internas del perfil (Musical Memories / Music Collection)
  const [activeTab, setActiveTab] = useState('memories');
  const scrollRef = useRef(null);
  const scrollSyncTimeout = useRef(null);
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

      setActiveTab((prev) => (prev === next ? prev : next));
    }, 80);
  };

  useEffect(() => {
    return () => {
      if (scrollSyncTimeout.current) clearTimeout(scrollSyncTimeout.current);
    };
  }, []);

  // ===== 1) Cargar perfil =====
  useEffect(() => {
    const initProfile = async () => {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError || !data?.user) {
        router.push('/login');
        return;
      }

      const uid = data.user.id;
      setUserId(uid);

      const { data: profile } = await supabase
        .from('profiles')
        .select('genre1, genre2, favourite_color_1, favourite_color_2')
        .eq('id', uid)
        .single();

      if (!profile?.favourite_color_1 || !profile?.favourite_color_2) {
        const { data: paletteData } = await supabase
          .from('color_palettes')
          .select('colors')
          .eq('name', 'Walcord Classic')
          .single();

        if (paletteData?.colors?.length) {
          const colors = [...paletteData.colors];
          const shuffled = colors.sort(() => 0.5 - Math.random());
          await supabase
            .from('profiles')
            .update({
              favourite_color_1: shuffled[0],
              favourite_color_2: shuffled[1],
            })
            .eq('id', uid);
        }
      }

      const selected = [profile?.genre1, profile?.genre2].filter(Boolean);
      setSelectedGenres(selected);
      setProfileLoading(false);
    };

    initProfile();
  }, [router]);

  // ===== 2) Cargar CONCERTS =====
  useEffect(() => {
    if (!userId) return;

    const fetchConcerts = async () => {
      setConcertsLoading(true);

      const { data: byView, error } = await supabase
        .from('v_concert_cards')
        .select(
          'concert_id, user_id, artist_id, artist_name, country_code, country_name, city, event_date, cover_url'
        )
        .eq('user_id', userId)
        .order('event_date', { ascending: false });

      if (error) {
        console.error('Error loading concerts from view', error.message);
        setConcerts([]);
        setConcertsLoading(false);
        return;
      }

      if (byView?.length) {
        setConcerts(
          byView.map((r) => ({
            id: r.concert_id,
            user_id: r.user_id,
            artist_id: r.artist_id,
            artist_name: r.artist_name,
            country_code: r.country_code,
            country_name: r.country_name ?? null,
            city: r.city,
            event_date: r.event_date,
            cover_url: r.cover_url,
          }))
        );
      } else {
        setConcerts([]);
      }

      setConcertsLoading(false);
    };

    fetchConcerts();
  }, [userId]);

  // ===== 2.5) Cargar MUSIC COLLECTION =====
  useEffect(() => {
    if (!userId) return;

    const fetchCollection = async () => {
      setCollectionLoading(true);

      const { data, error } = await supabase
        .from('music_collections')
        .select('id, user_id, record_id, photo_url, caption, created_at')
        .eq('user_id', userId)
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

    fetchCollection();
  }, [userId]);

  // ===== 3) Agrupar por año =====
  const groupsOrdered = useMemo(() => {
    const map = new Map();

    for (const c of concerts) {
      const year = c?.event_date ? new Date(c.event_date).getFullYear() : null;
      const key = year && year >= 1950 && year <= 2050 ? String(year) : 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    }

    for (const [, arr] of map) {
      arr.sort(
        (a, b) =>
          new Date(b.event_date || 0).getTime() - new Date(a.event_date || 0).getTime()
      );
    }

    const years = Array.from(map.keys())
      .filter((k) => k !== 'Unknown')
      .map(Number)
      .sort((a, b) => b - a)
      .map((n) => String(n));

    const ordered = years.map((y) => ({
      yearLabel: y,
      items: map.get(y),
    }));

    if (map.has('Unknown')) ordered.push({ yearLabel: 'Unknown', items: map.get('Unknown') });

    return ordered;
  }, [concerts]);

  // ===== 4) Render =====
  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black bg-white">
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black font-[Roboto]">
      {/* TOP — en móvil sin márgenes enormes */}
      <div className="w-full px-5 sm:px-12 pt-8 pb-4 flex justify-end">
        <button
          onClick={() => router.push('/settings')}
          aria-label="Open settings"
          title="Settings"
          className="flex flex-col items-end gap-[4px] cursor-pointer"
        >
          <span className="block w-[18px] h-[2px] bg-[#264AAE] rounded-full"></span>
          <span className="block w-[18px] h-[2px] bg-[#264AAE] rounded-full"></span>
          <span className="block w-[18px] h-[2px] bg-[#264AAE] rounded-full"></span>
        </button>
      </div>

      {/* MAIN LAYOUT — en móvil pegado a bordes, en desktop mantiene aire */}
      <div className="px-5 sm:px-12 grid grid-cols-1 lg:grid-cols-[1fr_1.35fr] gap-10 items-start">
        <div className="m-0 p-0">
          <UserHeader />
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

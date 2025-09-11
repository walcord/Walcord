'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import MiniConcertCard from './MiniConcertCard';
import type { ConcertPost } from './ConcertCardVinyl';

const PAGE_SIZE = 12;

type ExtendedPost = ConcertPost & {
  user_id?: string | null;
  _author?: { id: string; username?: string | null; name: string; avatar_url: string | null };
};

export default function TourFeed({ artist, tour }: { artist: string; tour: string }) {
  const supabase = useSupabaseClient();

  const [list, setList] = useState<ExtendedPost[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const fetchTokenRef = useRef(0);

  /** Fallback global: concert_photos + concerts (ignora tabs/sesión) */
  const fallbackBuild = async (): Promise<ExtendedPost[]> => {
    // Traemos últimas 800 fotos para tener margen
    const { data: ph } = await supabase
      .from('concert_photos')
      .select('id, user_id, concert_id, image_url, created_at')
      .order('created_at', { ascending: false })
      .limit(800);

    if (!ph?.length) return [];

    const firstByConcert: Record<string, { anchor: any; urls: string[]; last_at: string; user_id: string | null }> = {};
    for (const p of ph) {
      const cid = p.concert_id as string;
      if (!firstByConcert[cid]) {
        firstByConcert[cid] = { anchor: p, urls: [p.image_url], last_at: p.created_at, user_id: (p.user_id as string) ?? null };
      } else if (firstByConcert[cid].urls.length < 12) {
        firstByConcert[cid].urls.push(p.image_url);
        if (p.created_at > firstByConcert[cid].last_at) firstByConcert[cid].last_at = p.created_at;
      }
    }

    const concertIds = Object.keys(firstByConcert);
    if (!concertIds.length) return [];

    const { data: concerts } = await supabase
      .from('concerts')
      .select('id, artist_name, tour, city, country, year')
      .in('id', concertIds);

    const cById = Object.fromEntries((concerts ?? []).map((c: any) => [c.id, c]));

    let posts: ExtendedPost[] = concertIds.map((cid) => {
      const meta = cById[cid] || {};
      const agg = firstByConcert[cid];
      return {
        post_id: cid,
        concert_id: cid,
        anchor_photo_id: agg.anchor.id,
        artist_name: meta.artist_name ?? null,
        tour: meta.tour ?? null,
        city: meta.city ?? null,
        country: meta.country ?? null,
        year: meta.year ?? null,
        image_urls: agg.urls,
        like_count: 0,
        comment_count: 0,
        created_at: agg.last_at,
        user_id: agg.user_id,
      };
    });

    // Filtro exacto por artista + tour
    const a = artist.toLowerCase();
    const t = tour.toLowerCase();
    posts = posts.filter(
      (p) => (p.artist_name || '').toLowerCase() === a && (p.tour || '').toLowerCase() === t
    );

    // Orden por más reciente (si quieres likes primero, cámbialo aquí)
    posts.sort((x, y) => (x.created_at > y.created_at ? -1 : 1));
    return posts;
  };

  const fetchPage = async () => {
    if (loading || done) return;
    setLoading(true);
    const myToken = ++fetchTokenRef.current;

    try {
      // Vista optimizada global por tour (sin tabs/sesión)
      let q = supabase
        .from('v_concert_posts')
        .select(
          'user_id, concert_id, artist_name, tour, city, country, year, anchor_photo_id, image_urls, like_count, comment_count, last_photo_at'
        )
        .eq('artist_name', artist)
        .eq('tour', tour)
        .order('last_photo_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      const { data, error } = await q;

      if (fetchTokenRef.current !== myToken) return;

      let rows: ExtendedPost[] = [];
      if (!error && data && data.length) {
        rows = (data as any[]).map((r) => ({
          post_id: r.concert_id,
          concert_id: r.concert_id,
          anchor_photo_id: r.anchor_photo_id,
          artist_name: r.artist_name,
          tour: r.tour,
          city: r.city,
          country: r.country,
          year: r.year,
          image_urls: Array.isArray(r.image_urls) ? r.image_urls : r.image_urls ? [r.image_urls] : [],
          like_count: r.like_count ?? 0,
          comment_count: r.comment_count ?? 0,
          created_at: r.last_photo_at,
          user_id: r.user_id ?? null,
        }));
      }

      // Fallback si la vista devuelve 0 (por RLS u otros)
      if (!rows.length) {
        const built = await fallbackBuild();
        if (fetchTokenRef.current !== myToken) return;
        rows = built.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
        if (!rows.length) setDone(true);
      }

      // Perfiles para mini-card
      let profilesMap: Record<string, { id: string; username?: string | null; name: string; avatar_url: string | null }> = {};
      const uids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
      if (uids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', uids);

        profilesMap = Object.fromEntries(
          (profs || []).map((p: any) => [
            p.id,
            {
              id: p.id,
              username: p.username ?? null,
              name: p.full_name || p.username || 'User',
              avatar_url: p.avatar_url || null,
            },
          ])
        );
      }

      // Anti-duplicados + enrich
      const filtered = rows.filter((p) => {
        if (seenIdsRef.current.has(p.concert_id)) return false;
        seenIdsRef.current.add(p.concert_id);
        return true;
      });

      const finalRows: ExtendedPost[] = filtered.map((p) => ({
        ...p,
        _author: p.user_id ? profilesMap[p.user_id] : undefined,
      }));

      setList((prev) => [...prev, ...finalRows]);
      setPage((p) => p + 1);
      if (!filtered.length) setDone(true);
      setLoadedOnce(true);
    } finally {
      if (fetchTokenRef.current === myToken) setLoading(false);
    }
  };

  // Reset al cambiar de tour
  useEffect(() => {
    seenIdsRef.current.clear();
    setList([]);
    setPage(0);
    setDone(false);
    setLoadedOnce(false);
    void fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artist, tour]);

  // Infinite scroll
  const onIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting) fetchPage();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, artist, tour]
  );

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(onIntersect, { rootMargin: '600px 0px' });
    obs.observe(node);
    return () => obs.disconnect();
  }, [onIntersect]);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
        {list.map((p) => (
          <div key={p.post_id} className="w-full">
            <MiniConcertCard
              image_urls={p.image_urls}
              authorId={p._author?.id}
              authorUsername={p._author?.username}
              authorName={p._author?.name}
              authorAvatar={p._author?.avatar_url || undefined}
            />
          </div>
        ))}
      </div>

      <div ref={sentinelRef} className="h-10" />

      {loading && <div className="text-center text-xs text-neutral-500 py-6">Loading…</div>}
      {!loading && loadedOnce && !list.length && (
        <div className="text-center text-neutral-600">No concerts yet.</div>
      )}
    </>
  );
}

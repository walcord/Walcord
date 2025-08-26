"use client";

import { useEffect, useRef, useState } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import ConcertCardVinyl, { ConcertPost } from "./ConcertCardVinyl";

const PAGE_SIZE = 8;

export default function ConcertFeed() {
  const supabase = useSupabaseClient();
  const [list, setList] = useState<ConcertPost[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set()); // anti-duplicados

  const fallbackBuild = async (): Promise<ConcertPost[]> => {
    const { data: ph } = await supabase
      .from("concert_photos")
      .select("id, user_id, concert_id, image_url, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!ph?.length) return [];

    const firstByConcert: Record<string, { anchor: any; urls: string[]; last_at: string }> = {};
    for (const p of ph) {
      const cid = p.concert_id as string;
      if (!firstByConcert[cid]) {
        firstByConcert[cid] = { anchor: p, urls: [p.image_url], last_at: p.created_at };
      } else if (firstByConcert[cid].urls.length < 12) {
        firstByConcert[cid].urls.push(p.image_url);
      }
    }

    const concertIds = Object.keys(firstByConcert);
    const { data: concerts } = await supabase
      .from("concerts")
      .select("id, artist_name, tour, city, country, year")
      .in("id", concertIds);

    const cById = Object.fromEntries((concerts ?? []).map((c: any) => [c.id, c]));

    const posts: ConcertPost[] = concertIds.map((cid) => {
      const anchor = firstByConcert[cid].anchor;
      const urls = firstByConcert[cid].urls;
      const meta = cById[cid] || {};
      return {
        post_id: cid,
        concert_id: cid,
        anchor_photo_id: anchor.id,
        artist_name: meta.artist_name ?? null,
        tour: meta.tour ?? null,
        city: meta.city ?? null,
        country: meta.country ?? null,
        year: meta.year ?? null,
        image_urls: urls,
        like_count: 0,
        comment_count: 0,
        created_at: firstByConcert[cid].last_at,
      };
    });

    posts.sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
    return posts;
  };

  const fetchPage = async () => {
    if (loading || done) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("v_concert_posts")
      .select(
        "concert_id, artist_name, tour, city, country, year, anchor_photo_id, image_urls, like_count, comment_count, last_photo_at"
      )
      .order("last_photo_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    let rows: ConcertPost[] = [];

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
        image_urls: Array.isArray(r.image_urls) ? r.image_urls : (r.image_urls ? [r.image_urls] : []),
        like_count: r.like_count ?? 0,
        comment_count: r.comment_count ?? 0,
        created_at: r.last_photo_at,
      }));
    } else {
      const built = await fallbackBuild();
      rows = built.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
      if (!rows.length) setDone(true);
    }

    // Filtro anti-duplicados por concert_id
    const filtered = rows.filter((p) => {
      if (seenIdsRef.current.has(p.concert_id)) return false;
      seenIdsRef.current.add(p.concert_id);
      return true;
    });

    setList((prev) => [...prev, ...filtered]);
    setPage((p) => p + 1);
    setLoading(false);
    if (!filtered.length) setDone(true);
  };

  useEffect(() => { fetchPage(); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && fetchPage(),
      { rootMargin: "600px" }
    );
    obs.observe(node);
    return () => obs.disconnect();
    // eslint-disable-next-line
  }, [sentinelRef.current]);

  return (
    <>
      <div className="flex flex-col gap-5 sm:gap-6">
        {list.map((p) => (
          <div key={p.post_id} className="mx-auto max-w-2xl w-full">
            <ConcertCardVinyl post={p} />
          </div>
        ))}
      </div>
      <div ref={sentinelRef} className="h-10" />
      {loading && <div className="text-center text-xs text-neutral-500 py-6">Loading…</div>}
      {!loading && !list.length && <div className="text-center text-neutral-600">No concerts yet.</div>}
    </>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import ConcertCardVinyl, { ConcertPost } from "./ConcertCardVinyl";
import MiniConcertCard from "./MiniConcertCard";

const PAGE_SIZE = 8;

type FeedMode = "followed" | "friends" | "for-you";

/** Post extendido (user_id opcional para evitar errores TS) */
type ExtendedConcertPost = ConcertPost & {
  user_id?: string | null;
  _author?: { id: string; username?: string | null; name: string; avatar_url: string | null };
};

export default function ConcertFeed({
  mode = "followed",
  tourFilter,
  smallCards = false,
}: {
  mode?: FeedMode;
  tourFilter?: { artist_name: string; tour: string };
  smallCards?: boolean;
}) {
  const supabase = useSupabaseClient();
  const user = useUser();

  const [list, setList] = useState<ExtendedConcertPost[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const visibleIdsRef = useRef<string[] | null>(null);
  const fetchTokenRef = useRef(0);

  /** 🔑 Clave de reset:
   *  - En FOR YOU ignoramos cambios de user.id (para no vaciar el feed al hidratar sesión).
   *  - En Followed/Friends sí dependemos de user.id.
   */
  const resetKey = useMemo(() => {
    const userKey = mode === "for-you" ? "ignoreUser" : user?.id ?? "nouser";
    const tfA = tourFilter?.artist_name ?? "";
    const tfT = tourFilter?.tour ?? "";
    return `${mode}|${userKey}|${tfA}|${tfT}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, user?.id, tourFilter?.artist_name, tourFilter?.tour]);

  /** IDs visibles según pestaña:
   *  - followed: SOLO seguidos (no te incluye a ti)
   *  - friends: SOLO amigos aceptados (ambos sentidos)
   *  - for-you: null => sin filtro por IDs
   */
  const getVisibleUserIds = async (): Promise<string[] | null> => {
    if (mode === "for-you") return null;
    if (!user?.id) return [];

    if (visibleIdsRef.current) return visibleIdsRef.current;

    if (mode === "followed") {
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);
      const ids = new Set<string>();
      (follows || []).forEach((r: any) => ids.add(r.following_id));
      visibleIdsRef.current = Array.from(ids);
      return visibleIdsRef.current;
    }

    // friends
    const [frA, frB] = await Promise.all([
      supabase
        .from("friendships")
        .select("receiver_id")
        .eq("requester_id", user.id)
        .eq("status", "accepted"),
      supabase
        .from("friendships")
        .select("requester_id")
        .eq("receiver_id", user.id)
        .eq("status", "accepted"),
    ]);

    const ids = new Set<string>();
    (frA.data || []).forEach((r: any) => ids.add(r.receiver_id));
    (frB.data || []).forEach((r: any) => ids.add(r.requester_id));
    visibleIdsRef.current = Array.from(ids);
    return visibleIdsRef.current;
  };

  /** Fallback desde concert_photos + concerts (con user_id para mini-card y filtro exacto por tour).
   *  Si hay tourFilter, IGNORAMOS ids de pestaña (búsqueda global).
   */
  const fallbackBuild = async (): Promise<ExtendedConcertPost[]> => {
    const ids = tourFilter ? null : await getVisibleUserIds();

    let q = supabase
      .from("concert_photos")
      .select("id, user_id, concert_id, image_url, created_at")
      .order("created_at", { ascending: false })
      .limit(400);

    if (ids && ids.length > 0) q = q.in("user_id", ids);

    const { data: ph } = await q;
    if (!ph?.length) return [];

    const firstByConcert: Record<
      string,
      { anchor: any; urls: string[]; last_at: string; user_id: string | null }
    > = {};
    for (const p of ph) {
      const cid = p.concert_id as string;
      if (!firstByConcert[cid]) {
        firstByConcert[cid] = {
          anchor: p,
          urls: [p.image_url],
          last_at: p.created_at,
          user_id: (p.user_id as string) ?? null,
        };
      } else if (firstByConcert[cid].urls.length < 12) {
        firstByConcert[cid].urls.push(p.image_url);
        if (p.created_at > firstByConcert[cid].last_at) firstByConcert[cid].last_at = p.created_at;
      }
    }

    const concertIds = Object.keys(firstByConcert);
    if (!concertIds.length) return [];

    const { data: concerts } = await supabase
      .from("concerts")
      .select("id, artist_name, tour, city, country, year")
      .in("id", concertIds);

    const cById = Object.fromEntries((concerts ?? []).map((c: any) => [c.id, c]));

    let posts: ExtendedConcertPost[] = concertIds.map((cid) => {
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
        user_id: firstByConcert[cid].user_id,
      };
    });

    if (tourFilter) {
      const a = tourFilter.artist_name.toLowerCase();
      const t = tourFilter.tour.toLowerCase();
      posts = posts.filter(
        (p) => (p.artist_name || "").toLowerCase() === a && (p.tour || "").toLowerCase() === t
      );
    }

    // Orden según pestaña
    posts.sort((x, y) => {
      if (mode === "for-you") {
        const lx = x.like_count ?? 0;
        const ly = y.like_count ?? 0;
        if (ly !== lx) return ly - lx; // likes primero
      }
      return x.created_at > y.created_at ? -1 : 1; // por fecha
    });

    return posts;
  };

  const fetchPage = async () => {
    if (loading || done) return;
    setLoading(true);
    const myToken = ++fetchTokenRef.current;

    try {
      // Si hay tourFilter, ignoramos ids (global)
      const ids = tourFilter ? null : await getVisibleUserIds();

      let q = supabase
        .from("v_concert_posts")
        .select(
          "user_id, concert_id, artist_name, tour, city, country, year, anchor_photo_id, image_urls, like_count, comment_count, last_photo_at"
        );

      // Orden según pestaña
      if (mode === "for-you") {
        q = q
          .order("like_count", { ascending: false, nullsFirst: false })
          .order("last_photo_at", { ascending: false });
      } else {
        q = q.order("last_photo_at", { ascending: false });
      }

      // Paginación
      q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      // Filtro por IDs visibles (solo si NO hay tourFilter)
      if (ids && ids.length > 0) q = q.in("user_id", ids);

      // Filtro exacto por tour
      if (tourFilter) q = q.eq("artist_name", tourFilter.artist_name).eq("tour", tourFilter.tour);

      const { data, error } = await q;

      if (fetchTokenRef.current !== myToken) return; // respuesta obsoleta

      let rows: ExtendedConcertPost[] = [];
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

      // Fallback si la vista no trae nada (o RLS)
      if (!rows.length) {
        const built = await fallbackBuild();
        if (fetchTokenRef.current !== myToken) return;
        rows = built.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
        if (!rows.length) setDone(true);
      }

      // Perfiles (mini-card)
      let profilesMap: Record<
        string,
        { id: string; username?: string | null; name: string; avatar_url: string | null }
      > = {};
      if (smallCards) {
        const uids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
        if (uids.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, username, full_name, avatar_url")
            .in("id", uids);

          profilesMap = Object.fromEntries(
            (profs || []).map((p: any) => [
              p.id,
              {
                id: p.id,
                username: p.username ?? null,
                name: p.full_name || p.username || "User",
                avatar_url: p.avatar_url || null,
              },
            ])
          );
        }
      }

      // Anti-duplicados por concert_id + enrich
      const filtered = rows.filter((p) => {
        if (seenIdsRef.current.has(p.concert_id)) return false;
        seenIdsRef.current.add(p.concert_id);
        return true;
      });

      const finalRows: ExtendedConcertPost[] = filtered.map((p) => ({
        ...p,
        _author: p.user_id ? profilesMap[p.user_id] : undefined,
      }));

      // 🔒 MERGE + REORDENAR SIEMPRE
      setList((prev) => {
        const map = new Map<string, ExtendedConcertPost>();
        [...prev, ...finalRows].forEach((r) => map.set(r.concert_id, r));
        const arr = Array.from(map.values());

        if (mode === "for-you") {
          // General: por likes desc y desempate por fecha (created_at)
          arr.sort((a, b) => {
            const dl = (b.like_count ?? 0) - (a.like_count ?? 0);
            if (dl !== 0) return dl;
            return (b.created_at || "").localeCompare(a.created_at || "");
          });
        } else {
          // Otras pestañas: reciente primero por created_at
          arr.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        }

        return arr;
      });

      setPage((p) => p + 1);
      if (!filtered.length) setDone(true);
      setLoadedOnce(true);
    } finally {
      if (fetchTokenRef.current === myToken) setLoading(false);
    }
  };

  /** 🔁 Reset TOTAL cuando cambie la clave calculada (evita parpadeo en FOR YOU al hidratar sesión) */
  useEffect(() => {
    seenIdsRef.current.clear();
    visibleIdsRef.current = null;
    setList([]);
    setPage(0);
    setDone(false);
    setLoadedOnce(false);

    // Cargamos SIEMPRE en:
    // - tourFilter activo (global)
    // - modo for-you (aunque no haya sesión)
    // - o cuando hay sesión (followed/friends)
    if (tourFilter || mode === "for-you" || user?.id) void fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // IntersectionObserver robusto
  const onIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting) fetchPage();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, resetKey]
  );

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(onIntersect, { rootMargin: "600px 0px" });
    obs.observe(node);
    return () => obs.disconnect();
  }, [onIntersect]);

  return (
    <>
      <div
        className={
          smallCards
            ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4"
            : "flex flex-col gap-5 sm:gap-6"
        }
      >
        {list.map((p) => (
          <div key={p.post_id} className={smallCards ? "w-full" : "mx-auto max-w-2xl w-full"}>
            {smallCards ? (
              <MiniConcertCard
                image_urls={p.image_urls}
                authorId={p._author?.id}
                authorUsername={p._author?.username}
                authorName={p._author?.name}
                authorAvatar={p._author?.avatar_url || undefined}
              />
            ) : (
              <ConcertCardVinyl post={p} />
            )}
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

'use client';

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";

/* ============================
   Tipos y utilidades
============================ */
type ProfileMini = { id: string; username: string | null; full_name?: string | null; avatar_url: string | null };
type Artist = { id: string; name: string; image_url?: string | null };

type RecordMini = {
  id: string;
  title: string;
  artist_name?: string | null;
  release_year?: number | null;
  vibe_color?: string | null;
  cover_color?: string | null;
};

type PostBase = {
  kind: "concert" | "recommendation" | "music_collection";
  id: string;
  created_at: string;
  author: ProfileMini;
  like_count: number;
  comment_count: number;
  followers_count: number;
};

type RowConcert = PostBase & {
  kind: "concert";
  artist_id: string | null;
  artist_name: string | null;
  tour: string | null;
  city: string | null;
  country: string | null;
  year: number | null;
  event_date: string | null;
  caption?: string | null;
  image_urls: string[];

  cover_url: string | null;
  record_id: string | null;

  colors: { vibe?: string | null; cover?: string | null };
  post_type?: "concert" | "experience" | null;
  experience?: string | null;
};

type RowReco = PostBase & {
  kind: "recommendation";
  body: string;
  record_id: string;
  record_title: string;
  release_year: number | null;
  artist_id: string | null;
  artist_name: string | null;
  colors: { vibe?: string | null; cover?: string | null };
  rating: number | null;
};

type RowMusicCollection = PostBase & {
  kind: "music_collection";
  record_id: string | null;
  record_title?: string | null;
  photo_url: string | null;
  caption: string | null;
};

function clampText(s: string, max = 120) {
  const t = (s || "").trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Detectar si una URL apunta a un vídeo (para NO usarla en tiles) */
function isVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  const clean = url.split("?")[0] || "";
  return /\.(mp4|mov|webm|m4v|avi|mkv|ogg)$/i.test(clean);
}

const Avatar = ({ src, alt, size = 24 }: { src?: string | null; alt?: string; size?: number }) => (
  <div className="rounded-full overflow-hidden bg-neutral-100 shrink-0" style={{ width: size, height: size }}>
    {src ? (
      <img
        src={src}
        alt={alt || "user"}
        className="w-full h-full object-cover object-center"
      />
    ) : null}
  </div>
);

const ColorChip = ({ vibe, cover, size = 44 }: { vibe?: string | null; cover?: string | null; size?: number }) => (
  <div className="p-[6px] rounded-2xl" style={{ background: vibe || "#E9EDF7" }}>
    <div className="rounded-[14px] bg-white flex items-center justify-center" style={{ width: size, height: size }}>
      <div className="rounded-lg" style={{ width: size * 0.62, height: size * 0.62, background: cover || "#C9D6F5" }} />
    </div>
  </div>
);

function GradeBadge({ value }: { value: number | null }) {
  if (value == null) return null;
  const v = Math.max(1, Math.min(10, Math.round(value)));
  return (
    <div className="relative" style={{ width: 38, height: 38 }}>
      <div
        className="absolute inset-0 flex items-center justify-center rounded-full border bg-white"
        style={{
          borderColor: "#111",
          borderWidth: 1,
          color: "#111",
          fontFamily: "Times New Roman, serif",
          fontWeight: 400,
          fontSize: 14,
        }}
        aria-label={`Rating: ${v}`}
        title={`Rating: ${v}`}
      >
        {v}
      </div>
      <div
        className="absolute rounded-full bg-white"
        style={{ width: 14, height: 14, right: -2, bottom: -2, border: "1.25px solid #1F48AF" }}
        aria-hidden="true"
      >
        <div
          className="absolute rounded-full"
          style={{
            width: 4,
            height: 4,
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            background: "#1F48AF"
          }}
        />
      </div>
    </div>
  );
}

/* ============================
   Sorting
   ✅ GENERAL: by likes desc (then created_at desc)
   ✅ FRIENDS: most recent
============================ */
function cmpByLikes(a: PostBase, b: PostBase) {
  const la = Math.max(0, a.like_count || 0);
  const lb = Math.max(0, b.like_count || 0);
  if (lb !== la) return lb - la;

  const dt = (b.created_at || "").localeCompare(a.created_at || "");
  if (dt !== 0) return dt;
  return (b.id || "").localeCompare(a.id || "");
}

function cmpByRecent(a: PostBase, b: PostBase) {
  const dt = (b.created_at || "").localeCompare(a.created_at || "");
  if (dt !== 0) return dt;
  return (b.id || "").localeCompare(a.id || "");
}

/* ============================
   Feed hook (sin filtros)
   ✅ Cambios:
   - GENERAL: order by total like_count (concert_likes + concert_photo_likes) + reco likes
   - FRIENDS: most recent
   - Evita paginación: carga todo al inicio (NO loadMore)
   - Followers_count real desde profile_follow_counts
============================ */
function useUnifiedFeed(opts: { scope: "for-you" | "friends" }) {
  const supabase = useSupabaseClient();
  const me = useUser();
  const [rows, setRows] = useState<Array<RowConcert | RowReco | RowMusicCollection>>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const mounted = useRef(false);

  useEffect(() => {
    setRows([]);
    setDone(false);
    setLoading(false);
    mounted.current = false;
  }, [opts.scope, me?.id]);

  const loadAll = async () => {
    if (loading || done) return;
    if (opts.scope === "friends" && !me?.id) return;

    setLoading(true);
    try {
      let allowedUserIds: string[] | null = null;
      if (opts.scope === "friends") {
        const ids = new Set<string>([me!.id!]);
        const fo = await supabase.from("follows").select("following_id").eq("follower_id", me!.id!);
        (fo.data || []).forEach((r: any) => ids.add(r.following_id));
        const frA = await supabase.from("friendships").select("receiver_id").eq("requester_id", me!.id!).eq("status", "accepted");
        (frA.data || []).forEach((r: any) => ids.add(r.receiver_id));
        const frB = await supabase.from("friendships").select("requester_id").eq("receiver_id", me!.id!).eq("status", "accepted");
        (frB.data || []).forEach((r: any) => ids.add(r.requester_id));
        allowedUserIds = Array.from(ids);
      }

      const LIMIT = 400;

      /* ===== Concerts ===== */
      let cq = supabase
        .from("concerts")
        .select("id,user_id,artist_id,city,country_code,event_date,tour_name,caption,created_at,post_type,experience,cover_url,record_id")
        .order("created_at", { ascending: false })
        .limit(LIMIT);

      if (allowedUserIds) cq = cq.in("user_id", allowedUserIds);
      const { data: crows } = await cq;

      const concerts: RowConcert[] = [];
      if (crows?.length) {
        const cIds = crows.map((c: any) => c.id);
        const artistIds = [...new Set(crows.map((c: any) => c.artist_id).filter(Boolean))] as string[];
        const userIds = [...new Set(crows.map((c: any) => c.user_id).filter(Boolean))] as string[];
        const recordIds = [...new Set(crows.map((c: any) => c.record_id).filter(Boolean))] as string[];

        const mediaRes = await supabase
          .from("concert_media")
          .select("id,concert_id,url,created_at")
          .in("concert_id", cIds)
          .order("created_at", { ascending: true });

        const artistsRes = artistIds.length ? await supabase.from("artists").select("id,name").in("id", artistIds) : { data: [] as any[] };
        const profsRes = userIds.length ? await supabase.from("profiles").select("id,username,avatar_url").in("id", userIds) : { data: [] as any[] };

        const likeRowsRes = await supabase.from("concert_likes").select("concert_id").in("concert_id", cIds);
        const comRowsRes = await supabase.from("concert_comments").select("concert_id").in("concert_id", cIds);

        const recordsRes = recordIds.length
          ? await supabase.from("records").select("id,vibe_color,cover_color").in("id", recordIds)
          : { data: [] as any[] };

        const followRes = userIds.length
          ? await supabase.from("profile_follow_counts").select("profile_id,followers_count").in("profile_id", userIds)
          : { data: [] as any[] };

        const folBy: Record<string, number> = {};
        (followRes.data || []).forEach((r: any) => {
          folBy[r.profile_id] = r.followers_count ?? 0;
        });

        const media = mediaRes.data || [];
        const mediaIds = media.map((m: any) => m.id).filter(Boolean);

        const photoLikesRes =
          mediaIds.length > 0
            ? await supabase.from("concert_photo_likes").select("photo_id").in("photo_id", mediaIds)
            : { data: [] as any[] };

        const concertIdByPhotoId: Record<string, string> = {};
        media.forEach((m: any) => {
          if (m?.id && m?.concert_id) concertIdByPhotoId[m.id] = m.concert_id;
        });

        const photoLikeCountByConcertId: Record<string, number> = {};
        (photoLikesRes.data || []).forEach((r: any) => {
          const cid = concertIdByPhotoId[r.photo_id];
          if (!cid) return;
          photoLikeCountByConcertId[cid] = (photoLikeCountByConcertId[cid] ?? 0) + 1;
        });

        const urlsBy: Record<string, string[]> = {};
        media.forEach((m: any) => {
          const arr = (urlsBy[m.concert_id] ||= []);
          if (arr.length < 12 && m.url && !isVideoUrl(m.url)) arr.push(m.url);
        });

        const aById: Record<string, string> = {};
        (artistsRes.data || []).forEach((a: any) => (aById[a.id] = a.name));

        const uBy: Record<string, ProfileMini> = {};
        (profsRes.data || []).forEach((p: any) => (uBy[p.id] = { id: p.id, username: p.username, avatar_url: p.avatar_url }));

        const likeCount: Record<string, number> = {};
        (likeRowsRes.data || []).forEach((r: any) => {
          likeCount[r.concert_id] = (likeCount[r.concert_id] ?? 0) + 1;
        });

        const comCount: Record<string, number> = {};
        (comRowsRes.data || []).forEach((r: any) => {
          comCount[r.concert_id] = (comCount[r.concert_id] ?? 0) + 1;
        });

        const colByRecordId: Record<string, { vibe?: string | null; cover?: string | null }> = {};
        (recordsRes.data || []).forEach((rr: any) => {
          colByRecordId[rr.id] = { vibe: rr.vibe_color ?? null, cover: rr.cover_color ?? null };
        });

        crows.forEach((c: any) => {
          const coverUrl = (c as any)?.cover_url ?? null;
          const effectiveCover = coverUrl && !isVideoUrl(coverUrl) ? coverUrl : null;

          const colors = c.record_id ? (colByRecordId[c.record_id] || {}) : {};

          const totalConcertLikes = (likeCount[c.id] ?? 0) + (photoLikeCountByConcertId[c.id] ?? 0);

          concerts.push({
            kind: "concert",
            id: c.id,
            created_at: c.created_at,
            author: uBy[c.user_id] || { id: c.user_id, username: null, avatar_url: null },
            like_count: totalConcertLikes,
            comment_count: comCount[c.id] ?? 0,
            followers_count: folBy[c.user_id] ?? 0,
            artist_id: c.artist_id ?? null,
            artist_name: aById[c.artist_id] ?? null,
            tour: c.tour_name ?? null,
            city: c.city ?? null,
            country: c.country_code ?? null,
            year: c.event_date ? new Date(c.event_date).getFullYear() : null,
            event_date: c.event_date ?? null,
            caption: c.caption ?? null,
            image_urls: urlsBy[c.id] || [],
            cover_url: effectiveCover,
            record_id: (c as any)?.record_id ?? null,
            colors: { vibe: (colors as any).vibe ?? null, cover: (colors as any).cover ?? null },
            post_type: c.post_type ?? null,
            experience: c.experience ?? null,
          });
        });
      }

      /* ===== Music collections ===== */
      let mq = supabase
        .from("music_collections")
        .select("id,user_id,record_id,photo_url,caption,created_at")
        .order("created_at", { ascending: false })
        .limit(LIMIT);

      if (allowedUserIds) mq = mq.in("user_id", allowedUserIds);
      const { data: mrows } = await mq;

      const collections: RowMusicCollection[] = [];
      if (mrows?.length) {
        const userIds = [...new Set(mrows.map((r: any) => r.user_id).filter(Boolean))] as string[];
        const recordIds = [...new Set(mrows.map((r: any) => r.record_id).filter(Boolean))] as string[];

        const profsRes = userIds.length ? await supabase.from("profiles").select("id,username,avatar_url").in("id", userIds) : { data: [] as any[] };

        const followRes = userIds.length
          ? await supabase.from("profile_follow_counts").select("profile_id,followers_count").in("profile_id", userIds)
          : { data: [] as any[] };
        const folBy: Record<string, number> = {};
        (followRes.data || []).forEach((r: any) => {
          folBy[r.profile_id] = r.followers_count ?? 0;
        });

        const uBy: Record<string, ProfileMini> = {};
        (profsRes.data || []).forEach((p: any) => (uBy[p.id] = { id: p.id, username: p.username, avatar_url: p.avatar_url }));

        const recRes = recordIds.length ? await supabase.from("records").select("id,title").in("id", recordIds) : { data: [] as any[] };
        const rById: Record<string, { title: string }> = {};
        (recRes.data || []).forEach((rr: any) => {
          rById[rr.id] = { title: rr.title as string };
        });

        (mrows || []).forEach((r: any) => {
          collections.push({
            kind: "music_collection",
            id: r.id,
            created_at: r.created_at,
            author: uBy[r.user_id] || { id: r.user_id, username: null, avatar_url: null },
            like_count: 0,
            comment_count: 0,
            followers_count: folBy[r.user_id] ?? 0,
            record_id: r.record_id ?? null,
            record_title: r.record_id ? (rById[r.record_id]?.title ?? null) : null,
            photo_url: r.photo_url ?? null,
            caption: r.caption ?? null,
          });
        });
      }

      /* ===== Recommendations ===== */
      let rq = supabase
        .from("recommendations")
        .select("id,user_id,target_type,target_id,body,created_at,rating_id")
        .eq("target_type", "record")
        .order("created_at", { ascending: false })
        .limit(LIMIT);

      if (allowedUserIds) rq = rq.in("user_id", allowedUserIds);
      const { data: recs } = await rq;

      const recos: RowReco[] = [];
      if (recs?.length) {
        const recordIds = [...new Set(recs.map((r: any) => r.target_id))] as string[];
        const ratingIds = [...new Set(recs.map((r: any) => r.rating_id).filter(Boolean))] as string[];
        const userIds = [...new Set(recs.map((r: any) => r.user_id))] as string[];

        const recordsRes = recordIds.length
          ? await supabase.from("records").select("id,title,release_year,artist_id,artist_name,vibe_color,cover_color").in("id", recordIds)
          : { data: [] as any[] };
        const profsRes = userIds.length ? await supabase.from("profiles").select("id,username,avatar_url").in("id", userIds) : { data: [] as any[] };
        const likeRowsRes = await supabase.from("recommendation_likes").select("recommendation_id").in("recommendation_id", recs.map((r: any) => r.id));
        const comRowsRes = await supabase.from("recommendation_comments").select("recommendation_id").in("recommendation_id", recs.map((r: any) => r.id));
        const ratingsRes = ratingIds.length ? await supabase.from("ratings").select("id,rate").in("id", ratingIds) : { data: [] as any[] };

        const followRes = userIds.length
          ? await supabase.from("profile_follow_counts").select("profile_id,followers_count").in("profile_id", userIds)
          : { data: [] as any[] };
        const folBy: Record<string, number> = {};
        (followRes.data || []).forEach((r: any) => {
          folBy[r.profile_id] = r.followers_count ?? 0;
        });

        const recById: Record<string, any> = {};
        (recordsRes.data || []).forEach((r: any) => (recById[r.id] = r));

        const uBy: Record<string, ProfileMini> = {};
        (profsRes.data || []).forEach((p: any) => (uBy[p.id] = { id: p.id, username: p.username, avatar_url: p.avatar_url }));

        const likeCount: Record<string, number> = {};
        (likeRowsRes.data || []).forEach((r: any) => {
          likeCount[r.recommendation_id] = (likeCount[r.recommendation_id] ?? 0) + 1;
        });

        const comCount: Record<string, number> = {};
        (comRowsRes.data || []).forEach((r: any) => {
          comCount[r.recommendation_id] = (comCount[r.recommendation_id] ?? 0) + 1;
        });

        const ratingById: Record<string, number> = {};
        (ratingsRes.data || []).forEach((r: any) => (ratingById[r.id] = r.rate));

        recs.forEach((r: any) => {
          const rec = recById[r.target_id];
          if (!rec) return;
          recos.push({
            kind: "recommendation",
            id: r.id,
            created_at: r.created_at,
            author: uBy[r.user_id] || { id: r.user_id, username: null, avatar_url: null },
            like_count: likeCount[r.id] ?? 0,
            comment_count: comCount[r.id] ?? 0,
            followers_count: folBy[r.user_id] ?? 0,
            body: r.body as string,
            record_id: rec.id,
            record_title: rec.title,
            release_year: rec.release_year ?? null,
            artist_id: rec.artist_id ?? null,
            artist_name: rec.artist_name ?? null,
            colors: { vibe: rec.vibe_color, cover: rec.cover_color },
            rating: r.rating_id ? ratingById[r.rating_id] ?? null : null,
          });
        });
      }

      const merged = [...concerts, ...collections, ...recos];

      merged.sort(opts.scope === "for-you" ? (cmpByLikes as any) : (cmpByRecent as any));

      setRows(merged as any);
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      Promise.resolve().then(loadAll);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = () => {};

  return { rows, done, loading, loadMore };
}

/* ============================
   Search (slide panel)
============================ */
function UserSearch({ autoFocus, onNavigate }: { autoFocus?: boolean; onNavigate?: () => void }) {
  const supabase = useSupabaseClient();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<ProfileMini[]>([]);
  useEffect(() => {
    const t = setTimeout(async () => {
      const s = q.trim();
      if (s.length < 2) return setRes([]);
      const { data } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url")
        .or(`username.ilike.%${s}%,full_name.ilike.%${s}%`)
        .order("username", { ascending: true })
        .limit(12);
      setRes((data as any) || []);
    }, 220);
    return () => clearTimeout(t);
  }, [q, supabase]);

  return (
    <div className="space-y-2">
      <input
        autoFocus={!!autoFocus}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search users…"
        className="w-full rounded-full border border-neutral-200 px-4 py-2 outline-none focus:border-[#1F48AF] text-sm"
      />
      {q && res.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-xl overflow-hidden">
          <ul className="max-h-[60vh] overflow-auto divide-y divide-neutral-100">
            {res.map((u) => (
              <li key={u.id} className="p-3 hover:bg-neutral-50">
                <Link onClick={onNavigate} href={`/profile/${u.username}`} className="flex items-center gap-3">
                  <Avatar size={30} src={u.avatar_url} alt={u.full_name || u.username || "user"} />
                  <div className="min-w-0">
                    <div className="text-sm">{u.full_name || "—"}</div>
                    <div className="text-xs text-neutral-500">@{u.username}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ArtistSearch({ autoFocus, onPick }: { autoFocus?: boolean; onPick: (a: Artist) => void }) {
  const supabase = useSupabaseClient();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Artist[]>([]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const s = q.trim();
      if (s.length < 2) return setRes([]);
      const { data } = await supabase.from("artists").select("id,name,image_url").ilike("name", `%${s}%`).order("name", { ascending: true }).limit(16);
      setRes((data as Artist[]) || []);
    }, 180);
    return () => clearTimeout(t);
  }, [q, supabase]);

  return (
    <div className="space-y-2">
      <input
        autoFocus={!!autoFocus}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search artists…"
        className="w-full rounded-full border border-neutral-200 px-4 py-2 outline-none focus:border-[#1F48AF] text-sm"
      />
      {q && res.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-xl overflow-hidden">
          <ul className="max-h-[60vh] overflow-auto divide-y divide-neutral-100">
            {res.map((a) => (
              <li
                key={a.id}
                className="p-3 hover:bg-neutral-50 flex items-center gap-3 cursor-pointer"
                onClick={() => onPick(a)}
              >
                {a.image_url ? <img src={a.image_url} alt={a.name} className="w-8 h-8 rounded object-cover object-center shrink-0 block" /> : null}
                <div className="text-sm">{a.name}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RecordSearch({ autoFocus, onPick }: { autoFocus?: boolean; onPick: (r: RecordMini) => void }) {
  const supabase = useSupabaseClient();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<RecordMini[]>([]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const s = q.trim();
      if (s.length < 2) return setRes([]);
      const { data } = await supabase
        .from("records")
        .select("id,title,artist_name,release_year,vibe_color,cover_color")
        .or(`title.ilike.%${s}%,artist_name.ilike.%${s}%`)
        .order("release_year", { ascending: false })
        .limit(16);
      setRes((data as any) || []);
    }, 200);
    return () => clearTimeout(t);
  }, [q, supabase]);

  return (
    <div className="space-y-2">
      <input
        autoFocus={!!autoFocus}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search records…"
        className="w-full rounded-full border border-neutral-200 px-4 py-2 outline-none focus:border-[#1F48AF] text-sm"
      />
      {q && res.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-xl overflow-hidden">
          <ul className="max-h-[60vh] overflow-auto divide-y divide-neutral-100">
            {res.map((r) => (
              <li
                key={r.id}
                className="p-3 hover:bg-neutral-50 flex items-center gap-3 cursor-pointer"
                onClick={() => onPick(r)}
              >
                <ColorChip vibe={r.vibe_color} cover={r.cover_color} size={38} />
                <div className="min-w-0">
                  <div className="text-sm">{r.title}</div>
                  <div className="text-xs text-neutral-500">
                    {r.artist_name ? r.artist_name : "—"}{r.release_year ? ` · ${r.release_year}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ============================
   Tiles
============================ */
function TileShell({
  children,
  href,
  className = "",
}: {
  children: React.ReactNode;
  href: string;
  className?: string;
}) {
  return (
    <Link href={href} className={`group block w-full ${className}`}>
      {children}
    </Link>
  );
}

/** ✅ Concert tile */
function ConcertTile({ row }: { row: RowConcert }) {
  const cover =
    row.cover_url && !isVideoUrl(row.cover_url)
      ? row.cover_url
      : (row.image_urls?.find((u) => !!u && !isVideoUrl(u)) || null);

  const artistLine = (row.artist_name || "").trim() || "Concert";

  return (
    <TileShell href={`/post/${row.id}`}>
      <div className="relative aspect-square rounded-[14px] overflow-hidden bg-neutral-100">
        {cover ? (
          <img
            src={cover}
            alt=""
            loading="eager"
            decoding="async"
            className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.02] block"
            style={{
              imageOrientation: "from-image" as any,
            }}
          />
        ) : null}

        {/* ✅ lighter overlays (no ugly black haze) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/28 via-black/8 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/85 via-black/18 to-transparent" />

        {/* ✅ smaller username, readable; avatar visible but not huge */}
        <div className="absolute left-2.5 top-2.5 flex items-center gap-2 max-w-[calc(100%-20px)]">
          <Avatar size={24} src={row.author.avatar_url} alt={row.author.username || "user"} />
          <div
            className="min-w-0 truncate text-[11px] text-white/95"
            style={{
              fontFamily: "Roboto, Arial, sans-serif",
              fontWeight: 500,
              textShadow: "0 2px 12px rgba(0,0,0,0.55)",
            }}
            title={row.author.username || ""}
          >
            {row.author.username || "—"}
          </div>
        </div>

        <div className="absolute left-2 right-2 bottom-2">
          <div
            className="truncate text-white"
            style={{
              fontFamily: "Roboto, Arial, sans-serif",
              fontWeight: 500,
              textShadow: "0 2px 16px rgba(0,0,0,0.70)",
              fontSize: "clamp(14px, 3.5vw, 18px)",
              lineHeight: 1.05,
              letterSpacing: "0.01em",
            }}
            title={artistLine}
          >
            {artistLine}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 rounded-[14px] ring-1 ring-black/10 group-hover:ring-black/20 transition" />
      </div>
    </TileShell>
  );
}

/** ✅ Music collection tile */
function CollectionTile({ row }: { row: RowMusicCollection }) {
  const cover = row.photo_url || null;
  const title = (row.record_title || "").trim() || "Record";
  const href = row.record_id ? `/record/${row.record_id}` : `/post/${row.id}`;

  return (
    <TileShell href={href}>
      <div className="relative aspect-square rounded-[14px] overflow-hidden bg-neutral-100">
        {cover ? (
          <img
            src={cover}
            alt=""
            loading="eager"
            decoding="async"
            className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.02] block"
            style={{
              imageOrientation: "from-image" as any,
            }}
          />
        ) : null}

        {/* ✅ same overlay style as concert */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/28 via-black/8 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/85 via-black/18 to-transparent" />

        {/* ✅ EXACT same username/avatar sizing as concert */}
        <div className="absolute left-2.5 top-2.5 flex items-center gap-2 max-w-[calc(100%-20px)]">
          <Avatar size={24} src={row.author.avatar_url} alt={row.author.username || "user"} />
          <div
            className="min-w-0 truncate text-[11px] text-white/95"
            style={{
              fontFamily: "Roboto, Arial, sans-serif",
              fontWeight: 500,
              textShadow: "0 2px 12px rgba(0,0,0,0.55)",
            }}
            title={row.author.username || ""}
          >
            {row.author.username || "—"}
          </div>
        </div>

        {/* ✅ record title in Roboto (as requested) */}
        <div className="absolute left-2 right-2 bottom-2">
          <div
            className="truncate text-white"
            style={{
              fontFamily: "Roboto, Arial, sans-serif",
              fontWeight: 500,
              textShadow: "0 2px 16px rgba(0,0,0,0.70)",
              fontSize: "clamp(12.5px, 3.0vw, 16px)",
              lineHeight: 1.12,
              letterSpacing: "0.01em",
            }}
            title={title}
          >
            {title}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 rounded-[14px] ring-1 ring-black/10 group-hover:ring-black/20 transition" />
      </div>
    </TileShell>
  );
}

/** ✅ Listener take (recommendation) */
function RecommendationTile({ row }: { row: RowReco }) {
  const headline = row.record_title;
  const meta = `${row.artist_name ? row.artist_name : "—"}${row.release_year ? ` · ${row.release_year}` : ""}`.trim();

  return (
    <TileShell href={`/review/${row.id}`} className="col-span-2 sm:col-span-2">
      <div className="rounded-[16px] bg-white ring-1 ring-black/10 hover:ring-black/20 transition">
        <div className="p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar size={28} src={row.author.avatar_url} alt={row.author.username || "user"} />
              <div className="min-w-0">
                <div
                  className="text-[13px] text-neutral-900 leading-tight truncate"
                  style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 500 }}
                  title={row.author.username || ""}
                >
                  {row.author.username || "—"}
                </div>
                <div
                  className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
                  style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 400 }}
                >
                  Listener take
                </div>
              </div>
            </div>
            <GradeBadge value={row.rating} />
          </div>

          <div className="mt-3 flex items-start gap-3">
            <div className="shrink-0">
              <ColorChip vibe={row.colors.vibe} cover={row.colors.cover} size={50} />
            </div>

            <div className="min-w-0 flex-1">
              <div
                className="leading-snug truncate"
                style={{
                  fontFamily: "Times New Roman, serif",
                  fontWeight: 400,
                  fontSize: "clamp(17px, 1.9vw, 20px)",
                }}
                title={headline}
              >
                {headline}
              </div>

              <div
                className="mt-0.5 text-neutral-700 truncate"
                style={{
                  fontFamily: "Roboto, Arial, sans-serif",
                  fontWeight: 400,
                  fontSize: "clamp(12px, 1.3vw, 14px)",
                }}
              >
                {meta}
              </div>

              <div
                className="mt-2 text-neutral-700 leading-snug"
                style={{
                  fontFamily: "Roboto, Arial, sans-serif",
                  fontWeight: 400,
                  fontSize: "clamp(12.5px, 1.35vw, 14px)",
                }}
              >
                {clampText(row.body || "", 280)}
              </div>
            </div>
          </div>
        </div>

        <div className="h-px w-full bg-black/5" />
        <div className="px-3.5 py-2 text-[10px] text-neutral-500" style={{ fontFamily: "Roboto, Arial, sans-serif" }}>
          &nbsp;
        </div>
      </div>
    </TileShell>
  );
}

/* ============================
   Intercalado:
   2 cuadrados → 1 listener take → 4 cuadrados → 1 take → 4 → 1 → ...
   ✅ IMPORTANT: NO reordenamos aquí; respetamos el orden que venga del feed
============================ */
function buildInterleaved(items: Array<RowConcert | RowReco | RowMusicCollection>) {
  const squares = items.filter((x) => x.kind !== "recommendation");
  const takes = items.filter((x) => x.kind === "recommendation");

  const out: Array<RowConcert | RowReco | RowMusicCollection> = [];
  let s = 0;
  let t = 0;

  let firstBlock = true;

  while (s < squares.length || t < takes.length) {
    const blockCount = firstBlock ? 2 : 4;
    firstBlock = false;

    for (let i = 0; i < blockCount && s < squares.length; i++) {
      out.push(squares[s++] as any);
    }

    if (t < takes.length) {
      out.push(takes[t++] as any);
    }
  }

  return out;
}

/* ============================
   Grid renderer (reusable)
   ✅ NO infinite scroll / NO load more
============================ */
function Grid({
  items,
  loading,
  done,
}: {
  items: Array<RowConcert | RowReco | RowMusicCollection>;
  loading: boolean;
  done: boolean;
}) {
  const arranged = buildInterleaved(items);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
        {arranged.map((r) =>
          r.kind === "concert" ? (
            <ConcertTile key={`c_${r.id}`} row={r as RowConcert} />
          ) : r.kind === "music_collection" ? (
            <CollectionTile key={`mc_${r.id}`} row={r as RowMusicCollection} />
          ) : (
            <RecommendationTile key={`re_${r.id}`} row={r as RowReco} />
          )
        )}
      </div>

      <div className="mt-5 flex items-center justify-center">
        {loading ? (
          <div className="text-xs text-neutral-500" style={{ fontFamily: "Roboto, Arial, sans-serif" }}>
            Loading…
          </div>
        ) : done ? (
          <div className="text-xs text-neutral-500" style={{ fontFamily: "Roboto, Arial, sans-serif" }}>
            You’re all caught up.
          </div>
        ) : (
          <div className="text-xs text-neutral-400" style={{ fontFamily: "Roboto, Arial, sans-serif" }}>
            &nbsp;
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================
   Página
============================ */
export default function FeedPage() {
  const router = useRouter();

  // tabs + swipe (como Profile)
  const [tab, setTab] = useState<"general" | "friends">("general");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollSyncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutoScrolling = useRef(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTab, setSearchTab] = useState<"users" | "artists" | "records">("users");

  const general = useUnifiedFeed({ scope: "for-you" });
  const friends = useUnifiedFeed({ scope: "friends" });

  // ✅ Force default state on mount: GENERAL + scroll left = 0
  useEffect(() => {
    setTab("general");
    const el = scrollRef.current;
    if (el) el.scrollTo({ left: 0, behavior: "auto" as ScrollBehavior });
  }, []);

  // click -> scroll smooth
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    isAutoScrolling.current = true;

    const width = el.clientWidth || 1;
    const left = tab === "general" ? 0 : width;

    el.scrollTo({ left, behavior: "smooth" });

    const reset = setTimeout(() => {
      isAutoScrolling.current = false;
    }, 350);

    return () => clearTimeout(reset);
  }, [tab]);

  // scroll -> sync tab
  const handleHorizontalScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (isAutoScrolling.current) return;

    if (scrollSyncTimeout.current) clearTimeout(scrollSyncTimeout.current);
    scrollSyncTimeout.current = setTimeout(() => {
      const width = el.clientWidth || 1;
      const next = el.scrollLeft >= width / 2 ? "friends" : "general";
      setTab((prev) => (prev === next ? prev : next));
    }, 80);
  };

  useEffect(() => {
    return () => {
      if (scrollSyncTimeout.current) clearTimeout(scrollSyncTimeout.current);
    };
  }, []);

  const closeSearch = () => setSearchOpen(false);

  return (
    <div
      className="min-h-screen bg-white"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 18px)" }}
    >
      {/* Header */}
      <div className="mx-auto max-w-[980px] px-4 md:px-6 pt-4 sm:pt-6 pb-3">
        <div className="flex items-end justify-between gap-3">
          <div className="w-full">
            <h1
              className="text-[clamp(1.6rem,5vw,2.4rem)] font-normal tracking-tight"
              style={{ fontFamily: "Times New Roman, serif" }}
            >
              The Wall
            </h1>
            <div className="mt-2 h-px w-full bg-black/10" />
          </div>

          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="shrink-0 w-11 h-11 rounded-full border border-neutral-200 bg-white shadow-[0_6px_18px_rgba(0,0,0,0.08)] flex items-center justify-center hover:bg-neutral-50"
            title="Search"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.2-3.2" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("general")}
              className={`px-4 py-2 rounded-full border text-sm ${
                tab === "general"
                  ? "bg-[#1F48AF] text-white border-[#1F48AF]"
                  : "bg-white text-black border-neutral-200 hover:border-[#1F48AF]/40"
              }`}
            >
              General
            </button>
            <button
              onClick={() => setTab("friends")}
              className={`px-4 py-2 rounded-full border text-sm ${
                tab === "friends"
                  ? "bg-[#1F48AF] text-white border-[#1F48AF]"
                  : "bg-white text-black border-neutral-200 hover:border-[#1F48AF]/40"
              }`}
            >
              Friends
            </button>
          </div>
        </div>
      </div>

      {/* ✅ Horizontal swipe container (como Profile) */}
      <main className="mx-auto max-w-[980px] px-4 md:px-6 pb-16">
        <div ref={scrollRef} onScroll={handleHorizontalScroll} className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar">
          {/* PANEL 1 — GENERAL */}
          <div className="snap-center min-w-full">
            <Grid items={general.rows} loading={general.loading} done={general.done} />
          </div>

          {/* PANEL 2 — FRIENDS */}
          <div className="snap-center min-w-full">
            <Grid items={friends.rows} loading={friends.loading} done={friends.done} />
          </div>
        </div>
      </main>

      {/* Search slide panel */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-200 ${
          searchOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!searchOpen}
      >
        {/* ✅ NO dark/blur overlay (keeps iOS app borders clean) */}
        <div className="absolute inset-0 bg-transparent" onClick={closeSearch} />

        <div
          className={`absolute left-0 right-0 top-0 bg-white border-b border-neutral-200 shadow-[0_20px_60px_rgba(0,0,0,0.18)] transition-transform duration-300 ease-out ${
            searchOpen ? "translate-y-0" : "-translate-y-full"
          }`}
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        >
          <div className="mx-auto max-w-[980px] px-4 md:px-6 pt-0 pb-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[18px]" style={{ fontFamily: "Times New Roman, serif" }}>
                Search
              </div>
              <button
                onClick={closeSearch}
                className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center hover:bg-neutral-50"
                aria-label="Close search"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 6l12 12" />
                  <path d="M18 6l-12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setSearchTab("users")}
                className={`px-4 py-2 rounded-full border text-sm ${
                  searchTab === "users"
                    ? "bg-[#1F48AF] text-white border-[#1F48AF]"
                    : "bg-white text-black border-neutral-200 hover:border-[#1F48AF]/40"
                }`}
              >
                Users
              </button>
              <button
                onClick={() => setSearchTab("artists")}
                className={`px-4 py-2 rounded-full border text-sm ${
                  searchTab === "artists"
                    ? "bg-[#1F48AF] text-white border-[#1F48AF]"
                    : "bg-white text-black border-neutral-200 hover:border-[#1F48AF]/40"
                }`}
              >
                Artists
              </button>
              <button
                onClick={() => setSearchTab("records")}
                className={`px-4 py-2 rounded-full border text-sm ${
                  searchTab === "records"
                    ? "bg-[#1F48AF] text-white border-[#1F48AF]"
                    : "bg-white text-black border-neutral-200 hover:border-[#1F48AF]/40"
                }`}
              >
                Records
              </button>
            </div>

            <div className="mt-4">
              {searchTab === "users" ? (
                <UserSearch autoFocus onNavigate={closeSearch} />
              ) : searchTab === "artists" ? (
                <ArtistSearch
                  autoFocus
                  onPick={(a) => {
                    closeSearch();
                    router.push(`/artist/${a.id}`);
                  }}
                />
              ) : (
                <RecordSearch
                  autoFocus
                  onPick={(r) => {
                    closeSearch();
                    router.push(`/record/${r.id}`);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

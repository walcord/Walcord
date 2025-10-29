'use client';

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";

/* ============================
   Tipos y utilidades
============================ */
type ProfileMini = { id: string; username: string | null; full_name?: string | null; avatar_url: string | null };
type Artist = { id: string; name: string; image_url?: string | null };

type PostBase = {
  kind: "concert" | "recommendation" | "future_concert";
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

/** Future concert (friends) */
type RowFutureConcert = PostBase & {
  kind: "future_concert";
  artist_name: string | null; // future_concerts.artist (text)
  city: string | null;
  venue: string | null;
  country: string | null;
  event_date: string | null; // ISO date
  status: string | null;
  notes?: string | null;
};

const cap = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";

/** Sufijo inglés para el día (1st, 2nd, 3rd, 4th…) */
function daySuffix(n: number) {
  const j = n % 10, k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}
/** Fecha editorial: 31st of May */
function fmtDateEditorial(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const day = daySuffix(d.getDate());
  const month = d.toLocaleDateString(undefined, { month: "long" });
  return `${day} of ${month}`;
}

/* ============================
   Avatar / Chip / Media / Badge
============================ */
const Avatar = ({ src, alt, size = 36 }: { src?: string | null; alt?: string; size?: number }) => (
  <div className="rounded-full overflow-hidden bg-neutral-100 border border-neutral-200 shrink-0" style={{ width: size, height: size }}>
    {src ? <img src={src} alt={alt || "user"} className="w-full h-full object-cover" /> : null}
  </div>
);

const ColorChip = ({ vibe, cover, size = 40 }: { vibe?: string | null; cover?: string | null; size?: number }) => (
  <div className="p-[6px] rounded-xl" style={{ background: vibe || "#E9EDF7" }}>
    <div className="rounded-[10px] bg-white flex items-center justify-center" style={{ width: size, height: size }}>
      <div className="rounded-md" style={{ width: size * 0.6, height: size * 0.6, background: cover || "#C9D6F5" }} />
    </div>
  </div>
);

/** Badge editorial (círculo azul ligeramente más fino) */
function GradeBadge({ value }: { value: number | null }) {
  if (value == null) return null;
  const v = Math.max(1, Math.min(10, Math.round(value)));
  return (
    <div className="relative" style={{ width: 46, height: 46 }}>
      <div
        className="absolute inset-0 flex items-center justify-center rounded-full border bg-white"
        style={{ borderColor: "#111", borderWidth: 1, color: "#111", fontFamily: "Times New Roman, serif", fontWeight: 400, fontSize: 16 }}
        aria-label={`Rating: ${v}`}
        title={`Rating: ${v}`}
      >
        {v}
      </div>
      <div className="absolute rounded-full bg-white" style={{ width: 16, height: 16, right: -2, bottom: -2, border: "1.25px solid #1F48AF" }} aria-hidden="true">
        <div className="absolute rounded-full" style={{ width: 4, height: 4, left: "50%", top: "50%", transform: "translate(-50%, -50%)", background: "#1F48AF" }} />
      </div>
    </div>
  );
}

/** Grid media (igual que antes) */
const MediaBlock = ({ urls, postId }: { urls: string[]; postId: string }) => {
  const total = urls.length;
  if (total <= 0) return null;
  const take = urls.slice(0, 4);
  const more = Math.max(0, total - take.length);
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
      {take.map((u, i) => {
        const isLast = i === 3 && more > 0;
        return (
          <Link key={i} href={`/post/${postId}`} className="relative overflow-hidden rounded-2xl bg-neutral-100 block aspect-square">
            <img src={u} alt="" className="absolute inset-0 w-full h-full object-cover" />
            {isLast && <div className="absolute inset-0 bg-black/45 text-white flex items-center justify-center text-base sm:text-lg font-medium">+{Math.min(more, 99)}</div>}
          </Link>
        );
      })}
    </div>
  );
};

/* ============================
   Tarjetas
============================ */
function PostCardConcert({ row }: { row: RowConcert }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(row.like_count);
  const supabase = useSupabaseClient();
  const me = useUser();

  useEffect(() => {
    (async () => {
      if (!me?.id) return setLiked(false);
      const { data } = await supabase.from("concert_likes").select("concert_id").eq("concert_id", row.id).eq("user_id", me.id).maybeSingle();
      setLiked(!!data);
    })();
  }, [me?.id, supabase, row.id]);

  const toggleLike = async () => {
    if (!me?.id) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      if (next) await supabase.from("concert_likes").upsert({ concert_id: row.id, user_id: me.id }, { onConflict: "concert_id,user_id" });
      else await supabase.from("concert_likes").delete().eq("concert_id", row.id).eq("user_id", me.id);
    } catch {
      setLiked(!next);
      setLikeCount((n) => Math.max(0, n + (next ? -1 : 1)));
    }
  };

  const vibe = row.colors.vibe || "#E9EDF7";
  const cover = row.colors.cover || "#C9D6F5";
  const headerLeft = row.post_type === "experience" && row.experience ? cap(row.experience) : row.artist_name || "Concert";

  return (
    <article className="rounded-3xl border border-neutral-200 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <Link href={`/profile/${row.author.username || ""}`} className="flex items-center gap-3 min-w-0">
          <Avatar src={row.author.avatar_url} alt={row.author.username || "user"} />
          <div className="min-w-0"><div className="text-[13px] text-neutral-800 leading-tight line-clamp-1">{row.author.username || "—"}</div></div>
        </Link>
      </div>

      <div className="px-4 pb-2 flex items-center gap-3">
        <ColorChip vibe={vibe} cover={cover} />
        <div className="min-w-0">
          <div className="text-[15px] leading-tight line-clamp-1" style={{ fontFamily: "Times New Roman, serif", fontWeight: 400 }}>
            {headerLeft}{row.tour ? ` — ${row.tour}` : ""}
          </div>
          <div className="text-[12px] text-neutral-500 leading-tight line-clamp-1">
            {row.city || ""}{row.country ? `, ${row.country}` : ""}{row.year ? ` · ${row.year}` : ""}
          </div>
        </div>
      </div>

      {row.caption ? <div className="px-4 pt-1 pb-2 text-[15px] leading-relaxed">{row.caption}</div> : null}

      <div className="px-4 pb-3"><MediaBlock urls={row.image_urls} postId={row.id} /></div>

      <div className="px-4 pb-4">
        <div className="flex items-center gap-5 text-sm">
          <button onClick={toggleLike} className={`px-4 py-2 rounded-full border ${liked ? "border-[#1F48AF] text-[#1F48AF] bg-[#1F48AF]/10" : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"}`}>{liked ? "Liked" : "Like"}</button>
          <div className="text-sm text-zinc-600">{likeCount} likes · {row.comment_count} comments</div>
        </div>
      </div>
    </article>
  );
}

function PostCardRecommendation({ row }: { row: RowReco }) {
  const supabase = useSupabaseClient();
  const me = useUser();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(row.like_count);

  useEffect(() => {
    (async () => {
      if (!me?.id) return setLiked(false);
      const { data } = await supabase
        .from("recommendation_likes")
        .select("recommendation_id")
        .eq("recommendation_id", row.id)
        .eq("user_id", me.id)
        .maybeSingle();
      setLiked(!!data);
    })();
  }, [me?.id, supabase, row.id]);

  const toggleLike = async () => {
    if (!me?.id) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      if (next) {
        await supabase.from("recommendation_likes").upsert(
          { recommendation_id: row.id, user_id: me.id },
          { onConflict: "recommendation_id,user_id" }
        );
      } else {
        await supabase.from("recommendation_likes").delete().eq("recommendation_id", row.id).eq("user_id", me.id);
      }
    } catch {
      setLiked(!next);
      setLikeCount((n) => Math.max(0, n + (next ? -1 : 1)));
    }
  };

  return (
    <article className="rounded-3xl border border-neutral-200 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <Link href={`/profile/${row.author.username || ""}`} className="flex items-center gap-3 min-w-0">
          <Avatar src={row.author.avatar_url} alt={row.author.username || "user"} />
          <div className="min-w-0"><div className="text-[13px] text-neutral-800 leading-tight line-clamp-1">{row.author.username || "—"}</div></div>
        </Link>
        <div className="text-[11px] text-neutral-500 shrink-0">{fmtDate(row.created_at)}</div>
      </div>

      <div className="px-4 pb-2 flex items-center gap-3">
        <Link href={`/record/${row.record_id}`} className="flex-1 min-w-0 flex items-center gap-3 no-underline hover:no-underline">
          <ColorChip vibe={row.colors.vibe} cover={row.colors.cover} />
          <div className="min-w-0">
            <div className="text-[15px] leading-tight line-clamp-1" style={{ fontFamily: "Times New Roman, serif", fontWeight: 400 }}>
              {row.artist_name ? `${row.artist_name} — ${row.record_title}` : row.record_title}
            </div>
            <div className="text-[12px] text-neutral-500 leading-tight line-clamp-1">
              {row.release_year ? `Record from ${row.release_year}` : ""}
            </div>
          </div>
        </Link>
        <GradeBadge value={row.rating} />
      </div>

      <div className="px-4 pt-1 pb-2 text-[15px] leading-relaxed">{row.body}</div>

      <div className="px-4 pb-4">
        <div className="flex items-center gap-5 text-sm">
          <button onClick={toggleLike} className={`px-4 py-2 rounded-full border ${liked ? "border-[#1F48AF] text-[#1F48AF] bg-[#1F48AF]/10" : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"}`}>{liked ? "Liked" : "Like"}</button>
          <div className="text-sm text-zinc-600">{likeCount} likes · {row.comment_count} comments</div>
        </div>
      </div>
    </article>
  );
}

/** FUTURE CONCERT — UNA SOLA LÍNEA tipo notificación
 *  - Username EXACTAMENTE como en las otras tarjetas (Roboto/system, 13px, neutral-800)
 *  - Click SOLO en el username, sin subrayado ni hover underline
 *  - Frase editorial (Times) en la misma línea con truncate
 */
function PostCardFutureConcert({ row }: { row: RowFutureConcert }) {
  const sentence = `is going to ${row.artist_name || "a concert"}${
    row.city ? ` in ${row.city}` : ""
  }${row.event_date ? ` on ${fmtDateEditorial(row.event_date)}` : ""}${
    row.venue ? ` · ${row.venue}` : ""
  }`;

  return (
    <article className="rounded-3xl border border-neutral-200 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="flex items-start gap-3 min-w-0">
          <Link href={`/profile/${row.author.username || ""}`} className="shrink-0 no-underline hover:no-underline">
            <Avatar src={row.author.avatar_url} alt={row.author.username || "user"} />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <Link href={`/profile/${row.author.username || ""}`} className="no-underline hover:no-underline">
                <span className="text-[13px] text-neutral-800 leading-tight">
                  {row.author.username || "—"}
                </span>
              </Link>
              <span
                className="flex-1 min-w-0 whitespace-normal break-words text-[16px] leading-snug text-neutral-900 sm:truncate"
                style={{ fontFamily: "Times New Roman, serif", fontWeight: 400 }}
                title={`${row.author.username || ""} ${sentence}`}
              >
                {sentence}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
              {row.country ? (
                <span className="px-2 py-1 rounded-full border border-neutral-300">{row.country}</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="text-[11px] text-neutral-500 shrink-0">{fmtDate(row.created_at)}</div>
      </div>
    </article>
  );
}

/* ============================
   Ranking (estable)
============================ */
function cmpByLikesThenRecent(a: PostBase, b: PostBase) {
  if (b.like_count !== a.like_count) return b.like_count - a.like_count;
  const dt = (b.created_at || "").localeCompare(a.created_at || "");
  if (dt !== 0) return dt;
  return (b.id || "").localeCompare(a.id || "");
}
function cmpFriends(a: PostBase, b: PostBase) {
  const dt = (b.created_at || "").localeCompare(a.created_at || "");
  if (dt !== 0) return dt;
  return (b.id || "").localeCompare(a.id || "");
}
function cmpArtistFilter(a: RowConcert | RowReco, b: RowConcert | RowReco) {
  if (a.kind !== b.kind) return a.kind === "recommendation" ? -1 : 1;
  if (a.kind === "recommendation" && b.kind === "recommendation") {
    if (b.like_count !== a.like_count) return b.like_count - a.like_count;
    return (b.created_at || "").localeCompare(a.created_at || "");
  }
  if (b.created_at !== a.created_at) return (b.created_at || "").localeCompare(a.created_at || "");
  return (b.like_count || 0) - (a.like_count || 0);
}

/* ============================
   Hook feed unificado (auto-carga, sin botón)
============================ */
function useUnifiedFeed(opts: { scope: "for-you" | "friends"; artistId?: string | null; artistName?: string | null }) {
  const supabase = useSupabaseClient();
  const me = useUser();
  const [rows, setRows] = useState<Array<RowConcert | RowReco | RowFutureConcert>>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const PAGE = 12;
  const mounted = useRef(false);

  useEffect(() => {
    setRows([]);
    setCursor(null);
    setDone(false);
    setLoading(false);
  }, [opts.scope, opts.artistId, opts.artistName, me?.id]);

  const loadMore = async () => {
    if (loading || done) return;
    if (opts.scope === "friends" && !me?.id) return;

    setLoading(true);
    try {
      // amigos/seguidos permitidos en friends
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

      /* Concerts */
      let cq = supabase
        .from("concerts")
        .select("id,user_id,artist_id,city,country_code,event_date,tour_name,caption,created_at,post_type,experience")
        .order("created_at", { ascending: false })
        .limit(PAGE);
      if (cursor) cq = cq.lt("created_at", cursor);
      if (allowedUserIds) cq = cq.in("user_id", allowedUserIds);
      if (opts.artistId) cq = cq.eq("artist_id", opts.artistId);
      const { data: crows } = await cq;

      const concerts: RowConcert[] = [];
      if (crows?.length) {
        const cIds = crows.map((c: any) => c.id);
        const artistIds = [...new Set(crows.map((c: any) => c.artist_id).filter(Boolean))] as string[];
        const userIds = [...new Set(crows.map((c: any) => c.user_id).filter(Boolean))] as string[];

        const mediaRes = await supabase.from("concert_media").select("concert_id,url,created_at").in("concert_id", cIds).order("created_at", { ascending: true });
        const artistsRes = artistIds.length ? await supabase.from("artists").select("id,name").in("id", artistIds) : { data: [] as any[] };
        const profsRes = userIds.length ? await supabase.from("profiles").select("id,username,avatar_url").in("id", userIds) : { data: [] as any[] };
        const likeRowsRes = await supabase.from("concert_likes").select("concert_id").in("concert_id", cIds);
        const comRowsRes = await supabase.from("concert_comments").select("concert_id").in("concert_id", cIds);
        const followsCountRes = userIds.length ? await supabase.from("profile_follow_counts").select("profile_id,followers_count").in("profile_id", userIds) : { data: [] as any[] };

        const media = mediaRes.data || [];
        const artists = artistsRes.data || [];
        const profs = profsRes.data || [];
        const likeRows = likeRowsRes.data || [];
        const comRows = comRowsRes.data || [];
        const followsCount = followsCountRes.data || [];

        const urlsBy: Record<string, string[]> = {};
        media.forEach((m: any) => { const arr = (urlsBy[m.concert_id] ||= []); if (arr.length < 12) arr.push(m.url); });

        const aById: Record<string, string> = {};
        artists.forEach((a: any) => (aById[a.id] = a.name));

        const uBy: Record<string, ProfileMini> = {};
        profs.forEach((p: any) => (uBy[p.id] = { id: p.id, username: p.username, avatar_url: p.avatar_url }));

        const likeCount: Record<string, number> = {};
        likeRows.forEach((r: any) => { likeCount[r.concert_id] = (likeCount[r.concert_id] ?? 0) + 1; });
        const comCount: Record<string, number> = {};
        comRows.forEach((r: any) => { comCount[r.concert_id] = (comCount[r.concert_id] ?? 0) + 1; });

        const followersBy: Record<string, number> = {};
        followsCount.forEach((f: any) => (followersBy[f.profile_id] = f.followers_count ?? 0));

        const colorsByArtist: Record<string, { vibe?: string | null; cover?: string | null }> = {};
        if (artistIds.length) {
          const colorRowsRes = await supabase.from("records").select("artist_id,vibe_color,cover_color").in("artist_id", artistIds);
          (colorRowsRes.data || []).forEach((r: any) => {
            if (!colorsByArtist[r.artist_id]) colorsByArtist[r.artist_id] = { vibe: r.vibe_color, cover: r.cover_color };
          });
        }

        crows.forEach((c: any) => {
          concerts.push({
            kind: "concert",
            id: c.id,
            created_at: c.created_at,
            author: uBy[c.user_id] || { id: c.user_id, username: null, avatar_url: null },
            like_count: likeCount[c.id] ?? 0,
            comment_count: comCount[c.id] ?? 0,
            followers_count: followersBy[c.user_id] ?? 0,
            artist_id: c.artist_id ?? null,
            artist_name: aById[c.artist_id] ?? null,
            tour: c.tour_name ?? null,
            city: c.city ?? null,
            country: c.country_code ?? null,
            year: c.event_date ? new Date(c.event_date).getFullYear() : null,
            event_date: c.event_date ?? null,
            caption: c.caption ?? null,
            image_urls: urlsBy[c.id] || [],
            colors: colorsByArtist[c.artist_id] || {},
            post_type: c.post_type ?? null,
            experience: c.experience ?? null,
          });
        });
      }

      /* Future concerts (solo friends) */
      let futures: RowFutureConcert[] = [];
      if (opts.scope === "friends") {
        let fq = supabase
          .from("future_concerts")
          .select("id,user_id,artist,city,venue,country_code,event_date,status,notes,created_at")
          .order("created_at", { ascending: false })
          .limit(PAGE);
        if (cursor) fq = fq.lt("created_at", cursor);
        if (me?.id) fq = fq.in("user_id", (await (async () => {
          const ids = new Set<string>([me!.id!]);
          const fo = await supabase.from("follows").select("following_id").eq("follower_id", me!.id!);
          (fo.data || []).forEach((r: any) => ids.add(r.following_id));
          const frA = await supabase.from("friendships").select("receiver_id").eq("requester_id", me!.id!).eq("status", "accepted");
          (frA.data || []).forEach((r: any) => ids.add(r.receiver_id));
          const frB = await supabase.from("friendships").select("requester_id").eq("receiver_id", me!.id!).eq("status", "accepted");
          (frB.data || []).forEach((r: any) => ids.add(r.requester_id));
          return Array.from(ids);
        })()));
        const { data: frows } = await fq;
        if (frows?.length) {
          const userIds = [...new Set(frows.map((r: any) => r.user_id))] as string[];
          const profsRes = userIds.length ? await supabase.from("profiles").select("id,username,avatar_url").in("id", userIds) : { data: [] as any[] };
          const uBy: Record<string, ProfileMini> = {};
          (profsRes.data || []).forEach((p: any) => (uBy[p.id] = { id: p.id, username: p.username, avatar_url: p.avatar_url }));
          futures = frows.map((r: any) => ({
            kind: "future_concert",
            id: r.id,
            created_at: r.created_at,
            author: uBy[r.user_id] || { id: r.user_id, username: null, avatar_url: null },
            like_count: 0,
            comment_count: 0,
            followers_count: 0,
            artist_name: r.artist ?? null,
            city: r.city ?? null,
            venue: r.venue ?? null,
            country: r.country_code ?? null,
            event_date: r.event_date ?? null,
            status: r.status ?? null,
            notes: r.notes ?? null,
          }));
        }
      }

      /* Recommendations */
      let recordIdsForArtist: string[] = [];
      if (opts.artistId || opts.artistName) {
        const ids = new Set<string>();
        if (opts.artistId) {
          const r1 = await supabase.from("records").select("id").eq("artist_id", opts.artistId).limit(1000);
          (r1.data || []).forEach((row: any) => ids.add(row.id));
        }
        if (opts.artistName) {
          const r2 = await supabase.from("records").select("id").ilike("artist_name", `%${opts.artistName}%`).limit(1000);
          (r2.data || []).forEach((row: any) => ids.add(row.id));
        }
        recordIdsForArtist = Array.from(ids);
      }

      let rq = supabase
        .from("recommendations")
        .select("id,user_id,target_type,target_id,body,created_at,rating_id")
        .eq("target_type", "record")
        .order("created_at", { ascending: false })
        .limit(PAGE);
      if (cursor) rq = rq.lt("created_at", cursor);
      if (opts.scope === "friends" && me?.id) {
        const ids = new Set<string>([me.id]);
        const fo = await supabase.from("follows").select("following_id").eq("follower_id", me.id);
        (fo.data || []).forEach((r: any) => ids.add(r.following_id));
        const frA = await supabase.from("friendships").select("receiver_id").eq("requester_id", me.id).eq("status", "accepted");
        (frA.data || []).forEach((r: any) => ids.add(r.receiver_id));
        const frB = await supabase.from("friendships").select("requester_id").eq("receiver_id", me.id).eq("status", "accepted");
        (frB.data || []).forEach((r: any) => ids.add(r.requester_id));
        rq = rq.in("user_id", Array.from(ids));
      }
      if (recordIdsForArtist.length) rq = rq.in("target_id", recordIdsForArtist);

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
        const followsCountRes = userIds.length ? await supabase.from("profile_follow_counts").select("profile_id,followers_count").in("profile_id", userIds) : { data: [] as any[] };
        const ratingsRes = ratingIds.length ? await supabase.from("ratings").select("id,rate").in("id", ratingIds) : { data: [] as any[] };

        const records = recordsRes.data || [];
        const profs = profsRes.data || [];
        const likeRows = likeRowsRes.data || [];
        const comRows = comRowsRes.data || [];
        const followsCount = followsCountRes.data || [];
        const ratings = ratingsRes.data || [];

        const recById: Record<string, any> = {};
        records.forEach((r: any) => (recById[r.id] = r));

        const uBy: Record<string, ProfileMini> = {};
        profs.forEach((p: any) => (uBy[p.id] = { id: p.id, username: p.username, avatar_url: p.avatar_url }));

        const likeCount: Record<string, number> = {};
        likeRows.forEach((r: any) => { likeCount[r.recommendation_id] = (likeCount[r.recommendation_id] ?? 0) + 1; });
        const comCount: Record<string, number> = {};
        comRows.forEach((r: any) => { comCount[r.recommendation_id] = (comCount[r.recommendation_id] ?? 0) + 1; });

        const followersBy: Record<string, number> = {};
        followsCount.forEach((f: any) => (followersBy[f.profile_id] = f.followers_count ?? 0));

        const ratingById: Record<string, number> = {};
        ratings.forEach((r: any) => (ratingById[r.id] = r.rate));

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
            followers_count: followersBy[r.user_id] ?? 0,
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

      // MERGE + ORDEN + NUEVO CURSOR
      const fetched = [...concerts, ...recos, ...futures];
      if (fetched.length === 0) {
        setDone(true);
      } else {
        setRows((prev) => {
          const byKey = new Map<string, RowConcert | RowReco | RowFutureConcert>();
          for (const it of [...prev, ...fetched]) byKey.set(`${it.kind}:${it.id}`, it);
          const merged = Array.from(byKey.values());
          const hasArtist = !!(opts.artistId || opts.artistName);
          merged.sort(hasArtist ? (cmpArtistFilter as any) : (opts.scope === "friends" ? cmpFriends : cmpByLikesThenRecent));
          return merged;
        });
        const minCreated = fetched.reduce<string>((m, x) => (!m || x.created_at < m ? x.created_at : m), "");
        if (minCreated) setCursor(minCreated);
      }
    } finally {
      setLoading(false);
    }
  };

  // primer lote
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      Promise.resolve().then(loadMore);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // auto-cargar hasta terminar (sin botón)
  useEffect(() => {
    if (!loading && !done) loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, loading, done]);

  return { rows, loadMore, done, loading };
}

/* ============================
   Búsquedas
============================ */
function UserSearch() {
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
        .limit(10);
      setRes((data as any) || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q, supabase]);
  return (
    <div className="relative w-full md:w-[420px]">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search users and open their profile"
        className="w-full rounded-full border border-neutral-200 px-4 py-2 outline-none focus:border-[#1F48AF] text-sm"
      />
      {q && res.length > 0 && (
        <div className="absolute z-40 mt-2 w-full rounded-2xl border border-neutral-200 bg-white shadow-xl overflow-hidden">
          <ul className="max-h-[60vh] overflow-auto divide-y divide-neutral-100">
            {res.map((u) => (
              <li key={u.id} className="p-3 hover:bg-neutral-50">
                <Link href={`/profile/${u.username}`} className="flex items-center gap-3">
                  <Avatar size={28} src={u.avatar_url} alt={u.full_name || u.username || "user"} />
                  <div className="min-w-0">
                    <div className="text-sm line-clamp-1">{u.full_name || "—"}</div>
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

function ArtistSearch({ picked, onPick, onClear }: { picked: Artist | null; onPick: (a: Artist) => void; onClear: () => void }) {
  const supabase = useSupabaseClient();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Artist[]>([]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const s = q.trim();
      if (s.length < 2) return setRes([]);
      const { data } = await supabase.from("artists").select("id,name,image_url").ilike("name", `%${s}%`).order("name", { ascending: true }).limit(12);
      setRes((data as Artist[]) || []);
    }, 220);
    return () => clearTimeout(t);
  }, [q, supabase]);

  useEffect(() => {
    const s = q.trim().toLowerCase();
    if (!s || res.length !== 1) return;
    if (res[0].name.toLowerCase() === s) {
      onPick(res[0]); setQ(""); setRes([]);
    }
  }, [q, res, onPick]);

  const selectFirstMatch = () => { if (res.length > 0) { onPick(res[0]); setQ(""); setRes([]); } };

  return (
    <div className="space-y-2">
      <div className="relative w-full">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") selectFirstMatch(); }}
          placeholder="Search artists…"
          className="w-full rounded-full border border-neutral-200 px-4 py-2 outline-none focus:border-[#1F48AF] text-sm"
        />
        {q && res.length > 0 && (
          <div className="absolute z-40 mt-2 w-full rounded-2xl border border-neutral-200 bg-white shadow-xl overflow-hidden">
            <ul className="max-h-[60vh] overflow-auto divide-y divide-neutral-100">
              {res.map((a) => (
                <li key={a.id} className="p-3 hover:bg-neutral-50 flex items-center gap-3 cursor-pointer" onClick={() => { onPick(a); setQ(""); setRes([]); }}>
                  {a.image_url ? <img src={a.image_url} alt={a.name} className="w-7 h-7 rounded object-cover shrink-0" /> : null}
                  <div className="text-sm line-clamp-1">{a.name}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {picked && (
        <div className="flex items-center gap-2">
          <button onClick={onClear} className="px-4 py-2 rounded-full text-white text-sm" style={{ backgroundColor: "#1F48AF" }}>
            {picked.name} ×
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================
   Página
============================ */
export default function FeedPage() {
  const [tab, setTab] = useState<"general" | "friends">("general");
  const [artistFilter, setArtistFilter] = useState<Artist | null>(null);

  const general = useUnifiedFeed({ scope: "for-you", artistId: artistFilter?.id || null, artistName: artistFilter?.name || null });
  const friends = useUnifiedFeed({ scope: "friends" });

  const active = tab === "friends" ? friends : general;

  return (
    <div className="min-h-screen bg-white">
      {/* barra azul */}
      <header className="w-full h-24 bg-[#1F48AF] flex items-end justify-end px-4 sm:px-6 pb-4">
        <Link href="/profile" aria-label="Go to Profile" className="inline-flex items-center gap-1 rounded-full bg-white/95 backdrop-blur px-3 py-1.5 text-[12px] sm:text-xs text-black border border-white/60 hover:bg-white">
          <span className="hidden sm:inline">Profile</span>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 12h13" /><path d="M12 5l7 7-7 7" /></svg>
        </Link>
      </header>

      {/* título + tabs + user search */}
      <div className="mx-auto max-w-[500px] sm:max-w-[620px] md:max-w-[760px] lg:max-w-[820px] px-5 md:px-6 pt-6 sm:pt-8 pb-4">
        <h1 className="text-[clamp(1.6rem,5vw,2.4rem)] font-normal tracking-tight" style={{ fontFamily: "Times New Roman, serif" }}>
          The Wall
        </h1>
        <div className="mt-2 h-px w-full bg-black/10" />

        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setTab("general")} className={`px-4 py-2 rounded-full border text-sm ${tab === "general" ? "bg-[#1F48AF] text-white border-[#1F48AF]" : "bg-white text-black border-neutral-200 hover:border-[#1F48AF]/40"}`}>General</button>
            <button onClick={() => setTab("friends")} className={`px-4 py-2 rounded-full border text-sm ${tab === "friends" ? "bg-[#1F48AF] text-white border-[#1F48AF]" : "bg-white text-black border-neutral-200 hover:border-[#1F48AF]/40"}`}>Friends</button>
          </div>
          <UserSearch />
        </div>

        {tab === "general" && (
          <div className="mt-4">
            <ArtistSearch picked={artistFilter} onPick={(a) => setArtistFilter(a)} onClear={() => setArtistFilter(null)} />
          </div>
        )}
      </div>

      {/* contenido */}
      <main className="mx-auto max-w-[500px] sm:max-w-[620px] md:max-w-[760px] lg:max-w-[820px] px-5 md:px-6 pb-16">
        <div className="flex flex-col gap-6">
          {active.rows.map((r) =>
            r.kind === "concert" ? (
              <PostCardConcert key={`c_${r.id}`} row={r as RowConcert} />
            ) : r.kind === "future_concert" ? (
              <PostCardFutureConcert key={`fc_${r.id}`} row={r as RowFutureConcert} />
            ) : (
              <PostCardRecommendation key={`re_${r.id}`} row={r as RowReco} />
            )
          )}
        </div>

        {/* Sin botón Load more; autoload hasta terminar */}
      </main>
    </div>
  );
}

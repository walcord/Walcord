'use client';

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";

/* ===== Tipos mínimos ===== */
type Row = {
  concert_id: string;
  user_id: string | null;
  username: string | null;
  avatar_url: string | null;
  artist_id: string | null;
  artist_name: string | null;
  tour: string | null;
  city: string | null;
  country: string | null;
  year: number | null;
  last_photo_at: string | null;   // última foto (fallback)
  event_date: string | null;      // FECHA CONCIERTO
  caption?: string | null;
  image_urls: string[] | null;
  like_count: number | null;
  comment_count: number | null;

  // 👇 añadido para categoría
  post_type?: "concert" | "experience" | null;
  experience?: string | null; // 'ballet' | 'opera' | 'club' | ...
};

type Artist = { id: string; name: string; image_url?: string | null };
type Profile = { id: string; username: string | null; full_name: string | null; avatar_url: string | null };

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";

const cap = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

/* ===== Avatar ===== */
const Avatar = ({ src, alt, size = 36 }: { src?: string | null; alt?: string; size?: number }) => (
  <div className="rounded-full overflow-hidden bg-neutral-100 border border-neutral-200 shrink-0" style={{ width: size, height: size }}>
    {src ? <img src={src} alt={alt || "user"} className="w-full h-full object-cover" /> : null}
  </div>
);

/* ===== UserSearch ===== */
function UserSearch() {
  const supabase = useSupabaseClient();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Pick<Profile, "id" | "username" | "full_name" | "avatar_url">[]>([]);
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
      setRes(data || []);
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

/* ===== ArtistSearch (solo en General) ===== */
function ArtistSearch({ picked, onPick, onClear }: { picked: Artist | null; onPick: (a: Artist) => void; onClear: () => void }) {
  const supabase = useSupabaseClient();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Artist[]>([]);
  useEffect(() => {
    const t = setTimeout(async () => {
      const s = q.trim();
      if (s.length < 2) return setRes([]);
      const { data } = await supabase
        .from("artists")
        .select("id,name,image_url")
        .ilike("name", `%${s}%`)
        .order("name", { ascending: true })
        .limit(12);
      setRes((data as Artist[]) || []);
    }, 220);
    return () => clearTimeout(t);
  }, [q, supabase]);

  return (
    <div className="space-y-2">
      <div className="relative w-full">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search artists…" className="w-full rounded-full border border-neutral-200 px-4 py-2 outline-none focus:border-[#1F48AF] text-sm" />
        {q && res.length > 0 && (
          <div className="absolute z-40 mt-2 w-full rounded-2xl border border-neutral-200 bg-white shadow-xl overflow-hidden">
            <ul className="max-h-[60vh] overflow-auto divide-y divide-neutral-100">
              {res.map((a) => (
                <li key={a.id} className="p-3 hover:bg-neutral-50 flex items-center gap-3 cursor-pointer" onClick={() => { onPick(a); setQ(""); setRes([]); }}>
                  <div className="w-7 h-7 rounded-full bg-neutral-100 overflow-hidden shrink-0">
                    {a.image_url ? <img src={a.image_url} alt={a.name} className="w-full h-full object-cover" /> : null}
                  </div>
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

/* ===== Ribbon Friends ===== */
function NowTouringRibbon() {
  const supabase = useSupabaseClient();
  const me = useUser();
  const [rows, setRows] = useState<{ text: string; href: string }[]>([]);
  useEffect(() => {
    (async () => {
      if (!me?.id) return setRows([]);
      // ids: yo + seguidos + amistades
      const [fo, frA, frB] = await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", me.id),
        supabase.from("friendships").select("receiver_id").eq("requester_id", me.id).eq("status", "accepted"),
        supabase.from("friendships").select("requester_id").eq("receiver_id", me.id).eq("status", "accepted"),
      ]);
      const ids = new Set<string>([me.id]);
      (fo.data || []).forEach((r: any) => ids.add(r.following_id));
      (frA.data || []).forEach((r: any) => ids.add(r.receiver_id));
      (frB.data || []).forEach((r: any) => ids.add(r.requester_id));

      // tomamos conciertos/experiencias de esa gente
      const { data: concerts } = await supabase
        .from("concerts")
        .select("id,user_id,artist_id,city,country_code,event_date,tour_name,caption,created_at,post_type,experience")
        .in("user_id", Array.from(ids))
        .order("event_date", { ascending: false })
        .limit(60);

      if (!concerts?.length) return setRows([]);

      // lookup artistas + usuarios
      const artistIds = [...new Set(concerts.map((c: any) => c.artist_id).filter(Boolean))] as string[];
      const userIds = [...new Set(concerts.map((c: any) => c.user_id).filter(Boolean))] as string[];

      const [{ data: artists }, { data: users }] = await Promise.all([
        artistIds.length ? supabase.from("artists").select("id,name").in("id", artistIds) : Promise.resolve({ data: [] }),
        userIds.length ? supabase.from("profiles").select("id,username,full_name").in("id", userIds) : Promise.resolve({ data: [] }),
      ]);

      const aById: Record<string, string> = {};
      (artists || []).forEach((a: any) => (aById[a.id] = a.name));
      const uById: Record<string, string> = {};
      (users || []).forEach((u: any) => (uById[u.id] = u.username));

      const built =
        concerts.map((c: any) => {
          const title = c.post_type === 'experience' && c.experience ? cap(c.experience) : (aById[c.artist_id] || "Concert");
          const place = [c.city, c.country_code].filter(Boolean).join(", ");
          const when = c.event_date ? ` (${new Date(c.event_date).getFullYear()})` : "";
          const tour = c.tour_name ? ` — ${c.tour_name}` : "";
          const who = uById[c.user_id] || "—";
          return { text: `${who} went to ${title}${tour}${place ? ` in ${place}` : ""}${when}`, href: `/post/${c.id}` };
        }) ?? [];

      setRows(built.slice(0, 24));
    })();
  }, [me?.id, supabase]);

  if (rows.length === 0)
    return <div className="w-full overflow-hidden rounded-2xl border border-neutral-200 px-4 py-3 text-sm text-neutral-600">Your friends’ concerts will appear here soon.</div>;

  return (
    <div className="w-full rounded-2xl border border-neutral-200 overflow-hidden">
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent" />
        <div className="flex gap-8 animate-[ticker_40s_linear_infinite] whitespace-nowrap px-4 py-3 text-sm">
          {rows.concat(rows).map((r, i) => (
            <Link key={i} href={r.href} className="text-black hover:text-[#1F48AF] transition">
              {r.text}
            </Link>
          ))}
        </div>
      </div>
      <style jsx>{`@keyframes ticker { 0% {transform: translateX(0);} 100% {transform: translateX(-50%);} }`}</style>
    </div>
  );
}

/* ===== MediaBlock — 4 cuadrados + overlay ===== */
function MediaBlock({ urls, postId }: { urls: string[]; postId: string }) {
  const total = urls.length;
  if (total <= 0) return null;

  // Mostrar siempre cuadrado y máximo 4
  const take = urls.slice(0, 4);
  const more = Math.max(0, total - take.length);

  return (
    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
      {take.map((u, i) => {
        const isLast = i === 3 && more > 0;
        return (
          <Link
            key={i}
            href={`/post/${postId}`}
            className="relative overflow-hidden rounded-2xl bg-neutral-100 block aspect-square"
          >
            <img src={u} alt="" className="absolute inset-0 w-full h-full object-cover" />
            {isLast && (
              <div className="absolute inset-0 bg-black/45 text-white flex items-center justify-center text-base sm:text-lg font-medium">
                +{Math.min(more, 99)}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/* ===== Colores de artista (de cualquier record del artista) ===== */
function useArtistColors(artistId: string | null) {
  const supabase = useSupabaseClient();
  const [colors, setColors] = useState<{ vibe?: string | null; cover?: string | null }>({});
  useEffect(() => {
    (async () => {
      if (!artistId) return setColors({});
      const { data } = await supabase.from("records").select("vibe_color,cover_color").eq("artist_id", artistId).limit(1);
      setColors({ vibe: data?.[0]?.vibe_color || null, cover: data?.[0]?.cover_color || null });
    })();
  }, [artistId, supabase]);
  return colors;
}

/* ===== Comentarios (carga) ===== */
function useComments(concertId: string | null) {
  const supabase = useSupabaseClient();
  const me = useUser();
  const [items, setItems] = useState<Array<{ id: string; user_id: string; text: string; created_at: string; username?: string | null; avatar_url?: string | null }>>([]);
  const load = async () => {
    if (!concertId) return;
    const { data } = await supabase
      .from("concert_comments")
      .select("id,concert_id,user_id,body,created_at,profiles!inner(username,avatar_url)")
      .eq("concert_id", concertId)
      .order("created_at", { ascending: true });
    const rows = (data || []).map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      text: r.body as string,
      created_at: r.created_at,
      username: r.profiles?.username ?? null,
      avatar_url: r.profiles?.avatar_url ?? null,
    }));
    setItems(rows);
  };
  const send = async (text: string) => {
    if (!me?.id || !concertId || !text.trim()) return;
    await supabase.from("concert_comments").insert({ concert_id: concertId, user_id: me.id, body: text.trim() });
    await load();
  };
  return { items, load, send };
}

/* ===== PostCard (del feed) ===== */
function PostCardFeed({ row }: { row: Row }) {
  const supabase = useSupabaseClient();
  const me = useUser();
  const colors = useArtistColors(row.artist_id);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(row.like_count ?? 0);
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const { items, load, send } = useComments(row.concert_id);

  useEffect(() => {
    (async () => {
      if (!me?.id) return setLiked(false);
      const { data } = await supabase.from("concert_likes").select("concert_id").eq("concert_id", row.concert_id).eq("user_id", me.id).maybeSingle();
      setLiked(!!data);
    })();
  }, [me?.id, supabase, row.concert_id]);

  const toggleLike = async () => {
    if (!me?.id) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      if (next) {
        await supabase.from("concert_likes").upsert({ concert_id: row.concert_id, user_id: me.id }, { onConflict: "concert_id,user_id" });
      } else {
        await supabase.from("concert_likes").delete().eq("concert_id", row.concert_id).eq("user_id", me.id);
      }
    } catch {
      setLiked(!next);
      setLikeCount((n) => Math.max(0, n + (next ? -1 : 1)));
    }
  };

  const vibe = colors.vibe || "#E9EDF7";
  const cover = colors.cover || "#C9D6F5";
  const photos = (row.image_urls || []).filter(Boolean);

  // 👇 Encabezado: si es experience → categoría; si no, artista o "Concert"
  const headerLeft = row.post_type === 'experience' && row.experience
    ? cap(row.experience)
    : (row.artist_name || "Concert");

  return (
    <article className="rounded-3xl border border-neutral-200 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Link href={`/profile/${row.username || ""}`} className="flex items-center gap-3 min-w-0">
          <Avatar src={row.avatar_url} alt={row.username || "user"} />
          <div className="min-w-0">
            <div className="text-[13px] text-neutral-800 leading-tight line-clamp-1">{row.username || "—"}</div>
            <div className="text-[11px] text-neutral-500 leading-tight">{fmtDate(row.event_date || row.last_photo_at)}</div>
          </div>
        </Link>
      </div>

      {/* chip colores + títulos */}
      <div className="px-4 pb-2 flex items-center gap-3">
        <div className="p-[6px] rounded-xl" style={{ background: vibe }}>
          <div className="w-10 h-10 rounded-[10px] bg-white flex items-center justify-center">
            <div className="w-6 h-6 rounded-md" style={{ background: cover }} />
          </div>
        </div>
        <div className="min-w-0">
          {/* MISMA FUENTE QUE "THE WALL" */}
          <div
            className="text-[15px] leading-tight line-clamp-1"
            style={{ fontFamily: "Times New Roman, serif", fontWeight: 400 }}
          >
            {headerLeft}{row.tour ? ` — ${row.tour}` : ""}
          </div>
          <div className="text-[12px] text-neutral-500 leading-tight line-clamp-1">
            {row.city || ""}{row.country ? `, ${row.country}` : ""}{row.year ? ` · ${row.year}` : ""}
          </div>
        </div>
      </div>

      {/* caption */}
      {row.caption ? <div className="px-4 pt-1 pb-2 text-[15px] leading-relaxed">{row.caption}</div> : null}

      {/* fotos */}
      <div className="px-4 pb-3">
        <MediaBlock urls={photos} postId={row.concert_id} />
      </div>

      {/* footer */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-5 text-sm">
          <button
            onClick={toggleLike}
            className={`px-4 py-2 rounded-full border ${liked ? "border-[#1F48AF] text-[#1F48AF] bg-[#1F48AF]/10" : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"}`}
          >
            {liked ? "Liked" : "Like"}
          </button>
            <div className="text-sm text-zinc-600">
              {likeCount} likes · {row.comment_count ?? 0} comments
            </div>
          </div>

        <button
          className="mt-2 text-[#1F48AF] text-sm"
          onClick={async () => {
            const next = !open;
            setOpen(next);
            if (next) await load();
          }}
        >
          {open ? "Hide comments" : "View comments"}
        </button>

        {open && (
          <div className="mt-2 space-y-2">
            {items.length === 0 ? (
              <div className="text-[13px] text-neutral-500">No comments yet.</div>
            ) : (
              items.map((c) => (
                <div key={c.id} className="flex items-start gap-2">
                  <Avatar size={26} src={c.avatar_url} alt={c.username || "user"} />
                  <div className="bg-neutral-50 border border-neutral-200 rounded-2xl px-3 py-2 flex-1">
                    <div className="text-[12px] text-neutral-800 font-medium">{c.username || "—"}</div>
                    <div className="text-[13px] leading-snug">{c.text}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div className="mt-3 flex items-center gap-3">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="flex-1 rounded-2xl border border-zinc-300 px-4 py-3 text-[15px] outline-none"
            placeholder="Write a comment…"
          />
          <button
            onClick={async () => {
              const t = comment.trim();
              if (!t) return;
              await send(t);
              setComment("");
            }}
            className="px-4 py-2 rounded-full bg-[#7A8FD8] text-white"
          >
            Send
          </button>
        </div>
      </div>
    </article>
  );
}

/* ===== Hook feed (General/Friends) — SIN VIEW: construye desde tablas ===== */
function useConcertFeed(opts: { scope: "for-you" | "friends"; artistId?: string | null }) {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(0);
  const [done, setDone] = useState(false);
  const PAGE = 10;

  // reset también cuando el user.id cambia (para Friends)
  useEffect(() => { setRows([]); setPage(0); setDone(false); }, [opts.scope, opts.artistId, user?.id]);

  const fetchPage = async (pageIndex: number) => {
    // usuarios permitidos en FRIENDS: YO + seguidos + amistades
    let allowedUserIds: string[] | null = null;
    if (opts.scope === "friends") {
      if (!user?.id) return { data: [] as Row[] }; // importante: no marcamos done aquí
      const [fo, frA, frB] = await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", user.id),
        supabase.from("friendships").select("receiver_id").eq("requester_id", user.id).eq("status", "accepted"),
        supabase.from("friendships").select("requester_id").eq("receiver_id", user.id).eq("status", "accepted"),
      ]);
      const ids = new Set<string>([user.id]);
      (fo.data || []).forEach((r: any) => ids.add(r.following_id));
      (frA.data || []).forEach((r: any) => ids.add(r.receiver_id));
      (frB.data || []).forEach((r: any) => ids.add(r.requester_id));
      allowedUserIds = Array.from(ids);
    }

    // En Friends queremos "lo más reciente" → created_at DESC
    let cq = supabase
      .from("concerts")
      .select("id,user_id,artist_id,city,country_code,event_date,tour_name,caption,created_at,post_type,experience")
      .order("created_at", { ascending: false })
      .range(pageIndex * PAGE, pageIndex * PAGE + PAGE - 1);

    if (allowedUserIds) cq = cq.in("user_id", allowedUserIds);
    if (opts.artistId) cq = cq.eq("artist_id", opts.artistId);

    const { data: concerts } = await cq;
    if (!concerts?.length) return { data: [] as Row[] };

    const concertIds = concerts.map((c: any) => c.id);
    const artistIds = [...new Set(concerts.map((c: any) => c.artist_id).filter(Boolean))] as string[];
    const userIds = [...new Set(concerts.map((c: any) => c.user_id).filter(Boolean))] as string[];

    // 2) Media (máx 12 por post) + última foto para fallback
    const { data: media } = await supabase
      .from("concert_media")
      .select("concert_id,url,created_at")
      .in("concert_id", concertIds)
      .order("created_at", { ascending: true });

    const urlsByConcert: Record<string, string[]> = {};
    const lastPhotoAt: Record<string, string> = {};
    (media || []).forEach((m: any) => {
      const arr = (urlsByConcert[m.concert_id] ||= []);
      if (arr.length < 12) arr.push(m.url);
      if (!lastPhotoAt[m.concert_id] || m.created_at > lastPhotoAt[m.concert_id]) {
        lastPhotoAt[m.concert_id] = m.created_at;
      }
    });

    // 3) Artistas + perfiles
    const [{ data: artists }, { data: profs }] = await Promise.all([
      artistIds.length ? supabase.from("artists").select("id,name").in("id", artistIds) : Promise.resolve({ data: [] }),
      userIds.length ? supabase.from("profiles").select("id,username,avatar_url").in("id", userIds) : Promise.resolve({ data: [] }),
    ]);
    const aById: Record<string, string> = {};
    (artists || []).forEach((a: any) => (aById[a.id] = a.name));
    const uName: Record<string, { username: string | null; avatar_url: string | null }> = {};
    (profs || []).forEach((p: any) => (uName[p.id] = { username: p.username, avatar_url: p.avatar_url }));

    // 4) Likes y Comments (conteos)
    const [{ data: likeRows }, { data: comRows }] = await Promise.all([
      supabase.from("concert_likes").select("concert_id").in("concert_id", concertIds),
      supabase.from("concert_comments").select("concert_id").in("concert_id", concertIds),
    ]);

    const likes: Record<string, number> = {};
    (likeRows || []).forEach((r: any) => { likes[r.concert_id] = (likes[r.concert_id] ?? 0) + 1; });

    const comments: Record<string, number> = {};
    (comRows || []).forEach((r: any) => { comments[r.concert_id] = (comments[r.concert_id] ?? 0) + 1; });

    // 5) Build filas
    const data: Row[] = concerts.map((c: any) => ({
      concert_id: c.id,
      user_id: c.user_id ?? null,
      username: uName[c.user_id]?.username ?? null,
      avatar_url: uName[c.user_id]?.avatar_url ?? null,
      artist_id: c.artist_id ?? null,
      artist_name: aById[c.artist_id] ?? null,
      tour: c.tour_name ?? null,
      city: c.city ?? null,
      country: c.country_code ?? null, // <- usamos country_code en el select
      year: c.event_date ? new Date(c.event_date).getFullYear() : null,
      event_date: c.event_date ?? null,
      last_photo_at: lastPhotoAt[c.id] || c.created_at || null,
      caption: c.caption ?? null,
      image_urls: (urlsByConcert[c.id] || []).slice(0, 12),
      like_count: likes[c.id] ?? 0,
      comment_count: comments[c.id] ?? 0,
      post_type: c.post_type ?? null,
      experience: c.experience ?? null,
    }));

    // 🔒 Orden en "General": por likes desc, después fecha concierto desc
    if (opts.scope === "for-you") {
      data.sort((a, b) => {
        const dl = (b.like_count ?? 0) - (a.like_count ?? 0);
        if (dl !== 0) return dl;
        return (b.event_date || "").localeCompare(a.event_date || "");
      });
    }

    return { data };
  };

  useEffect(() => {
    (async () => {
      // espera a tener user.id en Friends para la primera página
      if (opts.scope === "friends" && !user?.id) return;
      if (done) return;
      const { data } = await fetchPage(page);
      setRows(prev => {
        const map = new Map<string, Row>();
        [...prev, ...data].forEach(r => map.set(r.concert_id, r));
        const arr = Array.from(map.values());
        // 🔒 Reordenar SIEMPRE tras merge para mantener el orden por likes
        if (opts.scope === "for-you") {
          arr.sort((a, b) => {
            const dl = (b.like_count ?? 0) - (a.like_count ?? 0);
            if (dl !== 0) return dl;
            return (b.event_date || "").localeCompare(a.event_date || "");
          });
        }
        return arr;
      });
      if (data.length < PAGE) setDone(true);
    })();
  }, [page, done, opts.scope, user?.id]); // deps clave

  return { rows, loadMore: () => setPage((p) => p + 1), done };
}

/* ===== Página ===== */
export default function FeedPage() {
  const [tab, setTab] = useState<"general" | "friends">("general");
  const [artistFilter, setArtistFilter] = useState<Artist | null>(null);

  const general = useConcertFeed({ scope: "for-you", artistId: artistFilter?.id || null });
  const friends = useConcertFeed({ scope: "friends" });

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

      {/* contenido: posts */}
      <main className="mx-auto max-w-[500px] sm:max-w-[620px] md:max-w-[760px] lg:max-w-[820px] px-5 md:px-6 pb-16">
        {tab === "friends" ? (
          <>
            <NowTouringRibbon />
            <div className="mt-6 flex flex-col gap-6">
              {friends.rows.map((r) => (
                <PostCardFeed key={r.concert_id} row={r} />
              ))}
            </div>
            {!friends.done && (
              <div className="text-center mt-6">
                <button onClick={friends.loadMore} className="rounded-full px-4 py-2 border border-neutral-300 hover:bg-neutral-50 text-sm">Load more</button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col gap-6">
              {general.rows.map((r) => (
                <PostCardFeed key={r.concert_id} row={r} />
              ))}
            </div>
            {!general.done && (
              <div className="text-center mt-6">
                <button onClick={general.loadMore} className="rounded-full px-4 py-2 border border-neutral-300 hover:bg-neutral-50 text-sm">Load more</button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

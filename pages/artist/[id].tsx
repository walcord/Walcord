"use client";

import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

/* =========================
   Tipos mínimos
   ========================= */
type RecordRow = {
  id: string;
  title: string | null;
  release_year: number | null;
  vibe_color: string | null;
  cover_color: string | null;
};

type ArtistRow = {
  id: string;
  name: string | null;
  description: string | null;
  records: RecordRow[];
};

/* ===== FILAS DE FEED (idéntico a pages/feed.tsx) ===== */
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
};

/* =========================
   Utils y subcomponentes
   ========================= */
const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

const Avatar = ({
  src,
  alt,
  size = 32, // ↓ más pequeño en móvil
}: {
  src?: string | null;
  alt?: string;
  size?: number;
}) => (
  <div
    className="rounded-full overflow-hidden bg-neutral-100 border border-neutral-200 shrink-0"
    style={{ width: size, height: size }}
  >
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {src ? <img src={src} alt={alt || "user"} className="w-full h-full object-cover" /> : null}
  </div>
);

/* ===== MediaBlock (copiado de feed, compactado) ===== */
function MediaBlock({ urls, postId }: { urls: string[]; postId: string }) {
  const n = urls.length;
  if (n <= 0) return null;

  // 1 foto → formato horizontal (recorte)
  if (n === 1) {
    return (
      <Link href={`/post/${postId}`} className="block overflow-hidden rounded-xl bg-neutral-100">
        <div className="w-full aspect-video relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urls[0]} alt="" className="absolute inset-0 w-full h-full object-cover" />
        </div>
      </Link>
    );
  }

  // 2–5 fotos → grid
  if (n <= 5) {
    const take = urls.slice(0, n);
    return (
      <div className={`grid gap-1.5 ${n === 2 ? "grid-cols-2" : n === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {take.map((u, i) => (
          <Link key={i} href={`/post/${postId}`} className="overflow-hidden rounded-xl bg-neutral-100 block">
            <div className="w-full aspect-[4/3] relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="absolute inset-0 w-full h-full object-cover" />
            </div>
          </Link>
        ))}
      </div>
    );
  }

  // 6+ fotos → mostrar 6 y overlay "See more →"
  const first = urls.slice(0, 6);
  const remaining = n - 6;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
      {first.map((u, i) => {
        const isLast = i === 5;
        return (
          <Link key={i} href={`/post/${postId}`} className="relative overflow-hidden rounded-xl bg-neutral-100 block">
            <div className="w-full aspect-[4/3] relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="absolute inset-0 w-full h-full object-cover" />
              {isLast && remaining > 0 && (
                <div className="absolute inset-0 bg-black/45 text-white flex items-center justify-center text-xs md:text-sm font-medium">
                  See more →
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/* ===== Colores de artista (chip) ===== */
function useArtistColors(artistId: string | null) {
  const [colors, setColors] = useState<{ vibe?: string | null; cover?: string | null }>({});
  useEffect(() => {
    (async () => {
      if (!artistId) return setColors({});
      const { data } = await supabase
        .from("records")
        .select("vibe_color,cover_color")
        .eq("artist_id", artistId)
        .limit(1);
      setColors({
        vibe: data?.[0]?.vibe_color || null,
        cover: data?.[0]?.cover_color || null,
      });
    })();
  }, [artistId]);
  return colors;
}

/* ===== PostCard (compacto en móvil) ===== */
function PostCard({ row }: { row: Row }) {
  const colors = useArtistColors(row.artist_id);
  const vibe = colors.vibe || "#E9EDF7";
  const cover = colors.cover || "#C9D6F5";
  const photos = (row.image_urls || []).filter(Boolean);

  return (
    <article className="w-full rounded-2xl border border-neutral-200 bg-white shadow-[0_6px_18px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Link href={`/profile/${row.username || ""}`} className="flex items-center gap-2.5 min-w-0">
          <Avatar src={row.avatar_url} alt={row.username || "user"} />
          <div className="min-w-0">
            <div className="text-[12px] text-neutral-800 leading-tight line-clamp-1">{row.username || "—"}</div>
            <div className="text-[10px] text-neutral-500 leading-tight">{fmtDate(row.event_date || row.last_photo_at)}</div>
          </div>
        </Link>
      </div>

      {/* chip colores + títulos */}
      <div className="px-3 pb-1.5 flex items-center gap-2.5">
        <div className="p-[5px] rounded-lg" style={{ background: vibe }}>
          <div className="w-9 h-9 rounded-[10px] bg-white flex items-center justify-center">
            <div className="w-5 h-5 rounded-md" style={{ background: cover }} />
          </div>
        </div>
        <div className="min-w-0">
          <div
            className="text-[14px] leading-tight line-clamp-1"
            style={{ fontFamily: "Times New Roman, serif", fontWeight: 400 }}
          >
            {row.artist_name || "Concert"}{row.tour ? ` — ${row.tour}` : ""}
          </div>
          <div className="text-[11px] text-neutral-500 leading-tight line-clamp-1">
            {row.city || ""}{row.country ? `, ${row.country}` : ""}{row.year ? ` · ${row.year}` : ""}
          </div>
        </div>
      </div>

      {/* caption */}
      {row.caption ? <div className="px-3 pt-1 pb-1.5 text-[14px] leading-relaxed">{row.caption}</div> : null}

      {/* fotos */}
      <div className="px-3 pb-2">
        {photos.length > 0 ? <MediaBlock urls={photos as string[]} postId={row.concert_id} /> : null}
      </div>

      {/* footer (conteos estáticos) */}
      <div className="px-3 pb-3 text-[12px] text-zinc-600">
        {(row.like_count ?? 0)} likes · {(row.comment_count ?? 0)} comments
      </div>
    </article>
  );
}

/* =========================
   Página
   ========================= */
export default function ArtistProfile() {
  const router = useRouter();
  const { id } = router.query;

  const [artist, setArtist] = useState<ArtistRow | null>(null);
  const [loading, setLoading] = useState(true);

  // filas de posts (conciertos) como en feed
  const [rows, setRows] = useState<Row[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  /* ===== Cargar artista + discos ===== */
  useEffect(() => {
    if (!router.isReady || !id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("artists")
        .select("*, records(id,title,release_year,vibe_color,cover_color)")
        .eq("id", id)
        .single();

      if (data) {
        (data as any).records =
          (data as any).records?.sort(
            (a: RecordRow, b: RecordRow) => (b.release_year ?? 0) - (a.release_year ?? 0)
          ) || [];
        setArtist(data as unknown as ArtistRow);
      }
      setLoading(false);
    })();
  }, [router.isReady, id]);

  /* ===== Cargar posts del ARTISTA igual que feed (concerts + concert_media) ===== */
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoadingPosts(true);

      // 1) Concerts del artista
      const { data: concerts } = await supabase
        .from("concerts")
        .select("id,user_id,artist_id,city,country_code,event_date,tour_name,caption,created_at")
        .eq("artist_id", id as string);

      if (!concerts || concerts.length === 0) {
        setRows([]);
        setLoadingPosts(false);
        return;
      }

      const concertIds = concerts.map((c: any) => c.id);
      const userIds = [...new Set(concerts.map((c: any) => c.user_id).filter(Boolean))] as string[];

      // 2) Media (max 12 por post) + última foto
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

      // 3) Perfiles + nombre artista
      const [{ data: profs }, { data: artistData }] = await Promise.all([
        userIds.length
          ? supabase.from("profiles").select("id,username,avatar_url").in("id", userIds)
          : Promise.resolve({ data: [] }),
        supabase.from("artists").select("id,name").eq("id", id as string).single(),
      ]);

      const uName: Record<string, { username: string | null; avatar_url: string | null }> = {};
      (profs || []).forEach((p: any) => (uName[p.id] = { username: p.username, avatar_url: p.avatar_url }));
      const artistName = (artistData as any)?.name ?? null;

      // 4) Likes + Comments
      const [{ data: likeRows }, { data: comRows }] = await Promise.all([
        supabase.from("concert_likes").select("concert_id").in("concert_id", concertIds),
        supabase.from("concert_comments").select("concert_id").in("concert_id", concertIds),
      ]);

      const likes: Record<string, number> = {};
      (likeRows || []).forEach((r: any) => {
        likes[r.concert_id] = (likes[r.concert_id] ?? 0) + 1;
      });

      const comments: Record<string, number> = {};
      (comRows || []).forEach((r: any) => {
        comments[r.concert_id] = (comments[r.concert_id] ?? 0) + 1;
      });

      // 5) Build filas
      const built: Row[] =
        concerts.map((c: any) => ({
          concert_id: c.id,
          user_id: c.user_id ?? null,
          username: uName[c.user_id]?.username ?? null,
          avatar_url: uName[c.user_id]?.avatar_url ?? null,
          artist_id: c.artist_id ?? null,
          artist_name: artistName,
          tour: c.tour_name ?? null,
          city: c.city ?? null,
          country: c.country_code ?? null,
          year: c.event_date ? new Date(c.event_date).getFullYear() : null,
          event_date: c.event_date ?? null,
          last_photo_at: lastPhotoAt[c.id] || c.created_at || null,
          caption: c.caption ?? null,
          image_urls: (urlsByConcert[c.id] || []).slice(0, 12),
          like_count: likes[c.id] ?? 0,
          comment_count: comments[c.id] ?? 0,
        })) || [];

      // 6) Orden: likes desc, luego fecha concierto desc
      built.sort((a, b) => {
        const dl = (b.like_count ?? 0) - (a.like_count ?? 0);
        if (dl !== 0) return dl;
        return (b.event_date || "").localeCompare(a.event_date || "");
      });

      setRows(built);
      setLoadingPosts(false);
    })();
  }, [id]);

  /* ===== Estilos editoriales (tipos más pequeños) ===== */
  const headingStyle = useMemo(
    () => ({ fontFamily: "Times New Roman", fontWeight: 400, letterSpacing: "0.3px" }),
    []
  );
  const bodyStyle = useMemo(() => ({ fontFamily: "Roboto", opacity: 0.9 }), []);

  return (
    <main className="min-h-screen bg-white text-black">
      {/* Banner azul sobrio */}
      <header className="w-full h-20 bg-[#1F48AF] flex items-end px-4 sm:px-6 pb-2">
        <button
          onClick={() => history.back()}
          aria-label="Go back"
          className="p-1.5 rounded-full hover:bg-[#1A3A95] transition"
        >
          <svg
            width="18"
            height="18"
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

      {/* CONTENIDO */}
      <div className="px-4 sm:px-6 md:px-24 pt-8 md:pt-10 pb-24">
        {/* Cabecera (centrada y contenida) */}
        <div className="mx-auto w-full max-w-[680px]">
          <h1
            className="text-[clamp(1.6rem,3vw,2.25rem)] mb-6 md:mb-8 tracking-tight"
            style={headingStyle}
          >
            {loading ? " " : (artist?.name ?? "—")}
          </h1>
        </div>

        {/* Texto + Records (contenidos) */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12 mx-auto w-full max-w-[1100px]">
            <div className="col-span-1 max-w-xl">
              <div className="h-16 bg-neutral-200 rounded-2xl mb-4" />
              <div className="h-2.5 w-3/4 bg-neutral-200 rounded mb-2" />
              <div className="h-2.5 w-2/3 bg-neutral-200 rounded mb-2" />
              <div className="h-2.5 w-1/2 bg-neutral-200 rounded" />
            </div>
            <div className="col-span-2">
              <div className="h-3 w-28 bg-neutral-200 rounded mb-3" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="w-full aspect-square rounded-xl bg-neutral-200" />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12 mx-auto w-full max-w-[1100px]">
            {/* COLUMNA IZQUIERDA — descripción editorial */}
            <div className="col-span-1 max-w-xl">
              <p
                className="text-[14px] md:text-[15px] leading-7 md:leading-8 font-light"
                style={bodyStyle}
              >
                {artist?.description}
              </p>
            </div>

            {/* COLUMNA DERECHA — Records (más pequeños) */}
            <div className="col-span-2">
              <h2 className="text-[17px] md:text-[19px] mb-3 md:mb-4" style={headingStyle}>
                Records
              </h2>

              {artist?.records?.length ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 md:gap-4">
                  {artist.records.map((record) => (
                    <Link
                      key={record.id}
                      href={`/record/${record.id}`}
                      className="flex flex-col items-start group"
                      aria-label={`Open ${record.title ?? ""}`}
                    >
                      <div
                        className="w-full aspect-square mb-1.5 rounded-xl shadow-sm flex items-center justify-center transition-transform group-hover:scale-[1.01]"
                        style={{
                          backgroundColor: record.vibe_color || "#f2f2f2",
                        }}
                      >
                        <div
                          className="w-8 h-8 md:w-9 md:h-9 rounded-sm"
                          style={{ backgroundColor: record.cover_color || "#d9d9d9" }}
                        />
                      </div>
                      <p className="text-[12.5px] md:text-[13.5px] font-light" style={{ fontFamily: "Roboto" }}>
                        {record.title}
                      </p>
                      <p className="text-[11.5px] text-gray-500 font-light" style={{ fontFamily: "Roboto" }}>
                        {record.release_year ?? ""}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center text-neutral-500 py-10">
                  No records found for this artist.
                </div>
              )}
            </div>
          </div>
        )}

        {/* POSTS DEL ARTISTA — compactados y con margen lateral en móvil */}
        <section className="mt-10 md:mt-12">
          <div className="mx-auto w-full max-w-[680px]">
            <h2 className="text-[17px] md:text-[19px] mb-3 md:mb-4" style={headingStyle}>
              Posts
            </h2>
          </div>

          {loadingPosts ? (
            <div className="mx-auto w-full max-w-[680px] space-y-4 px-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-36 bg-neutral-100 rounded-2xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="mx-auto w-full max-w-[680px] text-center text-neutral-500 py-10 px-3">
              No posts for this artist yet.
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {rows.map((r) => (
                <div
                  key={r.concert_id}
                  className="mx-auto w-full max-w-[420px] sm:max-w-[520px] px-3" // <<< CONTENCIÓN MÓVIL
                >
                  <PostCard row={r} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

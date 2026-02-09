"use client";

import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import PostCard from "../../components/PostCard";

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

/* ===== Concerts (mismo estilo que The Idol) ===== */
type ConcertMemory = {
  id: string;
  title: string;
  city: string;
  countryCode: string;
  year: number;
  userName: string;
  createdAt: string;
  imageUrls: string[];
  artist_id?: string | null;
  country_code?: string | null;
  event_date?: string | null;
  cover_url?: string | null;
  artist_name?: string | null;
  country_name?: string | null;
};

/* =========================
   Página
   ========================= */
export default function ArtistProfile() {
  const router = useRouter();
  const { id } = router.query;

  const supabase = useSupabaseClient();

  const [artist, setArtist] = useState<ArtistRow | null>(null);
  const [loadingArtist, setLoadingArtist] = useState(true);

  const [concerts, setConcerts] = useState<ConcertMemory[]>([]);
  const [loadingConcerts, setLoadingConcerts] = useState(true);

  /* ===== Cargar artista + discos ===== */
  useEffect(() => {
    if (!router.isReady || !id) return;

    (async () => {
      setLoadingArtist(true);
      const { data } = await supabase
        .from("artists")
        .select("*, records(id,title,release_year,vibe_color,cover_color)")
        .eq("id", id)
        .single();

      if (data) {
        (data as any).records =
          (data as any).records?.sort(
            (a: RecordRow, b: RecordRow) =>
              (b.release_year ?? 0) - (a.release_year ?? 0)
          ) || [];
        setArtist(data as unknown as ArtistRow);
      }
      setLoadingArtist(false);
    })();
  }, [router.isReady, id, supabase]);

  /* ===== Cargar concerts del artista (estilo PostCard global) ===== */
  useEffect(() => {
    if (!id) return;

    (async () => {
      setLoadingConcerts(true);

      const { data: concertsData, error } = await supabase
        .from("concerts")
        .select(
          "id, city, country_code, event_date, tour_name, artist_id, created_at"
        )
        .eq("artist_id", id as string)
        .order("event_date", { ascending: false });

      let concertsMapped: ConcertMemory[] = [];

      if (!error && concertsData && concertsData.length > 0) {
        const concertIds = concertsData.map((c: any) => c.id as string);

        let mediaMap = new Map<string, string[]>();

        if (concertIds.length > 0) {
          const { data: mediaData } = await supabase
            .from("concert_media")
            .select("concert_id, url, created_at")
            .in("concert_id", concertIds)
            .order("created_at", { ascending: true });

          if (mediaData) {
            mediaMap = new Map<string, string[]>();
            mediaData.forEach((m: any) => {
              const key = m.concert_id as string;
              const arr = mediaMap.get(key) ?? [];
              if (m.url) arr.push(m.url as string);
              mediaMap.set(key, arr);
            });
          }
        }

        const artistName = (artist?.name as string | null) ?? null;

        concertsMapped = concertsData.map((c: any) => {
          const imgs = mediaMap.get(c.id as string) ?? [];
          const mainImg = imgs[0] ?? null;

          return {
            id: c.id as string,
            title: (c.tour_name as string) ?? "",
            city: (c.city as string) ?? "",
            countryCode: (c.country_code as string) ?? "",
            year: c.event_date
              ? new Date(c.event_date).getFullYear()
              : new Date().getFullYear(),
            userName: "",
            createdAt: c.created_at
              ? new Date(c.created_at).toISOString()
              : "",
            imageUrls: imgs,
            artist_id: (c.artist_id as string) ?? null,
            country_code: (c.country_code as string) ?? null,
            event_date: (c.event_date as string) ?? null,
            cover_url: mainImg,
            artist_name: artistName,
            country_name:
              c.city && c.country_code
                ? `${c.city}, ${c.country_code}`
                : null,
          } as ConcertMemory;
        });
      }

      setConcerts(concertsMapped);
      setLoadingConcerts(false);
    })();
  }, [id, supabase, artist?.name]);

  /* ===== Estilos editoriales ===== */
  const headingStyle = useMemo(
    () => ({
      fontFamily: "Times New Roman, serif",
      fontWeight: 400,
      letterSpacing: "0.3px",
    }),
    []
  );
  const bodyStyle = useMemo(
    () => ({ fontFamily: "Roboto, system-ui, sans-serif", opacity: 0.9 }),
    []
  );

  return (
    <main className="min-h-screen bg-white text-black">
      {/* TOP — back button */}
      <div className="w-full px-5 sm:px-12 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-4 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          title="Back"
          className="flex items-center gap-2 text-[#264AAE] font-light text-[0.95rem]"
        >
          <span className="text-[1.35rem] leading-none -mt-[1px]">‹</span>
          <span>Back</span>
        </button>
        <div className="w-[60px]" />
      </div>

      <div className="mx-auto w-full max-w-[1040px] px-4 sm:px-6 pt-2 pb-[calc(env(safe-area-inset-bottom)+6.5rem)]">
        {/* CABECERA ARTISTA */}
        <section className="mx-auto w-full max-w-[720px]">
          <h1
            className="text-[clamp(1.7rem,3.1vw,2.4rem)] mb-6 md:mb-8 tracking-tight"
            style={headingStyle}
          >
            {loadingArtist ? " " : artist?.name ?? "—"}
          </h1>
        </section>

        {/* DESCRIPCIÓN + RECORDS */}
        {loadingArtist ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12 mx-auto w-full max-w-[1040px]">
            <div className="col-span-1 max-w-xl">
              <div className="h-16 bg-neutral-200 rounded-2xl mb-4" />
              <div className="h-2.5 w-3/4 bg-neutral-200 rounded mb-2" />
              <div className="h-2.5 w-2/3 bg-neutral-200 rounded mb-2" />
              <div className="h-2.5 w-1/2 bg-neutral-200 rounded" />
            </div>
            <div className="col-span-2">
              <div className="h-3 w-28 bg-neutral-200 rounded mb-3" />
              <div className="flex gap-3.5 md:gap-4 overflow-x-auto pb-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-[110px] md:w-[120px] aspect-square rounded-2xl bg-neutral-200"
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12 mx-auto w-full max-w-[1040px]">
            {/* COLUMNA IZQUIERDA — descripción editorial */}
            <div className="col-span-1 max-w-xl">
              <p
                className="text-[14px] md:text-[15px] leading-7 md:leading-8 font-light"
                style={bodyStyle}
              >
                {artist?.description}
              </p>
            </div>

            {/* COLUMNA DERECHA — Records en fila deslizable */}
            <div className="col-span-2">
              <h2
                className="text-[17px] md:text-[19px] mb-3 md:mb-4"
                style={headingStyle}
              >
                Records
              </h2>

              {artist?.records?.length ? (
                <div className="-mx-1 overflow-x-auto pb-2">
                  <div className="flex flex-nowrap gap-3.5 md:gap-4 px-1">
                    {artist.records.map((record) => (
                      <Link
                        key={record.id}
                        href={`/record/${record.id}`}
                        className="inline-flex w-[110px] md:w-[120px] flex-col items-start group shrink-0"
                        aria-label={`Open ${record.title ?? ""}`}
                      >
                        <div className="relative w-full pt-[100%] rounded-2xl shadow-sm overflow-hidden transition-transform group-hover:scale-[1.02]">
                          <div
                            className="absolute inset-0 rounded-2xl"
                            style={{
                              backgroundColor: record.vibe_color || "#f2f2f2",
                            }}
                          />
                          <div
                            className="absolute inset-[26%] rounded-md"
                            style={{
                              backgroundColor:
                                record.cover_color || "#d9d9d9",
                            }}
                          />
                        </div>
                        <p
                          className="mt-1.5 text-[12.5px] md:text-[13.5px] font-light line-clamp-2"
                          style={{ fontFamily: "Roboto" }}
                        >
                          {record.title}
                        </p>
                        <p
                          className="text-[11.5px] text-gray-500 font-light"
                          style={{ fontFamily: "Roboto" }}
                        >
                          {record.release_year ?? ""}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* NAV (mantener estilo anterior: pequeño + subrayado) */}
        <section className="mt-10 md:mt-12 mx-auto w-full max-w-[720px]">
          <div className="flex gap-6 text-sm">
            <button type="button" className="relative pb-1 text-left">
              <span
                className="text-[1.15rem] text-neutral-900"
                style={{ fontFamily: "Times New Roman, serif" }}
              >
                Tour
              </span>
              <span className="absolute inset-x-0 -bottom-0.5 h-[1px] bg-neutral-900" />
            </button>
          </div>
        </section>

        {/* CONTENIDO TOUR (idéntico al de antes) */}
        <section className="mt-6">
          <div className="mt-2">
            {loadingConcerts ? (
              <div className="mx-auto w-full max-w-[900px] grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-40 bg-neutral-100 rounded-2xl" />
                ))}
              </div>
            ) : concerts.length === 0 ? (
              <div className="mx-auto w-full max-w-[720px] text-center text-neutral-500 text-sm py-10">
                No tour posts yet.
              </div>
            ) : (
              <div className="mx-auto w-full max-w-[900px] grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
                {concerts.map((concert) => (
                  <PostCard key={concert.id} post={concert} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

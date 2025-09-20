'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/* ===== Tipos ===== */
type ProfileSlim = { username: string | null };
type ProfilesRelation = ProfileSlim | ProfileSlim[] | null;

type ClipRow = {
  id: string;
  user_id: string | null;
  video_url: string | null;
  poster_url: string | null;
  caption: string | null;
  artist_name: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  event_date: string | null; // ISO date
  duration_seconds: number | null;
  created_at: string | null;
  kind?: 'concert' | 'other' | string | null;
  experience?: 'ballet' | 'opera' | 'club' | string | null;
  profiles: ProfilesRelation;
};

const PAGE_SIZE = 12;

/* ===== Utils ===== */
function getUsername(p: ProfilesRelation): string | null {
  if (!p) return null;
  if (Array.isArray(p)) return p[0]?.username ?? null;
  return p.username ?? null;
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function formatEditorialDate(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const day = d.getDate();
    const month = d.toLocaleString(undefined, { month: 'long' });
    const year = d.getFullYear();
    return `${day}${ordinal(day)} ${month}, ${year}`;
  } catch {
    return iso;
  }
}

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ===== Componente principal ===== */
export default function TokPage() {
  const supabase = createClientComponentClient();
  const [clips, setClips] = useState<ClipRow[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Para pausar otros vídeos cuando uno entra en foco
  const videosRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  const fetchPage = useCallback(async (pageIndex: number) => {
    setLoading(true);
    const from = pageIndex * PAGE_SIZE;

    const { data, error } = await supabase
      .from('clips')
      .select(`
        id, user_id, video_url, poster_url, caption, artist_name, venue, city, country,
        event_date, duration_seconds, created_at, kind, experience,
        profiles:profiles(username)
      `)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (!error && data) {
      // se aleatoriza cada tanda para que entre visitas varíe el orden
      const randomized = shuffleInPlace([...data]) as ClipRow[];
      setClips(prev => (pageIndex === 0 ? randomized : [...prev, ...randomized]));
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchPage(0);
  }, [fetchPage]);

  // Infinite scroll
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      if (loading) return;
      const { scrollTop, clientHeight, scrollHeight } = el;
      if (scrollTop + clientHeight >= scrollHeight * 0.82) {
        const next = page + 1;
        setPage(next);
        fetchPage(next);
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [page, loading, fetchPage]);

  // IntersectionObserver para reproducir solo el vídeo visible y pausar el resto
  useEffect(() => {
    const container = scrollerRef.current;
    if (!container) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach(async (e) => {
          const vid = e.target as HTMLVideoElement;
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            // Pausa todos los demás
            videosRef.current.forEach((v) => {
              if (v !== vid) {
                try { v.pause(); v.currentTime = 0; } catch {}
              }
            });
            // Intenta reproducir con sonido; si falla, silencia y reintenta
            try {
              vid.muted = false;
              await vid.play();
            } catch {
              vid.muted = true;
              try { await vid.play(); } catch {}
            }
          } else {
            try { vid.pause(); vid.currentTime = 0; } catch {}
          }
        });
      },
      { root: container, threshold: [0, 0.6, 1] }
    );

    // observar todos los vídeos actuales
    videosRef.current.forEach((v) => io.observe(v));
    return () => io.disconnect();
  }, [clips.length]); // reata al cambiar el número de vídeos

  return (
    <div
      ref={scrollerRef}
      className="min-h-screen w-full overflow-y-auto"
      style={{
        background: '#0B1440', // azul marino más profundo
        fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI'",
        fontWeight: 300,
      }}
    >
      {/* Stack editorial sin encabezado */}
      <div className="mx-auto max-w-[1100px] px-5 py-10 space-y-10">
        {clips.map((clip) => (
          <CardRow
            key={clip.id}
            clip={clip}
            registerVideo={(el) => {
              if (!el) return;
              videosRef.current.set(clip.id, el);
            }}
          />
        ))}

        {loading && (
          <div className="text-white/70 text-center py-10">Loading…</div>
        )}
      </div>
    </div>
  );
}

/* ===== Tarjeta fila (caja de vídeo + rótulo lateral) ===== */
function CardRow({
  clip,
  registerVideo,
}: {
  clip: ClipRow;
  registerVideo: (el: HTMLVideoElement | null) => void;
}) {
  const username = getUsername(clip.profiles);
  const editorialDate = formatEditorialDate(clip.event_date);

  // Título: Artista (si concert y hay nombre) / Tipo (si no)
  const isConcert = (clip.kind ?? 'concert') === 'concert';
  const primaryTitle = (isConcert && clip.artist_name)
    ? clip.artist_name
    : (clip.experience
        ? clip.experience.charAt(0).toUpperCase() + clip.experience.slice(1)
        : 'Event');

  const placeLine = [clip.city, clip.country].filter(Boolean).join(', ');
  const eventNameLine = [clip.venue].filter(Boolean).join(' · ');

  return (
    <Link
      href={`/u/${clip.user_id ?? ''}`}
      className="block"
      style={{ textDecoration: 'none' }}
    >
      <div className="relative grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] gap-6 md:gap-8 items-stretch">
        {/* Caja de vídeo */}
        <div
          className="relative rounded-3xl overflow-hidden bg-[#0A1033] shadow-[0_12px_50px_rgba(0,0,0,0.45)] aspect-[10/13] md:aspect-[16/10]"
        >
          <video
            ref={registerVideo}
            src={clip.video_url ?? undefined}
            poster={clip.poster_url ?? undefined}
            className="absolute inset-0 w-full h-full object-cover"
            loop
            playsInline
            preload="metadata"
            // NO 'autoPlay' aquí: lo gestiona IntersectionObserver en el padre
          />
          {/* Borde interno sutil */}
          <div className="absolute inset-0 rounded-3xl ring-1 ring-white/6 pointer-events-none" />
        </div>

        {/* Rótulo editorial a la derecha */}
        <div className="flex items-center md:items-stretch">
          <div className="w-full md:self-center md:max-w-[520px] rounded-3xl bg-white/3 md:bg-transparent p-5 md:p-0">
            <div className="text-white">
              <div
                className="text-[1.6rem] md:text-[2rem] leading-tight"
                style={{ fontFamily: 'Times New Roman, serif', fontWeight: 700 }}
              >
                {primaryTitle}
              </div>

              {placeLine && (
                <div className="text-base md:text-lg text-white/85 mt-2">
                  {placeLine}
                </div>
              )}

              {eventNameLine && (
                <div className="text-sm md:text-base text-white/80 mt-1">
                  {eventNameLine}
                </div>
              )}

              {editorialDate && (
                <div className="text-sm md:text-base text-white/70 mt-1">
                  {editorialDate}
                </div>
              )}

              {clip.caption && (
                <p className="text-sm md:text-[0.95rem] text-white/80 mt-4 leading-relaxed">
                  {clip.caption}
                </p>
              )}

              {username && (
                <div className="text-sm text-white/60 mt-4">@{username}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

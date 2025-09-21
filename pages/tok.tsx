'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  event_date: string | null; // ISO
  duration_seconds: number | null;
  created_at: string | null;
  kind?: 'concert' | 'other' | string | null;
  experience?: 'ballet' | 'opera' | 'club' | string | null;
  profiles: ProfilesRelation;
};

const PAGE_SIZE = 24;
const NAVY = '#0B1440';

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
    return iso ?? null;
  }
}
function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ===== Página ===== */
export default function Tok() {
  const supabase = createClientComponentClient();
  const [clips, setClips] = useState<ClipRow[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  // para pausar todos menos el visible
  const videos = useRef<Map<string, HTMLVideoElement>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);

  const fetchPage = useCallback(async (pageIndex: number) => {
    setLoading(true);
    const from = pageIndex * PAGE_SIZE;

    const { data, error } = await supabase
      .from('clips')
      .select(`
        id, user_id, video_url, poster_url, caption,
        artist_name, venue, city, country, event_date,
        duration_seconds, created_at, kind, experience,
        profiles:profiles(username)
      `)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (!error && data) {
      setClips(prev =>
        pageIndex === 0 ? shuffle(data as ClipRow[]) : [...prev, ...shuffle(data as ClipRow[])]
      );
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchPage(0); }, [fetchPage]);

  // infinite scroll
  useEffect(() => {
    const el = containerRef.current;
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

  // IntersectionObserver: reproduce solo la tarjeta visible
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const io = new IntersectionObserver(
      entries => {
        entries.forEach(async e => {
          const vid = e.target as HTMLVideoElement;
          const id = vid.dataset.id!;
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            // Pausa los demás
            videos.current.forEach(v => {
              if (v !== vid) {
                try { v.pause(); v.currentTime = 0; } catch {}
              }
            });
            // Intenta con sonido, si falla → mute
            try {
              vid.muted = false;
              // @ts-ignore - algunos navegadores requieren playsInline+autoplay state
              await vid.play();
            } catch {
              vid.muted = true;
              try { await vid.play(); } catch {}
            }
          } else {
            try { vid.pause(); } catch {}
          }
        });
      },
      { root, threshold: [0, 0.6, 1] }
    );

    videos.current.forEach(v => io.observe(v));
    return () => io.disconnect();
  }, [clips.length]);

  return (
    <div
      ref={containerRef}
      className="min-h-screen w-full overflow-y-auto"
      style={{
        background: NAVY,
        // amortigua el corte con las barras blancas superiores/inferiores del dispositivo
        paddingTop: 'max(env(safe-area-inset-top), 10px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 18px)',
        WebkitOverflowScrolling: 'touch',
        fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI'",
        fontWeight: 300,
      }}
    >
      {/* Overlays para que el corte no sea brusco en iOS (top/bottom) */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-0 right-0 top-0 h-6"
        style={{
          background: `linear-gradient(180deg, ${NAVY} 0%, rgba(11,20,64,0) 100%)`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed left-0 right-0 bottom-0 h-8"
        style={{
          background: `linear-gradient(0deg, ${NAVY} 0%, rgba(11,20,64,0) 100%)`,
        }}
      />

      {/* Grid de cajitas cuadradas */}
      <div className="mx-auto max-w-[1200px] px-5 sm:px-6 md:px-8">
        <h1
          className="sr-only"
          style={{ fontFamily: 'Times New Roman, serif', fontWeight: 700 }}
        >
          Tok
        </h1>

        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6 py-8">
          {clips.map((c) => (
            <li key={c.id}>
              <ClipCard
                clip={c}
                register={(el) => {
                  if (!el) return;
                  videos.current.set(c.id, el);
                }}
              />
            </li>
          ))}
        </ul>

        {loading && (
          <div className="text-center text-white/70 py-8">Loading…</div>
        )}
      </div>
    </div>
  );
}

/* ===== Tarjeta cuadrada ===== */
function ClipCard({
  clip,
  register,
}: {
  clip: ClipRow;
  register: (el: HTMLVideoElement | null) => void;
}) {
  const username = getUsername(clip.profiles);
  const isConcert = (clip.kind ?? 'concert') === 'concert';
  const title =
    (isConcert && clip.artist_name)
      ? clip.artist_name
      : (clip.experience
          ? clip.experience.charAt(0).toUpperCase() + clip.experience.slice(1)
          : 'Event');

  const place = [clip.city, clip.country].filter(Boolean).join(', ');
  const datePretty = formatEditorialDate(clip.event_date);

  return (
    <Link href={`/u/${clip.user_id ?? ''}`} className="group block no-underline">
      <div className="relative aspect-square rounded-3xl overflow-hidden bg-[#0A1033] shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
        <video
          data-id={clip.id}
          ref={register}
          src={clip.video_url ?? undefined}
          poster={clip.poster_url ?? undefined}
          className="absolute inset-0 w-full h-full object-cover"
          loop
          playsInline
          preload="metadata"
        />
        {/* borde interno sutil */}
        <div className="absolute inset-0 rounded-3xl ring-1 ring-white/10 pointer-events-none" />

        {/* rótulo inferior */}
        <div className="absolute left-0 right-0 bottom-0 p-3 md:p-4">
          <div className="rounded-2xl px-3 py-2 md:px-4 md:py-[10px] backdrop-blur bg-[rgba(7,12,36,0.55)] ring-1 ring-white/10">
            <div
              className="truncate text-white leading-snug text-[1.05rem] md:text-[1.15rem]"
              style={{ fontFamily: 'Times New Roman, serif', fontWeight: 700 }}
              title={title ?? undefined}
            >
              {title}
            </div>

            <div className="mt-0.5 text-[0.78rem] md:text-[0.85rem] text-white/85 truncate">
              {place}
            </div>

            <div className="text-[0.74rem] md:text-[0.8rem] text-white/70 truncate">
              {datePretty}
            </div>
          </div>
        </div>

        {/* caption (solo si existe) */}
        {clip.caption && (
          <div className="absolute top-0 left-0 right-0 p-2 md:p-3">
            <div className="max-h-[38%] overflow-hidden text-ellipsis">
              <p className="text-[0.75rem] md:text-[0.85rem] leading-snug text-white/80">
                {clip.caption}
              </p>
            </div>
          </div>
        )}
      </div>

      {username && (
        <div className="mt-2 text-white/60 text-sm">@{username}</div>
      )}
    </Link>
  );
}

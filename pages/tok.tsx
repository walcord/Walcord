'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/* ===== Tipos ===== */
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
  kind?: 'concert' | 'experience' | string | null;
  experience?: 'ballet' | 'opera' | 'club' | string | null;
};
type Profile = { id: string; username: string | null };

const PAGE_SIZE = 10;

/* ===== Utils ===== */
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

/* ===== Página: feed vertical a pantalla casi completa ===== */
export default function TokPage() {
  const supabase = createClientComponentClient();
  const [items, setItems] = useState<ClipRow[]>([]);
  const [usernames, setUsernames] = useState<Record<string, string | null>>({});
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const videosRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  const fetchPage = useCallback(async (pageIndex: number) => {
    setLoading(true);
    setErr(null);
    const from = pageIndex * PAGE_SIZE;

    // 1) Trae clips (sin join)
    const { data, error } = await supabase
      .from('clips')
      .select(`
        id, user_id, video_url, poster_url, caption,
        artist_name, venue, city, country, event_date,
        duration_seconds, created_at, kind, experience
      `)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('clips select error:', error);
      setErr(error.message);
      setLoading(false);
      return;
    }

    const batch = (data as ClipRow[]) ?? [];
    setItems(prev => (pageIndex === 0 ? batch : [...prev, ...batch]));

    // 2) Trae usernames aparte (solo los que falten)
    const ids = Array.from(new Set(batch.map(b => b.user_id).filter(Boolean) as string[]))
      .filter(id => !(id in usernames));
    if (ids.length) {
      const { data: profs, error: perr } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', ids)
        .limit(1000);
      if (perr) {
        console.error('profiles select error:', perr);
        setErr(perr.message);
      } else if (profs?.length) {
        const map: Record<string, string | null> = {};
        (profs as Profile[]).forEach(p => { map[p.id] = p.username ?? null; });
        setUsernames(prev => ({ ...prev, ...map }));
      }
    }

    setLoading(false);
  }, [supabase, usernames]);

  useEffect(() => { fetchPage(0); }, [fetchPage]);

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

  // Auto play/pause del vídeo visible
  useEffect(() => {
    const container = scrollerRef.current;
    if (!container) return;
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(async (e) => {
          const vid = e.target as HTMLVideoElement;
          if (e.isIntersecting && e.intersectionRatio >= 0.7) {
            videosRef.current.forEach(v => { if (v !== vid) { try { v.pause(); v.currentTime = 0; } catch {} } });
            try { vid.muted = false; await vid.play(); }
            catch { vid.muted = true; try { await vid.play(); } catch {} }
          } else {
            try { vid.pause(); } catch {}
          }
        });
      },
      { root: container, threshold: [0, 0.7, 1] }
    );
    videosRef.current.forEach(v => io.observe(v));
    return () => io.disconnect();
  }, [items.length]);

  return (
    <div
      ref={scrollerRef}
      className="min-h-screen w-full overflow-y-auto"
      style={{
        background: '#FFFFFF',
        scrollSnapType: 'y mandatory',
        WebkitOverflowScrolling: 'touch',
        fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI'",
        fontWeight: 300,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Estados vacíos/errores visibles (para no ver pantalla en blanco) */}
      {err && (
        <div className="h-[20vh] flex items-center justify-center text-red-600 px-4">
          {err}
        </div>
      )}
      {!err && !loading && items.length === 0 && (
        <div className="h-[20vh] flex items-center justify-center text-black/50 px-4">
          No clips yet.
        </div>
      )}

      {items.map((clip) => (
        <Section
          key={clip.id}
          clip={clip}
          username={clip.user_id ? usernames[clip.user_id] ?? null : null}
          registerVideo={(el) => { if (el) videosRef.current.set(clip.id, el); }}
        />
      ))}

      {loading && (
        <div className="h-[20vh] flex items-center justify-center text-black/50">Loading…</div>
      )}
    </div>
  );
}

/* ===== Sección: vídeo GRANDE + tarjeta editorial ===== */
function Section({
  clip,
  username,
  registerVideo,
}: {
  clip: ClipRow;
  username: string | null;
  registerVideo: (el: HTMLVideoElement | null) => void;
}) {
  const isConcert = (clip.kind ?? 'concert') === 'concert';
  const title = isConcert && clip.artist_name
    ? clip.artist_name
    : (clip.experience ? clip.experience.charAt(0).toUpperCase() + clip.experience.slice(1) : 'Event');
  const place = [clip.city, clip.country].filter(Boolean).join(', ');
  const prettyDate = formatEditorialDate(clip.event_date);

  return (
    <section
      className="relative h-screen w-screen flex items-center justify-center"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div className="relative w-full max-w-[1100px] px-3 sm:px-5">
        {/* Vídeo casi a pantalla completa; al tocar → perfil */}
        <Link href={`/u/${clip.user_id ?? ''}`} className="block no-underline">
          <div className="w-full h-[78vh] md:h-[82vh] rounded-[32px] overflow-hidden bg-black/95 shadow-[0_22px_90px_rgba(0,0,0,0.22)]">
            <video
              ref={registerVideo}
              src={clip.video_url ?? undefined}
              poster={clip.poster_url ?? undefined}
              className="w-full h-full object-cover"
              loop
              playsInline
              preload="metadata"
            />
          </div>
        </Link>

        {/* Tarjeta editorial fuera del marco */}
        <Link href={`/u/${clip.user_id ?? ''}`} className="block no-underline">
          <div className="mt-4 md:mt-6 rounded-3xl border border-black/10 bg-white/95 backdrop-blur px-6 py-5 md:px-7 md:py-6 shadow-[0_10px_36px_rgba(0,0,0,0.08)]">
            <div
              className="text-[1.9rem] md:text-[2.2rem] leading-tight text-black"
              style={{ fontFamily: 'Times New Roman, serif', fontWeight: 700 }}
            >
              {title}
            </div>
            <div className="text-[1rem] md:text-[1.1rem] text-black/75 mt-1">{place}</div>
            {prettyDate && <div className="text-[0.98rem] text-black/65 mt-0.5">{prettyDate}</div>}
            {clip.venue && <div className="text-[0.98rem] text-black/65 mt-0.5">{clip.venue}</div>}
            {username && <div className="text-[0.95rem] text-black/55 mt-3">@{username}</div>}
            {clip.caption && <p className="text-[1rem] text-black/80 mt-3 leading-relaxed">{clip.caption}</p>}
          </div>
        </Link>

        {/* Botón de sonido (necesario por autoplay policies en iOS/simulator) */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const v = document.querySelector<HTMLVideoElement>('video');
            if (!v) return;
            v.muted = !v.muted;
            if (v.paused) v.play().catch(() => {});
          }}
          className="absolute right-6 bottom-[22vh] md:bottom-[24vh] w-11 h-11 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur"
          aria-label="Toggle sound"
          title="Sound"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 9v6h4l5 5V4L9 9H5z" />
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.06c1.48-.74 2.5-2.26 2.5-4.03z" />
          </svg>
        </button>
      </div>
    </section>
  );
}

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
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
  event_date: string | null;
  created_at: string | null;
  kind?: 'concert' | 'experience' | string | null;
  experience?: 'ballet' | 'opera' | 'club' | string | null;
  profiles: ProfilesRelation;
};

const PAGE_SIZE = 10;

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

/* ===== Página ===== */
export default function TokVideoPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const { id } = router.query as { id?: string };

  const [items, setItems] = useState<ClipRow[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const fetchPage = useCallback(async (pageIndex: number) => {
    setLoading(true);
    const from = pageIndex * PAGE_SIZE;

    const { data, error } = await supabase
      .from('clips')
      .select(`
        id, user_id, video_url, poster_url, caption,
        artist_name, venue, city, country, event_date, created_at,
        kind, experience,
        profiles:profiles(username)
      `)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (!error && data) {
      const rows = shuffleInPlace([...data]) as ClipRow[];

      if (pageIndex === 0 && id) {
        const idx = rows.findIndex(d => d.id === id);
        if (idx > 0) {
          const selected = rows[idx];
          rows.splice(idx, 1);
          rows.unshift(selected);
        }
      }
      setItems(prev => (pageIndex === 0 ? rows : [...prev, ...rows]));
    }
    setLoading(false);
  }, [supabase, id]);

  useEffect(() => { fetchPage(0); }, [fetchPage]);

  // infinite scroll + scroll-snap vertical
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

  return (
    <div
      ref={containerRef}
      className="h-screen w-screen overflow-y-scroll"
      style={{
        background: '#FFFFFF', // fondo blanco
        scrollSnapType: 'y mandatory',
        WebkitOverflowScrolling: 'touch',
        fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI'",
        fontWeight: 300,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {items.map((it) => (
        <VideoCard key={it.id} item={it} />
      ))}
      {loading && (
        <div className="h-[25vh] flex items-center justify-center text-black/50">
          Loading…
        </div>
      )}
    </div>
  );
}

/* ===== Card a pantalla casi completa ===== */
function VideoCard({ item }: { item: ClipRow }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [muted, setMuted] = useState(false); // probamos con sonido y caemos a mute si falla
  const [showHint, setShowHint] = useState(true);

  // Visibilidad para play/pause
  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        setIsVisible(e.isIntersecting && e.intersectionRatio >= 0.7);
      },
      { threshold: [0, 0.7, 1] }
    );
    obs.observe(node);
    return () => obs.unobserve(node);
  }, []);

  // Autoplay con audio si el navegador lo permite
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const tryPlay = async () => {
      try {
        v.muted = false;
        await v.play();
        setMuted(false);
      } catch {
        v.muted = true;
        setMuted(true);
        try { await v.play(); } catch {}
      }
    };

    if (isVisible) {
      tryPlay();
    } else {
      try { v.pause(); v.currentTime = 0; } catch {}
    }
  }, [isVisible]);

  const username = getUsername(item.profiles);
  const editorialDate = formatEditorialDate(item.event_date);
  const isConcert = (item.kind ?? 'concert') === 'concert';
  const primaryTitle = (isConcert && item.artist_name)
    ? item.artist_name
    : (item.experience
        ? item.experience.charAt(0).toUpperCase() + item.experience.slice(1)
        : 'Event');

  return (
    <section
      className="relative h-screen w-screen flex items-center justify-center"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div className="relative w-full max-w-[1100px] px-3 sm:px-5">
        {/* Caja del vídeo: CASI TODO EL TELÉFONO */}
        <Link
          href={`/u/${item.user_id ?? ''}`}
          className="block"
          style={{ textDecoration: 'none' }}
        >
          <div className="w-full h-[78vh] md:h-[82vh] rounded-[32px] overflow-hidden bg-black/95 shadow-[0_22px_90px_rgba(0,0,0,0.22)]">
            <video
              ref={videoRef}
              src={item.video_url ?? undefined}
              poster={item.poster_url ?? undefined}
              className="w-full h-full object-cover"
              loop
              playsInline
              preload="metadata"
              // Nota: iOS puede bloquear autoplay con sonido; arriba lo gestionamos.
            />
          </div>
        </Link>

        {/* Tarjeta editorial grande, fuera del marco y más protagonista */}
        <Link
          href={`/u/${item.user_id ?? ''}`}
          className="block no-underline"
        >
          <div className="mt-4 md:mt-6 rounded-3xl border border-black/10 bg-white/95 backdrop-blur px-6 py-5 md:px-7 md:py-6 shadow-[0_10px_36px_rgba(0,0,0,0.08)]">
            <div
              className="text-[1.9rem] md:text-[2.2rem] leading-tight text-black"
              style={{ fontFamily: 'Times New Roman, serif', fontWeight: 700 }}
            >
              {primaryTitle}
            </div>

            <div className="text-[1rem] md:text-[1.1rem] text-black/75 mt-1">
              {[item.city, item.country].filter(Boolean).join(', ')}
            </div>

            {editorialDate && (
              <div className="text-[0.98rem] text-black/65 mt-0.5">
                {editorialDate}
              </div>
            )}

            {item.venue && (
              <div className="text-[0.98rem] text-black/65 mt-0.5">
                {item.venue}
              </div>
            )}

            {username && (
              <div className="text-[0.95rem] text-black/55 mt-3">@{username}</div>
            )}

            {item.caption && (
              <p className="text-[1rem] text-black/80 mt-3 leading-relaxed">
                {item.caption}
              </p>
            )}
          </div>
        </Link>

        {/* Botón sonido (el vídeo navega al perfil, así que el sonido va con este botón) */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const v = videoRef.current;
            if (!v) return;
            v.muted = !v.muted;
            setMuted(v.muted);
            setShowHint(false);
            if (v.paused) { v.play().catch(()=>{}); }
          }}
          className="absolute right-6 bottom-[22vh] md:bottom-[24vh] w-11 h-11 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur"
          aria-label={muted ? 'Unmute' : 'Mute'}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 9v6h4l5 5V4L9 9H5z" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 9v6h4l5 5V4L9 9H5z" />
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.06c1.48-.74 2.5-2.26 2.5-4.03z" />
              <path d="M19 12c0 3.04-1.72 5.64-4.24 6.93l.76 1.85C18.09 19.72 20 16.09 20 12s-1.91-7.72-4.48-8.78l-.76 1.85C17.28 6.36 19 8.96 19 12z"/>
            </svg>
          )}
        </button>

        {/* Hint “Tap for sound” (se oculta al pulsar el botón) */}
        {showHint && muted && (
          <div className="absolute left-6 bottom-[22vh] md:bottom-[24vh] rounded-full bg-black/55 text-white/95 text-xs px-3 py-2">
            Tap for sound
          </div>
        )}
      </div>
    </section>
  );
}
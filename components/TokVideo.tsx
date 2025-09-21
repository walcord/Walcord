'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
  kind?: 'concert' | 'other' | string | null;
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
        id, user_id, video_url, poster_url, caption, artist_name, venue, city, country, event_date, created_at,
        kind, experience,
        profiles:profiles(username)
      `)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (!error && data) {
      const rows = shuffleInPlace([...data]) as ClipRow[];

      // si llega id inicial, ponlo primero la primera vez
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

  useEffect(() => {
    fetchPage(0);
  }, [fetchPage]);

  // infinite scroll con scroll-snap vertical
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
        background: '#0B1440',
        scrollSnapType: 'y mandatory',
        WebkitOverflowScrolling: 'touch',
        fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI'",
        fontWeight: 300,
      }}
    >
      {items.map((it) => (
        <VideoCard key={it.id} item={it} />
      ))}
      {loading && (
        <div className="h-[25vh] flex items-center justify-center text-white/70">
          Loading…
        </div>
      )}
    </div>
  );
}

/* ===== Card fullscreen con reproducción controlada ===== */
function VideoCard({ item }: { item: ClipRow }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [muted, setMuted] = useState(false); // intentamos con sonido

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        setIsVisible(e.isIntersecting && e.intersectionRatio >= 0.65);
      },
      { threshold: [0, 0.65, 1] }
    );
    obs.observe(node);
    return () => obs.unobserve(node);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const tryPlay = async () => {
      try {
        v.muted = false;
        await v.play();
      } catch {
        // Autoplay con audio bloqueado → mute y reintenta
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
      {/* Lienzo */}
      <div className="relative w-[100vw] h-[100vh] flex items-center justify-center">
        {/* Caja de vídeo centrada y grande */}
        <div className="absolute left-1/2 -translate-x-[52%] md:-translate-x-[55%] w-[88vw] md:w-[70vw] h-[78vh] md:h-[82vh] rounded-3xl overflow-hidden bg-[#0A1033] shadow-[0_14px_60px_rgba(0,0,0,0.5)]">
          <video
            ref={videoRef}
            src={item.video_url ?? undefined}
            poster={item.poster_url ?? undefined}
            className="w-full h-full object-cover"
            loop
            playsInline
            preload="metadata"
          />
          <div className="absolute inset-0 rounded-3xl ring-1 ring-white/6 pointer-events-none" />
        </div>

        {/* Rótulo editorial a la derecha */}
        <a
          href={`/u/${item.user_id ?? ''}`}
          className="absolute right-[4vw] md:right-[6vw] top-1/2 -translate-y-1/2 w-[70vw] md:w-[26vw] text-white no-underline"
        >
          <div
            className="text-[1.8rem] md:text-[2.2rem] leading-tight"
            style={{ fontFamily: 'Times New Roman, serif', fontWeight: 700 }}
          >
            {primaryTitle}
          </div>

          <div className="text-base md:text-lg text-white/85 mt-2">
            {[item.city, item.country].filter(Boolean).join(', ')}
          </div>

          {item.venue && (
            <div className="text-sm md:text-base text-white/80 mt-1">{item.venue}</div>
          )}

          {editorialDate && (
            <div className="text-sm md:text-base text-white/70 mt-1">{editorialDate}</div>
          )}

          {item.caption && (
            <p className="text-sm md:text-[0.95rem] text-white/80 mt-4 leading-relaxed">
              {item.caption}
            </p>
          )}

          {username && (
            <div className="text-sm text-white/60 mt-4">@{username}</div>
          )}
        </a>

        {/* Botón mute/unmute (discreto) */}
        <button
          onClick={() => {
            const v = videoRef.current;
            if (!v) return;
            v.muted = !v.muted;
            setMuted(v.muted);
            if (v.paused) {
              v.play().catch(()=>{});
            }
          }}
          className="absolute left-[4vw] bottom-[6vh] w-11 h-11 rounded-full bg-white/12 backdrop-blur flex items-center justify-center"
          aria-label={muted ? 'Unmute' : 'Mute'}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M5 9v6h4l5 5V4L9 9H5z" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M5 9v6h4l5 5V4L9 9H5z" />
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.06c1.48-.74 2.5-2.26 2.5-4.03z" />
              <path d="M19 12c0 3.04-1.72 5.64-4.24 6.93l.76 1.85C18.09 19.72 20 16.09 20 12s-1.91-7.72-4.48-8.78l-.76 1.85C17.28 6.36 19 8.96 19 12z"/>
            </svg>
          )}
        </button>
      </div>
    </section>
  );
}

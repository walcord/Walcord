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
function ordinal(n: number) { const s = ['th','st','nd','rd']; const v = n%100; /* @ts-ignore */ return s[(v-20)%10]||s[v]||s[0]; }
function formatEditorialDate(iso?: string | null) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const day = d.getDate();
    const month = d.toLocaleString(undefined, { month: 'long' });
    const year = d.getFullYear();
    return `${day}${ordinal(day)} ${month}, ${year}`;
  } catch { return iso ?? null; }
}
function shuffleInPlace<T>(arr: T[]) { for (let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }

/* ===== Página ===== */
export default function TokVideoPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const { id } = router.query as { id?: string };

  const [items, setItems] = useState<ClipRow[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videosRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  const fetchPage = useCallback(async (pageIndex: number) => {
    setLoading(true);
    const from = pageIndex * PAGE_SIZE;

    const { data } = await supabase
      .from('clips')
      .select(`
        id, user_id, video_url, poster_url, caption,
        artist_name, venue, city, country, event_date, created_at,
        kind, experience,
        profiles:profiles(username)
      `)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (data) {
      const rows = shuffleInPlace([...data]) as ClipRow[];

      if (pageIndex === 0 && id) {
        const idx = rows.findIndex(d => d.id === id);
        if (idx > 0) { const selected = rows[idx]; rows.splice(idx, 1); rows.unshift(selected); }
      }
      setItems(prev => (pageIndex === 0 ? rows : [...prev, ...rows]));
    }
    setLoading(false);
  }, [supabase, id]);

  useEffect(() => { fetchPage(0); }, [fetchPage]);

  // Registrar vídeos
  const registerVideo = (id: string, el: HTMLVideoElement | null) => {
    if (el) videosRef.current.set(id, el);
    else videosRef.current.delete(id);
  };

  // Pausar los que salen del viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        const vid = e.target as HTMLVideoElement;
        if (!e.isIntersecting || e.intersectionRatio < 0.7) {
          try { vid.pause(); vid.muted = true; vid.currentTime = 0; } catch {}
        }
      });
    }, { root: container, threshold: [0,0.7,1] });
    videosRef.current.forEach(v => io.observe(v));
    return () => io.disconnect();
  }, [items.length]);

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

  // Pausar todos menos uno (cuando se pulsa Play)
  const pauseOthers = (id: string) => {
    videosRef.current.forEach((v, k) => {
      if (k !== id) {
        try { v.pause(); v.muted = true; v.currentTime = 0; } catch {}
      }
    });
  };

  return (
    <div
      id="tok-scroller"
      ref={containerRef}
      className="h-screen w-screen overflow-y-scroll"
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
      {items.map((it, idx) => (
        <VideoCard
          key={it.id}
          item={it}
          register={(el)=>registerVideo(it.id, el)}
          pauseOthers={() => pauseOthers(it.id)}
          forceFirstLoad={idx===0}
        />
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
function VideoCard({
  item, register, pauseOthers, forceFirstLoad
}: {
  item: ClipRow;
  register: (el: HTMLVideoElement | null) => void;
  pauseOthers: () => void;
  forceFirstLoad?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Carga diferida (root = contenedor)
  useEffect(() => {
    const node = sentinelRef.current;
    const rootEl = document.getElementById('tok-scroller');
    if (!node) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { setShouldLoad(true); io.disconnect(); }
    }, { root: rootEl, rootMargin: '300px 0px', threshold: 0.01 });
    io.observe(node);

    let t:any;
    if (forceFirstLoad) t = setTimeout(()=>setShouldLoad(true), 200);

    return () => { io.disconnect(); if (t) clearTimeout(t); };
  }, [forceFirstLoad]);

  // Eventos del vídeo
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onLoadedData = () => setLoaded(true);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('loadeddata', onLoadedData);
    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('loadeddata', onLoadedData);
    };
  }, [shouldLoad]);

  const username = getUsername(item.profiles);
  const poster = item.poster_url || undefined;
  const isConcert = (item.kind ?? 'concert') === 'concert';
  const primaryTitle = (isConcert && item.artist_name)
    ? item.artist_name
    : (item.experience ? item.experience.charAt(0).toUpperCase() + item.experience.slice(1) : 'Event');
  const profileHref = username ? `/u/${username}` : `/u/${item.user_id ?? ''}`;

  return (
    <section
      className="relative h-screen w-screen flex items-center justify-center"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div ref={sentinelRef} className="absolute top-0 left-0 w-px h-px opacity-0" />

      <div className="relative w-full max-w-[1100px] px-3 sm:px-5">
        <div
          className="w-full h-[78vh] md:h-[82vh] rounded-[32px] overflow-hidden shadow-[0_22px_90px_rgba(0,0,0,0.22)] relative"
          style={{
            backgroundImage: poster ? `url(${poster})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: poster ? undefined : '#111',
          }}
        >
          <video
            ref={(el)=>{ register(el); videoRef.current=el; }}
            className="w-full h-full object-cover transition-opacity duration-200"
            style={{ opacity: loaded ? 1 : 0.01 }}
            loop
            playsInline
            // @ts-ignore
            webkit-playsinline="true"
            preload="metadata"
            muted
            poster={poster}
            src={shouldLoad ? (item.video_url ?? undefined) : undefined}
          />

          {/* Botón central Play/Pause */}
          <button
            onClick={() => {
              const v = videoRef.current;
              if (!v) return;
              if (!shouldLoad && item.video_url) { v.src = item.video_url; } // fuente inmediata
              try {
                if (v.paused) {
                  pauseOthers();
                  v.muted = false;
                  v.play().catch(()=>{});
                } else {
                  v.pause();
                }
              } catch {}
            }}
            className="absolute inset-0 w-full h-full flex items-center justify-center z-[70]"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            <span className="w-16 h-16 rounded-full bg-black/55 text-white flex items-center justify-center" style={{ boxShadow:'0 6px 24px rgba(0,0,0,0.28)' }}>
              {isPlaying ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
              ) : (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              )}
            </span>
          </button>
        </div>

        <Link href={profileHref} className="block no-underline">
          <div className="mt-4 md:mt-6 rounded-3xl border border-black/10 bg-white/95 backdrop-blur px-6 py-5 md:px-7 md:py-6 shadow-[0_10px_36px_rgba(0,0,0,0.08)]">
            <div className="text-[1.9rem] md:text-[2.2rem] leading-tight text-black" style={{ fontFamily:'Times New Roman, serif', fontWeight:400 }}>
              {primaryTitle}
            </div>
            <div className="text-[1rem] md:text-[1.1rem] text-black/75 mt-1">
              {[item.city, item.country].filter(Boolean).join(', ')}
            </div>
            {formatEditorialDate(item.event_date) && (
              <div className="text-[0.98rem] text-black/65 mt-0.5">{formatEditorialDate(item.event_date)}</div>
            )}
            {item.venue && <div className="text-[0.98rem] text-black/65 mt-0.5">{item.venue}</div>}
            {username && <div className="text-[0.95rem] text-black/55 mt-3">@{username}</div>}
            {item.caption && <p className="text-[1rem] text-black/80 mt-3 leading-relaxed">{item.caption}</p>}
          </div>
        </Link>
      </div>
    </section>
  );
}

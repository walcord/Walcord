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
  // @ts-ignore
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

/* ===== Página: feed vertical ===== */
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
      setErr(error.message);
      setLoading(false);
      return;
    }

    const batch = (data as ClipRow[]) ?? [];
    setItems(prev => (pageIndex === 0 ? batch : [...prev, ...batch]));

    // usernames aparte
    const ids = Array.from(new Set(batch.map(b => b.user_id).filter(Boolean) as string[]))
      .filter(id => !(id in usernames));
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', ids)
        .limit(1000);
      const map: Record<string, string | null> = {};
      (profs as Profile[] | null)?.forEach(p => { map[p.id] = p.username ?? null; });
      setUsernames(prev => ({ ...prev, ...map }));
    }

    setLoading(false);
  }, [supabase, usernames]);

  useEffect(() => { fetchPage(0); }, [fetchPage]);

  // Registrar / desregistrar vídeos
  const registerVideo = useCallback((id: string, el: HTMLVideoElement | null) => {
    if (el) videosRef.current.set(id, el);
    else videosRef.current.delete(id);
  }, []);

  // Pausar TODOS menos el indicado (cuando tocas Play en uno)
  const pauseOthers = useCallback((id: string) => {
    videosRef.current.forEach((v, k) => {
      if (k !== id) {
        try { v.pause(); v.muted = true; v.currentTime = 0; } catch {}
      }
    });
  }, []);

  // Al salir del viewport, pausar siempre (sin mezclar audio)
  useEffect(() => {
    const container = scrollerRef.current;
    if (!container) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        const vid = e.target as HTMLVideoElement;
        if (!e.isIntersecting || e.intersectionRatio < 0.7) {
          try { vid.pause(); vid.muted = true; vid.currentTime = 0; } catch {}
        }
      });
    }, { root: container, threshold: [0, 0.7, 1] });

    videosRef.current.forEach(v => io.observe(v));
    return () => io.disconnect();
  }, [items.length]);

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

  return (
    <div
      id="tok-scroller"
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

      {items.map((clip, idx) => (
        <Section
          key={clip.id}
          clip={clip}
          username={clip.user_id ? usernames[clip.user_id] ?? null : null}
          register={(el) => registerVideo(clip.id, el)}
          pauseOthers={() => pauseOthers(clip.id)}
          forceFirstLoad={idx === 0}
        />
      ))}

      {loading && (
        <div className="h-[20vh] flex items-center justify-center text-black/50">Loading…</div>
      )}
    </div>
  );
}

/* ===== Sección: vídeo + tarjeta — Play/Pause tipo TikTok ===== */
function Section({
  clip,
  username,
  register,
  pauseOthers,
  forceFirstLoad,
}: {
  clip: ClipRow;
  username: string | null;
  register: (el: HTMLVideoElement | null) => void;
  pauseOthers: () => void;
  forceFirstLoad?: boolean;
}) {
  const localVidRef = useRef<HTMLVideoElement | null>(null);
  const loadSentinelRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const isConcert = (clip.kind ?? 'concert') === 'concert';
  const title = isConcert && clip.artist_name
    ? clip.artist_name
    : (clip.experience ? clip.experience.charAt(0).toUpperCase() + clip.experience.slice(1) : 'Event');
  const place = [clip.city, clip.country].filter(Boolean).join(', ');
  const prettyDate = formatEditorialDate(clip.event_date);
  const profileHref = username ? `/u/${username}` : `/u/${clip.user_id ?? ''}`;

  // Carga diferida: root = contenedor con scroll
  useEffect(() => {
    const node = loadSentinelRef.current;
    if (!node) return;

    const rootEl = document.getElementById('tok-scroller');
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) { setShouldLoad(true); io.disconnect(); }
      },
      { root: rootEl, rootMargin: '300px 0px', threshold: 0.01 }
    );
    io.observe(node);

    // Fallback para el primer clip (por si el IO tarda)
    let t: any;
    if (forceFirstLoad) t = setTimeout(() => setShouldLoad(true), 200);

    return () => { io.disconnect(); if (t) clearTimeout(t); };
  }, [forceFirstLoad]);

  // Eventos del video
  useEffect(() => {
    const v = localVidRef.current;
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

  const poster = clip.poster_url || undefined;

  return (
    <section
      className="relative h-screen w-screen flex items-center justify-center"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div ref={loadSentinelRef} className="absolute top-0 left-0 w-px h-px opacity-0" />

      <div className="relative z-[99] w-full max-w-[1100px] px-3 sm:px-5 pb-[110px]">
        {/* Contenedor con fondo = poster (garantiza imagen siempre visible) */}
        <div
          className="relative w-full h-[78vh] md:h-[82vh] rounded-[32px] overflow-hidden shadow-[0_22px_90px_rgba(0,0,0,0.22)]"
          style={{
            backgroundImage: poster ? `url(${poster})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: poster ? undefined : '#111',
          }}
        >
          <video
            ref={(el) => { register(el); localVidRef.current = el; }}
            className="w-full h-full object-cover transition-opacity duration-200"
            style={{ opacity: loaded ? 1 : 0.01 }}
            loop
            playsInline
            // @ts-ignore
            webkit-playsinline="true"
            preload="metadata"
            muted
            poster={poster}
            src={shouldLoad ? (clip.video_url ?? undefined) : undefined}
          />

          {/* Botón central Play/Pause */}
          <button
            onClick={() => {
              const v = localVidRef.current;
              if (!v) return;
              // Asegurar que la fuente está lista (play inmediato)
              if (!shouldLoad && clip.video_url) {
                // Forzamos src y pedimos play en el mismo gesto
                v.src = clip.video_url;
              }
              try {
                if (v.paused) {
                  pauseOthers();         // Parar cualquier otro antes
                  v.muted = false;       // usuario ha interactuado -> audio permitido
                  v.play().catch(()=>{});
                } else {
                  v.pause();
                }
              } catch {}
            }}
            className="absolute inset-0 w-full h-full flex items-center justify-center z-[70]"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            title={isPlaying ? 'Pause' : 'Play'}
            style={{ background: 'transparent' }}
          >
            <span
              className="w-16 h-16 rounded-full bg-black/55 text-white flex items-center justify-center"
              style={{ boxShadow: '0 6px 24px rgba(0,0,0,0.28)' }}
            >
              {isPlaying ? (
                // Pause icon
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
              ) : (
                // Play icon
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              )}
            </span>
          </button>
        </div>

        {/* Tarjeta (link al perfil) */}
        <Link href={profileHref} className="block no-underline">
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-[-28px] w-[calc(100%-24px)] md:w-[78%] rounded-3xl border border-black/10 bg-white/95 backdrop-blur px-6 py-5 md:px-7 md:py-6 shadow-[0_16px_40px_rgba(0,0,0,0.12)] z-[40]"
          >
            <div className="text-[1.9rem] md:text-[2.2rem] leading-tight text-black" style={{ fontFamily: 'Times New Roman, serif', fontWeight: 400 }}>
              {title}
            </div>
            <div className="text-[1rem] md:text-[1.1rem] text-black/75 mt-1">{place}</div>
            {prettyDate && <div className="text-[0.98rem] text-black/65 mt-0.5">{prettyDate}</div>}
            {clip.venue && <div className="text-[0.98rem] text-black/65 mt-0.5">{clip.venue}</div>}
            {username && <div className="text-[0.95rem] text-black/55 mt-3">@{username}</div>}
            {clip.caption && <p className="text-[1rem] text-black/80 mt-3 leading-relaxed">{clip.caption}</p>}
          </div>
        </Link>
      </div>
    </section>
  );
}

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/* ===== Tipos ===== */
type ProfileSlim = { username: string | null };
type ProfilesRelation = ProfileSlim | ProfileSlim[] | null;
type ClipRow = {
  id: string; user_id: string | null;
  video_url: string | null; poster_url: string | null;
  caption: string | null; artist_name: string | null; venue: string | null;
  city: string | null; country: string | null; event_date: string | null;
  created_at: string | null; kind?: 'concert'|'experience'|string|null; experience?: 'ballet'|'opera'|'club'|string|null;
  profiles: ProfilesRelation;
};
const PAGE_SIZE = 10;

/* ===== Utils ===== */
function getUsername(p: ProfilesRelation): string | null {
  return !p ? null : Array.isArray(p) ? p[0]?.username ?? null : p.username ?? null;
}
function ordinal(n:number){const s=['th','st','nd','rd'];const v=n%100; /* @ts-ignore */ return s[(v-20)%10]||s[v]||s[0];}
function formatEditorialDate(iso?:string|null){
  if(!iso)return null;
  try{const d=new Date(iso);const day=d.getDate();return `${day}${ordinal(day)} ${d.toLocaleString(undefined,{month:'long'})}, ${d.getFullYear()}`;}catch{return iso??null;}
}
function seededShuffle<T>(arr:T[], seed:number){
  const a=[...arr]; let s=seed>>>0;
  for(let i=a.length-1;i>0;i--){ s^=s<<13; s^=s>>>17; s^=s<<5; const j=Math.abs(s)%(i+1); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

/* ===== Página ===== */
export default function TokVideoPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const { id } = router.query as { id?: string };

  const [items, setItems] = useState<ClipRow[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videosRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Aleatorio en cada carga
  const [seed] = useState<number>(() => {
    if (typeof window === 'undefined') return Date.now() & 0xffffffff;
    const r=(crypto.getRandomValues(new Uint32Array(1))[0])>>>0;
    return r;
  });

  const fetchPage = useCallback(async (pageIndex: number) => {
    if (loading) return;
    setLoading(true);

    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE; // ← pedimos PAGE_SIZE+1 para saber si hay más

    const { data } = await supabase
      .from('clips')
      .select(`
        id, user_id, video_url, poster_url, caption,
        artist_name, venue, city, country, event_date, created_at,
        kind, experience,
        profiles:profiles(username)
      `)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (data) {
      const rows = [...(data as ClipRow[])];
      const more = rows.length > PAGE_SIZE;
      setHasMore(more);
      const pageChunk = rows.slice(0, PAGE_SIZE);

      let shuffled = seededShuffle(pageChunk, seed + pageIndex * 97);

      if (pageIndex === 0 && id) {
        const idx = shuffled.findIndex(d => d.id === id);
        if (idx > 0) { const selected = shuffled[idx]; shuffled.splice(idx, 1); shuffled.unshift(selected); }
      }
      setItems(prev => (pageIndex === 0 ? shuffled : [...prev, ...shuffled]));
    }
    setLoading(false);
  }, [supabase, id, seed, loading]);

  useEffect(() => { setPage(0); fetchPage(0); }, [fetchPage]);

  // Registrar
  const registerVideo = (id: string, el: HTMLVideoElement | null) => {
    if (el) videosRef.current.set(id, el); else videosRef.current.delete(id);
  };

  // Autoplay/Pausa por visibilidad
  useEffect(() => {
    const container = containerRef.current; if (!container) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        const vid = e.target as HTMLVideoElement;
        if (e.isIntersecting && e.intersectionRatio >= 0.9) {
          try { vid.muted = true; vid.play().catch(()=>{}); } catch {}
        } else {
          try { vid.pause(); vid.currentTime = 0; } catch {}
        }
      });
    }, { root: container, threshold:[0,0.9,1] });
    videosRef.current.forEach(v => io.observe(v));
    return () => io.disconnect();
  }, [items.length]);

  // Infinite (opcional) + control de hasMore
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const onScroll = () => {
      if (loading || !hasMore) return;
      const { scrollTop, clientHeight, scrollHeight } = el;
      if (scrollTop + clientHeight >= scrollHeight * 0.82) { const next=page+1; setPage(next); fetchPage(next); }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [page, loading, fetchPage, hasMore]);

  // Pestaña oculta → pausar
  useEffect(() => {
    const handler = () => { if (document.hidden) videosRef.current.forEach(v=>{ try{ v.pause(); }catch{} }); };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  const pauseOthers = (id: string) => {
    videosRef.current.forEach((v, k) => { if (k !== id) { try{ v.pause(); v.currentTime = 0; } catch{} } });
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
        overscrollBehaviorY: 'contain',
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
          eagerLevel={idx < 1 ? 1 : (idx < 3 ? (idx + 1) as 2|3 : 0)}
        />
      ))}

      {loading && <div className="h-[12vh] flex items-center justify-center text-black/50">Loading…</div>}

      {!loading && hasMore && (
        <div className="w-full flex items-center justify-center py-6">
          <button
            onClick={() => {
              const next = page + 1;
              setPage(next);
              fetchPage(next);
            }}
            className="px-5 py-2 rounded-full border border-black/15 bg-white hover:bg-black/5 transition text-sm"
            aria-label="Load more videos"
            title="Load more"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}

/* ===== Card ===== */
function VideoCard({
  item, register, pauseOthers, eagerLevel
}: {
  item: ClipRow; register: (el: HTMLVideoElement | null) => void; pauseOthers: () => void;
  eagerLevel: 0 | 1 | 2 | 3;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(eagerLevel > 0);
  const [loaded, setLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (eagerLevel > 0) return;
    const node = sentinelRef.current; const rootEl = document.getElementById('tok-scroller'); if (!node) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { setShouldLoad(true); io.disconnect(); }
    }, { root: rootEl, rootMargin: '800px 0px', threshold: 0.01 });
    io.observe(node);
    return () => io.disconnect();
  }, [eagerLevel]);

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onLoaded = () => setLoaded(true);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('loadeddata', onLoaded);
    return () => { v.removeEventListener('play', onPlay); v.removeEventListener('pause', onPause); v.removeEventListener('loadeddata', onLoaded); };
  }, [shouldLoad]);

  const username = getUsername(item.profiles);
  const poster = item.poster_url || undefined;
  const isConcert = (item.kind ?? 'concert') === 'concert';
  const primaryTitle = isConcert && item.artist_name ? item.artist_name :
    (item.experience ? item.experience.charAt(0).toUpperCase()+item.experience.slice(1) : 'Event');
  const profileHref = username ? `/u/${username}` : `/u/${item.user_id ?? ''}`;
  const preloadAttr = eagerLevel === 1 ? 'auto' : (eagerLevel ? 'metadata' : 'none');

  return (
    <section className="relative h-screen w-screen flex items-center justify-center" style={{ scrollSnapAlign: 'start' }}>
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
            muted
            autoPlay
            disablePictureInPicture
            controls={false}
            poster={poster}
            preload={preloadAttr as any}
            src={shouldLoad ? (item.video_url ?? undefined) : undefined}
          />
          <button
            onClick={() => {
              const v = videoRef.current; if (!v) return;
              if (!shouldLoad && item.video_url) { v.src = item.video_url; setShouldLoad(true); }
              try {
                if (v.paused) { pauseOthers(); v.muted = false; v.play().catch(()=>{}); }
                else { v.pause(); }
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
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              )}
            </span>
          </button>
        </div>

        <Link href={profileHref} className="block no-underline">
          <div className="mt-4 md:mt-6 rounded-3xl border border-black/10 bg-white/95 backdrop-blur px-6 py-5 md:px-7 md:py-6 shadow-[0_10px_36px_rgba(0,0,0,0.08)]">
            <div className="text-[1.9rem] md:text-[2.2rem] leading-tight text-black" style={{ fontFamily:'Times New Roman, serif', fontWeight:400 }}>
              {primaryTitle}
            </div>
            <div className="text-[1rem] md:text-[1.1rem] text-black/75 mt-1">{[item.city, item.country].filter(Boolean).join(', ')}</div>
            {formatEditorialDate(item.event_date) && (<div className="text-[0.98rem] text-black/65 mt-0.5">{formatEditorialDate(item.event_date)}</div>)}
            {item.venue && (<div className="text-[0.98rem] text-black/65 mt-0.5">{item.venue}</div>)}
            {username && (<div className="text-[0.95rem] text-black/55 mt-3">@{username}</div>)}
            {item.caption && (<p className="text-[1rem] text-black/80 mt-3 leading-relaxed">{item.caption}</p>)}
          </div>
        </Link>
      </div>
    </section>
  );
}

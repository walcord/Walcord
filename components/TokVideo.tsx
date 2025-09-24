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
  const d = new Date(iso); const day = d.getDate();
  return `${day}${(['th','st','nd','rd'] as const)[(day%100-20)%10 as any]||(['th','st','nd','rd'] as const)[day as any]||'th'} ${d.toLocaleString(undefined,{month:'long'})}, ${d.getFullYear()}`;
}
function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
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
  const [activeIndex, setActiveIndex] = useState<number>(0);

  // Refs para control único vídeo
  const videosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const activeIdRef = useRef<string | null>(null);

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
      const rows = shuffleInPlace([...(data as ClipRow[])]);
      if (pageIndex === 0 && id) {
        const idx = rows.findIndex(d => d.id === id);
        if (idx > 0) { const selected = rows[idx]; rows.splice(idx, 1); rows.unshift(selected); }
      }
      setItems(prev => (pageIndex === 0 ? rows : [...prev, ...rows]));
    }
    setLoading(false);
  }, [supabase, id]);

  useEffect(() => { fetchPage(0); }, [fetchPage]);

  // Único vídeo activo: pausa al salir del foco
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const io = new IntersectionObserver(async (entries) => {
      for (const e of entries) {
        const vid = e.target as HTMLVideoElement;
        const id = vid.dataset.vid as string;
        if (!id) continue;

        if (e.isIntersecting && e.intersectionRatio >= 0.7) {
          const idxAttr = vid.getAttribute('data-index');
          if (idxAttr) setActiveIndex(parseInt(idxAttr, 10));
          videosRef.current.forEach((v, k) => {
            if (k !== id) { try { v.pause(); v.muted = true; } catch {} }
          });
          activeIdRef.current = id;
        } else {
          if (activeIdRef.current === id) activeIdRef.current = null;
          try { vid.pause(); vid.muted = true; } catch {}
        }
      }
    }, { root: container, threshold: [0,0.7,1] });

    videosRef.current.forEach(v => io.observe(v));
    return () => io.disconnect();
  }, [items.length]);

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

  // Registro de vídeos
  const registerVideo = (id: string, el: HTMLVideoElement | null) => {
    if (el) videosRef.current.set(id, el);
    else videosRef.current.delete(id);
  };

  return (
    <div
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
          index={idx}
          activeIndex={activeIndex}
          item={it}
          register={(el)=>registerVideo(it.id, el)}
          containerRef={containerRef}
        />
      ))}
      {loading && (
        <div className="h-[25vh] flex items-center justify-center text-black/50">Loading…</div>
      )}
    </div>
  );
}

/* ===== Card ===== */
function VideoCard({
  item, register, index, activeIndex, containerRef,
}: {
  item: ClipRow,
  register: (el: HTMLVideoElement|null)=>void,
  index: number,
  activeIndex: number,
  containerRef: React.MutableRefObject<HTMLDivElement | null>,
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false); // se pone src al pulsar
  const [showOverlay, setShowOverlay] = useState<null | 'play' | 'pause'>('play');
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (overlayTimer.current) clearTimeout(overlayTimer.current); }, []);

  const onTap = () => {
    const v = videoRef.current;
    if (!v) return;

    if (!shouldLoad) {
      setShouldLoad(true);
      setTimeout(() => {
        const vv = videoRef.current;
        if (!vv) return;
        vv.muted = false;
        vv.play().catch(() => { vv.muted = true; vv.play().catch(()=>{}); });
      }, 0);
      setShowOverlay('play');
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
      overlayTimer.current = setTimeout(() => setShowOverlay(null), 700);
      return;
    }

    if (v.paused) {
      v.muted = false;
      v.play().catch(() => { v.muted = true; v.play().catch(()=>{}); });
      setShowOverlay('play');
    } else {
      v.pause();
      setShowOverlay('pause');
    }
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(() => setShowOverlay(null), 700);
  };

  const username = getUsername(item.profiles);
  const isConcert = (item.kind ?? 'concert') === 'concert';
  const primaryTitle = (isConcert && item.artist_name) ? item.artist_name
    : (item.experience ? item.experience.charAt(0).toUpperCase()+item.experience.slice(1) : 'Event');
  const profileHref = username ? `/u/${username}` : `/u/${item.user_id ?? ''}`;

  return (
    <section className="relative h-screen w-screen flex items-center justify-center" style={{ scrollSnapAlign: 'start' }}>
      <div className="relative w-full max-w-[1100px] px-3 sm:px-5">
        <div className="w-full h-[78vh] md:h-[82vh] rounded-[32px] overflow-hidden bg-black/95 shadow-[0_22px_90px_rgba(0,0,0,0.22)] relative">
          <video
            ref={(el)=>{ register(el); videoRef.current=el; if (el) el.setAttribute('data-index', String(index)); }}
            data-vid={item.id}
            src={shouldLoad ? (item.video_url ?? undefined) : undefined}
            poster={item.poster_url ?? undefined}
            className="w-full h-full object-cover"
            loop
            playsInline
            preload={shouldLoad ? 'auto' : 'none'}
            muted
            // @ts-ignore
            webkit-playsinline="true"
            onClick={onTap}
          />
          {showOverlay && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[70]">
              <span className="w-16 h-16 rounded-full bg-black/55 text-white flex items-center justify-center" style={{ boxShadow:'0 6px 24px rgba(0,0,0,0.28)' }}>
                {showOverlay === 'play' ? (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                ) : (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
                )}
              </span>
            </div>
          )}
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

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

const PAGE_SIZE = 24;

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
  const [usernames, setUsernames] = useState<Record<string, string | null>>({});
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
        duration_seconds, created_at, kind, experience
      `)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (!error && data) {
      const batch = shuffle(data as ClipRow[]);
      setClips(prev => (pageIndex === 0 ? batch : [...prev, ...batch]));

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
    }
    setLoading(false);
  }, [supabase, usernames]);

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

  // Observer para auto-play del vídeo visible dentro de su tarjeta
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(async e => {
          const vid = e.target as HTMLVideoElement;
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            videos.current.forEach(v => {
              if (v !== vid) { try { v.pause(); v.currentTime = 0; } catch {} }
            });
            try { vid.muted = false; await vid.play(); }
            catch { vid.muted = true; try { await vid.play(); } catch {} }
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
        background: '#FFFFFF', // FONDO BLANCO
        paddingTop: 'max(env(safe-area-inset-top), 10px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 18px)',
        WebkitOverflowScrolling: 'touch',
        fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI'",
        fontWeight: 300,
      }}
    >
      <div className="mx-auto max-w-[1200px] px-5 sm:px-6 md:px-8">
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-6 md:gap-8 py-10">
          {clips.map((c) => (
            <li key={c.id}>
              <ClipCard
                clip={c}
                username={c.user_id ? usernames[c.user_id] ?? null : null}
                register={(el) => { if (el) videos.current.set(c.id, el); }}
              />
            </li>
          ))}
        </ul>

        {loading && <div className="text-center text-black/50 py-10">Loading…</div>}
      </div>
    </div>
  );
}

/* ===== Tarjeta cuadrada grande y limpia ===== */
function ClipCard({
  clip,
  username,
  register,
}: {
  clip: ClipRow;
  username: string | null;
  register: (el: HTMLVideoElement | null) => void;
}) {
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
      {/* Marco del vídeo más grande y centrado dentro de la tarjeta */}
      <div className="relative aspect-[4/5] rounded-[28px] overflow-hidden bg-black/90 shadow-[0_18px_80px_rgba(0,0,0,0.12)]">
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
      </div>

      {/* Tarjeta editorial fuera del marco, debajo */}
      <div className="mt-3 rounded-3xl border border-black/10 bg-white/90 backdrop-blur px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <div
          className="truncate text-black text-[1.25rem] leading-tight"
          style={{ fontFamily: 'Times New Roman, serif', fontWeight: 700 }}
          title={title ?? undefined}
        >
          {title}
        </div>
        <div className="mt-0.5 text-[0.95rem] text-black/75 truncate">{place}</div>
        {datePretty && (
          <div className="text-[0.9rem] text-black/65 truncate">{datePretty}</div>
        )}
        {clip.venue && (
          <div className="text-[0.9rem] text-black/60 truncate">{clip.venue}</div>
        )}
        {username && (
          <div className="text-sm text-black/55 mt-2">@{username}</div>
        )}
        {clip.caption && (
          <p className="text-[0.95rem] text-black/80 mt-2 leading-relaxed">
            {clip.caption}
          </p>
        )}
      </div>
    </Link>
  );
}

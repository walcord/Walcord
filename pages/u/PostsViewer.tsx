'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

/** Flecha sutil (back) */
function ArrowLeftMini() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

/** Tipos */
type Concert = {
  id: string;
  user_id: string | null;
  artist_id: string | null;
  country_code: string | null;
  city: string | null;
  event_date: string | null; // date
  tour_name: string | null;
  caption: string | null;
  created_at: string | null;
};

type MediaItem = {
  id: string;
  url: string;
  type: 'image' | 'video';
};

export default function PostDetail() {
  const router = useRouter();
  const { id } = router.query;
  const supabase = useSupabaseClient();

  const [concert, setConcert] = useState<Concert | null>(null);
  const [artistName, setArtistName] = useState<string>('');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      await fetchConcert(String(id));
      await fetchMedia(String(id));
      setLoading(false);
    })();
  }, [id]);

  async function fetchConcert(concertId: string) {
    // 1) Concert data
    const { data, error } = await supabase
      .from('concerts')
      .select('*')
      .eq('id', concertId)
      .single();

    if (!error && data) {
      setConcert(data as Concert);

      // 2) Artist name (si hay FK)
      if (data.artist_id) {
        const { data: art } = await supabase
          .from('artists')
          .select('name')
          .eq('id', data.artist_id)
          .single();
        setArtistName(art?.name || '');
      } else {
        setArtistName('');
      }
    }
  }

  async function fetchMedia(concertId: string) {
    // Intentamos distintas convenciones de columnas por compatibilidad
    const { data, error } = await supabase
      .from('concert_media')
      .select('id, url, media_url, type, media_type, path')
      .eq('concert_id', concertId)
      .order('id', { ascending: true });

    if (error || !data) {
      setMedia([]);
      return;
    }

    const items: MediaItem[] = (data as any[]).map((row) => {
      const rawUrl: string = row.url || row.media_url || row.path || '';
      let t: 'image' | 'video' = 'image';
      const ext = rawUrl.split('?')[0].split('.').pop()?.toLowerCase() || '';
      if (row.type === 'video' || row.media_type === 'video' || ['mp4', 'mov', 'webm', 'm4v'].includes(ext)) {
        t = 'video';
      }
      return { id: String(row.id), url: rawUrl, type: t };
    });

    setMedia(items);
  }

  const formattedDate = useMemo(() => {
    if (!concert?.event_date) return '';
    try {
      const d = new Date(concert.event_date);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return String(concert.event_date);
    }
  }, [concert?.event_date]);

  return (
    <div className="min-h-screen bg-white">
      {/* ===== Encabezado (azul) ===== */}
      <header className="sticky top-0 z-10 w-full bg-[#1F48AF]">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-4 sm:px-6 sm:py-6">
          <button
            onClick={() => router.back()}
            aria-label="Back"
            className="mr-1 grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/15 transition"
          >
            <ArrowLeftMini />
          </button>

          <div className="min-w-0">
            <h1
              className="truncate text-lg text-white sm:text-xl"
              style={{ fontFamily: '"Times New Roman", Times, serif' }}
            >
              {artistName || 'Concert'}
            </h1>
            <p
              className="truncate text-xs text-white/80 sm:text-sm"
              style={{ fontFamily: 'Roboto, system-ui, sans-serif', fontWeight: 300 }}
            >
              {concert?.tour_name ? `${concert.tour_name} — ` : ''}
              {[concert?.city, concert?.country_code].filter(Boolean).join(', ')}
              {formattedDate ? ` · ${formattedDate}` : ''}
            </p>
          </div>
        </div>
      </header>

      {/* ===== Contenido ===== */}
      <main className="mx-auto w-full max-w-6xl px-4 pb-14 pt-6 sm:px-6 sm:pt-8">
        {/* Caption */}
        {!!concert?.caption && (
          <p
            className="mb-5 text-[17px] leading-7 text-black/90 sm:mb-6 sm:text-[20px]"
            style={{ fontFamily: 'Roboto, system-ui, sans-serif', fontWeight: 300 }}
          >
            {concert.caption}
          </p>
        )}

        {/* Media grid – mobile first (1 col), luego 2 y 3 */}
        {loading ? (
          <div className="text-sm text-black/60">Loading…</div>
        ) : media.length > 0 ? (
          <section>
            <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [column-fill:_balance]">
              {media.map((m) => (
                <div key={m.id} className="group mb-4 break-inside-avoid overflow-hidden rounded-2xl">
                  {m.type === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.url}
                      alt="concert-media"
                      className="w-full object-cover transition duration-500 ease-out group-hover:scale-[1.02] group-hover:opacity-95"
                    />
                  ) : (
                    <div className="relative">
                      <video
                        src={m.url}
                        controls
                        playsInline
                        // iOS inline:
                        // @ts-ignore
                        webkit-playsinline="true"
                        preload="metadata"
                        className="h-auto w-full rounded-2xl"
                        style={{ display: 'block' }}
                        controlsList="nodownload noplaybackrate"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : (
          <p className="text-sm text-black/60">No media yet.</p>
        )}

        {/* Pie de datos (solo lectura) */}
        <section className="mt-8 rounded-2xl border border-black/10 bg-black/[0.02] p-4 sm:p-5">
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-black/50" style={{ fontFamily: 'Roboto, system-ui, sans-serif', fontWeight: 300 }}>
                Artist
              </dt>
              <dd className="text-black/90" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                {artistName || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-black/50" style={{ fontFamily: 'Roboto, system-ui, sans-serif', fontWeight: 300 }}>
                Tour
              </dt>
              <dd className="text-black/90" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                {concert?.tour_name || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-black/50" style={{ fontFamily: 'Roboto, system-ui, sans-serif', fontWeight: 300 }}>
                City / Country
              </dt>
              <dd className="text-black/90" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                {[concert?.city, concert?.country_code].filter(Boolean).join(', ') || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-black/50" style={{ fontFamily: 'Roboto, system-ui, sans-serif', fontWeight: 300 }}>
                Date
              </dt>
              <dd className="text-black/90" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                {formattedDate || '—'}
              </dd>
            </div>
          </dl>
        </section>
      </main>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

/* ========= Tipos locales seguros ========= */
type Concert = {
  id: string;
  user_id: string | null;
  artist_id: string | null;
  country_code: string | null;
  city: string | null;
  event_date: string | null;
  tour_name: string | null;
  caption: string | null;
  created_at: string | null;
  post_type?: 'concert' | 'experience' | null;
  experience?: string | null; // ballet / opera / club / ...
};

type MediaItem = { id: string; url: string; type: 'image' | 'video' };

type CommentRow = {
  id: string;
  concert_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  username: string | null;
  avatar_url: string | null;
};

/* ========= Flecha back ========= */
function BackArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

const cap = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

export default function ConcertViewer() {
  const router = useRouter();
  const { id } = router.query;
  const supabase = useSupabaseClient();
  const user = useUser();

  const [concert, setConcert] = useState<Concert | null>(null);
  const [artistName, setArtistName] = useState<string>('');
  const [countryName, setCountryName] = useState<string>('');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  // social
  const [likesCount, setLikesCount] = useState<number>(0);
  const [iLike, setILike] = useState<boolean>(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentText, setCommentText] = useState('');

  // ===== LIGHTBOX estado =====
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      await Promise.all([loadConcert(String(id)), loadMedia(String(id)), loadSocial(String(id))]);
      setLoading(false);
    })();
  }, [id, user?.id]);

  async function loadConcert(concertId: string) {
    const { data } = await supabase
      .from('concerts')
      .select('id,user_id,artist_id,country_code,city,event_date,tour_name,caption,created_at,post_type,experience')
      .eq('id', concertId)
      .single();

    if (!data) return;
    setConcert(data as Concert);

    if (data.artist_id) {
      const { data: a } = await supabase.from('artists').select('name').eq('id', data.artist_id).single();
      if (a?.name) setArtistName(a.name);
    } else {
      setArtistName('');
    }
    if (data.country_code) {
      const { data: c } = await supabase.from('countries').select('name').eq('code', data.country_code).single();
      if (c?.name) setCountryName(c.name);
    } else {
      setCountryName('');
    }
  }

  async function loadMedia(concertId: string) {
    const { data } = await supabase
      .from('concert_media')
      .select('id, url, media_type, created_at')
      .eq('concert_id', concertId)
      .order('created_at', { ascending: true });

    const rows: any[] = Array.isArray(data) ? data : [];
    const items: MediaItem[] = rows
      .map((row) => {
        const rawUrl: string = (row.url || '').trim();
        if (!rawUrl) return null;
        const flag = String(row.media_type || '').toLowerCase();
        const ext = rawUrl.split('?')[0].split('.').pop()?.toLowerCase() || '';
        const isVideo = flag === 'video' || ['mp4', 'mov', 'webm', 'm4v'].includes(ext);
        return { id: String(row.id), url: rawUrl, type: isVideo ? 'video' : 'image' } as MediaItem;
      })
      .filter(Boolean) as MediaItem[];
    setMedia(items);
  }

  async function loadSocial(concertId: string) {
    const { count } = await supabase
      .from('concert_likes')
      .select('user_id', { count: 'exact', head: true })
      .eq('concert_id', concertId);
    setLikesCount(count || 0);

    const { data: mine } =
      user?.id
        ? await supabase
            .from('concert_likes')
            .select('user_id')
            .eq('concert_id', concertId)
            .eq('user_id', user.id)
            .maybeSingle()
        : { data: null as any };
    setILike(!!mine);

    const { data: comm } = await supabase
      .from('concert_comments')
      .select('id, concert_id, user_id, comment, created_at, profiles(username, avatar_url)')
      .eq('concert_id', concertId)
      .order('created_at', { ascending: true });

    const mapped: CommentRow[] = (comm || []).map((r: any) => ({
      id: r.id,
      concert_id: r.concert_id,
      user_id: r.user_id,
      comment: r.comment,
      created_at: r.created_at,
      username: r.profiles?.username ?? null,
      avatar_url: r.profiles?.avatar_url ?? null,
    }));
    setComments(mapped);
  }

  const dateLabel = useMemo(() => {
    if (!concert?.event_date) return '';
    try {
      const d = new Date(concert.event_date);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return String(concert.event_date);
    }
  }, [concert?.event_date]);

  // 👇 Encabezado principal: categoría si post_type='experience', si no, artista o 'Concert'
  const headerTitle = concert?.post_type === 'experience' && concert.experience
    ? cap(concert.experience)
    : (artistName || 'Concert');

  const userLiked = iLike;

  const handleLike = async () => {
    if (!user?.id || !id) return;
    if (userLiked) {
      await supabase.from('concert_likes').delete().eq('concert_id', id).eq('user_id', user.id);
      setILike(false);
      setLikesCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from('concert_likes').upsert({ concert_id: String(id), user_id: user.id });
      setILike(true);
      setLikesCount((c) => c + 1);
    }
  };

  const handleSendComment = async () => {
    if (!user?.id || !id || !commentText.trim()) return;
    const payload = { concert_id: String(id), user_id: user.id, comment: commentText.trim() };
    await supabase.from('concert_comments').insert(payload);
    setCommentText('');
    await loadSocial(String(id));
    location.hash = 'comments';
  };

  // ===== LIGHTBOX helpers =====
  const imageList = useMemo(() => media.filter((m) => m.type === 'image'), [media]);

  const openLightbox = (idx: number) => {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  };

  const closeLightbox = () => setLightboxOpen(false);

  const prevImage = () => {
    if (!imageList.length) return;
    setLightboxIndex((i) => (i - 1 + imageList.length) % imageList.length);
  };

  const nextImage = () => {
    if (!imageList.length) return;
    setLightboxIndex((i) => (i + 1) % imageList.length);
  };

  // Bloquear scroll de fondo cuando el lightbox está abierto
  useEffect(() => {
    if (lightboxOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [lightboxOpen]);

  // Navegación con teclado (para web)
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'ArrowRight') nextImage();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen]);

  // Gestos táctiles
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };
  const onTouchEnd = () => {
    const dx = touchDeltaX.current;
    touchStartX.current = null;
    touchDeltaX.current = 0;
    const threshold = 50; // px
    if (dx > threshold) prevImage();
    else if (dx < -threshold) nextImage();
  };

  return (
    <div className="min-h-screen bg-white">
      {/* ===== BANNER ===== */}
      <header className="w-full h-32 bg-[#1F48AF] pt-[env(safe-area-inset-top)] flex items-end px-4 sm:px-6 pb-2">
        <button onClick={() => history.back()} aria-label="Go back" className="p-2 rounded-full hover:bg-[#1A3A95] transition self-end">
          <BackArrow />
        </button>
        <div className="ml-3 min-w-0 pb-0.5">
          <h1 className="truncate text-white text-[16px] sm:text-[18px]" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
            {headerTitle}
          </h1>
          <p className="truncate text-white/80 text-[12px]" style={{ fontFamily: 'Roboto, system-ui, sans-serif', fontWeight: 300 }}>
            {concert?.tour_name ? `${concert.tour_name} — ` : ''}
            {[concert?.city, countryName || concert?.country_code].filter(Boolean).join(', ')}
            {dateLabel ? ` · ${dateLabel}` : ''}
          </p>
        </div>
      </header>

      {/* ===== CONTENIDO ===== */}
      <main className="mx-auto w-full max-w-[520px] px-5 sm:px-6 pb-16 pt-5 sm:pt-7 overflow-x-hidden">
        {!!concert?.caption && (
          <p
            className="mb-5 mt-4 text-[15px] sm:text-[17px] leading-7 text-black/90 break-words [overflow-wrap:anywhere]"
            style={{ fontFamily: 'Roboto, system-ui, sans-serif', fontWeight: 300 }}
          >
            {concert.caption}
          </p>
        )}

        {/* Media */}
        {loading ? (
          <p className="text-sm text-black/60">Loading…</p>
        ) : media.length > 0 ? (
          <section className="mt-5">
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
              {media.map((m, idx) => {
                if (m.type === 'image') {
                  // índice relativo de imagenes (para abrir en el slide correcto)
                  const imgIndex = imageList.findIndex((im) => im.id === m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => openLightbox(Math.max(0, imgIndex))}
                      className="rounded-2xl overflow-hidden bg-black/5 focus:outline-none focus:ring-2 focus:ring-[#1F48AF]"
                      aria-label="Expand image"
                    >
                      <img
                        src={m.url}
                        alt="concert-media"
                        className="object-contain max-w-[200px] sm:max-w-[260px] max-h-[200px] sm:max-h-[260px] rounded-2xl"
                        loading="lazy"
                      />
                    </button>
                  );
                }
                return (
                  <div key={m.id} className="rounded-2xl overflow-hidden flex justify-center items-center bg-black/5">
                    <video
                      src={m.url}
                      controls
                      playsInline
                      // @ts-ignore iOS inline
                      webkit-playsinline="true"
                      preload="metadata"
                      className="object-contain max-w-[200px] sm:max-w-[260px] max-h-[200px] sm:max-h-[260px] rounded-2xl"
                      controlsList="nodownload noplaybackrate"
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <p className="text-sm text-black/60 mt-5">No media.</p>
        )}

        {/* ===== Social ===== */}
        <section className="mt-6 mx-auto w-full max-w-[520px] px-5 sm:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLike}
              aria-label={userLiked ? 'Unlike' : 'Like'}
              className={`inline-flex items-center gap-2 transition-transform active:scale-95 ${
                userLiked ? 'text-[#1F48AF]' : 'text-neutral-600 hover:text-neutral-800'
              }`}
            >
              <svg width="32" height="32" viewBox="0 0 48 48" aria-hidden="true">
                <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.9" />
                <circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.7" />
                <circle cx="24" cy="24" r="10" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
                <circle cx="24" cy="24" r="6" fill={userLiked ? 'currentColor' : 'transparent'} stroke="currentColor" strokeWidth="1" />
                <circle cx="24" cy="24" r="1.5" fill={userLiked ? 'white' : 'currentColor'} />
              </svg>
              <span className="text-sm">{likesCount}</span>
            </button>
          </div>

          <div id="comments" className="mt-4 space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-3 items-start">
                <div className="h-8 w-8 rounded-full bg-neutral-200 overflow-hidden shrink-0">
                  {c.avatar_url ? <img src={c.avatar_url} alt={c.username || ''} className="w-full h-full object-cover" /> : null}
                </div>
                <div className="min-w-0 break-words [overflow-wrap:anywhere]">
                  <div className="text-sm">
                    <span className="font-medium">{c.username || 'user'}</span> {c.comment}
                  </div>
                  <div className="text-xs text-neutral-500">{new Date(c.created_at).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>

          {user?.id && (
            <div className="mt-3 flex items-center gap-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment…"
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none break-words [overflow-wrap:anywhere]"
              />
              <button onClick={handleSendComment} className="rounded-xl bg-[#1F48AF] text-white px-4 py-2 text-sm">
                Send
              </button>
            </div>
          )}
        </section>
      </main>

      {/* ===== LIGHTBOX ===== */}
      {lightboxOpen && imageList.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
        >
          {/* Contenedor central para mantener todo lejos de los bordes superior/inferior */}
          <div
            className="relative w-full h-full flex items-center justify-center"
            style={{
              paddingTop: 'max(calc(env(safe-area-inset-top) + 32px), 32px)',
              paddingBottom: 'max(calc(env(safe-area-inset-bottom) + 32px), 32px)',
              paddingLeft: '24px',
              paddingRight: '24px',
            }}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Imagen centrada, editorial */}
            <img
              key={imageList[lightboxIndex].id}
              src={imageList[lightboxIndex].url}
              alt={`media-${lightboxIndex + 1}`}
              className="max-w-[92vw] max-h-[76vh] object-contain rounded-2xl shadow-2xl"
              draggable={false}
            />

            {/* Botón Close, centrado arriba (sin tocar bordes del teléfono) */}
            <button
              onClick={closeLightbox}
              aria-label="Close"
              className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white/95 hover:bg-white px-4 py-2 text-[13px] shadow-sm"
              style={{ top: 'calc(env(safe-area-inset-top) + 24px)' }}
            >
              Close
            </button>

            {/* Controles laterales (centrados verticalmente, sin invadir top/bottom) */}
            {imageList.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  aria-label="Previous image"
                  className="absolute rounded-full bg-white/90 hover:bg-white px-3 py-3 text-black shadow-sm active:scale-95"
                  style={{ left: '28px' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>

                <button
                  onClick={nextImage}
                  aria-label="Next image"
                  className="absolute rounded-full bg-white/90 hover:bg-white px-3 py-3 text-black shadow-sm active:scale-95"
                  style={{ right: '28px' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>

                {/* Indicadores centrados (lejos de bordes inferior/superior) */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 flex gap-1.5 rounded-full bg-white/90 px-3 py-1"
                  style={{ bottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
                >
                  {imageList.map((_, i) => (
                    <span
                      key={i}
                      className={`inline-block rounded-full ${i === lightboxIndex ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5'} bg-black`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

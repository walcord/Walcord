'use client';

import { useEffect, useMemo, useState } from 'react';
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

/* ========= Icono Vinilo ========= */
function VinylIcon({ active }: { active: boolean }) {
  return (
    <svg width="32" height="32" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.9" />
      <circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.7" />
      <circle cx="24" cy="24" r="10" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
      <circle cx="24" cy="24" r="6" fill={active ? 'currentColor' : 'transparent'} stroke="currentColor" strokeWidth="1" />
      <circle cx="24" cy="24" r="1.5" fill={active ? 'white' : 'currentColor'} />
    </svg>
  );
}

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

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      await Promise.all([loadConcert(String(id)), loadMedia(String(id)), loadSocial(String(id))]);
      setLoading(false);
    })();
  }, [id, user?.id]);

  async function loadConcert(concertId: string) {
    const { data } = await supabase.from('concerts').select('*').eq('id', concertId).single();
    if (!data) return;
    setConcert(data as Concert);

    if (data.artist_id) {
      const { data: a } = await supabase.from('artists').select('name').eq('id', data.artist_id).single();
      if (a?.name) setArtistName(a.name);
    }
    if (data.country_code) {
      const { data: c } = await supabase.from('countries').select('name').eq('code', data.country_code).single();
      if (c?.name) setCountryName(c.name);
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

  const handleLike = async () => {
    if (!user?.id || !id) return;
    if (iLike) {
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

  return (
    <div className="min-h-screen bg-white">
      {/* ===== BANNER ===== */}
      <header className="w-full h-32 bg-[#1F48AF] pt-[env(safe-area-inset-top)] flex items-end px-4 sm:px-6 pb-2">
        <button onClick={() => history.back()} aria-label="Go back" className="p-2 rounded-full hover:bg-[#1A3A95] transition self-end">
          <BackArrow />
        </button>
        <div className="ml-3 min-w-0 pb-0.5">
          <h1 className="truncate text-white text-[16px] sm:text-[18px]" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
            {artistName || 'Concert'}
          </h1>
          <p className="truncate text-white/80 text-[12px]" style={{ fontFamily: 'Roboto, system-ui, sans-serif', fontWeight: 300 }}>
            {concert?.tour_name ? `${concert.tour_name} — ` : ''}
            {[concert?.city, countryName || concert?.country_code].filter(Boolean).join(', ')}
            {dateLabel ? ` · ${dateLabel}` : ''}
          </p>
        </div>
      </header>

      {/* ===== CONTENIDO (centrado y estrecho para app) ===== */}
      <main className="mx-auto w-full max-w-[520px] px-3 sm:px-4 pb-16 pt-5 sm:pt-7">
        {!!concert?.caption && (
          <p className="mb-5 text-[16px] sm:text-[18px] leading-7 text-black/90" style={{ fontFamily: 'Roboto, system-ui, sans-serif', fontWeight: 300 }}>
            {concert.caption}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-black/60">Loading…</p>
        ) : media.length > 0 ? (
          <section>
            <div className="flex flex-wrap justify-center gap-2.5 sm:gap-3">
              {media.map((m) => (
                <div key={m.id} className="rounded-2xl overflow-hidden flex justify-center items-center bg-black/5">
                  {m.type === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.url}
                      alt="concert-media"
                      className="object-contain max-w-[160px] sm:max-w-[220px] max-h-[160px] sm:max-h-[220px] rounded-2xl"
                      loading="lazy"
                    />
                  ) : (
                    <video
                      src={m.url}
                      controls
                      playsInline
                      // @ts-ignore iOS inline
                      webkit-playsinline="true"
                      preload="metadata"
                      className="object-contain max-w-[160px] sm:max-w-[220px] max-h-[160px] sm:max-h-[220px] rounded-2xl"
                      controlsList="nodownload noplaybackrate"
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : (
          <p className="text-sm text-black/60">No media.</p>
        )}

        {/* ===== Social debajo de las fotos ===== */}
        <section className="mt-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLike}
              aria-label={iLike ? 'Unlike' : 'Like'}
              className={`inline-flex items-center gap-2 transition-transform active:scale-95 ${
                iLike ? 'text-[#1F48AF]' : 'text-neutral-600 hover:text-neutral-800'
              }`}
            >
              <VinylIcon active={iLike} />
              <span className="text-sm">{likesCount}</span>
            </button>
          </div>

          <div id="comments" className="mt-4 space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-3 items-start">
                <div className="h-8 w-8 rounded-full bg-neutral-200 overflow-hidden shrink-0">
                  {c.avatar_url ? <img src={c.avatar_url} alt={c.username || ''} className="w-full h-full object-cover" /> : null}
                </div>
                <div className="min-w-0">
                  <div className="text-sm"><span className="font-medium">{c.username || 'user'}</span> {c.comment}</div>
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
                className="flex-1 rounded-xl border border-neutral-300 px-3 py-2 outline-none"
              />
              <button onClick={handleSendComment} className="rounded-xl bg-[#1F48AF] text-white px-4 py-2 text-sm">Send</button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

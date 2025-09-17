'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

export type ConcertPost = {
  concert_id: string;
  anchor_photo_id: string | null;      // para saber quién subió la foto ancla
  artist_name: string | null;
  tour: string | null;
  city: string | null;
  country: string | null;
  year: number | null;
  event_date: string | null;           // FECHA DEL CONCIERTO (dd/mm/yyyy)
  image_urls: any;                     // array o json
  like_count: number;
  comment_count: number;
};

type Profile = { id: string; full_name: string | null; avatar_url: string | null };

const BLUE = '#1F48AF';
const fmtES = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('es-ES') : '');

function toArray(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  try { const p = JSON.parse(raw); if (Array.isArray(p)) return p.filter(Boolean); } catch {}
  return [String(raw)];
}

/* ===== Icono Like “Vinilo” ===== */
function VinylIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke={BLUE} strokeWidth="1.2" />
      <circle cx="12" cy="12" r="6.6" fill="none" stroke={BLUE} strokeWidth="0.8" opacity="0.9" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke={BLUE} strokeWidth="0.7" opacity="0.85" />
      <circle cx="12" cy="12" r="1.2" fill={filled ? BLUE : 'transparent'} stroke={BLUE} strokeWidth="0.9" />
    </svg>
  );
}

/* ===== Tarjeta (Friends) — igual que “Concerts”, sin attendees ===== */
export default function ConcertCardVinyl({ post }: { post: ConcertPost }) {
  const supabase = useSupabaseClient();
  const user = useUser();

  const images = useMemo(() => toArray(post.image_urls).filter(Boolean).slice(0, 4), [post.image_urls]);
  const [likeCount, setLikeCount] = useState<number>(post.like_count || 0);
  const [commentCount, setCommentCount] = useState<number>(post.comment_count || 0);
  const [iLiked, setILiked] = useState<boolean>(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<{ id: string; user_id: string; comment: string; created_at: string }[]>([]);
  const [text, setText] = useState('');

  const [uploader, setUploader] = useState<{ name: string; avatar: string | null }>({ name: '—', avatar: null });

  const title = post.artist_name || '—';
  const tour = post.tour || '';
  const place = post.city && post.country ? `${post.city}, ${post.country}` : post.city || post.country || '';
  const year = post.year ? ` · ${post.year}` : '';

  /* ===== Estado inicial (like + uploader) ===== */
  useEffect(() => {
    let mounted = true;
    (async () => {
      // ¿Yo he dado like a ESTE CONCIERTO?
      if (user?.id) {
        const { data } = await supabase
          .from('concert_likes')
          .select('concert_id')
          .eq('concert_id', post.concert_id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (mounted) setILiked(Boolean(data));
      }

      // Contadores reales (concert_likes / concert_comments)
      const [{ count: lc }, { count: cc }] = await Promise.all([
        supabase.from('concert_likes').select('*', { count: 'exact', head: true }).eq('concert_id', post.concert_id),
        supabase.from('concert_comments').select('*', { count: 'exact', head: true }).eq('concert_id', post.concert_id),
      ]);
      if (mounted) {
        if (typeof lc === 'number') setLikeCount(lc);
        if (typeof cc === 'number') setCommentCount(cc);
      }

      // Uploader: a partir de la foto ancla → profile con full_name + avatar
      if (post.anchor_photo_id) {
        const { data: ph } = await supabase
          .from('concert_photos')
          .select('user_id')
          .eq('id', post.anchor_photo_id)
          .maybeSingle();
        if (ph?.user_id) {
          const { data: pr } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', ph.user_id)
            .maybeSingle();
          if (mounted) setUploader({ name: pr?.full_name || '—', avatar: pr?.avatar_url || null });
        }
      }
    })();
    return () => { mounted = false; };
  }, [supabase, user?.id, post.concert_id, post.anchor_photo_id]);

  /* ===== Comentarios ===== */
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!commentsOpen) return;
      const { data } = await supabase
        .from('concert_comments')
        .select('id, user_id, comment, created_at')
        .eq('concert_id', post.concert_id)
        .order('created_at', { ascending: true });
      if (mounted) setComments((data || []) as any[]);
    })();
    return () => { mounted = false; };
  }, [commentsOpen, supabase, post.concert_id]);

  const onToggleLike = async () => {
    if (!user?.id) return;
    if (iLiked) {
      await supabase.from('concert_likes').delete().match({ concert_id: post.concert_id, user_id: user.id });
      setILiked(false); setLikeCount(n => Math.max(0, n - 1));
    } else {
      await supabase.from('concert_likes').upsert({ concert_id: post.concert_id, user_id: user.id });
      setILiked(true); setLikeCount(n => n + 1);
    }
  };

  const onSend = async () => {
    if (!user?.id || !text.trim()) return;
    const payload = { concert_id: post.concert_id, user_id: user.id, comment: text.trim() };
    const { data, error } = await supabase.from('concert_comments').insert(payload).select().single();
    if (!error && data) {
      setComments(prev => [...prev, data as any]);
      setText(''); setCommentCount(n => n + 1);
      if (!commentsOpen) setCommentsOpen(true);
    }
  };

  /* ===== Grid 2×2 (idéntico look) ===== */
  const Grid = () => {
    const urls = images;
    if (urls.length === 0) return <div className="aspect-[4/3] rounded-xl bg-neutral-100" />;
    if (urls.length === 1) {
      return (
        <div className="overflow-hidden rounded-xl">
          {/* enteras, no recortes */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urls[0]} alt="" className="w-full h-auto object-contain rounded-xl" />
        </div>
      );
    }
    if (urls.length === 2) {
      return (
        <div className="grid grid-cols-2 gap-2">
          {urls.map((u, i) => (
            <div key={i} className="relative overflow-hidden rounded-xl">
              <img src={u} alt="" className="w-full h-full object-contain" />
            </div>
          ))}
        </div>
      );
    }
    if (urls.length === 3) {
      return (
        <div className="grid grid-cols-3 gap-2">
          {urls.map((u, i) => (
            <div key={i} className="relative overflow-hidden rounded-xl">
              <img src={u} alt="" className="w-full h-full object-contain" />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 gap-2">
        {urls.map((u, i) => (
          <div key={i} className="relative overflow-hidden rounded-xl">
            <img src={u} alt="" className="w-full h-full object-contain" />
          </div>
        ))}
      </div>
    );
  };

  return (
    <article className="w-full rounded-2xl border border-neutral-200 bg-white shadow-[0_6px_22px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <div className="h-8 w-8 rounded-full overflow-hidden bg-neutral-200 shrink-0">
          {uploader.avatar && <img src={uploader.avatar} alt="" className="h-8 w-8 object-cover" />}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] leading-tight font-medium">{uploader.name}</div>
          <div className="text-[11.5px] text-neutral-500 leading-tight">{fmtES(post.event_date)}</div>
        </div>
      </div>
      <div className="px-4">
        <div className="h-px bg-neutral-200/70 mb-3" />
      </div>

      {/* Títulos */}
      <div className="px-4">
        <h3 className="text-[16px] leading-none" style={{ fontFamily: 'Times New Roman, serif' }}>{title}</h3>
        {tour && <div className="text-[12.5px] text-neutral-600">{tour}</div>}
        <div className="text-[12.5px] text-neutral-800">{place}{year}</div>
      </div>

      {/* Fotos */}
      <div className="px-4 py-3">
        <Grid />
      </div>

      {/* Acciones */}
      <div className="px-4 pb-3 flex items-center gap-5 text-[12.5px]">
        <button type="button" onClick={onToggleLike} className="inline-flex items-center gap-1.5" style={{ color: BLUE }} title={iLiked ? 'Unlike' : 'Like'}>
          <VinylIcon filled={iLiked} />
          <span className="font-light">{likeCount}</span>
        </button>

        <button type="button" onClick={() => setCommentsOpen(v => !v)} className="inline-flex items-center gap-1.5 text-neutral-800 hover:text-[#1F48AF]" title="Comments">
          <span className="underline">Comments</span>
          <span>({commentCount})</span>
        </button>
      </div>

      {/* Comentarios inline */}
      {commentsOpen && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write a comment…"
              className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-[13px] outline-none focus:border-neutral-500"
            />
            <button
              onClick={onSend}
              className="rounded-md px-3 py-1.5 text-[12px] text-white disabled:opacity-60"
              style={{ backgroundColor: BLUE }}
              disabled={!text.trim() || !user}
            >
              Send
            </button>
          </div>
          <ul className="mt-2 space-y-2">
            {comments.map(c => (
              <li key={c.id} className="text-[13px] text-neutral-900">
                {c.comment}
                <span className="ml-2 text-[11px] text-neutral-500">{new Date(c.created_at).toLocaleString('es-ES')}</span>
              </li>
            ))}
            {comments.length === 0 && <li className="text-xs text-neutral-500">Be the first to comment.</li>}
          </ul>
        </div>
      )}
    </article>
  );
}

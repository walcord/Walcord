'use client';

import type React from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type Props = { post: any };

const cap = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/** Detectar si una URL apunta a un vídeo para NO usarla nunca en el postcard */
function isVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  const clean = url.split('?')[0] || '';
  return /\.(mp4|mov|webm|m4v|avi|mkv|ogg)$/i.test(clean);
}

/** UTIL: confirm seguro para web/app */
function safeConfirm(message: string): boolean {
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm(message);
  }
  return true;
}

/** UTIL: alert seguro para web/app */
function safeAlert(message: string) {
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(message);
  } else {
    // eslint-disable-next-line no-console
    console.warn('ALERT:', message);
  }
}

export default function PostCard({ post }: Props) {
  const isConcert =
    !!post?.artist_id || !!post?.country_code || !!post?.event_date || !!post?.cover_url;

  // ⬇️ SOLO usamos fotos, nunca vídeos, tanto para concerts como para otros posts
  const initialBg = isConcert
    ? !isVideoUrl(post?.cover_url)
      ? post?.cover_url ?? null
      : null
    : ((post?.image_urls as string[] | undefined) || []).find(url => !isVideoUrl(url)) ?? null;

  const [bgUrl, setBgUrl] = useState<string | null>(initialBg);
  const [vibe, setVibe] = useState<string | null>(post?.record?.vibe_color ?? null);
  const [cover, setCover] = useState<string | null>(post?.record?.cover_color ?? null);
  const [artistName, setArtistName] = useState<string | null>(post?.artist_name ?? null);
  const [countryName, setCountryName] = useState<string | null>(post?.country_name ?? null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // Menu portal positioning (para que NO se recorte en móvil)
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  function computeMenuPosition() {
    if (!menuBtnRef.current) return;
    const r = menuBtnRef.current.getBoundingClientRect();

    const menuWidth = 200;
    const margin = 8;

    let left = r.right - menuWidth;
    let top = r.bottom + 8;

    const maxLeft = window.innerWidth - menuWidth - margin;
    if (left > maxLeft) left = maxLeft;
    if (left < margin) left = margin;

    const maxTop = window.innerHeight - margin;
    if (top > maxTop) top = maxTop;

    setMenuPos({ top, left });
  }

  function openMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window !== 'undefined') computeMenuPosition();
    setMenuOpen(true);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  // Cerrar menú: click fuera / resize / scroll
  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (ev: MouseEvent | TouchEvent) => {
      const target = ev.target as Node | null;
      if (!target) return;

      const clickedMenu = !!menuRef.current?.contains(target);
      const clickedBtn = !!menuBtnRef.current?.contains(target);

      if (!clickedMenu && !clickedBtn) closeMenu();
    };

    const onResize = () => computeMenuPosition();
    const onScroll = () => computeMenuPosition();

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);

    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('touchstart', onPointerDown as any);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);

  useEffect(() => {
    let alive = true;

    async function hydrateConcert() {
      if (!isConcert) return;
      const concertId = post?.id;
      if (!concertId) return;

      // 🔗 Leer siempre cover/record actuales desde concerts (pero SIN permitir edición)
      const { data: c } = await supabase
        .from('concerts')
        .select('cover_url, record_id')
        .eq('id', concertId)
        .single();

      if (!alive) return;

      const existingCoverUrl: string | null = (c as any)?.cover_url ?? null;
      const existingRecordId: string | null = (c as any)?.record_id ?? null;

      // Cover efectiva: si es vídeo, la ignoramos
      const effectiveCoverUrl =
        existingCoverUrl && !isVideoUrl(existingCoverUrl) ? existingCoverUrl : null;

      if (effectiveCoverUrl) setBgUrl(effectiveCoverUrl);

      // Hydrate artist / country names
      if (!artistName && post?.artist_id) {
        const { data: a } = await supabase
          .from('artists')
          .select('name')
          .eq('id', post.artist_id)
          .single();
        if (alive && a?.name) setArtistName(a.name);
      }

      if (!countryName && post?.country_code) {
        const { data: co } = await supabase
          .from('countries')
          .select('name')
          .eq('code', post.country_code)
          .single();
        if (alive && co?.name) setCountryName(co.name);
      }

      // Hydrate colors desde el record_id del concierto (sin palette)
      if ((!vibe || !cover) && existingRecordId) {
        const { data: r } = await supabase
          .from('records')
          .select('vibe_color, cover_color')
          .eq('id', existingRecordId)
          .single();

        if (!alive) return;
        if (r) {
          if (!vibe && (r as any).vibe_color) setVibe((r as any).vibe_color);
          if (!cover && (r as any).cover_color) setCover((r as any).cover_color);
        }
      }
    }

    hydrateConcert();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConcert, post?.id, post?.artist_id, post?.country_code, artistName, countryName, vibe, cover]);

  // Compat: posts antiguos (por record_id)
  useEffect(() => {
    let active = true;
    (async () => {
      if (vibe && cover) return;
      if (!post?.record_id) return;
      const { data } = await supabase
        .from('records')
        .select('vibe_color, cover_color')
        .eq('id', post.record_id)
        .single();
      if (!active) return;
      if (data) {
        if (!vibe && (data as any).vibe_color) setVibe((data as any).vibe_color);
        if (!cover && (data as any).cover_color) setCover((data as any).cover_color);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.record_id]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const ownerId =
        (post as any).user_id ?? (post as any).author_id ?? (post as any).profile_id ?? null;
      if (user && ownerId && user.id === ownerId) setIsOwner(true);
    })();
  }, [post]);

  const href = `/post/${post.id}`;
  const vibeSafe = useMemo(() => vibe || '#0E1A3A', [vibe]);
  const coverSafe = useMemo(() => cover || '#FFFFFF', [cover]);

  async function handleReport(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (reported || reporting) return;
    const ok = safeConfirm('Report this post?');
    if (!ok) return;
    try {
      setReporting(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        safeAlert('Please sign in to report.');
        return;
      }
      await supabase
        .from('reports')
        .insert({ user_id: user.id, post_id: post.id, reason: 'inappropriate' });
      setReported(true);
      closeMenu();
    } catch {
      safeAlert('Could not send report. Please try again.');
    } finally {
      setReporting(false);
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isOwner || deleting) return;
    const ok = safeConfirm('Delete this post? This cannot be undone.');
    if (!ok) return;
    try {
      setDeleting(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const endpoint = isConcert ? '/api/delete-concert' : '/api/delete-post';
      const payload = isConcert ? { concertId: post.id } : { postId: post.id };

      const base =
        typeof window !== 'undefined'
          ? window.location.origin
          : process.env.NEXT_PUBLIC_SITE_URL || '';
      const fullUrl = `${base}${endpoint}`;

      const resp = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        // eslint-disable-next-line no-console
        console.error('delete error:', json);
        safeAlert((json as any)?.error || 'Could not delete this post.');
        return;
      }
      closeMenu();
      if (typeof window !== 'undefined') window.location.reload();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      safeAlert('Could not delete this post.');
    } finally {
      setDeleting(false);
    }
  }

  const experience = post?.experience || post?.experience_type || null;
  const headerLeft = experience ? cap(experience) : artistName || 'Concert';

  return (
    <Link href={href} aria-label={`Open post ${post.id}`}>
      <article className="group relative aspect-square overflow-hidden rounded-2xl bg-neutral-100 shadow-sm hover:shadow transition-all hover:scale-[1.01] cursor-pointer w-full">
        {/* menú button */}
        <button
          ref={menuBtnRef}
          type="button"
          onClick={
            menuOpen
              ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  closeMenu();
                }
              : openMenu
          }
          aria-label={menuOpen ? 'Close menu' : 'More options'}
          className="absolute z-20 top-2 right-2 h-8 w-8 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/40 text-white text-base backdrop-blur-sm"
        >
          {menuOpen ? '×' : '⋯'}
        </button>

        {/* Portal dropdown (NO se recorta en móvil) */}
        {menuOpen && typeof window !== 'undefined'
          ? createPortal(
              <div
                ref={menuRef}
                className="fixed z-[9999] rounded-xl bg-black/80 text-white text-xs backdrop-blur-md shadow-lg overflow-hidden"
                style={{
                  top: menuPos.top,
                  left: menuPos.left,
                  width: 200,
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <button
                  type="button"
                  onClick={handleReport}
                  className="block w-full px-3 py-2.5 text-left hover:bg-white/10"
                >
                  {reported ? 'Reported ✓' : reporting ? 'Reporting…' : 'Report'}
                </button>

                {isOwner && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="block w-full px-3 py-2.5 text-left hover:bg-white/10"
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              </div>,
              document.body
            )
          : null}

        {bgUrl && !isVideoUrl(bgUrl) && (
          <img src={bgUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-black/10" />

        {/* Bloque colores */}
        <div
          className="absolute bottom-2 right-2 md:bottom-3 md:right-3 rounded-xl shadow-md w-16 h-16 sm:w-[72px] sm:h-[72px] md:w-20 md:h-20"
          style={{ backgroundColor: vibeSafe }}
        >
          <div
            className="absolute rounded-[6px]"
            style={{ inset: '26%', backgroundColor: coverSafe }}
          />
        </div>

        {/* Overlay Artist / Country */}
        {(headerLeft || countryName) && (
          <div
            className="pointer-events-none absolute left-2 bottom-2 md:left-3 md:bottom-3 rounded-lg bg-black/55 text-white px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
            style={{ fontFamily: 'Roboto, Arial, sans-serif' }}
          >
            {headerLeft && (
              <div className="text-[0.82rem] leading-[1.1]">{headerLeft}</div>
            )}
            {countryName && <div className="mt-0.5 text-[0.7rem] opacity-90">{countryName}</div>}
          </div>
        )}
      </article>
    </Link>
  );
}

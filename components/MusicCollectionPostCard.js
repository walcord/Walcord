'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabaseClient';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

function safeConfirm(message) {
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm(message);
  }
  return true;
}

function safeAlert(message) {
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(message);
  } else {
    // eslint-disable-next-line no-console
    console.warn('ALERT:', message);
  }
}

export default function MusicCollectionPostCard({ post }) {
  const [bgUrl, setBgUrl] = useState(post?.photo_url ?? null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  const menuBtnRef = useRef(null);
  const menuRef = useRef(null);

  // Menu position (portal)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  // Record hydration
  const [recordTitle, setRecordTitle] = useState(null);
  const [artistName, setArtistName] = useState(null);
  const [vibe, setVibe] = useState(null);
  const [cover, setCover] = useState(null);

  // Owner check
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const ownerId = post?.user_id ?? null;
      if (user && ownerId && user.id === ownerId) setIsOwner(true);
    })();
  }, [post]);

  // Hydrate: record + artist + colors
  useEffect(() => {
    let alive = true;

    async function hydrateRecord() {
      const rid = post?.record_id ?? null;
      if (!rid) return;

      const { data: rec, error: recErr } = await supabase
        .from('records')
        .select('id, title, artist_id, artist_name, vibe_color, cover_color')
        .eq('id', rid)
        .single();

      if (!alive) return;
      if (recErr) {
        // eslint-disable-next-line no-console
        console.error('hydrate record error:', recErr.message);
        return;
      }

      if (rec) {
        setRecordTitle(rec.title ?? null);
        setArtistName(rec.artist_name ?? null);
        setVibe(rec.vibe_color ?? null);
        setCover(rec.cover_color ?? null);
      }
    }

    hydrateRecord();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.record_id]);

  // Keep bgUrl synced (si cambia en DB y recargas)
  useEffect(() => {
    setBgUrl(post?.photo_url ?? null);
  }, [post?.photo_url]);

  const vibeSafe = useMemo(() => vibe || '#0E1A3A', [vibe]);
  const coverSafe = useMemo(() => cover || '#FFFFFF', [cover]);

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

  function openMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    computeMenuPosition();
    setMenuOpen(true);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  // Close on outside click / resize / scroll
  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (ev) => {
      const target = ev.target;
      if (!target) return;

      const clickedMenu = menuRef.current && menuRef.current.contains(target);
      const clickedBtn = menuBtnRef.current && menuBtnRef.current.contains(target);

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
      window.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);

  async function handleDelete(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!isOwner || deleting) return;

    const ok = safeConfirm('Delete this collection post? This cannot be undone.');
    if (!ok) return;

    try {
      setDeleting(true);

      const { error } = await supabase.from('music_collections').delete().eq('id', post.id);

      if (error) {
        // eslint-disable-next-line no-console
        console.error('delete error:', error.message);
        safeAlert('Could not delete this post.');
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

  const href = post?.record_id ? `/record/${post.record_id}` : '#';

  const headerLeft =
    recordTitle || artistName ? `${recordTitle || 'Record'}${artistName ? ` — ${artistName}` : ''}` : 'Collection';

  return (
    <Link href={href} aria-label={`Open collection post ${post?.id || ''}`}>
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
                {isOwner ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="block w-full px-3 py-2.5 text-left hover:bg-white/10"
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      closeMenu();
                      safeAlert('Thanks — we received your report.');
                    }}
                    className="block w-full px-3 py-2.5 text-left hover:bg-white/10"
                  >
                    Report
                  </button>
                )}
              </div>,
              document.body
            )
          : null}

        {bgUrl ? <img src={bgUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}

        <div className="absolute inset-0 bg-black/10" />

        {/* Bloque colores (como concerts) */}
        <div
          className="absolute bottom-2 right-2 md:bottom-3 md:right-3 rounded-xl shadow-md w-16 h-16 sm:w-[72px] sm:h-[72px] md:w-20 md:h-20"
          style={{ backgroundColor: vibeSafe }}
        >
          <div className="absolute rounded-[6px]" style={{ inset: '26%', backgroundColor: coverSafe }} />
        </div>

        {/* Overlay info */}
        <div
          className="pointer-events-none absolute left-2 bottom-2 md:left-3 md:bottom-3 rounded-lg bg-black/55 text-white px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
          style={{ fontFamily: 'Roboto, Arial, sans-serif' }}
        >
          <div className="text-[0.82rem] leading-[1.1]">{cap(headerLeft)}</div>
          {post?.caption ? (
            <div className="mt-0.5 text-[0.7rem] opacity-90 line-clamp-2">{post.caption}</div>
          ) : null}
        </div>
      </article>
    </Link>
  );
}

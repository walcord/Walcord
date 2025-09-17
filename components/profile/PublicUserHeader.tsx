'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import FollowButton from '../social/FollowButton';

const WALCORD_BLUES = {
  blue1: '#3268bbff',
  blue2: '#284072ff',
  blue3: '#2d4288ff',
  blue4: '#4a6ea9ff',
};

type Props = { userId: string };

export default function PublicUserHeader({ userId }: Props) {
  const [fullName, setFullName] = useState('User');
  const [username, setUsername] = useState<string>('');
  const [genres, setGenres] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [favouriteArtists, setFavouriteArtists] = useState<any[]>([]);
  const [favouriteRecords, setFavouriteRecords] = useState<any[]>([]);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [concertsCount, setConcertsCount] = useState<number>(0); // ← NUEVO

  // auth (para Follow / report-block)
  const [me, setMe] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const isSelf = !!me && me === userId;

  const [color1, color2, color3, color4] = useMemo(
    () => [WALCORD_BLUES.blue2, WALCORD_BLUES.blue1, WALCORD_BLUES.blue4, WALCORD_BLUES.blue3],
    []
  );

  // Perfil base
  useEffect(() => {
    if (!userId) return;
    const run = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url, full_name, username')
        .eq('id', userId)
        .single();
      if (data) {
        setAvatarUrl(data.avatar_url || null);
        setFullName(data.full_name || 'User');
        setUsername(data.username || '');
      }
      const { data: fcounts } = await supabase
        .from('profile_follow_counts')
        .select('followers_count')
        .eq('profile_id', userId)
        .single();
      setFollowersCount(fcounts?.followers_count ?? 0);
    };
    run();
  }, [userId]);

  // sesión
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      setAuthed(!!session?.user);
      setMe(session?.user?.id ?? null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setAuthed(!!session?.user);
      setMe(session?.user?.id ?? null);
    });
    return () => {
      sub.subscription.unsubscribe();
      active = false;
    };
  }, []);

  // Géneros
  useEffect(() => {
    if (!userId) return;
    const run = async () => {
      const { data } = await supabase
        .from('favourite_genres')
        .select('genres (slug)')
        .eq('user_id', userId)
        .limit(2);
      const names =
        data
          ?.map((it: any) => it.genres?.slug)
          .filter(Boolean)
          .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)) || [];
      setGenres(names);
    };
    run();
  }, [userId]);

  // Favoritos (solo lectura)
  useEffect(() => {
    if (!userId) return;
    const run = async () => {
      const { data: arts } = await supabase
        .from('favourite_artists')
        .select('name, cover_color, vibe_color')
        .eq('user_id', userId);
      setFavouriteArtists(arts || []);

      const { data: recs } = await supabase
        .from('favourite_records')
        .select('name, cover_color, vibe_color')
        .eq('user_id', userId);
      setFavouriteRecords(recs || []);
    };
    run();
  }, [userId]);

  // 🔢 Contador de conciertos asistidos (igual que en el otro header)
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { count, error } = await supabase
        .from('concerts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      if (error) { console.error(error.message); setConcertsCount(0); return; }
      setConcertsCount(count ?? 0);
    })();
  }, [userId]);

  const queryUser = username ? `?username=${encodeURIComponent(username)}` : '';
  const disabledLinkClass = username ? '' : 'pointer-events-none opacity-60';

  function toggleMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen((s) => !s);
  }
  async function onBlock(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!authed || !me || isSelf) return;
    if (!confirm(`Block @${username || 'user'}?`)) return;
    try {
      await supabase.from('blocked_users').insert({ blocker_id: me, blocked_id: userId });
      alert('User blocked.');
      setMenuOpen(false);
    } catch {
      alert('Could not block user. Please try again.');
    }
  }
  function onReportUser(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const subject = encodeURIComponent(`Report user @${username || userId}`);
    const body = encodeURIComponent(
      `I want to report user ${username ? '@' + username : userId} (id: ${userId}). Reason:\n\n`
    );
    window.location.href = `mailto:support@walcord.com?subject=${subject}&body=${body}`;
    setMenuOpen(false);
  }

  /* Icono fijo de dos personas (followers) */
  const PeopleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm0 2c-2.67 0-8 1.34-8 4v1h10v-1c0-2.66-5.33-4-8-4Zm8 0c-.29 0-.62.02-.97.05A6.33 6.33 0 0 1 18 17v1h6v-1c0-2.66-5.33-4-8-4Z"
        fill="#1F48AF"
      />
    </svg>
  );

  return (
    <section className="w-full px-6 sm:px-12">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-10">
        {/* Avatar (viewer) */}
        <div className="w-[108px] h-[108px] rounded-full shrink-0 overflow-hidden bg-neutral-300 relative">
          {avatarUrl && <Image src={avatarUrl} alt="Profile" fill className="object-cover" />}
        </div>

        {/* Info */}
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left w-full">
          {/* Géneros */}
          <p
            className="text-[15px] font-light text-[#1d1d1d] leading-tight"
            style={{ fontFamily: 'Times New Roman, serif' }}
          >
            {genres.length === 2 ? `${genres[0]} and ${genres[1]}` : '—'}
          </p>

          {/* Nombre */}
          <h1
            className="text-[clamp(2rem,5vw,2.625rem)] font-normal mt-1 mb-2"
            style={{ fontFamily: 'Times New Roman, serif' }}
          >
            {fullName}
          </h1>

          {/* Favourite blocks */}
          <div className="flex flex-wrap justify-center sm:justify-start gap-6 mb-4">
            {/* Records */}
            <Link
              href={`/u/records${queryUser}`}
              aria-disabled={!username}
              className={`flex items-center gap-3 hover:opacity-80 transition-all ${disabledLinkClass}`}
            >
              <div className="relative w-[48px] h-[48px]">
                {favouriteRecords.length >= 2 ? (
                  favouriteRecords.slice(0, 2).map((rec, i) => (
                    <div
                      key={i}
                      className={`absolute top-0 ${i === 0 ? 'left-0 z-10' : 'left-[8px] z-0'} w-[40px] h-[40px] rounded-sm`}
                      style={{
                        background: rec.cover_color || '#ccc',
                        border: `3px solid ${rec.vibe_color || '#eee'}`,
                      }}
                    />
                  ))
                ) : (
                  <>
                    <div
                      className="absolute left-0 top-0 w-[40px] h-[40px] rounded-sm z-10"
                      style={{ backgroundColor: WALCORD_BLUES.blue2 }}
                    />
                    <div
                      className="absolute left-[8px] top-0 w-[40px] h-[40px] rounded-sm z-0"
                      style={{ backgroundColor: WALCORD_BLUES.blue1 }}
                    />
                  </>
                )}
              </div>
              <div className="text-[15px] font-light leading-tight">
                <div>Favourite</div>
                <div>Records</div>
              </div>
            </Link>

            {/* Artists */}
            <Link
              href={`/u/artists${queryUser}`}
              aria-disabled={!username}
              className={`flex items-center gap-3 hover:opacity-80 transition-all ${disabledLinkClass}`}
            >
              <div className="relative w-[48px] h-[48px]">
                {favouriteArtists.length >= 2 ? (
                  favouriteArtists.slice(0, 2).map((art, i) => (
                    <div
                      key={i}
                      className={`absolute top-0 ${i === 0 ? 'left-0 z-10' : 'left-[8px] z-0'} w-[40px] h-[40px] rounded-full`}
                      style={{
                        background: art.cover_color || '#ccc',
                        border: `3px solid ${art.vibe_color || '#eee'}`,
                      }}
                    />
                  ))
                ) : (
                  <>
                    <div
                      className="absolute left-0 top-0 w-[40px] h-[40px] rounded-full z-10"
                      style={{ backgroundColor: WALCORD_BLUES.blue4 }}
                    />
                    <div
                      className="absolute left-[8px] top-0 w-[40px] h-[40px] rounded-full z-0"
                      style={{ backgroundColor: WALCORD_BLUES.blue3 }}
                    />
                  </>
                )}
              </div>
              <div className="text-[15px] font-light leading-tight">
                <div>Favourite</div>
                <div>Artists</div>
              </div>
            </Link>
          </div>

          {/* Future concerts + contador (igual estilo) */}
          <div className="mt-1 flex items-center gap-3">
            <Link
              href={`/u/ConcertsViewer${queryUser}`}
              aria-disabled={!username}
              className={`inline-flex items-center justify-center whitespace-nowrap bg-[#1f45af] text-white text-[14px] px-4 py-[6px] rounded-md transition-all duration-200 hover:brightness-105 active:scale-[0.98] ${disabledLinkClass}`}
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 400, letterSpacing: '-0.2px' }}
            >
              Future concerts
            </Link>

            <span
              className="inline-flex items-center px-3 py-[4px] rounded-full border border-neutral-300 text-[13px] text-neutral-800 select-none leading-none"
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
            >
              {concertsCount} {concertsCount === 1 ? 'concert' : 'concerts'} attended
            </span>
          </div>

          {/* Social (solo followers) */}
          <div className="mt-6 flex items-center gap-2">
            <PeopleIcon />
            <span
              className="text-sm text-neutral-700 select-none"
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
            >
              {followersCount} followers
            </span>
          </div>

          {/* Acciones (solo Follow) */}
          {!isSelf && authed !== null && (
            <div className="mt-4 flex items-center gap-2 shrink-0 relative">
              {authed ? (
                <FollowButton profileId={userId} />
              ) : (
                <Link
                  href="/login"
                  className="px-5 py-1.5 rounded-full border border-[#1F48AF] text-[#1F48AF] text-sm hover:bg-[#1F48AF] hover:text-white transition"
                >
                  Follow
                </Link>
              )}

              <div className="relative">
                <button
                  type="button"
                  onClick={toggleMenu}
                  aria-label={menuOpen ? 'Close menu' : 'More options'}
                  className="h-8 w-8 rounded-full bg-black/10 hover:bg-black/20 text-black flex items-center justify-center"
                >
                  {menuOpen ? '×' : '⋯'}
                </button>

                {menuOpen && (
                  <div
                    className="absolute right-0 mt-2 min-w-[130px] rounded-md bg-black/80 text-white text-xs shadow-sm backdrop-blur-sm overflow-hidden z-20"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <button type="button" onClick={onReportUser} className="block w-full text-left px-3 py-2 hover:bg-white/10">
                      Report user
                    </button>
                    {authed && (
                      <button type="button" onClick={onBlock} className="block w-full text-left px-3 py-2 hover:bg-white/10">
                        Block
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

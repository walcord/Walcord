'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

const WALCORD_BLUES = { blue1:'#3268bbff', blue2:'#284072ff', blue3:'#2d4288ff', blue4:'#4a6ea9ff' };

export default function UserHeader() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profileId, setProfileId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const [genres, setGenres] = useState<string[]>([]);
  const [favouriteArtists, setFavouriteArtists] = useState<any[]>([]);
  const [favouriteRecords, setFavouriteRecords] = useState<any[]>([]);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [concertsCount, setConcertsCount] = useState<number>(0);

  const [color1, color2, color3, color4] = useMemo(
    () => [WALCORD_BLUES.blue2, WALCORD_BLUES.blue1, WALCORD_BLUES.blue4, WALCORD_BLUES.blue3],
    []
  );

  const nameFontSizePx = useMemo(() => {
    const len = username.trim().length;
    if (len === 0) return undefined;
    if (len <= 16) return 42;
    if (len <= 22) return 36;
    if (len <= 28) return 32;
    return 28;
  }, [username]);

  /* Avatar (ya no editable desde el perfil) */
  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (upErr) { console.error(upErr.message); return; }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = pub.publicUrl;
    const { error: updErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
    if (updErr) { console.error(updErr.message); return; }
    setProfileImage(url);
    try { localStorage.setItem('walcord_avatar_url', url); } catch {}
  };

  /* Perfil base */
  useEffect(() => {
    try {
      const n = localStorage.getItem('walcord_full_name');
      const a = localStorage.getItem('walcord_avatar_url');
      if (n) setUsername(n);
      if (a) setProfileImage(a);
    } catch {}
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setProfileId(user.id);
      const { data } = await supabase.from('profiles').select('avatar_url, full_name').eq('id', user.id).single();
      setProfileImage((data?.avatar_url as string) || null);
      setUsername((data?.full_name as string) || 'User');
    })();
  }, []);

  const saveName = async (newName: string) => {
    if (!newName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSavingName(true);
    const { error } = await supabase.from('profiles').update({ full_name: newName.trim() }).eq('id', user.id);
    setSavingName(false);
    if (error) { console.error(error.message); return; }
    setUsername(newName.trim());
    try { localStorage.setItem('walcord_full_name', newName.trim()); } catch {}
    setEditingName(false);
  };

  /* Social: solo followers */
  useEffect(() => {
    if (!profileId) return;
    const loadFollowers = async () => {
      const { data: fcounts } = await supabase
        .from('profile_follow_counts')
        .select('followers_count')
        .eq('profile_id', profileId)
        .maybeSingle();
      if (fcounts?.followers_count != null) setFollowersCount(fcounts.followers_count);
      else {
        const { count } = await supabase
          .from('follows')
          .select('follower_id', { count: 'exact', head: true })
          .eq('following_id', profileId);
        setFollowersCount(count ?? 0);
      }
    };
    void loadFollowers();
    const ch = supabase
      .channel('userheader-followers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `following_id=eq.${profileId}` },
        () => void loadFollowers()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profileId]);

  /* Géneros */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('favourite_genres')
        .select('genres (slug)')
        .eq('user_id', user.id)
        .limit(2);
      if (error) { console.error(error.message); return; }
      const names = (data || [])
        .map((it:any)=>it.genres?.slug)
        .filter(Boolean)
        .map((s:string)=>s.charAt(0).toUpperCase()+s.slice(1));
      setGenres(names);
    })();
  }, []);

  /* Favs */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: A } = await supabase
        .from('favourite_artists')
        .select('name, cover_color, vibe_color')
        .eq('user_id', user.id);
      setFavouriteArtists(A || []);
      const { data: R } = await supabase
        .from('favourite_records')
        .select('name, cover_color, vibe_color')
        .eq('user_id', user.id);
      setFavouriteRecords(R || []);
    })();
  }, []);

  /* Nº conciertos */
  useEffect(() => {
    (async () => {
      if (!profileId) return;
      const { count, error } = await supabase
        .from('concerts')
        .select('id', { count:'exact', head:true })
        .eq('user_id', profileId);
      if (error) { console.error(error.message); setConcertsCount(0); return; }
      setConcertsCount(count ?? 0);
    })();
  }, [profileId]);

  /* ICONO NUEVO: dos personas (una apoyada ligeramente sobre la otra) */
  const TwoPeopleIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <g fill="none" stroke="#1F48AF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {/* Persona 1 */}
        <circle cx="8" cy="8.5" r="2.3" />
        <path d="M5.6 15c0-2 1.9-3.7 4.4-3.7s4.4 1.7 4.4 3.7" />
        {/* Persona 2 (ligeramente detrás y apoyada) */}
        <circle cx="15" cy="7.8" r="2.1" />
        <path d="M12.8 14.4c.4-1.5 1.6-2.6 3.3-2.6 1.9 0 3.5 1.4 3.5 3.2" />
      </g>
    </svg>
  );

  return (
    <section className="w-full px-6 sm:px-12">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-10">
        {/* Avatar (sin opción de cambiar desde aquí) */}
        <div
          className="w-[108px] h-[108px] rounded-full shrink-0 overflow-hidden bg-neutral-300 relative"
        >
          {profileImage && <Image src={profileImage} alt="Profile" fill className="object-cover" />}
          {/* input oculto sin uso directo desde el perfil */}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleProfileImageUpload}
            className="hidden"
          />
        </div>

        {/* Info */}
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left w-full">
          {/* Géneros */}
          <p
            className="text-[15px] font-light text-[#1d1d1d] leading-tight transition-all duration-200"
            style={{ fontFamily: 'Times New Roman, serif' }}
          >
            {genres.length === 2 ? `${genres[0]} and ${genres[1]}` : 'Select your favourite genres'}
          </p>

          {/* Nombre (ya no editable aquí) */}
          <div className="mt-1 mb-4">
            {editingName ? (
              <input
                autoFocus
                defaultValue={username}
                disabled={savingName}
                onBlur={(e) => saveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName((e.target as HTMLInputElement).value);
                  if (e.key === 'Escape') setEditingName(false);
                }}
                className="bg-transparent outline-none border-b border-neutral-400 text-center sm:text-left"
                style={{ fontFamily: 'Times New Roman, serif', fontSize: nameFontSizePx ? `${nameFontSizePx}px` : undefined }}
              />
            ) : (
              <h1
                className="font-normal whitespace-nowrap overflow-hidden text-ellipsis"
                style={{ fontFamily: 'Times New Roman, serif', fontSize: nameFontSizePx ? `${nameFontSizePx}px` : undefined }}
              >
                {username || ' '}
              </h1>
            )}
          </div>

          {/* Favoritos */}
          <div className="flex flex-wrap justify-center sm:justify-start gap-6 mb-3">
            {/* Records */}
            <div
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-all"
              onClick={() => router.push('/favourite-records')}
            >
              <div className="relative w-[48px] h-[48px]">
                {favouriteRecords.length >= 2 ? (
                  favouriteRecords.slice(0, 2).map((rec, i) => (
                    <div
                      key={i}
                      className={`absolute top-0 ${i === 0 ? 'left-0 z-10' : 'left-[8px] z-0'} w-[40px] h-[40px] rounded-sm`}
                      style={{ background: rec.cover_color || '#ccc', border:`3px solid ${rec.vibe_color || '#eee'}` }}
                    />
                  ))
                ) : (
                  <>
                    <div className="absolute left-0 top-0 w-[40px] h-[40px] rounded-sm z-10" style={{ backgroundColor: color1 }}/>
                    <div className="absolute left-[8px] top-0 w-[40px] h-[40px] rounded-sm z-0" style={{ backgroundColor: color2 }}/>
                  </>
                )}
              </div>
              <div className="text-[15px] font-light leading-tight" style={{ fontFamily: 'Roboto, sans-serif' }}>
                <div>Favourite</div><div>Records</div>
              </div>
            </div>

            {/* Artists */}
            <div
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-all"
              onClick={() => router.push('/favourite-artists')}
            >
              <div className="relative w-[48px] h-[48px]">
                {favouriteArtists.length >= 2 ? (
                  favouriteArtists.slice(0, 2).map((art, i) => (
                    <div
                      key={i}
                      className={`absolute top-0 ${i === 0 ? 'left-0 z-10' : 'left-[8px] z-0'} w-[40px] h-[40px] rounded-full`}
                      style={{ background: art.cover_color || '#ccc', border:`3px solid ${art.vibe_color || '#eee'}` }}
                    />
                  ))
                ) : (
                  <>
                    <div className="absolute left-0 top-0 w-[40px] h-[40px] rounded-full z-10" style={{ backgroundColor: color3 }}/>
                    <div className="absolute left-[8px] top-0 w-[40px] h-[40px] rounded-full z-0" style={{ backgroundColor: color4 }}/>
                  </>
                )}
              </div>
              <div className="text-[15px] font-light leading-tight" style={{ fontFamily: 'Roboto, sans-serif' }}>
                <div>Favourite</div><div>Artists</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-1 flex items-center gap-3">
            <button
              onClick={() => router.push('/future-concerts')}
              className="inline-flex items-center justify-center whitespace-nowrap bg-[#1f45af] text-white text-[14px] px-4 py-[6px] rounded-md transition-all duration-200 hover:brightness-105 active:scale-[0.98]"
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 400, letterSpacing: '-0.2px' }}
            >
              Future concerts
            </button>
            <button
              onClick={() => router.push('/listener-takes')}
              className="inline-flex items-center justify-center whitespace-nowrap text-[14px] px-4 py-[6px] rounded-full border border-neutral-300 text-neutral-900 transition-colors hover:bg-neutral-100 active:scale-[0.98]"
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 400, letterSpacing: '-0.2px' }}
            >
              Musical opinions
            </button>
          </div>

          {/* Followers */}
          <div
            className="mt-6 flex items-center gap-2 cursor-pointer select-none hover:opacity-80 transition"
            role="button"
            tabIndex={0}
            onClick={() => profileId && router.push(`/followers?u=${profileId}`)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && profileId) router.push(`/followers?u=${profileId}`);
            }}
            aria-label="Open Followers / Following"
            title="Open Followers / Following"
          >
            <TwoPeopleIcon />
            <span className="text-sm text-neutral-700" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}>
              {followersCount} followers
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

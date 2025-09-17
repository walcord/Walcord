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

  /* Avatar */
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

  /* Social: solo followers (sin friends) */
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

  /* Nº conciertos reales (concerts) */
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

  /* Icono fijo de dos personas (solo para followers) */
  const PeopleIcon = () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm0 2c-2.67 0-8 1.34-8 4v1h10v-1c0-2.66-5.33-4-8-4Zm8 0c-.29 0-.62.02-.97.05A6.33 6.33 0 0 1 18 17v1h6v-1c0-2.66-5.33-4-8-4Z" fill="#1F48AF"/>
    </svg>
  );

  return (
    <section className="w-full px-6 sm:px-12">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-10">
        {/* Avatar */}
        <div
          className="w-[108px] h-[108px] rounded-full shrink-0 overflow-hidden cursor-pointer bg-neutral-300 relative"
          onClick={() => fileInputRef.current?.click()}
          title="Change avatar"
        >
          {profileImage && <Image src={profileImage} alt="Profile" fill className="object-cover" />}
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleProfileImageUpload} className="hidden" />
        </div>

        {/* Info */}
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left w-full">
          {/* Géneros */}
          <p
            onClick={() => router.push('/select-genres')}
            className="text-[15px] font-light text-[#1d1d1d] leading-tight cursor-pointer transition-all duration-200 hover:opacity-70"
            style={{ fontFamily: 'Times New Roman, serif' }}
          >
            {genres.length === 2 ? `${genres[0]} and ${genres[1]}` : 'Select your favourite genres'}
          </p>

          {/* Nombre */}
          <div className="mt-1 mb-4">
            {editingName ? (
              <input
                autoFocus
                defaultValue={username}
                disabled={savingName}
                onBlur={(e) => saveName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveName((e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditingName(false); }}
                className="bg-transparent outline-none border-b border-neutral-400 text-center sm:text-left"
                style={{ fontFamily: 'Times New Roman, serif', fontSize: nameFontSizePx ? `${nameFontSizePx}px` : undefined }}
              />
            ) : (
              <h1
                className="font-normal whitespace-nowrap overflow-hidden text-ellipsis cursor-text"
                style={{ fontFamily: 'Times New Roman, serif', fontSize: nameFontSizePx ? `${nameFontSizePx}px` : undefined }}
                onClick={() => setEditingName(true)}
                title="Click to edit name"
              >
                {username || ' '}
              </h1>
            )}
          </div>

          {/* Favoritos */}
          <div className="flex flex-wrap justify-center sm:justify-start gap-6 mb-3">
            {/* Records */}
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-all" onClick={() => router.push('/favourite-records')}>
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
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-all" onClick={() => router.push('/favourite-artists')}>
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

          {/* Future concerts (misma fuente: Roboto) + contador */}
          <div className="mt-1 flex items-center gap-3">
            <button
              onClick={() => router.push('/future-concerts')}
              className="inline-flex items-center justify-center whitespace-nowrap bg-[#1f45af] text-white text-[14px] px-4 py-[6px] rounded-md transition-all duration-200 hover:brightness-105 active:scale-[0.98]"
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 400, letterSpacing: '-0.2px' }}
            >
              Future concerts
            </button>

            <span
              className="inline-flex items-center px-3 py-[4px] rounded-full border border-neutral-300 text-[13px] text-neutral-800 select-none leading-none"
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
            >
              {concertsCount} {concertsCount === 1 ? 'concert' : 'concerts'} attended
            </span>
          </div>

          {/* Followers (solo texto + icono fijo pequeño) */}
          <div className="mt-6 flex items-center gap-2">
            <PeopleIcon />
            <span className="text-sm text-neutral-700 select-none" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}>
              {followersCount} followers
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import FriendRequestsSheet from '../components/social/FriendRequestsSheet';

const WALCORD_BLUES = {
  blue1: '#3268bbff',
  blue2: '#284072ff',
  blue3: '#2d4288ff',
  blue4: '#4a6ea9ff',
};

type Props = { genres?: string[] };

export default function UserHeader(_: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Perfil base
  const [profileId, setProfileId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // Favoritos
  const [genres, setGenres] = useState<string[]>([]);
  const [songs, setSongs] = useState<string[]>([]);
  const [favouriteArtists, setFavouriteArtists] = useState<any[]>([]);
  const [favouriteRecords, setFavouriteRecords] = useState<any[]>([]);

  // Social
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);

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

  /* ========== Upload avatar (con guardado en profiles) ========== */
  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      console.error('Auth error:', userErr?.message || 'not logged in');
      return;
    }

    try {
      const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase
        .storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating profile avatar_url:', updateError.message);
        return;
      }

      setProfileImage(publicUrl);
      try {
        localStorage.setItem('walcord_avatar_url', publicUrl);
      } catch {}
    } catch (err) {
      console.error('Unexpected upload error:', err);
    } finally {
      // reset input para permitir re-subir el mismo archivo si quiere
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /* ========== Carga de perfil con caché local ========== */
  useEffect(() => {
    try {
      const cachedName = localStorage.getItem('walcord_full_name');
      const cachedAvatar = localStorage.getItem('walcord_avatar_url');
      if (cachedName) setUsername(cachedName);
      if (cachedAvatar) setProfileImage(cachedAvatar);
    } catch {}

    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setProfileId(user.id);

      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url, full_name')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error.message);
        return;
      }

      const avatar = (data?.avatar_url as string) || null;
      const name = (data?.full_name as string) || 'User';
      setProfileImage(avatar);
      setUsername(name);
      try {
        localStorage.setItem('walcord_full_name', name);
        if (avatar) localStorage.setItem('walcord_avatar_url', avatar);
      } catch {}
    };

    fetchProfile();
  }, []);

  /* ========== Update de nombre (inline) ========== */
  const saveName = async (newName: string) => {
    if (!newName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSavingName(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: newName.trim() })
      .eq('id', user.id);
    setSavingName(false);
    if (error) {
      console.error('Error updating full_name:', error.message);
      return;
    }
    setUsername(newName.trim());
    try { localStorage.setItem('walcord_full_name', newName.trim()); } catch {}
    setEditingName(false);
  };

  /* ========== Followers + Pending requests ========== */
  useEffect(() => {
    if (!profileId) return;

    const loadCounts = async () => {
      // 1) intenta leer vista agregada
      const { data: fcounts } = await supabase
        .from('profile_follow_counts')
        .select('followers_count')
        .eq('profile_id', profileId)
        .maybeSingle();

      if (fcounts?.followers_count != null) {
        setFollowersCount(fcounts.followers_count);
      } else {
        // 2) fallback directo a tabla follows
        const { count } = await supabase
          .from('follows')
          .select('follower_id', { count: 'exact', head: true })
          .eq('following_id', profileId);
        setFollowersCount(count ?? 0);
      }

      const { data: pend } = await supabase
        .from('friendships')
        .select('id')
        .eq('receiver_id', profileId)
        .eq('status', 'pending');
      setPendingCount(pend?.length ?? 0);
    };

    void loadCounts();

    const ch = supabase
      .channel('userheader-social')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `following_id=eq.${profileId}` },
        () => { void loadCounts(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships', filter: `receiver_id=eq.${profileId}` },
        () => { void loadCounts(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [profileId]);

  /* ========== Favoritos: géneros (máx 2) ========== */
  useEffect(() => {
    const fetchGenres = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('favourite_genres')
        .select('genres (slug)')
        .eq('user_id', user.id)
        .limit(2);

      if (error) return console.error('Error fetching genres:', error.message);

      const genreNames =
        data
          ?.map((item: any) => item.genres?.slug)
          .filter(Boolean)
          .map((slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1)) || [];

      setGenres(genreNames);
    };

    fetchGenres();
  }, []);

  /* ========== Favoritos: top songs (is_top = true, máx 3) ========== */
  useEffect(() => {
    const fetchTopSongs = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('favourite_tracks')
        .select('track_id (track)')
        .eq('user_id', user.id)
        .eq('is_top', true)
        .limit(3);

      if (error) return console.error('Error fetching top songs:', error.message);

      setSongs((data || []).map((entry: any) => entry.track_id?.track).filter(Boolean));
    };

    fetchTopSongs();
  }, []);

  /* ========== Favoritos: artistas y discos ========== */
  useEffect(() => {
    const fetchFavouriteArtists = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('favourite_artists')
        .select('name, cover_color, vibe_color')
        .eq('user_id', user.id);

      if (error) return console.error('Error fetching favourite artists:', error.message);

      setFavouriteArtists(data || []);
    };

    const fetchFavouriteRecords = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('favourite_records')
        .select('name, cover_color, vibe_color')
        .eq('user_id', user.id);

      if (error) return console.error('Error fetching favourite records:', error.message);

      setFavouriteRecords(data || []);
    };

    fetchFavouriteArtists();
    fetchFavouriteRecords();
  }, []);

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
          {/* Géneros favoritos */}
          <p
            onClick={() => router.push('/select-genres')}
            className="text-[15px] font-light text-[#1d1d1d] leading-tight cursor-pointer transition-all duration-200 hover:opacity-70"
            style={{ fontFamily: 'Times New Roman, serif' }}
          >
            {genres.length === 2 ? `${genres[0]} and ${genres[1]}` : 'Select your favourite genres'}
          </p>

          {/* Nombre (editable) */}
          <div className="mt-1 mb-6">
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
                className="font-normal whitespace-nowrap overflow-hidden text-ellipsis cursor-text"
                style={{ fontFamily: 'Times New Roman, serif', fontSize: nameFontSizePx ? `${nameFontSizePx}px` : undefined }}
                onClick={() => setEditingName(true)}
                title="Click to edit name"
              >
                {username || ' '}
              </h1>
            )}
          </div>

          {/* Favourite blocks */}
          <div className="flex flex-wrap justify-center sm:justify-start gap-6 mb-5">
            {/* Favourite Records */}
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
                      style={{
                        background: rec.cover_color || '#ccc',
                        border: `3px solid ${rec.vibe_color || '#eee'}`,
                      }}
                    />
                  ))
                ) : (
                  <>
                    <div className="absolute left-0 top-0 w-[40px] h-[40px] rounded-sm z-10" style={{ backgroundColor: color1 }} />
                    <div className="absolute left-[8px] top-0 w-[40px] h-[40px] rounded-sm z-0" style={{ backgroundColor: color2 }} />
                  </>
                )}
              </div>
              <div className="text-[15px] font-light leading-tight" style={{ fontFamily: 'Roboto, sans-serif' }}>
                <div>Favourite</div>
                <div>Records</div>
              </div>
            </div>

            {/* Favourite Artists */}
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
                      style={{
                        background: art.cover_color || '#ccc',
                        border: `3px solid ${art.vibe_color || '#eee'}`,
                      }}
                    />
                  ))
                ) : (
                  <>
                    <div className="absolute left-0 top-0 w-[40px] h-[40px] rounded-full z-10" style={{ backgroundColor: color3 }} />
                    <div className="absolute left-[8px] top-0 w-[40px] h-[40px] rounded-full z-0" style={{ backgroundColor: color4 }} />
                  </>
                )}
              </div>
              <div className="text-[15px] font-light leading-tight" style={{ fontFamily: 'Roboto, sans-serif' }}>
                <div>Favourite</div>
                <div>Artists</div>
              </div>
            </div>
          </div>

          {/* Botón Concerts */}
          <button
            onClick={() => router.push('/concerts')}
            className="bg-[#1f45af] text-white text-[15px] font-normal px-6 py-[6px] rounded transition-all duration-200 hover:scale-[1.02] hover:shadow-md active:scale-[0.97]"
            style={{ fontFamily: 'Times New Roman' }}
          >
            Concerts
          </button>

          {/* Favourite Songs */}
          <div
            onClick={() => router.push('/favourite-songs')}
            className="mt-5 text-[13px] font-light leading-tight cursor-pointer transition-all duration-200 hover:opacity-70"
            style={{ fontFamily: 'Roboto, sans-serif' }}
          >
            <p className="mb-1">Favourite Songs</p>
            <p className="text-[#1d1d1d]">
              {songs.length > 0 ? songs.join(' · ') : 'Select your favourite songs'}
            </p>
          </div>

          {/* --- Social --- */}
          <div className="mt-7 flex items-center gap-3">
            <span
              className="text-sm text-neutral-700 select-none"
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
            >
              {followersCount} followers
            </span>

            {profileId && <FriendRequestsSheet ownerProfileId={profileId} badgeCount={pendingCount} />}

            <a
              href="/friends"
              className="text-sm text-[#1F48AF] underline-offset-4 hover:opacity-80"
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
            >
              See all friends
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

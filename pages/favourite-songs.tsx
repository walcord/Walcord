'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Image from 'next/image';
import WalcordStar from '../components/icons/WalcordStar';
import { useSession, useUser } from '@supabase/auth-helpers-react';
import { useSearchParams } from 'next/navigation';

export default function FavouriteSongsPage() {
  const session = useSession();
  const me = useUser();
  const qs = useSearchParams();

  // PERFIL OBJETIVO
  const [targetId, setTargetId] = useState<string | null>(null);
  const [targetUsername, setTargetUsername] = useState<string | null>(null);
  const readonly = !!(targetId && me?.id && targetId !== me.id);

  useEffect(() => {
    const init = async () => {
      const qProfileId = qs.get('profileId') || qs.get('user') || qs.get('u');
      const qUsername = qs.get('username') || qs.get('handle');
      if (qProfileId) { setTargetId(qProfileId); return; }
      if (qUsername) {
        const { data } = await supabase.from('profiles').select('id,username').eq('username', qUsername).maybeSingle();
        if (data?.id) { setTargetId(data.id); setTargetUsername(data.username); return; }
      }
      setTargetId(session?.user?.id ?? null);
    };
    init();
  }, [qs, session?.user?.id]);

  const [tracks, setTracks] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [favouriteTracks, setFavouriteTracks] = useState<any[]>([]);

  useEffect(() => {
    const fetchAllTracks = async () => {
      // --- FIX: paginación para traer TODAS las canciones (límite PostgREST ~1000) ---
      const PAGE_SIZE = 1000;
      let from = 0;
      let to = PAGE_SIZE - 1;
      const all: any[] = [];

      // mantenemos el mismo select y el mismo alias de relación
      while (true) {
        const { data, error } = await supabase
          .from('tracks')
          .select(`
            *,
            records:record (
              id,
              title,
              artist_name,
              vibe_color,
              cover_color
            )
          `)
          .order('track', { ascending: true })
          .range(from, to);

        if (error) break;

        const chunk = data || [];
        all.push(...chunk);

        // si el bloque viene incompleto, ya no hay más filas
        if (chunk.length < PAGE_SIZE) break;

        from += PAGE_SIZE;
        to += PAGE_SIZE;
      }

      setTracks(all);
    };

    const fetchFavouriteTracks = async () => {
      if (!targetId) { setFavouriteTracks([]); setSelected([]); return; }
      const { data, error } = await supabase
        .from('favourite_tracks')
        .select('track_id, is_top')
        .eq('user_id', targetId);
      if (!error) {
        setFavouriteTracks(data || []);
        const topTracks = (data || []).filter((f) => f.is_top).map((f) => f.track_id);
        setSelected(topTracks);
      }
    };

    fetchAllTracks();
    fetchFavouriteTracks();
  }, [targetId]);

  const toggleSelect = async (trackId: string) => {
    if (readonly || !me?.id) return;

    const updatedSelected = [...selected];
    const isAlreadySelected = updatedSelected.includes(trackId);

    if (isAlreadySelected) {
      const { error } = await supabase
        .from('favourite_tracks')
        .delete()
        .eq('user_id', me.id)
        .eq('track_id', trackId)
        .eq('is_top', true);
      if (!error) setSelected(updatedSelected.filter((id) => id !== trackId));
    } else {
      if (updatedSelected.length >= 3) return;
      const trackData = tracks.find((t) => t.id === trackId);
      if (!trackData) return;
      const record_id = trackData.record_id || trackData.records?.id || null;
      const { error } = await supabase.from('favourite_tracks').upsert([{ user_id: me.id, track_id: trackId, is_top: true, record_id }]);
      if (!error) { updatedSelected.push(trackId); setSelected(updatedSelected); }
      setTargetId(me.id);
    }
  };

  const isSelected = (trackId: string) => selected.includes(trackId);
  const filteredTracks = useMemo(
    () => tracks.filter((track) => (track.track || '').toLowerCase().includes(search.toLowerCase())),
    [tracks, search]
  );
  const selectedSongs = tracks.filter((t) => selected.includes(t.id));
  const selectedTitles = selectedSongs.map((t) => t.track).join(' · ');

  const groupedByAlbum: Record<string, any[]> = {};
  tracks.forEach((track) => {
    const isFavourite = favouriteTracks.find((f) => f.track_id === track.id);
    if (isFavourite) {
      const album = track.records?.title || 'Unknown Album';
      if (!groupedByAlbum[album]) groupedByAlbum[album] = [];
      groupedByAlbum[album].push(track);
    }
  });

  return (
    <div className="bg-white min-h-screen text-black font-sans">
      <div className="w-full h-[100px] sm:h-[80px] bg-[#1F48AF] flex items-center justify-start px-4 sm:px-12">
        <Image src="/logotipo.png" alt="Walcord Logo" width={62} height={62} className="w-[62px] h-[62px]" />
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-10">
        <h1 className="text-4xl font-light text-center tracking-tight mb-1" style={{ fontFamily: 'Times New Roman, serif' }}>
          {selectedTitles || 'Favourite Songs'}
        </h1>
        {readonly && targetUsername && (
          <p className="text-center text-sm text-neutral-600 -mt-1 mb-2">Viewing @{targetUsername}</p>
        )}
        <hr className="border-black w-full mb-8" />
      </div>

      <div className="max-w-4xl mx-auto px-6 mb-6">
        {!readonly && (
          <input
            type="text"
            placeholder="Search your favourite songs or the song of the moment…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 border border-neutral-300 rounded-md focus:outline-none focus:border-black text-base placeholder:text-neutral-500"
          />
        )}
      </div>

      {selectedSongs.length > 0 && !readonly && (
        <div className="max-w-4xl mx-auto px-6 mb-8 flex flex-wrap gap-4">
          {selectedSongs.map((track) => (
            <button
              key={track.id}
              onClick={() => toggleSelect(track.id)}
              className="px-4 py-2 rounded-full border border-[#1F48AF] bg-[#1F48AF] text-white text-sm font-light"
            >
              {track.track} ✕
            </button>
          ))}
        </div>
      )}

      {!readonly && search.trim().length > 0 && (
        <div className="max-w-4xl mx-auto px-6 mb-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm font-light">
          {filteredTracks.map((track) => (
            <button
              key={track.id}
              onClick={() => toggleSelect(track.id)}
              className={`flex flex-col items-start border rounded-md px-3 py-2 text-left hover:bg-neutral-100 ${
                isSelected(track.id) ? 'border-[#1F48AF] bg-[#F0F3FF]' : 'border-neutral-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <WalcordStar size={14} filled={isSelected(track.id)} />
                <span>{track.track}</span>
              </div>
              <div className="text-neutral-500 text-[13px] ml-5 mt-[2px] leading-snug">
                <div>{track.records?.artist_name}</div>
                <div className="italic" style={{ fontFamily: 'Times New Roman, serif' }}>
                  {track.records?.title}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 pb-24">
        {Object.entries(groupedByAlbum).map(([album, tracks]) => (
          <div key={album} className="mb-16">
            <div className="flex items-center gap-6 mb-4">
              <div
                className="w-[56px] h-[56px] rounded-md"
                style={{ backgroundColor: tracks[0]?.records?.vibe_color || '#e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: tracks[0]?.records?.cover_color || '#111' }} />
              </div>
              <div>
                <h2 className="text-xl font-light leading-tight" style={{ fontFamily: 'Times New Roman, serif' }}>{album}</h2>
                <p className="text-sm text-neutral-600 font-light" style={{ fontFamily: 'Times New Roman, serif' }}>
                  {tracks[0]?.records?.artist_name}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm font-light">
              {tracks.map((track) => (
                <div key={track.id} className="flex items-center gap-2">
                  <WalcordStar size={14} filled />
                  <span>{track.track}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {Object.keys(groupedByAlbum).length === 0 && <p className="text-center text-neutral-500">No songs yet.</p>}
      </div>
    </div>
  );
}

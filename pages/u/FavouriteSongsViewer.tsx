'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import WalcordStar from '../../components/icons/WalcordStar';

type Track = {
  id: string;
  track: string;
  record_id?: string | null;
  records?: {
    id: string;
    title: string;
    artist_name: string;
    vibe_color: string | null;
    cover_color: string | null;
  } | null;
};

type Props = { viewerId?: string };

/**
 * Viewer de canciones favoritas (solo lectura).
 * - Usa `viewerId` si viene por props.
 * - Si no, intenta resolverlo vía query param ?username=… -> profiles.id
 */
export default function FavouriteSongsViewer({ viewerId }: Props) {
  const searchParams = useSearchParams();
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(viewerId ?? null);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [favIds, setFavIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Resolver viewerId desde ?username si no llega por props
  useEffect(() => {
    if (viewerId) return; // ya resuelto
    const username = searchParams?.get('username');
    if (!username) return;
    (async () => {
      const { data } = await supabase.from('profiles').select('id').eq('username', username).single();
      if (data?.id) setResolvedUserId(data.id);
    })();
  }, [viewerId, searchParams]);

  // Cargar datos
  useEffect(() => {
    if (!resolvedUserId) return;
    (async () => {
      setLoading(true);

      const { data: favs } = await supabase
        .from('favourite_tracks')
        .select('track_id')
        .eq('user_id', resolvedUserId);

      const favTrackIds: string[] = Array.from(new Set((favs || []).map((f: any) => f.track_id)));
      setFavIds(favTrackIds);

      let all: Track[] = [];
      if (favTrackIds.length > 0) {
        const { data } = await supabase
          .from('tracks')
          .select(
            `
            id, track, record_id,
            records:record (
              id, title, artist_name, vibe_color, cover_color
            )
          `
          )
          .in('id', favTrackIds)
          .order('track', { ascending: true });
        all = (data as any) || [];
      }

      setTracks(all);
      setLoading(false);
    })();
  }, [resolvedUserId]);

  const groupedByAlbum = useMemo(() => {
    const g: Record<string, Track[]> = {};
    for (const t of tracks) {
      const album = t.records?.title || 'Unknown Album';
      if (!g[album]) g[album] = [];
      g[album].push(t);
    }
    return g;
  }, [tracks]);

  const selectedTitles = useMemo(() => {
    const sel = tracks
      .filter((t) => favIds.includes(t.id))
      .slice(0, 3)
      .map((t) => t.track);
    return sel.join(' · ');
  }, [tracks, favIds]);

  if (loading) {
    return (
      <main className="bg-white min-h-screen text-black font-sans">
        <div className="w-full h-[100px] sm:h-[80px] bg-[#1F48AF] flex items-center justify-start px-4 sm:px-12">
          <Image src="/logotipo.png" alt="Walcord Logo" width={62} height={62} />
        </div>
        <div className="max-w-6xl mx-auto px-6 pt-10">
          <p className="text-sm text-neutral-600">Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <div className="bg-white min-h-screen text-black font-sans">
      <div className="w-full h-[100px] sm:h-[80px] bg-[#1F48AF] flex items-center justify-start px-4 sm:px-12">
        <Image src="/logotipo.png" alt="Walcord Logo" width={62} height={62} className="w-[62px] h-[62px]" />
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-10">
        <h1
          className="text-4xl font-light text-center tracking-tight mb-4"
          style={{ fontFamily: 'Times New Roman, serif' }}
        >
          {selectedTitles || 'Favourite Songs'}
        </h1>
        <hr className="border-black w-full mb-8" />
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-24">
        {Object.keys(groupedByAlbum).length === 0 ? (
          <p className="text-sm text-neutral-600">No favourite songs yet.</p>
        ) : (
          Object.entries(groupedByAlbum).map(([album, arr]) => (
            <div key={album} className="mb-16">
              <div className="flex items-center gap-6 mb-4">
                <div
                  className="w-[56px] h-[56px] rounded-md"
                  style={{
                    backgroundColor: arr[0]?.records?.vibe_color || '#e5e5e5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: arr[0]?.records?.cover_color || '#111' }} />
                </div>
                <div>
                  <h2 className="text-xl font-light leading-tight" style={{ fontFamily: 'Times New Roman, serif' }}>
                    {album}
                  </h2>
                  <p className="text-sm text-neutral-600 font-light" style={{ fontFamily: 'Times New Roman, serif' }}>
                    {arr[0]?.records?.artist_name}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm font-light">
                {arr.map((track) => (
                  <div key={track.id} className="flex items-center gap-2">
                    <WalcordStar size={14} filled />
                    <span>{track.track}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

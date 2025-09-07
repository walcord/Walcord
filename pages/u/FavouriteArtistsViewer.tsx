'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { ARTIST_COLOR_PALETTE } from '../../lib/artist.Colors';

type Artist = { id: string; name: string; place: string | null; image_url: string | null };
type FavRow = { artist_id: string; since_year: number };

function getArtistColor(artistId: string) {
  const hash = artistId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const index = hash % ARTIST_COLOR_PALETTE.length;
  return ARTIST_COLOR_PALETTE[index];
}

type Props = { viewerId?: string };

export default function FavouriteArtistsViewer({ viewerId }: Props) {
  const searchParams = useSearchParams();
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(viewerId ?? null);

  const [artists, setArtists] = useState<Artist[]>([]);
  const [favourites, setFavourites] = useState<FavRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (viewerId) return;
    const username = searchParams?.get('username');
    if (!username) return;
    (async () => {
      const { data } = await supabase.from('profiles').select('id').eq('username', username).single();
      if (data?.id) setResolvedUserId(data.id);
    })();
  }, [viewerId, searchParams]);

  useEffect(() => {
    if (!resolvedUserId) return;
    (async () => {
      setLoading(true);

      const { data: favs } = await supabase
        .from('favourite_artists')
        .select('artist_id, since_year')
        .eq('user_id', resolvedUserId);

      const ids: string[] = Array.from(new Set(((favs as FavRow[]) || []).map((f) => f.artist_id)));

      let arts: Artist[] = [];
      if (ids.length > 0) {
        const { data } = await supabase.from('artists').select('id,name,place,image_url').in('id', ids);
        arts = (data as Artist[]) || [];
      }

      setFavourites((favs as FavRow[]) || []);
      setArtists(arts || []);
      setLoading(false);
    })();
  }, [resolvedUserId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-black font-[Roboto]">
        {/* Banner actualizado */}
        <header className="w-full h-24 bg-[#1F48AF] flex items-end px-4 sm:px-6 pb-2">
          <button
            onClick={() => history.back()}
            aria-label="Go back"
            className="p-2 rounded-full hover:bg-[#1A3A95] transition"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </header>

        <div className="w-full flex justify-center mt-10">
          <p className="text-sm text-neutral-600">Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black font-[Roboto]">
      {/* Banner actualizado */}
      <header className="w-full h-24 bg-[#1F48AF] flex items-end px-4 sm:px-6 pb-2">
        <button
          onClick={() => history.back()}
          aria-label="Go back"
          className="p-2 rounded-full hover:bg-[#1A3A95] transition"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </header>

      <div className="w-full flex flex-col items-center mt-8 mb-6">
        <h1
          className="text-[clamp(1.5rem,3.5vw,2.4rem)]"
          style={{ fontFamily: 'Times New Roman', fontWeight: 400, opacity: 0.85, letterSpacing: '0.4px' }}
        >
          Favourite Artists
        </h1>
        <hr className="w-[90%] mt-4 border-t-[1.5px] border-black opacity-60" />
      </div>

      {favourites.length === 0 ? (
        <p className="text-center text-neutral-600 text-sm mb-24">No artists yet.</p>
      ) : (
        <div className="w-full px-4 sm:px-6 pb-24">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {favourites.map((fav) => {
              const artist = artists.find((a) => a.id === fav.artist_id);
              if (!artist) return null;
              const color = getArtistColor(artist.id);
              return (
                <Link
                  key={fav.artist_id}
                  href={`/artist/${fav.artist_id}`}
                  className="shadow-sm rounded-3xl overflow-hidden hover:bg-neutral-50 transition"
                >
                  <div className="w-full h-36 sm:h-40 flex items-center justify-center" style={{ backgroundColor: color }}>
                    {artist.image_url ? (
                      <img src={artist.image_url} alt={artist.name} className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover" />
                    ) : (
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/40" />
                    )}
                  </div>
                  <div className="p-3 sm:p-4 text-center">
                    <p className="text-sm sm:text-lg truncate" style={{ fontFamily: 'Times New Roman, serif', fontWeight: 400, opacity: 0.9 }}>
                      {artist.name}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 font-light truncate">
                      {artist.place}
                    </p>
                    <div className="mt-2 sm:mt-3 mb-1">
                      <span className="inline-flex items-center justify-center h-8 sm:h-9 px-3 sm:px-4 rounded-full text-xs sm:text-sm text-white font-light bg-[#1F48AF]">
                        Since {fav.since_year}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}

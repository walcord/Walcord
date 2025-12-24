'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/router';

/* ===============================
   Tipos (igual base)
   =============================== */
type Artist = {
  id: string;
  name: string;
  image_url?: string | null;
  place?: string | null; // NO se renderiza en viewer
  start_year?: number | null;
};

type FavRow = {
  artist_id: string;
  since_year?: number | null; // NO se renderiza en viewer
};

/* ===============================
   Utilidades (idénticas al original)
   - Paleta determinista (sin guardar en BD).
   =============================== */
const PALETTE = [
  '#1F48AF',
  '#0F254E',
  '#1B2A41',
  '#2E4057',
  '#14213D',
  '#2F3E46',
  '#0B4F6C',
  '#1D3557',
  '#2C3E50',
  '#112D32',
  '#4C4C47',
  '#3D2C2E',
  '#6B2E2E',
];

function hashName(name: string) {
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = (h * 33) ^ name.charCodeAt(i);
  return Math.abs(h);
}
function colorFor(name: string) {
  const idx = hashName(name) % PALETTE.length;
  return PALETTE[idx];
}

type Props = { viewerId?: string };

export default function FavouriteArtistsViewer({ viewerId }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [resolvedUserId, setResolvedUserId] = useState<string | null>(viewerId ?? null);
  const [resolvedUsername, setResolvedUsername] = useState<string | null>(null);

  const [artists, setArtists] = useState<Artist[]>([]);
  const [favourites, setFavourites] = useState<FavRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  /* ===============================
     Resolver username -> user_id (viewer)
     =============================== */
  useEffect(() => {
    if (viewerId) return;

    const username = searchParams?.get('username') || searchParams?.get('handle');
    if (!username) return;

    (async () => {
      setLoading(true);
      setNotFound(false);

      const { data, error } = await supabase
        .from('profiles')
        .select('id,username')
        .eq('username', username)
        .maybeSingle();

      if (error || !data?.id) {
        setNotFound(true);
        setResolvedUserId(null);
        setResolvedUsername(null);
        setLoading(false);
        return;
      }

      setResolvedUserId(data.id);
      setResolvedUsername(data.username ?? username);
    })();
  }, [viewerId, searchParams]);

  /* ===============================
     Cargar favoritos + artistas
     =============================== */
  useEffect(() => {
    if (!resolvedUserId) {
      if (!notFound) setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);

      const { data: favs } = await supabase
        .from('favourite_artists')
        .select('artist_id, since_year')
        .eq('user_id', resolvedUserId);

      const favRows = ((favs as FavRow[]) || []).filter((f) => !!f.artist_id);
      const ids = Array.from(new Set(favRows.map((f) => f.artist_id)));

      let arts: Artist[] = [];
      if (ids.length > 0) {
        const { data } = await supabase
          .from('artists')
          .select('id,name,image_url,place,start_year')
          .in('id', ids);

        arts = (data as Artist[]) || [];
      }

      setFavourites(favRows);
      setArtists(arts);
      setLoading(false);
    })();
  }, [resolvedUserId, notFound]);

  const artistsById = useMemo(() => {
    const map = new Map<string, Artist>();
    for (const a of artists) map.set(a.id, a);
    return map;
  }, [artists]);

  const favouriteArtists = useMemo(() => {
    return favourites
      .map((f) => artistsById.get(f.artist_id))
      .filter(Boolean) as Artist[];
  }, [favourites, artistsById]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-black font-[Roboto]">
        {/* TOP — back button (app safe-area friendly) */}
        <div
          className="w-full px-5 sm:px-12 pb-4 flex items-center justify-between"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.75rem)' }}
        >
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            title="Back"
            className="flex items-center gap-2 text-[#264AAE] font-light text-[0.95rem] py-1"
          >
            <span className="text-[1.35rem] leading-none -mt-[1px]">‹</span>
            <span>Back</span>
          </button>
          <div className="w-[60px]" />
        </div>

        {/* Header (igual que el original, sin acciones) */}
        <div className="w-full px-5 sm:px-6 pt-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col">
              <div
                className="text-[11px] tracking-[0.28em] uppercase text-black/50"
                style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
              >
                Collection
              </div>

              <h1
                className="mt-2 text-[clamp(2.05rem,7.0vw,3.15rem)] leading-[0.95]"
                style={{
                  fontFamily: 'Times New Roman, serif',
                  fontWeight: 400,
                  letterSpacing: '-0.25px',
                  opacity: 0.92,
                }}
              >
                Favourite Artists
              </h1>

              <div className="mt-4 h-[1px] w-24 bg-black/55" />
              <p className="text-sm text-neutral-600 mt-6">Loading…</p>
            </div>

            <div className="mt-2 w-[86px]" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black font-[Roboto]">
      {/* TOP — back button (app safe-area friendly) */}
      <div
        className="w-full px-5 sm:px-12 pb-4 flex items-center justify-between"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.75rem)' }}
      >
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          title="Back"
          className="flex items-center gap-2 text-[#264AAE] font-light text-[0.95rem] py-1"
        >
          <span className="text-[1.35rem] leading-none -mt-[1px]">‹</span>
          <span>Back</span>
        </button>
        <div className="w-[60px]" />
      </div>

      {/* Header (calcado al original, sin acciones) */}
      <div className="w-full px-5 sm:px-6 pt-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col">
            <div
              className="text-[11px] tracking-[0.28em] uppercase text-black/50"
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
            >
              Collection
            </div>

            <h1
              className="mt-2 text-[clamp(2.05rem,7.0vw,3.15rem)] leading-[0.95]"
              style={{
                fontFamily: 'Times New Roman, serif',
                fontWeight: 400,
                letterSpacing: '-0.25px',
                opacity: 0.92,
              }}
            >
              Favourite Artists
            </h1>

            <div className="mt-4 h-[1px] w-24 bg-black/55" />

            {resolvedUsername && (
              <p className="text-sm text-neutral-600 mt-4">Viewing @{resolvedUsername}</p>
            )}
          </div>

          {/* Sin Edit / sin + */}
          <div className="mt-2 w-[86px]" />
        </div>
      </div>

      {/* Content */}
      {notFound ? (
        <p
          className="text-center text-[16px] text-black/80 mt-16"
          style={{ fontFamily: 'Times New Roman, Times, serif' }}
        >
          User not found.
        </p>
      ) : favouriteArtists.length > 0 ? (
        <div className="w-full px-5 sm:px-6 mt-10 pb-36">
          <div className="text-[11px] uppercase tracking-[0.22em] text-black/45">
            Favourites · {favouriteArtists.length}
          </div>

          {/* Grid idéntica */}
          <div className="mt-7 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-7 gap-y-10">
            {favouriteArtists.map((artist) => {
              const hasImg = !!artist.image_url;
              const color = colorFor(artist.name || '');

              return (
                <div key={artist.id} className="flex flex-col items-center text-center">
                  <Link href={`/artist/${artist.id}`} className="relative">
                    <div
                      className="w-[118px] h-[118px] sm:w-[132px] sm:h-[132px] rounded-full cursor-pointer transition-transform duration-200 hover:scale-[1.02] shadow-[0_12px_26px_rgba(0,0,0,0.10)]"
                      style={{
                        backgroundColor: hasImg ? '#F4F5F7' : color,
                        overflow: 'hidden',
                        border: hasImg ? '2px solid' : 'none',
                        borderColor: hasImg ? color : undefined,
                      }}
                      aria-label={`Open ${artist.name}`}
                      title={artist.name}
                    >
                      {hasImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={artist.image_url as string}
                          alt={artist.name}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>
                  </Link>

                  <p
                    className="mt-4 text-[16px] leading-tight line-clamp-2"
                    style={{ fontFamily: 'Times New Roman, serif', opacity: 0.92 }}
                  >
                    {artist.name}
                  </p>

                  {/* ❌ SIN place */}
                  {/* ❌ SIN since */}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-center text-neutral-500 mt-16">No artists yet.</p>
      )}
    </main>
  );
}

'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

type Genre = {
  id: string;
  slug: string;
  description: string | null;
  artists?: { name: string }[] | null;
  records?: { name: string }[] | null;
};

export default function PublicFavouriteGenresPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const username = searchParams.get('username') || '';

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [genres, setGenres] = useState<Genre[]>([]);

  // 1) username -> user_id
  useEffect(() => {
    const run = async () => {
      if (!username) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();

      if (error || !data?.id) {
        // si no existe el usuario, vuelve al feed
        router.replace('/feed');
        return;
      }
      setViewerId(data.id);
    };
    run();
  }, [username, router]);

  // 2) cargar favourite_genres del viewer + detalles en `genres`
  useEffect(() => {
    const load = async () => {
      if (!viewerId) return;
      setLoading(true);

      // ids de géneros favoritos del viewer
      const { data: favs } = await supabase
        .from('favourite_genres')
        .select('genre_id')
        .eq('user_id', viewerId);

      const ids: string[] = Array.from(
        new Set((favs || []).map((f: any) => f.genre_id))
      );

      if (ids.length === 0) {
        setGenres([]);
        setLoading(false);
        return;
      }

      // detalle de géneros
      const { data: gen } = await supabase
        .from('genres')
        .select('id, slug, description, artists, records')
        .in('id', ids);

      setGenres((gen as Genre[]) || []);
      setLoading(false);
    };

    load();
  }, [viewerId]);

  const selectedLabels = useMemo(() => {
    if (genres.length === 0) return '';
    return genres
      .map((g) => g.slug.charAt(0).toUpperCase() + g.slug.slice(1))
      .join(' and ');
  }, [genres]);

  return (
    <div className="bg-white min-h-screen text-black font-sans">
      {/* Banner */}
      <div className="w-full h-[100px] sm:h-[80px] bg-[#1F48AF] flex items-center justify-start px-4 sm:px-12">
        <Image src="/logotipo.png" alt="Walcord Logo" width={62} height={62} />
      </div>

      {/* Título */}
      <div className="max-w-6xl mx-auto px-6 pt-10">
        <h1
          className="text-4xl font-light text-center tracking-tight mb-4"
          style={{ fontFamily: 'Times New Roman, serif' }}
        >
          {selectedLabels || 'Genres'}
        </h1>
        <hr className="border-black w-full mb-8" />
      </div>

      {/* Estado de carga / vacío */}
      <div className="max-w-6xl mx-auto px-6 pb-24">
        {loading ? (
          <p className="text-sm text-neutral-600">Loading…</p>
        ) : genres.length === 0 ? (
          <p className="text-sm text-neutral-600">No favourite genres yet.</p>
        ) : (
          genres.map((genre) => (
            <div key={genre.id} className="mb-20">
              <h2
                className="text-3xl font-normal mb-3 capitalize"
                style={{ fontFamily: 'Times New Roman, serif' }}
              >
                {genre.slug}
              </h2>

              {genre.description ? (
                <p
                  className="text-[17px] leading-relaxed text-neutral-800 mb-8"
                  style={{ fontFamily: 'Times New Roman, serif' }}
                >
                  {genre.description}
                </p>
              ) : null}

              {/* Artistas definidos del género (si existen en la fila) */}
              {genre.artists && genre.artists.length > 0 ? (
                <div className="mb-10">
                  <p
                    className="text-lg font-light mb-4"
                    style={{ fontFamily: 'Roboto, sans-serif' }}
                  >
                    Defining Artists
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {genre.artists.map((a, i) => (
                      <div
                        key={`${genre.id}-a-${i}`}
                        className="text-sm font-light"
                      >
                        {a.name}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Discos definidos del género (si existen en la fila) */}
              {genre.records && genre.records.length > 0 ? (
                <div>
                  <p
                    className="text-lg font-light mb-4"
                    style={{ fontFamily: 'Roboto, sans-serif' }}
                  >
                    Defining Records
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {genre.records.map((r, i) => (
                      <div
                        key={`${genre.id}-r-${i}`}
                        className="text-sm font-light"
                      >
                        {r.name}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

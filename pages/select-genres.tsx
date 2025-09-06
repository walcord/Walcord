"use client";

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Image from 'next/image';
import { useUser } from '@supabase/auth-helpers-react';
import { useSearchParams } from 'next/navigation';

export default function GenresPage() {
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
      setTargetId(me?.id ?? null);
    };
    init();
  }, [qs, me?.id]);

  const [genres, setGenres] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  // ======== PALETA WALCORD + COLOR DETERMINÍSTICO =========
  const WALCORD_COLORS = useMemo(
    () => [
      '#1F48AF', '#0F2A6B', '#112B3C', '#2B3A67', '#3B4A99', '#264653',
      '#2A9D8F', '#4B5563', '#111827', '#0B132B', '#1D3557', '#4C566A'
    ],
    []
  );

  const hashString = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  };

  const colorFor = (key: string | number | null | undefined) => {
    const base = (key ?? '').toString();
    if (!base) return WALCORD_COLORS[0];
    const idx = hashString(base) % WALCORD_COLORS.length;
    return WALCORD_COLORS[idx];
  };
  // =========================================================

  // Obtener géneros y favoritos del perfil objetivo
  useEffect(() => {
    const fetchData = async () => {
      const { data: allGenres } = await supabase.from('genres').select('*');
      setGenres(allGenres || []);

      if (targetId) {
        const { data: favGenres } = await supabase.from('favourite_genres').select('genre_id').eq('user_id', targetId);
        const genreIds = (favGenres || []).map((g) => g.genre_id);
        setSelected(genreIds);
      } else {
        setSelected([]);
      }
    };
    fetchData();
  }, [targetId]);

  const filteredGenres = useMemo(
    () => genres.filter((genre) => genre.slug.toLowerCase().includes(search.toLowerCase())),
    [genres, search]
  );

  const toggleSelect = async (id: string) => {
    if (readonly || !me?.id) return;
    const isSelected = selected.includes(id);

    if (isSelected) {
      await supabase.from('favourite_genres').delete().eq('user_id', me.id).eq('genre_id', id);
      setSelected((prev) => prev.filter((g) => g !== id));
    } else {
      if (selected.length >= 2) return;
      await supabase.from('favourite_genres').insert({ user_id: me.id, genre_id: id });
      setSelected((prev) => [...prev, id]);
      setTargetId(me.id);
    }
  };

  const selectedGenres = genres.filter((g) => selected.includes(g.id));
  const selectedLabels = selectedGenres.map((g) => g.slug.charAt(0).toUpperCase() + g.slug.slice(1)).join(' and ');

  return (
    <div className="bg-white min-h-screen text-black font-sans">
      {/* Banner azul con flecha minimalista pegada abajo */}
      <header className="w-full h-24 bg-[#1F48AF] flex items-end px-4 sm:px-12 pb-2">
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

      {/* Título */}
      <div className="max-w-6xl mx-auto px-6 pt-10">
        <h1 className="text-4xl font-light text-center tracking-tight mb-1" style={{ fontFamily: 'Times New Roman, serif' }}>
          {selectedLabels || 'Genres'}
        </h1>
        {readonly && targetUsername && (
          <p className="text-center text-sm text-neutral-600 -mt-1 mb-2">Viewing @{targetUsername}</p>
        )}
        <hr className="border-black w-full mb-8" />
      </div>

      {/* Buscador (solo si es tu perfil) */}
      {!readonly && (
        <div className="max-w-4xl mx-auto px-6 mb-6">
          <input
            type="text"
            placeholder="Search genres..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 border border-neutral-300 rounded-md focus:outline-none focus:border-black text-base"
          />
        </div>
      )}

      {/* Géneros seleccionados */}
      {selectedGenres.length > 0 && !readonly && (
        <div className="max-w-4xl mx-auto px-6 mb-8 flex flex-wrap gap-4">
          {selectedGenres.map((genre) => (
            <button
              key={genre.id}
              onClick={() => toggleSelect(genre.id)}
              className="px-4 py-2 rounded-full border border-[#1F48AF] bg-[#1F48AF] text-white text-sm font-light"
            >
              {genre.slug.charAt(0).toUpperCase() + genre.slug.slice(1)} ✕
            </button>
          ))}
        </div>
      )}

      {/* Selector */}
      {!readonly && selected.length < 2 && (
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mb-12">
          {filteredGenres.map((genre) => (
            <button
              key={genre.id}
              onClick={() => toggleSelect(genre.id)}
              className={`text-base border px-5 py-3 rounded-full transition text-center font-light tracking-tight whitespace-nowrap shadow-sm hover:shadow-md duration-200 ${
                selected.includes(genre.id)
                  ? 'bg-[#1F48AF] text-white border-[#1F48AF]'
                  : 'bg-white text-black border-neutral-300 hover:border-black'
              }`}
              style={{ fontFamily: 'Inter, -apple-system, sans-serif' }}
            >
              {genre.slug.charAt(0).toUpperCase() + genre.slug.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Descripción de los géneros seleccionados */}
      <div className="max-w-6xl mx-auto px-6 pb-24">
        {selectedGenres.map((genre) => (
          <div key={genre.id} className="mb-20">
            <h2 className="text-3xl font-normal mb-3 capitalize" style={{ fontFamily: 'Times New Roman, serif' }}>
              {genre.slug}
            </h2>
            <p className="text-[17px] leading-relaxed text-neutral-800 mb-8" style={{ fontFamily: 'Times New Roman, serif' }}>
              {genre.description}
            </p>

            {genre.artists?.length > 0 && (
              <div className="mb-10">
                <p className="text-lg font-light mb-4" style={{ fontFamily: 'Roboto, sans-serif' }}>
                  Defining Artists
                </p>
                <div className="grid grid-cols-5 gap-6">
                  {genre.artists.map((artist: any, i: number) => (
                    <div key={i} className="flex flex-col items-center text-center">
                      <div
                        className="w-14 h-14 rounded-full"
                        style={{ backgroundColor: colorFor(artist?.id ?? artist?.name ?? `${genre.id}-artist-${i}`) }}
                      />
                      <span className="text-sm mt-2 font-light">{artist.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {genre.records?.length > 0 && (
              <div>
                <p className="text-lg font-light mb-4" style={{ fontFamily: 'Roboto, sans-serif' }}>
                  Defining Records
                </p>
                <div className="grid grid-cols-5 gap-6">
                  {genre.records.map((record: any, i: number) => (
                    <div key={i} className="flex flex-col items-center text-center">
                      <div
                        className="w-14 h-14 rounded-sm"
                        style={{ backgroundColor: colorFor(record?.id ?? record?.name ?? `${genre.id}-record-${i}`) }}
                      />
                      <span className="text-sm mt-2 font-light text-center">{record.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {selectedGenres.length === 0 && <p className="text-center text-neutral-500">No genres yet.</p>}
      </div>
    </div>
  );
}

'use client';

import Image from 'next/image';
import { useState, useMemo } from 'react';
import NowTouringRibbon from '../../components/wall/NowTouringRibbon';
import ConcertFeed from '../../components/wall/ConcertFeed';
import ConcertTourSearch from '../../components/wall/ConcertTourSearch';

type FeedMode = 'followed' | 'friends' | 'for-you';

export default function ConcertsPage() {
  // --- Estado de pestañas (igual que en The Wall): Followed · Friends · For You
  const [mode, setMode] = useState<FeedMode>('followed');

  // --- Filtro por tour seleccionado desde el buscador (artist + tour)
  const [tourFilter, setTourFilter] = useState<{
    artist_name: string;
    tour: string;
  } | null>(null);

  // Texto de contexto cuando hay un tour seleccionado
  const subtitle = useMemo(() => {
    if (!tourFilter) return null;
    return `${tourFilter.artist_name} · ${tourFilter.tour}`;
  }, [tourFilter]);

  return (
    <main className="min-h-screen bg-white text-black">
      {/* Banner exacto como The Wall pero sin logo y con flecha abajo */}
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

      {/* Ribbon */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-6">
        <NowTouringRibbon />
      </section>

      {/* Pestañas: Followed · Friends · For You (misma línea visual que Wall) */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-6">
        <div className="flex gap-2 sm:gap-3">
          {(['followed', 'friends', 'for-you'] as FeedMode[]).map((m) => {
            const active = mode === m && !tourFilter; // si hay tourFilter, las tabs quedan visualmente pero sin "active"
            const label =
              m === 'followed' ? 'Followed' : m === 'friends' ? 'Friends' : 'For You';
            return (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  // no limpiamos el filtro aquí para permitir cambiar de pestaña sin perder búsqueda
                }}
                className={[
                  'px-4 py-2 rounded-full border text-sm transition',
                  active
                    ? 'bg-[#1F48AF] text-white border-[#1F48AF]'
                    : 'bg-white text-black border-black/10 hover:border-black/20',
                ].join(' ')}
                aria-pressed={active}
              >
                {label}
              </button>
            );
          })}
          {/* Botón claro para limpiar un tour seleccionado */}
          {tourFilter && (
            <button
              onClick={() => setTourFilter(null)}
              className="ml-auto text-xs underline text-neutral-600 hover:text-black"
              aria-label="Clear tour filter"
            >
              Clear tour filter
            </button>
          )}
        </div>
      </section>

      {/* Buscador de artista→tours (bajo el touring ribbon) */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-4">
        <ConcertTourSearch
          onSelectTour={(artist_name, tour) => setTourFilter({ artist_name, tour })}
        />
      </section>

      {/* Encabezado contextual cuando hay filtro de tour */}
      {tourFilter && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-4">
          <div className="text-[13px] sm:text-sm text-neutral-700">
            Showing posts from <span className="italic">{subtitle}</span>
          </div>
        </section>
      )}

      {/* Feed (cuando hay tourFilter, muestra cards más pequeñas) */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24 mt-6">
        <ConcertFeed
          mode={mode}
          tourFilter={tourFilter ?? undefined}
          smallCards={!!tourFilter}
        />
      </section>
    </main>
  );
}

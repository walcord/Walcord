'use client';

import { useRouter } from 'next/router';
import { useMemo } from 'react';
import TourFeed from '../../../components/wall/TourFeed';

export default function ExploreTourPage() {
  const router = useRouter();
  const { artist, tour } = router.query as { artist?: string; tour?: string };

  // Evita parpadeos hasta que router tenga query
  const ready = typeof artist === 'string' && typeof tour === 'string';

  return (
    <main className="min-h-screen bg-white text-black">
      {/* Header igual que concerts (flecha atrás) */}
      <header className="w-full h-24 bg-[#1F48AF] flex items-end px-4 sm:px-6 pb-2">
        <button
          onClick={() => history.back()}
          aria-label="Go back"
          className="p-2 rounded-full hover:bg-[#1A3A95] transition"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </header>

      {/* Encabezado contextual */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-6">
        {ready ? (
          <div className="text-[13px] sm:text-sm text-neutral-700">
            Showing posts from <span className="italic">{artist} · {tour}</span>
          </div>
        ) : (
          <div className="h-5" />
        )}
      </section>

      {/* Grid de posts (mini) */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24 mt-4">
        {ready && <TourFeed artist={artist!} tour={tour!} />}
      </section>
    </main>
  );
}

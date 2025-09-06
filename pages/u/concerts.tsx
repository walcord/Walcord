'use client';

import Image from 'next/image';
import NowTouringRibbon from '../../components/wall/NowTouringRibbon';
import ConcertFeed from '../../components/wall/ConcertFeed';

export default function ConcertsPage() {
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

      {/* Feed */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24 mt-8">
        <ConcertFeed />
      </section>
    </main>
  );
}

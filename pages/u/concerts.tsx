'use client';

import Image from 'next/image';
import NowTouringRibbon from '../../components/wall/NowTouringRibbon';
import ConcertFeed from '../../components/wall/ConcertFeed';

export default function ConcertsPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      {/* Banner exacto como The Wall: 80px + logo 56px */}
      <header className="w-full h-20 bg-[#1F48AF] flex items-center px-4 sm:px-6">
        <Image src="/logotipo.png" alt="Walcord" width={56} height={56} priority />
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

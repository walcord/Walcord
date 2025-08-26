"use client";

import Image from "next/image";
import NowTouringRibbon from "../../components/wall/NowTouringRibbon";
import ConcertFeed from "../../components/wall/ConcertFeed";

export default function ConcertsPage() {
  return (
    <main className="min-h-screen bg-white text-black font-sans">
      {/* Banner exacto como The Wall: 80px + logo 56px */}
      <div className="w-full h-20 bg-[#1F48AF] flex items-center justify-center">
        <Image src="/logotipo.png" alt="Walcord Logo" width={56} height={56} priority />
      </div>

      {/* Ribbon */}
      <section className="max-w-5xl mx-auto w-full px-4 sm:px-6 md:px-8 py-6">
        <NowTouringRibbon />
      </section>

      {/* Feed */}
      <section className="max-w-5xl mx-auto w-full px-4 sm:px-6 md:px-8 pb-24">
        <ConcertFeed />
      </section>
    </main>
  );
}

import React, { useState } from 'react';
import Header from '../components/editorial/Header';
import MenuDrawer from '../components/editorial/MenuDrawer';

export default function Feed() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">
      <Header onOpenMenu={() => setIsMenuOpen(true)} />
      <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="pt-32 md:pt-40 px-6 md:px-12 max-w-screen-2xl mx-auto flex flex-col items-center">
        <div className="flex flex-col items-center justify-center w-full h-[65vh] border-b border-gray-100">
          <span className="text-xs tracking-[0.4em] uppercase text-gray-400 mb-6 font-light">
            Coming Soon
          </span>
          <h2 className="text-5xl md:text-6xl font-serif font-normal text-center max-w-4xl leading-[1.15] text-gray-900 tracking-tight">
            The editorial journal of Classical Dance and Opera.
          </h2>
        </div>
      </main>
    </div>
  );
}
'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function Download() {
  return (
    <div className="min-h-screen bg-white text-black font-['Helvetica_Neue',_Helvetica,_Arial,_sans-serif] flex flex-col justify-between p-6 md:p-12">
      {/* Header minimalista */}
      <header className="flex justify-between items-center w-full max-w-5xl mx-auto shrink-0">
        <Link 
          href="/feed" 
          className="text-xl font-light hover:opacity-50 transition-opacity p-2 -ml-2 text-black"
          aria-label="Close"
        >
          ✕
        </Link>
        <div className="w-6" />
      </header>

      {/* Contenido Central: Desplazado hacia arriba con pt-8 y mb-auto */}
      <main className="flex flex-col items-center text-center max-w-md mx-auto px-4 pt-8 md:pt-16 mb-auto space-y-6">
        {/* Logo de Walcord */}
        <div className="w-32 md:w-40 flex items-center justify-center">
          <Image
            src="https://mbrdycxpztjtgsiyxikt.supabase.co/storage/v1/object/public/Assets/logo-walcord.png?v=2"
            alt="Walcord Logo"
            width={160}
            height={55}
            className="w-full h-auto object-contain"
            priority
          />
        </div>

        {/* Eslogan Editorial */}
        <h1 className="font-['Times_New_Roman',_serif] text-2xl md:text-4xl text-black leading-snug font-normal tracking-tight">
          The ballet and opera journal.
        </h1>

        {/* Botón App Store */}
        <div className="pt-2">
          <a
            href="https://apps.apple.com/es/app/walcord/id6751656616"
            target="_blank"
            rel="noopener noreferrer"
            className="
              inline-block
              px-7 py-3.5
              bg-black text-white
              text-[10px] tracking-[0.2em] uppercase font-medium
              hover:bg-gray-800
              transition-all duration-300
              shadow-sm
            "
          >
            Download on the App Store
          </a>
        </div>
      </main>

      {/* Footer discreto */}
      <footer className="text-center text-[9px] tracking-[0.2em] uppercase text-gray-400 shrink-0 pb-2">
        © {new Date().getFullYear()} WALCORD
      </footer>
    </div>
  );
}
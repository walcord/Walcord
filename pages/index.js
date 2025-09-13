'use client';

import { useRouter } from 'next/router';
import Image from 'next/image';

export default function Home() {
  const router = useRouter();

  return (
    <div
      className="relative flex flex-col items-center justify-center min-h-screen text-white text-center px-4"
      style={{ backgroundColor: '#1F48AF' }}
    >
      {/* Logo */}
      <Image
        src="/logotipo.png"
        alt="Walcord Logo"
        width={80}
        height={80}
        className="absolute"
        style={{ top: 49, left: '50%', transform: 'translateX(-50%)' }}
        priority
      />

      {/* Título */}
      <h1
        className="text-4xl md:text-6xl mb-8 font-normal"
        style={{ fontFamily: 'Times New Roman, serif' }}
      >
        Welcome to <span className="font-normal">Walcord</span>
      </h1>

      {/* Botones principales */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => router.push('/signup')}
          className="px-5 py-2.5 rounded-full text-sm font-light bg-white text-[#1F48AF] hover:bg-white/90 active:scale-95 transition"
          style={{ fontFamily: 'Roboto, sans-serif' }}
        >
          Create account
        </button>
        <button
          onClick={() => router.push('/login')}
          className="px-5 py-2.5 rounded-full text-sm font-light border border-white/60 text-white hover:bg-white/10 active:scale-95 transition"
          style={{ fontFamily: 'Roboto, sans-serif' }}
        >
          Log in
        </button>
      </div>

      {/* Acceso mínimo a preview */}
      <button
        onClick={() => router.push('/showcase')}
        className="text-xs underline underline-offset-4 opacity-80 hover:opacity-100 transition"
        style={{ fontFamily: 'Roboto, sans-serif' }}
      >
        Preview
      </button>
    </div>
  );
}

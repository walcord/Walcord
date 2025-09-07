'use client';

import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  return (
    <div
      className="relative flex flex-col items-center justify-center min-h-screen text-white text-center px-4"
      style={{ backgroundColor: '#1F48AF' }}
    >
      {/* Logo */}
      <img
        src="/logotipo.png"
        alt="Walcord Logo"
        className="w-20 h-20 absolute"
        style={{ top: 49, left: '50%', transform: 'translateX(-50%)' }}
      />

      {/* Título */}
      <h1
        className="text-4xl md:text-6xl mb-4 font-normal"
        style={{ fontFamily: 'Times New Roman, serif' }}
      >
        Welcome to <span className="font-normal">Walcord</span>
      </h1>

      {/* Subtítulo */}
      <p
        className="text-lg md:text-xl mb-8 text-white/90"
        style={{ fontFamily: 'Times New Roman' }}
      >
        Music defines us, we define music.
      </p>

      {/* Botones */}
      <div className="flex gap-4">
        <button
          onClick={() => router.push('/signup')}
          className="bg-white px-5 py-2 rounded-md text-sm font-light hover:bg-white/90 active:scale-95 transition-all duration-300"
          style={{ color: '#1F48AF', fontFamily: 'Roboto, sans-serif' }}
        >
          Come Together
        </button>
        <button
          onClick={() => router.push('/login')}
          className="bg-white px-5 py-2 rounded-md text-sm font-light hover:bg-white/90 active:scale-95 transition-all duration-300"
          style={{ color: '#1F48AF', fontFamily: 'Roboto, sans-serif' }}
        >
          Hello, it’s me
        </button>
      </div>
    </div>
  );
}

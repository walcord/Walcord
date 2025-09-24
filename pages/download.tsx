'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';

export default function Download() {
  const router = useRouter();

  return (
    <div
      className="relative flex flex-col items-center justify-center min-h-screen text-white text-center px-4"
      style={{ backgroundColor: '#1F48AF' }}
    >
      <Image
        src="/logotipo.png"
        alt="Walcord Logo"
        width={80}
        height={80}
        className="absolute"
        style={{ top: 49, left: '50%', transform: 'translateX(-50%)' }}
        priority
      />

      <h1
        className="text-4xl md:text-6xl mb-8 font-normal"
        style={{ fontFamily: 'Times New Roman, serif' }}
      >
        Walcord
      </h1>

      <div className="flex items-center gap-3 mb-4">
        <a
          href="https://apps.apple.com/es/app/walcord/id6751656616"
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-2.5 rounded-full text-sm font-light bg-white text-[#1F48AF] hover:bg-white/90 active:scale-95 transition"
          style={{ fontFamily: 'Roboto, sans-serif' }}
        >
          Download on the App Store
        </a>
      </div>
    </div>
  );
}

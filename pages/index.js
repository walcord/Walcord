'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { supabase } from '../lib/supabaseClient';

export default function Home() {
  const router = useRouter();

  // Si ya hay sesión → ir directo al feed
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data?.session) router.replace('/feed');
    });
    return () => { mounted = false; };
  }, [router]);

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
        Welcome to <span className="font-normal">Walcord</span>
      </h1>

      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => router.push('/login')}
          className="px-5 py-2.5 rounded-full text-sm font-light bg-white text-[#1F48AF] hover:bg-white/90 active:scale-95 transition"
          style={{ fontFamily: 'Roboto, sans-serif' }}
        >
          Enter
        </button>
      </div>
    </div>
  );
}

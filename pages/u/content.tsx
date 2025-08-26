'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

export default function ContentPage() {
  const [dots, setDots] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  // 1) Loading elegante
  useEffect(() => {
    const t = setInterval(() => setDots((p) => (p.length >= 3 ? '' : p + '.')), 650);
    return () => clearInterval(t);
  }, []);

  // 2) TOMO EL AZUL DEL LOGO Y PINTO TODA LA PÁGINA IGUAL
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous'; // mismo dominio → OK
    img.src = '/logotipo.png';
    img.onload = () => {
      try {
        const can = document.createElement('canvas');
        const ctx = can.getContext('2d');
        if (!ctx) return;
        can.width = img.naturalWidth;
        can.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        // Muestreo en la esquina superior izquierda (zona azul del logo)
        const sample = ctx.getImageData(10, 10, 1, 1).data; // [r,g,b,a]
        const [r, g, b, a] = sample;
        if (a > 0) {
          const hex = `#${[r, g, b]
            .map((v) => v.toString(16).padStart(2, '0'))
            .join('')}`.toUpperCase();
          // Aplico el color a toda la vista
          if (rootRef.current) rootRef.current.style.backgroundColor = hex;
          document.documentElement.style.setProperty('--walcord-blue', hex);
        }
      } catch {
        // Fallback al azul oficial si canvas no puede leer
        if (rootRef.current) rootRef.current.style.backgroundColor = '#1F48AF';
        document.documentElement.style.setProperty('--walcord-blue', '#1F48AF');
      }
    };
    img.onerror = () => {
      if (rootRef.current) rootRef.current.style.backgroundColor = '#1F48AF';
      document.documentElement.style.setProperty('--walcord-blue', '#1F48AF');
    };
  }, []);

  const sections = [
    { title: 'Interviews', subtitle: 'Intimate conversations with artists' },
    { title: 'Tour Films', subtitle: 'Cinematic journeys on the road' },
    { title: 'Performances', subtitle: 'Exclusive stages' },
    { title: 'Documentaries', subtitle: 'Stories behind the music' },
    { title: 'Entertainment', subtitle: 'Beyond the music' },
  ];

  return (
    <main
      ref={rootRef}
      className="min-h-screen text-white relative"
      style={{ backgroundColor: 'var(--walcord-blue, #1F48AF)' }}
    >
      {/* HEADER — logo y tagline */}
      <header className="w-full flex flex-col items-center text-center pt-14 pb-10">
        {/* SIN SOMBRAS NI GLOW: el logo se funde con el fondo */}
        <Image src="/logotipo.png" alt="Walcord" width={84} height={84} priority />
        <h1
          className="mt-6 text-xl sm:text-2xl font-light"
          style={{ fontFamily: 'Roboto, ui-sans-serif, system-ui' }}
        >
          Your True Music Platform
        </h1>
        <p
          className="mt-1 text-sm opacity-80 font-light"
          style={{ fontFamily: 'Roboto, ui-sans-serif, system-ui' }}
        >
          Loading{dots}
        </p>
      </header>

      {/* SECCIONES — sliders a ANCHO COMPLETO */}
      <div className="pb-20 space-y-16">
        {sections.map((section) => (
          <section key={section.title} className="space-y-5">
            {/* Títulos con aire lateral (no pegados a la izquierda) */}
            <div className="pl-10 sm:pl-16">
              <h2
                className="text-lg sm:text-xl"
                style={{ fontFamily: '"Times New Roman", Times, serif' }}
              >
                {section.title}
              </h2>
              <p
                className="text-xs sm:text-sm opacity-70"
                style={{ fontFamily: 'Roboto, ui-sans-serif, system-ui' }}
              >
                {section.subtitle}
              </p>
            </div>

            {/* Carrusel full-bleed */}
            <div className="flex space-x-5 overflow-x-auto no-scrollbar px-4 sm:px-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-[260px] sm:w-[320px] h-[150px] sm:h-[190px] rounded-xl relative overflow-hidden"
                >
                  {/* Placeholder tipo poster */}
                  <div className="w-full h-full bg-white/10 animate-pulse" />
                  <div className="absolute bottom-3 left-3">
                    <div className="h-3 w-24 bg-white/20 mb-2 rounded" />
                    <div className="h-2 w-16 bg-white/15 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* utilidades */}
      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </main>
  );
}

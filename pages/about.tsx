import React, { useState } from 'react';
import Head from 'next/head';
import Header from '../components/editorial/Header';
import MenuDrawer from '../components/editorial/MenuDrawer';
import { useLanguage } from '../context/LanguageContext';

export default function About() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { t } = useLanguage();

  const adrianImg = "https://mbrdycxpztjtgsiyxikt.supabase.co/storage/v1/object/public/Assets/ADRIAN-GERMONT-Walcord-Sep-03.jpg";
  const antoineImg = "https://mbrdycxpztjtgsiyxikt.supabase.co/storage/v1/object/public/Assets/ANTOINE-GAMARD-Walcord-Sep-091.JPG";

  return (
    <div className="min-h-[100dvh] bg-white text-black font-sans selection:bg-black selection:text-white">
      <Head>
        <title>{t('about')} — WALCORD</title>
      </Head>

      <Header onOpenMenu={() => setIsMenuOpen(true)} />
      <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="pt-24 pb-32 px-6 md:px-16 max-w-7xl mx-auto">
        {/* Cabecera de la página */}
        <section className="mb-20 md:mb-32 text-center md:text-left">
          <span className="block text-[10px] tracking-[0.25em] uppercase text-gray-400 mb-4 font-light">
            Walcord
          </span>
          <h1 className="text-4xl md:text-6xl font-serif font-light tracking-tight text-gray-900 uppercase">
            {t('about')}
          </h1>
          
          {/* Manifiesto / Descripción general */}
          {t('about_manifesto') && (
            <p className="mt-8 text-lg md:text-2xl font-serif text-gray-700 max-w-3xl leading-relaxed whitespace-pre-wrap">
              {t('about_manifesto')}
            </p>
          )}
        </section>

        {/* Rejilla del equipo editorial */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-20 md:gap-24 items-start">
          
          {/* Tarjeta: Adrian Germont */}
          <div className="flex flex-col">
            <div className="relative flex items-start justify-center">
              <div className="relative w-full max-w-[380px] aspect-[4/5] bg-gray-50 overflow-hidden">
                <img
                  src={adrianImg}
                  alt="Adrian Germont"
                  className="w-full h-full object-cover grayscale contrast-105"
                />
              </div>
              
              {/* Nombre con rotación vertical */}
              <div 
                className="pl-3 self-stretch flex items-center text-[11px] font-mono tracking-[0.2em] text-gray-500 uppercase select-none"
                style={{ writingMode: 'vertical-rl' }}
              >
                Adrian Germont
              </div>
            </div>

            <div className="mt-6 max-w-[380px]">
              <span className="block text-[10px] tracking-[0.2em] uppercase text-gray-400 font-light mb-2">
                {t('adrian_role')}
              </span>
              
              {/* Descripción de Adrian */}
              <p className="text-xs md:text-sm font-serif text-gray-800 leading-relaxed whitespace-pre-wrap">
                {t('adrian_bio')}
              </p>
            </div>
          </div>

          {/* Tarjeta: Antoine Gamard */}
          <div className="flex flex-col">
            <div className="relative flex items-start justify-center">
              <div className="relative w-full max-w-[380px] aspect-[4/5] bg-gray-50 overflow-hidden">
                <img
                  src={antoineImg}
                  alt="Antoine Gamard"
                  className="w-full h-full object-cover grayscale contrast-105"
                />
              </div>
              
              {/* Nombre con rotación vertical */}
              <div 
                className="pl-3 self-stretch flex items-center text-[11px] font-mono tracking-[0.2em] text-gray-500 uppercase select-none"
                style={{ writingMode: 'vertical-rl' }}
              >
                Antoine Gamard B.
              </div>
            </div>

            <div className="mt-6 max-w-[380px]">
              <span className="block text-[10px] tracking-[0.2em] uppercase text-gray-400 font-light mb-2">
                {t('antoine_role')}
              </span>
              
              {/* Descripción de Antoine */}
              <p className="text-xs md:text-sm font-serif text-gray-800 leading-relaxed whitespace-pre-wrap">
                {t('antoine_bio')}
              </p>
            </div>
          </div>

        </section>
      </main>
    </div>
  );
}
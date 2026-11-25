import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Header from '../components/editorial/Header';
import MenuDrawer from '../components/editorial/MenuDrawer';
import FilmCard from '../components/editorial/FilmCard';
import { supabase } from '../lib/supabaseClient';
import { useLanguage } from '../context/LanguageContext';

export default function Films() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [films, setFilms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const fetchFilms = async () => {
      const { data, error } = await supabase
        .from('films')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setFilms(data);
      } else if (error) {
        console.error('Error fetching films:', error);
      }
      setLoading(false);
    };

    fetchFilms();
  }, []);

  return (
    <div className="min-h-[100dvh] bg-white text-black font-sans selection:bg-black selection:text-white">
      <Head>
        <title>Films — WALCORD</title>
        <meta
          name="description"
          content="Original dance films produced by WALCORD. Yemaya, The Last Piece of Nureyev, Traviato and more."
        />
      </Head>

      <Header onOpenMenu={() => setIsMenuOpen(true)} />
      <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="pt-28 md:pt-40 px-6 sm:px-10 md:px-12 max-w-[1600px] mx-auto pb-32">
        {/* Cabecera de sección limpia, idéntica al resto de Walcord */}
        <div className="flex flex-col items-center mb-16 md:mb-24">
          <h1 className="text-xs tracking-[0.4em] uppercase text-gray-900 font-light mb-4">
            {t('films')}
          </h1>
          <div className="w-[1px] h-12 bg-gray-300"></div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-[50vh]">
            <span className="text-[10px] tracking-[0.2em] uppercase text-gray-400 animate-pulse">
              {t('loading')}
            </span>
          </div>
        ) : films.length === 0 ? (
          <div className="flex justify-center items-center h-[40vh]">
            <span className="text-xs uppercase tracking-widest text-gray-400">
              {t('coming_soon')}
            </span>
          </div>
        ) : (
          /* Catálogo de Pósters */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-16 gap-x-8 md:gap-y-24 md:gap-x-12 max-w-7xl mx-auto">
            {films.map((film) => (
              <FilmCard key={film.id} film={film} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
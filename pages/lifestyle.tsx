import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Header from '../components/editorial/Header';
import MenuDrawer from '../components/editorial/MenuDrawer';
import VideoCard from '../components/editorial/VideoCard';
import { supabase } from '../lib/supabaseClient';
import { useLanguage } from '../context/LanguageContext';

export default function Lifestyle() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const fetchVideos = async () => {
      // Llamada a la tabla "videos"
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (!error && data) {
        setVideos(data);
      } else if (error) {
        console.error("Error fetching videos:", error);
      }
      setLoading(false);
    };

    fetchVideos();
  }, []);

  return (
    <div className="min-h-[100dvh] bg-white text-black font-sans selection:bg-black selection:text-white">
      <Head>
        <title>Videos - WALCORD</title>
      </Head>

      <Header onOpenMenu={() => setIsMenuOpen(true)} />
      <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      {/* Contenedor idéntico al de Campaigns para mantener la coherencia (márgenes blancos en móvil incluidos) */}
      <main className="pt-28 md:pt-40 px-6 sm:px-10 md:px-12 max-w-[1600px] mx-auto pb-24">
        
        {/* Cabecera de sección */}
        <div className="flex flex-col items-center mb-16 md:mb-24">
          <h1 className="text-xs tracking-[0.4em] uppercase text-gray-900 font-light mb-4">
            {t('lifestyle')}
          </h1>
          <div className="w-[1px] h-12 bg-gray-300"></div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-[50vh]">
            <span className="text-[10px] tracking-[0.2em] uppercase text-gray-400 animate-pulse">{t('loading')}</span>
          </div>
        ) : (
          /* Grid de vídeos con separación amplia */
          /* CORREGIDO: Cambiado de grid-cols-3 a grid-cols-2 en escritorio, centradas */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-16 gap-x-8 md:gap-y-24 md:gap-x-12 max-w-7xl mx-auto">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
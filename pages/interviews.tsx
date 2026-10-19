import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Header from '../components/editorial/Header';
import MenuDrawer from '../components/editorial/MenuDrawer';
import ArticleCard from '../components/editorial/ArticleCard';
import { supabase } from '../lib/supabaseClient';
import { useLanguage } from '../context/LanguageContext';

export default function Interviews() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const fetchInterviews = async () => {
      // Obtener tanto de 'interviews' como de 'articles'
      const { data: interviewsData } = await supabase
        .from('interviews')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: articlesData } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false });

      // Combinar y ordenar cronológicamente
      const combined = [
        ...(interviewsData || []),
        ...(articlesData || [])
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setInterviews(combined);
      setLoading(false);
    };

    fetchInterviews();
  }, []);

  return (
    <div className="min-h-[100dvh] bg-white text-black font-sans selection:bg-black selection:text-white">
      <Head>
        <title>Interviews — WALCORD</title>
      </Head>

      <Header onOpenMenu={() => setIsMenuOpen(true)} />
      <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      {/* Contenedor idéntico al de Lifestyle / Videos */}
      <main className="pt-28 md:pt-40 px-6 sm:px-10 md:px-12 max-w-[1600px] mx-auto pb-24">
        
        {/* Cabecera de sección */}
        <div className="flex flex-col items-center mb-16 md:mb-24">
          <h1 className="text-xs tracking-[0.4em] uppercase text-gray-900 font-light mb-4">
            {t('interviews')}
          </h1>
          <div className="w-[1px] h-12 bg-gray-300"></div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-[50vh]">
            <span className="text-[10px] tracking-[0.2em] uppercase text-gray-400 animate-pulse">
              {t('loading')}
            </span>
          </div>
        ) : (
          /* Grid de ArticleCards para Entrevistas */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-y-16 gap-x-8 md:gap-y-20 md:gap-x-12">
            {interviews.map((item) => (
              <ArticleCard key={item.id} article={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
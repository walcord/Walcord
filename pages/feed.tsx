import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from '../components/editorial/Header';
import MenuDrawer from '../components/editorial/MenuDrawer';
import ArticleCard from '../components/editorial/ArticleCard';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabaseClient';

export default function Feed() {
  const { language, t } = useLanguage();
  const langKey = language.toLowerCase();
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [campaign, setCampaign] = useState(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeedData = async () => {
      // 1. Obtenemos la campaña más reciente para el Hero (opcional)
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (campaignData) setCampaign(campaignData);

      // 2. Obtenemos solo los artículos para el grid inferior
      const { data: articlesData } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (articlesData) {
        setArticles(articlesData);
      }
      
      setLoading(false);
    };

    fetchFeedData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-white flex justify-center items-center">
        <span className="text-[10px] tracking-[0.2em] uppercase text-gray-400 animate-pulse">{t('loading')}</span>
      </div>
    );
  }

  if (!campaign && articles.length === 0) {
    return (
      <div className="min-h-[100dvh] bg-white flex items-center justify-center">
         <span className="text-xs uppercase tracking-widest text-gray-400">Coming Soon</span>
      </div>
    );
  }

  const campaignTitle = campaign ? (campaign[`title_${langKey}`] || campaign.title) : '';
  
  return (
    <div className="min-h-[100dvh] bg-white text-black font-sans selection:bg-black selection:text-white">
      <Head><title>WALCORD</title></Head>

      <Header onOpenMenu={() => setIsMenuOpen(true)} />
      <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="pb-32">
        {/* HERO CAMPAIGN FEED */}
        {campaign && (
          <Link href={`/campaigns/${campaign.id}`} className="group relative block w-full h-[70vh] lg:h-[85vh] overflow-hidden cursor-pointer mb-12 lg:mb-24">
            <picture>
              <source media="(min-width: 768px)" srcSet={campaign.cover_horizontal_url || campaign.cover_url} />
              <img 
                src={campaign.cover_vertical_url || campaign.cover_url} 
                alt={campaignTitle} 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2s] ease-out group-hover:scale-105"
              />
            </picture>
            <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12 lg:px-16 bg-gradient-to-t from-black/60 via-transparent to-transparent">
              <h1 className="text-4xl md:text-6xl lg:text-8xl font-serif font-normal text-white tracking-tight mb-4 max-w-5xl">
                {campaignTitle}
              </h1>
              <span className="text-[10px] md:text-xs tracking-[0.2em] uppercase text-white font-light border-b border-transparent group-hover:border-white w-max transition-all pb-1">
                {t('explore_campaign')}
              </span>
            </div>
          </Link>
        )}

        {/* FEED GRID - Estilo Editorial solo con Artículos */}
        <div className={`columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-8 md:gap-12 space-y-8 md:space-y-12 px-6 md:px-12 lg:px-16 max-w-[2000px] mx-auto ${!campaign ? 'pt-32 md:pt-40' : ''}`}>
          {articles.map((article) => (
            <div key={`art-${article.id}`} className="break-inside-avoid">
              <ArticleCard article={article} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
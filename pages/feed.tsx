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
  const [mixedContent, setMixedContent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeedData = async () => {
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (campaignData) {
        setCampaign(campaignData);
      }

      let photosData = [];
      if (campaignData) {
        const { data: pData } = await supabase
          .from('campaign_photos')
          .select('*')
          .eq('campaign_id', campaignData.id)
          .order('display_order', { ascending: true })
          .limit(3); // Solo 3 fotos para no saturar el feed
          
        if (pData) photosData = pData;
      }

      const { data: articlesData } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10); // Cargamos más artículos para llenar el grid

      const combined = [];
      const maxLen = Math.max(photosData?.length || 0, articlesData?.length || 0);
      
      for (let i = 0; i < maxLen; i++) {
        if (articlesData && articlesData[i]) {
          combined.push({ type: 'article', data: articlesData[i] });
        }
        if (photosData && photosData[i]) {
          combined.push({ type: 'photo', data: photosData[i] });
        }
      }
      
      setMixedContent(combined);
      setLoading(false);
    };

    fetchFeedData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex justify-center items-center">
        <span className="text-[10px] tracking-[0.2em] uppercase text-gray-400 animate-pulse">{t('loading')}</span>
      </div>
    );
  }

  if (!campaign && mixedContent.length === 0) {
    return (
      <div className="min-h-[100dvh] bg-white text-black font-sans selection:bg-black selection:text-white">
        <Head><title>WALCORD</title></Head>
        <Header onOpenMenu={() => setIsMenuOpen(true)} />
        <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
        <main className="pt-32 md:pt-40 px-6 max-w-screen-2xl mx-auto flex flex-col items-center">
          <div className="flex flex-col items-center justify-center w-full h-[65vh]">
            <span className="text-xs tracking-[0.4em] uppercase text-gray-400 mb-6 font-light">{t('coming_soon')}</span>
            <h2 className="text-4xl md:text-5xl font-serif font-normal text-center max-w-4xl leading-tight text-gray-900">{t('journal_description')}</h2>
          </div>
        </main>
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
        {/* HERO CAMPAIGN - Reducido a 70-80vh para no ser tan masivo */}
        {campaign && (
          <Link href={`/campaigns/${campaign.id}`} className="group relative block w-full h-[70vh] lg:h-[80vh] overflow-hidden cursor-pointer mb-12 lg:mb-20">
            <img 
              src={campaign.cover_url || 'https://via.placeholder.com/1920x1080'} 
              alt={campaignTitle} 
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2s] ease-out group-hover:scale-105"
            />
            <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12 lg:px-16 bg-gradient-to-t from-black/50 via-transparent to-transparent">
              <h1 className="text-4xl md:text-6xl lg:text-8xl font-serif font-normal text-white tracking-tight mb-4 max-w-5xl">
                {campaignTitle}
              </h1>
              <span className="text-[10px] md:text-xs tracking-[0.2em] uppercase text-white font-light border-b border-transparent group-hover:border-white w-max transition-all pb-1">
                {t('explore_campaign')}
              </span>
            </div>
          </Link>
        )}

        {/* FEED GRID - Estilo Vogue (Múltiples columnas, tarjetas proporcionadas) */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 md:gap-12 px-6 md:px-12 lg:px-16 max-w-[2000px] mx-auto ${!campaign ? 'pt-32 md:pt-40' : ''}`}>
          {mixedContent.map((item, index) => {
            if (item.type === 'article') {
              return (
                <div key={`art-${item.data.id}`} className="col-span-1">
                  <ArticleCard article={item.data} />
                </div>
              );
            } else {
              return (
                <div key={`photo-${item.data.id}`} className="col-span-1 flex flex-col justify-center">
                  <div className="w-full aspect-[3/4] overflow-hidden bg-gray-50">
                    <img 
                      src={item.data.image_url} 
                      alt="Campaign visual" 
                      className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                    />
                  </div>
                </div>
              );
            }
          })}
        </div>
      </main>
    </div>
  );
}
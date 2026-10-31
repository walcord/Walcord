import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from '../components/editorial/Header';
import MenuDrawer from '../components/editorial/MenuDrawer';
import ArticleCard from '../components/editorial/ArticleCard';
import ReportCard from '../components/editorial/ReportCard';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabaseClient';

export default function Feed() {
  const { language, t } = useLanguage();
  const langKey = language ? language.toLowerCase() : 'fr';
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [campaign, setCampaign] = useState<any>(null);
  const [articlesList, setArticlesList] = useState<any[]>([]);
  const [reportsList, setReportsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeedData = async () => {
      // 1. Hero Campaign
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (campaignData) setCampaign(campaignData);

      // 2. Traer de 'interviews' y 'articles'
      const { data: interviewsData } = await supabase
        .from('interviews')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: articlesData } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false });

      const combinedArticles = [
        ...(interviewsData || []),
        ...(articlesData || [])
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setArticlesList(combinedArticles);

      // 3. Traer Reports
      const { data: reportsData } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (reportsData) setReportsList(reportsData);
      
      setLoading(false);
    };

    fetchFeedData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-white flex justify-center items-center">
        <span className="text-[10px] tracking-[0.2em] uppercase text-gray-400 animate-pulse">
          {t('loading')}
        </span>
      </div>
    );
  }

  const hasContent = campaign || articlesList.length > 0 || reportsList.length > 0;

  if (!hasContent) {
    return (
      <div className="min-h-[100dvh] bg-white flex items-center justify-center">
        <span className="text-xs uppercase tracking-widest text-gray-400">
          {t('coming_soon')}
        </span>
      </div>
    );
  }

  const campaignTitle = campaign ? (campaign[`title_${langKey}`] || campaign.title) : '';
  const hasReport = reportsList.length > 0;

  // Separación dinámica de artículos para las dos columnas laterales
  const leftArticles = articlesList.filter((_, index) => index % 2 === 0);
  const rightArticles = articlesList.filter((_, index) => index % 2 === 1);

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Periodical",
    "name": "WALCORD",
    "alternateName": "Walcord Magazine Feed",
    "url": "https://walcord.com/feed",
    "logo": "https://mbrdycxpztjtgsiyxikt.supabase.co/storage/v1/object/public/Assets/logo-walcord.png",
    "description": "Revue culturelle française consacrée à la danse classique et au ballet.",
    "publisher": {
      "@type": "Organization",
      "name": "WALCORD",
      "url": "https://walcord.com"
    }
  };

  return (
    <div className="min-h-[100dvh] bg-white text-black font-sans selection:bg-black selection:text-white">
      <Head>
        <title>WALCORD — Revue Culturelle de Danse Classique & Ballet</title>
        <link rel="canonical" href="https://walcord.com/feed" />
        <meta name="description" content="Revue culturelle française dédiée à la danse classique et au ballet. Campagnes conceptuelles, vidéos lifestyle, agenda des événements européens et interviews exclusives." />
        <meta name="keywords" content="Walcord, danse classique, ballet, revue culturelle, entrevistas danza, agenda ballet europe, lifestyle ballet, Adrian Germont" />
        <meta httpEquiv="content-language" content="fr, es, en, it" />
        <meta property="og:title" content="WALCORD — Revue Culturelle de Danse Classique" />
        <meta property="og:description" content="Revue culturelle française consacrée à la danse classique, campagnes conceptuelles, agenda des événements en Europe et interviews." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://walcord.com/feed" />
        <meta property="og:image" content="https://mbrdycxpztjtgsiyxikt.supabase.co/storage/v1/object/public/Assets/logo-walcord.png" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }} />
      </Head>

      <Header onOpenMenu={() => setIsMenuOpen(true)} />
      <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="pb-32">
        {campaign && (
          <Link href={`/campaigns/${campaign.id}`} className="group relative block w-full h-[65vh] lg:h-[75vh] overflow-hidden cursor-pointer mb-12 lg:mb-20">
            <picture>
              <source media="(min-width: 768px)" srcSet={campaign.cover_horizontal_url || campaign.cover_url} />
              <img 
                src={campaign.cover_vertical_url || campaign.cover_url} 
                alt={campaignTitle} 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2s] ease-out group-hover:scale-105"
              />
            </picture>
            <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12 lg:px-16 bg-gradient-to-t from-black/60 via-transparent to-transparent">
              <h1 className="text-3xl md:text-5xl lg:text-7xl font-serif font-normal text-white tracking-tight mb-4 max-w-4xl">
                {campaignTitle}
              </h1>
              <span className="text-[10px] md:text-xs tracking-[0.2em] uppercase text-white font-light border-b border-transparent group-hover:border-white w-max transition-all pb-1">
                {t('explore_campaign')}
              </span>
            </div>
          </Link>
        )}

        <div className={`px-6 md:px-10 max-w-7xl mx-auto ${!campaign ? 'pt-28 md:pt-36' : ''}`}>
          
          {hasReport ? (
            /* Estructura de 3 columnas continuas: Izquierda (Interviews), Centro (Article/Report), Derecha (Interviews) */
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-14 md:gap-12 lg:gap-16 items-start">
              
              {/* Columna 1: Entrevistas en el lado izquierdo */}
              <div className="lg:col-span-1 w-full flex flex-col gap-14 md:gap-12 lg:gap-16">
                {leftArticles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>

              {/* Columna 2 & 3: Reports / Artículos en la columna central */}
              <div className="lg:col-span-2 w-full flex flex-col gap-14 md:gap-12 lg:gap-16">
                {reportsList.map((report) => (
                  <ReportCard key={report.id} report={report} />
                ))}
              </div>

              {/* Columna 4: Entrevistas en el lado derecho */}
              <div className="lg:col-span-1 w-full flex flex-col gap-14 md:gap-12 lg:gap-16">
                {rightArticles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>

            </div>
          ) : (
            
            /* Escenario cuando aún no hay reports */
            <div>
              {articlesList.length === 1 && (
                <div className="max-w-md mx-auto">
                  <ArticleCard article={articlesList[0]} />
                </div>
              )}

              {articlesList.length === 2 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-14 md:gap-12 max-w-4xl mx-auto items-start">
                  {articlesList.map((article) => (
                    <div key={article.id} className="w-full flex flex-col">
                      <ArticleCard article={article} />
                    </div>
                  ))}
                </div>
              )}

              {articlesList.length >= 3 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-14 md:gap-12 items-start">
                  {articlesList.map((article) => (
                    <div key={article.id} className="w-full flex flex-col">
                      <ArticleCard article={article} />
                    </div>
                  ))}
                </div>
              )}
            </div>

          )}

        </div>
      </main>
    </div>
  );
}
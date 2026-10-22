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

  return (
    <div className="min-h-[100dvh] bg-white text-black font-sans selection:bg-black selection:text-white">
      <Head><title>WALCORD</title></Head>

      <Header onOpenMenu={() => setIsMenuOpen(true)} />
      <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="pb-32">
        {/* HERO CAMPAIGN FEED - Usa font-serif (Playfair/Didot) */}
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

        {/* CONTENEDOR COMPACTO RESTRINGIDO (MAX-W-5XL) PARA TARJETAS PEQUEÑAS Y ELEGANTES */}
        <div className={`px-6 md:px-10 max-w-5xl mx-auto ${!campaign ? 'pt-28 md:pt-36' : ''}`}>
          
          {/* ESCENARIO 1: CUANDO HAY UN REPORT PUBLICADO -> Layout de 3 elementos por fila [Entrevista | Report | Entrevista] */}
          {hasReport ? (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8 items-start">
              
              {/* Elemento Izquierdo: Entrevista */}
              <div className="lg:col-span-1 max-w-[280px] mx-auto lg:max-w-none w-full">
                {articlesList[0] && <ArticleCard article={articlesList[0]} />}
              </div>

              {/* Elemento Central: Report Horizontal */}
              <div className="lg:col-span-2 w-full py-6 lg:py-0 border-t border-b lg:border-t-0 lg:border-b-0 border-gray-100">
                {reportsList[0] && <ReportCard report={reportsList[0]} />}
              </div>

              {/* Elemento Derecho: Entrevista */}
              <div className="lg:col-span-1 max-w-[280px] mx-auto lg:max-w-none w-full">
                {articlesList[1] ? (
                  <ArticleCard article={articlesList[1]} />
                ) : (
                  /* Si solo hay 1 entrevista + 1 report, mantiene el espacio limpio */
                  <div className="hidden lg:block" />
                )}
              </div>

            </div>
          ) : (
            
            /* ESCENARIO 2: AÚN NO HAY REPORTS -> Reorganización automática según cantidad de artículos */
            <div>
              {/* Si solo hay 1 artículo (como Karl Paquette ahora) -> Centrado y tamaño compacto */}
              {articlesList.length === 1 && (
                <div className="max-w-xs mx-auto">
                  <ArticleCard article={articlesList[0]} />
                </div>
              )}

              {/* Si hay 2 artículos -> 2 columnas centradas */}
              {articlesList.length === 2 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-2xl mx-auto">
                  {articlesList.map((article) => (
                    <div key={article.id} className="max-w-[280px] mx-auto w-full">
                      <ArticleCard article={article} />
                    </div>
                  ))}
                </div>
              )}

              {/* Si hay 3 o más artículos -> Fila limpia de 3 por fila */}
              {articlesList.length >= 3 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                  {articlesList.map((article) => (
                    <div key={article.id} className="max-w-[280px] mx-auto w-full">
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
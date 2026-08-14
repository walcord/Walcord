import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Header from '../../components/editorial/Header';
import MenuDrawer from '../../components/editorial/MenuDrawer';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabaseClient';

export default function ArticleDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { language, t } = useLanguage();
  const langKey = language.toLowerCase();
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [article, setArticle] = useState(null); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchArticle = async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        setArticle(data);
      }
      setLoading(false);
    };

    fetchArticle();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex justify-center items-center">
        <span className="text-[10px] tracking-[0.2em] uppercase text-gray-400 animate-pulse">{t('loading')}</span>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-white flex flex-col justify-center items-center gap-6">
        <span className="text-[10px] tracking-[0.2em] uppercase text-gray-900">{t('not_found')}</span>
        <Link href="/" className="text-[10px] uppercase tracking-widest border-b border-black pb-1">{t('back')}</Link>
      </div>
    );
  }

  const localizedTitle = article[`title_${langKey}`] || article.title;
  const localizedSubtitle = article[`subtitle_${langKey}`] || article.subtitle;
  const localizedContent = article[`content_${langKey}`] || article.content;

  const formattedDate = new Date(article.created_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).toUpperCase();

  return (
    <div className="min-h-[100dvh] bg-white text-black font-sans selection:bg-black selection:text-white">
      <Head>
        <title>{localizedTitle} - WALCORD</title>
      </Head>

      <Header onOpenMenu={() => setIsMenuOpen(true)} />
      <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="pb-32">
        {/* Cabecera inmersiva con la cover_url */}
        <div className="w-full h-[60vh] md:h-[75vh] relative mb-12 md:mb-24">
           <img 
              src={article.cover_url || 'https://via.placeholder.com/1920x1080'} 
              alt={localizedTitle}
              className="w-full h-full object-cover"
           />
        </div>

        <article className="max-w-4xl mx-auto px-6 sm:px-10">
          <header className="mb-16 md:mb-20 text-center">
            <span className="block text-[9px] md:text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-6 font-light">
              {formattedDate}
            </span>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-normal text-gray-900 tracking-tight leading-[1.05] mb-8">
              {localizedTitle}
            </h1>

            {localizedSubtitle && (
              <p className="text-xl md:text-3xl font-serif text-gray-600 max-w-2xl mx-auto leading-snug">
                {localizedSubtitle}
              </p>
            )}
          </header>

          <div className="prose prose-stone prose-lg md:prose-xl max-w-none text-gray-800 font-serif leading-relaxed md:leading-loose">
            <p className="whitespace-pre-wrap">
              {localizedContent || 'Content will appear here.'}
            </p>
          </div>
        </article>
      </main>
    </div>
  );
}
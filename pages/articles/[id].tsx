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
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [article, setArticle] = useState(null); 
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchArticleData = async () => {
      const { data: articleData, error: articleError } = await supabase
        .from('articles')
        .select('*')
        .eq('id', id)
        .single();

      const { data: photosData, error: photosError } = await supabase
        .from('article_photos')
        .select('*')
        .eq('article_id', id)
        .order('display_order', { ascending: true });

      if (!articleError && articleData) {
        setArticle(articleData);
      }
      
      if (!photosError && photosData && photosData.length > 0) {
        setPhotos(photosData);
      }

      setLoading(false);
    };

    fetchArticleData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-white flex justify-center items-center">
        <span className="text-[10px] tracking-[0.2em] uppercase text-gray-400 animate-pulse">{t('loading')}</span>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col justify-center items-center gap-6">
        <span className="text-[10px] tracking-[0.2em] uppercase text-gray-900">{t('not_found')}</span>
        <Link href="/" className="text-[10px] uppercase tracking-widest border-b border-black pb-1">{t('back')}</Link>
      </div>
    );
  }

  const getLocalizedField = (fieldName) => {
    const langKey = language ? language.toLowerCase() : 'fr';
    if (langKey === 'en') {
      return article[fieldName] || article[`${fieldName}_en`] || article[`${fieldName}_fr`] || '';
    }
    return article[`${fieldName}_${langKey}`] || article[fieldName] || article[`${fieldName}_fr`] || '';
  };

  const localizedTitle = getLocalizedField('title');
  const localizedSubtitle = getLocalizedField('subtitle');
  const localizedContent = getLocalizedField('content');

  const date = new Date(article.created_at);
  const fallbackDate = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).toUpperCase();
  const finalDate = article.display_date || fallbackDate;

  // Separamos el texto por saltos de línea
  const paragraphs = localizedContent 
    ? localizedContent.split(/\n+/).filter((p) => p.trim() !== '')
    : [];

  // Configuración de dominio base para Google News
  const siteUrl = 'https://walcord.com'; // Cambia si tu dominio difiere
  const articleImage = article.cover_horizontal_url || article.cover_url || article.cover_vertical_url;

  // Esquema NewsArticle estructurado para Google News
  const newsArticleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": localizedTitle,
    "description": localizedSubtitle || localizedTitle,
    "image": articleImage ? [articleImage] : [],
    "datePublished": article.created_at,
    "dateModified": article.updated_at || article.created_at,
    "author": [{
      "@type": "Person",
      "name": article.author_name || "WALCORD Editorial"
    }],
    "publisher": {
      "@type": "Organization",
      "name": "WALCORD",
      "logo": {
        "@type": "ImageObject",
        "url": `${siteUrl}/logo.png`
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${siteUrl}${router.asPath}`
    }
  };

  return (
    <div className="min-h-[100dvh] bg-white text-black font-sans selection:bg-black selection:text-white">
      <Head>
        <title>{localizedTitle} - WALCORD</title>
        <meta name="description" content={localizedSubtitle || localizedTitle} />
        
        {/* Marcado de datos estructurados para Google News */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(newsArticleSchema) }}
        />
      </Head>

      <Header onOpenMenu={() => setIsMenuOpen(true)} />
      <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="pb-32 md:pb-40">
        
        {/* CABECERA (COVER) */}
        <section className="w-full px-4 md:px-12 max-w-screen-2xl mx-auto mb-12 md:mb-20 pt-24 md:pt-32">
          <div className="w-full relative">
            <picture>
              <source media="(min-width: 768px)" srcSet={article.cover_horizontal_url || article.cover_url} />
              <img 
                src={article.cover_vertical_url || article.cover_url} 
                alt={localizedTitle}
                className="w-full h-auto max-h-[85vh] object-cover bg-gray-50"
              />
            </picture>
          </div>
        </section>

        {/* CONTENIDO DEL ARTÍCULO */}
        <article className="max-w-4xl mx-auto px-6 sm:px-10">
          <header className="mb-16 md:mb-24 text-center">
            <span className="block text-[9px] md:text-[10px] tracking-[0.25em] uppercase text-gray-400 mb-6 font-light">
              {finalDate}
            </span>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-normal text-gray-900 tracking-tight leading-[1.05] mb-8">
              {localizedTitle}
            </h1>

            {localizedSubtitle && (
              <p className="text-xl md:text-2xl font-serif text-gray-600 max-w-2xl mx-auto leading-snug italic">
                {localizedSubtitle}
              </p>
            )}
          </header>

          {/* 1. TEXTO PRINCIPAL (Todo seguido) */}
          <div className="prose prose-stone prose-lg md:prose-xl max-w-none text-gray-800 font-serif">
            {paragraphs.map((p, idx) => {
              const trimmedText = p.trim();
              
              // Si empieza por "/", es una pregunta
              if (trimmedText.startsWith('/')) {
                const questionText = trimmedText.substring(1).trim();
                return (
                  <span key={`text-${idx}`} className="block font-sans font-semibold text-xs md:text-sm tracking-wider uppercase text-black mb-4 mt-12 text-left">
                    {questionText}
                  </span>
                );
              }

              // Si no, es texto normal
              return (
                <p key={`text-${idx}`} className="whitespace-pre-wrap font-serif leading-relaxed md:leading-loose text-gray-800 mb-8 md:mb-10">
                  {p}
                </p>
              );
            })}
          </div>

          {/* 2. GALERÍA DE FOTOS AL FINAL (Grid: 2 móvil, 4 ordenador) */}
          {photos && photos.length > 0 && (
            <div className="mt-20 md:mt-32 pt-12 border-t border-gray-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {photos.map((photo, idx) => (
                  <figure key={`photo-${photo.id || idx}`} className="w-full flex flex-col">
                    <img 
                      src={photo.image_url} 
                      alt={photo.caption || 'Article image'}
                      className="w-full h-auto object-cover aspect-[3/4] bg-gray-50"
                      loading="lazy"
                    />
                    {photo.caption && (
                      <figcaption className="mt-3 text-left text-[9px] md:text-[10px] tracking-[0.2em] uppercase text-gray-500 font-light">
                        {photo.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            </div>
          )}
        </article>
      </main>
    </div>
  );
}
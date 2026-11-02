import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Header from '../../components/editorial/Header';
import MenuDrawer from '../../components/editorial/MenuDrawer';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../../context/LanguageContext';

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
      setLoading(true);

      const { data: articleData, error: articleError } = await supabase
        .from('reports')
        .select('*')
        .eq('id', id)
        .single();

      const { data: photosData, error: photosError } = await supabase
        .from('report_photos')
        .select('*')
        .eq('report_id', id)
        .order('display_order', { ascending: true });

      if (!articleError && articleData) {
        setArticle(articleData);
      }
      if (!photosError && photosData) {
        setPhotos(photosData);
      }
      
      setLoading(false);
    };

    fetchArticleData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex justify-center items-center bg-white">
        <span className="text-[10px] tracking-[0.2em] uppercase text-gray-400 animate-pulse">
          {t('loading')}
        </span>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-[100dvh] flex justify-center items-center bg-white">
        <p className="text-xs tracking-[0.2em] uppercase text-gray-900">
          {t('not_found')}
        </p>
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
  const fallbackDate = `${date.toLocaleString('en-US', { month: 'short' })}. ${date.getFullYear().toString().slice(2)}'`.toUpperCase();
  const finalDate = article.display_date || fallbackDate;

  // Extraer párrafos individuales
  const paragraphs = localizedContent 
    ? localizedContent.split(/\n\s*\n/).filter((p) => p.trim() !== '')
    : [];

  // Renderizado de texto ajustado a formato de Cita/Declaración de Persona
  const renderParagraph = (text, key) => {
    const colonIndex = text.indexOf(' : ');
    
    if (colonIndex !== -1 && text.substring(0, colonIndex).split(' ').length < 15) {
      const speaker = text.substring(0, colonIndex).trim();
      const statement = text.substring(colonIndex + 3).trim();

      return (
        <div key={key} className="mb-10 text-left">
          {/* Indicador de persona que habla */}
          <div className="flex items-center gap-3 mb-3">
            <span className="w-5 h-[1px] bg-black"></span>
            <span className="font-sans font-bold text-[11px] md:text-xs tracking-[0.2em] uppercase text-black">
              {speaker}
            </span>
          </div>

          {/* Bloque de declaración en fuente Serif */}
          <blockquote className="whitespace-pre-line text-gray-900 font-serif border-l border-black/30 pl-4 md:pl-6 py-0.5 text-base md:text-lg leading-relaxed">
            {statement}
          </blockquote>
        </div>
      );
    }

    return (
      <p key={key} className="mb-6 whitespace-pre-line text-justify md:text-left text-gray-800 font-serif text-base md:text-lg leading-relaxed">
        {text}
      </p>
    );
  };

  // Renderizado de un bloque de fotos (individual o pareja)
  const renderPhotoBlock = (block, key) => {
    if (block.length === 2) {
      return (
        <div key={key} className="max-w-6xl mx-auto px-4 md:px-12 my-10 md:my-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
            {block.map((photo) => (
              <div key={photo.id} className="w-full">
                <img 
                  src={photo.image_url} 
                  alt={localizedTitle || "Article shot"} 
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div key={key} className="w-full max-w-5xl mx-auto px-4 md:px-12 my-10 md:my-16">
        <div className="w-full">
          <img 
            src={block[0].image_url} 
            alt={localizedTitle || "Article shot"} 
            className="w-full h-auto object-cover"
            loading="lazy"
          />
        </div>
      </div>
    );
  };

  // Algoritmo dinámico de intercalación equilibrada de imágenes y texto
  const renderEditorialStream = () => {
    if (!paragraphs.length && !photos.length) return null;

    if (!photos.length) {
      return (
        <div className="max-w-2xl mx-auto px-6 md:px-0 my-10 md:my-16 font-serif text-gray-900 leading-relaxed text-base md:text-lg">
          {paragraphs.map((p, idx) => renderParagraph(p, idx))}
        </div>
      );
    }

    // Agrupar fotos en bloques (parejas e individuales)
    const photoBlocks = [];
    let i = 0;
    while (i < photos.length) {
      if (i + 1 < photos.length && i % 3 === 1) {
        photoBlocks.push(photos.slice(i, i + 2));
        i += 2;
      } else {
        photoBlocks.push([photos[i]]);
        i += 1;
      }
    }

    if (!paragraphs.length) {
      return (
        <div className="w-full space-y-12 my-12">
          {photoBlocks.map((block, idx) => renderPhotoBlock(block, `photo-standalone-${idx}`))}
        </div>
      );
    }

    const stream = [];
    const totalParagraphs = paragraphs.length;
    const totalBlocks = photoBlocks.length;
    let blockIdx = 0;

    paragraphs.forEach((paragraph, pIdx) => {
      // Párrafo o declaración de texto
      stream.push(
        <div 
          key={`text-seg-${pIdx}`} 
          className="max-w-2xl mx-auto px-6 md:px-0 my-8 md:my-12 font-serif text-gray-900 leading-relaxed text-base md:text-lg selection:bg-black selection:text-white"
        >
          {renderParagraph(paragraph, pIdx)}
        </div>
      );

      // Reparto proporcional de fotos restantes tras este párrafo
      const remainingParagraphs = totalParagraphs - pIdx;
      const remainingBlocks = totalBlocks - blockIdx;

      if (remainingBlocks > 0) {
        const blocksForThisStep = Math.ceil(remainingBlocks / remainingParagraphs);

        for (let b = 0; b < blocksForThisStep && blockIdx < totalBlocks; b++) {
          stream.push(renderPhotoBlock(photoBlocks[blockIdx], `photo-seg-${pIdx}-${blockIdx}`));
          blockIdx++;
        }
      }
    });

    return stream;
  };

  return (
    <div className="min-h-[100dvh] bg-white text-black font-sans selection:bg-black selection:text-white">
      <Head>
        <title>{localizedTitle ? `${localizedTitle} — WALCORD` : 'WALCORD'}</title>
      </Head>

      <Header onOpenMenu={() => setIsMenuOpen(true)} />
      <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="pt-24 md:pt-32 pb-32 md:pb-40">
        
        {/* HERO PORTADA */}
        <section className="w-full px-4 md:px-12 max-w-screen-2xl mx-auto mb-12 md:mb-20">
          <div className="w-full relative">
            <picture>
              <source media="(min-width: 768px)" srcSet={article.cover_horizontal_url || article.cover_url} />
              <img 
                src={article.cover_vertical_url || article.cover_url} 
                alt={localizedTitle} 
                className="w-full h-auto max-h-[85vh] object-cover"
              />
            </picture>
          </div>
          
          <div className="mt-8 md:mt-16 flex flex-col items-center text-center px-4 max-w-4xl mx-auto">
            <span className="text-[9px] md:text-[10px] tracking-[0.3em] uppercase text-gray-400 mb-6 font-light">
              ARTICLE — {finalDate}
            </span>
            
            <h1 className="text-4xl md:text-7xl font-serif font-normal text-gray-900 tracking-tight leading-[1.1]">
              {localizedTitle}
            </h1>

            {localizedSubtitle && (
              <p className="mt-4 md:mt-6 text-sm md:text-lg font-serif italic text-gray-600 tracking-wide max-w-2xl leading-relaxed">
                {localizedSubtitle}
              </p>
            )}
          </div>
        </section>

        {/* STREAM EDITORIAL */}
        <section className="w-full">
          {renderEditorialStream()}
        </section>

      </main>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Header from '../../components/editorial/Header';
import MenuDrawer from '../../components/editorial/MenuDrawer';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../../context/LanguageContext';

export default function ReportDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { language, t } = useLanguage();
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [report, setReport] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchReportData = async () => {
      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .select('*')
        .eq('id', id)
        .single();

      const { data: photosData, error: photosError } = await supabase
        .from('report_photos')
        .select('*')
        .eq('report_id', id)
        .order('display_order', { ascending: true });

      if (!reportError && reportData) {
        setReport(reportData);
      }
      if (!photosError && photosData) {
        setPhotos(photosData);
      }
      
      setLoading(false);
    };

    fetchReportData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex justify-center items-center bg-white">
        <span className="text-[10px] tracking-[0.2em] uppercase text-gray-400 animate-pulse">{t('loading')}</span>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-[100dvh] flex justify-center items-center bg-white">
        <p className="text-xs tracking-[0.2em] uppercase text-gray-900">{t('not_found')}</p>
      </div>
    );
  }

  const getLocalizedField = (fieldName) => {
    const langKey = language ? language.toLowerCase() : 'fr';
    
    if (langKey === 'en') {
      return report[fieldName] || report[`${fieldName}_en`] || report[`${fieldName}_fr`] || '';
    }
    
    return report[`${fieldName}_${langKey}`] || report[fieldName] || report[`${fieldName}_fr`] || '';
  };

  const localizedTitle = getLocalizedField('title');
  const localizedSubtitle = getLocalizedField('subtitle');
  const localizedContent = getLocalizedField('content'); // Usamos 'content' en lugar de 'interview'

  const date = new Date(report.created_at);
  const fallbackDate = `${date.toLocaleString('en-US', { month: 'short' })}. ${date.getFullYear().toString().slice(2)}'`.toUpperCase();
  const finalDate = report.display_date || fallbackDate;

  // Extraer los párrafos individuales
  const paragraphs = localizedContent 
    ? localizedContent.split(/\n\s*\n/).filter((p) => p.trim() !== '')
    : [];

  // Mantuvimos la lógica de renderizado por si el reporte contiene formato Q&A
  const renderParagraph = (text, key) => {
    const colonIndex = text.indexOf(' : ');
    
    // Solo aplicamos el estilo "Interview" si encuentra el separador y la pregunta no es excesivamente larga
    if (colonIndex !== -1 && text.substring(0, colonIndex).split(' ').length < 15) {
      const question = text.substring(0, colonIndex).trim();
      const answer = text.substring(colonIndex + 3).trim();

      return (
        <div key={key} className="mb-8 text-left">
          <span className="block font-sans font-semibold text-xs md:text-sm tracking-wider uppercase text-black mb-1.5">
            {question}
          </span>
          <p className="whitespace-pre-line text-gray-800 font-serif">
            {answer}
          </p>
        </div>
      );
    }

    return (
      <p key={key} className="mb-6 whitespace-pre-line text-justify md:text-left text-gray-800 font-serif">
        {text}
      </p>
    );
  };

  // Algoritmo de distribución proporcional de texto e imágenes (IDÉNTICO a CampaignDetail)
  const renderEditorialStream = () => {
    if (!paragraphs.length && !photos.length) return null;

    if (!photos.length) {
      return (
        <div className="max-w-2xl mx-auto px-6 md:px-0 my-10 md:my-16 font-serif text-gray-900 leading-relaxed text-base md:text-lg">
          {paragraphs.map((p, idx) => renderParagraph(p, idx))}
        </div>
      );
    }

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

    const totalBlocks = photoBlocks.length;
    const totalParagraphs = paragraphs.length;
    const numSegments = totalBlocks + 1;

    const baseItemsPerSegment = Math.floor(totalParagraphs / numSegments);
    const remainder = totalParagraphs % numSegments;

    const stream = [];
    let pIdx = 0;

    for (let s = 0; s < numSegments; s++) {
      const count = baseItemsPerSegment + (s < remainder ? 1 : 0);

      if (count > 0 && pIdx < totalParagraphs) {
        const textChunk = paragraphs.slice(pIdx, pIdx + count);
        pIdx += count;

        stream.push(
          <div 
            key={`text-seg-${s}`} 
            className="max-w-2xl mx-auto px-6 md:px-0 my-10 md:my-16 font-serif text-gray-900 leading-relaxed text-base md:text-lg selection:bg-black selection:text-white"
          >
            {textChunk.map((p, idx) => renderParagraph(p, `${s}-${idx}`))}
          </div>
        );
      }

      if (s < totalBlocks) {
        const block = photoBlocks[s];

        if (block.length === 2) {
          stream.push(
            <div key={`photo-pair-${s}`} className="max-w-6xl mx-auto px-4 md:px-12 my-12 md:my-20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                {block.map((photo) => (
                  <div key={photo.id} className="w-full">
                    <img 
                      src={photo.image_url} 
                      alt="Report shot" 
                      className="w-full h-auto object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        } else {
          stream.push(
            <div key={`photo-single-${s}-${block[0].id}`} className="w-full max-w-5xl mx-auto px-4 md:px-12 my-12 md:my-20">
              <div className="w-full">
                <img 
                  src={block[0].image_url} 
                  alt="Report shot" 
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          );
        }
      }
    }

    return stream;
  };

  return (
    <div className="min-h-[100dvh] bg-white text-black font-sans selection:bg-black selection:text-white">
      <Head>
        <title>{localizedTitle} — WALCORD</title>
      </Head>

      <Header onOpenMenu={() => setIsMenuOpen(true)} />
      <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="pt-24 md:pt-32 pb-32 md:pb-40">
        
        {/* HERO PORTADA */}
        <section className="w-full px-4 md:px-12 max-w-screen-2xl mx-auto mb-12 md:mb-20">
          <div className="w-full relative">
            <picture>
              <source media="(min-width: 768px)" srcSet={report.cover_horizontal_url || report.cover_url} />
              <img 
                src={report.cover_vertical_url || report.cover_url} 
                alt={localizedTitle} 
                className="w-full h-auto max-h-[85vh] object-cover"
              />
            </picture>
          </div>
          
          <div className="mt-8 md:mt-16 flex flex-col items-center text-center px-4 max-w-4xl mx-auto">
            <span className="text-[9px] md:text-[10px] tracking-[0.3em] uppercase text-gray-400 mb-6 font-light">
              Report — {finalDate}
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

        {/* EDITORIAL STREAM (Texto e Imágenes Distribuidos) */}
        <section className="w-full">
          {renderEditorialStream()}
        </section>

      </main>
    </div>
  );
}
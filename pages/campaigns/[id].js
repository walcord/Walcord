import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Header from '../../components/editorial/Header';
import MenuDrawer from '../../components/editorial/MenuDrawer';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../../context/LanguageContext';

export default function CampaignDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { language, t } = useLanguage();
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [campaign, setCampaign] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchCampaignData = async () => {
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .single();

      const { data: photosData, error: photosError } = await supabase
        .from('campaign_photos')
        .select('*')
        .eq('campaign_id', id)
        .order('display_order', { ascending: true });

      if (!campaignError && campaignData) {
        setCampaign(campaignData);
      }
      if (!photosError && photosData) {
        setPhotos(photosData);
      }
      
      setLoading(false);
    };

    fetchCampaignData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex justify-center items-center bg-white">
        <span className="text-[10px] tracking-[0.2em] uppercase text-gray-400 animate-pulse">{t('loading')}</span>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-[100dvh] flex justify-center items-center bg-white">
        <p className="text-xs tracking-[0.2em] uppercase text-gray-900">{t('not_found')}</p>
      </div>
    );
  }

  // Idioma principal: Francés por defecto
  const langKey = language ? language.toLowerCase() : 'fr';
  const localizedTitle = campaign[`title_${langKey}`] || campaign.title_fr || campaign.title;
  const localizedSubtitle = campaign[`subtitle_${langKey}`] || campaign.subtitle_fr || campaign.subtitle;
  const localizedInterview = campaign[`interview_${langKey}`] || campaign.interview_fr || campaign.interview;
  const localizedSubjects = campaign[`subjects_${langKey}`] || campaign.subjects_fr || campaign.subjects;

  const date = new Date(campaign.created_at);
  const fallbackDate = `${date.toLocaleString('en-US', { month: 'short' })}. ${date.getFullYear().toString().slice(2)}'`.toUpperCase();
  const finalDate = campaign.display_date || fallbackDate;

  // Extraer las preguntas/respuestas individuales
  const paragraphs = localizedInterview 
    ? localizedInterview.split(/\n\s*\n/).filter((p) => p.trim() !== '')
    : [];

  // Función para renderizar preguntas con estilo Interview Magazine
  const renderParagraph = (text, key) => {
    const colonIndex = text.indexOf(' : ');
    if (colonIndex !== -1) {
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

  // Algoritmo de distribución proporcional de texto e imágenes en el cuerpo
  const renderEditorialStream = () => {
    if (!paragraphs.length && !photos.length) return null;

    if (!photos.length) {
      return (
        <div className="max-w-2xl mx-auto px-6 md:px-0 my-10 md:my-16 font-serif text-gray-900 leading-relaxed text-base md:text-lg">
          {paragraphs.map((p, idx) => renderParagraph(p, idx))}
        </div>
      );
    }

    // Agrupar fotos del cuerpo alternando individuales y parejas
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

    // Reparto equitativo de párrafos
    const baseItemsPerSegment = Math.floor(totalParagraphs / numSegments);
    const remainder = totalParagraphs % numSegments;

    const stream = [];
    let pIdx = 0;

    for (let s = 0; s < numSegments; s++) {
      const count = baseItemsPerSegment + (s < remainder ? 1 : 0);

      // Bloque de texto
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

      // Bloque de imagen en el cuerpo (mantiene proporción intacta)
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
                      alt="Editorial shot" 
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
                  alt="Editorial shot" 
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
        <title>{localizedTitle} - WALCORD</title>
      </Head>

      <Header onOpenMenu={() => setIsMenuOpen(true)} />
      <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="pt-24 md:pt-32 pb-32 md:pb-40">
        
        {/* HERO PORTADA (Restaurado exacto a tu código original con max-h-[85vh]) */}
        <section className="w-full px-4 md:px-12 max-w-screen-2xl mx-auto mb-12 md:mb-20">
          <div className="w-full relative">
            <picture>
              <source media="(min-width: 768px)" srcSet={campaign.cover_horizontal_url || campaign.cover_url} />
              <img 
                src={campaign.cover_vertical_url || campaign.cover_url} 
                alt={localizedTitle} 
                className="w-full h-auto max-h-[85vh] object-cover"
              />
            </picture>
          </div>
          
          <div className="mt-8 md:mt-16 flex flex-col items-center text-center px-4 max-w-4xl mx-auto">
            <span className="text-[9px] md:text-[10px] tracking-[0.3em] uppercase text-gray-400 mb-6 font-light">
              {finalDate} {localizedSubjects && `— ${localizedSubjects}`}
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

        {/* INTERVIEW STREAM */}
        <section className="w-full">
          {renderEditorialStream()}
        </section>

      </main>
    </div>
  );
}
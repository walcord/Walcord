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

  const date = new Date(campaign.created_at);
  const fallbackDate = `${date.toLocaleString('en-US', { month: 'short' })}. ${date.getFullYear().toString().slice(2)}'`.toUpperCase();
  const finalDate = campaign.display_date || fallbackDate;
  const langKey = language.toLowerCase();
  
  const localizedTitle = campaign[`title_${langKey}`] || campaign.title;
  const localizedInterview = campaign[`interview_${langKey}`] || campaign.interview;
  const localizedSubjects = campaign[`subjects_${langKey}`] || campaign.subjects;

  // Separamos el texto de la entrevista en párrafos individuales
  const paragraphs = localizedInterview 
    ? localizedInterview.split(/\n\s*\n/).filter((p) => p.trim() !== '')
    : [];

  // Algoritmo de interleaving estilo Interview Magazine:
  // Distribuye párrafos y fotos en bloques editoriales alternados
  const renderEditorialStream = () => {
    const stream = [];
    let photoIdx = 0;
    let paragraphIdx = 0;

    while (paragraphIdx < paragraphs.length || photoIdx < photos.length) {
      // 1. Bloque de Texto (2 párrafos de entrevista)
      if (paragraphIdx < paragraphs.length) {
        const textBlock = paragraphs.slice(paragraphIdx, paragraphIdx + 2);
        paragraphIdx += 2;

        stream.push(
          <div 
            key={`text-block-${paragraphIdx}`} 
            className="max-w-2xl mx-auto px-6 md:px-0 my-16 md:my-24 font-serif text-gray-900 leading-relaxed text-base md:text-xl selection:bg-black selection:text-white"
          >
            {textBlock.map((p, pSubIdx) => (
              <p key={pSubIdx} className="mb-6 whitespace-pre-line text-justify md:text-left">
                {p}
              </p>
            ))}
          </div>
        );
      }

      // 2. Foto Individual (Pantalla completa / Centrada)
      if (photoIdx < photos.length) {
        const singlePhoto = photos[photoIdx];
        photoIdx += 1;

        stream.push(
          <div key={`photo-single-${singlePhoto.id}`} className="w-full max-w-5xl mx-auto px-4 md:px-12 my-12 md:my-20">
            <div className="w-full bg-gray-50 overflow-hidden">
              <img 
                src={singlePhoto.image_url} 
                alt="Editorial shot" 
                className="w-full h-auto object-cover"
                loading="lazy"
              />
            </div>
          </div>
        );
      }

      // 3. Siguiente Bloque de Texto (1 párrafo)
      if (paragraphIdx < paragraphs.length) {
        const singleParagraph = paragraphs[paragraphIdx];
        paragraphIdx += 1;

        stream.push(
          <div 
            key={`text-single-${paragraphIdx}`} 
            className="max-w-2xl mx-auto px-6 md:px-0 my-16 md:my-24 font-serif text-gray-900 leading-relaxed text-base md:text-xl"
          >
            <p className="whitespace-pre-line text-justify md:text-left">
              {singleParagraph}
            </p>
          </div>
        );
      }

      // 4. Par de Fotos Diptych (Dos fotos verticales lado a lado)
      if (photoIdx < photos.length) {
        const pairPhotos = photos.slice(photoIdx, photoIdx + 2);
        photoIdx += pairPhotos.length;

        stream.push(
          <div key={`photo-pair-${photoIdx}`} className="max-w-6xl mx-auto px-4 md:px-12 my-16 md:my-24">
            <div className={`grid grid-cols-1 ${pairPhotos.length > 1 ? 'md:grid-cols-2' : ''} gap-6 md:gap-10`}>
              {pairPhotos.map((photo) => (
                <div key={photo.id} className="w-full bg-gray-50 overflow-hidden">
                  <img 
                    src={photo.image_url} 
                    alt="Editorial diptych shot" 
                    className="w-full h-auto object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        );
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
        
        {/* HERO PORTADA - Responsive Picture Tag */}
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
          
          <div className="mt-8 md:mt-16 flex flex-col items-center text-center px-4">
            <span className="text-[9px] md:text-[10px] tracking-[0.3em] uppercase text-gray-400 mb-6 font-light">
              {finalDate} — {localizedSubjects}
            </span>
            <h1 className="text-4xl md:text-7xl font-serif font-normal text-gray-900 tracking-tight max-w-4xl leading-[1.1]">
              {localizedTitle}
            </h1>
          </div>
        </section>

        {/* INTERVIEW MAGAZINE STREAM (Flujo intercalado de Texto + Imagen) */}
        <section className="w-full">
          {renderEditorialStream()}
        </section>

      </main>
    </div>
  );
}
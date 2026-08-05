import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Header from '../../components/editorial/Header';
import MenuDrawer from '../../components/editorial/MenuDrawer';
import { supabase } from '../../lib/supabaseClient';

export default function CampaignDetail() {
  const router = useRouter();
  const { id } = router.query;
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [campaign, setCampaign] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchCampaignData = async () => {
      // 1. Obtener datos de la campaña
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .single();

      // 2. Obtener fotos adicionales
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
        <span className="text-[10px] tracking-[0.2em] uppercase text-gray-400 animate-pulse">Loading...</span>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-[100dvh] flex justify-center items-center bg-white">
        <p className="text-xs tracking-[0.2em] uppercase text-gray-900">Campaign not found.</p>
      </div>
    );
  }

  // Lógica de fecha: Usa la manual de Supabase, o genera una automática si está vacía
  const date = new Date(campaign.created_at);
  const fallbackDate = `${date.toLocaleString('en-US', { month: 'short' })}. ${date.getFullYear().toString().slice(2)}'`.toUpperCase();
  const finalDate = campaign.display_date || fallbackDate;

  return (
    <div className="min-h-[100dvh] bg-white text-black font-sans selection:bg-black selection:text-white">
      <Head>
        <title>{campaign.title} - WALCORD</title>
      </Head>

      <Header onOpenMenu={() => setIsMenuOpen(true)} />
      <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      {/* AÑADIDO pb-32 o pb-40 para asegurar que hay margen al final del scroll */}
      <main className="pt-24 md:pt-32 pb-32 md:pb-40">
        {/* Portada Principal */}
        <section className="w-full px-4 md:px-12 max-w-screen-2xl mx-auto mb-16 md:mb-32">
          
          {/* CORREGIDO: aspect-video aplicado globalmente para que en el teléfono también se vea apaisada */}
          <div className="w-full aspect-video overflow-hidden">
            <img 
              src={campaign.cover_url} 
              alt={campaign.title} 
              className="w-full h-full object-cover"
            />
          </div>
          
          <div className="mt-8 md:mt-16 flex flex-col items-center text-center px-4">
            {/* CORREGIDO: Fecha manual de Supabase y eliminación del FEAT. */}
            <span className="text-[9px] md:text-[10px] tracking-[0.3em] uppercase text-gray-400 mb-6 font-light">
              {finalDate} — {campaign.subjects}
            </span>
            <h1 className="text-4xl md:text-7xl font-serif font-normal text-gray-900 tracking-tight max-w-4xl leading-[1.1]">
              {campaign.title}
            </h1>
          </div>
        </section>

        {/* Entrevista / Contenido Editorial */}
        {campaign.interview && (
          <section className="px-6 md:px-0 max-w-2xl mx-auto mb-16 md:mb-32 pb-12">
            <div className="prose prose-lg md:prose-xl prose-stone font-serif text-gray-800 leading-relaxed mx-auto text-justify whitespace-pre-wrap">
              {campaign.interview}
            </div>
          </section>
        )}

        {/* Galería de la Campaña (Grid Lookbook) */}
        {photos.length > 0 && (
          <section className="px-4 md:px-12 max-w-[1600px] mx-auto">
            <div className="w-full flex justify-center mb-16">
              <span className="text-[10px] tracking-[0.3em] uppercase text-gray-400 font-light">
                The Lookbook
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
              {photos.map((photo, index) => (
                <div 
                  key={photo.id} 
                  className={`w-full overflow-hidden bg-gray-50 ${
                    index % 3 === 0 ? 'md:col-span-2 aspect-video' : 'aspect-[3/4]'
                  }`}
                >
                  <img 
                    src={photo.image_url} 
                    alt={`Campaign shot ${index + 1}`} 
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
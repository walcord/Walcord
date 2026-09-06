'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Mantenemos la animación premium 1.2 segundos
      await new Promise((r) => setTimeout(r, 1200));
      if (cancelled) return;

      // 🚀 Lanzamos a TODOS los usuarios al feed, sin pedir login
      router.replace('/feed'); 
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Datos estructurados JSON-LD (Invisibles para el usuario, leídos por Google)
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Periodical",
    "name": "WALCORD",
    "alternateName": "Walcord Magazine",
    "url": "https://walcord.com",
    "logo": "https://mbrdycxpztjtgsiyxikt.supabase.co/storage/v1/object/public/Assets/logo-walcord.png",
    "description": "Revue culturelle française consacrée à la danse classique et au ballet : campagnes conceptuelles, vidéos lifestyle, agenda des événements en Europe et interviews exclusives avec les grands noms de la danse.",
    "inLanguage": ["fr", "es", "en", "it"],
    "genre": ["Classical Dance", "Ballet", "Culture", "Arts", "Lifestyle"],
    "publisher": {
      "@type": "Organization",
      "name": "WALCORD",
      "url": "https://walcord.com",
      "logo": "https://mbrdycxpztjtgsiyxikt.supabase.co/storage/v1/object/public/Assets/logo-walcord.png"
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center">
      <Head>
        {/* Título optimizado para el buscador */}
        <title>WALCORD — Revue Culturelle de Danse Classique & Ballet</title>
        
        {/* Meta descripción e idiomas */}
        <meta 
          name="description" 
          content="Revue culturelle française dédiée à la danse classique et au ballet. Campagnes conceptuelles, vidéos lifestyle, agenda des événements européens et interviews exclusives." 
        />
        <meta 
          name="keywords" 
          content="Walcord, danse classique, ballet, revue culturelle, entrevistas danza, agenda ballet europe, lifestyle ballet, Adrian Germont" 
        />
        <meta httpEquiv="content-language" content="fr, es, en, it" />

        {/* Open Graph (Cómo se ve al compartir el enlace en redes/WhatsApp) */}
        <meta property="og:title" content="WALCORD — Revue Culturelle de Danse Classique" />
        <meta property="og:description" content="Revue culturelle française consacrée à la danse classique, campagnes conceptuelles, agenda des événements en Europe et interviews." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://walcord.com" />
        <meta property="og:image" content="https://mbrdycxpztjtgsiyxikt.supabase.co/storage/v1/object/public/Assets/logo-walcord.png" />

        {/* Marcado JSON-LD para que Google cree la entidad oficial */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
        />
      </Head>

      {/* LOGO NUEVO */}
      <img 
        src="https://mbrdycxpztjtgsiyxikt.supabase.co/storage/v1/object/public/Assets/logo-walcord.png" 
        alt="Walcord - Revue Culturelle de Danse Classique" 
        style={{ width: '160px', height: 'auto', objectFit: 'contain' }} 
      />

      {/* LOADER EDITORIAL (Círculo ultra fino) */}
      <div className="editorial-ring mt-12"></div>

      <style jsx>{`
        .editorial-ring {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 1px solid rgba(0, 0, 0, 0.05); 
          border-top-color: #000000; 
          animation: spin 0.85s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
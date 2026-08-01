'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import Head from 'next/head';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session;

        // Mantenemos la animación premium 1.2 segundos
        await new Promise((r) => setTimeout(r, 1200));
        if (cancelled) return;

        if (!session) {
          router.replace('/login');
        } else {
          // 🚀 Como hemos eliminado el onboarding, vamos directos al portal
          router.replace('/feed'); 
        }
      } catch (e) {
        router.replace('/login');
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center">
      <Head>
        <title>WALCORD</title>
      </Head>

      {/* LOGO NUEVO */}
      <img 
        src="https://mbrdycxpztjtgsiyxikt.supabase.co/storage/v1/object/public/Assets/logo-walcord.png" 
        alt="Walcord" 
        style={{ width: '160px', height: 'auto', objectFit: 'contain' }} 
      />

      {/* LOADER EDITORIAL (Círculo ultra fino) */}
      <div className="editorial-ring mt-12"></div>

      <style jsx>{`
        .editorial-ring {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          /* Un borde gris casi invisible para marcar el recorrido */
          border: 1px solid rgba(0, 0, 0, 0.05); 
          /* La línea negra pura y fina que gira */
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
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { supabase } from '../lib/supabaseClient';

const WALCORD_BLUE = '#1F48AF';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        // 1) Comprobar si hay sesión persistida
        const { data } = await supabase.auth.getSession();
        const session = data?.session;

        // Mantener la animación premium
        await new Promise((r) => setTimeout(r, 1200));
        if (cancelled) return;

        if (!session) {
          router.replace('/login');
          return;
        }

        // 2) Decidir onboarding vs feed
        const userId = session.user.id;

        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', userId)
          .maybeSingle();

        if (cancelled) return;

        if (profile && profile.onboarding_completed === false) {
          router.replace('/onboarding');
        } else {
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
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="flex flex-col items-center">
        {/* Logo */}
        <div className="logoCoin">
          <div className="logoInner">
            <Image
              src="/logotipo-dark.png"
              alt="Walcord"
              width={88}
              height={88}
              priority
            />
          </div>
        </div>

        {/* Loader — single thin blue line */}
        <div className="loaderRing mt-10" />
      </div>

      <style jsx>{`
        .logoCoin {
          width: 96px;
          height: 96px;
          border-radius: 9999px;
          background: #ffffff;
          display: grid;
          place-items: center;
          position: relative;
        }

        .logoInner {
          width: 88px;
          height: 88px;
          border-radius: 9999px;
          overflow: hidden;
          display: grid;
          place-items: center;
        }

        /* 🔵 Editorial ultra-minimal loader */
        .loaderRing {
          width: 28px;
          height: 28px;
          border-radius: 9999px;
          border: 1px solid transparent;
          border-top-color: ${WALCORD_BLUE};
          animation: spin 0.9s linear infinite;
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

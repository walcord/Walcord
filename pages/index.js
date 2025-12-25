'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';

const WALCORD_BLUE = '#1F48AF';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace('/login');
    }, 1200);

    return () => clearTimeout(t);
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
          overflow: hidden; /* elimina borde cuadrado del PNG */
          display: grid;
          place-items: center;
        }

        /* 🔵 Editorial ultra-minimal loader */
        .loaderRing {
          width: 28px;
          height: 28px;
          border-radius: 9999px;

          /* SOLO una línea */
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

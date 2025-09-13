'use client';

import Image from 'next/image';
import Link from 'next/link';

/** CTA App Store sin logo (pill limpia) */
function AppStoreCTA({ className = '' }: { className?: string }) {
  return (
    <a
      href="https://apps.apple.com/es/app/walcord/id6751656616"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium bg-black text-white hover:bg-neutral-800 transition ${className}`}
      style={{ fontFamily: 'Roboto, sans-serif' }}
    >
      Download on the App Store
    </a>
  );
}

/** Tarjeta de feature */
function Feature({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl p-6 bg-white shadow-sm">
      <div className="w-10 h-10 rounded-xl bg-[#004AAD]/10 text-[#004AAD] flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-xl mb-2" style={{ fontFamily: 'Times New Roman, serif' }}>
        {title}
      </h3>
      <p className="text-neutral-700" style={{ fontFamily: 'Roboto, sans-serif' }}>
        {text}
      </p>
    </div>
  );
}

export default function Showcase() {
  return (
    <main className="min-h-screen bg-white text-black">
      {/* =========================== HERO =========================== */}
      <section className="relative overflow-hidden" style={{ backgroundColor: '#004AAD' }}>
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          {/* Logo */}
          <div className="w-full flex justify-center pt-10 md:pt-14">
            <Image src="/logotipo.png" alt="Walcord" width={76} height={76} priority />
          </div>

          <div className="grid md:grid-cols-2 gap-10 items-center pt-8 md:pt-10 pb-16 md:pb-24">
            {/* Copy + CTA */}
            <div className="text-white">
              {/* 2 líneas forzadas */}
              <h1
                className="text-3xl sm:text-5xl md:text-6xl leading-tight md:leading-[1.1] font-normal mb-5"
                style={{ fontFamily: 'Times New Roman, serif' }}
              >
                Walcord.<br />
                <span className="block text-3xl sm:text-4xl md:text-[2.9rem]">
                  Designed for music people.
                </span>
              </h1>

              {/* Mensaje basado en tu post de LinkedIn */}
              <p
                className="text-base md:text-xl opacity-90 max-w-xl mb-6"
                style={{ fontFamily: 'Roboto, sans-serif' }}
              >
                Walcord is a home for people who live through music. Share the concerts you’ve attended, archive your favourite records, artists, genres and songs, connect through memories and opinions, and access original content and interviews — all in a space made only for music.
              </p>

              <div className="flex items-center gap-4">
                <AppStoreCTA />
                <Link
                  href="/signup"
                  className="hidden sm:inline-flex px-5 py-2.5 rounded-full bg-white/10 text-white hover:bg-white/15 transition text-sm"
                  style={{ fontFamily: 'Roboto, sans-serif' }}
                >
                  Create account
                </Link>
              </div>
            </div>

            {/* Mockup principal (sin rings/borders que generaban líneas) */}
            <div className="relative mx-auto w-full max-w-sm rounded-[28px] overflow-hidden shadow-2xl" style={{ backgroundColor: '#004AAD' }}>
              <div className="p-3 md:p-4">
                <div className="relative w-full aspect-[9/16]">
                  <Image
                    src="/showcase/wall.png"
                    alt="Walcord — The Wall"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================== FEATURES ========================== */}
      <section className="max-w-6xl mx-auto px-6 md:px-8 py-12 md:py-20">
        <div className="grid md:grid-cols-3 gap-8">
          <Feature
            title="The Wall"
            text="Your home feed with memories, recommendations and collections in an editorial layout."
            icon={
              <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden>
                <rect x="3" y="4" width="18" height="6" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <rect x="3" y="12" width="18" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            }
          />
          <Feature
            title="Concert journal"
            text="Posts with photos, city and year. See who attended with you and keep everything beautifully organized."
            icon={
              <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden>
                <path d="M4 5h16v14H4z" fill="currentColor" opacity=".12" />
                <path d="M4 5h16v14H4z" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <circle cx="8" cy="9" r="1.5" fill="currentColor" />
                <path d="M4 15l4-3 3 2 4-3 5 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            }
          />
          <Feature
            title="Ratings & favourites"
            text="Tactile 1–10 ratings for records, plus favourites for artists, records and songs."
            icon={
              <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <text x="12" y="15" textAnchor="middle" fontSize="8" fill="currentColor">10</text>
              </svg>
            }
          />
        </div>
      </section>

      {/* ===================== SCREENSHOTS (CAROUSEL) ===================== */}
      <section className="max-w-6xl mx-auto px-0 md:px-8 pb-8 md:pb-16">
        <div className="px-6">
          <h2 className="text-2xl md:text-3xl mb-4" style={{ fontFamily: 'Times New Roman, serif' }}>
            A look inside
          </h2>
        </div>

        {/* Azul unificado y SANS ring/border para evitar líneas */}
        <div className="relative">
          <div className="flex gap-6 overflow-x-auto px-6 pb-4 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              { src: '/showcase/record.png', alt: 'Record detail — rating 1–10' },
              { src: '/showcase/post.png', alt: 'Concert post — gallery & attendees' },
              { src: '/showcase/comments.png', alt: 'The Wall — recommendations & comments' },
              { src: '/showcase/profile.png', alt: 'Profile — favourites & concerts' },
            ].map((s, i) => (
              <figure
                key={i}
                className="snap-center shrink-0 w-[85%] sm:w-[60%] md:w-[32%] rounded-3xl overflow-hidden shadow-xl"
                style={{ backgroundColor: '#004AAD' }}
              >
                <div className="relative aspect-[9/16] p-3">
                  <Image src={s.src} alt={s.alt} fill className="object-contain" />
                </div>
                <figcaption className="p-4 text-sm text-neutral-600 bg-white">
                  {s.alt}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ========================= CLOSING CTA ========================= */}
      <section className="max-w-6xl mx-auto px-6 md:px-8 py-14 md:py-20">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div
            className="relative rounded-[24px] overflow-hidden shadow-2xl"
            style={{ backgroundColor: '#004AAD' }}
          >
            <div className="relative w-full aspect-[9/16] p-4">
              <Image
                src="/showcase/profile.png"
                alt="Walcord — Profile"
                fill
                className="object-contain"
              />
            </div>
          </div>
          <div>
            <h3 className="text-3xl md:text-4xl mb-4" style={{ fontFamily: 'Times New Roman, serif' }}>
              Built with taste.
            </h3>
            <p className="text-neutral-700 mb-6" style={{ fontFamily: 'Roboto, sans-serif' }}>
              Explore the app, then join the private network for music people — your concerts, records and friends in one place.
            </p>
            <div className="flex items-center gap-4">
              <AppStoreCTA />
              <Link
                href="/login"
                className="px-5 py-2.5 rounded-full border border-neutral-300 hover:bg-neutral-100 transition text-sm"
                style={{ fontFamily: 'Roboto, sans-serif' }}
              >
                Log in
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

'use client';

import Image from 'next/image';

export default function Download() {
  return (
    <div
      className="relative flex flex-col items-center justify-center min-h-screen px-4"
      style={{ backgroundColor: '#1F48AF' }}
    >
      {/* Logo */}
      <Image
        src="/logotipo.png"
        alt="Walcord Logo"
        width={88}
        height={88}
        priority
        className="mb-12"
      />

      {/* App Store button */}
      <a
        href="https://apps.apple.com/es/app/walcord/id6751656616"
        target="_blank"
        rel="noopener noreferrer"
        className="
          px-6 py-3
          rounded-full
          bg-white text-[#1F48AF]
          text-sm font-normal
          shadow-sm
          hover:shadow-md hover:-translate-y-[1px]
          active:translate-y-0
          transition-all
        "
        style={{ fontFamily: 'Roboto, sans-serif' }}
      >
        Download on the App Store
      </a>
    </div>
  );
}

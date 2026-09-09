import React, { useState } from 'react';
import Link from 'next/link';
import { useLanguage, Language } from '../../context/LanguageContext';

interface HeaderProps {
  onOpenMenu: () => void;
}

export default function Header({ onOpenMenu }: HeaderProps) {
  const { language, setLanguage } = useLanguage();
  const [isLangOpen, setIsLangOpen] = useState(false);

  const handleLangChange = (lang: Language) => {
    setLanguage(lang); // Esto cambiará el idioma en toda la app
    setIsLangOpen(false); // Cierra el menú tras seleccionar
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-28 bg-white/90 backdrop-blur-md z-[40] flex items-center justify-between px-6 md:px-12 transition-all duration-300">
      
      {/* Botón de Menú (Izquierda) */}
      <button onClick={onOpenMenu} className="w-8 h-8 flex flex-col justify-center space-y-1.5 focus:outline-none">
        <span className="block w-6 h-[1px] bg-black"></span>
        <span className="block w-6 h-[1px] bg-black"></span>
      </button>

      {/* Logo (Centro) */}
      <Link href="/" className="absolute left-1/2 -translate-x-1/2 text-4xl tracking-tight text-black font-serif">
        Walcord
      </Link>

      {/* Selector de Idiomas (Derecha) */}
      <div className="relative">
        <button 
          onClick={() => setIsLangOpen(!isLangOpen)}
          className="text-[10px] tracking-widest uppercase font-light text-black flex items-center gap-1 hover:opacity-70"
        >
          {language} <span className="text-[8px]">{isLangOpen ? '▲' : '▼'}</span>
        </button>

        {isLangOpen && (
          <div className="absolute right-0 top-full mt-2 w-16 bg-white border border-gray-100 shadow-sm flex flex-col py-1 z-[50]">
            {(['FR', 'EN', 'ES', 'IT'] as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => handleLangChange(lang)}
                className={`text-[10px] tracking-widest uppercase py-2 hover:bg-gray-50 transition-colors ${
                  language === lang ? 'font-medium' : 'font-light'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
import React from 'react';

interface HeaderProps {
  onOpenMenu: () => void;
}

export default function Header({ onOpenMenu }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 w-full bg-white/90 backdrop-blur-md z-40 transition-all duration-300">
      <div className="flex justify-between items-center px-6 py-4 md:px-12 md:py-6">
        
        {/* Hamburguesa extra fina */}
        <button 
          onClick={onOpenMenu} 
          className="text-black hover:opacity-50 transition-opacity duration-300 focus:outline-none"
        >
          <svg className="w-7 h-7 font-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.8} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Logo estilo Editorial */}
        <h1 className="text-4xl md:text-5xl font-serif text-black cursor-pointer tracking-tight">
          Walcord
        </h1>

        {/* Espaciador para centrar */}
        <div className="w-7 h-7"></div>
      </div>
    </header>
  );
}
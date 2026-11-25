import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface FilmCardProps {
  film: any;
}

export default function FilmCard({ film }: FilmCardProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const { language, t } = useLanguage();

  const langKey = language ? language.toLowerCase() : 'fr';
  const localizedTitle = film[`title_${langKey}`] || film.title;
  const localizedSynopsis = film[`synopsis_${langKey}`] || film.synopsis;

  // Bloquear scroll de la página de atrás cuando el modal está abierto
  useEffect(() => {
    if (isDetailsOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setIsPlaying(false);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDetailsOpen]);

  const getYouTubeId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const videoId = getYouTubeId(film.youtube_url);

  const handleCloseAll = () => {
    setIsPlaying(false);
    setIsDetailsOpen(false);
  };

  return (
    <>
      {/* 1. TARJETA DE PÓSTER EN EL CATÁLOGO */}
      <article
        onClick={() => setIsDetailsOpen(true)}
        className="group cursor-pointer flex flex-col w-full"
      >
        <div className="relative w-full aspect-[2/3] overflow-hidden bg-gray-100 mb-3 md:mb-5">
          <img
            src={film.poster_url || 'https://via.placeholder.com/800x1200'}
            alt={localizedTitle}
            className="w-full h-full object-cover transition-transform duration-[1.4s] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] md:group-hover:scale-105"
            loading="lazy"
          />

          {/* Overlay sutil solo en escritorio */}
          <div className="hidden md:flex absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 items-center justify-center">
            <span className="px-5 py-2.5 bg-white/95 text-black text-[10px] tracking-[0.25em] uppercase font-normal">
              {t('watch_film')}
            </span>
          </div>
        </div>

        {/* Pie editorial bajo el póster */}
        <div className="flex flex-col space-y-1">
          <div className="flex items-center justify-between text-[9px] md:text-[10px] tracking-[0.18em] uppercase text-gray-400 font-light">
            <span className="truncate pr-2">{film.director}</span>
            <span className="shrink-0">
              {film.release_year}
              {film.release_year && film.duration ? ' · ' : ''}
              {film.duration}
            </span>
          </div>
          <h2 className="text-lg md:text-2xl font-serif font-normal tracking-tight text-gray-900 md:group-hover:opacity-60 transition-opacity">
            {localizedTitle}
          </h2>
        </div>
      </article>

      {/* 2. MODAL DE FICHA TÉCNICA (ADAPTADO 100% A MÓVIL Y ESCRITORIO) */}
      {isDetailsOpen && !isPlaying && (
        <div
          className="fixed inset-0 z-[100] bg-white md:bg-black/75 md:backdrop-blur-sm md:flex md:items-center md:justify-center md:p-8 lg:p-12 overflow-y-auto"
          onClick={handleCloseAll}
        >
          <div
            className="relative w-full min-h-[100dvh] md:min-h-0 md:max-w-5xl md:max-h-[90vh] bg-white text-black md:shadow-2xl md:overflow-y-auto flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera fija superior */}
            <div className="sticky top-0 z-30 flex items-center justify-between px-5 py-4 md:px-10 md:py-5 bg-white/95 backdrop-blur-sm border-b border-gray-100">
              <span className="text-[9px] md:text-[10px] tracking-[0.25em] uppercase text-gray-400 font-light">
                WALCORD FILMS
              </span>
              <button
                onClick={handleCloseAll}
                className="py-1 px-2 text-[10px] tracking-[0.25em] uppercase text-gray-600 hover:text-black transition-colors"
              >
                {t('close')} &times;
              </button>
            </div>

            {/* Contenido de la ficha */}
            <div className="p-6 pb-20 md:p-10 lg:p-12 flex flex-col md:grid md:grid-cols-12 md:gap-10 lg:gap-12 items-start">
              
              {/* Póster: compacto y centrado en móvil (w-44), columna completa en PC */}
              <div className="w-44 sm:w-52 mx-auto mb-6 md:mb-0 md:w-full md:col-span-5 lg:col-span-4 shrink-0">
                <div className="relative aspect-[2/3] w-full bg-gray-100 overflow-hidden shadow-sm">
                  <img
                    src={film.poster_url}
                    alt={localizedTitle}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Información, Botón Play y Créditos */}
              <div className="w-full md:col-span-7 lg:col-span-8 flex flex-col">
                {/* Año y Duración */}
                <div className="flex items-center justify-center md:justify-start gap-2.5 text-[10px] tracking-[0.22em] uppercase text-gray-400 mb-2">
                  {film.release_year && <span>{film.release_year}</span>}
                  {film.release_year && film.duration && <span>•</span>}
                  {film.duration && <span>{film.duration}</span>}
                </div>

                {/* Título */}
                <h2 className="text-2xl sm:text-3xl md:text-5xl font-serif font-normal tracking-tight text-gray-900 leading-[1.15] text-center md:text-left mb-6 md:mb-8">
                  {localizedTitle}
                </h2>

                {/* Botón Ver Película */}
                <div className="mb-8 md:mb-10">
                  <button
                    onClick={() => setIsPlaying(true)}
                    className="w-full md:w-auto px-8 py-4 bg-black text-white text-[10px] md:text-[11px] tracking-[0.28em] uppercase font-normal active:scale-[0.99] hover:bg-gray-800 transition-all flex items-center justify-center gap-3"
                  >
                    <span className="text-xs">&#9654;</span>
                    <span>{t('watch_film')}</span>
                  </button>
                </div>

                {/* Sinopsis */}
                {localizedSynopsis && (
                  <div className="mb-8 pb-7 border-b border-gray-100">
                    <h3 className="text-[9px] md:text-[10px] tracking-[0.25em] uppercase text-gray-400 mb-2.5">
                      {t('synopsis')}
                    </h3>
                    <p className="text-[13px] md:text-[15px] leading-relaxed text-gray-700 font-light whitespace-pre-line">
                      {localizedSynopsis}
                    </p>
                  </div>
                )}

                {/* Ficha Técnica (Director, Duración, Reparto) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-8 text-xs">
                  {film.director && (
                    <div className="border-b border-gray-100 pb-3">
                      <span className="block text-[9px] tracking-[0.25em] uppercase text-gray-400 mb-1">
                        {t('director')}
                      </span>
                      <span className="text-gray-900 font-normal tracking-wide">
                        {film.director}
                      </span>
                    </div>
                  )}

                  {film.duration && (
                    <div className="border-b border-gray-100 pb-3">
                      <span className="block text-[9px] tracking-[0.25em] uppercase text-gray-400 mb-1">
                        {t('duration')}
                      </span>
                      <span className="text-gray-900 font-normal tracking-wide">
                        {film.duration}
                      </span>
                    </div>
                  )}

                  {film.cast_members && (
                    <div className="border-b border-gray-100 pb-3 sm:col-span-2">
                      <span className="block text-[9px] tracking-[0.25em] uppercase text-gray-400 mb-1">
                        {t('cast')}
                      </span>
                      <span className="text-gray-900 font-normal tracking-wide leading-relaxed">
                        {film.cast_members}
                      </span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 3. REPRODUCTOR DE VÍDEO FULLSCREEN (IDÉNTICO A VIDEOCARD PARA MÓVIL Y PC) */}
      {isDetailsOpen && isPlaying && (
        <div
          className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black p-4 md:p-10"
          onClick={() => setIsPlaying(false)}
        >
          {/* Barra superior en reproductor */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-5 md:p-8 z-[120]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsPlaying(false);
              }}
              className="text-white text-[10px] tracking-[0.25em] uppercase hover:text-gray-400 transition-colors"
            >
              &larr; {t('back')}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCloseAll();
              }}
              className="text-white text-[10px] tracking-[0.25em] uppercase hover:text-gray-400 transition-colors"
            >
              {t('close')} &times;
            </button>
          </div>

          {/* Contenedor 16:9 ajustado al ancho del teléfono */}
          <div
            className="relative w-full max-w-6xl aspect-video bg-black shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {videoId ? (
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`}
                title={localizedTitle}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full text-white text-xs tracking-widest uppercase">
                INVALID VIDEO LINK
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
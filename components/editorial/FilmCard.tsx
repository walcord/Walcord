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

  // Bloquear scroll del fondo cuando la ficha técnica está abierta
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

  const handleCloseModal = () => {
    setIsPlaying(false);
    setIsDetailsOpen(false);
  };

  return (
    <>
      {/* TARJETA DE PÓSTER EN EL CATÁLOGO */}
      <article
        onClick={() => setIsDetailsOpen(true)}
        className="group cursor-pointer flex flex-col"
      >
        {/* Contenedor del póster en formato cine 2:3 */}
        <div className="relative w-full aspect-[2/3] overflow-hidden bg-gray-100 mb-5">
          <img
            src={film.poster_url || 'https://via.placeholder.com/800x1200'}
            alt={localizedTitle}
            className="w-full h-full object-cover transition-transform duration-[1.4s] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:scale-105"
            loading="lazy"
          />

          {/* Overlay sutil en hover (Desktop) */}
          <div className="hidden md:flex absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 items-center justify-center">
            <span className="px-5 py-2.5 bg-white/95 text-black text-[10px] tracking-[0.25em] uppercase font-normal">
              {t('watch_film')}
            </span>
          </div>
        </div>

        {/* Pie editorial bajo el póster */}
        <div className="flex flex-col space-y-1.5">
          <div className="flex items-center justify-between text-[10px] tracking-[0.2em] uppercase text-gray-400 font-light">
            <span>{film.director}</span>
            <span>
              {film.release_year}
              {film.release_year && film.duration ? ' — ' : ''}
              {film.duration}
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-serif font-normal tracking-tight text-gray-900 group-hover:opacity-60 transition-opacity">
            {localizedTitle}
          </h2>
        </div>
      </article>

      {/* MODAL FICHA TÉCNICA + STREAMING */}
      {isDetailsOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-0 md:p-8 lg:p-12 overflow-y-auto"
          onClick={handleCloseModal}
        >
          <div
            className="relative w-full max-w-6xl min-h-[100dvh] md:min-h-0 md:max-h-[90vh] bg-white text-black shadow-2xl overflow-y-auto flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Barra superior del Modal */}
            <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-5 md:px-10 md:py-6 bg-white/95 backdrop-blur-sm border-b border-gray-100">
              <span className="text-[9px] md:text-[10px] tracking-[0.3em] uppercase text-gray-400 font-light">
                WALCORD FILMS {film.release_year ? `• ${film.release_year}` : ''}
              </span>
              <button
                onClick={handleCloseModal}
                className="text-[10px] tracking-[0.3em] uppercase text-gray-500 hover:text-black transition-colors"
              >
                {t('close')} &times;
              </button>
            </div>

            {/* MODO REPRODUCCIÓN (YOUTUBE PLAYER) */}
            {isPlaying ? (
              <div className="flex-grow flex flex-col bg-black">
                <div className="relative w-full aspect-video max-h-[78vh] mx-auto bg-black">
                  {videoId ? (
                    <iframe
                      className="absolute inset-0 w-full h-full"
                      src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
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

                {/* Barra inferior para volver a la ficha técnica */}
                <div className="px-6 py-4 md:px-10 bg-white flex items-center justify-between border-t border-gray-100">
                  <span className="font-serif text-lg text-gray-900">{localizedTitle}</span>
                  <button
                    onClick={() => setIsPlaying(false)}
                    className="text-[10px] tracking-[0.25em] uppercase text-gray-500 hover:text-black transition-colors"
                  >
                    &larr; {t('back')}
                  </button>
                </div>
              </div>
            ) : (
              /* MODO FICHA TÉCNICA EDITORIAL */
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 p-6 md:p-10 lg:p-14 items-start">
                
                {/* Columna Izquierda: Póster */}
                <div className="md:col-span-5 lg:col-span-4 w-full max-w-xs mx-auto md:max-w-none">
                  <div className="relative aspect-[2/3] w-full bg-gray-100 overflow-hidden shadow-sm">
                    <img
                      src={film.poster_url}
                      alt={localizedTitle}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* Columna Derecha: Título, Botón Play, Sinopsis y Créditos */}
                <div className="md:col-span-7 lg:col-span-8 flex flex-col justify-between h-full">
                  <div>
                    {/* Metadatos rápidos */}
                    <div className="flex flex-wrap items-center gap-3 text-[10px] tracking-[0.25em] uppercase text-gray-400 mb-3">
                      {film.release_year && <span>{film.release_year}</span>}
                      {film.release_year && film.duration && <span>•</span>}
                      {film.duration && <span>{film.duration}</span>}
                    </div>

                    {/* Título de la película */}
                    <h2 className="text-3xl md:text-5xl font-serif font-normal tracking-tight text-gray-900 leading-[1.1] mb-8">
                      {localizedTitle}
                    </h2>

                    {/* Botón de Reproducción estilo Zara / Streaming */}
                    <div className="mb-10">
                      <button
                        onClick={() => setIsPlaying(true)}
                        className="w-full sm:w-auto px-10 py-4 bg-black text-white text-[11px] tracking-[0.3em] uppercase font-normal hover:bg-gray-800 transition-colors flex items-center justify-center gap-3"
                      >
                        <span className="text-xs">&#9654;</span>
                        <span>{t('watch_film')}</span>
                      </button>
                    </div>

                    {/* Sinopsis */}
                    {localizedSynopsis && (
                      <div className="mb-10 pb-8 border-b border-gray-100">
                        <h3 className="text-[10px] tracking-[0.25em] uppercase text-gray-400 mb-3">
                          {t('synopsis')}
                        </h3>
                        <p className="text-sm md:text-[15px] leading-relaxed text-gray-700 font-light whitespace-pre-line">
                          {localizedSynopsis}
                        </p>
                      </div>
                    )}

                    {/* Tabla de Ficha Técnica (Sin Música) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8 text-xs">
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
            )}
          </div>
        </div>
      )}
    </>
  );
}
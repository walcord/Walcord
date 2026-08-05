import React, { useState } from 'react';

export default function VideoCard({ video }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Función para extraer el ID de YouTube de cualquier formato de URL
  const getYouTubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const videoId = getYouTubeId(video.youtube_url);

  return (
    <>
      {/* 
        TARJETA DE VÍDEO
        Cambiamos la etiqueta <a> por un <div> con un evento onClick
      */}
      <div 
        onClick={() => setIsModalOpen(true)}
        className="group relative block w-full aspect-[4/3] overflow-hidden cursor-pointer bg-gray-50"
      >
        {/* Imagen Base */}
        <img 
          src={video.cover_url || 'https://via.placeholder.com/800x600'} 
          alt={video.title} 
          className="object-cover w-full h-full transition-transform duration-[1.2s] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] md:group-hover:scale-105"
          loading="lazy"
        />
        
        {/* Overlay oscuro (Siempre visible en móvil, hover en PC) */}
        <div className="absolute inset-0 bg-black/25 
                        opacity-100 md:opacity-0 md:group-hover:opacity-100 
                        transition-opacity duration-700 ease-in-out 
                        flex flex-col p-6 pb-8 md:p-10 text-white"
        >
          {/* Sujeto */}
          <span className="block text-[10px] md:text-xs tracking-[0.25em] font-light uppercase">
            {video.subject}
          </span>
          
          {/* Título */}
          <div className="flex-grow flex items-center justify-center text-center px-2">
            <h3 className="text-3xl md:text-5xl font-serif font-normal tracking-tight leading-[1.1] 
                           translate-y-0 md:translate-y-3 md:group-hover:translate-y-0 
                           transition-transform duration-700 ease-out">
              {video.title}
            </h3>
          </div>

          {/* Pie */}
          <div className="flex justify-center w-full">
            <span className="text-[9px] md:text-[10px] tracking-[0.3em] uppercase font-light">
              Watch Video
            </span>
          </div>
        </div>
      </div>

      {/* 
        MODAL DEL REPRODUCTOR (Solo se renderiza si isModalOpen es true) 
      */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 md:p-10 transition-opacity"
          onClick={() => setIsModalOpen(false)} // Cierra el modal si haces clic fuera del vídeo
        >
          {/* Botón de Cerrar */}
          <button 
            onClick={() => setIsModalOpen(false)}
            className="absolute top-6 right-6 md:top-10 md:right-10 text-white text-[10px] tracking-[0.3em] uppercase hover:text-gray-400 transition-colors z-[110]"
          >
            Close ✕
          </button>

          {/* Contenedor del Vídeo (Detiene el clic para que no se cierre si pausas el vídeo) */}
          <div 
            className="relative w-full max-w-6xl aspect-video bg-black shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {videoId ? (
              <iframe
                className="absolute inset-0 w-full h-full"
                // Añadimos autoplay=1 para que empiece solo al abrir el modal
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                title={video.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              ></iframe>
            ) : (
              <div className="flex items-center justify-center w-full h-full text-white text-xs tracking-widest">
                INVALID VIDEO LINK
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
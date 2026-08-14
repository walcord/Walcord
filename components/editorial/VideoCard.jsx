import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

export default function VideoCard({ video }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { language, t } = useLanguage();

  const langKey = language.toLowerCase();
  const localizedTitle = video[`title_${langKey}`] || video.title;
  const localizedSubject = video[`subject_${langKey}`] || video.subject;

  const getYouTubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const videoId = getYouTubeId(video.youtube_url);

  return (
    <>
      <div 
        onClick={() => setIsModalOpen(true)}
        className="group relative block w-full aspect-[4/3] overflow-hidden cursor-pointer bg-gray-50"
      >
        <img 
          src={video.cover_url || 'https://via.placeholder.com/800x600'} 
          alt={localizedTitle} 
          className="object-cover w-full h-full transition-transform duration-[1.2s] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] md:group-hover:scale-105"
          loading="lazy"
        />
        
        <div className="absolute inset-0 bg-black/25 
                        opacity-100 md:opacity-0 md:group-hover:opacity-100 
                        transition-opacity duration-700 ease-in-out 
                        flex flex-col p-6 pb-8 md:p-10 text-white"
        >
          <span className="block text-[10px] md:text-xs tracking-[0.25em] font-light uppercase">
            {localizedSubject}
          </span>
          
          <div className="flex-grow flex items-center justify-center text-center px-2">
            <h3 className="text-3xl md:text-5xl font-serif font-normal tracking-tight leading-[1.1] 
                           translate-y-0 md:translate-y-3 md:group-hover:translate-y-0 
                           transition-transform duration-700 ease-out">
              {localizedTitle}
            </h3>
          </div>

          <div className="flex justify-center w-full">
            <span className="text-[9px] md:text-[10px] tracking-[0.3em] uppercase font-light">
              {t('watch_video')}
            </span>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 md:p-10 transition-opacity"
          onClick={() => setIsModalOpen(false)} 
        >
          <button 
            onClick={() => setIsModalOpen(false)}
            className="absolute top-6 right-6 md:top-10 md:right-10 text-white text-[10px] tracking-[0.3em] uppercase hover:text-gray-400 transition-colors z-[110]"
          >
            {t('close')} ✕
          </button>

          <div 
            className="relative w-full max-w-6xl aspect-video bg-black shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {videoId ? (
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                title={localizedTitle}
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
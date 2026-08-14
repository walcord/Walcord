import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';

export default function EventCard({ event }) {
  const [isOpen, setIsOpen] = useState(false);
  const { language, t } = useLanguage();

  const langKey = language.toLowerCase();
  const localizedTitle = event[`title_${langKey}`] || event.title;
  const localizedSynopsis = event[`synopsis_${langKey}`] || event.synopsis;
  const localizedChoreographer = event[`choreographer_${langKey}`] || event.choreographer;
  const localizedMusic = event[`music_${langKey}`] || event.music;
  const localizedDancers = event[`dancers_${langKey}`] || event.dancers;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const startDateObj = new Date(event.start_date);
  const fallbackDate = startDateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit'
  }).toUpperCase();

  const finalDates = event.display_date || fallbackDate;

  return (
    <>
      <div 
        onClick={() => setIsOpen(true)}
        className="group relative block w-full aspect-[4/3] md:aspect-[16/10] bg-white border border-gray-200 hover:border-black transition-colors duration-500 cursor-pointer p-6 md:p-10 flex flex-col justify-between"
      >
        <div className="flex justify-between items-start text-[10px] md:text-xs tracking-[0.25em] font-light uppercase text-gray-500 border-b border-gray-100 pb-4">
          <span className="text-gray-900 font-normal">{event.house || 'PARIS OPERA'}</span>
          <span>{finalDates}</span>
        </div>

        <div className="my-auto py-6">
          <h3 className="text-3xl md:text-5xl font-serif font-normal text-gray-900 tracking-tight leading-[1.05] group-hover:translate-x-2 transition-transform duration-500 ease-out">
            {localizedTitle}
          </h3>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-gray-100 text-[9px] md:text-[10px] tracking-[0.3em] uppercase text-gray-400 group-hover:text-black transition-colors">
          <span>{t('programme_cast')}</span>
          <span>[+]</span>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="absolute inset-0" onClick={() => setIsOpen(false)} />

          <div className="relative w-full max-w-2xl h-full bg-white text-black z-10 overflow-y-auto flex flex-col justify-between p-8 md:p-14 shadow-2xl">
            <div>
              <div className="flex justify-between items-center mb-12 border-b border-gray-200 pb-4">
                <span className="text-[10px] tracking-[0.3em] uppercase text-gray-400 font-light">
                  {t('season_programme')}
                </span>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="text-xs tracking-[0.2em] uppercase text-gray-900 hover:text-gray-400 transition-colors"
                >
                  {t('close')} ✕
                </button>
              </div>

              <div className="mb-10">
                <span className="block text-[10px] md:text-xs tracking-[0.3em] uppercase text-gray-500 mb-3 font-light">
                  {event.house} — {finalDates}
                </span>
                <h2 className="text-4xl md:text-6xl font-serif font-normal text-gray-900 tracking-tight leading-none">
                  {localizedTitle}
                </h2>
              </div>

              {localizedSynopsis && (
                <div className="mb-12 text-justify font-serif text-gray-700 leading-relaxed text-base md:text-lg border-t border-b border-gray-100 py-8 whitespace-pre-wrap">
                  {localizedSynopsis}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs uppercase tracking-wider mb-12">
                {localizedChoreographer && (
                  <div className="border-l border-gray-200 pl-4 py-1">
                    <span className="block text-[9px] text-gray-400 tracking-[0.25em] mb-1 font-light">{t('choreography')}</span>
                    <span className="font-serif normal-case text-base text-gray-900">{localizedChoreographer}</span>
                  </div>
                )}
                {localizedMusic && (
                  <div className="border-l border-gray-200 pl-4 py-1">
                    <span className="block text-[9px] text-gray-400 tracking-[0.25em] mb-1 font-light">{t('music')}</span>
                    <span className="font-serif normal-case text-base text-gray-900">{localizedMusic}</span>
                  </div>
                )}
                {localizedDancers && (
                  <div className="border-l border-gray-200 pl-4 py-1 md:col-span-2">
                    <span className="block text-[9px] text-gray-400 tracking-[0.25em] mb-1 font-light">{t('principal_cast')}</span>
                    <span className="font-serif normal-case text-base text-gray-900">{localizedDancers}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-8 border-t border-gray-200 flex justify-between items-center text-[10px] tracking-[0.25em] uppercase text-gray-400">
              <span>WALCORD EVENTS</span>
              <span>{event.house}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
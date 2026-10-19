import React from 'react';
import Link from 'next/link';
import { useLanguage } from '../../context/LanguageContext';

export default function ReportCard({ report }) {
  const { language, t } = useLanguage();
  const langKey = language ? language.toLowerCase() : 'fr';
  
  const title = report[`title_${langKey}`] || report.title;

  const date = new Date(report.created_at);
  const fallbackDate = date.toLocaleDateString(language || 'fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).toUpperCase();

  const displayDate = report.display_date || fallbackDate;
  // Prioriza la imagen horizontal para los reports
  const imageUrl = report.cover_horizontal_url || report.cover_url;

  return (
    <Link href={`/reports/${report.id}`} className="group flex flex-col h-full cursor-pointer bg-white border border-gray-100">
      <div className="w-full aspect-[16/9] overflow-hidden bg-gray-50">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={title} 
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-300 text-[10px] tracking-widest uppercase">
            No Image
          </div>
        )}
      </div>
      
      <div className="flex flex-col flex-grow p-6 md:p-8">
        <span className="text-[10px] tracking-[0.2em] uppercase text-gray-400 mb-3 font-light">
          Report — {displayDate}
        </span>

        <h3 className="text-2xl md:text-3xl lg:text-4xl font-serif text-black leading-snug mb-6 group-hover:text-gray-600 transition-colors">
          {title}
        </h3>

        <div className="mt-auto">
          <span className="text-[9px] tracking-[0.2em] uppercase text-black font-medium border-b border-black pb-1 inline-block">
            {t('read_report')}
          </span>
        </div>
      </div>
    </Link>
  );
}
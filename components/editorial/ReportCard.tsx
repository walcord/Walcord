import React from 'react';
import Link from 'next/link';
import { useLanguage } from '../../context/LanguageContext';

export default function ReportCard({ report }: { report: any }) {
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
  const imageUrl = report.cover_horizontal_url || report.cover_url;

  return (
    <Link href={`/reports/${report.id}`} className="group flex flex-col h-full cursor-pointer bg-white">
      {/* Aspect ratio 4/3: más compacto, con cuerpo y perfectamente equilibrado con el 3/4 lateral */}
      <div className="w-full aspect-[4/3] overflow-hidden mb-4 bg-gray-50 flex-shrink-0">
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
      
      {/* Mismo orden que ArticleCard: Título -> Fecha -> Enlace */}
      <div className="flex flex-col">
        <h3 className="text-xl md:text-3xl font-serif text-black leading-snug mb-1 group-hover:text-gray-600 transition-colors">
          {title}
        </h3>

        <span className="text-[10px] tracking-[0.15em] uppercase text-gray-400 mb-2 font-light">
          {displayDate}
        </span>

        <div className="mt-1">
          <span className="text-[9px] tracking-[0.2em] uppercase text-black font-medium border-b border-black pb-1 inline-block">
            {t('read_report')}
          </span>
        </div>
      </div>
    </Link>
  );
}
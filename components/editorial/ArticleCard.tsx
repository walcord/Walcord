import React from 'react';
import Link from 'next/link';
import { useLanguage } from '../../context/LanguageContext';

export default function ArticleCard({ article }: { article: any }) {
  const { language, t } = useLanguage();
  const langKey = language ? language.toLowerCase() : 'fr';
  
  const title = article[`title_${langKey}`] || article.title;

  const date = new Date(article.created_at);
  const fallbackDate = date.toLocaleDateString(language || 'fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).toUpperCase();

  const displayDate = article.display_date || fallbackDate;
  const imageUrl = article.cover_vertical_url || article.cover_url;

  return (
    <Link href={`/articles/${article.id}`} className="group flex flex-col w-full h-full cursor-pointer">
      <div className="w-full aspect-square md:aspect-[3/4] overflow-hidden mb-4 bg-gray-50 flex-shrink-0">
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
      
      <div className="flex flex-col">
        <h3 className="text-xl md:text-2xl font-times text-black leading-snug mb-1 group-hover:text-gray-600 transition-colors">
          {title}
        </h3>

        <span className="text-[10px] tracking-[0.15em] uppercase text-gray-400 mb-2 font-light">
          {displayDate}
        </span>

        {/* mt-1 fijo sin empujarlo al fondo */}
        <div className="mt-1">
          <span className="text-[9px] tracking-[0.2em] uppercase text-black font-medium border-b border-black pb-1 inline-block">
            {t('read_interview') || t('read_article')}
          </span>
        </div>
      </div>
    </Link>
  );
}
import React from 'react';
import Link from 'next/link';
import { useLanguage } from '../../context/LanguageContext';

export default function ArticleCard({ article }) {
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
    <Link href={`/articles/${article.id}`} className="group flex flex-col w-full cursor-pointer h-full">
      <div className="w-full aspect-[3/4] overflow-hidden mb-4 bg-gray-50">
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
      
      <div className="flex flex-col flex-grow">
        <h3 className="text-xl md:text-2xl font-serif text-black leading-snug mb-2 group-hover:text-gray-600 transition-colors">
          {title}
        </h3>

        <span className="text-[10px] tracking-[0.15em] uppercase text-gray-400 mb-4 font-light">
          {displayDate}
        </span>

        <div className="mt-auto pt-2">
          <span className="text-[9px] tracking-[0.2em] uppercase text-black font-medium border-b border-black pb-1 inline-block">
            {t('read_article')}
          </span>
        </div>
      </div>
    </Link>
  );
}
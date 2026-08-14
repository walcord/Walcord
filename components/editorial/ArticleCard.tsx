import React from 'react';
import Link from 'next/link';
import { useLanguage } from '../../context/LanguageContext';

export default function ArticleCard({ article }) {
  const { language, t } = useLanguage();
  const langKey = language.toLowerCase();
  
  const title = article[`title_${langKey}`] || article.title;
  const subtitle = article[`subtitle_${langKey}`] || article.subtitle;

  return (
    <Link href={`/articles/${article.id}`} className="group flex flex-col w-full cursor-pointer h-full">
      {/* Contenedor de la imagen proporcionado (3:4) */}
      <div className="w-full aspect-[3/4] overflow-hidden mb-4 bg-gray-50">
        {article.cover_url ? (
          <img 
            src={article.cover_url} 
            alt={title} 
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-300">
            No Image
          </div>
        )}
      </div>
      
      {/* Textos contenidos (Estilo Revista) */}
      <div className="flex flex-col flex-grow">
        <h3 className="text-xl md:text-2xl font-serif text-black leading-snug mb-2 group-hover:text-gray-600 transition-colors">
          {title}
        </h3>
        {subtitle && (
          <p className="text-sm text-gray-500 line-clamp-2 mb-4 font-light">
            {subtitle}
          </p>
        )}
        <div className="mt-auto pt-2">
          <span className="text-[9px] tracking-[0.2em] uppercase text-black font-medium border-b border-black pb-1 inline-block">
            {t('read_article')}
          </span>
        </div>
      </div>
    </Link>
  );
}
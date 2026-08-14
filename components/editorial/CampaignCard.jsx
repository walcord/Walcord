import Link from 'next/link';
import { useLanguage } from '../../context/LanguageContext';

export default function CampaignCard({ campaign }) {
  const { language } = useLanguage();
  const langKey = language.toLowerCase();
  
  const localizedTitle = campaign[`title_${langKey}`] || campaign.title;
  const localizedSubjects = campaign[`subjects_${langKey}`] || campaign.subjects;

  const date = new Date(campaign.created_at);
  const fallbackDate = `${date.toLocaleString('en-US', { month: 'short' })}. ${date.getFullYear().toString().slice(2)}'`.toUpperCase();
  const finalDate = campaign.display_date || fallbackDate;

  return (
    <Link 
      href={`/campaigns/${campaign.id}`} 
      className="group relative block w-full aspect-[4/5] md:aspect-[3/4] overflow-hidden cursor-pointer bg-gray-50"
    >
      <img 
        src={campaign.cover_url || 'https://via.placeholder.com/800x1200'} 
        alt={localizedTitle} 
        className="object-cover w-full h-full transition-transform duration-[1.2s] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] md:group-hover:scale-105"
        loading="lazy"
      />
      
      <div className="absolute inset-0 bg-black/20 
                      opacity-100 md:opacity-0 md:group-hover:opacity-100 
                      transition-opacity duration-700 ease-in-out 
                      flex flex-col justify-between p-6 pb-12 md:p-10 text-white"
      >
        <span className="block text-[10px] md:text-xs tracking-[0.25em] font-light uppercase">
          {finalDate}
        </span>
        
        <div className="flex flex-col items-center text-center 
                        translate-y-0 md:translate-y-4 md:group-hover:translate-y-0 
                        transition-transform duration-700 ease-out">
          <h3 className="text-3xl md:text-5xl font-serif font-normal mb-3 md:mb-4 tracking-tight px-4">
            {localizedTitle}
          </h3>
          <p className="text-[9px] md:text-[10px] tracking-[0.3em] uppercase font-light">
            {localizedSubjects}
          </p>
        </div>
      </div>
    </Link>
  );
}
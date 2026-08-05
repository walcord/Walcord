import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from '../components/editorial/Header';
import MenuDrawer from '../components/editorial/MenuDrawer';
import { supabase } from '../lib/supabaseClient';

export default function Critics() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [critics, setCritics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCritics = async () => {
      const { data, error } = await supabase
        .from('critics')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setCritics(data);
      } else {
        console.error("Error fetching critics:", error);
      }
      setLoading(false);
    };

    fetchCritics();
  }, []);

  const leadCritic = critics.length > 0 ? critics[0] : null;
  const otherCritics = critics.length > 1 ? critics.slice(1) : [];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: '2-digit', 
      year: 'numeric' 
    }).toUpperCase();
  };

  return (
    <div className="min-h-[100dvh] bg-white text-black font-sans selection:bg-black selection:text-white">
      <Head>
        <title>Critics - WALCORD</title>
      </Head>

      <Header onOpenMenu={() => setIsMenuOpen(true)} />
      <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="pt-28 md:pt-40 px-6 sm:px-10 md:px-12 max-w-[1600px] mx-auto pb-24">
        <div className="flex flex-col items-center mb-16 md:mb-24">
          <h1 className="text-xs tracking-[0.4em] uppercase text-gray-900 font-light mb-4">
            Critics
          </h1>
          <div className="w-[1px] h-12 bg-gray-300"></div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-[30vh]">
            <span className="text-[10px] tracking-[0.2em] uppercase text-gray-400 animate-pulse">Loading Archive...</span>
          </div>
        ) : !leadCritic ? (
          <div className="text-center py-20">
            <p className="text-xs tracking-[0.25em] uppercase text-gray-400">No critics published yet.</p>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto flex flex-col gap-24">
            
            <Link href={`/critics/${leadCritic.id}`} className="group block border-b border-gray-300 pb-16">
              <div className="flex flex-col md:items-center text-left md:text-center">
                <span className="text-[10px] md:text-xs tracking-[0.3em] uppercase text-gray-500 mb-6 font-light">
                  Latest Critic — {formatDate(leadCritic.created_at)}
                </span>
                
                {leadCritic.venue && (
                  <span className="text-[10px] tracking-[0.2em] uppercase text-gray-400 mb-2">
                    {leadCritic.venue}
                  </span>
                )}

                <h2 className="text-5xl md:text-7xl font-serif font-normal text-gray-900 tracking-tight leading-[1.05] mb-4 group-hover:text-gray-600 transition-colors">
                  {leadCritic.title}
                </h2>
                
                <p className="text-base md:text-lg font-serif text-gray-600 max-w-2xl leading-relaxed mb-10 line-clamp-2">
                  {leadCritic.content}
                </p>
              </div>
            </Link>

            {otherCritics.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-16">
                {otherCritics.map((critic) => (
                  <Link href={`/critics/${critic.id}`} key={critic.id} className="group block border-t border-black pt-6">
                    <div className="mb-4">
                      <span className="text-[9px] tracking-[0.25em] uppercase text-gray-500">
                        {formatDate(critic.created_at)}
                      </span>
                    </div>
                    
                    {critic.venue && (
                      <span className="block text-[9px] tracking-[0.2em] uppercase text-gray-400 mb-2">
                        {critic.venue}
                      </span>
                    )}

                    <h3 className="text-3xl font-serif font-normal text-gray-900 leading-tight mb-4 group-hover:translate-x-2 transition-transform duration-500 ease-out">
                      {critic.title}
                    </h3>
                    
                    <p className="text-sm font-serif text-gray-600 line-clamp-2 leading-relaxed mb-6">
                      {critic.content}
                    </p>
                    <span className="text-[9px] tracking-[0.2em] uppercase text-gray-900 border-b border-transparent group-hover:border-black pb-1 transition-all">
                      Read Full Critic
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
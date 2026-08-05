import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Header from '../../components/editorial/Header';
import MenuDrawer from '../../components/editorial/MenuDrawer';
import { supabase } from '../../lib/supabaseClient';

export default function CriticDetail() {
  const router = useRouter();
  const { id } = router.query;
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [critic, setCritic] = useState(null); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchCritic = async () => {
      const { data, error } = await supabase
        .from('critics')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        setCritic(data);
      } else {
        console.error("Error fetching critic detail:", error);
      }
      setLoading(false);
    };

    fetchCritic();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex justify-center items-center">
        <span className="text-[10px] tracking-[0.2em] uppercase text-gray-400 animate-pulse">Loading Critic...</span>
      </div>
    );
  }

  if (!critic) {
    return (
      <div className="min-h-screen bg-white flex flex-col justify-center items-center gap-6">
        <span className="text-[10px] tracking-[0.2em] uppercase text-gray-900">Critic not found</span>
        <Link href="/critics" className="text-xs border-b border-black pb-1">Back to Critics</Link>
      </div>
    );
  }

  const formattedDate = new Date(critic.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  }).toUpperCase();

  return (
    <div className="min-h-[100dvh] bg-white text-black font-sans selection:bg-black selection:text-white">
      <Head>
        <title>{critic.title} - WALCORD</title>
      </Head>

      <Header onOpenMenu={() => setIsMenuOpen(true)} />
      <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="pt-32 md:pt-48 px-6 sm:px-10 pb-32">
        <article className="max-w-3xl mx-auto">
          
          <header className="mb-16 md:mb-24 text-center">
            <span className="block text-[10px] tracking-[0.3em] uppercase text-gray-500 mb-6 font-light">
              Critic
            </span>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-normal text-gray-900 tracking-tight leading-[1.05] mb-6">
              {critic.title}
            </h1>

            {critic.content && (
              <p className="text-xl md:text-2xl font-serif text-gray-500 italic mb-10 max-w-2xl mx-auto">
                "{critic.content}"
              </p>
            )}
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 pt-8 border-t border-gray-200 text-[10px] tracking-[0.25em] uppercase text-gray-900">
              {critic.venue && (
                <>
                  <span>{critic.venue}</span>
                  <span className="hidden md:inline-block w-1 h-1 bg-gray-300 rounded-full"></span>
                </>
              )}
              <span>{formattedDate}</span>
            </div>
          </header>

          <div className="prose prose-stone prose-lg max-w-none text-gray-800 font-serif leading-loose text-justify md:text-left">
            <p className="
              first-letter:text-7xl 
              first-letter:font-serif 
              first-letter:float-left 
              first-letter:mr-4 
              first-letter:mt-2 
              first-letter:text-black
              whitespace-pre-wrap
            ">
              {critic.full_text || 'Full critic text will appear here.'}
            </p>
          </div>

        </article>
      </main>
    </div>
  );
}
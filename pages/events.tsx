import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Header from '../components/editorial/Header';
import MenuDrawer from '../components/editorial/MenuDrawer';
import EventCard from '../components/editorial/EventCard';
import { supabase } from '../lib/supabaseClient';

export default function Events() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [groupedEvents, setGroupedEvents] = useState<{ [key: string]: any[] }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      const today = new Date().toISOString().split('T')[0];

      // Trae eventos cuyo fin (o inicio si no tiene fin) sea hoy o futuro
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`)
        .eq('is_archived', false)
        .order('start_date', { ascending: true });

      if (!error && data) {
        const grouped: { [key: string]: any[] } = {};

        data.forEach((event) => {
          const startDate = new Date(event.start_date);
          const endDate = event.end_date ? new Date(event.end_date) : new Date(event.start_date);

          // Iterador desde el primer día del mes de inicio hasta el mes de fin
          let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
          const lastMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

          while (current <= lastMonth) {
            const monthYearKey = current.toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric'
            }).toUpperCase();

            if (!grouped[monthYearKey]) {
              grouped[monthYearKey] = [];
            }

            grouped[monthYearKey].push(event);

            // Avanzar al siguiente mes
            current.setMonth(current.getMonth() + 1);
          }
        });

        setGroupedEvents(grouped);
      } else if (error) {
        console.error("Error fetching events:", error);
      }
      setLoading(false);
    };

    fetchEvents();
  }, []);

  const monthKeys = Object.keys(groupedEvents);

  return (
    <div className="min-h-[100dvh] bg-white text-black font-sans selection:bg-black selection:text-white">
      <Head>
        <title>Events - WALCORD</title>
      </Head>

      <Header onOpenMenu={() => setIsMenuOpen(true)} />
      <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="pt-28 md:pt-40 px-6 sm:px-10 md:px-12 max-w-[1600px] mx-auto pb-24">
        {/* Cabecera */}
        <div className="flex flex-col items-center mb-16 md:mb-24">
          <h1 className="text-xs tracking-[0.4em] uppercase text-gray-900 font-light mb-4">
            Events & Season
          </h1>
          <div className="w-[1px] h-12 bg-gray-300"></div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-[50vh]">
            <span className="text-[10px] tracking-[0.2em] uppercase text-gray-400 animate-pulse">
              Loading Season...
            </span>
          </div>
        ) : monthKeys.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xs tracking-[0.25em] uppercase text-gray-400">
              No upcoming events scheduled.
            </p>
          </div>
        ) : (
          <div className="space-y-20 max-w-7xl mx-auto">
            {monthKeys.map((month) => (
              <section key={month} className="space-y-8">
                {/* Cabecera del mes */}
                <div className="border-b border-black pb-3">
                  <h2 className="text-xs md:text-sm tracking-[0.35em] uppercase text-gray-900 font-normal">
                    {month}
                  </h2>
                </div>

                {/* Grid 2 Columnas de Tarjetas Tipográficas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  {groupedEvents[month].map((event) => (
                    <EventCard key={`${event.id}-${month}`} event={event} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
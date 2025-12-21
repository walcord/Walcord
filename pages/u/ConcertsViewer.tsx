'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

type FutureRow = {
  id: string;
  artist: string;
  city: string;
  venue: string | null;
  seat_label: string | null;
  companions: string | null;
  notes: string | null;
  country_code: string | null;
  event_date: string; // DATE (YYYY-MM-DD)
  created_at: string;
};

export default function ConcertsViewer() {
  const router = useRouter();
  const { username } = router.query as { username?: string };

  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [items, setItems] = useState<FutureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  /* ========== resolver username -> user_id ========== */
  useEffect(() => {
    if (!username) return;
    (async () => {
      setLoading(true);
      setNotFound(false);

      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();

      if (error || !data?.id) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setTargetUserId(data.id);
    })();
  }, [username]);

  /* ========== cargar future_concerts del perfil (solo viewer) ========== */
  useEffect(() => {
    if (!targetUserId) return;
    (async () => {
      setLoading(true);

      const { data } = await supabase
        .from('future_concerts')
        .select(
          'id, artist, city, venue, seat_label, companions, notes, country_code, event_date, created_at',
        )
        .eq('user_id', targetUserId)
        .order('event_date', { ascending: true });

      setItems((data as FutureRow[]) || []);
      setLoading(false);
    })();
  }, [targetUserId]);

  /* ====== Helpers UI ====== */
  const formatDate = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    const day = d.toLocaleDateString('en-GB', { day: '2-digit' });
    const month = d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
    const year = d.getFullYear();
    return { day, month, year };
  };

  const groupedByYear = useMemo(() => {
    const map: Record<string, FutureRow[]> = {};
    for (const it of items) {
      const y = new Date(it.event_date + 'T00:00:00').getFullYear().toString();
      if (!map[y]) map[y] = [];
      map[y].push(it);
    }
    return map;
  }, [items]);

  const orderedYears = useMemo(
    () =>
      Object.keys(groupedByYear)
        .map((y) => parseInt(y, 10))
        .sort((a, b) => a - b)
        .map((y) => y.toString()),
    [groupedByYear],
  );

  return (
    <div className="bg-white min-h-screen text-black font-[Roboto]">
      <main className="mx-auto w-full max-w-[520px] px-4 pt-6 pb-16">
        {/* HEADER EDITORIAL — idéntico al original, sin botones */}
        <header className="mb-4">
          <div className="flex items-center justify-between">
            <div className="w-8" />
            <h1
              className="text-[clamp(22px,4vw,30px)] tracking-tight text-center"
              style={{
                fontFamily: '"Times New Roman", Times, serif',
                fontWeight: 400,
                letterSpacing: '-0.03em',
              }}
            >
              Future concerts
            </h1>
            <div className="w-8" />
          </div>
        </header>

        {/* LISTA — SOLO LECTURA */}
        <section>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 rounded-3xl border border-neutral-200 bg-neutral-50 animate-pulse"
                />
              ))}
            </div>
          ) : notFound ? (
            <div
              className="mt-16 text-center text-xs text-neutral-500"
              style={{ fontFamily: '"Times New Roman", Times, serif' }}
            >
              User not found.
            </div>
          ) : items.length === 0 ? (
            <div className="mt-16 text-center text-xs text-neutral-500">
              No future concerts yet.
            </div>
          ) : (
            orderedYears.map((year) => (
              <div key={year} className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-px flex-1 bg-neutral-200" />
                  <span
                    className="text-[11px] uppercase tracking-[0.18em] text-neutral-600"
                    style={{ fontFamily: '"Times New Roman", Times, serif' }}
                  >
                    {year}
                  </span>
                  <div className="h-px flex-1 bg-neutral-200" />
                </div>

                <div className="space-y-3">
                  {groupedByYear[year].map((it) => {
                    const { day, month, year: yFull } = formatDate(it.event_date);

                    return (
                      <article
                        key={it.id}
                        className="rounded-3xl border border-neutral-200 px-4 py-3 flex items-center gap-3 bg-white"
                      >
                        {/* FECHA */}
                        <div className="flex flex-col items-center justify-center w-16 h-20 rounded-2xl border border-neutral-200 text-[10px] uppercase tracking-[0.18em] text-neutral-700 shrink-0">
                          <span>{day}</span>
                          <span>{month}</span>
                          <span className="mt-1 text-[9px] tracking-[0.16em]">
                            {yFull}
                          </span>
                        </div>

                        {/* CONTENIDO */}
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          <div className="min-w-0">
                            <p
                              className="text-[15px] leading-5 truncate"
                              style={{
                                fontFamily: '"Times New Roman", Times, serif',
                                fontWeight: 400,
                              }}
                            >
                              {it.artist}
                            </p>

                            <p className="text-[11px] text-neutral-600 truncate">
                              {it.venue}
                              {it.venue && it.city ? ' · ' : ''}
                              {it.city}
                              {it.city && it.country_code ? ' · ' : ''}
                              {it.country_code}
                            </p>
                          </div>

                          {it.seat_label && (
                            <p className="text-[10px] text-neutral-600">
                              Seats · {it.seat_label}
                            </p>
                          )}

                          {it.companions && (
                            <p className="text-[10px] text-neutral-600 truncate">
                              <span className="uppercase tracking-[0.18em] text-[9px] text-neutral-500 mr-1">
                                With
                              </span>
                              <span className="font-light">{it.companions}</span>
                            </p>
                          )}

                          {it.notes && (
                            <p className="text-[10px] text-neutral-500 italic line-clamp-2">
                              {it.notes}
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}

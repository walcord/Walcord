'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

type FutureRow = {
  id: string;
  artist: string;
  country_code: string | null;
  city: string;
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
        .select('id, artist, country_code, city, event_date, created_at')
        .eq('user_id', targetUserId)
        .order('event_date', { ascending: true });
      setItems((data as FutureRow[]) || []);
      setLoading(false);
    })();
  }, [targetUserId]);

  return (
    <div className="bg-white min-h-screen text-black">
      {/* ===== Banner azul (idéntico): h-24, flecha 20px, pegado abajo ===== */}
      <header className="w-full h-24 bg-[#1F48AF] flex items-end px-4 sm:px-12 pb-2">
        <button
          onClick={() => history.back()}
          aria-label="Go back"
          className="p-2 rounded-full hover:bg-[#1A3A95] transition"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </header>

      {/* ===== Título y regla (igual estilo) ===== */}
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 pt-8">
        <h1
          className="text-[clamp(1.8rem,4vw,2.4rem)] font-light text-center tracking-tight mb-3"
          style={{ fontFamily: '"Times New Roman", Times, serif' }}
        >
          Future concerts
        </h1>
        <hr className="border-black w-full mb-8" />
      </div>

      {/* ===== Lista compacta (solo lectura) ===== */}
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-20">
        {loading ? (
          <div className="grid grid-cols-1 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-neutral-200 px-3 py-3">
                <div className="h-4 w-40 bg-neutral-200 rounded mb-2" />
                <div className="h-3 w-56 bg-neutral-200 rounded" />
              </div>
            ))}
          </div>
        ) : notFound ? (
          <p
            className="text-center text-[16px] text-black/80"
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
          >
            User not found.
          </p>
        ) : items.length === 0 ? (
          <p
            className="text-center text-[16px] text-black/80"
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
          >
            No future concerts yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {items.map((it) => (
              <div
                key={it.id}
                className="rounded-xl border border-neutral-200 px-3 py-2 flex items-center justify-between"
              >
                <div>
                  <div
                    className="text-[15px]"
                    style={{ fontFamily: '"Times New Roman", Times, serif' }}
                  >
                    {it.artist}
                  </div>
                  <div className="text-[12px] text-neutral-700">
                    {new Date(it.event_date + 'T00:00:00').toLocaleDateString(undefined, {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                    {' · '}
                    {it.city}
                    {it.country_code ? ` · ${it.country_code}` : ''}
                  </div>
                </div>

                {/* ← sin botón Delete, es solo viewer */}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

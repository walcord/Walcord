'use client';

import { useEffect, useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';

export default function ConcertTourSearch({
  onSelectTour,
}: {
  onSelectTour?: (artist_name: string, tour: string) => void; // ahora opcional
}) {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Array<{ artist_name: string; tour: string }>>([]);

  useEffect(() => {
    const t = setTimeout(() => void search(q), 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const search = async (term: string) => {
    if (!term || term.trim().length < 2) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const { data: byArtist } = await supabase
        .from('concerts')
        .select('artist_name, tour')
        .ilike('artist_name', `%${term}%`)
        .limit(200);

      const { data: byTour } = await supabase
        .from('concerts')
        .select('artist_name, tour')
        .ilike('tour', `%${term}%`)
        .limit(200);

      const map = new Map<string, { artist_name: string; tour: string }>();
      [...(byArtist || []), ...(byTour || [])].forEach((r: any) => {
        const key = `${(r.artist_name || '').toLowerCase()}||${(r.tour || '').toLowerCase()}`;
        if (!map.has(key) && r.artist_name && r.tour) {
          map.set(key, { artist_name: r.artist_name, tour: r.tour });
        }
      });

      const arr = Array.from(map.values());
      arr.sort((a, b) => a.artist_name.localeCompare(b.artist_name) || a.tour.localeCompare(b.tour));
      setItems(arr.slice(0, 30));
    } finally {
      setLoading(false);
    }
  };

  const goToExplore = (artist_name: string, tour: string) => {
    // Llama al callback si alguien lo usa (no rompe nada existente)
    onSelectTour?.(artist_name, tour);
    // Navega SIEMPRE a la nueva página de resultados
    const href = `/u/concerts/explore?artist=${encodeURIComponent(artist_name)}&tour=${encodeURIComponent(tour)}`;
    router.push(href);
  };

  return (
    <div className="w-full">
      <div className="h-12 border border-black/10 rounded-full px-4 sm:px-5 flex items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a tour or artist (For example: Billie Eilish)"
          className="w-full outline-none text-sm placeholder:text-neutral-400"
          aria-label="Search artist or tour"
        />
      </div>

      {q.trim().length >= 2 && (
        <div className="mt-3 border border-black/10 rounded-2xl overflow-hidden">
          {loading && <div className="px-4 py-3 text-xs text-neutral-500">Searching…</div>}
          {!loading && items.length === 0 && (
            <div className="px-4 py-3 text-sm text-neutral-600">No results.</div>
          )}
          {!loading &&
            items.map((it, i) => (
              <button
                key={`${it.artist_name}-${it.tour}-${i}`}
                className="w-full text-left px-4 sm:px-5 py-3 hover:bg-neutral-50 transition flex items-center justify-between"
                onClick={() => goToExplore(it.artist_name, it.tour)}
                aria-label={`Filter by ${it.artist_name} · ${it.tour}`}
              >
                <div className="text-sm">
                  <div className="font-normal" style={{ fontFamily: 'Times New Roman, serif' }}>
                    {it.artist_name}
                  </div>
                  <div className="text-neutral-600 text-xs">{it.tour}</div>
                </div>
                <span className="text-xs text-neutral-500">View posts</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

type TimeoutId = ReturnType<typeof setTimeout>;
type Artist = { id: string; name: string };
type Country = { code: string; name: string };

type FutureRow = {
  id: string;
  artist: string;
  country_code: string | null;
  city: string;
  event_date: string;
  created_at: string;
};

export default function FutureConcertsPage() {
  const router = useRouter();

  // Auth
  const [userId, setUserId] = useState<string | null>(null);

  // Catálogos
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryCode, setCountryCode] = useState<string>('');

  // Artista (buscador -> guardamos el nombre, tu columna es TEXT)
  const [artistQ, setArtistQ] = useState('');
  const [artistResults, setArtistResults] = useState<Artist[]>([]);
  const [artistSearching, setArtistSearching] = useState(false);
  const artistDebouncer = useRef<TimeoutId | null>(null);
  const [artistName, setArtistName] = useState<string>('');

  // Form
  const [city, setCity] = useState('');
  const [dateStr, setDateStr] = useState('');

  // Data
  const [items, setItems] = useState<FutureRow[]>([]);
  const [loading, setLoading] = useState(true);

  const canAdd = !!artistName && !!city.trim() && !!countryCode && !!dateStr;

  /* ====== Init ====== */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);

      const { data: C } = await supabase.from('countries').select('code,name').order('name', { ascending: true });
      setCountries((C as Country[]) || []);

      await loadItems(user.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ====== Buscar artistas (debounce) ====== */
  useEffect(() => {
    const term = artistQ.trim();
    if (!term || term.length < 2) { setArtistResults([]); setArtistSearching(false); return; }
    setArtistSearching(true);
    if (artistDebouncer.current) clearTimeout(artistDebouncer.current);
    artistDebouncer.current = setTimeout(async () => {
      try {
        const { data } = await supabase.from('artists').select('id,name').ilike('name', `%${term}%`).limit(25);
        setArtistResults((data as Artist[]) || []);
      } finally { setArtistSearching(false); }
    }, 200);
  }, [artistQ]);

  /* ====== CRUD ====== */
  async function loadItems(uid: string) {
    setLoading(true);
    const { data } = await supabase
      .from('future_concerts')
      .select('id, artist, country_code, city, event_date, created_at')
      .eq('user_id', uid)
      .order('event_date', { ascending: true });
    setItems((data as FutureRow[]) || []);
    setLoading(false);
  }

  async function addItem() {
    if (!userId || !canAdd) return;
    const { data, error } = await supabase
      .from('future_concerts')
      .insert([{ user_id: userId, artist: artistName, country_code: countryCode, city: city.trim(), event_date: dateStr }])
      .select('id, artist, country_code, city, event_date, created_at')
      .single();

    if (!error && data) {
      setItems(prev =>
        [...prev, data as FutureRow].sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
      );
    }

    // reset rápido
    setArtistName(''); setArtistQ(''); setArtistResults([]);
    setCountryCode(''); setCity(''); setDateStr('');
  }

  async function removeItem(id: string) {
    const backup = items;
    setItems(prev => prev.filter(i => i.id !== id));
    const { error } = await supabase.from('future_concerts').delete().eq('id', id);
    if (error) setItems(backup);
  }

  return (
    <div className="bg-white min-h-screen text-black">
      {/* ===== Banner AZUL (fijo) — con márgenes laterales por debajo ===== */}
      <header className="w-full h-20 bg-[#1F48AF] flex items-end px-4 pb-2">
        <div className="mx-auto w-full max-w-[520px]">
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
        </div>
      </header>

      {/* ===== CONTENEDOR CENTRAL ESTRECHO (NO ROZA BORDES) ===== */}
      <main className="mx-auto w-full max-w-[520px] px-4 py-4">
        {/* ===== Barra de creación (compacta) pegada al contenido, con sticky suave ===== */}
        <section className="sticky top-2 z-10 bg-white/95 backdrop-blur rounded-2xl border border-neutral-200 px-3 py-3">
          <div className="grid grid-cols-2 gap-2 items-center">
            {/* ARTIST (buscable) */}
            <div className="col-span-2 relative">
              {artistName ? (
                <div className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2">
                  <span className="truncate" style={{ fontFamily: '"Times New Roman", Times, serif' }}>{artistName}</span>
                  <button className="text-xs text-[#1F48AF]" onClick={() => { setArtistName(''); setArtistQ(''); }}>Change</button>
                </div>
              ) : (
                <>
                  <input
                    value={artistQ}
                    onChange={(e) => setArtistQ(e.target.value)}
                    placeholder="Artist"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#1F48AF]"
                  />
                  {(artistSearching || artistResults.length > 0) && (
                    <div className="absolute mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg max-h-72 overflow-auto">
                      {artistSearching && <div className="px-3 py-2 text-sm text-neutral-500">Searching…</div>}
                      {!artistSearching && artistResults.map(r => (
                        <button
                          key={r.id}
                          onClick={() => { setArtistName(r.name); setArtistQ(''); setArtistResults([]); }}
                          className="block w-full text-left px-3 py-2 hover:bg-neutral-50"
                          style={{ fontFamily: '"Times New Roman", Times, serif' }}
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* CITY */}
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              className="col-span-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#1F48AF]"
            />

            {/* COUNTRY */}
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="col-span-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#1F48AF] appearance-none"
            >
              <option value="">Country</option>
              {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>

            {/* DATE */}
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="col-span-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#1F48AF]"
            />

            {/* ADD */}
            <button
              onClick={addItem}
              disabled={!canAdd}
              className="col-span-1 rounded-lg px-3 py-2 text-sm text-white bg-[#1F48AF] enabled:hover:opacity-90 disabled:opacity-40 transition"
              style={{ fontFamily: '"Times New Roman", Times, serif' }}
            >
              Add
            </button>
          </div>
        </section>

        {/* ===== Lista compacta (con márgenes laterales del contenedor) ===== */}
        <section className="mt-4">
          {loading ? (
            <p className="text-sm text-neutral-600">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-center text-[16px] text-black/80" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
              Add your next concerts above.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {items.map(it => (
                <div key={it.id} className="rounded-2xl border border-neutral-200 px-3 py-2 flex items-center justify-between bg-white">
                  <div className="min-w-0">
                    <div className="text-[15px] leading-tight line-clamp-1" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                      {it.artist}
                    </div>
                    <div className="text-[12px] text-neutral-700">
                      {new Date(it.event_date+'T00:00:00').toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'})}
                      {' · '}{it.city}{it.country_code ? ` · ${it.country_code}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(it.id)}
                    className="text-[12px] rounded-full px-3 py-1 border border-neutral-300 hover:bg-neutral-100 transition shrink-0"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

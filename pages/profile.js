'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';
import UserHeader from './UserHeader';
import PostCard from '../components/PostCard';

export default function ProfilePage() {
  const router = useRouter();

  const [selectedGenres, setSelectedGenres] = useState([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  const [concertsLoading, setConcertsLoading] = useState(true);
  const [concerts, setConcerts] = useState([]);

  // === Eliminación de cuenta (UI/estado) ===
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  // ===== 1) Cargar perfil =====
  useEffect(() => {
    const initProfile = async () => {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError || !data?.user) {
        router.push('/login');
        return;
      }

      const uid = data.user.id;
      setUserId(uid);

      const { data: profile } = await supabase
        .from('profiles')
        .select('genre1, genre2, favourite_color_1, favourite_color_2')
        .eq('id', uid)
        .single();

      if (!profile?.favourite_color_1 || !profile?.favourite_color_2) {
        const { data: paletteData } = await supabase
          .from('color_palettes')
          .select('colors')
          .eq('name', 'Walcord Classic')
          .single();

        if (paletteData?.colors?.length) {
          const colors = paletteData.colors.slice();
          const shuffled = colors.sort(() => 0.5 - Math.random());
          await supabase
            .from('profiles')
            .update({ favourite_color_1: shuffled[0], favourite_color_2: shuffled[1] })
            .eq('id', uid);
        }
      }

      const selected = [profile?.genre1, profile?.genre2].filter(Boolean);
      setSelectedGenres(selected);
      setProfileLoading(false);
    };

    initProfile();
  }, [router]);

  // ===== 2) Cargar CONCERTS (siempre DESC por fecha) =====
  useEffect(() => {
    if (!userId) return;

    const fetchConcerts = async () => {
      setConcertsLoading(true);

      const { data: byView } = await supabase
        .from('v_concert_cards')
        .select('*')
        .eq('user_id', userId)
        .order('event_date', { ascending: false });

      if (byView?.length) {
        setConcerts(
          byView.map((r) => ({
            id: r.concert_id,
            user_id: r.user_id,
            artist_id: r.artist_id,
            artist_name: r.artist_name,
            country_code: r.country_code,
            country_name: r.country_name ?? null,
            city: r.city,
            event_date: r.event_date,
            cover_url: r.cover_url,
          }))
        );
        setConcertsLoading(false);
        return;
      }

      const { data } = await supabase
        .from('concerts')
        .select(`
          id, user_id, artist_id, country_code, city, event_date, tour_name, caption,
          artists(name),
          countries(name),
          concert_media(url, media_type, created_at)
        `)
        .eq('user_id', userId)
        .order('event_date', { ascending: false });

      const normalized = (data || []).map((c) => {
        const firstMedia = (c.concert_media || [])
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.url ?? null;

        return {
          id: c.id,
          user_id: c.user_id,
          artist_id: c.artist_id,
          artist_name: c.artists?.name ?? null,
          country_code: c.country_code,
          country_name: c.countries?.name ?? null,
          city: c.city,
          event_date: c.event_date,
          cover_url: firstMedia,
        };
      });

      setConcerts(normalized);
      setConcertsLoading(false);
    };

    fetchConcerts();
  }, [userId]);

  // ===== 3) Agrupar por año y ORDENAR (años DESC, dentro DESC por fecha) =====
  const groupsOrdered = useMemo(() => {
    const map = new Map();
    for (const c of concerts) {
      const year = c?.event_date ? new Date(c.event_date).getFullYear() : null;
      const key = year && year >= 1950 && year <= 2050 ? String(year) : 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    }

    for (const [, arr] of map) {
      arr.sort(
        (a, b) =>
          new Date(b.event_date || 0).getTime() - new Date(a.event_date || 0).getTime()
      );
    }

    const years = Array.from(map.keys())
      .filter((k) => k !== 'Unknown')
      .map(Number)
      .sort((a, b) => b - a)
      .map((n) => String(n));

    const ordered = years.map((y) => ({ yearLabel: y, items: map.get(y) }));
    if (map.has('Unknown')) ordered.push({ yearLabel: 'Unknown', items: map.get('Unknown') });
    return ordered;
  }, [concerts]);

  // ===== 4) Eliminar cuenta (acción) =====
  const handleDeleteAccount = async () => {
    setDeleteErr(null);
    setDeleteBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ hard: true }),
      });

      if (!res.ok) {
        try {
          // @ts-ignore
          const { error: rpcErr } = await supabase.rpc('delete_user_and_data');
          if (rpcErr) throw rpcErr;
        } catch (e) {
          throw new Error('No ha sido posible eliminar la cuenta. Revisa /api/delete-account o la RPC delete_user_and_data.');
        }
      }

      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (err) {
      setDeleteErr(err?.message || 'Unexpected error');
    } finally {
      setDeleteBusy(false);
    }
  };

  // ===== 5) Render =====
  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black bg-white">
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black font-[Roboto]">
      {/* Banner */}
      <div className="w-full h-24 flex items-end justify-between px-6 bg-[#1F48AF] pb-3 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 ml-auto">
          <a
            href="/feed"
            aria-label="Back to The Wall"
            className="inline-flex items-center gap-2 rounded-full bg-white/95 text-black px-3 py-1.5 text-xs border border-white/60 hover:bg-white transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H5m6 7l-7-7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hidden sm:inline">The Wall</span>
          </a>
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.href = 'https://walcord.com/'; }}
            className="inline-flex items-center gap-2 rounded-full bg-white/90 text-black px-3 py-1.5 text-xs border border-white/60 hover:bg-white transition-all"
            aria-label="Log out"
            title="Log out"
          >
            Log out
          </button>
        </div>
      </div>

      {/* Título + (+) */}
      <div className="w-full px-10 sm:px-12 mt-6 mb-8 relative">
        <h1 className="text-[clamp(1.8rem,4.5vw,2.375rem)] font-normal" style={{ fontFamily: 'Times New Roman, serif' }}>
          Profile
        </h1>
        <hr className="mt-2 border-t border-black/50" />
        <a
          href="/post/new"
          className="absolute right-10 sm:right-12 top-full mt-7 h-10 w-10 rounded-full bg-[#1F48AF] text-white flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 transition-transform duration-300 z-10"
          aria-label="Create post"
          title="Create post"
        >
          <span className="text-2xl leading-none font-light">+</span>
        </a>
      </div>

      {/* Layout */}
      <div className="px-10 sm:px-12 grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-10 items-start">
        <div className="m-0 p-0">
          <UserHeader />
        </div>

        <aside className="m-0 p-0">
          <h2 className="text-[clamp(1.1rem,2vw,1.5rem)] font-light mb-1">Concerts</h2>

          {concertsLoading ? (
            <div className="mt-4 text-sm text-neutral-600">Loading concerts…</div>
          ) : groupsOrdered.length === 0 ? (
            <div className="mt-4 text-sm text-neutral-600">No concerts yet.</div>
          ) : (
            groupsOrdered.map(({ yearLabel, items }) => (
              <section key={yearLabel} className="mt-7">
                <div className="flex items-center">
                  <div className="text-[0.78rem] tracking-[0.14em] uppercase text-neutral-500">{yearLabel}</div>
                  <div className="h-px flex-1 ml-6 bg-black/10" />
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-7">
                  {items.map((c) => (
                    <PostCard
                      key={c.id}
                      post={{
                        id: c.id,
                        user_id: c.user_id,
                        artist_id: c.artist_id,
                        artist_name: c.artist_name,
                        country_code: c.country_code,
                        country_name: c.country_name,
                        event_date: c.event_date,
                        cover_url: c.cover_url,
                      }}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </aside>
      </div>

      {/* ===== AÑADIDO: bloque inferior EXACTO como la imagen ===== */}
      <footer className="px-10 sm:px-12 mt-16 pt-8 pb-28">
        <hr className="border-t border-black/10 mb-6" />
        <p className="text-[0.98rem] text-neutral-500 mb-2">
          Manage your data & policies.
        </p>
        <a
          href="/privacy"
          className="text-[0.98rem] underline underline-offset-2 text-neutral-700 hover:text-neutral-900"
        >
          Privacy & Policies
        </a>

        <div className="mt-6">
          <button
            onClick={() => { setDeleteOpen(true); setDeleteErr(null); setDeleteConfirm(''); }}
            className="inline-flex items-center justify-center rounded-2xl px-5 py-2.5 text-[1rem] border-2 border-red-500 text-red-600 bg-transparent hover:bg-red-50 active:scale-[0.99] transition"
            aria-label="Delete account"
            title="Delete account"
          >
            Delete account
          </button>
          {deleteErr && (
            <span className="ml-3 text-sm text-red-700 align-middle">{deleteErr}</span>
          )}
        </div>
      </footer>

      {/* Modal Confirmación (no cambia nada del resto) */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="w-full max-w-md rounded-lg bg-white shadow-xl p-6">
              <h4 className="text-lg font-medium">Confirm account deletion</h4>
              <p className="mt-2 text-sm text-neutral-700">
                Type <span className="font-mono bg-neutral-100 px-1 py-0.5 rounded">DELETE</span> to confirm.
              </p>

              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="mt-4 w-full border border-neutral-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-[#1F48AF]"
                placeholder="Type DELETE"
              />

              {deleteErr && (
                <div className="mt-3 text-sm text-red-700">
                  {deleteErr}
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => { if (!deleteBusy) setDeleteOpen(false); }}
                  className="px-4 py-2 text-sm rounded-md border border-neutral-300 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteBusy || deleteConfirm !== 'DELETE'}
                  className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteBusy ? 'Deleting…' : 'Delete permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

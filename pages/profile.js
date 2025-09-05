'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import Image from 'next/image';
import { useRouter } from 'next/router';
import UserHeader from './UserHeader';
import PostCard from '../components/PostCard';

export default function ProfilePage() {
  const router = useRouter();

  // ===== Estado perfil =====
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  // ===== Estado posts =====
  const [postsLoading, setPostsLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [eraOrder] = useState([
    'From my childhood',
    'From my teenage years',
    'From my twenties',
    'From my thirties',
    'From my forties',
    'From my fifties',
    'From my sixties',
    'From my seventies',
    'From my eighties',
    'From my nineties',
  ]);

  // ===== Estado eliminación de cuenta (UI) =====
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState(null);

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

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('genre1, genre2, favourite_color_1, favourite_color_2')
        .eq('id', uid)
        .single();

      if (profileError) {
        setProfileLoading(false);
        return;
      }

      // Colores por defecto si faltan
      if (!profile?.favourite_color_1 || !profile?.favourite_color_2) {
        const { data: paletteData } = await supabase
          .from('color_palettes')
          .select('colors')
          .eq('name', 'Walcord Classic')
          .single();

        if (paletteData?.colors?.length) {
          const colors = paletteData.colors.slice();
          const shuffled = colors.sort(() => 0.5 - Math.random());
          const color1 = shuffled[0];
          const color2 = shuffled[1];
          await supabase
            .from('profiles')
            .update({ favourite_color_1: color1, favourite_color_2: color2 })
            .eq('id', uid);
        }
      }

      const selected = [profile?.genre1, profile?.genre2].filter(Boolean);
      setSelectedGenres(selected);
      setProfileLoading(false);
    };

    initProfile();
  }, [router]);

  // ===== 2) Cargar posts (y realtime) =====
  useEffect(() => {
    if (!userId) return;

    const fetchPosts = async () => {
      setPostsLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          record:records(id, title, cover_url, artist_name),
          author:profiles(username, avatar_url),
          post_likes(count),
          post_comments(count)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        setPosts([]);
      } else {
        const normalized = (data || []).map((p) => ({
          ...p,
          likes_count: p?.post_likes?.[0]?.count ?? 0,
          comments_count: p?.post_comments?.[0]?.count ?? 0,
        }));
        setPosts(normalized);
      }
      setPostsLoading(false);
    };

    fetchPosts();

    const channel = supabase
      .channel('posts-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts', filter: `user_id=eq.${userId}` },
        () => fetchPosts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // ===== Agrupar por era =====
  const groupedByEra = useMemo(() => {
    const g = {};
    for (const p of posts) {
      const key = p.era || 'From my twenties';
      g[key] = g[key] ? [...g[key], p] : [p];
    }
    const ordered = {};
    const seen = new Set();
    for (const label of eraOrder) {
      if (g[label]) {
        ordered[label] = g[label];
        seen.add(label);
      }
    }
    Object.keys(g)
      .filter((k) => !seen.has(k))
      .sort()
      .forEach((k) => (ordered[k] = g[k]));
    return ordered;
  }, [posts, eraOrder]);

  // ===== Eliminar cuenta (acción) =====
  const handleConfirmDelete = async () => {
    try {
      setDeleteBusy(true);
      setDeleteErr(null);

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('No active session');

      const resp = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || 'Delete failed');

      await supabase.auth.signOut();
      router.replace('/goodbye');
    } catch (e) {
      setDeleteErr(e?.message || 'Unexpected error');
    } finally {
      setDeleteBusy(false);
    }
  };

  // ===== Logout (confirmación) =====
  const handleLogout = async () => {
    const ok = window.confirm('Are you sure you want to log out?');
    if (!ok) return;
    try {
      await supabase.auth.signOut();
      router.replace('/welcome');
    } catch (e) {
      console.error(e);
      alert('There was an error logging out. Please try again.');
    }
  };

  // ===== Render =====
  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black bg-white">
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black font-[Roboto]">
      {/* Banner unificado */}
      <div className="w-full h-20 flex items-center justify-between px-6 bg-[#1F48AF]">
        <Image src="/logotipo.png" alt="Walcord Logo" width={56} height={56} />
        {/* Botón The Wall a la derecha */}
        <a
          href="/feed"
          aria-label="Back to The Wall"
          className="inline-flex items-center gap-2 rounded-full bg-white/95 text-black px-3 py-1.5 text-xs border border-white/60 hover:bg-white transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M19 12H5m6 7l-7-7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="hidden sm:inline">The Wall</span>
        </a>
      </div>

      {/* LOG OUT (fijo, arriba derecha; convive con la botonera global) */}
      <div className="fixed top-12 right-2 z-[10000]">
        <button
          onClick={handleLogout}
          className="px-3 h-8 rounded-full border border-white/40 bg-[#1F48AF] text-white text-[12px] leading-8 font-light tracking-wide hover:opacity-90 transition"
        >
          Log out
        </button>
      </div>

      {/* Título + línea + botón (+) */}
      <div className="w-full px-10 sm:px-12 mt-6 mb-8 relative">
        <h1
          className="text-[clamp(1.8rem,4.5vw,2.375rem)] font-normal"
          style={{ fontFamily: 'Times New Roman, serif' }}
        >
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
          <h2 className="text-[clamp(1.1rem,2vw,1.5rem)] font-light mb-1">Memories</h2>

          {postsLoading ? (
            <div className="mt-4 text-sm text-neutral-600">Loading posts…</div>
          ) : Object.keys(groupedByEra).length === 0 ? (
            <div className="mt-4 text-sm text-neutral-600">No memories yet.</div>
          ) : (
            Object.keys(groupedByEra).map((era) => (
              <section key={era} className="mt-7">
                <div className="flex items-center">
                  <div className="text-[0.78rem] tracking-[0.14em] uppercase text-neutral-500">
                    {era}
                  </div>
                  <div className="h-px flex-1 ml-6 bg-black/10" />
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-7">
                  {groupedByEra[era].map((p) => (
                    <PostCard key={p.id} post={p} />
                  ))}
                </div>
              </section>
            ))
          )}
        </aside>
      </div>

      {/* ===== Footer minimal (abajo del todo) ===== */}
      <div className="px-10 sm:px-12 mt-12 mb-10">
        <div className="border-t border-gray-200 pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-gray-500">
            <div className="mb-1">Manage your data & policies.</div>
            <a
              href="/privacy.html"
              className="underline decoration-gray-400 hover:decoration-gray-800"
            >
              Privacy & Policies
            </a>
          </div>

          {userId && (
            <button
              onClick={() => setDeleteOpen(true)}
              className="self-start rounded-xl border border-red-600 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
            >
              Delete account
            </button>
          )}
        </div>
      </div>

      {/* ===== Modal confirmación (minimalista) ===== */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="mb-2 text-base font-semibold">Delete account</h3>
            <p className="mb-4 text-sm text-gray-600">
              You’re about to permanently delete your account and associated data. This action cannot be undone. Are you sure?
            </p>
            {deleteErr && <div className="mb-3 text-xs text-red-600">{deleteErr}</div>}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteOpen(false)}
                disabled={deleteBusy}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteBusy}
                className="rounded-xl border border-red-600 px-3 py-2 text-sm text-white"
                style={{ background: deleteBusy ? '#9f1239' : '#dc2626' }}
              >
                {deleteBusy ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

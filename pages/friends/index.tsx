// app/friends/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { supabase } from '../../lib/supabaseClient';
import { listMyFriends } from '../../lib/supabase-social';

type MiniProfile = { id: string; username: string; full_name: string | null; avatar_url: string | null };

export default function FriendsPage() {
  const [me, setMe] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<MiniProfile[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setMe(user?.id ?? null);
    })();
  }, []);

  const load = async () => {
    if (!me) return;
    try {
      setLoading(true);
      setErr(null);
      const list = await listMyFriends(supabase, me);
      setFriends(list);
    } catch (e: any) {
      setErr(e?.message || 'Error loading friends.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!me) return;
    load();
    const ch = supabase
      .channel('friends-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `requester_id=eq.${me}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `receiver_id=eq.${me}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me]);

  const filteredFriends = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return friends;
    return friends.filter((f) =>
      (f.full_name || '').toLowerCase().includes(term) ||
      (f.username || '').toLowerCase().includes(term)
    );
  }, [friends, q]);

  return (
    <main className="min-h-screen bg-white">
      {/* Banner */}
      <div className="w-full h-20 flex items-center justify-between px-12 bg-[#1F48AF]">
        <Image src="/Logotipo.png" width={56} height={56} alt="Walcord" priority />
        <a
          href="/profile"
          className="inline-flex items-center gap-2 rounded-full bg-white/95 text-black px-3 py-1.5 text-xs border border-white/60 hover:bg-white transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M19 12H5m6 7l-7-7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="hidden sm:inline">Back</span>
        </a>
      </div>

      {/* Título */}
      <div className="mx-auto max-w-6xl px-6 md:px-8 mt-8">
        <h1 className="text-[clamp(1.9rem,4.5vw,2.4rem)] font-normal tracking-tight" style={{ fontFamily: 'Times New Roman, serif' }}>
          Friends
        </h1>
        <div className="mt-2 h-px bg-black/10" />
      </div>

      {/* Contenido */}
      <div className="mx-auto max-w-6xl px-6 md:px-8 mt-6 pb-16">
        {/* Search + contador */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-neutral-700" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}>
            {friends.length} friend{friends.length === 1 ? '' : 's'}
          </div>
          <div className="relative w-full md:w-[360px]">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search friends"
              className="w-full rounded-full border border-neutral-200 px-5 py-2 outline-none focus:border-[#1F48AF] transition-all"
            />
          </div>
        </div>

        {/* Estado */}
        {loading ? (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-neutral-100 animate-pulse" />
            ))}
          </div>
        ) : err ? (
          <div className="mt-8 text-sm text-red-600">{err}</div>
        ) : filteredFriends.length === 0 ? (
          <div className="mt-10 text-neutral-600 text-sm">No friends found.</div>
        ) : (
          <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFriends.map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border border-neutral-200 bg-white p-4 flex items-center gap-3 hover:shadow-sm transition-shadow"
              >
                <div className="w-12 h-12 rounded-full overflow-hidden bg-neutral-100 border border-neutral-200">
                  {p.avatar_url && <img src={p.avatar_url} alt={p.username} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}>
                    {p.full_name || '—'}
                  </div>
                  <div className="text-xs text-neutral-500 truncate">@{p.username}</div>
                </div>
                <a
                  href={`/profile/${p.username}`}
                  className="text-xs rounded-full border border-neutral-200 px-3 py-1 hover:border-[#1F48AF]"
                >
                  See profile
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type MiniProfile = { id: string; username: string | null; full_name: string | null; avatar_url: string | null };

export default function FriendsViewer({ viewerId }: { viewerId: string }) {
  const [friends, setFriends] = useState<MiniProfile[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!viewerId) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setErr(null);

        // accepted friendships where viewerId is requester or receiver
        const { data: fr1, error: e1 } = await supabase
          .from('friendships')
          .select(`
            id, requester_id, receiver_id, status,
            requester:requester_id ( id, username, full_name, avatar_url ),
            receiver:receiver_id ( id, username, full_name, avatar_url )
          `)
          .or(`requester_id.eq.${viewerId},receiver_id.eq.${viewerId}`)
          .eq('status', 'accepted');

        if (e1) throw e1;

        const unique = new Map<string, MiniProfile>();
        (fr1 || []).forEach((row: any) => {
          const other: MiniProfile = row.requester_id === viewerId ? row.receiver : row.requester;
          if (other?.id) unique.set(other.id, other);
        });

        if (!cancelled) setFriends(Array.from(unique.values()));
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'Error loading friends.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    const ch = supabase
      .channel('friends-viewer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
      cancelled = true;
    };
  }, [viewerId]);

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
        <Image src="/logotipo.png" width={56} height={56} alt="Walcord" priority />
      </div>

      {/* Título */}
      <div className="mx-auto max-w-6xl px-6 md:px-8 mt-8">
        <h1
          className="text-[clamp(1.9rem,4.5vw,2.4rem)] font-normal tracking-tight"
          style={{ fontFamily: 'Times New Roman, serif' }}
        >
          Friends
        </h1>
        <div className="mt-2 h-px bg-black/10" />
      </div>

      {/* Search */}
      <div className="mx-auto max-w-6xl px-6 md:px-8 mt-6">
        <div className="relative w-full md:w-[360px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search friends"
            className="w-full rounded-full border border-neutral-200 px-5 py-2 outline-none focus:border-[#1F48AF] transition-all"
          />
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 md:px-8 mt-6 pb-16">
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
                  {p.avatar_url && <img src={p.avatar_url} alt={p.username || ''} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1">
                  <div className="text-sm" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}>
                    {p.full_name || '—'}
                  </div>
                  <div className="text-xs text-neutral-500">@{p.username}</div>
                </div>
                {p.username && (
                  <Link
                    href={`/u/${p.username}`}
                    className="text-xs rounded-full border border-neutral-200 px-3 py-1 hover:border-[#1F48AF]"
                  >
                    See profile
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

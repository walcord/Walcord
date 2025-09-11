// components/social/FriendRequestsSheet.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  listPendingRequests,
  acceptFriendRequest,
  declineFriendRequest,
  countPendingRequests,
  type FriendRequestRow,
} from '../../lib/supabase-social';

function WalcordPeopleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7" cy="7" r="3" stroke="#1F48AF" strokeWidth="1.2" />
      <circle cx="13" cy="8" r="3" stroke="#1F48AF" strokeWidth="1.2" fill="white" />
      <path d="M4 15C4 12.7909 5.79086 11 8 11H8.5C10.7091 11 12.5 12.7909 12.5 15V16H4V15Z" stroke="#1F48AF" strokeWidth="1.2" />
      <path d="M11 15C11 13.3431 12.3431 12 14 12H14.5C16.1569 12 17.5 13.3431 17.5 15V16H11V15Z" stroke="#1F48AF" strokeWidth="1.2" />
    </svg>
  );
}

type Props = {
  ownerProfileId: string;
  badgeCount?: number;
};

export default function FriendRequestsSheet({ ownerProfileId, badgeCount = 0 }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FriendRequestRow[]>([]);
  const [count, setCount] = useState(badgeCount);
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [list, c] = await Promise.all([
        listPendingRequests(supabase, ownerProfileId),
        countPendingRequests(supabase, ownerProfileId),
      ]);
      setRows(list);
      setCount(c);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Error loading requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCount(badgeCount);
  }, [badgeCount]);

  useEffect(() => {
    if (!open) return;
    load();
  }, [open]);

  useEffect(() => {
    const ch = supabase
      .channel('friend-requests-sheet')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friend_requests', filter: `to_user=eq.${ownerProfileId}` },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships', filter: `receiver_id=eq.${ownerProfileId}` },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships', filter: `requester_id=eq.${ownerProfileId}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ownerProfileId]);

  const accept = async (id: number) => {
    setActioningId(id);
    setErrorMsg(null);
    try {
      await acceptFriendRequest(supabase, id);
      await load();
    } catch (e: any) {
      setErrorMsg(e?.message || 'Could not accept the request.');
      console.error('acceptFriendRequest error', e);
    } finally {
      setActioningId(null);
    }
  };

  const decline = async (id: number) => {
    setActioningId(id);
    setErrorMsg(null);
    try {
      await declineFriendRequest(supabase, id);
      await load();
    } catch (e: any) {
      setErrorMsg(e?.message || 'Could not decline the request.');
      console.error('declineFriendRequest error', e);
    } finally {
      setActioningId(null);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-full border border-[#1F48AF] bg-white"
        title="Friend requests"
      >
        <WalcordPeopleIcon />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#1F48AF] text-white text-[10px] flex items-center justify-center">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[1000] bg-black/40" onClick={() => setOpen(false)}>
          {/* Contenedor responsive: en móviles muestra una caja centrada; en desktop actúa como sheet a la derecha */}
          <div
            className="absolute inset-0 flex items-start justify-center p-4 md:items-stretch md:justify-end"
            onClick={() => setOpen(false)}
          >
            <aside
              className="w-full md:max-w-[440px] max-w-[560px] bg-white shadow-xl md:rounded-none rounded-2xl overflow-hidden md:h-full md:mt-0 mt-6
                         md:max-h-full max-h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header fijo; espacio seguro para notch */}
              <div
                className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b bg-white"
                style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
              >
                <div className="flex items-center gap-2">
                  <WalcordPeopleIcon />
                  <span className="text-sm" style={{ fontFamily: 'Times New Roman, serif' }}>
                    Friendship Requests
                  </span>
                </div>
                <button
                  className="text-sm text-neutral-600 hover:text-black"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>

              {/* Contenido scrollable dentro de la caja */}
              <div className="p-4 flex flex-col gap-3 overflow-y-auto md:h-[calc(100%-52px)]"
                   style={{ WebkitOverflowScrolling: 'touch' }}>
                {loading ? (
                  <>
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-16 rounded-2xl bg-neutral-100 animate-pulse" />
                    ))}
                  </>
                ) : rows.length === 0 ? (
                  <div className="text-sm text-neutral-600">No pending requests.</div>
                ) : (
                  rows.map((r) => (
                    <div key={r.id} className="rounded-2xl border border-neutral-200 p-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-100 border">
                        {r.from_profile?.avatar_url && (
                          <img
                            src={r.from_profile.avatar_url}
                            alt={r.from_profile.username}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{r.from_profile?.full_name || '—'}</div>
                        <div className="text-xs text-neutral-500 truncate">@{r.from_profile?.username}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => accept(r.id)}
                          disabled={actioningId === r.id}
                          className="text-xs rounded-full bg-[#1F48AF] text-white px-3 py-1.5 disabled:opacity-60"
                        >
                          {actioningId === r.id ? 'Accepting…' : 'Accept'}
                        </button>
                        <button
                          onClick={() => decline(r.id)}
                          disabled={actioningId === r.id}
                          className="text-xs rounded-full border border-neutral-300 px-3 py-1.5 hover:border-[#1F48AF] disabled:opacity-60"
                        >
                          {actioningId === r.id ? 'Declining…' : 'Decline'}
                        </button>
                      </div>
                    </div>
                  ))
                )}

                {errorMsg && (
                  <div className="text-xs text-red-600 mt-1">
                    {errorMsg}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      )}
    </>
  );
}

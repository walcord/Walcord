// pages/u/[username]/friends.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import FriendsViewer from '../u/FriendsViewer';
import { supabase } from '../../lib/supabaseClient';

export default function PublicFriendsWrapper() {
  const router = useRouter();
  const { username } = router.query as { username?: string };
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    (async () => {
      const { data } = await supabase.from('profiles').select('id').eq('username', username).single();
      if (!data?.id) return router.replace('/feed');
      setUid(data.id);
    })();
  }, [username, router]);

  if (!uid) {
    return (
      <main className="min-h-screen bg-white text-black font-[Roboto]">
        {/* Banner actualizado */}
        <header className="w-full h-24 bg-[#1F48AF] flex items-end px-4 sm:px-6 pb-2">
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

        <p className="px-12 mt-6 text-sm text-neutral-600">Loading…</p>
      </main>
    );
  }

  return <FriendsViewer viewerId={uid} />;
}

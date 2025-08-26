// pages/u/[username]/favourite-records.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import FavouriteRecordsViewer from '../u/FavouriteRecordsViewer';
import Image from 'next/image';
import { supabase } from '../../lib/supabaseClient';

export default function PublicRecordsWrapper() {
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
        <div className="w-full h-20 flex items-center justify-between px-12 bg-[#1F48AF]">
          <Image src="/logotipo.png" alt="Walcord Logo" width={62} height={62} />
          <a href={`/u/${username || ''}`} className="inline-flex items-center gap-2 rounded-full bg-white/95 text-black px-3 py-1.5 text-xs border border-white/60">
            Back
          </a>
        </div>
        <p className="px-12 mt-6 text-sm text-neutral-600">Loading…</p>
      </main>
    );
  }

  return <FavouriteRecordsViewer viewerId={uid} />;
}

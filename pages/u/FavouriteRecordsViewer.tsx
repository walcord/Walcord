'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

type RecordRow = {
  id: string;
  title: string;
  artist_name: string;
  release_year: number | null;
  vibe_color: string | null;
  cover_color: string | null;
};

type Props = { viewerId?: string };

/**
 * Viewer de discos favoritos (solo lectura).
 * Soporta `viewerId` por props o resolución vía ?username=…
 */
export default function FavouriteRecordsViewer({ viewerId }: Props) {
  const searchParams = useSearchParams();
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(viewerId ?? null);

  const [records, setRecords] = useState<RecordRow[]>([]);
  const [favIds, setFavIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (viewerId) return;
    const username = searchParams?.get('username');
    if (!username) return;
    (async () => {
      const { data } = await supabase.from('profiles').select('id').eq('username', username).single();
      if (data?.id) setResolvedUserId(data.id);
    })();
  }, [viewerId, searchParams]);

  useEffect(() => {
    if (!resolvedUserId) return;
    (async () => {
      setLoading(true);

      const { data: favs } = await supabase
        .from('favourite_records')
        .select('records_id')
        .eq('user_id', resolvedUserId);

      const ids: string[] = Array.from(new Set((favs || []).map((f: any) => f.records_id)));
      setFavIds(ids);

      let recs: RecordRow[] = [];
      if (ids.length > 0) {
        const { data } = await supabase
          .from('records')
          .select('id,title,artist_name,release_year,vibe_color,cover_color')
          .in('id', ids)
          .order('release_year', { ascending: false });
        recs = (data as RecordRow[]) || [];
      }

      setRecords(recs);
      setLoading(false);
    })();
  }, [resolvedUserId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-black font-[Roboto]">
        <div className="w-full h-20 flex items-center px-4 sm:px-12 bg-[#1F48AF]">
          <Image src="/logotipo.png" alt="Walcord Logo" width={56} height={56} />
        </div>
        <p className="text-center text-gray-500 text-sm mt-10">Loading records…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black font-[Roboto]">
      <div className="w-full h-20 flex items-center px-4 sm:px-12 bg-[#1F48AF]">
        <Image src="/logotipo.png" alt="Walcord Logo" width={56} height={56} />
      </div>

      <div className="w-full flex flex-col items-center mt-8 mb-6">
        <h1
          className="text-[clamp(1.5rem,3.5vw,2.4rem)]"
          style={{ fontFamily: 'Times New Roman, serif', fontWeight: 400, opacity: 0.85, letterSpacing: '0.4px' }}
        >
          Favourite Records
        </h1>
        <hr className="w-[90%] mt-4 border-t-[1.5px] border-black opacity-60" />
      </div>

      {favIds.length === 0 ? (
        <p className="text-center text-neutral-600 text-sm mb-24">No records yet.</p>
      ) : (
        <div className="w-full px-4 sm:px-6 mb-24">
          {/* GRID 2 columnas en móvil */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {records.map((record) => (
              <div key={record.id} className="flex flex-col items-center text-center">
                <Link
                  href={`/record/${record.id}`}
                  className="w-36 h-36 sm:w-40 sm:h-40 rounded-xl shadow-md flex items-center justify-center transition-transform duration-200 hover:scale-[1.03]"
                  style={{ backgroundColor: record.vibe_color || '#000000' }}
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[6px]" style={{ backgroundColor: record.cover_color || '#FFFFFF' }} />
                </Link>

                <p className="mt-2 text-[13px] sm:text-sm font-normal leading-tight line-clamp-2" style={{ fontFamily: 'Times New Roman, serif', opacity: 0.9 }}>
                  {record.title}
                </p>
                <p className="text-[11px] sm:text-xs text-gray-600 font-light">{record.artist_name}</p>
                {record.release_year ? <p className="text-[11px] sm:text-xs text-gray-500 font-light">{record.release_year}</p> : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

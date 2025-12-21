'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useSearchParams } from 'next/navigation';

/** ====== Tipos (mismo shape visual que el original) ====== */
type RecordRow = {
  id: string;
  title: string;
  cover_url: string | null;
  artist_name: string;
  release_year: number | null;
  type: string | null;
  description: string | null;
  vibe_color: string | null;
  cover_color: string | null;
};

type FavRow = { records_id: string };

type Props = { viewerId?: string };

export default function FavouriteRecordsViewer({ viewerId }: Props) {
  const qs = useSearchParams();

  const [resolvedUserId, setResolvedUserId] = useState<string | null>(viewerId ?? null);
  const [resolvedUsername, setResolvedUsername] = useState<string | null>(null);

  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [favouriteRecords, setFavouriteRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  /** ====== resolver username -> user_id (viewer) ====== */
  useEffect(() => {
    if (viewerId) return;

    const qUsername = qs.get('username') || qs.get('handle');
    if (!qUsername) return;

    (async () => {
      setLoading(true);
      setNotFound(false);

      const { data, error } = await supabase
        .from('profiles')
        .select('id,username')
        .eq('username', qUsername)
        .maybeSingle();

      if (error || !data?.id) {
        setNotFound(true);
        setResolvedUserId(null);
        setResolvedUsername(null);
        setLoading(false);
        return;
      }

      setResolvedUserId(data.id);
      setResolvedUsername(data.username ?? qUsername);
    })();
  }, [viewerId, qs]);

  /** ====== cargar favourites + records ====== */
  useEffect(() => {
    if (!resolvedUserId) {
      if (!notFound) setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);

      const { data: favs } = await supabase
        .from('favourite_records')
        .select('records_id')
        .eq('user_id', resolvedUserId);

      const ids = Array.from(
        new Set(((favs as FavRow[]) || []).map((f) => f.records_id).filter(Boolean)),
      );

      setFavouriteIds(ids);

      let recs: RecordRow[] = [];
      if (ids.length > 0) {
        const { data } = await supabase
          .from('records')
          .select('*')
          .in('id', ids)
          .order('release_year', { ascending: false });

        recs = (data as RecordRow[]) || [];
      }

      // mantener orden estable según release_year DESC (ya viene ordenado)
      setFavouriteRecords(recs);
      setLoading(false);
    })();
  }, [resolvedUserId, notFound]);

  const count = useMemo(() => favouriteIds.length, [favouriteIds]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-black font-[Roboto]">
        {/* Header (IGUAL al original, sin acciones) */}
        <div className="w-full px-5 sm:px-6 pt-9">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col">
              <div
                className="text-[11px] tracking-[0.28em] uppercase text-black/50"
                style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
              >
                Collection
              </div>

              <h1
                className="mt-2 text-[clamp(2.05rem,7.0vw,3.15rem)] leading-[0.95]"
                style={{
                  fontFamily: 'Times New Roman, serif',
                  fontWeight: 400,
                  letterSpacing: '-0.25px',
                  opacity: 0.92,
                }}
              >
                Favourite Records
              </h1>

              <div className="mt-4 h-[1px] w-24 bg-black/55" />
              <p className="text-sm text-neutral-600 mt-6">Loading…</p>
            </div>

            <div className="mt-2 w-[86px]" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black font-[Roboto]">
      {/* Header (IGUAL al original, sin acciones) */}
      <div className="w-full px-5 sm:px-6 pt-9">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col">
            <div
              className="text-[11px] tracking-[0.28em] uppercase text-black/50"
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
            >
              Collection
            </div>

            <h1
              className="mt-2 text-[clamp(2.05rem,7.0vw,3.15rem)] leading-[0.95]"
              style={{
                fontFamily: 'Times New Roman, serif',
                fontWeight: 400,
                letterSpacing: '-0.25px',
                opacity: 0.92,
              }}
            >
              Favourite Records
            </h1>

            <div className="mt-4 h-[1px] w-24 bg-black/55" />

            {resolvedUsername && (
              <p className="text-sm text-neutral-600 mt-4">Viewing @{resolvedUsername}</p>
            )}
          </div>

          {/* Sin Edit / sin + */}
          <div className="mt-2 w-[86px]" />
        </div>
      </div>

      {/* Body */}
      {notFound ? (
        <p
          className="text-center text-[16px] text-black/80 mt-16"
          style={{ fontFamily: 'Times New Roman, Times, serif' }}
        >
          User not found.
        </p>
      ) : favouriteRecords.length > 0 ? (
        <div className="w-full px-5 sm:px-6 mt-10 pb-36">
          <div className="text-[11px] uppercase tracking-[0.22em] text-black/45">
            Favourites · {count}
          </div>

          {/* Grid editorial (IGUAL) */}
          <div className="mt-7 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-7 gap-y-10">
            {favouriteRecords.map((record) => {
              return (
                <div key={record.id} className="flex flex-col items-center text-center">
                  <Link href={`/record/${record.id}`} className="relative">
                    <div
                      className="w-[140px] h-[140px] sm:w-[150px] sm:h-[150px] rounded-[22px] cursor-pointer transition-transform duration-200 hover:scale-[1.02] shadow-[0_12px_26px_rgba(0,0,0,0.10)] flex items-center justify-center"
                      style={{ backgroundColor: record.vibe_color || '#1F48AF' }}
                      aria-label={`Open ${record.title}`}
                      title={record.title}
                    >
                      <div
                        className="w-[54px] h-[54px] sm:w-[58px] sm:h-[58px] rounded-[10px]"
                        style={{ backgroundColor: record.cover_color || '#FFFFFF' }}
                      />
                    </div>
                  </Link>

                  <p
                    className="mt-4 text-[16px] leading-tight line-clamp-2"
                    style={{ fontFamily: 'Times New Roman, serif', opacity: 0.92 }}
                  >
                    {record.title}
                  </p>
                  <p className="mt-1 text-[12px] text-black/55 font-light line-clamp-1">
                    {record.artist_name}
                  </p>
                  {record.release_year ? (
                    <p className="mt-0.5 text-[12px] text-black/40 font-light">{record.release_year}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-center text-neutral-500 mt-16">No records yet.</p>
      )}
    </main>
  );
}

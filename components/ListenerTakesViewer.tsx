'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

/** Badge editorial del rating (versión grande – timeline) */
const RatingBadge = ({ rate }: { rate: number }) => {
  if (Number.isNaN(rate)) return null;
  return (
    <div
      className="relative inline-flex items-center justify-center select-none"
      style={{ width: 40, height: 40 }}
    >
      <div className="w-10 h-10 rounded-full border border-black flex items-center justify-center bg-white">
        <span className="text-[15px] leading-none" style={{ fontFamily: 'Times New Roman' }}>
          {rate}
        </span>
      </div>
      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-[#1F48AF] bg-white flex items-center justify-center">
        <div className="w-[5px] h-[5px] rounded-full bg-[#1F48AF]" />
      </div>
    </div>
  );
};

/** Badge rating para shelves (más pequeño) */
const RatingBadgeSmall = ({ rate }: { rate: number }) => {
  if (Number.isNaN(rate)) return null;
  return (
    <div
      className="relative inline-flex items-center justify-center select-none"
      style={{ width: 32, height: 32 }}
    >
      <div className="w-8 h-8 rounded-full border border-black flex items-center justify-center bg-white">
        <span className="text-[13px] leading-none" style={{ fontFamily: 'Times New Roman' }}>
          {rate}
        </span>
      </div>
      <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border border-[#1F48AF] bg-white flex items-center justify-center">
        <div className="w-[4px] h-[4px] rounded-full bg-[#1F48AF]" />
      </div>
    </div>
  );
};

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
};

type RecordRow = {
  id: string;
  title: string;
  artist_name: string;
  release_year: number | null;
  vibe_color?: string | null;
  cover_color?: string | null;
};

type Thought = {
  id: string;
  user_id: string;
  target_type: 'record';
  target_id: string;
  body: string | null;
  created_at: string;
  rating_id?: string | null;
  record?: RecordRow | null;
  rate?: number | null;
  listened_on?: string | null;
};

function formatDiaryDate(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function ListenerTakesViewer({ profileId: propProfileId }: { profileId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const usernameParam = searchParams?.get('username') || searchParams?.get('handle') || null;

  const [viewProfileId, setViewProfileId] = useState<string | null>(propProfileId ?? null);
  const [targetUsername, setTargetUsername] = useState<string | null>(null);

  const [takes, setTakes] = useState<Thought[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Vista tipo Letterboxd: timeline / shelves
  const [viewMode, setViewMode] = useState<'timeline' | 'shelves'>('timeline');

  // Orden
  const [sortMode, setSortMode] = useState<'recent' | 'rating_high' | 'rating_low' | 'alpha'>('recent');

  // "See more" por take (solo para expand/collapse)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  /* ========= Resolver profileId desde ?username si no viene por props ========= */
  useEffect(() => {
    let active = true;

    (async () => {
      if (viewProfileId) return;
      if (!usernameParam) return;

      const { data } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('username', usernameParam)
        .maybeSingle();

      if (!active) return;

      setViewProfileId(data?.id ?? null);
      setTargetUsername(data?.username ?? usernameParam);
    })();

    return () => {
      active = false;
    };
  }, [usernameParam, viewProfileId]);

  /* ========= Cargar takes del perfil objetivo (viewer) ========= */
  useEffect(() => {
    const boot = async () => {
      setLoading(true);

      if (!viewProfileId) {
        setTakes([]);
        setLoading(false);
        return;
      }

      const { data: recs, error } = await supabase
        .from('recommendations')
        .select('id, user_id, target_type, target_id, body, created_at, rating_id, listened_on')
        .eq('user_id', viewProfileId)
        .eq('target_type', 'record')
        .order('listened_on', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(400);

      if (error) {
        setTakes([]);
        setLoading(false);
        return;
      }

      const list = (recs || []) as Thought[];

      const recordIds = Array.from(new Set(list.map((t) => t.target_id))).filter(Boolean);
      let recordsMap: Record<string, RecordRow> = {};
      if (recordIds.length) {
        const { data: recRows } = await supabase
          .from('records')
          .select('id, title, artist_name, release_year, vibe_color, cover_color')
          .in('id', recordIds);

        (recRows || []).forEach((r: any) => {
          recordsMap[r.id] = r as RecordRow;
        });
      }

      const ratingIds = Array.from(
        new Set(list.map((t) => t.rating_id).filter((x) => x !== null && x !== undefined))
      ) as string[];

      let rateByRatingId: Record<string, number> = {};
      if (ratingIds.length) {
        const { data: ratingRows } = await supabase.from('ratings').select('id, rate').in('id', ratingIds);
        (ratingRows || []).forEach((r: any) => {
          rateByRatingId[r.id] = r.rate as number;
        });
      }

      const hydrated: Thought[] = list.map((t) => ({
        ...t,
        record: recordsMap[t.target_id] || null,
        rate: (t.rating_id ? rateByRatingId[t.rating_id] : null) ?? null,
      }));

      setTakes(hydrated);
      setLoading(false);
    };

    boot();
  }, [viewProfileId]);

  /* ========= Orden ========= */
  const sorted = useMemo(() => {
    const list = [...takes];

    list.sort((a, b) => {
      const da = new Date(a.listened_on || a.created_at).getTime();
      const db = new Date(b.listened_on || b.created_at).getTime();

      switch (sortMode) {
        case 'recent':
          return db - da;
        case 'rating_high': {
          const ra = a.rate ?? -999;
          const rb = b.rate ?? -999;
          if (rb !== ra) return rb - ra;
          return db - da;
        }
        case 'rating_low': {
          const ra2 = a.rate ?? 999;
          const rb2 = b.rate ?? 999;
          if (ra2 !== rb2) return ra2 - rb2;
          return db - da;
        }
        case 'alpha': {
          const ta = (a.record?.title || '').toLowerCase();
          const tb = (b.record?.title || '').toLowerCase();
          if (ta < tb) return -1;
          if (ta > tb) return 1;
          return 0;
        }
        default:
          return db - da;
      }
    });

    return list;
  }, [takes, sortMode]);

  // Agrupado por MES + AÑO (ej. "Nov 2025") para timeline
  const groupedByPeriod = useMemo(() => {
    type Bucket = { label: string; items: Thought[] };
    const map: Record<string, Bucket> = {};

    for (const t of sorted) {
      const d = new Date(t.listened_on || t.created_at);
      if (Number.isNaN(d.getTime())) {
        if (!map['Unknown']) map['Unknown'] = { label: 'Unknown', items: [] };
        map['Unknown'].items.push(t);
      } else {
        const year = d.getFullYear();
        const month = d.getMonth();
        const key = `${year}-${month + 1}`;
        const label = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
        if (!map[key]) map[key] = { label, items: [] };
        map[key].items.push(t);
      }
    }

    const orderedKeys = Object.keys(map).sort((a, b) => {
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      const [ya, ma] = a.split('-').map((v) => parseInt(v, 10));
      const [yb, mb] = b.split('-').map((v) => parseInt(v, 10));
      if (yb !== ya) return yb - ya;
      return mb - ma;
    });

    return { map, orderedKeys };
  }, [sorted]);

  return (
    <div className="bg-white min-h-screen text-black font-[Roboto]">
      <main
        className="mx-auto w-full max-w-[780px] px-4 pb-[calc(env(safe-area-inset-bottom)+8rem)]"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 2.25rem)',
        }}
      >
        {/* TOP — back button */}
        <div className="w-full px-5 sm:px-12 pb-4 flex items-center justify-between pt-2">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            title="Back"
            className="flex items-center gap-2 text-[#264AAE] font-light text-[0.95rem] py-1"
          >
            <span className="text-[1.35rem] leading-none -mt-[1px]">‹</span>
            <span>Back</span>
          </button>
          <div className="w-[60px]" />
        </div>

        {/* HEADER EDITORIAL (calcado, sin botón +) */}
        <header className="mb-5">
          <div className="flex items-center justify-between gap-3">
            <h1
              className="text-[clamp(26px,7vw,36px)] leading-tight"
              style={{
                fontFamily: '"Times New Roman", Times, serif',
                fontWeight: 400,
                letterSpacing: '-0.035em',
              }}
            >
              Musical opinions
            </h1>

            {/* SIN + (viewer) */}
            <div className="w-9 h-9" />
          </div>

          {targetUsername && (
            <p className="text-sm text-neutral-600 mt-3" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}>
              Viewing @{targetUsername}
            </p>
          )}
        </header>

        {/* CONTROLES SUPERIORES (calcados) */}
        <section className="mb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Vista Timeline / Shelves */}
            <div className="inline-flex rounded-full bg-neutral-100 p-1 self-start">
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`px-3 h-8 rounded-full text-[11px] ${
                  viewMode === 'timeline' ? 'bg-white shadow-sm' : 'text-neutral-600'
                }`}
              >
                Timeline
              </button>
              <button
                type="button"
                onClick={() => setViewMode('shelves')}
                className={`px-3 h-8 rounded-full text-[11px] ${
                  viewMode === 'shelves' ? 'bg-white shadow-sm' : 'text-neutral-600'
                }`}
              >
                Shelves
              </button>
            </div>

            {/* Orden – solo Recent / Top rated / A–Z */}
            <div className="flex flex-wrap gap-1.5 md:justify-end">
              <button
                type="button"
                onClick={() => setSortMode('recent')}
                className={`h-8 rounded-full px-3 text-[11px] border whitespace-nowrap ${
                  sortMode === 'recent'
                    ? 'bg-[#1F48AF] text-white border-[#1F48AF]'
                    : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                Recent
              </button>
              <button
                type="button"
                onClick={() => setSortMode('rating_high')}
                className={`h-8 rounded-full px-3 text-[11px] border whitespace-nowrap ${
                  sortMode === 'rating_high'
                    ? 'bg-[#1F48AF] text-white border-[#1F48AF]'
                    : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                Top rated
              </button>
              <button
                type="button"
                onClick={() => setSortMode('alpha')}
                className={`h-8 rounded-full px-3 text-[11px] border whitespace-nowrap ${
                  sortMode === 'alpha'
                    ? 'bg-[#1F48AF] text-white border-[#1F48AF]'
                    : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                A–Z
              </button>
            </div>
          </div>
        </section>

        {/* CONTENIDO PRINCIPAL */}
        <section>
          {loading ? (
            <div className="text-sm text-neutral-500">Loading diary…</div>
          ) : !viewProfileId ? (
            <div className="mt-16 text-center text-xs text-neutral-500">User not found.</div>
          ) : sorted.length === 0 ? (
            <div className="mt-16 text-center text-xs text-neutral-500">No records logged yet.</div>
          ) : viewMode === 'shelves' ? (
            // GRID – Shelves: cover limpia, info editorial debajo
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              {sorted.map((it) => (
                <Link key={it.id} href={`/record/${it.target_id}`} className="group block">
                  <div
                    className="w-full aspect-square rounded-3xl flex items-center justify-center border border-black/10 overflow-hidden"
                    style={{ backgroundColor: it.record?.vibe_color || '#f3f3f3' }}
                  >
                    <div
                      className="w-[38%] h-[38%] rounded-[10px] shadow"
                      style={{ backgroundColor: it.record?.cover_color || '#111' }}
                    />
                  </div>

                  <div className="mt-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className="text-[13px] leading-tight truncate group-hover:opacity-80"
                        style={{ fontFamily: '"Times New Roman", Times, serif' }}
                      >
                        {it.record?.title || 'Record'}
                      </p>
                      <p className="text-[11px] text-neutral-700 truncate">{it.record?.artist_name || '—'}</p>
                    </div>
                    {typeof it.rate === 'number' && (
                      <div className="shrink-0 pt-1">
                        <RatingBadgeSmall rate={it.rate} />
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            // TIMELINE – agrupado por mes + año
            <div className="space-y-4">
              {groupedByPeriod.orderedKeys.map((key) => {
                const bucket = groupedByPeriod.map[key];
                if (!bucket) return null;

                return (
                  <div key={key} className="space-y-3">
                    <div className="flex items-center gap-3 mt-2">
                      <div className="h-px flex-1 bg-neutral-200" />
                      <span
                        className="text-[11px] uppercase tracking-[0.18em] text-neutral-600"
                        style={{ fontFamily: '"Times New Roman", Times, serif' }}
                      >
                        {bucket.label.toUpperCase()}
                      </span>
                      <div className="h-px flex-1 bg-neutral-200" />
                    </div>

                    {bucket.items.map((it) => {
                      const fullBody = it.body || '';
                      const isLong = fullBody.length > 420;
                      const isExpanded = expanded[it.id];
                      const displayBody = !isLong || isExpanded ? fullBody : `${fullBody.slice(0, 420)}…`;

                      return (
                        <article
                          key={it.id}
                          className="relative rounded-[28px] border border-neutral-200 bg-white shadow-[0_14px_38px_rgba(0,0,0,0.06)]"
                        >
                          {/* rating flotante (solo UNA vez) */}
                          {typeof it.rate === 'number' && (
                            <div className="absolute top-4 right-4">
                              <RatingBadge rate={it.rate} />
                            </div>
                          )}

                          <div className="px-3 sm:px-5 py-4">
                            {/* CABECERA */}
                            <div className="flex items-start gap-3">
                              {/* COVER */}
                              <Link href={`/record/${it.target_id}`} className="shrink-0">
                                <div
                                  className="w-[64px] h-[64px] sm:w-[74px] sm:h-[74px] rounded-[18px] flex items-center justify-center border border-black/10 overflow-hidden"
                                  style={{ backgroundColor: it.record?.vibe_color || '#f3f3f3' }}
                                  aria-label={`${it.record?.title || 'Record'} cover`}
                                >
                                  <div
                                    className="w-[24px] h-[24px] sm:w-[28px] sm:h-[28px] rounded-[8px] shadow"
                                    style={{ backgroundColor: it.record?.cover_color || '#111' }}
                                  />
                                </div>
                              </Link>

                              <div className="flex-1 min-w-0 pr-12">
                                <Link href={`/record/${it.target_id}`}>
                                  <h3
                                    className="text-[16px] sm:text-[17px] leading-5 font-normal hover:opacity-80 break-words"
                                    style={{ fontFamily: '"Times New Roman", Times, serif' }}
                                  >
                                    {it.record?.title || 'Record'}
                                  </h3>
                                </Link>

                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <p className="text-[12px] text-neutral-700">
                                    {it.record?.artist_name || '—'}
                                    {it.record?.release_year ? ` · ${it.record.release_year}` : ''}
                                  </p>
                                  <span className="text-[11px] text-neutral-400">·</span>
                                  <p className="text-[11px] text-neutral-500">
                                    {formatDiaryDate(it.listened_on || it.created_at)}
                                  </p>
                                </div>

                                {/* SIN acciones (viewer) */}
                              </div>
                            </div>

                            {/* BODY */}
                            <div className="mt-4">
                              {fullBody ? (
                                <div>
                                  <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
                                    Listener take
                                  </p>

                                  <p
                                    className="text-[15px] leading-7 text-neutral-900"
                                    style={{ fontFamily: '"Times New Roman", Times, serif' }}
                                  >
                                    {displayBody}
                                  </p>

                                  {isLong && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpanded((prev) => ({
                                          ...prev,
                                          [it.id]: !isExpanded,
                                        }))
                                      }
                                      className="mt-2 text-[11px] text-[#1F48AF]"
                                    >
                                      {isExpanded ? 'See less' : 'See more'}
                                    </button>
                                  )}
                                </div>
                              ) : null}
                            </div>

                            {/* SEE MORE -> /review/[id].tsx */}
                            <div className="mt-4">
                              <Link
                                href={`/review/${it.id}`}
                                className="text-[11px] font-light text-neutral-500 hover:text-neutral-900"
                              >
                                See more
                              </Link>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

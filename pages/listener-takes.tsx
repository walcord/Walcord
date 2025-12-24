'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
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
        <span
          className="text-[15px] leading-none"
          style={{ fontFamily: 'Times New Roman' }}
        >
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
        <span
          className="text-[13px] leading-none"
          style={{ fontFamily: 'Times New Roman' }}
        >
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

type RecordSearchRow = {
  id: string;
  title: string;
  artist_name: string;
  release_year: number | null;
  vibe_color?: string | null;
  cover_color?: string | null;
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

/** Pequeño cuadrado de disco para buscador / grid */
function RecordSquareMini({
  vibe,
  cover,
}: {
  vibe?: string | null;
  cover?: string | null;
}) {
  return (
    <div
      className="w-9 h-9 rounded-lg flex items-center justify-center border border-black/10"
      style={{ backgroundColor: vibe || '#e5e5e5' }}
    >
      <div
        className="w-4 h-4 rounded-[4px] shadow"
        style={{ backgroundColor: cover || '#111' }}
      />
    </div>
  );
}

export default function ListenerTakesPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [me, setMe] = useState<Profile | null>(null);

  const [takes, setTakes] = useState<Thought[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Vista tipo Letterboxd: timeline / shelves
  const [viewMode, setViewMode] = useState<'timeline' | 'shelves'>('timeline');

  // Orden
  const [sortMode, setSortMode] = useState<
    'recent' | 'rating_high' | 'rating_low' | 'alpha'
  >('recent');

  // Form para nuevo take
  const [showForm, setShowForm] = useState(false);
  const [recordQ, setRecordQ] = useState('');
  const [recordSearching, setRecordSearching] = useState(false);
  const [recordResults, setRecordResults] = useState<RecordSearchRow[]>([]);
  const [selectedRecord, setSelectedRecord] =
    useState<RecordSearchRow | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [newBody, setNewBody] = useState('');
  const [newRate, setNewRate] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edición de texto
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState<string>('');

  // "See more" por take (solo para expand/collapse)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  /* ========= Init ========= */
  useEffect(() => {
    const boot = async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!uid) {
        router.push('/login');
        return;
      }
      setUserId(uid);

      const { data: myp } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .eq('id', uid)
        .maybeSingle();
      if (myp) setMe(myp as Profile);

      const { data: recs, error } = await supabase
        .from('recommendations')
        .select(
          'id, user_id, target_type, target_id, body, created_at, rating_id, listened_on',
        )
        .eq('user_id', uid)
        .eq('target_type', 'record')
        .order('listened_on', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) {
        setTakes([]);
        setLoading(false);
        return;
      }

      const list = (recs || []) as Thought[];

      const recordIds = Array.from(new Set(list.map((t) => t.target_id))).filter(
        Boolean,
      );
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
        new Set(
          list
            .map((t) => t.rating_id)
            .filter((x) => x !== null && x !== undefined),
        ),
      ) as string[];
      let rateByRatingId: Record<string, number> = {};
      if (ratingIds.length) {
        const { data: ratingRows } = await supabase
          .from('ratings')
          .select('id, rate')
          .in('id', ratingIds);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ========= Búsqueda de discos ========= */
  useEffect(() => {
    const term = recordQ.trim();
    if (!showForm) return;
    if (!term || term.length < 2) {
      setRecordResults([]);
      setRecordSearching(false);
      return;
    }
    setRecordSearching(true);

    const timeout = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('records')
          .select(
            'id, title, artist_name, release_year, vibe_color, cover_color',
          )
          .ilike('title', `%${term}%`)
          .limit(30);
        setRecordResults((data as RecordSearchRow[]) || []);
      } finally {
        setRecordSearching(false);
      }
    }, 220);

    return () => clearTimeout(timeout);
  }, [recordQ, showForm]);

  const canAdd = !!selectedRecord && typeof newRate === 'number';

  /* ========= Crear nuevo take ========= */
  const handleAddTake = async () => {
    if (!userId || !selectedRecord || !canAdd || submitting) return;

    setSubmitting(true);
    const bodyClean = newBody.trim();
    let listenedOn = today;
    let ratingId: string | null = null;

    if (typeof newRate === 'number') {
      const { data: ratingRow, error: ratingError } = await supabase
        .from('ratings')
        .insert({
          user_id: userId,
          target_type: 'record',
          target_id: selectedRecord.id,
          rate: newRate,
        })
        .select('id')
        .single();

      if (!ratingError && ratingRow) {
        ratingId = ratingRow.id as string;
      }
    }

    const payload: any = {
      user_id: userId,
      target_type: 'record',
      target_id: selectedRecord.id,
      body: bodyClean || null,
      rating_id: ratingId,
      listened_on: listenedOn,
      category: null, // ya no usamos shelves
    };

    const { data: recRow, error: recError } = await supabase
      .from('recommendations')
      .insert(payload)
      .select(
        'id, user_id, target_type, target_id, body, created_at, rating_id, listened_on',
      )
      .single();

    if (!recError && recRow) {
      const newTake: Thought = {
        ...(recRow as Thought),
        record: {
          id: selectedRecord.id,
          title: selectedRecord.title,
          artist_name: selectedRecord.artist_name,
          release_year: selectedRecord.release_year,
          vibe_color: selectedRecord.vibe_color,
          cover_color: selectedRecord.cover_color,
        },
        rate: newRate ?? null,
      };

      setTakes((prev) =>
        [newTake, ...prev].sort((a, b) => {
          const da = new Date(a.listened_on || a.created_at).getTime();
          const db = new Date(b.listened_on || b.created_at).getTime();
          return db - da;
        }),
      );

      setSelectedRecord(null);
      setRecordQ('');
      setRecordResults([]);
      setNewBody('');
      setNewRate(null);
      setShowForm(false);
    }

    setSubmitting(false);
  };

  /* ========= Edición ========= */
  const beginEdit = (t: Thought) => {
    setEditingId(t.id);
    setEditingBody(t.body || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingBody('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const bodyClean = editingBody.trim();

    const { error } = await supabase
      .from('recommendations')
      .update({ body: bodyClean || null })
      .eq('id', editingId)
      .eq('user_id', userId || '');

    if (!error) {
      setTakes((prev) =>
        prev.map((it) =>
          it.id === editingId ? { ...it, body: bodyClean || null } : it,
        ),
      );
      cancelEdit();
    }
  };

  const deleteTake = async (id: string) => {
    if (!confirm('Delete this record from your diary?')) return;
    await supabase
      .from('recommendations')
      .delete()
      .eq('id', id)
      .eq('user_id', userId || '');
    setTakes((prev) => prev.filter((it) => it.id !== id));
  };

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
        if (!map['Unknown']) {
          map['Unknown'] = { label: 'Unknown', items: [] };
        }
        map['Unknown'].items.push(t);
      } else {
        const year = d.getFullYear();
        const month = d.getMonth(); // 0-11
        const key = `${year}-${month + 1}`;
        const label = d.toLocaleDateString('en-GB', {
          month: 'short',
          year: 'numeric',
        });
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

  /* ========= Render ========= */

  return (
    <div className="bg-white min-h-screen text-black font-[Roboto]">
      {/* TOP — back button (TU BLOQUE EXACTO) */}
      <div className="sticky top-0 z-50 bg-white">
        <div className="w-full px-5 sm:px-12 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            title="Back"
            className="flex items-center gap-2 text-[#264AAE] font-light text-[0.95rem]"
          >
            <span className="text-[1.35rem] leading-none -mt-[1px]">‹</span>
            <span>Back</span>
          </button>
          <div className="w-[60px]" />
        </div>
      </div>

      <main
        className="mx-auto w-full max-w-[780px] px-4"
        style={{
          paddingTop: '0px',
          paddingBottom: 'calc(120px + env(safe-area-inset-bottom))',
        }}
      >
        {/* HEADER EDITORIAL */}
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
            <button
              type="button"
              onClick={() => setShowForm((s) => !s)}
              aria-label="Log a record"
              className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-[0_10px_24px_rgba(0,0,0,0.25)] hover:scale-105 active:scale-95 transition-transform"
              style={{ backgroundColor: '#1F48AF' }}
            >
              <span className="text-lg leading-none">+</span>
            </button>
          </div>
        </header>

        {/* FORM INLINE */}
        {showForm && (
          <section className="mb-6 rounded-3xl border border-neutral-200 bg-white px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.08)]">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {/* RECORD SEARCH */}
              <div className="col-span-2 relative">
                {selectedRecord ? (
                  <div className="flex items-center justify-between rounded-2xl border border-neutral-200 px-3 py-2 bg-neutral-50/70">
                    <div className="flex items-center gap-3 min-w-0">
                      <RecordSquareMini
                        vibe={selectedRecord.vibe_color}
                        cover={selectedRecord.cover_color}
                      />
                      <div className="min-w-0">
                        <p
                          className="truncate text-[14px]"
                          style={{
                            fontFamily: '"Times New Roman", Times, serif',
                          }}
                        >
                          {selectedRecord.title}
                        </p>
                        <p className="text-[11px] text-neutral-600 truncate">
                          {selectedRecord.artist_name}
                          {selectedRecord.release_year
                            ? ` · ${selectedRecord.release_year}`
                            : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-[11px] text-[#1F48AF]"
                      onClick={() => {
                        setSelectedRecord(null);
                        setRecordQ('');
                        setRecordResults([]);
                      }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={recordQ}
                      onChange={(e) => setRecordQ(e.target.value)}
                      placeholder="Search record"
                      className="w-full rounded-2xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#1F48AF]"
                    />
                    {(recordSearching || recordResults.length > 0) && (
                      <div className="absolute mt-1 w-full rounded-2xl border border-neutral-200 bg-white shadow-xl max-h-64 overflow-auto z-30">
                        {recordSearching && (
                          <div className="px-3 py-2 text-sm text-neutral-500">
                            Searching…
                          </div>
                        )}
                        {!recordSearching &&
                          recordResults.map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => {
                                setSelectedRecord(r);
                                setRecordQ('');
                                setRecordResults([]);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-neutral-50 flex items-center gap-3"
                            >
                              <RecordSquareMini
                                vibe={r.vibe_color}
                                cover={r.cover_color}
                              />
                              <div className="min-w-0">
                                <p
                                  className="text-[14px] truncate"
                                  style={{
                                    fontFamily:
                                      '"Times New Roman", Times, serif',
                                  }}
                                >
                                  {r.title}
                                </p>
                                <p className="text-[11px] text-neutral-600 truncate">
                                  {r.artist_name}
                                  {r.release_year ? ` · ${r.release_year}` : ''}
                                </p>
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* RATING */}
              <div className="col-span-2">
                <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                  Rating
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 10 }).map((_, idx) => {
                    const v = idx + 1;
                    const active = newRate === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() =>
                          setNewRate((prev) => (prev === v ? null : v))
                        }
                        className={`w-7 h-7 rounded-full text-[11px] flex items-center justify-center border ${
                          active
                            ? 'bg-[#1F48AF] border-[#1F48AF] text-white'
                            : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                        }`}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* TEXT REVIEW */}
              <textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Write your take"
                className="col-span-2 rounded-2xl border border-neutral-200 px-3 py-3 text-[15px] leading-7 outline-none focus:ring-2 focus:ring-[#1F48AF] min-h-[90px]"
                style={{
                  fontFamily: '"Times New Roman", Times, serif',
                }}
                maxLength={1000}
              />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-[11px] text-neutral-500 hover:text-black"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddTake}
                disabled={!canAdd || submitting}
                className="rounded-full px-5 h-9 text-xs text-white enabled:hover:opacity-90 disabled:opacity-40 transition"
                style={{ backgroundColor: '#1F48AF' }}
              >
                {submitting ? 'Saving…' : 'Log record'}
              </button>
            </div>
          </section>
        )}

        {/* CONTROLES SUPERIORES */}
        <section className="mb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Vista Timeline / Shelves */}
            <div className="inline-flex rounded-full bg-neutral-100 p-1 self-start">
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`px-3 h-8 rounded-full text-[11px] ${
                  viewMode === 'timeline'
                    ? 'bg-white shadow-sm'
                    : 'text-neutral-600'
                }`}
              >
                Timeline
              </button>
              <button
                type="button"
                onClick={() => setViewMode('shelves')}
                className={`px-3 h-8 rounded-full text-[11px] ${
                  viewMode === 'shelves'
                    ? 'bg-white shadow-sm'
                    : 'text-neutral-600'
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
          ) : sorted.length === 0 ? (
            <div className="mt-16 text-center text-xs text-neutral-500">
              No records logged yet.
            </div>
          ) : viewMode === 'shelves' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              {sorted.map((it) => (
                <Link
                  key={it.id}
                  href={`/record/${it.target_id}`}
                  className="group block"
                >
                  <div
                    className="w-full aspect-square rounded-3xl flex items-center justify-center border border-black/10 overflow-hidden"
                    style={{
                      backgroundColor: it.record?.vibe_color || '#f3f3f3',
                    }}
                  >
                    <div
                      className="w-[38%] h-[38%] rounded-[10px] shadow"
                      style={{
                        backgroundColor: it.record?.cover_color || '#111',
                      }}
                    />
                  </div>

                  <div className="mt-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className="text-[13px] leading-tight truncate group-hover:opacity-80"
                        style={{
                          fontFamily: '"Times New Roman", Times, serif',
                        }}
                      >
                        {it.record?.title || 'Record'}
                      </p>
                      <p className="text-[11px] text-neutral-700 truncate">
                        {it.record?.artist_name || '—'}
                      </p>
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
                        style={{
                          fontFamily: '"Times New Roman", Times, serif',
                        }}
                      >
                        {bucket.label.toUpperCase()}
                      </span>
                      <div className="h-px flex-1 bg-neutral-200" />
                    </div>

                    {bucket.items.map((it) => {
                      const fullBody = it.body || '';
                      const isLong = fullBody.length > 420;
                      const isExpanded = expanded[it.id];
                      const displayBody =
                        !isLong || isExpanded
                          ? fullBody
                          : `${fullBody.slice(0, 420)}…`;

                      return (
                        <article
                          key={it.id}
                          className="relative rounded-[28px] border border-neutral-200 bg-white shadow-[0_14px_38px_rgba(0,0,0,0.06)]"
                        >
                          {typeof it.rate === 'number' && (
                            <div className="absolute top-4 right-4">
                              <RatingBadge rate={it.rate} />
                            </div>
                          )}

                          <div className="px-3 sm:px-5 py-4">
                            <div className="flex items-start gap-3">
                              <Link
                                href={`/record/${it.target_id}`}
                                className="shrink-0"
                              >
                                <div
                                  className="w-[64px] h-[64px] sm:w-[74px] sm:h-[74px] rounded-[18px] flex items-center justify-center border border-black/10 overflow-hidden"
                                  style={{
                                    backgroundColor:
                                      it.record?.vibe_color || '#f3f3f3',
                                  }}
                                  aria-label={`${
                                    it.record?.title || 'Record'
                                  } cover`}
                                >
                                  <div
                                    className="w-[24px] h-[24px] sm:w-[28px] sm:h-[28px] rounded-[8px] shadow"
                                    style={{
                                      backgroundColor:
                                        it.record?.cover_color || '#111',
                                    }}
                                  />
                                </div>
                              </Link>

                              <div className="flex-1 min-w-0 pr-12">
                                <Link href={`/record/${it.target_id}`}>
                                  <h3
                                    className="text-[16px] sm:text-[17px] leading-5 font-normal hover:opacity-80 break-words"
                                    style={{
                                      fontFamily:
                                        '"Times New Roman", Times, serif',
                                    }}
                                  >
                                    {it.record?.title || 'Record'}
                                  </h3>
                                </Link>

                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <p className="text-[12px] text-neutral-700">
                                    {it.record?.artist_name || '—'}
                                    {it.record?.release_year
                                      ? ` · ${it.record.release_year}`
                                      : ''}
                                  </p>
                                  <span className="text-[11px] text-neutral-400">
                                    ·
                                  </span>
                                  <p className="text-[11px] text-neutral-500">
                                    {formatDiaryDate(
                                      it.listened_on || it.created_at,
                                    )}
                                  </p>
                                </div>

                                {it.user_id === userId && (
                                  <div className="mt-2 flex gap-2">
                                    {editingId === it.id ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={saveEdit}
                                          className="h-7 px-3 rounded-full text-[10px] bg-[#1F48AF] text-white hover:opacity-95"
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          onClick={cancelEdit}
                                          className="h-7 px-3 rounded-full text-[10px] bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => beginEdit(it)}
                                          className="h-7 px-3 rounded-full text-[10px] bg-white border border-neutral-200 hover:bg-neutral-50"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => deleteTake(it.id)}
                                          className="h-7 px-3 rounded-full text-[10px] bg-white border border-neutral-200 hover:bg-neutral-50"
                                        >
                                          Delete
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="mt-4">
                              {editingId === it.id ? (
                                <textarea
                                  value={editingBody}
                                  onChange={(e) =>
                                    setEditingBody(e.target.value)
                                  }
                                  className="w-full min-h-[110px] border border-neutral-200 rounded-2xl px-3 py-3 text-[15px] leading-7 outline-none focus:ring-2 focus:ring-[#1F48AF]"
                                  style={{
                                    fontFamily:
                                      '"Times New Roman", Times, serif',
                                  }}
                                  maxLength={1000}
                                />
                              ) : fullBody ? (
                                <div>
                                  <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
                                    Listener take
                                  </p>

                                  <p
                                    className="text-[15px] leading-7 text-neutral-900"
                                    style={{
                                      fontFamily:
                                        '"Times New Roman", Times, serif',
                                    }}
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

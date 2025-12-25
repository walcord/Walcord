'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

const WALCORD_BLUE = '#1F48AF';
const GENRES_TABLE = 'genres';

function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

/* ===============================
   Loader
   =============================== */
function PremiumLoader() {
  return (
    <div className="flex flex-col items-center justify-center">
      <Image src="/logotipo-dark.png" alt="Walcord" width={72} height={72} priority />
      <div
        className="mt-8 h-7 w-7 rounded-full border border-transparent border-t-[2px]"
        style={{ borderTopColor: WALCORD_BLUE, animation: 'spin 0.9s linear infinite' }}
      />
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

/* ===============================
   Progress
   =============================== */
function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={clsx('h-[6px] rounded-full transition-all', i === step ? 'w-7' : 'w-[6px]')}
          style={{ backgroundColor: i === step ? WALCORD_BLUE : 'rgba(0,0,0,0.15)' }}
        />
      ))}
    </div>
  );
}

/* ===============================
   Palette (editorial darks — Zara vibe)
   - deterministic by id (no DB)
   =============================== */
const EDITORIAL_DARKS = [
  '#0B0F1A', // ink
  '#0F254E', // navy
  '#1B2A41', // slate navy
  '#14213D', // deep blue
  '#112D32', // petrol
  '#2C3E50', // midnight
  '#1D3557', // city blue
  '#2F3E46', // charcoal
  '#3D2C2E', // oxblood charcoal
  '#2E4057', // steel
];

function hashToIndex(str: string, mod: number) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % mod;
}

function artistColor(id: string) {
  return EDITORIAL_DARKS[hashToIndex(id || 'x', EDITORIAL_DARKS.length)];
}

/* ===============================
   Types
   =============================== */
type GenreRow = { id: string; slug: string | null };
type ArtistRow = { id: string; name: string; image_url: string | null };
type RecordRow = {
  id: string;
  title: string;
  artist_name?: string | null;
  cover_url: string | null;
  vibe_color: string | null;
  cover_color: string | null;
};

export default function Onboarding() {
  const router = useRouter();

  const TOTAL = 4;

  const [step, setStep] = useState(0);
  const [boot, setBoot] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);

  // Genres
  const [genres, setGenres] = useState<GenreRow[]>([]);
  const [genreQ, setGenreQ] = useState('');
  const [pickedGenres, setPickedGenres] = useState<GenreRow[]>([]);

  // Artists
  const [artistQ, setArtistQ] = useState('');
  const [artistResults, setArtistResults] = useState<ArtistRow[]>([]);
  const [pickedArtists, setPickedArtists] = useState<ArtistRow[]>([]);

  // Records
  const [recordQ, setRecordQ] = useState('');
  const [recordResults, setRecordResults] = useState<RecordRow[]>([]);
  const [pickedRecords, setPickedRecords] = useState<RecordRow[]>([]);

  // Prevent iOS “hidden bar” issues
  const pageRef = useRef<HTMLDivElement | null>(null);

  const canContinue = useMemo(() => {
    if (step === 0) return true;
    if (step === 1) return pickedGenres.length === 2;
    if (step === 2) return pickedArtists.length >= 1;
    if (step === 3) return pickedRecords.length >= 1;
    return false;
  }, [step, pickedGenres.length, pickedArtists.length, pickedRecords.length]);

  /* ===============================
     Init
     =============================== */
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!mounted) return;

      const uid = sessionData?.session?.user?.id || null;
      if (!uid) {
        router.replace('/login');
        return;
      }
      setUserId(uid);

      // Optional “onboarding_completed” guard (won’t crash if column not present)
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', uid)
          .maybeSingle();
        if ((prof as any)?.onboarding_completed === true) {
          router.replace('/feed');
          return;
        }
      } catch {
        // ignore
      }

      // Genres: IMPORTANT — use slug (NOT name)
      const { data: g, error: gErr } = await supabase
        .from(GENRES_TABLE)
        .select('id,slug')
        .order('slug', { ascending: true })
        .limit(1000);

      if (!gErr) setGenres((g as GenreRow[]) || []);
      setBoot(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  /* ===============================
     Searches (artists / records)
   =============================== */
  useEffect(() => {
    const q = artistQ.trim();
    let cancelled = false;

    (async () => {
      if (!q) {
        setArtistResults([]);
        return;
      }
      const { data } = await supabase.from('artists').select('id,name,image_url').ilike('name', `%${q}%`).limit(24);
      if (!cancelled) setArtistResults((data as ArtistRow[]) || []);
    })();

    return () => {
      cancelled = true;
    };
  }, [artistQ]);

  useEffect(() => {
    const q = recordQ.trim();
    let cancelled = false;

    (async () => {
      if (!q) {
        setRecordResults([]);
        return;
      }
      // include vibe_color + cover_color for the “double square”
      const { data } = await supabase
        .from('records')
        .select('id,title,artist_name,cover_url,vibe_color,cover_color')
        .ilike('title', `%${q}%`)
        .limit(24);

      if (!cancelled) setRecordResults((data as RecordRow[]) || []);
    })();

    return () => {
      cancelled = true;
    };
  }, [recordQ]);

  /* ===============================
     Filtering
     =============================== */
  const filteredGenres = useMemo(() => {
    const q = genreQ.trim().toLowerCase();
    if (!q) return genres;
    return genres.filter((g) => String(g.slug || '').toLowerCase().includes(q));
  }, [genres, genreQ]);

  /* ===============================
     UI actions
     =============================== */
  const toggleGenre = (g: GenreRow) => {
    setPickedGenres((prev) => {
      const exists = prev.some((x) => x.id === g.id);
      if (exists) return prev.filter((x) => x.id !== g.id);
      if (prev.length >= 2) return prev;
      return [...prev, g];
    });
  };

  const toggleArtist = (a: ArtistRow) => {
    setPickedArtists((prev) => {
      const exists = prev.some((x) => x.id === a.id);
      if (exists) return prev.filter((x) => x.id !== a.id);
      return [...prev, a];
    });
  };

  const toggleRecord = (r: RecordRow) => {
    setPickedRecords((prev) => {
      const exists = prev.some((x) => x.id === r.id);
      if (exists) return prev.filter((x) => x.id !== r.id);
      return [...prev, r];
    });
  };

  const pickAvatar = (file: File | null) => {
    setAvatarFile(file);
    if (!file) {
      setAvatarPreview(null);
      return;
    }
    setAvatarPreview(URL.createObjectURL(file));
  };

  /* ===============================
     Saving (linked to your tables)
     - favourite_genres: user_id, genre_id
     - favourite_artists: user_id, artist_id
     - favourite_records: user_id, records_id   (IMPORTANT)
     =============================== */
  const saveAvatarIfAny = async () => {
    if (!userId || !avatarFile) return;

    setSavingAvatar(true);
    try {
      const ext = (avatarFile.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${userId}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage.from('avatars').upload(path, avatarFile, {
        upsert: true,
        cacheControl: '3600',
        contentType: avatarFile.type || 'image/jpeg',
      });

      if (upErr) {
        console.error('[Onboarding] avatar upload error:', upErr);
        return;
      }

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatarUrl = pub?.publicUrl || null;

      // Ensure the profile row gets the avatar_url (your profiles table has avatar_url)
      const { error: pErr } = await supabase.from('profiles').upsert(
        {
          id: userId,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'id' }
      );

      if (pErr) console.error('[Onboarding] profile avatar_url upsert error:', pErr);
    } finally {
      setSavingAvatar(false);
    }
  };

  const saveGenresIfAny = async () => {
    if (!userId) return;
    if (pickedGenres.length === 0) return;

    const { error: delErr } = await supabase.from('favourite_genres').delete().eq('user_id', userId);
    if (delErr) console.error('[Onboarding] delete favourite_genres error:', delErr);

    const { error: insErr } = await supabase.from('favourite_genres').insert(
      pickedGenres.map((g) => ({
        user_id: userId,
        genre_id: g.id,
      }))
    );
    if (insErr) console.error('[Onboarding] insert favourite_genres error:', insErr);
  };

  const saveArtistsIfAny = async () => {
    if (!userId) return;
    if (pickedArtists.length === 0) return;

    const { error: delErr } = await supabase.from('favourite_artists').delete().eq('user_id', userId);
    if (delErr) console.error('[Onboarding] delete favourite_artists error:', delErr);

    const { error: insErr } = await supabase.from('favourite_artists').insert(
      pickedArtists.map((a) => ({
        user_id: userId,
        artist_id: a.id,
      }))
    );
    if (insErr) console.error('[Onboarding] insert favourite_artists error:', insErr);
  };

  const saveRecordsIfAny = async () => {
    if (!userId) return;
    if (pickedRecords.length === 0) return;

    // IMPORTANT: your column is records_id (not record_id)
    const { error: delErr } = await supabase.from('favourite_records').delete().eq('user_id', userId);
    if (delErr) console.error('[Onboarding] delete favourite_records error:', delErr);

    const { error: insErr } = await supabase.from('favourite_records').insert(
      pickedRecords.map((r) => ({
        user_id: userId,
        records_id: r.id,
      }))
    );
    if (insErr) console.error('[Onboarding] insert favourite_records error:', insErr);
  };

  const finishOnboarding = async () => {
    // Optional column; won’t break if it doesn’t exist
    if (userId) {
      try {
        await supabase.from('profiles').upsert(
          {
            id: userId,
            onboarding_completed: true,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: 'id' }
        );
      } catch {
        // ignore
      }
    }
    router.replace('/feed');
  };

  const persistCurrentStepIfAny = useCallback(async () => {
    if (step === 0) await saveAvatarIfAny();
    if (step === 1) await saveGenresIfAny();
    if (step === 2) await saveArtistsIfAny();
    if (step === 3) await saveRecordsIfAny();
  }, [step, userId, avatarFile, pickedGenres, pickedArtists, pickedRecords]);

  const next = async () => {
    if (!canContinue) return;

    await persistCurrentStepIfAny();

    if (step >= TOTAL - 1) {
      await finishOnboarding();
      return;
    }

    setStep((s) => Math.min(s + 1, TOTAL - 1));
    pageRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' });
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  const skip = async () => {
    // “Skip” still saves *if user selected something* on that step (so it registers)
    await persistCurrentStepIfAny();

    if (step >= TOTAL - 1) {
      await finishOnboarding();
      return;
    }

    setStep((s) => Math.min(s + 1, TOTAL - 1));
    pageRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' });
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  const back = () => {
    setStep((s) => Math.max(s - 1, 0));
    pageRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' });
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  /* ===============================
     UI blocks (Spotify-ish, Walcord minimal)
     =============================== */
  const Header = (
    <div className="flex items-center justify-between">
      <button
        onClick={skip}
        className="text-[12px] text-black/45 hover:text-black/70 transition"
        style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
      >
        Skip
      </button>

      <Image src="/logotipo-dark.png" alt="Walcord" width={44} height={44} priority />

      <button
        onClick={back}
        disabled={step === 0}
        className="text-[12px] text-black/45 hover:text-black/70 transition disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
      >
        Back
      </button>
    </div>
  );

  const StepHint = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div className="mt-10">
      <div
        className="text-[11px] tracking-[0.28em] uppercase text-black/45"
        style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
      >
        Step {step + 1} of {TOTAL}
      </div>
      <h2 className="mt-3 text-[34px] text-black" style={{ fontFamily: 'Times New Roman, serif', fontWeight: 400 }}>
        {title}
      </h2>
      <p className="mt-3 text-[14px] text-black/55" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}>
        {subtitle}
      </p>
      <div className="mt-6 h-[1px] w-24 bg-black/55" />
    </div>
  );

  if (boot) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <PremiumLoader />
      </div>
    );
  }

  return (
    <div
      ref={pageRef as any}
      className="min-h-screen bg-white px-6"
      style={{
        // keep things visible on iPhone / Xcode webview
        paddingTop: 'calc(env(safe-area-inset-top) + 28px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 120px)',
      }}
    >
      <div className="mx-auto w-full max-w-[520px]">
        {/* HEADER */}
        {Header}

        <div className="mt-8 flex justify-center">
          <ProgressDots step={step} total={TOTAL} />
        </div>

        {/* =======================
            STEP 0 — Avatar
           ======================= */}
        {step === 0 && (
          <>
            <StepHint title="Add a photo." subtitle="Optional — you can always change it later." />

            <div className="mt-10 flex flex-col items-center">
              <div className="h-[150px] w-[150px] rounded-full border border-black/10 overflow-hidden bg-black/5 flex items-center justify-center">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[12px] text-black/40" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}>
                    Optional
                  </span>
                )}
              </div>

              <label className="mt-6 cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => pickAvatar(e.target.files?.[0] || null)}
                />
                <span
                  className="inline-flex items-center justify-center rounded-full px-4 py-2 border border-black/15 text-[12.5px] text-black hover:bg-black/5 active:scale-[0.99] transition"
                  style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
                >
                  Choose photo
                </span>
              </label>
            </div>
          </>
        )}

        {/* =======================
            STEP 1 — Genres
           ======================= */}
        {step === 1 && (
          <>
            <StepHint title="Select two genres." subtitle="Pick exactly two — you can edit anytime." />

            <div className="mt-8">
              <div className="rounded-2xl border border-black/10 px-4 py-3">
                <input
                  value={genreQ}
                  onChange={(e) => setGenreQ(e.target.value)}
                  placeholder="Search genres"
                  className="w-full outline-none bg-transparent text-[14px] text-black placeholder-black/30"
                  style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
                />
              </div>

              {/* Selected pills */}
              <div className="mt-4 flex flex-wrap gap-2">
                {pickedGenres.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => toggleGenre(g)}
                    className="px-3 py-1.5 rounded-full text-white text-[11px] active:scale-[0.99] transition"
                    style={{ backgroundColor: WALCORD_BLUE, fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
                    aria-label={`Remove ${g.slug || 'genre'}`}
                    title="Remove"
                  >
                    {g.slug} ×
                  </button>
                ))}
              </div>

              {/* Spotify-ish “chips/cards” */}
              <div className="mt-6 flex flex-wrap gap-2">
                {filteredGenres.slice(0, 80).map((g) => {
                  const active = pickedGenres.some((x) => x.id === g.id);
                  const label = g.slug || '';
                  if (!label) return null;

                  return (
                    <button
                      key={g.id}
                      onClick={() => toggleGenre(g)}
                      className={clsx(
                        'rounded-full border px-3 py-2 text-left active:scale-[0.99] transition',
                        active ? 'border-black/30 bg-black/[0.03]' : 'border-black/10 hover:bg-black/[0.03]'
                      )}
                      style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
                    >
                      <span className="text-[12.5px] text-black">{label}</span>
                    </button>
                  );
                })}
              </div>

              <p className="mt-6 text-[12px] text-black/45" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}>
                {pickedGenres.length}/2 selected
              </p>
            </div>
          </>
        )}

        {/* =======================
            STEP 2 — Artist
           ======================= */}
        {step === 2 && (
          <>
            <StepHint title="Select your favourite artist." subtitle="Search and pick at least one." />

            <div className="mt-8">
              <div className="rounded-2xl border border-black/10 px-4 py-3">
                <input
                  value={artistQ}
                  onChange={(e) => setArtistQ(e.target.value)}
                  placeholder="Search artists"
                  className="w-full outline-none bg-transparent text-[14px] text-black placeholder-black/30"
                  style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
                />
              </div>

              {/* Selected pills */}
              <div className="mt-4 flex flex-wrap gap-2">
                {pickedArtists.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => toggleArtist(a)}
                    className="px-3 py-1.5 rounded-full text-white text-[11px] active:scale-[0.99] transition"
                    style={{ backgroundColor: WALCORD_BLUE, fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
                    aria-label={`Remove ${a.name}`}
                    title="Remove"
                  >
                    {a.name} ×
                  </button>
                ))}
              </div>

              {/* Results grid (Spotify-ish tiles) */}
              <div className="mt-6 grid grid-cols-3 sm:grid-cols-4 gap-4">
                {artistResults.map((a) => {
                  const active = pickedArtists.some((x) => x.id === a.id);
                  const bg = artistColor(a.id);

                  return (
                    <button
                      key={a.id}
                      onClick={() => toggleArtist(a)}
                      className={clsx(
                        'flex flex-col items-center gap-2 p-2 rounded-2xl border active:scale-[0.99] transition',
                        active ? 'border-black/30 bg-black/[0.03]' : 'border-black/10 hover:bg-black/[0.03]'
                      )}
                      aria-label={`Pick ${a.name}`}
                      title={a.name}
                    >
                      <div
                        className="h-[72px] w-[72px] rounded-full overflow-hidden flex items-center justify-center shadow-[0_10px_18px_rgba(0,0,0,0.08)]"
                        style={{ backgroundColor: bg }}
                      >
                        {a.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.image_url} alt={a.name} className="h-full w-full object-cover" />
                        ) : (
                          // IMPORTANT: no letter (user asked)
                          <div className="h-full w-full" />
                        )}
                      </div>

                      <div className="text-[12px] text-center text-black line-clamp-2" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}>
                        {a.name}
                      </div>
                    </button>
                  );
                })}
              </div>

              {!artistQ.trim() ? (
                <p className="mt-4 text-[12px] text-black/40" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}>
                  Type to search.
                </p>
              ) : null}
            </div>
          </>
        )}

        {/* =======================
            STEP 3 — Record
           ======================= */}
        {step === 3 && (
          <>
            <StepHint title="Select your favourite record." subtitle="Search and pick at least one." />

            <div className="mt-8">
              <div className="rounded-2xl border border-black/10 px-4 py-3">
                <input
                  value={recordQ}
                  onChange={(e) => setRecordQ(e.target.value)}
                  placeholder="Search records"
                  className="w-full outline-none bg-transparent text-[14px] text-black placeholder-black/30"
                  style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
                />
              </div>

              {/* Selected pills */}
              <div className="mt-4 flex flex-wrap gap-2">
                {pickedRecords.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => toggleRecord(r)}
                    className="px-3 py-1.5 rounded-full text-white text-[11px] active:scale-[0.99] transition"
                    style={{ backgroundColor: WALCORD_BLUE, fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
                    aria-label={`Remove ${r.title}`}
                    title="Remove"
                  >
                    {r.title} ×
                  </button>
                ))}
              </div>

              {/* Results grid with “double square” (like your FavouriteRecords UI) */}
              <div className="mt-6 grid grid-cols-3 sm:grid-cols-4 gap-4">
                {recordResults.map((r) => {
                  const active = pickedRecords.some((x) => x.id === r.id);
                  const vibe = r.vibe_color || WALCORD_BLUE;
                  const cover = r.cover_color || '#FFFFFF';

                  return (
                    <button
                      key={r.id}
                      onClick={() => toggleRecord(r)}
                      className={clsx(
                        'flex flex-col items-start gap-2 p-2 rounded-2xl border active:scale-[0.99] transition',
                        active ? 'border-black/30 bg-black/[0.03]' : 'border-black/10 hover:bg-black/[0.03]'
                      )}
                      aria-label={`Pick ${r.title}`}
                      title={r.title}
                    >
                      {/* double square */}
                      <div
                        className="h-[82px] w-[82px] rounded-[18px] flex items-center justify-center shadow-[0_12px_22px_rgba(0,0,0,0.10)]"
                        style={{ backgroundColor: vibe }}
                      >
                        <div className="h-[30px] w-[30px] rounded-[8px]" style={{ backgroundColor: cover }} />
                      </div>

                      <div className="w-full">
                        <div className="text-[12px] text-black line-clamp-2" style={{ fontFamily: 'Times New Roman, serif', fontWeight: 400, opacity: 0.92 }}>
                          {r.title}
                        </div>
                        {r.artist_name ? (
                          <div className="text-[11px] text-black/45 font-light truncate" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}>
                            {r.artist_name}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>

              {!recordQ.trim() ? (
                <p className="mt-4 text-[12px] text-black/40" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}>
                  Type to search.
                </p>
              ) : null}
            </div>
          </>
        )}

        {/* =======================
            CTA — fixed, safe-area aware
           ======================= */}
        <div
          className="fixed left-0 right-0 bg-white"
          style={{
            bottom: 0,
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
            paddingTop: 10,
          }}
        >
          <div className="px-6">
            <button
              onClick={next}
              disabled={!canContinue || savingAvatar}
              className="w-full rounded-full py-3 text-[14px] text-white active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: WALCORD_BLUE, fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
            >
              {savingAvatar ? 'Saving…' : step === TOTAL - 1 ? 'Finish' : 'Continue'}
            </button>

            {/* tiny helper under CTA */}
            <div className="mt-2 text-center text-[11px] text-black/40" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}>
              {step === 1 ? 'Select exactly 2 genres.' : step === 2 ? 'Select at least 1 artist.' : step === 3 ? 'Select at least 1 record.' : ' '}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

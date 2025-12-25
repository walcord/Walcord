'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

const WALCORD_BLUE = '#1F48AF';
const GENRES_TABLE = 'genres';

function clsx(...xs) {
  return xs.filter(Boolean).join(' ');
}

function PremiumLoader() {
  return (
    <div className="flex flex-col items-center justify-center">
      <Image src="/logotipo-dark.png" alt="Walcord" width={74} height={74} priority />
      <div className="mt-8 h-9 w-9 rounded-full border border-black/15 border-t-[3px]" style={{ borderTopColor: WALCORD_BLUE }} />
      <style jsx>{`
        div.mt-8 {
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

function ProgressDots({ step, total }) {
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

export default function Onboarding() {
  const router = useRouter();

  const TOTAL = 4;
  const [step, setStep] = useState(0);
  const [boot, setBoot] = useState(true);
  const [userId, setUserId] = useState(null);

  // Step 0 avatar
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [savingAvatar, setSavingAvatar] = useState(false);

  // Step 1 genres
  const [genres, setGenres] = useState([]);
  const [genreQ, setGenreQ] = useState('');
  const [pickedGenres, setPickedGenres] = useState([]);

  // Step 2 artists
  const [artistQ, setArtistQ] = useState('');
  const [artistResults, setArtistResults] = useState([]);
  const [pickedArtists, setPickedArtists] = useState([]);

  // Step 3 records
  const [recordQ, setRecordQ] = useState('');
  const [recordResults, setRecordResults] = useState([]);
  const [pickedRecords, setPickedRecords] = useState([]);

  const canContinue = useMemo(() => {
    if (step === 0) return true;
    if (step === 1) return pickedGenres.length === 2;
    if (step === 2) return pickedArtists.length >= 1;
    if (step === 3) return pickedRecords.length >= 1;
    return false;
  }, [step, pickedGenres.length, pickedArtists.length, pickedRecords.length]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const uid = data?.session?.user?.id || null;
      if (!uid) {
        router.replace('/login');
        return;
      }

      setUserId(uid);

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', uid)
        .maybeSingle();

      if (profile && profile.onboarding_completed === true) {
        router.replace('/feed');
        return;
      }

      // genres
      const { data: g } = await supabase.from(GENRES_TABLE).select('id,name').order('name', { ascending: true }).limit(500);
      setGenres(g || []);

      setBoot(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    const q = artistQ.trim();
    let cancelled = false;

    (async () => {
      if (!q) {
        setArtistResults([]);
        return;
      }
      const { data } = await supabase.from('artists').select('id,name,image_url').ilike('name', `%${q}%`).limit(18);
      if (!cancelled) setArtistResults(data || []);
    })();

    return () => {
      cancelled = true;
    };
  }, [artistQ, userId]);

  useEffect(() => {
    if (!userId) return;
    const q = recordQ.trim();
    let cancelled = false;

    (async () => {
      if (!q) {
        setRecordResults([]);
        return;
      }
      const { data } = await supabase.from('records').select('id,title,cover_url,artist_name').ilike('title', `%${q}%`).limit(18);
      if (!cancelled) setRecordResults(data || []);
    })();

    return () => {
      cancelled = true;
    };
  }, [recordQ, userId]);

  const filteredGenres = useMemo(() => {
    const q = genreQ.trim().toLowerCase();
    if (!q) return genres;
    return genres.filter((g) => String(g.name || '').toLowerCase().includes(q));
  }, [genres, genreQ]);

  const toggleGenre = (g) => {
    setPickedGenres((prev) => {
      const exists = prev.some((x) => x.id === g.id);
      if (exists) return prev.filter((x) => x.id !== g.id);
      if (prev.length >= 2) return prev;
      return [...prev, g];
    });
  };

  const toggleArtist = (a) => {
    setPickedArtists((prev) => {
      const exists = prev.some((x) => x.id === a.id);
      if (exists) return prev.filter((x) => x.id !== a.id);
      return [...prev, a];
    });
  };

  const toggleRecord = (r) => {
    setPickedRecords((prev) => {
      const exists = prev.some((x) => x.id === r.id);
      if (exists) return prev.filter((x) => x.id !== r.id);
      return [...prev, r];
    });
  };

  const pickAvatar = (file) => {
    setAvatarFile(file);
    if (!file) {
      setAvatarPreview(null);
      return;
    }
    setAvatarPreview(URL.createObjectURL(file));
  };

  const saveAvatarIfAny = async () => {
    if (!userId) return;
    if (!avatarFile) return;

    setSavingAvatar(true);
    try {
      const ext = avatarFile.name.split('.').pop() || 'jpg';
      const path = `${userId}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage.from('avatars').upload(path, avatarFile, {
        cacheControl: '3600',
        upsert: true,
      });

      if (upErr) {
        setSavingAvatar(false);
        return;
      }

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatarUrl = pub?.publicUrl || null;

      if (avatarUrl) {
        await supabase.from('profiles').upsert({ id: userId, avatar_url: avatarUrl }, { onConflict: 'id' });
      }
    } finally {
      setSavingAvatar(false);
    }
  };

  const saveStep = async () => {
    if (!userId) return;

    if (step === 0) {
      await saveAvatarIfAny();
      return;
    }

    if (step === 1) {
      await supabase.from('favourite_genres').delete().eq('user_id', userId);
      await supabase.from('favourite_genres').insert(pickedGenres.map((g) => ({ user_id: userId, genre_id: g.id })));
      return;
    }

    if (step === 2) {
      await supabase.from('favourite_artists').delete().eq('user_id', userId);
      await supabase.from('favourite_artists').insert(pickedArtists.map((a) => ({ user_id: userId, artist_id: a.id })));
      return;
    }

    if (step === 3) {
      await supabase.from('favourite_records').delete().eq('user_id', userId);
      await supabase.from('favourite_records').insert(pickedRecords.map((r) => ({ user_id: userId, record_id: r.id })));

      await supabase.from('profiles').upsert({ id: userId, onboarding_completed: true }, { onConflict: 'id' });

      router.replace('/feed');
    }
  };

  const next = async () => {
    if (!canContinue) return;
    await saveStep();
    setStep((s) => Math.min(s + 1, TOTAL - 1));
  };

  const back = () => setStep((s) => Math.max(s - 1, 0));

  if (boot) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <PremiumLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-6">
      <div className="mx-auto w-full max-w-[520px] pt-10 pb-10">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.replace('/')}
            className="text-[12px] text-black/45 hover:text-black/70 transition"
            style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
          >
            Exit
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

        <div className="mt-8 flex items-center justify-center">
          <ProgressDots step={step} total={TOTAL} />
        </div>

        {/* SLIDES */}
        <div className="mt-10 overflow-hidden">
          <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${step * 100}%)` }}>
            {/* STEP 0 */}
            <section className="w-full shrink-0 pr-2">
              <h2 className="text-[34px] text-black" style={{ fontFamily: 'Times New Roman, serif', fontWeight: 400 }}>
                Add a photo.
              </h2>

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

                <label className="mt-7 cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => pickAvatar(e.target.files?.[0] || null)} />
                  <span
                    className="inline-flex items-center justify-center rounded-full px-6 py-3 border border-black/15 text-black hover:bg-black/5 active:scale-[0.99] transition"
                    style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
                  >
                    Choose photo
                  </span>
                </label>
              </div>
            </section>

            {/* STEP 1 */}
            <section className="w-full shrink-0 px-2">
              <h2 className="text-[34px] text-black" style={{ fontFamily: 'Times New Roman, serif', fontWeight: 400 }}>
                Two genres.
              </h2>

              <div className="mt-8">
                <div className="rounded-2xl border border-black/10 px-4 py-3">
                  <input
                    value={genreQ}
                    onChange={(e) => setGenreQ(e.target.value)}
                    placeholder="Search"
                    className="w-full outline-none bg-transparent text-[14px] text-black placeholder-black/30"
                    style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {pickedGenres.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => toggleGenre(g)}
                      className="px-3 py-1.5 rounded-full text-white text-[12px] active:scale-[0.99] transition"
                      style={{ backgroundColor: WALCORD_BLUE, fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
                    >
                      {g.name} ×
                    </button>
                  ))}
                </div>

                <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {filteredGenres.slice(0, 48).map((g) => {
                    const active = pickedGenres.some((x) => x.id === g.id);
                    return (
                      <button
                        key={g.id}
                        onClick={() => toggleGenre(g)}
                        className={clsx(
                          'rounded-2xl border px-3 py-3 text-left active:scale-[0.99] transition',
                          active ? 'border-black/30 bg-black/[0.03]' : 'border-black/10 hover:bg-black/[0.03]'
                        )}
                      >
                        <div className="text-[13px] text-black" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}>
                          {g.name}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <p className="mt-6 text-[12px] text-black/45" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}>
                  {pickedGenres.length}/2 selected
                </p>
              </div>
            </section>

            {/* STEP 2 */}
            <section className="w-full shrink-0 px-2">
              <h2 className="text-[34px] text-black" style={{ fontFamily: 'Times New Roman, serif', fontWeight: 400 }}>
                Favourite artist.
              </h2>

              <div className="mt-8">
                <div className="rounded-2xl border border-black/10 px-4 py-3">
                  <input
                    value={artistQ}
                    onChange={(e) => setArtistQ(e.target.value)}
                    placeholder="Search"
                    className="w-full outline-none bg-transparent text-[14px] text-black placeholder-black/30"
                    style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {pickedArtists.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => toggleArtist(a)}
                      className="px-3 py-1.5 rounded-full bg-black text-white text-[12px] active:scale-[0.99] transition"
                      style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
                    >
                      {a.name} ×
                    </button>
                  ))}
                </div>

                <div className="mt-6 grid grid-cols-3 sm:grid-cols-4 gap-4">
                  {artistResults.map((a) => {
                    const active = pickedArtists.some((x) => x.id === a.id);
                    return (
                      <button
                        key={a.id}
                        onClick={() => toggleArtist(a)}
                        className={clsx(
                          'flex flex-col items-center gap-2 p-2 rounded-2xl border active:scale-[0.99] transition',
                          active ? 'border-black/30 bg-black/[0.03]' : 'border-black/10 hover:bg-black/[0.03]'
                        )}
                      >
                        <div className="h-[72px] w-[72px] rounded-full overflow-hidden bg-black/10">
                          {a.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.image_url} alt={a.name} className="h-full w-full object-cover" />
                          ) : null}
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
            </section>

            {/* STEP 3 */}
            <section className="w-full shrink-0 pl-2">
              <h2 className="text-[34px] text-black" style={{ fontFamily: 'Times New Roman, serif', fontWeight: 400 }}>
                Favourite record.
              </h2>

              <div className="mt-8">
                <div className="rounded-2xl border border-black/10 px-4 py-3">
                  <input
                    value={recordQ}
                    onChange={(e) => setRecordQ(e.target.value)}
                    placeholder="Search"
                    className="w-full outline-none bg-transparent text-[14px] text-black placeholder-black/30"
                    style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {pickedRecords.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => toggleRecord(r)}
                      className="px-3 py-1.5 rounded-full text-white text-[12px] active:scale-[0.99] transition"
                      style={{ backgroundColor: WALCORD_BLUE, fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
                    >
                      {r.title} ×
                    </button>
                  ))}
                </div>

                <div className="mt-6 grid grid-cols-3 sm:grid-cols-4 gap-4">
                  {recordResults.map((r) => {
                    const active = pickedRecords.some((x) => x.id === r.id);
                    return (
                      <button
                        key={r.id}
                        onClick={() => toggleRecord(r)}
                        className={clsx(
                          'flex flex-col items-start gap-2 p-2 rounded-2xl border active:scale-[0.99] transition',
                          active ? 'border-black/30 bg-black/[0.03]' : 'border-black/10 hover:bg-black/[0.03]'
                        )}
                      >
                        <div className="h-[80px] w-[80px] rounded-xl overflow-hidden bg-black/10">
                          {r.cover_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.cover_url} alt={r.title} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="w-full">
                          <div className="text-[12px] text-black line-clamp-2" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}>
                            {r.title}
                          </div>
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
            </section>
          </div>
        </div>

        {/* CTA único, simple */}
        <button
          onClick={next}
          disabled={!canContinue || savingAvatar}
          className="mt-10 w-full rounded-full py-3 text-[14px] text-white active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: WALCORD_BLUE, fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
        >
          {savingAvatar ? 'Saving…' : step === TOTAL - 1 ? 'Finish' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

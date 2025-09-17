'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type TimeoutId = ReturnType<typeof setTimeout>;
type ArtistItem = { id: string; name: string };
type CountryItem = { code: string; name: string };
type MediaFile = { file: File; kind: 'image' };

const MAX_PHOTOS = 6;

/** Intento 1: upload normal. Si falla → intento 2: signed upload. Devuelve { path, isPublic } */
async function uploadWithFallback(bucket: string, path: string, file: File) {
  // 1) Upload normal
  const direct = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });

  if (!direct.error) {
    return { path: direct.data?.path || path, isPublic: true }; // si el bucket es público, luego haremos getPublicUrl
  }

  // 2) Signed upload fallback
  const r = await fetch('/api/storage-signed-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, path }),
  });

  const j = await r.json().catch(() => ({} as any));
  if (!r.ok || !j?.token) {
    throw new Error(
      `No se pudo crear Signed Upload URL (${direct.error?.message || 'upload denied'})`
    );
  }

  const signed = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(path, j.token, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (signed.error) {
    throw new Error(`Fallo subiendo a Storage (signed): ${signed.error.message}`);
  }

  return { path: signed.data?.path || path, isPublic: false }; // bucket probablemente privado
}

/** Obtiene una URL utilizable: pública si el bucket lo es; si no, firma por largo plazo */
async function getUsableUrl(bucket: string, path: string, preferSigned = false) {
  if (preferSigned) {
    const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365); // 1 año
    if (signed.error) throw new Error(`Error creando signed URL: ${signed.error.message}`);
    return signed.data.signedUrl;
  }
  const pub = supabase.storage.from(bucket).getPublicUrl(path);
  return pub.data.publicUrl;
}

export default function NewPostPage() {
  const [artistQ, setArtistQ] = useState('');
  const [artistResults, setArtistResults] = useState<ArtistItem[]>([]);
  const [artistSearching, setArtistSearching] = useState(false);
  const [artist, setArtist] = useState<ArtistItem | null>(null);
  const artistDebouncer = useRef<TimeoutId | null>(null);

  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [countryCode, setCountryCode] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>(''); 
  const [tourName, setTourName] = useState<string>('');
  const [caption, setCaption] = useState('');

  const [files, setFiles] = useState<MediaFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  // Cargar países
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('countries')
        .select('code, name')
        .order('name', { ascending: true });
      if (!error) setCountries((data as CountryItem[]) || []);
    })();
  }, []);

  // Buscar artistas
  useEffect(() => {
    const term = artistQ.trim();
    if (!term || term.length < 2) {
      setArtistResults([]);
      setArtistSearching(false);
      return;
    }
    setArtistSearching(true);
    if (artistDebouncer.current) clearTimeout(artistDebouncer.current);
    artistDebouncer.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('artists')
          .select('id, name')
          .ilike('name', `%${term}%`)
          .limit(25);
        if (!error) setArtistResults((data as ArtistItem[]) || []);
      } finally {
        setArtistSearching(false);
      }
    }, 200);
  }, [artistQ]);

  // Files helpers (SOLO IMÁGENES)
  const addIncomingFiles = (incoming: FileList | null) => {
    if (!incoming?.length) return;

    // Filtrar solo imágenes
    const incomingImages = Array.from(incoming).filter((f) => f.type.startsWith('image/'));
    if (incomingImages.length === 0) return;

    setFiles((prev) => {
      // Evitar duplicados
      const map = new Map<string, MediaFile>();
      prev.forEach((m) => map.set(`${m.file.name}-${m.file.size}-${m.file.lastModified}`, m));

      // Espacio restante
      const remaining = Math.max(0, MAX_PHOTOS - map.size);

      // Añadir hasta el máximo permitido
      const toAdd = incomingImages.slice(0, remaining).map((f) => ({
        file: f,
        kind: 'image' as const,
      }));
      toAdd.forEach((m) => map.set(`${m.file.name}-${m.file.size}-${m.file.lastModified}`, m));

      // Si se intentó añadir más de lo permitido, avisar
      if (incomingImages.length > remaining) {
        alert('maximum six');
      }

      // Recortar duro por si acaso
      const arr = Array.from(map.values()).slice(0, MAX_PHOTOS);
      return arr;
    });
  };

  const removeFileAt = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const imageCount = useMemo(
    () => files.filter((f) => f.kind === 'image').length,
    [files]
  );

  const previews = useMemo(
    () => files.slice(0, MAX_PHOTOS).map((m) => ({ url: URL.createObjectURL(m.file) })),
    [files]
  );

  // Submit
  const onSubmit = async () => {
    if (!artist) return alert('Please select artist');
    if (!countryCode) return alert('Please select country');
    if (!city.trim()) return alert('Please type city');
    if (!dateStr) return alert('Please select date');
    if (imageCount < 1) return alert('Please add at least 1 photo');
    if (imageCount > MAX_PHOTOS) return alert('maximum six');

    setSubmitting(true);
    setDone(null);

    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const userId = authData?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const insertPayload = {
        user_id: userId,
        artist_id: artist.id,
        country_code: countryCode,
        city: city.trim(),
        event_date: dateStr,
        tour_name: tourName.trim() || null,
        caption: caption.trim() || null,
      };

      const { data: concertIns, error: concertErr } = await supabase
        .from('concerts')
        .insert(insertPayload)
        .select('id')
        .single();

      if (concertErr) throw new Error(`No se pudo crear el concierto: ${concertErr.message}`);
      const concertId: string = (concertIns as any).id;

      // Subir solo imágenes (máx 6 ya garantizado)
      const uploads: { url: string }[] = [];
      for (const m of files.slice(0, MAX_PHOTOS)) {
        const ext = (m.file.name.split('.').pop() || 'jpg').toLowerCase();
        const safeName = m.file.name.replace(/[^\w.\-]+/g, '_');
        const path = `${concertId}/${Date.now()}_${Math.random()
          .toString(36)
          .slice(2)}_${safeName}.${ext}`.replace(/\.([a-z0-9]{2,4})\.\1$/i, '.$1'); // evita doble extensión

        const { path: storedPath, isPublic } = await uploadWithFallback(
          'concert_media',
          path,
          m.file
        );

        // Si el bucket es público → publicUrl; si no → signedUrl
        const publicishUrl = await getUsableUrl('concert_media', storedPath, !isPublic);
        uploads.push({ url: publicishUrl });
      }

      if (uploads.length) {
        const payload = uploads.map((u) => ({
          concert_id: concertId,
          url: u.url,
          media_type: 'image',
        }));
        const { error: mediaErr } = await supabase
          .from('concert_media')
          .insert(payload);
        if (mediaErr) throw new Error(`No se pudieron guardar las imágenes: ${mediaErr.message}`);
      }

      setDone('Concert shared');
      setArtist(null);
      setArtistQ('');
      setArtistResults([]);
      setCountryCode('');
      setCity('');
      setDateStr('');
      setTourName('');
      setCaption('');
      setFiles([]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      alert(e?.message ?? 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Banner */}
      <header className="w-full h-24 bg-[#1F48AF] flex items-end justify-between px-4 sm:px-6 pb-3 pt-[env(safe-area-inset-top)]">
        <button
          onClick={() => history.back()}
          aria-label="Back"
          className="inline-flex items-center gap-2 rounded-full bg-white/95 text-black px-3 py-1.5 text-xs border border-white/60 hover:bg-white transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
            <path
              d="M19 12H5m6 7-7-7 7-7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="hidden sm:inline">Back</span>
        </button>
        <div className="text-white/90 text-sm pr-1">New Post</div>
      </header>

      {/* Caja */}
      <main className="mx-auto w-full max-w-[760px] px-4 sm:px-6 py-6 sm:py-8">
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-[0_6px_22px_rgba(0,0,0,0.06)]">
          {/* Header */}
          <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-2">
            <h1
              className="text-[clamp(1.6rem,4.5vw,2rem)] leading-[1.1] tracking-tight"
              style={{ fontFamily: '"Times New Roman", Times, serif', fontWeight: 400 }}
            >
              Share your concert
            </h1>
          </div>

          {/* Layout */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-7 px-5 sm:px-6 pb-6 sm:pb-7">
            {/* Izquierda: campos */}
            <div>
              {/* Artist */}
              {artist ? (
                <div className="mb-5 sm:mb-6 flex items-center justify-between rounded-2xl border border-neutral-200 bg-white/80 backdrop-blur px-4 py-3 shadow-sm">
                  <div className="leading-tight">
                    <div style={{ fontFamily: '"Times New Roman", Times, serif' }}>{artist.name}</div>
                    <div className="text-sm text-neutral-500" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
                      Artist selected
                    </div>
                  </div>
                  <button
                    onClick={() => setArtist(null)}
                    className="text-sm text-[#1F48AF] hover:underline"
                    style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="mb-5 sm:mb-6">
                  <label
                    className="block text-xs uppercase tracking-widest text-neutral-600"
                    style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                  >
                    Artist
                  </label>
                  <div className="mt-2 relative">
                    <input
                      value={artistQ}
                      onChange={(e) => setArtistQ(e.target.value)}
                      placeholder="Search artist name…"
                      className="w-full rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 outline-none focus:ring-2 focus:ring-[#1F48AF] shadow-sm italic"
                      style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                    />
                    {(artistSearching || artistResults.length > 0) && (
                      <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white/95 shadow-xl max-h-[320px] overflow-y-auto">
                        {artistSearching && (
                          <div
                            className="px-4 py-3 text-sm text-neutral-500"
                            style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                          >
                            Searching…
                          </div>
                        )}
                        {!artistSearching &&
                          artistResults.map((r) => (
                            <button
                              key={r.id}
                              onClick={() => {
                                setArtist(r);
                                setArtistQ('');
                                setArtistResults([]);
                              }}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 transition"
                            >
                              <div className="min-w-0">
                                <div className="truncate" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                  {r.name}
                                </div>
                              </div>
                            </button>
                          ))}
                        {!artistSearching && artistResults.length === 0 && artistQ.trim().length >= 2 && (
                          <div
                            className="px-4 py-3 text-sm text-neutral-500"
                            style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                          >
                            No artists found.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Country */}
              <div className="mb-5 sm:mb-6">
                <label
                  className="block text-xs uppercase tracking-widest text-neutral-600"
                  style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                >
                  Country
                </label>
                <div className="mt-2 relative">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 pr-10 shadow-sm outline-none focus:ring-2 focus:ring-[#1F48AF]"
                    style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                  >
                    <option value="">Select country…</option>
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">▾</span>
                </div>
              </div>

              {/* City */}
              <div className="mb-5 sm:mb-6">
                <label
                  className="block text-xs uppercase tracking-widest text-neutral-600"
                  style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                >
                  City
                </label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Type your city…"
                  className="mt-2 w-full rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 outline-none focus:ring-2 focus:ring-[#1F48AF] shadow-sm"
                  style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                />
              </div>

              {/* Date */}
              <div className="mb-5 sm:mb-6">
                <label
                  className="block text-xs uppercase tracking-widest text-neutral-600"
                  style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                >
                  Date
                </label>
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 outline-none focus:ring-2 focus:ring-[#1F48AF] shadow-sm"
                  style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                />
              </div>

              {/* Tour (optional) */}
              <div className="mb-5 sm:mb-6">
                <label
                  className="block text-xs uppercase tracking-widest text-neutral-600"
                  style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                >
                  Tour (optional)
                </label>
                <input
                  value={tourName}
                  onChange={(e) => setTourName(e.target.value)}
                  placeholder="Tour name…"
                  className="mt-2 w-full rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 outline-none focus:ring-2 focus:ring-[#1F48AF] shadow-sm"
                  style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                />
              </div>

              {/* Caption (optional) */}
              <div className="mb-5 sm:mb-6">
                <label
                  className="block text-xs uppercase tracking-widest text-neutral-600"
                  style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                >
                  Caption (optional)
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={6}
                  placeholder="Write something…"
                  className="mt-2 w-full rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 outline-none focus:ring-2 focus:ring-[#1F48AF] shadow-sm"
                  style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                />
              </div>
            </div>

            {/* Derecha: SOLO FOTOS */}
            <div>
              <label
                className="block text-xs uppercase tracking-widest text-neutral-600"
                style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
              >
                Photos (max {MAX_PHOTOS})
              </label>
              <div
                onDragEnter={() => setIsDragging(true)}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(ev) => {
                  ev.preventDefault();
                  setIsDragging(false);
                  addIncomingFiles(ev.dataTransfer?.files ?? null);
                }}
                onDragOver={(ev) => ev.preventDefault()}
                className={[
                  'mt-2 rounded-2xl border border-dashed p-4 sm:p-5 bg.white/70 backdrop-blur transition'.replace('bg.white','bg-white'),
                  isDragging ? 'border-[#1F48AF] ring-2 ring-[#1F48AF]/40' : 'border-neutral-300',
                ].join(' ')}
              >
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => addIncomingFiles(e.target.files)}
                  className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-xl file:border-0 file:bg-[#1F48AF] file:px-4 file:py-2 file:text-white file:shadow-sm hover:file:brightness-110"
                  style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                />
                {files.length ? (
                  <>
                    <div className="mt-3 flex items-center justify-between">
                      <span
                        className="text-sm text-neutral-600"
                        style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                      >
                        {files.length}/{MAX_PHOTOS} selected.
                      </span>
                      <button
                        type="button"
                        onClick={() => setFiles([])}
                        className="text-sm text-[#1F48AF] hover:underline"
                        style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                      >
                        Clear
                      </button>
                    </div>
                  </>
                ) : (
                  <p
                    className="mt-2 text-xs text-neutral-500 italic"
                    style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                  >
                    Drag & drop images here or choose files.
                  </p>
                )}
                {previews.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {previews.map((p, i) => (
                      <div key={i} className="relative group">
                        <img src={p.url} alt="" className="h-28 w-full rounded-xl object-cover" />
                        <button
                          type="button"
                          onClick={() => removeFileAt(i)}
                          className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-black/70 text-white text-xs leading-6 text-center shadow opacity-0 group-hover:opacity-100"
                          aria-label="Remove file"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="px-5 sm:px-6 pb-6 sm:pb-7">
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={onSubmit}
                disabled={submitting || !artist || !countryCode || !city.trim() || !dateStr || imageCount < 1}
                className="rounded-xl bg-[#1F48AF] px-6 py-3 text-white shadow-sm transition hover:shadow disabled:opacity-40"
                style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
              >
                {submitting ? 'Publishing…' : 'Publish'}
              </button>
              {done && (
                <span
                  className="text-sm text-green-600"
                  style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                >
                  {done}
                </span>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

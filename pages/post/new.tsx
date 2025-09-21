'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type TimeoutId = ReturnType<typeof setTimeout>;
type ArtistItem = { id: string; name: string };
type CountryItem = { code: string; name: string };
type MediaFile = { file: File; kind: 'image' | 'video' };

type PostType = 'concert' | 'experience';
type Experience =
  | 'opera'
  | 'musical'
  | 'ballet'
  | 'jazz_club'
  | 'festival'
  | 'recital'
  | 'orchestra'
  | 'club_party';

const EXPERIENCE_OPTIONS: { value: Experience; label: string }[] = [
  { value: 'opera',       label: 'Opera' },
  { value: 'musical',     label: 'Musical' },
  { value: 'ballet',      label: 'Ballet' },
  { value: 'jazz_club',   label: 'Jazz Club' },
  { value: 'festival',    label: 'Festival' },
  { value: 'recital',     label: 'Recital' },
  { value: 'orchestra',   label: 'Orchestra' },
  { value: 'club_party',  label: 'Club Party' },
];

const MAX_PHOTOS = 6;
const MAX_VIDEOS = 1;
const MAX_VIDEO_SECONDS = 15;

/** === Helpers de Storage (subida directa + URL pública) === */
async function uploadDirect(bucket: string, path: string, file: File) {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) throw new Error(`Upload to ${bucket} failed: ${error.message}`);
  return { path: data?.path || path };
}
function getPublicUrl(bucket: string, path: string) {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Lee duración del vídeo en segundos usando <video> */
function readVideoDurationSec(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      const d = v.duration;
      URL.revokeObjectURL(url);
      if (isFinite(d)) resolve(d);
      else reject(new Error('No se pudo leer la duración del vídeo'));
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo cargar el vídeo'));
    };
    v.src = url;
  });
}

export default function NewPostPage() {
  // ===== Tipo de post
  const [postType, setPostType] = useState<PostType>('concert');
  const [experience, setExperience] = useState<Experience | ''>('');

  // ===== Artist search (solo Concerts)
  const [artistQ, setArtistQ] = useState('');
  const [artistResults, setArtistResults] = useState<ArtistItem[]>([]);
  const [artistSearching, setArtistSearching] = useState(false);
  const [artist, setArtist] = useState<ArtistItem | null>(null);
  const artistDebouncer = useRef<TimeoutId | null>(null);

  // ===== Ubicación/fecha/caption
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [countryCode, setCountryCode] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>(''); 
  const [tourName, setTourName] = useState<string>('');
  const [caption, setCaption] = useState('');

  // ===== Medios
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

  // Buscar artistas (sólo si es concert)
  useEffect(() => {
    if (postType !== 'concert') {
      setArtist(null);
      setArtistQ('');
      setArtistResults([]);
      setArtistSearching(false);
      return;
    }
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
  }, [artistQ, postType]);

  // Añadir ficheros (valida duración del vídeo ≤ 15 s)
  const addIncomingFiles = async (incoming: FileList | null) => {
    if (!incoming?.length) return;

    const incomingImages: File[] = [];
    const incomingVideos: File[] = [];

    for (const f of Array.from(incoming)) {
      if (f.type.startsWith('image/')) incomingImages.push(f);
      else if (f.type.startsWith('video/')) incomingVideos.push(f);
    }

    if (incomingVideos.length > 1) alert('only one video is allowed');
    const pickedVideo = incomingVideos[0] || null;

    if (pickedVideo) {
      try {
        const secs = await readVideoDurationSec(pickedVideo);
        if (secs > MAX_VIDEO_SECONDS + 0.01) {
          alert('the video must be 15 seconds or less');
        } else {
          setFiles(prev => {
            const currentVid = prev.find(x => x.kind === 'video');
            if (currentVid) {
              alert('only one video is allowed');
              return prev;
            }
            return [...prev, { file: pickedVideo, kind: 'video' }];
          });
        }
      } catch {
        alert('could not read video duration');
      }
    }

    if (incomingImages.length) {
      setFiles(prev => {
        const imgs = prev.filter(x => x.kind === 'image');
        const room = Math.max(0, MAX_PHOTOS - imgs.length);
        const toAdd = incomingImages.slice(0, room).map(f => ({ file: f, kind: 'image' as const }));
        if (incomingImages.length > room) alert('maximum six photos');
        return [...prev, ...toAdd];
      });
    }
  };

  const removeFileAt = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));
  const imageCount = useMemo(() => files.filter((f) => f.kind === 'image').length, [files]);
  const videoFile = useMemo(() => files.find((f) => f.kind === 'video')?.file || null, [files]);

  const previews = useMemo(
    () =>
      files.slice(0, MAX_PHOTOS + MAX_VIDEOS).map((m) => ({
        kind: m.kind,
        url: URL.createObjectURL(m.file),
        name: m.file.name,
      })),
    [files]
  );

  // Submit
  const onSubmit = async () => {
    if (postType === 'concert' && !artist) return alert('Please select artist');
    if (postType === 'experience' && !experience) return alert('Please select an experience type');
    if (!countryCode) return alert('Please select country');
    if (!city.trim()) return alert('Please type city');
    if (!dateStr) return alert('Please select date');
    if (imageCount < 1 && !videoFile) return alert('Please add at least 1 photo or a video');
    if (imageCount > MAX_PHOTOS) return alert('maximum six photos');

    if (videoFile) {
      try {
        const secs = await readVideoDurationSec(videoFile);
        if (secs > MAX_VIDEO_SECONDS + 0.01) {
          alert('the video must be 15 seconds or less');
          return;
        }
      } catch {
        alert('could not read video duration');
        return;
      }
    }

    setSubmitting(true);
    setDone(null);

    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const userId = authData?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      // 1) Inserta en concerts
      const concertInsert: Record<string, any> = {
        user_id: userId,
        artist_id: postType === 'concert' ? artist?.id : null,
        country_code: countryCode,
        city: city.trim(),
        event_date: dateStr,
        tour_name: tourName.trim() || null,
        caption: caption.trim() || null,
        post_type: postType,
        experience: postType === 'experience' ? experience : null,
      };

      const { data: concertIns, error: concertErr } = await supabase
        .from('concerts')
        .insert(concertInsert)
        .select('id')
        .single();
      if (concertErr) throw new Error(`No se pudo crear el concierto: ${concertErr.message}`);
      const concertId: string = (concertIns as any).id;

      // 2) Sube IMÁGENES → concert_media
      if (imageCount) {
        const images = files.filter(f => f.kind === 'image').slice(0, MAX_PHOTOS);
        const uploads: string[] = [];

        for (const m of images) {
          const ext = (m.file.name.split('.').pop() || 'jpg').toLowerCase();
          const baseName = m.file.name.replace(/[^\w.\-]+/g, '_').replace(/\.[a-z0-9]{2,4}$/i, '');
          const path = `${concertId}/${Date.now()}_${Math.random().toString(36).slice(2)}_${baseName}.${ext}`;

          const { path: storedPath } = await uploadDirect('concert_media', path, m.file);
          const url = getPublicUrl('concert_media', storedPath);
          uploads.push(url);
        }

        if (uploads.length) {
          const payload = uploads.map((url) => ({ concert_id: concertId, url, media_type: 'image' }));
          const { error: mediaErr } = await supabase.from('concert_media').insert(payload);
          if (mediaErr) throw new Error(`No se pudieron guardar las imágenes: ${mediaErr.message}`);
        }
      }

      // 3) Sube VÍDEO (si hay) → clips (bucket público)
      if (videoFile) {
        const ext = (videoFile.name.split('.').pop() || 'mp4').toLowerCase();
        const base = `user_${userId}/${concertId}`;
        const videoPath = `${base}/video_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

        const { path: storedPath } = await uploadDirect('clips', videoPath, videoFile);
        const video_url = getPublicUrl('clips', storedPath);

        const poster_url = null;

        const { error: clipsErr } = await supabase.from('clips').insert([
          {
            user_id: userId,
            video_url,
            poster_url,
            caption: caption || null,
            artist_name: postType === 'concert' ? artist?.name || null : null,
            venue: tourName || null,
            city: city || null,
            country: countryCode || null,
            event_date: dateStr || null,
            kind: postType,
            experience: postType === 'experience' ? experience : null,
          },
        ]);
        if (clipsErr) throw new Error(`No se pudo registrar el vídeo en clips: ${clipsErr.message}`);
      }

      // Reset
      setDone(postType === 'concert' ? 'Concert shared' : 'Experience shared');
      setArtist(null);
      setArtistQ('');
      setArtistResults([]);
      setCountryCode('');
      setCity('');
      setDateStr('');
      setTourName('');
      setCaption('');
      setFiles([]);
      setExperience('');
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
            <path d="M19 12H5m6 7-7-7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="hidden sm:inline">Back</span>
        </button>
        <div className="text-white/90 text-sm pr-1">New Post</div>
      </header>

      {/* Caja */}
      <main className="mx-auto w-full max-w-[760px] px-4 sm:px-6 py-6 sm:py-8">
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-[0_6px_22px_rgba(0,0,0,0.06)]">
          {/* Header */}
          <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-0">
            <h1 className="text-[clamp(1.6rem,4.5vw,2rem)] leading-[1.1] tracking-tight"
                style={{ fontFamily: '"Times New Roman", Times, serif', fontWeight: 400 }}>
              Share your experience
            </h1>
            {/* Selector principal (separado del título) */}
            <div className="mt-3">
              <div className="inline-flex rounded-2xl border border-neutral-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPostType('concert')}
                  className={`px-4 py-2 text-sm ${postType === 'concert' ? 'bg-[#1F48AF] text-white' : 'bg-white text-black'}`}
                  style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                >
                  Concerts
                </button>
                <button
                  type="button"
                  onClick={() => setPostType('experience')}
                  className={`px-4 py-2 text-sm border-l border-neutral-200 ${postType === 'experience' ? 'bg-[#1F48AF] text-white' : 'bg-white text-black'}`}
                  style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                >
                  Other musical experiences
                </button>
              </div>
            </div>
          </div>

          {/* Layout */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-7 px-5 sm:px-6 pb-6 sm:pb-7 mt-4">
            {/* Izquierda */}
            <div>
              {/* Concerts → buscador */}
              {postType === 'concert' ? (
                <>
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
                      <label className="block text-xs uppercase tracking-widest text-neutral-600" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
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
                              <div className="px-4 py-3 text-sm text-neutral-500" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
                                Searching…
                              </div>
                            )}
                            {!artistSearching &&
                              artistResults.map((r) => (
                                <button
                                  key={r.id}
                                  onClick={() => { setArtist(r); setArtistQ(''); setArtistResults([]); }}
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
                              <div className="px-4 py-3 text-sm text-neutral-500" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
                                No artists found.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                // Experiences → selector con el MISMO estilo que Country
                <div className="mb-5 sm:mb-6">
                  <label className="block text-xs uppercase tracking-widest text-neutral-600" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
                    Experience type
                  </label>
                  <div className="mt-2 relative">
                    <select
                      value={experience}
                      onChange={(e) => setExperience(e.target.value as Experience)}
                      className="w-full appearance-none rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 pr-10 shadow-sm outline-none focus:ring-2 focus:ring-[#1F48AF]"
                      style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                    >
                      <option value="" disabled>Select one…</option>
                      {EXPERIENCE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">▾</span>
                  </div>
                </div>
              )}

              {/* Country */}
              <div className="mb-5 sm:mb-6">
                <label className="block text-xs uppercase tracking-widest text-neutral-600" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
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
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">▾</span>
                </div>
              </div>

              {/* City */}
              <div className="mb-5 sm:mb-6">
                <label className="block text-xs uppercase tracking-widest text-neutral-600" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
                  City
                </label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Type your city…"
                  className="mt-2 w-full rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 outline-none focus:ring-2 focus:ring-[#1F48AF] shadow-sm"
                  style={{ fontFamily: 'Roboto, Arial', fontWeight: 300 }}
                />
              </div>

              {/* Date */}
              <div className="mb-5 sm:mb-6">
                <label className="block text-xs uppercase tracking-widest text-neutral-600" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
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

              {/* Name of the event */}
              <div className="mb-5 sm:mb-6">
                <label className="block text-xs uppercase tracking-widest text-neutral-600" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
                  Name of the event
                </label>
                <input
                  value={tourName}
                  onChange={(e) => setTourName(e.target.value)}
                  placeholder="Tour name…"
                  className="mt-2 w-full rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 outline-none focus:ring-2 focus:ring-[#1F48AF] shadow-sm"
                  style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                />
              </div>

              {/* Caption */}
              <div className="mb-5 sm:mb-6">
                <label className="block text-xs uppercase tracking-widest text-neutral-600" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
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

            {/* Derecha: Photos and videos */}
            <div>
              <label className="block text-xs uppercase tracking-widest text-neutral-600" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
                Photos and videos
              </label>
              <div
                onDragEnter={() => setIsDragging(true)}
                onDragLeave={() => setIsDragging(false)}
                onDrop={async (ev) => {
                  ev.preventDefault();
                  setIsDragging(false);
                  await addIncomingFiles(ev.dataTransfer?.files ?? null);
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
                  accept="image/*,video/*"
                  onChange={async (e) => await addIncomingFiles(e.target.files)}
                  className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-xl file:border-0 file:bg-[#1F48AF] file:px-4 file:py-2 file:text-white file:shadow-sm hover:file:brightness-110"
                  style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                />
                {files.length ? (
                  <>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm text-neutral-600" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
                        {imageCount}/{MAX_PHOTOS} photos · {videoFile ? 1 : 0}/{MAX_VIDEOS} video
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
                  <p className="mt-2 text-xs text-neutral-500 italic" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
                    Drag & drop images or a video, or choose files.
                  </p>
                )}
                {previews.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {previews.map((p, i) => (
                      <div key={i} className="relative group">
                        {p.kind === 'image' ? (
                          <img src={p.url} alt="" className="h-28 w-full rounded-xl object-cover" />
                        ) : (
                          <video src={p.url} className="h-28 w-full rounded-xl object-cover" muted />
                        )}
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
                disabled={
                  submitting ||
                  (postType === 'concert' && !artist) ||
                  (postType === 'experience' && !experience) ||
                  !countryCode ||
                  !city.trim() ||
                  !dateStr ||
                  (imageCount < 1 && !videoFile)
                }
                className="rounded-xl bg-[#1F48AF] px-6 py-3 text-white shadow-sm transition hover:shadow disabled:opacity-40"
                style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
              >
                {submitting ? 'Publishing…' : 'Publish'}
              </button>
              {done && (
                <span className="text-sm text-green-600" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
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

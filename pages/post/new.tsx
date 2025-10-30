"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

/* =========================================================
   Walcord — New
   - Tabs arriba: Experiences (por defecto) · Listener Takes
   - Experiences = tu flujo actual (conciertos/experiencias)
   - Listener Takes = buscador de discos + reseña (≤280) + RATING obligatorio
   ========================================================= */

type TimeoutId = ReturnType<typeof setTimeout>;
type ArtistItem = { id: string; name: string };
type CountryItem = { code: string; name: string };
type MediaFile = { file: File; kind: "image" | "video" };

type PostType = "concert" | "experience";
type Experience =
  | "Opera"
  | "Musical"
  | "Dance"
  | "Ballet"
  | "Jazz Club"
  | "Festival"
  | "Recital"
  | "Home Sounds"
  | "Orchestra"
  | "Theatre"
  | "Club Party"
  | "Karaoke";

const EXPERIENCE_OPTIONS: { value: Experience; label: string }[] = [
  { value: "Opera", label: "Opera" },
  { value: "Musical", label: "Musical" },
  { value: "Dance", label: "Dance" },
  { value: "Ballet", label: "Ballet" },
  { value: "Jazz Club", label: "Jazz Club" },
  { value: "Festival", label: "Festival" },
  { value: "Recital", label: "Recital" },
  { value: "Home Sounds", label: "Home Sounds" },
  { value: "Orchestra", label: "Orchestra" },
  { value: "Theatre", label: "Theatre" },
  { value: "Club Party", label: "Club Party" },
  { value: "Karaoke", label: "Karaoke" },
];

const MAX_PHOTOS = 6;
const MAX_VIDEOS = 1;
const MAX_VIDEO_SECONDS = 15;

/** Mensajes */
const ONE_VIDEO_MSG = "Only one video is allowed (15 seconds or less).";
const MAX_PHOTOS_MSG = "Maximum six photos.";
const VIDEO_TOO_LONG_MSG = "The video must be 15 seconds or less.";
const COULD_NOT_READ_VIDEO_MSG = "Could not read video duration.";
const LIMIT_REACHED_MSG = "Limit reached. Remove some files to add more.";

/** Lee duración del vídeo en segundos usando <video> */
function readVideoDurationSec(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const d = v.duration;
      URL.revokeObjectURL(url);
      if (isFinite(d)) resolve(d);
      else reject(new Error("No se pudo leer la duración del vídeo"));
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo cargar el vídeo"));
    };
    v.src = url;
  });
}

/** === Helpers de Storage (subida directa + URL pública) === */
async function uploadDirect(bucket: string, path: string, file: File) {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(`Upload to ${bucket} failed: ${error.message}`);
  return { path: data?.path || path };
}
function getPublicUrl(bucket: string, path: string) {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/* ====== Tipos para la pestaña Listener Takes ====== */
type RecordRow = {
  id: string;
  title: string;
  artist_name: string | null;
  release_year: number | null;
  vibe_color: string | null;
  cover_color: string | null;
};

type TopTab = "experiences" | "takes";

export default function NewPostPage() {
  /* ==========================================
     TABS arriba (Experiences · Listener Takes)
     ========================================== */
  const [topTab, setTopTab] = useState<TopTab>("experiences");

  /* ==========================================
     EXPERIENCES (tu flujo actual intacto)
     ========================================== */
  // Tipo de post
  const [postType, setPostType] = useState<PostType>("concert");
  const [experience, setExperience] = useState<Experience | "">("");

  // Artist search (solo Concerts)
  const [artistQ, setArtistQ] = useState("");
  const [artistResults, setArtistResults] = useState<ArtistItem[]>([]);
  const [artistSearching, setArtistSearching] = useState(false);
  const [artist, setArtist] = useState<ArtistItem | null>(null);
  const [artistError, setArtistError] = useState<string>(""); // ⚠️ solo opciones existentes
  const artistDebouncer = useRef<TimeoutId | null>(null);

  // Flag para evitar que onBlur borre el valor mientras se hace clic en la opción
  const isPickingOptionRef = useRef(false);

  // Ubicación/fecha/caption
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [countryCode, setCountryCode] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");
  const [tourName, setTourName] = useState<string>("");
  const [caption, setCaption] = useState("");

  // Medios
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  // Refs para inputs separados
  const imagesInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // Cargar países
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("countries")
        .select("code, name")
        .order("name", { ascending: true });
      if (!error) setCountries((data as CountryItem[]) || []);
    })();
  }, []);

  // Buscar artistas (sólo si es concert)
  useEffect(() => {
    if (postType !== "concert") {
      setArtist(null);
      setArtistQ("");
      setArtistResults([]);
      setArtistSearching(false);
      setArtistError("");
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
          .from("artists")
          .select("id, name")
          .ilike("name", `%${term}%`)
          .limit(25);
        if (!error) {
          setArtistResults((data as ArtistItem[]) || []);
          setArtistError(""); // limpiar error al recibir resultados
        }
      } finally {
        setArtistSearching(false);
      }
    }, 200);
  }, [artistQ, postType]);

  /** Util: limpia el valor de un input file para permitir re-selección */
  const resetInput = (ref: React.RefObject<HTMLInputElement>) => {
    if (ref.current) ref.current.value = "";
  };

  /** Añadir ficheros: función genérica para DnD (mezcla) */
  const addIncomingFiles = async (incoming: FileList | null) => {
    if (!incoming?.length) return;

    // Split por tipo
    const newImages: File[] = [];
    const newVideos: File[] = [];

    for (const f of Array.from(incoming)) {
      if (f.type.startsWith("image/")) newImages.push(f);
      else if (f.type.startsWith("video/")) newVideos.push(f);
    }

    // === Vídeos ===
    if (newVideos.length) {
      if (newVideos.length > 1) {
        alert(ONE_VIDEO_MSG);
        return;
      }
      if (files.some((f) => f.kind === "video")) {
        alert(ONE_VIDEO_MSG);
        return;
      }
      const pickedVideo = newVideos[0];
      try {
        const secs = await readVideoDurationSec(pickedVideo);
        if (secs > MAX_VIDEO_SECONDS + 0.01) {
          alert(VIDEO_TOO_LONG_MSG);
          return;
        }
      } catch {
        alert(COULD_NOT_READ_VIDEO_MSG);
        return;
      }
      setFiles((prev) => [...prev, { file: pickedVideo, kind: "video" }]);
    }

    // === Imágenes ===
    if (newImages.length) {
      setFiles((prev) => {
        const currentImages = prev.filter((x) => x.kind === "image").length;
        const room = Math.max(0, MAX_PHOTOS - currentImages);
        const toAdd = newImages
          .slice(0, room)
          .map((f) => ({ file: f, kind: "image" as const }));
        if (newImages.length > room) alert(MAX_PHOTOS_MSG);
        return [...prev, ...toAdd];
      });
    }
  };

  /** Picker exclusivo para imágenes (mejor feedback de límites) */
  const onPickImages = async (list: FileList | null) => {
    if (!list?.length) return;
    const imgs = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => {
      const currentImages = prev.filter((x) => x.kind === "image").length;
      const room = Math.max(0, MAX_PHOTOS - currentImages);
      if (room <= 0) {
        alert(LIMIT_REACHED_MSG);
        resetInput(imagesInputRef);
        return prev;
      }
      const toAdd = imgs
        .slice(0, room)
        .map((file) => ({ file, kind: "image" as const }));
      if (imgs.length > room) alert(MAX_PHOTOS_MSG);
      resetInput(imagesInputRef);
      return [...prev, ...toAdd];
    });
  };

  /** Picker exclusivo para vídeo (valida duración y único) */
  const onPickVideo = async (list: FileList | null) => {
    if (!list?.length) return;
    const picked = list[0];
    if (!picked.type.startsWith("video/")) {
      resetInput(videoInputRef);
      return;
    }
    if (files.some((f) => f.kind === "video")) {
      alert(ONE_VIDEO_MSG);
      resetInput(videoInputRef);
      return;
    }
    try {
      const secs = await readVideoDurationSec(picked);
      if (secs > MAX_VIDEO_SECONDS + 0.01) {
        alert(VIDEO_TOO_LONG_MSG);
        resetInput(videoInputRef);
        return;
      }
    } catch {
      alert(COULD_NOT_READ_VIDEO_MSG);
      resetInput(videoInputRef);
      return;
    }
    setFiles((prev) => [...prev, { file: picked, kind: "video" }]);
    resetInput(videoInputRef);
  };

  const removeFileAt = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  const imageCount = useMemo(
    () => files.filter((f) => f.kind === "image").length,
    [files]
  );
  const videoFile = useMemo(
    () => files.find((f) => f.kind === "video")?.file || null,
    [files]
  );

  const previews = useMemo(
    () =>
      files.slice(0, MAX_PHOTOS + MAX_VIDEOS).map((m) => ({
        kind: m.kind,
        url: URL.createObjectURL(m.file),
        name: m.file.name,
      })),
    [files]
  );

  // Submit EXPERIENCES
  const onSubmitExperience = async () => {
    // Validaciones de campos obligatorios
    if (postType === "concert" && !artist) {
      setArtistError("Please choose an existing artist from the list.");
      return alert("Please select artist");
    }
    if (postType === "experience" && !experience)
      return alert("Please select an experience type");
    if (!countryCode) return alert("Please select country");
    if (!city.trim()) return alert("Please type city");
    if (!dateStr) return alert("Please select date");
    if (imageCount < 1 && !videoFile)
      return alert("Please add photos and/or a video");

    const isOnlyVideo = !!videoFile && imageCount === 0;
    const hasPhotos = imageCount > 0;

    // Si hay vídeo, validar duración justo antes de subir
    let videoDurationSec: number | null = null;
    if (videoFile) {
      try {
        const secs = await readVideoDurationSec(videoFile);
        if (secs > MAX_VIDEO_SECONDS + 0.01) {
          alert(VIDEO_TOO_LONG_MSG);
          return;
        }
        videoDurationSec = Math.round(secs);
      } catch {
        alert(COULD_NOT_READ_VIDEO_MSG);
        return;
      }
    }

    setSubmitting(true);
    setDone(null);

    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const userId = authData?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      if (isOnlyVideo) {
        // === SOLO VÍDEO → clips
        const ext = (videoFile!.name.split(".").pop() || "mp4").toLowerCase();
        const base = `user_${userId}/${Date.now()}_${Math.random()
          .toString(36)
          .slice(2)}`;
        const videoPath = `${base}/video.${ext}`;
        const { path: storedPath } = await uploadDirect("clips", videoPath, videoFile!);
        const video_url = getPublicUrl("clips", storedPath);

        const { error: clipsErr } = await supabase.from("clips").insert([
          {
            user_id: userId,
            video_url,
            poster_url: null,
            caption: caption || null,
            artist_name: postType === "concert" ? artist?.name || null : null,
            venue: tourName || null,
            city: city || null,
            country: countryCode || null,
            event_date: dateStr || null,
            duration_seconds: videoDurationSec, // <-- CLAVE PARA EL FEED
            kind: postType, // 'concert' | 'experience'
            experience: postType === "experience" ? experience : null,
          },
        ]);
        if (clipsErr)
          throw new Error(
            `No se pudo registrar el vídeo en clips: ${clipsErr.message}`
          );
      } else {
        // === HAY FOTOS (con o sin vídeo) → concerts + concert_media; si también hay vídeo, además clips
        const { data: concertIns, error: concertErr } = await supabase
          .from("concerts")
          .insert({
            user_id: userId,
            artist_id: postType === "concert" ? artist?.id : null,
            country_code: countryCode,
            city: city.trim(),
            event_date: dateStr,
            tour_name: tourName.trim() || null,
            caption: caption.trim() || null,
            post_type: postType,
            experience: postType === "experience" ? experience : null,
          })
          .select("id")
          .single();
        if (concertErr) throw new Error(`No se pudo crear el concierto: ${concertErr.message}`);
        const concertId: string = (concertIns as any).id;

        // Subir fotos → concert_media
        if (hasPhotos) {
          const images = files
            .filter((f) => f.kind === "image")
            .slice(0, MAX_PHOTOS);
          const uploads: string[] = [];
          for (const m of images) {
            const ext = (m.file.name.split(".").pop() || "jpg").toLowerCase();
            const baseName = m.file.name
              .replace(/[^\w.\-]+/g, "_")
              .replace(/\.[a-z0-9]{2,4}$/i, "");
            const path = `${concertId}/${Date.now()}_${Math.random()
              .toString(36)
              .slice(2)}_${baseName}.${ext}`;
            const { path: storedPath } = await uploadDirect(
              "concert_media",
              path,
              m.file
            );
            uploads.push(getPublicUrl("concert_media", storedPath));
          }
          if (uploads.length) {
            const payload = uploads.map((url) => ({
              concert_id: concertId,
              url,
              media_type: "image",
            }));
            const { error: mediaErr } = await supabase
              .from("concert_media")
              .insert(payload);
            if (mediaErr)
              throw new Error(
                `No se pudieron guardar las imágenes: ${mediaErr.message}`
              );
          }
        }

        // Si además hay vídeo, también guardarlo en clips
        if (videoFile) {
          const ext = (videoFile.name.split(".").pop() || "mp4").toLowerCase();
          const base = `user_${userId}/${concertId}`;
          const videoPath = `${base}/video_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2)}.${ext}`;
          const { path: storedPath } = await uploadDirect(
            "clips",
            videoPath,
            videoFile
          );
          const video_url = getPublicUrl("clips", storedPath);

          const { error: clipsErr } = await supabase.from("clips").insert([
            {
              user_id: userId,
              video_url,
              poster_url: null,
              caption: caption || null,
              artist_name:
                postType === "concert" ? artist?.name || null : null,
              venue: tourName || null,
              city: city || null,
              country: countryCode || null,
              event_date: dateStr || null,
              duration_seconds: videoDurationSec, // <-- CLAVE PARA EL FEED
              kind: postType,
              experience: postType === "experience" ? experience : null,
            },
          ]);
          if (clipsErr)
            throw new Error(
              `No se pudo registrar el vídeo en clips: ${clipsErr.message}`
            );
        }
      }

      setDone("Shared");

      // Reset UI
      setArtist(null);
      setArtistQ("");
      setArtistResults([]);
      setCountryCode("");
      setCity("");
      setDateStr("");
      setTourName("");
      setCaption("");
      setFiles([]);
      setExperience("");
      setArtistError("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      alert(e?.message ?? "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const canPublishExperience =
    !submitting &&
    ((postType === "concert" && !!artist) ||
      (postType === "experience" && !!experience)) &&
    !!countryCode &&
    !!city.trim() &&
    !!dateStr &&
    (imageCount > 0 || !!videoFile);

  /* ==========================================
     LISTENER TAKES — buscador de discos + reseña
     (con RATING obligatorio y enlace rating_id)
     ========================================== */
  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const u = (await supabase.auth.getUser()).data.user;
      setMeId(u?.id || null);
    })();
  }, []);

  const [recordQ, setRecordQ] = useState("");
  const [recordSearching, setRecordSearching] = useState(false);
  const [recordResults, setRecordResults] = useState<RecordRow[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<RecordRow | null>(null);
  const recordDebouncer = useRef<TimeoutId | null>(null);
  const [takeBody, setTakeBody] = useState("");
  const [postingTake, setPostingTake] = useState(false);

  // ⭐ NEW: rating para el take
  const [takeRate, setTakeRate] = useState<number | null>(null);

  useEffect(() => {
    if (!recordQ.trim() || recordQ.trim().length < 2) {
      setRecordResults([]);
      return;
    }
    setRecordSearching(true);
    if (recordDebouncer.current) clearTimeout(recordDebouncer.current);
    recordDebouncer.current = setTimeout(async () => {
      try {
        const term = recordQ.trim();
        // Búsqueda por título o artista (case-insensitive)
        const { data, error } = await supabase
          .from("records")
          .select("id, title, artist_name, release_year, vibe_color, cover_color")
          .or(`title.ilike.%${term}%,artist_name.ilike.%${term}%`)
          .order("release_year", { ascending: false })
          .limit(25);
        if (!error) setRecordResults((data as RecordRow[]) || []);
      } finally {
        setRecordSearching(false);
      }
    }, 220);
  }, [recordQ]);

  const canPublishTake =
    !!meId &&
    !!selectedRecord &&
    takeBody.trim().length > 0 &&
    takeBody.length <= 280 &&
    takeRate != null &&
    !postingTake;

  const submitTake = async () => {
    if (!meId) return alert("Sign in to continue.");
    if (!selectedRecord) return alert("Please choose a record.");
    const clean = takeBody.trim();
    if (!clean || clean.length > 280) return;
    if (takeRate == null) {
      alert("Please select a rating (1–10) to publish your Listener Take.");
      return;
    }

    setPostingTake(true);
    try {
      // 1) upsert del rating del usuario para este record y obtener su id
      const { data: ratingRow, error: ratingErr } = await supabase
        .from("ratings")
        .upsert(
          { user_id: meId, record_id: selectedRecord.id, rate: takeRate },
          { onConflict: "user_id,record_id" }
        )
        .select("id")
        .single();

      if (ratingErr || !ratingRow) throw new Error("Error saving the rating.");

      // 2) insertar la recomendación enlazando rating_id
      const { error } = await supabase
        .from("recommendations")
        .insert({
          user_id: meId,
          target_type: "record",
          target_id: selectedRecord.id,
          body: clean,
          rating_id: ratingRow.id, // 🔗 vínculo
        });

      if (error) throw error;

      // Reset UI de takes
      setTakeBody("");
      setSelectedRecord(null);
      setRecordQ("");
      setRecordResults([]);
      setTakeRate(null);
      alert("Your take has been shared.");
    } catch (e: any) {
      alert(e?.message ?? "Error");
    } finally {
      setPostingTake(false);
    }
  };

  /* ==========================================
     RENDER
     ========================================== */
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
        <div className="text-white/90 text-sm pr-1">New</div>
      </header>

      {/* Caja */}
      <main className="mx-auto w-full max-w-[760px] px-4 sm:px-6 py-6 sm:py-8">
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-[0_6px_22px_rgba(0,0,0,0.06)]">
          {/* Header */}
          <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-0">
            <h1
              className="text-[clamp(1.6rem,4.5vw,2rem)] leading-[1.1] tracking-tight"
              style={{
                fontFamily: '"Times New Roman", Times, serif',
                fontWeight: 400,
              }}
            >
              Share in The Wall
            </h1>

            {/* ====== Tabs superiores (estilo cápsula) ====== */}
            <div className="mt-3">
              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTopTab("experiences")}
                  className={`px-5 py-2 rounded-full text-sm border ${
                    topTab === "experiences"
                      ? "bg-[#1F48AF] text-white border-[#1F48AF]"
                      : "bg-white text-black border-neutral-200"
                  }`}
                  style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                >
                  Musical Memories
                </button>

                <button
                  type="button"
                  onClick={() => setTopTab("takes")}
                  className={`px-5 py-2 rounded-full text-sm border ${
                    topTab === "takes"
                      ? "bg-[#1F48AF] text-white border-[#1F48AF]"
                      : "bg-white text-black border-neutral-200"
                  }`}
                  style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                >
                  Musical Opinion
                </button>
              </div>
            </div>
          </div>

          {/* ====== CONTENIDO POR TAB ====== */}
          {topTab === "experiences" ? (
            /* ===================== EXPERIENCES ===================== */
            <>
              {/* Layout */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-7 px-5 sm:px-6 pb-6 sm:pb-7 mt-4">
                {/* Izquierda */}
                <div>
                  {/* Selector interno Concerts / Other musical experiences */}
                  <div className="mb-5">
                    <div className="inline-flex rounded-2xl border border-neutral-200 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setPostType("concert");
                          setArtistError("");
                        }}
                        className={`px-4 py-2 text-sm ${
                          postType === "concert"
                            ? "bg-[#1F48AF] text-white"
                            : "bg-white text-black"
                        }`}
                        style={{
                          fontFamily: "Roboto, Arial, sans-serif",
                          fontWeight: 300,
                        }}
                      >
                        Concerts
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPostType("experience");
                          setArtistError("");
                        }}
                        className={`px-4 py-2 text-sm border-l border-neutral-200 ${
                          postType === "experience"
                            ? "bg-[#1F48AF] text-white"
                            : "bg-white text-black"
                        }`}
                        style={{
                          fontFamily: "Roboto, Arial, sans-serif",
                          fontWeight: 300,
                        }}
                      >
                        Other musical experiences
                      </button>
                    </div>
                  </div>

                  {/* Concerts → buscador */}
                  {postType === "concert" ? (
                    <>
                      {artist ? (
                        <div className="mb-5 sm:mb-6 flex items-center justify-between rounded-2xl border border-neutral-200 bg-white/80 backdrop-blur px-4 py-3 shadow-sm">
                          <div className="leading-tight">
                            <div
                              style={{
                                fontFamily:
                                  '"Times New Roman", Times, serif',
                              }}
                            >
                              {artist.name}
                            </div>
                            <div
                              className="text-sm text-neutral-500"
                              style={{
                                fontFamily: "Roboto, Arial, sans-serif",
                                fontWeight: 300,
                              }}
                            >
                              Artist selected
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setArtist(null);
                              setArtistError("");
                            }}
                            className="text-sm text-[#1F48AF] hover:underline"
                            style={{
                              fontFamily: "Roboto, Arial, sans-serif",
                              fontWeight: 300,
                            }}
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <div className="mb-5 sm:mb-6">
                          <label
                            className="block text-xs uppercase tracking-widest text-neutral-600"
                            style={{
                              fontFamily: "Roboto, Arial, sans-serif",
                              fontWeight: 300,
                            }}
                          >
                            Artist
                          </label>
                          <div className="mt-2 relative">
                            <input
                              value={artistQ}
                              onChange={(e) => {
                                setArtistQ(e.target.value);
                                setArtistError("");
                              }}
                              onBlur={() => {
                                // ⚠️ Evitar limpiar si el blur viene de hacer click en una opción
                                if (isPickingOptionRef.current) return;
                                if (!artist && artistQ.trim()) {
                                  setArtistQ("");
                                  setArtistError(
                                    "Please choose an existing artist from the list."
                                  );
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (artistResults.length > 0) {
                                    const pick = artistResults[0];
                                    setArtist(pick);
                                    setArtistQ("");
                                    setArtistResults([]);
                                    setArtistError("");
                                  } else {
                                    setArtistError(
                                      "No artists found. Only existing artists can be selected."
                                    );
                                  }
                                }
                              }}
                              placeholder="Search artist name…"
                              className="w-full rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 outline-none focus:ring-2 focus:ring-[#1F48AF] shadow-sm italic"
                              style={{
                                fontFamily: "Roboto, Arial, sans-serif",
                                fontWeight: 300,
                              }}
                            />
                            {(artistSearching || artistResults.length > 0) && (
                              <div
                                className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white/95 shadow-xl max-h-[320px] overflow-y-auto"
                                // Activa flag en mousedown para que se ejecute antes que el blur
                                onMouseDown={() => {
                                  isPickingOptionRef.current = true;
                                }}
                                onMouseUp={() => {
                                  // liberar el flag justo después de seleccionar
                                  setTimeout(() => {
                                    isPickingOptionRef.current = false;
                                  }, 0);
                                }}
                              >
                                {artistSearching && (
                                  <div
                                    className="px-4 py-3 text-sm text-neutral-500"
                                    style={{
                                      fontFamily: "Roboto, Arial, sans-serif",
                                      fontWeight: 300,
                                    }}
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
                                        setArtistQ("");
                                        setArtistResults([]);
                                        setArtistError("");
                                      }}
                                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 transition"
                                    >
                                      <div className="min-w-0">
                                        <div
                                          className="truncate"
                                          style={{
                                            fontFamily:
                                              '"Times New Roman", Times, serif',
                                          }}
                                        >
                                          {r.name}
                                        </div>
                                      </div>
                                    </button>
                                  ))}
                                {!artistSearching &&
                                  artistResults.length === 0 &&
                                  artistQ.trim().length >= 2 && (
                                    <div
                                      className="px-4 py-3 text-sm text-neutral-500"
                                      style={{
                                        fontFamily:
                                          "Roboto, Arial, sans-serif",
                                        fontWeight: 300,
                                      }}
                                    >
                                      No artists found. Only existing artists
                                      can be selected.
                                    </div>
                                  )}
                              </div>
                            )}
                            {artistError && (
                              <p
                                className="mt-2 text-xs text-red-600"
                                style={{
                                  fontFamily: "Roboto, Arial, sans-serif",
                                  fontWeight: 300,
                                }}
                              >
                                {artistError}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    // Experiences → selector con el MISMO estilo que Country
                    <div className="mb-5 sm:mb-6">
                      <label
                        className="block text-xs uppercase tracking-widest text-neutral-600"
                        style={{
                          fontFamily: "Roboto, Arial, sans-serif",
                          fontWeight: 300,
                        }}
                      >
                        Experience type
                      </label>
                      <div className="mt-2 relative">
                        <select
                          value={experience}
                          onChange={(e) =>
                            setExperience(e.target.value as Experience)
                          }
                          className="w-full appearance-none rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 pr-10 shadow-sm outline-none focus:ring-2 focus:ring-[#1F48AF]"
                          style={{
                            fontFamily: "Roboto, Arial, sans-serif",
                            fontWeight: 300,
                          }}
                        >
                          <option value="" disabled>
                            Select one…
                          </option>
                          {EXPERIENCE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                          ▾
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Country */}
                  <div className="mb-5 sm:mb-6">
                    <label
                      className="block text-xs uppercase tracking-widest text-neutral-600"
                      style={{
                        fontFamily: "Roboto, Arial, sans-serif",
                        fontWeight: 300,
                      }}
                    >
                      Country
                    </label>
                    <div className="mt-2 relative">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="w-full appearance-none rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 pr-10 shadow-sm outline-none focus:ring-2 focus:ring-[#1F48AF]"
                        style={{
                          fontFamily: "Roboto, Arial, sans-serif",
                          fontWeight: 300,
                        }}
                      >
                        <option value="">Select country…</option>
                        {countries.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                        ▾
                      </span>
                    </div>
                  </div>

                  {/* City */}
                  <div className="mb-5 sm:mb-6">
                    <label
                      className="block text-xs uppercase tracking-widest text-neutral-600"
                      style={{
                        fontFamily: "Roboto, Arial",
                        fontWeight: 300,
                      }}
                    >
                      City
                    </label>
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Type your city…"
                      className="mt-2 w-full rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 outline-none focus:ring-2 focus:ring-[#1F48AF] shadow-sm"
                      style={{
                        fontFamily: "Roboto, Arial",
                        fontWeight: 300,
                      }}
                    />
                  </div>

                  {/* Date */}
                  <div className="mb-5 sm:mb-6">
                    <label
                      className="block text-xs uppercase tracking-widest text-neutral-600"
                      style={{
                        fontFamily: "Roboto, Arial, sans-serif",
                        fontWeight: 300,
                      }}
                    >
                      Date
                    </label>
                    <input
                      type="date"
                      value={dateStr}
                      onChange={(e) => setDateStr(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 outline-none focus:ring-2 focus:ring-[#1F48AF] shadow-sm"
                      style={{
                        fontFamily: "Roboto, Arial, sans-serif",
                        fontWeight: 300,
                      }}
                    />
                  </div>

                  {/* Name of the event */}
                  <div className="mb-5 sm:mb-6">
                    <label
                      className="block text-xs uppercase tracking-widest text-neutral-600"
                      style={{
                        fontFamily: "Roboto, Arial, sans-serif",
                        fontWeight: 300,
                      }}
                    >
                      Name of the event
                    </label>
                    <input
                      value={tourName}
                      onChange={(e) => setTourName(e.target.value)}
                      placeholder="Tour name…"
                      className="mt-2 w-full rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 outline-none focus:ring-2 focus:ring-[#1F48AF] shadow-sm"
                      style={{
                        fontFamily: "Roboto, Arial, sans-serif",
                        fontWeight: 300,
                      }}
                    />
                  </div>

                  {/* Caption (oculto por ahora) */}
                  <div className="hidden">
                    <label
                      className="block text-xs uppercase tracking-widest text-neutral-600"
                      style={{
                        fontFamily: "Roboto, Arial, sans-serif",
                        fontWeight: 300,
                      }}
                    >
                      Caption (optional)
                    </label>
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      rows={6}
                      placeholder="Write something…"
                      className="mt-2 w-full rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 outline-none focus:ring-2 focus:ring-[#1F48AF] shadow-sm"
                      style={{
                        fontFamily: "Roboto, Arial, sans-serif",
                        fontWeight: 300,
                      }}
                    />
                  </div>
                </div>

                {/* Derecha: Photos and videos */}
                <div>
                  <label
                    className="block text-xs uppercase tracking-widest text-neutral-600"
                    style={{
                      fontFamily: "Roboto, Arial, sans-serif",
                      fontWeight: 300,
                    }}
                  >
                    Photos and videos
                  </label>

                  {/* Zona DnD (mantiene validaciones) */}
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
                      "mt-2 rounded-2xl border border-dashed p-4 sm:p-5 bg.white/70 backdrop-blur transition".replace(
                        "bg.white",
                        "bg-white"
                      ),
                      isDragging
                        ? "border-[#1F48AF] ring-2 ring-[#1F48AF]/40"
                        : "border-neutral-300",
                    ].join(" ")}
                  >
                    {/* Controles separados: imágenes y vídeo */}
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={imagesInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => onPickImages(e.target.files)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (imageCount >= MAX_PHOTOS) {
                            alert(LIMIT_REACHED_MSG);
                            return;
                          }
                          imagesInputRef.current?.click();
                        }}
                        disabled={imageCount >= MAX_PHOTOS}
                        className="text-sm rounded-xl bg-[#1F48AF] px-4 py-2 text-white shadow-sm transition hover:shadow disabled:opacity-40"
                        style={{
                          fontFamily: "Roboto, Arial, sans-serif",
                          fontWeight: 300,
                        }}
                      >
                        {imageCount >= MAX_PHOTOS
                          ? "Max photos reached"
                          : "Add photos"}
                      </button>

                      <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/*"
                        onChange={(e) => onPickVideo(e.target.files)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (videoFile) {
                            alert(ONE_VIDEO_MSG);
                            return;
                          }
                          videoInputRef.current?.click();
                        }}
                        disabled={!!videoFile}
                        className="text-sm rounded-xl bg-black px-4 py-2 text-white shadow-sm transition hover:shadow disabled:opacity-40"
                        style={{
                          fontFamily: "Roboto, Arial, sans-serif",
                          fontWeight: 300,
                        }}
                      >
                        {videoFile ? "Video added" : "Add 1 video (≤15s)"}
                      </button>

                      {!!files.length && (
                        <button
                          type="button"
                          onClick={() => {
                            setFiles([]);
                            resetInput(imagesInputRef);
                            resetInput(videoInputRef);
                          }}
                          className="text-sm text-[#1F48AF] hover:underline ml-auto"
                          style={{
                            fontFamily: "Roboto, Arial, sans-serif",
                            fontWeight: 300,
                          }}
                        >
                          Clear all
                        </button>
                      )}
                    </div>

                    {/* Nota de ayuda y contador */}
                    <p
                      className="mt-2 text-xs text-neutral-600"
                      style={{
                        fontFamily: "Roboto, Arial, sans-serif",
                        fontWeight: 300,
                      }}
                    >
                      You can upload up to six photos and one video (15s max).
                      Non-compliant files will be rejected automatically.
                    </p>
                    <span
                      className="mt-1 inline-block text-xs text-neutral-600"
                      style={{
                        fontFamily: "Roboto, Arial, sans-serif",
                        fontWeight: 300,
                      }}
                    >
                      {imageCount}/{MAX_PHOTOS} photos · {videoFile ? 1 : 0}/
                      {MAX_VIDEOS} video
                    </span>

                    {/* Estado vacío para DnD */}
                    {!files.length && (
                      <p
                        className="mt-2 text-xs text-neutral-500 italic"
                        style={{ fontFamily: "Roboto, Arial", fontWeight: 300 }}
                      >
                        Drag & drop images or a video, or use the buttons above.
                      </p>
                    )}

                    {/* Previews */}
                    {previews.length > 0 && (
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {previews.map((p, i) => (
                          <div key={i} className="relative group">
                            {p.kind === "image" ? (
                              <img
                                src={p.url}
                                alt=""
                                className="h-28 w-full rounded-xl object-cover"
                              />
                            ) : (
                              <video
                                src={p.url}
                                className="h-28 w-full rounded-xl object-cover"
                                muted
                              />
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
                    onClick={onSubmitExperience}
                    disabled={!canPublishExperience}
                    className="rounded-xl bg-[#1F48AF] px-6 py-3 text-white shadow-sm transition hover:shadow disabled:opacity-40"
                    style={{
                      fontFamily: "Roboto, Arial, sans-serif",
                      fontWeight: 300,
                    }}
                  >
                    {submitting ? "Publishing…" : "Publish"}
                  </button>
                  {done && (
                    <span
                      className="text-sm text-green-600"
                      style={{
                        fontFamily: "Roboto, Arial, sans-serif",
                        fontWeight: 300,
                      }}
                    >
                      {done}
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* ===================== LISTENER TAKES ===================== */
            <section className="px-5 sm:px-6 pb-8 sm:pb-10 mt-5">
              {/* Buscador de discos */}
              <div className="max-w-[680px]">
                {selectedRecord ? (
                  <div className="mb-5 sm:mb-6 flex items-center justify-between rounded-2xl border border-neutral-200 bg-white/80 backdrop-blur px-4 py-3 shadow-sm">
                    <div className="leading-tight">
                      <div
                        className="truncate"
                        style={{
                          fontFamily: '"Times New Roman", Times, serif',
                        }}
                      >
                        {selectedRecord.title}
                      </div>
                      <div
                        className="text-xs text-neutral-500"
                        style={{
                          fontFamily: "Roboto, Arial, sans-serif",
                          fontWeight: 300,
                        }}
                      >
                        {selectedRecord.artist_name || "—"}
                        {selectedRecord.release_year
                          ? ` · ${selectedRecord.release_year}`
                          : ""}
                      </div>
                    </div>
                    <div
                      className="w-10 h-10 rounded-lg"
                      style={{
                        backgroundColor:
                          selectedRecord.vibe_color || "#F4F4F4",
                      }}
                      title="Album aesthetic"
                    >
                      <div
                        className="w-3.5 h-3.5 rounded-sm shadow-sm m-3"
                        style={{
                          backgroundColor:
                            selectedRecord.cover_color || "#000",
                        }}
                      />
                    </div>
                    <button
                      onClick={() => {
                        setSelectedRecord(null);
                        setTakeRate(null);
                      }}
                      className="text-sm text-[#1F48AF] hover:underline"
                      style={{
                        fontFamily: "Roboto, Arial, sans-serif",
                        fontWeight: 300,
                      }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="mb-5 sm:mb-6">
                    <label
                      className="block text-xs uppercase tracking-widest text-neutral-600"
                      style={{
                        fontFamily: "Roboto, Arial, sans-serif",
                        fontWeight: 300,
                      }}
                    >
                      Record
                    </label>
                    <div className="mt-2 relative">
                      <input
                        value={recordQ}
                        onChange={(e) => setRecordQ(e.target.value)}
                        placeholder="Search title or artist…"
                        className="w-full rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 outline-none focus:ring-2 focus:ring-[#1F48AF] shadow-sm"
                        style={{
                          fontFamily: "Roboto, Arial, sans-serif",
                          fontWeight: 300,
                        }}
                      />
                      {(recordSearching || recordResults.length > 0) && (
                        <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white/95 shadow-xl max-h-[360px] overflow-y-auto">
                          {recordSearching && (
                            <div
                              className="px-4 py-3 text-sm text-neutral-500"
                              style={{
                                fontFamily: "Roboto, Arial, sans-serif",
                                fontWeight: 300,
                              }}
                            >
                              Searching…
                            </div>
                          )}
                          {!recordSearching &&
                            recordResults.map((r) => (
                              <button
                                key={r.id}
                                onClick={() => {
                                  setSelectedRecord(r);
                                  setRecordResults([]);
                                  setRecordQ("");
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-neutral-50 transition"
                              >
                                <div
                                  className="font-normal"
                                  style={{
                                    fontFamily:
                                      '"Times New Roman", Times, serif',
                                  }}
                                >
                                  {r.title}
                                </div>
                                <div
                                  className="text-xs text-neutral-500"
                                  style={{
                                    fontFamily: "Roboto, Arial, sans-serif",
                                    fontWeight: 300,
                                  }}
                                >
                                  {r.artist_name || "—"}
                                  {r.release_year ? ` · ${r.release_year}` : ""}
                                </div>
                              </button>
                            ))}
                          {!recordSearching &&
                            recordResults.length === 0 &&
                            recordQ.trim().length >= 2 && (
                              <div
                                className="px-4 py-3 text-sm text-neutral-500"
                                style={{
                                  fontFamily: "Roboto, Arial, sans-serif",
                                  fontWeight: 300,
                                }}
                              >
                                No records found.
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Composer de la reseña */}
                <div className="bg-white border border-neutral-200 rounded-3xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
                  <textarea
                    value={takeBody}
                    onChange={(e) => setTakeBody(e.target.value)}
                    placeholder="Share your thoughts about this record…"
                    className="w-full min-h-[110px] border border-neutral-300 rounded-2xl px-3 py-3 text-[15px] leading-7 outline-none focus:ring-2 focus:ring-[#1F48AF] font-[family-name:Times_New_Roman,Times,serif]"
                    maxLength={280}
                  />

                  {/* ⭐ Selector de rating obligatorio (1–10) */}
                  <div className="mt-3">
                    <div className="text-[12px] text-neutral-600 mb-2 flex items-center gap-2">
                      <span>Select your rating (required)</span>
                    </div>
                    <div className="grid grid-cols-10 gap-1">
                      {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                        <button
                          key={n}
                          onClick={() => setTakeRate(n)}
                          className={`h-9 rounded-full border text-sm ${
                            takeRate===n ? "bg-[#1F48AF] text-white border-[#1F48AF]" : "border-neutral-300 hover:bg-neutral-50"
                          }`}
                          aria-pressed={takeRate===n}
                          aria-label={`Rate ${n}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span
                      className={`text-xs ${
                        takeBody.length > 280
                          ? "text-red-600"
                          : "text-neutral-500"
                      }`}
                    >
                      {280 - takeBody.length}
                    </span>
                    <button
                      onClick={submitTake}
                      disabled={!canPublishTake}
                      className={`text-xs px-4 py-2 rounded-full ${
                        canPublishTake
                          ? "bg-[#1F48AF] text-white"
                          : "bg-neutral-300 text-neutral-600 cursor-not-allowed"
                      }`}
                    >
                      {postingTake ? "Posting…" : "Share Take"}
                    </button>
                  </div>
                </div>

                <p
                  className="mt-3 text-xs text-neutral-500"
                  style={{
                    fontFamily: "Roboto, Arial, sans-serif",
                    fontWeight: 300,
                  }}
                >
                </p>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

/* =========================================================
   Walcord — New
   3 tabs:
   1) Memories
   2) Collection
   3) Opinion
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

/** Helpers de Storage (subida directa + URL pública) */
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

/** Avatar resolver: si avatar_url es URL -> úsala; si es path -> conviértelo a publicUrl del bucket */
function isHttpUrl(v: string) {
  return /^https?:\/\//i.test(v);
}
// cambia "avatars" si tu bucket se llama distinto
function resolveAvatarUrl(raw: string | null, bucket = "avatars") {
  if (!raw) return null;
  if (isHttpUrl(raw)) return raw;
  const { data } = supabase.storage.from(bucket).getPublicUrl(raw);
  return data?.publicUrl || null;
}

/* ====== Tipos records ====== */
type RecordRow = {
  id: string;
  title: string;
  artist_name: string | null;
  release_year: number | null;
  vibe_color: string | null;
  cover_color: string | null;
};

type RecordSearchRow = RecordRow;

type TopTab = "memories" | "collection" | "opinion";

export default function NewPage() {
  /* ==========================================
     Top tabs
     ========================================== */
  const [topTab, setTopTab] = useState<TopTab>("memories");

  /* ==========================================
     Auth + profile
     ========================================== */
  const [meId, setMeId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const u = (await supabase.auth.getUser()).data.user;
      const uid = u?.id || null;
      setMeId(uid);

      if (!uid) return;

      // FIX: tu tabla profiles usa "id" (uuid) como PK (no "user_id")
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url, username, full_name")
        .eq("id", uid)
        .maybeSingle();

      if (error) console.log("profiles read error:", error);

      const raw = (data as any)?.avatar_url || null;
      const resolved = resolveAvatarUrl(raw, "avatars"); // <-- cambia bucket si no es "avatars"
      setAvatarUrl(resolved);

      setDisplayName((data as any)?.full_name || (data as any)?.username || null);
    })();
  }, []);

  /* ==========================================
     MUSICAL MEMORIES
     - cover tipo postcard claro (Change + picker)
     ========================================== */
  const [postType, setPostType] = useState<PostType>("concert");
  const [experience, setExperience] = useState<Experience | "">("");

  // Artist search (solo Concerts)
  const [artistQ, setArtistQ] = useState("");
  const [artistResults, setArtistResults] = useState<ArtistItem[]>([]);
  const [artistSearching, setArtistSearching] = useState(false);
  const [artist, setArtist] = useState<ArtistItem | null>(null);
  const [artistError, setArtistError] = useState<string>("");
  const artistDebouncer = useRef<TimeoutId | null>(null);
  const isPickingOptionRef = useRef(false);

  // Ubicación/fecha/caption
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [countryCode, setCountryCode] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");
  const [tourName, setTourName] = useState<string>("");
  const [caption, setCaption] = useState("");

  // Media
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const imagesInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // Cover selection
  const [selectedCoverIdx, setSelectedCoverIdx] = useState<number>(0);
  const [showCoverPicker, setShowCoverPicker] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("countries")
        .select("code, name")
        .order("name", { ascending: true });
      if (!error) setCountries((data as CountryItem[]) || []);
    })();
  }, []);

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
          setArtistError("");
        }
      } finally {
        setArtistSearching(false);
      }
    }, 200);
  }, [artistQ, postType]);

  const resetInput = (ref: React.RefObject<HTMLInputElement>) => {
    if (ref.current) ref.current.value = "";
  };

  const addIncomingFiles = async (incoming: FileList | null) => {
    if (!incoming?.length) return;

    const newItems: MediaFile[] = [];
    for (const f of Array.from(incoming)) {
      if (f.type.startsWith("image/")) newItems.push({ file: f, kind: "image" });
      else if (f.type.startsWith("video/")) newItems.push({ file: f, kind: "video" });
    }
    if (!newItems.length) return;

    setFiles((prev) => [...prev, ...newItems]);
  };

  const onPickImages = async (list: FileList | null) => {
    if (!list?.length) return;
    const imgs = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) {
      resetInput(imagesInputRef);
      return;
    }
    setFiles((prev) => [...prev, ...imgs.map((file) => ({ file, kind: "image" as const }))]);
    resetInput(imagesInputRef);
  };

  const onPickVideo = async (list: FileList | null) => {
    if (!list?.length) return;
    const vids = Array.from(list).filter((f) => f.type.startsWith("video/"));
    if (!vids.length) {
      resetInput(videoInputRef);
      return;
    }
    setFiles((prev) => [...prev, ...vids.map((file) => ({ file, kind: "video" as const }))]);
    resetInput(videoInputRef);
  };

  const removeFileAt = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const imageFiles = useMemo(() => files.filter((f) => f.kind === "image").map((x) => x.file), [files]);
  const videoFiles = useMemo(() => files.filter((f) => f.kind === "video").map((x) => x.file), [files]);

  useEffect(() => {
    setSelectedCoverIdx((prev) => {
      if (!imageFiles.length) return 0;
      return Math.min(prev, imageFiles.length - 1);
    });
  }, [imageFiles.length]);

  const previews = useMemo(
    () =>
      files.map((m) => ({
        kind: m.kind,
        url: URL.createObjectURL(m.file),
        name: m.file.name,
      })),
    [files]
  );

  const currentCoverThumb = useMemo(() => {
    if (!imageFiles.length) return null;
    const idx = Math.min(selectedCoverIdx, imageFiles.length - 1);
    const f = imageFiles[idx];
    if (!f) return null;
    return { idx, url: URL.createObjectURL(f) };
  }, [imageFiles, selectedCoverIdx]);

  const canPublishMemories =
    !submitting &&
    ((postType === "concert" && !!artist) || (postType === "experience" && !!experience)) &&
    !!countryCode &&
    !!city.trim() &&
    !!dateStr &&
    (imageFiles.length > 0 || videoFiles.length > 0);

  const onSubmitMemories = async () => {
    if (postType === "concert" && !artist) {
      setArtistError("Please choose an existing artist from the list.");
      return alert("Please select artist");
    }
    if (postType === "experience" && !experience) return alert("Please select an experience type");
    if (!countryCode) return alert("Please select country");
    if (!city.trim()) return alert("Please type city");
    if (!dateStr) return alert("Please select date");
    if (imageFiles.length < 1 && videoFiles.length < 1) return alert("Please add photos and/or videos");

    setSubmitting(true);
    setDone(null);

    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const userId = authData?.user?.id;
      if (!userId) throw new Error("Not authenticated");

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

      let coverUrlToSave: string | null = null;

      // Fotos -> concert_media + cover
      if (imageFiles.length) {
        const uploads: string[] = [];
        for (const file of imageFiles) {
          const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
          const baseName = file.name
            .replace(/[^\w.\-]+/g, "_")
            .replace(/\.[a-z0-9]{2,6}$/i, "");
          const path = `${concertId}/${Date.now()}_${Math.random().toString(36).slice(2)}_${baseName}.${ext}`;
          const { path: storedPath } = await uploadDirect("concert_media", path, file);
          uploads.push(getPublicUrl("concert_media", storedPath));
        }

        coverUrlToSave = uploads[Math.min(selectedCoverIdx, uploads.length - 1)] || uploads[0];

        const { error: mediaErr } = await supabase.from("concert_media").insert(
          uploads.map((url) => ({
            concert_id: concertId,
            url,
            media_type: "image",
          }))
        );
        if (mediaErr) throw new Error(`No se pudieron guardar las imágenes: ${mediaErr.message}`);

        const { data: coverRow } = await supabase
          .from("concert_media")
          .select("id, url")
          .eq("concert_id", concertId)
          .eq("url", coverUrlToSave)
          .maybeSingle();

        await supabase
          .from("concerts")
          .update({
            cover_url: coverUrlToSave,
            cover_media_id: coverRow?.id || null,
          })
          .eq("id", concertId);
      }

      // Vídeos -> clips + concert_media (para viewer)
      if (videoFiles.length) {
        for (const vf of videoFiles) {
          const ext = (vf.name.split(".").pop() || "mp4").toLowerCase();
          const base = `user_${userId}/${concertId}`;
          const videoPath = `${base}/video_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          const { path: storedPath } = await uploadDirect("clips", videoPath, vf);
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
              duration_seconds: null,
              kind: postType,
              experience: postType === "experience" ? experience : null,
            },
          ]);
          if (clipsErr) throw new Error(`No se pudo registrar el vídeo en clips: ${clipsErr.message}`);

          await supabase
            .from("concert_media")
            .upsert(
              {
                concert_id: concertId,
                url: video_url,
                media_type: "video",
              } as any,
              { onConflict: "concert_id,url" }
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
      setSelectedCoverIdx(0);
      setShowCoverPicker(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      alert(e?.message ?? "Error");
    } finally {
      setSubmitting(false);
    }
  };

  /* ==========================================
     MUSICAL COLLECTION
     - 1 photo + record
     ========================================== */
  const [collectionRecordQ, setCollectionRecordQ] = useState("");
  const [collectionSearching, setCollectionSearching] = useState(false);
  const [collectionResults, setCollectionResults] = useState<RecordSearchRow[]>([]);
  const [selectedCollectionRecord, setSelectedCollectionRecord] = useState<RecordSearchRow | null>(null);
  const collectionDebouncer = useRef<TimeoutId | null>(null);

  const [collectionPhoto, setCollectionPhoto] = useState<File | null>(null);
  const collectionPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [postingCollection, setPostingCollection] = useState(false);

  useEffect(() => {
    const term = collectionRecordQ.trim();
    if (topTab !== "collection") return;
    if (!term || term.length < 2) {
      setCollectionResults([]);
      setCollectionSearching(false);
      return;
    }
    setCollectionSearching(true);
    if (collectionDebouncer.current) clearTimeout(collectionDebouncer.current);

    collectionDebouncer.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from("records")
          .select("id, title, artist_name, release_year, vibe_color, cover_color")
          .or(`title.ilike.%${term}%,artist_name.ilike.%${term}%`)
          .order("release_year", { ascending: false })
          .limit(25);

        if (!error) setCollectionResults((data as RecordSearchRow[]) || []);
      } finally {
        setCollectionSearching(false);
      }
    }, 220);
  }, [collectionRecordQ, topTab]);

  const canPublishCollection = !!meId && !!selectedCollectionRecord && !!collectionPhoto && !postingCollection;

  const onSubmitCollection = async () => {
    if (!meId) return alert("Sign in to continue.");
    if (!selectedCollectionRecord) return alert("Please choose a record.");
    if (!collectionPhoto) return alert("Please add a photo.");

    setPostingCollection(true);
    try {
      const ext = (collectionPhoto.name.split(".").pop() || "jpg").toLowerCase();
      const baseName = collectionPhoto.name
        .replace(/[^\w.\-]+/g, "_")
        .replace(/\.[a-z0-9]{2,6}$/i, "");
      const path = `user_${meId}/${Date.now()}_${Math.random().toString(36).slice(2)}_${baseName}.${ext}`;

      const { path: storedPath } = await uploadDirect("collection_media", path, collectionPhoto);
      const photo_url = getPublicUrl("collection_media", storedPath);

      const { error } = await supabase.from("music_collections").insert({
        user_id: meId,
        record_id: selectedCollectionRecord.id,
        photo_url,
        caption: null,
      });

      if (error) throw error;

      alert("Saved to your collection.");
      setSelectedCollectionRecord(null);
      setCollectionRecordQ("");
      setCollectionResults([]);
      setCollectionPhoto(null);
      if (collectionPhotoInputRef.current) collectionPhotoInputRef.current.value = "";
    } catch (e: any) {
      alert(e?.message ?? "Error");
    } finally {
      setPostingCollection(false);
    }
  };

  /* ==========================================
     MUSICAL OPINION
     - siempre intuitivo: eliges record -> escribes -> rating -> Publish
     - muestra profile picture real
     ========================================== */
  const [recordQ, setRecordQ] = useState("");
  const [recordSearching, setRecordSearching] = useState(false);
  const [recordResults, setRecordResults] = useState<RecordRow[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<RecordRow | null>(null);
  const recordDebouncer = useRef<TimeoutId | null>(null);

  const [takeBody, setTakeBody] = useState("");
  const [postingTake, setPostingTake] = useState(false);
  const [takeRate, setTakeRate] = useState<number | null>(null);

  useEffect(() => {
    const term = recordQ.trim();
    if (topTab !== "opinion") return;

    if (!term || term.length < 2) {
      setRecordResults([]);
      setRecordSearching(false);
      return;
    }
    setRecordSearching(true);
    if (recordDebouncer.current) clearTimeout(recordDebouncer.current);
    recordDebouncer.current = setTimeout(async () => {
      try {
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
  }, [recordQ, topTab]);

  const canPublishTake =
    !!meId && !!selectedRecord && takeBody.trim().length > 0 && takeRate != null && !postingTake;

  const submitTake = async () => {
    if (!meId) return alert("Sign in to continue.");
    if (!selectedRecord) return alert("Please choose a record.");
    const clean = takeBody.trim();
    if (!clean) return;

    if (takeRate == null) {
      alert("Please select a rating (1–10).");
      return;
    }

    setPostingTake(true);
    try {
      const { data: ratingRow, error: ratingErr } = await supabase
        .from("ratings")
        .upsert({ user_id: meId, record_id: selectedRecord.id, rate: takeRate }, { onConflict: "user_id,record_id" })
        .select("id")
        .single();

      if (ratingErr || !ratingRow) throw new Error("Error saving the rating.");

      const { error } = await supabase.from("recommendations").insert({
        user_id: meId,
        target_type: "record",
        target_id: selectedRecord.id,
        body: clean,
        rating_id: ratingRow.id,
      });

      if (error) throw error;

      setTakeBody("");
      setSelectedRecord(null);
      setRecordQ("");
      setRecordResults([]);
      setTakeRate(null);
      alert("Published.");
    } catch (e: any) {
      alert(e?.message ?? "Error");
    } finally {
      setPostingTake(false);
    }
  };

  /* ==========================================
     Descriptions (sin guiones)
     ========================================== */
  const tabTitle = useMemo(() => {
    if (topTab === "memories") return "Memories";
    if (topTab === "collection") return "Collection";
    return "Opinion";
  }, [topTab]);

  const tabDescription = useMemo(() => {
    if (topTab === "memories") {
      return "Share your concert memories with photos and videos so you can keep them forever.";
    }
    if (topTab === "collection") {
      return "Share your physical record collection with a photo of the record you own. It is a way to remember the chapters of your life through the music you lived with.";
    }
    return "Share what stayed with you and how the record made you feel. Keep it thoughtful and always invite a positive conversation around music.";
  }, [topTab]);

  /* ==========================================
     Publish button (1 solo botón, QUIETO dentro del layout)
     - NO fixed (no se mueve contigo al hacer scroll)
     ========================================== */
  const renderPublishButton = () => {
    const disabled =
      topTab === "memories"
        ? !canPublishMemories
        : topTab === "collection"
          ? !canPublishCollection
          : !canPublishTake;

    const onClick =
      topTab === "memories" ? onSubmitMemories : topTab === "collection" ? onSubmitCollection : submitTake;

    const label =
      topTab === "memories"
        ? submitting
          ? "Publishing…"
          : "Publish"
        : topTab === "collection"
          ? postingCollection
            ? "Publishing…"
            : "Publish"
          : postingTake
            ? "Publishing…"
            : "Publish";

    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className="rounded-full bg-[#1F48AF] px-6 h-11 text-xs text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition hover:shadow disabled:opacity-40"
        style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-white">
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

            {/* Tabs */}
            <div className="mt-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setTopTab("memories")}
                  className={`flex-1 px-3 py-2 rounded-full text-[12px] border ${
                    topTab === "memories"
                      ? "bg-[#1F48AF] text-white border-[#1F48AF]"
                      : "bg-white text-black border-neutral-200"
                  }`}
                  style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                >
                  Memories
                </button>

                <button
                  type="button"
                  onClick={() => setTopTab("collection")}
                  className={`flex-1 px-3 py-2 rounded-full text-[12px] border ${
                    topTab === "collection"
                      ? "bg-[#1F48AF] text-white border-[#1F48AF]"
                      : "bg-white text-black border-neutral-200"
                  }`}
                  style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                >
                  Collection
                </button>

                <button
                  type="button"
                  onClick={() => setTopTab("opinion")}
                  className={`flex-1 px-3 py-2 rounded-full text-[12px] border ${
                    topTab === "opinion"
                      ? "bg-[#1F48AF] text-white border-[#1F48AF]"
                      : "bg-white text-black border-neutral-200"
                  }`}
                  style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                >
                  Opinion
                </button>
              </div>
            </div>

            {/* Description */}
            <div className="mt-4">
              <div
                className="text-[14px] text-neutral-800"
                style={{ fontFamily: '"Times New Roman", Times, serif', fontWeight: 400 }}
              >
                {tabTitle}
              </div>
              <p
                className="mt-1 text-xs text-neutral-600"
                style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
              >
                {tabDescription}
              </p>

              {/* Publish button QUIETO (no fixed) */}
              <div className="mt-4 flex justify-end">{renderPublishButton()}</div>
            </div>
          </div>

          {/* ===================== MEMORIES ===================== */}
          {topTab === "memories" ? (
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-7 px-5 sm:px-6 pb-6 sm:pb-7 mt-5">
              {/* Left */}
              <div>
                {/* Artist */}
                {artist ? (
                  <div className="mb-5 sm:mb-6 flex items-center justify-between rounded-2xl border border-neutral-200 bg-white/80 backdrop-blur px-4 py-3 shadow-sm">
                    <div className="leading-tight">
                      <div style={{ fontFamily: '"Times New Roman", Times, serif' }}>{artist.name}</div>
                      <div
                        className="text-sm text-neutral-500"
                        style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
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
                      style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="mb-5 sm:mb-6">
                    <label
                      className="block text-xs uppercase tracking-widest text-neutral-600"
                      style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
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
                          if (isPickingOptionRef.current) return;
                          if (!artist && artistQ.trim()) {
                            setArtistQ("");
                            setArtistError("Please choose an existing artist from the list.");
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
                              setArtistError("No artists found. Only existing artists can be selected.");
                            }
                          }
                        }}
                        placeholder="Search artist name…"
                        className="w-full rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 outline-none focus:ring-2 focus:ring-[#1F48AF] shadow-sm italic"
                        style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                      />

                      {(artistSearching || artistResults.length > 0) && (
                        <div
                          className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white/95 shadow-xl max-h-[320px] overflow-y-auto"
                          onMouseDown={() => {
                            isPickingOptionRef.current = true;
                          }}
                          onMouseUp={() => {
                            setTimeout(() => {
                              isPickingOptionRef.current = false;
                            }, 0);
                          }}
                        >
                          {artistSearching && (
                            <div
                              className="px-4 py-3 text-sm text-neutral-500"
                              style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
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
                                  <div className="truncate" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                    {r.name}
                                  </div>
                                </div>
                              </button>
                            ))}
                        </div>
                      )}

                      {artistError && (
                        <p
                          className="mt-2 text-xs text-red-600"
                          style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                        >
                          {artistError}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Country */}
                <div className="mb-5 sm:mb-6">
                  <label
                    className="block text-xs uppercase tracking-widest text-neutral-600"
                    style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                  >
                    Country
                  </label>
                  <div className="mt-2 relative">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 pr-10 shadow-sm outline-none focus:ring-2 focus:ring-[#1F48AF]"
                      style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
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
                    style={{ fontFamily: "Roboto, Arial", fontWeight: 300 }}
                  >
                    City
                  </label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Type your city…"
                    className="mt-2 w-full rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 outline-none focus:ring-2 focus:ring-[#1F48AF] shadow-sm"
                    style={{ fontFamily: "Roboto, Arial", fontWeight: 300 }}
                  />
                </div>

                {/* Date */}
                <div className="mb-5 sm:mb-6">
                  <label
                    className="block text-xs uppercase tracking-widest text-neutral-600"
                    style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                  >
                    Date
                  </label>
                  <input
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 outline-none focus:ring-2 focus:ring-[#1F48AF] shadow-sm"
                    style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                  />
                </div>

                {/* Event name */}
                <div className="mb-5 sm:mb-6">
                  <label
                    className="block text-xs uppercase tracking-widest text-neutral-600"
                    style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                  >
                    Name of the event
                  </label>
                  <input
                    value={tourName}
                    onChange={(e) => setTourName(e.target.value)}
                    placeholder="Tour name…"
                    className="mt-2 w-full rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 outline-none focus:ring-2 focus:ring-[#1F48AF] shadow-sm"
                    style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                  />
                </div>

                {/* caption hidden */}
                <div className="hidden">
                  <textarea value={caption} onChange={(e) => setCaption(e.target.value)} />
                </div>
              </div>

              {/* Right */}
              <div>
                <label
                  className="block text-xs uppercase tracking-widest text-neutral-600"
                  style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                >
                  Photos and videos
                </label>

                <div
                  onDrop={async (ev) => {
                    ev.preventDefault();
                    await addIncomingFiles(ev.dataTransfer?.files ?? null);
                  }}
                  onDragOver={(ev) => ev.preventDefault()}
                  className="mt-2 rounded-2xl border border-dashed p-4 sm:p-5 bg-white/70 backdrop-blur transition border-neutral-300"
                >
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
                      onClick={() => imagesInputRef.current?.click()}
                      className="text-sm rounded-xl bg-[#1F48AF] px-4 py-2 text-white shadow-sm transition hover:shadow"
                      style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                    >
                      Add photos
                    </button>

                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/*"
                      multiple
                      onChange={(e) => onPickVideo(e.target.files)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      className="text-sm rounded-xl bg-black px-4 py-2 text-white shadow-sm transition hover:shadow"
                      style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                    >
                      Add videos
                    </button>

                    {!!files.length && (
                      <button
                        type="button"
                        onClick={() => {
                          setFiles([]);
                          resetInput(imagesInputRef);
                          resetInput(videoInputRef);
                          setSelectedCoverIdx(0);
                          setShowCoverPicker(false);
                        }}
                        className="text-sm text-[#1F48AF] hover:underline ml-auto"
                        style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {previews.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {previews.map((p, i) => (
                        <div key={i} className="relative group">
                          {p.kind === "image" ? (
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

                  {/* POSTCARD COVER (CLARO, visible si hay fotos) */}
                  {imageFiles.length > 0 && (
                    <div className="mt-4">
                      <div
                        className="text-[11px] uppercase tracking-[0.16em] text-neutral-600"
                        style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                      >
                        Postcard cover
                      </div>

                      {/* Bloque visual 2 cuadrados + Change */}
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="h-20 w-20 rounded-2xl overflow-hidden border border-neutral-200 bg-white">
                            {currentCoverThumb ? (
                              <img src={currentCoverThumb.url} alt="" className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <div className="relative w-20 h-20 rounded-2xl shadow-md border border-neutral-200 bg-white">
                            <div
                              className="absolute rounded-[10px] bg-neutral-900"
                              style={{ inset: "24%", opacity: 0.12 }}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowCoverPicker((s) => !s)}
                          className="text-[10px] rounded-full border border-[#1F48AF] text-[#1F48AF] px-4 py-1.5 leading-none tracking-[0.14em] uppercase bg-white hover:bg-[#1F48AF] hover:text-white transition"
                        >
                          Change
                        </button>
                      </div>

                      {/* Selector horizontal */}
                      {showCoverPicker && (
                        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                          {imageFiles.map((f, idx) => {
                            const url = URL.createObjectURL(f);
                            const active = idx === selectedCoverIdx;
                            return (
                              <button
                                key={`${f.name}-${idx}`}
                                type="button"
                                onClick={() => setSelectedCoverIdx(idx)}
                                className={`shrink-0 rounded-xl border overflow-hidden ${
                                  active ? "border-[#1F48AF]" : "border-neutral-200"
                                }`}
                                aria-pressed={active}
                              >
                                <img src={url} alt="" className="h-20 w-20 object-cover" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          {/* ===================== COLLECTION ===================== */}
          {topTab === "collection" ? (
            <section className="px-5 sm:px-6 pb-8 sm:pb-10 mt-5">
              <div className="max-w-[680px]">
                {selectedCollectionRecord ? (
                  <div className="mb-5 sm:mb-6 flex items-center justify-between rounded-2xl border border-neutral-200 bg-white/80 backdrop-blur px-4 py-3 shadow-sm">
                    <div className="leading-tight min-w-0">
                      <div className="truncate" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                        {selectedCollectionRecord.title}
                      </div>
                      <div
                        className="text-xs text-neutral-500"
                        style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                      >
                        {selectedCollectionRecord.artist_name || "—"}
                        {selectedCollectionRecord.release_year ? ` · ${selectedCollectionRecord.release_year}` : ""}
                      </div>
                    </div>

                    <div
                      className="relative w-10 h-10 rounded-lg shrink-0 border border-neutral-200 overflow-hidden"
                      style={{ backgroundColor: selectedCollectionRecord.vibe_color || "#F4F4F4" }}
                      title="Album aesthetic"
                    >
                      <div
                        className="absolute rounded-[5px]"
                        style={{
                          backgroundColor: selectedCollectionRecord.cover_color || "#000",
                          inset: "32%",
                          opacity: 0.95,
                        }}
                      />
                    </div>

                    <button
                      onClick={() => setSelectedCollectionRecord(null)}
                      className="text-sm text-[#1F48AF] hover:underline"
                      style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="mb-5 sm:mb-6">
                    <label
                      className="block text-xs uppercase tracking-widest text-neutral-600"
                      style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                    >
                      Record
                    </label>
                    <div className="mt-2 relative">
                      <input
                        value={collectionRecordQ}
                        onChange={(e) => setCollectionRecordQ(e.target.value)}
                        placeholder="Search title or artist…"
                        className="w-full rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 outline-none focus:ring-2 focus:ring-[#1F48AF] shadow-sm"
                        style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                      />

                      {(collectionSearching || collectionResults.length > 0) && (
                        <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white/95 shadow-xl max-h-[360px] overflow-y-auto">
                          {collectionSearching && (
                            <div
                              className="px-4 py-3 text-sm text-neutral-500"
                              style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                            >
                              Searching…
                            </div>
                          )}
                          {!collectionSearching &&
                            collectionResults.map((r) => (
                              <button
                                key={r.id}
                                onClick={() => {
                                  setSelectedCollectionRecord(r);
                                  setCollectionResults([]);
                                  setCollectionRecordQ("");
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-neutral-50 transition"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                      {r.title}
                                    </div>
                                    <div
                                      className="text-xs text-neutral-500"
                                      style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                                    >
                                      {r.artist_name || "—"}
                                      {r.release_year ? ` · ${r.release_year}` : ""}
                                    </div>
                                  </div>

                                  <div
                                    className="relative w-9 h-9 rounded-lg shrink-0 border border-neutral-200 overflow-hidden"
                                    style={{ backgroundColor: r.vibe_color || "#F4F4F4" }}
                                  >
                                    <div
                                      className="absolute rounded-[5px]"
                                      style={{
                                        backgroundColor: r.cover_color || "#000",
                                        inset: "32%",
                                        opacity: 0.95,
                                      }}
                                    />
                                  </div>
                                </div>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Photo */}
                <div className="mb-5">
                  <label
                    className="block text-xs uppercase tracking-widest text-neutral-600"
                    style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                  >
                    Photo (with your record)
                  </label>

                  <input
                    ref={collectionPhotoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCollectionPhoto(e.target.files?.[0] || null)}
                    className="hidden"
                  />

                  <div className="mt-2 rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => collectionPhotoInputRef.current?.click()}
                        className="text-sm rounded-xl bg-[#1F48AF] px-4 py-2 text-white shadow-sm transition hover:shadow"
                        style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                      >
                        {collectionPhoto ? "Change photo" : "Add photo"}
                      </button>

                      {collectionPhoto && (
                        <button
                          type="button"
                          onClick={() => {
                            setCollectionPhoto(null);
                            if (collectionPhotoInputRef.current) collectionPhotoInputRef.current.value = "";
                          }}
                          className="text-sm text-[#1F48AF] hover:underline"
                          style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {collectionPhoto && (
                      <div className="mt-3">
                        <img
                          src={URL.createObjectURL(collectionPhoto)}
                          alt=""
                          className="w-full max-h-[360px] rounded-2xl object-cover border border-neutral-200"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {/* ===================== OPINION ===================== */}
          {topTab === "opinion" ? (
            <section className="px-5 sm:px-6 pb-8 sm:pb-10 mt-5">
              <div className="max-w-[680px]">
                {/* Record picker */}
                {selectedRecord ? (
                  <div className="mb-5 sm:mb-6 flex items-center justify-between rounded-2xl border border-neutral-200 bg-white/80 backdrop-blur px-4 py-3 shadow-sm">
                    <div className="leading-tight min-w-0">
                      <div className="truncate" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                        {selectedRecord.title}
                      </div>
                      <div
                        className="text-xs text-neutral-500"
                        style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                      >
                        {selectedRecord.artist_name || "—"}
                        {selectedRecord.release_year ? ` · ${selectedRecord.release_year}` : ""}
                      </div>
                    </div>

                    <div
                      className="relative w-10 h-10 rounded-lg shrink-0 border border-neutral-200 overflow-hidden"
                      style={{ backgroundColor: selectedRecord.vibe_color || "#F4F4F4" }}
                      title="Album aesthetic"
                    >
                      <div
                        className="absolute rounded-[5px]"
                        style={{
                          backgroundColor: selectedRecord.cover_color || "#000",
                          inset: "32%",
                          opacity: 0.95,
                        }}
                      />
                    </div>

                    <button
                      onClick={() => {
                        setSelectedRecord(null);
                        setTakeRate(null);
                      }}
                      className="text-sm text-[#1F48AF] hover:underline"
                      style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="mb-5 sm:mb-6">
                    <label
                      className="block text-xs uppercase tracking-widest text-neutral-600"
                      style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                    >
                      Record
                    </label>
                    <div className="mt-2 relative">
                      <input
                        value={recordQ}
                        onChange={(e) => setRecordQ(e.target.value)}
                        placeholder="Search title or artist…"
                        className="w-full rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 outline-none focus:ring-2 focus:ring-[#1F48AF] shadow-sm"
                        style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                      />
                      {(recordSearching || recordResults.length > 0) && (
                        <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white/95 shadow-xl max-h-[360px] overflow-y-auto">
                          {recordSearching && (
                            <div
                              className="px-4 py-3 text-sm text-neutral-500"
                              style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
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
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                      {r.title}
                                    </div>
                                    <div
                                      className="text-xs text-neutral-500"
                                      style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                                    >
                                      {r.artist_name || "—"}
                                      {r.release_year ? ` · ${r.release_year}` : ""}
                                    </div>
                                  </div>

                                  <div
                                    className="relative w-9 h-9 rounded-lg shrink-0 border border-neutral-200 overflow-hidden"
                                    style={{ backgroundColor: r.vibe_color || "#F4F4F4" }}
                                  >
                                    <div
                                      className="absolute rounded-[5px]"
                                      style={{
                                        backgroundColor: r.cover_color || "#000",
                                        inset: "32%",
                                        opacity: 0.95,
                                      }}
                                    />
                                  </div>
                                </div>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Composer (sin open/close) */}
                <div className="rounded-3xl border border-neutral-200 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)] p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full overflow-hidden bg-neutral-200 shrink-0 border border-neutral-200">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={() => setAvatarUrl(null)}
                        />
                      ) : (
                        <div className="h-full w-full" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div
                        className="text-[13px] text-neutral-900 truncate"
                        style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                      >
                        {displayName ? displayName : "Write your opinion"}
                      </div>
                      <div
                        className="text-[11px] text-neutral-500"
                        style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                      >
                        For the fans, not critics.
                      </div>
                    </div>
                  </div>

                  <textarea
                    value={takeBody}
                    onChange={(e) => setTakeBody(e.target.value)}
                    placeholder={selectedRecord ? "Share what stayed with you…" : "Select a record to start writing."}
                    disabled={!selectedRecord}
                    className="mt-3 w-full min-h-[140px] border border-neutral-200 rounded-2xl px-3 py-3 text-[15px] leading-7 outline-none focus:ring-2 focus:ring-[#1F48AF]"
                    style={{ fontFamily: '"Times New Roman", Times, serif' }}
                  />

                  <div className="mt-3">
                    <div
                      className="text-[11px] text-neutral-600 mb-2"
                      style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 300 }}
                    >
                      Rating (required)
                    </div>
                    <div className="grid grid-cols-10 gap-1">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setTakeRate(n)}
                          disabled={!selectedRecord}
                          className={`h-9 rounded-full border text-sm transition ${
                            takeRate === n
                              ? "bg-[#1F48AF] text-white border-[#1F48AF]"
                              : "border-neutral-300 hover:bg-neutral-50"
                          } ${!selectedRecord ? "opacity-50 cursor-not-allowed" : ""}`}
                          aria-pressed={takeRate === n}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}

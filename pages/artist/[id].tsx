"use client";

import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import PostCard from "../../components/PostCard";

const IDOL_POSTS_BUCKET = "idol-posts";

/* =========================
   Tipos mínimos
   ========================= */
type RecordRow = {
  id: string;
  title: string | null;
  release_year: number | null;
  vibe_color: string | null;
  cover_color: string | null;
};

type ArtistRow = {
  id: string;
  name: string | null;
  description: string | null;
  records: RecordRow[];
};

/* ===== Concerts (mismo estilo que The Idol) ===== */
type ConcertMemory = {
  id: string;
  title: string;
  city: string;
  countryCode: string;
  year: number;
  userName: string;
  createdAt: string;
  imageUrls: string[];
  artist_id?: string | null;
  country_code?: string | null;
  event_date?: string | null;
  cover_url?: string | null;
  artist_name?: string | null;
  country_name?: string | null;
};

/* ===== Moments (idol_posts) ===== */
type IdolMoment = {
  id: string;
  userId: string | null;
  userName: string;
  userHandle: string;
  body: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  mediaUrls: string[];
  avatarUrl: string | null;
};

type Hashtag = {
  tag: string;
  count: number;
};

type ProfileMini = {
  avatar_url: string | null;
};

/* =========================
   Utils
   ========================= */
const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

const extractHashtags = (text: string): string[] => {
  const regex = /#([A-Za-z0-9_]+)/g;
  const tags: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    tags.push(match[1]);
  }
  return tags;
};

const normalizeTag = (raw: string) => raw.replace(/^#/, "").trim().toLowerCase();

/* =========================
   Página
   ========================= */
export default function ArtistProfile() {
  const router = useRouter();
  const { id } = router.query;

  const supabase = useSupabaseClient();
  const user = useUser();

  const [artist, setArtist] = useState<ArtistRow | null>(null);
  const [loadingArtist, setLoadingArtist] = useState(true);

  const [concerts, setConcerts] = useState<ConcertMemory[]>([]);
  const [loadingConcerts, setLoadingConcerts] = useState(true);

  const [moments, setMoments] = useState<IdolMoment[]>([]);
  const [loadingMoments, setLoadingMoments] = useState(true);
  const [likedMoments, setLikedMoments] = useState<Set<string>>(new Set());

  const [activeTab, setActiveTab] = useState<"moments" | "tour">("moments");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const [newMomentBody, setNewMomentBody] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const [currentProfile, setCurrentProfile] = useState<ProfileMini>({
    avatar_url: null,
  });

  // solo texto + hashtag topic opcional
  const [hashtagTopic, setHashtagTopic] = useState("");

  /* ===== Cargar artista + discos ===== */
  useEffect(() => {
    if (!router.isReady || !id) return;

    (async () => {
      setLoadingArtist(true);
      const { data } = await supabase
        .from("artists")
        .select("*, records(id,title,release_year,vibe_color,cover_color)")
        .eq("id", id)
        .single();

      if (data) {
        (data as any).records =
          (data as any).records?.sort(
            (a: RecordRow, b: RecordRow) =>
              (b.release_year ?? 0) - (a.release_year ?? 0)
          ) || [];
        setArtist(data as unknown as ArtistRow);
      }
      setLoadingArtist(false);
    })();
  }, [router.isReady, id, supabase]);

  /* ===== Cargar perfil para avatar ===== */
  useEffect(() => {
    if (!user) {
      setCurrentProfile({ avatar_url: null });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      setCurrentProfile({
        avatar_url: data?.avatar_url ?? null,
      });
    })();
  }, [user, supabase]);

  /* ===== Cargar concerts del artista (estilo PostCard global) ===== */
  useEffect(() => {
    if (!id) return;

    (async () => {
      setLoadingConcerts(true);

      const { data: concertsData, error } = await supabase
        .from("concerts")
        .select(
          "id, city, country_code, event_date, tour_name, artist_id, created_at"
        )
        .eq("artist_id", id as string)
        .order("event_date", { ascending: false });

      let concertsMapped: ConcertMemory[] = [];

      if (!error && concertsData && concertsData.length > 0) {
        const concertIds = concertsData.map((c: any) => c.id as string);

        let mediaMap = new Map<string, string[]>();

        if (concertIds.length > 0) {
          const { data: mediaData } = await supabase
            .from("concert_media")
            .select("concert_id, url, created_at")
            .in("concert_id", concertIds)
            .order("created_at", { ascending: true });

          if (mediaData) {
            mediaMap = new Map<string, string[]>();
            mediaData.forEach((m: any) => {
              const key = m.concert_id as string;
              const arr = mediaMap.get(key) ?? [];
              if (m.url) arr.push(m.url as string);
              mediaMap.set(key, arr);
            });
          }
        }

        const artistName = (artist?.name as string | null) ?? null;

        concertsMapped = concertsData.map((c: any) => {
          const imgs = mediaMap.get(c.id as string) ?? [];
          const mainImg = imgs[0] ?? null;

          return {
            id: c.id as string,
            title: (c.tour_name as string) ?? "",
            city: (c.city as string) ?? "",
            countryCode: (c.country_code as string) ?? "",
            year: c.event_date
              ? new Date(c.event_date).getFullYear()
              : new Date().getFullYear(),
            userName: "",
            createdAt: c.created_at
              ? new Date(c.created_at).toISOString()
              : "",
            imageUrls: imgs,
            artist_id: (c.artist_id as string) ?? null,
            country_code: (c.country_code as string) ?? null,
            event_date: (c.event_date as string) ?? null,
            cover_url: mainImg,
            artist_name: artistName,
            country_name:
              c.city && c.country_code
                ? `${c.city}, ${c.country_code}`
                : null,
          } as ConcertMemory;
        });
      }

      setConcerts(concertsMapped);
      setLoadingConcerts(false);
    })();
  }, [id, supabase, artist?.name]);

  /* ===== Cargar Moments (idol_posts + media solo FOTOS + likes del user) ===== */
  useEffect(() => {
    if (!id) return;

    (async () => {
      setLoadingMoments(true);

      const { data: postsData, error: postsError } = await supabase
        .from("idol_posts")
        .select(
          "id, user_id, user_name, user_handle, body, likes_count, comments_count, created_at"
        )
        .eq("artist_id", id as string)
        .order("created_at", { ascending: false })
        .limit(80);

      if (postsError || !postsData) {
        setMoments([]);
        setLikedMoments(new Set());
        setLoadingMoments(false);
        return;
      }

      const postIds = postsData.map((p: any) => p.id as string);

      let mediaMap = new Map<string, string[]>();

      if (postIds.length > 0) {
        const { data: mediaData } = await supabase
          .from("idol_post_media")
          .select("post_id, url, media_type, position, created_at")
          .in("post_id", postIds)
          .eq("media_type", "image")
          .order("position", { ascending: true });

        if (mediaData) {
          mediaData.forEach((m: any) => {
            const key = m.post_id as string;
            const arr = mediaMap.get(key) ?? [];
            if (m.url) arr.push(m.url as string);
            mediaMap.set(key, arr);
          });
        }
      }

      // Avatares de usuarios que han posteado
      const userIds = Array.from(
        new Set(
          postsData
            .map((p: any) => p.user_id as string | null)
            .filter((u): u is string => Boolean(u))
        )
      );

      let avatarMap = new Map<string, string | null>();
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, avatar_url")
          .in("id", userIds);

        if (profileData) {
          profileData.forEach((p: any) => {
            avatarMap.set(p.id as string, (p.avatar_url as string) ?? null);
          });
        }
      }

      let likedSet = new Set<string>();
      if (user?.id && postIds.length > 0) {
        const { data: likedRows } = await supabase
          .from("idol_post_likes")
          .select("post_id")
          .eq("user_id", user.id)
          .in("post_id", postIds);

        if (likedRows) {
          likedRows.forEach((r: any) => likedSet.add(r.post_id as string));
        }
      }

      const mapped: IdolMoment[] = postsData.map((p: any) => ({
        id: p.id as string,
        userId: (p.user_id as string) ?? null,
        userName: (p.user_name as string) ?? "",
        userHandle: (p.user_handle as string) ?? "",
        body: (p.body as string) ?? "",
        likesCount: (p.likes_count as number) ?? 0,
        commentsCount: (p.comments_count as number) ?? 0,
        createdAt: fmtDate(p.created_at),
        mediaUrls: mediaMap.get(p.id as string) ?? [],
        avatarUrl: p.user_id ? avatarMap.get(p.user_id as string) ?? null : null,
      }));

      setMoments(mapped);
      setLikedMoments(likedSet);
      setLoadingMoments(false);
    })();
  }, [id, supabase, user?.id]);

  /* ===== Trending hashtags calculados en cliente ===== */
  const trendingTags: Hashtag[] = useMemo(() => {
    const counts: Record<string, number> = {};
    moments.forEach((m) => {
      const tags = extractHashtags(m.body);
      tags.forEach((t) => {
        const key = t.toLowerCase();
        counts[key] = (counts[key] ?? 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));
  }, [moments]);

  /* ===== Moments filtrados por hashtag activo ===== */
  const filteredMoments = useMemo(() => {
    if (!activeTag) return moments;
    return moments.filter((m) =>
      extractHashtags(m.body).some(
        (t) => t.toLowerCase() === activeTag.toLowerCase()
      )
    );
  }, [moments, activeTag]);

  /* ===== Sugerencias en el input de hashtag (a partir de trending) ===== */
  const hashtagSuggestions = useMemo(() => {
    if (!hashtagTopic) return [];
    const draft = normalizeTag(hashtagTopic);
    if (!draft) return [];
    return trendingTags.filter((t) =>
      t.tag.toLowerCase().startsWith(draft)
    );
  }, [trendingTags, hashtagTopic]);

  /* ===== Estilos editoriales ===== */
  const headingStyle = useMemo(
    () => ({
      fontFamily: "Times New Roman, serif",
      fontWeight: 400,
      letterSpacing: "0.3px",
    }),
    []
  );
  const bodyStyle = useMemo(
    () => ({ fontFamily: "Roboto, system-ui, sans-serif", opacity: 0.9 }),
    []
  );

  /* ===== Crear Moment ===== */
  const handleCreateMoment = async () => {
    if (!user || !id || !newMomentBody.trim() || isPosting) return;

    const cleanedTopic = normalizeTag(hashtagTopic);

    setIsPosting(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      const displayName =
        profile?.full_name || profile?.username || "walcord user";
      const handle = profile?.username
        ? `@${profile.username}`
        : "@walcord user";

      let finalBody = newMomentBody.trim();

      // hashtag opcional: si hay topic, lo añadimos
      if (cleanedTopic) {
        const hash = `#${cleanedTopic}`;
        if (!finalBody.toLowerCase().includes(hash.toLowerCase())) {
          finalBody = `${finalBody} ${hash}`.trim();
        }
      }

      const payload = {
        user_id: user.id,
        artist_id: id as string,
        user_name: displayName,
        user_handle: handle,
        body: finalBody,
        likes_count: 0,
        comments_count: 0,
      };

      const { data, error } = await supabase
        .from("idol_posts")
        .insert([payload])
        .select(
          "id, user_id, user_name, user_handle, body, likes_count, comments_count, created_at"
        )
        .single();

      if (error || !data) {
        console.error("Error creating moment", error);
        setIsPosting(false);
        return;
      }

      // sin subida de fotos: solo texto
      const uploadedUrls: string[] = [];

      const newMoment: IdolMoment = {
        id: data.id as string,
        userId: (data.user_id as string) ?? null,
        userName: (data.user_name as string) ?? displayName,
        userHandle: (data.user_handle as string) ?? handle,
        body: (data.body as string) ?? finalBody,
        likesCount: (data.likes_count as number) ?? 0,
        commentsCount: (data.comments_count as number) ?? 0,
        createdAt: fmtDate(data.created_at),
        mediaUrls: uploadedUrls,
        avatarUrl: profile?.avatar_url ?? currentProfile.avatar_url ?? null,
      };

      setMoments((prev) => [newMoment, ...prev]);
      setNewMomentBody("");
      setHashtagTopic("");
      setIsComposerOpen(false);
    } finally {
      setIsPosting(false);
    }
  };

  /* ===== Like / Unlike Moment (lógica guardada, aunque no se muestre nada) ===== */
  const handleToggleLike = async (momentId: string) => {
    if (!user) return;

    const alreadyLiked = likedMoments.has(momentId);
    const nextSet = new Set(likedMoments);

    if (alreadyLiked) {
      nextSet.delete(momentId);
      setLikedMoments(nextSet);
      setMoments((prev) =>
        prev.map((m) =>
          m.id === momentId
            ? { ...m, likesCount: Math.max(0, m.likesCount - 1) }
            : m
        )
      );
      await supabase
        .from("idol_post_likes")
        .delete()
        .eq("user_id", user.id)
        .eq("post_id", momentId);
      await supabase
        .rpc("decrement_idol_post_likes", { post_id_input: momentId })
        .catch(() => {});
    } else {
      nextSet.add(momentId);
      setLikedMoments(nextSet);
      setMoments((prev) =>
        prev.map((m) =>
          m.id === momentId ? { ...m, likesCount: m.likesCount + 1 } : m
        )
      );
      await supabase
        .from("idol_post_likes")
        .insert([{ user_id: user.id, post_id: momentId }]);
      await supabase
        .rpc("increment_idol_post_likes", { post_id_input: momentId })
        .catch(() => {});
    }
  };

  const handleOpenComposer = () => {
    setIsComposerOpen((prev) => !prev);
  };

  const isPostDisabled = !newMomentBody.trim() || isPosting;

  return (
    <main className="min-h-screen bg-white text-black">
      {/* TOP — back button */}
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

      <div className="mx-auto w-full max-w-[1040px] px-4 sm:px-6 pt-2 pb-[calc(env(safe-area-inset-bottom)+6.5rem)]">
        {/* CABECERA ARTISTA */}
        <section className="mx-auto w-full max-w-[720px]">
          <h1
            className="text-[clamp(1.7rem,3.1vw,2.4rem)] mb-6 md:mb-8 tracking-tight"
            style={headingStyle}
          >
            {loadingArtist ? " " : artist?.name ?? "—"}
          </h1>
        </section>

        {/* DESCRIPCIÓN + RECORDS */}
        {loadingArtist ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12 mx-auto w-full max-w-[1040px]">
            <div className="col-span-1 max-w-xl">
              <div className="h-16 bg-neutral-200 rounded-2xl mb-4" />
              <div className="h-2.5 w-3/4 bg-neutral-200 rounded mb-2" />
              <div className="h-2.5 w-2/3 bg-neutral-200 rounded mb-2" />
              <div className="h-2.5 w-1/2 bg-neutral-200 rounded" />
            </div>
            <div className="col-span-2">
              <div className="h-3 w-28 bg-neutral-200 rounded mb-3" />
              <div className="flex gap-3.5 md:gap-4 overflow-x-auto pb-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-[110px] md:w-[120px] aspect-square rounded-2xl bg-neutral-200"
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12 mx-auto w-full max-w-[1040px]">
            {/* COLUMNA IZQUIERDA — descripción editorial */}
            <div className="col-span-1 max-w-xl">
              <p
                className="text-[14px] md:text-[15px] leading-7 md:leading-8 font-light"
                style={bodyStyle}
              >
                {artist?.description}
              </p>
            </div>

            {/* COLUMNA DERECHA — Records en fila deslizable */}
            <div className="col-span-2">
              <h2
                className="text-[17px] md:text-[19px] mb-3 md:mb-4"
                style={headingStyle}
              >
                Records
              </h2>

              {artist?.records?.length ? (
                <div className="-mx-1 overflow-x-auto pb-2">
                  <div className="flex flex-nowrap gap-3.5 md:gap-4 px-1">
                    {artist.records.map((record) => (
                      <Link
                        key={record.id}
                        href={`/record/${record.id}`}
                        className="inline-flex w-[110px] md:w-[120px] flex-col items-start group shrink-0"
                        aria-label={`Open ${record.title ?? ""}`}
                      >
                        <div className="relative w-full pt-[100%] rounded-2xl shadow-sm overflow-hidden transition-transform group-hover:scale-[1.02]">
                          <div
                            className="absolute inset-0 rounded-2xl"
                            style={{
                              backgroundColor: record.vibe_color || "#f2f2f2",
                            }}
                          />
                          <div
                            className="absolute inset-[26%] rounded-md"
                            style={{
                              backgroundColor:
                                record.cover_color || "#d9d9d9",
                            }}
                          />
                        </div>
                        <p
                          className="mt-1.5 text-[12.5px] md:text-[13.5px] font-light line-clamp-2"
                          style={{ fontFamily: "Roboto" }}
                        >
                          {record.title}
                        </p>
                        <p
                          className="text-[11.5px] text-gray-500 font-light"
                          style={{ fontFamily: "Roboto" }}
                        >
                          {record.release_year ?? ""}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* NAV MOMENTS / TOUR */}
        <section className="mt-10 md:mt-12 mx-auto w-full max-w-[720px]">
          <div className="flex gap-6 text-sm">
            {(["moments", "tour"] as const).map((tab) => {
              const label = tab === "moments" ? "Moments" : "Tour";
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className="relative pb-1 text-left"
                >
                  <span
                    className={`text-[1.15rem] ${
                      isActive ? "text-neutral-900" : "text-neutral-400"
                    }`}
                    style={{ fontFamily: "Times New Roman, serif" }}
                  >
                    {label}
                  </span>
                  {isActive && (
                    <span className="absolute inset-x-0 -bottom-0.5 h-[1px] bg-neutral-900" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* CONTENIDO TABS */}
        <section className="mt-6">
          {activeTab === "moments" && (
            <div className="mx-auto w-full max-w-[720px] space-y-6 pb-16 relative">
              {/* Trending (chips arriba) */}
              {trendingTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {trendingTags.map((t) => {
                    const isTagActive =
                      activeTag &&
                      activeTag.toLowerCase() === t.tag.toLowerCase();
                    return (
                      <button
                        key={t.tag}
                        type="button"
                        onClick={() =>
                          setActiveTag((prev) =>
                            prev &&
                            prev.toLowerCase() === t.tag.toLowerCase()
                              ? null
                              : t.tag
                          )
                        }
                        className={`rounded-full px-3 py-1 text-[11px] font-light transition border ${
                          isTagActive
                            ? "border-[#1F48AF] bg-[#1F48AF] text-white"
                            : "border-neutral-200 text-neutral-700 hover:border-neutral-400"
                        }`}
                      >
                        #{t.tag}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Composer (abre/cierra con botón +) */}
              {isComposerOpen && (
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-9 w-9 rounded-full overflow-hidden bg-neutral-200">
                    {currentProfile.avatar_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={currentProfile.avatar_url}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 rounded-3xl border border-neutral-200 bg-white shadow-[0_12px_30px_rgba(0,0,0,0.06)] px-4 py-3">
                    <textarea
                      value={newMomentBody}
                      onChange={(e) => setNewMomentBody(e.target.value)}
                      placeholder="Share a thought about this artist..."
                      className="w-full min-h-[70px] resize-none border-none bg-transparent text-sm outline-none"
                    />

                    <div className="mt-3 space-y-2">
                      {/* Fila Post + topic hashtag */}
                      <div className="flex items-center justify-between gap-3">
                        <input
                          value={hashtagTopic}
                          onChange={(e) => setHashtagTopic(e.target.value)}
                          placeholder="Hashtag topic (metgala, grammys, ag8)..."
                          className="flex-1 rounded-full border border-neutral-200 px-3 py-1.5 text-[11px] outline-none focus:border-neutral-500"
                        />

                        <button
                          type="button"
                          disabled={isPostDisabled}
                          onClick={handleCreateMoment}
                          className="rounded-full px-5 h-8 text-xs text-white enabled:hover:opacity-90 disabled:opacity-40 transition"
                          style={{ backgroundColor: "#1F48AF" }}
                        >
                          Post
                        </button>
                      </div>

                      {/* Sugerencias desde trending */}
                      {hashtagTopic && hashtagSuggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {hashtagSuggestions.map((t) => (
                            <button
                              key={t.tag}
                              type="button"
                              onClick={() => setHashtagTopic(t.tag)}
                              className="rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] text-neutral-700 hover:border-neutral-400"
                            >
                              #{t.tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Feed Moments */}
              {loadingMoments ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-32 bg-neutral-100 rounded-3xl" />
                  ))}
                </div>
              ) : filteredMoments.length === 0 ? (
                <div className="text-center text-neutral-500 text-sm py-10">
                  No moments yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredMoments.map((m) => (
                    <MomentCard
                      key={m.id}
                      moment={m}
                      isLiked={likedMoments.has(m.id)}
                      onToggleLike={() => handleToggleLike(m.id)}
                    />
                  ))}
                </div>
              )}

              {/* Botón flotante pequeño dentro de Moments */}
              <button
                type="button"
                onClick={handleOpenComposer}
                className="absolute -top-10 right-0 h-9 w-9 rounded-full shadow-[0_8px_20px_rgba(0,0,0,0.18)] flex items-center justify-center text-white text-lg"
                style={{ backgroundColor: "#1F48AF" }}
              >
                {isComposerOpen ? "×" : "+"}
              </button>
            </div>
          )}

          {activeTab === "tour" && (
            <div className="mt-2">
              {loadingConcerts ? (
                <div className="mx-auto w-full max-w-[900px] grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-40 bg-neutral-100 rounded-2xl" />
                  ))}
                </div>
              ) : concerts.length === 0 ? (
                <div className="mx-auto w-full max-w-[720px] text-center text-neutral-500 text-sm py-10">
                  No tour posts yet.
                </div>
              ) : (
                <div className="mx-auto w-full max-w-[900px] grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
                  {concerts.map((concert) => (
                    <PostCard key={concert.id} post={concert} />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/* =========================
   Cards Moments
   ========================= */
function MomentCard({
  moment,
  isLiked,
  onToggleLike,
}: {
  moment: IdolMoment;
  isLiked: boolean;
  onToggleLike: () => void;
}) {
  const hasMedia = moment.mediaUrls.length > 0;

  return (
    <article className="relative rounded-3xl border border-neutral-200 bg-white px-4 py-3 shadow-[0_14px_32px_rgba(0,0,0,0.05)]">
      <div className="flex items-start gap-3">
        <div className="mt-1 h-9 w-9 rounded-full overflow-hidden bg-neutral-200">
          {moment.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={moment.avatarUrl}
              alt={moment.userName}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <p className="text-[13px] font-medium text-neutral-900">
                {moment.userName}
              </p>
              <p className="text-[11px] font-light text-neutral-500">
                {moment.userHandle}
              </p>
            </div>
            <span className="text-[11px] font-light text-neutral-400">
              {moment.createdAt}
            </span>
          </div>

          <p className="mt-3 text-[13px] font-light leading-relaxed text-neutral-800 whitespace-pre-wrap">
            {moment.body}
          </p>

          {hasMedia && (
            <div className="mt-3 overflow-hidden rounded-2xl bg-neutral-900">
              <div className="relative aspect-[4/3] w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={moment.mediaUrls[0]}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Footer likes/comentarios oculto por ahora */}
        </div>
      </div>
    </article>
  );
}

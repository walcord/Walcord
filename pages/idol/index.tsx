"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { useRouter } from "next/router";
import PostCard from "../../components/PostCard";

type ArtistChip = {
  id: string;
  name: string;
};

type RecordItem = {
  id: string;
  title: string;
  releaseYear: number;
  vibeColor: string;
  coverColor: string;
  description: string;
};

type RecordReview = {
  id: string;
  recordId: string;
  userName: string;
  rating: number;
  body: string;
  likes: number;
  createdAt: string;
};

type FeedPost = {
  id: string;
  userName: string;
  userHandle: string;
  avatarUrl?: string;
  body: string;
  likes: number;
  comments: number;
  createdAt: string;
  relatedRecordTitle?: string;
  coverUrl?: string;
};

type ConcertMemory = {
  id: string;
  title: string;
  city: string;
  countryCode: string;
  year: number;
  userName: string;
  createdAt: string;
  imageUrls: string[];

  // extras para que PostCard funcione igual que en perfil
  artist_id?: string | null;
  country_code?: string | null;
  event_date?: string | null;
  cover_url?: string | null;
  artist_name?: string | null;
  country_name?: string | null;
};

type Era = {
  id: string;
  name: string;
  years: string;
};

type ContentItem = {
  id: string;
  eraId: string;
  contentType: "entertainment" | "performance";
  title: string;
  source: string;
  youtubeUrl: string;
  thumbnailUrl?: string;
  releaseYear: number;
};

type ActiveVideo = {
  title: string;
  url: string;
};

type Hashtag = {
  tag: string;
  count: number;
};

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

const getYouTubeEmbedUrl = (url: string) => {
  if (!url) return "";
  try {
    const cleanUrl = url.split("&")[0];

    if (cleanUrl.includes("watch?v=")) {
      const id = cleanUrl.split("watch?v=")[1];
      return `https://www.youtube.com/embed/${id}`;
    }

    if (cleanUrl.includes("youtu.be/")) {
      const id = cleanUrl.split("youtu.be/")[1];
      return `https://www.youtube.com/embed/${id}`;
    }

    return cleanUrl;
  } catch {
    return url;
  }
};

/* ------------------------------------------------------------------ */
/*  PAGE COMPONENT                                                     */
/* ------------------------------------------------------------------ */

const TheIdolPage: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();

  const [artistChips, setArtistChips] = useState<ArtistChip[]>([]);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [selectedArtistName, setSelectedArtistName] = useState<string>("");
  const [artistBio, setArtistBio] = useState<string>("");

  const [records, setRecords] = useState<RecordItem[]>([]);
  const [reviews, setReviews] = useState<RecordReview[]>([]);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [concerts, setConcerts] = useState<ConcertMemory[]>([]);
  const [eras, setEras] = useState<Era[]>([]);
  const [eraContents, setEraContents] = useState<ContentItem[]>([]);
  const [activeVideo, setActiveVideo] = useState<ActiveVideo | null>(null);

  const [artistSearch, setArtistSearch] = useState<string>("");

  /* ---------------- CARGA: ARTISTAS DESTACADOS ------------------- */
  useEffect(() => {
    const loadFeaturedArtists = async () => {
      const { data: featured, error } = await supabase
        .from("idol_featured_artists")
        .select("artist_id, sort_order")
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Error loading featured artists", error);
        return;
      }
      if (!featured || featured.length === 0) return;

      const artistIds = featured.map((f: any) => f.artist_id);

      const { data: artistsData, error: artistsError } = await supabase
        .from("artists")
        .select("id, name, description")
        .in("id", artistIds);

      if (artistsError || !artistsData) {
        console.error("Error loading artists", artistsError);
        return;
      }

      const byId = new Map(artistsData.map((a: any) => [a.id as string, a]));

      const chips: ArtistChip[] = featured
        .map((f: any) => {
          const artist = byId.get(f.artist_id as string);
          if (!artist) return null;
          return { id: artist.id as string, name: artist.name as string };
        })
        .filter(Boolean) as ArtistChip[];

      setArtistChips(chips);

      const first = chips[0];
      if (first) {
        setSelectedArtistId(first.id);
        setSelectedArtistName(first.name);
        const artist = byId.get(first.id);
        setArtistBio(artist?.description ?? "");
      }
    };

    loadFeaturedArtists();
  }, [supabase]);

  const filteredArtistChips = useMemo(() => {
    const q = artistSearch.trim().toLowerCase();
    if (!q) return artistChips;
    return artistChips.filter((a) => a.name.toLowerCase().includes(q));
  }, [artistChips, artistSearch]);

  /* ---------------- CARGA: DATA DEL ARTISTA ---------------------- */
  useEffect(() => {
    if (!selectedArtistId) return;

    const loadArtistData = async () => {
      /* ----- RECORDS (más nuevo -> más antiguo) ----- */
      const { data: recordsData, error: recordsError } = await supabase
        .from("records")
        .select("id, title, release_year, vibe_color, cover_color, description")
        .eq("artist_id", selectedArtistId)
        .order("release_year", { ascending: false });

      let recordIds: string[] = [];

      if (!recordsError && recordsData) {
        const mapped = recordsData.map((r: any) => ({
          id: r.id as string,
          title: r.title as string,
          releaseYear: (r.release_year as number) ?? 0,
          vibeColor: (r.vibe_color as string) ?? "#0f172a",
          coverColor: (r.cover_color as string) ?? "#e5e7eb",
          description: (r.description as string) ?? "",
        }));
        setRecords(mapped);
        recordIds = mapped.map((r) => r.id);
      } else {
        setRecords([]);
      }

      /* ----- REVIEWS (ratings + recommendations) ----- */
      if (recordIds.length > 0) {
        const { data: recData, error: recError } = await supabase
          .from("recommendations")
          .select("id, user_id, target_type, target_id, body, created_at, rating_id")
          .eq("target_type", "record")
          .in("target_id", recordIds)
          .order("created_at", { ascending: false })
          .limit(24);

        if (!recError && recData) {
          const ratingIds = recData.map((r: any) => r.rating_id).filter(Boolean);
          const userIds = recData.map((r: any) => r.user_id).filter(Boolean);

          let ratingsMap = new Map<string, { record_id: string; rate: number }>();
          let usersMap = new Map<string, string>();

          if (ratingIds.length > 0) {
            const { data: ratingsData } = await supabase
              .from("ratings")
              .select("id, record_id, rate")
              .in("id", ratingIds);
            if (ratingsData) {
              ratingsMap = new Map(
                ratingsData.map((r: any) => [
                  r.id as string,
                  { record_id: r.record_id as string, rate: (r.rate as number) ?? 0 },
                ])
              );
            }
          }

          if (userIds.length > 0) {
            const { data: profilesData } = await supabase
              .from("profiles")
              .select("id, username")
              .in("id", userIds);
            if (profilesData) {
              usersMap = new Map(
                profilesData.map((p: any) => [p.id as string, (p.username as string) ?? ""])
              );
            }
          }

          const mappedReviews: RecordReview[] = recData.map((r: any) => {
            const ratingInfo = r.rating_id ? ratingsMap.get(r.rating_id as string) : undefined;
            const recordId = ratingInfo?.record_id ?? (r.target_id as string) ?? "";
            const rate = ratingInfo?.rate ?? 0;
            const userName =
              usersMap.get(r.user_id as string) ?? (r.user_id ? "walcord user" : "walcord");

            return {
              id: r.id as string,
              recordId,
              userName,
              rating: rate,
              body: (r.body as string) ?? "",
              likes: 0,
              createdAt: r.created_at
                ? new Date(r.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "",
            };
          });

          setReviews(mappedReviews);
        } else {
          setReviews([]);
        }
      } else {
        setReviews([]);
      }

      /* ----- POSTS TIPO TWEET (Moments) ----- */
      const { data: postsData, error: postsError } = await supabase
        .from("idol_posts")
        .select("id, user_name, user_handle, body, likes_count, comments_count, created_at")
        .eq("artist_id", selectedArtistId)
        .order("created_at", { ascending: false })
        .limit(6);

      if (!postsError && postsData) {
        let mediaMap = new Map<string, string>();

        const postIds = postsData.map((p: any) => p.id as string);

        if (postIds.length > 0) {
          const { data: mediaData } = await supabase
            .from("idol_post_media")
            .select("post_id, url, position, created_at")
            .in("post_id", postIds)
            .order("position", { ascending: true });

          if (mediaData) {
            mediaData.forEach((m: any) => {
              const key = m.post_id as string;
              if (!mediaMap.has(key) && m.url) {
                mediaMap.set(key, m.url as string);
              }
            });
          }
        }

        setFeedPosts(
          postsData.map((p: any) => ({
            id: p.id as string,
            userName: (p.user_name as string) ?? "",
            userHandle: (p.user_handle as string) ?? "",
            body: (p.body as string) ?? "",
            likes: (p.likes_count as number) ?? 0,
            comments: (p.comments_count as number) ?? 0,
            createdAt: p.created_at
              ? new Date(p.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "",
            coverUrl: mediaMap.get(p.id as string),
          }))
        );
      } else {
        setFeedPosts([]);
      }

      /* ----- CONCIERTOS + MEDIA (Tour) ----- */
      const { data: concertsData, error: concertsError } = await supabase
        .from("concerts")
        .select("id, city, country_code, event_date, tour_name, artist_id, created_at")
        .eq("artist_id", selectedArtistId)
        .order("event_date", { ascending: false })
        .limit(20);

      let concertsMapped: ConcertMemory[] = [];

      if (!concertsError && concertsData) {
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

        concertsMapped = concertsData.map((c: any) => {
          const imgs = mediaMap.get(c.id as string) ?? [];
          const mainImg = imgs[0] ?? null;

          return {
            id: c.id as string,
            title: (c.tour_name as string) ?? "",
            city: (c.city as string) ?? "",
            countryCode: (c.country_code as string) ?? "",
            year: c.event_date ? new Date(c.event_date).getFullYear() : new Date().getFullYear(),
            userName: "",
            createdAt: c.created_at ? new Date(c.created_at).toISOString() : "",
            imageUrls: imgs,

            // campos extra para PostCard
            artist_id: (c.artist_id as string) ?? null,
            country_code: (c.country_code as string) ?? null,
            event_date: (c.event_date as string) ?? null,
            cover_url: mainImg,
            artist_name: null,
            country_name: c.city && c.country_code ? `${c.city}, ${c.country_code}` : null,
          } as ConcertMemory;
        });
      }

      setConcerts(concertsMapped);

      /* ----- ERAS ----- */
      const { data: erasData, error: erasError } = await supabase
        .from("artist_eras")
        .select("id, name, years_label, description, display_order")
        .eq("artist_id", selectedArtistId)
        .order("display_order", { ascending: true });

      if (!erasError && erasData) {
        setEras(
          erasData.map((e: any) => ({
            id: e.id as string,
            name: e.name as string,
            years: (e.years_label as string) ?? "",
          }))
        );
      } else {
        setEras([]);
      }

      /* ----- CONTENIDO DE ERAS ----- */
      const { data: contentData, error: contentError } = await supabase
        .from("era_contents")
        .select(
          "id, era_id, content_type, title, source, youtube_url, thumbnail_url, release_year, position"
        )
        .order("position", { ascending: true });

      if (!contentError && contentData) {
        setEraContents(
          contentData.map((c: any) => ({
            id: c.id as string,
            eraId: c.era_id as string,
            contentType: c.content_type as "entertainment" | "performance",
            title: c.title as string,
            source: (c.source as string) ?? "",
            youtubeUrl: (c.youtube_url as string) ?? "",
            thumbnailUrl: c.thumbnail_url as string | undefined,
            releaseYear: (c.release_year as number) ?? 0,
          }))
        );
      } else {
        setEraContents([]);
      }

      /* ----- REFRESCAR NOMBRE Y BIO ----- */
      const { data: artistData } = await supabase
        .from("artists")
        .select("name, description")
        .eq("id", selectedArtistId)
        .maybeSingle();

      if (artistData) {
        setSelectedArtistName(artistData.name ?? selectedArtistName);
        setArtistBio(artistData.description ?? "");
      }
    };

    loadArtistData();
  }, [selectedArtistId, supabase, selectedArtistName]);

  const handleCreateMoment = async (body: string) => {
    if (!user || !selectedArtistId || !body.trim()) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, full_name")
      .eq("id", user.id)
      .maybeSingle();

    const displayName = profile?.full_name || profile?.username || "walcord user";
    const handle = profile?.username ? `@${profile.username}` : "@walcord user";

    const payload = {
      user_id: user.id,
      artist_id: selectedArtistId,
      user_name: displayName,
      user_handle: handle,
      body: body.trim(),
      likes_count: 0,
      comments_count: 0,
    };

    const { data, error } = await supabase
      .from("idol_posts")
      .insert([payload])
      .select("id, user_name, user_handle, body, likes_count, comments_count, created_at")
      .single();

    if (error || !data) {
      console.error("Error creating idol post", error);
      return;
    }

    const createdAt = data.created_at
      ? new Date(data.created_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "";

    const newPost: FeedPost = {
      id: data.id as string,
      userName: (data.user_name as string) ?? displayName,
      userHandle: (data.user_handle as string) ?? handle,
      body: (data.body as string) ?? body.trim(),
      likes: (data.likes_count as number) ?? 0,
      comments: (data.comments_count as number) ?? 0,
      createdAt,
      coverUrl: undefined,
    };

    setFeedPosts((prev) => [newPost, ...prev]);
  };

  const handleOpenVideo = (item: ContentItem) => {
    setActiveVideo({
      title: item.title,
      url: item.youtubeUrl,
    });
  };

  const handleCloseVideo = () => setActiveVideo(null);

  const selectedArtistChip = artistChips.find((a) => a.id === selectedArtistId);

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-[500px] sm:max-w-[620px] md:max-w-[760px] lg:max-w-[820px] px-5 md:px-6 pt-[calc(env(safe-area-inset-top)+24px)] sm:pt-[calc(env(safe-area-inset-top)+32px)] pb-[calc(env(safe-area-inset-bottom)+96px)]">
        {/* HEADER */}
        <header>
          <h1
            className="text-[clamp(1.6rem,5vw,2.4rem)] font-normal tracking-tight"
            style={{ fontFamily: "Times New Roman, serif" }}
          >
            The Idol
          </h1>
          <div className="mt-2 h-px w-full bg-black/10" />
        </header>

        {/* ARTIST SEARCH (minimal) */}
        <section className="mt-6">
          <input
            value={artistSearch}
            onChange={(e) => setArtistSearch(e.target.value)}
            placeholder="Search an artist..."
            className="w-full rounded-full border border-neutral-200 px-4 py-2 text-[12px] font-light outline-none focus:border-neutral-500"
            style={{ fontFamily: "Roboto, system-ui, sans-serif" }}
          />
        </section>

        {/* ARTIST CHIPS – desde Supabase (idol_featured_artists) */}
        <section className="mt-3">
          <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible">
            {filteredArtistChips.map((artist) => {
              const selected = artist.id === selectedArtistId;
              return (
                <button
                  key={artist.id}
                  type="button"
                  onClick={() => setSelectedArtistId(artist.id)}
                  className={`inline-flex shrink-0 items-center rounded-full px-4 py-1.5 text-sm font-normal transition-all duration-150 ${
                    selected
                      ? "bg-[#1F48AF] text-white shadow-sm"
                      : "bg-white text-neutral-900 border border-neutral-300 hover:border-neutral-500"
                  }`}
                >
                  <span>{artist.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ARTIST PROFILE */}
        {selectedArtistId && (
          <section className="mt-8">
            <ArtistProfile
              artistId={selectedArtistId as string}
              artistName={selectedArtistChip?.name ?? selectedArtistName}
              bio={artistBio}
              records={records}
              reviews={reviews}
              feedPosts={feedPosts}
              concerts={concerts}
              eras={eras}
              eraContents={eraContents}
              onOpenVideo={handleOpenVideo}
              onCreateMoment={handleCreateMoment}
            />
          </section>
        )}
      </div>

      {/* VIDEO MODAL */}
      {activeVideo && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="relative w-full max-w-3xl rounded-3xl border border-neutral-200 bg-white shadow-[0_18px_60px_rgba(0,0,0,0.30)]">
            <button
              type="button"
              onClick={handleCloseVideo}
              className="absolute -right-3 -top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white text-[16px] font-light text-neutral-700 shadow-sm hover:bg-neutral-100"
              aria-label="Close video"
            >
              ×
            </button>
            <div className="p-3 sm:p-4">
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-neutral-200 bg-black">
                <iframe
                  src={getYouTubeEmbedUrl(activeVideo.url)}
                  title={activeVideo.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

/* ------------------------------------------------------------------ */
/*  ARTIST PROFILE                                                     */
/* ------------------------------------------------------------------ */

type ArtistProfileProps = {
  artistId: string;
  artistName: string;
  bio?: string;
  records: RecordItem[];
  reviews: RecordReview[];
  feedPosts: FeedPost[];
  concerts: ConcertMemory[];
  eras: Era[];
  eraContents: ContentItem[];
  onOpenVideo: (item: ContentItem) => void;
  onCreateMoment?: (body: string) => Promise<void> | void;
};

const ArtistProfile: React.FC<ArtistProfileProps> = ({
  artistId,
  artistName,
  bio,
  records,
  reviews,
  feedPosts,
  concerts,
  eras,
  eraContents,
  onOpenVideo,
  onCreateMoment,
}) => {
  const router = useRouter();
  const supabase = useSupabaseClient();
  const user = useUser();

  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(
    records[0]?.id ?? null
  );
  const [activeSection, setActiveSection] = useState<"eras" | "moments" | "tour">(
    "eras"
  );

  const [showPostForm, setShowPostForm] = useState(false);
  const [newPostBody, setNewPostBody] = useState("");
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);

  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);

  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [hashtagTopic, setHashtagTopic] = useState("");

  useEffect(() => {
    if (!records.length) return;
    setSelectedRecordId(records[0].id);
  }, [records, artistId]);

  useEffect(() => {
    if (!user) {
      setCurrentAvatarUrl(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      setCurrentAvatarUrl((data?.avatar_url as string) ?? null);
    })();
  }, [user, supabase]);

  const selectedRecord = records.find((record) => record.id === selectedRecordId);
  const selectedReviews = reviews.filter((review) => review.recordId === selectedRecordId);

  const trendingTags: Hashtag[] = useMemo(() => {
    const counts: Record<string, number> = {};
    feedPosts.forEach((m) => {
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
  }, [feedPosts]);

  const filteredFeedPosts = useMemo(() => {
    if (!activeTag) return feedPosts;
    return feedPosts.filter((m) =>
      extractHashtags(m.body).some((t) => t.toLowerCase() === activeTag.toLowerCase())
    );
  }, [feedPosts, activeTag]);

  const hashtagSuggestions = useMemo(() => {
    if (!hashtagTopic) return [];
    const draft = normalizeTag(hashtagTopic);
    if (!draft) return [];
    return trendingTags.filter((t) => t.tag.toLowerCase().startsWith(draft));
  }, [trendingTags, hashtagTopic]);

  const handleSubmitPost = async () => {
    if (!newPostBody.trim() || !onCreateMoment || isSubmittingPost) return;

    const cleanedTopic = normalizeTag(hashtagTopic);
    let finalBody = newPostBody.trim();

    if (cleanedTopic) {
      const hash = `#${cleanedTopic}`;
      if (!finalBody.toLowerCase().includes(hash.toLowerCase())) {
        finalBody = `${finalBody} ${hash}`.trim();
      }
    }

    setIsSubmittingPost(true);
    try {
      await onCreateMoment(finalBody);
      setNewPostBody("");
      setHashtagTopic("");
      setShowPostForm(false);
    } finally {
      setIsSubmittingPost(false);
    }
  };

  const handleSeeMoreReviews = () => {
    if (!selectedRecordId) return;
    router.push(`/record/${selectedRecordId}`);
  };

  return (
    <div className="space-y-10 md:space-y-12">
      {/* NAME */}
      <div>
        <h2
          className="text-[1.9rem] sm:text-[2.1rem] font-normal tracking-tight text-neutral-900"
          style={{ fontFamily: "Times New Roman, serif" }}
        >
          {artistName}
        </h2>
        <div className="mt-3 h-px w-full bg-black/10" />
      </div>

      {/* MOSAICO + DETALLE DISCO */}
      <section>
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:gap-10 transition-all duration-500">
          {/* MOSAICO */}
          <div className="mx-auto grid max-w-[360px] grid-cols-3 gap-4 md:max-w-[420px]">
            {records.map((record) => {
              const isSelected = record.id === selectedRecordId;

              return (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => setSelectedRecordId(record.id)}
                  className="relative flex items-center justify-center transition-transform duration-300 hover:scale-[1.02]"
                  aria-label={record.title}
                >
                  <div className="relative w-[94px] sm:w-[110px]">
                    <div className="pt-[100%]" />
                    <div className="absolute inset-0">
                      <div className="absolute inset-0" style={{ backgroundColor: record.vibeColor }} />
                      <div
                        className="absolute inset-[35%] shadow-md"
                        style={{ backgroundColor: record.coverColor }}
                      />
                      {isSelected && (
                        <div className="pointer-events-none absolute inset-[-3px] border border-[#1F48AF]" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Texto del disco seleccionado + reviews */}
          <AnimatePresence mode="wait">
            {selectedRecord && (
              <motion.div
                key={selectedRecord.id}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.45, ease: [0.19, 1, 0.22, 1] }}
                className="md:flex-1 md:pt-1 md:translate-x-2"
              >
                <h3
                  className="text-[1.4rem] leading-snug text-neutral-900"
                  style={{ fontFamily: "Times New Roman, serif" }}
                >
                  {selectedRecord.title}
                </h3>
                <p className="mt-1 text-[11px] font-light uppercase tracking-[0.26em] text-neutral-500">
                  Record from {selectedRecord.releaseYear}
                </p>
                <p className="mt-4 text-sm font-light leading-relaxed text-neutral-800">
                  {selectedRecord.description}
                </p>

                {selectedReviews.length > 0 && (
                  <div className="mt-6">
                    <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">
                      Reviews
                    </p>
                    <div className="mt-3 overflow-x-auto pb-2">
                      <div className="grid auto-cols-[260px] grid-flow-col grid-rows-1 gap-4">
                        {selectedReviews.map((review) => (
                          <ReviewCard key={review.id} review={review} />
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleSeeMoreReviews}
                      className="mt-2 text-[11px] font-medium text-neutral-500 hover:text-neutral-900"
                    >
                      See more
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* NAV ERAS / MOMENTS / TOUR */}
      <section className="space-y-7">
        <div className="flex gap-6 text-sm">
          {(["eras", "moments", "tour"] as const).map((section) => {
            const label =
              section === "eras" ? "Eras" : section === "moments" ? "Moments" : "Tour";
            const isActive = activeSection === section;
            return (
              <button
                key={section}
                type="button"
                onClick={() => setActiveSection(section)}
                className="relative pb-1 text-left"
              >
                <span
                  className={`text-[1.15rem] ${isActive ? "text-neutral-900" : "text-neutral-400"}`}
                  style={{ fontFamily: "Times New Roman, serif" }}
                >
                  {label}
                </span>
                {isActive && <span className="absolute inset-x-0 -bottom-0.5 h-[1px] bg-neutral-900" />}
              </button>
            );
          })}
        </div>

        {/* CONTENIDO SEGÚN SECCIÓN ACTIVA CON TRANSICIÓN */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
          >
            {activeSection === "eras" && (
              <section>
                <div className="mt-4 space-y-10">
                  {eras.map((era) => (
                    <EraBlock key={era.id} era={era} contentItems={eraContents} onOpenVideo={onOpenVideo} />
                  ))}
                </div>
              </section>
            )}

            {activeSection === "moments" && (
              <section className="mt-2 space-y-4 relative">
                {/* Trending tags (calcado) */}
                {trendingTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {trendingTags.map((t) => {
                      const isTagActive =
                        activeTag && activeTag.toLowerCase() === t.tag.toLowerCase();
                      return (
                        <button
                          key={t.tag}
                          type="button"
                          onClick={() =>
                            setActiveTag((prev) =>
                              prev && prev.toLowerCase() === t.tag.toLowerCase() ? null : t.tag
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

                {feedPosts.length > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
                      Latest moments
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push(`/artist/${artistId}`)}
                      className="text-[11px] font-medium text-neutral-500 hover:text-neutral-900"
                    >
                      See all
                    </button>
                  </div>
                )}

                {/* Composer (calcado con topic hashtag + suggestions) */}
                {showPostForm && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-9 w-9 rounded-full overflow-hidden bg-neutral-200">
                      {currentAvatarUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={currentAvatarUrl}
                          alt="Avatar"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 rounded-3xl border border-neutral-200 bg-white shadow-[0_12px_30px_rgba(0,0,0,0.06)] px-4 py-3">
                      <textarea
                        value={newPostBody}
                        onChange={(e) => setNewPostBody(e.target.value)}
                        placeholder="Share a thought about this artist..."
                        className="w-full min-h-[70px] resize-none border-none bg-transparent text-sm outline-none"
                      />

                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <input
                            value={hashtagTopic}
                            onChange={(e) => setHashtagTopic(e.target.value)}
                            placeholder="Hashtag topic (metgala, grammys, ag8)..."
                            className="flex-1 rounded-full border border-neutral-200 px-3 py-1.5 text-[11px] outline-none focus:border-neutral-500"
                          />

                          <button
                            type="button"
                            disabled={!newPostBody.trim() || isSubmittingPost}
                            onClick={handleSubmitPost}
                            className="rounded-full px-5 h-8 text-xs text-white enabled:hover:opacity-90 disabled:opacity-40 transition"
                            style={{ backgroundColor: "#1F48AF" }}
                          >
                            Post
                          </button>
                        </div>

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

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {filteredFeedPosts.map((post) => (
                    <MomentStripItem key={post.id} post={post} />
                  ))}
                </div>

                {/* Botón flotante + */}
                <button
                  type="button"
                  onClick={() => setShowPostForm((prev) => !prev)}
                  className="absolute -top-10 right-0 h-9 w-9 rounded-full shadow-[0_8px_20px_rgba(0,0,0,0.18)] flex items-center justify-center text-white text-lg"
                  style={{ backgroundColor: "#1F48AF" }}
                  aria-label={showPostForm ? "Close composer" : "Create moment"}
                >
                  {showPostForm ? "×" : "+"}
                </button>
              </section>
            )}

            {activeSection === "tour" && (
              <section className="mt-2">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {concerts.map((concert) => (
                    <PostCard key={concert.id} post={concert} />
                  ))}
                </div>
              </section>
            )}
          </motion.div>
        </AnimatePresence>

        {/* BIO SIEMPRE VISIBLE EN CUALQUIER TAB */}
        {bio && (
          <section className="mt-8 border-t border-neutral-200 pt-6">
            <p className="text-sm font-light leading-relaxed text-neutral-700">{bio}</p>
          </section>
        )}
      </section>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  COMPONENTES PEQUEÑOS                                               */
/* ------------------------------------------------------------------ */

type ReviewCardProps = {
  review: RecordReview;
};

const ReviewCard: React.FC<ReviewCardProps> = ({ review }) => {
  const router = useRouter();

  const handleOpenReview = () => {
    router.push(`/review/${review.id}`);
  };

  return (
    <button
      type="button"
      onClick={handleOpenReview}
      className="flex h-full flex-col justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left shadow-[0_10px_28px_rgba(0,0,0,0.04)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(0,0,0,0.06)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-neutral-900">{review.userName}</p>
          <p className="text-[11px] font-light text-neutral-500">{review.createdAt}</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-900 text-[12px] font-medium text-neutral-900">
          {review.rating}
        </div>
      </div>
      <p className="mt-3 line-clamp-4 text-[13px] font-light leading-relaxed text-neutral-800">
        {review.body}
      </p>
      <p className="mt-3 text-[11px] font-light text-neutral-500">
        {review.likes} likes · 0 comments
      </p>
    </button>
  );
};

type MomentStripItemProps = {
  post: FeedPost;
};

const MomentStripItem: React.FC<MomentStripItemProps> = ({ post }) => {
  return (
    <article className="relative rounded-3xl border border-neutral-200 bg-white p-4 shadow-[0_14px_32px_rgba(0,0,0,0.05)] transition-transform duration-300 hover:-translate-y-1">
      {post.coverUrl && (
        <div className="mb-3 overflow-hidden rounded-2xl bg-neutral-900">
          <div className="relative aspect-[4/3] w-full">
            <img
              src={post.coverUrl}
              alt={post.userName}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        </div>
      )}
      <div className="flex items-start gap-2">
        <div className="mt-1 h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-neutral-200" />
        <div className="flex-1">
          <p className="text-[13px] font-medium text-neutral-900">{post.userName}</p>
          <p className="text-[11px] font-light text-neutral-500">{post.userHandle}</p>
        </div>
      </div>
      <p className="mt-3 text-[13px] font-light leading-relaxed text-neutral-800">{post.body}</p>
      <p className="mt-3 text-[11px] font-light text-neutral-500">
        {post.likes} likes · {post.comments} comments
      </p>
    </article>
  );
};

/* ----------------------------- ERAS -------------------------------- */

type EraBlockProps = {
  era: Era;
  contentItems: ContentItem[];
  onOpenVideo: (item: ContentItem) => void;
};

const EraBlock: React.FC<EraBlockProps> = ({ era, contentItems, onOpenVideo }) => {
  const entertainmentItems = contentItems.filter(
    (item) => item.eraId === era.id && item.contentType === "entertainment"
  );
  const performanceItems = contentItems.filter(
    (item) => item.eraId === era.id && item.contentType === "performance"
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-light uppercase tracking-[0.24em] text-neutral-500">
          {era.years}
        </p>
        <h4
          className="mt-1 text-[1.25rem] text-neutral-900"
          style={{ fontFamily: "Times New Roman, serif" }}
        >
          {era.name}
        </h4>
      </div>

      {entertainmentItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
            Entertainment
          </p>
          <div className="mt-1 flex gap-4 overflow-x-auto pb-1">
            {entertainmentItems.map((item) => (
              <ContentCard key={item.id} item={item} onOpenVideo={onOpenVideo} />
            ))}
          </div>
        </div>
      )}

      {performanceItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
            Performances
          </p>
          <div className="mt-1 flex gap-4 overflow-x-auto pb-1">
            {performanceItems.map((item) => (
              <ContentCard key={item.id} item={item} onOpenVideo={onOpenVideo} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

type ContentCardProps = {
  item: ContentItem;
  onOpenVideo: (item: ContentItem) => void;
};

const ContentCard: React.FC<ContentCardProps> = ({ item, onOpenVideo }) => {
  return (
    <button
      type="button"
      onClick={() => onOpenVideo(item)}
      className="group relative flex w-[260px] flex-none cursor-pointer overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_14px_30px_rgba(0,0,0,0.08)] transition-transform duration-300 hover:-translate-y-1"
    >
      <div className="relative aspect-video w-full">
        {item.thumbnailUrl && (
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
        {!item.thumbnailUrl && (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-700" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
        <div className="absolute inset-x-4 bottom-3 flex items-center justify-between text-[11px] text-neutral-100">
          <span className="font-light uppercase tracking-[0.14em]">{item.source}</span>
          <span className="rounded-full bg-[#1F48AF] px-3 py-1 text-[10px] font-medium text-white shadow-sm transition-all duration-150 group-hover:-translate-y-0.5 group-hover:shadow-md">
            Watch
          </span>
        </div>
      </div>
    </button>
  );
};

export default TheIdolPage;

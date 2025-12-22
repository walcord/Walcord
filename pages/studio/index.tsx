import React, { useEffect, useState } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useRouter } from "next/router";

type StudioCategory = "conversation" | "session" | "live";

type StudioItem = {
  id: string;
  title: string;
  subtitle?: string;
  artist?: string;
  tag: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  category?: StudioCategory;
  createdAt?: string;
};

type Article = {
  id: string;
  title: string;
  excerpt: string;
  slug: string;
  author?: string | null;
  created_at?: string | null;
};

type ActiveVideo = {
  title: string;
  url: string;
};

type RecordOfTheWeek = {
  id: string;
  title: string;
  artist_name: string | null;
  release_year: number | null;
  description: string | null;
  vibe_color: string | null;
  cover_color: string | null;
};

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

const normaliseCategory = (raw: string | null): StudioCategory | undefined => {
  if (!raw) return undefined;
  const value = raw.toLowerCase().trim();
  if (value.startsWith("conv")) return "conversation";
  if (value.startsWith("sess")) return "session";
  if (value.startsWith("liv")) return "live";
  return undefined;
};

const getTagFromCategory = (category?: StudioCategory) => {
  switch (category) {
    case "conversation":
      return "Conversation";
    case "session":
      return "Vinyl Session";
    case "live":
      return "Live Performance";
    default:
      return "";
  }
};

const formatStudioDate = (iso?: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const day = date.getDate();
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  const getSuffix = (d: number) => {
    if (d >= 11 && d <= 13) return "th";
    switch (d % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  };

  return `${day}${getSuffix(day)} ${month} ${year}`;
};

const TheStudioPage = () => {
  const supabase = useSupabaseClient<any>();
  const router = useRouter();

  const [hero, setHero] = useState<StudioItem | null>(null);
  const [conversations, setConversations] = useState<StudioItem[]>([]);
  const [sessions, setSessions] = useState<StudioItem[]>([]);
  const [live, setLive] = useState<StudioItem[]>([]);
  const [activeVideo, setActiveVideo] = useState<ActiveVideo | null>(null);
  const [recordOfTheWeek, setRecordOfTheWeek] =
    useState<RecordOfTheWeek | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);

  // ✅ FIX Xcode/WebView: al entrar en la página, fuerza arriba para que el headline se vea
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }
  }, []);

  // ✅ Smooth: cuando hay modal, bloquea scroll del body para evitar saltos/feeling “arcaico”
  useEffect(() => {
    if (typeof document === "undefined") return;

    const prevOverflow = document.body.style.overflow;
    const prevTouch = (document.body.style as any).webkitOverflowScrolling;

    if (activeVideo) {
      document.body.style.overflow = "hidden";
      (document.body.style as any).webkitOverflowScrolling = "auto";
    } else {
      document.body.style.overflow = prevOverflow;
      (document.body.style as any).webkitOverflowScrolling = prevTouch;
    }

    return () => {
      document.body.style.overflow = prevOverflow;
      (document.body.style as any).webkitOverflowScrolling = prevTouch;
    };
  }, [activeVideo]);

  useEffect(() => {
    const fetchStudioData = async () => {
      try {
        // STUDIO ITEMS
        const { data, error } = await supabase
          .from("studio_items")
          .select(
            "id, title, subtitle, category, youtube_url, thumbnail_url, created_at, artists(name)"
          )
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) {
          console.error("Error fetching studio_items:", error);
        } else if (data && data.length > 0) {
          const mapped: StudioItem[] = data.map((row: any) => {
            const category = normaliseCategory(row.category);
            return {
              id: row.id,
              title: row.title,
              subtitle: row.subtitle ?? undefined,
              artist: row.artists?.name ?? undefined,
              tag: getTagFromCategory(category),
              thumbnailUrl: row.thumbnail_url ?? undefined,
              videoUrl: row.youtube_url ?? undefined,
              category,
              createdAt: row.created_at,
            };
          });

          if (mapped.length > 0) {
            setHero(mapped[0]);
          }

          const conv = mapped.filter((item) => item.category === "conversation");
          const sess = mapped.filter((item) => item.category === "session");
          const liv = mapped.filter((item) => item.category === "live");

          if (conv.length > 0) setConversations(conv);
          if (sess.length > 0) setSessions(sess);
          if (liv.length > 0) setLive(liv);
        }

        // RECORD OF THE WEEK
        const { data: recordData, error: recordError } = await supabase
          .from("records")
          .select(
            "id, title, artist_name, release_year, description, vibe_color, cover_color"
          )
          .eq("is_record_of_the_week", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (recordError) {
          console.error("Error fetching record_of_the_week:", recordError);
        } else if (recordData) {
          setRecordOfTheWeek(recordData as RecordOfTheWeek);
        }

        // ARTICLES
        const { data: articlesData, error: articlesError } = await supabase
          .from("studio_articles")
          .select("id, title, slug, excerpt, author, created_at")
          .order("created_at", { ascending: false })
          .limit(4);

        if (articlesError) {
          console.error("Error fetching studio_articles:", articlesError);
        } else if (articlesData) {
          setArticles(articlesData as Article[]);
        }
      } catch (err) {
        console.error("Unexpected error fetching studio data:", err);
      }
    };

    fetchStudioData();
  }, [supabase]);

  const featureArticle = articles[0];
  const secondaryArticles = articles.slice(1);

  const handlePlayItem = (item: StudioItem) => {
    if (!item.videoUrl) return;
    setActiveVideo({
      title: item.title,
      url: item.videoUrl,
    });
  };

  const handleOpenArticle = (slug: string) => {
    router.push(`/studio/article/${slug}`);
  };

  return (
    <main className="min-h-screen bg-white">
      {/* ✅ Layout app: SIN safe-area arriba (evita huecazo), y +padding abajo para no chocar con tab bar */}
      <div className="mx-auto max-w-[500px] sm:max-w-[620px] md:max-w-[760px] lg:max-w-[820px] px-5 md:px-6 pt-6 sm:pt-8 pb-[calc(env(safe-area-inset-bottom)+120px)]">
        {/* HEADER */}
        <header>
          <h1
            className="text-[clamp(1.6rem,5vw,2.4rem)] font-normal tracking-tight"
            style={{ fontFamily: "Times New Roman, serif" }}
          >
            The Studio
          </h1>
          <div className="mt-2 h-px w-full bg-black/10" />
        </header>

        {/* HERO EDITORIAL */}
        {hero ? (
          <section className="mt-8">
            <div
              className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_4px_14px_rgba(0,0,0,0.06)] cursor-pointer transition-transform duration-200 hover:-translate-y-0.5"
              onClick={() => {
                if (hero && hero.videoUrl) handlePlayItem(hero);
              }}
            >
              <div className="p-6 sm:p-7">
                {/* LABEL + TITLE + SUBTITLE */}
                <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                  Latest in The Studio
                </p>

                <h2
                  className="text-[1.7rem] leading-tight text-neutral-900"
                  style={{
                    fontFamily: "Times New Roman, serif",
                    fontWeight: 400,
                  }}
                >
                  {hero.title}
                </h2>

                {hero.subtitle && (
                  <p className="mt-2 text-[14px] font-light leading-relaxed text-neutral-700">
                    {hero.subtitle}
                  </p>
                )}

                {/* TAGS */}
                <div className="mt-4 flex items-center gap-2">
                  {hero.tag && (
                    <span className="inline-flex items-center rounded-full border border-neutral-300 px-3 py-1 text-[11px] font-medium tracking-wide text-neutral-700">
                      {hero.tag.toUpperCase()}
                    </span>
                  )}
                  {hero.artist && (
                    <span className="text-[11px] font-light uppercase tracking-[0.18em] text-neutral-500">
                      {hero.artist}
                    </span>
                  )}
                </div>

                {/* VISUAL / VIDEO HERO */}
                <div className="mt-6 relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-700">
                  {hero.thumbnailUrl && (
                    <img
                      src={hero.thumbnailUrl}
                      alt={hero.title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
                  <div className="relative flex h-48 sm:h-56 lg:h-64 items-end justify-between px-5 pb-4 pt-6">
                    <div className="max-w-[220px] sm:max-w-xs">
                      <p className="text-[11px] font-light uppercase tracking-[0.18em] text-neutral-300">
                        A Walcord original
                      </p>
                      <p className="mt-1 text-[11px] font-light leading-snug text-neutral-300">
                        {formatStudioDate(hero.createdAt)}
                      </p>
                    </div>

                    <span className="rounded-full bg-[#1F48AF] px-5 py-1.5 text-[11px] font-medium text-white shadow-sm">
                      Watch
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          // Hero vacío elegante si aún no hay nada subido
          <section className="mt-8">
            <div className="overflow-hidden rounded-2xl border border-dashed border-neutral-300 bg-neutral-50">
              <div className="p-6 sm:p-7">
                <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                  Latest in The Studio
                </p>
                <h2
                  className="mt-3 text-[1.7rem] leading-tight text-neutral-900"
                  style={{
                    fontFamily: "Times New Roman, serif",
                    fontWeight: 400,
                  }}
                >
                  Something new is being mixed.
                </h2>
                <p className="mt-3 max-w-md text-[14px] font-light leading-relaxed text-neutral-600">
                  The first Walcord conversation, session or live performance
                  will appear here very soon.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* CONVERSATIONS */}
        <StudioRow
          title="Conversations"
          description="Long-form talks with artists, directors and the people who build the records we love."
          items={conversations}
          onPlay={handlePlayItem}
        />

        {/* SESSIONS */}
        <StudioRow
          title="Sessions"
          description="Vinyl-only sets, mashups and carefully curated rooms of sound."
          items={sessions}
          onPlay={handlePlayItem}
        />

        {/* LIVE */}
        <StudioRow
          title="Live"
          description="Performances that feel like being in the front row, even when you are on your sofa."
          items={live}
          onPlay={handlePlayItem}
        />

        {/* RECORD OF THE WEEK */}
        <section className="mt-14">
          <div className="flex items-baseline justify_between gap-4">
            <div>
              <h2
                className="text-xl sm:text-2xl text-neutral-900"
                style={{
                  fontFamily: "Times New Roman, serif",
                  fontWeight: 400,
                }}
              >
                Record of the week
              </h2>
              <p className="mt-2 max-w-xl text-sm font-light text-neutral-600">
                One record, once a week. No algorithm, just taste.
              </p>
            </div>
          </div>

          {recordOfTheWeek ? (
            <div
              className="mt-7 overflow-hidden rounded-3xl border border-neutral-200 bg-white cursor-pointer transition-transform duration-200 hover:-translate-y-0.5"
              onClick={() => router.push(`/record/${recordOfTheWeek.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/record/${recordOfTheWeek.id}`);
                }
              }}
            >
              <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:gap-8 sm:p-8">
                {/* Portada disco usando vibe_color y cover_color */}
                <div className="sm:w-1/3 flex justify-center sm:justify-start">
                  <div className="relative aspect-square w-32 sm:w-40 md:w-44">
                    <div
                      className="absolute inset-0 rounded-2xl"
                      style={{
                        backgroundColor:
                          recordOfTheWeek.vibe_color || "#3b3b3b",
                      }}
                    />
                    <div
                      className="absolute inset-[30%] rounded-xl shadow-md"
                      style={{
                        backgroundColor:
                          recordOfTheWeek.cover_color || "#8b8b8b",
                      }}
                    />
                  </div>
                </div>

                {/* Texto editorial */}
                <div className="flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-500">
                    Walcord selection
                  </p>

                  <h3
                    className="mt-3 text-[1.45rem] leading-snug text-neutral-900 sm:text-[1.6rem]"
                    style={{
                      fontFamily: "Times New Roman, serif",
                      fontWeight: 400,
                    }}
                  >
                    {recordOfTheWeek.title}
                  </h3>

                  <p className="mt-1 text-[11px] font-light uppercase tracking-[0.28em] text-neutral-600">
                    {recordOfTheWeek.artist_name}
                    {recordOfTheWeek.release_year
                      ? ` · ${recordOfTheWeek.release_year}`
                      : ""}
                  </p>

                  <p className="mt-4 max-w-xl text-[14px] font-light leading-relaxed text-neutral-700">
                    {recordOfTheWeek.description}
                  </p>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center rounded_full border border-neutral-300 px-4 py-1.5 text-[12px] font-medium text-neutral-900">
                      Open Record
                    </span>
                    <span className="text-[11px] font-light text-neutral-500">
                      Updated every Sunday night
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Estado si aún no has marcado ningún record_of_the_week en Supabase
            <div className="mt-7 overflow-hidden rounded-3xl border border-dashed border-neutral-300 bg-neutral-50">
              <div className="p-6 sm:p-8">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-500">
                  Walcord selection
                </p>
                <h3
                  className="mt-3 text-[1.45rem] leading-snug text-neutral-900 sm:text-[1.6rem]"
                  style={{
                    fontFamily: "Times New Roman, serif",
                    fontWeight: 400,
                  }}
                >
                  The next record of the week is being chosen.
                </h3>
                <p className="mt-3 max-w-xl text-[14px] font-light leading-relaxed text-neutral-700">
                  As soon as you mark a record in Supabase as “record of the
                  week”, it will appear here with its colours and description.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ARTICLES */}
        <section className="mt-16">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                className="text-xl sm:text-2xl text-neutral-900"
                style={{
                  fontFamily: "Times New Roman, serif",
                  fontWeight: 400,
                }}
              >
                Articles
              </h2>
              <p className="mt-2 max-w-xl text-sm font-light text-neutral-600">
                Writing on music, cities and the people who listen.
              </p>
              <button
                type="button"
                onClick={() => router.push("/studio/articles")}
                className="mt-3 inline-flex whitespace-nowrap items-center text-[11px] font-medium text-neutral-500 sm:hidden"
              >
                View all
              </button>
            </div>
            <button
              type="button"
              onClick={() => router.push("/studio/articles")}
              className="hidden sm:inline-flex whitespace-nowrap items-center text-xs font-medium text-neutral-500 transition-colors duration-150 hover:text-neutral-900"
            >
              View all
            </button>
          </div>

          {articles.length > 0 ? (
            <div className="mt-8 border-t border-neutral-200 pt-8 grid gap-10 sm:grid-cols-[minmax(0,2.1fr)_minmax(0,1.4fr)]">
              {/* FEATURE IZQUIERDA */}
              <article
                className="space_y-4 cursor-pointer"
                onClick={() =>
                  featureArticle && handleOpenArticle(featureArticle.slug)
                }
              >
                <div className="flex items-center gap-3">
                  <div className="h-[1px] w-10 bg-neutral-400" />
                  <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-neutral-500">
                    JOURNAL
                  </p>
                </div>
                <h3
                  className="text-[1.6rem] leading-tight text-neutral-900 sm:text-[1.8rem]"
                  style={{
                    fontFamily: "Times New Roman, serif",
                    fontWeight: 400,
                  }}
                >
                  {featureArticle?.title}
                </h3>
                <p className="max-w-xl text-sm font-light leading-relaxed text-neutral-700">
                  {featureArticle?.excerpt}
                </p>
                <button
                  type="button"
                  className="mt-2 inline-flex items-center text-[11px] font-medium tracking-[0.18em] text-neutral-700"
                >
                  READ STORY
                  <span className="ml-1 text-[13px]">→</span>
                </button>
              </article>

              {/* COLUMNA DERECHA */}
              <div className="border-t border-neutral-200 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
                <div className="space-y-6 pt-6 sm:pt-0">
                  {secondaryArticles.map((article) => (
                    <article
                      key={article.id}
                      className="space-y-2 border-b border-neutral-200 pb-5 last:border-b-0 last:pb-0 cursor-pointer"
                      onClick={() => handleOpenArticle(article.slug)}
                    >
                      <h3
                        className="text-[1.05rem] leading-snug text-neutral-900"
                        style={{
                          fontFamily: "Times New Roman, serif",
                          fontWeight: 400,
                        }}
                      >
                        {article.title}
                      </h3>
                      <p className="text-sm font-light leading-relaxed text-neutral-700">
                        {article.excerpt}
                      </p>
                      <button
                        type="button"
                        className="mt-1 inline-flex items-center text-[11px] font-medium tracking-[0.18em] text-neutral-700"
                      >
                        READ
                        <span className="ml-1 text-[13px]">→</span>
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Placeholder editorial si aún no hay artículos
            <div className="mt-8 border-t border-neutral-200 pt-8">
              <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-neutral-500">
                Journal
              </p>
              <h3
                className="mt-3 text-[1.4rem] leading-snug text-neutral-900"
                style={{
                  fontFamily: "Times New Roman, serif",
                  fontWeight: 400,
                }}
              >
                The first Walcord pieces are being edited.
              </h3>
              <p className="mt-3 max-w-xl text-sm font-light leading-relaxed text-neutral-700">
                As soon as you publish your first essays on concerts, cities and
                fandom, they&apos;ll live here in a clean, fully editorial
                layout.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* ✅ VIDEO MODAL: sin blur, sin gris, sin fondo blanco -> mantiene lo de atrás */}
      {activeVideo && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ backgroundColor: "transparent" }}
          onClick={() => setActiveVideo(null)}
        >
          <div
            className="relative w-full max-w-3xl rounded-3xl border border-neutral-200 bg-white shadow-[0_26px_90px_rgba(0,0,0,0.35)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveVideo(null)}
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

type StudioRowProps = {
  title: string;
  description?: string;
  items: StudioItem[];
  onPlay?: (item: StudioItem) => void;
};

const StudioRow: React.FC<StudioRowProps> = ({
  title,
  description,
  items,
  onPlay,
}) => {
  const hasItems = items && items.length > 0;

  if (!hasItems) {
    return null;
  }

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2
            className="text-xl sm:text-2xl text-neutral-900"
            style={{ fontFamily: "Times New Roman, serif", fontWeight: 400 }}
          >
            {title}
          </h2>
          {description && (
            <p className="mt-2 max-w-xl text-sm font-light text-neutral-600">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex gap-4 overflow-x-auto pb-3 pr-3 sm:pr-0">
        {items.map((item) => (
          <div
            key={item.id}
            className="group flex w-72 flex-none cursor-pointer flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-transform duration-200 hover:-translate-y-1 sm:w-80"
            onClick={() => onPlay && onPlay(item)}
          >
            {/* Thumbnail fijo */}
            <div className="relative h-32 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-700">
              {item.thumbnailUrl && (
                <img
                  src={item.thumbnailUrl}
                  alt={item.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
              <div className="absolute inset-x-4 bottom-3 flex items-center justify-between text-[11px] text-neutral-200">
                <span className="font-light uppercase tracking-[0.16em]">
                  {item.tag}
                </span>
                <button
                  type="button"
                  className="rounded-full bg-[#1F48AF] px-3 py-1 text-[10px] font-medium text-white shadow-sm transition-all duration-150 group-hover:-translate-y-0.5 group-hover:shadow-md"
                >
                  Play
                </button>
              </div>
            </div>

            {/* Texto con altura consistente */}
            <div className="flex min-h-[130px] flex-1 flex-col p-4">
              {item.artist && (
                <p className="text-[11px] font-light uppercase tracking-[0.2em] text-neutral-500">
                  {item.artist}
                </p>
              )}
              <h3
                className="mt-1 text-[17px] leading-snug text-neutral-900 line-clamp-2"
                style={{
                  fontFamily: "Times New Roman, serif",
                  fontWeight: 400,
                }}
              >
                {item.title}
              </h3>
              {item.subtitle && (
                <p className="mt-2 text-sm font-light leading-relaxed text-neutral-700 line-clamp-2">
                  {item.subtitle}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TheStudioPage;

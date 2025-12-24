import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import StudioArticleAudioPlayer from "../../../components/StudioArticleAudioPlayer";

type Article = {
  id: string;
  title: string;
  body: string;
  author?: string | null;
  created_at?: string | null;
  audio_url?: string | null;
  audio_cover_url?: string | null;
};

const formatArticleDate = (iso?: string | null) => {
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

  return `${day} ${month} ${year}`;
};

const StudioArticlePage = () => {
  const router = useRouter();
  const supabase = useSupabaseClient<any>();
  const { slug } = router.query;

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug || typeof slug !== "string") return;

    const fetchArticle = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("studio_articles")
        .select("id, title, body, author, created_at, audio_url, audio_cover_url")
        .eq("slug", slug)
        .maybeSingle();

      if (error) {
        console.error("Error fetching studio_article:", error);
      }
      setArticle((data || null) as Article | null);
      setLoading(false);
    };

    fetchArticle();
  }, [slug, supabase]);

  const hasAudio = !!article?.audio_url;

  return (
    <main className="min-h-screen bg-white">
      {/* TOP — back button (sticky + safe-area + EXTRA SPACE) */}
      <div className="sticky top-0 z-50 bg-white">
        <div
          className="w-full border-b border-neutral-200"
          style={{
            paddingTop: "calc(env(safe-area-inset-top) + 2.25rem)", // EXTRA arriba (más que suficiente)
            paddingBottom: "1.25rem",
          }}
        >
          <div className="mx-auto max-w-[720px] px-5 md:px-6 flex items-center justify-between">
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
      </div>

      <div
        className="mx-auto max-w-[720px] px-5 md:px-6"
        style={{
          paddingTop: "1.25rem",
          // EXTRA abajo: bottom bar + safe-area + margen adicional para el player/podcast
          paddingBottom: hasAudio
            ? "calc(260px + env(safe-area-inset-bottom))"
            : "calc(170px + env(safe-area-inset-bottom))",
        }}
      >
        {loading && (
          <div className="mt-10 space-y-4">
            <div className="h-4 w-24 bg-neutral-100 rounded-full" />
            <div className="h-8 w-3/4 bg-neutral-100 rounded-md" />
            <div className="h-4 w-1/2 bg-neutral-100 rounded-md" />
          </div>
        )}

        {!loading && !article && (
          <p className="mt-10 text-sm text-neutral-600">
            This piece is no longer available.
          </p>
        )}

        {!loading && article && (
          <article className="mt-6">
            <h1
              className="mt-3 text-[2rem] leading-tight text-neutral-900 sm:text-[2.4rem]"
              style={{ fontFamily: "Times New Roman, serif", fontWeight: 400 }}
            >
              {article.title}
            </h1>

            <p className="mt-3 text-[11px] font-light uppercase tracking-[0.22em] text-neutral-500">
              {article.author} · {formatArticleDate(article.created_at)}
            </p>

            {article.audio_url ? (
              <div className="mt-6">
                <StudioArticleAudioPlayer
                  src={article.audio_url}
                  title={article.title}
                  author={article.author}
                  brand="Walcord"
                  artworkUrl={article.audio_cover_url || null}
                  storageKey={`walcord:studio-audio:${slug}`}
                />
              </div>
            ) : null}

            <div className="mt-8 border-t border-neutral-200 pt-6">
              {article.body
                .split(/\n{2,}/)
                .filter((p) => p.trim().length > 0)
                .map((paragraph, index) => (
                  <p
                    key={index}
                    className="mt-4 text-[17px] md:text-[18px] leading-relaxed text-neutral-800 font-light"
                    style={{ fontFamily: "Times New Roman, serif" }}
                  >
                    {paragraph.trim()}
                  </p>
                ))}
            </div>
          </article>
        )}
      </div>
    </main>
  );
};

export default StudioArticlePage;

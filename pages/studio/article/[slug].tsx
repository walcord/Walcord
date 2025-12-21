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

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-[720px] px-5 md:px-6 pt-6 pb-16">
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
          <article className="mt-8">
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

import React, { useEffect, useState } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useRouter } from "next/router";

type Article = {
  id: string;
  title: string;
  excerpt: string;
  slug: string;
  created_at?: string | null;
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

const StudioArticlesPage = () => {
  const supabase = useSupabaseClient<any>();
  const router = useRouter();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("studio_articles")
        .select("id, title, slug, excerpt, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching studio_articles list:", error);
      } else if (data) {
        setArticles(data as Article[]);
      }
      setLoading(false);
    };

    fetchArticles();
  }, [supabase]);

  const handleOpenArticle = (slug: string) => {
    router.push(`/studio/article/${slug}`);
  };

  return (
    <main className="min-h-screen bg-white">
      {/* TOP — back button (sticky + safe-area + EXTRA SPACE) */}
      <div className="sticky top-0 z-50 bg-white">
        <div
          className="w-full px-5 md:px-6 border-b border-neutral-200"
          style={{
            paddingTop: "calc(env(safe-area-inset-top) + 2.25rem)", // MÁS espacio arriba (extra)
            paddingBottom: "1.25rem",
          }}
        >
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              title="Back"
              className="flex items-center gap-2 text-[#264AAE] font-light text-[0.95rem]"
            >
              <span className="text-[1.35rem] leading-none -mt-[1px]">‹</span>
              <span>Back</span>
            </button>

            {/* spacer para centrar visualmente y mantener look limpio */}
            <div className="w-[60px]" />
          </div>
        </div>
      </div>

      <div
        className="mx-auto max-w-[500px] sm:max-w-[620px] md:max-w-[760px] lg:max-w-[820px] px-5 md:px-6"
        style={{
          paddingTop: "1.6rem",
          paddingBottom: "calc(160px + env(safe-area-inset-bottom))", // MÁS espacio abajo por la bottom bar
        }}
      >
        {/* HEADER */}
        <header>
          <h1
            className="text-[clamp(1.6rem,5vw,2.4rem)] font-normal tracking-tight text-neutral-900"
            style={{ fontFamily: "Times New Roman, serif" }}
          >
            Articles
          </h1>
          <p className="mt-2 max-w-xl text-sm font-light text-neutral-600">
            Long-form writing on music, cities and the listeners around them.
          </p>
        </header>

        {/* LISTA EDITORIAL */}
        {loading ? (
          <div className="mt-10 space-y-5">
            <div className="h-4 w-40 rounded-full bg-neutral-100" />
            <div className="h-5 w-3/4 rounded-full bg-neutral-100" />
            <div className="h-4 w-2/3 rounded-full bg-neutral-100" />
          </div>
        ) : articles.length === 0 ? (
          <p className="mt-10 text-sm text-neutral-600">
            The first Walcord pieces are being edited.
          </p>
        ) : (
          <section className="mt-8 border-t border-neutral-200 pt-8 space-y-8">
            {articles.map((article) => (
              <article
                key={article.id}
                className="cursor-pointer space-y-2 pb-6 border-b border-neutral-200 last:border-b-0 last:pb-0"
                onClick={() => handleOpenArticle(article.slug)}
              >
                <h2
                  className="text-[1.4rem] leading-snug text-neutral-900 sm:text-[1.5rem]"
                  style={{
                    fontFamily: "Times New Roman, serif",
                    fontWeight: 400,
                  }}
                >
                  {article.title}
                </h2>

                <p className="text-[11px] font-light uppercase tracking-[0.22em] text-neutral-500">
                  {formatArticleDate(article.created_at)}
                </p>

                <p className="mt-2 text-sm font-light leading-relaxed text-neutral-700">
                  {article.excerpt}
                </p>

                <button
                  type="button"
                  className="mt-2 inline-flex items-center text-[11px] font-medium tracking-[0.18em] text-neutral-700"
                >
                  READ
                  <span className="ml-1 text-[13px]">→</span>
                </button>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
};

export default StudioArticlesPage;

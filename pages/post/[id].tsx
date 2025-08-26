'use client';

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";

/** Icono like */
function WalcordLike({ filled }: { filled: boolean }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill={filled ? "#1F48AF" : "none"} stroke="#1F48AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "all 0.3s ease" }}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" fill={filled ? "#fff" : "none"} />
    </svg>
  );
}

/** Flecha back */
function ArrowLeftMini() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export default function PostDetail() {
  const router = useRouter();
  const { id } = router.query;
  const supabase = useSupabaseClient();
  const user = useUser();

  const [post, setPost] = useState<any>(null);
  const [likes, setLikes] = useState<any[]>([]);
  const [isLiked, setIsLiked] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      await Promise.all([fetchPost(), fetchLikes(), fetchComments()]);
    })();
  }, [id]);

  async function fetchPost() {
    const { data } = await supabase
      .from("posts")
      .select(`
        id, user_id, record_id, era, caption, image_urls, created_at,
        profiles:profiles!posts_user_id_fkey ( username, avatar_url ),
        records:records!posts_record_id_fkey ( title, artist_name, vibe_color, cover_color )
      `)
      .eq("id", id)
      .single();
    setPost(data);
  }

  async function fetchLikes() {
    const { data } = await supabase
      .from("post_likes")
      .select(`
        user_id,
        profiles:profiles!post_likes_user_id_fkey ( username, avatar_url )
      `)
      .eq("post_id", id);
    const list = data || [];
    setLikes(list);
    if (user?.id) setIsLiked(list.some((l: any) => l.user_id === user.id));
  }

  async function fetchComments() {
    const { data } = await supabase
      .from("post_comments")
      .select(`
        id, comment, created_at, user_id,
        profiles:profiles!post_comments_user_id_fkey ( username, avatar_url )
      `)
      .eq("post_id", id)
      .order("created_at", { ascending: true });
    setComments(data || []);
  }

  async function toggleLike() {
    if (!user) return;
    if (isLiked) {
      await supabase.from("post_likes").delete().match({ post_id: id, user_id: user.id });
    } else {
      await supabase.from("post_likes").insert({ post_id: id, user_id: user.id });
    }
    await fetchLikes();
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newComment.trim()) return;
    await supabase.from("post_comments").insert({
      post_id: id,
      user_id: user.id,
      comment: newComment.trim(),
    });
    setNewComment("");
    await fetchComments();
  }

  const cleanEra = useMemo(() => {
    const s = (post?.era || "").trim();
    return s.replace(/^\s*from\s+/i, "");
  }, [post?.era]);

  const images: string[] = useMemo(() => {
    if (!post?.image_urls) return [];
    try {
      const j = JSON.parse(post.image_urls);
      if (Array.isArray(j)) return j;
    } catch {}
    return String(post.image_urls).split(",").map((u: string) => u.trim()).filter(Boolean);
  }, [post?.image_urls]);

  return (
    <div className="min-h-screen bg-white">
      {/* Banner */}
      <header className="relative w-full bg-[#1F48AF]">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-6 py-6">
          <button onClick={() => router.back()} aria-label="Back" className="mr-2 grid h-8 w-8 place-items-center rounded-full bg-white/10 hover:bg-white/15 transition">
            <ArrowLeftMini />
          </button>

          {/* COVER */}
          <div className="relative flex items-center justify-center overflow-hidden rounded-md" style={{ width: 56, height: 56, backgroundColor: post?.records?.vibe_color || "#1F48AF" }}>
            <div className="rounded" style={{ width: 26, height: 26, backgroundColor: post?.records?.cover_color || "#ffffff" }} />
          </div>

          <div className="leading-tight">
            <h1 className="text-xl text-white" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
              {post?.records?.title ?? "Untitled record"}
            </h1>
            <p className="text-sm text-white/80" style={{ fontFamily: "Roboto, system-ui, sans-serif", fontWeight: 300 }}>
              {post?.records?.artist_name}
            </p>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto w/full max-w-6xl px-6 py-8">
        {post?.caption && (
          <p className="mb-6 text-[20px] leading-7 text-black/90" style={{ fontFamily: "Roboto, system-ui, sans-serif", fontWeight: 300 }}>
            {post.caption}
          </p>
        )}

        {images.length > 0 && (
          <section className="mb-8">
            <div className="columns-1 gap-6 sm:columns-2 lg:columns-3">
              {images.map((url, i) => (
                <div key={i} className="group mb-6 break-inside-avoid overflow-hidden rounded-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`photo-${i}`} className="w-full object-cover transition duration-500 ease-out group-hover:scale-[1.02] group-hover:blur-[1px] group-hover:opacity-95" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Interacciones */}
        <section className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button aria-label="Like" onClick={toggleLike} className="rounded-xl transition active:scale-95" title={isLiked ? "Unlike" : "Like"}>
              <WalcordLike filled={isLiked} />
            </button>

            <div className="flex -space-x-2">
              {likes.slice(0, 8).map((l) => (
                <div key={l.user_id} className="h-8 w-8 overflow-hidden rounded-full ring-2 ring-white" title={l.profiles?.username}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.profiles?.avatar_url || "/default-avatar.png"} alt={l.profiles?.username || "user"} className="h-full w-full object-cover" />
                </div>
              ))}
              {likes.length > 8 && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-xs">+{likes.length - 8}</div>
              )}
            </div>
          </div>

          {cleanEra && (
            <div className="text-sm text-black/50" style={{ fontFamily: "Roboto, system-ui, sans-serif", fontWeight: 300 }}>
              From {cleanEra}
            </div>
          )}
        </section>

        {/* Comentarios */}
        <section>
          <h2 className="mb-4 text-lg text-black/90" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
            Comments
          </h2>

          <div className="space-y-5">
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-3">
                <div className="h-8 w-8 overflow-hidden rounded-full bg-black/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.profiles?.avatar_url || "/default-avatar.png"} alt={c.profiles?.username || "user"} className="h-full w-full object-cover" />
                </div>
                <div>
                  <p className="text-[13px] leading-4 text-black/60" style={{ fontFamily: "Roboto, system-ui, sans-serif", fontWeight: 300 }}>
                    <span className="text-black/80">{c.profiles?.username}</span>
                  </p>
                  <p className="mt-1 text-[15px] text-black/90" style={{ fontFamily: "Roboto, system-ui, sans-serif", fontWeight: 300 }}>
                    {c.comment}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {user && (
            <form onSubmit={submitComment} className="mt-6 flex items-center gap-3">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment…"
                className="w-full rounded-xl border border-black/10 px-4 py-3 outline-none transition focus:border-[#1F48AF]/60"
                style={{ fontFamily: "Roboto, system-ui, sans-serif", fontWeight: 300 }}
              />
              <button type="submit" className="rounded-xl bg-[#1F48AF] px-5 py-3 text-white transition hover:opacity-90 active:scale-95" style={{ fontFamily: "Roboto, system-ui, sans-serif", fontWeight: 300 }}>
                Send
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}

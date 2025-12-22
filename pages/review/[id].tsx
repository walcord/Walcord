"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";

type FullReview = {
  id: string;
  body: string;
  createdAt: string;
  rating: number;
  userId: string | null;
  userName: string;
  userUsername?: string | null;
  userAvatarUrl?: string | null;
  recordId: string;
  recordTitle: string;
  recordYear: number;
  artistName: string;
  vibeColor: string;
  coverColor: string;
  likes: number;
  commentsCount: number;
};

type ReviewComment = {
  id: string;
  userName: string;
  body: string;
  createdAt: string;
};

type LikeUser = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
};

const ReviewPage: React.FC = () => {
  const router = useRouter();
  const supabase = useSupabaseClient();
  const user = useUser();

  const [review, setReview] = useState<FullReview | null>(null);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isLiking, setIsLiking] = useState(false);
  const [likedByMe, setLikedByMe] = useState(false);

  const [likesPanelOpen, setLikesPanelOpen] = useState(false);
  const [likesUsers, setLikesUsers] = useState<LikeUser[]>([]);
  const [loadingLikesUsers, setLoadingLikesUsers] = useState(false);

  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const reviewId = React.useMemo(() => {
    const { id } = router.query;
    if (Array.isArray(id)) return id[0];
    return id ?? null;
  }, [router.query]);

  /* ======================= LOAD REVIEW ======================= */

  const loadReview = useCallback(async () => {
    if (!reviewId) return;
    setIsLoading(true);

    try {
      const { data: rec, error: recError } = await supabase
        .from("recommendations")
        .select("id, user_id, target_type, target_id, body, created_at, rating_id")
        .eq("id", reviewId)
        .maybeSingle();

      if (recError || !rec) {
        console.error("Error loading review", recError);
        setIsLoading(false);
        return;
      }

      let recordId: string = (rec.target_id as string) || "";
      let ratingValue = 0;

      if (rec.rating_id) {
        const { data: ratingData, error: ratingError } = await supabase
          .from("ratings")
          .select("record_id, rate")
          .eq("id", rec.rating_id as string)
          .maybeSingle();

        if (!ratingError && ratingData) {
          recordId = (ratingData.record_id as string) ?? recordId;
          ratingValue = (ratingData.rate as number) ?? 0;
        }
      }

      const { data: record, error: recordError } = await supabase
        .from("records")
        .select("id, title, release_year, vibe_color, cover_color, artist_id")
        .eq("id", recordId)
        .maybeSingle();

      if (recordError || !record) {
        console.error("Error loading record for review", recordError);
        setIsLoading(false);
        return;
      }

      let artistName = "Unknown artist";
      if (record.artist_id) {
        const { data: artistData } = await supabase
          .from("artists")
          .select("name")
          .eq("id", record.artist_id as string)
          .maybeSingle();
        if (artistData?.name) artistName = artistData.name as string;
      }

      let userName = "walcord user";
      let userUsername: string | null = null;
      let avatarUrl: string | null | undefined = null;

      if (rec.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, full_name, avatar_url")
          .eq("id", rec.user_id as string)
          .maybeSingle();

        if (profile) {
          userUsername = (profile.username as string) ?? null;
          userName =
            (profile.full_name as string) ||
            (profile.username as string) ||
            "walcord user";
          avatarUrl = (profile.avatar_url as string) ?? null;
        }
      }

      let likes = 0;
      const { count: likesCount, error: likesError } = await supabase
        .from("recommendation_likes")
        .select("id", { count: "exact", head: true })
        .eq("recommendation_id", rec.id as string);

      if (!likesError && typeof likesCount === "number") likes = likesCount;

      let commentsCount = 0;
      const { count: commentsCountVal, error: commentsCountError } = await supabase
        .from("recommendation_comments")
        .select("id", { count: "exact", head: true })
        .eq("recommendation_id", rec.id as string);

      if (!commentsCountError && typeof commentsCountVal === "number") commentsCount = commentsCountVal;

      if (user) {
        const { data: myLike } = await supabase
          .from("recommendation_likes")
          .select("id")
          .eq("recommendation_id", rec.id as string)
          .eq("user_id", user.id)
          .maybeSingle();

        setLikedByMe(!!myLike);
      } else {
        setLikedByMe(false);
      }

      const createdAt = rec.created_at
        ? new Date(rec.created_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "";

      const full: FullReview = {
        id: rec.id as string,
        body: (rec.body as string) ?? "",
        createdAt,
        rating: typeof ratingValue === "number" ? ratingValue : 0,
        userId: (rec.user_id as string) ?? null,
        userName: userName || "walcord user",
        userUsername,
        userAvatarUrl: avatarUrl,
        recordId: record.id as string,
        recordTitle: (record.title as string) ?? "",
        recordYear: (record.release_year as number) ?? 0,
        artistName,
        vibeColor: (record.vibe_color as string) ?? "#0f172a",
        coverColor: (record.cover_color as string) ?? "#e5e7eb",
        likes,
        commentsCount,
      };

      setReview(full);
    } catch (err) {
      console.error("Unexpected error loading review", err);
    } finally {
      setIsLoading(false);
    }
  }, [reviewId, supabase, user]);

  /* ======================= LOAD COMMENTS ======================= */

  const loadComments = useCallback(async () => {
    if (!reviewId) return;

    try {
      const { data, error } = await supabase
        .from("recommendation_comments")
        .select("id, user_id, body, created_at")
        .eq("recommendation_id", reviewId)
        .order("created_at", { ascending: true });

      if (error || !data) {
        console.error("Error loading review comments", error);
        setComments([]);
        return;
      }

      const userIds = Array.from(new Set(data.map((c: any) => c.user_id).filter(Boolean)));

      let usersMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, full_name")
          .in("id", userIds);

        if (profiles) {
          usersMap = new Map(
            profiles.map((p: any) => [
              p.id as string,
              (p.full_name as string) || (p.username as string) || "walcord user",
            ])
          );
        }
      }

      const mapped: ReviewComment[] = data.map((c: any) => ({
        id: c.id as string,
        userName: usersMap.get(c.user_id as string) ?? (c.user_id ? "walcord user" : "walcord"),
        body: (c.body as string) ?? "",
        createdAt: c.created_at
          ? new Date(c.created_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "",
      }));

      setComments(mapped);
    } catch (err) {
      console.error("Unexpected error loading comments", err);
      setComments([]);
    }
  }, [reviewId, supabase]);

  /* ======================= LOAD LIKES USERS ======================= */

  const loadLikesUsers = useCallback(
    async (recommendationId: string) => {
      setLoadingLikesUsers(true);
      try {
        const { data, error } = await supabase
          .from("recommendation_likes")
          .select("user_id")
          .eq("recommendation_id", recommendationId)
          .order("created_at", { ascending: false });

        if (error || !data) {
          console.error("Error loading recommendation likes users", error);
          setLikesUsers([]);
          return;
        }

        const userIds = Array.from(new Set(data.map((r: any) => r.user_id).filter(Boolean)));

        if (userIds.length === 0) {
          setLikesUsers([]);
          return;
        }

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", userIds);

        if (profilesError || !profiles) {
          console.error("Error loading profiles for likes", profilesError);
          setLikesUsers([]);
          return;
        }

        const profileMap = new Map(profiles.map((p: any) => [p.id as string, p]));

        const mapped: LikeUser[] = data
          .map((row: any) => {
            const prof = profileMap.get(row.user_id as string) as any | undefined;
            return {
              user_id: row.user_id as string,
              username: prof?.username ?? null,
              avatar_url: prof?.avatar_url ?? null,
            } as LikeUser;
          })
          .filter(Boolean);

        setLikesUsers(mapped);
      } catch (err) {
        console.error("Unexpected error loading likes users", err);
        setLikesUsers([]);
      } finally {
        setLoadingLikesUsers(false);
      }
    },
    [supabase]
  );

  /* ======================= EFFECTS ======================= */

  useEffect(() => {
    if (!reviewId) return;
    loadReview();
    loadComments();
  }, [reviewId, loadReview, loadComments]);

  useEffect(() => {
    if (!likesPanelOpen || !review) return;
    loadLikesUsers(review.id);
  }, [likesPanelOpen, review, loadLikesUsers]);

  /* ======================= HANDLERS ======================= */

  const handleToggleLike = async () => {
    if (!review || !user || isLiking) return;
    setIsLiking(true);

    try {
      if (likedByMe) {
        const { error } = await supabase
          .from("recommendation_likes")
          .delete()
          .eq("recommendation_id", review.id)
          .eq("user_id", user.id);

        if (!error) {
          setLikedByMe(false);
          setReview((prev) => (prev ? { ...prev, likes: Math.max(0, prev.likes - 1) } : prev));
        }
      } else {
        const payload = { recommendation_id: review.id, user_id: user.id };
        const { error } = await supabase.from("recommendation_likes").insert([payload]);

        if (!error) {
          setLikedByMe(true);
          setReview((prev) => (prev ? { ...prev, likes: prev.likes + 1 } : prev));
        }
      }
    } catch (err) {
      console.error("Error toggling review like", err);
    } finally {
      setIsLiking(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!review || !user || !newComment.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      const payload = {
        recommendation_id: review.id,
        user_id: user.id,
        body: newComment.trim(),
      };

      const { data, error } = await supabase
        .from("recommendation_comments")
        .insert([payload])
        .select("id, created_at")
        .single();

      if (error || !data) {
        console.error("Error adding review comment", error);
        setIsSubmittingComment(false);
        return;
      }

      const createdAt = data.created_at
        ? new Date(data.created_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "";

      const newEntry: ReviewComment = {
        id: data.id as string,
        userName: user.user_metadata?.full_name || user.user_metadata?.username || "You",
        body: newComment.trim(),
        createdAt,
      };

      setComments((prev) => [...prev, newEntry]);
      setNewComment("");
      setReview((prev) => (prev ? { ...prev, commentsCount: prev.commentsCount + 1 } : prev));
    } catch (err) {
      console.error("Unexpected error posting comment", err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleGoToRecord = () => {
    if (!review) return;
    router.push(`/record/${review.recordId}`);
  };

  const handleGoToProfile = () => {
    if (!review?.userUsername) return;
    router.push(`/u/${review.userUsername}`);
  };

  const closeLikesPanel = () => setLikesPanelOpen(false);

  /* ======================= RENDER ======================= */

  if (isLoading) {
    return (
      <main className="min-h-[100dvh] bg-white">
        <div className="mx-auto max-w-[820px] px-5 md:px-6 pt-10 pb-16">
          <p className="text-sm text-neutral-500">Loading review…</p>
        </div>
      </main>
    );
  }

  if (!review) {
    return (
      <main className="min-h-[100dvh] bg-white">
        <div className="mx-auto max-w-[820px] px-5 md:px-6 pt-10 pb-16">
          <p className="text-sm text-neutral-500">This review could not be found.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-white">
      {/* TOP — back button */}
      <div className="w-full px-5 sm:px-12 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-3 flex items-center justify-between bg-white">
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

      {/* ✅ TOP META BAR (bulletproof para iOS) */}
      <div className="mx-auto max-w-[820px] px-5 md:px-6">
        <div className="mt-1 mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={handleGoToProfile}
            disabled={!review.userUsername}
            className={`flex items-center gap-3 text-left ${
              review.userUsername ? "hover:opacity-90" : ""
            } disabled:opacity-100`}
            aria-label={review.userUsername ? `Open @${review.userUsername} profile` : "Profile"}
          >
            <div className="h-9 w-9 overflow-hidden rounded-full bg-neutral-200">
              {review.userAvatarUrl && (
                <img src={review.userAvatarUrl} alt={review.userName || "walcord user"} className="h-full w-full object-cover" />
              )}
            </div>
            <div>
              <p className="text-[13px] font-medium text-neutral-900">{review.userName || "walcord user"}</p>
              <p className="text-[11px] font-light text-neutral-500">{review.createdAt}</p>
            </div>
          </button>

          <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-neutral-900 text-[13px] font-medium text-neutral-900 bg-white">
            {typeof review.rating === "number" ? review.rating : 0}
            <div className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[#1F48AF] bg-white">
              <div className="h-1.5 w-1.5 rounded-full bg-[#1F48AF]" />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[820px] px-5 md:px-6 pt-2 sm:pt-3 pb-24">
        {/* MAIN CARD */}
        <article className="rounded-[32px] border border-neutral-200 bg-white px-5 py-5 sm:px-7 sm:py-7 shadow-[0_22px_70px_rgba(0,0,0,0.10)]">
          {/* Record context */}
          <section className="flex items-center gap-4">
            <button type="button" onClick={handleGoToRecord} className="group flex items-center gap-4 text-left">
              <div className="relative w-[60px] sm:w-[72px]">
                <div className="pt-[100%]" />
                <div className="absolute inset-0">
                  <div className="absolute inset-0" style={{ backgroundColor: review.vibeColor }} />
                  <div className="absolute inset-[28%] shadow-md" style={{ backgroundColor: review.coverColor }} />
                </div>
              </div>
              <div>
                <p
                  className="text-[14px] font-medium text-neutral-900 group-hover:underline"
                  style={{ fontFamily: "Times New Roman, serif" }}
                >
                  {review.artistName} — {review.recordTitle}
                </p>
                <p className="text-[11px] font-light uppercase tracking-[0.22em] text-neutral-500">
                  Record from {review.recordYear}
                </p>
              </div>
            </button>
          </section>

          {/* Body text */}
          <section className="mt-6">
            <p className="text-[14px] font-light leading-relaxed text-neutral-900">{review.body}</p>
          </section>

          {/* Footer: likes + counts */}
          <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleToggleLike}
                disabled={!user || isLiking}
                className={`inline-flex items-center rounded-full border px-5 py-1.5 text-[13px] font-normal transition ${
                  likedByMe
                    ? "border-[#1F48AF] text-[#1F48AF]"
                    : "border-neutral-400 text-neutral-800 hover:border-neutral-900"
                } disabled:opacity-40`}
              >
                {likedByMe ? "Liked" : "Like"}
              </button>

              <button
                type="button"
                onClick={() => setLikesPanelOpen(true)}
                className="text-[11px] font-light text-neutral-500 hover:text-neutral-900"
              >
                {review.likes} {review.likes === 1 ? "like" : "likes"}
              </button>
            </div>

            <p className="text-[11px] font-light text-neutral-500">
              {review.commentsCount} {review.commentsCount === 1 ? "comment" : "comments"}
            </p>
          </footer>
        </article>

        {/* COMMENTS */}
        <section className="mt-8 space-y-5">
          <h2 className="text-[12px] font-medium uppercase tracking-[0.24em] text-neutral-500">Comments</h2>

          {/* New comment */}
          <div className="rounded-3xl border border-neutral-200 bg-white px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.04)]">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={user ? "Share your thoughts about this review…" : "Log in to comment on this review."}
              disabled={!user}
              className="w-full min-h-[80px] resize-none border-none bg-transparent text-sm outline-none placeholder:text-neutral-400"
            />
            <div className="mt-3 flex items-center justify-end">
              <button
                type="button"
                disabled={!user || !newComment.trim() || isSubmittingComment}
                onClick={handleSubmitComment}
                className="rounded-full px-5 h-8 text-xs text-white enabled:hover:opacity-90 disabled:opacity-40 transition"
                style={{ backgroundColor: "#1F48AF" }}
              >
                Post comment
              </button>
            </div>
          </div>

          {/* Comments list */}
          <div className="space-y-3">
            {comments.length === 0 && (
              <p className="text-[12px] font-light text-neutral-500">No comments yet. Be the first to comment.</p>
            )}
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-3xl border border-neutral-200 bg-white px-4 py-3 shadow-[0_10px_28px_rgba(0,0,0,0.04)]"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[13px] font-medium text-neutral-900">{comment.userName}</p>
                  <p className="text-[11px] font-light text-neutral-500">{comment.createdAt}</p>
                </div>
                <p className="text-[13px] font-light leading-relaxed text-neutral-800">{comment.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* LIKES BOTTOM SHEET */}
      <div
        className={`fixed inset-0 z-40 flex items-end justify-center ${
          likesPanelOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity ${likesPanelOpen ? "opacity-100" : "opacity-0"}`}
          onClick={closeLikesPanel}
        />

        <div
          className={`relative w-full max-w-md rounded-t-3xl bg-white shadow-[0_-12px_40px_rgba(15,23,42,0.18)] transition-transform duration-300 ${
            likesPanelOpen ? "translate-y-0" : "translate-y-full"
          }`}
          style={{
            maxHeight: "calc(100dvh - (env(safe-area-inset-top) + 72px))",
            paddingTop: "14px",
            paddingBottom: "calc(env(safe-area-inset-bottom) + 92px)",
          }}
        >
          <div className="flex items-center justify-center mb-2">
            <div className="h-1 w-10 rounded-full bg-neutral-300" />
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-center text-neutral-500 mb-3">Likes</p>

          <div
            className="px-4 pb-1 overflow-y-auto"
            style={{ maxHeight: "calc(100dvh - (env(safe-area-inset-top) + 72px + 92px + 56px))" }}
          >
            {loadingLikesUsers ? (
              <p className="py-4 text-sm text-neutral-500 text-center">Loading…</p>
            ) : likesUsers.length === 0 ? (
              <p className="py-4 text-sm text-neutral-500 text-center">No likes yet.</p>
            ) : (
              likesUsers.map((u) => (
                <button
                  key={u.user_id}
                  type="button"
                  onClick={() => {
                    if (!u.username) return;
                    closeLikesPanel();
                    router.push(`/u/${u.username}`);
                  }}
                  className={`w-full flex items-center justify-between py-2 text-left ${
                    u.username ? "hover:bg-neutral-50 rounded-xl px-2 -mx-2" : ""
                  }`}
                  disabled={!u.username}
                  aria-label={u.username ? `Open @${u.username} profile` : "User"}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-neutral-200 overflow-hidden">
                      {u.avatar_url && (
                        <img src={u.avatar_url} alt={u.username || ""} className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{u.username || "user"}</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default ReviewPage;

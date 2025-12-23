"use client";

import type React from "react";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import WalcordCircle from "../../components/icons/WalcordCircle";
import Link from "next/link";

/** Tooltip minimal Walcord */
const Tooltip = ({ children, message }: { children: React.ReactNode; message: string }) => (
  <div className="group relative flex justify-center items-center">
    {children}
    <span
      className="absolute bottom-full mb-2 w-max max-w-[240px] scale-0 group-hover:scale-100 transition-all bg-[#1F48AF] text-white text-xs px-3 py-[6px] rounded z-10 whitespace-nowrap font-light"
      style={{ fontFamily: "Roboto" }}
    >
      {message}
    </span>
  </div>
);

/** Badge editorial del rating */
const RatingBadge = ({ rate, size = 44 }: { rate: number; size?: number }) => {
  if (Number.isNaN(rate)) return null;
  const box = size;
  const dotBox = Math.max(14, Math.round(size * 0.32));
  const dot = Math.max(6, Math.round(size * 0.14));
  return (
    <div
      className="relative inline-flex items-center justify-center rounded-full border border-neutral-900 bg-white text-neutral-900 select-none"
      style={{ width: box, height: box, fontSize: Math.max(12, Math.round(size * 0.3)) }}
    >
      {rate}
      <div
        className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border border-[#1F48AF] bg-white"
        style={{ width: dotBox, height: dotBox }}
      >
        <div className="rounded-full bg-[#1F48AF]" style={{ width: dot, height: dot }} />
      </div>
    </div>
  );
};

/** Modal simple y limpio */
const Modal = ({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg" style={{ fontFamily: "Times New Roman" }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-black text-sm font-light"
            style={{ fontFamily: "Roboto" }}
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url?: string | null;
};

type Thought = {
  id: string;
  user_id: string;
  target_type: "record" | "artist" | "track";
  target_id: string;
  body: string;
  created_at: string;
  profile?: Profile;
  likes_count?: number;
  comments_count?: number;
  liked_by_me?: boolean;
  rating_id?: string | null;
  rate?: number | null;
};

type ThoughtComment = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile?: Profile;
};

type LikeUser = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
};

export default function RecordProfile() {
  const router = useRouter();
  const { id } = router.query;
  const recordId = Array.isArray(id) ? id[0] : (id as string | undefined);

  const [record, setRecord] = useState<any>(null);
  const [averageRate, setAverageRate] = useState<number | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [meProfile, setMeProfile] = useState<Profile | null>(null);
  const [isFromFavouriteArtist, setIsFromFavouriteArtist] = useState<boolean>(false);

  const [loginOpen, setLoginOpen] = useState(false);
  const [loginTitle, setLoginTitle] = useState<string>("Sign in to continue");
  const requireAuth = (title: string) => {
    if (!userId) {
      setLoginTitle(title);
      setLoginOpen(true);
      return false;
    }
    return true;
  };

  // ✅ FAVOURITE RECORD (Add button)
  const [isFavourite, setIsFavourite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  const [takesLoading, setTakesLoading] = useState<boolean>(true);
  const [takes, setTakes] = useState<Thought[]>([]);
  const [takeBody, setTakeBody] = useState<string>("");
  const [takeRate, setTakeRate] = useState<number | null>(null);
  const [takePosting, setTakePosting] = useState<boolean>(false);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentsMap, setCommentsMap] = useState<Record<string, ThoughtComment[]>>({});
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState<string>("");
  const [hasMyTake, setHasMyTake] = useState<boolean>(false);
  const composerRef = useRef<HTMLDivElement | null>(null);

  const [composerOpen, setComposerOpen] = useState<boolean>(false);
  const [ratePickerOpen, setRatePickerOpen] = useState<boolean>(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState<string>("");

  const [likesPanelOpen, setLikesPanelOpen] = useState(false);
  const [likesUsers, setLikesUsers] = useState<LikeUser[]>([]);
  const [loadingLikesUsers, setLoadingLikesUsers] = useState(false);
  const [likesForRecId, setLikesForRecId] = useState<string | null>(null);

  /** Sync auth + profile */
  useEffect(() => {
    const syncUser = async () => {
      const u = (await supabase.auth.getUser()).data.user;
      const uid = u?.id || null;
      setUserId(uid);

      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url")
          .eq("id", uid)
          .maybeSingle();
        if (prof) setMeProfile(prof as Profile);
      } else {
        setMeProfile(null);
      }
    };

    syncUser();

    // Mantener sincronizado si cambia sesión
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      syncUser();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshIsFavourite = async (recId: string, myUid: string | null) => {
    if (!myUid) {
      setIsFavourite(false);
      return;
    }

    const { data, error } = await supabase
      .from("favourite_records")
      .select("id")
      .eq("user_id", myUid)
      .eq("records_id", recId)
      .maybeSingle();

    if (error) {
      setIsFavourite(false);
      return;
    }
    setIsFavourite(!!data);
  };

  /** Load record + ratings + favArtist + isFavourite + takes */
  useEffect(() => {
    if (!recordId) return;

    const fetchAll = async () => {
      const { data: recordData } = await supabase.from("records").select("*").eq("id", recordId).single();
      if (!recordData) return;

      const { data: artistData } = await supabase
        .from("artists")
        .select("id, name")
        .eq("name", recordData.artist_name)
        .single();

      const { data: ratingsData } = await supabase.from("ratings").select("rate").eq("record_id", recordId);
      const avg =
        ratingsData && ratingsData.length > 0
          ? ratingsData.reduce((sum: number, r: any) => sum + r.rate, 0) / ratingsData.length
          : null;

      const u = (await supabase.auth.getUser()).data.user;

      await refreshIsFavourite(recordId, u?.id || null);

      if (u?.id && artistData) {
        const { data: favArtist } = await supabase
          .from("favourite_artists")
          .select("id")
          .eq("user_id", u.id)
          .eq("artist_id", artistData.id);

        setIsFromFavouriteArtist(!!(favArtist && favArtist.length > 0));

        const { data: userRate } = await supabase
          .from("ratings")
          .select("rate")
          .eq("user_id", u.id)
          .eq("record_id", recordId)
          .maybeSingle();

        if (userRate) {
          setUserRating(userRate.rate);
          setTakeRate(userRate.rate);
        } else {
          setUserRating(null);
        }
      } else {
        setIsFromFavouriteArtist(false);
      }

      setRecord({ ...recordData, artist: artistData });
      setAverageRate(avg);

      await loadTakes(recordId, u?.id || null);
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  /** Si cambia userId con el record cargado, recalculamos fav */
  useEffect(() => {
    if (!recordId) return;
    refreshIsFavourite(recordId, userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, recordId]);

  const toggleFavourite = async () => {
    if (!recordId) return;
    if (!requireAuth("Sign in to add this record to favourites")) return;
    if (!userId) return;
    if (favLoading) return;

    setFavLoading(true);
    try {
      if (isFavourite) {
        const { error } = await supabase
          .from("favourite_records")
          .delete()
          .eq("user_id", userId)
          .eq("records_id", recordId);

        if (!error) setIsFavourite(false);
      } else {
        const { error } = await supabase
          .from("favourite_records")
          .upsert({ user_id: userId, records_id: recordId }, { onConflict: "user_id,records_id" });

        if (!error) setIsFavourite(true);
      }
    } finally {
      setFavLoading(false);
    }
  };

  const handleRate = async (rate: number) => {
    if (!requireAuth("Sign in to rate this record")) return;
    if (!userId || !recordId) return;

    if (userRating === rate && hasMyTake) {
      alert("You already shared a take for this record. Delete your take before removing the rating.");
      return;
    }

    if (userRating === rate) {
      await supabase.from("ratings").delete().eq("user_id", userId).eq("record_id", recordId);
      setUserRating(null);
      setTakeRate(null);
    } else {
      await supabase
        .from("ratings")
        .upsert({ user_id: userId, record_id: recordId, rate }, { onConflict: "user_id,record_id" });
      setUserRating(rate);
      setTakeRate(rate);
    }

    const { data: ratingsData } = await supabase.from("ratings").select("rate").eq("record_id", recordId);
    const avg =
      ratingsData && ratingsData.length > 0
        ? ratingsData.reduce((sum: number, r: any) => sum + r.rate, 0) / ratingsData.length
        : null;

    setAverageRate(avg);
  };

  const loadTakes = async (recId: string, myId: string | null) => {
    setTakesLoading(true);
    const { data: recs, error } = await supabase
      .from("recommendations")
      .select("id, user_id, target_type, target_id, body, created_at, rating_id")
      .eq("target_type", "record")
      .eq("target_id", recId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      setTakes([]);
      setHasMyTake(false);
      setTakesLoading(false);
      return;
    }

    const userIds = Array.from(new Set((recs || []).map((r: any) => r.user_id)));
    const profiles: Record<string, Profile> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .in("id", userIds);
      (profs || []).forEach((p: any) => (profiles[p.id] = p));
    }

    const ratingIds = Array.from(
      new Set((recs || []).map((r: any) => r.rating_id).filter((x: any) => x !== null && x !== undefined))
    ) as string[];

    const rateByRatingId: Record<string, number> = {};
    if (ratingIds.length) {
      const { data: ratingRows } = await supabase.from("ratings").select("id, rate").in("id", ratingIds as any);
      (ratingRows || []).forEach((r: any) => {
        rateByRatingId[String(r.id)] = r.rate as number;
      });
    }

    const ids = (recs || []).map((r: any) => r.id);
    const likesCount: Record<string, number> = {};
    const commentsCount: Record<string, number> = {};
    const likedSet = new Set<string>();

    if (ids.length) {
      const { data: likes } = await supabase
        .from("recommendation_likes")
        .select("recommendation_id")
        .in("recommendation_id", ids as any);

      (likes || []).forEach((row: any) => {
        const k = String(row.recommendation_id);
        likesCount[k] = (likesCount[k] || 0) + 1;
      });

      const { data: comments } = await supabase
        .from("recommendation_comments")
        .select("recommendation_id")
        .in("recommendation_id", ids as any);

      (comments || []).forEach((row: any) => {
        const k = String(row.recommendation_id);
        commentsCount[k] = (commentsCount[k] || 0) + 1;
      });

      if (myId) {
        const { data: myLikes } = await supabase
          .from("recommendation_likes")
          .select("recommendation_id")
          .in("recommendation_id", ids as any)
          .eq("user_id", myId);

        (myLikes || []).forEach((row: any) => likedSet.add(row.recommendation_id));
      }
    }

    const mapped: Thought[] = (recs || []).map((r: any) => ({
      ...r,
      profile: profiles[r.user_id],
      likes_count: likesCount[String(r.id)] ?? 0,
      comments_count: commentsCount[String(r.id)] ?? 0,
      liked_by_me: likedSet.has(r.id),
      rate: (r.rating_id ? (rateByRatingId[String(r.rating_id)] ?? null) : null) ?? null,
    }));

    setTakes(mapped);
    setHasMyTake(!!myId && !!mapped.find((t) => t.user_id === myId));
    setTakesLoading(false);
  };

  const postTake = async () => {
    if (!recordId) return;
    if (!requireAuth("Sign in to share your take")) return;
    const bodyClean = takeBody.trim();
    if (bodyClean.length === 0) return;
    if (!userId) return;

    if (takeRate == null) {
      alert("Please select a rating (1–10) to publish your take.");
      return;
    }

    setTakePosting(true);

    const { data: ratingRow, error: ratingErr } = await supabase
      .from("ratings")
      .upsert({ user_id: userId, record_id: recordId, rate: takeRate }, { onConflict: "user_id,record_id" })
      .select("id")
      .single();

    if (ratingErr || !ratingRow) {
      setTakePosting(false);
      alert("Error saving the rating for this take.");
      return;
    }

    const { error } = await supabase.from("recommendations").insert({
      user_id: userId,
      target_type: "record",
      target_id: recordId,
      body: bodyClean,
      rating_id: ratingRow.id,
    });

    if (error) {
      alert(`Error posting: ${error.message}`);
    } else {
      await loadTakes(recordId, userId);
      setHasMyTake(true);
    }

    setTakePosting(false);
    setTakeBody("");
    setRatePickerOpen(false);
    setComposerOpen(false);
  };

  const toggleLike = async (rec: Thought) => {
    if (!requireAuth("Sign in to like")) return;
    if (!userId) return;

    if (rec.liked_by_me) {
      await supabase.from("recommendation_likes").delete().match({ recommendation_id: rec.id, user_id: userId });
      setTakes((prev) =>
        prev.map((it) =>
          it.id === rec.id ? { ...it, liked_by_me: false, likes_count: Math.max(0, (it.likes_count || 0) - 1) } : it
        )
      );
    } else {
      await supabase.from("recommendation_likes").insert({ recommendation_id: rec.id, user_id: userId });
      setTakes((prev) =>
        prev.map((it) => (it.id === rec.id ? { ...it, liked_by_me: true, likes_count: (it.likes_count || 0) + 1 } : it))
      );
    }
  };

  const loadLikesUsers = async (recommendationId: string) => {
    setLoadingLikesUsers(true);
    setLikesForRecId(recommendationId);

    try {
      const { data, error } = await supabase
        .from("recommendation_likes")
        .select("user_id")
        .eq("recommendation_id", recommendationId)
        .order("created_at", { ascending: false });

      if (error || !data) {
        setLikesUsers([]);
        return;
      }

      const userIds = Array.from(new Set((data || []).map((r: any) => r.user_id).filter(Boolean)));
      if (userIds.length === 0) {
        setLikesUsers([]);
        return;
      }

      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

      if (profErr || !profiles) {
        setLikesUsers([]);
        return;
      }

      const profileMap = new Map(profiles.map((p: any) => [p.id as string, p]));
      const mapped: LikeUser[] = (data || [])
        .map((row: any) => {
          const p = profileMap.get(row.user_id as string) as any | undefined;
          return {
            user_id: row.user_id as string,
            username: p?.username ?? null,
            avatar_url: p?.avatar_url ?? null,
          } as LikeUser;
        })
        .filter(Boolean);

      setLikesUsers(mapped);
    } finally {
      setLoadingLikesUsers(false);
    }
  };

  const loadComments = async (rid: string) => {
    const { data, error } = await supabase
      .from("recommendation_comments")
      .select("id, user_id, body, created_at")
      .eq("recommendation_id", rid)
      .order("created_at", { ascending: true });

    if (error) return;

    const uids = Array.from(new Set((data || []).map((c: any) => c.user_id)));
    const pmap: Record<string, Profile> = {};
    if (uids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .in("id", uids);

      (profs || []).forEach((p: any) => (pmap[p.id] = p));
    }

    const mapped: ThoughtComment[] = (data || []).map((c: any) => ({
      ...c,
      profile: pmap[c.user_id],
    }));

    setCommentsMap((prev) => ({ ...prev, [rid]: mapped }));
  };

  const sendReply = async () => {
    if (!replyFor || !userId) return;
    const bodyClean = replyBody.trim();
    if (bodyClean.length === 0) return;

    const { data, error } = await supabase
      .from("recommendation_comments")
      .insert({
        recommendation_id: replyFor,
        user_id: userId,
        body: bodyClean,
      })
      .select("id, created_at")
      .single();

    if (!error && data) {
      setTakes((prev) =>
        prev.map((it) => (it.id === replyFor ? { ...it, comments_count: (it.comments_count || 0) + 1 } : it))
      );

      setCommentsMap((prev) => {
        const prevList = prev[replyFor] || [];
        const newItem: ThoughtComment = {
          id: data.id,
          user_id: userId,
          body: bodyClean,
          created_at: data.created_at,
          profile: meProfile
            ? { id: userId, full_name: meProfile.full_name, username: meProfile.username, avatar_url: meProfile.avatar_url }
            : { id: userId, full_name: "—", username: null, avatar_url: null },
        };
        return { ...prev, [replyFor]: [...prevList, newItem] };
      });
    }

    setReplyBody("");
    setReplyFor(null);
  };

  const beginEdit = (t: Thought) => {
    setEditingId(t.id);
    setEditingBody(t.body);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditingBody("");
  };
  const saveEdit = async () => {
    if (!editingId) return;
    const bodyClean = editingBody.trim();
    if (bodyClean.length === 0) return;

    const { error } = await supabase
      .from("recommendations")
      .update({ body: bodyClean })
      .eq("id", editingId)
      .eq("user_id", userId || "");

    if (!error) {
      setTakes((prev) => prev.map((it) => (it.id === editingId ? { ...it, body: bodyClean } : it)));
      cancelEdit();
    }
  };

  const deleteTake = async (rid: string) => {
    if (!confirm("Delete this take?")) return;
    await supabase.from("recommendations").delete().eq("id", rid).eq("user_id", userId || "");

    setTakes((prev) => prev.filter((it) => it.id !== rid));
    setHasMyTake((prev) => {
      const stillMine = takes.some((t) => t.id !== rid && t.user_id === userId);
      return stillMine;
    });
  };

  if (!record) {
    return (
      <main className="flex justify-center items-center h-screen text-gray-500 text-sm">
        Loading record...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
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

      {/* Wrapper with comfortable top + strong bottom spacing for iOS tab bar */}
      <div className="mx-auto max-w-[820px] px-5 md:px-6 pt-2 sm:pt-3 pb-[calc(env(safe-area-inset-bottom)+140px)]">
        {/* ===== RECORD HEADER ===== */}
        <section className="pb-6 border-b border-neutral-200">
          {/* Cover centrado, bordes más cuadrados */}
          <div className="flex justify-center">
            <div className="w-full max-w-[228px]">
              <div className="relative w-full">
                <div className="pt-[100%]" />
                <div className="absolute inset-0 overflow-hidden rounded-[18px] border border-neutral-200">
                  <div className="absolute inset-0" style={{ backgroundColor: record.vibe_color }} />
                  <div className="absolute inset-[34%] rounded-[8px]" style={{ backgroundColor: record.cover_color }} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 text-center">
            <h1
              className="text-[26px] leading-tight text-neutral-900"
              style={{ fontFamily: "Times New Roman, serif", letterSpacing: "-0.02em" }}
            >
              {record.title}
            </h1>
            <p className="mt-1 text-[12px] text-neutral-600">by {record.artist?.name}</p>
          </div>

          {record.description && (
            <p className="mt-4 text-center text-[13px] font-light leading-relaxed text-neutral-700">{record.description}</p>
          )}

          <p className="mt-3 text-center text-[11px] font-light uppercase tracking-[0.22em] text-neutral-500">
            Released in {record.release_year}
          </p>

          {/* ✅ CLEAN: Average + Add arriba, pill debajo */}
          <div className="mt-6 flex flex-col items-center gap-3">
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={toggleFavourite}
                disabled={favLoading}
                className={`h-8 rounded-full px-6 text-[11px] transition whitespace-nowrap ${
                  isFavourite
                    ? "bg-white border border-[#1F48AF] text-[#1F48AF] hover:bg-[#1F48AF]/5"
                    : "bg-[#1F48AF] text-white hover:opacity-90"
                } ${favLoading ? "opacity-50" : ""}`}
                style={{ fontFamily: "Roboto" }}
              >
                {favLoading ? "Saving…" : isFavourite ? "Added" : "Add"}
              </button>

              {averageRate !== null && (
                <Tooltip message="Average rating from all users">
                  <div className="flex items-center gap-2">
                    <div className="relative flex items-center justify-center w-12 h-12 shrink-0">
                      <div className="absolute inset-0 rounded-full border border-black bg-white flex items-center justify-center">
                        <span className="text-[14px]" style={{ fontFamily: "Times New Roman" }}>
                          {averageRate.toFixed(1)}
                        </span>
                      </div>
                      <WalcordCircle className="absolute -bottom-1 -right-1 w-5 h-5 text-[#1F48AF]" />
                    </div>

                    <span className="text-[12px] font-light text-neutral-500 leading-[1.05] whitespace-nowrap">
                      <span className="block">Average</span>
                      <span className="block">Grade</span>
                    </span>
                  </div>
                </Tooltip>
              )}
            </div>

            {isFromFavouriteArtist && (
              <button
                type="button"
                className="h-8 rounded-full px-4 text-[11px] border border-neutral-300 text-neutral-700 hover:border-neutral-900 transition leading-tight whitespace-normal text-center"
                style={{ fontFamily: "Roboto" }}
              >
                Record from one of your favourites
              </button>
            )}
          </div>

          {/* Your rating: 1 línea siempre */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-medium uppercase tracking-[0.22em] text-neutral-500">Your rating</p>
              {userRating !== null && <span className="text-[11px] font-light text-neutral-500">Tap again to remove</span>}
            </div>

            <div className="mt-3 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1.5 min-w-max pb-1">
                {Array.from({ length: 10 }).map((_, idx) => {
                  const n = idx + 1;
                  const active = userRating === n;
                  return (
                    <button
                      key={n}
                      onClick={() => handleRate(n)}
                      className={`w-8 h-8 rounded-full text-[12px] flex items-center justify-center border transition active:scale-95 ${
                        active ? "bg-[#1F48AF] border-[#1F48AF] text-white" : "border-neutral-300 text-neutral-800 hover:bg-neutral-50"
                      }`}
                      style={{ fontFamily: "Times New Roman, serif" }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <Modal open={loginOpen} onClose={() => setLoginOpen(false)} title={loginTitle}>
          <div className="space-y-3">
            <p className="text-sm text-gray-600 font-light" style={{ fontFamily: "Roboto" }}>
              Create an account or sign in to interact with Walcord.
            </p>
            <Link
              href="/login"
              className="block text-center rounded-xl bg-[#1F48AF] text-white px-4 py-2 text-sm"
              style={{ fontFamily: "Roboto" }}
            >
              Sign in
            </Link>
            <button
              onClick={() => setLoginOpen(false)}
              className="w-full text-center text-sm text-gray-500 underline"
              style={{ fontFamily: "Roboto" }}
            >
              Continue browsing
            </button>
          </div>
        </Modal>

        {/* ===== TAKES ===== */}
        <section className="mt-7">
          <div className="pb-5 border-b border-neutral-200">
            <button
              type="button"
              onClick={() => {
                if (!userId) {
                  setLoginTitle("Sign in to share your take");
                  setLoginOpen(true);
                  return;
                }
                setComposerOpen((s) => !s);
                if (!composerOpen) {
                  setTimeout(() => composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
                }
              }}
              className="w-full flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3 hover:border-neutral-900 transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 overflow-hidden rounded-full bg-neutral-200 shrink-0">
                  {meProfile?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={meProfile.avatar_url} alt="You" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-[13px] font-medium text-neutral-900 truncate">
                    {hasMyTake ? "Update your take" : "Write a listener take"}
                  </p>
                  <p className="text-[11px] font-light text-neutral-500">For the fans — not critics.</p>
                </div>
              </div>
              <span className="text-[12px] text-neutral-600">{composerOpen ? "Close" : "Open"}</span>
            </button>

            {composerOpen && (
              <div ref={composerRef} className="mt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-light text-neutral-500">Your rating for this take (required)</p>
                    <button
                      type="button"
                      onClick={() => setRatePickerOpen((s) => !s)}
                      className="mt-2 text-[12px] text-[#1F48AF] hover:opacity-80"
                    >
                      {takeRate == null ? "Select rating" : "Change rating"}
                    </button>
                  </div>
                  {typeof takeRate === "number" ? <RatingBadge rate={takeRate} size={44} /> : null}
                </div>

                {ratePickerOpen && (
                  <div className="mt-3 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-1.5 min-w-max pb-1">
                      {Array.from({ length: 10 }).map((_, idx) => {
                        const v = idx + 1;
                        const active = takeRate === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setTakeRate(v)}
                            className={`w-8 h-8 rounded-full text-[12px] flex items-center justify-center border transition active:scale-95 ${
                              active ? "bg-[#1F48AF] border-[#1F48AF] text-white" : "border-neutral-300 text-neutral-800 hover:bg-neutral-50"
                            }`}
                            style={{ fontFamily: "Times New Roman, serif" }}
                          >
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-3">
                  <textarea
                    value={takeBody}
                    onChange={(e) => setTakeBody(e.target.value)}
                    placeholder="Say what this record means to you…"
                    className="w-full min-h-[110px] resize-none rounded-2xl border border-neutral-200 px-3 py-3 text-[14px] font-light leading-relaxed text-neutral-900 outline-none focus:ring-2 focus:ring-[#1F48AF] placeholder:text-neutral-400"
                  />
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setComposerOpen(false);
                      setRatePickerOpen(false);
                    }}
                    className="text-[11px] font-light text-neutral-500 hover:text-neutral-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={postTake}
                    disabled={takePosting || takeBody.trim().length === 0 || takeRate == null}
                    className="rounded-full px-5 h-9 text-xs text-white enabled:hover:opacity-90 disabled:opacity-40 transition"
                    style={{ backgroundColor: "#1F48AF" }}
                  >
                    {takePosting ? "Posting…" : "Post take"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5">
            {takesLoading ? (
              <p className="text-sm text-neutral-500">Loading takes…</p>
            ) : takes.length === 0 ? (
              <p className="text-[12px] font-light text-neutral-500">No takes yet. Be the first.</p>
            ) : (
              <ul className="divide-y divide-neutral-200">
                {takes.map((it) => (
                  <li key={String(it.id)} className="py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 overflow-hidden rounded-full bg-neutral-200 shrink-0">
                          {it.profile?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={it.profile.avatar_url}
                              alt={it.profile?.full_name || "user"}
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-neutral-900 truncate">
                            {it.profile?.full_name || it.profile?.username || "walcord user"}
                          </p>
                          <p className="text-[11px] font-light text-neutral-500">
                            {new Date(it.created_at).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>

                      {typeof it.rate === "number" ? <RatingBadge rate={it.rate} size={46} /> : null}
                    </div>

                    {editingId === it.id ? (
                      <div className="mt-4">
                        <textarea
                          value={editingBody}
                          onChange={(e) => setEditingBody(e.target.value)}
                          className="w-full min-h-[110px] resize-none rounded-2xl border border-neutral-200 px-3 py-3 text-[14px] font-light leading-relaxed text-neutral-900 outline-none focus:ring-2 focus:ring-[#1F48AF]"
                        />
                        <div className="mt-3 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="h-8 rounded-full px-4 text-[11px] bg-neutral-200 text-neutral-700"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={saveEdit}
                            className="h-8 rounded-full px-4 text-[11px] text-white"
                            style={{ backgroundColor: "#1F48AF" }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 text-[14px] font-light leading-relaxed text-neutral-900">{it.body}</p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleLike(it)}
                          className={`inline-flex items-center rounded-full border px-5 py-1.5 text-[13px] font-normal transition ${
                            it.liked_by_me ? "border-[#1F48AF] text-[#1F48AF]" : "border-neutral-400 text-neutral-800 hover:border-neutral-900"
                          }`}
                        >
                          {it.liked_by_me ? "Liked" : "Like"}
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            setLikesPanelOpen(true);
                            await loadLikesUsers(it.id);
                          }}
                          className="text-[11px] font-light text-neutral-500 hover:text-neutral-900"
                        >
                          {it.likes_count || 0} {(it.likes_count || 0) === 1 ? "like" : "likes"}
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={async () => {
                            const isOpen = !!openComments[it.id];
                            const next = { ...openComments, [it.id]: !isOpen };
                            setOpenComments(next);
                            if (!isOpen && !commentsMap[it.id]) await loadComments(it.id);
                            setReplyFor(it.id);
                          }}
                          className="text-[11px] font-light text-neutral-500 hover:text-neutral-900"
                          aria-expanded={!!openComments[it.id]}
                        >
                          {it.comments_count || 0} {(it.comments_count || 0) === 1 ? "comment" : "comments"}
                        </button>

                        {it.user_id === userId && (
                          <>
                            {editingId === it.id ? null : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => beginEdit(it)}
                                  className="text-[11px] font-light text-neutral-500 hover:text-neutral-900"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteTake(it.id)}
                                  className="text-[11px] font-light text-neutral-500 hover:text-neutral-900"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {openComments[it.id] && (
                      <div className="mt-4 space-y-3">
                        {commentsMap[it.id] && commentsMap[it.id]!.length > 0 ? (
                          <ul className="space-y-2">
                            {commentsMap[it.id]!.map((c) => (
                              <li key={c.id} className="rounded-3xl border border-neutral-200 bg-white px-4 py-3">
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="h-7 w-7 overflow-hidden rounded-full bg-neutral-200 shrink-0">
                                      {c.profile?.avatar_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={c.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                                      ) : null}
                                    </div>
                                    <p className="text-[13px] font-medium text-neutral-900 truncate">
                                      {c.profile?.full_name || c.profile?.username || "walcord user"}
                                    </p>
                                  </div>
                                  <p className="text-[11px] font-light text-neutral-500">
                                    {new Date(c.created_at).toLocaleDateString("en-GB", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </p>
                                </div>
                                <p className="text-[13px] font-light leading-relaxed text-neutral-800">{c.body}</p>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-[12px] font-light text-neutral-500">No comments yet. Be the first to comment.</p>
                        )}
                      </div>
                    )}

                    {replyFor === it.id && (
                      <div className="mt-4 rounded-3xl border border-neutral-200 bg-white px-4 py-4">
                        <textarea
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          placeholder="Write a reply…"
                          className="w-full min-h-[80px] resize-none border-none bg-transparent text-sm outline-none placeholder:text-neutral-400"
                        />
                        <div className="mt-3 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setReplyFor(null);
                              setReplyBody("");
                            }}
                            className="h-8 rounded-full px-4 text-[11px] bg-neutral-200 text-neutral-700"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={sendReply}
                            disabled={!replyBody.trim().length}
                            className="rounded-full px-5 h-8 text-xs text-white enabled:hover:opacity-90 disabled:opacity-40 transition"
                            style={{ backgroundColor: "#1F48AF" }}
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
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
          onClick={() => {
            setLikesPanelOpen(false);
            setLikesUsers([]);
            setLikesForRecId(null);
          }}
        />
        <div
          className={`relative w-full max-w-md rounded-t-3xl bg-white shadow-[0_-12px_40px_rgba(15,23,42,0.18)] transition-transform duration-300 ${
            likesPanelOpen ? "translate-y-0" : "translate-y-full"
          }`}
          style={{
            maxHeight: "70vh",
            paddingTop: "14px",
            paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
          }}
        >
          <div className="flex items-center justify-center mb-2">
            <div className="h-1 w-10 rounded-full bg-neutral-300" />
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-center text-neutral-500 mb-3">Likes</p>
          <div className="px-4 pb-1 overflow-y-auto" style={{ maxHeight: "calc(70vh - 56px)" }}>
            {loadingLikesUsers ? (
              <p className="py-4 text-sm text-neutral-500 text-center">Loading…</p>
            ) : likesUsers.length === 0 ? (
              <p className="py-4 text-sm text-neutral-500 text-center">No likes yet.</p>
            ) : (
              likesUsers.map((u) => (
                <div key={`${likesForRecId || "x"}-${u.user_id}`} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-neutral-200 overflow-hidden">
                      {u.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatar_url} alt={u.username || ""} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{u.username || "user"}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

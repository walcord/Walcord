"use client";

/* ==========================================================================================
   Walcord — The Wall (Feed)
   Hot‑fix v3.3.1:
   - Banner idéntico a Concerts (h-20 + logo 56px) con botón “Profile” a la derecha.
   - Orden de botones: Memories · Concerts · Content · Recommendations · Pending.
   - 🔇 Sin “temblores” de posts (sin animaciones verticales en las cards).
   - ✅ FIX fotos 1× con normalizeUrls().
   ========================================================================================== */

import React, { useEffect, useRef, useState, useDeferredValue } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { motion, AnimatePresence } from "framer-motion";

/* ===============================
   Tipos
   =============================== */
type PendingRow = {
  id: string;
  user_id: string;
  type: "artist" | "record";
  created_at: string;
  artist_id: string | null;
  artist_name: string | null;
  artist_vibe_color: string | null;
  artist_cover_color: string | null;
  record_id: string | null;
  record_title: string | null;
  record_artist_name: string | null;
  record_year: number | null;
  record_vibe_color: string | null;
  record_cover_color: string | null;
};

type ConcertPost = {
  post_id: string;
  user_id: string;
  caption: string | null;
  created_at: string;
  concert_id: string;
  image_urls?: string[] | null;
  username: string;
  avatar_url?: string | null;
  artist_name?: string | null;
  tour?: string | null;
  city?: string | null;
  country?: string | null;
  year?: number | null;
  like_count: number;
  comment_count: number;
};

type MemoryPost = {
  id: string; // post_id
  user_id: string;
  created_at: string;
  text: string | null;
  image_urls: string[] | null;
  username: string;
  avatar_url: string | null;
  record_id?: string | null;
  record_title?: string | null;
  record_artist_name?: string | null;
  record_vibe_color?: string | null;
  record_cover_color?: string | null;
};

type ContentItem = {
  id: string;
  title: string;
  kind:
    | "documentary"
    | "interview"
    | "concert"
    | "entertainment"
    | "short"
    | "clip";
  thumbnail_url: string | null;
  duration_sec: number | null;
  artist_name: string | null;
  created_at: string;
};

/* ===============================
   UI Helpers
   =============================== */
const Pill = ({
  active,
  children,
  onClick,
  href,
  ariaControls,
}: {
  active?: boolean;
  children?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  ariaControls?: string;
}) =>
  href ? (
    <Link
      href={href}
      aria-controls={ariaControls}
      className={[
        "px-4 md:px-5 py-2 rounded-full border transition-all text-sm select-none",
        active
          ? "bg-[#1F48AF] text-white border-[#1F48AF] shadow-sm"
          : "bg-white text-black border-neutral-200 hover:border-[#1F48AF]/40",
      ].join(" ")}
    >
      {children}
    </Link>
  ) : (
    <button
      onClick={onClick}
      aria-controls={ariaControls}
      className={[
        "px-4 md:px-5 py-2 rounded-full border transition-all text-sm select-none",
        active
          ? "bg-[#1F48AF] text-white border-[#1F48AF] shadow-sm"
          : "bg-white text-black border-neutral-200 hover:border-[#1F48AF]/40",
      ].join(" ")}
    >
      {children}
    </button>
  );

const Avatar = ({
  src,
  alt,
  size = 38,
}: {
  src?: string | null;
  alt?: string;
  size?: number;
}) => (
  <div
    className="rounded-full overflow-hidden bg-neutral-100 border border-neutral-200"
    style={{ width: size, height: size }}
    aria-label={alt || "user avatar"}
  >
    {src ? (
      <img src={src} alt={alt || "user"} className="w-full h-full object-cover" />
    ) : (
      <div className="w-full h-full" />
    )}
  </div>
);

const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse bg-neutral-100 rounded-2xl ${className}`} />
);

/* Iconos inline */
const WalcordLikeIcon: React.FC<{ active?: boolean; size?: number }> = ({
  active,
  size = 18,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="inline-block"
  >
    <circle
      cx="12"
      cy="12"
      r="8.5"
      fill={active ? "#E8EFFB" : "transparent"}
      stroke={active ? "#1F48AF" : "currentColor"}
      strokeWidth="1.6"
    />
    <circle
      cx="12"
      cy="12"
      r="3.2"
      fill={active ? "#1F48AF" : "white"}
      stroke={active ? "#1F48AF" : "currentColor"}
      strokeWidth="1.2"
    />
  </svg>
);

const ArrowRight: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
  >
    <path d="M5 12h13" />
    <path d="M12 5l7 7-7 7" />
  </svg>
);

/* ===============================
   Estilo
   =============================== */
const V = {
  shadow: "0 6px 22px rgba(0,0,0,0.06)",
};

/* ===============================
   Utils
   =============================== */
const softHashColor = (seed: string | null | undefined) => {
  if (!seed) return "#F3F4F6";
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const r = 238 - (h % 24);
  const g = 238 - ((h >> 3) % 24);
  const b = 238 - ((h >> 6) % 24);
  return `rgb(${r}, ${g}, ${b})`;
};

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

/** Normalizador robusto de URLs de imagen. */
const normalizeUrls = (value: any): string[] | null => {
  const stripQuotes = (s: string) =>
    s.replace(/^"+|"+$/g, "").replace(/^'+|'+$/g, "").trim();

  const push = (arr: string[], v: any) => {
    if (!v && v !== 0) return;
    if (typeof v === "string") {
      let s = stripQuotes(v);
      if (!s) return;
      const lower = s.toLowerCase();
      if (lower === "null" || lower === "undefined" || lower === "[]") return;

      if ((s.startsWith("[") && s.endsWith("]")) || (s.startsWith("{") && s.endsWith("}"))) {
        try {
          const normalizedJson =
            s.includes("'") && !s.includes('"') ? s.replace(/'/g, '"') : s;
          const parsed = JSON.parse(normalizedJson);
          const inner = normalizeUrls(parsed);
          if (inner) inner.forEach((u) => arr.push(stripQuotes(u)));
          return;
        } catch {
          /* continúa abajo */
        }
      }

      const matches = s.match(/https?:\/\/[^\s,"'}\]]+/g);
      if (matches?.length) {
        matches.forEach((m) => arr.push(stripQuotes(m)));
        return;
      }

      const parts = s
        .split(/[\n,]+/)
        .map((x) => stripQuotes(x))
        .filter(Boolean);
      if (parts.length) parts.forEach((p) => arr.push(stripQuotes(p)));
      return;
    }
    if (typeof v === "object") {
      const cand = stripQuotes(
        (v?.url || v?.src || v?.path || v?.image_url || "").toString()
      );
      if (cand) arr.push(cand);
    }
  };

  try {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const acc: string[] = [];
      push(acc, value);
      return acc.length ? acc : null;
    }

    if (Array.isArray(value)) {
      const acc: string[] = [];
      value.forEach((v) => push(acc, v));
      return acc.length ? acc : null;
    }

    if (typeof value === "string") {
      let s = stripQuotes(value);
      if (!s) return null;

      if (/^\{.*\}$/.test(s)) {
        const inner = s.slice(1, -1);
        const parts = inner
          .split(",")
          .map((x) => x.replace(/^"+|"+$/g, "").replace(/^'+|'+$/g, "").trim())
          .filter(Boolean);
        return parts.length ? parts : null;
      }

      if (
        (s.startsWith("[") && s.endsWith("]")) ||
        (s.startsWith("{") && s.endsWith("}"))
      ) {
        try {
          const normalizedJson =
            s.includes("'") && !s.includes('"') ? s.replace(/'/g, '"') : s;
          const parsed = JSON.parse(normalizedJson);
          return normalizeUrls(parsed);
        } catch {
          /* fall back abajo */
        }
      }

      const matches = s.match(/https?:\/\/[^\s,"'}\]]+/g);
      if (matches?.length) return matches.map(stripQuotes);

      const arr = s
        .split(/[\n,]+/)
        .map((x) => stripQuotes(x))
        .filter(Boolean);
      return arr.length ? arr : null;
    }
  } catch {
    /* noop */
  }
  return null;
};

/* ===============================
   Lightbox
   =============================== */
const Lightbox: React.FC<{
  urls: string[];
  index: number;
  onClose: () => void;
}> = ({ urls, index, onClose }) => {
  const [i, setI] = useState(index);
  const total = urls.length;

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((p) => (p + 1) % total);
      if (e.key === "ArrowLeft") setI((p) => (p - 1 + total) % total);
    };
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
    document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [onClose, total]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/90 text-sm border border-white/30 rounded-full px-3 py-1"
        >
          Close
        </button>
        <button
          onClick={() => setI((p) => (p - 1 + total) % total)}
          className="absolute left-3 md:left-6 text-white/80 text-xl px-3 py-2"
          aria-label="Prev"
        >
          ‹
        </button>
        <button
          onClick={() => setI((p) => (p + 1) % total)}
          className="absolute right-3 md:right-6 text-white/80 text-xl px-3 py-2"
          aria-label="Next"
        >
          ›
        </button>

        <motion.img
          key={i}
          src={urls[i]}
          alt=""
          className="max-h-[86vh] max-w-[92vw] object-contain rounded-xl shadow-2xl"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        />
        <div className="absolute bottom-5 text-white/80 text-xs">
          {i + 1} / {total}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

/* ===============================
   Buscador de usuarios (sin follow/friend)
   =============================== */
const UserSearch: React.FC<{ meId: string | null }> = ({ meId }) => {
  const supabase = useSupabaseClient();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [searchLoading, setSearchLoading] = useState(false);
  const [results, setResults] = useState<
    Array<{ id: string; username: string; full_name: string | null; avatar_url: string | null }>
  >([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const q = deferred.trim();
      if (q.length < 2) {
        if (!cancelled) setResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        const or = `full_name.ilike.%${q}%,username.ilike.%${q}%`;
        const { data: raw } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .or(or)
          .neq("id", meId || "")
          .order("username", { ascending: true })
          .limit(15);

        if (!cancelled) {
          const mapped =
            (raw || []).map((r: any) => ({
              id: r.id,
              username: r.username,
              full_name: r.full_name,
              avatar_url: r.avatar_url,
            })) ?? [];
          setResults(mapped);
        }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [deferred, meId, supabase]);

  // posicion fijo anclado
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] =
    useState<{ left: number; top: number; width: number } | null>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setAnchor({ left: rect.left, top: rect.bottom + 8, width: rect.width });
    const onResize = () => {
      const r = el.getBoundingClientRect();
      setAnchor({ left: r.left, top: r.bottom + 8, width: r.width });
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, []);

  return (
    <div className="relative w-full md:w-[460px]" ref={anchorRef}>
      <input
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search users and open their profile"
        className="w-full rounded-full border border-neutral-200 px-4 py-2 outline-none focus:border-[#1F48AF] transition-all text-sm"
      />
      {open && !!query && anchor && (
        <div
          className="fixed z-40 rounded-2xl border border-neutral-200 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.08)] overflow-hidden"
          style={{ left: anchor.left, top: anchor.top, width: anchor.width }}
          role="listbox"
        >
          {searchLoading ? (
            <div className="p-4 text-sm text-neutral-500">
              {query.trim().length < 2 ? "Type at least 2 characters…" : "Searching…"}
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm text-neutral-500">No users found</div>
          ) : (
            <ul className="divide-y divide-neutral-100 max-h-[420px] overflow-auto">
              {results.map((p) => (
                <li
                  key={p.id}
                  className="p-3 flex items-center gap-3 hover:bg-neutral-50 transition-colors"
                >
                  <Link
                    href={`/profile/${p.username}`}
                    className="flex items-center gap-3 flex-1"
                    onClick={() => setOpen(false)}
                  >
                    <Avatar size={32} src={p.avatar_url} alt={p.full_name || p.username} />
                    <div>
                      <div className="text-sm">{p.full_name || "—"}</div>
                      <div className="text-xs text-neutral-500">@{p.username}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="p-2 text-right">
            <button
              onClick={() => setOpen(false)}
              className="text-xs text-neutral-500 hover:text-neutral-700"
            >
              close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ===============================
   Feed
   =============================== */
export const Feed: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();

  // Tabs
  const [activeTab, setActiveTab] = useState<
    "memories" | "content" | "recommendations" | "pending" | "concerts"
  >("memories");

  // Base
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingRow[]>([]);

  // Memories
  const [memories, setMemories] = useState<MemoryPost[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memoriesPage, setMemoriesPage] = useState(0);
  const pageSize = 8;

  // Likes / comments
  const [likedByMe, setLikedByMe] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState<
    Record<string, { likes: number; comments: number }>
  >({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentsCache, setCommentsCache] = useState<
    Record<
      string,
      Array<{
        id: string;
        user_id: string;
        text: string;
        created_at: string;
        full_name?: string | null;
        username?: string | null;
        avatar_url?: string | null;
      }>
    >
  >({});
  const [commentsPage, setCommentsPage] = useState<Record<string, number>>({});

  // Nombres
  const [names, setNames] = useState<
    Record<string, { full_name?: string | null; username?: string | null }>
  >({});

  // Content
  const [content, setContent] = useState<ContentItem[]>([]);
  const [contentLoading, setContentLoading] = useState(false);

  // Concerts
  const [concerts, setConcerts] = useState<ConcertPost[]>([]);
  const [concertsLoading, setConcertsLoading] = useState(true);
  const concertsPageSize = 8;
  const [concertsPage, setConcertsPage] = useState(0);
  const concertsFetchingRef = useRef(false);

  const meId = user?.id ?? null;

  /* --------- Helpers de sincronización --------- */
  const refreshCounts = async (postId: string) => {
    if (!meId) return;
    try {
      const [{ data: cts }, { data: liked }] = await Promise.all([
        supabase
          .from("v_posts_counts")
          .select("post_id, like_count, comment_count")
          .eq("post_id", postId)
          .maybeSingle(),
        supabase
          .from("post_likes")
          .select("post_id")
          .eq("post_id", postId)
          .eq("user_id", meId)
          .maybeSingle(),
      ]);
      setCounts((p) => ({
        ...p,
        [postId]: {
          likes: cts?.like_count ?? p[postId]?.likes ?? 0,
          comments: cts?.comment_count ?? p[postId]?.comments ?? 0,
        },
      }));
      setLikedByMe((p) => ({ ...p, [postId]: !!liked }));
    } catch (e) {
      console.warn("refreshCounts error", e);
    }
  };

  /* ---------------- loaders ---------------- */
  const loadPending = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("v_pending_items_expanded")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error) setPending((data || []) as PendingRow[]);
  };

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await Promise.all([loadPending()]);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Memories ---------------- */
  const fetchMemories = async (reset = false) => {
    if (!user) return;
    setMemoriesLoading(true);
    try {
      const from = reset ? 0 : memoriesPage * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await supabase
        .from("v_memories_posts")
        .select(
          "viewer_id, post_id, author_id, created_at, caption, image_urls, username, avatar_url, record_id, record_title, artist_name, record_vibe_color, record_cover_color"
        )
        .eq("viewer_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const normalized: MemoryPost[] = (data || []).map((p: any) => ({
        id: p.post_id,
        user_id: p.author_id,
        created_at: p.created_at,
        text: p.caption ?? null,
        image_urls: normalizeUrls(p.image_urls),
        username: p.username ?? "user",
        avatar_url: p.avatar_url ?? null,
        record_id: p.record_id ?? null,
        record_title: p.record_title ?? null,
        record_artist_name: p.artist_name ?? null,
        record_vibe_color: p.record_vibe_color ?? null,
        record_cover_color: p.record_cover_color ?? null,
      }));

      setMemories((prev) => (reset ? normalized : [...prev, ...normalized]));
      if (reset) setMemoriesPage(1);
      else setMemoriesPage((n) => n + 1);

      // counts + liked
      const postIds = normalized.map((n) => n.id);
      if (postIds.length) {
        const [{ data: countsRes }, { data: likedRes }] = await Promise.all([
          supabase
            .from("v_posts_counts")
            .select("post_id, like_count, comment_count")
            .in("post_id", postIds),
          supabase
            .from("post_likes")
            .select("post_id")
            .eq("user_id", user.id)
            .in("post_id", postIds),
        ]);

        const nextCounts: Record<string, { likes: number; comments: number }> =
          {};
        (countsRes || []).forEach((r: any) => {
          nextCounts[r.post_id] = {
            likes: r.like_count ?? 0,
            comments: r.comment_count ?? 0,
          };
        });

        const nextLiked: Record<string, boolean> = {};
        (likedRes || []).forEach((r: any) => (nextLiked[r.post_id] = true));

        setCounts((prev) => (reset ? nextCounts : { ...prev, ...nextCounts }));
        setLikedByMe((prev) => (reset ? nextLiked : { ...prev, ...nextLiked }));
      }

      // nombres (full_name)
      const authors = Array.from(new Set(normalized.map((n) => n.user_id))).filter(
        Boolean
      );
      if (authors.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, username")
          .in("id", authors as string[]);
        const map: Record<
          string,
          { full_name?: string | null; username?: string | null }
        > = {};
        (profs || []).forEach(
          (p: any) =>
            (map[p.id] = { full_name: p.full_name, username: p.username })
        );
        setNames((prev) => ({ ...prev, ...map }));
      }
    } catch (e) {
      console.error("fetchMemories failed", e);
    } finally {
      setMemoriesLoading(false);
    }
  };

  /* ---------------- Content ---------------- */
  const fetchContent = async () => {
    setContentLoading(true);
    try {
      const { data } = await supabase
        .from("content_items")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      setContent((data || []) as ContentItem[]);
    } finally {
      setContentLoading(false);
    }
  };

  /* ---------------- Concerts ---------------- */
  const fetchConcertsPage = async (reset = false) => {
    if (!user) return;
    if (concertsFetchingRef.current) return;
    concertsFetchingRef.current = true;
    try {
      if (reset) {
        setConcertsPage(0);
        setConcerts([]);
        setConcertsLoading(true);
      }

      const [followsRes, fA, fB] = await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", user.id),
        supabase.from("friendships").select("receiver_id").eq("requester_id", user.id),
        supabase.from("friendships").select("requester_id").eq("receiver_id", user.id),
      ]);
      const ids = new Set<string>();
      (followsRes.data || []).forEach((r: any) => ids.add(r.following_id));
      (fA.data || []).forEach((r: any) => ids.add(r.receiver_id));
      (fB.data || []).forEach((r: any) => ids.add(r.requester_id));
      const idsArr = Array.from(ids);
      if (idsArr.length === 0) {
        setConcerts([]);
        setConcertsLoading(false);
        concertsFetchingRef.current = false;
        return;
      }

      const from = reset ? 0 : concertsPage * concertsPageSize;
      const to = from + concertsPageSize - 1;

      const { data, error } = await supabase
        .from("v_concert_posts")
        .select("*")
        .in("user_id", idsArr)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      setConcerts((prev) =>
        reset ? (data as ConcertPost[]) : [...prev, ...(data as ConcertPost[])]
      );
      if (reset) setConcertsPage(1);
      else setConcertsPage((p) => p + 1);
    } finally {
      setConcertsLoading(false);
      concertsFetchingRef.current = false;
    }
  };

  /* ---------------- Efectos / realtime ---------------- */
  useEffect(() => {
    if (!user) return;
    loadAll();

    const postsChannel = supabase
      .channel("posts-inline")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, () =>
        fetchMemories(true)
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "post_likes" }, () =>
        fetchMemories(true)
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "post_likes" }, () =>
        fetchMemories(true)
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "post_comments" }, () =>
        fetchMemories(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(postsChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Carga inmediata + retry corto tras refresh
  useEffect(() => {
    if (!user) return;
    fetchMemories(true);
    const retry = setTimeout(() => {
      if (!memoriesLoading && memories.length === 0) fetchMemories(true);
    }, 900);
    return () => clearTimeout(retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === "content" && content.length === 0 && !contentLoading)
      fetchContent();
    if (activeTab === "concerts" && concerts.length === 0)
      fetchConcertsPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  /* ---------------- Likes & comments ---------------- */
  const toggleLike = async (postId: string) => {
    if (!user) return;
    const liked = likedByMe[postId];

  // Optimista
    setLikedByMe((p) => ({ ...p, [postId]: !liked }));
    setCounts((p) => ({
      ...p,
      [postId]: {
        likes: Math.max(0, (p[postId]?.likes ?? 0) + (liked ? -1 : 1)),
        comments: p[postId]?.comments ?? 0,
      },
    }));

    try {
      if (liked) {
        await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);
      } else {
        await supabase.from("post_likes").insert({
          post_id: postId,
          user_id: user.id,
          created_at: new Date().toISOString(),
        });
      }
      await refreshCounts(postId);
    } catch (e) {
      // revertir si falla
      setLikedByMe((p) => ({ ...p, [postId]: liked }));
      setCounts((p) => ({
        ...p,
        [postId]: {
          likes: Math.max(0, (p[postId]?.likes ?? 0) + (liked ? 1 : -1)),
          comments: p[postId]?.comments ?? 0,
        },
      }));
      console.error("Like failed", e);
      alert("Like failed");
    }
  };

  const loadComments = async (postId: string, reset = false) => {
    if (!user) return;
    const page = reset ? 0 : commentsPage[postId] || 0;
    const from = page * 10;
    const to = from + 9;

    // Leemos de post_comments (columna `comment`) y unimos perfiles
    const { data, error } = await supabase
      .from("post_comments")
      .select(
        "id, post_id, user_id, comment, created_at, profiles!inner(full_name, username, avatar_url)"
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .range(from, to);

    if (!error) {
      const list =
        (data || []).map((row: any) => ({
          id: row.id,
          user_id: row.user_id,
          text: row.comment as string,
          created_at: row.created_at,
          full_name: row.profiles?.full_name ?? null,
          username: row.profiles?.username ?? null,
          avatar_url: row.profiles?.avatar_url ?? null,
        })) ?? [];

      setCommentsCache((prev) => ({
        ...prev,
        [postId]: reset ? list : [...(prev[postId] || []), ...list],
      }));
      setCommentsPage((prev) => ({ ...prev, [postId]: page + 1 }));

      await refreshCounts(postId);
    }
  };

  const sendComment = async (postId: string, text: string) => {
    if (!user || !text.trim()) return;
    await supabase.from("post_comments").insert({
      post_id: postId,
      user_id: user.id,
      comment: text.trim(),
      created_at: new Date().toISOString(),
    });
    await Promise.all([loadComments(postId, true), refreshCounts(postId)]);
  };

  const CommentBox: React.FC<{ postId: string }> = ({ postId }) => {
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const onSend = async () => {
      if (!user || !text.trim()) return;
      setSending(true);
      try {
        await sendComment(postId, text);
        setText("");
      } catch (e: any) {
        alert(e?.message || "Could not comment");
      } finally {
        setSending(false);
      }
    };
    return (
      <div className="mt-3 flex items-center gap-2 sm:gap-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment…"
          className="flex-1 rounded-full border border-neutral-200 px-3 sm:px-4 py-2 outline-none focus:border-[#1F48AF] text-sm"
        />
        <button
          onClick={onSend}
          disabled={!text.trim() || sending}
          className="rounded-full bg-[#1F48AF] text-white px-3 sm:px-4 py-2 text-[13px] shadow-sm disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    );
  };

  const CommentsList: React.FC<{ postId: string }> = ({ postId }) => {
    const items = commentsCache[postId] || [];
    return items.length === 0 ? (
      <div className="text-[13px] text-neutral-500 mt-2">No comments yet.</div>
    ) : (
      <ul className="mt-2 space-y-2">
        {items.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            <Avatar size={26} src={c.avatar_url} alt={c.full_name || c.username || "user"} />
            <div className="bg-neutral-50 border border-neutral-200 rounded-2xl px-3 py-2 flex-1">
              <div className="text-[12px] text-neutral-800 font-medium">
                {c.full_name || "—"}
              </div>
              <div className="text-[13px] leading-snug">{c.text}</div>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  /* ---------------- RecordChip + PhotoGrid ---------------- */
  const RecordChip: React.FC<{
    id?: string | null;
    title?: string | null;
    artist?: string | null;
    vibe?: string | null;
    inner?: string | null;
  }> = ({ id, title, artist, vibe, inner }) =>
    id ? (
      <Link href={`/record/${id}`} className="block">
        <div className="flex items-center gap-3 sm:gap-4 group">
          <div
            className="relative p-[2px] rounded-xl"
            style={{
              background:
                vibe && inner
                  ? `linear-gradient(135deg, ${vibe}, ${inner})`
                  : "linear-gradient(135deg,#e5e7eb,#d1d5db)",
            }}
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-[10px] bg-white flex items-center justify-center">
              <div
                className="w-6 h-6 rounded-md"
                style={{ backgroundColor: inner || "#111" }}
              />
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[14px] sm:text-[15px] font-medium tracking-tight line-clamp-1">
              {title}
            </div>
            <div className="text-xs text-neutral-500 line-clamp-1">{artist}</div>
          </div>
        </div>
      </Link>
    ) : null;

  const [lightbox, setLightbox] = useState<{
    urls: string[];
    index: number;
  } | null>(null);

  // ================= FIX: PhotoGrid re-normaliza y limpia =================
  const PhotoGrid: React.FC<{ urls: string[] | null | undefined }> = ({ urls }) => {
    // Vuelva a normalizar cualquier cosa que venga (array/objeto/texto/JSON)
    const flattened = normalizeUrls(urls as any) || [];

    const clean = (s: string) =>
      s
        .toString()
        .replace(/^"+|"+$/g, "")
        .replace(/^'+|'+$/g, "")
        .replace(/^\{+|\}+$/g, "")
        .trim();

    const safe = flattened
      .map((s) => clean(s))
      .filter((s) => s && s.toLowerCase() !== "null" && s.toLowerCase() !== "undefined");

    if (!safe.length) return null;

    const openAt = (idx: number) => setLightbox({ urls: safe, index: idx });

    const Tile: React.FC<{
      src: string;
      idx: number;
      badge?: string | null;
      square?: boolean;
    }> = ({ src, idx, badge, square }) => (
      <button
        onClick={() => openAt(idx)}
        className={[
          "relative overflow-hidden rounded-xl sm:rounded-2xl",
          square ? "aspect-square" : "aspect-[4/3]",
        ].join(" ")}
      >
        <img
          src={src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        {badge && (
          <div className="absolute inset-0 bg-black/45 text-white text-base sm:text-lg font-medium flex items-center justify-center">
            {badge}
          </div>
        )}
      </button>
    );

    const arr = safe.slice(0, 4);
    if (arr.length === 1) return <Tile src={arr[0]} idx={0} />;

    if (arr.length === 2) {
      return (
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          {arr.map((u, i) => (
            <Tile key={i} src={u} idx={i} />
          ))}
        </div>
      );
    }
    if (arr.length === 3) {
      return (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <Tile src={arr[0]} idx={0} />
          <Tile src={arr[1]} idx={1} />
          <Tile src={arr[2]} idx={2} />
        </div>
      );
    }
    const more = clamp(safe.length - 4, 0, 99);
    return (
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        {arr.map((u, i) => {
          const isLast = i === 3 && safe.length > 4;
          return (
            <Tile
              key={i}
              src={u}
              idx={i}
              badge={isLast ? `+${more}` : null}
              square
            />
          );
        })}
      </div>
    );
  };

  /* ---------------- Secciones de UI ---------------- */
  const Memories = () =>
    memoriesLoading && memories.length === 0 ? (
      <div className="mx-auto max-w-2xl sm:max-w-3xl px-3 sm:px-4 py-10 text-center text-neutral-500">
        Loading…
      </div>
    ) : memories.length === 0 ? (
      <div className="mx-auto max-w-2xl sm:max-w-3xl px-3 sm:px-4 py-10 text-center text-neutral-600">
        Follow friends to start seeing Memories.
      </div>
    ) : (
      <div className="mx-auto max-w-2xl sm:max-w-3xl px-3 sm:px-4">
        <div className="flex flex-col gap-6 sm:gap-8 py-5 sm:py-6">
          {memories.map((p) => {
            const vibe = softHashColor(p.username);
            const displayName = names[p.user_id]?.full_name || "—";
            const visibleComments = openComments[p.id]
              ? commentsCache[p.id]?.length ?? 0
              : counts[p.id]?.comments ?? 0;

            return (
              // 🔇 Sin motion en la card para evitar “temblores”
              <article
                key={p.id}
                className="rounded-2xl sm:rounded-3xl border border-neutral-200 bg-white overflow-hidden"
                style={{ boxShadow: V.shadow }}
              >
                {/* Header */}
                <div
                  className="flex items-center gap-3 sm:gap-3 px-3 sm:px-4 py-3"
                  style={{ background: `linear-gradient(0deg, #fff, ${vibe})` }}
                >
                  <Avatar size={34} src={p.avatar_url} alt={displayName} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] sm:text-sm font-medium leading-tight line-clamp-1">
                      {displayName}
                    </div>
                    <div className="text-[11px] sm:text[12px] text-neutral-500 leading-tight">
                      {fmtDate(p.created_at)}
                    </div>
                  </div>
                </div>

                {/* Record */}
                <div className="px-3 sm:px-4 pt-3 sm:pt-4">
                  <RecordChip
                    id={p.record_id}
                    title={p.record_title || undefined}
                    artist={p.record_artist_name || undefined}
                    vibe={p.record_vibe_color || undefined}
                    inner={p.record_cover_color || undefined}
                  />
                </div>

                {/* Texto */}
                {p.text && (
                  <div className="px-3 sm:px-4 py-3 sm:py-4 text-[14px] sm:text-[15px] leading-relaxed">
                    {p.text}
                  </div>
                )}

                {/* Fotos */}
                <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                  <PhotoGrid urls={p.image_urls} />
                </div>

                {/* Acciones + Comentarios */}
                <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                  <div className="flex items-center justify-between text-[13px] sm:text-sm">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <button
                        onClick={() => toggleLike(p.id)}
                        className={[
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors",
                          likedByMe[p.id]
                            ? "border-[#1F48AF] text-[#1F48AF] bg-[#1F48AF]/5"
                            : "border-neutral-200 hover:border-[#1F48AF]",
                        ].join(" ")}
                        aria-pressed={likedByMe[p.id] ? "true" : "false"}
                      >
                        <WalcordLikeIcon active={!!likedByMe[p.id]} />
                        {likedByMe[p.id] ? "Liked" : "Like"}
                      </button>
                      <span className="text-neutral-600">
                        <span className="font-semibold">
                          {counts[p.id]?.likes ?? 0}
                        </span>{" "}
                        likes ·{" "}
                        <span className="font-semibold">{visibleComments}</span>{" "}
                        comments
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 sm:mt-3">
                    <button
                      onClick={async () => {
                        const next = !openComments[p.id];
                        setOpenComments((prev) => ({ ...prev, [p.id]: next }));
                        if (next) {
                          await loadComments(p.id, true);
                          await refreshCounts(p.id);
                        }
                      }}
                      className="text-[12px] text-[#1F48AF] hover:underline"
                    >
                      {openComments[p.id] ? "Hide comments" : "View comments"}
                    </button>
                    {openComments[p.id] && (
                      <>
                        <CommentsList postId={p.id} />
                        <div className="mt-2">
                          <button
                            onClick={() => loadComments(p.id, false)}
                            className="text-xs text-neutral-600 hover:text-neutral-800"
                          >
                            Load more
                          </button>
                        </div>
                      </>
                    )}
                    <CommentBox postId={p.id} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="pb-10 text-center">
          <button
            onClick={() => fetchMemories(false)}
            className="rounded-full px-4 py-2 border border-neutral-300 hover:bg-neutral-50 text-sm"
          >
            Load more
          </button>
        </div>
      </div>
    );

  /* ---------------- Content / Pending / Concerts ---------------- */
  const ContentGrid = () =>
    contentLoading && content.length === 0 ? (
      <div className="mx-auto max-w-6xl px-4 py-12 text-center text-neutral-500">
        Loading content…
      </div>
    ) : content.length === 0 ? (
      <div className="mx-auto max-w-6xl px-4 py-12 text-center text-neutral-600">
        No content yet.
      </div>
    ) : (
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5 py-6">
          {content.map((c) => (
            <a
              key={c.id}
              href={`/content/${c.id}`}
              className="group rounded-2xl overflow-hidden border border-neutral-200 bg-white hover:shadow-md transition"
            >
              <div className="relative aspect-video bg-neutral-100">
                {c.thumbnail_url && (
                  <img
                    src={c.thumbnail_url}
                    alt={c.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                {c.duration_sec != null && (
                  <span className="absolute bottom-2 right-2 text-[11px] bg-black/80 text-white rounded px-1.5 py-0.5">
                    {Math.floor(c.duration_sec / 60)}:
                    {String(c.duration_sec % 60).padStart(2, "0")}
                  </span>
                )}
              </div>
              <div className="p-3">
                <div className="text-sm font-medium line-clamp-2">
                  {c.title}
                </div>
                <div className="text-xs text-neutral-500 mt-1 capitalize">
                  {c.kind}
                  {c.artist_name ? ` · ${c.artist_name}` : ""}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    );

  const PendingGrid = () =>
    loading ? (
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Skeleton className="h-[110px]" />
          <Skeleton className="h-[110px]" />
          <Skeleton className="h-[110px]" />
        </div>
      </div>
    ) : pending.length === 0 ? (
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mt-10 text-neutral-600 text-sm">
          No pending items. You’re all caught up.
        </div>
      </div>
    ) : (
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pending.map((it) => {
            const isRecord = it.type === "record";
            const bg = isRecord ? it.record_vibe_color : it.artist_vibe_color;
            return (
              <motion.article
                key={it.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="rounded-2xl border border-neutral-200 p-3 bg-white flex items-center gap-3 hover:shadow-[0_4px_18px_rgba(0,0,0,0.06)] transition-shadow"
              >
                {isRecord ? (
                  <div
                    className="relative w-[64px] h-[64px] rounded-2xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: bg || "#F3F4F6" }}
                  >
                    <div
                      className="w-6 h-6 rounded-[6px]"
                      style={{
                        backgroundColor:
                          it.record_cover_color || "rgba(0,0,0,0.7)",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="relative w-[64px] h-[64px] rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: bg || "#E5E7EB" }}
                  />
                )}

                <div className="min-w-0">
                  {isRecord ? (
                    <>
                      <div
                        className="text-[15px] tracking-tight"
                        style={{ fontFamily: "Times New Roman, serif" }}
                      >
                        {it.record_title}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {it.record_artist_name}
                        {it.record_year ? ` · ${it.record_year}` : ""}
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        className="text-[15px] tracking-tight"
                        style={{ fontFamily: "Times New Roman, serif" }}
                      >
                        {it.artist_name}
                      </div>
                      <div className="text-xs text-neutral-500">Artist</div>
                    </>
                  )}
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    );

  const ConcertsInline = () =>
    concertsLoading && concerts.length === 0 ? (
      <div className="mx-auto max-w-3xl px-4">
        <div className="py-16 text-center text-neutral-500">
          Loading concerts…
        </div>
      </div>
    ) : concerts.length === 0 ? (
      <div className="mx-auto max-w-3xl px-4">
        <div className="py-16 text-center text-neutral-600">
          No concert posts yet.
        </div>
      </div>
    ) : (
      <div className="mx-auto max-w-3xl px-4">
        <div className="flex flex-col gap-8 py-8">
          {concerts.map((p) => (
            <article
              key={p.post_id}
              className="rounded-3xl border border-neutral-200 overflow-hidden shadow-[0_6px_24px_rgba(0,0,0,0.06)] bg-white"
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 rounded-full overflow-hidden bg-neutral-200">
                  {p.avatar_url && (
                    <img
                      src={p.avatar_url}
                      alt={names[p.user_id]?.full_name || "—"}
                      className="h-9 w-9 object-cover"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold leading-tight">
                    {names[p.user_id]?.full_name || "—"}
                  </div>
                  <div className="text-[12px] text-neutral-500 leading-tight">
                    {p.artist_name
                      ? `${p.artist_name}${p.tour ? ` — ${p.tour}` : ""}`
                      : "Concert"}
                    {p.city ? ` · ${p.city}` : ""}
                    {p.country ? `, ${p.country}` : ""}
                    {p.year ? ` · ${p.year}` : ""}
                  </div>
                </div>
                <div className="text-[12px] text-neutral-500">
                  {fmtDate(p.created_at)}
                </div>
              </div>

              {Array.isArray(p.image_urls) && p.image_urls.length > 0 ? (
                <div className="grid grid-cols-2 gap-1">
                  {p.image_urls.slice(0, 4).map((url, idx) => (
                    <div key={idx} className="relative aspect-square bg-neutral-100">
                      <img
                        src={url}
                        alt={`photo ${idx + 1}`}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="aspect-[4/3] bg-neutral-100" />
              )}

              <div className="px-4 py-4">
                <div className="flex items-center gap-6 text-sm">
                  <span>
                    <span className="font-semibold">{p.like_count}</span> likes
                  </span>
                </div>
                {p.caption && (
                  <p className="mt-2 text-[15px] leading-relaxed">{p.caption}</p>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="pb-12 text-center">
          <button
            onClick={() => fetchConcertsPage(false)}
            className="rounded-full px-5 py-2 border border-neutral-300 hover:bg-neutral-50 text-sm"
          >
            Load more
          </button>
        </div>
      </div>
    );

  /* ---------------- Render ---------------- */
  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-neutral-600">Sign in to see your Wall.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Banner idéntico a Concerts con botón Profile a la derecha */}
      <header className="w-full h-20 bg-[#1F48AF] flex items-center justify-between px-4 sm:px-6">
        <Image src="/logotipo.png" alt="Walcord" width={56} height={56} priority />

        <Link
          href="/profile"
          aria-label="Go to Profile"
          className="inline-flex items-center gap-2 rounded-full bg-white/95 backdrop-blur px-3 py-1.5 text-[12px] sm:text-xs text-black border border-white/60 hover:bg-white transition-all"
        >
          <span className="hidden sm:inline">Profile</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </header>

      {/* Hero / Tabs / Search */}
      <div className="mx-auto max-w-6xl px-4 md:px-6 pt-6 sm:pt-8 pb-4">
        <h1
          className="text-[clamp(1.6rem,5vw,2.4rem)] font-normal tracking-tight"
          style={{ fontFamily: "Times New Roman, serif" }}
        >
          The Wall
        </h1>
        <div className="mt-2 h-px w-full bg-black/10" />

        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill
              active={activeTab === "memories"}
              onClick={() => setActiveTab("memories")}
              ariaControls="memories"
            >
              Memories
            </Pill>
            {/* Concerts inmediatamente después de Memories */}
            <Pill href="/u/concerts" ariaControls="concerts">
              Concerts
            </Pill>
            <Pill href="/u/content" ariaControls="content">
              Content
            </Pill>
            <Pill href="/u/recommendations" ariaControls="recommendations">
              Recommendations
            </Pill>
            <Pill href="/u/pending" ariaControls="pending">
              Pending
            </Pill>
          </div>

          {/* Search */}
          <UserSearch meId={meId} />
        </div>
      </div>

      {/* Contenido dinámico */}
      <main className="pb-16">
        {activeTab === "memories" ? (
          <Memories />
        ) : activeTab === "content" ? (
          <ContentGrid />
        ) : activeTab === "pending" ? (
          <PendingGrid />
        ) : (
          <ConcertsInline />
        )}
      </main>

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          urls={lightbox.urls}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
};

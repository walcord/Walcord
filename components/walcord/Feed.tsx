"use client";

/* ==========================================================================================
   Walcord — The Wall (Feed)  —  SINGLE FILE
   - Feed centrado en conciertos + Memories heredado (por compatibilidad).
   - Subtabs: Following · Friends · For You.
   - Buscador de usuarios (desktop dropdown + sheet móvil).
   - Touring Ribbon integrado (para la pestaña Friends).
   - Likes/Comments usando post_likes y post_comments.
   ========================================================================================== */

import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useDeferredValue,
  useCallback,
} from "react";
import Link from "next/link";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { motion, AnimatePresence } from "framer-motion";

/* ===============================
   Tipos base
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

export type ConcertPost = {
  post_id: string;
  user_id: string | null;
  caption: string | null;
  created_at: string;
  concert_id: string;
  image_urls?: string[] | null;
  username?: string | null;
  avatar_url?: string | null;
  artist_name?: string | null;
  tour?: string | null;
  city?: string | null;
  country?: string | null;
  year?: number | null;
  like_count: number | null;
  comment_count: number | null;
};

/* ===============================
   UI helpers & utils
   =============================== */
const Pill = ({
  active,
  children,
  onClick,
  href,
  ariaControls,
  disabled,
}: {
  active?: boolean;
  children?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  ariaControls?: string;
  disabled?: boolean;
}) =>
  href && !disabled ? (
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
      disabled={disabled}
      className={[
        "px-4 md:px-5 py-2 rounded-full border transition-all text-sm select-none",
        disabled
          ? "bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed"
          : active
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

/* visuals */
const V = { shadow: "0 6px 22px rgba(0,0,0,0.06)" };

/* utils */
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

/** Normalizador robusto de URLs de imagen para arrays/strings JSON/CSV/etc. */
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
        } catch { /* fall-through */ }
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
        } catch { /* ignore */ }
      }

      const matches = s.match(/https?:\/\/[^\s,"'}\]]+/g);
      if (matches?.length) return matches.map(stripQuotes);

      const arr = s
        .split(/[\n,]+/)
        .map((x) => stripQuotes(x))
        .filter(Boolean);
      return arr.length ? arr : null;
    }
  } catch { /* noop */ }
  return null;
};

/* ===============================
   Lightbox sencillo para fotos
   =============================== */
const Lightbox: React.FC<{ urls: string[]; index: number; onClose: () => void }> = ({
  urls,
  index,
  onClose,
}) => {
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
          className="absolute right-4 text-white/90 text-sm border border-white/30 rounded-full px-3.5 py-2"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
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
   Buscador de usuarios (desktop + móvil)
   =============================== */
const UserSearch: React.FC<{ meId: string | null }> = ({ meId }) => {
  const supabase = useSupabaseClient();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<
    Array<{ id: string; username: string; full_name: string | null; avatar_url: string | null }>
  >([]);

  // estado UI
  const [openDesktop, setOpenDesktop] = useState(false);
  const [openSheet, setOpenSheet] = useState(false); // móvil
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] =
    useState<{ left: number; top: number; width: number } | null>(null);

  // social
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  type FriendState = "none" | "outgoing" | "incoming" | "friends";
  const [friendship, setFriendship] = useState<Record<string, FriendState>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const refreshSocial = async (userIds: string[]) => {
    if (!meId || userIds.length === 0) return;
    const [{ data: fRows }, { data: outRows }, { data: inRows }, { data: accA }, { data: accB }] =
      await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", meId).in("following_id", userIds),
        supabase.from("friendships").select("receiver_id,status").eq("requester_id", meId).in("receiver_id", userIds),
        supabase.from("friendships").select("requester_id,status").eq("receiver_id", meId).in("requester_id", userIds),
        supabase.from("friendships").select("requester_id,receiver_id,status").eq("requester_id", meId).eq("status", "accepted").in("receiver_id", userIds),
        supabase.from("friendships").select("requester_id,receiver_id,status").eq("receiver_id", meId).eq("status", "accepted").in("requester_id", userIds),
      ]);
    const fMap: Record<string, boolean> = {};
    (fRows || []).forEach((r: any) => (fMap[r.following_id] = true));
    const accepted = new Set<string>();
    (accA || []).forEach((r: any) => accepted.add(r.receiver_id));
    (accB || []).forEach((r: any) => accepted.add(r.requester_id));
    const fs: Record<string, FriendState> = {};
    userIds.forEach((id) => {
      if (accepted.has(id)) fs[id] = "friends";
      else if ((outRows || []).find((r: any) => r.receiver_id === id)) fs[id] = "outgoing";
      else if ((inRows || []).find((r: any) => r.requester_id === id)) fs[id] = "incoming";
      else fs[id] = "none";
    });
    setFollowing((p) => ({ ...p, ...fMap }));
    setFriendship((p) => ({ ...p, ...fs }));
  };

  const toggleFollow = async (targetId: string) => {
    if (!meId || meId === targetId) return;
    const isFollowing = !!following[targetId];
    setBusy((p) => ({ ...p, [targetId]: true }));
    setFollowing((p) => ({ ...p, [targetId]: !isFollowing }));
    try {
      if (isFollowing) {
        await supabase.from("follows").delete().eq("follower_id", meId).eq("following_id", targetId);
      } else {
        await supabase
          .from("follows")
          .insert({ follower_id: meId, following_id: targetId, created_at: new Date().toISOString() });
      }
    } finally {
      setBusy((p) => ({ ...p, [targetId]: false }));
    }
  };

  const sendFriendRequest = async (targetId: string) => {
    if (!meId || meId === targetId) return;
    if (friendship[targetId] === "outgoing" || friendship[targetId] === "friends") return;
    setBusy(p => ({ ...p, [targetId]: true }));
    try {
      await supabase.from("friendships").insert({ requester_id: meId, receiver_id: targetId, status: "pending", created_at: new Date().toISOString() });
      setFriendship((p) => ({ ...p, [targetId]: "outgoing" }));
    } finally {
      setBusy((p) => ({ ...p, [targetId]: false }));
    }
  };

  // búsqueda
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const q = deferred.trim();
      if (q.length < 2) {
        if (!cancelled) {
          setResults([]);
          setFollowing({});
          setFriendship({});
        }
        return;
      }
      setLoading(true);
      try {
        const or = `full_name.ilike.%${q}%,username.ilike.%${q}%`;
        const { data: raw } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .or(or)
          .neq("id", meId || "")
          .order("username", { ascending: true })
          .limit(20);

        if (!cancelled) {
          const mapped =
            (raw || []).map((r: any) => ({
              id: r.id,
              username: r.username,
              full_name: r.full_name,
              avatar_url: r.avatar_url,
            })) ?? [];
          setResults(mapped);
          await refreshSocial(mapped.map((m) => m.id));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [deferred, meId, supabase]);

  // posicion dropdown desktop
  const anchorRefEl = anchorRef;
  useEffect(() => {
    const el = anchorRefEl.current;
    if (!el) return;
    const set = () => {
      const r = el.getBoundingClientRect();
      setAnchor({ left: r.left, top: r.bottom + 8, width: r.width });
    };
    set();
    window.addEventListener("resize", set);
    window.addEventListener("scroll", set, true);
    return () => {
      window.removeEventListener("resize", set);
      window.removeEventListener("scroll", set, true);
    };
  }, [anchorRefEl]);

  const ResultsList = (props: { onNavigate?: () => void }) => (
    <ul className="divide-y divide-neutral-100 max-h-[70vh] overflow-auto">
      {results.map((p) => {
        const isFollowing = !!following[p.id];
        const isBusy = !!busy[p.id];
        return (
          <li key={p.id} className="p-3 flex items-center gap-3 hover:bg-neutral-50 transition-colors">
            <Link href={`/profile/${p.username}`} className="flex items-center gap-3 flex-1 min-w-0" onClick={props.onNavigate}>
              <Avatar size={32} src={p.avatar_url} alt={p.full_name || p.username} />
              <div className="min-w-0">
                <div className="text-sm line-clamp-1">{p.full_name || "—"}</div>
                <div className="text-xs text-neutral-500">@{p.username}</div>
              </div>
            </Link>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  toggleFollow(p.id);
                }}
                disabled={isBusy}
                className={[
                  "px-3 py-1.5 rounded-full text-[12px] border transition-colors",
                  isFollowing ? "bg-[#1F48AF] text-white border-[#1F48AF]" : "bg-white text-black border-neutral-200 hover:border-[#1F48AF]/40",
                ].join(" ")}
                aria-pressed={isFollowing ? "true" : "false"}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  sendFriendRequest(p.id);
                }}
                disabled={isBusy}
                className="px-3 py-1.5 rounded-full text-[12px] border bg-white text-black border-neutral-200 hover:border-[#1F48AF]/40 disabled:opacity-60"
              >
                Add friend
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="relative w-full md:w-[460px]" ref={anchorRef}>
      {/* Input — desktop y móvil */}
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpenDesktop(true)}
          placeholder="Search users and open their profile"
          className="hidden sm:block w-full rounded-full border border-neutral-200 px-4 py-2 outline-none focus:border-[#1F48AF] transition-all text-sm"
        />
        <button
          onClick={() => setOpenSheet(true)}
          className="sm:hidden w-full rounded-full border border-neutral-200 px-4 py-2 text-left text-sm bg-white"
        >
          Search users and open their profile
        </button>
      </div>

      {/* Dropdown desktop */}
      {openDesktop && !!query && anchor && (
        <div
          className="hidden sm:block fixed z-40 rounded-2xl border border-neutral-200 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.08)] overflow-hidden"
          style={{ left: anchor.left, top: anchor.top, width: anchor.width }}
          role="listbox"
        >
          {loading ? (
            <div className="p-4 text-sm text-neutral-500">
              {query.trim().length < 2 ? "Type at least 2 characters…" : "Searching…"}
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm text-neutral-500">No users found</div>
          ) : (
            <ResultsList onNavigate={() => setOpenDesktop(false)} />
          )}
          <div className="p-2 text-right">
            <button onClick={() => setOpenDesktop(false)} className="text-xs text-neutral-500 hover:text-neutral-700">
              close
            </button>
          </div>
        </div>
      )}

      {/* SHEET móvil */}
      <AnimatePresence>
        {openSheet && (
          <>
            <motion.div
              className="sm:hidden fixed inset-0 z-40 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpenSheet(false)}
            />
            <motion.div
              className="sm:hidden fixed left-0 right-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-[0_-10px_30px_rgba(0,0,0,0.2)]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ height: "70vh" }}
            >
              <div className="pt-3 pb-2">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-neutral-300" />
              </div>
              <div className="px-4 pb-3">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search users…"
                  className="w-full rounded-full border border-neutral-200 px-4 py-2 outline-none focus:border-[#1F48AF] transition-all text-sm"
                />
              </div>
              <div className="px-1 pb-[env(safe-area-inset-bottom)]">
                {loading ? (
                  <div className="p-4 text-sm text-neutral-500">{query.trim().length < 2 ? "Type at least 2 characters…" : "Searching…"}</div>
                ) : results.length === 0 ? (
                  <div className="p-4 text-sm text-neutral-500">No users found</div>
                ) : (
                  <ResultsList onNavigate={() => setOpenSheet(false)} />
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ===============================
   Touring Ribbon (para pestaña Friends)
   =============================== */
const NowTouringRibbon: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [items, setItems] = useState<
    Array<{
      concert_id: string;
      artist_id: string | null;
      artist_name: string | null;
      tour: string | null;
      city: string | null;
      country: string | null;
      year: number | null;
      username: string | null;
      full_name: string | null;
      created_at: string;
    }>
  >([]);
  const visibleIdsRef = useRef<string[] | null>(null);

  const getVisibleUserIds = async (): Promise<string[]> => {
    if (!user?.id) return [];
    if (visibleIdsRef.current) return visibleIdsRef.current;

    const [followsRes, frA, frB] = await Promise.all([
      supabase.from("follows").select("following_id").eq("follower_id", user.id),
      supabase
        .from("friendships")
        .select("receiver_id")
        .eq("requester_id", user.id)
        .eq("status", "accepted"),
      supabase
        .from("friendships")
        .select("requester_id")
        .eq("receiver_id", user.id)
        .eq("status", "accepted"),
    ]);

    const ids = new Set<string>([user.id]);
    (followsRes.data || []).forEach((r: any) => ids.add(r.following_id));
    (frA.data || []).forEach((r: any) => ids.add(r.receiver_id));
    (frB.data || []).forEach((r: any) => ids.add(r.requester_id));
    visibleIdsRef.current = Array.from(ids);
    return visibleIdsRef.current;
  };

  useEffect(() => {
    let mounted = true;
    visibleIdsRef.current = null;

    (async () => {
      const ids = await getVisibleUserIds();
      if (ids.length === 0) {
        if (mounted) setItems([]);
        return;
      }

      const { data: ph, error } = await supabase
        .from("concert_photos")
        .select("id, user_id, concert_id, created_at")
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .limit(24);

      if (error || !ph?.length) {
        if (mounted) setItems([]);
        return;
      }

      const concertIds = [...new Set(ph.map((x) => x.concert_id))];
      const userIds = [...new Set(ph.map((x) => x.user_id))];

      const [{ data: concerts }, { data: users }] = await Promise.all([
        supabase
          .from("concerts")
          .select("id, artist_name, tour, city, country, year")
          .in("id", concertIds),
        supabase
          .from("profiles")
          .select("id, username, full_name")
          .in("id", userIds),
      ]);

      const artistNames = [
        ...new Set(
          (concerts ?? []).map((c: any) => c.artist_name).filter(Boolean)
        ),
      ] as string[];
      const { data: artists } = artistNames.length
        ? await supabase
            .from("artists")
            .select("id, name")
            .in("name", artistNames)
        : { data: [] as any[] };

      const idByName = Object.fromEntries(
        (artists ?? []).map((a: any) => [a.name, a.id])
      );
      const cById = Object.fromEntries(
        (concerts ?? []).map((c: any) => [c.id, c])
      );
      const uById = Object.fromEntries(
        (users ?? []).map((u: any) => [u.id, u])
      );

      const seen = new Set<string>();
      const built: any[] = [];
      for (const p of ph) {
        if (seen.has(p.concert_id)) continue;
        seen.add(p.concert_id);

        const c = cById[p.concert_id] || {};
        const u = uById[p.user_id] || {};
        built.push({
          concert_id: p.concert_id,
          artist_id: idByName[c.artist_name] ?? null,
          artist_name: c.artist_name ?? null,
          tour: c.tour ?? null,
          city: c.city ?? null,
          country: c.country ?? null,
          year: c.year ?? null,
          username: u.username ?? null,
          full_name: u.full_name ?? null,
          created_at: p.created_at,
        });
      }

      if (mounted) setItems(built);
    })();

  return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, supabase]);

  const stream = useMemo(() => {
    return items.map((it) => {
      const who = it.full_name || it.username || "—";
      const place =
        it.city && it.country
          ? `${it.city}, ${it.country}`
          : it.city || it.country || "";
      const when = it.year ? ` (${it.year})` : "";
      const artist = it.artist_name || "—";
      const tour = it.tour ? ` — ${it.tour}` : "";
      const href = it.artist_id ? `/artist/${it.artist_id}` : "#";
      const text = `${who} went to ${artist}${tour}${place ? ` in ${place}` : ""}${when}`;
      return { text, href };
    });
  }, [items]);

  if (stream.length === 0) {
    return (
      <div className="w-full overflow-hidden rounded-2xl border border-neutral-200">
        <div className="px-4 py-3 text-sm text-neutral-600">
          Your friends’ concerts will appear here soon.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-neutral-200 overflow-hidden">
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent" />
        <div className="w-full overflow-hidden">
          <div className="flex gap-8 animate-[ticker_40s_linear_infinite] whitespace-nowrap px-4 py-3 text-sm">
            {stream.concat(stream).map((row, i) => (
              <Link
                key={i}
                href={row.href}
                className="text-black hover:text-[#1F48AF] transition"
              >
                {row.text}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

/* ===============================
   Mini feed de conciertos (mosaico)
   =============================== */
const MiniConcertCard: React.FC<{
  image_urls?: string[] | null;
  authorId?: string | null;
  authorUsername?: string | null;
  authorName?: string | null;
  authorAvatar?: string | null;
}> = ({ image_urls, authorUsername, authorName, authorAvatar }) => {
  const urls = (image_urls || []).slice(0, 4);
  return (
    <article className="rounded-2xl overflow-hidden border border-neutral-200 bg-white">
      {urls.length ? (
        <div className="grid grid-cols-2 gap-1">
          {urls.map((u, i) => (
            <div key={i} className="relative aspect-square bg-neutral-100">
              <img src={u} alt="" className="absolute inset-0 w-full h-full object-cover" />
            </div>
          ))}
        </div>
      ) : (
        <div className="aspect-[4/3] bg-neutral-100" />
      )}
      <div className="p-2.5 flex items-center gap-2">
        <Avatar size={24} src={authorAvatar} alt={authorName || authorUsername || "user"} />
        <div className="text-[12px] line-clamp-1">{authorName || authorUsername || "—"}</div>
      </div>
    </article>
  );
};

type FeedMode = "followed" | "friends" | "for-you";

/** Feed de conciertos reutilizable (lista o mosaico) */
const ConcertFeed: React.FC<{
  mode?: FeedMode;
  tourFilter?: { artist_name: string; tour: string };
  smallCards?: boolean;
}> = ({ mode = "followed", tourFilter, smallCards = false }) => {
  const supabase = useSupabaseClient();
  const user = useUser();

  const PAGE_SIZE = 8;

  const [list, setList] = useState<ConcertPost[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const visibleIdsRef = useRef<string[] | null>(null);
  const fetchTokenRef = useRef(0);

  const resetKey = useMemo(() => {
    const userKey = mode === "for-you" ? "ignoreUser" : user?.id ?? "nouser";
    const tfA = tourFilter?.artist_name ?? "";
    const tfT = tourFilter?.tour ?? "";
    return `${mode}|${userKey}|${tfA}|${tfT}`;
  }, [mode, user?.id, tourFilter?.artist_name, tourFilter?.tour]);

  const getVisibleUserIds = async (): Promise<string[] | null> => {
    if (mode === "for-you") return null;
    if (!user?.id) return [];
    if (visibleIdsRef.current) return visibleIdsRef.current;

    if (mode === "followed") {
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);
      const ids = new Set<string>();
      (follows || []).forEach((r: any) => ids.add(r.following_id));
      visibleIdsRef.current = Array.from(ids);
      return visibleIdsRef.current;
    }

    // friends
    const [frA, frB] = await Promise.all([
      supabase
        .from("friendships")
        .select("receiver_id")
        .eq("requester_id", user.id)
        .eq("status", "accepted"),
      supabase
        .from("friendships")
        .select("requester_id")
        .eq("receiver_id", user.id)
        .eq("status", "accepted"),
    ]);
    const ids = new Set<string>();
    (frA.data || []).forEach((r: any) => ids.add(r.receiver_id));
    (frB.data || []).forEach((r: any) => ids.add(r.requester_id));
    visibleIdsRef.current = Array.from(ids);
    return visibleIdsRef.current;
  };

  const fallbackBuild = async (): Promise<ConcertPost[]> => {
    const ids = tourFilter ? null : await getVisibleUserIds();

    let q = supabase
      .from("concert_photos")
      .select("id, user_id, concert_id, image_url, created_at")
      .order("created_at", { ascending: false })
      .limit(400);

    if (ids && ids.length > 0) q = q.in("user_id", ids);

    const { data: ph } = await q;
    if (!ph?.length) return [];

    const firstByConcert: Record<
      string,
      { anchor: any; urls: string[]; last_at: string; user_id: string | null }
    > = {};
    for (const p of ph) {
      const cid = p.concert_id as string;
      if (!firstByConcert[cid]) {
        firstByConcert[cid] = {
          anchor: p,
          urls: [p.image_url],
          last_at: p.created_at,
          user_id: (p.user_id as string) ?? null,
        };
      } else if (firstByConcert[cid].urls.length < 12) {
        firstByConcert[cid].urls.push(p.image_url);
        if (p.created_at > firstByConcert[cid].last_at)
          firstByConcert[cid].last_at = p.created_at;
      }
    }

    const concertIds = Object.keys(firstByConcert);
    if (!concertIds.length) return [];

    const { data: concerts } = await supabase
      .from("concerts")
      .select("id, artist_name, tour, city, country, year")
      .in("id", concertIds);

    const cById = Object.fromEntries((concerts ?? []).map((c: any) => [c.id, c]));

    let posts: ConcertPost[] = concertIds.map((cid) => {
      const anchor = firstByConcert[cid].anchor;
      const urls = firstByConcert[cid].urls;
      const meta = cById[cid] || {};
      return {
        post_id: cid,
        concert_id: cid,
        artist_name: meta.artist_name ?? null,
        tour: meta.tour ?? null,
        city: meta.city ?? null,
        country: meta.country ?? null,
        year: meta.year ?? null,
        image_urls: urls,
        like_count: 0,
        comment_count: 0,
        created_at: firstByConcert[cid].last_at,
        user_id: firstByConcert[cid].user_id,
        caption: anchor.caption ?? null,
      };
    });

    if (tourFilter) {
      const a = tourFilter.artist_name.toLowerCase();
      const t = tourFilter.tour.toLowerCase();
      posts = posts.filter(
        (p) => (p.artist_name || "").toLowerCase() === a && (p.tour || "").toLowerCase() === t
      );
    }

    posts.sort((x, y) => {
      if (mode === "for-you") {
        const lx = x.like_count ?? 0;
        const ly = y.like_count ?? 0;
        if (ly !== lx) return ly - lx;
      }
      return x.created_at > y.created_at ? -1 : 1;
    });

    return posts;
  };

  const fetchPage = async () => {
    if (loading || done) return;
    setLoading(true);
    const myToken = ++fetchTokenRef.current;

    try {
      const ids = tourFilter ? null : await getVisibleUserIds();

      let q = supabase
        .from("v_concert_posts")
        .select(
          "user_id, concert_id, artist_name, tour, city, country, year, anchor_photo_id, image_urls, like_count, comment_count, last_photo_at"
        );

      if (mode === "for-you") {
        q = q
          .order("like_count", { ascending: false, nullsFirst: false })
          .order("last_photo_at", { ascending: false });
      } else {
        q = q.order("last_photo_at", { ascending: false });
      }

      q = q.range(page * 8, page * 8 + 8 - 1);

      if (ids && ids.length > 0) q = q.in("user_id", ids);
      if (tourFilter) q = q.eq("artist_name", tourFilter.artist_name).eq("tour", tourFilter.tour);

      const { data, error } = await q;

      if (fetchTokenRef.current !== myToken) return;

      let rows: ConcertPost[] = [];
      if (!error && data && data.length) {
        rows = (data as any[]).map((r) => ({
          post_id: r.concert_id,
          concert_id: r.concert_id,
          artist_name: r.artist_name,
          tour: r.tour,
          city: r.city,
          country: r.country,
          year: r.year,
          image_urls: Array.isArray(r.image_urls) ? r.image_urls : r.image_urls ? [r.image_urls] : [],
          like_count: r.like_count ?? 0,
          comment_count: r.comment_count ?? 0,
          created_at: r.last_photo_at,
          user_id: r.user_id ?? null,
          caption: null,
        }));
      }

      if (!rows.length) {
        const built = await fallbackBuild();
        if (fetchTokenRef.current !== myToken) return;
        rows = built.slice(page * 8, page * 8 + 8);
        if (!rows.length) setDone(true);
      }

      const filtered = rows.filter((p) => {
        if (seenIdsRef.current.has(p.concert_id)) return false;
        seenIdsRef.current.add(p.concert_id);
        return true;
      });

      setList((prev) => [...prev, ...filtered]);
      setPage((p) => p + 1);
      if (!filtered.length) setDone(true);
      setLoadedOnce(true);
    } finally {
      if (fetchTokenRef.current === myToken) setLoading(false);
    }
  };

  useEffect(() => {
    seenIdsRef.current.clear();
    visibleIdsRef.current = null;
    setList([]);
    setPage(0);
    setDone(false);
    setLoadedOnce(false);

    if (tourFilter || mode === "for-you" || user?.id) void fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const onIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting) fetchPage();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, resetKey]
  );

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(onIntersect, { rootMargin: "600px 0px" });
    obs.observe(node);
    return () => obs.disconnect();
  }, [onIntersect]);

  return (
    <>
      <div
        className={
          smallCards
            ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4"
            : "flex flex-col gap-5 sm:gap-6"
        }
      >
        {list.map((p) => (
          <div key={p.post_id} className={smallCards ? "w-full" : "mx-auto max-w-[560px] w-full px-3"}>
            {smallCards ? (
              <MiniConcertCard image_urls={p.image_urls} />
            ) : (
              <article className="rounded-3xl border border-neutral-200 overflow-hidden shadow-[0_6px_24px_rgba(0,0,0,0.06)] bg-white">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1">
                    <div className="text-sm font-semibold leading-tight">
                      {p.artist_name || "Concert"}
                      {p.tour ? ` — ${p.tour}` : ""}
                    </div>
                    <div className="text-[12px] text-neutral-500 leading-tight">
                      {p.city ? `${p.city}` : ""}
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
                      <span className="font-semibold">{p.like_count ?? 0}</span> likes ·{" "}
                      <span className="font-semibold">{p.comment_count ?? 0}</span> comments
                    </span>
                  </div>
                  {p.caption && (
                    <p className="mt-2 text-[15px] leading-relaxed">{p.caption}</p>
                  )}
                </div>
              </article>
            )}
          </div>
        ))}
      </div>

      <div ref={sentinelRef} className="h-10" />
      {loading && <div className="text-center text-xs text-neutral-500 py-6">Loading…</div>}
      {!loading && loadedOnce && !list.length && (
        <div className="text-center text-neutral-600">No concerts yet.</div>
      )}
    </>
  );
};

/* ===============================
   Feed principal
   =============================== */
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

const PhotoGrid: React.FC<{ urls: string[] | null | undefined; onOpen?: (u: string[], i: number)=>void }> = ({ urls, onOpen }) => {
  const flattened = normalizeUrls(urls as any) || [];
  const clean = (s: string) =>
    s.toString().replace(/^"+|"+$/g, "").replace(/^'+|'+$/g, "").replace(/^\{+|\}+$/g, "").trim();
  const safe = flattened.map(clean).filter((s) => s && s.toLowerCase() !== "null" && s.toLowerCase() !== "undefined");
  if (!safe.length) return null;

  const Tile: React.FC<{ src: string; idx: number; badge?: string | null; square?: boolean }> = ({ src, idx, badge, square }) => (
    <button
      onClick={() => onOpen && onOpen(safe, idx)}
      className={["relative overflow-hidden rounded-xl sm:rounded-2xl w-full block", square ? "aspect-square" : "aspect-[4/3]"].join(" ")}
    >
      <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
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
        {arr.map((u, i) => <Tile key={i} src={u} idx={i} />)}
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
          <Tile key={i} src={u} idx={i} badge={isLast ? `+${more}` : null} square />
        );
      })}
    </div>
  );
};

const ScopeTabs: React.FC<{
  value: "following" | "friends" | "foryou";
  onChange: (v: "following" | "friends" | "foryou") => void;
}> = ({ value, onChange }) => {
  const Btn: React.FC<{ val: "following" | "friends" | "foryou"; label: string; desc: string }> = ({ val, label, desc }) => {
    const active = value === val;
    return (
      <button
        onClick={() => onChange(val)}
        aria-pressed={active}
        className={[
          "group relative rounded-xl px-3 py-2 text-left transition-all",
          active ? "bg-[#1F48AF] text-white shadow-sm" : "text-neutral-800 hover:bg-neutral-100"
        ].join(" ")}
      >
        <div className="text-[13px] font-semibold tracking-tight">{label}</div>
        <div className={["text-[11px]", active ? "text-white/90" : "text-neutral-500"].join(" ")}>{desc}</div>
      </button>
    );
  };

  return (
    <div className="w-full max-w-[520px] rounded-2xl border border-neutral-200 bg-neutral-50 p-1 grid grid-cols-3 gap-1">
      <Btn val="following" label="Following" desc="Gente a la que sigues" />
      <Btn val="friends" label="Friends" desc="Solo amistades" />
      <Btn val="foryou" label="For You" desc="Top Content" />
    </div>
  );
};

/* ===============================
   Feed principal exportable
   =============================== */
export default function FeedPage() {
  const supabase = useSupabaseClient();
  const user = useUser();

  const [activeTab, setActiveTab] = useState<"general" | "friends">("general");
  const [feedScope, setFeedScope] = useState<"following" | "friends" | "foryou">(
    "following"
  );

  // Memories (compatibilidad) — se mantienen para usuarios legacy si lo necesitas
  const [memories, setMemories] = useState<MemoryPost[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memoriesPage, setMemoriesPage] = useState(0);
  const pageSize = 8;

  const [likedByMe, setLikedByMe] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState<Record<string, { likes: number; comments: number }>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentsCache, setCommentsCache] = useState<Record<string, Array<{ id: string; user_id: string; text: string; created_at: string; full_name?: string | null; username?: string | null; avatar_url?: string | null }>>>({});
  const [commentsPage, setCommentsPage] = useState<Record<string, number>>({});
  const [names, setNames] = useState<Record<string, { full_name?: string | null; username?: string | null }>>({});
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);

  const meId = user?.id ?? null;

  /* ------- helpers de filtros sociales ------- */
  const getFollowingIds = async (): Promise<string[]> => {
    if (!user?.id) return [];
    const { data } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
    return (data || []).map((r: any) => r.following_id);
  };
  const getFriendIds = async (): Promise<string[]> => {
    if (!user?.id) return [];
    const [frA, frB] = await Promise.all([
      supabase.from("friendships").select("receiver_id").eq("requester_id", user.id).eq("status", "accepted"),
      supabase.from("friendships").select("requester_id").eq("receiver_id", user.id).eq("status", "accepted"),
    ]);
    const ids = new Set<string>();
    (frA.data || []).forEach((r: any) => ids.add(r.receiver_id));
    (frB.data || []).forEach((r: any) => ids.add(r.requester_id));
    return Array.from(ids);
  };

  /* ------- Memories (legacy) ------- */
  const refreshCounts = async (postId: string) => {
    if (!meId) return;
    try {
      const [{ data: cts }, { data: liked }] = await Promise.all([
        supabase.from("v_posts_counts").select("post_id, like_count, comment_count").eq("post_id", postId).maybeSingle(),
        supabase.from("post_likes").select("post_id").eq("post_id", postId).eq("user_id", meId).maybeSingle(),
      ]);
      setCounts((p) => ({
        ...p,
        [postId]: { likes: cts?.like_count ?? p[postId]?.likes ?? 0, comments: cts?.comment_count ?? p[postId]?.comments ?? 0 },
      }));
      setLikedByMe((p) => ({ ...p, [postId]: !!liked }));
    } catch (e) {
      console.warn("refreshCounts error", e);
    }
  };

  const fetchMemories = async (reset = false) => {
    if (!user) return;
    setMemoriesLoading(true);
    try {
      // visibilidad por scope
      let authorIds: string[] | null = null;
      if (feedScope === "following") authorIds = await getFollowingIds();
      if (feedScope === "friends") authorIds = await getFriendIds();
      if (authorIds && authorIds.length === 0) {
        setMemories([]);
        setMemoriesPage(0);
        setMemoriesLoading(false);
        return;
      }

      const from = reset ? 0 : memoriesPage * pageSize;
      const to = from + pageSize - 1;

      let q = supabase
        .from("v_memories_posts")
        .select(
          "viewer_id, post_id, author_id, created_at, caption, image_urls, username, avatar_url, record_id, record_title, artist_name, record_vibe_color, record_cover_color"
        )
        .eq("viewer_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (authorIds) q = q.in("author_id", authorIds);

      const { data, error } = await q;
      if (error) throw error;

      let normalized: MemoryPost[] =
        (data || []).map((p: any) => ({
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
        })) ?? [];

      if (feedScope === "foryou" && normalized.length) {
        const ids = normalized.map((n) => n.id);
        const { data: countsRes } = await supabase
          .from("v_posts_counts")
          .select("post_id, like_count")
          .in("post_id", ids);
        const likeMap: Record<string, number> = {};
        (countsRes || []).forEach((r: any) => (likeMap[r.post_id] = r.like_count ?? 0));
        normalized = normalized.sort((a, b) => (likeMap[b.id] || 0) - (likeMap[a.id] || 0));
      }

      setMemories((prev) => (reset ? normalized : [...prev, ...normalized]));
      if (reset) setMemoriesPage(1);
      else setMemoriesPage((n) => n + 1);

      const postIds = normalized.map((n) => n.id);
      if (postIds.length) {
        const [{ data: countsRes }, { data: likedRes }] = await Promise.all([
          supabase.from("v_posts_counts").select("post_id, like_count, comment_count").in("post_id", postIds),
          supabase.from("post_likes").select("post_id").eq("user_id", user.id).in("post_id", postIds),
        ]);
        const nextCounts: Record<string, { likes: number; comments: number }> = {};
        (countsRes || []).forEach((r: any) => {
          nextCounts[r.post_id] = { likes: r.like_count ?? 0, comments: r.comment_count ?? 0 };
        });
        const nextLiked: Record<string, boolean> = {};
        (likedRes || []).forEach((r: any) => (nextLiked[r.post_id] = true));
        setCounts((prev) => (reset ? nextCounts : { ...prev, ...nextCounts }));
        setLikedByMe((prev) => (reset ? nextLiked : { ...prev, ...nextLiked }));
      }

      const authors = Array.from(new Set(normalized.map((n) => n.user_id))).filter(Boolean) as string[];
      if (authors.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, username").in("id", authors);
        const map: Record<string, { full_name?: string | null; username?: string | null }> = {};
        (profs || []).forEach((p: any) => (map[p.id] = { full_name: p.full_name, username: p.username }));
        setNames((prev) => ({ ...prev, ...map }));
      }
    } catch (e) {
      console.error("fetchMemories failed", e);
    } finally {
      setMemoriesLoading(false);
    }
  };

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
        await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
      } else {
        await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id, created_at: new Date().toISOString() });
      }
      await refreshCounts(postId);
    } catch (e) {
      // revert
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

    const { data, error } = await supabase
      .from("post_comments")
      .select("id, post_id, user_id, comment, created_at, profiles!inner(full_name, username, avatar_url)")
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

      setCommentsCache((prev) => ({ ...prev, [postId]: reset ? list : [...(prev[postId] || []), ...list] }));
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

  /* ------- efectos ------- */
  useEffect(() => {
    if (!user) return;
    fetchMemories(true);
    const retry = setTimeout(() => {
      if (!memoriesLoading && memories.length === 0) fetchMemories(true);
    }, 900);
    return () => clearTimeout(retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, feedScope]);

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-neutral-600">Sign in to see your Wall.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Banner azul grande */}
      <header className="w-full h-24 bg-[#1F48AF] flex items-end justify-end px-4 sm:px-6 pb-4">
        <Link
          href="/profile"
          aria-label="Go to Profile"
          className="inline-flex items-center gap-1 rounded-full bg-white/95 backdrop-blur px-3 py-1.5 text-[12px] sm:text-xs text-black border border-white/60 hover:bg-white transition-all"
        >
          <span className="hidden sm:inline">Profile</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </header>

      {/* Hero / Tabs / Search — CENTRADO Y ESTRECHO */}
      <div className="mx-auto max-w-[560px] px-3 md:px-4 pt-6 sm:pt-8 pb-4">
        <h1 className="text-[clamp(1.6rem,5vw,2.2rem)] font-normal tracking-tight" style={{ fontFamily: "Times New Roman, serif" }}>
          The Wall
        </h1>
        <div className="mt-2 h-px w-full bg-black/10" />

        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill active={activeTab === "general"} onClick={() => setActiveTab("general")} ariaControls="general">
              General
            </Pill>
            <Pill active={activeTab === "friends"} onClick={() => setActiveTab("friends")} ariaControls="friends">
              Friends
            </Pill>
          </div>
          <UserSearch meId={user?.id ?? null} />
        </div>

        {/* Subtabs solo para Memories legacy (si lo mantienes) */}
        {activeTab === "general" && (
          <div className="mt-3">
            <ScopeTabs value={feedScope} onChange={setFeedScope} />
          </div>
        )}
      </div>

      {/* Cuerpo — CENTRADO Y ESTRECHO */}
      <main className="pb-16">
        {activeTab === "friends" ? (
          <div className="mx-auto max-w-[560px] px-3 md:px-4">
            <NowTouringRibbon />
            <div className="mt-6">
              <ConcertFeed mode="friends" />
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-[560px] px-3 md:px-4">
            <div className="mb-6">
              <ConcertFeed mode="for-you" smallCards />
            </div>

            {/* Memories legacy (opcional) */}
            {memoriesLoading && memories.length === 0 ? (
              <div className="mx-auto max-w-[560px] px-3 py-10 text-center text-neutral-500">
                Loading…
              </div>
            ) : memories.length === 0 ? null : (
              <div className="mx-auto max-w-[560px] px-3">
                <div className="flex flex-col gap-6 sm:gap-8 py-5 sm:py-6">
                  {memories.map((p) => {
                    const vibe = softHashColor(p.username);
                    const displayName = names[p.user_id]?.full_name || "—";
                    const username = names[p.user_id]?.username || p.username;
                    const profileHref = `/profile/${username}`;
                    const visibleComments = openComments[p.id]
                      ? commentsCache[p.id]?.length ?? 0
                      : counts[p.id]?.comments ?? 0;

                    return (
                      <article key={p.id} className="rounded-2xl sm:rounded-3xl border border-neutral-200 bg-white overflow-hidden" style={{ boxShadow: V.shadow }}>
                        <Link href={profileHref} className="flex items-center gap-3 sm:gap-3 px-3 sm:px-4 py-3" style={{ background: `linear-gradient(0deg, #fff, ${vibe})` }}>
                          <Avatar size={34} src={p.avatar_url} alt={displayName} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] sm:text-sm font-medium leading-tight line-clamp-1">{displayName}</div>
                            <div className="text-[11px] sm:text[12px] text-neutral-500 leading-tight">{fmtDate(p.created_at)}</div>
                          </div>
                        </Link>

                        <div className="px-3 sm:px-4 pt-3 sm:pt-4">
                          <RecordChip
                            id={p.record_id}
                            title={p.record_title || undefined}
                            artist={p.record_artist_name || undefined}
                            vibe={p.record_vibe_color || undefined}
                            inner={p.record_cover_color || undefined}
                          />
                        </div>

                        {p.text && (
                          <div className="px-3 sm:px-4 py-3 sm:py-4 text-[14px] sm:text-[15px] leading-relaxed">
                            {p.text}
                          </div>
                        )}

                        <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                          <PhotoGrid
                            urls={p.image_urls}
                            onOpen={(u, i) => setLightbox({ urls: u, index: i })}
                          />
                        </div>

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
                                <span className="font-semibold">{counts[p.id]?.likes ?? 0}</span>{" "}
                                likes · <span className="font-semibold">{visibleComments}</span>{" "}
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
            )}
          </div>
        )}
      </main>

      {lightbox && (
        <Lightbox
          urls={lightbox.urls}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { useUser } from "@supabase/auth-helpers-react";
import { supabase } from "../lib/supabaseClient";

/** ========= Types ========= */
interface Profile {
  id: string;
  username: string | null;
  avatar_url?: string | null;
}

/** ========= Walcord palette + utils ========= */
const WALCORD_BLUE = "#1F48AF";
const PALETTE = [
  WALCORD_BLUE,
  "#0F254E",
  "#1B2A41",
  "#2E4057",
  "#14213D",
  "#2F3E46",
  "#0B4F6C",
  "#1D3557",
  "#2C3E50",
  "#112D32",
  "#4C4C47",
  "#3D2C2E",
  "#6B2E2E",
];

const hashStr = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return Math.abs(h);
};
const colorFor = (s: string) => PALETTE[hashStr(s) % PALETTE.length];
const norm = (s?: string | null) =>
  (s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const firstQueryValue = (v: string | string[] | undefined): string | null => {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
};

/** ========= Component ========= */
export default function FollowersPage() {
  const router = useRouter();
  const me = useUser();

  /** target profile (read-only if viewing others) */
  const [targetId, setTargetId] = useState<string | null>(null);
  const [targetUsername, setTargetUsername] = useState<string | null>(null);
  const readonly = !!(targetId && me?.id && targetId !== me.id);

  useEffect(() => {
    const init = async () => {
      if (!router.isReady) return;

      const qProfileId =
        firstQueryValue(router.query.profileId as any) ||
        firstQueryValue(router.query.user as any) ||
        firstQueryValue(router.query.u as any);

      const qUsername =
        firstQueryValue(router.query.username as any) ||
        firstQueryValue(router.query.handle as any);

      if (qProfileId) {
        setTargetId(qProfileId);
        return;
      }

      if (qUsername) {
        const { data } = await supabase
          .from("profiles")
          .select("id,username")
          .eq("username", qUsername)
          .maybeSingle();

        if (data?.id) {
          setTargetId(data.id);
          setTargetUsername(data.username);
          return;
        }
      }

      setTargetId(me?.id ?? null);
    };

    init();
  }, [router.isReady, router.query, me?.id]);

  /** state */
  const [tab, setTab] = useState<"following" | "followers">("following");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState<Profile[]>([]);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [myFollowingIds, setMyFollowingIds] = useState<Set<string>>(new Set());

  /** data loaders */
  const fetchProfilesByIds = async (ids: string[]): Promise<Profile[]> => {
    if (!ids.length) return [];
    const { data } = await supabase
      .from("profiles")
      .select("id,username,avatar_url")
      .in("id", Array.from(new Set(ids)));
    return (data || []) as Profile[];
  };

  useEffect(() => {
    const load = async () => {
      if (!targetId) return;
      setLoading(true);

      const { data: f1 } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", targetId);

      const { data: f2 } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", targetId);

      const followingIds = (f1 || [])
        .map((r: any) => r.following_id)
        .filter(Boolean);
      const followerIds = (f2 || [])
        .map((r: any) => r.follower_id)
        .filter(Boolean);

      const [followingProfiles, followerProfiles] = await Promise.all([
        fetchProfilesByIds(followingIds),
        fetchProfilesByIds(followerIds),
      ]);

      setFollowing(
        followingProfiles.sort((a, b) =>
          (a.username || "").localeCompare(b.username || "")
        )
      );
      setFollowers(
        followerProfiles.sort((a, b) =>
          (a.username || "").localeCompare(b.username || "")
        )
      );

      if (me?.id) {
        const { data: mine } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", me.id);
        setMyFollowingIds(new Set((mine || []).map((r: any) => r.following_id)));
      } else {
        setMyFollowingIds(new Set());
      }

      setLoading(false);
    };
    load();
  }, [targetId, me?.id]);

  /** actions */
  const isMeFollowing = useCallback(
    (userId: string) => myFollowingIds.has(userId),
    [myFollowingIds]
  );

  const follow = async (userId: string) => {
    if (!me?.id || me.id === userId) return;
    const { error } = await supabase
      .from("follows")
      .insert([{ follower_id: me.id, following_id: userId }]);
    if (!error) {
      setMyFollowingIds((prev) => new Set(prev).add(userId));
      if (!readonly && tab === "following") {
        const exists = following.some((p) => p.id === userId);
        if (!exists) {
          const prof = await fetchProfilesByIds([userId]);
          if (prof[0]) setFollowing((prev) => [prof[0], ...prev]);
        }
      }
    }
  };

  const unfollow = async (userId: string) => {
    if (!me?.id) return;
    const { error } = await supabase
      .from("follows")
      .delete()
      .match({ follower_id: me.id, following_id: userId });
    if (!error) {
      setMyFollowingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      if (!readonly && tab === "following") {
        setFollowing((prev) => prev.filter((p) => p.id !== userId));
      }
    }
  };

  /** filtering */
  const list = tab === "following" ? following : followers;
  const filtered = useMemo(() => {
    const q = norm(search);
    if (!q) return list;
    return list.filter((p) => norm(p.username).includes(q));
  }, [list, search]);

  // ✅ CONECTADO con pages/u/[username].tsx
  const openProfile = useCallback(
    async (p: Profile) => {
      const directUsername = (p.username || "").trim();
      if (directUsername) {
        router.push(`/u/${encodeURIComponent(directUsername)}`);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", p.id)
        .maybeSingle();

      const resolved = (data?.username || "").trim();
      if (resolved) {
        router.push(`/u/${encodeURIComponent(resolved)}`);
        return;
      }

      router.push(`/u/${encodeURIComponent(p.id)}`);
    },
    [router]
  );

  return (
    <main className="min-h-screen bg-white text-black font-[Roboto]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-[calc(env(safe-area-inset-bottom)+8rem)] relative overflow-visible">
        {/* TOP — back button (same as other pages) */}
        <div className="w-full px-1 sm:px-6 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-3 flex items-center justify-between relative z-[1000]">
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

        {/* ✅ Only the alt tabs (no headline above) */}
        <div className="flex flex-col items-center gap-3 mb-6 relative z-[1000]">
          {readonly && targetUsername && (
            <p className="text-xs text-neutral-600">@{targetUsername}</p>
          )}

          <div className="flex items-center gap-10 text-sm">
            <button
              onClick={() => setTab("following")}
              className={`pb-1 transition ${
                tab === "following"
                  ? "text-black border-b-2 border-black"
                  : "text-neutral-500 hover:text-black"
              }`}
            >
              Following
            </button>
            <button
              onClick={() => setTab("followers")}
              className={`pb-1 transition ${
                tab === "followers"
                  ? "text-black border-b-2 border-black"
                  : "text-neutral-500 hover:text-black"
              }`}
            >
              Followers
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="flex justify-center mb-5">
          <input
            type="text"
            placeholder="Search people"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md h-9 rounded-full border border-neutral-300 px-4 text-xs tracking-wide placeholder-neutral-500 focus:outline-none focus:border-black transition-all text-center"
          />
        </div>

        {/* Content */}
        {loading ? (
          <ul className="divide-y divide-neutral-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-neutral-100 animate-pulse" />
                <div className="flex-1 h-3 rounded bg-neutral-100 animate-pulse" />
              </li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <div className="mt-16 text-center text-xs text-neutral-500">
            {tab === "following"
              ? "Not following anyone yet."
              : "No followers yet."}
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {filtered.map((p) => {
              const hasAvatar = !!p.avatar_url;
              const color = colorFor(p.username || p.id);
              const amIFollowing = isMeFollowing(p.id);
              const isMeCard = me?.id === p.id;

              return (
                <li
                  key={p.id}
                  className="py-3 flex items-center gap-3 hover:bg-neutral-50/70 transition"
                >
                  {/* Avatar */}
                  <button
                    onClick={() => openProfile(p)}
                    title={p.username || "User"}
                    aria-label={`Open ${p.username || "user"} profile`}
                    className="shrink-0 w-10 h-10 rounded-full overflow-hidden ring-1 ring-black/5"
                    style={{ backgroundColor: hasAvatar ? "#FFFFFF" : color }}
                  >
                    {hasAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.avatar_url as string}
                        alt={p.username || "User avatar"}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </button>

                  {/* Username */}
                  <button
                    onClick={() => openProfile(p)}
                    className="flex-1 text-left min-w-0 hover:opacity-80 transition"
                    aria-label={`Open ${p.username || "user"} profile`}
                  >
                    <p className="text-[13px] leading-5 truncate font-light">
                      {p.username ? `@${p.username}` : "Unnamed"}
                    </p>
                  </button>

                  {/* CTA */}
                  {!isMeCard && me?.id && (
                    amIFollowing ? (
                      <button
                        onClick={() => unfollow(p.id)}
                        className="px-4 h-8 text-[11px] rounded-full border border-neutral-400 text-black hover:bg-neutral-100 transition"
                        aria-label={`Unfollow ${p.username || "user"}`}
                        title="Unfollow"
                      >
                        Following
                      </button>
                    ) : (
                      <button
                        onClick={() => follow(p.id)}
                        className="px-4 h-8 text-[11px] rounded-full bg-[--walcord-blue] text-white hover:opacity-90 transition"
                        style={{ backgroundColor: WALCORD_BLUE }}
                        aria-label={`Follow ${p.username || "user"}`}
                        title="Follow"
                      >
                        Follow
                      </button>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

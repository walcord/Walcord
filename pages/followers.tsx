"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  WALCORD_BLUE, "#0F254E", "#1B2A41", "#2E4057", "#14213D",
  "#2F3E46", "#0B4F6C", "#1D3557", "#2C3E50", "#112D32",
  "#4C4C47", "#3D2C2E", "#6B2E2E",
];

const hashStr = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return Math.abs(h);
};
const colorFor = (s: string) => PALETTE[hashStr(s) % PALETTE.length];
const norm = (s?: string | null) =>
  (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/** ========= Component ========= */
export default function FollowersPage() {
  const router = useRouter();
  const qs = useSearchParams();
  const me = useUser();

  /** target profile (read-only if viewing others) */
  const [targetId, setTargetId] = useState<string | null>(null);
  const [targetUsername, setTargetUsername] = useState<string | null>(null);
  const readonly = !!(targetId && me?.id && targetId !== me.id);

  useEffect(() => {
    const init = async () => {
      const qProfileId = qs.get("profileId") || qs.get("user") || qs.get("u");
      const qUsername = qs.get("username") || qs.get("handle");
      if (qProfileId) { setTargetId(qProfileId); return; }
      if (qUsername) {
        const { data } = await supabase
          .from("profiles")
          .select("id,username")
          .eq("username", qUsername)
          .maybeSingle();
        if (data?.id) { setTargetId(data.id); setTargetUsername(data.username); return; }
      }
      setTargetId(me?.id ?? null);
    };
    init();
  }, [qs, me?.id]);

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
        .from("follows").select("following_id").eq("follower_id", targetId);

      const { data: f2 } = await supabase
        .from("follows").select("follower_id").eq("following_id", targetId);

      const followingIds = (f1 || []).map((r: any) => r.following_id).filter(Boolean);
      const followerIds = (f2 || []).map((r: any) => r.follower_id).filter(Boolean);

      const [followingProfiles, followerProfiles] = await Promise.all([
        fetchProfilesByIds(followingIds),
        fetchProfilesByIds(followerIds),
      ]);

      setFollowing(followingProfiles.sort((a, b) => (a.username || "").localeCompare(b.username || "")));
      setFollowers(followerProfiles.sort((a, b) => (a.username || "").localeCompare(b.username || "")));

      if (me?.id) {
        const { data: mine } = await supabase
          .from("follows").select("following_id").eq("follower_id", me.id);
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
    const { error } = await supabase.from("follows").insert([{ follower_id: me.id, following_id: userId }]);
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
      .from("follows").delete()
      .match({ follower_id: me.id, following_id: userId });
    if (!error) {
      setMyFollowingIds((prev) => { const next = new Set(prev); next.delete(userId); return next; });
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

  const openProfile = (p: Profile) => router.push(`/profile?u=${p.id}`);

  /** ========= UI (editorial Walcord, consistente app/web) ========= */
  return (
    <main className="min-h-screen bg-white text-black font-[Roboto]">
      {/* Banner superior sobrio — ahora más alto (h-24) */}
      <header
        className="w-full h-24 flex items-end px-4 sm:px-6 pb-2"
        style={{ backgroundColor: WALCORD_BLUE }}
      >
        <button
          onClick={() => history.back()}
          aria-label="Go back"
          className="p-2 rounded-full hover:bg-white/10 transition"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </header>

      {/* Título + tabs (ligeramente más grandes) */}
      <div className="w-full flex flex-col items-center mt-8 mb-4">
        <h1
          className="text-[clamp(24px,4.5vw,32px)] tracking-tight"
          style={{ fontFamily: "Times New Roman, serif", fontWeight: 400, opacity: 0.9 }}
        >
          {tab === "following" ? "Following" : "Followers"}
        </h1>

        <div className="mt-3 flex items-center gap-8">
          <button
            onClick={() => setTab("following")}
            className={`px-5 h-11 rounded-full text-[14px] transition ${
              tab === "following"
                ? "bg-[#1F48AF] text-white"
                : "bg-white text-[#1F48AF] ring-1 ring-inset ring-[#1F48AF] hover:bg-[#EAF0FF]"
            }`}
          >
            Following
          </button>
          <button
            onClick={() => setTab("followers")}
            className={`px-5 h-11 rounded-full text-[14px] transition ${
              tab === "followers"
                ? "bg-[#1F48AF] text-white"
                : "bg-white text-[#1F48AF] ring-1 ring-inset ring-[#1F48AF] hover:bg-[#EAF0FF]"
            }`}
          >
            Followers
          </button>
        </div>

        {readonly && targetUsername && (
          <p className="text-xs text-neutral-600 mt-2 font-[Roboto]">@{targetUsername}</p>
        )}

        <hr className="w-[92%] mt-4 border-t border-black/20" />
      </div>

      {/* Buscador — se mantiene sobrio */}
      <div className="w-full flex flex-col items-center gap-6 mb-6 px-4">
        <input
          type="text"
          placeholder="Search users…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[92%] max-w-xl px-5 h-10 border border-black/60 rounded-full text-[13px] placeholder-neutral-500 focus:outline-none focus:border-black transition-all duration-200 text-center font-light"
        />
      </div>

      {/* Lista en TARJETAS (cards) */}
      <section className="w-full max-w-3xl mx-auto px-4 sm:px-6 mt-2 mb-24">
        {loading ? (
          <ul className="grid grid-cols-1 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="rounded-2xl border border-neutral-200 p-4">
                <div className="h-7 w-1/2 rounded bg-neutral-100 animate-pulse" />
                <div className="mt-3 h-10 w-full rounded-md bg-neutral-100 animate-pulse" />
              </li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <div className="text-center text-neutral-500 text-sm mt-16 font-[Roboto]">
            {tab === "following" ? "Not following anyone yet." : "No followers yet."}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3">
            {filtered.map((p) => {
              const hasAvatar = !!p.avatar_url;
              const color = colorFor(p.username || p.id);
              const amIFollowing = isMeFollowing(p.id);
              const isMeCard = me?.id === p.id;

              return (
                <li
                  key={p.id}
                  className="rounded-2xl border border-neutral-200 p-4 hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)] transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <button
                      onClick={() => openProfile(p)}
                      title={p.username || "User"}
                      aria-label={`Open ${p.username || "user"} profile`}
                      className="shrink-0 w-12 h-12 rounded-full overflow-hidden ring-1 ring-black/10"
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

                    {/* Username — Roboto LIGHT y clicable al perfil */}
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => openProfile(p)}
                        className="text-left w-full hover:opacity-80 transition"
                        aria-label={`Open ${p.username || "user"} profile`}
                      >
                        <p
                          className="text-[14px] leading-6 truncate font-light"
                          style={{ fontFamily: "Roboto, system-ui, -apple-system, Segoe UI" }}
                        >
                          {p.username ? `@${p.username}` : "Unnamed"}
                        </p>
                      </button>
                    </div>

                    {/* CTA (más grande: h-11 y 14px) */}
                    {!isMeCard && me?.id && (
                      amIFollowing ? (
                        <button
                          onClick={() => unfollow(p.id)}
                          className="px-4 h-11 text-[14px] rounded-full text-black ring-1 ring-inset ring-black/60 hover:bg-neutral-100 transition"
                          aria-label={`Unfollow ${p.username || "user"}`}
                          title="Unfollow"
                        >
                          Following
                        </button>
                      ) : (
                        <button
                          onClick={() => follow(p.id)}
                          className="px-4 h-11 text-[14px] rounded-full bg-[#1F48AF] text-white hover:bg-[#1A3A95] transition"
                          aria-label={`Follow ${p.username || "user"}`}
                          title="Follow"
                        >
                          Follow
                        </button>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

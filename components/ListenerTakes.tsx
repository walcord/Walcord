"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";

/**
 * ListenerTakes — mini feed editorial de recomendaciones/opiniones
 * Ranking (GENERAL): 1) likes  2) followers_count  3) fecha (desc)
 * Ranking (FRIENDS): solo amistades + orden por fecha (desc)
 * Tablas usadas: recommendations, recommendation_likes, recommendation_comments, profile_follow_counts
 * target_type: 'record' | 'artist' | 'track' (puedes limitar a 'record' si quieres)
 */

type TakeRow = {
  id: string;
  user_id: string;
  body: string | null;
  created_at: string;
  target_type: "record" | "artist" | "track";
  target_id: string;
  like_count: number;
  comment_count: number;
  author_username: string | null;
  author_full_name: string | null;
  author_avatar_url: string | null;
  followers_count: number; // de profile_follow_counts
  record_title?: string | null;
  record_artist_name?: string | null;
  record_vibe_color?: string | null;
  record_cover_color?: string | null;
};

function SquareRecord({
  id,
  title,
  artist,
  vibe,
  inner,
}: {
  id?: string | null;
  title?: string | null;
  artist?: string | null;
  vibe?: string | null;
  inner?: string | null;
}) {
  if (!id) return null;
  return (
    <Link href={`/record/${id}`} className="block">
      <div className="flex items-center gap-3 group">
        <div
          className="relative p-[2px] rounded-xl"
          style={{
            background:
              vibe && inner
                ? `linear-gradient(135deg, ${vibe}, ${inner})`
                : "linear-gradient(135deg,#e5e7eb,#d1d5db)",
          }}
        >
          <div className="w-10 h-10 rounded-[8px] bg-white flex items-center justify-center">
            <div className="w-5 h-5 rounded-md" style={{ backgroundColor: inner || "#111" }} />
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-medium tracking-tight line-clamp-1">{title}</div>
          <div className="text-[11px] text-neutral-500 line-clamp-1">{artist}</div>
        </div>
      </div>
    </Link>
  );
}

export default function ListenerTakes({
  scope = "general", // "general" | "friends"
}: {
  scope?: "general" | "friends";
}) {
  const supabase = useSupabaseClient();
  const user = useUser();
  const me = user?.id ?? null;

  const PAGE = 12;
  const [rows, setRows] = useState<TakeRow[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const getFriendIds = async (): Promise<string[]> => {
    if (!me) return [];
    const [frA, frB] = await Promise.all([
      supabase.from("friendships").select("receiver_id").eq("requester_id", me).eq("status", "accepted"),
      supabase.from("friendships").select("requester_id").eq("receiver_id", me).eq("status", "accepted"),
    ]);
    const ids = new Set<string>([me]);
    (frA.data || []).forEach((r: any) => ids.add(r.receiver_id));
    (frB.data || []).forEach((r: any) => ids.add(r.requester_id));
    return Array.from(ids);
  };

  const fetchPage = async () => {
    if (!me || loading || finished) return;
    setLoading(true);

    try {
      // base select con joins necesarios
      // Nota: usamos vistas/joins mínimos para performance; ajusta nombres si tus vistas difieren.
      let base = supabase
        .from("recommendations")
        .select(
          `
          id, user_id, body, created_at, target_type, target_id,
          profiles:profiles!recommendations_user_id_fkey(username, full_name, avatar_url),
          counts:v_recommendation_counts(like_count, comment_count),
          follows:profile_follow_counts!inner(followers_count),
          records!left(id, title, artist_name, vibe_color, cover_color)
        `
        );

      if (scope === "friends") {
        const friends = await getFriendIds();
        if (!friends.length) {
          setRows([]);
          setFinished(true);
          setLoading(false);
          return;
        }
        base = base.in("user_id", friends);
      }

      // rangos
      base = base.range(page * PAGE, page * PAGE + PAGE - 1);

      // ORDEN:
      // - GENERAL: likes desc, followers_count desc, created_at desc
      // - FRIENDS: created_at desc (reciente)
      if (scope === "friends") {
        base = base.order("created_at", { ascending: false });
      } else {
        base = base
          .order("counts.like_count", { ascending: false, nullsFirst: true })
          .order("follows.followers_count", { ascending: false, nullsFirst: true })
          .order("created_at", { ascending: false });
      }

      const { data, error } = await base;
      if (error) throw error;

      const mapped: TakeRow[] = (data || []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        body: r.body,
        created_at: r.created_at,
        target_type: r.target_type,
        target_id: r.target_id,
        like_count: r.counts?.like_count ?? 0,
        comment_count: r.counts?.comment_count ?? 0,
        author_username: r.profiles?.username ?? null,
        author_full_name: r.profiles?.full_name ?? null,
        author_avatar_url: r.profiles?.avatar_url ?? null,
        followers_count: r.follows?.followers_count ?? 0,
        record_title: r.records?.title ?? null,
        record_artist_name: r.records?.artist_name ?? null,
        record_vibe_color: r.records?.vibe_color ?? null,
        record_cover_color: r.records?.cover_color ?? null,
      }));

      setRows((p) => [...p, ...mapped]);
      setPage((p) => p + 1);
      if (!mapped.length || mapped.length < PAGE) setFinished(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setRows([]);
    setPage(0);
    setFinished(false);
  }, [scope]);

  useEffect(() => {
    if (!sentinel.current) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) fetchPage();
    }, { rootMargin: "600px 0px" });
    obs.observe(sentinel.current);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentinel.current, page, scope]);

  if (!me) return null;

  return (
    <section className="w-full">
      <h3 className="text-[15px] font-semibold tracking-tight mb-2" style={{ fontFamily: "Times New Roman, serif" }}>
        Listener Takes
      </h3>

      <div className="flex flex-col gap-3">
        {rows.map((t) => {
          const display = t.author_full_name || `@${t.author_username}` || "—";
          return (
            <article key={t.id} className="border border-neutral-200 rounded-2xl p-3 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full overflow-hidden bg-neutral-100 border border-neutral-200">
                  {t.author_avatar_url ? (
                    <img src={t.author_avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="text-[13px] font-medium">{display}</div>
                <div className="ml-auto text-[11px] text-neutral-500">
                  {new Date(t.created_at).toLocaleDateString()}
                </div>
              </div>

              {t.target_type === "record" && (
                <div className="mt-2">
                  <SquareRecord
                    id={t.target_id}
                    title={t.record_title || undefined}
                    artist={t.record_artist_name || undefined}
                    vibe={t.record_vibe_color || undefined}
                    inner={t.record_cover_color || undefined}
                  />
                </div>
              )}

              {t.body && <p className="mt-2 text-[14px] leading-relaxed">{t.body}</p>}

              <div className="mt-3 text-[12px] text-neutral-600">
                <span className="font-semibold">{t.like_count}</span> likes ·{" "}
                <span className="font-semibold">{t.comment_count}</span> comments ·{" "}
                <span>{t.followers_count} followers</span>
              </div>
            </article>
          );
        })}
      </div>

      <div ref={sentinel} className="h-10" />
      {loading && <div className="py-4 text-center text-xs text-neutral-500">Loading…</div>}
      {!loading && !rows.length && finished && (
        <div className="py-4 text-center text-neutral-600">No takes yet.</div>
      )}
    </section>
  );
}

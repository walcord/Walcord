"use client";

import { useEffect, useMemo, useState } from "react";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import WalcordPeopleIcon from "../icons/WalcordPeopleIcon";

export type ConcertPost = {
  post_id: string;              // == concert_id
  concert_id: string;
  anchor_photo_id: string | null;
  artist_name: string | null;
  tour: string | null;
  city: string | null;
  country: string | null;
  year: number | null;
  image_urls: any;
  like_count: number;
  comment_count: number;
  created_at: string;
};

type Profile = { id: string; full_name: string | null; avatar_url: string | null };

function toArray(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p.filter(Boolean);
  } catch {}
  return [String(raw)];
}

// Paleta
const BLUE = "#1F48AF";

/* =============== Lightbox simple (teclas ←/→/Esc) =============== */
function Lightbox({
  urls,
  index,
  onClose,
}: {
  urls: string[];
  index: number;
  onClose: () => void;
}) {
  const [i, setI] = useState(index);
  const total = urls.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setI((p) => (p - 1 + total) % total);
      if (e.key === "ArrowRight") setI((p) => (p + 1) % total);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, total]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center">
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full border border-white/30 px-3 py-1 text-white/90 text-sm"
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

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={i}
        src={urls[i]}
        alt=""
        className="max-h-[86vh] max-w-[92vw] object-contain rounded-xl shadow-2xl"
      />
      <div className="absolute bottom-5 text-white/80 text-xs">
        {i + 1} / {total}
      </div>
    </div>
  );
}

export default function ConcertCardVinyl({ post }: { post: ConcertPost }) {
  const supabase = useSupabaseClient();
  const user = useUser();

  const images = useMemo(() => toArray(post.image_urls), [post.image_urls]);
  const [likeCount, setLikeCount] = useState<number>(post.like_count || 0);
  const [commentCount, setCommentCount] = useState<number>(post.comment_count || 0);
  const [iLiked, setILiked] = useState<boolean>(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const [attendees, setAttendees] = useState<Profile[]>([]);
  const [comments, setComments] = useState<{ id: string; user_id: string; text: string; created_at: string }[]>([]);
  const [text, setText] = useState("");
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);

  // Uploader (de la foto ancla)
  const [uploader, setUploader] = useState<{ name: string; avatar: string | null; when: string | null }>({
    name: "—",
    avatar: null,
    when: null,
  });

  const title = post.artist_name || "—";
  const tour = post.tour || "";
  const place = post.city && post.country ? `${post.city}, ${post.country}` : post.city || post.country || "";
  const year = post.year ? ` · ${post.year}` : "";
  const anchorId = post.anchor_photo_id;

  // Estado inicial (like + attendees + uploader)
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (anchorId && user?.id) {
        const { data } = await supabase
          .from("concert_photo_likes")
          .select("photo_id")
          .eq("photo_id", anchorId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (mounted) setILiked(Boolean(data));
      }

      if (anchorId) {
        const [{ count: lc }, { count: cc }] = await Promise.all([
          supabase.from("concert_photo_likes").select("*", { count: "exact", head: true }).eq("photo_id", anchorId),
          supabase.from("concert_photo_comments").select("*", { count: "exact", head: true }).eq("photo_id", anchorId),
        ]);
        if (mounted) {
          if (typeof lc === "number") setLikeCount(lc);
          if (typeof cc === "number") setCommentCount(cc);
        }
      }

      const { data: at } = await supabase
        .from("concerts_atendees")
        .select("user_id")
        .eq("concert_id", post.concert_id)
        .limit(500);
      const ids = (at || []).map((r: any) => r.user_id);
      if (ids.length) {
        const { data: pf } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", ids)
          .order("full_name", { ascending: true });
        if (mounted) setAttendees((pf || []) as Profile[]);
      }

      if (anchorId) {
        const { data: ph } = await supabase
          .from("concert_photos")
          .select("user_id, created_at")
          .eq("id", anchorId)
          .maybeSingle();
        if (ph?.user_id) {
          const { data: pr } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", ph.user_id)
            .maybeSingle();
          if (mounted) {
            setUploader({
              name: pr?.full_name || "—",
              avatar: pr?.avatar_url || null,
              when: ph?.created_at || null,
            });
          }
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [supabase, user?.id, anchorId, post.concert_id]);

  // Cargar comentarios al abrir
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!commentsOpen || !anchorId) return;
      const { data } = await supabase
        .from("concert_photo_comments")
        .select("id, user_id, text, created_at")
        .eq("photo_id", anchorId)
        .order("created_at", { ascending: true });
      if (mounted) setComments((data || []) as any[]);
    })();
    return () => {
      mounted = false;
    };
  }, [commentsOpen, supabase, anchorId]);

  // Like/Unlike
  const onToggleLike = async () => {
    if (!user?.id || !anchorId) return;
    if (iLiked) {
      await supabase.from("concert_photo_likes").delete().eq("photo_id", anchorId).eq("user_id", user.id);
      setILiked(false);
      setLikeCount((n) => Math.max(0, n - 1));
    } else {
      await supabase.from("concert_photo_likes").insert({ photo_id: anchorId, user_id: user.id });
      setILiked(true);
      setLikeCount((n) => n + 1);
    }
  };

  // Comentar
  const onSend = async () => {
    if (!user?.id || !anchorId || !text.trim()) return;
    const payload = { photo_id: anchorId, user_id: user.id, text: text.trim() };
    const { data, error } = await supabase.from("concert_photo_comments").insert(payload).select().single();
    if (!error && data) {
      setComments((prev) => [...prev, data as any]);
      setText("");
      setCommentCount((n) => n + 1);
      if (!commentsOpen) setCommentsOpen(true);
    }
  };

  // Abrir lightbox
  const openLightbox = (idx: number) => {
    const list = images.filter(Boolean);
    if (!list.length) return;
    setLightbox({ urls: list, index: idx });
  };

  const urls = images.filter(Boolean).slice(0, 4);

  return (
    // IMPORTANTE: overflow-visible para que el popover no se recorte
    <article
      className="w-full rounded-2xl border border-neutral-200 bg-white overflow-visible"
      style={{ boxShadow: "0 6px 22px rgba(0,0,0,0.06)" }}
    >
      {/* Header compacto con uploader */}
      <div className="px-3 sm:px-4 pt-3 pb-2 flex items-center gap-2">
        <div className="h-8 w-8 rounded-full overflow-hidden bg-neutral-200 shrink-0">
          {uploader.avatar && <img src={uploader.avatar} alt="" className="h-8 w-8 object-cover" />}
        </div>
        <div className="min-w-0">
          <div className="text-[12px] leading-tight font-medium">{uploader.name}</div>
          <div className="text-[11px] text-neutral-500 leading-tight">
            {uploader.when ? new Date(uploader.when).toLocaleDateString() : ""}
          </div>
        </div>
      </div>

      {/* Títulos del concierto */}
      <div className="px-3 sm:px-4">
        <h3 className="text-[16px] leading-none" style={{ fontFamily: "Times New Roman, serif" }}>{title}</h3>
        {tour && <div className="text-[12px] text-neutral-600">{tour}</div>}
        <div className="text-[12px] text-neutral-800">{place}{year}</div>
      </div>

      {/* Fotos (clicables → lightbox) */}
      <div className="px-3 sm:px-4 py-2">
        {urls.length === 0 ? (
          <div className="aspect-[4/3] rounded-xl bg-neutral-100" />
        ) : urls.length === 1 ? (
          <button onClick={() => openLightbox(0)} className="relative w-full overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urls[0]} alt="" className="w-full h-auto object-contain rounded-xl" />
          </button>
        ) : urls.length === 2 ? (
          <div className="grid grid-cols-2 gap-1.5">
            {urls.map((u, i) => (
              <button key={i} onClick={() => openLightbox(i)} className="relative overflow-hidden rounded-xl aspect-[4/3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="absolute inset-0 w-full h-full object-cover" />
              </button>
            ))}
          </div>
        ) : urls.length === 3 ? (
          <div className="grid grid-cols-3 gap-1.5">
            {urls.map((u, i) => (
              <button key={i} onClick={() => openLightbox(i)} className="relative overflow-hidden rounded-xl aspect-[4/3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="absolute inset-0 w-full h-full object-cover" />
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {urls.map((u, i) => (
              <button key={i} onClick={() => openLightbox(i)} className="relative overflow-hidden rounded-xl aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="absolute inset-0 w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="px-3 sm:px-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-5 text-[12px]">
          <button
            type="button"
            onClick={onToggleLike}
            className={"flex items-center gap-1.5 " + (iLiked ? "text-[#1F48AF]" : "text-neutral-800 hover:text-[#1F48AF]")}
            title={iLiked ? "Unlike" : "Like"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 20s-6.5-4.3-8.8-7C1.3 10.9 2 8 4.2 6.8 6 5.8 8.3 6.3 9.6 8c1.3-1.7 3.6-2.2 5.4-1.2C17.2 8 17.9 10.9 14.8 13c-2.3 1.8-2.8 2.2-2.8 2.2"
                stroke="currentColor"
                strokeWidth={iLiked ? 2.1 : 1.5}
                fill={iLiked ? "currentColor" : "none"}
              />
            </svg>
            <span>{likeCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setCommentsOpen((v) => !v)}
            className="flex items-center gap-1.5 text-neutral-800 hover:text-[#1F48AF]"
            title="Comments"
          >
            <span className="underline">Comments</span>
            <span>({commentCount})</span>
          </button>
        </div>

        {/* Attendees (popover con z alto) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setAttendeesOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1 text-[11px] hover:border-neutral-300"
            title="Attendees"
            style={{ color: BLUE }}
          >
            <WalcordPeopleIcon className="w-4 h-4" />
            Attendees ({attendees.length})
          </button>

          {attendeesOpen && (
            <div className="absolute right-0 mt-2 z-50 w-72 rounded-xl border border-neutral-200 bg-white shadow-lg p-3">
              {attendees.length === 0 ? (
                <div className="text-xs text-neutral-500 p-2">No attendees yet.</div>
              ) : (
                <ul className="max-h-72 overflow-auto divide-y divide-neutral-100">
                  {attendees.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-2">
                      <div className="h-7 w-7 rounded-full overflow-hidden bg-neutral-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.avatar_url || "/avatar.png"} alt="" className="h-7 w-7 object-cover" />
                      </div>
                      <div className="text-sm">{p.full_name || "—"}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Comentarios */}
      {commentsOpen && (
        <div className="px-3 sm:px-4 pb-3">
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write a comment…"
              className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-[13px] outline-none focus:border-neutral-500"
            />
            <button
              onClick={onSend}
              className="rounded-md px-3 py-1.5 text-[12px] text-white disabled:opacity-60"
              style={{ backgroundColor: BLUE }}
              disabled={!text.trim() || !user || !anchorId}
              title={!user ? "Sign in to comment" : "Send"}
            >
              Send
            </button>
          </div>
          <ul className="mt-2 space-y-2">
            {comments.map((c) => (
              <li key={c.id} className="text-[13px] text-neutral-900">
                {c.text}
                <span className="ml-2 text-[11px] text-neutral-500">
                  {new Date(c.created_at).toLocaleString()}
                </span>
              </li>
            ))}
            {comments.length === 0 && <li className="text-xs text-neutral-500">Be the first to comment.</li>}
          </ul>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightbox && (
        <Lightbox
          urls={lightbox.urls}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </article>
  );
}

'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '../lib/supabaseClient';

/** Tooltip minimal Walcord (idéntico estilo al record id) */
const Tooltip = ({ children, message }: { children: React.ReactNode; message: string }) => (
  <div className="group relative flex justify-center items-center">
    {children}
    <span
      className="absolute bottom-full mb-2 w-max max-w-[240px] scale-0 group-hover:scale-100 transition-all bg-[#1F48AF] text-white text-xs px-3 py-[6px] rounded z-10 whitespace-nowrap font-light"
      style={{ fontFamily: 'Roboto' }}
    >
      {message}
    </span>
  </div>
);

/** Modal simple (idéntico estilo al record id) */
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
          <h3 className="text-lg" style={{ fontFamily: 'Times New Roman' }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-black text-sm font-light"
            style={{ fontFamily: 'Roboto' }}
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

/** Badge editorial del rating (como en el feed) */
const RatingBadge = ({ rate }: { rate: number }) => {
  if (Number.isNaN(rate)) return null;
  return (
    <div className="relative inline-flex items-center justify-center select-none" style={{ width: 44, height: 44 }}>
      <div className="w-11 h-11 rounded-full border border-black flex items-center justify-center bg-white">
        <span className="text-[16px] leading-none" style={{ fontFamily: 'Times New Roman' }}>
          {rate}
        </span>
      </div>
      {/* circulito azul Walcord con punto — borde fino y punto más pequeño */}
      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border border-[#1F48AF] bg-white flex items-center justify-center">
        <div className="w-[6px] h-[6px] rounded-full bg-[#1F48AF]" />
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

type RecordRow = {
  id: string;
  title: string;
  artist_name: string;
  release_year: number | null;
  vibe_color?: string | null;
  cover_color?: string | null;
};

type Thought = {
  id: string;
  user_id: string;
  target_type: 'record';
  target_id: string; // record_id
  body: string;
  created_at: string;
  rating_id?: string | null;
  // hydrate
  likes_count?: number;
  comments_count?: number;
  liked_by_me?: boolean;
  record?: RecordRow | null;
  rate?: number | null;
};

type ThoughtComment = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile?: Profile;
};

export default function ListenerTakesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [me, setMe] = useState<Profile | null>(null);

  const [takes, setTakes] = useState<Thought[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentsMap, setCommentsMap] = useState<Record<string, ThoughtComment[]>>({});
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState<string>('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState<string>('');

  const [loginOpen, setLoginOpen] = useState(false);

  const pageTopRef = useRef<HTMLDivElement | null>(null);

  const requireAuth = (title: string) => {
    if (!userId) {
      setLoginOpen(true);
      return false;
    }
    return true;
  };

  useEffect(() => {
    const boot = async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);

      if (!uid) {
        setLoading(false);
        return;
      }

      // Perfil propio
      const { data: myp } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .eq('id', uid)
        .maybeSingle();
      if (myp) setMe(myp as Profile);

      // 1) mis listener takes (solo target_type='record'), más recientes primero
      const { data: recs, error } = await supabase
        .from('recommendations')
        .select('id, user_id, target_type, target_id, body, created_at, rating_id')
        .eq('user_id', uid)
        .eq('target_type', 'record')
        .order('created_at', { ascending: false })
        .limit(300);

      if (error) {
        setTakes([]);
        setLoading(false);
        return;
      }

      const list = (recs || []) as Thought[];

      // 2) records involucrados
      const recordIds = Array.from(new Set(list.map((t) => t.target_id))).filter(Boolean);
      let recordsMap: Record<string, RecordRow> = {};
      if (recordIds.length) {
        const { data: recRows } = await supabase
          .from('records')
          .select('id, title, artist_name, release_year, vibe_color, cover_color')
          .in('id', recordIds);
        (recRows || []).forEach((r: any) => {
          recordsMap[r.id] = r as RecordRow;
        });
      }

      // 3) likes y comments
      const ids = list.map((t) => t.id);
      const likesCount: Record<string, number> = {};
      const commentsCount: Record<string, number> = {};
      const likedSet = new Set<string>();

      if (ids.length) {
        const { data: likes } = await supabase
          .from('recommendation_likes')
          .select('recommendation_id')
          .in('recommendation_id', ids as any);
        (likes || []).forEach((row: any) => {
          const k = String(row.recommendation_id);
          likesCount[k] = (likesCount[k] || 0) + 1;
        });

        const { data: comments } = await supabase
          .from('recommendation_comments')
          .select('recommendation_id')
          .in('recommendation_id', ids as any);
        (comments || []).forEach((row: any) => {
          const k = String(row.recommendation_id);
          commentsCount[k] = (commentsCount[k] || 0) + 1;
        });

        const { data: myLikes } = await supabase
          .from('recommendation_likes')
          .select('recommendation_id')
          .in('recommendation_id', ids as any)
          .eq('user_id', uid);
        (myLikes || []).forEach((row: any) => likedSet.add(row.recommendation_id));
      }

      // 4) rates
      const ratingIds = Array.from(new Set(list.map((t) => t.rating_id).filter(Boolean))) as string[];
      let rateByRatingId: Record<string, number> = {};
      if (ratingIds.length) {
        const { data: ratingRows } = await supabase
          .from('ratings')
          .select('id, rate')
          .in('id', ratingIds);
        (ratingRows || []).forEach((r: any) => {
          rateByRatingId[r.id] = r.rate as number;
        });
      }

      // ensamblado final
      const hydrated: Thought[] = list.map((t) => ({
        ...t,
        record: recordsMap[t.target_id] || null,
        likes_count: likesCount[String(t.id)] ?? 0,
        comments_count: commentsCount[String(t.id)] ?? 0,
        liked_by_me: likedSet.has(t.id),
        rate: (t.rating_id ? rateByRatingId[t.rating_id] : null) ?? null,
      }));

      setTakes(hydrated);
      setLoading(false);
    };

    boot();
  }, []);

  const toggleLike = async (item: Thought) => {
    if (!requireAuth('Sign in to like')) return;
    if (!userId) return;

    if (item.liked_by_me) {
      await supabase.from('recommendation_likes').delete().match({ recommendation_id: item.id, user_id: userId });
      setTakes((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, liked_by_me: false, likes_count: Math.max(0, (it.likes_count || 0) - 1) } : it
        )
      );
    } else {
      await supabase.from('recommendation_likes').insert({ recommendation_id: item.id, user_id: userId });
      setTakes((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, liked_by_me: true, likes_count: (it.likes_count || 0) + 1 } : it))
      );
    }
  };

  const loadComments = async (id: string) => {
    const { data, error } = await supabase
      .from('recommendation_comments')
      .select('id, user_id, body, created_at')
      .eq('recommendation_id', id)
      .order('created_at', { ascending: true });
    if (error) return;

    const uids = Array.from(new Set((data || []).map((c) => c.user_id)));
    let pmap: Record<string, Profile> = {};
    if (uids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', uids);
      (profs || []).forEach((p: any) => (pmap[p.id] = p));
    }

    const mapped: ThoughtComment[] = (data || []).map((c: any) => ({
      ...c,
      profile: pmap[c.user_id],
    }));
    setCommentsMap((prev) => ({ ...prev, [id]: mapped }));
  };

  const sendReply = async () => {
    if (!replyFor || !userId) return;
    const bodyClean = replyBody.trim();
    if (bodyClean.length === 0 || bodyClean.length > 280) return;

    const { data, error } = await supabase
      .from('recommendation_comments')
      .insert({
        recommendation_id: replyFor,
        user_id: userId,
        body: bodyClean,
      })
      .select('id, created_at')
      .single();

    if (!error) {
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
          profile: { id: userId, full_name: me?.full_name || '—', username: me?.username || null },
        };
        return { ...prev, [replyFor]: [...prevList, newItem] };
      });
    }

    setReplyBody('');
    setReplyFor(null);
  };

  const beginEdit = (t: Thought) => {
    setEditingId(t.id);
    setEditingBody(t.body);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditingBody('');
  };
  const saveEdit = async () => {
    if (!editingId) return;
    const bodyClean = editingBody.trim();
    if (bodyClean.length === 0 || bodyClean.length > 280) return;

    const { error } = await supabase
      .from('recommendations')
      .update({ body: bodyClean })
      .eq('id', editingId)
      .eq('user_id', userId || '');

    if (!error) {
      setTakes((prev) => prev.map((it) => (it.id === editingId ? { ...it, body: bodyClean } : it)));
      cancelEdit();
    }
  };

  const deleteTake = async (id: string) => {
    if (!confirm('Delete this take?')) return;
    await supabase.from('recommendations').delete().eq('id', id).eq('user_id', userId || '');
    setTakes((prev) => prev.filter((it) => it.id !== id));
  };

  return (
    <main className="min-h-screen bg-white text-black">
      {/* Banner azul superior, sin logo, idéntico lenguaje visual */}
      <header className="w-full h-24 bg-[#1F48AF] flex items-end px-4 sm:px-6 pb-2">
        <button
          onClick={() => history.back()}
          aria-label="Go back"
          className="p-2 rounded-full hover:bg-[#1A3A95] transition"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </header>

      {/* Modal de Login si no hay sesión */}
      <Modal open={loginOpen} onClose={() => setLoginOpen(false)} title="Sign in to continue">
        <div className="space-y-3">
          <p className="text-sm text-gray-600 font-light" style={{ fontFamily: 'Roboto' }}>
            Create an account or sign in to interact with Walcord.
          </p>
          <Link
            href="/login"
            className="block text-center rounded-xl bg-[#1F48AF] text-white px-4 py-2 text-sm"
            style={{ fontFamily: 'Roboto' }}
          >
            Sign in
          </Link>
          <button
            onClick={() => setLoginOpen(false)}
            className="w-full text-center text-sm text-gray-500 underline"
            style={{ fontFamily: 'Roboto' }}
          >
            Continue browsing
          </button>
        </div>
      </Modal>

      {/* Cabecera de la página */}
      <div ref={pageTopRef} className="px-6 md:px-24 pt-10 pb-4">
        <div className="mx-auto w-full max-w-[780px]">
          <h1 className="text-[clamp(1.6rem,3vw,2.3rem)] font-normal mb-1" style={{ fontFamily: 'Times New Roman' }}>
            Your Listener Takes
          </h1>
        </div>
      </div>

      {/* Listado de takes */}
      <section className="px-6 md:px-24 pb-16">
        <div className="mx-auto w-full max-w-[780px]">
          {loading ? (
            <div className="text-sm text-neutral-500">Loading takes…</div>
          ) : takes.length === 0 ? (
            <div className="text-sm text-neutral-500">You haven’t posted any Listener Takes yet.</div>
          ) : (
            <ul className="space-y-4">
              {takes.map((it) => (
                <li
                  key={String(it.id)}
                  className="border border-neutral-200 rounded-3xl p-5 shadow-[0_10px_30px_rgba(0,0,0,0.06)]"
                >
                  {/* 🔧 Cambio clave: apilar en móvil, fila en ≥ sm */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <Link href={`/record/${it.target_id}`} className="shrink-0">
                        <div
                          className="w-16 h-16 rounded-xl flex items-center justify-center border border-black/10"
                          style={{ backgroundColor: it.record?.vibe_color || '#f3f3f3' }}
                          aria-label={`${it.record?.title || 'Record'} cover`}
                        >
                          <div
                            className="w-5 h-5 rounded-sm shadow"
                            style={{ backgroundColor: it.record?.cover_color || '#111' }}
                          />
                        </div>
                      </Link>

                      <div className="min-w-0">
                        <Link href={`/record/${it.target_id}`}>
                          <h3
                            className="text-[17px] leading-[1.2] sm:leading-5 font-normal hover:opacity-80 break-words"
                            style={{ fontFamily: 'Times New Roman' }}
                          >
                            {it.record?.title || 'Record'}
                          </h3>
                        </Link>
                        <div className="text-[12px] text-neutral-600 font-light" style={{ fontFamily: 'Roboto' }}>
                          by {it.record?.artist_name || '—'}
                          {it.record?.release_year ? ` · ${it.record.release_year}` : ''}
                        </div>
                        {/* Solo fecha (sin hora exacta) */}
                        <div className="text-[11px] text-neutral-500 mt-1">
                          {new Date(it.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* 🔧 En móvil, estos controles bajan debajo del título */}
                    <div className="flex items-center gap-2 sm:gap-3 sm:self-start">
                      {typeof it.rate === 'number' ? <RatingBadge rate={it.rate} /> : null}

                      {it.user_id === userId && (
                        <>
                          {editingId === it.id ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={saveEdit}
                                className="text-[11px] px-2 py-0.5 rounded-full bg-[#1F48AF] text-white"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-200"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => beginEdit(it)}
                                className="text-[11px] px-2 py-0.5 rounded-full border border-neutral-300 hover:bg-neutral-50"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteTake(it.id)}
                                className="text-[11px] px-2 py-0.5 rounded-full border border-neutral-300 hover:bg-neutral-50"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {editingId === it.id ? (
                    <textarea
                      value={editingBody}
                      onChange={(e) => setEditingBody(e.target.value)}
                      className="mt-3 w-full min-h-[90px] border border-neutral-300 rounded-2xl px-3 py-3 text-[15px] leading-7 outline-none focus:ring-2 focus:ring-[#1F48AF] font-[family-name:Times_New_Roman,Times,serif]"
                      maxLength={280}
                    />
                  ) : (
                    <p className="mt-3 text-[16px] leading-7 font-[family-name:Times_New_Roman,Times,serif]">
                      {it.body}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
                    <button
                      onClick={() => toggleLike(it)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition ${
                        it.liked_by_me
                          ? 'bg-[#1F48AF] text-white border-[#1F48AF]'
                          : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      Like · {it.likes_count || 0}
                    </button>

                    <button
                      onClick={async () => {
                        const isOpen = !!openComments[it.id];
                        const next = { ...openComments, [it.id]: !isOpen };
                        setOpenComments(next);
                        if (!isOpen && !commentsMap[it.id]) await loadComments(it.id);
                        setReplyFor(it.id);
                        if (!isOpen) {
                          setTimeout(() => {
                            document
                              .getElementById(`comments-${it.id}`)
                              ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }, 0);
                        }
                      }}
                      className="text-xs px-3 py-1.5 rounded-full border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                      aria-expanded={!!openComments[it.id]}
                    >
                      Comment · {it.comments_count || 0}
                    </button>

                    <Link
                      href={`/record/${it.target_id}`}
                      className="text-xs px-3 py-1.5 rounded-full border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                    >
                      Open record
                    </Link>
                  </div>

                  {openComments[it.id] && (
                    <div id={`comments-${it.id}`} className="mt-3">
                      {commentsMap[it.id] && commentsMap[it.id]!.length > 0 ? (
                        <ul className="space-y-2">
                          {commentsMap[it.id]!.map((c) => (
                            <li
                              key={c.id}
                              className="rounded-2xl bg-neutral-50 border border-neutral-200 px-3 py-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Image
                                    src={c.profile?.avatar_url || '/default-user-icon.png'}
                                    width={20}
                                    height={20}
                                    alt="user"
                                    className="rounded-full border border-black/10"
                                  />
                                  <span className="text-[13px] font-light font-[family-name:Times_New_Roman,Times,serif]">
                                    {c.profile?.full_name || '—'}
                                  </span>
                                </div>
                                <span className="text-[10px] text-neutral-500">
                                  {new Date(c.created_at).toLocaleString()}
                                </span>
                              </div>
                              <p className="mt-1 text-[14px]">{c.body}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-[12px] text-neutral-500">Be the first to comment.</div>
                      )}
                    </div>
                  )}

                  {replyFor === it.id && (
                    <div className="mt-3 border-t border-neutral-200 pt-3">
                      <textarea
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        placeholder="Write a reply…"
                        className="w-full min-h-[80px] border border-neutral-300 rounded-2xl px-3 py-3 text-[15px] outline-none focus:ring-2 focus:ring-[#1F48AF]"
                        maxLength={280}
                      />
                      <div className="mt-2 flex items-center justify-between">
                        <span
                          className={`text-xs ${replyBody.length > 280 ? 'text-red-600' : 'text-neutral-500'}`}
                        >
                          {280 - replyBody.length}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setReplyFor(null);
                              setReplyBody('');
                            }}
                            className="text-xs px-3 py-1.5 rounded-full bg-neutral-200 text-neutral-700"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={sendReply}
                            disabled={!replyBody.trim().length || replyBody.length > 280}
                            className={`text-xs px-3 py-1.5 rounded-full ${
                              replyBody.trim().length && replyBody.length <= 280
                                ? 'bg-[#1F48AF] text-white'
                                : 'bg-neutral-300 text-neutral-600 cursor-not-allowed'
                            }`}
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

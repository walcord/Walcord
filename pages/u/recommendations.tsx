'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react';

/**
 * Walcord — Recommendations v6
 * - Header: flecha minimalista pegada abajo (h-24), sin logo.
 * - Tabs: estilo editorial (más grandes).
 * - Composer: Record / Artist / Track + comentario (≤280).
 * - Feed: elegante + social con Like y Comment (iconos CSS).
 * - Comments: listado visible al pulsar Comment + reply inline.
 * - Nombres: tipografías Walcord (Times/Roboto Light).
 */

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
};

type Recommendation = {
  id: string | number;
  user_id: string;
  target_type: 'record' | 'artist' | 'track';
  target_id: string;
  body: string;
  created_at: string;
  profile?: Profile;
  target_label?: string;
  likes_count?: number;
  comments_count?: number;
  liked_by_me?: boolean;
};

type RecComment = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile?: Profile;
};

type SearchItem = { id: string; label: string };

export default function RecommendationsPage() {
  const supabase = useSupabaseClient();
  const me = useUser();

  // Tabs
  const [tab, setTab] = useState<'following'|'friends'|'foryou'>('following');

  // Composer
  const [targetType, setTargetType] = useState<'record'|'artist'|'track'>('record');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchItem[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<SearchItem | null>(null);
  const [body, setBody] = useState('');
  const remaining = 280 - body.length;
  const canPost = !!(me?.id && selectedTarget && body.trim().length > 0 && body.length <= 280);

  // Feed
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Recommendation[]>([]);
  const [posting, setPosting] = useState(false);

  // Comments (UI + data)
  const [replyFor, setReplyFor] = useState<string | number | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const replyRemaining = 280 - replyBody.length;
  const [openComments, setOpenComments] = useState<Record<string | number, boolean>>({});
  const [commentsMap, setCommentsMap] = useState<Record<string | number, RecComment[]>>({});

  // ───────────────────────────────── Search
  useEffect(() => {
    let active = true;

    const run = async () => {
      if (query.trim().length < 2) { setSuggestions([]); return; }

      if (targetType === 'artist') {
        const { data, error } = await supabase
          .from('artists')
          .select('id, name')
          .ilike('name', `%${query}%`)
          .limit(10);

        if (!active) return;
        if (error) { setSuggestions([]); return; }
        setSuggestions((data || []).map((r: any) => ({ id: r.id, label: r.name })));
        return;
      }

      if (targetType === 'record') {
        const { data, error } = await supabase
          .from('records')
          .select('id, title, artist_name, release_year')
          .or(`title.ilike.%${query}%,artist_name.ilike.%${query}%`)
          .limit(10);

        if (!active) return;
        if (error) { setSuggestions([]); return; }

        setSuggestions(
          (data || []).map((r: any) => ({
            id: r.id,
            label: `${r.title} — ${r.artist_name ?? ''}${r.release_year ? ` (${r.release_year})` : ''}`.trim(),
          }))
        );
        return;
      }

      // targetType === 'track'
      const { data: tr, error: terr } = await supabase
        .from('tracks')
        .select('id, track, record_id')
        .ilike('track', `%${query}%`)
        .limit(12);

      if (!active) return;
      if (terr || !tr?.length) { setSuggestions([]); return; }

      const recIds = Array.from(new Set(tr.map((t: any) => t.record_id).filter(Boolean)));
      let recMap: Record<string, any> = {};
      if (recIds.length) {
        const { data: recs } = await supabase
          .from('records')
          .select('id, title, artist_name, release_year')
          .in('id', recIds);
        (recs || []).forEach((r: any) => { recMap[r.id] = r; });
      }

      const mapped: SearchItem[] = tr.map((t: any) => {
        const rec = t.record_id ? recMap[t.record_id] : null;
        const tail = rec
          ? ` — ${rec.artist_name ?? ''}${rec.title ? ` · ${rec.title}` : ''}${rec.release_year ? ` (${rec.release_year})` : ''}`
          : '';
        return { id: t.id, label: `${t.track}${tail}`.trim() };
      });

      setSuggestions(mapped);
    };

    const t = setTimeout(run, 140);
    return () => { active = false; clearTimeout(t); };
  }, [query, targetType, supabase]);

  // ───────────────────────────────── Carga del feed
  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // Seguidos/amigos
      let followingIds: string[] = [];
      let friendsIds: string[] = [];
      if (me?.id) {
        const { data: f1 } = await supabase.from('follows').select('following_id').eq('follower_id', me.id);
        const { data: f2 } = await supabase.from('follows').select('follower_id').eq('following_id', me.id);
        followingIds = (f1 || []).map((r: any) => r.following_id);
        const followersIds = (f2 || []).map((r: any) => r.follower_id);
        const setFollowers = new Set(followersIds);
        friendsIds = followingIds.filter((id) => setFollowers.has(id));
      }

      let base = supabase
        .from('recommendations')
        .select('id, user_id, target_type, target_id, body, created_at')
        .order('created_at', { ascending: false })
        .limit(120);

      if (tab === 'following') {
        const allow = Array.from(new Set([me?.id, ...followingIds].filter(Boolean))) as string[];
        if (allow.length) base = base.in('user_id', allow);
      } else if (tab === 'friends') {
        const allow = Array.from(new Set(friendsIds)) as string[];
        if (allow.length) base = base.in('user_id', allow);
        else base = base.eq('user_id', '00000000-0000-0000-0000-000000000000'); // vacío controlado
      }

      const { data: recs, error } = await base;
      if (error) { setItems([]); setLoading(false); return; }

      // Perfiles
      const userIds = Array.from(new Set((recs || []).map((r) => r.user_id)));
      let profiles: Record<string, Profile> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', userIds);
        (profs || []).forEach((p: any) => { profiles[p.id] = p; });
      }

      // Etiquetas destino
      const byType = {
        record: (recs || []).filter((r) => r.target_type === 'record'),
        artist: (recs || []).filter((r) => r.target_type === 'artist'),
        track:  (recs || []).filter((r) => r.target_type === 'track'),
      };
      const labelMap: Record<string, string> = {};

      if (byType.record.length) {
        const ids = Array.from(new Set(byType.record.map(r => r.target_id)));
        const { data } = await supabase.from('records').select('id, title, artist_name, release_year').in('id', ids);
        (data || []).forEach((row: any) => {
          labelMap[row.id] = `${row.title} — ${row.artist_name ?? ''}${row.release_year ? ` (${row.release_year})` : ''}`.trim();
        });
      }
      if (byType.artist.length) {
        const ids = Array.from(new Set(byType.artist.map(r => r.target_id)));
        const { data } = await supabase.from('artists').select('id, name').in('id', ids);
        (data || []).forEach((row: any) => { labelMap[row.id] = row.name; });
      }
      if (byType.track.length) {
        const ids = Array.from(new Set(byType.track.map(r => r.target_id)));
        const { data } = await supabase.from('tracks').select('id, track, record_id').in('id', ids);
        const recIds = Array.from(new Set((data || []).map((t: any) => t.record_id).filter(Boolean)));
        let recMap: Record<string, any> = {};
        if (recIds.length) {
          const { data: recs2 } = await supabase.from('records').select('id, title, artist_name, release_year').in('id', recIds);
          (recs2 || []).forEach((r: any) => { recMap[r.id] = r; });
        }
        (data || []).forEach((row: any) => {
          const rec = row.record_id ? recMap[row.record_id] : null;
          labelMap[row.id] = rec
            ? `${row.track} — ${rec.artist_name ?? ''}${rec.title ? ` · ${rec.title}` : ''}${rec.release_year ? ` (${rec.release_year})` : ''}`
            : row.track;
        });
      }

      // Métricas likes/comments (lado cliente)
      const recIds = (recs || []).map((r) => r.id);
      let likedSet = new Set<string | number>();
      let likesCount: Record<string, number> = {};
      let commentsCount: Record<string, number> = {};

      if (recIds.length) {
        const { data: likes } = await supabase
          .from('recommendation_likes')
          .select('recommendation_id')
          .in('recommendation_id', recIds as any);
        (likes || []).forEach((row: any) => {
          const k = String(row.recommendation_id);
          likesCount[k] = (likesCount[k] || 0) + 1;
        });

        const { data: comments } = await supabase
          .from('recommendation_comments')
          .select('recommendation_id')
          .in('recommendation_id', recIds as any);
        (comments || []).forEach((row: any) => {
          const k = String(row.recommendation_id);
          commentsCount[k] = (commentsCount[k] || 0) + 1;
        });

        if (me?.id) {
          const { data: myLikes } = await supabase
            .from('recommendation_likes')
            .select('recommendation_id')
            .in('recommendation_id', recIds as any)
            .eq('user_id', me.id);
          (myLikes || []).forEach((row: any) => likedSet.add(row.recommendation_id));
        }
      }

      let mapped: Recommendation[] = (recs || []).map((r: any) => ({
        ...r,
        profile: profiles[r.user_id],
        target_label: labelMap[r.target_id] ?? '—',
        likes_count: likesCount[String(r.id)] ?? 0,
        comments_count: commentsCount[String(r.id)] ?? 0,
        liked_by_me: likedSet.has(r.id),
      }));

      if (tab === 'foryou') {
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        mapped = mapped
          .sort((a, b) => {
            const aRecent = new Date(a.created_at).getTime() >= weekAgo ? 1 : 0;
            const bRecent = new Date(b.created_at).getTime() >= weekAgo ? 1 : 0;
            return (bRecent - aRecent)
              || ((b.likes_count ?? 0) - (a.likes_count ?? 0))
              || (new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          });
      }

      setItems(mapped);
      setLoading(false);
    };

    load();
  }, [supabase, me?.id, tab]);

  // ───────────────────────────────── Comments helpers
  const loadComments = async (recId: string | number) => {
    const { data, error } = await supabase
      .from('recommendation_comments')
      .select('id, user_id, body, created_at')
      .eq('recommendation_id', recId)
      .order('created_at', { ascending: true });

    if (error) return;

    const uids = Array.from(new Set((data || []).map((c) => c.user_id)));
    let pmap: Record<string, Profile> = {};
    if (uids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', uids);
      (profs || []).forEach((p: any) => { pmap[p.id] = p; });
    }

    const mapped: RecComment[] = (data || []).map((c: any) => ({
      ...c,
      profile: pmap[c.user_id],
    }));

    setCommentsMap((prev) => ({ ...prev, [recId]: mapped }));
  };

  // ───────────────────────────────── Publicar
  const onPost = async () => {
    if (!canPost || !me?.id || !selectedTarget) return;
    setPosting(true);

    const tmpId = `tmp_${Date.now()}`;
    const optimistic: Recommendation = {
      id: tmpId,
      user_id: me.id,
      target_type: targetType,
      target_id: selectedTarget.id,
      body: body.trim(),
      created_at: new Date().toISOString(),
      profile: { id: me.id, full_name: me.user_metadata?.full_name || '—', username: null },
      target_label: selectedTarget.label,
      likes_count: 0,
      comments_count: 0,
      liked_by_me: false,
    };
    setItems((prev) => [optimistic, ...prev]);

    const { data, error } = await supabase
      .from('recommendations')
      .insert({
        user_id: me.id,
        target_type: targetType,
        target_id: selectedTarget.id,
        body: body.trim(),
      })
      .select('id')
      .single();

    if (error) {
      setItems((prev) => prev.filter((it) => it.id !== tmpId));
      alert(`Error posting: ${error.code ?? ''} ${error.message}`);
    } else {
      setItems((prev) => prev.map((it) => (it.id === tmpId ? { ...it, id: data.id } : it)));
    }

    setPosting(false);
    setBody('');
    setQuery('');
    setSelectedTarget(null);
    setSuggestions([]);

    // refresco del feed
    setTimeout(() => setTab((t) => t), 50);
  };

  // ───────────────────────────────── Like / Unlike
  const toggleLike = async (rec: Recommendation) => {
    if (!me?.id) return;
    if (rec.liked_by_me) {
      await supabase.from('recommendation_likes').delete().match({ recommendation_id: rec.id, user_id: me.id });
      setItems((prev) => prev.map((it) =>
        it.id === rec.id ? { ...it, liked_by_me: false, likes_count: Math.max(0, (it.likes_count || 0) - 1) } : it
      ));
    } else {
      await supabase.from('recommendation_likes').insert({ recommendation_id: rec.id, user_id: me.id });
      setItems((prev) => prev.map((it) =>
        it.id === rec.id ? { ...it, liked_by_me: true, likes_count: (it.likes_count || 0) + 1 } : it
      ));
    }
  };

  // ───────────────────────────────── Reply
  const sendReply = async () => {
    if (!replyFor || !me?.id || replyBody.trim().length === 0 || replyBody.length > 280) return;
    const bodyClean = replyBody.trim();

    const { data, error } = await supabase
      .from('recommendation_comments')
      .insert({
        recommendation_id: replyFor,
        user_id: me.id,
        body: bodyClean,
      })
      .select('id, created_at')
      .single();

    if (!error) {
      // Actualiza contador
      setItems((prev) => prev.map((it) =>
        it.id === replyFor ? { ...it, comments_count: (it.comments_count || 0) + 1 } : it
      ));

      // Añade al listado visible si está abierto
      setCommentsMap((prev) => {
        const prevList = prev[replyFor] || [];
        const newItem: RecComment = {
          id: data.id,
          user_id: me!.id,
          body: bodyClean,
          created_at: data.created_at,
          profile: { id: me!.id, full_name: me!.user_metadata?.full_name || '—', username: null },
        };
        return { ...prev, [replyFor]: [...prevList, newItem] };
      });
    }

    setReplyBody('');
    setReplyFor(null);
  };

  // ───────────────────────────────── UI helpers
  const tabBtn = (active: boolean) =>
    `px-4 py-2 rounded-full text-sm font-light tracking-wide ${
      active ? 'bg-[#1F48AF] text-white' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
    }`;

  // Icono Like (círculos concéntricos)
  const IconLike = ({ filled }: { filled?: boolean }) => (
    <span className="inline-block relative w-4 h-4 align-[-2px]" aria-hidden>
      <span className={`absolute inset-0 rounded-full border ${filled ? 'border-white' : 'border-current'}`}></span>
      <span className={`absolute inset-[3px] rounded-full border ${filled ? 'border-white' : 'border-current'}`}></span>
    </span>
  );

  // Icono Comment (burbuja)
  const IconComment = () => (
    <span className="inline-block relative align-[-2px] w-4 h-4" aria-hidden>
      <span className="absolute inset-0 rounded-[6px] border border-current"></span>
      <span className="absolute -bottom-[2px] left-[6px] w-2 h-2 rotate-45 border-b border-r border-current bg-transparent"></span>
    </span>
  );

  // ───────────────────────────────── Render
  return (
    <main className="min-h-screen bg-white text-black">
      {/* Header: flecha minimalista (h-24) pegada abajo, sin logo */}
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

      {/* Tabs */}
      <section className="w-full max-w-[44rem] mx-auto px-4 mt-4 sm:mt-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <button className={tabBtn(tab === 'following')} onClick={() => setTab('following')}>Following</button>
          <button className={tabBtn(tab === 'friends')} onClick={() => setTab('friends')}>Friends</button>
          <button className={tabBtn(tab === 'foryou')} onClick={() => setTab('foryou')}>For You</button>
        </div>
      </section>

      {/* Composer */}
      <section className="w-full max-w-[44rem] mx-auto px-4 mt-4">
        <div className="bg-white border border-neutral-200 rounded-3xl p-4 sm:p-5 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {(['record','artist','track'] as const).map(tt => (
              <label key={tt} className={`text-xs px-3 py-1.5 rounded-full border ${targetType===tt?'bg-[#1F48AF] text-white border-[#1F48AF]':'border-neutral-300 text-neutral-700'}`}>
                <input
                  type="radio"
                  name="tt"
                  className="hidden"
                  checked={targetType===tt}
                  onChange={() => { setTargetType(tt); setSelectedTarget(null); setQuery(''); setSuggestions([]); }}
                />
                {tt[0].toUpperCase()+tt.slice(1)}
              </label>
            ))}
          </div>

          {/* Selector destino */}
          <div className="relative">
            <input
              value={selectedTarget ? selectedTarget.label : query}
              onChange={(e) => { setSelectedTarget(null); setQuery(e.target.value); }}
              placeholder={`Search ${targetType}…`}
              className="w-full border border-neutral-300 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-[15px] outline-none focus:ring-2 focus:ring-[#1F48AF]"
            />
            {(!selectedTarget && suggestions.length > 0) && (
              <div className="absolute z-10 mt-2 w-full bg-white border border-neutral-200 rounded-2xl shadow-2xl max-h-64 overflow-auto">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    className="w-full text-left text-[15px] px-3 sm:px-4 py-2.5 hover:bg-neutral-50"
                    onClick={() => { setSelectedTarget(s); setSuggestions([]); }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Texto */}
          <div className="mt-3 sm:mt-4">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your recommendation…"
              className="w-full min-h=[96px] sm:min-h-[110px] border border-neutral-300 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-[15px] leading-7 outline-none focus:ring-2 focus:ring-[#1F48AF] font-[family-name:Times_New_Roman,Times,serif]"
              maxLength={280}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className={`text-xs ${remaining < 0 ? 'text-red-600' : 'text-neutral-500'}`}>{remaining}</span>
              <button
                onClick={onPost}
                disabled={!canPost || posting}
                className={`text-xs px-3 sm:px-4 py-2 rounded-full ${canPost ? 'bg-[#1F48AF] text-white' : 'bg-neutral-300 text-neutral-600 cursor-not-allowed'}`}
              >
                {posting ? 'Posting…' : 'Recommend'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Feed */}
      <section className="w-full max-w-[44rem] mx-auto px-4 mt-5 sm:mt-6 pb-20">
        {loading ? (
          <div className="text-sm text-neutral-500">Loading recommendations…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-neutral-500">No recommendations yet.</div>
        ) : (
          <ul className="space-y-3 sm:space-y-4">
            {items.map((it) => (
              <li key={String(it.id)} className="border border-neutral-200 rounded-3xl p-4 sm:p-5 shadow-[0_6px_24px_rgba(0,0,0,0.05)]">
                {/* Cabecera */}
                <div className="flex items-start justify-between">
                  <div>
                    {/* Nombre: Walcord fonts (Times/Roboto Light) */}
                    <div className="text-[15px] font-light font-[family-name:Times_New_Roman,Times,serif]">
                      {it.profile?.full_name || '—'}
                    </div>
                    <div className="text-[11px] text-neutral-500">{new Date(it.created_at).toLocaleString()}</div>
                  </div>
                  <div className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
                    {it.target_type.toUpperCase()}
                  </div>
                </div>

                {/* Destino */}
                <div className="mt-2 sm:mt-3">
                  <span className="inline-block text-[12px] px-2.5 py-1 rounded-full bg-[#1F48AF]/10 text-[#1F48AF]">
                    {it.target_label}
                  </span>
                </div>

                {/* Cuerpo */}
                <p className="mt-3 sm:mt-4 text-[16px] sm:text-[17px] leading-7 sm:leading-8 font-[family-name:Times_New_Roman,Times,serif]">
                  {it.body}
                </p>

                {/* Acciones */}
                <div className="mt-3 sm:mt-4 flex items-center gap-3 sm:gap-4">
                  <button
                    onClick={() => toggleLike(it)}
                    className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-1.5 transition ${it.liked_by_me ? 'bg-[#1F48AF] text-white border-[#1F48AF]' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'}`}
                    aria-label="Like"
                  >
                    <IconLike filled={it.liked_by_me} />
                    {it.liked_by_me ? 'Liked' : 'Like'} · {it.likes_count || 0}
                  </button>

                  <button
                    onClick={async () => {
                      const isOpen = !!openComments[it.id];
                      const next = { ...openComments, [it.id]: !isOpen };
                      setOpenComments(next);
                      if (!isOpen && !commentsMap[it.id]) {
                        await loadComments(it.id);
                      }
                      setReplyFor(it.id); // abre el cuadro de respuesta también
                    }}
                    className="text-xs px-3 py-1.5 rounded-full border border-neutral-300 text-neutral-700 hover:bg-neutral-50 flex items-center gap-1.5"
                    aria-expanded={!!openComments[it.id]}
                  >
                    <IconComment />
                    Comment · {it.comments_count || 0}
                  </button>
                </div>

                {/* Lista de comentarios */}
                {openComments[it.id] && (
                  <div className="mt-3 sm:mt-4">
                    {(commentsMap[it.id] && commentsMap[it.id]!.length > 0) ? (
                      <ul className="space-y-2">
                        {commentsMap[it.id]!.map((c) => (
                          <li key={c.id} className="rounded-2xl bg-neutral-50 border border-neutral-200 px-3 py-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[13px] font-light font-[family-name:Times_New_Roman,Times,serif]">
                                {c.profile?.full_name || '—'}
                              </span>
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

                {/* Reply inline */}
                {replyFor === it.id && (
                  <div className="mt-3 sm:mt-4 border-t border-neutral-200 pt-3 sm:pt-4">
                    <textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Write a reply…"
                      className="w-full min-h-[80px] sm:min-h-[90px] border border-neutral-300 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-[15px] outline-none focus:ring-2 focus:ring-[#1F48AF]"
                      maxLength={280}
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`text-xs ${replyRemaining < 0 ? 'text-red-600' : 'text-neutral-500'}`}>{replyRemaining}</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setReplyFor(null); setReplyBody(''); }} className="text-xs px-3 py-1.5 rounded-full bg-neutral-200 text-neutral-700">Cancel</button>
                        <button
                          onClick={sendReply}
                          disabled={!replyBody.trim().length || replyBody.length > 280}
                          className={`text-xs px-3 py-1.5 rounded-full ${replyBody.trim().length && replyBody.length<=280 ? 'bg-[#1F48AF] text-white' : 'bg-neutral-300 text-neutral-600 cursor-not-allowed'}`}
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
      </section>
    </main>
  );
}

'use client';

import type React from 'react';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

/* ========= Tipos locales ========= */
type Concert = {
  id: string;
  user_id: string | null;
  artist_id: string | null;
  country_code: string | null;
  city: string | null;
  event_date: string | null;
  tour_name: string | null;
  caption: string | null;
  created_at: string | null;
  post_type?: 'concert' | 'experience' | null;
  experience?: string | null;
  record_id?: string | null;
  cover_url?: string | null;
  cover_media_id?: string | null;
};

type MediaItem = { id: string; url: string; type: 'image' | 'video' };

type CommentRow = {
  id: string;
  concert_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  username: string | null;
  avatar_url: string | null;
};

type RecordPalette = {
  id: string;
  title: string;
  vibe_color: string | null;
  cover_color: string | null;
};

type CoverOption = { id: string; url: string };

type Attendee = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

type LikeUser = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  is_following: boolean;
};

type MentionProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type TimeoutId = ReturnType<typeof setTimeout>;

const cap = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/* ========= Viewer ========= */
export default function ConcertViewer() {
  const router = useRouter();
  const { id } = router.query;
  const supabase = useSupabaseClient();
  const user = useUser();

  const [concert, setConcert] = useState<Concert | null>(null);
  const [artistName,ssetArtistName] = useState<string>('');
  const [countryName, setCountryName] = useState<string>('');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  // EXTERNAL OWNER HEADER
  const [postAuthor, setPostAuthor] = useState<{
    id: string;
    username: string | null;
    avatar_url: string | null;
  } | null>(null);

  // social
  const [likesCount, setLikesCount] = useState<number>(0);
  const [iLike, setILike] = useState<boolean>(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentText, setCommentText] = useState('');
  const [likesPanelOpen, setLikesPanelOpen] = useState(false);
  const [likesUsers, setLikesUsers] = useState<LikeUser[]>([]);
  const [loadingLikesUsers, setLoadingLikesUsers] = useState(false);

  // paleta de record
  const [recordOptions, setRecordOptions] = useState<RecordPalette[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [updatingRecord, setUpdatingRecord] = useState(false);
  const [showRecordPicker, setShowRecordPicker] = useState(false);

  // cover del postcard
  const [coverOptions, setCoverOptions] = useState<CoverOption[]>([]);
  const [selectedCoverId, setSelectedCoverId] = useState<string | null>(null);
  const [updatingCover, setUpdatingCover] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);

  // personas con las que fui
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [savingAttendee, setSavingAttendee] = useState(false);
  const [removingAttendeeId, setRemovingAttendeeId] = useState<string | null>(null);

  const [peopleInput, setPeopleInput] = useState('');
  const [selectedPeople, setSelectedPeople] = useState<MentionProfile[]>([]);
  const [companySuggestions, setCompanySuggestions] = useState<MentionProfile[]>([]);
  const [companySearching, setCompanySearching] = useState(false);
  const companyDebouncer = useRef<TimeoutId | null>(null);

  // LIGHTBOX
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);

  // drag & drop board
  const dragIdRef = useRef<string | null>(null);

  // tour diary
  const [diaryExpanded, setDiaryExpanded] = useState(false);
  const [diaryDraft, setDiaryDraft] = useState('');
  const [savingDiary, setSavingDiary] = useState(false);
  const [diaryEditing, setDiaryEditing] = useState(false);

  // subida de media extra
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const isOwner = useMemo(
    () => Boolean(user?.id && concert?.user_id && user.id === concert.user_id),
    [user?.id, concert?.user_id]
  );

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const c = await loadConcert(String(id));
      if (c) {
        await Promise.all([loadMedia(String(id), c), loadSocial(String(id)), loadAttendees(String(id))]);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  useEffect(() => {
    if (!likesPanelOpen || !id) return;
    (async () => {
      await loadLikesUsers(String(id));
    })();
  }, [likesPanelOpen, id, user?.id]);

  /* ====== Buscar perfiles para People I went with (estilo FutureConcerts) ======
     IMPORTANTE: solo owner puede buscar/seleccionar. */
  useEffect(() => {
    if (!isOwner) {
      setCompanySuggestions([]);
      setCompanySearching(false);
      return;
    }

    const raw = peopleInput.trim();
    if (!raw || raw.length < 2) {
      setCompanySuggestions([]);
      setCompanySearching(false);
      return;
    }

    setCompanySearching(true);

    if (companyDebouncer.current) clearTimeout(companyDebouncer.current);
    companyDebouncer.current = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .ilike('username', `${raw}%`)
          .limit(10);

        setCompanySuggestions(((data as any) || []) as MentionProfile[]);
      } finally {
        setCompanySearching(false);
      }
    }, 200);
  }, [peopleInput, supabase, isOwner]);

  /* ========= LOADERS ========= */

  async function loadConcert(concertId: string): Promise<Concert | null> {
    const { data } = await supabase
      .from('concerts')
      .select(
        'id,user_id,artist_id,country_code,city,event_date,tour_name,caption,created_at,post_type,experience,record_id,cover_url,cover_media_id'
      )
      .eq('id', concertId)
      .single();

    if (!data) return null;
    const row = data as Concert;
    setConcert(row);
    setDiaryDraft(row.caption || '');
    setDiaryEditing(!row.caption);

    // load author for external header
    if (row.user_id) {
      const { data: p } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .eq('id', row.user_id)
        .maybeSingle();
      if (p) setPostAuthor({ id: p.id, username: p.username ?? null, avatar_url: p.avatar_url ?? null });
      else setPostAuthor({ id: row.user_id, username: null, avatar_url: null });
    } else {
      setPostAuthor(null);
    }

    let artistLabel = '';

    if (row.artist_id) {
      const { data: a } = await supabase.from('artists').select('name').eq('id', row.artist_id).single();
      if (a?.name) {
        setArtistName(a.name);
        artistLabel = a.name;
      } else {
        setArtistName('');
      }
    } else {
      setArtistName('');
    }

    if (row.country_code) {
      const { data: c } = await supabase.from('countries').select('name').eq('code', row.country_code).single();
      if (c?.name) setCountryName(c.name);
      else setCountryName('');
    } else {
      setCountryName('');
    }

    await loadRecordPalette(row, artistLabel || row.tour_name || '');

    return row;
  }

  async function loadRecordPalette(baseConcert: Concert, fallbackArtistName: string) {
    if (!baseConcert.artist_id && !fallbackArtistName) return;

    let query = supabase
      .from('records')
      .select('id,title,vibe_color,cover_color')
      .not('vibe_color', 'is', null)
      .not('cover_color', 'is', null);

    if (baseConcert.artist_id) {
      query = query.eq('artist_id', baseConcert.artist_id);
    } else if (fallbackArtistName) {
      query = query.ilike('artist_name', `%${fallbackArtistName}%`);
    }

    const { data } = await query.order('release_year', { ascending: true });
    const rows: RecordPalette[] = ((data as any) || []) as RecordPalette[];
    if (!rows.length) return;

    setRecordOptions(rows);
    const initialId = baseConcert.record_id || rows[0].id;
    setSelectedRecordId(initialId || null);
  }

  async function loadMedia(concertId: string, baseConcert?: Concert) {
    const { data } = await supabase
      .from('concert_media')
      .select('id, url, media_type, created_at')
      .eq('concert_id', concertId)
      .order('created_at', { ascending: true });

    const rows: any[] = Array.isArray(data) ? data : [];
    const items: MediaItem[] = rows
      .map(row => {
        const rawUrl: string = (row.url || '').trim();
        if (!rawUrl) return null;
        const flag = String(row.media_type || '').toLowerCase();
        const ext = rawUrl.split('?')[0].split('.').pop()?.toLowerCase() || '';
        const isVideo = flag === 'video' || ['mp4', 'mov', 'webm', 'm4v'].includes(ext);
        return { id: String(row.id), url: rawUrl, type: isVideo ? 'video' : 'image' } as MediaItem;
      })
      .filter(Boolean) as MediaItem[];

    setMedia(items);

    const imageOptions: CoverOption[] = items.filter(m => m.type === 'image').map(m => ({ id: m.id, url: m.url }));
    setCoverOptions(imageOptions);

    if (!selectedCoverId) {
      const initialCoverId = (baseConcert?.cover_media_id as string | null) || imageOptions[0]?.id || null;
      setSelectedCoverId(initialCoverId || null);
    }

    if (baseConcert && baseConcert.user_id && baseConcert.event_date) {
      await syncClipsToConcert(baseConcert);
    }
  }

  async function syncClipsToConcert(baseConcert: Concert) {
    const { data: clips } = await supabase
      .from('clips')
      .select('id, video_url, event_date, kind')
      .eq('user_id', baseConcert.user_id)
      .eq('kind', 'concert')
      .eq('event_date', baseConcert.event_date);

    if (!clips || !clips.length) return;

    await Promise.all(
      clips.map(async (clip: any) => {
        const url: string = (clip.video_url || '').trim();
        if (!url) return;
        await supabase
          .from('concert_media')
          .upsert(
            {
              concert_id: baseConcert.id,
              url,
              media_type: 'video',
            } as any,
            { onConflict: 'concert_id,url' }
          );
      })
    );
  }

  async function loadSocial(concertId: string) {
    const { count } = await supabase
      .from('concert_likes')
      .select('user_id', { count: 'exact', head: true })
      .eq('concert_id', concertId);
    setLikesCount(count || 0);

    const { data: mine } = user?.id
      ? await supabase.from('concert_likes').select('user_id').eq('concert_id', concertId).eq('user_id', user.id).maybeSingle()
      : ({ data: null } as any);
    setILike(!!mine);

    const { data: comm } = await supabase
      .from('concert_comments')
      .select('id, concert_id, user_id, comment, created_at, profiles(username, avatar_url)')
      .eq('concert_id', concertId)
      .order('created_at', { ascending: true });

    const mapped: CommentRow[] = (comm || []).map((r: any) => ({
      id: r.id,
      concert_id: r.concert_id,
      user_id: r.user_id,
      comment: r.comment,
      created_at: r.created_at,
      username: r.profiles?.username ?? null,
      avatar_url: r.profiles?.avatar_url ?? null,
    }));
    setComments(mapped);
  }

  async function loadLikesUsers(concertId: string) {
    setLoadingLikesUsers(true);
    try {
      const { data, error } = await supabase
        .from('concert_likes')
        .select('user_id, profiles(username, avatar_url)')
        .eq('concert_id', concertId)
        .order('created_at', { ascending: false });

      if (error) {
        setLikesUsers([]);
        return;
      }

      let followingIds: string[] = [];
      if (user?.id) {
        const { data: following, error: followsError } = await supabase.from('follows').select('following_id').eq('follower_id', user.id);
        if (!followsError && following) {
          followingIds = (following as any[]).map((f: any) => f.following_id);
        }
      }

      const list: LikeUser[] =
        (data || []).map((row: any) => ({
          user_id: row.user_id,
          username: row.profiles?.username ?? null,
          avatar_url: row.profiles?.avatar_url ?? null,
          is_following: user?.id ? followingIds.includes(row.user_id) : false,
        })) ?? [];
      setLikesUsers(list);
    } finally {
      setLoadingLikesUsers(false);
    }
  }

  async function loadAttendees(concertId: string) {
    const { data } = await supabase.from('concerts_atendees').select('id, profiles(username, avatar_url)').eq('concert_id', concertId).order('created_at', { ascending: true });

    const rows: Attendee[] =
      (data || []).map((r: any) => ({
        id: r.id,
        username: r.profiles?.username ?? null,
        avatar_url: r.profiles?.avatar_url ?? null,
      })) ?? [];
    setAttendees(rows);
  }

  /* ========= LABELS & HELPERS ========= */

  const dateLabel = useMemo(() => {
    if (!concert?.event_date) return '';
    try {
      const d = new Date(concert.event_date);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return String(concert.event_date);
    }
  }, [concert?.event_date]);

  const headerTitle = concert?.post_type === 'experience' && concert.experience ? cap(concert.experience) : artistName || 'Concert';

  const userLiked = iLike;

  const imageList = useMemo(() => media.filter(m => m.type === 'image'), [media]);

  const currentPalette = useMemo(() => (selectedRecordId ? recordOptions.find(r => r.id === selectedRecordId) || null : null), [recordOptions, selectedRecordId]);

  const currentVibe = currentPalette?.vibe_color || '#0E1A3A';
  const currentCoverColor = currentPalette?.cover_color || '#FFFFFF';

  const currentCoverThumb = useMemo(() => {
    if (!selectedCoverId) return null;
    const opt = coverOptions.find(c => c.id === selectedCoverId);
    return opt || null;
  }, [coverOptions, selectedCoverId]);

  const diaryText = concert?.caption || '';
  const diaryShouldTruncate = diaryText.length > 220;
  const diaryPreview = diaryShouldTruncate ? diaryText.slice(0, 220).trimEnd() + '…' : diaryText;

  const hasLocation = Boolean(concert?.city || countryName || concert?.country_code);

  /* ========= HANDLERS ========= */

  const handleLike = async () => {
    if (!user?.id || !id) return;
    if (userLiked) {
      await supabase.from('concert_likes').delete().eq('concert_id', id).eq('user_id', user.id);
      setILike(false);
      setLikesCount(c => Math.max(0, c - 1));
    } else {
      await supabase.from('concert_likes').upsert({ concert_id: String(id), user_id: user.id });
      setILike(true);
      setLikesCount(c => c + 1);
    }
  };

  const handleSendComment = async () => {
    if (!user?.id || !id || !commentText.trim()) return;
    const payload = {
      concert_id: String(id),
      user_id: user.id,
      comment: commentText.trim(),
    };
    await supabase.from('concert_comments').insert(payload);
    setCommentText('');
    await loadSocial(String(id));
    // @ts-expect-error location global
    location.hash = 'comments';
  };

  const openLightbox = (idx: number) => {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  };

  const closeLightbox = () => setLightboxOpen(false);

  const prevImage = () => {
    if (!imageList.length) return;
    setLightboxIndex(i => (i - 1 + imageList.length) % imageList.length);
  };

  const nextImage = () => {
    if (!imageList.length) return;
    setLightboxIndex(i => (i + 1) % imageList.length);
  };

  // bloquear scroll fondo cuando lightbox abierto
  useEffect(() => {
    if (lightboxOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [lightboxOpen]);

  // navegación teclado
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'ArrowRight') nextImage();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen]);

  // gestos táctiles
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };
  const onTouchEnd = () => {
    const dx = touchDeltaX.current;
    touchStartX.current = null;
    touchDeltaX.current = 0;
    const threshold = 50;
    if (dx > threshold) prevImage();
    else if (dx < -threshold) nextImage();
  };

  // drag & drop board (solo owner)
  const handleDragStart = (idDrag: string) => (e: React.DragEvent) => {
    if (!isOwner) return;
    dragIdRef.current = idDrag;
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDrop = (targetId: string) => (e: React.DragEvent) => {
    if (!isOwner) return;
    e.preventDefault();
    const sourceId = dragIdRef.current;
    dragIdRef.current = null;
    if (!sourceId || sourceId === targetId) return;
    setMedia(prev => {
      const list = [...prev];
      const from = list.findIndex(m => m.id === sourceId);
      const to = list.findIndex(m => m.id === targetId);
      if (from === -1 || to === -1) return prev;
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      return list;
    });
  };
  const handleDragOver = (e: React.DragEvent) => {
    if (!isOwner) return;
    e.preventDefault();
  };

  const handleSelectRecord = async (recordId: string) => {
    if (!isOwner) return;
    if (!concert || updatingRecord || recordId === selectedRecordId) return;
    setSelectedRecordId(recordId);
    setUpdatingRecord(true);
    try {
      await supabase.from('concerts').update({ record_id: recordId }).eq('id', concert.id);
      setConcert(prev => (prev ? { ...prev, record_id: recordId } : prev));
    } finally {
      setUpdatingRecord(false);
    }
  };

  const handleSelectCover = async (mediaId: string) => {
    if (!isOwner) return;
    if (!concert || updatingCover) return;
    const opt = coverOptions.find(c => c.id === mediaId);
    if (!opt) return;
    setSelectedCoverId(mediaId);
    setUpdatingCover(true);
    try {
      await supabase.from('concerts').update({ cover_media_id: mediaId, cover_url: opt.url }).eq('id', concert.id);
      setConcert(prev => (prev ? { ...prev, cover_media_id: mediaId, cover_url: opt.url } : prev));
    } finally {
      setUpdatingCover(false);
    }
  };

  const handlePickCompanyUser = (profile: MentionProfile) => {
    if (!isOwner) return;
    if (!profile.username) return;

    setSelectedPeople(prev => {
      if (prev.some(p => p.id === profile.id)) return prev;
      return [...prev, profile];
    });
    setPeopleInput('');
    setCompanySuggestions([]);
  };

  const handleRemovePerson = (profileId: string) => {
    if (!isOwner) return;
    setSelectedPeople(prev => prev.filter(p => p.id !== profileId));
  };

  const handleAddAttendee = async () => {
    if (!isOwner) return;
    if (!concert || !user?.id || savingAttendee || selectedPeople.length === 0) return;
    setSavingAttendee(true);
    try {
      const toInsert = selectedPeople.filter(p => !attendees.some(a => a.username === p.username));
      if (!toInsert.length) {
        setSelectedPeople([]);
        setPeopleInput('');
        setCompanySuggestions([]);
        return;
      }

      const { data } = await supabase
        .from('concerts_atendees')
        .insert(
          toInsert.map(p => ({
            concert_id: concert.id,
            profile_id: p.id,
          }))
        )
        .select('id, profiles(username, avatar_url)');

      const rows: Attendee[] =
        (data || []).map((r: any) => ({
          id: r.id,
          username: r.profiles?.username ?? null,
          avatar_url: r.profiles?.avatar_url ?? null,
        })) ?? [];

      setAttendees(prev => [...prev, ...rows]);
      setSelectedPeople([]);
      setPeopleInput('');
      setCompanySuggestions([]);
    } finally {
      setSavingAttendee(false);
    }
  };

  const handleRemoveAttendee = async (attendeeId: string) => {
    if (!concert || !isOwner || removingAttendeeId) return;
    setRemovingAttendeeId(attendeeId);
    try {
      await supabase.from('concerts_atendees').delete().eq('id', attendeeId);
      setAttendees(prev => prev.filter(a => a.id !== attendeeId));
    } finally {
      setRemovingAttendeeId(null);
    }
  };

  const toggleMemoryPanel = () => {
    if (!isOwner) return;
    const next = !(showRecordPicker || showCoverPicker);
    setShowRecordPicker(next);
    setShowCoverPicker(next);
  };

  const handleSaveDiary = async () => {
    if (!concert || !isOwner || savingDiary) return;
    const text = diaryDraft.trim();
    setSavingDiary(true);
    try {
      await supabase.from('concerts').update({ caption: text || null }).eq('id', concert.id);
      setConcert(prev => (prev ? { ...prev, caption: text || null } : prev));
      setDiaryEditing(!text);
    } finally {
      setSavingDiary(false);
    }
  };

  const handleOpenMediaPicker = () => {
    if (!isOwner || !fileInputRef.current) return;
    fileInputRef.current.click();
  };

  const handleMediaFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isOwner) return;
    if (!concert || !e.target.files || !e.target.files.length) return;
    const files = Array.from(e.target.files);
    setUploadingMedia(true);
    try {
      for (const file of files) {
        const isVideo = file.type.startsWith('video/');
        const path = `concerts/${concert.id}/${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('concert-media')
          .upload(path, file, { cacheControl: '3600', upsert: false });

        if (uploadError || !uploadData) continue;

        const { data: publicUrlData } = supabase.storage.from('concert-media').getPublicUrl(uploadData.path);

        const publicUrl = publicUrlData?.publicUrl;
        if (!publicUrl) continue;

        await supabase.from('concert_media').insert({
          concert_id: concert.id,
          url: publicUrl,
          media_type: isVideo ? 'video' : 'image',
        } as any);
      }

      await loadMedia(concert.id, concert);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setUploadingMedia(false);
    }
  };

  const closeLikesPanel = () => {
    setLikesPanelOpen(false);
  };

  /* ========= RENDER ========= */
  return (
    <div className="min-h-[100dvh] bg-white">
      {/* TOP — back button (safe-area + espacio para que NO corte en iOS) */}
      <div className="w-full px-4 sm:px-8 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-4 flex items-center justify-between bg-white">
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

      <main className="mx-auto w-full max-w-4xl px-4 sm:px-8 pb-28 pt-2 sm:pt-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={handleMediaFilesSelected}
          disabled={!isOwner}
        />

        {/* EXTERNAL USER HEADER (solo cuando NO eres owner) */}
        {!isOwner && postAuthor?.username && (
          <button
            type="button"
            onClick={() => router.push(`/u/${postAuthor.username}`)}
            className="mb-5 w-full flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 hover:bg-neutral-50 transition"
            aria-label="Open author profile"
          >
            <div className="h-9 w-9 rounded-full bg-neutral-200 overflow-hidden shrink-0">
              {postAuthor.avatar_url ? (
                <img
                  src={postAuthor.avatar_url}
                  alt={postAuthor.username || 'user'}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p
                className="text-[12px] uppercase tracking-[0.16em] text-neutral-500"
                style={{ fontFamily: 'Roboto, system-ui, sans-serif' }}
              >
                Posted by
              </p>
              <p
                className="text-[14px] text-black truncate"
                style={{ fontFamily: 'Roboto, system-ui, sans-serif', fontWeight: 400 }}
              >
                {postAuthor.username}
              </p>
            </div>
            <span className="text-[12px] text-neutral-400">›</span>
          </button>
        )}

        {/* HEADER EDITORIAL */}
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h1
                className="text-lg sm:text-2xl text-black"
                style={{ fontFamily: '"Times New Roman", Times, serif' }}
              >
                {headerTitle}
              </h1>
              <div
                className="mt-2 flex flex-wrap items-center gap-2 text-[11px] sm:text-xs uppercase tracking-[0.16em] text-neutral-500"
                style={{ fontFamily: 'Roboto, system-ui, sans-serif' }}
              >
                {concert?.tour_name && <span>{concert.tour_name}</span>}
                {(concert?.city || countryName || concert?.country_code) && (
                  <>
                    <span className="h-px w-6 bg-neutral-300" />
                    <span>
                      {[concert?.city, countryName || concert?.country_code].filter(Boolean).join(', ')}
                    </span>
                  </>
                )}
                {dateLabel &&
                  (hasLocation ? (
                    <>
                      <span className="h-px w-6 bg-neutral-300 hidden sm:inline-block" />
                      <span>{dateLabel}</span>
                    </>
                  ) : (
                    <span>{dateLabel}</span>
                  ))}
              </div>
            </div>
          </div>

          {/* MEMORY BLOCK — cuadrados + botón debajo */}
          {(recordOptions.length > 0 || currentCoverThumb) && (
            <section className="mt-1">
              <div className="flex items-center justify-start">
                <div className="flex items-center gap-2 sm:gap-2">
                  {recordOptions.length > 0 && (
                    <div
                      className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl shadow-md"
                      style={{ backgroundColor: currentVibe }}
                    >
                      <div
                        className="absolute rounded-[10px]"
                        style={{
                          backgroundColor: currentCoverColor,
                          inset: '24%',
                        }}
                      />
                    </div>
                  )}
                  {currentCoverThumb && (
                    <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl overflow-hidden border border-neutral-200">
                      <img src={currentCoverThumb.url} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              {/* Change SOLO si owner */}
              {isOwner && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={toggleMemoryPanel}
                    className="text-[10px] sm:text-[11px] rounded-full border border-[#1F48AF] text-[#1F48AF] px-4 py-1.5 leading-none tracking-[0.14em] uppercase bg-white hover:bg-[#1F48AF] hover:text-white transition"
                  >
                    {updatingRecord || updatingCover ? 'Saving…' : 'Change'}
                  </button>
                </div>
              )}
            </section>
          )}
        </div>

        {/* pickers MEMORY — SOLO si owner */}
        {isOwner &&
        ((showRecordPicker && recordOptions.length > 0) || (showCoverPicker && coverOptions.length > 0)) ? (
          <section className="mt-3 mb-4 space-y-3">
            {showRecordPicker && recordOptions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {recordOptions.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectRecord(r.id)}
                    className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs ${
                      r.id === selectedRecordId
                        ? 'bg-[#1F48AF] text-white border-[#1F48AF]'
                        : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    {r.title}
                  </button>
                ))}
              </div>
            )}

            {showCoverPicker && coverOptions.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {coverOptions.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCover(c.id)}
                    className={`overflow-hidden rounded-xl border ${
                      c.id === selectedCoverId ? 'border-[#1F48AF]' : 'border-neutral-200'
                    }`}
                  >
                    <img src={c.url} alt="" className="h-20 w-20 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : null}

        <div className="mt-4 h-px w-full bg-neutral-200" />

        {/* card editorial: diary + people */}
        <section className="mt-5 mb-7 rounded-2xl border border-neutral-200 bg-white/80 shadow-[0_18px_45px_rgba(15,23,42,0.06)] px-4 py-4 sm:px-6 sm:py-5 grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)] items-start">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500 mb-1">Tour diary</p>
            {isOwner ? (
              <>
                {diaryEditing || !concert?.caption ? (
                  <>
                    <textarea
                      value={diaryDraft}
                      onChange={e => setDiaryDraft(e.target.value)}
                      placeholder="Write what happened that night"
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-[13px] outline-none min-h-[96px] resize-vertical"
                      style={{ fontFamily: 'Roboto, system-ui, sans-serif', fontWeight: 300 }}
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveDiary}
                        className="text-[11px] uppercase tracking-[0.16em] rounded-full bg-[#1F48AF] text-white px-4 py-1.5"
                      >
                        {savingDiary ? 'Saving…' : 'Publish'}
                      </button>
                      {concert?.caption && (
                        <button
                          type="button"
                          onClick={() => {
                            setDiaryDraft(concert.caption || '');
                            setDiaryEditing(false);
                          }}
                          className="text-[11px] uppercase tracking-[0.16em] rounded-full border border-neutral-300 text-neutral-600 px-4 py-1.5"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p
                      className="text-[14px] sm:text-[15px] leading-6 text-black/90 break-words [overflow-wrap:anywhere]"
                      style={{ fontFamily: 'Roboto, system-ui, sans-serif', fontWeight: 300 }}
                    >
                      {concert.caption}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setDiaryDraft(concert.caption || '');
                        setDiaryEditing(true);
                      }}
                      className="mt-2 text-[11px] uppercase tracking-[0.16em] text-neutral-500 hover:text-black"
                    >
                      Edit
                    </button>
                  </>
                )}
              </>
            ) : diaryText ? (
              <>
                <p
                  className="text-[14px] sm:text-[15px] leading-6 text-black/90 break-words [overflow-wrap:anywhere]"
                  style={{ fontFamily: 'Roboto, system-ui, sans-serif', fontWeight: 300 }}
                >
                  {diaryExpanded || !diaryShouldTruncate ? diaryText : diaryPreview}
                </p>
                {diaryShouldTruncate && (
                  <button
                    type="button"
                    onClick={() => setDiaryExpanded(v => !v)}
                    className="mt-2 text-[11px] uppercase tracking-[0.16em] text-neutral-500 hover:text-black"
                  >
                    {diaryExpanded ? 'See less' : 'See more'}
                  </button>
                )}
              </>
            ) : (
              <p className="text-[13px] text-neutral-500 italic">Write what happened that night</p>
            )}
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500 mb-2">People I went with</p>

            {attendees.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-3">
                {attendees.map(a => (
                  <div key={a.id} className="flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1 text-xs bg-white">
                    <div className="h-6 w-6 rounded-full bg-neutral-200 overflow-hidden shrink-0">
                      {a.avatar_url ? (
                        <img src={a.avatar_url} alt={a.username || ''} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <span>{a.username || 'user'}</span>

                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAttendee(a.id)}
                        className="ml-1 text-[11px] text-neutral-400 hover:text-black"
                        aria-label="Remove attendee"
                      >
                        {removingAttendeeId === a.id ? '…' : '×'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-neutral-500 italic">No people added.</p>
            )}

            {isOwner && user?.id && (
              <div className="relative">
                <div className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-[13px] flex flex-wrap items-center gap-2 focus-within:ring-1 focus-within:ring-[#1F48AF]">
                  {selectedPeople.map(p => (
                    <div key={p.id} className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-2 py-1 text-[11px]">
                      <div className="w-5 h-5 rounded-full overflow-hidden bg-neutral-300 flex items-center justify-center text-[10px]">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt={p.username || ''} className="w-full h-full object-cover" />
                        ) : (
                          <span>{(p.username || 'U').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <span>{p.username}</span>
                      <button type="button" onClick={() => handleRemovePerson(p.id)} className="text-[11px] text-neutral-500 hover:text-black">
                        ×
                      </button>
                    </div>
                  ))}
                  <input
                    value={peopleInput}
                    onChange={e => setPeopleInput(e.target.value)}
                    placeholder={selectedPeople.length === 0 ? 'Add username (@username)' : ''}
                    className="flex-1 min-w-[80px] border-none outline-none bg-transparent text-[13px]"
                  />
                </div>

                {(companySearching || companySuggestions.length > 0) && (
                  <div className="absolute mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg max-h-60 overflow-auto z-30">
                    {companySearching && <div className="px-3 py-2 text-sm text-neutral-500">Searching…</div>}
                    {!companySearching &&
                      companySuggestions.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handlePickCompanyUser(p)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-50"
                        >
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-neutral-200 flex items-center justify-center text-[10px]">
                            {p.avatar_url ? (
                              <img src={p.avatar_url} alt={p.username || ''} className="w-full h-full object-cover" />
                            ) : (
                              <span>{(p.username || 'U').charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12px] truncate">{p.username || 'user'}</p>
                            {p.full_name && <p className="text-[11px] text-neutral-500 truncate">{p.full_name}</p>}
                          </div>
                        </button>
                      ))}
                  </div>
                )}

                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddAttendee}
                    className="rounded-xl bg-[#1F48AF] text-white px-3 py-2 text-[11px] tracking-[0.14em] uppercase disabled:opacity-40"
                    disabled={selectedPeople.length === 0 || savingAttendee}
                  >
                    {savingAttendee ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* MEDIA BOARD — collage */}
        {loading ? (
          <p className="text-sm text-black/60 mt-4">Loading…</p>
        ) : media.length > 0 ? (
          <section className="mt-2">
            <div className="columns-2 sm:columns-3 gap-3 sm:gap-4">
              {media.map(m => {
                const wrapperProps = {
                  key: m.id,
                  draggable: isOwner,
                  onDragStart: handleDragStart(m.id),
                  onDrop: handleDrop(m.id),
                  onDragOver: handleDragOver,
                  className:
                    'break-inside-avoid mb-3 sm:mb-4 rounded-2xl overflow-hidden shadow-sm bg-transparent ' +
                    (isOwner ? 'cursor-move' : 'cursor-default'),
                };

                if (m.type === 'image') {
                  const imgIndex = imageList.findIndex(im => im.id === m.id);
                  return (
                    <div {...wrapperProps}>
                      <button
                        type="button"
                        onClick={() => openLightbox(Math.max(0, imgIndex))}
                        className="focus:outline-none block w-full h-full"
                        aria-label="Expand image"
                      >
                        <img
                          src={m.url}
                          alt="concert-media"
                          className="w-full h-auto max-h-[460px] rounded-2xl object-contain"
                          loading="lazy"
                        />
                      </button>
                    </div>
                  );
                }

                return (
                  <div {...wrapperProps}>
                    <video
                      src={m.url}
                      controls
                      playsInline
                      // @ts-ignore iOS inline
                      webkit-playsinline="true"
                      preload="metadata"
                      className="w-full h-auto rounded-2xl bg-black"
                      controlsList="nodownload noplaybackrate"
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <p className="text-sm text-black/60 mt-5">No media.</p>
        )}

        {/* SOCIAL */}
        <section className="mt-6 w-full max-w-2xl">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLike}
              aria-label={userLiked ? 'Unlike' : 'Like'}
              className={`inline-flex items-center justify-center transition-transform active:scale-95 ${
                userLiked ? 'text-[#1F48AF]' : 'text-neutral-600 hover:text-neutral-800'
              }`}
            >
              <svg width="32" height="32" viewBox="0 0 48 48" aria-hidden="true">
                <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.9" />
                <circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.7" />
                <circle cx="24" cy="24" r="10" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
                <circle
                  cx="24"
                  cy="24"
                  r="6"
                  fill={userLiked ? 'currentColor' : 'transparent'}
                  stroke="currentColor"
                  strokeWidth="1"
                />
                <circle cx="24" cy="24" r="1.5" fill={userLiked ? 'white' : 'currentColor'} />
              </svg>
            </button>
            <button type="button" onClick={() => setLikesPanelOpen(true)} className="text-sm text-neutral-700 hover:text-black">
              {likesCount} {likesCount === 1 ? 'like' : 'likes'}
            </button>
          </div>

          <div id="comments" className="mt-4 space-y-3">
            {comments.map(c => (
              <div key={c.id} className="flex gap-3 items-start">
                <div className="h-8 w-8 rounded-full bg-neutral-200 overflow-hidden shrink-0">
                  {c.avatar_url ? <img src={c.avatar_url} alt={c.username || ''} className="w-full h-full object-cover" /> : null}
                </div>
                <div className="min-w-0 break-words [overflow-wrap:anywhere]">
                  <div className="text-sm">
                    <span className="font-medium">{c.username || 'user'}</span> {c.comment}
                  </div>
                  <div className="text-xs text-neutral-500">{new Date(c.created_at).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>

          {user?.id && (
            <div className="mt-3 flex items-center gap-2">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Write a comment…"
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none break-words [overflow-wrap:anywhere]"
              />
              <button type="button" onClick={handleSendComment} className="rounded-xl bg-[#1F48AF] text-white px-4 py-2 text-sm">
                Send
              </button>
            </div>
          )}
        </section>
      </main>

      {/* LIKES BOTTOM SHEET */}
      <div className={`fixed inset-0 z-40 flex items-end justify-center ${likesPanelOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div className={`absolute inset-0 bg-black/40 transition-opacity ${likesPanelOpen ? 'opacity-100' : 'opacity-0'}`} onClick={closeLikesPanel} />
        <div
          className={`relative w-full max-w-md rounded-t-3xl bg-white shadow-[0_-12px_40px_rgba(15,23,42,0.18)] transition-transform duration-300 ${
            likesPanelOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{
            maxHeight: '70vh',
            paddingTop: '14px',
            paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
          }}
        >
          <div className="flex items-center justify-center mb-2">
            <div className="h-1 w-10 rounded-full bg-neutral-300" />
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-center text-neutral-500 mb-3">Likes</p>
          <div className="px-4 pb-1 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 56px)' }}>
            {loadingLikesUsers ? (
              <p className="py-4 text-sm text-neutral-500 text-center">Loading…</p>
            ) : likesUsers.length === 0 ? (
              <p className="py-4 text-sm text-neutral-500 text-center">No likes yet.</p>
            ) : (
              likesUsers.map(u => (
                <div key={u.user_id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-neutral-200 overflow-hidden">
                      {u.avatar_url ? <img src={u.avatar_url} alt={u.username || ''} className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{u.username || 'user'}</span>
                      {u.user_id === user?.id && <span className="text-[11px] text-neutral-500">You</span>}
                    </div>
                  </div>
                  {user?.id && u.user_id !== user.id && (
                    <span
                      className={`text-[11px] uppercase tracking-[0.16em] rounded-full border px-3 py-1 ${
                        u.is_following ? 'border-neutral-300 text-neutral-700 bg-neutral-50' : 'border-black text-black'
                      }`}
                    >
                      {u.is_following ? 'Following' : 'Follow'}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* LIGHTBOX */}
      {lightboxOpen && imageList.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center" onClick={closeLightbox} role="dialog" aria-modal="true">
          <div
            className="relative w-full h-full flex items-center justify-center"
            style={{
              paddingTop: 'max(calc(env(safe-area-inset-top) + 32px), 32px)',
              paddingBottom: 'max(calc(env(safe-area-inset-bottom) + 32px), 32px)',
              paddingLeft: '24px',
              paddingRight: '24px',
            }}
            onClick={e => e.stopPropagation()}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <img
              key={imageList[lightboxIndex].id}
              src={imageList[lightboxIndex].url}
              alt={`media-${lightboxIndex + 1}`}
              className="max-w-[92vw] max-h-[76vh] object-contain rounded-2xl shadow-2xl"
              draggable={false}
            />

            <button
              onClick={closeLightbox}
              aria-label="Close"
              className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white/95 hover:bg-white px-4 py-2 text-[13px] shadow-sm"
              style={{ top: 'calc(env(safe-area-inset-top) + 24px)' }}
            >
              Close
            </button>

            {imageList.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  aria-label="Previous image"
                  className="absolute rounded-full bg-white/90 hover:bg-white px-3 py-3 text-black shadow-sm active:scale-95"
                  style={{ left: '28px' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>

                <button
                  onClick={nextImage}
                  aria-label="Next image"
                  className="absolute rounded-full bg-white/90 hover:bg-white px-3 py-3 text-black shadow-sm active:scale-95"
                  style={{ right: '28px' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>

                <div
                  className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/85"
                  style={{ bottom: 'calc(env(safe-area-inset-bottom) + 22px)' }}
                >
                  <span className="inline-block h-px w-10 bg-white/60" />
                  <span>
                    {lightboxIndex + 1} / {imageList.length}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

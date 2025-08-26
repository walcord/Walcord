'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useUser } from '@supabase/auth-helpers-react'
import { supabase } from '../lib/supabaseClient'
import ConcertAttendees from '../components/ConcertAttendees'

interface Concert {
  id: string
  artist_name: string
  tour: string
  city: string
  country: string
  year: number
}

interface Photo {
  id: string
  concert_id: string
  user_id: string
  image_url: string
  created_at: string
}

type ConcertMeta = {
  likeCount: number
  myLike: boolean
  commentCount: number
}

export default function ConcertsPage() {
  const user = useUser()

  // ===== icono corazón para likes (no Walcord People) =====
  const HeartIcon = ({ filled }: { filled?: boolean }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" className={filled ? 'fill-[#1F48AF]' : 'fill-none'}>
      <path
        d="M12.1 21s-6.6-4.35-9.3-8.07C1 10.75 1.6 7.7 4.2 6.3c2.01-1.06 4.2-.5 5.7 1.05C11.4 5.8 13.6 5.24 15.6 6.3c2.6 1.4 3.2 4.45 1.4 6.63C18.7 16.65 12.1 21 12.1 21z"
        stroke="#1F48AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )

  // buscador 3 pasos
  const [step, setStep] = useState<'artist' | 'tour' | 'concert'>('artist')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [selectedArtist, setSelectedArtist] = useState('')
  const [selectedTour, setSelectedTour] = useState('')

  // mis conciertos (SIEMPRE desde Supabase)
  const [userConcerts, setUserConcerts] = useState<Concert[]>([])

  // fotos/meta por concierto
  const [photosByConcert, setPhotosByConcert] = useState<Record<string, Photo[]>>({})
  const [concertMeta, setConcertMeta] = useState<Record<string, ConcertMeta>>({})

  // evita recargas dobles por hover
  const loadedOnce = useRef<Set<string>>(new Set())

  // upload / edit
  const addFileInputRef = useRef<HTMLInputElement | null>(null)
  const editFileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null)

  /* ======================================================
   * CARGA DE MIS CONCIERTOS DESDE SUPABASE (NO localStorage)
   * ====================================================== */
  const loadMyConcerts = async () => {
    if (!user?.id) { setUserConcerts([]); return }
    const { data: atds, error } = await supabase
      .from('concerts_atendees')
      .select('concert_id')
      .eq('user_id', user.id)

    if (error) { setUserConcerts([]); return }
    const ids = Array.from(new Set((atds || []).map((r: any) => r.concert_id)))
    if (ids.length === 0) { setUserConcerts([]); return }

    const { data: concerts } = await supabase
      .from('concerts')
      .select('*')
      .in('id', ids)

    setUserConcerts((concerts || []) as Concert[])
  }

  // Al montar / cambiar usuario: cargar mis conciertos
  useEffect(() => {
    try { localStorage.removeItem('userConcerts') } catch {}
    loadMyConcerts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  /* ===========================
   * BUSCADOR EN 3 PASOS
   * =========================== */
  useEffect(() => {
    if (step === 'artist' && query.length > 0) {
      supabase.from('concerts').select('artist_name')
        .ilike('artist_name', `%${query}%`)
        .then(({ data }) => {
          if (data) setResults([...new Set(data.map((d) => d.artist_name))])
        })
    } else if (step === 'tour' && query.length > 0 && selectedArtist) {
      supabase.from('concerts').select('tour')
        .eq('artist_name', selectedArtist)
        .ilike('tour', `%${query}%`)
        .then(({ data }) => {
          if (data) setResults([...new Set(data.map((d) => d.tour))])
        })
    } else if (step === 'concert' && selectedArtist && selectedTour) {
      supabase.from('concerts').select('*')
        .eq('artist_name', selectedArtist)
        .eq('tour', selectedTour)
        .then(({ data }) => {
          if (!data) return setResults([])
          const lower = query.toLowerCase()
          setResults(data.filter((c) =>
            `${c.city}, ${c.country} ${c.year}`.toLowerCase().includes(lower)
          ))
        })
    } else {
      setResults([])
    }
  }, [query, step, selectedArtist, selectedTour])

  const handleSelect = async (item: any) => {
    if (step === 'artist') {
      setSelectedArtist(item)
      setQuery(''); setStep('tour'); return
    }
    if (step === 'tour') {
      setSelectedTour(item)
      setQuery(''); setStep('concert'); return
    }

    const concert = item as Concert
    if (!user?.id) return

    await supabase.from('concerts_atendees').upsert([
      { user_id: user.id, concert_id: concert.id }
    ])
    await loadMyConcerts()

    setQuery(''); setStep('artist'); setSelectedArtist(''); setSelectedTour('')
  }

  const handleDeleteConcert = async (id: string) => {
    if (!user?.id) return
    if (!confirm('Are you sure you want to delete this concert?')) return
    await supabase.from('concerts_atendees').delete().match({ user_id: user.id, concert_id: id })
    setPhotosByConcert((prev) => { const cp = { ...prev }; delete cp[id]; return cp })
    setConcertMeta((prev) => { const cp = { ...prev }; delete cp[id]; return cp })
    loadedOnce.current.delete(id)
    await loadMyConcerts()
  }

  /* ===========================
   * AGRUPADO POR AÑO / FUTURE
   * =========================== */
  const groupedConcerts = useMemo(() => {
    return userConcerts.reduce((acc, c) => {
      const label = c.year > new Date().getFullYear() ? 'Future' : String(c.year)
      if (!acc[label]) acc[label] = []
      acc[label].push(c)
      return acc
    }, {} as Record<string, Concert[]>)
  }, [userConcerts])

  /* ===========================
   * DATA LOADERS (mis fotos/meta)
   * =========================== */
  const fetchPhotos = async (concertId: string) => {
    if (!user?.id) return
    const { data } = await supabase
      .from('concert_photos')
      .select('*')
      .eq('concert_id', concertId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setPhotosByConcert((prev) => ({ ...prev, [concertId]: (data || []) as Photo[] }))
  }

  const refreshConcertMeta = async (concertId: string) => {
    if (!user?.id) return
    const [{ data: likes }, { data: myLike }, { data: comments }] = await Promise.all([
      supabase.from('concert_likes').select('concert_id').eq('concert_id', concertId),
      supabase.from('concert_likes').select('concert_id').eq('concert_id', concertId).eq('user_id', user.id),
      supabase.from('concert_comments').select('id').eq('concert_id', concertId),
    ])
    setConcertMeta((prev) => ({
      ...prev,
      [concertId]: {
        likeCount: (likes || []).length,
        myLike: (myLike || []).length > 0,
        commentCount: (comments || []).length,
      },
    }))
  }

  // Toggle like del concierto
  const toggleConcertLike = async (concertId: string) => {
    if (!user?.id) return
    const meta = concertMeta[concertId]
    if (meta?.myLike) {
      await supabase.from('concert_likes').delete().match({ concert_id: concertId, user_id: user.id })
      setConcertMeta((prev) => ({
        ...prev,
        [concertId]: {
          likeCount: Math.max((meta.likeCount || 1) - 1, 0),
          myLike: false,
          commentCount: meta.commentCount || 0,
        },
      }))
    } else {
      await supabase.from('concert_likes').upsert({ concert_id: concertId, user_id: user.id })
      setConcertMeta((prev) => ({
        ...prev,
        [concertId]: {
          likeCount: (meta?.likeCount || 0) + 1,
          myLike: true,
          commentCount: meta?.commentCount || 0,
        },
      }))
    }
  }

  // Carga segura (una vez por concierto, al pasar el ratón)
  const loadOnce = (concertId: string) => {
    if (loadedOnce.current.has(concertId)) return
    loadedOnce.current.add(concertId)
    fetchPhotos(concertId)
    refreshConcertMeta(concertId)
  }

  // Si cambia de usuario, refresca (evita estados cruzados)
  useEffect(() => {
    Object.keys(photosByConcert).forEach((cid) => {
      fetchPhotos(cid)
      refreshConcertMeta(cid)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  /* ===========================
   * COMMENTS (popover limpio)
   * =========================== */
  function ConcertComments({ concertId }: { concertId: string }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<{ id: string; text: string; user_id: string; created_at: string }[]>([])
    const [val, setVal] = useState('')

    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('concert_comments')
        .select('id, content, user_id, created_at')
        .eq('concert_id', concertId)
        .order('created_at', { ascending: false })
        .limit(50)
      const normalized = (data || []).map((r: any) => ({
        id: r.id,
        text: r.content ?? '',
        user_id: r.user_id,
        created_at: r.created_at,
      }))
      setItems(normalized)
      setLoading(false)
    }

    useEffect(() => { if (open) load() }, [open])

    const add = async () => {
      if (!user?.id || !val.trim()) return
      await supabase.from('concert_comments').insert({ concert_id: concertId, user_id: user.id, content: val.trim() })
      setVal(''); await load(); refreshConcertMeta(concertId)
    }

    const remove = async (id: string) => {
      if (!user?.id) return
      const c = items.find((i) => i.id === id)
      if (!c || c.user_id !== user.id) return
      await supabase.from('concert_comments').delete().match({ id })
      await load(); refreshConcertMeta(concertId)
    }

    return (
      <div className="text-xs font-light relative">
        <button onClick={() => setOpen((v) => !v)} className="underline underline-offset-2 hover:text-[#1F48AF] transition">
          {open ? 'Hide comments' : 'Comments'}
        </button>

        {open && (
          <div className="absolute right-0 z-50 mt-2 w-[320px] max-h-[360px] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
            <div className="p-3 border-b border-neutral-200">
              <div className="flex gap-2">
                <input
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  placeholder="Write a comment…"
                  className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-[12px]"
                />
                <button onClick={add} className="px-3 py-2 rounded-lg bg-[#1F48AF] text-white text-[12px] hover:bg-[#183B91]">Send</button>
              </div>
            </div>
            <div className="p-3 max-h-[280px] overflow-y-auto">
              {loading ? (
                <p className="text-neutral-400">Loading…</p>
              ) : items.length === 0 ? (
                <p className="text-neutral-400">No comments yet.</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((c) => (
                    <li key={c.id} className="group flex items-start justify-between gap-3 rounded-lg border border-neutral-100 p-2">
                      <p className="text-neutral-800 leading-snug">{c.text}</p>
                      {user?.id === c.user_id && (
                        <button onClick={() => remove(c.id)} className="text-neutral-400 hover:text-red-500 transition text-sm" aria-label="Delete" title="Delete">
                          &times;
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ===========================
   * RENDER
   * =========================== */
  return (
    <div className="bg-white min-h-screen text-black font-sans">
      <div className="w-full h-[100px] sm:h-[80px] bg-[#1F48AF] flex items-center px-6 sm:px-12">
        <Image src="/logotipo.png" alt="Walcord Logo" width={62} height={62} />
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-10">
        <h1 className="text-4xl font-light text-center tracking-tight mb-4" style={{ fontFamily: 'Times New Roman, serif' }}>
          Concerts
        </h1>
        <hr className="border-black w-full mb-8" />
      </div>

      {/* Search */}
      <div className="max-w-4xl mx-auto px-6 mb-6 relative">
        <input
          type="text"
          placeholder={
            step === 'artist'
              ? 'Search artist...'
              : step === 'tour'
              ? `Search tour of ${selectedArtist}...`
              : `Search concert: city or year...`
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full px-4 py-3 border border-neutral-300 rounded-md text-base"
        />
        {results.length > 0 && (
          <div className="absolute w-full bg-white shadow-xl rounded-xl mt-2 z-50 max-h-[300px] overflow-y-auto border border-neutral-200">
            {results.map((item, i) => (
              <button
                key={i}
                onClick={() => handleSelect(item)}
                className="w-full text-left px-5 py-3 hover:bg-[#f2f2f2] transition text-sm font-light"
              >
                {typeof item === 'string' ? item : `${item.city}, ${item.country} · ${item.year}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Listado */}
      <div className="max-w-6xl mx-auto px-6 pb-24 space-y-20">
        {Object.entries(groupedConcerts)
          .sort(([a], [b]) => {
            if (a === 'Future') return -1
            if (b === 'Future') return 1
            return Number(b) - Number(a)
          })
          .map(([year, concerts]) => (
            <section key={year} className="mb-12">
              <h2 className="text-3xl font-light text-gray-800 mb-3" style={{ fontFamily: 'Times New Roman, serif' }}>{year}</h2>
              <div className="w-24 h-[3px] bg-black mb-6 rounded-full" />

              <div className="space-y-16">
                {concerts.map((concert) => (
                  <div
                    key={concert.id}
                    className="w-full border border-neutral-200 p-4 rounded-lg shadow-sm hover:shadow-md transition bg-white"
                    onMouseEnter={() => loadOnce(concert.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-[20px] font-light" style={{ fontFamily: 'Times New Roman, serif' }}>{concert.artist_name}</h3>
                        <p className="text-sm font-light text-gray-500" style={{ fontFamily: 'Roboto, sans-serif' }}>{concert.tour}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-light" style={{ fontFamily: 'Roboto, sans-serif' }}>{concert.city}, {concert.country}</p>
                      </div>
                    </div>

                    {/* Photos (mías) */}
                    <div className="mt-4">
                      {(photosByConcert[concert.id] || []).length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {(photosByConcert[concert.id] || []).slice(0, 6).map((p) => (
                            <PhotoCard key={p.id} photo={p} />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      {/* Subir fotos */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => { setUploadingFor(concert.id); addFileInputRef.current?.click() }}
                          className="text-white bg-[#1F48AF] hover:bg-[#183B91] transition px-4 py-2 text-sm rounded-full font-light"
                          style={{ fontFamily: 'Roboto, sans-serif' }}
                        >
                          Share memories about this concert
                        </button>
                        <input ref={addFileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={onAddFiles} />
                        <input ref={editFileInputRef} type="file" accept="image/*" className="hidden" onChange={onEditFile} />
                      </div>

                      <div className="flex items-center gap-5">
                        {/* LIKE con corazón */}
                        <button
                          onClick={() => { loadOnce(concert.id); toggleConcertLike(concert.id) }}
                          className="inline-flex items-center gap-2"
                          aria-label="Like concert"
                          title="Like this concert"
                        >
                          <HeartIcon filled={concertMeta[concert.id]?.myLike} />
                          <span className="text-sm font-light">
                            {concertMeta[concert.id]?.likeCount ?? 0}
                          </span>
                        </button>

                        <ConcertComments concertId={concert.id} />

                        <div className="flex items-center gap-3">
                          <ConcertAttendees concertId={concert.id} />
                          <button onClick={() => handleDeleteConcert(concert.id)} className="text-gray-400 hover:text-red-500 text-xl" aria-label="Delete concert">
                            &times;
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
      </div>
    </div>
  )

  /* ------- componentes internos ------- */
  function PhotoCard({ photo }: { photo: Photo }) {
    const mine = user?.id === photo.user_id
    return (
      <div className="relative w-full rounded-md overflow-hidden bg-neutral-200 group" style={{ aspectRatio: '2/3' }}>
        <Image
          src={photo.image_url}
          alt=""
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-[1.02] will-change-transform"
          sizes="(max-width:768px) 33vw, 16vw"
        />
        {mine && (
          <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition">
            <button
              onClick={() => { setEditingPhoto(photo); editFileInputRef.current?.click() }}
              className="px-2 py-1 rounded-md text-[11px] bg-white/90 hover:bg-white shadow-sm"
            >
              Edit
            </button>
            <button
              onClick={() => deletePhoto(photo)}
              className="px-2 py-1 rounded-md text-[11px] bg-white/90 hover:bg-white shadow-sm"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    )
  }

  async function onAddFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const concertId = uploadingFor
    if (!concertId || !user?.id) return
    const files = e.target.files
    if (!files || files.length === 0) return
    const inserts: { concert_id: string; user_id: string; image_url: string }[] = []
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${concertId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('concert-photos').upload(path, file, { cacheControl: '3600', upsert: false })
      if (!error) {
        const { data: pub } = supabase.storage.from('concert-photos').getPublicUrl(path)
        inserts.push({ concert_id: concertId, user_id: user.id, image_url: pub.publicUrl })
      }
    }
    if (inserts.length) { await supabase.from('concert_photos').insert(inserts); await fetchPhotos(concertId) }
    setUploadingFor(null)
    if (addFileInputRef.current) addFileInputRef.current.value = ''
  }

  async function onEditFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!editingPhoto || !user?.id) return
    const file = e.target.files?.[0]; if (!file) return
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${editingPhoto.concert_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('concert-photos').upload(path, file, { cacheControl: '3600', upsert: false })
    if (!error) {
      const { data: pub } = supabase.storage.from('concert-photos').getPublicUrl(path)
      await supabase.from('concert_photos').update({ image_url: pub.publicUrl }).eq('id', editingPhoto.id)
      await fetchPhotos(editingPhoto.concert_id)
    }
    setEditingPhoto(null)
    if (editFileInputRef.current) editFileInputRef.current.value = ''
  }

  async function deletePhoto(p: Photo) {
    if (!user?.id || user.id !== p.user_id) return
    if (!confirm('Delete this photo?')) return
    await supabase.from('concert_photos').delete().match({ id: p.id })
    setPhotosByConcert((prev) => ({ ...prev, [p.concert_id]: (prev[p.concert_id] || []).filter((x) => x.id !== p.id) }))
  }
}

/* Animación keyframes (si ya la tienes global, ignora) */
declare global { interface CSSStyleDeclaration {} }

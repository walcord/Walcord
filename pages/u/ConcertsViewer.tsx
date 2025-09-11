'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useUser } from '@supabase/auth-helpers-react'
import { supabase } from '../../lib/supabaseClient'
import ConcertAttendees from '../../components/ConcertAttendees'

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

export default function ConcertsViewer() {
  const user = useUser()
  const router = useRouter()
  const { username } = router.query as { username?: string }

  const [targetUserId, setTargetUserId] = useState<string | null>(null)

  const [concerts, setConcerts] = useState<Concert[]>([])
  const [photosByConcert, setPhotosByConcert] = useState<Record<string, Photo[]>>({})
  const [concertMeta, setConcertMeta] = useState<Record<string, ConcertMeta>>({})
  const loadedOnce = useRef<Set<string>>(new Set())

  /* ========== HEART ICON (likes) ========== */
  const HeartIcon = ({ filled }: { filled?: boolean }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" className={filled ? 'fill-[#1F48AF]' : 'fill-none'}>
      <path
        d="M12.1 21s-6.6-4.35-9.3-8.07C1 10.75 1.6 7.7 4.2 6.3c2.01-1.06 4.2-.5 5.7 1.05C11.4 5.8 13.6 5.24 15.6 6.3c2.6 1.4 3.2 4.45 1.4 6.63C18.7 16.65 12.1 21 12.1 21z"
        stroke="#1F48AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )

  /* ========== USERNAME -> user_id ========== */
  useEffect(() => {
    if (!username) return
    ;(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single()
      if (error || !data?.id) { router.replace('/feed'); return }
      setTargetUserId(data.id)
    })()
  }, [username, router])

  /* ========== Cargar conciertos del perfil ========== */
  const loadConcerts = async (uid: string) => {
    const { data: atds } = await supabase
      .from('concerts_atendees')
      .select('concert_id')
      .eq('user_id', uid)
    const ids = Array.from(new Set((atds || []).map((a: any) => a.concert_id)))
    if (ids.length === 0) { setConcerts([]); return }
    const { data: cs } = await supabase.from('concerts').select('*').in('id', ids)
    setConcerts((cs || []) as Concert[])
  }

  useEffect(() => { if (targetUserId) loadConcerts(targetUserId) }, [targetUserId])

  /* ========== Agrupar por año / future ========== */
  const groupedConcerts = useMemo(() => {
    return concerts.reduce((acc, c) => {
      const label = c.year > new Date().getFullYear() ? 'Future' : String(c.year)
      if (!acc[label]) acc[label] = []
      acc[label].push(c)
      return acc
    }, {} as Record<string, Concert[]>)
  }, [concerts])

  /* ========== Fotos + Meta ========== */
  const fetchPhotos = async (concertId: string) => {
    if (!targetUserId) return
    const { data } = await supabase
      .from('concert_photos')
      .select('*')
      .eq('concert_id', concertId)
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
    setPhotosByConcert((prev) => ({ ...prev, [concertId]: (data || []) as Photo[] }))
  }

  const refreshConcertMeta = async (concertId: string) => {
    const [{ data: likes }, { data: myLike }, { data: comments }] = await Promise.all([
      supabase.from('concert_likes').select('concert_id').eq('concert_id', concertId),
      user?.id
        ? supabase.from('concert_likes').select('concert_id').eq('concert_id', concertId).eq('user_id', user.id)
        : Promise.resolve({ data: [] as any }),
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

  const toggleConcertLike = async (concertId: string) => {
    if (!user?.id) return
    const meta = concertMeta[concertId]
    if (meta?.myLike) {
      await supabase.from('concert_likes').delete().match({ concert_id: concertId, user_id: user.id })
      setConcertMeta((prev) => ({ ...prev, [concertId]: { ...meta, myLike: false, likeCount: Math.max((meta.likeCount || 1) - 1, 0) } }))
    } else {
      await supabase.from('concert_likes').upsert({ concert_id: concertId, user_id: user.id })
      setConcertMeta((prev) => ({ ...prev, [concertId]: { ...meta, myLike: true, likeCount: (meta?.likeCount || 0) + 1 } }))
    }
  }

  const loadOnce = (concertId: string) => {
    if (loadedOnce.current.has(concertId)) return
    loadedOnce.current.add(concertId)
    fetchPhotos(concertId)
    refreshConcertMeta(concertId)
  }

  /* ========== Comentarios (popover) ========== */
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
        id: r.id, text: r.content ?? '', user_id: r.user_id, created_at: r.created_at,
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
        <button onClick={() => setOpen(v => !v)} className="underline underline-offset-2 hover:text-[#1F48AF] transition">
          {open ? 'Hide comments' : 'Comments'}
        </button>
        {open && (
          <div className="absolute right-0 z-50 mt-2 w-[320px] max-h-[360px] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
            <div className="p-3 border-b border-neutral-200">
              <div className="flex gap-2">
                <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Write a comment…"
                       className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-[12px]" />
                <button onClick={add} className="px-3 py-2 rounded-lg bg-[#1F48AF] text-white text-[12px] hover:bg-[#183B91]">Send</button>
              </div>
            </div>
            <div className="p-3 max-h-[280px] overflow-y-auto">
              {loading ? <p className="text-neutral-400">Loading…</p> :
               items.length === 0 ? <p className="text-neutral-400">No comments yet.</p> :
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
               </ul>}
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ========== GRID de fotos (del usuario del perfil) ========== */
  const PhotosGrid = ({ concertId }: { concertId: string }) => {
    const photos = photosByConcert[concertId] || []
    return (
      <div className="mt-4">
        {photos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {photos.slice(0, 6).map((p) => (
              <div key={p.id} className="relative w-full rounded-md overflow-hidden bg-neutral-200" style={{ aspectRatio: '2/3' }}>
                <Image src={p.image_url} alt="" fill className="object-cover" sizes="(max-width:768px) 33vw, 16vw" />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  /* ========== BUSCADOR 3 PASOS (para AÑADIR conciertos) ========== */
  const [step, setStep] = useState<'artist' | 'tour' | 'concert'>('artist')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [selectedArtist, setSelectedArtist] = useState('')
  const [selectedTour, setSelectedTour] = useState('')

  useEffect(() => {
    let active = true
    async function run() {
      if (step === 'artist' && query.trim().length > 0) {
        const { data } = await supabase.from('concerts').select('artist_name').ilike('artist_name', `%${query}%`)
        if (active && data) setResults([...new Set(data.map(d => d.artist_name))]); return
      }
      if (step === 'tour' && query.trim().length > 0 && selectedArtist) {
        const { data } = await supabase.from('concerts').select('tour').eq('artist_name', selectedArtist).ilike('tour', `%${query}%`)
        if (active && data) setResults([...new Set(data.map(d => d.tour))]); return
      }
      if (step === 'concert' && selectedArtist && selectedTour) {
        const { data } = await supabase
          .from('concerts')
          .select('id, city, country, year, artist_name, tour')
          .eq('artist_name', selectedArtist)
          .eq('tour', selectedTour)
        if (!data) return setResults([])
        const lower = query.toLowerCase()
        setResults(data.filter(c => `${c.city}, ${c.country} ${c.year}`.toLowerCase().includes(lower)))
        return
      }
      setResults([])
    }
    run()
    return () => { active = false }
  }, [query, step, selectedArtist, selectedTour])

  async function handleSearchSelect(item: any) {
    if (step === 'artist') { setSelectedArtist(item); setQuery(''); setStep('tour'); return }
    if (step === 'tour')   { setSelectedTour(item); setQuery(''); setStep('concert'); return }

    // Selección final -> añadir asistencia para el USUARIO LOGUEADO
    const concert = item as { id: string }
    if (!user?.id || !concert?.id) return
    await supabase.from('concerts_atendees').upsert([{ user_id: user.id, concert_id: concert.id }])

    // si el perfil es el propio, recarga su listado
    if (targetUserId === user.id) await loadConcerts(user.id)

    // reset buscador
    setQuery(''); setStep('artist'); setSelectedArtist(''); setSelectedTour('')
  }

  /* ========== RENDER ========== */
  return (
    <div className="bg-white min-h-screen text-black font-sans">
      {/* Banner EXACTO al de referencia */}
      <header className="w-full h-24 bg-[#1F48AF] flex items-end px-4 sm:px-6 pb-2">
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="p-2 rounded-full hover:bg-[#1A3A95] transition"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-6 pt-10">
        <h1 className="text-4xl font-light text-center tracking-tight mb-4" style={{ fontFamily: 'Times New Roman, serif' }}>
          Concerts
        </h1>
        <hr className="border-black w-full mb-8" />
      </div>

      {/* 🔎 Buscador solo cuando estás en TU propio perfil */}
      {user?.id && targetUserId === user.id && (
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
                  onClick={() => handleSearchSelect(item)}
                  className="w-full text-left px-5 py-3 hover:bg-[#f2f2f2] transition text-sm font-light"
                >
                  {typeof item === 'string' ? item : `${item.city}, ${item.country} · ${item.year}`}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 pb-24 space-y-20">
        {Object.entries(groupedConcerts)
          .sort(([a], [b]) => (a === 'Future' ? -1 : b === 'Future' ? 1 : Number(b) - Number(a)))
          .map(([year, list]) => (
            <section key={year} className="mb-12">
              <h2 className="text-3xl font-light text-gray-800 mb-3" style={{ fontFamily: 'Times New Roman, serif' }}>{year}</h2>
              <div className="w-24 h-[3px] bg-black mb-6 rounded-full" />

              <div className="space-y-16">
                {list.map((concert) => (
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

                    <div className="mt-4">
                      {(photosByConcert[concert.id] || []).length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {(photosByConcert[concert.id] || []).slice(0, 6).map((p) => (
                            <div key={p.id} className="relative w-full rounded-md overflow-hidden bg-neutral-200" style={{ aspectRatio: '2/3' }}>
                              <Image src={p.image_url} alt="" fill className="object-cover" sizes="(max-width:768px) 33vw, 16vw" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div />
                      <div className="flex items-center gap-5">
                        <button
                          onClick={() => { loadOnce(concert.id); toggleConcertLike(concert.id) }}
                          className="inline-flex items-center gap-2"
                          aria-label="Like concert"
                          title="Like this concert"
                        >
                          <HeartIcon filled={concertMeta[concert.id]?.myLike} />
                          <span className="text-sm font-light">{concertMeta[concert.id]?.likeCount ?? 0}</span>
                        </button>

                        <ConcertComments concertId={concert.id} />

                        {/* 🔹 Solo reducir el botón de Attendees */}
                        <div className="[&>button]:px-4 [&>button]:py-1.5 [&>button]:text-sm [&>button_svg]:w-4 [&>button_svg]:h-4">
                          <ConcertAttendees concertId={concert.id} />
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
}

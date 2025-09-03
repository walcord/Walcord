'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPost, uploadPostImages, searchRecords } from '../../lib/posts'

type TimeoutId = ReturnType<typeof setTimeout>;

type RecordItem = {
  id: string
  title: string
  artist_name?: string
  cover_url?: string | null
  vibe_color?: string | null
  cover_color?: string | null
}

const ERAS = [
  'From my childhood',
  'From my teenage years',
  'From my twenties',
  'From my thirties',
  'From my forties',
  'From my fifties',
  'From my sixties',
  'From my seventies',
  'From my eighties',
  'From my nineties',
]

export default function NewPostPage() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<RecordItem[]>([])
  const [searching, setSearching] = useState(false)

  const [record, setRecord] = useState<RecordItem | null>(null)
  const [era, setEra] = useState('From my teenage years')
  const [caption, setCaption] = useState('')

  const [files, setFiles] = useState<FileList | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const debouncer = useRef<TimeoutId | null>(null)

  useEffect(() => {
    const term = q.trim()
    if (!term || term.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    if (debouncer.current) clearTimeout(debouncer.current)
    debouncer.current = setTimeout(async () => {
      try {
        const res = await searchRecords(term)
        setResults(res as any)
      } finally {
        setSearching(false)
      }
    }, 200)
  }, [q])

  const onSubmit = async () => {
    if (!record) return alert('Please select a record')
    setSubmitting(true)
    setDone(null)
    try {
      const urls = files && files.length ? await uploadPostImages(Array.from(files)) : []
      await createPost({
        record_id: record.id,
        era,
        caption: caption.trim() || undefined,
        image_urls: urls,
      })
      setDone('Memory shared')
      setQ(''); setResults([]); setRecord(null); setCaption(''); setFiles(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e: any) {
      alert(e?.message ?? 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  const makeFileList = (arr: File[]) => {
    const dt = new DataTransfer()
    arr.forEach((f) => dt.items.add(f))
    return dt.files
  }

  const mergeFiles = (prev: FileList | null, incoming: FileList | null) => {
    const a = prev ? Array.from(prev) : []
    const b = incoming ? Array.from(incoming) : []
    const map = new Map<string, File>()
    ;[...a, ...b].forEach((f) =>
      map.set(`${f.name}-${f.size}-${f.lastModified}`, f)
    )
    return makeFileList(Array.from(map.values()))
  }

  const removeFileAt = (idx: number) => {
    if (!files) return
    const arr = Array.from(files)
    arr.splice(idx, 1)
    setFiles(arr.length ? makeFileList(arr) : null)
  }

  const previews = useMemo(() => {
    if (!files?.length) return []
    return Array.from(files).slice(0, 9).map((f) => URL.createObjectURL(f))
  }, [files])

  return (
    <div className="min-h-screen bg-[#1F48AF]/6">
      {/* Márgenes laterales en móvil (+ contenido más estrecho) */}
      <main className="mx-auto w-full max-w-3xl lg:max-w-5xl px-5 sm:px-6 py-10 sm:py-12">
        {/* Header */}
        <header className="mb-6 sm:mb-8">
          <h1
            className="text-[clamp(1.75rem,5vw,44px)] leading-[1.1] tracking-tight"
            style={{ fontFamily: '"Times New Roman", Times, serif', fontWeight: 400 }}
          >
            Share a Memory
          </h1>
          <p
            className="mt-2 text-sm text-neutral-600"
            style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
          >
            Bring your music moments to life.
          </p>
        </header>

        {/* Layout 2 columnas */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Columna izquierda: Record / Era / Caption */}
          <div>
            {record ? (
              <div className="mb-6 sm:mb-7 flex items-center justify-between rounded-2xl border border-neutral-200 bg-white/80 backdrop-blur px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div
                    className="relative h-10 w-10 rounded-xl shadow"
                    style={{ backgroundColor: record.vibe_color || '#0E1A3A' }}
                    aria-hidden
                  >
                    <div
                      className="absolute inset-[26%] rounded-md"
                      style={{ backgroundColor: record.cover_color || '#FFFFFF' }}
                    />
                  </div>
                  <div className="leading-tight">
                    <div style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                      {record.title}
                    </div>
                    {record.artist_name && (
                      <div
                        className="text-sm text-neutral-500"
                        style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                      >
                        {record.artist_name}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setRecord(null)}
                  className="text-sm text-[#1F48AF] hover:underline"
                  style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="mb-6 sm:mb-7">
                <label
                  className="block text-xs uppercase tracking-widest text-neutral-600"
                  style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                >
                  Record
                </label>

                <div className="mt-2 relative">
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search a record by title or artist…"
                    className="w-full rounded-xl border border-neutral-200 bg.white/70 backdrop-blur px-4 py-3 outline-none focus:ring-2 focus:ring-[#1F48AF] shadow-sm italic"
                    style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                  />
                  {(searching || results.length > 0) && (
                    <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white/95 shadow-xl">
                      {searching && (
                        <div
                          className="px-4 py-3 text-sm text-neutral-500"
                          style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                        >
                          Searching…
                        </div>
                      )}

                      {!searching &&
                        results.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => {
                              setRecord(r)
                              setQ('')
                              setResults([])
                            }}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 transition"
                          >
                            <div
                              className="relative h-9 w-9 rounded-lg shadow"
                              style={{ backgroundColor: r.vibe_color || '#0E1A3A' }}
                              aria-hidden
                            >
                              <div
                                className="absolute inset-[28%] rounded-[6px]"
                                style={{ backgroundColor: r.cover_color || '#FFFFFF' }}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                {r.title}
                              </div>
                              {r.artist_name && (
                                <div className="truncate text-sm text-neutral-500" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
                                  {r.artist_name}
                                </div>
                              )}
                            </div>
                          </button>
                        ))}

                      {!searching && results.length === 0 && q.trim().length >= 2 && (
                        <div className="px-4 py-3 text-sm text-neutral-500" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
                          No records found.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ERA */}
            <div className="mb-6 sm:mb-7">
              <label className="block text-xs uppercase tracking-widest text-neutral-600" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
                Era
              </label>
              <div className="mt-2 relative">
                <select
                  value={era}
                  onChange={(e) => setEra(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 pr-10 shadow-sm outline-none focus:ring-2 focus:ring-[#1F48AF]"
                  style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
                >
                  {ERAS.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">▾</span>
              </div>
            </div>

            {/* CAPTION */}
            <div className="mb-6 sm:mb-7">
              <label className="block text-xs uppercase tracking-widest text-neutral-600" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
                Caption
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={6}
                placeholder="Write something about this memory…"
                className="mt-2 w-full rounded-xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 outline-none focus:ring-2 focus:ring-[#1F48AF] shadow-sm"
                style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
              />
            </div>
          </div>

          {/* Columna derecha: Images */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-neutral-600" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
              Images
            </label>

            <div
              onDragEnter={() => setIsDragging(true)}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(ev) => {
                ev.preventDefault()
                setIsDragging(false)
                const incoming = ev.dataTransfer?.files ?? null
                if (incoming?.length) setFiles((prev) => mergeFiles(prev, incoming))
              }}
              onDragOver={(ev) => ev.preventDefault()}
              className={[
                'mt-2 rounded-2xl border border-dashed p-4 sm:p-5 bg-white/70 backdrop-blur transition',
                isDragging ? 'border-[#1F48AF] ring-2 ring-[#1F48AF]/40' : 'border-neutral-300',
              ].join(' ')}
            >
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => setFiles((prev) => mergeFiles(prev, e.target.files))}
                className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-xl file:border-0 file:bg-[#1F48AF] file:px-4 file:py-2 file:text-white file:shadow-sm hover:file:brightness-110"
                style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
              />

              {files?.length ? (
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-neutral-600" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
                    {files.length} image{files.length > 1 ? 's' : ''} selected
                  </span>
                  <button type="button" onClick={() => setFiles(null)} className="text-sm text-[#1F48AF] hover:underline" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
                    Clear
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-neutral-500 italic" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
                  Drag & drop images here or choose files.
                </p>
              )}

              {previews.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {previews.map((src, i) => (
                    <div key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-28 w-full rounded-xl object-cover" />
                      <button
                        type="button"
                        onClick={() => removeFileAt(i)}
                        className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-black/70 text-white text-xs leading-6 text-center shadow"
                        aria-label="Remove image"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ACTIONS */}
        <div className="mt-8 flex items-center gap-3">
          <button
            onClick={onSubmit}
            disabled={submitting || !record}
            className="rounded-xl bg-[#1F48AF] px-6 py-3 text-white shadow-sm transition hover:shadow disabled:opacity-40"
            style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}
          >
            {submitting ? 'Publishing…' : 'Publish'}
          </button>
          {done && (
            <span className="text-sm text-green-600" style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 300 }}>
              {done}
            </span>
          )}
        </div>
      </main>
    </div>
  )
}

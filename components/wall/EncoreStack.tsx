'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase } from '../../lib/supabaseClient'

type EncoreItem = {
  id: string
  artist_name: string
  city: string
  country: string
  year: number
  cover?: string | null
}

export default function EncoreStack({ followIds, excludeIds }: { followIds: string[]; excludeIds: string[] }) {
  const [items, setItems] = useState<EncoreItem[]>([])

  useEffect(() => {
    if (followIds.length === 0) return
    ;(async () => {
      const { data: atds } = await supabase
        .from('concerts_atendees')
        .select('concert_id')
        .in('user_id', followIds)

      const allIds = Array.from(new Set((atds || []).map((a: any) => a.concert_id)))
      const prevYearsIds = allIds.filter((id) => !excludeIds.includes(id))

      const { data: concerts } = await supabase
        .from('concerts')
        .select('id, artist_name, city, country, year')
        .in('id', prevYearsIds)
        .lt('year', new Date().getFullYear() - 1)
        .limit(12)

      const covers: Record<string, string | null> = {}
      if (concerts && concerts.length) {
        const ids = concerts.map(c => c.id)
        const { data: ph } = await supabase
          .from('concert_photos')
          .select('concert_id, image_url')
          .in('concert_id', ids)
          .order('created_at', { ascending: false })
        for (const p of ph || []) if (!covers[p.concert_id]) covers[p.concert_id] = p.image_url
      }

      setItems((concerts || []).map(c => ({ ...c, cover: covers[c.id] || null })))
    })()
  }, [followIds, excludeIds])

  if (items.length === 0) return null

  return (
    <div className="mt-12">
      <h4 className="text-center text-sm tracking-wide text-neutral-500 mb-4">Encore · from the archives</h4>
      <div className="relative flex justify-center">
        <div className="relative w-[280px] h-[280px]">
          {items.slice(0, 5).map((it, i) => {
            const rot = [-5, 3, -2, 6, -7][i % 5]
            const off = i * 6
            return (
              <div
                key={it.id}
                className="absolute top-0 left-0 w-[240px] h-[240px] rounded-xl border border-neutral-200 bg-white shadow-lg"
                style={{ transform: `translate(${off}px, ${off}px) rotate(${rot}deg)` }}
                title={`${it.artist_name} — ${it.city}, ${it.country} · ${it.year}`}
              >
                <div className="relative w-full h-[180px] rounded-t-xl overflow-hidden bg-neutral-100">
                  {it.cover ? (
                    <Image src={it.cover} alt="" fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-neutral-400">Walcord</div>
                  )}
                </div>
                <div className="p-3">
                  <div className="text-sm">{it.artist_name}</div>
                  <div className="text-xs text-neutral-500">{it.city}, {it.country} · {it.year}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

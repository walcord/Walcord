'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const WALCORD_BLUES = {
  blue1: '#3268bbff',
  blue2: '#284072ff',
  blue3: '#2d4288ff',
  blue4: '#4a6ea9ff',
}

type Props = { userId: string }

export default function PublicUserHeader({ userId }: Props) {
  const [fullName, setFullName] = useState('User')
  const [username, setUsername] = useState<string>('')
  const [genres, setGenres] = useState<string[]>([])
  const [songs, setSongs] = useState<string[]>([])
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [favouriteArtists, setFavouriteArtists] = useState<any[]>([])
  const [favouriteRecords, setFavouriteRecords] = useState<any[]>([])
  const [followersCount, setFollowersCount] = useState<number>(0)

  const [color1, color2, color3, color4] = useMemo(
    () => [WALCORD_BLUES.blue2, WALCORD_BLUES.blue1, WALCORD_BLUES.blue4, WALCORD_BLUES.blue3],
    []
  )

  // Perfil base
  useEffect(() => {
    if (!userId) return
    const run = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url, full_name, username')
        .eq('id', userId)
        .single()
      if (data) {
        setAvatarUrl(data.avatar_url || null)
        setFullName(data.full_name || 'User')
        setUsername(data.username || '')
      }
      const { data: fcounts } = await supabase
        .from('profile_follow_counts')
        .select('followers_count')
        .eq('profile_id', userId)
        .single()
      setFollowersCount(fcounts?.followers_count ?? 0)
    }
    run()
  }, [userId])

  // Géneros
  useEffect(() => {
    if (!userId) return
    const run = async () => {
      const { data } = await supabase
        .from('favourite_genres')
        .select('genres (slug)')
        .eq('user_id', userId)
        .limit(2)
      const names =
        data?.map((it: any) => it.genres?.slug)
          .filter(Boolean)
          .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)) || []
      setGenres(names)
    }
    run()
  }, [userId])

  // Top songs
  useEffect(() => {
    if (!userId) return
    const run = async () => {
      const { data } = await supabase
        .from('favourite_tracks')
        .select('track_id (track)')
        .eq('user_id', userId)
        .eq('is_top', true)
        .limit(3)
      setSongs((data || []).map((e: any) => e.track_id?.track).filter(Boolean))
    }
    run()
  }, [userId])

  // Favoritos (solo lectura)
  useEffect(() => {
    if (!userId) return
    const run = async () => {
      const { data: arts } = await supabase
        .from('favourite_artists')
        .select('name, cover_color, vibe_color')
        .eq('user_id', userId)
      setFavouriteArtists(arts || [])

      const { data: recs } = await supabase
        .from('favourite_records')
        .select('name, cover_color, vibe_color')
        .eq('user_id', userId)
      setFavouriteRecords(recs || [])
    }
    run()
  }, [userId])

  const queryUser = username ? `?username=${encodeURIComponent(username)}` : ''
  const disabledLinkClass = username ? '' : 'pointer-events-none opacity-60'

  return (
    <section className="w-full px-6 sm:px-12">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-10">
        {/* Avatar */}
        <div className="w-[108px] h-[108px] rounded-full shrink-0 overflow-hidden bg-neutral-300 relative">
          {avatarUrl && <Image src={avatarUrl} alt="Profile" fill className="object-cover" />}
        </div>

        {/* Info */}
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left w-full">
          <p className="text-[15px] font-light text-[#1d1d1d] leading-tight" style={{ fontFamily: 'Times New Roman, serif' }}>
            {genres.length === 2 ? `${genres[0]} and ${genres[1]}` : '—'}
          </p>

          <h1 className="text-[clamp(2rem,5vw,2.625rem)] font-normal mt-1 mb-2" style={{ fontFamily: 'Times New Roman, serif' }}>
            {fullName}
          </h1>

          {/* Favourite blocks */}
          <div className="flex flex-wrap justify-center sm:justify-start gap-6 mb-4">
            {/* Records */}
            <Link
              href={`/u/records${queryUser}`}
              aria-disabled={!username}
              className={`flex items-center gap-3 hover:opacity-80 transition-all ${disabledLinkClass}`}
            >
              <div className="relative w-[48px] h-[48px]">
                {favouriteRecords.length >= 2 ? (
                  favouriteRecords.slice(0, 2).map((rec, i) => (
                    <div
                      key={i}
                      className={`absolute top-0 ${i === 0 ? 'left-0 z-10' : 'left-[8px] z-0'} w-[40px] h-[40px] rounded-sm`}
                      style={{ background: rec.cover_color || '#ccc', border: `3px solid ${rec.vibe_color || '#eee'}` }}
                    />
                  ))
                ) : (
                  <>
                    <div className="absolute left-0 top-0 w-[40px] h-[40px] rounded-sm z-10" style={{ backgroundColor: color1 }} />
                    <div className="absolute left-[8px] top-0 w-[40px] h-[40px] rounded-sm z-0" style={{ backgroundColor: color2 }} />
                  </>
                )}
              </div>
              <div className="text-[15px] font-light leading-tight">
                <div>Favourite</div>
                <div>Records</div>
              </div>
            </Link>

            {/* Artists */}
            <Link
              href={`/u/artists${queryUser}`}
              aria-disabled={!username}
              className={`flex items-center gap-3 hover:opacity-80 transition-all ${disabledLinkClass}`}
            >
              <div className="relative w-[48px] h-[48px]">
                {favouriteArtists.length >= 2 ? (
                  favouriteArtists.slice(0, 2).map((art, i) => (
                    <div
                      key={i}
                      className={`absolute top-0 ${i === 0 ? 'left-0 z-10' : 'left-[8px] z-0'} w-[40px] h-[40px] rounded-full`}
                      style={{ background: art.cover_color || '#ccc', border: `3px solid ${art.vibe_color || '#eee'}` }}
                    />
                  ))
                ) : (
                  <>
                    <div className="absolute left-0 top-0 w-[40px] h-[40px] rounded-full z-10" style={{ backgroundColor: color3 }} />
                    <div className="absolute left-[8px] top-0 w-[40px] h-[40px] rounded-full z-0" style={{ backgroundColor: color4 }} />
                  </>
                )}
              </div>
              <div className="text-[15px] font-light leading-tight">
                <div>Favourite</div>
                <div>Artists</div>
              </div>
            </Link>
          </div>

          {/* Concerts → viewer */}
          <Link
            href={`/u/ConcertsViewer${queryUser}`}
            aria-disabled={!username}
            className={`bg-[#1f45af] text-white text-[15px] font-normal px-6 py-[6px] rounded transition-all duration-200 hover:scale-[1.02] hover:shadow-md active:scale-[0.97] ${disabledLinkClass}`}
            style={{ fontFamily: 'Times New Roman' }}
          >
            Concerts
          </Link>

          {/* Favourite Songs (solo texto) */}
          <div
            className="mt-4 text-left text-[13px] font-light leading-tight"
            style={{ fontFamily: 'Roboto, sans-serif' }}
          >
            <p className="mb-1">Favourite Songs</p>
            <p className="text-[#1d1d1d]">{songs.length > 0 ? songs.join(' · ') : '—'}</p>
          </div>

          {/* Social */}
          <div className="mt-6 flex items-center gap-3">
            <span className="text-sm text-neutral-700 select-none" style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}>
              {followersCount} followers
            </span>

            <Link
              href={username ? `/u/friends${queryUser}` : '#'}
              aria-disabled={!username}
              className={`text-sm text-[#1F48AF] underline-offset-4 hover:underline ${disabledLinkClass}`}
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
            >
              See all friends
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

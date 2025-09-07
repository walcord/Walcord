import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabaseClient"
import Image from "next/image"
import WalcordStar from "../../components/icons/WalcordStar"
import WalcordCircle from "../../components/icons/WalcordCircle"
import WalcordPeopleIcon from "../../components/icons/WalcordPeopleIcon"
import Link from "next/link"

/** Tooltip minimal Walcord */
const Tooltip = ({ children, message }: { children: React.ReactNode; message: string }) => (
  <div className="group relative flex justify-center items-center">
    {children}
    <span
      className="absolute bottom-full mb-2 w-max max-w-[240px] scale-0 group-hover:scale-100 transition-all bg-[#1F48AF] text-white text-xs px-3 py-[6px] rounded z-10 whitespace-nowrap font-light"
      style={{ fontFamily: "Roboto" }}
    >
      {message}
    </span>
  </div>
)

/** Modal simple y limpio */
const Modal = ({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg" style={{ fontFamily: "Times New Roman" }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-black text-sm font-light"
            style={{ fontFamily: "Roboto" }}
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function RecordProfile() {
  const router = useRouter()
  const { id } = router.query
  // Normalizamos SIEMPRE el id de la ruta a string
  const recordId = Array.isArray(id) ? id[0] : (id as string | undefined)

  const [record, setRecord] = useState<any>(null)
  const [tracks, setTracks] = useState<any[]>([])
  const [friends, setFriends] = useState<any[]>([])
  const [photos, setPhotos] = useState<any[]>([])
  const [averageRate, setAverageRate] = useState<number | null>(null)
  const [userRating, setUserRating] = useState<number | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [favouriteTrackIds, setFavouriteTrackIds] = useState<string[]>([])
  const [isFromFavouriteArtist, setIsFromFavouriteArtist] = useState<boolean>(false)

  // pending (nuevo)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pendingLoading, setPendingLoading] = useState(false)

  // modal amigos
  const [openFriends, setOpenFriends] = useState(false)

  useEffect(() => {
    if (!recordId) return

    const fetchAll = async () => {
      // RECORD
      const { data: recordData } = await supabase.from("records").select("*").eq("id", recordId).single()
      if (!recordData) return

      // ARTISTA
      const { data: artistData } = await supabase
        .from("artists")
        .select("id, name")
        .eq("name", recordData.artist_name)
        .single()

      // TRACKS
      const { data: tracksData } = await supabase
        .from("tracks")
        .select("id, track")
        .eq("record", recordData.title)

      // RATINGS (media)
      const { data: ratingsData } = await supabase.from("ratings").select("rate").eq("record_id", recordId)
      const avg =
        ratingsData && ratingsData.length > 0
          ? ratingsData.reduce((sum: number, r: any) => sum + r.rate, 0) / ratingsData.length
          : null

      // 📸 FOTOS DESDE POSTS (usa image_urls TEXT con JSON o CSV)
      const { data: postsData } = await supabase
        .from("posts")
        .select("id, image_urls, created_at, record_id")
        .eq("record_id", recordId)
        .order("created_at", { ascending: false })

      const flattenedPhotos =
        (postsData || []).flatMap((p: any) => {
          let arr: string[] = []

          if (typeof p.image_urls === "string" && p.image_urls.trim() !== "") {
            // 1) Intenta parsear JSON ["url1","url2"]
            try {
              const parsed = JSON.parse(p.image_urls)
              if (Array.isArray(parsed)) arr = parsed.filter(Boolean)
            } catch {
              // 2) Fallback CSV "url1,url2"
              arr = p.image_urls.split(",").map((s: string) => s.trim()).filter(Boolean)
            }
          } else if (Array.isArray(p.image_urls)) {
            arr = p.image_urls.filter(Boolean)
          }

          return arr.map((u: string, idx: number) => ({
            id: `${p.id}-${idx}`,
            image_url: u,
            created_at: p.created_at,
          }))
        })

      // AMIGOS (quien tiene este record en favoritos)
      const { data: friendsData } = await supabase
        .from("favourite_records")
        .select("user_id, profiles(username, avatar_url)")
        .eq("record_id", recordId)

      // USUARIO
      const user = (await supabase.auth.getUser()).data.user
      setUserId(user?.id || null)

      if (user?.id && artistData) {
        // ¿El artista es favorito del usuario?
        const { data: favArtist } = await supabase
          .from("favourite_artists")
          .select("*")
          .eq("user_id", user.id)
          .eq("artist_id", artistData.id)
        if (favArtist?.length > 0) setIsFromFavouriteArtist(true)

        // Canciones favoritas del usuario en este record
        const { data: favTracks } = await supabase
          .from("favourite_tracks")
          .select("track_id")
          .eq("user_id", user.id)
          .eq("record_id", recordId)
        setFavouriteTrackIds(favTracks?.map((t) => t.track_id) || [])

        // Rating del usuario
        const { data: userRate } = await supabase
          .from("ratings")
          .select("rate")
          .eq("user_id", user.id)
          .eq("record_id", recordId)
          .maybeSingle()
        if (userRate) setUserRating(userRate.rate)
      }

      // Amigos sin incluir al usuario actual
      const friendsWithoutMe = (friendsData || []).filter((f: any) => f.user_id !== user?.id)

      setRecord({ ...recordData, artist: artistData })
      setTracks(tracksData || [])
      setFriends(friendsWithoutMe || [])
      setAverageRate(avg)
      setPhotos(flattenedPhotos || [])
    }

    fetchAll()
  }, [recordId])

  // Carga/estado de Pending (nuevo)
  useEffect(() => {
    if (!recordId) return
    ;(async () => {
      const u = (await supabase.auth.getUser()).data.user
      if (!u?.id) return
      const { data, error } = await supabase
        .from("pending_items")
        .select("id")
        .eq("user_id", u.id)
        .eq("type", "record")
        .eq("record_id", recordId)
        .maybeSingle()
      if (!error && data?.id) setPendingId(data.id)
    })()
  }, [recordId])

  const togglePending = async () => {
    const u = (await supabase.auth.getUser()).data.user
    if (!u?.id || !recordId) return
    setPendingLoading(true)
    try {
      if (pendingId) {
        const { error } = await supabase.from("pending_items").delete().eq("id", pendingId)
        if (error) throw error
        setPendingId(null)
      } else {
        const { data, error } = await supabase
          .from("pending_items")
          .upsert(
            { user_id: u.id, type: "record", artist_id: null, record_id: recordId },
            { onConflict: "user_id,type,artist_id,record_id" }
          )
          .select("id")
          .single()
        if (error) throw error
        setPendingId(data.id)
      }
    } finally {
      setPendingLoading(false)
    }
  }

  // Cambiar / quitar rating
  const handleRate = async (rate: number) => {
    if (!userId || !recordId) return

    // Si repite la misma nota, borramos su rating
    if (userRating === rate) {
      await supabase.from("ratings").delete().eq("user_id", userId).eq("record_id", recordId)
      setUserRating(null)
    } else {
      // Eliminamos cualquier rating previo de este usuario para este disco y luego insertamos
      await supabase.from("ratings").delete().eq("user_id", userId).eq("record_id", recordId)
      await supabase.from("ratings").insert({ user_id: userId, record_id: recordId, rate })
      setUserRating(rate)
    }

    const { data: ratingsData } = await supabase.from("ratings").select("rate").eq("record_id", recordId)
    const avg =
      ratingsData && ratingsData.length > 0
        ? ratingsData.reduce((sum: number, r: any) => sum + r.rate, 0) / ratingsData.length
        : null
    setAverageRate(avg)
  }

  // Toggle favourite track
  const toggleFavourite = async (trackId: string) => {
    if (!userId || !recordId) return
    const isFav = favouriteTrackIds.includes(trackId)

    if (isFav) {
      await supabase
        .from("favourite_tracks")
        .delete()
        .eq("user_id", userId)
        .eq("track_id", trackId)
        .eq("record_id", recordId)
      setFavouriteTrackIds(favouriteTrackIds.filter((tid) => tid !== trackId))
    } else {
      await supabase.from("favourite_tracks").upsert({
        user_id: userId,
        track_id: trackId,
        record_id: recordId,
        is_top: false,
      })
      setFavouriteTrackIds([...favouriteTrackIds, trackId])
    }
  }

  if (!record) {
    return (
      <main className="flex justify-center items-center h-screen text-gray-500 text-sm">
        Loading record...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white text-black">
      {/* Banner azul con flecha minimalista pegada abajo (h-24, sin logo) */}
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

      {/* Layout: mobile -> Record (1) / Tracklist (2) / Photos (3) */}
      {/* Desktop -> Tracklist | Photos | Record */}
      <div className="px-6 md:px-24 pt-14 pb-24 flex flex-col lg:flex-row gap-20">
        {/* TRACKLIST */}
        <div className="order-2 lg:order-1 w-full lg:w-1/3">
          <ul className="space-y-5">
            {tracks.map((t: any, i: number) => {
              const isFav = favouriteTrackIds.includes(t.id)
              return (
                <li
                  key={i}
                  className="flex justify-between items-center text-[clamp(2rem,3vw,2rem)] font-light"
                  style={{ fontFamily: "Times New Roman, serif" }}
                >
                  <div className="flex items-center gap-2 min-w-0 w-full">
                    <Tooltip message={isFav ? "Remove from favourites" : "Add to favourites"}>
                      <button
                        onClick={() => toggleFavourite(t.id)}
                        className="transition-transform duration-200 hover:scale-110 active:scale-90 flex-shrink-0"
                      >
                        <WalcordStar
                          filled={isFav}
                          size={20}
                          className={`w-5 h-5 ${isFav ? "text-[#1F48AF]" : "text-gray-400"}`}
                        />
                      </button>
                    </Tooltip>

                    {/* Título con ellipsis, sin salto */}
                    <div className="max-w-[80%] md:max-w-[85%] lg:max-w-[86%] overflow-hidden">
                      <span className="block truncate" title={t.track}>
                        {t.track}
                      </span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        {/* FOTOS (mosaico estilo Pinterest) */}
        <div className="order-3 lg:order-2 w-full lg:w-1/3">
          <div className="columns-2 sm:columns-3 gap-4 [&_img]:mb-4">
            {photos.map((p: any) => (
              <Image
                key={p.id}
                src={p.image_url || "/placeholder.png"}
                alt="record photo"
                width={800}
                height={800}
                className="w-full rounded-xl shadow-sm object-cover"
              />
            ))}
            {photos.length === 0 && (
              <p className="text-sm text-gray-400 font-light text-center" style={{ fontFamily: "Roboto" }}>
                No photos yet for this record.
              </p>
            )}
          </div>
        </div>

        {/* RECORD INFO */}
        <div className="order-1 lg:order-3 w-full lg:w-1/3 flex flex-col items-center text-center">
          {/* Cover */}
          <div className="w-64 h-64 mb-6 flex items-center justify-center" style={{ backgroundColor: record.vibe_color }}>
            <div className="w-16 h-16 rounded-sm shadow-md" style={{ backgroundColor: record.cover_color }} />
          </div>

          {/* Title + artist */}
          <h1 className="text-[clamp(1.8rem,3vw,2.5rem)] font-normal mb-1" style={{ fontFamily: "Times New Roman" }}>
            {record.title}
          </h1>
          <p className="text-sm text-gray-600 font-light mb-4" style={{ fontFamily: "Roboto" }}>
            by {record.artist?.name}
          </p>

          {/* Botón Add to Pending (AZUL) */}
          {userId && (
            <button
              onClick={togglePending}
              disabled={pendingLoading}
              className={[
                "mb-4 rounded-full px-3 py-1.5 text-xs border transition",
                pendingId
                  ? "bg-[#1F48AF] text-white border-[#1F48AF]"
                  : "bg-white text-[#1F48AF] border-[#1F48AF] hover:bg-[#1F48AF] hover:text-white",
              ].join(" ")}
              title={pendingId ? "Remove from Pending" : "Add to Pending"}
            >
              {pendingLoading ? "Saving…" : pendingId ? "In Pending" : "Add to Pending"}
            </button>
          )}

          {/* Description */}
          {record.description && (
            <p
              className="text-sm text-gray-700 font-light leading-relaxed mb-4 max-w-xs"
              style={{ fontFamily: "Roboto" }}
            >
              {record.description}
            </p>
          )}

          <p className="text-xs text-gray-500 font-light mb-6">Released in {record.release_year}</p>

          {/* Average Grade */}
          {averageRate !== null && (
            <div className="flex flex-col items-center mb-6">
              <Tooltip message="This is the average rating from all users">
                <div className="relative flex items-center justify-center w-16 h-16 transition-all duration-300 hover:scale-105">
                  <div className="absolute inset-0 rounded-full border border-black bg-white flex items-center justify-center">
                    <span className="text-lg font-normal" style={{ fontFamily: "Times New Roman" }}>
                      {averageRate.toFixed(1)}
                    </span>
                  </div>
                  <WalcordCircle className="absolute -bottom-1 -right-1 w-5 h-5 text-[#1F48AF]" />
                </div>
              </Tooltip>
              <p className="text-xs text-gray-500 mt-2">Average Grade</p>
            </div>
          )}

          {/* Rate buttons (toggle to remove) */}
          <div className="grid grid-cols-5 gap-2 mb-8">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <Tooltip key={n} message={userRating === n ? `Tap again to remove (${n})` : `Rate ${n}`}>
                <button
                  onClick={() => handleRate(n)}
                  className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-200 active:scale-90
                    ${
                      userRating === n
                        ? "bg-[#1F48AF] text-white border-[#1F48AF] scale-105"
                        : "text-black hover:bg-gray-100 border-black hover:scale-105"
                    }
                  `}
                  style={{ fontFamily: "Times New Roman" }}
                >
                  {n}
                </button>
              </Tooltip>
            ))}
          </div>

          {/* Friends (solo si hay OTROS usuarios) */}
          {(friends?.length || 0) > 0 && (
            <button onClick={() => setOpenFriends(true)} className="flex items-center gap-2 mb-4 group">
              <div className="flex -space-x-2">
                {friends.slice(0, 3).map((f: any, i: number) => (
                  <Image
                    key={i}
                    src={f.profiles?.avatar_url || "/default-user-icon.png"}
                    width={26}
                    height={26}
                    alt="user"
                    className="rounded-full border border-black"
                  />
                ))}
              </div>
              <span className="text-xs font-light text-gray-600 group-hover:text-black transition-colors flex items-center gap-1">
                <WalcordPeopleIcon className="w-4 h-4" />
                Some friends love this record
              </span>
            </button>
          )}

          {/* (Opcional) marca si el artista es favorito del usuario */}
          {isFromFavouriteArtist && (
            <div className="flex items-center gap-1">
              <p className="text-xs font-light text-gray-500">Record from one of your Favourites</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal con lista completa de amigos */}
      <Modal open={openFriends} onClose={() => setOpenFriends(false)} title="Friends who love this record">
        {friends.length === 0 ? (
          <p className="text-sm text-gray-500 font-light" style={{ fontFamily: "Roboto" }}>
            No friends yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {friends.map((f: any, i: number) => (
              <li key={i} className="flex items-center gap-3">
                <Image
                  src={f.profiles?.avatar_url || "/default-user-icon.png"}
                  width={32}
                  height={32}
                  alt="user"
                  className="rounded-full border border-black"
                />
                <span className="text-sm" style={{ fontFamily: "Roboto" }}>
                  {f.profiles?.username || "Walcord user"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </main>
  )
}

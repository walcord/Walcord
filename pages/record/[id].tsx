import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabaseClient"
import Image from "next/image"
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

type Profile = {
  id: string
  full_name: string | null
  username: string | null
}

type Thought = {
  id: string
  user_id: string
  target_type: "record" | "artist" | "track"
  target_id: string
  body: string
  created_at: string
  profile?: Profile
  likes_count?: number
  comments_count?: number
  liked_by_me?: boolean
}

type ThoughtComment = {
  id: string
  user_id: string
  body: string
  created_at: string
  profile?: Profile
}

export default function RecordProfile() {
  const router = useRouter()
  const { id } = router.query
  const recordId = Array.isArray(id) ? id[0] : (id as string | undefined)

  const [record, setRecord] = useState<any>(null)
  const [friends, setFriends] = useState<any[]>([])
  const [averageRate, setAverageRate] = useState<number | null>(null)
  const [userRating, setUserRating] = useState<number | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isFromFavouriteArtist, setIsFromFavouriteArtist] = useState<boolean>(false)

  // modal amigos
  const [openFriends, setOpenFriends] = useState(false)

  // ✅ Modal de login contextual (solo si no hay sesión)
  const [loginOpen, setLoginOpen] = useState(false)
  const [loginTitle, setLoginTitle] = useState<string>("Sign in to continue")
  const requireAuth = (title: string) => {
    if (!userId) {
      setLoginTitle(title)
      setLoginOpen(true)
      return false
    }
    return true
  }

  // ────────────────────────────────────────────────
  // STATE: Listener Takes embebido en este record
  // ────────────────────────────────────────────────
  const [takesLoading, setTakesLoading] = useState<boolean>(true)
  const [takes, setTakes] = useState<Thought[]>([])
  const [takeBody, setTakeBody] = useState<string>("")
  const [takePosting, setTakePosting] = useState<boolean>(false)
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({})
  const [commentsMap, setCommentsMap] = useState<Record<string, ThoughtComment[]>>({})
  const [replyFor, setReplyFor] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState<string>("")

  useEffect(() => {
    const syncUser = async () => {
      const u = (await supabase.auth.getUser()).data.user
      setUserId(u?.id || null)
    }
    syncUser()
  }, [])

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

      // RATINGS (media)
      const { data: ratingsData } = await supabase.from("ratings").select("rate").eq("record_id", recordId)
      const avg =
        ratingsData && ratingsData.length > 0
          ? ratingsData.reduce((sum: number, r: any) => sum + r.rate, 0) / ratingsData.length
          : null

      // AMIGOS (quien tiene este record en favoritos)
      const { data: friendsData } = await supabase
        .from("favourite_records")
        .select("user_id, profiles(username, avatar_url)")
        .eq("record_id", recordId)

      // USUARIO
      const u = (await supabase.auth.getUser()).data.user

      if (u?.id && artistData) {
        // ¿El artista es favorito del usuario?
        const { data: favArtist } = await supabase
          .from("favourite_artists")
          .select("*")
          .eq("user_id", u.id)
          .eq("artist_id", artistData.id)
        if (favArtist?.length > 0) setIsFromFavouriteArtist(true)

        // Rating del usuario
        const { data: userRate } = await supabase
          .from("ratings")
          .select("rate")
          .eq("user_id", u.id)
          .eq("record_id", recordId)
          .maybeSingle()
        if (userRate) setUserRating(userRate.rate)
      }

      const friendsWithoutMe = (friendsData || []).filter((f: any) => f.user_id !== u?.id)

      setRecord({ ...recordData, artist: artistData })
      setFriends(friendsWithoutMe || [])
      setAverageRate(avg)

      await loadTakes(recordId, u?.id || null)
    }

    fetchAll()
  }, [recordId])

  // Cambiar / quitar rating
  const handleRate = async (rate: number) => {
    if (!requireAuth("Sign in to rate this record")) return
    if (!userId || !recordId) return

    // Si repite la misma nota, borramos su rating
    if (userRating === rate) {
      await supabase.from("ratings").delete().eq("user_id", userId).eq("record_id", recordId)
      setUserRating(null)
    } else {
      // Eliminamos cualquier rating previo y luego insertamos
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

  // ────────────────────────────────────────────────
  // LÓGICA Listener Takes (filtrado al recordId)
  // ────────────────────────────────────────────────
  const loadTakes = async (recId: string, myId: string | null) => {
    setTakesLoading(true)
    const { data: recs, error } = await supabase
      .from("recommendations")
      .select("id, user_id, target_type, target_id, body, created_at")
      .eq("target_type", "record")
      .eq("target_id", recId)
      .order("created_at", { ascending: false })
      .limit(200)

    if (error) {
      setTakes([])
      setTakesLoading(false)
      return
    }

    // Perfiles
    const userIds = Array.from(new Set((recs || []).map((r) => r.user_id)))
    let profiles: Record<string, Profile> = {}
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, username").in("id", userIds)
      ;(profs || []).forEach((p: any) => (profiles[p.id] = p))
    }

    // Métricas likes/comments
    const ids = (recs || []).map((r) => r.id)
    const likesCount: Record<string, number> = {}
    const commentsCount: Record<string, number> = {}
    const likedSet = new Set<string>()

    if (ids.length) {
      const { data: likes } = await supabase
        .from("recommendation_likes")
        .select("recommendation_id")
        .in("recommendation_id", ids as any)
      ;(likes || []).forEach((row: any) => {
        const k = String(row.recommendation_id)
        likesCount[k] = (likesCount[k] || 0) + 1
      })

      const { data: comments } = await supabase
        .from("recommendation_comments")
        .select("recommendation_id")
        .in("recommendation_id", ids as any)
      ;(comments || []).forEach((row: any) => {
        const k = String(row.recommendation_id)
        commentsCount[k] = (commentsCount[k] || 0) + 1
      })

      if (myId) {
        const { data: myLikes } = await supabase
          .from("recommendation_likes")
          .select("recommendation_id")
          .in("recommendation_id", ids as any)
          .eq("user_id", myId)
        ;(myLikes || []).forEach((row: any) => likedSet.add(row.recommendation_id))
      }
    }

    const mapped: Thought[] = (recs || []).map((r: any) => ({
      ...r,
      profile: profiles[r.user_id],
      likes_count: likesCount[String(r.id)] ?? 0,
      comments_count: commentsCount[String(r.id)] ?? 0,
      liked_by_me: likedSet.has(r.id),
    }))

    setTakes(mapped)
    setTakesLoading(false)
  }

  const postTake = async () => {
    if (!recordId) return
    if (!requireAuth("Sign in to share your take")) return
    const bodyClean = takeBody.trim()
    if (bodyClean.length === 0 || bodyClean.length > 280) return
    if (!userId) return

    setTakePosting(true)
    const tmpId = `tmp_${Date.now()}`
    const optimistic: Thought = {
      id: tmpId,
      user_id: userId,
      target_type: "record",
      target_id: recordId,
      body: bodyClean,
      created_at: new Date().toISOString(),
      profile: { id: userId, full_name: "—", username: null },
      likes_count: 0,
      comments_count: 0,
      liked_by_me: false,
    }
    setTakes((prev) => [optimistic, ...prev])

    const { data, error } = await supabase
      .from("recommendations")
      .insert({
        user_id: userId,
        target_type: "record",
        target_id: recordId,
        body: bodyClean,
      })
      .select("id")
      .single()

    if (error) {
      setTakes((prev) => prev.filter((it) => it.id !== tmpId))
      alert(`Error posting: ${error.message}`)
    } else {
      setTakes((prev) => prev.map((it) => (it.id === tmpId ? { ...it, id: data.id } : it)))
    }

    setTakePosting(false)
    setTakeBody("")
  }

  const toggleLike = async (rec: Thought) => {
    if (!requireAuth("Sign in to like")) return
    if (!userId) return

    if (rec.liked_by_me) {
      await supabase.from("recommendation_likes").delete().match({ recommendation_id: rec.id, user_id: userId })
      setTakes((prev) =>
        prev.map((it) =>
          it.id === rec.id ? { ...it, liked_by_me: false, likes_count: Math.max(0, (it.likes_count || 0) - 1) } : it
        )
      )
    } else {
      await supabase.from("recommendation_likes").insert({ recommendation_id: rec.id, user_id: userId })
      setTakes((prev) =>
        prev.map((it) => (it.id === rec.id ? { ...it, liked_by_me: true, likes_count: (it.likes_count || 0) + 1 } : it))
      )
    }
  }

  const loadComments = async (id: string) => {
    const { data, error } = await supabase
      .from("recommendation_comments")
      .select("id, user_id, body, created_at")
      .eq("recommendation_id", id)
      .order("created_at", { ascending: true })
    if (error) return

    const uids = Array.from(new Set((data || []).map((c) => c.user_id)))
    let pmap: Record<string, Profile> = {}
    if (uids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, username").in("id", uids)
      ;(profs || []).forEach((p: any) => (pmap[p.id] = p))
    }

    const mapped: ThoughtComment[] = (data || []).map((c: any) => ({
      ...c,
      profile: pmap[c.user_id],
    }))
    setCommentsMap((prev) => ({ ...prev, [id]: mapped }))
  }

  const sendReply = async () => {
    if (!replyFor || !userId) return
    const bodyClean = replyBody.trim()
    if (bodyClean.length === 0 || bodyClean.length > 280) return

    const { data, error } = await supabase
      .from("recommendation_comments")
      .insert({
        recommendation_id: replyFor,
        user_id: userId,
        body: bodyClean,
      })
      .select("id, created_at")
      .single()

    if (!error) {
      setTakes((prev) =>
        prev.map((it) => (it.id === replyFor ? { ...it, comments_count: (it.comments_count || 0) + 1 } : it))
      )
      setCommentsMap((prev) => {
        const prevList = prev[replyFor] || []
        const newItem: ThoughtComment = {
          id: data.id,
          user_id: userId,
          body: bodyClean,
          created_at: data.created_at,
          profile: { id: userId, full_name: "—", username: null },
        }
        return { ...prev, [replyFor]: [...prevList, newItem] }
      })
    }

    setReplyBody("")
    setReplyFor(null)
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

      {/* ===== Layout centrado del disco ===== */}
      <div className="px-6 md:px-24 pt-10 pb-16">
        <div className="mx-auto w-full max-w-[680px] flex flex-col items-center text-center">
          {/* Cover centrada */}
          <div
            className="w-64 h-64 mb-6 flex items-center justify-center rounded-xl"
            style={{ backgroundColor: record.vibe_color }}
          >
            <div className="w-16 h-16 rounded-sm shadow-md" style={{ backgroundColor: record.cover_color }} />
          </div>

          {/* Title + artist */}
          <h1 className="text-[clamp(1.8rem,3vw,2.5rem)] font-normal mb-1" style={{ fontFamily: "Times New Roman" }}>
            {record.title}
          </h1>
          <p className="text-sm text-gray-600 font-light mb-4" style={{ fontFamily: "Roboto" }}>
            by {record.artist?.name}
          </p>

          {/* Description */}
          {record.description && (
            <p
              className="text-sm text-gray-700 font-light leading-relaxed mb-4 max-w-md"
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
            <div className="flex items-center gap-1 mb-2">
              <p className="text-xs text-gray-500">Record from one of your Favourites</p>
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

      {/* ✅ Modal de Login (solo cuando el usuario no ha iniciado sesión) */}
      <Modal open={loginOpen} onClose={() => setLoginOpen(false)} title={loginTitle}>
        <div className="space-y-3">
          <p className="text-sm text-gray-600 font-light" style={{ fontFamily: "Roboto" }}>
            Create an account or sign in to interact with Walcord.
          </p>
          <Link
            href="/login"
            className="block text-center rounded-xl bg-[#1F48AF] text-white px-4 py-2 text-sm"
            style={{ fontFamily: "Roboto" }}
          >
            Sign in
          </Link>
          <button
            onClick={() => setLoginOpen(false)}
            className="w-full text-center text-sm text-gray-500 underline"
            style={{ fontFamily: "Roboto" }}
          >
            Continue browsing
          </button>
        </div>
      </Modal>

      {/* ───────────────────────────────
          LISTENER TAKES (antes community)
          ─────────────────────────────── */}
      <section className="px-6 md:px-24 pb-24">
        <div className="mx-auto w-full max-w-[680px]">
          <h2 className="text-xl mb-3" style={{ fontFamily: "Times New Roman" }}>
            Listener Takes
          </h2>

          {/* Composer (solo texto, 280) */}
          <div className="bg-white border border-neutral-200 rounded-3xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.06)] mb-4">
            <textarea
              value={takeBody}
              onChange={(e) => setTakeBody(e.target.value)}
              placeholder="Share your thoughts about this record…"
              className="w-full min-h-[90px] border border-neutral-300 rounded-2xl px-3 py-3 text-[15px] leading-7 outline-none focus:ring-2 focus:ring-[#1F48AF] font-[family-name:Times_New_Roman,Times,serif]"
              maxLength={280}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className={`text-xs ${takeBody.length > 280 ? "text-red-600" : "text-neutral-500"}`}>
                {280 - takeBody.length}
              </span>
              <button
                onClick={postTake}
                disabled={takePosting || takeBody.trim().length === 0 || takeBody.length > 280}
                className={`text-xs px-4 py-2 rounded-full ${
                  takeBody.trim().length && takeBody.length <= 280
                    ? "bg-[#1F48AF] text-white"
                    : "bg-neutral-300 text-neutral-600 cursor-not-allowed"
                }`}
              >
                {takePosting ? "Posting…" : "Share Take"}
              </button>
            </div>
          </div>

          {/* Feed */}
          {takesLoading ? (
            <div className="text-sm text-neutral-500">Loading takes…</div>
          ) : takes.length === 0 ? (
            <div className="text-sm text-neutral-500">No takes yet.</div>
          ) : (
            <ul className="space-y-3">
              {takes.map((it) => (
                <li key={String(it.id)} className="border border-neutral-200 rounded-3xl p-4 shadow-[0_6px_24px_rgba(0,0,0,0.05)]">
                  {/* Cabecera */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[15px] font-light font-[family-name:Times_New_Roman,Times,serif]">
                        {it.profile?.full_name || "—"}
                      </div>
                      <div className="text-[11px] text-neutral-500">{new Date(it.created_at).toLocaleString()}</div>
                    </div>
                    <div className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">RECORD</div>
                  </div>

                  {/* Texto */}
                  <p className="mt-3 text-[16px] leading-7 font-[family-name:Times_New_Roman,Times,serif]">{it.body}</p>

                  {/* Acciones */}
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={() => toggleLike(it)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition ${
                        it.liked_by_me ? "bg-[#1F48AF] text-white border-[#1F48AF]" : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      Like · {it.likes_count || 0}
                    </button>

                    <button
                      onClick={async () => {
                        const isOpen = !!openComments[it.id]
                        const next = { ...openComments, [it.id]: !isOpen }
                        setOpenComments(next)
                        if (!isOpen && !commentsMap[it.id]) await loadComments(it.id)
                        setReplyFor(it.id)
                      }}
                      className="text-xs px-3 py-1.5 rounded-full border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                      aria-expanded={!!openComments[it.id]}
                    >
                      Comment · {it.comments_count || 0}
                    </button>
                  </div>

                  {/* Lista de comentarios */}
                  {openComments[it.id] && (
                    <div className="mt-3">
                      {commentsMap[it.id] && commentsMap[it.id]!.length > 0 ? (
                        <ul className="space-y-2">
                          {commentsMap[it.id]!.map((c) => (
                            <li key={c.id} className="rounded-2xl bg-neutral-50 border border-neutral-200 px-3 py-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[13px] font-light font-[family-name:Times_New_Roman,Times,serif]">
                                  {c.profile?.full_name || "—"}
                                </span>
                                <span className="text-[10px] text-neutral-500">{new Date(c.created_at).toLocaleString()}</span>
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
                    <div className="mt-3 border-t border-neutral-200 pt-3">
                      <textarea
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        placeholder="Write a reply…"
                        className="w-full min-h-[80px] border border-neutral-300 rounded-2xl px-3 py-3 text-[15px] outline-none focus:ring-2 focus:ring-[#1F48AF]"
                        maxLength={280}
                      />
                      <div className="mt-2 flex items-center justify-between">
                        <span className={`text-xs ${replyBody.length > 280 ? "text-red-600" : "text-neutral-500"}`}>
                          {280 - replyBody.length}
                        </span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setReplyFor(null); setReplyBody(""); }} className="text-xs px-3 py-1.5 rounded-full bg-neutral-200 text-neutral-700">
                            Cancel
                          </button>
                          <button
                            onClick={sendReply}
                            disabled={!replyBody.trim().length || replyBody.length > 280}
                            className={`text-xs px-3 py-1.5 rounded-full ${
                              replyBody.trim().length && replyBody.length <= 280
                                ? "bg-[#1F48AF] text-white"
                                : "bg-neutral-300 text-neutral-600 cursor-not-allowed"
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
  )
}

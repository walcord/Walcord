// lib/supabase-social.ts
import type { SupabaseClient } from "@supabase/supabase-js";

/* ================== Tipos ================== */
export type Profile = {
  id: string;
  username: string;
  full_name?: string | null;
  avatar_url?: string | null;
  followers_count?: number;
  friends_count?: number;
  affinity?: number;
  is_following?: boolean;
  friend_status?: "pending" | "accepted" | null;
};

export type FriendRequestRow = {
  id: number;
  from_user: string;
  to_user: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  from_profile?: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
};

export type Recommendation = {
  id: string;
  record_id: string;
  record_title: string;
  cover_url?: string | null;
  rating?: number | null;
  note?: string | null;
  author: {
    username: string;
    full_name?: string | null;
    avatar_url?: string | null;
  };
};

/* ================== Recomendaciones ================== */
export async function fetchRecommendations(supabase: SupabaseClient): Promise<Recommendation[]> {
  const { data, error } = await supabase
    .from("recommendations")
    .select(`
      id, record_id, record_title, cover_url, rating, note,
      author:profiles!recommendations_author_id_fkey ( username, full_name, avatar_url )
    `)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) { console.warn("fetchRecommendations", error); return []; }
  return (data || []) as unknown as Recommendation[];
}

/* ================== Buscar perfiles ================== */
export async function searchProfiles(
  supabase: SupabaseClient,
  query: string,
  currentUserId: string | null
): Promise<Profile[]> {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
    .limit(10);

  if (error || !profiles?.length) return [];

  const ids = profiles.map((p) => p.id);

  // followers (vista)
  const { data: followCounts } = await supabase
    .from("profile_follow_counts")
    .select("profile_id, followers_count")
    .in("profile_id", ids);

  const followersMap = new Map<string, number>();
  followCounts?.forEach((r: any) => followersMap.set(r.profile_id, r.followers_count));

  // friends (vista)
  const { data: friendsView } = await supabase
    .from("profile_friends")
    .select("profile_id, friend_id")
    .in("profile_id", ids);

  const friendsCountMap = new Map<string, number>();
  friendsView?.forEach((r: any) => {
    friendsCountMap.set(r.profile_id, (friendsCountMap.get(r.profile_id) || 0) + 1);
  });

  let followingSet = new Set<string>();
  let friendStatusMap = new Map<string, "pending" | "accepted" | null>();

  if (currentUserId) {
    const { data: followingRows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", currentUserId)
      .in("following_id", ids);
    followingSet = new Set((followingRows || []).map((r: any) => r.following_id));

    // friendships aceptadas o pendientes
    const { data: frRows } = await supabase
      .from("friendships")
      .select("requester_id, receiver_id, status")
      .or(
        `and(requester_id.eq.${currentUserId},receiver_id.in.(${ids.join(
          ","
        )})),and(receiver_id.eq.${currentUserId},requester_id.in.(${ids.join(",")}))`
      );

    frRows?.forEach((r: any) => {
      const other = r.requester_id === currentUserId ? r.receiver_id : r.requester_id;
      friendStatusMap.set(other, r.status);
    });

    // requests pendientes (si no hay friendship)
    const { data: reqRows } = await supabase
      .from("friend_requests")
      .select("from_user, to_user, status")
      .or(
        `and(from_user.eq.${currentUserId},to_user.in.(${ids.join(
          ","
        )})),and(to_user.eq.${currentUserId},from_user.in.(${ids.join(",")}))`
      )
      .eq("status", "pending");

    reqRows?.forEach((r: any) => {
      const other = r.from_user === currentUserId ? r.to_user : r.from_user;
      if (!friendStatusMap.has(other)) friendStatusMap.set(other, "pending");
    });
  }

  return profiles.map((p: any) => ({
    id: p.id,
    username: p.username,
    full_name: p.full_name,
    avatar_url: p.avatar_url,
    followers_count: followersMap.get(p.id) || 0,
    friends_count: friendsCountMap.get(p.id) || 0,
    affinity: undefined,
    is_following: currentUserId ? followingSet.has(p.id) : false,
    friend_status: currentUserId ? friendStatusMap.get(p.id) || null : null,
  }));
}

/* ================== Follows ================== */
export async function followUser(
  supabase: SupabaseClient,
  followerId: string,
  followingId: string
): Promise<void> {
  if (followerId === followingId) return;
  const { error } = await supabase.from("follows").insert({
    follower_id: followerId,
    following_id: followingId,
  });
  if (error && !(`${error.message}`.toLowerCase().includes("duplicate"))) throw error;
}

/* ================== Friend requests (tabla friend_requests) ================== */
export async function sendFriendRequest(
  supabase: SupabaseClient,
  requesterId: string,
  receiverId: string
): Promise<void> {
  if (requesterId === receiverId) return;
  const { error } = await supabase
    .from("friend_requests")
    .upsert(
      { from_user: requesterId, to_user: receiverId, status: "pending", created_at: new Date().toISOString() },
      { onConflict: "from_user,to_user", ignoreDuplicates: false }
    );
  if (error && !(`${error.message}`.toLowerCase().includes("duplicate"))) throw error;
}

/**
 * Acepta una solicitud y garantiza la relación en ambas direcciones.
 * Inserta primero (requester = receptor actual) para evitar bloqueos por RLS.
 */
export async function acceptFriendRequest(
  supabase: SupabaseClient,
  requestId: number
): Promise<void> {
  // 1) Leer la request
  const { data: req, error: e1 } = await supabase
    .from("friend_requests")
    .select("id, from_user, to_user, status")
    .eq("id", requestId)
    .single();
  if (e1) throw e1;
  if (!req || req.status !== "pending") return;

  // 2) Marcar request como aceptada (primero, para estado consistente)
  const { error: eStatus } = await supabase
    .from("friend_requests")
    .update({ status: "accepted" })
    .eq("id", requestId);
  if (eStatus) throw eStatus;

  // 3) Crear friendships en ambas direcciones (evita RLS estrictas)
  // a) Inserto con el usuario receptor como requester (auth.uid() suele ser el receptor)
  const a = await supabase.from("friendships").upsert(
    {
      requester_id: req.to_user,
      receiver_id: req.from_user,
      status: "accepted",
      created_at: new Date().toISOString(),
    },
    { onConflict: "requester_id,receiver_id" }
  );

  // b) Inserto la dirección original (por si tu lógica o vistas la esperan así)
  const b = await supabase.from("friendships").upsert(
    {
      requester_id: req.from_user,
      receiver_id: req.to_user,
      status: "accepted",
      created_at: new Date().toISOString(),
    },
    { onConflict: "requester_id,receiver_id" }
  );

  // Si ambas fallan con error “real”, lo propagamos
  const aErr = (a as any)?.error;
  const bErr = (b as any)?.error;
  const ignored = (e: any) =>
    !e || `${e.message}`.toLowerCase().includes("duplicate") || `${e.message}`.toLowerCase().includes("permission");
  if (!ignored(aErr) && !ignored(bErr)) {
    throw aErr || bErr;
  }
}

export async function declineFriendRequest(
  supabase: SupabaseClient,
  requestId: number
): Promise<void> {
  const { error } = await supabase
    .from("friend_requests")
    .update({ status: "declined" })
    .eq("id", requestId);
  if (error) throw error;
}

/* ================== Listados / contadores ================== */
export async function countPendingRequests(
  supabase: SupabaseClient,
  myId: string
): Promise<number> {
  const { count } = await supabase
    .from("friend_requests")
    .select("id", { count: "exact", head: true })
    .eq("to_user", myId)
    .eq("status", "pending");
  return count ?? 0;
}

export async function listPendingRequests(
  supabase: SupabaseClient,
  myId: string
): Promise<FriendRequestRow[]> {
  const { data, error } = await supabase
    .from("friend_requests")
    .select(`
      id, from_user, to_user, status, created_at,
      from_profile:from_user ( id, username, full_name, avatar_url )
    `)
    .eq("to_user", myId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as FriendRequestRow[];
}

export async function listMyFriends(
  supabase: SupabaseClient,
  myId: string
): Promise<Array<{ id: string; username: string; full_name: string | null; avatar_url: string | null }>> {
  const { data, error } = await supabase
    .from("friendships")
    .select(`
      requester_id, receiver_id, status,
      requester:profiles!friendships_requester_id_fkey ( id, username, full_name, avatar_url ),
      receiver:profiles!friendships_receiver_id_fkey ( id, username, full_name, avatar_url )
    `)
    .or(`requester_id.eq.${myId},receiver_id.eq.${myId}`)
    .eq("status", "accepted");

  if (error) throw error;

  const out: any[] = [];
  (data || []).forEach((row: any) => {
    const other = row.requester_id === myId ? row.receiver : row.requester;
    if (other?.id) out.push(other);
  });
  const map = new Map(out.map((p) => [p.id, p]));
  return Array.from(map.values());
}

/* ================== Realtime helpers usados por Feed ================== */
export function subscribeRecommendations(
  supabase: SupabaseClient,
  cb: () => void
) {
  return supabase
    .channel("recs-feed")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "recommendations" },
      () => cb()
    )
    .subscribe();
}

export function subscribePendingForUser(
  supabase: SupabaseClient,
  userId: string,
  cb: () => void
) {
  return supabase
    .channel(`pending-${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "pending_items", filter: `to_user_id=eq.${userId}` },
      () => cb()
    )
    .subscribe();
}

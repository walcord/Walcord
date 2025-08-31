// lib/supabase-social.ts
// Lógica social unificada sobre la tabla `friendships`
// Estados esperados: 'pending' | 'accepted' | 'declined' (o delete para rechazar)

import type { SupabaseClient } from "@supabase/supabase-js";

/* =========================
   Tipos
   ========================= */
export type FriendRequestRow = {
  id: number;
  from_user: string; // requester_id
  to_user: string;   // receiver_id
  created_at: string;
  from_profile?: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
};

export type FriendRow = {
  id: string; // id del amigo (no el mío)
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  since: string; // created_at de la fila en friendships
};

/* =========================
   Friend Requests (PENDING)
   ========================= */

/** Lista solicitudes PENDIENTES dirigidas a `ownerProfileId`, leyendo de `friendships`. */
export async function listPendingRequests(
  supabase: SupabaseClient,
  ownerProfileId: string
): Promise<FriendRequestRow[]> {
  const { data: rows, error } = await supabase
    .from("friendships")
    .select("id, requester_id, receiver_id, created_at, status")
    .eq("receiver_id", ownerProfileId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const list =
    (rows || []).map((r: any) => ({
      id: r.id as number,
      from_user: r.requester_id as string,
      to_user: r.receiver_id as string,
      created_at: r.created_at as string,
    })) ?? [];

  if (list.length === 0) return [];

  const requesterIds = Array.from(new Set(list.map((r) => r.from_user)));
  const { data: profs, error: err2 } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .in("id", requesterIds);

  if (err2) throw err2;

  const profMap = new Map<string, any>();
  (profs || []).forEach((p: any) => profMap.set(p.id, p));

  return list.map((r) => ({
    ...r,
    from_profile: profMap.has(r.from_user)
      ? {
          id: profMap.get(r.from_user).id,
          username: profMap.get(r.from_user).username,
          full_name: profMap.get(r.from_user).full_name,
          avatar_url: profMap.get(r.from_user).avatar_url,
        }
      : undefined,
  }));
}

/** Devuelve el número de solicitudes PENDIENTES dirigidas a `ownerProfileId`. */
export async function countPendingRequests(
  supabase: SupabaseClient,
  ownerProfileId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("friendships")
    .select("*", { count: "exact", head: true })
    .eq("receiver_id", ownerProfileId)
    .eq("status", "pending");

  if (error) throw error;
  return count ?? 0;
}

/** Acepta la solicitud: status -> 'accepted' (busca por ID de la fila en friendships). */
export async function acceptFriendRequest(
  supabase: SupabaseClient,
  requestId: number
): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) throw error;
}

/** Rechaza la solicitud: elimina la fila pendiente (o márcala como declined si prefieres). */
export async function declineFriendRequest(
  supabase: SupabaseClient,
  requestId: number
): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) throw error;
}

/* =========================
   Friends (ACCEPTED)
   ========================= */

/**
 * Lista mis amigos (filas accepted en `friendships`) devolviendo
 * el perfil de "la otra persona" para cada relación.
 *
 * @param supabase
 * @param meId            uuid del usuario actual (auth.uid)
 * @param searchQuery     filtro opcional por username/full_name (ilike)
 * @param limit           límite (por defecto 50)
 * @param offset          desplazamiento para paginación (por defecto 0)
 */
export async function listMyFriends(
  supabase: SupabaseClient,
  meId: string,
  searchQuery?: string,
  limit: number = 50,
  offset: number = 0
): Promise<FriendRow[]> {
  // 1) Traemos las relaciones aceptadas donde soy requester o receiver
  const { data: rels, error } = await supabase
    .from("friendships")
    .select("id, requester_id, receiver_id, created_at, status")
    .eq("status", "accepted")
    .or(`requester_id.eq.${meId},receiver_id.eq.${meId}`)
    .order("created_at", { ascending: false });

  if (error) throw error;

  if (!rels || rels.length === 0) return [];

  // 2) Calculamos el "otro id" por cada fila
  const items = rels.map((r: any) => {
    const otherId = r.requester_id === meId ? r.receiver_id : r.requester_id;
    return { otherId, since: r.created_at as string };
  });

  // 3) Filtro por búsqueda (si hay) y paginación manual sobre perfiles
  const otherIds = Array.from(new Set(items.map((i) => i.otherId)));

  // Para poder filtrar por nombre/username con ilike en SQL, lo hacemos en la query:
  // si no hay searchQuery, pedimos directamente esos perfiles;
  // si hay, añadimos .or() con filtros ilike.
  const base = supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .in("id", otherIds);

  let profQuery = base as any;

  if (searchQuery && searchQuery.trim().length >= 1) {
    const q = searchQuery.trim();
    // NOTA: como ya hay un .in(id, ...), Supabase no permite encadenar .or()
    // con columnas de la misma tabla fácilmente, así que traemos todos y filtramos en memoria.
    const { data: profsRaw, error: errProfiles } = await (base as any);
    if (errProfiles) throw errProfiles;

    const lc = q.toLowerCase();
    const profs = (profsRaw || []).filter((p: any) => {
      const u = (p.username || "").toLowerCase();
      const f = (p.full_name || "").toLowerCase();
      return u.includes(lc) || f.includes(lc);
    });

    // 4) Join con created_at + paginación
    const sinceMap = new Map<string, string>();
    items.forEach((i) => sinceMap.set(i.otherId, i.since));

    const joined: FriendRow[] = profs.map((p: any) => ({
      id: p.id,
      username: p.username,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      since: sinceMap.get(p.id) || "",
    }));

    return joined.slice(offset, offset + limit);
  }

  // Sin search: pedimos perfiles y luego paginamos
  const { data: profs, error: err2 } = await profQuery;
  if (err2) throw err2;

  const sinceMap = new Map<string, string>();
  items.forEach((i) => sinceMap.set(i.otherId, i.since));

  // Ordenamos por fecha (ya venía ordenado por created_at en friendships)
  const ordered = items
    .map((i) => i.otherId)
    .filter((id) => profs?.some((p: any) => p.id === id));

  const byId = new Map<string, any>();
  (profs || []).forEach((p: any) => byId.set(p.id, p));

  const out: FriendRow[] = ordered.map((oid) => {
    const p = byId.get(oid);
    return {
      id: p.id,
      username: p.username,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      since: sinceMap.get(oid) || "",
    };
  });

  return out.slice(offset, offset + limit);
}

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export async function sendFriendRequest(receiver_id: string) {
  const supabase = createClientComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase.from("friendships").insert({
    requester_id: user.id,
    receiver_id,
    status: "pending"
  });
  if (error && !error.message?.toLowerCase().includes("duplicate")) throw error;
  return true;
}

export async function acceptFriendRequest(requestId: string) {
  const supabase = createClientComponentClient();
  const { error } = await supabase.from("friendships")
    .update({ status: "accepted" }).eq("id", requestId);
  if (error) throw error;
}

export async function declineFriendRequest(requestId: string) {
  const supabase = createClientComponentClient();
  const { error } = await supabase.from("friendships")
    .update({ status: "declined" }).eq("id", requestId);
  if (error) throw error;
}

export async function getPendingRequests() {
  const supabase = createClientComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from("friendships")
    .select("id, requester:requester_id ( id, username, full_name, avatar_url )")
    .eq("receiver_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

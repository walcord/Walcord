import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export async function followUser(following_id: string) {
  const supabase = createClientComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase.from("follows").insert({
    follower_id: user.id,
    following_id
  });
  if (error && !error.message?.toLowerCase().includes("duplicate")) throw error;
  return true;
}

export async function unfollowUser(following_id: string) {
  const supabase = createClientComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", following_id);
  if (error) throw error;
  return true;
}

export async function isFollowing(profileId: string) {
  const supabase = createClientComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", profileId)
    .maybeSingle();
  return Boolean(data);
}

export async function getFollowerCounts(profileId: string) {
  const supabase = createClientComponentClient();
  const { data, error } = await supabase
    .from("profile_follow_counts")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

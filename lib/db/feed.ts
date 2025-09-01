// lib/db/feed.ts
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export async function fetchSecurePosts() {
  const supabase = createClientComponentClient();
  // Trae SOLO tus posts, los de seguidos y amistades aceptadas (RLS + vista segura)
  const { data, error } = await supabase
    .from("v_posts_feed_secure")
    .select("*");
  if (error) throw error;
  return data ?? [];
}

export async function fetchSecureConcerts() {
  const supabase = createClientComponentClient();
  const { data, error } = await supabase
    .from("v_concerts_feed_secure")
    .select("*");
  if (error) throw error;
  return data ?? [];
}

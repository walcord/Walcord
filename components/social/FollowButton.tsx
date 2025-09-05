'use client';
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";

export default function FollowButton({ profileId }: { profileId: string }) {
  const supabase = useSupabaseClient();
  const user = useUser();

  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!user?.id) return; // si no hay sesión, dejamos el botón en estado inicial
        const { data } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id)
          .eq("following_id", profileId)
          .maybeSingle();
        if (mounted) setFollowing(!!data);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [profileId, supabase, user?.id]);

  const onClick = async () => {
    if (!user?.id) {
      alert("Please log in to follow users.");
      return;
    }
    setLoading(true);
    try {
      if (following) {
        await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", profileId);
      } else {
        await supabase.from("follows").insert({
          follower_id: user.id,
          following_id: profileId,
          created_at: new Date().toISOString(),
        });
      }
      setFollowing(!following);
    } catch (err) {
      console.error("follow/unfollow error:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={loading}
      className={`px-4 h-8 rounded-full text-sm border transition 
        ${following ? "bg-[#1F48AF] text-white border-[#1F48AF]" : "bg-white text-[#1F48AF] border-[#1F48AF]"}
        disabled:opacity-50`}
      aria-label={following ? "Unfollow" : "Follow"}
    >
      {following ? "Following" : "Follow"}
    </motion.button>
  );
}

'use client';
import { useEffect, useState } from "react";
import { isFollowing, followUser, unfollowUser } from "../../lib/db/follow";
import { motion } from "framer-motion";

export default function FollowButton({ profileId }: { profileId: string }) {
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    let mounted = true;
    isFollowing(profileId).then(v => { if (mounted) { setFollowing(v); setLoading(false); }});
    return () => { mounted = false; };
  }, [profileId]);

  const onClick = async () => {
    setLoading(true);
    try {
      if (following) await unfollowUser(profileId);
      else await followUser(profileId);
      setFollowing(!following);
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

'use client';
import { useState } from "react";
import { motion } from "framer-motion";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";

export default function AddFriendButton({ profileId }: { profileId: string }) {
  const supabase = useSupabaseClient();
  const user = useUser();

  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    if (!user?.id) {
      alert("Please log in to add friends.");
      return;
    }
    setLoading(true);
    try {
      await supabase.from("friendships").insert({
        requester_id: user.id,
        receiver_id: profileId,
        status: "pending",
        created_at: new Date().toISOString(),
      });
      setSent(true);
    } catch (err) {
      console.error("sendFriendRequest error:", err);
      alert("Could not send the request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={loading || sent}
      className={`px-4 h-8 rounded-full text-sm transition border 
      ${sent ? "bg-gray-100 text-gray-500 border-gray-200" : "bg-[#1F48AF] text-white border-[#1F48AF]"}
      disabled:opacity-60`}
      aria-label="Add friend"
    >
      {sent ? "Requested" : "Add Friend"}
    </motion.button>
  );
}

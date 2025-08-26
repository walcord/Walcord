'use client';
import { useState } from "react";
import { sendFriendRequest } from "../../lib/db/friendship";
import { motion } from "framer-motion";

export default function AddFriendButton({ profileId }: { profileId: string }) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      await sendFriendRequest(profileId);
      setSent(true);
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

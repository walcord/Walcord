"use client";
import { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Props = { targetUserId: string; compact?: boolean };

export default function BlockUserButton({ targetUserId, compact }: Props) {
  const supabase = createClientComponentClient();
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  async function toggleBlock() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return alert("Please sign in to block users.");

      if (blocked) {
        await supabase.from("blocked_users")
          .delete()
          .eq("blocker_id", user.id)
          .eq("blocked_id", targetUserId);
        setBlocked(false);
      } else {
        await supabase.from("blocked_users").insert({
          blocker_id: user.id,
          blocked_id: targetUserId
        });
        setBlocked(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggleBlock}
      disabled={loading}
      style={{
        padding: compact ? "2px 8px" : "6px 12px",
        fontSize: compact ? 12 : 14,
        borderRadius: 10,
        border: "1px solid #999",
        background: blocked ? "#eee" : "white",
        color: "#333",
        marginLeft: 8
      }}
      aria-label={blocked ? "Unblock user" : "Block user"}
    >
      {loading ? "…" : blocked ? "Unblock" : "Block"}
    </button>
  );
}

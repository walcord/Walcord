"use client";
import { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Props = { postId: string; compact?: boolean };

export default function ReportButton({ postId, compact }: Props) {
  const supabase = createClientComponentClient();
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function onReport() {
    try {
      setSending(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return alert("Please sign in to report.");
      await supabase.from("reports").insert({
        user_id: user.id,
        post_id: postId,
        reason: "inappropriate",
      });
      setDone(true);
      alert("Thanks. We’ll review this within 24 hours.");
    } catch (e) {
      alert("Could not send report. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (done) return <span style={{opacity:.6}}>Reported</span>;
  return (
    <button
      onClick={onReport}
      disabled={sending}
      style={{
        padding: compact ? "2px 8px" : "6px 12px",
        fontSize: compact ? 12 : 14,
        borderRadius: 10,
        border: "1px solid #1F48AF",
        background: "white",
        color: "#1F48AF"
      }}
      aria-label="Report content"
    >
      {sending ? "Sending…" : "Report"}
    </button>
  );
}

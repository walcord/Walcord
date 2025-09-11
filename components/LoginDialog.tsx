"use client";

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Props = {
  open: boolean;
  onClose: () => void;
  trigger?: { reason?: "like" | "rate" | "favorite" | "comment" | "follow" | "generic"; message?: string };
};

export default function LoginDialog({ open, onClose, trigger }: Props) {
  if (!open) return null;

  const [email, setEmail] = useState("");

  const titleMap: Record<string, string> = {
    like: "Sign in to like",
    rate: "Sign in to rate",
    favorite: "Sign in to favorite",
    comment: "Sign in to comment",
    follow: "Sign in to follow",
    generic: "Sign in to continue",
  };

  const title = titleMap[trigger?.reason ?? "generic"];

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-2xl font-serif">{title}</h2>
        <p className="mt-1 text-sm text-neutral-600">
          {trigger?.message ?? "Create an account or sign in to interact with Walcord."}
        </p>

        <form onSubmit={handleMagicLink} className="mt-4 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none"
            required
          />
          <button type="submit" className="w-full rounded-xl bg-[#1F48AF] px-4 py-2 font-medium text-white">
            Send magic link
          </button>
        </form>

        <button onClick={onClose} className="mt-4 w-full text-center text-sm text-neutral-500 underline">
          Continue browsing
        </button>
      </div>
    </div>
  );
}

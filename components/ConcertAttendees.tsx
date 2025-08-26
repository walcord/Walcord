"use client";

import { useEffect, useState } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";

type Att = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export default function ConcertAttendees({ concertId }: { concertId: string }) {
  const supabase = useSupabaseClient();
  const [list, setList] = useState<Att[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("concerts_atendees")
        .select("user_id, profiles ( full_name, username, avatar_url )")
        .eq("concert_id", concertId);

      if (error) return;
      const built: Att[] =
        data?.map((row: any) => ({
          user_id: row.user_id,
          full_name: row.profiles?.full_name ?? null,
          username: row.profiles?.username ?? null,
          avatar_url: row.profiles?.avatar_url ?? null,
        })) ?? [];

      if (mounted) setList(built);
    })();
    return () => {
      mounted = false;
    };
  }, [supabase, concertId]);

  return (
    <>
      <button
        type="button"
        className="flex items-center gap-2 rounded-full border px-4 py-2 text-[#1F48AF] border-neutral-200 hover:bg-neutral-50"
        onClick={() => setOpen(true)}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          className="text-[#1F48AF]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span>Attendees ({list.length})</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">Also present</h3>
              <button
                className="rounded-full px-3 py-1 border"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <ul className="max-h-[60vh] overflow-auto divide-y">
              {list.map((p) => (
                <li key={p.user_id} className="flex items-center gap-3 py-3">
                  <div className="h-9 w-9 rounded-full overflow-hidden bg-neutral-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.avatar_url || "/avatar.png"}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {p.full_name || p.username || "—"}
                    </div>
                    {p.username && (
                      <div className="text-xs text-neutral-500">@{p.username}</div>
                    )}
                  </div>
                </li>
              ))}
              {list.length === 0 && (
                <li className="py-6 text-center text-sm text-neutral-500">
                  Nobody has checked in yet.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

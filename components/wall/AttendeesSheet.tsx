"use client";

import { useEffect, useState } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";

type Profile = { id: string; full_name: string | null; avatar_url: string | null };

export default function AttendeesSheet({ concertId }: { concertId: string }) {
  const supabase = useSupabaseClient();
  const [people, setPeople] = useState<Profile[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: rows } = await supabase
        .from("concerts_atendees")
        .select("user_id")
        .eq("concert_id", concertId);
      const ids = (rows || []).map((r: any) => r.user_id);
      if (ids.length === 0) return;
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", ids)
        .order("full_name", { ascending: true });
      if (mounted && profs) setPeople(profs as Profile[]);
    })();
    return () => {
      mounted = false;
    };
  }, [concertId, supabase]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {people.map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-3 border border-neutral-200 rounded-xl p-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.avatar_url || "/avatar.png"}
            alt=""
            className="h-9 w-9 rounded-full object-cover bg-neutral-200"
          />
          <div className="text-sm">{p.full_name || "—"}</div>
        </div>
      ))}
    </div>
  );
}

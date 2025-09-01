"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import Link from "next/link";

type RibbonItem = {
  concert_id: string;
  artist_id: string | null;
  artist_name: string | null;
  tour: string | null;
  city: string | null;
  country: string | null;
  year: number | null;
  username: string | null;
  full_name: string | null;
  created_at: string;
};

export default function NowTouringRibbon() {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [items, setItems] = useState<RibbonItem[]>([]);
  const visibleIdsRef = useRef<string[] | null>(null);

  /** Tú + seguidos + amistades aceptadas (ambos sentidos). */
  const getVisibleUserIds = async (): Promise<string[]> => {
    if (!user?.id) return [];
    if (visibleIdsRef.current) return visibleIdsRef.current;

    const [followsRes, frA, frB] = await Promise.all([
      supabase.from("follows").select("following_id").eq("follower_id", user.id),
      supabase
        .from("friendships")
        .select("receiver_id")
        .eq("requester_id", user.id)
        .eq("status", "accepted"),
      supabase
        .from("friendships")
        .select("requester_id")
        .eq("receiver_id", user.id)
        .eq("status", "accepted"),
    ]);

    const ids = new Set<string>([user.id]);
    (followsRes.data || []).forEach((r: any) => ids.add(r.following_id));
    (frA.data || []).forEach((r: any) => ids.add(r.receiver_id));
    (frB.data || []).forEach((r: any) => ids.add(r.requester_id));

    visibleIdsRef.current = Array.from(ids);
    return visibleIdsRef.current;
  };

  useEffect(() => {
    let mounted = true;
    visibleIdsRef.current = null; // reset si cambia el usuario

    (async () => {
      const ids = await getVisibleUserIds();
      if (ids.length === 0) {
        if (mounted) setItems([]);
        return;
      }

      // ✅ Solo fotos de tus seguidos/amigos/tú
      const { data: ph, error } = await supabase
        .from("concert_photos")
        .select("id, user_id, concert_id, created_at")
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .limit(24);

      if (error || !ph?.length) {
        if (mounted) setItems([]);
        return;
      }

      const concertIds = [...new Set(ph.map((x) => x.concert_id))];
      const userIds = [...new Set(ph.map((x) => x.user_id))];

      const [{ data: concerts }, { data: users }] = await Promise.all([
        supabase
          .from("concerts")
          .select("id, artist_name, tour, city, country, year")
          .in("id", concertIds),
        supabase
          .from("profiles")
          .select("id, username, full_name")
          .in("id", userIds),
      ]);

      const artistNames = [
        ...new Set(
          (concerts ?? []).map((c: any) => c.artist_name).filter(Boolean)
        ),
      ] as string[];
      const { data: artists } = artistNames.length
        ? await supabase
            .from("artists")
            .select("id, name")
            .in("name", artistNames)
        : { data: [] as any[] };

      const idByName = Object.fromEntries(
        (artists ?? []).map((a: any) => [a.name, a.id])
      );
      const cById = Object.fromEntries(
        (concerts ?? []).map((c: any) => [c.id, c])
      );
      const uById = Object.fromEntries(
        (users ?? []).map((u: any) => [u.id, u])
      );

      // 1 item por concierto (evita duplicados)
      const seen = new Set<string>();
      const built: RibbonItem[] = [];
      for (const p of ph) {
        if (seen.has(p.concert_id)) continue;
        seen.add(p.concert_id);

        const c = cById[p.concert_id] || {};
        const u = uById[p.user_id] || {};
        built.push({
          concert_id: p.concert_id,
          artist_id: idByName[c.artist_name] ?? null,
          artist_name: c.artist_name ?? null,
          tour: c.tour ?? null,
          city: c.city ?? null,
          country: c.country ?? null,
          year: c.year ?? null,
          username: u.username ?? null,
          full_name: u.full_name ?? null,
          created_at: p.created_at,
        });
      }

      if (mounted) setItems(built);
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, supabase]);

  const stream = useMemo(() => {
    return items.map((it) => {
      const who = it.full_name || it.username || "—";
      const place =
        it.city && it.country
          ? `${it.city}, ${it.country}`
          : it.city || it.country || "";
      const when = it.year ? ` (${it.year})` : "";
      const artist = it.artist_name || "—";
      const tour = it.tour ? ` — ${it.tour}` : "";
      // Enlace al perfil real del artista por ID
      const href = it.artist_id ? `/artist/${it.artist_id}` : "#";
      const text = `${who} went to ${artist}${tour}${
        place ? ` in ${place}` : ""
      }${when}`;
      return { text, href };
    });
  }, [items]);

  if (stream.length === 0) {
    return (
      <div className="w-full overflow-hidden rounded-2xl border border-neutral-200">
        <div className="px-4 py-3 text-sm text-neutral-600">
          Your friends’ concerts will appear here soon.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-neutral-200 overflow-hidden">
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent" />
        <div className="w-full overflow-hidden">
          <div className="flex gap-8 animate-[ticker_40s_linear_infinite] whitespace-nowrap px-4 py-3 text-sm">
            {stream.concat(stream).map((row, i) => (
              <Link
                key={i}
                href={row.href}
                className="text-black hover:text-[#1F48AF] transition"
              >
                {row.text}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes ticker {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}

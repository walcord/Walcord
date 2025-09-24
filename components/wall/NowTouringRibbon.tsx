'use client';

import { useEffect, useMemo, useState } from "react";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import Link from "next/link";

type RibbonItem = {
  concert_id: string;
  artist_name: string | null;
  tour: string | null;
  city: string | null;
  country: string | null;
  year: number | null;
  username: string | null;
  full_name: string | null;
};

export default function NowTouringRibbon() {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [items, setItems] = useState<RibbonItem[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  /** === MISMA FUNCIÓN QUE USA EL FEED (yo + seguidos + amistades aceptadas) === */
  const getAllowedUserIds = async (): Promise<string[]> => {
    if (!user?.id) return [];
    const [fo, frA, frB] = await Promise.all([
      supabase.from("follows").select("following_id").eq("follower_id", user.id),
      supabase.from("friendships").select("receiver_id").eq("requester_id", user.id).eq("status", "accepted"),
      supabase.from("friendships").select("requester_id").eq("receiver_id", user.id).eq("status", "accepted"),
    ]);
    const ids = new Set<string>([user.id]);
    (fo.data || []).forEach((r: any) => ids.add(r.following_id));
    (frA.data || []).forEach((r: any) => ids.add(r.receiver_id));
    (frB.data || []).forEach((r: any) => ids.add(r.requester_id));
    return Array.from(ids);
  };

  useEffect(() => {
    (async () => {
      // 👉 Espera a tener sesión para no “congelar” en 0 ids
      if (!user?.id) return;
      setLoading(true);

      const allowed = await getAllowedUserIds();
      setVisibleCount(allowed.length); // 👈 lo verás pintado debajo para verificar

      if (allowed.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      // Posts de tus seguidos (no depende de fotos)
      const { data: concerts, error } = await supabase
        .from("concerts")
        .select("id,user_id,artist_id,city,country,country_code,year,event_date,tour_name,created_at,post_type,experience")
        .in("user_id", allowed)
        .order("event_date", { ascending: false }) // cambia a created_at si prefieres “publicado más reciente”
        .limit(60);

      if (error || !concerts?.length) {
        setItems([]);
        setLoading(false);
        return;
      }

      const userIds = [...new Set(concerts.map((c: any) => c.user_id))];
      const artistIds = [...new Set(concerts.map((c: any) => c.artist_id).filter(Boolean))] as string[];

      const [{ data: profiles }, { data: artists }] = await Promise.all([
        supabase.from("profiles").select("id,username,full_name").in("id", userIds),
        artistIds.length ? supabase.from("artists").select("id,name").in("id", artistIds) : Promise.resolve({ data: [] as any[] }),
      ]);

      const uById = Object.fromEntries((profiles || []).map((u: any) => [u.id, u]));
      const aById = Object.fromEntries((artists || []).map((a: any) => [a.id, a.name]));

      const built: RibbonItem[] = concerts.map((c: any) => {
        const u = uById[c.user_id] || {};
        const country = c.country ?? c.country_code ?? null;
        const year = typeof c.year === "number" && c.year ? c.year : (c.event_date ? new Date(c.event_date).getFullYear() : null);
        const artistName =
          c.post_type === "experience" && c.experience
            ? `${String(c.experience).charAt(0).toUpperCase()}${String(c.experience).slice(1)}`
            : (aById[c.artist_id] ?? null);

        return {
          concert_id: c.id,
          artist_name: artistName || "Concert",
          tour: c.tour_name ?? null,
          city: c.city ?? null,
          country,
          year,
          username: u.username ?? null,
          full_name: u.full_name ?? null,
        };
      });

      setItems(built);
      setLoading(false);
    })();
  }, [user?.id, supabase]);

  const stream = useMemo(() => {
    return items.map((it) => {
      const who = it.full_name || it.username || "—";
      const place = it.city && it.country ? `${it.city}, ${it.country}` : it.city || it.country || "";
      const when = it.year ? ` (${it.year})` : "";
      const tour = it.tour ? ` — ${it.tour}` : "";
      return { text: `${who} went to ${it.artist_name}${tour}${place ? ` in ${place}` : ""}${when}`, href: `/post/${it.concert_id}` };
    });
  }, [items]);

  // Muestra contador de ids visibles para depurar (quítalo luego)
  const Debug = () => (
    <div className="px-4 pt-1 pb-0 text-[11px] text-neutral-500">
      visible users: <span className="font-mono">{visibleCount}</span>
    </div>
  );

  if (loading || stream.length === 0) {
    return (
      <div className="w-full overflow-hidden rounded-2xl border border-neutral-200">
        <Debug />
        <div className="px-4 py-3 text-sm text-neutral-600">
          Your friends’ concerts will appear here soon.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-neutral-200 overflow-hidden">
      <Debug />
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent" />
        <div className="flex gap-8 animate-[ticker_40s_linear_infinite] whitespace-nowrap px-4 py-3 text-sm">
          {stream.concat(stream).map((row, i) => (
            <Link key={i} href={row.href} className="text-black hover:text-[#1F48AF] transition">
              {row.text}
            </Link>
          ))}
        </div>
      </div>
      <style jsx>{`
        @keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      `}</style>
    </div>
  );
}

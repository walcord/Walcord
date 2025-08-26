import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type RecordCard = { id: string; title: string; cover_url: string | null; vibe_color: string | null };
type ArtistCard = { id: string; name: string; image_url: string | null };
type ConcertCard = { id: string; artist: string; tour: string | null; city: string | null; year: number | null; event_date?: string };
type TrackCard = { id: string; title: string; record_id: string; cover_url: string | null };

export default function PublicSections({ viewedUserId }: { viewedUserId: string }) {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [records, setRecords] = useState<RecordCard[]>([]);
  const [artists, setArtists] = useState<ArtistCard[]>([]);
  const [concerts, setConcerts] = useState<ConcertCard[]>([]);
  const [tracks, setTracks] = useState<TrackCard[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Records
      const { data: recs } = await supabase
        .from("favourite_records_view")
        .select("*")
        .eq("user_id", viewedUserId)
        .order("id", { ascending: false })
        .limit(16);

      // Artists
      const { data: arts } = await supabase
        .from("favourite_artists_view")
        .select("*")
        .eq("user_id", viewedUserId)
        .order("id", { ascending: false })
        .limit(16);

      // Concerts
      const { data: cons } = await supabase
        .from("concerts_atendees_view")
        .select("*")
        .eq("user_id", viewedUserId)
        .order("event_date", { ascending: false })
        .limit(16);

      // Tracks
      const { data: trs } = await supabase
        .from("favourite_tracks_view")
        .select("*")
        .eq("user_id", viewedUserId)
        .order("id", { ascending: false })
        .limit(16);

      if (alive) {
        setRecords((recs as any) ?? []);
        setArtists((arts as any) ?? []);
        setConcerts((cons as any) ?? []);
        setTracks((trs as any) ?? []);
      }
    })();

    return () => { alive = false; };
  }, [supabase, viewedUserId]);

  return (
    <div className="pb-24">
      <Section title="Favourite Records">
        <CardGrid>
          {records.map((r) => (
            <Link key={r.id} href={`/record/${r.id}`} className="group block">
              <div className="aspect-square rounded-2xl overflow-hidden bg-neutral-200 ring-1 ring-black/5">
                {r.cover_url ? <Image src={r.cover_url} alt={r.title} width={600} height={600} className="h-full w-full object-cover" /> : null}
              </div>
              <p className="mt-2 text-sm text-neutral-800 group-hover:underline">{r.title}</p>
            </Link>
          ))}
        </CardGrid>
      </Section>

      <Section title="Favourite Artists">
        <CardGrid>
          {artists.map((a) => (
            <div key={a.id} className="group">
              <div className="aspect-square rounded-full overflow-hidden bg-neutral-200 ring-1 ring-black/5">
                {a.image_url ? <Image src={a.image_url} alt={a.name} width={600} height={600} className="h-full w-full object-cover" /> : null}
              </div>
              <p className="mt-2 text-sm text-neutral-800">{a.name}</p>
            </div>
          ))}
        </CardGrid>
      </Section>

      <Section title="Concerts">
        <ul className="divide-y divide-black/10 rounded-2xl ring-1 ring-black/5 bg-white">
          {concerts.map((c) => (
            <li key={c.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{c.artist}</p>
                <p className="text-sm text-neutral-500">{[c.tour, c.city, c.year].filter(Boolean).join(" · ")}</p>
              </div>
              <span className="text-xs text-neutral-500">view</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Favourite Songs">
        <CardGrid>
          {tracks.map((t) => (
            <div key={t.id} className="group">
              <div className="aspect-square rounded-2xl overflow-hidden bg-neutral-200 ring-1 ring-black/5">
                {t.cover_url ? <Image src={t.cover_url} alt={t.title} width={600} height={600} className="h-full w-full object-cover" /> : null}
              </div>
              <p className="mt-2 text-sm text-neutral-800">{t.title}</p>
            </div>
          ))}
        </CardGrid>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-xl tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">{children}</div>;
}

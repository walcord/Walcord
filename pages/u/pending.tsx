"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";

/* ============================================================
   Walcord — Pending (alineado con "The Wall")
   Tipos: Times New Roman (titulares) + Roboto Light 300 (meta)
   Gutter/anchos: max-w-6xl + px-4 sm:px-6 (idéntico al Wall)
   Buscador: h-12, borde 1px, radio completo (look Wall)
   Tarjetas: compactas, ritmo editorial y botones discretos
   ============================================================ */

type PendingItem = {
  id: string;
  type: "artist" | "record";
  // Artist
  artist_id?: string | null;
  artist_name?: string | null;
  artist_vibe_color?: string | null;
  artist_cover_color?: string | null;
  // Record
  record_id?: string | null;
  record_title?: string | null;
  record_artist_name?: string | null;
  record_year?: number | null;
  record_vibe_color?: string | null;
  record_cover_color?: string | null;
};

type RecordHit = {
  id: string;
  title: string;
  year?: number | null;
  artist_name?: string | null;
  vibe_color?: string | null;
  cover_color?: string | null;
};

function fold(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function PendingPage() {
  const supabase = useSupabaseClient();
  const user = useUser();

  const [pending, setPending] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search (records only)
  const [q, setQ] = useState("");
  const debouncedQ = useMemo(() => q.trim(), [q]);
  const foldedQ = useMemo(() => fold(debouncedQ), [debouncedQ]);
  const [recordHits, setRecordHits] = useState<RecordHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  // Load pending items
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("v_pending_items_expanded")
        .select("*")
        .eq("user_id", user.id);
      if (data) setPending(data as PendingItem[]);
      setLoading(false);
    })();
  }, [user, supabase]);

  // Search records (robusto + sin acentos)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!debouncedQ) {
        setRecordHits([]);
        return;
      }
      const first3 = debouncedQ.slice(0, 3);

      const r1 = supabase
        .from("records")
        .select("id,title,release_year,artist_name,vibe_color,cover_color")
        .or(`title.ilike.%${debouncedQ}%,artist_name.ilike.%${debouncedQ}%`)
        .limit(24);

      const r2 = supabase
        .from("records")
        .select("id,title,release_year,artist_name,vibe_color,cover_color")
        .or(`title.ilike.%${first3}%,artist_name.ilike.%${first3}%`)
        .limit(24);

      const [a, b] = await Promise.all([r1, r2]);
      if (cancelled) return;

      const merged = [...(a.data || []), ...(b.data || [])];
      const filtered = merged
        .filter(
          (r: any) =>
            fold(r.title).includes(foldedQ) ||
            fold(r.artist_name || "").includes(foldedQ)
        )
        .reduce<RecordHit[]>((acc, r: any) => {
          if (!acc.find((x) => x.id === r.id))
            acc.push({
              id: r.id,
              title: r.title,
              year: r.release_year ?? null,
              artist_name: r.artist_name ?? null,
              vibe_color: r.vibe_color ?? null,
              cover_color: r.cover_color ?? null,
            });
          return acc;
        }, [])
        .slice(0, 8);

      setRecordHits(filtered);
    };
    const t = setTimeout(run, 200);
    return () => {
      clearTimeout(t);
      cancelled = true;
    };
  }, [debouncedQ, foldedQ, supabase]);

  // Remove from pending
  const removeItem = async (id: string) => {
    await supabase.from("pending_items").delete().eq("id", id);
    setPending((prev) => prev.filter((p) => p.id !== id));
  };

  const artistItems = pending.filter((p) => p.type === "artist");
  const recordItems = pending.filter((p) => p.type === "record");

  /* ---------------------------- Helpers UI ---------------------------- */

  const SectionRule = ({ title }: { title: string }) => (
    <div className="flex items-center gap-3 mb-4">
      <h2
        className="text-[16px]"
        style={{ fontFamily: '"Times New Roman", Times, serif' }}
      >
        {title}
      </h2>
      <div className="h-px flex-1 bg-neutral-200" />
    </div>
  );

  const ArtistCard = ({ a }: { a: PendingItem }) => (
    <li className="rounded-[14px] overflow-hidden border border-neutral-200 shadow-sm hover:shadow-md transition">
      <Link href={`/artist/${a.artist_id}`}>
        {/* Cabecera compacta */}
        <div
          className="h-24 flex items-center justify-center"
          style={{ backgroundColor: a.artist_vibe_color || "#4b2a65" }}
        >
          <div
            className="w-10 h-10 rounded-full"
            style={{ backgroundColor: a.artist_cover_color || "#b09bbd" }}
          />
        </div>
        <div className="px-3 pt-2 pb-3 text-center">
          <div
            className="text-[14px] leading-tight"
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
          >
            {a.artist_name}
          </div>
        </div>
      </Link>
      <div className="px-3 pb-3">
        <button
          onClick={() => removeItem(a.id)}
          className="w-full rounded-full px-3 py-1.5 text-[11px] bg-[#1F48AF] text-white"
          style={{ fontFamily: "Roboto, sans-serif", fontWeight: 300 }}
        >
          Listened
        </button>
      </div>
    </li>
  );

  const RecordCard = ({ r }: { r: PendingItem }) => (
    <li className="text-center">
      <Link href={`/record/${r.record_id}`}>
        <div
          className="w-28 h-28 sm:w-32 sm:h-32 mx-auto rounded-lg shadow-sm flex items-center justify-center"
          style={{ backgroundColor: r.record_vibe_color || "#e5e5e5" }}
        >
          <div
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-[6px]"
            style={{ backgroundColor: r.record_cover_color || "#bdbdbd" }}
          />
        </div>
        <div
          className="mt-2 text-[14px] leading-tight"
          style={{ fontFamily: '"Times New Roman", Times, serif' }}
        >
          {r.record_title}
        </div>
        <div
          className="text-[12px] text-neutral-600"
          style={{ fontFamily: "Roboto, sans-serif", fontWeight: 300 }}
        >
          {r.record_artist_name}
        </div>
        <div
          className="text-[12px] text-neutral-400"
          style={{ fontFamily: "Roboto, sans-serif", fontWeight: 300 }}
        >
          {r.record_year ?? ""}
        </div>
      </Link>
      <div className="mt-2">
        <button
          onClick={() => removeItem(r.id)}
          className="rounded-full px-4 py-1.5 text-[11px] bg-[#1F48AF] text-white"
          style={{ fontFamily: "Roboto, sans-serif", fontWeight: 300 }}
        >
          Remove
        </button>
      </div>
    </li>
  );

  /* ------------------------------ Render ------------------------------ */

  return (
    <main className="min-h-screen bg-white text-black">
      {/* Banner exactamente como en The Wall */}
      <header className="w-full h-20 bg-[#1F48AF] flex items-center px-4 sm:px-6">
        <Image src="/logotipo.png" alt="Walcord" width={56} height={56} priority />
      </header>

      {/* Contenido con el mismo ritmo que The Wall */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-20">
        {/* H1 y subtítulo (misma jerarquía) */}
        <div className="mb-6">
          <h1
            className="text-[40px] sm:text-[44px] leading-none"
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
          >
            Pending
          </h1>
          <p
            className="mt-2 text-[12px] text-neutral-500"
            style={{ fontFamily: "Roboto, sans-serif", fontWeight: 300 }}
          >
            Save now, listen later. Keep your discoveries.
          </p>
        </div>

        {/* Buscador a la altura del del Wall */}
        <div className="relative mb-10">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search records…"
            className="w-full h-12 rounded-full border border-neutral-200 px-5 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#1F48AF]"
            style={{ fontFamily: "Roboto, sans-serif", fontWeight: 300 }}
            aria-label="Search records"
          />
          {searchOpen && recordHits.length > 0 && (
            <div
              className="absolute z-20 mt-2 w-full rounded-2xl border border-neutral-200 bg-white shadow-xl"
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="p-4">
                <div
                  className="mb-3 text-[10px] uppercase tracking-wide text-neutral-500"
                  style={{ fontFamily: "Roboto, sans-serif", fontWeight: 300 }}
                >
                  Records
                </div>
                <ul className="grid sm:grid-cols-2 gap-2.5">
                  {recordHits.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/record/${r.id}`}
                        className="flex items-center gap-3 hover:bg-neutral-50 rounded-xl p-2"
                        onClick={() => setSearchOpen(false)}
                      >
                        {/* Mini disco (cuadrado dentro de cuadrado) */}
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center shadow-sm"
                          style={{ backgroundColor: r.vibe_color || "#e5e5e5" }}
                        >
                          <div
                            className="w-3.5 h-3.5 rounded-[3px]"
                            style={{ backgroundColor: r.cover_color || "#bdbdbd" }}
                          />
                        </div>
                        <div className="min-w-0">
                          <div
                            className="truncate text-[13px] leading-tight"
                            style={{ fontFamily: '"Times New Roman", Times, serif' }}
                          >
                            {r.title}
                          </div>
                          <div
                            className="truncate text-[11px] text-neutral-500"
                            style={{ fontFamily: "Roboto, sans-serif", fontWeight: 300 }}
                          >
                            {r.artist_name || "—"}
                            {r.year ? ` · ${r.year}` : ""}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {searchOpen && (
            <div className="fixed inset-0 z-10" onClick={() => setSearchOpen(false)} />
          )}
        </div>

        {/* Sección Artists (si hay) */}
        {artistItems.length > 0 && (
          <section className="mb-12">
            <SectionRule title="Artists" />
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {artistItems.map((a) => (
                <ArtistCard key={a.id} a={a} />
              ))}
            </ul>
          </section>
        )}

        {/* Sección Records (si hay) */}
        {recordItems.length > 0 && (
          <section>
            <SectionRule title="Records" />
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {recordItems.map((r) => (
                <RecordCard key={r.id} r={r} />
              ))}
            </ul>
          </section>
        )}

        {/* Vacío */}
        {!loading && artistItems.length === 0 && recordItems.length === 0 && (
          <div
            className="text-center text-neutral-500 mt-10"
            style={{ fontFamily: "Roboto, sans-serif", fontWeight: 300 }}
          >
            Your pending list is empty.
          </div>
        )}
      </section>
    </main>
  );
}

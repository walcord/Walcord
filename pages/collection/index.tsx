"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";

/* ============================================================
   Walcord — Collection
   Tipos: Times New Roman (titulares) + Roboto Light 300 (meta)
   Gutter/anchos: max-w-6xl + px-4 sm:px-6 (look The Wall)
   Tabs: deslizables, sticky en móvil
   Buscador: h-12, borde 1px, radio completo
   Vibes: grid editorial por discos con mini-mosaicos
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

type VibeTile = {
  record_id: string;
  title: string;
  artist_name: string | null;
  year: number | null;
  vibe_color: string | null;
  cover_color: string | null;
  photos: string[]; // 0..6
};

function fold(s: string) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function CollectionPage() {
  const supabase = useSupabaseClient();
  const user = useUser();

  // -------------------- TABS --------------------
  // Vibes primero y por defecto
  const [tab, setTab] = useState<"pending" | "vibes">("vibes");

  // -------------------- PENDING --------------------
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoadingPending(true);
      const { data } = await supabase
        .from("v_pending_items_expanded")
        .select("*")
        .eq("user_id", user.id);
      if (data) setPending(data as PendingItem[]);
      setLoadingPending(false);
    })();
  }, [user, supabase]);

  const removeItem = async (id: string) => {
    await supabase.from("pending_items").delete().eq("id", id);
    setPending((prev) => prev.filter((p) => p.id !== id));
  };

  const artistItems = pending.filter((p) => p.type === "artist");
  const recordItems = pending.filter((p) => p.type === "record");

  // -------------------- SEARCH (records) --------------------
  const [q, setQ] = useState("");
  const debouncedQ = useMemo(() => q.trim(), [q]);
  const foldedQ = useMemo(() => fold(debouncedQ), [debouncedQ]);
  const [recordHits, setRecordHits] = useState<RecordHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

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
        .slice(0, 10);

      setRecordHits(filtered);
    };
    const t = setTimeout(run, 200);
    return () => {
      clearTimeout(t);
      cancelled = true;
    };
  }, [debouncedQ, foldedQ, supabase]);

  // -------------------- VIBES (board por discos) --------------------
  const [vibes, setVibes] = useState<VibeTile[]>([]);
  const [loadingVibes, setLoadingVibes] = useState(true);

  useEffect(() => {
    (async () => {
      setLoadingVibes(true);

      const { data: posts } = await supabase
        .from("posts")
        .select("id, record_id, image_urls, created_at")
        .not("record_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(400);

      const mapPhotos: Record<string, string[]> = {};
      (posts || []).forEach((p: any) => {
        if (!p.record_id) return;
        let arr: string[] = [];
        if (typeof p.image_urls === "string" && p.image_urls.trim() !== "") {
          try {
            const parsed = JSON.parse(p.image_urls);
            if (Array.isArray(parsed)) arr = parsed.filter(Boolean);
          } catch {
            arr = p.image_urls.split(",").map((s: string) => s.trim()).filter(Boolean);
          }
        } else if (Array.isArray(p.image_urls)) {
          arr = p.image_urls.filter(Boolean);
        }
        if (!mapPhotos[p.record_id]) mapPhotos[p.record_id] = [];
        for (const u of arr) {
          if (mapPhotos[p.record_id].length < 6) mapPhotos[p.record_id].push(u);
        }
      });

      const recordIds = Object.keys(mapPhotos);
      if (recordIds.length === 0) {
        setVibes([]);
        setLoadingVibes(false);
        return;
      }

      const { data: recs } = await supabase
        .from("records")
        .select("id,title,artist_name,release_year,vibe_color,cover_color")
        .in("id", recordIds);

      const tiles: VibeTile[] =
        (recs || [])
          .map((r: any) => ({
            record_id: r.id,
            title: r.title,
            artist_name: r.artist_name ?? null,
            year: r.release_year ?? null,
            vibe_color: r.vibe_color ?? null,
            cover_color: r.cover_color ?? null,
            photos: mapPhotos[r.id] ?? [],
          }))
          .sort((a, b) => b.photos.length - a.photos.length);

      setVibes(tiles);
      setLoadingVibes(false);
    })();
  }, [supabase]);

  /* ---------------------------- Helpers UI ---------------------------- */

  const SectionRule = ({ title }: { title: string }) => (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-[16px]" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
        {title}
      </h2>
      <div className="h-px flex-1 bg-neutral-200" />
    </div>
  );

  const ArtistCard = ({ a }: { a: PendingItem }) => (
    <li className="rounded-[14px] overflow-hidden border border-neutral-200 shadow-sm hover:shadow-md transition">
      <Link href={`/artist/${a.artist_id}`}>
        <div className="h-24 flex items-center justify-center" style={{ backgroundColor: a.artist_vibe_color || "#4b2a65" }}>
          <div className="w-10 h-10 rounded-full" style={{ backgroundColor: a.artist_cover_color || "#b09bbd" }} />
        </div>
        <div className="px-3 pt-2 pb-3 text-center">
          <div className="text-[14px] leading-tight" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
            {a.artist_name}
          </div>
        </div>
      </Link>
      <div className="px-3 pb-3">
        <button
          onClick={() => removeItem(a.id)}
          className="w-full rounded-full px-3 py-1.5 text-[11px] bg-[#1F48AF] text-white"
          style={{ fontFamily: "Roboto", fontWeight: 300 }}
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
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[6px]" style={{ backgroundColor: r.record_cover_color || "#bdbdbd" }} />
        </div>
        <div className="mt-2 text-[14px] leading-tight" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
          {r.record_title}
        </div>
        <div className="text-[12px] text-neutral-600" style={{ fontFamily: "Roboto", fontWeight: 300 }}>
          {r.record_artist_name}
        </div>
        <div className="text-[12px] text-neutral-400" style={{ fontFamily: "Roboto", fontWeight: 300 }}>
          {r.record_year ?? ""}
        </div>
      </Link>
      <div className="mt-2">
        <button
          onClick={() => removeItem(r.id)}
          className="rounded-full px-4 py-1.5 text-[11px] bg-[#1F48AF] text-white"
          style={{ fontFamily: "Roboto", fontWeight: 300 }}
        >
          Remove
        </button>
      </div>
    </li>
  );

  const VibeCard = ({ v }: { v: VibeTile }) => {
    const imgs = v.photos.slice(0, 6);
    return (
      <li className="group rounded-2xl overflow-hidden border border-neutral-200 shadow-sm hover:shadow-lg transition">
        <Link href={`/record/${v.record_id}`}>
          <div className="relative">
            <div className="p-3" style={{ backgroundColor: v.vibe_color || "#f1efe9" }}>
              <div className="grid grid-cols-3 gap-2">
                {imgs.map((src, i) => (
                  <div key={i} className={`relative ${i === 0 ? "col-span-2 row-span-2" : ""}`}>
                    <Image
                      src={src}
                      alt="photo"
                      width={800}
                      height={800}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  </div>
                ))}
                {imgs.length === 0 && (
                  <div className="col-span-3 h-40 rounded-xl flex items-center justify-center border border-dashed border-neutral-300">
                    <div className="w-14 h-14 rounded-md" style={{ backgroundColor: v.cover_color || "#d9d9d9" }} />
                  </div>
                )}
              </div>
            </div>
            <div className="absolute top-3 left-3 rounded-full px-3 py-1 text-[11px] bg-white/90 border border-black/10 backdrop-blur-sm">
              {imgs.length} {imgs.length === 1 ? "photo" : "photos"}
            </div>
          </div>
          <div className="px-3 pt-2 pb-3">
            <div className="text-[14px] leading-tight" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
              {v.title}
            </div>
            <div className="text-[12px] text-neutral-600" style={{ fontFamily: "Roboto", fontWeight: 300 }}>
              {v.artist_name || "—"}{v.year ? ` · ${v.year}` : ""}
            </div>
          </div>
        </Link>
      </li>
    );
  };

  /* ------------------------------ Render ------------------------------ */

  return (
    <main className="min-h-screen bg-white text-black">
      {/* Banner */}
      <header className="w-full h-24 bg-[#1F48AF] flex items-end px-4 sm:px-6 pb-2">
        <button onClick={() => history.back()} aria-label="Go back" className="p-2 rounded-full hover:bg-[#1A3A95] transition">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </header>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-20">
        {/* Title */}
        <div className="mb-4">
          <h1 className="text-[40px] sm:text-[44px] leading-none" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
            Collection
          </h1>
          <p className="mt-2 text-[12px] text-neutral-500" style={{ fontFamily: "Roboto", fontWeight: 300 }}>
            Your saved picks and the community’s vibe by record.
          </p>
        </div>

        {/* Tabs (Vibes primero) */}
        <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div className="overflow-x-auto no-scrollbar">
            <div className="inline-flex gap-2 p-1 rounded-full border border-neutral-200 bg-white">
              {[
                { key: "vibes", label: "Vibes" },
                { key: "pending", label: "Pending" },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key as any)}
                  className={`px-4 py-1.5 rounded-full text-[12px] transition ${
                    tab === t.key
                      ? "bg-[#1F48AF] text-white"
                      : "bg-white text-black hover:bg-neutral-100"
                  }`}
                  style={{ fontFamily: "Roboto", fontWeight: 300 }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search común */}
        <div className="relative mt-6 mb-10">
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search records…"
            className="w-full h-12 rounded-full border border-neutral-200 px-5 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#1F48AF]"
            style={{ fontFamily: "Roboto", fontWeight: 300 }}
            aria-label="Search records"
          />
          {searchOpen && recordHits.length > 0 && (
            <div
              className="absolute z-20 mt-2 w-full rounded-2xl border border-neutral-200 bg-white shadow-xl"
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="p-4">
                <div className="mb-3 text-[10px] uppercase tracking-wide text-neutral-500" style={{ fontFamily: "Roboto", fontWeight: 300 }}>
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
                        <div className="w-8 h-8 rounded-md flex items-center justify-center shadow-sm" style={{ backgroundColor: r.vibe_color || "#e5e5e5" }}>
                          <div className="w-3.5 h-3.5 rounded-[3px]" style={{ backgroundColor: r.cover_color || "#bdbdbd" }} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] leading-tight" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                            {r.title}
                          </div>
                          <div className="truncate text-[11px] text-neutral-500" style={{ fontFamily: "Roboto", fontWeight: 300 }}>
                            {r.artist_name || "—"}{r.year ? ` · ${r.year}` : ""}
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

        {/* ------------------ TAB: VIBES ------------------ */}
        {tab === "vibes" && (
          <>
            <SectionRule title="Boards by record" />
            {loadingVibes ? (
              <div className="text-neutral-500" style={{ fontFamily: "Roboto", fontWeight: 300 }}>
                Loading boards…
              </div>
            ) : vibes.length === 0 ? (
              <div className="text-neutral-500" style={{ fontFamily: "Roboto", fontWeight: 300 }}>
                No community photos yet.
              </div>
            ) : (
              <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                {vibes.map((v) => <VibeCard key={v.record_id} v={v} />)}
              </ul>
            )}
          </>
        )}

        {/* ------------------ TAB: PENDING ------------------ */}
        {tab === "pending" && (
          <>
            {artistItems.length > 0 && (
              <section className="mb-12">
                <SectionRule title="Artists" />
                <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                  {artistItems.map((a) => <ArtistCard key={a.id} a={a} />)}
                </ul>
              </section>
            )}

            {recordItems.length > 0 && (
              <section>
                <SectionRule title="Records" />
                <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                  {recordItems.map((r) => <RecordCard key={r.id} r={r} />)}
                </ul>
              </section>
            )}

            {!loadingPending && artistItems.length === 0 && recordItems.length === 0 && (
              <div className="text-center text-neutral-500 mt-10" style={{ fontFamily: "Roboto", fontWeight: 300 }}>
                Your pending list is empty.
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

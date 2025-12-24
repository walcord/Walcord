"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@supabase/auth-helpers-react";

/** ====== Tipos ====== */
interface RecordRow {
  id: string;
  title: string;
  cover_url: string | null;
  artist_name: string;
  release_year: number | null;
  type: string | null;
  description: string | null;
  vibe_color: string | null;
  cover_color: string | null;
}

interface FavouriteRow {
  records_id: string;
}

export default function FavouriteRecords() {
  const router = useRouter();
  const me = useUser();
  const qs = useSearchParams();

  /** ====== Perfil objetivo (modo lectura si ves el de otro) ====== */
  const [targetId, setTargetId] = useState<string | null>(null);
  const [targetUsername, setTargetUsername] = useState<string | null>(null);
  const readonly = !!(targetId && me?.id && targetId !== me.id);

  useEffect(() => {
    const init = async () => {
      const qProfileId = qs.get("profileId") || qs.get("user") || qs.get("u");
      const qUsername = qs.get("username") || qs.get("handle");
      if (qProfileId) {
        setTargetId(qProfileId);
        return;
      }
      if (qUsername) {
        const { data } = await supabase
          .from("profiles")
          .select("id,username")
          .eq("username", qUsername)
          .maybeSingle();
        if (data?.id) {
          setTargetId(data.id);
          setTargetUsername(data.username);
          return;
        }
      }
      setTargetId(me?.id ?? null);
    };
    init();
  }, [qs, me?.id]);

  /** ====== Estado ====== */
  const [search, setSearch] = useState("");
  const [allRecords, setAllRecords] = useState<RecordRow[]>([]);
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [favouriteRecords, setFavouriteRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);

  // UI
  const [searchOpen, setSearchOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  /** ====== Util: normalizar texto (sin acentos y en minúsculas) ====== */
  const norm = useCallback((s: string | null | undefined) => {
    return (s ?? "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();
  }, []);

  /** ====== Helpers de recarga (para evitar estados "fantasma") ====== */
  const refetchAllRecords = useCallback(async () => {
    const pageSize = 1000;
    let from = 0;
    let to = pageSize - 1;
    const acc: RecordRow[] = [];

    while (true) {
      const { data, error } = await supabase
        .from("records")
        .select("*")
        .order("release_year", { ascending: false })
        .range(from, to);

      if (error) {
        console.error("[FavouriteRecords] refetchAllRecords error:", error);
        break;
      }

      const batch = (data ?? []) as unknown as RecordRow[];
      acc.push(...batch);

      if (batch.length < pageSize) break;

      from += pageSize;
      to += pageSize;
    }

    setAllRecords(acc);
  }, []);

  const refetchFavouritesFor = useCallback(async (profileId: string) => {
    const { data: favData, error: favErr } = await supabase
      .from("favourite_records")
      .select("records_id, records:records(*)")
      .eq("user_id", profileId);

    if (favErr) {
      console.error("[FavouriteRecords] refetchFavourites error:", favErr);
      setFavouriteIds([]);
      setFavouriteRecords([]);
      return;
    }

    const ids = (favData ?? [])
      .map((r: any) => r.records_id)
      .filter(Boolean) as string[];

    const uniqIds = Array.from(new Set(ids));
    setFavouriteIds(uniqIds);

    const favRecs = (favData as any[])
      .map((row) => row.records as RecordRow | null)
      .filter(Boolean) as RecordRow[];
    setFavouriteRecords(favRecs);
  }, []);

  /** ====== Carga de datos ====== */
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // 1) Cargar TODOS los records (para buscar y poder añadir)
      await refetchAllRecords();

      // 2) Cargar favoritos del usuario objetivo
      if (targetId) {
        await refetchFavouritesFor(targetId);
      } else {
        setFavouriteIds([]);
        setFavouriteRecords([]);
      }

      setLoading(false);
    };

    fetchData();
  }, [targetId, refetchAllRecords, refetchFavouritesFor]);

  /** ====== Acciones ====== */
  const handleAddFavourite = async (recordId: string) => {
    if (readonly || !me?.id) return;

    const { error } = await supabase
      .from("favourite_records")
      .upsert([{ user_id: me.id, records_id: recordId }], {
        onConflict: "user_id,records_id",
        ignoreDuplicates: true,
      });

    if (error) {
      console.error("[FavouriteRecords] add favourite error:", error);
      return;
    }

    setFavouriteIds((prev) =>
      prev.includes(recordId) ? prev : [...prev, recordId]
    );
    const rec = allRecords.find((r) => r.id === recordId);
    if (rec) {
      setFavouriteRecords((prev) => {
        const exists = prev.some((r) => r.id === rec.id);
        return exists ? prev : [rec, ...prev];
      });
    }

    await refetchFavouritesFor(me.id);
  };

  const handleRemoveFavourite = async (recordId: string) => {
    if (readonly || !me?.id) return;

    const { error } = await supabase
      .from("favourite_records")
      .delete()
      .match({ user_id: me.id, records_id: recordId });

    if (error) {
      console.error("[FavouriteRecords] remove favourite error:", error);
      return;
    }

    setFavouriteIds((prev) => prev.filter((id) => id !== recordId));
    setFavouriteRecords((prev) => prev.filter((r) => r.id !== recordId));

    await refetchAllRecords();
    await refetchFavouritesFor(me.id);
  };

  const isFavourite = useCallback(
    (recordId: string) => favouriteIds.includes(recordId),
    [favouriteIds]
  );

  /** ====== Búsqueda (case/acentos-insensible) ====== */
  const matchedRecords = useMemo(() => {
    const q = norm(search);
    if (!q) return [];
    return allRecords.filter((record) => {
      const inTitle = norm(record.title).includes(q);
      const inArtist = norm(record.artist_name).includes(q);
      return inTitle || inArtist;
    });
  }, [allRecords, search, norm]);

  const goToRecordProfile = (id: string) => router.push(`/record/${id}`);

  /** ====== UI actions (como Favourite Artists) ====== */
  const openSearch = () => {
    if (readonly) return;
    setSearchOpen(true);
    setEditMode(false);
    setTimeout(() => {
      const el = document.getElementById(
        "recordSearchInput"
      ) as HTMLInputElement | null;
      el?.focus();
    }, 0);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearch("");
  };

  const toggleEdit = () => {
    if (readonly) return;
    setEditMode((v) => !v);
    setSearchOpen(false);
    setSearch("");
  };

  const showing: RecordRow[] = search ? matchedRecords : favouriteRecords;

  return (
    <main className="min-h-screen bg-white text-black font-[Roboto] pb-[calc(env(safe-area-inset-bottom)+8.25rem)]">
      {/* TOP — back button */}
      <div className="w-full px-5 sm:px-12 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-3 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          title="Back"
          className="flex items-center gap-2 text-[#264AAE] font-light text-[0.95rem]"
        >
          <span className="text-[1.35rem] leading-none -mt-[1px]">‹</span>
          <span>Back</span>
        </button>
        <div className="w-[60px]" />
      </div>

      {/* Header (replica Favourite Artists) */}
      <div className="w-full px-5 sm:px-6 pt-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col">
            <div
              className="text-[11px] tracking-[0.28em] uppercase text-black/50"
              style={{ fontFamily: "Roboto, sans-serif", fontWeight: 300 }}
            >
              Collection
            </div>

            <h1
              className="mt-2 text-[clamp(2.05rem,7.0vw,3.15rem)] leading-[0.95]"
              style={{
                fontFamily: "Times New Roman, serif",
                fontWeight: 400,
                letterSpacing: "-0.25px",
                opacity: 0.92,
              }}
            >
              Favourite Records
            </h1>

            <div className="mt-4 h-[1px] w-24 bg-black/55" />

            {readonly && targetUsername && (
              <p className="text-sm text-neutral-600 mt-4">
                Viewing @{targetUsername}
              </p>
            )}
          </div>

          {/* Actions (EDIT + + pequeño) */}
          {!readonly && (
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={toggleEdit}
                className="text-[12px] uppercase tracking-[0.18em] text-black/55 hover:text-black/80 transition"
                style={{ fontFamily: "Roboto, sans-serif", fontWeight: 300 }}
                aria-label="Toggle edit"
                title={editMode ? "Done" : "Edit"}
              >
                {editMode ? "Done" : "Edit"}
              </button>

              <button
                onClick={() => (searchOpen ? closeSearch() : openSearch())}
                className="w-[40px] h-[40px] rounded-full bg-[#1F48AF] text-white flex items-center justify-center shadow-[0_10px_18px_rgba(31,72,175,0.16)] hover:opacity-95 transition"
                aria-label="Add record"
                title="Add"
              >
                <span className="text-[20px] leading-none">+</span>
              </button>
            </div>
          )}
        </div>

        {/* Search block */}
        {searchOpen && !readonly && (
          <div className="mt-8">
            <input
              id="recordSearchInput"
              type="text"
              placeholder="Find your record"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 h-12 border border-black/15 rounded-[12px] text-[14px] placeholder-gray-500 focus:outline-none focus:border-black/30 transition font-light text-left"
            />

            <div className="mt-4 flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-[0.22em] text-black/45">
                Results
              </div>

              <button
                onClick={closeSearch}
                className="text-[11px] uppercase tracking-[0.22em] text-black/45 hover:text-black/75 transition"
                style={{ fontFamily: "Roboto, sans-serif", fontWeight: 300 }}
              >
                Close
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {(search ? matchedRecords : []).slice(0, 18).map((record) => {
                const fav = isFavourite(record.id);

                return (
                  <div
                    key={record.id}
                    className="w-full flex items-center justify-between gap-3 px-4 h-14 rounded-[16px] border border-black/10 hover:border-black/20 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* mini cover */}
                      <div
                        onClick={() => goToRecordProfile(record.id)}
                        className="w-10 h-10 rounded-[10px] cursor-pointer flex items-center justify-center"
                        style={{
                          backgroundColor: record.vibe_color || "#1F48AF",
                          boxShadow: "0 8px 18px rgba(0,0,0,0.10)",
                        }}
                        aria-label={`Open ${record.title}`}
                        title={record.title}
                      >
                        <div
                          className="w-4 h-4 rounded-[4px]"
                          style={{
                            backgroundColor: record.cover_color || "#FFFFFF",
                          }}
                        />
                      </div>

                      <div className="min-w-0">
                        <div
                          className="text-[15px] leading-tight truncate"
                          style={{
                            fontFamily: "Times New Roman, serif",
                            opacity: 0.92,
                          }}
                        >
                          {record.title}
                        </div>
                        <div className="text-[11px] text-black/45 font-light truncate">
                          {record.artist_name}
                        </div>
                      </div>
                    </div>

                    {fav ? (
                      <button
                        onClick={() => handleRemoveFavourite(record.id)}
                        className="px-4 h-9 rounded-full text-[12px] border border-black/15 hover:border-black/25 transition font-light"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAddFavourite(record.id)}
                        className="px-4 h-9 rounded-full text-[12px] bg-[#1F48AF] text-white hover:opacity-95 transition font-light"
                      >
                        Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <p className="text-center text-gray-500 text-sm mt-14 mb-32">
          Loading records...
        </p>
      ) : showing.length > 0 ? (
        <div className="w-full px-5 sm:px-6 mt-10 pb-[calc(env(safe-area-inset-bottom)+10rem)]">
          <div className="text-[11px] uppercase tracking-[0.22em] text-black/45">
            Your favourites · {favouriteRecords.length}
          </div>

          {/* Grid editorial */}
          <div className="mt-7 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-7 gap-y-10">
            {(!search ? favouriteRecords : matchedRecords).map((record) => {
              const fav = isFavourite(record.id);

              return (
                <div
                  key={record.id}
                  className="flex flex-col items-center text-center"
                >
                  <div className="relative">
                    <div
                      onClick={() => goToRecordProfile(record.id)}
                      className="w-[140px] h-[140px] sm:w-[150px] sm:h-[150px] rounded-[22px] cursor-pointer transition-transform duration-200 hover:scale-[1.02] shadow-[0_12px_26px_rgba(0,0,0,0.10)] flex items-center justify-center"
                      style={{ backgroundColor: record.vibe_color || "#1F48AF" }}
                      aria-label={`Open ${record.title}`}
                      title={record.title}
                    >
                      {/* cover square */}
                      <div
                        className="w-[54px] h-[54px] sm:w-[58px] sm:h-[58px] rounded-[10px]"
                        style={{
                          backgroundColor: record.cover_color || "#FFFFFF",
                        }}
                      />
                    </div>

                    {/* X pinned (solo edit + favorito) */}
                    {!readonly && editMode && fav && (
                      <button
                        onClick={() => handleRemoveFavourite(record.id)}
                        className="absolute -top-2 -right-2 w-9 h-9 rounded-full bg-white border border-black/20 shadow-sm flex items-center justify-center hover:border-black/35 transition"
                        aria-label="Remove from favourites"
                        title="Remove"
                      >
                        <span className="text-[22px] leading-none font-light text-black/70">
                          ×
                        </span>
                      </button>
                    )}
                  </div>

                  <p
                    className="mt-4 text-[16px] leading-tight line-clamp-2"
                    style={{
                      fontFamily: "Times New Roman, serif",
                      opacity: 0.92,
                    }}
                  >
                    {record.title}
                  </p>
                  <p className="mt-1 text-[12px] text-black/55 font-light line-clamp-1">
                    {record.artist_name}
                  </p>
                  {record.release_year ? (
                    <p className="mt-0.5 text-[12px] text-black/40 font-light">
                      {record.release_year}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-center text-neutral-500 mt-16 mb-28">
          No records yet.
        </p>
      )}
    </main>
  );
}

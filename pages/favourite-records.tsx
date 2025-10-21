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
  const [allRecords, setAllRecords] = useState<RecordRow[]>([]); // para buscar/añadir
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [favouriteRecords, setFavouriteRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);

  /** ====== Util: normalizar texto (sin acentos y en minúsculas) ====== */
  const norm = useCallback((s: string | null | undefined) => {
    return (s ?? "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  }, []);

  /** ====== Carga de datos ====== */
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // 1) Cargar TODOS los records (para buscar y poder añadir)
      const { data: recordsData, error: recordsErr } = await supabase
        .from("records")
        .select("*")
        .order("release_year", { ascending: false });

      if (!recordsErr && recordsData) {
        setAllRecords(recordsData as unknown as RecordRow[]);
      } else {
        setAllRecords([]);
      }

      // 2) Cargar favoritos del usuario objetivo con JOIN para traer EXACTAMENTE los records favoritos
      if (targetId) {
        const { data: favData, error: favErr } = await supabase
          .from("favourite_records")
          .select("records_id, records:records(*)")
          .eq("user_id", targetId);

        if (!favErr && favData) {
          const ids = favData
            .map((r: any) => r.records_id)
            .filter(Boolean) as string[];

          // Puede haber duplicados; los eliminamos
          const uniqIds = Array.from(new Set(ids));
          setFavouriteIds(uniqIds);

          // Extraemos los records del JOIN, ignorando posibles nulos
          const favRecs = (favData as any[])
            .map((row) => row.records as RecordRow | null)
            .filter(Boolean) as RecordRow[];
          setFavouriteRecords(favRecs);
        } else {
          setFavouriteIds([]);
          setFavouriteRecords([]);
        }
      } else {
        setFavouriteIds([]);
        setFavouriteRecords([]);
      }

      setLoading(false);
    };

    fetchData();
  }, [targetId]);

  /** ====== Acciones ====== */
  const handleAddFavourite = async (recordId: string) => {
    if (readonly || !me?.id) return;
    const { error } = await supabase
      .from("favourite_records")
      .insert([{ user_id: me.id, records_id: recordId }]);
    if (error) return;

    // Optimista: añadimos al estado
    setFavouriteIds((prev) =>
      prev.includes(recordId) ? prev : [...prev, recordId]
    );
    const rec = allRecords.find((r) => r.id === recordId);
    if (rec) {
      // Evitar duplicados en favouriteRecords
      setFavouriteRecords((prev) => {
        const exists = prev.some((r) => r.id === rec.id);
        return exists ? prev : [rec, ...prev];
      });
    }
  };

  const handleRemoveFavourite = async (recordId: string) => {
    if (readonly || !me?.id) return;
    const { error } = await supabase
      .from("favourite_records")
      .delete()
      .match({ user_id: me.id, records_id: recordId });
    if (error) return;

    // Optimista: quitamos del estado
    setFavouriteIds((prev) => prev.filter((id) => id !== recordId));
    setFavouriteRecords((prev) => prev.filter((r) => r.id !== recordId));
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

  /** ====== Qué mostrar ====== */
  const goToRecordProfile = (id: string) => router.push(`/record/${id}`);
  const showing: RecordRow[] =
    search ? matchedRecords : favouriteRecords;

  return (
    <main className="min-h-screen bg-white text-black font-[Roboto]">
      {/* Banner azul con flecha minimalista pegada abajo */}
      <header className="w-full h-24 bg-[#1F48AF] flex items-end px-4 sm:px-6 pb-2">
        <button
          onClick={() => history.back()}
          aria-label="Go back"
          className="p-2 rounded-full hover:bg-[#1A3A95] transition"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </header>

      {/* Título */}
      <div className="w-full flex flex-col items-center mt-10 mb-6">
        <h1
          className="text-[clamp(1.5rem,3.5vw,2.4rem)]"
          style={{
            fontFamily: "Times New Roman, serif",
            fontWeight: 400,
            opacity: 0.85,
            letterSpacing: "0.4px",
          }}
        >
          Favourite Records
        </h1>
        {readonly && targetUsername && (
          <p className="text-sm text-neutral-600 mt-2">Viewing @{targetUsername}</p>
        )}
        <hr className="w-[90%] mt-4 border-t-[1.5px] border-black opacity-60" />
      </div>

      {/* Buscador */}
      <div className="w-full flex flex-col items-center gap-6 mb-8">
        <input
          type="text"
          placeholder={readonly ? "Search records…" : "Find your record"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[90%] max-w-2xl px-5 h-12 border border-black rounded-full text-base placeholder-gray-500 focus:outline-none transition-all duration-200 text-center font-light"
        />
      </div>

      {/* Resultados */}
      {loading ? (
        <p className="text-center text-gray-500 text-sm mb-32">Loading records...</p>
      ) : search || showing.length > 0 ? (
        <div className="w-full px-4 sm:px-6 mb-24">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {showing.map((record) => {
              const fav = isFavourite(record.id);
              return (
                <div key={record.id} className="flex flex-col items-center text-center">
                  <div
                    onClick={() => goToRecordProfile(record.id)}
                    className="w-36 h-36 sm:w-40 sm:h-40 rounded-xl shadow-md flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-[1.03]"
                    style={{ backgroundColor: record.vibe_color || "#1F48AF" }}
                  >
                    <div
                      className="w-10 h-10 sm:w-12 sm:h-12"
                      style={{ backgroundColor: record.cover_color || "#FFFFFF" }}
                    />
                  </div>

                  <p
                    className="mt-2 text-[13px] sm:text-sm font-normal leading-tight line-clamp-2"
                    style={{ fontFamily: "Times New Roman, serif", opacity: 0.9 }}
                  >
                    {record.title}
                  </p>
                  <p className="text-[11px] sm:text-xs text-gray-600 font-light">
                    {record.artist_name}
                  </p>
                  {record.release_year && (
                    <p className="text-[11px] sm:text-xs text-gray-500 font-light mb-1">
                      {record.release_year}
                    </p>
                  )}

                  {fav ? (
                    !readonly ? (
                      <button
                        onClick={() => handleRemoveFavourite(record.id)}
                        className="text-base sm:text-lg text-gray-500 hover:text-black transition font-light"
                        aria-label="Remove from favourites"
                        title="Remove"
                      >
                        ✕
                      </button>
                    ) : (
                      <span className="text-[10px] sm:text-[11px] text-neutral-500">
                        Favourite
                      </span>
                    )
                  ) : (
                    !readonly && (
                      <button
                        onClick={() => handleAddFavourite(record.id)}
                        className="bg-[#1F48AF] text-white px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-full hover:bg-[#1A3A95] transition font-light"
                      >
                        Add
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-center text-neutral-500">No records yet.</p>
      )}
    </main>
  );
}

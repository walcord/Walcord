"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@supabase/auth-helpers-react";

interface Record {
  id: string;
  title: string;
  cover_url: string;
  artist_name: string;
  release_year: number;
  type: string;
  description: string;
  vibe_color: string;
  cover_color: string;
}

export default function FavouriteRecords() {
  const router = useRouter();
  const me = useUser();
  const qs = useSearchParams();

  // PERFIL OBJETIVO
  const [targetId, setTargetId] = useState<string | null>(null);
  const [targetUsername, setTargetUsername] = useState<string | null>(null);
  const readonly = !!(targetId && me?.id && targetId !== me.id);

  useEffect(() => {
    const init = async () => {
      const qProfileId = qs.get("profileId") || qs.get("user") || qs.get("u");
      const qUsername = qs.get("username") || qs.get("handle");
      if (qProfileId) { setTargetId(qProfileId); return; }
      if (qUsername) {
        const { data } = await supabase
          .from("profiles")
          .select("id,username")
          .eq("username", qUsername)
          .maybeSingle();
        if (data?.id) { setTargetId(data.id); setTargetUsername(data.username); return; }
      }
      setTargetId(me?.id ?? null);
    };
    init();
  }, [qs, me?.id]);

  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<Record[]>([]);
  const [favourites, setFavourites] = useState<{ records_id: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: recordsData } = await supabase
        .from("records")
        .select("*")
        .order("release_year", { ascending: false });

      if (recordsData) setRecords(recordsData);

      if (targetId) {
        const { data: favouritesData } = await supabase
          .from("favourite_records")
          .select("records_id")
          .eq("user_id", targetId);
        setFavourites((favouritesData || []) as any);
      } else {
        setFavourites([]);
      }

      setLoading(false);
    };

    fetchData();
  }, [targetId]);

  const handleAddFavourite = async (recordId: string) => {
    if (readonly || !me?.id) return;
    await supabase.from("favourite_records").insert([{ user_id: me.id, records_id: recordId }]);
    setFavourites([...favourites, { records_id: recordId }]);
  };

  const handleRemoveFavourite = async (recordId: string) => {
    if (readonly || !me?.id) return;
    await supabase.from("favourite_records").delete().match({ user_id: me.id, records_id: recordId });
    setFavourites(favourites.filter((fav) => fav.records_id !== recordId));
  };

  const isFavourite = (recordId: string) => favourites.some((fav) => fav.records_id === recordId);

  const matchedRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          record.title?.toLowerCase().includes(search.toLowerCase()) ||
          record.artist_name?.toLowerCase().includes(search.toLowerCase())
      ),
    [records, search]
  );

  const goToRecordProfile = (id: string) => router.push(`/record/${id}`);

  const showing = search ? matchedRecords : records.filter((r) => isFavourite(r.id));

  return (
    <main className="min-h-screen bg-white text-black font-[Roboto]">
      {/* Banner EXACTAMENTE IGUAL que en Favourite Artists */}
      <header className="w-full h-20 bg-[#1F48AF] flex items-center px-4 sm:px-6">
        <Link href="/profile" aria-label="Back to profile" className="mr-3 hidden sm:inline">
          <span className="text-white/85 text-xs px-2 py-1 rounded-full border border-white/40">
            Back
          </span>
        </Link>
        <Image
          src="/logotipo.png"
          alt="Walcord"
          width={56}
          height={56}
          priority
          className="select-none"
        />
      </header>

      {/* Título */}
      <div className="w-full flex flex-col items-center mt-10 mb-6">
        <h1
          className="text-[clamp(1.5rem,3.5vw,2.4rem)]"
          style={{ fontFamily: "Times New Roman, serif", fontWeight: 400, opacity: 0.85, letterSpacing: "0.4px" }}
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

      {/* Resultados (GRID 2 columnas en móvil) */}
      {loading ? (
        <p className="text-center text-gray-500 text-sm mb-32">Loading records...</p>
      ) : search || favourites.length > 0 ? (
        <div className="w-full px-4 sm:px-6 mb-24">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {showing.map((record) => {
              const fav = isFavourite(record.id);
              return (
                <div key={record.id} className="flex flex-col items-center text-center">
                  <div
                    onClick={() => goToRecordProfile(record.id)}
                    className="w-36 h-36 sm:w-40 sm:h-40 rounded-xl shadow-md flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-[1.03]"
                    style={{ backgroundColor: record.vibe_color || "#000000" }}
                  >
                    <div className="w-10 h-10 sm:w-12 sm:h-12" style={{ backgroundColor: record.cover_color || "#FFFFFF" }} />
                  </div>

                  <p
                    className="mt-2 text-[13px] sm:text-sm font-normal leading-tight line-clamp-2"
                    style={{ fontFamily: "Times New Roman, serif", opacity: 0.9 }}
                  >
                    {record.title}
                  </p>
                  <p className="text-[11px] sm:text-xs text-gray-600 font-light">{record.artist_name}</p>
                  <p className="text-[11px] sm:text-xs text-gray-500 font-light mb-1">{record.release_year}</p>

                  {fav ? (
                    !readonly ? (
                      <button onClick={() => handleRemoveFavourite(record.id)} className="text-base sm:text-lg text-gray-500 hover:text-black transition font-light">
                        ✕
                      </button>
                    ) : (
                      <span className="text-[10px] sm:text-[11px] text-neutral-500">Favourite</span>
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

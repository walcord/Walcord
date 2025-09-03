"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@supabase/auth-helpers-react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { ARTIST_COLOR_PALETTE } from "../lib/artist.Colors";
import NowTouringRibbon from "../components/wall/NowTouringRibbon";

/* ===========================================================================
   Walcord — Favourite Artists (MOBILE-FIRST, banner igual que ConcertsPage)
   - Header 80px + logo 56px, seguido de NowTouringRibbon.
   - AVATARES SIEMPRE CIRCULARES (sin deformaciones)
   =========================================================================== */

const currentYear = new Date().getFullYear();

function getArtistColor(artistId: string) {
  const hash = artistId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = hash % ARTIST_COLOR_PALETTE.length;
  return ARTIST_COLOR_PALETTE[index];
}

export default function FavouriteArtists() {
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

  const [search, setSearch] = useState("");
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [newArtist, setNewArtist] = useState<any>(null);
  const [artists, setArtists] = useState<any[]>([]);
  const [favourites, setFavourites] = useState<any[]>([]);

  useEffect(() => {
    const fetchArtists = async () => {
      const { data } = await supabase.from("artists").select("*");
      if (data) setArtists(data);
    };

    const fetchFavourites = async () => {
      if (!targetId) {
        setFavourites([]);
        return;
      }
      const { data } = await supabase
        .from("favourite_artists")
        .select("artist_id, since_year")
        .eq("user_id", targetId);
      setFavourites(data || []);
    };

    fetchArtists();
    fetchFavourites();
  }, [targetId]);

  const handleAddArtist = async () => {
    if (readonly || !me?.id || !newArtist) return;
    const { error } = await supabase.from("favourite_artists").insert([
      { user_id: me.id, artist_id: newArtist.id, since_year: selectedYear },
    ]);
    if (error) return console.error("Error inserting favourite artist:", error.message);
    setFavourites([...favourites, { artist_id: newArtist.id, since_year: selectedYear }]);
    setShowYearPicker(false);
    setSelectedYear(currentYear);
    setTargetId(me.id);
  };

  const handleRemoveArtist = async (artistId: string) => {
    if (readonly || !me?.id) return;
    await supabase
      .from("favourite_artists")
      .delete()
      .match({ artist_id: artistId, user_id: me.id });
    setFavourites(favourites.filter((fav) => fav.artist_id !== artistId));
  };

  const isFavourite = (artistId: string) =>
    favourites.find((fav) => fav.artist_id === artistId);

  const matchedArtists = useMemo(
    () =>
      artists.filter((artist) =>
        artist.name.toLowerCase().includes(search.toLowerCase())
      ),
    [artists, search]
  );

  return (
    <main className="min-h-screen bg-white text-black font-[Roboto]">
      {/* Banner exacto como ConcertsPage: 80px + logo 56px */}
      <header className="w-full h-20 bg-[#1F48AF] flex items-center px-4 sm:px-6">
        <Link href="/profile" aria-label="Back to profile" className="mr-3">
          <span className="hidden sm:inline text-white/80 text-xs px-2 py-1 rounded-full border border-white/40">
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
      <div className="w-full flex flex-col items-center mt-8 mb-6">
        <h1
          className="text-[clamp(1.5rem,3.5vw,2.4rem)]"
          style={{
            fontFamily: "Times New Roman",
            fontWeight: 400,
            opacity: 0.85,
            letterSpacing: "0.4px",
          }}
        >
          Favourite Artists
        </h1>
        {readonly && targetUsername && (
          <p className="text-sm text-neutral-600 mt-2">Viewing @{targetUsername}</p>
        )}
        <hr className="w-[90%] mt-4 border-t border-black/60" />
      </div>

      {/* Buscador */}
      <div className="w-full flex flex-col items-center gap-6 mb-8">
        <input
          type="text"
          placeholder={readonly ? "Search artists…" : "Find your artist"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[90%] max-w-2xl px-5 h-12 border border-black rounded-full text-base placeholder-gray-500 focus:outline-none text-center font-light"
        />
      </div>

      {/* Resultados del buscador */}
      {search && matchedArtists.length > 0 && (
        <div className="flex flex-col items-center gap-3 sm:gap-4 mb-14">
          {matchedArtists.map((artist) => (
            <Link
              key={artist.id}
              href={`/artist/${artist.id}`}
              className="w-[92%] max-w-xl bg-white shadow-sm rounded-2xl px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-4 sm:gap-6 justify-between border border-neutral-200 hover:bg-neutral-50 transition"
            >
              {/* LADO IZQUIERDO: avatar + datos */}
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div
                  className="relative aspect-square w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden shrink-0 border border-black/5"
                  style={{ backgroundColor: getArtistColor(artist.id) }}
                >
                  {artist.image_url ? (
                    <Image
                      src={artist.image_url}
                      alt={artist.name}
                      fill
                      className="object-cover rounded-full"
                      sizes="64px"
                    />
                  ) : null}
                </div>

                <div className="min-w-0">
                  <p
                    className="text-base sm:text-lg truncate"
                    style={{ fontFamily: "Times New Roman, serif", fontWeight: 400, opacity: 0.9 }}
                  >
                    {artist.name}
                  </p>
                  <p className="text-sm font-light text-neutral-500 truncate">
                    {artist.place}
                  </p>
                </div>
              </div>

              {/* LADO DERECHO: estado favorito / botón */}
              {isFavourite(artist.id) ? (
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <span className="inline-flex items-center justify-center h-10 min-w-[120px] sm:min-w-[140px] px-3 rounded-full text-xs sm:text-sm text-white font-light bg-[#1F48AF]">
                    Since {isFavourite(artist.id)?.since_year}
                  </span>
                  {!readonly && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleRemoveArtist(artist.id);
                      }}
                      className="text-[#1F48AF] text-xl leading-none font-light hover:opacity-70"
                      aria-label="Remove favourite"
                    >
                      ×
                    </button>
                  )}
                </div>
              ) : (
                !readonly && (
                  <button
                    className="inline-flex items-center justify-center h-10 min-w-[120px] sm:min-w-[140px] px-4 rounded-full text-xs sm:text-sm text-white font-light bg-[#1F48AF] hover:opacity-90 transition shrink-0"
                    onClick={(e) => {
                      e.preventDefault();
                      setNewArtist(artist);
                      setShowYearPicker(true);
                    }}
                  >
                    Add as Favourite
                  </button>
                )
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Favoritos (GRID 2 columnas en móvil) */}
      {favourites.length > 0 ? (
        <div className="w-full px-4 sm:px-6 pb-24">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {favourites.map((fav) => {
              const artist = artists.find((a) => a.id === fav.artist_id);
              if (!artist) return null;
              const color = getArtistColor(artist.id);

              return (
                <Link
                  key={fav.artist_id}
                  href={`/artist/${fav.artist_id}`}
                  className="shadow-sm rounded-3xl overflow-hidden hover:bg-neutral-50 transition"
                >
                  <div
                    className="w-full h-36 sm:h-40 flex items-center justify-center"
                    style={{ backgroundColor: color }}
                  >
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden">
                      {artist.image_url ? (
                        <Image
                          src={artist.image_url}
                          alt={artist.name}
                          fill
                          className="object-cover rounded-full"
                          sizes="96px"
                        />
                      ) : (
                        <div className="w-full h-full bg-white/40" />
                      )}
                    </div>
                  </div>
                  <div className="p-3 sm:p-4 text-center">
                    <p
                      className="text-sm sm:text-lg truncate"
                      style={{
                        fontFamily: "Times New Roman, serif",
                        fontWeight: 400,
                        opacity: 0.9,
                      }}
                    >
                      {artist.name}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 font-light truncate">
                      {artist.place}
                    </p>
                    <div className="mt-2 sm:mt-3 mb-1">
                      <span className="inline-flex items-center justify-center h-8 sm:h-9 px-3 sm:px-4 rounded-full text-xs sm:text-sm text-white font-light bg-[#1F48AF]">
                        Since {fav.since_year}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-center text-neutral-500 pb-16">No artists yet.</p>
      )}

      {/* Selector de año */}
      {showYearPicker && newArtist && !readonly && (
        <div className="fixed inset-0 bg-[#1F48AF] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl w-[90%] max-w-md text-center">
            <p
              className="text-lg mb-4"
              style={{
                fontFamily: "Times New Roman, serif",
                fontWeight: 200,
                opacity: 0.85,
              }}
            >
              When did you start listening to <span>{newArtist.name}</span>?
            </p>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="border border-black rounded-full bg-white text-sm shadow-sm w-full h-11 px-4 font-light"
            >
              {Array.from({ length: currentYear - 1924 }, (_, i) => currentYear - i).map(
                (year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                )
              )}
            </select>
            <div className="flex justify-center gap-3 sm:gap-4 mt-6">
              <button
                onClick={handleAddArtist}
                className="bg-[#1F48AF] text-white px-5 sm:px-6 h-10 rounded-full text-sm hover:bg-[#1A3A95] transition font-light"
              >
                Confirm year
              </button>
              <button
                onClick={() => setShowYearPicker(false)}
                className="text-sm text-gray-800 hover:text-black transition border border-gray-300 px-5 h-10 rounded-full font-light bg-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

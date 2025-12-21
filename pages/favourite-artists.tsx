"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@supabase/auth-helpers-react";

/* ===============================
   Tipos
   =============================== */
interface Artist {
  id: string;
  name: string;
  image_url?: string | null;
  place?: string | null; // "City, Country"
  start_year?: number | null; // e.g. 1985
}

/* ===============================
   Utilidades
   - Paleta determinista (sin guardar en BD).
   - Normalizador búsqueda (sin acentos y case-insensitive).
   =============================== */
const PALETTE = [
  "#1F48AF",
  "#0F254E",
  "#1B2A41",
  "#2E4057",
  "#14213D",
  "#2F3E46",
  "#0B4F6C",
  "#1D3557",
  "#2C3E50",
  "#112D32",
  "#4C4C47",
  "#3D2C2E",
  "#6B2E2E",
];

function hashName(name: string) {
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = (h * 33) ^ name.charCodeAt(i);
  return Math.abs(h);
}
function colorFor(name: string) {
  const idx = hashName(name) % PALETTE.length;
  return PALETTE[idx];
}
function norm(s?: string | null) {
  return (s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export default function FavouriteArtists() {
  const router = useRouter();
  const me = useUser();
  const qs = useSearchParams();

  // PERFIL OBJETIVO (modo lectura cuando ves otro perfil)
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
  const [artists, setArtists] = useState<Artist[]>([]);
  const [favourites, setFavourites] = useState<{ artist_id: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // UI states
  const [searchOpen, setSearchOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Carga artistas + favoritos
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: artistsData } = await supabase
        .from("artists")
        .select("id,name,image_url,place,start_year")
        .order("name", { ascending: true });

      if (artistsData) setArtists(artistsData as Artist[]);

      if (targetId) {
        const { data: favouritesData } = await supabase
          .from("favourite_artists")
          .select("artist_id")
          .eq("user_id", targetId);

        setFavourites((favouritesData || []) as any);
      } else {
        setFavourites([]);
      }

      setLoading(false);
    };

    fetchData();
  }, [targetId]);

  /* ===============================
     Acciones
     =============================== */
  const handleAddFavourite = async (artistId: string) => {
    if (readonly || !me?.id) return;
    await supabase.from("favourite_artists").insert([{ user_id: me.id, artist_id: artistId }]);
    setFavourites((prev) => [...prev, { artist_id: artistId }]);
  };

  const handleRemoveFavourite = async (artistId: string) => {
    if (readonly || !me?.id) return;
    await supabase.from("favourite_artists").delete().match({ user_id: me.id, artist_id: artistId });
    setFavourites((prev) => prev.filter((fav) => fav.artist_id !== artistId));
  };

  const isFavourite = (artistId: string) => favourites.some((fav) => fav.artist_id === artistId);

  /* ===============================
     Búsqueda robusta (sin acentos / case-insensitive)
     =============================== */
  const matchedArtists = useMemo(() => {
    const q = norm(search);
    if (!q) return artists;
    return artists.filter((a) => norm(a.name).includes(q) || norm(a.place).includes(q));
  }, [artists, search]);

  const goToArtist = (id: string) => router.push(`/artist/${id}`);

  const openSearch = () => {
    if (readonly) return;
    setSearchOpen(true);
    setEditMode(false);
    setTimeout(() => {
      const el = document.getElementById("artistSearchInput") as HTMLInputElement | null;
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

  // favourites grid
  const favouriteArtists = artists.filter((a) => isFavourite(a.id));

  // search results list (solo al buscar)
  const searchResults = search ? matchedArtists : [];

  return (
    <main className="min-h-screen bg-white text-black font-[Roboto]">
      {/* Header */}
      <div className="w-full px-5 sm:px-6 pt-9">
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
              Favourite Artists
            </h1>

            <div className="mt-4 h-[1px] w-24 bg-black/55" />

            {readonly && targetUsername && (
              <p className="text-sm text-neutral-600 mt-4">Viewing @{targetUsername}</p>
            )}
          </div>

          {/* Actions */}
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

              {/* + más pequeño */}
              <button
                onClick={() => (searchOpen ? closeSearch() : openSearch())}
                className="w-[40px] h-[40px] rounded-full bg-[#1F48AF] text-white flex items-center justify-center shadow-[0_10px_18px_rgba(31,72,175,0.16)] hover:opacity-95 transition"
                aria-label="Add artist"
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
              id="artistSearchInput"
              type="text"
              placeholder="Find your artist"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 h-12 border border-black/15 rounded-[12px] text-[14px] placeholder-gray-500 focus:outline-none focus:border-black/30 transition font-light text-left"
            />

            {/* Results label + small close aligned right (not huge, not centered) */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-[0.22em] text-black/45">Results</div>

              <button
                onClick={closeSearch}
                className="text-[11px] uppercase tracking-[0.22em] text-black/45 hover:text-black/75 transition"
                style={{ fontFamily: "Roboto, sans-serif", fontWeight: 300 }}
              >
                Close
              </button>
            </div>

            {/* Results list */}
            <div className="mt-3 space-y-2">
              {searchResults.slice(0, 18).map((artist) => {
                const fav = isFavourite(artist.id);
                const hasImg = !!artist.image_url;
                const color = colorFor(artist.name || "");

                return (
                  <div
                    key={artist.id}
                    className="w-full flex items-center justify-between gap-3 px-4 h-14 rounded-[16px] border border-black/10 hover:border-black/20 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        onClick={() => goToArtist(artist.id)}
                        className="w-10 h-10 rounded-full cursor-pointer flex items-center justify-center"
                        style={{
                          backgroundColor: hasImg ? "#F4F5F7" : color,
                          overflow: "hidden",
                          border: hasImg ? "1.5px solid" : "none",
                          borderColor: hasImg ? color : undefined,
                        }}
                        aria-label={`Open ${artist.name}`}
                        title={artist.name}
                      >
                        {hasImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={artist.image_url as string} alt={artist.name} className="w-full h-full object-cover" />
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <div
                          className="text-[15px] leading-tight truncate"
                          style={{ fontFamily: "Times New Roman, serif", opacity: 0.92 }}
                        >
                          {artist.name}
                        </div>
                      </div>
                    </div>

                    {fav ? (
                      <button
                        onClick={() => handleRemoveFavourite(artist.id)}
                        className="px-4 h-9 rounded-full text-[12px] border border-black/15 hover:border-black/25 transition font-light"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAddFavourite(artist.id)}
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

      {/* Content */}
      {loading ? (
        <p className="text-center text-gray-500 text-sm mt-14 mb-32">Loading artists...</p>
      ) : favouriteArtists.length > 0 ? (
        <div className="w-full px-5 sm:px-6 mt-10 pb-36">
          <div className="text-[11px] uppercase tracking-[0.22em] text-black/45">
            Your favourites · {favouriteArtists.length}
          </div>

          {/* Grid: tighter vertical rhythm, no weird gaps */}
          <div className="mt-7 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-7 gap-y-10">
            {favouriteArtists.map((artist) => {
              const hasImg = !!artist.image_url;
              const color = colorFor(artist.name || "");

              return (
                <div key={artist.id} className="flex flex-col items-center text-center">
                  {/* Avatar + delete X pinned (close to artist, correct scale) */}
                  <div className="relative">
                    <div
                      onClick={() => goToArtist(artist.id)}
                      className="w-[118px] h-[118px] sm:w-[132px] sm:h-[132px] rounded-full cursor-pointer transition-transform duration-200 hover:scale-[1.02] shadow-[0_12px_26px_rgba(0,0,0,0.10)]"
                      style={{
                        backgroundColor: hasImg ? "#F4F5F7" : color,
                        overflow: "hidden",
                        border: hasImg ? "2px solid" : "none",
                        borderColor: hasImg ? color : undefined,
                      }}
                      aria-label={`Open ${artist.name}`}
                      title={artist.name}
                    >
                      {hasImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={artist.image_url as string}
                          alt={artist.name}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>

                    {/* X like your reference: small, on the corner, not floating far away */}
                    {!readonly && editMode && (
                      <button
                        onClick={() => handleRemoveFavourite(artist.id)}
                        className="absolute -top-2 -right-2 w-9 h-9 rounded-full bg-white border border-black/20 shadow-sm flex items-center justify-center hover:border-black/35 transition"
                        aria-label="Remove from favourites"
                        title="Remove"
                      >
                        <span className="text-[22px] leading-none font-light text-black/70">×</span>
                      </button>
                    )}
                  </div>

                  <p
                    className="mt-4 text-[16px] leading-tight line-clamp-2"
                    style={{ fontFamily: "Times New Roman, serif", opacity: 0.92 }}
                  >
                    {artist.name}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-center text-neutral-500 mt-16">No artists yet.</p>
      )}
    </main>
  );
}

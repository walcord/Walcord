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
  place?: string | null;       // "City, Country"
  start_year?: number | null;  // e.g. 1985
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

  // Carga artistas + favoritos
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Aseguramos traer los campos necesarios para que "no falte info"
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

  // Mostrar favoritos si no hay búsqueda; con búsqueda, mostrar resultados
  const showing = search ? matchedArtists : artists.filter((a) => isFavourite(a.id));

  const goToArtist = (id: string) => router.push(`/artist/${id}`);

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
          Favourite Artists
        </h1>
        {readonly && targetUsername && (
          <p className="text-sm text-neutral-600 mt-2">Viewing @{targetUsername}</p>
        )}
        <hr className="w-[90%] mt-4 border-t-[1.5px] border-black opacity-60" />
      </div>

      {/* Buscador (sin mensaje extra) */}
      <div className="w-full flex flex-col items-center gap-6 mb-8">
        <input
          type="text"
          placeholder={readonly ? "Search artists…" : "Find your artist"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[90%] max-w-2xl px-5 h-12 border border-black rounded-full text-base placeholder-gray-500 focus:outline-none transition-all duration-200 text-center font-light"
        />
      </div>

      {/* Resultados */}
      {loading ? (
        <p className="text-center text-gray-500 text-sm mb-32">Loading artists...</p>
      ) : search || favourites.length > 0 ? (
        <div className="w-full px-4 sm:px-6 mb-24">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {showing.map((artist) => {
              const fav = isFavourite(artist.id);
              const hasImg = !!artist.image_url;
              const color = colorFor(artist.name || "");

              // Normalizamos "info" para evitar falsos vacíos (espacios, 0, etc.)
              const place = artist.place && artist.place.trim().length > 0 ? artist.place.trim() : null;
              const since =
                typeof artist.start_year === "number" && artist.start_year > 0 ? artist.start_year : null;

              return (
                <div key={artist.id} className="flex flex-col items-center text-center">
                  {/* Avatar circular:
                      - Sin letras (como pediste).
                      - Si hay imagen: borde del color editorial. */}
                  <div
                    onClick={() => goToArtist(artist.id)}
                    className="w-32 h-32 sm:w-36 sm:h-36 rounded-full shadow-md cursor-pointer transition-transform duration-200 hover:scale-[1.03] flex items-center justify-center"
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
                      <img src={artist.image_url as string} alt={artist.name} className="w-full h-full object-cover" />
                    ) : null}
                  </div>

                  {/* Nombre */}
                  <p
                    className="mt-2 text-[13px] sm:text-sm font-normal leading-tight line-clamp-2"
                    style={{ fontFamily: "Times New Roman, serif", opacity: 0.9 }}
                  >
                    {artist.name}
                  </p>

                  {/* Info secundaria (solo si existe, para que no “falte info” por huecos) */}
                  {place ? (
                    <p className="text-[11px] sm:text-xs text-gray-600 font-light">{place}</p>
                  ) : (
                    <div className="h-[14px]" />
                  )}
                  {since ? (
                    <p className="text-[11px] sm:text-xs text-gray-500 font-light mb-1">Since {since}</p>
                  ) : (
                    <div className="h-[18px] mb-1" />
                  )}

                  {/* Add / Remove */}
                  {fav ? (
                    !readonly ? (
                      <button
                        onClick={() => handleRemoveFavourite(artist.id)}
                        className="text-base sm:text-lg text-gray-500 hover:text-black transition font-light"
                        aria-label="Remove from favourites"
                        title="Remove"
                      >
                        ✕
                      </button>
                    ) : (
                      <span className="text-[10px] sm:text-[11px] text-neutral-500">Favourite</span>
                    )
                  ) : (
                    !readonly && (
                      <button
                        onClick={() => handleAddFavourite(artist.id)}
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
        <p className="text-center text-neutral-500">No artists yet.</p>
      )}
    </main>
  );
}

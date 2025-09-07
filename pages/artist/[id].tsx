"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Image from "next/image";
import Link from "next/link";

export default function ArtistProfile() {
  const router = useRouter();
  const { id } = router.query;

  const [artist, setArtist] = useState<any>(null);
  const [followers, setFollowers] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingLoading, setPendingLoading] = useState(false);

  const [loading, setLoading] = useState(true); // ← loader para “que se vea al menos”

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
  }, []);

  useEffect(() => {
    if (!router.isReady || !id) return;

    const fetchArtist = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("artists")
        .select("*, records(id, title, release_year, vibe_color, cover_color)")
        .eq("id", id)
        .single();

      if (data) {
        // orden seguro cuando release_year pueda ser null
        (data as any).records = (data as any).records?.sort(
          (a: any, b: any) => (b.release_year ?? 0) - (a.release_year ?? 0)
        ) || [];
        setArtist(data);
      }
      setLoading(false);
    };

    const fetchFollowers = async () => {
      const { data } = await supabase
        .from("favourite_artists")
        .select("user_id, profiles(avatar_url)")
        .eq("artist_id", id);
      if (data) setFollowers(data);
    };

    fetchArtist();
    fetchFollowers();
  }, [router.isReady, id]);

  useEffect(() => {
    if (!id || !userId) return;
    (async () => {
      const { data } = await supabase
        .from("pending_items")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "artist")
        .eq("artist_id", id)
        .maybeSingle();
      if (data?.id) setPendingId(data.id);
    })();
  }, [id, userId]);

  const togglePending = async () => {
    if (!userId || !id) return;
    setPendingLoading(true);
    try {
      if (pendingId) {
        await supabase.from("pending_items").delete().eq("id", pendingId);
        setPendingId(null);
      } else {
        const { data } = await supabase
          .from("pending_items")
          .upsert(
            { user_id: userId, type: "artist", artist_id: id as string, record_id: null },
            { onConflict: "user_id,type,artist_id,record_id" }
          )
          .select("id")
          .single();
        setPendingId(data?.id ?? null);
      }
    } finally {
      setPendingLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white text-black">
      {/* Banner azul con flecha minimalista pegada abajo (h-24, sin logo) */}
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

      {/* CONTENIDO */}
      <div className="px-6 sm:px-8 md:px-24 pt-8 md:pt-12 pb-24">
        {/* CABECERA + BOTÓN PENDING */}
        <div className="flex items-start justify-between gap-4">
          <h1
            className="text-[clamp(2rem,4vw,3rem)] mb-8 md:mb-12"
            style={{ fontFamily: "Times New Roman", fontWeight: 400, letterSpacing: "0.5px" }}
          >
            {loading ? " " : (artist?.name ?? "—")}
          </h1>

          {!loading && userId && (
            <button
              onClick={togglePending}
              disabled={pendingLoading}
              className={[
                "mt-2 rounded-full px-3 py-1.5 text-xs border transition",
                pendingId
                  ? "bg-[#1F48AF] text-white border-[#1F48AF]"
                  : "bg-white text-[#1F48AF] border-[#1F48AF] hover:bg-[#1F48AF] hover:text-white",
              ].join(" ")}
              title={pendingId ? "Remove from Pending" : "Add to Pending"}
            >
              {pendingLoading ? "Saving…" : pendingId ? "In Pending" : "Add to Pending"}
            </button>
          )}
        </div>

        {/* SKELETON PARA QUE “SE VEA” MIENTRAS CARGA */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 md:gap-16">
            <div className="col-span-1 max-w-xl">
              <div className="h-24 bg-neutral-200 rounded-2xl mb-6" />
              <div className="h-3 w-3/4 bg-neutral-200 rounded mb-2" />
              <div className="h-3 w-2/3 bg-neutral-200 rounded mb-2" />
              <div className="h-3 w-1/2 bg-neutral-200 rounded" />
            </div>
            <div className="col-span-2">
              <div className="h-4 w-32 bg-neutral-200 rounded mb-4" />
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="w-full aspect-square rounded-xl bg-neutral-200" />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 md:gap-16">
            {/* COLUMNA IZQUIERDA */}
            <div className="col-span-1 max-w-xl">
              <p
                className="text-base md:text-lg leading-relaxed font-light"
                style={{ fontFamily: "Roboto", opacity: 0.85 }}
              >
                {artist?.description}
              </p>

              {followers.length > 0 && (
                <div className="mt-10">
                  <h2
                    className="text-xl mb-4"
                    style={{ fontFamily: "Times New Roman", fontWeight: 400 }}
                  >
                    Also followed by
                  </h2>
                  <div className="flex items-center flex-wrap gap-3">
                    {followers.map((f, i) => (
                      <Image
                        key={i}
                        src={f.profiles?.avatar_url || "/default-user-icon.png"}
                        width={40}
                        height={40}
                        alt="user"
                        className="rounded-full w-10 h-10 object-cover border border-black"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* COLUMNA DERECHA: RECORDS (ENLACE A /record/[id]) */}
            <div className="col-span-2">
              <h2
                className="text-xl mb-6"
                style={{ fontFamily: "Times New Roman", fontWeight: 400 }}
              >
                Records
              </h2>

              {artist?.records?.length ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                  {artist.records.map((record: any) => (
                    <Link
                      key={record.id}
                      href={`/record/${record.id}`}
                      className="flex flex-col items-start group"
                      aria-label={`Open ${record.title}`}
                    >
                      <div
                        className="w-full aspect-square mb-2 rounded-xl shadow-sm flex items-center justify-center transition-transform group-hover:scale-[1.02]"
                        style={{
                          backgroundColor: record.vibe_color,
                        }}
                      >
                        <div
                          className="w-10 h-10 md:w-12 md:h-12 rounded-sm"
                          style={{ backgroundColor: record.cover_color }}
                        />
                      </div>
                      <p className="text-base font-light" style={{ fontFamily: "Roboto" }}>
                        {record.title}
                      </p>
                      <p
                        className="text-sm text-gray-500 font-light"
                        style={{ fontFamily: "Roboto" }}
                      >
                        {record.release_year ?? ""}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center text-neutral-500 py-16">
                  No records found for this artist.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

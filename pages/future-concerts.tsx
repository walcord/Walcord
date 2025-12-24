"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

type TimeoutId = ReturnType<typeof setTimeout>;

type Artist = { id: string; name: string };
type Country = { code: string; name: string };

type MentionProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type FutureRow = {
  id: string;
  artist: string;
  city: string;
  venue: string | null;
  seat_label: string | null;
  companions: string | null;
  notes: string | null;
  country_code: string | null;
  event_date: string;
  created_at: string;
};

export default function FutureConcertsPage() {
  const router = useRouter();

  // Auth
  const [userId, setUserId] = useState<string | null>(null);

  // Catálogos
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryCode, setCountryCode] = useState<string>("");

  // Artista (buscador -> guardamos el nombre)
  const [artistQ, setArtistQ] = useState("");
  const [artistResults, setArtistResults] = useState<Artist[]>([]);
  const [artistSearching, setArtistSearching] = useState(false);
  const artistDebouncer = useRef<TimeoutId | null>(null);
  const [artistName, setArtistName] = useState<string>("");

  // Form
  const [city, setCity] = useState("");
  const [venue, setVenue] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [seatLabel, setSeatLabel] = useState("");
  const [eveningNote, setEveningNote] = useState("");

  // People I am going with
  const [peopleInput, setPeopleInput] = useState("");
  const [selectedPeople, setSelectedPeople] = useState<MentionProfile[]>([]);
  const [companySuggestions, setCompanySuggestions] = useState<MentionProfile[]>([]);
  const [companySearching, setCompanySearching] = useState(false);
  const companyDebouncer = useRef<TimeoutId | null>(null);

  // Data
  const [items, setItems] = useState<FutureRow[]>([]);
  const [loading, setLoading] = useState(true);

  // UI
  const [showForm, setShowForm] = useState(false);

  const canAdd =
    !!artistName &&
    !!city.trim() &&
    !!venue.trim() &&
    !!countryCode &&
    !!dateStr;

  /* ====== Init ====== */
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);

      const { data: C } = await supabase
        .from("countries")
        .select("code,name")
        .order("name", { ascending: true });
      setCountries((C as Country[]) || []);

      await loadItems(user.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ====== Buscar artistas (debounce) ====== */
  useEffect(() => {
    const term = artistQ.trim();
    if (!term || term.length < 2) {
      setArtistResults([]);
      setArtistSearching(false);
      return;
    }
    setArtistSearching(true);
    if (artistDebouncer.current) clearTimeout(artistDebouncer.current);
    artistDebouncer.current = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from("artists")
          .select("id,name")
          .ilike("name", `%${term}%`)
          .limit(25);
        setArtistResults((data as Artist[]) || []);
      } finally {
        setArtistSearching(false);
      }
    }, 200);
  }, [artistQ]);

  /* ====== Buscar perfiles para People I am going with ====== */
  useEffect(() => {
    const raw = peopleInput.trim();
    if (!raw || raw.length < 2) {
      setCompanySuggestions([]);
      setCompanySearching(false);
      return;
    }

    setCompanySearching(true);

    if (companyDebouncer.current) clearTimeout(companyDebouncer.current);
    companyDebouncer.current = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .ilike("username", `${raw}%`)
          .limit(10);

        setCompanySuggestions((data as MentionProfile[]) || []);
      } finally {
        setCompanySearching(false);
      }
    }, 200);
  }, [peopleInput]);

  const handlePickCompanyUser = (profile: MentionProfile) => {
    if (!profile.username) return;

    setSelectedPeople((prev) => {
      if (prev.some((p) => p.id === profile.id)) return prev;
      return [...prev, profile];
    });
    setPeopleInput("");
    setCompanySuggestions([]);
  };

  const handleRemovePerson = (id: string) => {
    setSelectedPeople((prev) => prev.filter((p) => p.id !== id));
  };

  /* ====== CRUD ====== */
  async function loadItems(uid: string) {
    setLoading(true);
    const { data } = await supabase
      .from("future_concerts")
      .select(
        "id, artist, city, venue, seat_label, companions, notes, country_code, event_date, created_at"
      )
      .eq("user_id", uid)
      .order("event_date", { ascending: true });
    setItems((data as FutureRow[]) || []);
    setLoading(false);
  }

  async function addItem() {
    if (!userId || !canAdd) return;

    const companionsString =
      selectedPeople
        .map((p) => p.username)
        .filter(Boolean)
        .join(" ") || null;

    const payload = {
      user_id: userId,
      artist: artistName,
      city: city.trim(),
      venue: venue.trim(),
      country_code: countryCode || null,
      event_date: dateStr,
      seat_label: seatLabel.trim() || null,
      companions: companionsString,
      notes: eveningNote.trim() || null,
    };

    const { data, error } = await supabase
      .from("future_concerts")
      .insert([payload])
      .select(
        "id, artist, city, venue, seat_label, companions, notes, country_code, event_date, created_at"
      )
      .single();

    if (!error && data) {
      setItems((prev) =>
        [...prev, data as FutureRow].sort(
          (a, b) =>
            new Date(a.event_date).getTime() -
            new Date(b.event_date).getTime()
        )
      );
    }

    // reset rápido
    setArtistName("");
    setArtistQ("");
    setArtistResults([]);
    setCountryCode("");
    setCity("");
    setVenue("");
    setDateStr("");
    setSeatLabel("");
    setEveningNote("");
    setPeopleInput("");
    setSelectedPeople([]);
    setShowForm(false);
  }

  async function removeItem(id: string) {
    const backup = items;
    setItems((prev) => prev.filter((i) => i.id !== id));
    const { error } = await supabase
      .from("future_concerts")
      .delete()
      .eq("id", id);
    if (error) setItems(backup);
  }

  /* ====== Helpers UI ====== */
  const formatDate = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    const day = d.toLocaleDateString("en-GB", { day: "2-digit" });
    const month = d
      .toLocaleDateString("en-GB", { month: "short" })
      .toUpperCase();
    const year = d.getFullYear();
    return { day, month, year };
  };

  const groupedByYear = useMemo(() => {
    const map: Record<string, FutureRow[]> = {};
    for (const it of items) {
      const y = new Date(it.event_date + "T00:00:00").getFullYear().toString();
      if (!map[y]) map[y] = [];
      map[y].push(it);
    }
    return map;
  }, [items]);

  const orderedYears = useMemo(
    () =>
      Object.keys(groupedByYear)
        .map((y) => parseInt(y, 10))
        .sort((a, b) => a - b)
        .map((y) => y.toString()),
    [groupedByYear]
  );

  return (
    <div className="bg-white min-h-screen text-black font-[Roboto]">
      {/* IMPORTANT: isolation + overflow-visible para WKWebView */}
      <main className="mx-auto w-full max-w-[520px] px-4 relative overflow-visible [isolation:isolate] pb-[calc(env(safe-area-inset-bottom)+8rem)]">
        {/* HEADER STICKY (iOS-proof) */}
        <div className="sticky top-0 z-[9999] bg-white/95 backdrop-blur-sm">
          {/* safe-area real */}
          <div className="pt-[calc(env(safe-area-inset-top)+0.75rem)]" />

          {/* TOP — back button */}
          <div className="w-full px-5 sm:px-12 pb-3 flex items-center justify-between">
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

          {/* HEADER EDITORIAL + PLUS */}
          <div className="px-5 sm:px-12 pb-3">
            <div className="flex items-center justify-between">
              <div className="w-8" />
              <h1
                className="text-[clamp(22px,4vw,30px)] tracking-tight text-center"
                style={{
                  fontFamily: '"Times New Roman", Times, serif',
                  fontWeight: 400,
                  letterSpacing: "-0.03em",
                }}
              >
                Future concerts
              </h1>

              {/* ✅ ALWAYS VISIBLE: high z + pointer-events ok */}
              <button
                type="button"
                onClick={() => setShowForm((s) => !s)}
                aria-label="Add future concert"
                className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-[0_10px_24px_rgba(0,0,0,0.25)] active:scale-95 transition-transform"
                style={{ backgroundColor: "#1F48AF" }}
              >
                <span className="text-lg leading-none">+</span>
              </button>
            </div>
          </div>

          {/* little separator like your editorial screens */}
          <div className="h-px bg-neutral-200/70" />
        </div>

        {/* CONTENT OFFSET so it doesn't go under sticky header */}
        <div className="pt-4">
          {/* FORM INLINE */}
          {showForm && (
            <section className="mb-6 rounded-3xl border border-neutral-200 bg-white px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.08)] relative z-[9998]">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {/* ARTIST (buscable) */}
                <div className="col-span-2 relative">
                  {artistName ? (
                    <div className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 bg-neutral-50/70">
                      <span
                        className="truncate"
                        style={{
                          fontFamily: '"Times New Roman", Times, serif',
                        }}
                      >
                        {artistName}
                      </span>
                      <button
                        type="button"
                        className="text-[11px] text-[#1F48AF]"
                        onClick={() => {
                          setArtistName("");
                          setArtistQ("");
                        }}
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        value={artistQ}
                        onChange={(e) => setArtistQ(e.target.value)}
                        placeholder="Artist"
                        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#1F48AF]"
                      />
                      {(artistSearching || artistResults.length > 0) && (
                        <div className="absolute mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg max-h-60 overflow-auto z-[9999]">
                          {artistSearching && (
                            <div className="px-3 py-2 text-sm text-neutral-500">
                              Searching…
                            </div>
                          )}
                          {!artistSearching &&
                            artistResults.map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => {
                                  setArtistName(r.name);
                                  setArtistQ("");
                                  setArtistResults([]);
                                }}
                                className="block w-full text-left px-3 py-2 hover:bg-neutral-50"
                                style={{
                                  fontFamily: '"Times New Roman", Times, serif',
                                }}
                              >
                                {r.name}
                              </button>
                            ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* CITY */}
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="col-span-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#1F48AF]"
                />

                {/* COUNTRY */}
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="col-span-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#1F48AF] appearance-none bg-white"
                >
                  <option value="">Country</option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {/* VENUE */}
                <input
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="Venue"
                  className="col-span-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#1F48AF]"
                />

                {/* SEATS */}
                <input
                  value={seatLabel}
                  onChange={(e) => setSeatLabel(e.target.value)}
                  placeholder="Seats"
                  className="col-span-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#1F48AF]"
                />

                {/* PEOPLE I AM GOING WITH */}
                <div className="col-span-2 relative">
                  <div className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm flex flex-wrap items-center gap-2 focus-within:ring-1 focus-within:ring-[#1F48AF]">
                    {selectedPeople.map((p) => (
                      <div
                        key={p.id}
                        className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-2 py-1 text-[11px]"
                      >
                        <div className="w-5 h-5 rounded-full overflow-hidden bg-neutral-300 flex items-center justify-center text-[10px]">
                          {p.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.avatar_url}
                              alt={p.username || ""}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>
                              {(p.username || "U").charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span>{p.username}</span>
                        <button
                          type="button"
                          onClick={() => handleRemovePerson(p.id)}
                          className="text-[11px] text-neutral-500 hover:text-black"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <input
                      value={peopleInput}
                      onChange={(e) => setPeopleInput(e.target.value)}
                      placeholder={
                        selectedPeople.length === 0
                          ? "People I am going with"
                          : ""
                      }
                      className="flex-1 min-w-[80px] border-none outline-none bg-transparent text-sm"
                    />
                  </div>

                  {(companySearching || companySuggestions.length > 0) && (
                    <div className="absolute mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg max-h-60 overflow-auto z-[9999]">
                      {companySearching && (
                        <div className="px-3 py-2 text-sm text-neutral-500">
                          Searching…
                        </div>
                      )}
                      {!companySearching &&
                        companySuggestions.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handlePickCompanyUser(p)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-50"
                          >
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-neutral-200 flex items-center justify-center text-[10px]">
                              {p.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={p.avatar_url}
                                  alt={p.username || ""}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>
                                  {(p.username || "U").charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[12px] truncate">
                                {p.username || "user"}
                              </p>
                              {p.full_name && (
                                <p className="text-[11px] text-neutral-500 truncate">
                                  {p.full_name}
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* DATE */}
                <div className="col-span-2">
                  <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                    Date
                  </p>
                  <input
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#1F48AF] bg-white"
                  />
                </div>

                {/* NOTES */}
                <textarea
                  value={eveningNote}
                  onChange={(e) => setEveningNote(e.target.value)}
                  placeholder="Notes"
                  className="col-span-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#1F48AF] resize-none min-h-[70px]"
                />
              </div>

              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-[11px] text-neutral-500 hover:text-black"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addItem}
                  disabled={!canAdd}
                  className="rounded-full px-5 h-9 text-xs text-white enabled:hover:opacity-90 disabled:opacity-40 transition"
                  style={{ backgroundColor: "#1F48AF" }}
                >
                  Add concert
                </button>
              </div>
            </section>
          )}

          {/* LISTA DE CONCIERTOS */}
          <section>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-20 rounded-3xl border border-neutral-200 bg-neutral-50 animate-pulse"
                  />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="mt-16 text-center text-xs text-neutral-500">
                No future concerts yet.
              </div>
            ) : (
              orderedYears.map((year) => (
                <div key={year} className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-px flex-1 bg-neutral-200" />
                    <span
                      className="text-[11px] uppercase tracking-[0.18em] text-neutral-600"
                      style={{ fontFamily: '"Times New Roman", Times, serif' }}
                    >
                      {year}
                    </span>
                    <div className="h-px flex-1 bg-neutral-200" />
                  </div>

                  <div className="space-y-3">
                    {groupedByYear[year].map((it) => {
                      const { day, month, year: yFull } = formatDate(it.event_date);

                      return (
                        <article
                          key={it.id}
                          className="rounded-3xl border border-neutral-200 px-4 py-3 flex items-center gap-3 hover:shadow-[0_16px_40px_rgba(0,0,0,0.06)] transition-shadow bg-white"
                        >
                          <div className="flex flex-col items-center justify-center w-16 h-20 rounded-2xl border border-neutral-200 text-[10px] uppercase tracking-[0.18em] text-neutral-700 shrink-0">
                            <span>{day}</span>
                            <span>{month}</span>
                            <span className="mt-1 text-[9px] tracking-[0.16em]">
                              {yFull}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p
                                  className="text-[15px] leading-5 truncate"
                                  style={{
                                    fontFamily: '"Times New Roman", Times, serif',
                                    fontWeight: 400,
                                  }}
                                >
                                  {it.artist}
                                </p>
                                <p className="text-[11px] text-neutral-600 truncate">
                                  {it.venue}
                                  {it.venue && it.city ? " · " : ""}
                                  {it.city}
                                  {it.city && it.country_code ? " · " : ""}
                                  {it.country_code}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeItem(it.id)}
                                className="px-3 h-7 rounded-full text-[10px] border border-neutral-300 text-neutral-600 hover:bg-neutral-100 transition shrink-0"
                              >
                                Remove
                              </button>
                            </div>

                            {it.seat_label && (
                              <p className="text-[10px] text-neutral-600">
                                Seats · {it.seat_label}
                              </p>
                            )}

                            {it.companions && (
                              <p className="text-[10px] text-neutral-600 truncate">
                                <span className="uppercase tracking-[0.18em] text-[9px] text-neutral-500 mr-1">
                                  With
                                </span>
                                <span className="font-light">{it.companions}</span>
                              </p>
                            )}

                            {it.notes && (
                              <p className="text-[10px] text-neutral-500 italic line-clamp-2">
                                {it.notes}
                              </p>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

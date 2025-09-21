'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import PublicUserHeader from '../../components/profile/PublicUserHeader';
import PostCard from '../../components/PostCard';

type CardRow = {
  id: string;                // concert_id
  user_id: string;
  artist_id: string | null;
  artist_name: string | null;
  country_code: string | null;
  country_name: string | null;
  city: string | null;
  event_date: string | null; // ISO
  cover_url: string | null;
};

export default function ExternalProfilePage() {
  const router = useRouter();
  const { username } = router.query as { username?: string };

  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [concertsLoading, setConcertsLoading] = useState(true);
  const [concerts, setConcerts] = useState<CardRow[]>([]);

  /* ===== username → user_id ===== */
  useEffect(() => {
    if (!username) return;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();
      if (error || !data?.id) { router.replace('/feed'); return; }
      setTargetUserId(data.id);
      setProfileLoading(false);
    })();
  }, [username, router]);

  /* ===== cargar CONCERTS del usuario (DESC por fecha) ===== */
  useEffect(() => {
    if (!targetUserId) return;

    const fetchConcerts = async () => {
      setConcertsLoading(true);

      // 1) Intento con view optimizada
      const { data: byView } = await supabase
        .from('v_concert_cards')
        .select('*')
        .eq('user_id', targetUserId)
        .order('event_date', { ascending: false });

      if (byView && byView.length > 0) {
        setConcerts(
          (byView as any[]).map(r => ({
            id: r.concert_id,
            user_id: r.user_id,
            artist_id: r.artist_id,
            artist_name: r.artist_name,
            country_code: r.country_code,
            country_name: r.country_name ?? null,
            city: r.city ?? null,
            event_date: r.event_date,
            cover_url: r.cover_url ?? null,
          }))
        );
        setConcertsLoading(false);
        return;
      }

      // 2) Fallback directo a tablas
      const { data } = await supabase
        .from('concerts')
        .select(`
          id, user_id, artist_id, country_code, city, event_date,
          artists(name),
          countries(name),
          concert_media(url, created_at)
        `)
        .eq('user_id', targetUserId)
        .order('event_date', { ascending: false });

      const normalized: CardRow[] = (data || []).map((c: any) => {
        const latest =
          (c.concert_media || []).sort(
            (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0]?.url ?? null;
        return {
          id: c.id,
          user_id: c.user_id,
          artist_id: c.artist_id,
          artist_name: c.artists?.name ?? null,
          country_code: c.country_code ?? null,
          country_name: c.countries?.name ?? null,
          city: c.city ?? null,
          event_date: c.event_date ?? null,
          cover_url: latest,
        };
      });

      setConcerts(normalized);
      setConcertsLoading(false);
    };

    void fetchConcerts();

    const ch = supabase
      .channel('external-profile-concerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'concerts', filter: `user_id=eq.${targetUserId}` },
        () => void fetchConcerts()
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [targetUserId]);

  /* ===== agrupar por año (años DESC; dentro fecha DESC) ===== */
  const groupsOrdered = useMemo(() => {
    const map = new Map<string, CardRow[]>();
    for (const c of concerts) {
      const year = c.event_date ? new Date(c.event_date).getFullYear() : null;
      const key = year && year >= 1950 && year <= 2050 ? String(year) : 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    for (const [, arr] of map) {
      arr.sort(
        (a, b) =>
          new Date(b.event_date || 0).getTime() - new Date(a.event_date || 0).getTime()
      );
    }
    const years = Array.from(map.keys())
      .filter(k => k !== 'Unknown')
      .map(Number)
      .sort((a, b) => b - a)
      .map(String);

    const ordered = years.map(y => ({ yearLabel: y, items: map.get(y)! }));
    if (map.has('Unknown')) ordered.push({ yearLabel: 'Unknown', items: map.get('Unknown')! });
    return ordered;
  }, [concerts]);

  if (profileLoading || !targetUserId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black bg-white">
        <p>Loading profile…</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black font-[Roboto]">
      {/* Banner (alineado con el del perfil actual) */}
      <div className="w-full h-24 flex items-end justify-between px-6 bg-[#1F48AF] pb-3 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 ml-auto">
          <a
            href="/feed"
            aria-label="Back to The Wall"
            className="inline-flex items-center gap-2 rounded-full bg-white/95 text-black px-3 py-1.5 text-xs border border-white/60 hover:bg-white transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H5m6 7l-7-7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hidden sm:inline">The Wall</span>
          </a>
        </div>
      </div>

      {/* Título (Times New Roman) */}
      <div className="w-full px-10 sm:px-12 mt-6 mb-8 relative">
        <h1 className="text-[clamp(1.8rem,4.5vw,2.375rem)] font-normal" style={{ fontFamily: 'Times New Roman, serif' }}>
          Profile
        </h1>
        <hr className="mt-2 border-t border-black/50" />
      </div>

      {/* Layout */}
      <div className="px-10 sm:px-12 grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-10 items-start">
        <div className="m-0 p-0">
          <PublicUserHeader userId={targetUserId} />
        </div>

        <aside className="m-0 p-0">
          {/* Encabezado de sección alineado al perfil actual */}
          <h2 className="text-[clamp(1.1rem,2vw,1.5rem)] font-light mb-1">Musical Memories</h2>

          {concertsLoading ? (
            <div className="mt-4 text-sm text-neutral-600">Loading memories…</div>
          ) : groupsOrdered.length === 0 ? (
            <div className="mt-4 text-sm text-neutral-600">No musical memories yet.</div>
          ) : (
            groupsOrdered.map(({ yearLabel, items }) => (
              <section key={yearLabel} className="mt-7">
                <div className="flex items-center">
                  <div className="text-[0.78rem] tracking-[0.14em] uppercase text-neutral-500">{yearLabel}</div>
                  <div className="h-px flex-1 ml-6 bg-black/10" />
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-7">
                  {items.map((c) => (
                    <PostCard
                      key={c.id}
                      post={{
                        id: c.id,
                        user_id: c.user_id,
                        artist_id: c.artist_id,
                        artist_name: c.artist_name,
                        country_code: c.country_code,
                        country_name: c.country_name,
                        event_date: c.event_date,
                        cover_url: c.cover_url,
                      }}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </aside>
      </div>
    </main>
  );
}

// --- SSR para evitar getStaticPaths/getStaticProps ---
export async function getServerSideProps() {
  return { props: {} };
}

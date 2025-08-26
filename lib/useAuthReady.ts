'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type AuthReady = {
  ready: boolean;           // ya sabemos con certeza si hay sesión o no
  session: any | null;      // sesión (puede ser null si no hay)
  user: any | null;         // usuario (atajo)
};

export function useAuthReady(): AuthReady {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<any | null>(null);

  useEffect(() => {
    let alive = true;

    // 1) primer intento: sesión actual
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session ?? null);
      setReady(true);
    });

    // 2) suscripción: futuros cambios (navegar atrás, refresh, etc.)
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      if (!alive) return;
      setSession(sess ?? null);
      setReady(true);
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  return { ready, session, user: session?.user ?? null };
}

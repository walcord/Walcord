'use client';

import { useRouter } from 'next/navigation';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

export default function LogoutButton() {
  const router = useRouter();
  const supabase = useSupabaseClient();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();   // cierra sesión en Supabase
    } finally {
      // redirige a tu pantalla de bienvenida
      router.replace('/index');      // ajusta la ruta si tu welcome es otra
      router.refresh();                // asegura rehidratación sin sesión
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="inline-flex items-center gap-2 rounded-full bg-white/90 text-black px-3 py-1.5 text-xs border border-white/60 hover:bg-white transition"
      aria-label="Log out"
      title="Log out"
    >
      Log out
    </button>
  );
}

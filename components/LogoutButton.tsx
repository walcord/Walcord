'use client';

import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';
import { useState } from 'react';

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onLogout = async () => {
    if (loading) return;
    const ok = window.confirm('Are you sure you want to log out?');
    if (!ok) return;

    setLoading(true);
    try {
      await supabase.auth.signOut();
      router.replace('/welcome');
    } catch (e) {
      console.error(e);
      alert('There was an error logging out. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={onLogout}
      disabled={loading}
      className="px-3 h-8 rounded-full border border-white/40 bg-[#1F48AF] text-white text-[12px] leading-8 hover:opacity-90 transition
                 font-light tracking-wide"
    >
      {loading ? 'Logging out…' : 'Log out'}
    </button>
  );
}

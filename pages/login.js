'use client';

import { useRouter } from 'next/router';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

const WALCORD_BLUE = '#1F48AF';

/* ===============================
   Brand (silent, editorial)
   =============================== */
function BrandMark() {
  return (
    <div className="flex flex-col items-center">
      <div className="logoWrap">
        <div className="logoInner">
          <Image
            src="/logotipo-dark.png"
            alt="Walcord"
            width={76}
            height={76}
            priority
          />
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const router = useRouter();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPassword = (password) => password.length >= 6;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const { email, password } = form;

    if (!email || !password) return setError('Please complete all fields.');
    if (!isValidEmail(email)) return setError('Please enter a valid email address.');
    if (!isValidPassword(password)) return setError('Password must be at least 6 characters long.');

    setLoading(true);

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      if (String(loginError.message).toLowerCase().includes('email not confirmed')) {
        setError('Please confirm your email before logging in.');
      } else {
        setError(loginError.message);
      }
      setLoading(false);
      return;
    }

    if (data?.session) {
      const userId = data.session.user.id;

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', userId)
        .maybeSingle();

      if (profile && profile.onboarding_completed === false) {
        router.replace('/onboarding');
      } else {
        router.replace('/feed');
      }
    } else {
      router.replace('/feed');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white px-6 flex items-center justify-center">
      <div className="w-full max-w-[420px]">
        {/* Brand */}
        <BrandMark />

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-16 flex flex-col gap-4">
          <div className="rounded-2xl border border-black/10 px-4 py-3 focus-within:border-black/20 transition">
            <input
              name="email"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              className="w-full outline-none bg-transparent text-[14px] text-black placeholder-black/30"
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
            />
          </div>

          <div className="rounded-2xl border border-black/10 px-4 py-3 focus-within:border-black/20 transition">
            <input
              name="password"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              className="w-full outline-none bg-transparent text-[14px] text-black placeholder-black/30"
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
            />
          </div>

          {error ? (
            <p
              className="text-sm text-center text-red-600"
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-full py-3 text-[14px] text-white active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              backgroundColor: WALCORD_BLUE,
              fontFamily: 'Roboto, sans-serif',
              fontWeight: 300,
            }}
          >
            {loading ? 'Loading…' : 'Continue'}
          </button>

          <div className="mt-8 text-center">
            <Link
              href="/signup"
              className="text-[13px] text-black/55 hover:text-black/80 transition"
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
            >
              Create account
            </Link>
          </div>
        </form>
      </div>

      {/* Scoped styles */}
      <style jsx>{`
        .logoWrap {
          width: 88px;
          height: 88px;
          border-radius: 9999px;
          background: #ffffff;
          display: grid;
          place-items: center;
          position: relative;
          margin: 0 auto;
        }

        /* Halo editorial sutil → hace que el logo “respire” */
        .logoWrap::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: 9999px;
          background: linear-gradient(
            180deg,
            rgba(31, 72, 175, 0.16),
            rgba(0, 0, 0, 0.05)
          );
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          padding: 1px;
          pointer-events: none;
        }

        .logoInner {
          width: 76px;
          height: 76px;
          border-radius: 9999px;
          overflow: hidden; /* elimina cualquier borde cuadrado del PNG */
          display: grid;
          place-items: center;
          background: #ffffff;
        }
      `}</style>
    </div>
  );
}

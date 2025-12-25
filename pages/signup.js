'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';

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

export default function Signup() {
  const router = useRouter();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const origin = useMemo(() => {
    if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
    return process.env.NEXT_PUBLIC_SITE_URL || 'https://walcord.com';
  }, []);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
    setSuccessMessage('');
  };

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPassword = (password) => password.length >= 6;
  const normalize = (s) => (s || '').trim();

  const mapSupabaseError = (message) => {
    if (!message) return 'Something went wrong. Please try again.';
    const msg = String(message).toLowerCase();
    if (msg.includes('user already registered')) return 'This email is already registered.';
    if (msg.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.';
    if (msg.includes('database error saving new user')) return 'Database error saving new user. Please try again.';
    if (msg.includes('invalid email')) return 'Please enter a valid email address.';
    if (msg.includes('password')) return 'Password must be at least 6 characters long.';
    return String(message);
  };

  const ensureProfileSkeleton = async (userId, fullName) => {
    await supabase
      .from('profiles')
      .upsert(
        { id: userId, full_name: fullName, onboarding_completed: false },
        { onConflict: 'id' }
      );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    const name = normalize(form.name);
    const email = normalize(form.email);
    const password = form.password;

    if (!name || !email || !password) return setError('Please complete all fields.');
    if (!isValidEmail(email)) return setError('Please enter a valid email address.');
    if (!isValidPassword(password)) return setError('Password must be at least 6 characters long.');
    if (!agreed) return setError('Please accept the Terms of Use.');

    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });

      if (signUpError) {
        setError(mapSupabaseError(signUpError.message));
        setLoading(false);
        return;
      }

      if (data?.session) {
        const userId = data.session.user.id;
        await ensureProfileSkeleton(userId, name);
        router.replace('/onboarding');
        return;
      }

      setSuccessMessage('Account created. Please check your email to confirm.');
      setForm({ name: '', email: '', password: '' });
    } catch (err) {
      setError(mapSupabaseError(err?.message));
    } finally {
      setLoading(false);
    }
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
              name="name"
              type="text"
              placeholder="Name"
              value={form.name}
              onChange={handleChange}
              className="w-full outline-none bg-transparent text-[14px] text-black placeholder-black/30"
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
            />
          </div>

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

          <label className="flex items-start gap-3 mt-1">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1"
            />
            <span
              className="text-[12px] text-black/55"
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
            >
              I agree to the{' '}
              <a
                href="/terms"
                className="underline underline-offset-4 text-black/70 hover:text-black transition"
              >
                Terms
              </a>
              .
            </span>
          </label>

          {error ? (
            <p
              className="text-sm text-center text-red-600"
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
            >
              {error}
            </p>
          ) : null}

          {successMessage ? (
            <p
              className="text-sm text-center text-green-700"
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
            >
              {successMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || !agreed}
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
              href="/login"
              className="text-[13px] text-black/55 hover:text-black/80 transition"
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
            >
              Already have an account?
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

        /* Halo editorial sutil */
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
          overflow: hidden;
          display: grid;
          place-items: center;
          background: #ffffff;
        }
      `}</style>
    </div>
  );
}

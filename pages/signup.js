'use client';

import { useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function Signup() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const origin = useMemo(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
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
    return message;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    const name = normalize(form.name);
    const email = normalize(form.email);
    const password = form.password;

    if (!name || !email || !password) {
      setError('Please complete all fields.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!isValidPassword(password)) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (!agreed) {
      setError('Please accept the Terms of Use.');
      return;
    }

    setLoading(true);
    try {
      // 1) Intentar signUp. Si confirmación está DESACTIVADA, devuelve session.
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // sin emailRedirectTo → permite sesión inmediata si la confirmación está desactivada
          data: { full_name: name },
        },
      });

      if (signUpError) {
        setError(mapSupabaseError(signUpError.message));
        setLoading(false);
        return;
      }

      // 2) Si ya hay sesión, entrar directo
      if (data?.session) {
        router.replace('/feed');
        return;
      }

      // 3) Fallback universal: si NO hay sesión (p. ej., confirmación activada),
      // intentar loguear inmediatamente con email+password.
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!signInError && signInData?.session) {
        router.replace('/feed');
        return;
      }

      // 4) Si tampoco dejó iniciar sesión, mostramos mensaje estándar.
      setSuccessMessage('Account created. Please check your email to confirm.');
      setForm({ name: '', email: '', password: '' });
    } catch (err) {
      setError(mapSupabaseError(err?.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 sm:px-6 bg-[#1F48AF]"
      style={{ fontFamily: 'Times New Roman' }}
    >
      <div className="w-full max-w-sm bg-white px-6 py-10 sm:px-10 rounded-md flex flex-col items-center shadow-[0_8px_30px_rgba(0,0,0,0.1)] transition-all duration-500 ease-in-out">
        <h1 className="text-center mb-8 text-[clamp(2rem,2vw,2.8rem)] font-light tracking-[0.3px] text-black">
          Create an Account
        </h1>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5 text-black">
          <div className="border border-gray-300 rounded-sm px-3 py-2 bg-white">
            <input
              name="name"
              type="text"
              placeholder="Name and Surname"
              value={form.name}
              onChange={handleChange}
              autoComplete="name"
              required
              className="w-full outline-none bg-transparent text-sm font-light placeholder-gray-400"
              style={{ fontFamily: 'Roboto, sans-serif' }}
            />
          </div>

          <div className="border border-gray-300 rounded-sm px-3 py-2 bg-white">
            <input
              name="email"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              required
              className="w-full outline-none bg-transparent text-sm font-light placeholder-gray-400"
              style={{ fontFamily: 'Roboto, sans-serif' }}
            />
          </div>

          <div className="border border-gray-300 rounded-sm px-3 py-2 bg-white">
            <input
              name="password"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
              required
              minLength={6}
              className="w-full outline-none bg-transparent text-sm font-light placeholder-gray-400"
              style={{ fontFamily: 'Roboto, sans-serif' }}
            />
          </div>

          {error && <p className="text-sm mt-2 text-center text-red-600">{error}</p>}
          {successMessage && <p className="text-sm mt-2 text-center text-green-700">{successMessage}</p>}

          <label className="flex gap-3 items-start -mt-1">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              required
              aria-label="Agree to Terms of Use"
              className="mt-1"
            />
            <span className="text-[13px]" style={{ fontFamily: 'Roboto, sans-serif' }}>
              I agree to the <a href="/terms" className="underline text-[#1F48AF]">Terms of Use</a>.
            </span>
          </label>

          <button
            type="submit"
            disabled={loading || !agreed}
            className="mt-3 w-full py-2 text-white text-sm tracking-wide rounded-md transition-all duration-300 hover:opacity-90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#1F48AF', fontFamily: 'Roboto, sans-serif' }}
          >
            {loading ? 'Creating account…' : 'Come Together'}
          </button>
        </form>
      </div>
    </div>
  );
}

'use client';

import { useRouter } from 'next/router';
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const router = useRouter();

  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const isValidEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const isValidPassword = (password) => password.length >= 6;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { email, password } = form;

    if (!email || !password) {
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

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      if (loginError.message.toLowerCase().includes('email not confirmed')) {
        setError('Please confirm your email before logging in.');
      } else {
        setError(loginError.message);
      }
      return;
    }

    // Verificar sesión y redirigir
    if (data && data.session) {
      router.push('/feed');
    } else {
      const { data: sData, error: sErr } = await supabase.auth.getSession();
      if (sErr || !sData || !sData.session) {
        setError('Login succeeded but session is missing. Please try again.');
        return;
      }
      router.push('/feed');
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 sm:px-6 bg-[#1F48AF]"
      style={{ fontFamily: 'Times New Roman' }}
    >
      <div
        className="w-full max-w-sm bg-white px-6 py-10 sm:px-10 rounded-md flex flex-col items-center shadow-[0_8px_30px_rgba(0,0,0,0.1)] transition-all duration-500 ease-in-out"
      >
        <h1 className="text-center mb-8 text-[clamp(2rem,2vw,2.8rem)] font-light tracking-[0.3px] text-black">
          Welcome Back
        </h1>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5 text-black">
          <div className="border border-gray-300 rounded-sm px-3 py-2 bg-white">
            <input
              name="email"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
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
              className="w-full outline-none bg-transparent text-sm font-light placeholder-gray-400"
              style={{ fontFamily: 'Roboto, sans-serif' }}
            />
          </div>

          {error && (
            <p
              className="text-sm mt-2 text-center text-red-600"
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontWeight: 300,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className="mt-6 w-full py-2 text-white text-sm tracking-wide rounded-md transition-all duration-300 hover:opacity-90 active:scale-95"
            style={{
              backgroundColor: '#1F48AF',
              fontFamily: 'Roboto, sans-serif',
              fontWeight: 300,
              fontSize: '0.9rem',
            }}
          >
            Hello, it’s me
          </button>
        </form>
      </div>
    </div>
  );
}

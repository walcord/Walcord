'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';

export default function Signup() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
    setSuccessMessage('');
  };

  const isValidEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const isValidPassword = (password) => password.length >= 6;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, email, password } = form;

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

    const { data, error: signUpError } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/login`,
    data: {
      full_name: name,
    },
  },
});

    if (signUpError) {
      if (signUpError.message === 'User already registered') {
        setError('This email is already registered.');
      } else {
        setError(signUpError.message);
      }
      return;
    }

    // ✅ Mostrar mensaje de éxito
    setSuccessMessage('Account created. Please check your email to confirm.');
    setForm({ name: '', email: '', password: '' });
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
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
            >
              {error}
            </p>
          )}

          {successMessage && (
            <p
              className="text-sm mt-2 text-center text-green-700"
              style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 300 }}
            >
              {successMessage}
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
            Come Together
          </button>
        </form>
      </div>
    </div>
  );
}
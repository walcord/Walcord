import { useState } from 'react';
import { supabase } from '../lib/supabaseClient'; 
import Head from 'next/head';
import { useRouter } from 'next/router'; // Importamos el router nativo de Next.js

export default function Login() {
  const router = useRouter(); // Inicializamos el router
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); 
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    if (isLogin) {
      // LÓGICA DE INICIO DE SESIÓN
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage({ text: 'Invalid credentials. Please try again.', type: 'error' });
        setLoading(false);
      } else {
        // Viajamos a index.js manteniendo la memoria activa para no perder la sesión
        router.push('/');
      }
    } else {
      // LÓGICA DE REGISTRO
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            full_name: name,
          }
        }
      });
      if (error) {
        setMessage({ text: error.message, type: 'error' });
        setLoading(false);
      } else {
        // Viajamos a index.js manteniendo la memoria activa
        router.push('/');
      }
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#ffffff', 
      color: '#000000', 
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', 
      padding: '2rem 1.5rem',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Head>
        <title>{isLogin ? 'Log in - WALCORD' : 'Create Account - WALCORD'}</title>
      </Head>

      <header style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1.5rem', position: 'relative', width: '100%' }}>
        <button onClick={() => router.push('/')} style={{ position: 'absolute', left: 0, background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}>
          ✕
        </button>
        {/* Tu logo intacto */}
        <img 
          src="https://mbrdycxpztjtgsiyxikt.supabase.co/storage/v1/object/public/Assets/logo-walcord.png" 
          alt="Walcord" 
          style={{ width: '140px', height: 'auto', objectFit: 'contain' }} 
        />
      </header>

      <main style={{ maxWidth: '400px', width: '100%', margin: '0 auto', flexGrow: 1 }}>
        <h1 style={{ 
          fontSize: '0.85rem', 
          letterSpacing: '0.15em', 
          textTransform: 'uppercase', 
          marginBottom: '3rem', 
          fontWeight: '400',
          textAlign: 'left'
        }}>
          {isLogin ? 'Log in to your account' : 'Create an Account'}
        </h1>

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          
          {!isLogin && (
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="NAME"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLogin}
                style={{ 
                  width: '100%', border: 'none', borderBottom: '1px solid #000', 
                  padding: '0.5rem 0', fontSize: '0.85rem', letterSpacing: '0.05em', 
                  outline: 'none', backgroundColor: 'transparent', borderRadius: 0
                }}
              />
            </div>
          )}

          <div style={{ position: 'relative' }}>
            <input
              type="email"
              placeholder="EMAIL"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ 
                width: '100%', border: 'none', borderBottom: '1px solid #000', 
                padding: '0.5rem 0', fontSize: '0.85rem', letterSpacing: '0.05em', 
                outline: 'none', backgroundColor: 'transparent', borderRadius: 0
              }}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <input
              type="password"
              placeholder="PASSWORD"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ 
                width: '100%', border: 'none', borderBottom: '1px solid #000', 
                padding: '0.5rem 0', fontSize: '0.85rem', letterSpacing: '0.05em', 
                outline: 'none', backgroundColor: 'transparent', borderRadius: 0
              }}
            />
          </div>

          {message.text && (
            <p style={{ fontSize: '0.75rem', color: '#cc0000', marginTop: '-1.5rem', letterSpacing: '0.03em' }}>
              {message.text}
            </p>
          )}

          <button type="submit" disabled={loading} style={{ 
            width: '100%', padding: '1rem', backgroundColor: '#000', color: '#fff', 
            border: '1px solid #000', textTransform: 'uppercase', letterSpacing: '0.1em', 
            fontSize: '0.85rem', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '1rem', borderRadius: 0,
            transition: 'background-color 0.2s ease',
            opacity: loading ? 0.7 : 1
          }}>
            {loading ? 'PROCESSING...' : 'CONTINUE'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'left' }}>
          <button onClick={() => setIsLogin(!isLogin)} type="button" style={{ 
            background: 'none', border: 'none', textDecoration: 'underline', 
            fontSize: '0.75rem', letterSpacing: '0.05em', cursor: 'pointer',
            padding: 0, color: '#555'
          }}>
            {isLogin ? 'Need an account? Register' : 'Already have an account? Log in'}
          </button>
        </div>
      </main>
    </div>
  );
}
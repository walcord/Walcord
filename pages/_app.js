import '../styles/globals.css';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { useEffect } from 'react';
import supabase from '../lib/supabaseClient';

// Importante: _app.js debe exportar por defecto un componente que envuelva TODA la app
export default function MyApp({ Component, pageProps }) {
  // Evita listeners duplicados en desarrollo con React StrictMode
  useEffect(() => {
    // No añadimos listeners manuales aquí; centralizamos en auth-helpers
    return () => {};
  }, []);

  return (
    <SessionContextProvider supabaseClient={supabase} initialSession={pageProps.initialSession}>
      <Component {...pageProps} />
    </SessionContextProvider>
  );
}

import type { AppProps } from 'next/app';
import { useEffect, useMemo, useState } from 'react';
import '../styles/globals.css';

function AppButtons() {
  // Botones minimalistas, solo cuando corremos dentro de la app
  const go = (path: string) => {
    try {
      // Next Router (si existe)
      // @ts-ignore
      if (window?.next?.router?.push) window.next.router.push(path);
      else window.location.href = path;
    } catch {
      window.location.href = path;
    }
  };

  const logout = async () => {
    // logout web simple: ve a /logout si lo tienes; si no, limpia storage básico y vuelve a /
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    go('/');
  };

  return (
    <div className="wc-fabs">
      <button className="wc-fab wc-fab-primary" onClick={() => go('/wall')}>Wall</button>
      <button className="wc-fab wc-fab-light" onClick={() => go('/profile')}>Profile</button>
      {/* Si no quieres Logout, borra el botón siguiente */}
      <button className="wc-fab wc-fab-ghost" onClick={logout}>⏻</button>
    </div>
  );
}

export default function MyApp({ Component, pageProps }: AppProps) {
  const [isApp, setIsApp] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || '';
    // El WebView RN iOS/Android ya pone "WalcordApp/1.0"
    const app = ua.includes('WalcordApp/');
    setIsApp(app);
    // Añade o quita clase en <html> para CSS global
    const html = document.documentElement;
    if (app) html.classList.add('is-app');
    else html.classList.remove('is-app');
  }, []);

  return (
    <>
      {/* Botones flotantes SOLO en la app */}
      {isApp && <AppButtons />}
      <Component {...pageProps} />
    </>
  );
}

import type { AppProps } from 'next/app';
import { useEffect, useState } from 'react';
import '../styles/globals.css';

function AppButtons() {
  const go = (path: string) => {
    try {
      // Next router (si existe) o fallback duro
      // @ts-ignore
      if (window?.next?.router?.push) window.next.router.push(path);
      else window.location.assign(path);
    } catch {
      window.location.assign(path);
    }
  };

  const logout = async () => {
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
    go('/');
  };

  const back = () => {
    if (history.length > 1) history.back();
    else go('/wall');
  };

  return (
    <>
      {/* Overlay azul que tapa cualquier banner de la web */}
      <div className="app-overlay" />

      {/* Botones minimalistas (arriba-derecha) */}
      <div className="wc-fabs wc-fabs--compact">
        <button className="wc-fab wc-fab-icon" onClick={back} aria-label="Back">←</button>
        <button className="wc-fab wc-fab-primary" onClick={() => go('/wall')}>Wall</button>
        <button className="wc-fab wc-fab-light" onClick={() => go('/profile')}>Profile</button>
        {/* Si NO quieres logout, borra la siguiente línea */}
        <button className="wc-fab wc-fab-icon" onClick={logout} aria-label="Logout">⏻</button>
      </div>
    </>
  );
}

export default function MyApp({ Component, pageProps }: AppProps) {
  const [isApp, setIsApp] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || '';
    const is = /WalcordApp/i.test(ua) || new URLSearchParams(location.search).get('app') === '1';
    setIsApp(is);
    const html = document.documentElement;
    if (is) html.classList.add('is-app');
    else html.classList.remove('is-app');
  }, []);

  return (
    <>
      {isApp && <AppButtons />}
      <Component {...pageProps} />
    </>
  );
}

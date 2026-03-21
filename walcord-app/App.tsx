// pages/_app.tsx
import type { AppProps } from 'next/app'
import '../styles/globals.css'

import { SessionContextProvider } from '@supabase/auth-helpers-react'
import { supabase } from '../lib/supabaseClient'
import AuthProvider from '../components/AuthProvider'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

function shouldHideAndroidBottomBar(pathname: string) {
  return (
    pathname === '/' ||
    pathname === '/welcome' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/onboarding' ||
    pathname === '/auth/login' ||
    pathname === '/auth/signup'
  )
}

function AppButtons({ pathname }: { pathname: string }) {
  const go = (path: string) => {
    try {
      // @ts-ignore
      if (window?.next?.router?.push) window.next.router.push(path)
      else window.location.assign(path)
    } catch {
      window.location.assign(path)
    }
  }

  const back = () => {
    if (history.length > 1) history.back()
    else go('/wall')
  }

  if (pathname === '/welcome') return null

  return (
    <>
      <div
        className="fixed top-0 left-0 w-full z-[9999] pointer-events-none"
        aria-hidden="true"
      >
        <div className="h-8 w-full" style={{ backgroundColor: '#1F48AF' }} />
      </div>

      <div className="fixed top-2 right-2 z-[10000] flex gap-2">
        <button
          onClick={back}
          aria-label="Back"
          className="px-3 h-8 rounded-full border border-white/40 bg-black/40 backdrop-blur text-white text-[12px] leading-8 font-light tracking-wide hover:bg-black/60 transition"
        >
          ←
        </button>

        <button
          onClick={() => go('/wall')}
          className="px-3 h-8 rounded-full border border-white/40 bg-black/40 backdrop-blur text-white text-[12px] leading-8 font-light tracking-wide hover:bg-black/60 transition"
        >
          Wall
        </button>

        <button
          onClick={() => go('/profile')}
          className="px-3 h-8 rounded-full border border-white/40 bg-black/40 backdrop-blur text-white text-[12px] leading-8 font-light tracking-wide hover:bg-black/60 transition"
        >
          Profile
        </button>
      </div>
    </>
  )
}

function AndroidBottomBar({ pathname }: { pathname: string }) {
  const go = (path: string) => {
    try {
      // @ts-ignore
      if (window?.next?.router?.push) window.next.router.push(path)
      else window.location.assign(path)
    } catch {
      window.location.assign(path)
    }
  }

  if (shouldHideAndroidBottomBar(pathname)) return null

  return (
    <div
      className="fixed left-0 right-0 z-[10000] flex justify-center pointer-events-none"
      style={{ bottom: 'max(10px, env(safe-area-inset-bottom))' }}
    >
      <div
        className="pointer-events-auto h-[52px] px-[18px] rounded-[26px] border border-black/10 shadow-lg flex items-center gap-[22px]"
        style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          boxShadow: '0 5px 14px rgba(0,0,0,0.12)',
        }}
      >
        <button
          onClick={() => go('/feed')}
          aria-label="Feed"
          className="text-black/85 text-[13px] font-light tracking-wide active:scale-95 transition"
        >
          Feed
        </button>

        <button
          onClick={() => go('/idol')}
          aria-label="Idol"
          className="text-black/85 text-[13px] font-light tracking-wide active:scale-95 transition"
        >
          Idol
        </button>

        <button
          onClick={() => go('/post/new')}
          aria-label="New post"
          className="text-black/85 text-[18px] leading-none font-light active:scale-95 transition"
        >
          +
        </button>

        <button
          onClick={() => go('/studio')}
          aria-label="Studio"
          className="text-black/85 text-[13px] font-light tracking-wide active:scale-95 transition"
        >
          Studio
        </button>

        <button
          onClick={() => go('/profile')}
          aria-label="Profile"
          className="text-black/85 text-[13px] font-light tracking-wide active:scale-95 transition"
        >
          Profile
        </button>
      </div>
    </div>
  )
}

export default function MyApp({ Component, pageProps }: AppProps) {
  const [isApp, setIsApp] = useState(false)
  const [isAndroidApp, setIsAndroidApp] = useState(false)
  const [isIOSApp, setIsIOSApp] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const ua = navigator.userAgent || ''
    const params = new URLSearchParams(location.search)

    const walcordApp =
      /WalcordApp/i.test(ua) || params.get('app') === '1'

    const androidApp = walcordApp && /Android/i.test(ua)
    const iosApp = walcordApp && /iPhone|iPad|iPod/i.test(ua)

    setIsApp(walcordApp)
    setIsAndroidApp(androidApp)
    setIsIOSApp(iosApp)

    const html = document.documentElement
    html.classList.toggle('is-app', walcordApp)
    html.classList.toggle('is-android-app', androidApp)
    html.classList.toggle('is-ios-app', iosApp)
  }, [])

  return (
    <SessionContextProvider supabaseClient={supabase}>
      <AuthProvider>
        {isApp && <AppButtons pathname={router.pathname} />}
        {isAndroidApp && <AndroidBottomBar pathname={router.pathname} />}
        <Component {...pageProps} />
      </AuthProvider>
    </SessionContextProvider>
  )
}
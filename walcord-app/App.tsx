// pages/_app.tsx
import type { AppProps } from 'next/app'
import '../styles/globals.css'

import { SessionContextProvider } from '@supabase/auth-helpers-react'
import Supabase, { supabase } from '../lib/supabaseClient' // ambas formas por compatibilidad
import AuthProvider from '../components/AuthProvider'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

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
      <div className="fixed top-0 left-0 w-full z-[9999] pointer-events-none" aria-hidden="true">
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

export default function MyApp({ Component, pageProps }: AppProps) {
  const [isApp, setIsApp] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const ua = navigator.userAgent || ''
    const is = /WalcordApp/i.test(ua) || new URLSearchParams(location.search).get('app') === '1'
    setIsApp(is)
    const html = document.documentElement
    if (is) html.classList.add('is-app')
    else html.classList.remove('is-app')
  }, [])
}
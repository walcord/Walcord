'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function Btn({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-3 h-8 rounded-full border border-white/40 bg-black/40 backdrop-blur text-white text-[12px] leading-8 hover:bg-black/60 transition
                 font-light tracking-wide"
    >
      {label}
    </Link>
  );
}

/**
 * Botonera fija superior derecha (debajo de la franja azul).
 * No se muestra en /welcome.
 */
export default function NavButtons() {
  const pathname = usePathname();
  if (pathname === '/welcome') return null;

  return (
    <div className="fixed top-2 right-2 z-[9999] flex gap-2">
      <Btn href="/" label="Wall" />
      <Btn href="/profile" label="Profile" />
    </div>
  );
}

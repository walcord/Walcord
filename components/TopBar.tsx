'use client';

import { useEffect, useState } from 'react';

/**
 * Franja fija superior para tapar el banner del WebView / PWA.
 * Altura pequeña, color azul Walcord, z-index muy alto.
 */
export default function TopBar() {
  const [safeTop, setSafeTop] = useState<number>(0);

  useEffect(() => {
    // Soporte para notch en iOS: respetar safe-area-inset-top si existe
    const style = getComputedStyle(document.documentElement);
    const inset = style.getPropertyValue('--sat') || style.getPropertyValue('--safe-area-inset-top') || '0px';
    const px = parseInt(String(inset).replace('px', '').trim() || '0', 10);
    setSafeTop(Number.isNaN(px) ? 0 : px);
  }, []);

  return (
    <div
      style={{ paddingTop: safeTop }}
      className="fixed top-0 left-0 w-full z-[9999] pointer-events-none"
      aria-hidden="true"
    >
      <div className="h-8 w-full bg-[#1F48AF]" />
    </div>
  );
}

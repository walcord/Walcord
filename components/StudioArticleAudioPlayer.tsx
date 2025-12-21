'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  src: string;                 // audio_url
  title: string;               // article title
  author?: string | null;      // article author
  brand?: string;              // "Walcord"
  artworkUrl?: string | null;  // audio_cover_url (o portada del artículo)
  accentColor?: string;        // Walcord blue
  storageKey?: string;         // persist position per article
};

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export default function StudioArticleAudioPlayer({
  src,
  title,
  author,
  brand = 'Walcord',
  artworkUrl,
  accentColor = '#1F48AF',
  storageKey,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const key = useMemo(() => storageKey || `walcord:studio-audio:${src}`, [storageKey, src]);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  // Restore last position
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const saved = Number(localStorage.getItem(key) || '0');
    if (Number.isFinite(saved) && saved > 0) {
      a.currentTime = saved;
      setCurrent(saved);
    }
  }, [key]);

  // Save position periodically
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onTime = () => {
      setCurrent(a.currentTime || 0);
      localStorage.setItem(key, String(a.currentTime || 0));
    };

    const onLoaded = () => {
      setReady(true);
      setDuration(a.duration || 0);
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onLoaded);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);

    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onLoaded);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
    };
  }, [key]);

  // Media Session (lock screen metadata + headphone controls)
  useEffect(() => {
    // @ts-ignore
    const ms: MediaSession | undefined = (navigator as any).mediaSession;
    if (!ms) return;

    try {
      ms.metadata = new MediaMetadata({
        title: title || 'Walcord Studio',
        artist: author ? `${author}` : brand,
        album: brand,
        artwork: artworkUrl
          ? [
              { src: artworkUrl, sizes: '96x96', type: 'image/png' },
              { src: artworkUrl, sizes: '192x192', type: 'image/png' },
              { src: artworkUrl, sizes: '512x512', type: 'image/png' },
            ]
          : undefined,
      });

      const a = audioRef.current;
      if (!a) return;

      ms.setActionHandler('play', async () => {
        try { await a.play(); } catch {}
      });
      ms.setActionHandler('pause', () => a.pause());
      ms.setActionHandler('seekbackward', () => {
        a.currentTime = Math.max(0, (a.currentTime || 0) - 15);
      });
      ms.setActionHandler('seekforward', () => {
        a.currentTime = Math.min(a.duration || Infinity, (a.currentTime || 0) + 15);
      });
      ms.setActionHandler('seekto', (details: any) => {
        if (typeof details?.seekTime === 'number') a.currentTime = details.seekTime;
      });
    } catch {
      // no-op
    }
  }, [title, author, brand, artworkUrl]);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;

    if (a.paused) {
      try {
        await a.play();
      } catch {
        // iOS requires a user gesture; button click counts as gesture
      }
    } else {
      a.pause();
    }
  };

  const jump = (delta: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(a.duration || Infinity, (a.currentTime || 0) + delta));
  };

  const sliderValue = seeking ? seekValue : current;

  return (
    <div
      style={{
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 16,
        padding: 16,
        background: 'rgba(255,255,255,0.9)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
      }}
    >
      <audio ref={audioRef} src={src} preload="metadata" playsInline />

      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 14,
            overflow: 'hidden',
            background: 'rgba(0,0,0,0.06)',
            flexShrink: 0,
          }}
        >
          {artworkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={artworkUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : null}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'Times New Roman, Times, serif',
              fontSize: 16,
              letterSpacing: 0.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
          <div
            style={{
              marginTop: 4,
              fontFamily: 'Roboto, system-ui, -apple-system, Segoe UI, Arial',
              fontSize: 12,
              opacity: 0.65,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {author ? `${author} · ${brand}` : brand}
          </div>
        </div>

        <button
          onClick={() => jump(-15)}
          aria-label="Back 15s"
          style={{
            width: 38,
            height: 38,
            borderRadius: 999,
            border: '1px solid rgba(0,0,0,0.10)',
            background: 'white',
            fontFamily: 'Roboto, system-ui',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          -15
        </button>

        <button
          onClick={toggle}
          aria-label={playing ? 'Pause' : 'Play'}
          style={{
            width: 46,
            height: 46,
            borderRadius: 999,
            border: 'none',
            background: accentColor,
            color: 'white',
            cursor: 'pointer',
            fontFamily: 'Roboto, system-ui',
            fontSize: 12,
            boxShadow: `0 10px 20px ${accentColor}33`,
          }}
        >
          {playing ? 'II' : '▶'}
        </button>

        <button
          onClick={() => jump(15)}
          aria-label="Forward 15s"
          style={{
            width: 38,
            height: 38,
            borderRadius: 999,
            border: '1px solid rgba(0,0,0,0.10)',
            background: 'white',
            fontFamily: 'Roboto, system-ui',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          +15
        </button>
      </div>

      <div style={{ marginTop: 14 }}>
        <input
          type="range"
          min={0}
          max={Math.max(1, duration)}
          step={0.1}
          value={Math.min(Math.max(0, sliderValue), duration || sliderValue)}
          onMouseDown={() => setSeeking(true)}
          onMouseUp={() => {
            setSeeking(false);
            const a = audioRef.current;
            if (!a) return;
            a.currentTime = seekValue;
          }}
          onTouchStart={() => setSeeking(true)}
          onTouchEnd={() => {
            setSeeking(false);
            const a = audioRef.current;
            if (!a) return;
            a.currentTime = seekValue;
          }}
          onChange={(e) => {
            const v = Number(e.target.value || '0');
            setSeekValue(v);
            if (!seeking) {
              const a = audioRef.current;
              if (!a) return;
              a.currentTime = v;
            }
          }}
          style={{ width: '100%', accentColor }}
          aria-label="Seek"
        />

        <div
          style={{
            marginTop: 8,
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'Roboto, system-ui',
            fontSize: 12,
            opacity: 0.7,
          }}
        >
          <span>{formatTime(current)}</span>
          <span>{ready ? formatTime(duration) : '—:—'}</span>
        </div>
      </div>
    </div>
  );
}

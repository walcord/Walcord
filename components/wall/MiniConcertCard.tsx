"use client";

import Link from "next/link";

export default function MiniConcertCard({
  image_urls,
  authorId,
  authorUsername,
  authorName,
  authorAvatar,
}: {
  image_urls: string[];
  authorId?: string;
  authorUsername?: string | null;
  authorName?: string;
  authorAvatar?: string;
}) {
  const pics = (image_urls || []).slice(0, 4);
  const profileHref =
    authorUsername && authorUsername.trim().length > 0
      ? `/u/${authorUsername}`
      : authorId
      ? `/u/${authorId}`
      : undefined;

  const CardInner = (
    <div className="relative w-full rounded-2xl border border-black/10 p-2">
      {/* Overlay autor */}
      {(authorName || authorAvatar) && (
        <div className="absolute left-2 top-2 z-10">
          <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-black/55 text-white backdrop-blur">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {authorAvatar ? (
              <img
                src={authorAvatar}
                alt=""
                className="h-5 w-5 rounded-full object-cover bg-neutral-300"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="h-5 w-5 rounded-full bg-neutral-300" />
            )}
            <span className="text-[12px] leading-none">{authorName || "User"}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {pics.map((src, i) => (
          <div key={i} className="aspect-square overflow-hidden rounded-xl bg-neutral-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
          </div>
        ))}
      </div>
    </div>
  );

  return profileHref ? <Link href={profileHref}>{CardInner}</Link> : CardInner;
}

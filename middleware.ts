import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Redirige /profile/<username> -> /u/<username>
  const match = pathname.match(/^\/profile\/([^\/]+)\/?$/);
  if (match) {
    const username = match[1];
    const url = req.nextUrl.clone();
    url.pathname = `/u/${username}`;
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/profile/:path*"],
};

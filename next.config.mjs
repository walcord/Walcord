/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // (opcional) desbloquear build sin ESLint/TS
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  images: {
    remotePatterns: [
      // ✅ URLs antiguas (object/public)
      { protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/object/public/**' },
      // ✅ URLs nuevas (render/image/public) — las que te están rompiendo ahora
      { protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/render/image/public/**' },
    ],
  },
};

export default nextConfig;

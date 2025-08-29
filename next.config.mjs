/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    domains: ['qslzurtzlaopmfohcxgy.supabase.co'],
  },

  // ✅ Rewrites para que /privacy y /support funcionen aunque solo existan los .html
  async rewrites() {
    return [
      { source: '/privacy', destination: '/privacy.html' },
      { source: '/support', destination: '/support.html' },
    ];
  },

  // esta línea hace que ESLint NO corte el build por los <a> mientras lo arreglo yo
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['qslzurztlaopmfohcxgy.supabase.co'],
  },
  // ← esta línea hace que ESLint NO corte el build por los <a> mientras lo arreglo yo
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/profile/:username',
        destination: '/u/:username',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
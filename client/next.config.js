/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Allows the leaflet imports to remain client-only without breaking SSG.
    optimizePackageImports: ['lucide-react'],
  },
};

module.exports = nextConfig;

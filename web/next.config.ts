import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/clinic',
        destination: '/search',
        permanent: false,
      },
      {
        source: '/clinic/:path*',
        destination: '/search',
        permanent: false,
      },
      {
        source: '/clinics',
        destination: '/search',
        permanent: false,
      },
      {
        // Renamed "Find My Treatment" slug — keep old links/SEO working.
        source: '/skin-navigator',
        destination: '/ai-aesthetic-treatment-finder',
        permanent: true,
      },
      {
        // Renamed public clinic page route — keep old links/SEO working.
        source: '/clinics/:slug',
        destination: '/practices/:slug',
        permanent: true,
      }
    ];
  },
};

export default nextConfig;

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
      }
    ];
  },
};

export default nextConfig;

import type { NextConfig } from 'next';
import { site } from './src/lib/site';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  // `/about/` permanently redirects to `/about`; one canonical form per URL.
  trailingSlash: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [70, 75],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: site.indexable
          ? securityHeaders
          : // Previews and staging must never be indexed, whatever a crawler makes of robots.txt.
            [...securityHeaders, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
  async redirects() {
    // Earlier or guessable addresses for the same content. One canonical URL each.
    return [
      { source: '/features/ai-persona', destination: '/ai-persona', permanent: true },
      { source: '/features/compatibility', destination: '/compatibility', permanent: true },
      { source: '/features/discovery', destination: '/features#discovery', permanent: true },
      { source: '/features/safety', destination: '/safety', permanent: true },
      { source: '/persona', destination: '/ai-persona', permanent: true },
      { source: '/home', destination: '/', permanent: true },
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/privacy-policy', destination: '/privacy', permanent: true },
      { source: '/terms-of-service', destination: '/terms', permanent: true },
    ];
  },
};

export default config;

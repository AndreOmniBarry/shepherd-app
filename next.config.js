/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // PWA off in dev — faster HMR
  runtimeCaching: [
    {
      // Cache Supabase API calls for offline graceful degradation
      urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'supabase-rest',
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 50, maxAgeSeconds: 300 },
      },
    },
    {
      // Cache static assets aggressively
      urlPattern: /\.(js|css|woff2?)$/,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'static-assets' },
    },
  ],
});

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // Reduce memory pressure on the 2014 MacBook Air dev server
  experimental: {
    optimizeCss: false,        // don't add extra build step
    workerThreads: false,      // single-thread safer on i5 1.4GHz
    cpus: 1,                   // cap parallel compilation
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',         value: 'DENY' },
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js needs unsafe-eval in dev
              "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
              `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL} https://api.anthropic.com wss://*.supabase.co`,
              "img-src 'self' data: blob:",
              "font-src 'self' https://cdn.jsdelivr.net data:",
            ].join('; '),
          },
        ],
      },
      // Pastor dashboard: no indexing
      {
        source: '/dashboard/(.*)',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

module.exports = withPWA(nextConfig);

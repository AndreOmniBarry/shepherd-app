/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // PWA off in dev — faster HMR
  // Exclude setup and auth pages from SW precache
  publicExcludes: ['!setup', '!login', '!register'],
  buildExcludes: [/middleware-manifest\.json$/],
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
      // NetworkFirst (not StaleWhileRevalidate) — with fast-moving daily
      // deploys, "stale-while-revalidate" was serving the OLD bundle on
      // every visit and only refreshing the cache in the background for
      // next time, so a freshly deployed change could take multiple
      // reloads to ever actually show up. NetworkFirst tries the network
      // first and only falls back to cache if the network is genuinely
      // unavailable, so testers see the real latest deploy immediately.
      urlPattern: /\.(js|css|woff2?)$/,
      handler: 'NetworkFirst',
      options: { cacheName: 'static-assets', networkTimeoutSeconds: 5 },
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
          // Tells the browser to only ever contact this host over HTTPS —
          // including on the very first visit for anyone who types
          // "justshephrd.com" without a scheme — for the next 2 years, and
          // to apply that to every subdomain too. This is separate from the
          // TLS certificate itself (see chat): that's issued and terminated
          // by the hosting platform (Vercel), not by app code. This header
          // only closes the plain-HTTP downgrade window that sits in front
          // of a cert that's otherwise already working.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js needs unsafe-eval in dev
              "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
              `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL} https://api.anthropic.com wss://*.supabase.co`,
              `img-src 'self' data: blob: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`,
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
      // The service worker file itself must never be cached — if a
      // browser/CDN holds onto an old sw.js, it never even learns a new
      // one exists, so every runtime-caching fix above becomes moot.
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
    ];
  },
};

module.exports = withPWA(nextConfig);

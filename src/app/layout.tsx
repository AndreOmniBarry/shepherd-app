import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/hooks/useTheme';
import AudioUnlocker from '@/components/AudioUnlocker';
import AppLockGate from '@/components/AppLockGate';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const SITE_URL = 'https://justshephrd.com';
const SITE_TITLE = 'SHEP.HERD | The Comforters House Global';
const SITE_DESCRIPTION = 'Church management and growth intelligence platform';

export const metadata: Metadata = {
  // Base for resolving relative URLs in openGraph/twitter images below —
  // without this Next.js falls back to whatever host actually served the
  // request, so a link preview could resolve against a preview/Vercel
  // deployment URL instead of the real domain depending on where it's
  // fetched from.
  metadataBase: new URL(SITE_URL),
  title: {
    template: '%s — SHEP.HERD',
    default:  SITE_TITLE,
  },
  description: SITE_DESCRIPTION,
  manifest: '/manifest.json',
  themeColor: '#3C3489',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,   // Prevent zoom on attendance form inputs (mobile)
  },
  icons: {
    icon:  '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  // Link-preview card when justshephrd.com is shared in WhatsApp, Slack,
  // Twitter/X, iMessage etc. Reuses the 512px app icon as the preview
  // image — not a proper 1200x630 social banner, but a real logo beats no
  // preview at all. Swap in a dedicated banner under /public later if one
  // gets designed.
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: 'SHEP.HERD',
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'SHEP.HERD' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/icons/icon-512.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </head>
      <body className="bg-gray-50 text-gray-900 antialiased min-h-screen">
        <ThemeProvider><AudioUnlocker /><AppLockGate />{children}</ThemeProvider>
      </body>
    </html>
  );
}

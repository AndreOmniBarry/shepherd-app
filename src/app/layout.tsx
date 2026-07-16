import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    template: '%s — SHEP.HERD',
    default:  'SHEP.HERD | The Comforters House Global',
  },
  description: 'Church management and growth intelligence platform',
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tabler-icons/3.19.0/iconfont/tabler-icons.min.css" />
    </head>
      <body className="bg-gray-50 text-gray-900 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}

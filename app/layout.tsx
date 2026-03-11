// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'TechMold POS',
  description: 'Professional Point of Sale System for TechMold Tech Shop — works online & offline',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TechMold POS',
    startupImage: [
      { url: '/icons/icon-512x512.png' },
    ],
  },
  icons: {
    icon: [
      { url: '/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/icons/icon.svg', color: '#00D4FF' },
    ],
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'application-name': 'TechMold POS',
    'msapplication-TileColor': '#080c10',
    'msapplication-TileImage': '/icons/icon-144x144.png',
    'msapplication-config': 'none',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#080c10',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* PWA / iOS */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TechMold POS" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-startup-image" href="/icons/icon-512x512.png" />

        {/* Windows tiles */}
        <meta name="msapplication-TileColor" content="#080c10" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />

        {/* Misc */}
        <meta name="format-detection" content="telephone=no" />
        <meta name="HandheldFriendly" content="true" />
      </head>
      <body className="font-body antialiased">
        {children}

        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1a2029',
              color: '#f0f6fc',
              border: '1px solid rgba(0,212,255,0.2)',
              borderRadius: '10px',
              fontFamily: 'DM Sans, system-ui, sans-serif',
              fontSize: '13px',
              maxWidth: '380px',
            },
            success: { iconTheme: { primary: '#3fb950', secondary: '#1a2029' }, duration: 3000 },
            error: { iconTheme: { primary: '#f85149', secondary: '#1a2029' }, duration: 4000 },
          }}
        />

        {/* Service Worker registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
                    .then(function(reg) {
                      console.log('[App] SW registered:', reg.scope);
                      // Check for updates every 60 seconds
                      setInterval(function() { reg.update(); }, 60000);
                    })
                    .catch(function(err) {
                      console.warn('[App] SW registration failed:', err);
                    });

                  // Listen for SW updates
                  navigator.serviceWorker.addEventListener('controllerchange', function() {
                    console.log('[App] SW updated — reloading for fresh content');
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}

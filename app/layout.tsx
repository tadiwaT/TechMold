// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'TechMold POS',
  description: 'Professional Point of Sale System for TechMold Tech Shop',
  manifest: '/manifest.json',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor: '#080c10',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-body antialiased">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1a2029',
              color: '#f0f6fc',
              border: '1px solid rgba(0,212,255,0.2)',
              borderRadius: '8px',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#3fb950', secondary: '#1a2029' },
            },
            error: {
              iconTheme: { primary: '#f85149', secondary: '#1a2029' },
            },
          }}
        />
      </body>
    </html>
  )
}

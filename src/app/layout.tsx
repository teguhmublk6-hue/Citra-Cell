import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { FirebaseClientProvider } from '@/firebase/client-provider'

export const metadata: Metadata = {
  title: 'Brimo UI Enhancer',
  description: 'A modern financial dashboard',
  manifest: '/manifest.json',
  themeColor: '#0d1117',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <FirebaseClientProvider>
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  )
}

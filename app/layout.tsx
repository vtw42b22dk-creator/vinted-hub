import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/AuthContext'
import AuthGate from '@/components/AuthGate'
import { getBasePath, getSiteUrl } from '@/lib/config'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const basePath = getBasePath()
const siteUrl = getSiteUrl() || 'https://vtw42b22dk-creator.github.io/vinted-hub'

export const metadata: Metadata = {
  title: 'Vinted Hub — Dashboard de Revenda',
  description: 'Dashboard privado para gerir Vinted: mensagens, negociações e inventário',
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    title: 'Vinted Hub',
  },
  metadataBase: new URL(siteUrl),
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-slate-50 font-sans antialiased`}
      >
        <AuthProvider>
          <AuthGate>{children}</AuthGate>
        </AuthProvider>
      </body>
    </html>
  )
}

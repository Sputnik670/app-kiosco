import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { PWAProvider, InstallPrompt, UpdatePrompt } from "@/components/pwa"
import { ThemeProvider } from "@/components/theme-provider"

const inter = Inter({ subsets: ["latin"] })

/**
 * Viewport configuration para PWA
 * Sincronizado con manifest.json (theme_color: #0f172a)
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  // Sincronizado con manifest.json theme_color
  themeColor: '#0f172a',
}

/**
 * Metadata para PWA
 * Sincronizado con manifest.json
 */
export const metadata: Metadata = {
  title: "Kiosco App - Gestión Inteligente",
  description: "Sistema profesional de gestión para kioscos y comercios pequeños. Control de inventario, ventas, caja y empleados en tiempo real.",
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Kiosco App',
  },
  // OpenGraph para compartir
  openGraph: {
    title: 'Kiosco App',
    description: 'Sistema de gestión para kioscos',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <PWAProvider showConnectionStatus={true} connectionStatusPosition="top">
            {children}
            {/* PWA Installation & Update Prompts */}
            <InstallPrompt position="bottom" showDelay={30000} />
            <UpdatePrompt autoDismissDelay={10000} />
          </PWAProvider>
          <Analytics />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
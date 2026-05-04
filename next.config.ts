import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  fallbacks: {
    document: "/offline.html",
  },
  workboxOptions: {
    // Archivos a precachear
    additionalManifestEntries: [
      { url: "/offline.html", revision: "1" },
      { url: "/manifest.json", revision: "1" },
    ],
    // Excluir archivos grandes y API routes
    exclude: [
      /\.map$/,
      /^.*\/api\/.*$/,
      /_buildManifest\.js$/,
      /_ssgManifest\.js$/,
    ],
    // Estrategias de runtime caching
    runtimeCaching: [
      // Stale-While-Revalidate para fuentes de Google
      {
        urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "google-fonts",
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 año
          },
        },
      },
      // Stale-While-Revalidate para activos estáticos
      {
        urlPattern: /\.(?:js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "static-assets",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 días
          },
        },
      },
      // Network First para páginas HTML (datos dinámicos)
      {
        urlPattern: /^https?:\/\/.*\/(?!api\/).*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "pages-cache",
          networkTimeoutSeconds: 10,
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 24 * 60 * 60, // 1 día
          },
        },
      },
      // Network Only para Supabase (siempre en línea)
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: "NetworkOnly",
      },
    ],
  },
});

const nextConfig: NextConfig = {
  // Configuración para Turbopack (Next.js 16+)
  turbopack: {},

  // Packages que NO se bundlean — Next.js los resuelve via require() en runtime.
  // Necesario para CJS-only packages que Turbopack no resuelve bien al bundlear
  // dynamic imports en server actions (qrcode, jspdf en lib/services/invoice-pdf.ts).
  // El error sin esto: "Module not found: Can't resolve 'qrcode'" en Vercel build.
  serverExternalPackages: ['qrcode', 'jspdf', '@arcasdk/core'],

  // Server Actions: permitir orígenes válidos para evitar 403 CSRF
  // Incluye dominio producción + patrón de preview deploys de Vercel
  experimental: {
    serverActions: {
      allowedOrigins: [
        'app-kiosco-chi.vercel.app',
        'app-kiosco-git-main-sputnik670s-projects.vercel.app',
        'localhost:3000',
      ],
    },
  },
};

export default withPWA(nextConfig);

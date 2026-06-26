import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";

import { Footer } from "@/components/nav/Footer";
import { TopNav } from "@/components/nav/TopNav";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// `theme-color` must live in `viewport`, not `metadata`, per the Next.js 16
// App Router metadata conventions. Putting it under `metadata` either silently
// no-ops or breaks the type.
export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Disabling user-scalable would be hostile — a11y win keeping it on.
};

export const metadata: Metadata = {
  title: {
    default: "BoketePR — Reporta los hoyos de Puerto Rico",
    template: "%s · BoketePR",
  },
  description:
    "Reporta los hoyos de Puerto Rico con una foto y tu ubicación. Nuestra IA los clasifica para que las autoridades sepan cuáles arreglar primero.",
  keywords: [
    "hoyos",
    "Puerto Rico",
    "potholes",
    "carreteras",
    "DTOP",
    "reportar",
  ],
  authors: [{ name: "BoketePR" }],
  creator: "BoketePR",
  applicationName: "BoketePR",
  // Apple-specific PWA metadata. iOS Safari reads these, not the web manifest,
  // for the "Add to Home Screen" name + icon + status bar styling.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BoketePR",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "es_PR",
    url: "https://boketepr.vercel.app",
    siteName: "BoketePR",
    title: "BoketePR — Reporta los hoyos de Puerto Rico",
    description:
      "Reporta los hoyos de Puerto Rico con una foto y tu ubicación. Nuestra IA los clasifica para que las autoridades sepan cuáles arreglar primero.",
  },
  twitter: {
    card: "summary_large_image",
    title: "BoketePR — Reporta los hoyos de Puerto Rico",
    description:
      "Reporta los hoyos de Puerto Rico con una foto y tu ubicación.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-PR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <TopNav />
        <main className="flex-1">{children}</main>
        <Footer />
        {/* SW registration is production-only (see component). */}
        <ServiceWorkerRegistrar />
        {/* InstallPrompt renders nothing on the server; safe to include here. */}
        <InstallPrompt />
        {/* Vercel Analytics: page views, custom events, Web Vitals.
            Free on the Vercel hobby plan; no env vars needed for the
            basic integration (the project id is auto-detected from
            Vercel deployment context). */}
        <Analytics />
      </body>
    </html>
  );
}

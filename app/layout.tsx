import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Footer } from "@/components/nav/Footer";
import { TopNav } from "@/components/nav/TopNav";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      </body>
    </html>
  );
}

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Security headers (SEC-003 in the security audit).
   *
   * Defaults that apply to every response. Some routes add their own
   * headers (e.g. /api/reports adds `Retry-After` on 429); those take
   * precedence because NextResponse.headers.set overrides these.
   *
   *   - HSTS: lock to HTTPS for 2 years (preload-ready).
   *   - X-Content-Type-Options: nosniff — stop MIME-sniffing of JSON / SVG / etc.
   *   - X-Frame-Options: DENY — block clickjacking via iframe. We don't
   *     need to be embedded anywhere.
   *   - Referrer-Policy: strict-origin-when-cross-origin — leak only the
   *     origin (not full URL) to external sites.
   *   - Permissions-Policy: allow camera + geolocation only on our origin.
   *     Microphone and other sensors are denied.
   *   - CSP: allow the script + image + connect sources we actually use.
   *     `unsafe-inline` for script-src is required by Next.js's hydration
   *     inline scripts. Tighten to nonces when migrating to Next.js 16
   *     nonce support. Note: Google Maps APIs load from *.googleapis.com
   *     and *.gstatic.com; Supabase Storage + Realtime from *.supabase.co.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(self), microphone=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // photos, thumbnails, avatars from Supabase; Google tiles; data/blob for previews
              "img-src 'self' data: blob: https://*.supabase.co https://*.googleapis.com https://maps.gstatic.com https://*.ggpht.com",
              // Next.js hydration requires 'unsafe-inline' script-src until we migrate to nonces
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://*.gstatic.com",
              // Supabase REST + Realtime (wss); Google Maps Directions/Places
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.googleapis.com",
              // Google Places Autocomplete uses an iframe
              "frame-src 'self' https://*.google.com",
              // Tailwind / Next.js inline styles
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

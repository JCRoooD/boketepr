/**
 * Severity bucket helper — shared between the submit success state, the map
 * pins, the shareable /report/[id] page, and the profile.
 *
 * Keep the four-bucket model (Leve / Moderado / Severo / Peligroso) in one
 * place so the legend, the pin colors, and the badge colors stay in sync.
 *
 * Buckets (matches the report success card from Goal 3 + 4):
 *   Leve       — 1.0 .. 3.0   (green)
 *   Moderado   — 3.1 .. 6.0   (yellow)
 *   Severo     — 6.1 .. 8.0   (orange)
 *   Peligroso  — 8.1 .. 10.0  (red)
 *
 * The boundaries are inclusive at the bottom, exclusive at the top
 * (severity=3 is Leve, severity=3.1 is Moderado, etc.).
 */

export type SeverityBucket = "leve" | "moderado" | "severo" | "peligroso";

export interface SeverityStyle {
  /** Stable id used for keys, class composition, etc. */
  bucket: SeverityBucket;
  /** Spanish label shown to the user. */
  label: string;
  /** Tailwind classes for the badge background + text (light + dark). */
  badgeBg: string;
  badgeText: string;
  /** Solid hex color used for map pins (Google Maps needs a real color, not a class). */
  pinColor: string;
  /** Hex color for the white ring around the pin glyph. */
  pinBorder: string;
  /** A short, uppercase tag for compact UI (legend swatches, etc.). */
  shortLabel: string;
}

export function bucketFor(severity: number): SeverityBucket {
  if (severity <= 3) return "leve";
  if (severity <= 6) return "moderado";
  if (severity <= 8) return "severo";
  return "peligroso";
}

export function severityStyle(severity: number): SeverityStyle {
  const bucket = bucketFor(severity);
  switch (bucket) {
    case "leve":
      return {
        bucket,
        label: "Leve",
        badgeBg: "bg-green-100 dark:bg-green-950/40",
        badgeText: "text-green-800 dark:text-green-200",
        pinColor: "#16a34a", // green-600
        pinBorder: "#ffffff",
        shortLabel: "LEVE",
      };
    case "moderado":
      return {
        bucket,
        label: "Moderado",
        badgeBg: "bg-yellow-100 dark:bg-yellow-950/40",
        badgeText: "text-yellow-800 dark:text-yellow-200",
        pinColor: "#ca8a04", // yellow-600
        pinBorder: "#ffffff",
        shortLabel: "MOD",
      };
    case "severo":
      return {
        bucket,
        label: "Severo",
        badgeBg: "bg-orange-100 dark:bg-orange-950/40",
        badgeText: "text-orange-800 dark:text-orange-200",
        pinColor: "#ea580c", // orange-600
        pinBorder: "#ffffff",
        shortLabel: "SEV",
      };
    case "peligroso":
      return {
        bucket,
        label: "Peligroso",
        badgeBg: "bg-red-100 dark:bg-red-950/40",
        badgeText: "text-red-800 dark:text-red-200",
        pinColor: "#dc2626", // red-600
        pinBorder: "#ffffff",
        shortLabel: "PEL",
      };
  }
}

/**
 * The four buckets in display order, used for the map legend.
 */
export const ALL_BUCKETS: SeverityStyle[] = [
  severityStyle(1),
  severityStyle(4),
  severityStyle(7),
  severityStyle(9),
];

import { PinProps } from "@vis.gl/react-google-maps";

import { severityStyle } from "@/lib/reports/severity";

/**
 * Map a severity (1.0..10.0) to the props for `<Pin>` from
 * `@vis.gl/react-google-maps`. Used inside `<AdvancedMarker>` to draw a
 * colored, numbered pin.
 *
 * Why a function instead of a component: Pin is a *props configuration*
 * — you spread it into the AdvancedMarker child, not a rendered React
 * element of its own. A function matches the API better.
 *
 * Visual: a teardrop pin with the severity number as the glyph, white
 * border, severity-bucket color background.
 *
 *   - Leve (≤3)       → green pin
 *   - Moderado (≤6)   → yellow pin
 *   - Severo (≤8)     → orange pin
 *   - Peligroso (>8)  → red pin
 */
export function pinElementProps(severity: number): PinProps {
  const style = severityStyle(severity);
  return {
    background: style.pinColor,
    borderColor: style.pinBorder,
    glyph: severity.toFixed(1),
    glyphColor: "#ffffff",
  };
}

/**
 * Pin styling for a recently-fixed report (migration 0007).
 *
 * The map keeps fixed pins visible for 30 days as a small green check
 * so users see which nearby hoyos have been repaired without needing
 * to click. After 30 days the pin falls off the map (query filter).
 *
 * Color: a darker, more saturated green than "Leve" so it visually
 * reads as "done" rather than "low severity". White checkmark glyph.
 */
export function fixedPinElementProps(): PinProps {
  return {
    background: "#16a34a", // green-600
    borderColor: "#14532d", // green-900
    glyph: "✓",
    glyphColor: "#ffffff",
  };
}
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

import { ALL_BUCKETS } from "@/lib/reports/severity";

/**
 * Small fixed-position legend for the public map. Shows the four
 * severity buckets with their colors so first-time users can decode
 * the pins at a glance.
 *
 * Pinned bottom-left so it doesn't fight with the "Reportar un hoyo"
 * CTA (top-right) or the recenter button (bottom-right).
 */
export function SeverityLegend() {
  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 z-10 rounded-lg border border-border/50 bg-background/90 px-3 py-2 text-xs shadow-md backdrop-blur">
      <p className="mb-1.5 font-semibold text-foreground">Severidad</p>
      <ul className="flex flex-col gap-1">
        {ALL_BUCKETS.map((b) => (
          <li key={b.bucket} className="flex items-center gap-2">
            <span
              className="inline-block size-3 rounded-full border border-white shadow-sm"
              style={{ backgroundColor: b.pinColor }}
              aria-hidden="true"
            />
            <span className="text-foreground">{b.label}</span>
            <span className="text-muted-foreground">
              ({b.bucket === "leve"
                ? "1-3"
                : b.bucket === "moderado"
                  ? "4-6"
                  : b.bucket === "severo"
                    ? "7-8"
                    : "9-10"}
              )
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

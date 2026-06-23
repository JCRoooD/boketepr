import { Card, CardContent } from "@/components/ui/card";
import { severityStyle } from "@/lib/reports/severity";

/**
 * StatsCard — server component for /profile.
 *
 * Computes a per-user breakdown of submitted reports:
 *   - Total + Active vs Fixed count
 *   - Severity bucket counts (Leve / Moderado / Severo / Peligroso)
 *
 * Stats come from `lib/profile/stats.ts`. Empty buckets show "0"
 * rather than being omitted — keeps the layout stable as data fills in.
 *
 * We hard-code the bucket ranges here (matches `bucketFor` in
 * `lib/reports/severity.ts`). They're tiny constants — moving them
 * to a shared module would just be ceremony.
 */

export interface ProfileStats {
  total: number;
  active: number;
  fixed: number;
  byBucket: Record<"leve" | "moderado" | "severo" | "peligroso", number>;
}

export interface StatsCardProps {
  stats: ProfileStats;
}

const BUCKETS: Array<{
  id: "leve" | "moderado" | "severo" | "peligroso";
  label: string;
  range: string;
  /** Severity value used to look up the bucket's style (any value inside the bucket). */
  representativeSeverity: number;
}> = [
  { id: "leve", label: "Leve", range: "1.0–3.0", representativeSeverity: 2 },
  { id: "moderado", label: "Moderado", range: "3.1–6.0", representativeSeverity: 4 },
  { id: "severo", label: "Severo", range: "6.1–8.0", representativeSeverity: 7 },
  { id: "peligroso", label: "Peligroso", range: "8.1–10.0", representativeSeverity: 9 },
];

export function StatsCard({ stats }: StatsCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Tu actividad
          </h2>
          <p className="text-xs text-muted-foreground">
            Resumen de tus reportes en BoketePR.
          </p>
        </div>

        {/* Total + active vs fixed */}
        <dl className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-md bg-muted/50 px-2 py-2">
            <dt className="text-xs text-muted-foreground">Total</dt>
            <dd className="text-2xl font-bold tabular-nums">
              {stats.total}
            </dd>
          </div>
          <div className="rounded-md bg-muted/50 px-2 py-2">
            <dt className="text-xs text-muted-foreground">Activos</dt>
            <dd className="text-2xl font-bold tabular-nums text-foreground">
              {stats.active}
            </dd>
          </div>
          <div className="rounded-md bg-muted/50 px-2 py-2">
            <dt className="text-xs text-muted-foreground">Reparados</dt>
            <dd className="text-2xl font-bold tabular-nums text-green-600">
              {stats.fixed}
            </dd>
          </div>
        </dl>

        {/* Severity breakdown */}
        {stats.total > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
              Por severidad
            </h3>
            <ul className="flex flex-col gap-1.5">
              {BUCKETS.map((bucket) => {
                const count = stats.byBucket[bucket.id];
                if (count === 0) return null;
                const style = severityStyle(bucket.representativeSeverity);
                return (
                  <li
                    key={bucket.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block size-3 rounded-full"
                        style={{ backgroundColor: style.pinColor }}
                        aria-hidden="true"
                      />
                      <span className="text-foreground">{bucket.label}</span>
                      <span className="text-xs text-muted-foreground">
                        ({bucket.range})
                      </span>
                    </span>
                    <span className="tabular-nums font-medium">{count}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {stats.total === 0 && (
          <p className="text-sm text-muted-foreground">
            Aún no has reportado ningún hoyo.{" "}
            <a
              href="/submit"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Reporta uno
            </a>{" "}
            para empezar.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
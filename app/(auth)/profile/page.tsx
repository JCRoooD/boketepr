import Link from "next/link";
import { LogOut } from "lucide-react";

import { signOut } from "@/app/auth/actions";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ReportListItem } from "@/components/profile/ReportListItem";
import { StatsCard } from "@/components/profile/StatsCard";
import { Button } from "@/components/ui/button";
import { fetchProfileStats } from "@/lib/profile/stats";
import { createClient } from "@/lib/supabase/server";

/**
 * /profile — Goal 6 full version.
 *
 * Sections, top to bottom:
 *   1. Avatar + name header (client: edit-in-place)
 *   2. Email + member-since (read-only)
 *   3. Stats card (total + active vs fixed + severity buckets)
 *   4. Report history list (most recent 20, with thumbnails and
 *      a "view all" link if more)
 *   5. Sign-out button + "report another hoyo" CTA
 *
 * Server component. The interactive bits (AvatarUpload, ProfileForm)
 * are client components composed here.
 *
 * RLS note: we read the user's own reports without a separate check
 * because the `reports_read_all` policy allows public reads; we
 * additionally `.eq("user_id", user.id)` so the result only
 * includes this user's rows.
 */
export const metadata = {
  title: "Mi perfil · BoketePR",
};

const HISTORY_LIMIT = 20;

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null; // middleware should have redirected
  }

  // Fetch the profile row + stats + report history in parallel.
  const [profileRes, stats, historyRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url, reports_submitted, created_at")
      .eq("id", user.id)
      .single(),
    fetchProfileStats(user.id),
    supabase
      .from("reports")
      .select(
        "id, severity, severity_reason, status, created_at, photo_url, thumbnail_url, user_comment, lat, lng",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);

  const profile = profileRes.data;
  const history = historyRes.data ?? [];

  const fallbackName =
    profile?.display_name ??
    (user.user_metadata?.display_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Usuario BoketePR";

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("es-PR", {
        year: "numeric",
        month: "long",
      })
    : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-col gap-6">
        {/* Page header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Mi perfil</h1>
          <p className="text-sm text-muted-foreground">
            Tu cuenta en BoketePR.
          </p>
        </div>

        {/* Avatar + name (client components) */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
          <AvatarUpload
            currentUrl={profile?.avatar_url ?? null}
            fallbackName={fallbackName}
          />
          <div className="flex-1 space-y-3">
            <ProfileForm initialDisplayName={profile?.display_name ?? ""} />

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="space-y-1">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  Correo
                </dt>
                <dd className="font-medium break-all">{user.email}</dd>
              </div>
              {memberSince && (
                <div className="space-y-1">
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                    Miembro desde
                  </dt>
                  <dd className="font-medium">{memberSince}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Stats */}
        <StatsCard stats={stats} />

        {/* Report history */}
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Mis reportes</h2>
            {history.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Mostrando los {history.length} más recientes
              </span>
            )}
          </div>

          {history.length === 0 ? (
            <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-6 text-center">
              <p className="text-sm text-foreground">
                Aún no has reportado ningún hoyo.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                <Link
                  href="/submit"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Reporta el primero
                </Link>{" "}
                y aparecerá aquí.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {history.map((r) => (
                <li key={r.id}>
                  <ReportListItem report={r} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <form action={signOut}>
            <Button type="submit" variant="outline">
              <LogOut className="size-4" aria-hidden="true" />
              Cerrar sesión
            </Button>
          </form>
          <Link
            href="/"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
import { LogOut } from "lucide-react";

import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Mi perfil · BoketePR",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Middleware should have redirected, but defensive check.
    return null;
  }

  // Fetch the profile row (auto-created on signup by the handle_new_user trigger).
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, reports_submitted, created_at")
    .eq("id", user.id)
    .single();

  const displayName =
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
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Mi perfil</h1>
          <p className="text-sm text-muted-foreground">
            Tu cuenta en BoketePR.
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-card p-6 shadow-sm">
          <dl className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-1.5">
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                Nombre
              </dt>
              <dd className="text-base font-medium">{displayName}</dd>
            </div>
            <div className="space-y-1.5">
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                Correo
              </dt>
              <dd className="text-base font-medium break-all">{user.email}</dd>
            </div>
            <div className="space-y-1.5">
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                Reportes enviados
              </dt>
              <dd className="text-base font-medium tabular-nums">
                {profile?.reports_submitted ?? 0}
              </dd>
            </div>
            {memberSince ? (
              <div className="space-y-1.5">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  Miembro desde
                </dt>
                <dd className="text-base font-medium">{memberSince}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="flex flex-wrap gap-3">
          <form action={signOut}>
            <Button type="submit" variant="outline">
              <LogOut className="size-4" aria-hidden="true" />
              Cerrar sesión
            </Button>
          </form>
        </div>

        <p className="text-xs text-muted-foreground">
          ¿Quieres reportar un hoyo?{" "}
          <a
            href="/"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Vuelve al inicio
          </a>{" "}
          y haz clic en <strong>Reportar un hoyo</strong>.
        </p>
      </div>
    </div>
  );
}

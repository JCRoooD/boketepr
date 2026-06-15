import Link from "next/link";

import { GoogleSignIn, LoginForm } from "@/components/auth/AuthForms";

export const metadata = {
  title: "Iniciar sesión · BoketePR",
};

type SearchParams = Promise<{ next?: string; message?: string; email?: string; error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { next, message, email, error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Iniciar sesión</h1>
          <p className="text-sm text-muted-foreground">
            Entra a tu cuenta de BoketePR.
          </p>
        </div>

        {message === "check_email" ? (
          <div
            role="status"
            className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300"
          >
            <p className="font-medium">¡Revisa tu correo!</p>
            <p className="mt-1 text-emerald-700/90 dark:text-emerald-300/90">
              Te enviamos un enlace de confirmación a{" "}
              {email ? <strong>{email}</strong> : "tu correo"}. Haz clic en el
              enlace para activar tu cuenta.
            </p>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {decodeURIComponent(error)}
          </div>
        ) : null}

        <div className="rounded-lg border border-border/60 bg-card p-6 shadow-sm">
          <GoogleSignIn next={next} />

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            o
            <span className="h-px flex-1 bg-border" />
          </div>

          <LoginForm next={next} />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          ¿Problemas para entrar?{" "}
          <Link
            href="mailto:soporte@boketepr.app"
            className="underline-offset-4 hover:underline"
          >
            Escríbenos
          </Link>
        </p>
      </div>
    </div>
  );
}

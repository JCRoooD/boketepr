import Link from "next/link";

import { GoogleSignIn, SignupForm } from "@/components/auth/AuthForms";

export const metadata = {
  title: "Crear cuenta · BoketePR",
};

type SearchParams = Promise<{ next?: string }>;

export default async function SignupPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Crear cuenta</h1>
          <p className="text-sm text-muted-foreground">
            Únete a BoketePR y ayuda a mapear los hoyos de Puerto Rico.
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-card p-6 shadow-sm">
          <GoogleSignIn next={next} />

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            o
            <span className="h-px flex-1 bg-border" />
          </div>

          <SignupForm next={next} />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Al crear una cuenta aceptas los{" "}
          <Link href="/terminos" className="underline-offset-4 hover:underline">
            Términos
          </Link>{" "}
          y la{" "}
          <Link href="/privacidad" className="underline-offset-4 hover:underline">
            Política de Privacidad
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

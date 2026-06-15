"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  signIn,
  signInWithGoogle,
  signUp,
  type AuthFormState,
} from "@/app/auth/actions";

/* -------------------------------------------------------------------------- */
/*  Shared bits                                                                */
/* -------------------------------------------------------------------------- */

function SubmitButton({ children, pendingLabel }: { children: React.ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      className="w-full"
      disabled={pending}
      aria-busy={pending}
      formAction={signInWithGoogle}
    >
      {pending ? "Conectando…" : "Continuar con Google"}
    </Button>
  );
}

function ErrorMessage({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {error}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Signup form                                                                */
/* -------------------------------------------------------------------------- */

export function SignupForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(signUp, null);

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="space-y-2">
        <Label htmlFor="signup-display-name">Nombre (opcional)</Label>
        <Input
          id="signup-display-name"
          name="display_name"
          type="text"
          autoComplete="name"
          placeholder="Cómo quieres que te veamos"
          maxLength={50}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-email">Correo electrónico</Label>
        <Input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="tu@correo.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-password">Contraseña</Label>
        <Input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
      </div>

      <ErrorMessage error={state?.error} />

      <SubmitButton pendingLabel="Creando cuenta…">Crear cuenta</SubmitButton>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Login form                                                                 */
/* -------------------------------------------------------------------------- */

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(signIn, null);

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="space-y-2">
        <Label htmlFor="login-email">Correo electrónico</Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="tu@correo.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="login-password">Contraseña</Label>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <ErrorMessage error={state?.error} />

      <SubmitButton pendingLabel="Entrando…">Iniciar sesión</SubmitButton>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Crea una
        </Link>
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Google OAuth (shared between signup + login)                               */
/* -------------------------------------------------------------------------- */

export function GoogleSignIn({ next }: { next?: string }) {
  return (
    <form action={signInWithGoogle} className="space-y-2">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <GoogleButton />
    </form>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Server Actions for authentication.
 *
 * These run on the server, never expose the service role key to the browser,
 * and integrate with Next.js's revalidation/redirect primitives so that
 * auth state changes flow through the middleware correctly.
 *
 * Form components call these via `useFormState` (in the AuthForms component).
 * Each action returns a state object with `{ error?: string }` for inline
 * error display in Spanish.
 */

export type AuthFormState = { error?: string } | null;

/** Sanitize a redirect target to prevent open-redirect attacks. */
function safeNext(next: string | null | undefined): string {
  if (!next) return "/profile";
  // Only allow same-origin paths starting with /
  if (!next.startsWith("/") || next.startsWith("//")) return "/profile";
  return next;
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const supabase = await createClient();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return { error: "El correo y la contraseña son requeridos." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: displayName ? { display_name: displayName } : undefined,
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return { error: friendlyError(error.message) };
  }

  // Email confirmation is on, so signUp returns a user with no session.
  // Show a "check your email" page instead of redirecting.
  redirect(`/login?message=check_email&email=${encodeURIComponent(email)}`);
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const supabase = await createClient();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return { error: "El correo y la contraseña son requeridos." };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: friendlyError(error.message) };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signInWithGoogle(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const supabase = await createClient();
  const next = safeNext(String(formData.get("next") ?? ""));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return { error: friendlyError(error.message) };
  }

  // Supabase returns a URL to redirect to. Use the framework redirect.
  if (data?.url) {
    redirect(data.url);
  }

  return { error: "No se pudo iniciar el flujo de Google." };
}

/** Map Supabase's English error messages to friendly Spanish. */
function friendlyError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return "Correo o contraseña incorrectos.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirma tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.";
  }
  if (lower.includes("user already registered") || lower.includes("already been registered")) {
    return "Este correo ya está registrado. Intenta iniciar sesión.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Demasiados intentos. Espera unos minutos e intenta de nuevo.";
  }
  if (lower.includes("password") && lower.includes("short")) {
    return "La contraseña es muy corta.";
  }
  if (lower.includes("signup") && lower.includes("disabled")) {
    return "El registro está temporalmente deshabilitado.";
  }
  // Fallback: return the original message (still better than nothing)
  return message;
}

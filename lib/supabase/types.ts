/**
 * Database type definitions for BoketePR.
 *
 * This is intentionally a placeholder for Goal 1. Once we run the Supabase
 * migration in Goal 2, we will regenerate this file with:
 *
 *   npx supabase gen types typescript --project-id <ref> > lib/supabase/types.ts
 *
 * For now, an empty `Database` type lets the client compile without forcing
 * a schema to exist yet.
 */
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/**
 * Database type definitions for BoketePR.
 *
 * Hand-written from the migrations in `lib/db/migrations/`. If you change
 * the schema, regenerate with:
 *
 *   npx supabase gen types typescript --project-id dyeskzwmapznizwgpewa > lib/supabase/types.ts
 *
 * (Requires the supabase CLI to be logged in to the project.)
 */

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
          reports_submitted: number;
          is_banned: boolean;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          reports_submitted?: number;
          is_banned?: boolean;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          reports_submitted?: number;
          is_banned?: boolean;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          user_id: string | null;
          // PostGIS geography point — PostgREST returns GeoJSON when Accept includes
          // application/geo+json, otherwise a hex-encoded EWKB string. We type as
          // unknown so callers handle the conversion explicitly.
          location: unknown;
          // 6-char geohash. Used for the cell-based neighbor index (~1.2 km grid).
          // NOT for display — use `lat`/`lng` (the exact columns) when you need a
          // pin position.
          geohash: string;
          // Exact point mirrored from `location` by a BEFORE INSERT/UPDATE trigger
          // (migration 0004). Map and detail panel read these directly.
          lat: number;
          lng: number;
          photo_url: string;
          thumbnail_url: string | null;
          severity: number;
          severity_reason: string;
          hazards: string[];
          user_comment: string | null;
          status: "active" | "fixed" | "disputed";
          created_at: string;
          updated_at: string;
          ai_model_version: string | null;
          ai_scored_at: string | null;
          confirm_count: number;
          dispute_count: number;
          submitted_to_dtop: boolean;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          // WKT format: 'POINT(longitude latitude)' — e.g. 'POINT(-66.1057 18.4655)'
          location: string;
          geohash: string;
          // Exact lat/lng. The trigger will also derive these from `location` if
          // you omit them, but writing them explicitly is cheaper and clearer.
          lat: number;
          lng: number;
          photo_url: string;
          thumbnail_url?: string | null;
          severity: number;
          severity_reason: string;
          hazards?: string[];
          user_comment?: string | null;
          status?: "active" | "fixed" | "disputed";
          created_at?: string;
          updated_at?: string;
          ai_model_version?: string | null;
          ai_scored_at?: string | null;
          confirm_count?: number;
          dispute_count?: number;
          submitted_to_dtop?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          location?: string;
          geohash?: string;
          lat?: number;
          lng?: number;
          photo_url?: string;
          thumbnail_url?: string | null;
          severity?: number;
          severity_reason?: string;
          hazards?: string[];
          user_comment?: string | null;
          status?: "active" | "fixed" | "disputed";
          created_at?: string;
          updated_at?: string;
          ai_model_version?: string | null;
          ai_scored_at?: string | null;
          confirm_count?: number;
          dispute_count?: number;
          submitted_to_dtop?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "reports_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      // Migration 0005. Powers the duplicate-detection card on /submit:
      // "Ya hay N reportes cerca de aquí" — backed by PostGIS ST_DWithin
      // on the geography(point) column with the GiST index from 0001.
      find_nearby_reports: {
        Args: {
          // Migration 0006 renamed these IN params from
          // `lat`/`lng`/`radius_m`/`max_results` to the `in_*`
          // prefix. The OUT columns (returned to the client) keep
          // the clean names (`lat`, `lng`, `distance_m`, ...). The
          // rename was needed to avoid shadowing the OUT columns
          // inside the function body — Postgres RETURNS TABLE makes
          // the OUT columns and IN parameters share a namespace, so
          // when they collide the OUT wins. That bug returned wrong
          // rows with distance_m = 0 regardless of the query point.
          in_lat: number;
          in_lng: number;
          in_radius_m?: number;
          in_max_results?: number;
        };
        Returns: Array<{
          id: string;
          lat: number;
          lng: number;
          severity: number;
          severity_reason: string;
          hazards: string[];
          user_comment: string | null;
          created_at: string;
          photo_url: string;
          thumbnail_url: string | null;
          distance_m: number;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// Convenience aliases for the row shape of each table.
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Report = Database["public"]["Tables"]["reports"]["Row"];
export type ReportStatus = Report["status"];

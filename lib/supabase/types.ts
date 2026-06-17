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
          geohash: string;
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
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// Convenience aliases for the row shape of each table.
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Report = Database["public"]["Tables"]["reports"]["Row"];
export type ReportStatus = Report["status"];

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audio_analysis: {
        Row: {
          beats_json: Json | null
          bpm: number | null
          created_at: string
          energy_json: Json | null
          id: string
          project_id: string
          sections_json: Json | null
        }
        Insert: {
          beats_json?: Json | null
          bpm?: number | null
          created_at?: string
          energy_json?: Json | null
          id?: string
          project_id: string
          sections_json?: Json | null
        }
        Update: {
          beats_json?: Json | null
          bpm?: number | null
          created_at?: string
          energy_json?: Json | null
          id?: string
          project_id?: string
          sections_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_analysis_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          reason: string
          ref_id: string | null
          ref_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          reason: string
          ref_id?: string | null
          ref_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          ref_id?: string | null
          ref_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      credit_wallets: {
        Row: {
          balance: number
          id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_queue: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          max_retries: number | null
          payload: Json | null
          project_id: string
          result: Json | null
          retry_count: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          step: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_retries?: number | null
          payload?: Json | null
          project_id: string
          result?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          step: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_retries?: number | null
          payload?: Json | null
          project_id?: string
          result?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          step?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_queue_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_flags: {
        Row: {
          created_at: string
          id: string
          project_id: string
          reason: string
          resolved_by: string | null
          status: Database["public"]["Enums"]["moderation_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          reason: string
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["moderation_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          reason?: string
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["moderation_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_flags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          character_bible_json: Json | null
          created_at: string
          id: string
          project_id: string
          shotlist_json: Json | null
          style_bible_json: Json | null
          version: number
        }
        Insert: {
          character_bible_json?: Json | null
          created_at?: string
          id?: string
          project_id: string
          shotlist_json?: Json | null
          style_bible_json?: Json | null
          version?: number
        }
        Update: {
          character_bible_json?: Json | null
          created_at?: string
          id?: string
          project_id?: string
          shotlist_json?: Json | null
          style_bible_json?: Json | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          aspect_ratio: string | null
          audio_url: string | null
          created_at: string
          duration_sec: number | null
          face_urls: Json | null
          id: string
          mode: string | null
          provider_default: string | null
          ref_photo_urls: Json | null
          status: Database["public"]["Enums"]["project_status"]
          style_preset: string | null
          synopsis: string | null
          title: string
          type: Database["public"]["Enums"]["project_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          aspect_ratio?: string | null
          audio_url?: string | null
          created_at?: string
          duration_sec?: number | null
          face_urls?: Json | null
          id?: string
          mode?: string | null
          provider_default?: string | null
          ref_photo_urls?: Json | null
          status?: Database["public"]["Enums"]["project_status"]
          style_preset?: string | null
          synopsis?: string | null
          title?: string
          type: Database["public"]["Enums"]["project_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          aspect_ratio?: string | null
          audio_url?: string | null
          created_at?: string
          duration_sec?: number | null
          face_urls?: Json | null
          id?: string
          mode?: string | null
          provider_default?: string | null
          ref_photo_urls?: Json | null
          status?: Database["public"]["Enums"]["project_status"]
          style_preset?: string | null
          synopsis?: string | null
          title?: string
          type?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      renders: {
        Row: {
          created_at: string
          id: string
          logs: string | null
          master_url_16_9: string | null
          master_url_9_16: string | null
          project_id: string
          status: Database["public"]["Enums"]["render_status"]
          teaser_url: string | null
          thumbs_json: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logs?: string | null
          master_url_16_9?: string | null
          master_url_9_16?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["render_status"]
          teaser_url?: string | null
          thumbs_json?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logs?: string | null
          master_url_16_9?: string | null
          master_url_9_16?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["render_status"]
          teaser_url?: string | null
          thumbs_json?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "renders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      shots: {
        Row: {
          cost_credits: number | null
          created_at: string
          duration_sec: number | null
          error_message: string | null
          id: string
          idx: number
          negative_prompt: string | null
          output_url: string | null
          project_id: string
          prompt: string | null
          provider: string | null
          seed: number | null
          status: Database["public"]["Enums"]["shot_status"]
          updated_at: string
        }
        Insert: {
          cost_credits?: number | null
          created_at?: string
          duration_sec?: number | null
          error_message?: string | null
          id?: string
          idx: number
          negative_prompt?: string | null
          output_url?: string | null
          project_id: string
          prompt?: string | null
          provider?: string | null
          seed?: number | null
          status?: Database["public"]["Enums"]["shot_status"]
          updated_at?: string
        }
        Update: {
          cost_credits?: number | null
          created_at?: string
          duration_sec?: number | null
          error_message?: string | null
          id?: string
          idx?: number
          negative_prompt?: string | null
          output_url?: string | null
          project_id?: string
          prompt?: string | null
          provider?: string | null
          seed?: number | null
          status?: Database["public"]["Enums"]["shot_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      debit_credits: {
        Args: {
          p_amount: number
          p_reason: string
          p_ref_id?: string
          p_ref_type?: string
          p_user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      topup_credits: {
        Args: {
          p_amount: number
          p_reason: string
          p_ref_id?: string
          p_ref_type?: string
          p_user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      job_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      moderation_status: "pending" | "reviewed" | "resolved" | "dismissed"
      project_status:
        | "draft"
        | "analyzing"
        | "planning"
        | "generating"
        | "stitching"
        | "completed"
        | "failed"
        | "cancelled"
      project_type: "clip" | "film"
      render_status: "pending" | "processing" | "completed" | "failed"
      shot_status:
        | "pending"
        | "generating"
        | "completed"
        | "failed"
        | "regenerating"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      job_status: ["pending", "processing", "completed", "failed", "cancelled"],
      moderation_status: ["pending", "reviewed", "resolved", "dismissed"],
      project_status: [
        "draft",
        "analyzing",
        "planning",
        "generating",
        "stitching",
        "completed",
        "failed",
        "cancelled",
      ],
      project_type: ["clip", "film"],
      render_status: ["pending", "processing", "completed", "failed"],
      shot_status: [
        "pending",
        "generating",
        "completed",
        "failed",
        "regenerating",
      ],
    },
  },
} as const

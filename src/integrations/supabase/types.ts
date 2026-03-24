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
          {
            foreignKeyName: "audio_analysis_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects_public"
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
          agent_slug: string | null
          completed_at: string | null
          created_at: string
          episode_id: string | null
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
          agent_slug?: string | null
          completed_at?: string | null
          created_at?: string
          episode_id?: string | null
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
          agent_slug?: string | null
          completed_at?: string | null
          created_at?: string
          episode_id?: string | null
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
          {
            foreignKeyName: "job_queue_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_queue_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
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
          {
            foreignKeyName: "moderation_flags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
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
          {
            foreignKeyName: "plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
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
          manifest_url: string | null
          master_url_16_9: string | null
          master_url_9_16: string | null
          project_id: string
          render_mode: string | null
          status: Database["public"]["Enums"]["render_status"]
          teaser_url: string | null
          thumbs_json: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logs?: string | null
          manifest_url?: string | null
          master_url_16_9?: string | null
          master_url_9_16?: string | null
          project_id: string
          render_mode?: string | null
          status?: Database["public"]["Enums"]["render_status"]
          teaser_url?: string | null
          thumbs_json?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logs?: string | null
          manifest_url?: string | null
          master_url_16_9?: string | null
          master_url_9_16?: string | null
          project_id?: string
          render_mode?: string | null
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
          {
            foreignKeyName: "renders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects_public"
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
          provider_type: string | null
          scene_id: string | null
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
          provider_type?: string | null
          scene_id?: string | null
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
          provider_type?: string | null
          scene_id?: string | null
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
          {
            foreignKeyName: "shots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shots_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
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
      webhook_deliveries: {
        Row: {
          created_at: string
          endpoint_id: string
          event: string
          id: string
          payload: Json
          response_body: string | null
          status_code: number | null
        }
        Insert: {
          created_at?: string
          endpoint_id: string
          event: string
          id?: string
          payload?: Json
          response_body?: string | null
          status_code?: number | null
        }
        Update: {
          created_at?: string
          endpoint_id?: string
          event?: string
          id?: string
          payload?: Json
          response_body?: string | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_outputs: {
        Row: {
          agent_run_id: string
          content: Json
          created_at: string
          id: string
          output_type: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          agent_run_id: string
          content?: Json
          created_at?: string
          id?: string
          output_type: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          agent_run_id?: string
          content?: Json
          created_at?: string
          id?: string
          output_type?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_outputs_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_prompts: {
        Row: {
          agent_slug: string
          content: string
          created_at: string
          id: string
          is_active: boolean
          variables: Json | null
          version: number
        }
        Insert: {
          agent_slug: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          variables?: Json | null
          version: number
        }
        Update: {
          agent_slug?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          variables?: Json | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_prompts_agent_slug_fkey"
            columns: ["agent_slug"]
            isOneToOne: false
            referencedRelation: "agent_registry"
            referencedColumns: ["slug"]
          },
        ]
      }
      agent_registry: {
        Row: {
          category: string
          config: Json | null
          created_at: string
          dependencies: string[] | null
          description: string | null
          id: string
          name: string
          role: string
          slug: string
          status: Database["public"]["Enums"]["agent_status"]
          updated_at: string
        }
        Insert: {
          category: string
          config?: Json | null
          created_at?: string
          dependencies?: string[] | null
          description?: string | null
          id?: string
          name: string
          role: string
          slug: string
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
        }
        Update: {
          category?: string
          config?: Json | null
          created_at?: string
          dependencies?: string[] | null
          description?: string | null
          id?: string
          name?: string
          role?: string
          slug?: string
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          agent_slug: string
          completed_at: string | null
          cost_credits: number | null
          created_at: string
          episode_id: string | null
          error_message: string | null
          id: string
          input: Json | null
          latency_ms: number | null
          model_used: string | null
          output: Json | null
          prompt_version: number | null
          season_id: string | null
          series_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["agent_run_status"]
          tokens_used: number | null
        }
        Insert: {
          agent_slug: string
          completed_at?: string | null
          cost_credits?: number | null
          created_at?: string
          episode_id?: string | null
          error_message?: string | null
          id?: string
          input?: Json | null
          latency_ms?: number | null
          model_used?: string | null
          output?: Json | null
          prompt_version?: number | null
          season_id?: string | null
          series_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["agent_run_status"]
          tokens_used?: number | null
        }
        Update: {
          agent_slug?: string
          completed_at?: string | null
          cost_credits?: number | null
          created_at?: string
          episode_id?: string | null
          error_message?: string | null
          id?: string
          input?: Json | null
          latency_ms?: number | null
          model_used?: string | null
          output?: Json | null
          prompt_version?: number | null
          season_id?: string | null
          series_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["agent_run_status"]
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_agent_slug_fkey"
            columns: ["agent_slug"]
            isOneToOne: false
            referencedRelation: "agent_registry"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "agent_runs_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_decisions: {
        Row: {
          agent_run_id: string | null
          approval_step_id: string
          created_at: string
          decided_by: string | null
          decision: Database["public"]["Enums"]["approval_status"]
          id: string
          reason: string | null
        }
        Insert: {
          agent_run_id?: string | null
          approval_step_id: string
          created_at?: string
          decided_by?: string | null
          decision: Database["public"]["Enums"]["approval_status"]
          id?: string
          reason?: string | null
        }
        Update: {
          agent_run_id?: string | null
          approval_step_id?: string
          created_at?: string
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["approval_status"]
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_decisions_approval_step_id_fkey"
            columns: ["approval_step_id"]
            isOneToOne: false
            referencedRelation: "approval_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_decisions_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_steps: {
        Row: {
          created_at: string
          episode_id: string
          id: string
          notes: string | null
          reviewer_agent: string | null
          reviewer_user: string | null
          status: Database["public"]["Enums"]["approval_status"]
          step_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          episode_id: string
          id?: string
          notes?: string | null
          reviewer_agent?: string | null
          reviewer_user?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          step_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          episode_id?: string
          id?: string
          notes?: string | null
          reviewer_agent?: string | null
          reviewer_user?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          step_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_steps_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_steps_reviewer_agent_fkey"
            columns: ["reviewer_agent"]
            isOneToOne: false
            referencedRelation: "agent_registry"
            referencedColumns: ["slug"]
          },
        ]
      }
      asset_packs: {
        Row: {
          created_at: string
          episode_id: string | null
          file_url: string | null
          id: string
          manifest: Json | null
          pack_type: string
          series_id: string
          status: Database["public"]["Enums"]["render_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          episode_id?: string | null
          file_url?: string | null
          id?: string
          manifest?: Json | null
          pack_type?: string
          series_id: string
          status?: Database["public"]["Enums"]["render_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          episode_id?: string | null
          file_url?: string | null
          id?: string
          manifest?: Json | null
          pack_type?: string
          series_id?: string
          status?: Database["public"]["Enums"]["render_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_packs_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_packs_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bibles: {
        Row: {
          content: Json
          created_at: string
          id: string
          name: string
          series_id: string
          type: Database["public"]["Enums"]["bible_type"]
          updated_at: string
          version: number
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          name: string
          series_id: string
          type: Database["public"]["Enums"]["bible_type"]
          updated_at?: string
          version?: number
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          name?: string
          series_id?: string
          type?: Database["public"]["Enums"]["bible_type"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "bibles_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_safety_flags: {
        Row: {
          category: string
          created_at: string
          description: string | null
          episode_id: string | null
          id: string
          resolved: boolean
          resolved_by: string | null
          severity: string
          shot_id: string | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          episode_id?: string | null
          id?: string
          resolved?: boolean
          resolved_by?: string | null
          severity?: string
          shot_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          episode_id?: string | null
          id?: string
          resolved?: boolean
          resolved_by?: string | null
          severity?: string
          shot_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_safety_flags_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_safety_flags_shot_id_fkey"
            columns: ["shot_id"]
            isOneToOne: false
            referencedRelation: "shots"
            referencedColumns: ["id"]
          },
        ]
      }
      character_profiles: {
        Row: {
          arc: Json | null
          created_at: string
          id: string
          name: string
          personality: Json | null
          reference_images: Json | null
          relationships: Json | null
          series_id: string
          updated_at: string
          visual_description: string
          voice_notes: string | null
          wardrobe: Json | null
        }
        Insert: {
          arc?: Json | null
          created_at?: string
          id?: string
          name: string
          personality?: Json | null
          reference_images?: Json | null
          relationships?: Json | null
          series_id: string
          updated_at?: string
          visual_description: string
          voice_notes?: string | null
          wardrobe?: Json | null
        }
        Update: {
          arc?: Json | null
          created_at?: string
          id?: string
          name?: string
          personality?: Json | null
          reference_images?: Json | null
          relationships?: Json | null
          series_id?: string
          updated_at?: string
          visual_description?: string
          voice_notes?: string | null
          wardrobe?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "character_profiles_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      character_reference_packs: {
        Row: {
          character_id: string
          created_at: string
          file_type: string | null
          file_url: string
          id: string
          label: string | null
        }
        Insert: {
          character_id: string
          created_at?: string
          file_type?: string | null
          file_url: string
          id?: string
          label?: string | null
        }
        Update: {
          character_id?: string
          created_at?: string
          file_type?: string | null
          file_url?: string
          id?: string
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "character_reference_packs_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "character_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      continuity_reports: {
        Row: {
          agent_run_id: string | null
          created_at: string
          episode_id: string
          id: string
          issues: Json
          summary: string | null
          verdict: Database["public"]["Enums"]["review_verdict"]
        }
        Insert: {
          agent_run_id?: string | null
          created_at?: string
          episode_id: string
          id?: string
          issues?: Json
          summary?: string | null
          verdict?: Database["public"]["Enums"]["review_verdict"]
        }
        Update: {
          agent_run_id?: string | null
          created_at?: string
          episode_id?: string
          id?: string
          issues?: Json
          summary?: string | null
          verdict?: Database["public"]["Enums"]["review_verdict"]
        }
        Relationships: [
          {
            foreignKeyName: "continuity_reports_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_reports_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      episodes: {
        Row: {
          created_at: string
          duration_target_sec: number | null
          id: string
          next_episode_hook: string | null
          number: number
          previously_on: string | null
          project_id: string | null
          season_id: string
          status: Database["public"]["Enums"]["episode_status"]
          synopsis: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_target_sec?: number | null
          id?: string
          next_episode_hook?: string | null
          number: number
          previously_on?: string | null
          project_id?: string | null
          season_id: string
          status?: Database["public"]["Enums"]["episode_status"]
          synopsis?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_target_sec?: number | null
          id?: string
          next_episode_hook?: string | null
          number?: number
          previously_on?: string | null
          project_id?: string | null
          season_id?: string
          status?: Database["public"]["Enums"]["episode_status"]
          synopsis?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "episodes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episodes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episodes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      legal_ethics_reviews: {
        Row: {
          agent_run_id: string | null
          created_at: string
          episode_id: string
          flags: Json
          id: string
          recommendations: string | null
          verdict: Database["public"]["Enums"]["review_verdict"]
        }
        Insert: {
          agent_run_id?: string | null
          created_at?: string
          episode_id: string
          flags?: Json
          id?: string
          recommendations?: string | null
          verdict?: Database["public"]["Enums"]["review_verdict"]
        }
        Update: {
          agent_run_id?: string | null
          created_at?: string
          episode_id?: string
          flags?: Json
          id?: string
          recommendations?: string | null
          verdict?: Database["public"]["Enums"]["review_verdict"]
        }
        Relationships: [
          {
            foreignKeyName: "legal_ethics_reviews_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_ethics_reviews_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_registry: {
        Row: {
          capabilities: Json
          config: Json | null
          created_at: string
          display_name: string
          health_checked_at: string | null
          health_status: string | null
          id: string
          is_enabled: boolean
          name: string
          provider_type: string
          updated_at: string
        }
        Insert: {
          capabilities?: Json
          config?: Json | null
          created_at?: string
          display_name: string
          health_checked_at?: string | null
          health_status?: string | null
          id?: string
          is_enabled?: boolean
          name: string
          provider_type: string
          updated_at?: string
        }
        Update: {
          capabilities?: Json
          config?: Json | null
          created_at?: string
          display_name?: string
          health_checked_at?: string | null
          health_status?: string | null
          id?: string
          is_enabled?: boolean
          name?: string
          provider_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      psychology_reviews: {
        Row: {
          agent_run_id: string | null
          character_assessments: Json
          created_at: string
          episode_id: string
          id: string
          recommendations: string | null
          verdict: Database["public"]["Enums"]["review_verdict"]
        }
        Insert: {
          agent_run_id?: string | null
          character_assessments?: Json
          created_at?: string
          episode_id: string
          id?: string
          recommendations?: string | null
          verdict?: Database["public"]["Enums"]["review_verdict"]
        }
        Update: {
          agent_run_id?: string | null
          character_assessments?: Json
          created_at?: string
          episode_id?: string
          id?: string
          recommendations?: string | null
          verdict?: Database["public"]["Enums"]["review_verdict"]
        }
        Relationships: [
          {
            foreignKeyName: "psychology_reviews_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psychology_reviews_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      render_batches: {
        Row: {
          config: Json | null
          created_at: string
          episode_ids: Json
          id: string
          progress: Json | null
          season_id: string | null
          series_id: string
          status: Database["public"]["Enums"]["render_status"]
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          episode_ids?: Json
          id?: string
          progress?: Json | null
          season_id?: string | null
          series_id: string
          status?: Database["public"]["Enums"]["render_status"]
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          episode_ids?: Json
          id?: string
          progress?: Json | null
          season_id?: string | null
          series_id?: string
          status?: Database["public"]["Enums"]["render_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "render_batches_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "render_batches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      scenes: {
        Row: {
          characters: Json | null
          created_at: string
          description: string | null
          duration_target_sec: number | null
          episode_id: string
          id: string
          idx: number
          location: string | null
          mood: string | null
          time_of_day: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          characters?: Json | null
          created_at?: string
          description?: string | null
          duration_target_sec?: number | null
          episode_id: string
          id?: string
          idx: number
          location?: string | null
          mood?: string | null
          time_of_day?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          characters?: Json | null
          created_at?: string
          description?: string | null
          duration_target_sec?: number | null
          episode_id?: string
          id?: string
          idx?: number
          location?: string | null
          mood?: string | null
          time_of_day?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenes_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          created_at: string
          current_version: number
          episode_id: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_version?: number
          episode_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_version?: number
          episode_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scripts_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: true
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      script_versions: {
        Row: {
          change_summary: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          script_id: string
          version: number
        }
        Insert: {
          change_summary?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          script_id: string
          version: number
        }
        Update: {
          change_summary?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          script_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "script_versions_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          arc_summary: string | null
          created_at: string
          episode_count: number | null
          id: string
          number: number
          series_id: string
          synopsis: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          arc_summary?: string | null
          created_at?: string
          episode_count?: number | null
          id?: string
          number: number
          series_id: string
          synopsis?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          arc_summary?: string | null
          created_at?: string
          episode_count?: number | null
          id?: string
          number?: number
          series_id?: string
          synopsis?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          created_at: string
          genre: string | null
          id: string
          logline: string | null
          project_id: string
          target_audience: string | null
          tone: string | null
          total_seasons: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          genre?: string | null
          id?: string
          logline?: string | null
          project_id: string
          target_audience?: string | null
          tone?: string | null
          total_seasons?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          genre?: string | null
          id?: string
          logline?: string | null
          project_id?: string
          target_audience?: string | null
          tone?: string | null
          total_seasons?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          active: boolean
          created_at: string
          events: string[]
          id: string
          secret: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          secret?: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          secret?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      projects_public: {
        Row: {
          id: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          style_preset: string | null
          title: string | null
          type: Database["public"]["Enums"]["project_type"] | null
        }
        Insert: {
          id?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          style_preset?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["project_type"] | null
        }
        Update: {
          id?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          style_preset?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["project_type"] | null
        }
        Relationships: []
      }
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
      agent_run_status: "queued" | "running" | "completed" | "failed" | "cancelled"
      agent_status: "active" | "inactive" | "deprecated"
      app_role: "admin" | "moderator" | "user"
      approval_status: "pending" | "approved" | "rejected" | "revision_requested"
      bible_type: "style" | "character" | "wardrobe" | "location" | "world" | "music" | "voice" | "prop"
      episode_status:
        | "draft"
        | "story_development"
        | "psychology_review"
        | "legal_ethics_review"
        | "visual_bible"
        | "continuity_check"
        | "shot_generation"
        | "shot_review"
        | "assembly"
        | "edit_review"
        | "delivery"
        | "completed"
        | "failed"
        | "cancelled"
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
        | "in_production"
      project_type: "clip" | "film" | "series"
      render_status: "pending" | "processing" | "completed" | "failed"
      review_verdict: "pass" | "flag" | "block"
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
      agent_run_status: ["queued", "running", "completed", "failed", "cancelled"],
      agent_status: ["active", "inactive", "deprecated"],
      app_role: ["admin", "moderator", "user"],
      approval_status: ["pending", "approved", "rejected", "revision_requested"],
      bible_type: ["style", "character", "wardrobe", "location", "world", "music", "voice", "prop"],
      episode_status: [
        "draft",
        "story_development",
        "psychology_review",
        "legal_ethics_review",
        "visual_bible",
        "continuity_check",
        "shot_generation",
        "shot_review",
        "assembly",
        "edit_review",
        "delivery",
        "completed",
        "failed",
        "cancelled",
      ],
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
        "in_production",
      ],
      project_type: ["clip", "film", "series"],
      render_status: ["pending", "processing", "completed", "failed"],
      review_verdict: ["pass", "flag", "block"],
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

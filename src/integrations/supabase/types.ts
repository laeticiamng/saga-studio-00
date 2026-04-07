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
      aberration_categories: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          repair_action_default: string
          severity_default: string
          subcategory: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          repair_action_default?: string
          severity_default?: string
          subcategory: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          repair_action_default?: string
          severity_default?: string
          subcategory?: string
        }
        Relationships: []
      }
      agent_outputs: {
        Row: {
          agent_run_id: string
          content: Json
          created_at: string
          id: string
          output_type: string
        }
        Insert: {
          agent_run_id: string
          content?: Json
          created_at?: string
          id?: string
          output_type: string
        }
        Update: {
          agent_run_id?: string
          content?: Json
          created_at?: string
          id?: string
          output_type?: string
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
          version: number
        }
        Insert: {
          agent_slug: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          version?: number
        }
        Update: {
          agent_slug?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
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
          created_at: string
          dependencies: string[] | null
          description: string | null
          is_active: boolean
          name: string
          role: string | null
          slug: string
          status: string
        }
        Insert: {
          category?: string
          created_at?: string
          dependencies?: string[] | null
          description?: string | null
          is_active?: boolean
          name: string
          role?: string | null
          slug: string
          status?: string
        }
        Update: {
          category?: string
          created_at?: string
          dependencies?: string[] | null
          description?: string | null
          is_active?: boolean
          name?: string
          role?: string | null
          slug?: string
          status?: string
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          agent_slug: string
          completed_at: string | null
          correlation_id: string | null
          created_at: string
          episode_id: string | null
          error_message: string | null
          id: string
          idempotency_key: string | null
          input: Json | null
          latency_ms: number | null
          max_retries: number | null
          model_used: string | null
          output: Json | null
          prompt_version: number | null
          retry_count: number | null
          season_id: string | null
          series_id: string | null
          started_at: string | null
          status: string
          tokens_used: number | null
        }
        Insert: {
          agent_slug: string
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          episode_id?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          input?: Json | null
          latency_ms?: number | null
          max_retries?: number | null
          model_used?: string | null
          output?: Json | null
          prompt_version?: number | null
          retry_count?: number | null
          season_id?: string | null
          series_id?: string | null
          started_at?: string | null
          status?: string
          tokens_used?: number | null
        }
        Update: {
          agent_slug?: string
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          episode_id?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          input?: Json | null
          latency_ms?: number | null
          max_retries?: number | null
          model_used?: string | null
          output?: Json | null
          prompt_version?: number | null
          retry_count?: number | null
          season_id?: string | null
          series_id?: string | null
          started_at?: string | null
          status?: string
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
      anomaly_events: {
        Row: {
          auto_fix_attempted: boolean
          auto_fix_result: string | null
          blocking: boolean
          category: string
          confidence: number | null
          created_at: string
          explanation: string | null
          id: string
          severity: string
          subcategory: string | null
          suggested_fix: string | null
          validation_id: string
        }
        Insert: {
          auto_fix_attempted?: boolean
          auto_fix_result?: string | null
          blocking?: boolean
          category: string
          confidence?: number | null
          created_at?: string
          explanation?: string | null
          id?: string
          severity?: string
          subcategory?: string | null
          suggested_fix?: string | null
          validation_id: string
        }
        Update: {
          auto_fix_attempted?: boolean
          auto_fix_result?: string | null
          blocking?: boolean
          category?: string
          confidence?: number | null
          created_at?: string
          explanation?: string | null
          id?: string
          severity?: string
          subcategory?: string | null
          suggested_fix?: string | null
          validation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anomaly_events_validation_id_fkey"
            columns: ["validation_id"]
            isOneToOne: false
            referencedRelation: "asset_validations"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_decisions: {
        Row: {
          approval_step_id: string
          created_at: string
          decided_by: string | null
          decision: string
          id: string
          reason: string | null
        }
        Insert: {
          approval_step_id: string
          created_at?: string
          decided_by?: string | null
          decision: string
          id?: string
          reason?: string | null
        }
        Update: {
          approval_step_id?: string
          created_at?: string
          decided_by?: string | null
          decision?: string
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
          status: string
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
          status?: string
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
          status?: string
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
        ]
      }
      asset_normalization_results: {
        Row: {
          aspect_ratio_detected: string | null
          asset_id: string
          audio_channels: number | null
          audio_loudness_lufs: number | null
          audio_present: boolean | null
          audio_sample_rate: number | null
          codec: string | null
          container: string | null
          created_at: string
          duration_ms: number | null
          fps: number | null
          height: number | null
          id: string
          normalized_at: string | null
          poster_frame_url: string | null
          project_id: string
          raw_metadata: Json | null
          thumbnail_url: string | null
          width: number | null
        }
        Insert: {
          aspect_ratio_detected?: string | null
          asset_id: string
          audio_channels?: number | null
          audio_loudness_lufs?: number | null
          audio_present?: boolean | null
          audio_sample_rate?: number | null
          codec?: string | null
          container?: string | null
          created_at?: string
          duration_ms?: number | null
          fps?: number | null
          height?: number | null
          id?: string
          normalized_at?: string | null
          poster_frame_url?: string | null
          project_id: string
          raw_metadata?: Json | null
          thumbnail_url?: string | null
          width?: number | null
        }
        Update: {
          aspect_ratio_detected?: string | null
          asset_id?: string
          audio_channels?: number | null
          audio_loudness_lufs?: number | null
          audio_present?: boolean | null
          audio_sample_rate?: number | null
          codec?: string | null
          container?: string | null
          created_at?: string
          duration_ms?: number | null
          fps?: number | null
          height?: number | null
          id?: string
          normalized_at?: string | null
          poster_frame_url?: string | null
          project_id?: string
          raw_metadata?: Json | null
          thumbnail_url?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_normalization_results_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "project_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_normalization_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_normalization_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_packs: {
        Row: {
          created_at: string
          episode_id: string | null
          id: string
          manifest: Json | null
          pack_type: string
          series_id: string
          status: string
        }
        Insert: {
          created_at?: string
          episode_id?: string | null
          id?: string
          manifest?: Json | null
          pack_type?: string
          series_id: string
          status?: string
        }
        Update: {
          created_at?: string
          episode_id?: string | null
          id?: string
          manifest?: Json | null
          pack_type?: string
          series_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_packs_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_packs_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_validations: {
        Row: {
          asset_id: string | null
          asset_type: string
          blocking: boolean
          created_at: string
          episode_shot_id: string | null
          explanation: string | null
          id: string
          pass_results: Json | null
          project_id: string
          scene_id: string | null
          scores: Json
          updated_at: string
          validation_status: string
          validator_type: string
        }
        Insert: {
          asset_id?: string | null
          asset_type?: string
          blocking?: boolean
          created_at?: string
          episode_shot_id?: string | null
          explanation?: string | null
          id?: string
          pass_results?: Json | null
          project_id: string
          scene_id?: string | null
          scores?: Json
          updated_at?: string
          validation_status?: string
          validator_type?: string
        }
        Update: {
          asset_id?: string | null
          asset_type?: string
          blocking?: boolean
          created_at?: string
          episode_shot_id?: string | null
          explanation?: string | null
          id?: string
          pass_results?: Json | null
          project_id?: string
          scene_id?: string | null
          scores?: Json
          updated_at?: string
          validation_status?: string
          validator_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_validations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "project_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_validations_episode_shot_id_fkey"
            columns: ["episode_shot_id"]
            isOneToOne: false
            referencedRelation: "episode_shots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_validations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_validations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
        ]
      }
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
      audit_logs: {
        Row: {
          action: string
          correlation_id: string | null
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
          correlation_id?: string | null
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
          correlation_id?: string | null
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
          type: string
          updated_at: string
          version: number
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          name: string
          series_id: string
          type?: string
          updated_at?: string
          version?: number
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          name?: string
          series_id?: string
          type?: string
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
          description: string
          episode_id: string
          id: string
          resolved: boolean
          severity: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          episode_id: string
          id?: string
          resolved?: boolean
          severity?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          episode_id?: string
          id?: string
          resolved?: boolean
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_safety_flags_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      canonical_conflicts: {
        Row: {
          canonical_value: Json | null
          created_at: string
          doc_a_id: string | null
          doc_b_id: string | null
          entity_type: string
          field_key: string
          id: string
          notes: string | null
          project_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          updated_at: string
          value_a: Json | null
          value_b: Json | null
        }
        Insert: {
          canonical_value?: Json | null
          created_at?: string
          doc_a_id?: string | null
          doc_b_id?: string | null
          entity_type?: string
          field_key: string
          id?: string
          notes?: string | null
          project_id: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          updated_at?: string
          value_a?: Json | null
          value_b?: Json | null
        }
        Update: {
          canonical_value?: Json | null
          created_at?: string
          doc_a_id?: string | null
          doc_b_id?: string | null
          entity_type?: string
          field_key?: string
          id?: string
          notes?: string | null
          project_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          updated_at?: string
          value_a?: Json | null
          value_b?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "canonical_conflicts_doc_a_id_fkey"
            columns: ["doc_a_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canonical_conflicts_doc_b_id_fkey"
            columns: ["doc_b_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canonical_conflicts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canonical_conflicts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
        ]
      }
      canonical_fields: {
        Row: {
          approved: boolean | null
          approved_at: string | null
          approved_by: string | null
          canonical_value: Json
          confidence: number | null
          created_at: string
          entity_name: string | null
          entity_type: string
          field_key: string
          id: string
          inferred: boolean | null
          project_id: string
          source_document_id: string | null
          source_passage: string | null
          updated_at: string
        }
        Insert: {
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          canonical_value: Json
          confidence?: number | null
          created_at?: string
          entity_name?: string | null
          entity_type?: string
          field_key: string
          id?: string
          inferred?: boolean | null
          project_id: string
          source_document_id?: string | null
          source_passage?: string | null
          updated_at?: string
        }
        Update: {
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          canonical_value?: Json
          confidence?: number | null
          created_at?: string
          entity_name?: string | null
          entity_type?: string
          field_key?: string
          id?: string
          inferred?: boolean | null
          project_id?: string
          source_document_id?: string | null
          source_passage?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "canonical_fields_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canonical_fields_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canonical_fields_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      character_profiles: {
        Row: {
          arc: string | null
          backstory: string | null
          created_at: string
          id: string
          name: string
          personality: string | null
          relationships: Json | null
          series_id: string
          updated_at: string
          visual_description: string | null
          voice_notes: string | null
          wardrobe: string | null
        }
        Insert: {
          arc?: string | null
          backstory?: string | null
          created_at?: string
          id?: string
          name: string
          personality?: string | null
          relationships?: Json | null
          series_id: string
          updated_at?: string
          visual_description?: string | null
          voice_notes?: string | null
          wardrobe?: string | null
        }
        Update: {
          arc?: string | null
          backstory?: string | null
          created_at?: string
          id?: string
          name?: string
          personality?: string | null
          relationships?: Json | null
          series_id?: string
          updated_at?: string
          visual_description?: string | null
          voice_notes?: string | null
          wardrobe?: string | null
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
          id: string
          image_urls: Json | null
          source: string | null
        }
        Insert: {
          character_id: string
          created_at?: string
          id?: string
          image_urls?: Json | null
          source?: string | null
        }
        Update: {
          character_id?: string
          created_at?: string
          id?: string
          image_urls?: Json | null
          source?: string | null
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
      continuity_conflicts: {
        Row: {
          conflict_type: string
          created_at: string
          description: string
          episode_id: string | null
          id: string
          resolved: boolean
          series_id: string
          severity: string
        }
        Insert: {
          conflict_type?: string
          created_at?: string
          description: string
          episode_id?: string | null
          id?: string
          resolved?: boolean
          series_id: string
          severity?: string
        }
        Update: {
          conflict_type?: string
          created_at?: string
          description?: string
          episode_id?: string | null
          id?: string
          resolved?: boolean
          series_id?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuity_conflicts_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_conflicts_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      continuity_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          preset_refs: Json | null
          project_id: string | null
          series_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          preset_refs?: Json | null
          project_id?: string | null
          series_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          preset_refs?: Json | null
          project_id?: string | null
          series_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuity_groups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_groups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_groups_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      continuity_memory_edges: {
        Row: {
          created_at: string
          edge_type: string
          id: string
          properties: Json | null
          series_id: string
          source_node_id: string
          target_node_id: string
        }
        Insert: {
          created_at?: string
          edge_type?: string
          id?: string
          properties?: Json | null
          series_id: string
          source_node_id: string
          target_node_id: string
        }
        Update: {
          created_at?: string
          edge_type?: string
          id?: string
          properties?: Json | null
          series_id?: string
          source_node_id?: string
          target_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuity_memory_edges_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_memory_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "continuity_memory_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_memory_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "continuity_memory_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      continuity_memory_nodes: {
        Row: {
          created_at: string
          first_appearance_episode: string | null
          id: string
          is_active: boolean
          label: string
          last_updated_episode: string | null
          node_type: string
          properties: Json | null
          series_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_appearance_episode?: string | null
          id?: string
          is_active?: boolean
          label: string
          last_updated_episode?: string | null
          node_type?: string
          properties?: Json | null
          series_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_appearance_episode?: string | null
          id?: string
          is_active?: boolean
          label?: string
          last_updated_episode?: string | null
          node_type?: string
          properties?: Json | null
          series_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuity_memory_nodes_first_appearance_episode_fkey"
            columns: ["first_appearance_episode"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_memory_nodes_last_updated_episode_fkey"
            columns: ["last_updated_episode"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_memory_nodes_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
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
          issues: Json | null
          summary: string | null
          verdict: string
        }
        Insert: {
          agent_run_id?: string | null
          created_at?: string
          episode_id: string
          id?: string
          issues?: Json | null
          summary?: string | null
          verdict?: string
        }
        Update: {
          agent_run_id?: string | null
          created_at?: string
          episode_id?: string
          id?: string
          issues?: Json | null
          summary?: string | null
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuity_reports_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_reports_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
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
      delivery_manifests: {
        Row: {
          created_at: string
          episode_id: string | null
          id: string
          manifest_type: string
          metadata: Json | null
          series_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          episode_id?: string | null
          id?: string
          manifest_type?: string
          metadata?: Json | null
          series_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          episode_id?: string | null
          id?: string
          manifest_type?: string
          metadata?: Json | null
          series_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_manifests_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_manifests_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_events: {
        Row: {
          created_at: string
          detail: string | null
          event_type: string
          id: string
          project_id: string
          raw_data: Json | null
          scope: string
          scope_id: string | null
          severity: string
          title: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          event_type: string
          id?: string
          project_id: string
          raw_data?: Json | null
          scope?: string
          scope_id?: string | null
          severity?: string
          title: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          event_type?: string
          id?: string
          project_id?: string
          raw_data?: Json | null
          scope?: string
          scope_id?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
        ]
      }
      episode_shots: {
        Row: {
          batch_index: number | null
          cost_credits: number | null
          created_at: string | null
          duration_sec: number | null
          episode_id: string
          error_message: string | null
          id: string
          idx: number
          negative_prompt: string | null
          output_url: string | null
          prompt: string | null
          provider: string | null
          scene_id: string | null
          seed: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          batch_index?: number | null
          cost_credits?: number | null
          created_at?: string | null
          duration_sec?: number | null
          episode_id: string
          error_message?: string | null
          id?: string
          idx?: number
          negative_prompt?: string | null
          output_url?: string | null
          prompt?: string | null
          provider?: string | null
          scene_id?: string | null
          seed?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          batch_index?: number | null
          cost_credits?: number | null
          created_at?: string | null
          duration_sec?: number | null
          episode_id?: string
          error_message?: string | null
          id?: string
          idx?: number
          negative_prompt?: string | null
          output_url?: string | null
          prompt?: string | null
          provider?: string | null
          scene_id?: string | null
          seed?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "episode_shots_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episode_shots_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      episodes: {
        Row: {
          created_at: string
          duration_target_min: number | null
          id: string
          number: number
          project_id: string | null
          season_id: string
          status: string
          synopsis: string | null
          title: string
          updated_at: string
          workflow_run_id: string | null
        }
        Insert: {
          created_at?: string
          duration_target_min?: number | null
          id?: string
          number: number
          project_id?: string | null
          season_id: string
          status?: string
          synopsis?: string | null
          title?: string
          updated_at?: string
          workflow_run_id?: string | null
        }
        Update: {
          created_at?: string
          duration_target_min?: number | null
          id?: string
          number?: number
          project_id?: string | null
          season_id?: string
          status?: string
          synopsis?: string | null
          title?: string
          updated_at?: string
          workflow_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "episodes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      export_jobs: {
        Row: {
          created_at: string
          episode_id: string | null
          export_type: string
          format: string
          id: string
          metadata: Json | null
          output_url: string | null
          series_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          episode_id?: string | null
          export_type?: string
          format?: string
          id?: string
          metadata?: Json | null
          output_url?: string | null
          series_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          episode_id?: string | null
          export_type?: string
          format?: string
          id?: string
          metadata?: Json | null
          output_url?: string | null
          series_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_jobs_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_jobs_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      export_presets: {
        Row: {
          aspect_ratio: string | null
          audio_bitrate_kbps: number | null
          audio_codec: string | null
          audio_sample_rate: number | null
          codec: string | null
          container: string | null
          created_at: string
          crop_safe_margin_pct: number | null
          description: string | null
          display_name: string
          fps: number | null
          id: string
          is_active: boolean | null
          name: string
          resolution: string
          subtitle_mode: string | null
          target_bitrate_kbps: number | null
          title_safe_margin_pct: number | null
        }
        Insert: {
          aspect_ratio?: string | null
          audio_bitrate_kbps?: number | null
          audio_codec?: string | null
          audio_sample_rate?: number | null
          codec?: string | null
          container?: string | null
          created_at?: string
          crop_safe_margin_pct?: number | null
          description?: string | null
          display_name: string
          fps?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          resolution?: string
          subtitle_mode?: string | null
          target_bitrate_kbps?: number | null
          title_safe_margin_pct?: number | null
        }
        Update: {
          aspect_ratio?: string | null
          audio_bitrate_kbps?: number | null
          audio_codec?: string | null
          audio_sample_rate?: number | null
          codec?: string | null
          container?: string | null
          created_at?: string
          crop_safe_margin_pct?: number | null
          description?: string | null
          display_name?: string
          fps?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          resolution?: string
          subtitle_mode?: string | null
          target_bitrate_kbps?: number | null
          title_safe_margin_pct?: number | null
        }
        Relationships: []
      }
      export_versions: {
        Row: {
          approved_by: string | null
          aspect_ratio: string | null
          checksum: string | null
          created_at: string
          duration_ms: number | null
          episode_id: string | null
          failure_stage: string | null
          file_size_bytes: number | null
          format: string
          id: string
          look_preset: string | null
          metadata: Json | null
          output_url: string | null
          preset_name: string | null
          project_id: string
          resolution: string
          retry_count: number | null
          status: string
          timeline_id: string | null
          timeline_version_ref: string | null
          updated_at: string
          version: number
        }
        Insert: {
          approved_by?: string | null
          aspect_ratio?: string | null
          checksum?: string | null
          created_at?: string
          duration_ms?: number | null
          episode_id?: string | null
          failure_stage?: string | null
          file_size_bytes?: number | null
          format?: string
          id?: string
          look_preset?: string | null
          metadata?: Json | null
          output_url?: string | null
          preset_name?: string | null
          project_id: string
          resolution?: string
          retry_count?: number | null
          status?: string
          timeline_id?: string | null
          timeline_version_ref?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          approved_by?: string | null
          aspect_ratio?: string | null
          checksum?: string | null
          created_at?: string
          duration_ms?: number | null
          episode_id?: string | null
          failure_stage?: string | null
          file_size_bytes?: number | null
          format?: string
          id?: string
          look_preset?: string | null
          metadata?: Json | null
          output_url?: string | null
          preset_name?: string | null
          project_id?: string
          resolution?: string
          retry_count?: number | null
          status?: string
          timeline_id?: string | null
          timeline_version_ref?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "export_versions_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_versions_timeline_id_fkey"
            columns: ["timeline_id"]
            isOneToOne: false
            referencedRelation: "timelines"
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
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
        }
        Relationships: []
      }
      field_provenance: {
        Row: {
          created_at: string
          document_version: number | null
          extraction_confidence: number | null
          extraction_date: string | null
          id: string
          source_document_id: string | null
          source_passage: string | null
          status: string
          target_field: string
          target_record_id: string
          target_table: string
        }
        Insert: {
          created_at?: string
          document_version?: number | null
          extraction_confidence?: number | null
          extraction_date?: string | null
          id?: string
          source_document_id?: string | null
          source_passage?: string | null
          status?: string
          target_field: string
          target_record_id: string
          target_table: string
        }
        Update: {
          created_at?: string
          document_version?: number | null
          extraction_confidence?: number | null
          extraction_date?: string | null
          id?: string
          source_document_id?: string | null
          source_passage?: string | null
          status?: string
          target_field?: string
          target_record_id?: string
          target_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_provenance_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_policies: {
        Row: {
          created_at: string
          description: string | null
          domain: string
          enforcement_mode: string
          id: string
          is_active: boolean
          policy_key: string
          rule: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          domain?: string
          enforcement_mode?: string
          id?: string
          is_active?: boolean
          policy_key: string
          rule?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          domain?: string
          enforcement_mode?: string
          id?: string
          is_active?: boolean
          policy_key?: string
          rule?: Json
        }
        Relationships: []
      }
      governance_transitions: {
        Row: {
          created_at: string
          domain: string
          from_state: string
          guard_conditions: Json | null
          id: string
          is_active: boolean
          required_approvals: Json | null
          to_state: string
        }
        Insert: {
          created_at?: string
          domain?: string
          from_state: string
          guard_conditions?: Json | null
          id?: string
          is_active?: boolean
          required_approvals?: Json | null
          to_state: string
        }
        Update: {
          created_at?: string
          domain?: string
          from_state?: string
          guard_conditions?: Json | null
          id?: string
          is_active?: boolean
          required_approvals?: Json | null
          to_state?: string
        }
        Relationships: []
      }
      governance_violations: {
        Row: {
          actor_id: string | null
          actor_type: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          policy_key: string
          project_id: string | null
          reason: string
          resolved: boolean
          severity: string
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          policy_key: string
          project_id?: string | null
          reason: string
          resolved?: boolean
          severity?: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          policy_key?: string
          project_id?: string | null
          reason?: string
          resolved?: boolean
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_violations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_violations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          auto_retry_count: number
          created_at: string
          detail: string | null
          id: string
          project_id: string | null
          resolution_notes: string | null
          root_cause_class: string | null
          scope: string
          scope_id: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          auto_retry_count?: number
          created_at?: string
          detail?: string | null
          id?: string
          project_id?: string | null
          resolution_notes?: string | null
          root_cause_class?: string | null
          scope?: string
          scope_id?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          auto_retry_count?: number
          created_at?: string
          detail?: string | null
          id?: string
          project_id?: string | null
          resolution_notes?: string | null
          root_cause_class?: string | null
          scope?: string
          scope_id?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
        ]
      }
      inferred_completions: {
        Row: {
          confidence: number | null
          created_at: string
          entity_name: string | null
          entity_type: string
          field_key: string
          id: string
          inferred_value: Json
          project_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_context: string | null
          source_document_ids: string[] | null
          status: string
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          entity_name?: string | null
          entity_type?: string
          field_key: string
          id?: string
          inferred_value: Json
          project_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_context?: string | null
          source_document_ids?: string[] | null
          status?: string
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          entity_name?: string | null
          entity_type?: string
          field_key?: string
          id?: string
          inferred_value?: Json
          project_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_context?: string | null
          source_document_ids?: string[] | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inferred_completions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inferred_completions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_runs: {
        Row: {
          completed_at: string | null
          conflicts_found: number | null
          created_at: string
          documents_processed: number | null
          documents_total: number | null
          entities_extracted: number | null
          error_message: string | null
          id: string
          inferred_proposed: number | null
          missing_detected: number | null
          project_id: string
          series_id: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          conflicts_found?: number | null
          created_at?: string
          documents_processed?: number | null
          documents_total?: number | null
          entities_extracted?: number | null
          error_message?: string | null
          id?: string
          inferred_proposed?: number | null
          missing_detected?: number | null
          project_id: string
          series_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          conflicts_found?: number | null
          created_at?: string
          documents_processed?: number | null
          documents_total?: number | null
          entities_extracted?: number | null
          error_message?: string | null
          id?: string
          inferred_proposed?: number | null
          missing_detected?: number | null
          project_id?: string
          series_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingestion_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingestion_runs_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      job_queue: {
        Row: {
          actual_cost: number | null
          agent_slug: string | null
          completed_at: string | null
          created_at: string
          episode_id: string | null
          error_message: string | null
          estimated_cost: number | null
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
          actual_cost?: number | null
          agent_slug?: string | null
          completed_at?: string | null
          created_at?: string
          episode_id?: string | null
          error_message?: string | null
          estimated_cost?: number | null
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
          actual_cost?: number | null
          agent_slug?: string | null
          completed_at?: string | null
          created_at?: string
          episode_id?: string | null
          error_message?: string | null
          estimated_cost?: number | null
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
        ]
      }
      legal_ethics_reviews: {
        Row: {
          agent_run_id: string | null
          created_at: string
          episode_id: string
          flags: Json | null
          id: string
          recommendations: string | null
          verdict: string
        }
        Insert: {
          agent_run_id?: string | null
          created_at?: string
          episode_id: string
          flags?: Json | null
          id?: string
          recommendations?: string | null
          verdict?: string
        }
        Update: {
          agent_run_id?: string | null
          created_at?: string
          episode_id?: string
          flags?: Json | null
          id?: string
          recommendations?: string | null
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_ethics_reviews_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_ethics_reviews_episode_id_fkey"
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
      project_assets: {
        Row: {
          asset_type: string
          created_at: string
          created_by: string | null
          id: string
          lifecycle_state: string | null
          metadata: Json | null
          project_id: string
          source_model: string | null
          source_provider: string | null
          status: string
          storage_path: string | null
          tags: string[] | null
          url: string | null
        }
        Insert: {
          asset_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lifecycle_state?: string | null
          metadata?: Json | null
          project_id: string
          source_model?: string | null
          source_provider?: string | null
          status?: string
          storage_path?: string | null
          tags?: string[] | null
          url?: string | null
        }
        Update: {
          asset_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lifecycle_state?: string | null
          metadata?: Json | null
          project_id?: string
          source_model?: string | null
          source_provider?: string | null
          status?: string
          storage_path?: string | null
          tags?: string[] | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
        ]
      }
      project_budgets: {
        Row: {
          actual_total_cost: number | null
          budget_limit_credits: number | null
          cost_mode: string
          created_at: string
          estimated_total_cost: number | null
          id: string
          per_scene_limit_credits: number | null
          project_id: string
          updated_at: string
        }
        Insert: {
          actual_total_cost?: number | null
          budget_limit_credits?: number | null
          cost_mode?: string
          created_at?: string
          estimated_total_cost?: number | null
          id?: string
          per_scene_limit_credits?: number | null
          project_id: string
          updated_at?: string
        }
        Update: {
          actual_total_cost?: number | null
          budget_limit_credits?: number | null
          cost_mode?: string
          created_at?: string
          estimated_total_cost?: number | null
          id?: string
          per_scene_limit_credits?: number | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
        ]
      }
      project_validation_reports: {
        Row: {
          blocking_count: number
          created_at: string
          id: string
          premium_readiness_score: number | null
          project_id: string
          report: Json
          timeline_version: string | null
          total_anomalies: number
        }
        Insert: {
          blocking_count?: number
          created_at?: string
          id?: string
          premium_readiness_score?: number | null
          project_id: string
          report?: Json
          timeline_version?: string | null
          total_anomalies?: number
        }
        Update: {
          blocking_count?: number
          created_at?: string
          id?: string
          premium_readiness_score?: number | null
          project_id?: string
          report?: Json
          timeline_version?: string | null
          total_anomalies?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_validation_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_validation_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          artist_presence: string | null
          aspect_ratio: string | null
          audio_url: string | null
          clip_type: string | null
          created_at: string
          duration_sec: number | null
          face_urls: Json | null
          governance_state: string
          id: string
          mode: string | null
          provider_default: string | null
          quality_tier: string | null
          ref_photo_urls: Json | null
          render_target: string | null
          status: Database["public"]["Enums"]["project_status"]
          style_preset: string | null
          synopsis: string | null
          title: string
          type: Database["public"]["Enums"]["project_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          artist_presence?: string | null
          aspect_ratio?: string | null
          audio_url?: string | null
          clip_type?: string | null
          created_at?: string
          duration_sec?: number | null
          face_urls?: Json | null
          governance_state?: string
          id?: string
          mode?: string | null
          provider_default?: string | null
          quality_tier?: string | null
          ref_photo_urls?: Json | null
          render_target?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          style_preset?: string | null
          synopsis?: string | null
          title?: string
          type: Database["public"]["Enums"]["project_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          artist_presence?: string | null
          aspect_ratio?: string | null
          audio_url?: string | null
          clip_type?: string | null
          created_at?: string
          duration_sec?: number | null
          face_urls?: Json | null
          governance_state?: string
          id?: string
          mode?: string | null
          provider_default?: string | null
          quality_tier?: string | null
          ref_photo_urls?: Json | null
          render_target?: string | null
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
      provider_payload_logs: {
        Row: {
          created_at: string
          episode_shot_id: string | null
          error_message: string | null
          id: string
          latency_ms: number | null
          model: string
          payload_sent: Json | null
          project_id: string
          provider: string
          response_metadata: Json | null
          scene_id: string | null
          shot_id: string | null
          status: string | null
          step: string | null
        }
        Insert: {
          created_at?: string
          episode_shot_id?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          model: string
          payload_sent?: Json | null
          project_id: string
          provider: string
          response_metadata?: Json | null
          scene_id?: string | null
          shot_id?: string | null
          status?: string | null
          step?: string | null
        }
        Update: {
          created_at?: string
          episode_shot_id?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          model?: string
          payload_sent?: Json | null
          project_id?: string
          provider?: string
          response_metadata?: Json | null
          scene_id?: string | null
          shot_id?: string | null
          status?: string | null
          step?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_payload_logs_episode_shot_id_fkey"
            columns: ["episode_shot_id"]
            isOneToOne: false
            referencedRelation: "episode_shots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_payload_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_payload_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_payload_logs_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_registry: {
        Row: {
          api_base_url: string | null
          capabilities: Json | null
          cost_per_second: number | null
          created_at: string
          display_name: string | null
          health_checked_at: string | null
          health_status: string | null
          id: string
          is_active: boolean
          is_enabled: boolean
          max_duration_sec: number | null
          name: string
          provider_type: string
          updated_at: string
        }
        Insert: {
          api_base_url?: string | null
          capabilities?: Json | null
          cost_per_second?: number | null
          created_at?: string
          display_name?: string | null
          health_checked_at?: string | null
          health_status?: string | null
          id?: string
          is_active?: boolean
          is_enabled?: boolean
          max_duration_sec?: number | null
          name: string
          provider_type?: string
          updated_at?: string
        }
        Update: {
          api_base_url?: string | null
          capabilities?: Json | null
          cost_per_second?: number | null
          created_at?: string
          display_name?: string | null
          health_checked_at?: string | null
          health_status?: string | null
          id?: string
          is_active?: boolean
          is_enabled?: boolean
          max_duration_sec?: number | null
          name?: string
          provider_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      psychology_reviews: {
        Row: {
          agent_run_id: string | null
          character_assessments: Json | null
          created_at: string
          episode_id: string
          id: string
          recommendations: string | null
          verdict: string
        }
        Insert: {
          agent_run_id?: string | null
          character_assessments?: Json | null
          created_at?: string
          episode_id: string
          id?: string
          recommendations?: string | null
          verdict?: string
        }
        Update: {
          agent_run_id?: string | null
          character_assessments?: Json | null
          created_at?: string
          episode_id?: string
          id?: string
          recommendations?: string | null
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "psychology_reviews_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psychology_reviews_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_reports: {
        Row: {
          blocking_issues: Json | null
          checked_by: string | null
          checks: Json | null
          created_at: string
          delivery_manifest_id: string | null
          episode_id: string | null
          has_blocking_issues: boolean | null
          id: string
          overall_verdict: string
          score: number | null
          timeline_id: string | null
          warnings: Json | null
        }
        Insert: {
          blocking_issues?: Json | null
          checked_by?: string | null
          checks?: Json | null
          created_at?: string
          delivery_manifest_id?: string | null
          episode_id?: string | null
          has_blocking_issues?: boolean | null
          id?: string
          overall_verdict?: string
          score?: number | null
          timeline_id?: string | null
          warnings?: Json | null
        }
        Update: {
          blocking_issues?: Json | null
          checked_by?: string | null
          checks?: Json | null
          created_at?: string
          delivery_manifest_id?: string | null
          episode_id?: string | null
          has_blocking_issues?: boolean | null
          id?: string
          overall_verdict?: string
          score?: number | null
          timeline_id?: string | null
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "qc_reports_delivery_manifest_id_fkey"
            columns: ["delivery_manifest_id"]
            isOneToOne: false
            referencedRelation: "delivery_manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_reports_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_reports_timeline_id_fkey"
            columns: ["timeline_id"]
            isOneToOne: false
            referencedRelation: "timelines"
            referencedColumns: ["id"]
          },
        ]
      }
      redaction_profiles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          series_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          series_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redaction_profiles_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      redaction_reports: {
        Row: {
          created_at: string
          findings: Json | null
          id: string
          redaction_run_id: string
          summary: string | null
          verdict: string
        }
        Insert: {
          created_at?: string
          findings?: Json | null
          id?: string
          redaction_run_id: string
          summary?: string | null
          verdict?: string
        }
        Update: {
          created_at?: string
          findings?: Json | null
          id?: string
          redaction_run_id?: string
          summary?: string | null
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "redaction_reports_redaction_run_id_fkey"
            columns: ["redaction_run_id"]
            isOneToOne: false
            referencedRelation: "redaction_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      redaction_rules: {
        Row: {
          action: string
          created_at: string
          id: string
          pattern: string | null
          profile_id: string
          rule_type: string
        }
        Insert: {
          action?: string
          created_at?: string
          id?: string
          pattern?: string | null
          profile_id: string
          rule_type: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          pattern?: string | null
          profile_id?: string
          rule_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "redaction_rules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "redaction_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      redaction_runs: {
        Row: {
          applied_rules: Json | null
          completed_at: string | null
          created_at: string
          episode_id: string
          id: string
          issues_found: number | null
          issues_resolved: number | null
          profile_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          applied_rules?: Json | null
          completed_at?: string | null
          created_at?: string
          episode_id: string
          id?: string
          issues_found?: number | null
          issues_resolved?: number | null
          profile_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          applied_rules?: Json | null
          completed_at?: string | null
          created_at?: string
          episode_id?: string
          id?: string
          issues_found?: number | null
          issues_resolved?: number | null
          profile_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "redaction_runs_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redaction_runs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "redaction_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      render_batches: {
        Row: {
          created_at: string | null
          episode_ids: Json | null
          error_message: string | null
          id: string
          progress: Json | null
          season_id: string | null
          series_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          episode_ids?: Json | null
          error_message?: string | null
          id?: string
          progress?: Json | null
          season_id?: string | null
          series_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          episode_ids?: Json | null
          error_message?: string | null
          id?: string
          progress?: Json | null
          season_id?: string | null
          series_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "render_batches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "render_batches_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
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
      repair_attempts: {
        Row: {
          anomaly_event_id: string
          attempt_number: number
          created_at: string
          id: string
          provider_used: string | null
          repair_mode: string
          result_asset_id: string | null
          status: string
        }
        Insert: {
          anomaly_event_id: string
          attempt_number?: number
          created_at?: string
          id?: string
          provider_used?: string | null
          repair_mode?: string
          result_asset_id?: string | null
          status?: string
        }
        Update: {
          anomaly_event_id?: string
          attempt_number?: number
          created_at?: string
          id?: string
          provider_used?: string | null
          repair_mode?: string
          result_asset_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_attempts_anomaly_event_id_fkey"
            columns: ["anomaly_event_id"]
            isOneToOne: false
            referencedRelation: "anomaly_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_attempts_result_asset_id_fkey"
            columns: ["result_asset_id"]
            isOneToOne: false
            referencedRelation: "project_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_policies: {
        Row: {
          category: string
          created_at: string
          default_action: string
          escalation_action: string
          id: string
          max_retries: number
        }
        Insert: {
          category: string
          created_at?: string
          default_action?: string
          escalation_action?: string
          id?: string
          max_retries?: number
        }
        Update: {
          category?: string
          created_at?: string
          default_action?: string
          escalation_action?: string
          id?: string
          max_retries?: number
        }
        Relationships: []
      }
      review_gates: {
        Row: {
          approved_by: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_action: string | null
          episode_id: string | null
          gate_owner: string | null
          gate_type: string
          id: string
          metadata: Json | null
          notes: string | null
          project_id: string
          scene_id: string | null
          stale: boolean
          status: string
          superseded_by: string | null
          updated_at: string
          version_ref: string | null
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_action?: string | null
          episode_id?: string | null
          gate_owner?: string | null
          gate_type: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          project_id: string
          scene_id?: string | null
          stale?: boolean
          status?: string
          superseded_by?: string | null
          updated_at?: string
          version_ref?: string | null
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_action?: string | null
          episode_id?: string | null
          gate_owner?: string | null
          gate_type?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          project_id?: string
          scene_id?: string | null
          stale?: boolean
          status?: string
          superseded_by?: string | null
          updated_at?: string
          version_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_gates_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_gates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_gates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_gates_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_gates_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "review_gates"
            referencedColumns: ["id"]
          },
        ]
      }
      scene_clip_candidates: {
        Row: {
          asset_id: string | null
          created_at: string
          episode_shot_id: string | null
          id: string
          is_approved: boolean | null
          is_locked: boolean | null
          is_selected: boolean | null
          metadata: Json | null
          project_id: string
          rank: number
          ranking_reason: string | null
          scene_id: string | null
          score_continuity: number | null
          score_duration_fit: number | null
          score_provider_confidence: number | null
          score_technical: number | null
          score_total: number | null
          score_user_priority: number | null
          score_visual_quality: number | null
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          episode_shot_id?: string | null
          id?: string
          is_approved?: boolean | null
          is_locked?: boolean | null
          is_selected?: boolean | null
          metadata?: Json | null
          project_id: string
          rank?: number
          ranking_reason?: string | null
          scene_id?: string | null
          score_continuity?: number | null
          score_duration_fit?: number | null
          score_provider_confidence?: number | null
          score_technical?: number | null
          score_total?: number | null
          score_user_priority?: number | null
          score_visual_quality?: number | null
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          episode_shot_id?: string | null
          id?: string
          is_approved?: boolean | null
          is_locked?: boolean | null
          is_selected?: boolean | null
          metadata?: Json | null
          project_id?: string
          rank?: number
          ranking_reason?: string | null
          scene_id?: string | null
          score_continuity?: number | null
          score_duration_fit?: number | null
          score_provider_confidence?: number | null
          score_technical?: number | null
          score_total?: number | null
          score_user_priority?: number | null
          score_visual_quality?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scene_clip_candidates_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "project_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scene_clip_candidates_episode_shot_id_fkey"
            columns: ["episode_shot_id"]
            isOneToOne: false
            referencedRelation: "episode_shots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scene_clip_candidates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scene_clip_candidates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scene_clip_candidates_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      scenes: {
        Row: {
          characters: Json | null
          continuity_group_id: string | null
          created_at: string
          description: string | null
          duration_target_sec: number | null
          episode_id: string
          id: string
          idx: number
          location: string | null
          mood: string | null
          shot_count: number | null
          time_of_day: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          characters?: Json | null
          continuity_group_id?: string | null
          created_at?: string
          description?: string | null
          duration_target_sec?: number | null
          episode_id: string
          id?: string
          idx?: number
          location?: string | null
          mood?: string | null
          shot_count?: number | null
          time_of_day?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          characters?: Json | null
          continuity_group_id?: string | null
          created_at?: string
          description?: string | null
          duration_target_sec?: number | null
          episode_id?: string
          id?: string
          idx?: number
          location?: string | null
          mood?: string | null
          shot_count?: number | null
          time_of_day?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenes_continuity_group_id_fkey"
            columns: ["continuity_group_id"]
            isOneToOne: false
            referencedRelation: "continuity_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenes_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
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
      seasons: {
        Row: {
          arc_summary: string | null
          created_at: string
          id: string
          number: number
          series_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          arc_summary?: string | null
          created_at?: string
          id?: string
          number: number
          series_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          arc_summary?: string | null
          created_at?: string
          id?: string
          number?: number
          series_id?: string
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
          episode_duration_min: number | null
          episodes_per_season: number | null
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
          episode_duration_min?: number | null
          episodes_per_season?: number | null
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
          episode_duration_min?: number | null
          episodes_per_season?: number | null
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
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
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
        ]
      }
      source_document_autofill_runs: {
        Row: {
          auto_filled: number | null
          completed_at: string | null
          created_at: string
          document_id: string
          id: string
          needs_review: number | null
          rejected: number | null
          started_at: string | null
          status: string
          total_fields: number | null
        }
        Insert: {
          auto_filled?: number | null
          completed_at?: string | null
          created_at?: string
          document_id: string
          id?: string
          needs_review?: number | null
          rejected?: number | null
          started_at?: string | null
          status?: string
          total_fields?: number | null
        }
        Update: {
          auto_filled?: number | null
          completed_at?: string | null
          created_at?: string
          document_id?: string
          id?: string
          needs_review?: number | null
          rejected?: number | null
          started_at?: string | null
          status?: string
          total_fields?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "source_document_autofill_runs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      source_document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          id: string
          metadata: Json | null
          page_number: number | null
          section_type: string | null
        }
        Insert: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id: string
          id?: string
          metadata?: Json | null
          page_number?: number | null
          section_type?: string | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          id?: string
          metadata?: Json | null
          page_number?: number | null
          section_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      source_document_entities: {
        Row: {
          ambiguity_flag: boolean | null
          created_at: string
          document_id: string
          entity_key: string
          entity_type: string
          entity_value: Json
          extraction_confidence: number
          id: string
          mapping_confidence: number | null
          semantic_confidence: number | null
          source_chunk_id: string | null
          source_passage: string | null
          status: string
        }
        Insert: {
          ambiguity_flag?: boolean | null
          created_at?: string
          document_id: string
          entity_key: string
          entity_type: string
          entity_value?: Json
          extraction_confidence?: number
          id?: string
          mapping_confidence?: number | null
          semantic_confidence?: number | null
          source_chunk_id?: string | null
          source_passage?: string | null
          status?: string
        }
        Update: {
          ambiguity_flag?: boolean | null
          created_at?: string
          document_id?: string
          entity_key?: string
          entity_type?: string
          entity_value?: Json
          extraction_confidence?: number
          id?: string
          mapping_confidence?: number | null
          semantic_confidence?: number | null
          source_chunk_id?: string | null
          source_passage?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_document_entities_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_document_entities_source_chunk_id_fkey"
            columns: ["source_chunk_id"]
            isOneToOne: false
            referencedRelation: "source_document_chunks"
            referencedColumns: ["id"]
          },
        ]
      }
      source_document_mappings: {
        Row: {
          created_at: string
          current_value: Json | null
          entity_id: string
          id: string
          proposed_value: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_field: string
          target_record_id: string | null
          target_table: string
        }
        Insert: {
          created_at?: string
          current_value?: Json | null
          entity_id: string
          id?: string
          proposed_value?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_field: string
          target_record_id?: string | null
          target_table: string
        }
        Update: {
          created_at?: string
          current_value?: Json | null
          entity_id?: string
          id?: string
          proposed_value?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_field?: string
          target_record_id?: string | null
          target_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_document_mappings_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "source_document_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      source_documents: {
        Row: {
          created_at: string
          document_role: string | null
          extraction_mode: string | null
          file_name: string
          file_size_bytes: number | null
          file_type: string
          id: string
          metadata: Json | null
          parent_document_id: string | null
          project_id: string | null
          role_confidence: number | null
          series_id: string | null
          source_priority: string | null
          status: string
          storage_path: string | null
          tags: string[] | null
          updated_at: string
          uploaded_by: string
          version: number
        }
        Insert: {
          created_at?: string
          document_role?: string | null
          extraction_mode?: string | null
          file_name: string
          file_size_bytes?: number | null
          file_type?: string
          id?: string
          metadata?: Json | null
          parent_document_id?: string | null
          project_id?: string | null
          role_confidence?: number | null
          series_id?: string | null
          source_priority?: string | null
          status?: string
          storage_path?: string | null
          tags?: string[] | null
          updated_at?: string
          uploaded_by: string
          version?: number
        }
        Update: {
          created_at?: string
          document_role?: string | null
          extraction_mode?: string | null
          file_name?: string
          file_size_bytes?: number | null
          file_type?: string
          id?: string
          metadata?: Json | null
          parent_document_id?: string | null
          project_id?: string | null
          role_confidence?: number | null
          series_id?: string | null
          source_priority?: string | null
          status?: string
          storage_path?: string | null
          tags?: string[] | null
          updated_at?: string
          uploaded_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "source_documents_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_documents_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_clips: {
        Row: {
          asset_id: string | null
          created_at: string
          end_time_ms: number
          episode_shot_id: string | null
          id: string
          in_trim_ms: number | null
          locked: boolean | null
          metadata: Json | null
          model: string | null
          name: string | null
          out_trim_ms: number | null
          provider: string | null
          scene_id: string | null
          shot_id: string | null
          source_url: string | null
          start_time_ms: number
          status: string
          track_id: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          end_time_ms?: number
          episode_shot_id?: string | null
          id?: string
          in_trim_ms?: number | null
          locked?: boolean | null
          metadata?: Json | null
          model?: string | null
          name?: string | null
          out_trim_ms?: number | null
          provider?: string | null
          scene_id?: string | null
          shot_id?: string | null
          source_url?: string | null
          start_time_ms?: number
          status?: string
          track_id: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          end_time_ms?: number
          episode_shot_id?: string | null
          id?: string
          in_trim_ms?: number | null
          locked?: boolean | null
          metadata?: Json | null
          model?: string | null
          name?: string | null
          out_trim_ms?: number | null
          provider?: string | null
          scene_id?: string | null
          shot_id?: string | null
          source_url?: string | null
          start_time_ms?: number
          status?: string
          track_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_clips_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "project_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_clips_episode_shot_id_fkey"
            columns: ["episode_shot_id"]
            isOneToOne: false
            referencedRelation: "episode_shots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_clips_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_clips_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "timeline_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_tracks: {
        Row: {
          created_at: string
          gain: number | null
          id: string
          idx: number
          label: string
          locked: boolean | null
          muted: boolean | null
          solo: boolean | null
          timeline_id: string
          track_type: string
          volume: number | null
        }
        Insert: {
          created_at?: string
          gain?: number | null
          id?: string
          idx?: number
          label?: string
          locked?: boolean | null
          muted?: boolean | null
          solo?: boolean | null
          timeline_id: string
          track_type?: string
          volume?: number | null
        }
        Update: {
          created_at?: string
          gain?: number | null
          id?: string
          idx?: number
          label?: string
          locked?: boolean | null
          muted?: boolean | null
          solo?: boolean | null
          timeline_id?: string
          track_type?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "timeline_tracks_timeline_id_fkey"
            columns: ["timeline_id"]
            isOneToOne: false
            referencedRelation: "timelines"
            referencedColumns: ["id"]
          },
        ]
      }
      timelines: {
        Row: {
          created_at: string
          created_by: string | null
          duration_ms: number | null
          episode_id: string | null
          fps: number | null
          id: string
          locked_by: string | null
          look_preset: string | null
          metadata: Json | null
          name: string
          project_id: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_ms?: number | null
          episode_id?: string | null
          fps?: number | null
          id?: string
          locked_by?: string | null
          look_preset?: string | null
          metadata?: Json | null
          name?: string
          project_id: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_ms?: number | null
          episode_id?: string | null
          fps?: number | null
          id?: string
          locked_by?: string | null
          look_preset?: string | null
          metadata?: Json | null
          name?: string
          project_id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "timelines_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timelines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timelines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
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
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints_safe"
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
      workflow_approvals: {
        Row: {
          created_at: string
          decided_by_user: string | null
          decision: string
          id: string
          reason: string | null
          workflow_step_id: string
        }
        Insert: {
          created_at?: string
          decided_by_user?: string | null
          decision?: string
          id?: string
          reason?: string | null
          workflow_step_id: string
        }
        Update: {
          created_at?: string
          decided_by_user?: string | null
          decision?: string
          id?: string
          reason?: string | null
          workflow_step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_approvals_workflow_step_id_fkey"
            columns: ["workflow_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_confidence_scores: {
        Row: {
          agent_run_id: string | null
          created_at: string
          details: Json | null
          dimension: string
          episode_id: string | null
          id: string
          score: number
          workflow_step_id: string | null
        }
        Insert: {
          agent_run_id?: string | null
          created_at?: string
          details?: Json | null
          dimension: string
          episode_id?: string | null
          id?: string
          score?: number
          workflow_step_id?: string | null
        }
        Update: {
          agent_run_id?: string | null
          created_at?: string
          details?: Json | null
          dimension?: string
          episode_id?: string | null
          id?: string
          score?: number
          workflow_step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_confidence_scores_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_confidence_scores_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_confidence_scores_workflow_step_id_fkey"
            columns: ["workflow_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_runs: {
        Row: {
          completed_at: string | null
          correlation_id: string | null
          created_at: string
          current_step_key: string | null
          episode_id: string
          error_message: string | null
          id: string
          idempotency_key: string | null
          series_id: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          current_step_key?: string | null
          episode_id: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          series_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          current_step_key?: string | null
          episode_id?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          series_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_runs_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_step_runs: {
        Row: {
          agent_run_id: string
          created_at: string
          id: string
          workflow_step_id: string
        }
        Insert: {
          agent_run_id: string
          created_at?: string
          id?: string
          workflow_step_id: string
        }
        Update: {
          agent_run_id?: string
          created_at?: string
          id?: string
          workflow_step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_step_runs_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_step_runs_workflow_step_id_fkey"
            columns: ["workflow_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          agents: string[] | null
          auto_advance_threshold: number | null
          completed_at: string | null
          created_at: string
          id: string
          label: string | null
          requires_approval: boolean | null
          started_at: string | null
          status: string
          step_key: string
          step_order: number
          workflow_run_id: string
        }
        Insert: {
          agents?: string[] | null
          auto_advance_threshold?: number | null
          completed_at?: string | null
          created_at?: string
          id?: string
          label?: string | null
          requires_approval?: boolean | null
          started_at?: string | null
          status?: string
          step_key: string
          step_order?: number
          workflow_run_id: string
        }
        Update: {
          agents?: string[] | null
          auto_advance_threshold?: number | null
          completed_at?: string | null
          created_at?: string
          id?: string
          label?: string | null
          requires_approval?: boolean | null
          started_at?: string | null
          status?: string
          step_key?: string
          step_order?: number
          workflow_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
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
      webhook_endpoints_safe: {
        Row: {
          active: boolean | null
          created_at: string | null
          events: string[] | null
          id: string | null
          secret_masked: string | null
          updated_at: string | null
          url: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          events?: string[] | null
          id?: string | null
          secret_masked?: never
          updated_at?: string | null
          url?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          events?: string[] | null
          id?: string | null
          secret_masked?: never
          updated_at?: string | null
          url?: string | null
          user_id?: string | null
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
      user_owns_project: { Args: { p_project_id: string }; Returns: boolean }
      user_owns_series: { Args: { p_series_id: string }; Returns: boolean }
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
      project_type: "clip" | "film" | "series" | "music_video"
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
      project_type: ["clip", "film", "series", "music_video"],
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

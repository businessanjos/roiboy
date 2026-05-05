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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_addons: {
        Row: {
          account_id: string
          addon_plan_id: string
          created_at: string
          id: string
          quantity: number
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          addon_plan_id: string
          created_at?: string
          id?: string
          quantity?: number
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          addon_plan_id?: string
          created_at?: string
          id?: string
          quantity?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_addons_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_addons_addon_plan_id_fkey"
            columns: ["addon_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      account_settings: {
        Row: {
          account_id: string
          ai_analysis_frequency: string | null
          ai_auto_analysis_enabled: boolean | null
          ai_confidence_threshold: number | null
          ai_life_events_prompt: string | null
          ai_min_message_length: number | null
          ai_model: string | null
          ai_risk_prompt: string | null
          ai_roi_prompt: string | null
          ai_system_prompt: string | null
          created_at: string
          escore_live_participation: number
          escore_live_presence: number
          escore_whatsapp_engagement: number
          id: string
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          onboarding_step: number
          threshold_engagement_drop_percent: number
          threshold_low_escore: number
          threshold_low_roizometer: number
          threshold_silence_days: number
          updated_at: string
          vnps_eligible_max_risk: number
          vnps_eligible_min_escore: number
          vnps_eligible_min_score: number
          vnps_risk_weight_high: number
          vnps_risk_weight_low: number
          vnps_risk_weight_medium: number
          weight_live_interaction: number
          weight_whatsapp_audio: number
          weight_whatsapp_text: number
          zapp_allowed_roles: Json | null
        }
        Insert: {
          account_id: string
          ai_analysis_frequency?: string | null
          ai_auto_analysis_enabled?: boolean | null
          ai_confidence_threshold?: number | null
          ai_life_events_prompt?: string | null
          ai_min_message_length?: number | null
          ai_model?: string | null
          ai_risk_prompt?: string | null
          ai_roi_prompt?: string | null
          ai_system_prompt?: string | null
          created_at?: string
          escore_live_participation?: number
          escore_live_presence?: number
          escore_whatsapp_engagement?: number
          id?: string
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          onboarding_step?: number
          threshold_engagement_drop_percent?: number
          threshold_low_escore?: number
          threshold_low_roizometer?: number
          threshold_silence_days?: number
          updated_at?: string
          vnps_eligible_max_risk?: number
          vnps_eligible_min_escore?: number
          vnps_eligible_min_score?: number
          vnps_risk_weight_high?: number
          vnps_risk_weight_low?: number
          vnps_risk_weight_medium?: number
          weight_live_interaction?: number
          weight_whatsapp_audio?: number
          weight_whatsapp_text?: number
          zapp_allowed_roles?: Json | null
        }
        Update: {
          account_id?: string
          ai_analysis_frequency?: string | null
          ai_auto_analysis_enabled?: boolean | null
          ai_confidence_threshold?: number | null
          ai_life_events_prompt?: string | null
          ai_min_message_length?: number | null
          ai_model?: string | null
          ai_risk_prompt?: string | null
          ai_roi_prompt?: string | null
          ai_system_prompt?: string | null
          created_at?: string
          escore_live_participation?: number
          escore_live_presence?: number
          escore_whatsapp_engagement?: number
          id?: string
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          onboarding_step?: number
          threshold_engagement_drop_percent?: number
          threshold_low_escore?: number
          threshold_low_roizometer?: number
          threshold_silence_days?: number
          updated_at?: string
          vnps_eligible_max_risk?: number
          vnps_eligible_min_escore?: number
          vnps_eligible_min_score?: number
          vnps_risk_weight_high?: number
          vnps_risk_weight_low?: number
          vnps_risk_weight_medium?: number
          weight_live_interaction?: number
          weight_whatsapp_audio?: number
          weight_whatsapp_text?: number
          zapp_allowed_roles?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "account_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          asaas_customer_id: string | null
          city: string | null
          complement: string | null
          contact_name: string | null
          created_at: string
          document: string | null
          document_type: string | null
          email: string | null
          id: string
          name: string
          neighborhood: string | null
          payment_method_configured: boolean
          phone: string | null
          plan_id: string | null
          state: string | null
          street: string | null
          street_number: string | null
          subscription_status: string | null
          trial_ends_at: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          asaas_customer_id?: string | null
          city?: string | null
          complement?: string | null
          contact_name?: string | null
          created_at?: string
          document?: string | null
          document_type?: string | null
          email?: string | null
          id?: string
          name: string
          neighborhood?: string | null
          payment_method_configured?: boolean
          phone?: string | null
          plan_id?: string | null
          state?: string | null
          street?: string | null
          street_number?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          asaas_customer_id?: string | null
          city?: string | null
          complement?: string | null
          contact_name?: string | null
          created_at?: string
          document?: string | null
          document_type?: string | null
          email?: string | null
          id?: string
          name?: string
          neighborhood?: string | null
          payment_method_configured?: boolean
          phone?: string | null
          plan_id?: string | null
          state?: string | null
          street?: string | null
          street_number?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_types: {
        Row: {
          account_id: string
          color: string | null
          created_at: string
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          sector_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sector_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sector_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_types_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_functions: {
        Row: {
          account_id: string
          created_at: string
          description: string | null
          display_order: number
          function_key: string
          function_name: string
          id: string
          instructions: string | null
          is_enabled: boolean
          settings: Json | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          description?: string | null
          display_order?: number
          function_key: string
          function_name: string
          id?: string
          instructions?: string | null
          is_enabled?: boolean
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          description?: string | null
          display_order?: number
          function_key?: string
          function_name?: string
          id?: string
          instructions?: string | null
          is_enabled?: boolean
          settings?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_functions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_analysis_queue: {
        Row: {
          account_id: string
          attempts: number
          client_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_type: string
          max_attempts: number
          message_id: string | null
          payload: Json | null
          priority: number
          started_at: string | null
          status: string
        }
        Insert: {
          account_id: string
          attempts?: number
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          max_attempts?: number
          message_id?: string | null
          payload?: Json | null
          priority?: number
          started_at?: string | null
          status?: string
        }
        Update: {
          account_id?: string
          attempts?: number
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          max_attempts?: number
          message_id?: string | null
          payload?: Json | null
          priority?: number
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_analysis_queue_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analysis_queue_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ai_analysis_queue_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analysis_queue_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "zapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_effective_patterns: {
        Row: {
          account_id: string
          created_at: string
          effective_response: string
          extracted_at: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          pattern_type: string
          positive_outcomes: number | null
          reviewed_by: string | null
          sector_id: string
          source_conversation_id: string | null
          source_message_id: string | null
          success_score: number | null
          times_used: number | null
          trigger_context: string | null
          updated_at: string
          why_it_works: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          effective_response: string
          extracted_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          pattern_type: string
          positive_outcomes?: number | null
          reviewed_by?: string | null
          sector_id: string
          source_conversation_id?: string | null
          source_message_id?: string | null
          success_score?: number | null
          times_used?: number | null
          trigger_context?: string | null
          updated_at?: string
          why_it_works?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          effective_response?: string
          extracted_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          pattern_type?: string
          positive_outcomes?: number | null
          reviewed_by?: string | null
          sector_id?: string
          source_conversation_id?: string | null
          source_message_id?: string | null
          success_score?: number | null
          times_used?: number | null
          trigger_context?: string | null
          updated_at?: string
          why_it_works?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_effective_patterns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_effective_patterns_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "zapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_sector_agents: {
        Row: {
          avatar_url: string | null
          created_at: string
          description: string | null
          display_name: string
          features: Json | null
          greeting_message: string | null
          id: string
          is_enabled: boolean
          max_tokens: number | null
          model: string
          name: string
          personality: string | null
          sector_id: string
          system_prompt: string | null
          temperature: number | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          display_name: string
          features?: Json | null
          greeting_message?: string | null
          id?: string
          is_enabled?: boolean
          max_tokens?: number | null
          model?: string
          name: string
          personality?: string | null
          sector_id: string
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          features?: Json | null
          greeting_message?: string | null
          id?: string
          is_enabled?: boolean
          max_tokens?: number | null
          model?: string
          name?: string
          personality?: string | null
          sector_id?: string
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_suggestion_feedback: {
        Row: {
          account_id: string
          client_responded: boolean | null
          client_sentiment: string | null
          context_messages: Json | null
          conversation_id: string | null
          created_at: string
          edited_before_send: boolean | null
          feedback: string
          final_text_sent: string | null
          id: string
          original_text: string | null
          response_time_minutes: number | null
          sector_id: string
          suggested_text: string
          suggestion_type: string
          user_id: string
          was_used: boolean | null
        }
        Insert: {
          account_id: string
          client_responded?: boolean | null
          client_sentiment?: string | null
          context_messages?: Json | null
          conversation_id?: string | null
          created_at?: string
          edited_before_send?: boolean | null
          feedback: string
          final_text_sent?: string | null
          id?: string
          original_text?: string | null
          response_time_minutes?: number | null
          sector_id: string
          suggested_text: string
          suggestion_type: string
          user_id: string
          was_used?: boolean | null
        }
        Update: {
          account_id?: string
          client_responded?: boolean | null
          client_sentiment?: string | null
          context_messages?: Json | null
          conversation_id?: string | null
          created_at?: string
          edited_before_send?: boolean | null
          feedback?: string
          final_text_sent?: string | null
          id?: string
          original_text?: string | null
          response_time_minutes?: number | null
          sector_id?: string
          suggested_text?: string
          suggestion_type?: string
          user_id?: string
          was_used?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestion_feedback_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_suggestion_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "zapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_alerts: {
        Row: {
          account_id: string
          alert_sent_at: string
          alert_type: string
          current_value: number
          email_sent_to: string
          id: string
          threshold_value: number
        }
        Insert: {
          account_id: string
          alert_sent_at?: string
          alert_type: string
          current_value: number
          email_sent_to: string
          id?: string
          threshold_value: number
        }
        Update: {
          account_id?: string
          alert_sent_at?: string
          alert_type?: string
          current_value?: number
          email_sent_to?: string
          id?: string
          threshold_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_alerts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_limits: {
        Row: {
          account_id: string
          alert_email: string
          created_at: string
          id: string
          is_enabled: boolean | null
          last_alert_sent_at: string | null
          max_analyses_per_day: number | null
          max_cost_per_day: number | null
          max_tokens_per_day: number | null
          updated_at: string
        }
        Insert: {
          account_id: string
          alert_email: string
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          last_alert_sent_at?: string | null
          max_analyses_per_day?: number | null
          max_cost_per_day?: number | null
          max_tokens_per_day?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          alert_email?: string
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          last_alert_sent_at?: string | null
          max_analyses_per_day?: number | null
          max_cost_per_day?: number | null
          max_tokens_per_day?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_limits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          account_id: string
          client_id: string | null
          created_at: string
          id: string
          input_tokens: number
          life_events_created: number
          message_id: string | null
          model: string
          output_tokens: number
          recommendations_created: number
          risk_events_created: number
          roi_events_created: number
        }
        Insert: {
          account_id: string
          client_id?: string | null
          created_at?: string
          id?: string
          input_tokens?: number
          life_events_created?: number
          message_id?: string | null
          model: string
          output_tokens?: number
          recommendations_created?: number
          risk_events_created?: number
          roi_events_created?: number
        }
        Update: {
          account_id?: string
          client_id?: string | null
          created_at?: string
          id?: string
          input_tokens?: number
          life_events_created?: number
          message_id?: string | null
          model?: string
          output_tokens?: number
          recommendations_created?: number
          risk_events_created?: number
          roi_events_created?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ai_usage_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "message_events"
            referencedColumns: ["id"]
          },
        ]
      }
      api_key_logs: {
        Row: {
          api_key_id: string
          executed_at: string | null
          id: string
          ip_address: string | null
          method: string | null
          path: string | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id: string
          executed_at?: string | null
          id?: string
          ip_address?: string | null
          method?: string | null
          path?: string | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string
          executed_at?: string | null
          id?: string
          ip_address?: string | null
          method?: string | null
          path?: string | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_key_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          account_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_preview: string
          last_used_at: string | null
          name: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_preview: string
          last_used_at?: string | null
          name?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_preview?: string
          last_used_at?: string | null
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          account_id: string
          client_id: string
          created_at: string
          duration_sec: number | null
          event_id: string | null
          id: string
          join_delay_sec: number | null
          join_time: string
          leave_time: string | null
          live_session_id: string | null
        }
        Insert: {
          account_id: string
          client_id: string
          created_at?: string
          duration_sec?: number | null
          event_id?: string | null
          id?: string
          join_delay_sec?: number | null
          join_time: string
          leave_time?: string | null
          live_session_id?: string | null
        }
        Update: {
          account_id?: string
          client_id?: string
          created_at?: string
          duration_sec?: number | null
          event_id?: string | null
          id?: string
          join_delay_sec?: number | null
          join_time?: string
          leave_time?: string | null
          live_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "attendance_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_checkin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          account_id: string
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          account_id: string
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          account_id?: string
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_digit: string | null
          account_id: string
          account_number: string | null
          account_type: string
          agency: string | null
          agency_city: string | null
          agency_complement: string | null
          agency_digit: string | null
          agency_neighborhood: string | null
          agency_number: string | null
          agency_state: string | null
          agency_street: string | null
          agency_zip_code: string | null
          bank_code: string | null
          bank_name: string
          card_brand: string | null
          card_last_digits: string | null
          closing_day: number | null
          color: string
          created_at: string
          credit_limit: number | null
          currency: string
          current_balance: number
          due_day: number | null
          exclude_from_reports: boolean | null
          id: string
          initial_balance: number
          initial_balance_date: string | null
          is_active: boolean
          linked_account_id: string | null
          logo_url: string | null
          manager_email: string | null
          manager_name: string | null
          manager_phone: string | null
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          account_digit?: string | null
          account_id: string
          account_number?: string | null
          account_type?: string
          agency?: string | null
          agency_city?: string | null
          agency_complement?: string | null
          agency_digit?: string | null
          agency_neighborhood?: string | null
          agency_number?: string | null
          agency_state?: string | null
          agency_street?: string | null
          agency_zip_code?: string | null
          bank_code?: string | null
          bank_name: string
          card_brand?: string | null
          card_last_digits?: string | null
          closing_day?: number | null
          color?: string
          created_at?: string
          credit_limit?: number | null
          currency?: string
          current_balance?: number
          due_day?: number | null
          exclude_from_reports?: boolean | null
          id?: string
          initial_balance?: number
          initial_balance_date?: string | null
          is_active?: boolean
          linked_account_id?: string | null
          logo_url?: string | null
          manager_email?: string | null
          manager_name?: string | null
          manager_phone?: string | null
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          account_digit?: string | null
          account_id?: string
          account_number?: string | null
          account_type?: string
          agency?: string | null
          agency_city?: string | null
          agency_complement?: string | null
          agency_digit?: string | null
          agency_neighborhood?: string | null
          agency_number?: string | null
          agency_state?: string | null
          agency_street?: string | null
          agency_zip_code?: string | null
          bank_code?: string | null
          bank_name?: string
          card_brand?: string | null
          card_last_digits?: string | null
          closing_day?: number | null
          color?: string
          created_at?: string
          credit_limit?: number | null
          currency?: string
          current_balance?: number
          due_day?: number | null
          exclude_from_reports?: boolean | null
          id?: string
          initial_balance?: number
          initial_balance_date?: string | null
          is_active?: boolean
          linked_account_id?: string | null
          logo_url?: string | null
          manager_email?: string | null
          manager_name?: string | null
          manager_phone?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_linked_account_id_fkey"
            columns: ["linked_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      boletos: {
        Row: {
          account_id: string
          amount: number
          bank_account_id: string | null
          bank_code: string | null
          bank_name: string | null
          barcode: string | null
          client_id: string | null
          created_at: string
          description: string | null
          digitable_line: string | null
          discount_amount: number | null
          document_number: string | null
          due_date: string
          external_id: string | null
          external_url: string | null
          financial_entry_id: string | null
          fine_amount: number | null
          id: string
          interest_amount: number | null
          issue_date: string
          notes: string | null
          our_number: string | null
          paid_amount: number | null
          payment_date: string | null
          pdf_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount?: number
          bank_account_id?: string | null
          bank_code?: string | null
          bank_name?: string | null
          barcode?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          digitable_line?: string | null
          discount_amount?: number | null
          document_number?: string | null
          due_date: string
          external_id?: string | null
          external_url?: string | null
          financial_entry_id?: string | null
          fine_amount?: number | null
          id?: string
          interest_amount?: number | null
          issue_date?: string
          notes?: string | null
          our_number?: string | null
          paid_amount?: number | null
          payment_date?: string | null
          pdf_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          bank_account_id?: string | null
          bank_code?: string | null
          bank_name?: string | null
          barcode?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          digitable_line?: string | null
          discount_amount?: number | null
          document_number?: string | null
          due_date?: string
          external_id?: string | null
          external_url?: string | null
          financial_entry_id?: string | null
          fine_amount?: number | null
          id?: string
          interest_amount?: number | null
          issue_date?: string
          notes?: string | null
          our_number?: string | null
          paid_amount?: number | null
          payment_date?: string | null
          pdf_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boletos_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boletos_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boletos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "boletos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boletos_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      churn_analysis_reports: {
        Row: {
          account_id: string
          clients_with_messages: number | null
          contracts_analyzed: number | null
          created_at: string
          created_by: string | null
          id: string
          insights: string
          total_messages: number | null
          total_value: number | null
        }
        Insert: {
          account_id: string
          clients_with_messages?: number | null
          contracts_analyzed?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          insights: string
          total_messages?: number | null
          total_value?: number | null
        }
        Update: {
          account_id?: string
          clients_with_messages?: number | null
          contracts_analyzed?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          insights?: string
          total_messages?: number | null
          total_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "churn_analysis_reports_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_churn_analyses: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          messages_analyzed: number
          overall_risk: string | null
          signals: Json
          summary: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          messages_analyzed?: number
          overall_risk?: string | null
          signals?: Json
          summary?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          messages_analyzed?: number
          overall_risk?: string | null
          signals?: Json
          summary?: string | null
        }
        Relationships: []
      }
      client_contracts: {
        Row: {
          account_id: string
          cancellation_justification: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          client_id: string
          clinica_ryka_error: string | null
          clinica_ryka_external_id: string | null
          clinica_ryka_status: string | null
          clinica_ryka_synced_at: string | null
          contract_type: string
          created_at: string
          currency: string
          deal_id: string | null
          end_date: string | null
          file_name: string | null
          file_url: string | null
          first_due_date: string | null
          id: string
          installments_count: number | null
          installments_detail: Json | null
          negotiation_description: string | null
          negotiation_type: string | null
          notes: string | null
          parent_contract_id: string | null
          payment_method: string | null
          payment_option: string | null
          product_id: string | null
          receivables_generated: boolean | null
          receivables_generated_at: string | null
          start_date: string
          status: string
          status_changed_at: string | null
          status_reason: string | null
          updated_at: string
          value: number
        }
        Insert: {
          account_id: string
          cancellation_justification?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          client_id: string
          clinica_ryka_error?: string | null
          clinica_ryka_external_id?: string | null
          clinica_ryka_status?: string | null
          clinica_ryka_synced_at?: string | null
          contract_type?: string
          created_at?: string
          currency?: string
          deal_id?: string | null
          end_date?: string | null
          file_name?: string | null
          file_url?: string | null
          first_due_date?: string | null
          id?: string
          installments_count?: number | null
          installments_detail?: Json | null
          negotiation_description?: string | null
          negotiation_type?: string | null
          notes?: string | null
          parent_contract_id?: string | null
          payment_method?: string | null
          payment_option?: string | null
          product_id?: string | null
          receivables_generated?: boolean | null
          receivables_generated_at?: string | null
          start_date: string
          status?: string
          status_changed_at?: string | null
          status_reason?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          account_id?: string
          cancellation_justification?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          client_id?: string
          clinica_ryka_error?: string | null
          clinica_ryka_external_id?: string | null
          clinica_ryka_status?: string | null
          clinica_ryka_synced_at?: string | null
          contract_type?: string
          created_at?: string
          currency?: string
          deal_id?: string | null
          end_date?: string | null
          file_name?: string | null
          file_url?: string | null
          first_due_date?: string | null
          id?: string
          installments_count?: number | null
          installments_detail?: Json | null
          negotiation_description?: string | null
          negotiation_type?: string | null
          notes?: string | null
          parent_contract_id?: string | null
          payment_method?: string | null
          payment_option?: string | null
          product_id?: string | null
          receivables_generated?: boolean | null
          receivables_generated_at?: string | null
          start_date?: string
          status?: string
          status_changed_at?: string | null
          status_reason?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_contracts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contracts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contracts_parent_contract_id_fkey"
            columns: ["parent_contract_id"]
            isOneToOne: false
            referencedRelation: "client_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contracts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      client_diagnostics: {
        Row: {
          account_id: string
          annual_revenue: number | null
          business_sector: string | null
          business_segment: string | null
          client_id: string
          company_size: string | null
          created_at: string
          created_by: string | null
          current_situation: string | null
          employee_count: number | null
          expectations: string | null
          has_defined_processes: boolean | null
          has_digital_presence: boolean | null
          has_financial_control: boolean | null
          has_formal_structure: boolean | null
          has_marketing_strategy: boolean | null
          has_sales_team: boolean | null
          id: string
          long_term_goals: string | null
          main_challenges: Json | null
          notes: string | null
          pain_points: string | null
          previous_solutions: string | null
          short_term_goals: string | null
          success_criteria: string | null
          updated_at: string
          years_in_business: number | null
        }
        Insert: {
          account_id: string
          annual_revenue?: number | null
          business_sector?: string | null
          business_segment?: string | null
          client_id: string
          company_size?: string | null
          created_at?: string
          created_by?: string | null
          current_situation?: string | null
          employee_count?: number | null
          expectations?: string | null
          has_defined_processes?: boolean | null
          has_digital_presence?: boolean | null
          has_financial_control?: boolean | null
          has_formal_structure?: boolean | null
          has_marketing_strategy?: boolean | null
          has_sales_team?: boolean | null
          id?: string
          long_term_goals?: string | null
          main_challenges?: Json | null
          notes?: string | null
          pain_points?: string | null
          previous_solutions?: string | null
          short_term_goals?: string | null
          success_criteria?: string | null
          updated_at?: string
          years_in_business?: number | null
        }
        Update: {
          account_id?: string
          annual_revenue?: number | null
          business_sector?: string | null
          business_segment?: string | null
          client_id?: string
          company_size?: string | null
          created_at?: string
          created_by?: string | null
          current_situation?: string | null
          employee_count?: number | null
          expectations?: string | null
          has_defined_processes?: boolean | null
          has_digital_presence?: boolean | null
          has_financial_control?: boolean | null
          has_formal_structure?: boolean | null
          has_marketing_strategy?: boolean | null
          has_sales_team?: boolean | null
          id?: string
          long_term_goals?: string | null
          main_challenges?: Json | null
          notes?: string | null
          pain_points?: string | null
          previous_solutions?: string | null
          short_term_goals?: string | null
          success_criteria?: string | null
          updated_at?: string
          years_in_business?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_diagnostics_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_diagnostics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_diagnostics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_diagnostics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_event_deliveries: {
        Row: {
          account_id: string
          client_id: string
          created_at: string
          delivered_at: string | null
          delivery_method: string | null
          event_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["delivery_status"]
          updated_at: string
        }
        Insert: {
          account_id: string
          client_id: string
          created_at?: string
          delivered_at?: string | null
          delivery_method?: string | null
          event_id: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
        }
        Update: {
          account_id?: string
          client_id?: string
          created_at?: string
          delivered_at?: string | null
          delivery_method?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_event_deliveries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_event_deliveries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_event_deliveries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_event_deliveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_event_deliveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_checkin_view"
            referencedColumns: ["id"]
          },
        ]
      }
      client_field_values: {
        Row: {
          account_id: string
          client_id: string
          created_at: string
          field_id: string
          id: string
          updated_at: string
          value_boolean: boolean | null
          value_date: string | null
          value_json: Json | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          account_id: string
          client_id: string
          created_at?: string
          field_id: string
          id?: string
          updated_at?: string
          value_boolean?: boolean | null
          value_date?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          account_id?: string
          client_id?: string
          created_at?: string
          field_id?: string
          id?: string
          updated_at?: string
          value_boolean?: boolean | null
          value_date?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_field_values_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_field_values_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_field_values_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      client_followups: {
        Row: {
          account_id: string
          client_id: string
          content: string | null
          created_at: string
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          parent_id: string | null
          title: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          client_id: string
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          parent_id?: string | null
          title?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          client_id?: string
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          parent_id?: string | null
          title?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_followups_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_followups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_followups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_followups_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "client_followups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_followups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_form_sends: {
        Row: {
          account_id: string
          client_id: string
          created_at: string
          form_id: string
          id: string
          responded_at: string | null
          sent_at: string
        }
        Insert: {
          account_id: string
          client_id: string
          created_at?: string
          form_id: string
          id?: string
          responded_at?: string | null
          sent_at?: string
        }
        Update: {
          account_id?: string
          client_id?: string
          created_at?: string
          form_id?: string
          id?: string
          responded_at?: string | null
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_form_sends_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_form_sends_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_form_sends_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_form_sends_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      client_life_event_images: {
        Row: {
          account_id: string
          created_at: string
          file_name: string | null
          file_size: number | null
          id: string
          image_url: string
          life_event_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          id?: string
          image_url: string
          life_event_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          id?: string
          image_url?: string
          life_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_life_event_images_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_life_event_images_life_event_id_fkey"
            columns: ["life_event_id"]
            isOneToOne: false
            referencedRelation: "client_life_events"
            referencedColumns: ["id"]
          },
        ]
      }
      client_life_events: {
        Row: {
          account_id: string
          client_id: string
          created_at: string
          description: string | null
          event_date: string | null
          event_type: string
          id: string
          image_url: string | null
          integration_id: string | null
          is_recurring: boolean
          message: string | null
          reminder_days_before: number | null
          scheduled_send_at: string | null
          send_error: string | null
          send_status: string | null
          sent_at: string | null
          source: string
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          client_id: string
          created_at?: string
          description?: string | null
          event_date?: string | null
          event_type: string
          id?: string
          image_url?: string | null
          integration_id?: string | null
          is_recurring?: boolean
          message?: string | null
          reminder_days_before?: number | null
          scheduled_send_at?: string | null
          send_error?: string | null
          send_status?: string | null
          sent_at?: string | null
          source?: string
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          client_id?: string
          created_at?: string
          description?: string | null
          event_date?: string | null
          event_type?: string
          id?: string
          image_url?: string | null
          integration_id?: string | null
          is_recurring?: boolean
          message?: string | null
          reminder_days_before?: number | null
          scheduled_send_at?: string | null
          send_error?: string | null
          send_status?: string | null
          sent_at?: string | null
          source?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_life_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_life_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_life_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_products: {
        Row: {
          account_id: string
          client_id: string
          created_at: string
          id: string
          product_id: string
        }
        Insert: {
          account_id: string
          client_id: string
          created_at?: string
          id?: string
          product_id: string
        }
        Update: {
          account_id?: string
          client_id?: string
          created_at?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_products_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      client_relationships: {
        Row: {
          account_id: string
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          primary_client_id: string
          related_client_id: string
          relationship_label: string | null
          relationship_type: Database["public"]["Enums"]["client_relationship_type"]
          sync_data: boolean
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          primary_client_id: string
          related_client_id: string
          relationship_label?: string | null
          relationship_type?: Database["public"]["Enums"]["client_relationship_type"]
          sync_data?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          primary_client_id?: string
          related_client_id?: string
          relationship_label?: string | null
          relationship_type?: Database["public"]["Enums"]["client_relationship_type"]
          sync_data?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_relationships_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_relationships_primary_client_id_fkey"
            columns: ["primary_client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_relationships_primary_client_id_fkey"
            columns: ["primary_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_relationships_related_client_id_fkey"
            columns: ["related_client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_relationships_related_client_id_fkey"
            columns: ["related_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_service_history: {
        Row: {
          account_id: string
          agent_id: string | null
          agent_name: string | null
          ai_summary: string | null
          client_id: string | null
          closed_at: string
          conversation_assignment_id: string | null
          created_at: string
          department_name: string | null
          duration_minutes: number | null
          id: string
          lead_id: string | null
          messages_count: number | null
          notes: string | null
          outcome: string | null
          sector_id: string | null
          started_at: string | null
          summary: string | null
        }
        Insert: {
          account_id: string
          agent_id?: string | null
          agent_name?: string | null
          ai_summary?: string | null
          client_id?: string | null
          closed_at?: string
          conversation_assignment_id?: string | null
          created_at?: string
          department_name?: string | null
          duration_minutes?: number | null
          id?: string
          lead_id?: string | null
          messages_count?: number | null
          notes?: string | null
          outcome?: string | null
          sector_id?: string | null
          started_at?: string | null
          summary?: string | null
        }
        Update: {
          account_id?: string
          agent_id?: string | null
          agent_name?: string | null
          ai_summary?: string | null
          client_id?: string | null
          closed_at?: string
          conversation_assignment_id?: string | null
          created_at?: string
          department_name?: string | null
          duration_minutes?: number | null
          id?: string
          lead_id?: string | null
          messages_count?: number | null
          notes?: string | null
          outcome?: string | null
          sector_id?: string | null
          started_at?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_service_history_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_service_history_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "zapp_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_service_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_service_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_service_history_conversation_assignment_id_fkey"
            columns: ["conversation_assignment_id"]
            isOneToOne: false
            referencedRelation: "zapp_conversation_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_service_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      client_stage_checklist: {
        Row: {
          account_id: string
          checklist_item_id: string
          client_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
        }
        Insert: {
          account_id: string
          checklist_item_id: string
          client_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
        }
        Update: {
          account_id?: string
          checklist_item_id?: string
          client_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_stage_checklist_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_stage_checklist_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "stage_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_stage_checklist_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_stage_checklist_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_stage_checklist_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_stages: {
        Row: {
          account_id: string
          color: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_id: string
          color?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          color?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_stages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_subscriptions: {
        Row: {
          account_id: string
          amount: number
          billing_period: Database["public"]["Enums"]["billing_period"]
          client_id: string
          created_at: string
          currency: string
          end_date: string | null
          id: string
          next_billing_date: string | null
          notes: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          product_name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount?: number
          billing_period?: Database["public"]["Enums"]["billing_period"]
          client_id: string
          created_at?: string
          currency?: string
          end_date?: string | null
          id?: string
          next_billing_date?: string | null
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          product_name: string
          start_date?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          billing_period?: Database["public"]["Enums"]["billing_period"]
          client_id?: string
          created_at?: string
          currency?: string
          end_date?: string | null
          id?: string
          next_billing_date?: string | null
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          product_name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_id: string
          additional_bank_accounts: Json | null
          additional_phones: Json | null
          additional_pix_keys: Json | null
          avatar_url: string | null
          bank_account: string | null
          bank_account_type: string | null
          bank_agency: string | null
          bank_code: string | null
          bank_name: string | null
          bio: string | null
          birth_date: string | null
          business_city: string | null
          business_complement: string | null
          business_neighborhood: string | null
          business_niche: string | null
          business_segment: string | null
          business_state: string | null
          business_street: string | null
          business_street_number: string | null
          business_zip_code: string | null
          city: string | null
          cnpj: string | null
          companies: Json | null
          company_name: string | null
          company_name_normalized: string | null
          complement: string | null
          contract_end_date: string | null
          contract_start_date: string | null
          country: string | null
          cpf: string | null
          created_at: string
          emails: Json | null
          full_name: string
          full_name_normalized: string | null
          id: string
          instagram: string | null
          instagrams: Json | null
          is_mls: boolean
          logo_url: string | null
          mls_level: string | null
          neighborhood: string | null
          notes: string | null
          phone_e164: string
          pix_key: string | null
          pix_key_type: string | null
          responsible_user_id: string | null
          rg: string | null
          sales_user_id: string | null
          stage_id: string | null
          state: string | null
          status: Database["public"]["Enums"]["client_status"]
          street: string | null
          street_number: string | null
          tags: Json | null
          zip_code: string | null
        }
        Insert: {
          account_id: string
          additional_bank_accounts?: Json | null
          additional_phones?: Json | null
          additional_pix_keys?: Json | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_code?: string | null
          bank_name?: string | null
          bio?: string | null
          birth_date?: string | null
          business_city?: string | null
          business_complement?: string | null
          business_neighborhood?: string | null
          business_niche?: string | null
          business_segment?: string | null
          business_state?: string | null
          business_street?: string | null
          business_street_number?: string | null
          business_zip_code?: string | null
          city?: string | null
          cnpj?: string | null
          companies?: Json | null
          company_name?: string | null
          company_name_normalized?: string | null
          complement?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          country?: string | null
          cpf?: string | null
          created_at?: string
          emails?: Json | null
          full_name: string
          full_name_normalized?: string | null
          id?: string
          instagram?: string | null
          instagrams?: Json | null
          is_mls?: boolean
          logo_url?: string | null
          mls_level?: string | null
          neighborhood?: string | null
          notes?: string | null
          phone_e164: string
          pix_key?: string | null
          pix_key_type?: string | null
          responsible_user_id?: string | null
          rg?: string | null
          sales_user_id?: string | null
          stage_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          street?: string | null
          street_number?: string | null
          tags?: Json | null
          zip_code?: string | null
        }
        Update: {
          account_id?: string
          additional_bank_accounts?: Json | null
          additional_phones?: Json | null
          additional_pix_keys?: Json | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_code?: string | null
          bank_name?: string | null
          bio?: string | null
          birth_date?: string | null
          business_city?: string | null
          business_complement?: string | null
          business_neighborhood?: string | null
          business_niche?: string | null
          business_segment?: string | null
          business_state?: string | null
          business_street?: string | null
          business_street_number?: string | null
          business_zip_code?: string | null
          city?: string | null
          cnpj?: string | null
          companies?: Json | null
          company_name?: string | null
          company_name_normalized?: string | null
          complement?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          country?: string | null
          cpf?: string | null
          created_at?: string
          emails?: Json | null
          full_name?: string
          full_name_normalized?: string | null
          id?: string
          instagram?: string | null
          instagrams?: Json | null
          is_mls?: boolean
          logo_url?: string | null
          mls_level?: string | null
          neighborhood?: string | null
          notes?: string | null
          phone_e164?: string
          pix_key?: string | null
          pix_key_type?: string | null
          responsible_user_id?: string | null
          rg?: string | null
          sales_user_id?: string | null
          stage_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          street?: string | null
          street_number?: string | null
          tags?: Json | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_sales_user_id_fkey"
            columns: ["sales_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "client_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_deal_entries: {
        Row: {
          account_id: string
          client_name: string | null
          commission_on_pix: number | null
          commission_on_remaining: number | null
          commission_pending: number
          commission_percent: number
          commission_released: number
          commission_status: string
          commission_total: number
          contract_id: string | null
          created_at: string
          deal_id: string | null
          deal_title: string | null
          deal_value: number
          id: string
          installments_count: number | null
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_option: string | null
          payment_status: string
          period_id: string | null
          pix_amount_paid: number | null
          pix_installments_paid: number | null
          plan_id: string
          released_at: string | null
          remaining_amount: number | null
          remaining_paid: boolean | null
          remaining_paid_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          client_name?: string | null
          commission_on_pix?: number | null
          commission_on_remaining?: number | null
          commission_pending?: number
          commission_percent?: number
          commission_released?: number
          commission_status?: string
          commission_total?: number
          contract_id?: string | null
          created_at?: string
          deal_id?: string | null
          deal_title?: string | null
          deal_value?: number
          id?: string
          installments_count?: number | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_option?: string | null
          payment_status?: string
          period_id?: string | null
          pix_amount_paid?: number | null
          pix_installments_paid?: number | null
          plan_id: string
          released_at?: string | null
          remaining_amount?: number | null
          remaining_paid?: boolean | null
          remaining_paid_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          client_name?: string | null
          commission_on_pix?: number | null
          commission_on_remaining?: number | null
          commission_pending?: number
          commission_percent?: number
          commission_released?: number
          commission_status?: string
          commission_total?: number
          contract_id?: string | null
          created_at?: string
          deal_id?: string | null
          deal_title?: string | null
          deal_value?: number
          id?: string
          installments_count?: number | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_option?: string | null
          payment_status?: string
          period_id?: string | null
          pix_amount_paid?: number | null
          pix_installments_paid?: number | null
          plan_id?: string
          released_at?: string | null
          remaining_amount?: number | null
          remaining_paid?: boolean | null
          remaining_paid_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_deal_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_deal_entries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "client_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_deal_entries_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_deal_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "commission_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_deal_entries_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "commission_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_deal_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_periods: {
        Row: {
          account_id: string
          all_triggers_met: boolean
          approved_at: string | null
          approved_by: string | null
          bonus_value: number
          commission_value: number
          conversion_rate: number
          created_at: string
          has_delinquency: boolean
          id: string
          notes: string | null
          period_end: string
          period_start: string
          plan_id: string
          status: string
          tasks_completed: number
          tasks_total: number
          tier_achieved_id: string | null
          total_calls: number
          total_commission: number
          triggers_met: Json | null
          updated_at: string
          user_id: string
          won_deals: number
          won_value: number
        }
        Insert: {
          account_id: string
          all_triggers_met?: boolean
          approved_at?: string | null
          approved_by?: string | null
          bonus_value?: number
          commission_value?: number
          conversion_rate?: number
          created_at?: string
          has_delinquency?: boolean
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          plan_id: string
          status?: string
          tasks_completed?: number
          tasks_total?: number
          tier_achieved_id?: string | null
          total_calls?: number
          total_commission?: number
          triggers_met?: Json | null
          updated_at?: string
          user_id: string
          won_deals?: number
          won_value?: number
        }
        Update: {
          account_id?: string
          all_triggers_met?: boolean
          approved_at?: string | null
          approved_by?: string | null
          bonus_value?: number
          commission_value?: number
          conversion_rate?: number
          created_at?: string
          has_delinquency?: boolean
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          plan_id?: string
          status?: string
          tasks_completed?: number
          tasks_total?: number
          tier_achieved_id?: string | null
          total_calls?: number
          total_commission?: number
          triggers_met?: Json | null
          updated_at?: string
          user_id?: string
          won_deals?: number
          won_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "commission_periods_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_periods_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_periods_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "commission_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_periods_tier_achieved_id_fkey"
            columns: ["tier_achieved_id"]
            isOneToOne: false
            referencedRelation: "commission_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_periods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_plans: {
        Row: {
          account_id: string
          cargo: string
          commission_model: string | null
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          monthly_quota: number
          name: string
          period_type: string
          prospecting_commission_percent: number
          sdr_value_per_call: number | null
          sdr_value_per_sale: number | null
          tier_mode: string
          updated_at: string
        }
        Insert: {
          account_id: string
          cargo?: string
          commission_model?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          monthly_quota?: number
          name: string
          period_type?: string
          prospecting_commission_percent?: number
          sdr_value_per_call?: number | null
          sdr_value_per_sale?: number | null
          tier_mode?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          cargo?: string
          commission_model?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          monthly_quota?: number
          name?: string
          period_type?: string
          prospecting_commission_percent?: number
          sdr_value_per_call?: number | null
          sdr_value_per_sale?: number | null
          tier_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_plans_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_sales_levels: {
        Row: {
          account_id: string
          created_at: string
          display_order: number
          fixed_salary: number
          id: string
          level_name: string
          monthly_target: number
          plan_id: string
          team_bonus_percent: number
          total_compensation: number
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          display_order?: number
          fixed_salary?: number
          id?: string
          level_name: string
          monthly_target?: number
          plan_id: string
          team_bonus_percent?: number
          total_compensation?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          display_order?: number
          fixed_salary?: number
          id?: string
          level_name?: string
          monthly_target?: number
          plan_id?: string
          team_bonus_percent?: number
          total_compensation?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_sales_levels_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_sales_levels_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "commission_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_tiers: {
        Row: {
          bonus_value: number | null
          commission_percent: number
          created_at: string
          display_order: number
          id: string
          is_super_meta: boolean
          max_value: number | null
          min_value: number
          plan_id: string
          tier_name: string
        }
        Insert: {
          bonus_value?: number | null
          commission_percent?: number
          created_at?: string
          display_order?: number
          id?: string
          is_super_meta?: boolean
          max_value?: number | null
          min_value?: number
          plan_id: string
          tier_name: string
        }
        Update: {
          bonus_value?: number | null
          commission_percent?: number
          created_at?: string
          display_order?: number
          id?: string
          is_super_meta?: boolean
          max_value?: number | null
          min_value?: number
          plan_id?: string
          tier_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_tiers_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "commission_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_triggers: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          plan_id: string
          trigger_type: string
          trigger_value: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          plan_id: string
          trigger_type: string
          trigger_value?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          plan_id?: string
          trigger_type?: string
          trigger_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_triggers_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "commission_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      company_goals: {
        Row: {
          account_id: string
          annual_goal: number
          created_at: string
          goal_type: string
          id: string
          monthly_goals: Json
          notes: string | null
          updated_at: string
          year: number
        }
        Insert: {
          account_id: string
          annual_goal?: number
          created_at?: string
          goal_type?: string
          id?: string
          monthly_goals?: Json
          notes?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          account_id?: string
          annual_goal?: number
          created_at?: string
          goal_type?: string
          id?: string
          monthly_goals?: Json
          notes?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      composition_presets: {
        Row: {
          account_id: string
          composition_items: string[]
          created_at: string | null
          id: string
          is_favorite: boolean | null
          name: string
          objective: string | null
          post_type: string | null
          specialist_version: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          composition_items: string[]
          created_at?: string | null
          id?: string
          is_favorite?: boolean | null
          name: string
          objective?: string | null
          post_type?: string | null
          specialist_version?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          composition_items?: string[]
          created_at?: string | null
          id?: string
          is_favorite?: boolean | null
          name?: string
          objective?: string | null
          post_type?: string | null
          specialist_version?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "composition_presets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      composition_templates: {
        Row: {
          composition_items: string[]
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_system: boolean | null
          name: string
          objective: string | null
          post_type: string | null
        }
        Insert: {
          composition_items: string[]
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          objective?: string | null
          post_type?: string | null
        }
        Update: {
          composition_items?: string[]
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          objective?: string | null
          post_type?: string | null
        }
        Relationships: []
      }
      consultant_bonus_payouts: {
        Row: {
          account_id: string
          achieved: boolean
          actual_value: number
          bonus_paid: number
          created_at: string
          goal_id: string
          id: string
          month: number
          notes: string | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          account_id: string
          achieved?: boolean
          actual_value?: number
          bonus_paid?: number
          created_at?: string
          goal_id: string
          id?: string
          month: number
          notes?: string | null
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          account_id?: string
          achieved?: boolean
          actual_value?: number
          bonus_paid?: number
          created_at?: string
          goal_id?: string
          id?: string
          month?: number
          notes?: string | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "consultant_bonus_payouts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_bonus_payouts_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "consultant_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_bonus_payouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_goals: {
        Row: {
          account_id: string
          annual_target: number
          bonus_amount: number
          created_at: string
          id: string
          metric_type: string
          monthly_targets: Json
          notes: string | null
          product_id: string
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          account_id: string
          annual_target?: number
          bonus_amount?: number
          created_at?: string
          id?: string
          metric_type: string
          monthly_targets?: Json
          notes?: string | null
          product_id: string
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          account_id?: string
          annual_target?: number
          bonus_amount?: number
          created_at?: string
          id?: string
          metric_type?: string
          monthly_targets?: Json
          notes?: string | null
          product_id?: string
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "consultant_goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_goals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_company_defaults: {
        Row: {
          account_id: string
          company_address: string | null
          company_bank_info: Json | null
          company_cnpj: string | null
          company_email: string | null
          company_name: string | null
          company_representative: string | null
          company_representative_cpf: string | null
          created_at: string
          default_jurisdiction: string | null
          default_late_fee_percentage: number | null
          default_late_interest_percentage: number | null
          default_rescission_penalty_percentage: number | null
          id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          company_address?: string | null
          company_bank_info?: Json | null
          company_cnpj?: string | null
          company_email?: string | null
          company_name?: string | null
          company_representative?: string | null
          company_representative_cpf?: string | null
          created_at?: string
          default_jurisdiction?: string | null
          default_late_fee_percentage?: number | null
          default_late_interest_percentage?: number | null
          default_rescission_penalty_percentage?: number | null
          id?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          company_address?: string | null
          company_bank_info?: Json | null
          company_cnpj?: string | null
          company_email?: string | null
          company_name?: string | null
          company_representative?: string | null
          company_representative_cpf?: string | null
          created_at?: string
          default_jurisdiction?: string | null
          default_late_fee_percentage?: number | null
          default_late_interest_percentage?: number | null
          default_rescission_penalty_percentage?: number | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_company_defaults_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          account_id: string
          content_html: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          product_id: string | null
          updated_at: string
          variables: Json
        }
        Insert: {
          account_id: string
          content_html?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          product_id?: string | null
          updated_at?: string
          variables?: Json
        }
        Update: {
          account_id?: string
          content_html?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          product_id?: string | null
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_templates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          account_id: string
          channel: Database["public"]["Enums"]["channel_type"]
          client_id: string
          created_at: string
          external_thread_id: string | null
          id: string
        }
        Insert: {
          account_id: string
          channel?: Database["public"]["Enums"]["channel_type"]
          client_id: string
          created_at?: string
          external_thread_id?: string | null
          id?: string
        }
        Update: {
          account_id?: string
          channel?: Database["public"]["Enums"]["channel_type"]
          client_id?: string
          created_at?: string
          external_thread_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          account_id: string
          code: string | null
          color: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          code?: string | null
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          code?: string | null
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_products: {
        Row: {
          account_id: string
          coupon_id: string
          created_at: string
          id: string
          product_id: string
        }
        Insert: {
          account_id: string
          coupon_id: string
          created_at?: string
          id?: string
          product_id: string
        }
        Update: {
          account_id?: string
          coupon_id?: string
          created_at?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_products_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_products_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_usages: {
        Row: {
          account_id: string
          client_id: string | null
          contract_id: string | null
          coupon_id: string
          created_at: string
          discount_applied: number
          final_value: number
          id: string
          original_value: number
          used_at: string
        }
        Insert: {
          account_id: string
          client_id?: string | null
          contract_id?: string | null
          coupon_id: string
          created_at?: string
          discount_applied?: number
          final_value?: number
          id?: string
          original_value?: number
          used_at?: string
        }
        Update: {
          account_id?: string
          client_id?: string | null
          contract_id?: string | null
          coupon_id?: string
          created_at?: string
          discount_applied?: number
          final_value?: number
          id?: string
          original_value?: number
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "coupon_usages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "client_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          account_id: string
          applies_to_contracts: boolean
          applies_to_subscriptions: boolean
          code: string
          created_at: string
          current_uses: number
          description: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          id: string
          is_active: boolean
          max_uses: number | null
          min_value: number | null
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          account_id: string
          applies_to_contracts?: boolean
          applies_to_subscriptions?: boolean
          code: string
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_value?: number | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          account_id?: string
          applies_to_contracts?: boolean
          applies_to_subscriptions?: boolean
          code?: string
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_value?: number | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_incentive_plans: {
        Row: {
          account_id: string
          annual_bonus_enabled: boolean
          annual_bonus_payment_channel: string | null
          annual_bonus_rules: string | null
          annual_bonus_value: number
          base_salary_monthly: number
          bonus_budget_amount: number
          bonus_budget_percent_base: string | null
          bonus_budget_period: string
          bonus_budget_value_type: string
          bonus_distribution_method: string
          bonus_distribution_shares: Json
          bonus_payment_channel: string | null
          bonus_payment_when: string | null
          churn_penalty_enabled: boolean
          churn_penalty_percent: number
          churn_penalty_threshold: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          minimum_achievement_percent: number
          monthly_bonus_payment_channel: string | null
          monthly_bonus_value: number
          name: string
          notes: string | null
          quarterly_bonus_enabled: boolean
          quarterly_bonus_payment_channel: string | null
          quarterly_bonus_rules: string | null
          quarterly_bonus_value: number
          role_label: string | null
          routines: Json
          updated_at: string
          user_id: string | null
          variable_target_monthly: number
          weight_churn: number
          weight_nps: number
          weight_renewal: number
        }
        Insert: {
          account_id: string
          annual_bonus_enabled?: boolean
          annual_bonus_payment_channel?: string | null
          annual_bonus_rules?: string | null
          annual_bonus_value?: number
          base_salary_monthly?: number
          bonus_budget_amount?: number
          bonus_budget_percent_base?: string | null
          bonus_budget_period?: string
          bonus_budget_value_type?: string
          bonus_distribution_method?: string
          bonus_distribution_shares?: Json
          bonus_payment_channel?: string | null
          bonus_payment_when?: string | null
          churn_penalty_enabled?: boolean
          churn_penalty_percent?: number
          churn_penalty_threshold?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          minimum_achievement_percent?: number
          monthly_bonus_payment_channel?: string | null
          monthly_bonus_value?: number
          name?: string
          notes?: string | null
          quarterly_bonus_enabled?: boolean
          quarterly_bonus_payment_channel?: string | null
          quarterly_bonus_rules?: string | null
          quarterly_bonus_value?: number
          role_label?: string | null
          routines?: Json
          updated_at?: string
          user_id?: string | null
          variable_target_monthly?: number
          weight_churn?: number
          weight_nps?: number
          weight_renewal?: number
        }
        Update: {
          account_id?: string
          annual_bonus_enabled?: boolean
          annual_bonus_payment_channel?: string | null
          annual_bonus_rules?: string | null
          annual_bonus_value?: number
          base_salary_monthly?: number
          bonus_budget_amount?: number
          bonus_budget_percent_base?: string | null
          bonus_budget_period?: string
          bonus_budget_value_type?: string
          bonus_distribution_method?: string
          bonus_distribution_shares?: Json
          bonus_payment_channel?: string | null
          bonus_payment_when?: string | null
          churn_penalty_enabled?: boolean
          churn_penalty_percent?: number
          churn_penalty_threshold?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          minimum_achievement_percent?: number
          monthly_bonus_payment_channel?: string | null
          monthly_bonus_value?: number
          name?: string
          notes?: string | null
          quarterly_bonus_enabled?: boolean
          quarterly_bonus_payment_channel?: string | null
          quarterly_bonus_rules?: string | null
          quarterly_bonus_value?: number
          role_label?: string | null
          routines?: Json
          updated_at?: string
          user_id?: string | null
          variable_target_monthly?: number
          weight_churn?: number
          weight_nps?: number
          weight_renewal?: number
        }
        Relationships: []
      }
      cs_incentive_tiers: {
        Row: {
          bonus_multiplier: number
          created_at: string
          id: string
          label: string | null
          max_achievement_percent: number | null
          min_achievement_percent: number
          plan_id: string
        }
        Insert: {
          bonus_multiplier?: number
          created_at?: string
          id?: string
          label?: string | null
          max_achievement_percent?: number | null
          min_achievement_percent: number
          plan_id: string
        }
        Update: {
          bonus_multiplier?: number
          created_at?: string
          id?: string
          label?: string | null
          max_achievement_percent?: number | null
          min_achievement_percent?: number
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cs_incentive_tiers_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "cs_incentive_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_folders: {
        Row: {
          account_id: string
          created_at: string
          display_order: number
          id: string
          is_expanded: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_expanded?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_expanded?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_folders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          account_id: string
          created_at: string
          display_order: number | null
          field_type: string
          folder_id: string | null
          id: string
          is_active: boolean | null
          is_required: boolean | null
          name: string
          options: Json | null
          required_stages: Json | null
          show_in_clients: boolean
          show_in_deals: boolean
          show_in_leads: boolean
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          display_order?: number | null
          field_type: string
          folder_id?: string | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          name: string
          options?: Json | null
          required_stages?: Json | null
          show_in_clients?: boolean
          show_in_deals?: boolean
          show_in_leads?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          display_order?: number | null
          field_type?: string
          folder_id?: string | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          name?: string
          options?: Json | null
          required_stages?: Json | null
          show_in_clients?: boolean
          show_in_deals?: boolean
          show_in_leads?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_fields_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "custom_field_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_activities: {
        Row: {
          account_id: string
          completed_at: string | null
          content: string | null
          created_at: string
          deal_id: string
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          new_value: string | null
          old_value: string | null
          scheduled_at: string | null
          title: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          account_id: string
          completed_at?: string | null
          content?: string | null
          created_at?: string
          deal_id: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          scheduled_at?: string | null
          title?: string | null
          type?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string
          completed_at?: string | null
          content?: string | null
          created_at?: string
          deal_id?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          scheduled_at?: string | null
          title?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_field_values: {
        Row: {
          account_id: string
          created_at: string
          deal_id: string
          field_id: string
          id: string
          updated_at: string
          value_boolean: boolean | null
          value_date: string | null
          value_json: Json | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          deal_id: string
          field_id: string
          id?: string
          updated_at?: string
          value_boolean?: boolean | null
          value_date?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          deal_id?: string
          field_id?: string
          id?: string
          updated_at?: string
          value_boolean?: boolean | null
          value_date?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_field_values_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_field_values_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_loss_reasons: {
        Row: {
          account_id: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_loss_reasons_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_loss_sub_reasons: {
        Row: {
          account_id: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          loss_reason_id: string
          name: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          loss_reason_id: string
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          loss_reason_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_loss_sub_reasons_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_loss_sub_reasons_loss_reason_id_fkey"
            columns: ["loss_reason_id"]
            isOneToOne: false
            referencedRelation: "deal_loss_reasons"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_operation_briefings: {
        Row: {
          account_id: string
          caixa_valor: number | null
          cidade: string | null
          client_id: string | null
          completed_at: string | null
          completed_by: string | null
          conhece_cliente_nossa: string | null
          conhece_cliente_nossa_bool: boolean | null
          conhece_cliente_nossa_quem: string | null
          created_at: string
          created_by: string | null
          da_aulas: boolean | null
          da_cursos: boolean | null
          deal_id: string | null
          dias_atende_semana: string | null
          dias_atende_semana_num: number | null
          equipamentos: string | null
          especialidade: string | null
          estado: string | null
          estado_uf: string | null
          estrutura_clinica: string | null
          faturamento_mes_1: number | null
          faturamento_mes_2: number | null
          faturamento_mes_3: number | null
          foco_atuacao: string | null
          horas_atende_dia: string | null
          horas_atende_dia_num: number | null
          id: string
          is_complete: boolean
          ja_fez_mentoria: string | null
          ja_fez_mentoria_bool: boolean | null
          ja_fez_mentoria_quem: string | null
          margem_lucro: string | null
          margem_lucro_percent: number | null
          meta_faturamento: number | null
          moeda_codigo: string | null
          numero_funcionarios: string | null
          numero_funcionarios_num: number | null
          numero_salas: number | null
          objetivo_mentoria: string | null
          observacoes: string | null
          pais: string | null
          pais_codigo: string | null
          tem_caixa: string | null
          tem_caixa_bool: boolean | null
          tempo_atuacao: string | null
          tempo_atuacao_anos: number | null
          ticket_medio: number | null
          trafego_investimento: string | null
          trafego_investimento_periodo: string | null
          trafego_investimento_valor: number | null
          ultimos_faturamentos: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          caixa_valor?: number | null
          cidade?: string | null
          client_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          conhece_cliente_nossa?: string | null
          conhece_cliente_nossa_bool?: boolean | null
          conhece_cliente_nossa_quem?: string | null
          created_at?: string
          created_by?: string | null
          da_aulas?: boolean | null
          da_cursos?: boolean | null
          deal_id?: string | null
          dias_atende_semana?: string | null
          dias_atende_semana_num?: number | null
          equipamentos?: string | null
          especialidade?: string | null
          estado?: string | null
          estado_uf?: string | null
          estrutura_clinica?: string | null
          faturamento_mes_1?: number | null
          faturamento_mes_2?: number | null
          faturamento_mes_3?: number | null
          foco_atuacao?: string | null
          horas_atende_dia?: string | null
          horas_atende_dia_num?: number | null
          id?: string
          is_complete?: boolean
          ja_fez_mentoria?: string | null
          ja_fez_mentoria_bool?: boolean | null
          ja_fez_mentoria_quem?: string | null
          margem_lucro?: string | null
          margem_lucro_percent?: number | null
          meta_faturamento?: number | null
          moeda_codigo?: string | null
          numero_funcionarios?: string | null
          numero_funcionarios_num?: number | null
          numero_salas?: number | null
          objetivo_mentoria?: string | null
          observacoes?: string | null
          pais?: string | null
          pais_codigo?: string | null
          tem_caixa?: string | null
          tem_caixa_bool?: boolean | null
          tempo_atuacao?: string | null
          tempo_atuacao_anos?: number | null
          ticket_medio?: number | null
          trafego_investimento?: string | null
          trafego_investimento_periodo?: string | null
          trafego_investimento_valor?: number | null
          ultimos_faturamentos?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          caixa_valor?: number | null
          cidade?: string | null
          client_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          conhece_cliente_nossa?: string | null
          conhece_cliente_nossa_bool?: boolean | null
          conhece_cliente_nossa_quem?: string | null
          created_at?: string
          created_by?: string | null
          da_aulas?: boolean | null
          da_cursos?: boolean | null
          deal_id?: string | null
          dias_atende_semana?: string | null
          dias_atende_semana_num?: number | null
          equipamentos?: string | null
          especialidade?: string | null
          estado?: string | null
          estado_uf?: string | null
          estrutura_clinica?: string | null
          faturamento_mes_1?: number | null
          faturamento_mes_2?: number | null
          faturamento_mes_3?: number | null
          foco_atuacao?: string | null
          horas_atende_dia?: string | null
          horas_atende_dia_num?: number | null
          id?: string
          is_complete?: boolean
          ja_fez_mentoria?: string | null
          ja_fez_mentoria_bool?: boolean | null
          ja_fez_mentoria_quem?: string | null
          margem_lucro?: string | null
          margem_lucro_percent?: number | null
          meta_faturamento?: number | null
          moeda_codigo?: string | null
          numero_funcionarios?: string | null
          numero_funcionarios_num?: number | null
          numero_salas?: number | null
          objetivo_mentoria?: string | null
          observacoes?: string | null
          pais?: string | null
          pais_codigo?: string | null
          tem_caixa?: string | null
          tem_caixa_bool?: boolean | null
          tempo_atuacao?: string | null
          tempo_atuacao_anos?: number | null
          ticket_medio?: number | null
          trafego_investimento?: string | null
          trafego_investimento_periodo?: string | null
          trafego_investimento_valor?: number | null
          ultimos_faturamentos?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_operation_briefings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_operation_briefings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "deal_operation_briefings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_operation_briefings_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_operation_briefings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_operation_briefings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stages: {
        Row: {
          account_id: string
          color: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          name_normalized: string | null
          pipeline_id: string
          probability: number | null
          updated_at: string
        }
        Insert: {
          account_id: string
          color?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          name_normalized?: string | null
          pipeline_id: string
          probability?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          color?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          name_normalized?: string | null
          pipeline_id?: string
          probability?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_stages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          account_id: string
          client_id: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          currency: string | null
          entry_value: number | null
          expected_close_date: string | null
          has_second_seat: boolean
          id: string
          lead_id: string | null
          loss_notes: string | null
          loss_reason_id: string | null
          loss_sub_reason_id: string | null
          lost_at: string | null
          lost_reason: string | null
          notes: string | null
          pipeline_id: string | null
          probability: number | null
          responsible_user_id: string | null
          sdr_user_id: string | null
          second_seat_name: string | null
          source: string | null
          source_contract_id: string | null
          stage_changed_at: string | null
          stage_id: string | null
          status: string
          tags: Json | null
          title: string
          updated_at: string
          value: number | null
          won_at: string | null
        }
        Insert: {
          account_id: string
          client_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string | null
          entry_value?: number | null
          expected_close_date?: string | null
          has_second_seat?: boolean
          id?: string
          lead_id?: string | null
          loss_notes?: string | null
          loss_reason_id?: string | null
          loss_sub_reason_id?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          notes?: string | null
          pipeline_id?: string | null
          probability?: number | null
          responsible_user_id?: string | null
          sdr_user_id?: string | null
          second_seat_name?: string | null
          source?: string | null
          source_contract_id?: string | null
          stage_changed_at?: string | null
          stage_id?: string | null
          status?: string
          tags?: Json | null
          title: string
          updated_at?: string
          value?: number | null
          won_at?: string | null
        }
        Update: {
          account_id?: string
          client_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string | null
          entry_value?: number | null
          expected_close_date?: string | null
          has_second_seat?: boolean
          id?: string
          lead_id?: string | null
          loss_notes?: string | null
          loss_reason_id?: string | null
          loss_sub_reason_id?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          notes?: string | null
          pipeline_id?: string | null
          probability?: number | null
          responsible_user_id?: string | null
          sdr_user_id?: string | null
          second_seat_name?: string | null
          source?: string | null
          source_contract_id?: string | null
          stage_changed_at?: string | null
          stage_id?: string | null
          status?: string
          tags?: Json | null
          title?: string
          updated_at?: string
          value?: number | null
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_loss_reason_id_fkey"
            columns: ["loss_reason_id"]
            isOneToOne: false
            referencedRelation: "deal_loss_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_loss_sub_reason_id_fkey"
            columns: ["loss_sub_reason_id"]
            isOneToOne: false
            referencedRelation: "deal_loss_sub_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_sdr_user_id_fkey"
            columns: ["sdr_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_source_contract_id_fkey"
            columns: ["source_contract_id"]
            isOneToOne: false
            referencedRelation: "client_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "deal_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_contracts: {
        Row: {
          account_id: string
          client_address: string | null
          client_cpf_cnpj: string | null
          client_email: string | null
          client_id: string | null
          client_marital_status: string | null
          client_name: string
          client_nationality: string | null
          client_representative: string | null
          client_representative_cpf: string | null
          company_address: string | null
          company_bank_info: Json | null
          company_cnpj: string | null
          company_email: string | null
          company_name: string | null
          company_representative: string | null
          company_representative_cpf: string | null
          contract_duration_months: number | null
          contract_number: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          deliverables: Json | null
          down_payment_date: string | null
          down_payment_percentage: number | null
          down_payment_value: number | null
          due_day: number | null
          extra_hour_rate: number | null
          first_due_date: string | null
          has_renewal: boolean | null
          id: string
          include_witnesses: boolean | null
          installment_value: number | null
          installments: number | null
          jurisdiction: string | null
          late_fee_percentage: number | null
          late_interest_percentage: number | null
          monthly_hours: number | null
          object_description: string | null
          payment_method: string | null
          placeholder_values: Json | null
          product_id: string | null
          rescission_penalty_percentage: number | null
          service_mode: string | null
          share_token: string
          signed_at: string | null
          signed_pdf_path: string | null
          status: string
          template_html: string | null
          template_id: string | null
          template_variables: Json | null
          total_value: number | null
          updated_at: string
          zapsign_document_token: string | null
        }
        Insert: {
          account_id: string
          client_address?: string | null
          client_cpf_cnpj?: string | null
          client_email?: string | null
          client_id?: string | null
          client_marital_status?: string | null
          client_name: string
          client_nationality?: string | null
          client_representative?: string | null
          client_representative_cpf?: string | null
          company_address?: string | null
          company_bank_info?: Json | null
          company_cnpj?: string | null
          company_email?: string | null
          company_name?: string | null
          company_representative?: string | null
          company_representative_cpf?: string | null
          contract_duration_months?: number | null
          contract_number?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          deliverables?: Json | null
          down_payment_date?: string | null
          down_payment_percentage?: number | null
          down_payment_value?: number | null
          due_day?: number | null
          extra_hour_rate?: number | null
          first_due_date?: string | null
          has_renewal?: boolean | null
          id?: string
          include_witnesses?: boolean | null
          installment_value?: number | null
          installments?: number | null
          jurisdiction?: string | null
          late_fee_percentage?: number | null
          late_interest_percentage?: number | null
          monthly_hours?: number | null
          object_description?: string | null
          payment_method?: string | null
          placeholder_values?: Json | null
          product_id?: string | null
          rescission_penalty_percentage?: number | null
          service_mode?: string | null
          share_token?: string
          signed_at?: string | null
          signed_pdf_path?: string | null
          status?: string
          template_html?: string | null
          template_id?: string | null
          template_variables?: Json | null
          total_value?: number | null
          updated_at?: string
          zapsign_document_token?: string | null
        }
        Update: {
          account_id?: string
          client_address?: string | null
          client_cpf_cnpj?: string | null
          client_email?: string | null
          client_id?: string | null
          client_marital_status?: string | null
          client_name?: string
          client_nationality?: string | null
          client_representative?: string | null
          client_representative_cpf?: string | null
          company_address?: string | null
          company_bank_info?: Json | null
          company_cnpj?: string | null
          company_email?: string | null
          company_name?: string | null
          company_representative?: string | null
          company_representative_cpf?: string | null
          contract_duration_months?: number | null
          contract_number?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          deliverables?: Json | null
          down_payment_date?: string | null
          down_payment_percentage?: number | null
          down_payment_value?: number | null
          due_day?: number | null
          extra_hour_rate?: number | null
          first_due_date?: string | null
          has_renewal?: boolean | null
          id?: string
          include_witnesses?: boolean | null
          installment_value?: number | null
          installments?: number | null
          jurisdiction?: string | null
          late_fee_percentage?: number | null
          late_interest_percentage?: number | null
          monthly_hours?: number | null
          object_description?: string | null
          payment_method?: string | null
          placeholder_values?: Json | null
          product_id?: string | null
          rescission_penalty_percentage?: number | null
          service_mode?: string | null
          share_token?: string
          signed_at?: string | null
          signed_pdf_path?: string | null
          status?: string
          template_html?: string | null
          template_id?: string | null
          template_variables?: Json | null
          total_value?: number | null
          updated_at?: string
          zapsign_document_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "digital_contracts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "digital_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_contracts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_contracts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          account_id: string
          created_at: string | null
          error: string | null
          html_content: string
          id: string
          lead_id: string | null
          meeting_url: string | null
          recipient_email: string
          recipient_name: string | null
          send_at: string
          sent_at: string | null
          status: string
          subject: string
          task_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          error?: string | null
          html_content: string
          id?: string
          lead_id?: string | null
          meeting_url?: string | null
          recipient_email: string
          recipient_name?: string | null
          send_at: string
          sent_at?: string | null
          status?: string
          subject: string
          task_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          error?: string | null
          html_content?: string
          id?: string
          lead_id?: string | null
          meeting_url?: string | null
          recipient_email?: string
          recipient_name?: string | null
          send_at?: string
          sent_at?: string | null
          status?: string
          subject?: string
          task_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "internal_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      event_checklist: {
        Row: {
          account_id: string
          assigned_to: string | null
          category: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          display_order: number | null
          due_date: string | null
          event_id: string
          id: string
          priority: string | null
          status: Database["public"]["Enums"]["event_checklist_status"]
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          assigned_to?: string | null
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          due_date?: string | null
          event_id: string
          id?: string
          priority?: string | null
          status?: Database["public"]["Enums"]["event_checklist_status"]
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          assigned_to?: string | null
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          due_date?: string | null
          event_id?: string
          id?: string
          priority?: string | null
          status?: Database["public"]["Enums"]["event_checklist_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_checklist_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checklist_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checklist_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checklist_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checklist_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_checkin_view"
            referencedColumns: ["id"]
          },
        ]
      }
      event_costs: {
        Row: {
          account_id: string
          actual_value: number | null
          category: Database["public"]["Enums"]["event_cost_category"]
          created_at: string
          description: string
          due_date: string | null
          estimated_value: number
          event_id: string
          id: string
          invoice_number: string | null
          notes: string | null
          paid_at: string | null
          receipt_url: string | null
          status: Database["public"]["Enums"]["event_cost_status"]
          supplier: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          actual_value?: number | null
          category?: Database["public"]["Enums"]["event_cost_category"]
          created_at?: string
          description: string
          due_date?: string | null
          estimated_value?: number
          event_id: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          paid_at?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["event_cost_status"]
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          actual_value?: number | null
          category?: Database["public"]["Enums"]["event_cost_category"]
          created_at?: string
          description?: string
          due_date?: string | null
          estimated_value?: number
          event_id?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          paid_at?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["event_cost_status"]
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_costs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_costs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_costs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_checkin_view"
            referencedColumns: ["id"]
          },
        ]
      }
      event_feedback: {
        Row: {
          account_id: string
          additional_comments: string | null
          client_id: string | null
          content_rating: number | null
          created_at: string
          event_id: string
          highlights: string | null
          id: string
          improvements: string | null
          nps_score: number | null
          organization_rating: number | null
          overall_rating: number | null
          participant_id: string | null
          submitted_at: string
          venue_rating: number | null
          would_recommend: boolean | null
        }
        Insert: {
          account_id: string
          additional_comments?: string | null
          client_id?: string | null
          content_rating?: number | null
          created_at?: string
          event_id: string
          highlights?: string | null
          id?: string
          improvements?: string | null
          nps_score?: number | null
          organization_rating?: number | null
          overall_rating?: number | null
          participant_id?: string | null
          submitted_at?: string
          venue_rating?: number | null
          would_recommend?: boolean | null
        }
        Update: {
          account_id?: string
          additional_comments?: string | null
          client_id?: string | null
          content_rating?: number | null
          created_at?: string
          event_id?: string
          highlights?: string | null
          id?: string
          improvements?: string | null
          nps_score?: number | null
          organization_rating?: number | null
          overall_rating?: number | null
          participant_id?: string | null
          submitted_at?: string
          venue_rating?: number | null
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "event_feedback_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_feedback_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "event_feedback_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_feedback_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_feedback_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_checkin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_feedback_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "event_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_feedback_questions: {
        Row: {
          account_id: string
          created_at: string
          display_order: number
          event_id: string
          id: string
          is_active: boolean
          is_required: boolean
          question_text: string
          question_type: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          display_order?: number
          event_id: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          question_text: string
          question_type?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          display_order?: number
          event_id?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          question_text?: string
          question_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_feedback_questions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_feedback_questions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_feedback_questions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_checkin_view"
            referencedColumns: ["id"]
          },
        ]
      }
      event_feedback_responses: {
        Row: {
          account_id: string
          created_at: string
          event_id: string
          feedback_id: string
          id: string
          question_id: string
          question_text: string
          response_boolean: boolean | null
          response_number: number | null
          response_value: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          event_id: string
          feedback_id: string
          id?: string
          question_id: string
          question_text: string
          response_boolean?: boolean | null
          response_number?: number | null
          response_value?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          event_id?: string
          feedback_id?: string
          id?: string
          question_id?: string
          question_text?: string
          response_boolean?: boolean | null
          response_number?: number | null
          response_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_feedback_responses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_feedback_responses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_feedback_responses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_checkin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_feedback_responses_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "event_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      event_gifts: {
        Row: {
          account_id: string
          created_at: string
          description: string | null
          event_id: string
          id: string
          image_url: string | null
          name: string
          notes: string | null
          quantity: number
          quantity_distributed: number
          status: Database["public"]["Enums"]["event_gift_status"]
          supplier: string | null
          total_cost: number | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          image_url?: string | null
          name: string
          notes?: string | null
          quantity?: number
          quantity_distributed?: number
          status?: Database["public"]["Enums"]["event_gift_status"]
          supplier?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          image_url?: string | null
          name?: string
          notes?: string | null
          quantity?: number
          quantity_distributed?: number
          status?: Database["public"]["Enums"]["event_gift_status"]
          supplier?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_gifts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_gifts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_gifts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_checkin_view"
            referencedColumns: ["id"]
          },
        ]
      }
      event_media: {
        Row: {
          account_id: string
          caption: string | null
          created_at: string
          display_order: number | null
          event_id: string
          file_name: string | null
          file_size: number | null
          file_url: string
          id: string
          is_cover: boolean
          media_type: Database["public"]["Enums"]["event_media_type"]
          thumbnail_url: string | null
          uploaded_by: string | null
        }
        Insert: {
          account_id: string
          caption?: string | null
          created_at?: string
          display_order?: number | null
          event_id: string
          file_name?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          is_cover?: boolean
          media_type?: Database["public"]["Enums"]["event_media_type"]
          thumbnail_url?: string | null
          uploaded_by?: string | null
        }
        Update: {
          account_id?: string
          caption?: string | null
          created_at?: string
          display_order?: number | null
          event_id?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          is_cover?: boolean
          media_type?: Database["public"]["Enums"]["event_media_type"]
          thumbnail_url?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_media_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_media_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_media_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_checkin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_notes: {
        Row: {
          account_id: string
          content: string
          created_at: string
          event_id: string
          id: string
          is_pinned: boolean | null
          note_type: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          content: string
          created_at?: string
          event_id: string
          id?: string
          is_pinned?: boolean | null
          note_type?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          content?: string
          created_at?: string
          event_id?: string
          id?: string
          is_pinned?: boolean | null
          note_type?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_notes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_notes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_notes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_checkin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participants: {
        Row: {
          account_id: string
          client_id: string | null
          created_at: string
          custom_data: Json | null
          event_id: string
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          guest_rg: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          notes: string | null
          rsvp_responded_at: string | null
          rsvp_status: Database["public"]["Enums"]["event_rsvp_status"]
          rsvp_token: string | null
          updated_at: string
          waitlist_position: number | null
        }
        Insert: {
          account_id: string
          client_id?: string | null
          created_at?: string
          custom_data?: Json | null
          event_id: string
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          guest_rg?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          notes?: string | null
          rsvp_responded_at?: string | null
          rsvp_status?: Database["public"]["Enums"]["event_rsvp_status"]
          rsvp_token?: string | null
          updated_at?: string
          waitlist_position?: number | null
        }
        Update: {
          account_id?: string
          client_id?: string | null
          created_at?: string
          custom_data?: Json | null
          event_id?: string
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          guest_rg?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          notes?: string | null
          rsvp_responded_at?: string | null
          rsvp_status?: Database["public"]["Enums"]["event_rsvp_status"]
          rsvp_token?: string | null
          updated_at?: string
          waitlist_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "event_participants_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_checkin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_products: {
        Row: {
          account_id: string
          created_at: string
          event_id: string
          id: string
          product_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          event_id: string
          id?: string
          product_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          event_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_products_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_products_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_products_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_checkin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      event_schedule: {
        Row: {
          account_id: string
          created_at: string
          description: string | null
          display_order: number | null
          end_time: string | null
          event_id: string
          id: string
          location: string | null
          notes: string | null
          speaker: string | null
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          end_time?: string | null
          event_id: string
          id?: string
          location?: string | null
          notes?: string | null
          speaker?: string | null
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          end_time?: string | null
          event_id?: string
          id?: string
          location?: string | null
          notes?: string | null
          speaker?: string | null
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_schedule_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_schedule_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_schedule_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_checkin_view"
            referencedColumns: ["id"]
          },
        ]
      }
      event_team: {
        Row: {
          account_id: string
          created_at: string
          event_id: string
          id: string
          is_external: boolean
          is_primary: boolean
          responsibilities: string | null
          role: Database["public"]["Enums"]["event_team_role"]
          role_description: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          event_id: string
          id?: string
          is_external?: boolean
          is_primary?: boolean
          responsibilities?: string | null
          role?: Database["public"]["Enums"]["event_team_role"]
          role_description?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          event_id?: string
          id?: string
          is_external?: boolean
          is_primary?: boolean
          responsibilities?: string | null
          role?: Database["public"]["Enums"]["event_team_role"]
          role_description?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_team_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_team_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_team_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_checkin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_team_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          account_id: string
          address: string | null
          allow_external_guests: boolean
          budget: number | null
          category: Database["public"]["Enums"]["event_category"]
          checkin_code: string | null
          client_id: string | null
          color: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          end_time: string | null
          ends_at: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          expected_attendees: number | null
          goal_confirmed: number | null
          goal_invited: number | null
          goal_present: number | null
          goals: string | null
          id: string
          invitation_file_url: string | null
          is_recurring: boolean
          material_url: string | null
          max_capacity: number | null
          meeting_url: string | null
          mentor_user_id: string | null
          modality: Database["public"]["Enums"]["event_modality"]
          notes: string | null
          public_registration_code: string | null
          public_registration_enabled: boolean | null
          rsvp_closed: boolean
          rsvp_closure_message: string | null
          rsvp_deadline: string | null
          rsvp_form_fields: Json | null
          scheduled_at: string | null
          start_time: string | null
          status: string | null
          target_deal_stages: Json | null
          title: string
          updated_at: string
          visible_sectors: Json | null
        }
        Insert: {
          account_id: string
          address?: string | null
          allow_external_guests?: boolean
          budget?: number | null
          category?: Database["public"]["Enums"]["event_category"]
          checkin_code?: string | null
          client_id?: string | null
          color?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          ends_at?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          expected_attendees?: number | null
          goal_confirmed?: number | null
          goal_invited?: number | null
          goal_present?: number | null
          goals?: string | null
          id?: string
          invitation_file_url?: string | null
          is_recurring?: boolean
          material_url?: string | null
          max_capacity?: number | null
          meeting_url?: string | null
          mentor_user_id?: string | null
          modality?: Database["public"]["Enums"]["event_modality"]
          notes?: string | null
          public_registration_code?: string | null
          public_registration_enabled?: boolean | null
          rsvp_closed?: boolean
          rsvp_closure_message?: string | null
          rsvp_deadline?: string | null
          rsvp_form_fields?: Json | null
          scheduled_at?: string | null
          start_time?: string | null
          status?: string | null
          target_deal_stages?: Json | null
          title: string
          updated_at?: string
          visible_sectors?: Json | null
        }
        Update: {
          account_id?: string
          address?: string | null
          allow_external_guests?: boolean
          budget?: number | null
          category?: Database["public"]["Enums"]["event_category"]
          checkin_code?: string | null
          client_id?: string | null
          color?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          ends_at?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          expected_attendees?: number | null
          goal_confirmed?: number | null
          goal_invited?: number | null
          goal_present?: number | null
          goals?: string | null
          id?: string
          invitation_file_url?: string | null
          is_recurring?: boolean
          material_url?: string | null
          max_capacity?: number | null
          meeting_url?: string | null
          mentor_user_id?: string | null
          modality?: Database["public"]["Enums"]["event_modality"]
          notes?: string | null
          public_registration_code?: string | null
          public_registration_enabled?: boolean | null
          rsvp_closed?: boolean
          rsvp_closure_message?: string | null
          rsvp_deadline?: string | null
          rsvp_form_fields?: Json | null
          scheduled_at?: string | null
          start_time?: string | null
          status?: string | null
          target_deal_stages?: Json | null
          title?: string
          updated_at?: string
          visible_sectors?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_mentor_user_id_fkey"
            columns: ["mentor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      external_dashboard_access: {
        Row: {
          account_id: string
          created_at: string
          dashboard_id: string
          granted_by: string
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          dashboard_id: string
          granted_by: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          dashboard_id?: string
          granted_by?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_dashboard_access_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_dashboard_access_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "insights_dashboards"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_questions: {
        Row: {
          account_id: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          is_default: boolean
          is_required: boolean
          question_text: string
          question_type: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_required?: boolean
          question_text: string
          question_type?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_required?: boolean
          question_text?: string
          question_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_questions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_budgets: {
        Row: {
          account_id: string
          budget_type: string
          category_id: string | null
          cost_center_id: string | null
          created_at: string
          id: string
          month: number | null
          name: string
          notes: string | null
          planned_amount: number
          updated_at: string
          year: number
        }
        Insert: {
          account_id: string
          budget_type?: string
          category_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          id?: string
          month?: number | null
          name: string
          notes?: string | null
          planned_amount?: number
          updated_at?: string
          year: number
        }
        Update: {
          account_id?: string
          budget_type?: string
          category_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          id?: string
          month?: number | null
          name?: string
          notes?: string | null
          planned_amount?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_budgets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_budgets_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          account_id: string
          color: string
          created_at: string
          display_order: number
          dre_group: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          account_id: string
          color?: string
          created_at?: string
          display_order?: number
          dre_group?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          color?: string
          created_at?: string
          display_order?: number
          dre_group?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_classification_rules: {
        Row: {
          account_id: string
          category_id: string | null
          confidence: number | null
          created_at: string
          id: string
          is_active: boolean | null
          pattern: string
          pattern_type: string
          suggested_description: string | null
          times_confirmed: number | null
          times_rejected: number | null
          times_used: number | null
          updated_at: string
        }
        Insert: {
          account_id: string
          category_id?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          pattern: string
          pattern_type?: string
          suggested_description?: string | null
          times_confirmed?: number | null
          times_rejected?: number | null
          times_used?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          category_id?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          pattern?: string
          pattern_type?: string
          suggested_description?: string | null
          times_confirmed?: number | null
          times_rejected?: number | null
          times_used?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_classification_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_classification_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entries: {
        Row: {
          account_id: string
          amount: number
          attachment_name: string | null
          attachment_url: string | null
          bank_account_id: string | null
          category_id: string | null
          client_id: string | null
          conciliated_at: string | null
          conciliated_by: string | null
          contract_id: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string
          document_number: string | null
          due_date: string
          entry_type: string
          expected_date: string | null
          id: string
          installment_group_id: string | null
          installment_number: number | null
          is_conciliated: boolean
          is_recurring: boolean
          issue_date: string | null
          notes: string | null
          omie_id: string | null
          omie_sync_at: string | null
          parent_entry_id: string | null
          payment_date: string | null
          payment_forecast_date: string | null
          project_id: string | null
          recurrence_end_date: string | null
          recurrence_type: string | null
          registration_date: string | null
          seller_id: string | null
          status: string
          supplier_id: string | null
          total_installments: number | null
          updated_at: string
        }
        Insert: {
          account_id: string
          amount?: number
          attachment_name?: string | null
          attachment_url?: string | null
          bank_account_id?: string | null
          category_id?: string | null
          client_id?: string | null
          conciliated_at?: string | null
          conciliated_by?: string | null
          contract_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description: string
          document_number?: string | null
          due_date: string
          entry_type?: string
          expected_date?: string | null
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          is_conciliated?: boolean
          is_recurring?: boolean
          issue_date?: string | null
          notes?: string | null
          omie_id?: string | null
          omie_sync_at?: string | null
          parent_entry_id?: string | null
          payment_date?: string | null
          payment_forecast_date?: string | null
          project_id?: string | null
          recurrence_end_date?: string | null
          recurrence_type?: string | null
          registration_date?: string | null
          seller_id?: string | null
          status?: string
          supplier_id?: string | null
          total_installments?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          attachment_name?: string | null
          attachment_url?: string | null
          bank_account_id?: string | null
          category_id?: string | null
          client_id?: string | null
          conciliated_at?: string | null
          conciliated_by?: string | null
          contract_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          document_number?: string | null
          due_date?: string
          entry_type?: string
          expected_date?: string | null
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          is_conciliated?: boolean
          is_recurring?: boolean
          issue_date?: string | null
          notes?: string | null
          omie_id?: string | null
          omie_sync_at?: string | null
          parent_entry_id?: string | null
          payment_date?: string | null
          payment_forecast_date?: string | null
          project_id?: string | null
          recurrence_end_date?: string | null
          recurrence_type?: string | null
          registration_date?: string | null
          seller_id?: string | null
          status?: string
          supplier_id?: string | null
          total_installments?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "financial_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_conciliated_by_fkey"
            columns: ["conciliated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "client_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_parent_entry_id_fkey"
            columns: ["parent_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entry_templates: {
        Row: {
          account_id: string
          category_id: string | null
          client_id: string | null
          cost_center_id: string | null
          created_at: string
          default_amount: number | null
          description: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          notes: string | null
          supplier_id: string | null
          type: string
          updated_at: string
          use_count: number
        }
        Insert: {
          account_id: string
          category_id?: string | null
          client_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          default_amount?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          notes?: string | null
          supplier_id?: string | null
          type: string
          updated_at?: string
          use_count?: number
        }
        Update: {
          account_id?: string
          category_id?: string | null
          client_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          default_amount?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          notes?: string | null
          supplier_id?: string | null
          type?: string
          updated_at?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_entry_templates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entry_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entry_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "financial_entry_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entry_templates_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entry_templates_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_pending_classifications: {
        Row: {
          account_id: string
          ai_confidence: number | null
          ai_reasoning: string | null
          amount: number
          bank_account_id: string | null
          created_at: string
          external_id: string | null
          id: string
          matched_rule_id: string | null
          original_description: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggested_category_id: string | null
          suggested_client_id: string | null
          suggested_description: string | null
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          account_id: string
          ai_confidence?: number | null
          ai_reasoning?: string | null
          amount: number
          bank_account_id?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          matched_rule_id?: string | null
          original_description: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_category_id?: string | null
          suggested_client_id?: string | null
          suggested_description?: string | null
          transaction_date: string
          transaction_type: string
        }
        Update: {
          account_id?: string
          ai_confidence?: number | null
          ai_reasoning?: string | null
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          matched_rule_id?: string | null
          original_description?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_category_id?: string | null
          suggested_client_id?: string | null
          suggested_description?: string | null
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_pending_classifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_pending_classifications_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_pending_classifications_matched_rule_id_fkey"
            columns: ["matched_rule_id"]
            isOneToOne: false
            referencedRelation: "financial_classification_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_pending_classifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_pending_classifications_suggested_category_id_fkey"
            columns: ["suggested_category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_pending_classifications_suggested_client_id_fkey"
            columns: ["suggested_client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "financial_pending_classifications_suggested_client_id_fkey"
            columns: ["suggested_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_reactions: {
        Row: {
          account_id: string
          created_at: string
          emoji: string
          followup_id: string
          id: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          emoji: string
          followup_id: string
          id?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          emoji?: string
          followup_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_reactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_reactions_followup_id_fkey"
            columns: ["followup_id"]
            isOneToOne: false
            referencedRelation: "client_followups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          created_at: string | null
          display_order: number
          field_id: string
          form_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          field_id: string
          form_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          display_order?: number
          field_id?: string
          form_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_responses: {
        Row: {
          account_id: string
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          form_id: string
          id: string
          last_edited_at: string | null
          last_edited_by: string | null
          responses: Json
          submitted_at: string
        }
        Insert: {
          account_id: string
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          form_id: string
          id?: string
          last_edited_at?: string | null
          last_edited_by?: string | null
          responses?: Json
          submitted_at?: string
        }
        Update: {
          account_id?: string
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          form_id?: string
          id?: string
          last_edited_at?: string | null
          last_edited_by?: string | null
          responses?: Json
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_responses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "form_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_responses_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          account_id: string
          appearance: Json | null
          created_at: string
          description: string | null
          fields: Json
          id: string
          is_active: boolean
          require_client_info: boolean
          sector_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          appearance?: Json | null
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          require_client_info?: boolean
          sector_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          appearance?: Json | null
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          require_client_info?: boolean
          sector_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_config_alerts: {
        Row: {
          account_id: string
          alert_type: string
          created_at: string
          details: Json | null
          duplicate_stage_ids: string[] | null
          id: string
          pipeline_id: string | null
          resolved: boolean
          resolved_at: string | null
          stage_name: string | null
          visual_id: string | null
        }
        Insert: {
          account_id: string
          alert_type: string
          created_at?: string
          details?: Json | null
          duplicate_stage_ids?: string[] | null
          id?: string
          pipeline_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          stage_name?: string | null
          visual_id?: string | null
        }
        Update: {
          account_id?: string
          alert_type?: string
          created_at?: string
          details?: Json | null
          duplicate_stage_ids?: string[] | null
          id?: string
          pipeline_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          stage_name?: string | null
          visual_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_config_alerts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      google_drive_connections: {
        Row: {
          access_token: string | null
          account_id: string
          connected_at: string
          connected_by: string | null
          created_at: string
          google_email: string
          google_user_id: string | null
          id: string
          is_active: boolean
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          refresh_token: string
          scope: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          account_id: string
          connected_at?: string
          connected_by?: string | null
          created_at?: string
          google_email: string
          google_user_id?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          refresh_token: string
          scope?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          account_id?: string
          connected_at?: string
          connected_by?: string | null
          created_at?: string
          google_email?: string
          google_user_id?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          refresh_token?: string
          scope?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_drive_connections_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      google_drive_folders: {
        Row: {
          account_id: string
          connection_id: string
          created_at: string
          created_by: string | null
          drive_folder_id: string
          files_synced_count: number
          folder_name: string
          id: string
          is_active: boolean
          is_shared_drive: boolean
          last_page_token: string | null
          last_synced_at: string | null
          seller_name: string | null
          shared_drive_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          connection_id: string
          created_at?: string
          created_by?: string | null
          drive_folder_id: string
          files_synced_count?: number
          folder_name: string
          id?: string
          is_active?: boolean
          is_shared_drive?: boolean
          last_page_token?: string | null
          last_synced_at?: string | null
          seller_name?: string | null
          shared_drive_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          connection_id?: string
          created_at?: string
          created_by?: string | null
          drive_folder_id?: string
          files_synced_count?: number
          folder_name?: string
          id?: string
          is_active?: boolean
          is_shared_drive?: boolean
          last_page_token?: string | null
          last_synced_at?: string | null
          seller_name?: string | null
          shared_drive_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_drive_folders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_drive_folders_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "google_drive_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_benefits: {
        Row: {
          account_id: string
          benefit_type: string
          card_number: string | null
          collaborator_id: string
          created_at: string
          employee_contribution: number | null
          end_date: string | null
          id: string
          notes: string | null
          plan_name: string | null
          provider: string | null
          start_date: string | null
          status: string
          updated_at: string
          value: number | null
        }
        Insert: {
          account_id: string
          benefit_type: string
          card_number?: string | null
          collaborator_id: string
          created_at?: string
          employee_contribution?: number | null
          end_date?: string | null
          id?: string
          notes?: string | null
          plan_name?: string | null
          provider?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          account_id?: string
          benefit_type?: string
          card_number?: string | null
          collaborator_id?: string
          created_at?: string
          employee_contribution?: number | null
          end_date?: string | null
          id?: string
          notes?: string | null
          plan_name?: string | null
          provider?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_benefits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_benefits_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "hr_collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_collaborator_audit_log: {
        Row: {
          account_id: string
          action: string
          changed_fields: Json | null
          collaborator_id: string
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          account_id: string
          action: string
          changed_fields?: Json | null
          collaborator_id: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          account_id?: string
          action?: string
          changed_fields?: Json | null
          collaborator_id?: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_collaborator_audit_log_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "hr_collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_collaborators: {
        Row: {
          account_id: string
          address: string | null
          address_complement: string | null
          annual_total_cost: number | null
          avatar_url: string | null
          base_salary: number | null
          birth_date: string | null
          cbo: string | null
          city: string | null
          commissions: number | null
          cost_pct: number | null
          cpf: string | null
          created_at: string
          department: string | null
          dsr_commissions: number | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employment_type: string | null
          fgts: number | null
          full_name: string
          gender: string | null
          health_plan: number | null
          hire_date: string | null
          home_office_allowance: number | null
          hr_department_id: string | null
          id: string
          inss_employer: number | null
          inss_gilrat: number | null
          inss_third_parties: number | null
          life_insurance: number | null
          marital_status: string | null
          meal_voucher: number | null
          monthly_total_cost: number | null
          neighborhood: string | null
          net_salary: number | null
          notes: string | null
          other_costs: number | null
          payroll_company: string | null
          phone: string | null
          position: string | null
          registration_company: string | null
          rg: string | null
          salary: number | null
          source_note: string | null
          state: string | null
          status: string | null
          termination_date: string | null
          thirteenth_provision: number | null
          total_benefits: number | null
          total_charges: number | null
          total_cost: number | null
          total_salary: number | null
          transport_voucher: number | null
          unit: string | null
          updated_at: string
          user_id: string | null
          vacation_provision: number | null
          vacation_third: number | null
          work_model: string | null
          zip_code: string | null
        }
        Insert: {
          account_id: string
          address?: string | null
          address_complement?: string | null
          annual_total_cost?: number | null
          avatar_url?: string | null
          base_salary?: number | null
          birth_date?: string | null
          cbo?: string | null
          city?: string | null
          commissions?: number | null
          cost_pct?: number | null
          cpf?: string | null
          created_at?: string
          department?: string | null
          dsr_commissions?: number | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employment_type?: string | null
          fgts?: number | null
          full_name: string
          gender?: string | null
          health_plan?: number | null
          hire_date?: string | null
          home_office_allowance?: number | null
          hr_department_id?: string | null
          id?: string
          inss_employer?: number | null
          inss_gilrat?: number | null
          inss_third_parties?: number | null
          life_insurance?: number | null
          marital_status?: string | null
          meal_voucher?: number | null
          monthly_total_cost?: number | null
          neighborhood?: string | null
          net_salary?: number | null
          notes?: string | null
          other_costs?: number | null
          payroll_company?: string | null
          phone?: string | null
          position?: string | null
          registration_company?: string | null
          rg?: string | null
          salary?: number | null
          source_note?: string | null
          state?: string | null
          status?: string | null
          termination_date?: string | null
          thirteenth_provision?: number | null
          total_benefits?: number | null
          total_charges?: number | null
          total_cost?: number | null
          total_salary?: number | null
          transport_voucher?: number | null
          unit?: string | null
          updated_at?: string
          user_id?: string | null
          vacation_provision?: number | null
          vacation_third?: number | null
          work_model?: string | null
          zip_code?: string | null
        }
        Update: {
          account_id?: string
          address?: string | null
          address_complement?: string | null
          annual_total_cost?: number | null
          avatar_url?: string | null
          base_salary?: number | null
          birth_date?: string | null
          cbo?: string | null
          city?: string | null
          commissions?: number | null
          cost_pct?: number | null
          cpf?: string | null
          created_at?: string
          department?: string | null
          dsr_commissions?: number | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employment_type?: string | null
          fgts?: number | null
          full_name?: string
          gender?: string | null
          health_plan?: number | null
          hire_date?: string | null
          home_office_allowance?: number | null
          hr_department_id?: string | null
          id?: string
          inss_employer?: number | null
          inss_gilrat?: number | null
          inss_third_parties?: number | null
          life_insurance?: number | null
          marital_status?: string | null
          meal_voucher?: number | null
          monthly_total_cost?: number | null
          neighborhood?: string | null
          net_salary?: number | null
          notes?: string | null
          other_costs?: number | null
          payroll_company?: string | null
          phone?: string | null
          position?: string | null
          registration_company?: string | null
          rg?: string | null
          salary?: number | null
          source_note?: string | null
          state?: string | null
          status?: string | null
          termination_date?: string | null
          thirteenth_provision?: number | null
          total_benefits?: number | null
          total_charges?: number | null
          total_cost?: number | null
          total_salary?: number | null
          transport_voucher?: number | null
          unit?: string | null
          updated_at?: string
          user_id?: string | null
          vacation_provision?: number | null
          vacation_third?: number | null
          work_model?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_collaborators_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_collaborators_hr_department_id_fkey"
            columns: ["hr_department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_collaborators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_departments: {
        Row: {
          account_id: string
          color: string
          created_at: string
          description: string | null
          head_collaborator_id: string | null
          id: string
          is_active: boolean
          name: string
          parent_department_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          color?: string
          created_at?: string
          description?: string | null
          head_collaborator_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_department_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          color?: string
          created_at?: string
          description?: string | null
          head_collaborator_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_department_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_departments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_departments_head_collaborator_id_fkey"
            columns: ["head_collaborator_id"]
            isOneToOne: false
            referencedRelation: "hr_collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_departments_parent_department_id_fkey"
            columns: ["parent_department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_documents: {
        Row: {
          account_id: string
          collaborator_id: string
          created_at: string
          description: string | null
          document_type: string
          expiry_date: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          issue_date: string | null
          status: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          account_id: string
          collaborator_id: string
          created_at?: string
          description?: string | null
          document_type?: string
          expiry_date?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          status?: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          account_id?: string
          collaborator_id?: string
          created_at?: string
          description?: string | null
          document_type?: string
          expiry_date?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_documents_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_documents_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "hr_collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_job_applications: {
        Row: {
          account_id: string
          ai_analysis_status:
            | Database["public"]["Enums"]["hr_ai_analysis_status"]
            | null
          ai_report: string | null
          ai_score: number | null
          applied_at: string
          candidate_birth_date: string | null
          candidate_city: string | null
          candidate_email: string
          candidate_gender: string | null
          candidate_name: string
          candidate_pcd: boolean | null
          candidate_pcd_type: string | null
          candidate_phone: string | null
          candidate_race: string | null
          candidate_sexual_orientation: string | null
          candidate_state: string | null
          cover_letter: string | null
          desired_position: string | null
          desired_seniority: string | null
          id: string
          job_id: string
          notes: string | null
          profiler_completed_at: string | null
          profiler_result_code: string | null
          profiler_result_detail: Json | null
          resume_url: string | null
          stage: Database["public"]["Enums"]["hr_candidate_stage"]
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          ai_analysis_status?:
            | Database["public"]["Enums"]["hr_ai_analysis_status"]
            | null
          ai_report?: string | null
          ai_score?: number | null
          applied_at?: string
          candidate_birth_date?: string | null
          candidate_city?: string | null
          candidate_email: string
          candidate_gender?: string | null
          candidate_name: string
          candidate_pcd?: boolean | null
          candidate_pcd_type?: string | null
          candidate_phone?: string | null
          candidate_race?: string | null
          candidate_sexual_orientation?: string | null
          candidate_state?: string | null
          cover_letter?: string | null
          desired_position?: string | null
          desired_seniority?: string | null
          id?: string
          job_id: string
          notes?: string | null
          profiler_completed_at?: string | null
          profiler_result_code?: string | null
          profiler_result_detail?: Json | null
          resume_url?: string | null
          stage?: Database["public"]["Enums"]["hr_candidate_stage"]
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          ai_analysis_status?:
            | Database["public"]["Enums"]["hr_ai_analysis_status"]
            | null
          ai_report?: string | null
          ai_score?: number | null
          applied_at?: string
          candidate_birth_date?: string | null
          candidate_city?: string | null
          candidate_email?: string
          candidate_gender?: string | null
          candidate_name?: string
          candidate_pcd?: boolean | null
          candidate_pcd_type?: string | null
          candidate_phone?: string | null
          candidate_race?: string | null
          candidate_sexual_orientation?: string | null
          candidate_state?: string | null
          cover_letter?: string | null
          desired_position?: string | null
          desired_seniority?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          profiler_completed_at?: string | null
          profiler_result_code?: string | null
          profiler_result_detail?: Json | null
          resume_url?: string | null
          stage?: Database["public"]["Enums"]["hr_candidate_stage"]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_job_applications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "hr_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_jobs: {
        Row: {
          account_id: string
          application_deadline: string | null
          benefits: string[] | null
          closed_at: string | null
          contract_type: string | null
          created_at: string
          created_by: string | null
          department: string | null
          description: string | null
          description_context: string | null
          description_tone: string | null
          desired_skills: string[] | null
          education_level: string | null
          expected_start_date: string | null
          experience_years: number | null
          id: string
          languages: Json | null
          openings_count: number | null
          position: string | null
          require_cover_letter: boolean | null
          required_skills: string[] | null
          requirements: string | null
          salary_max: number | null
          salary_min: number | null
          salary_type: string | null
          seniority: string | null
          status: Database["public"]["Enums"]["hr_job_status"]
          tags: string[] | null
          title: string
          unit: string | null
          updated_at: string
          urgency: string | null
          work_model: string | null
        }
        Insert: {
          account_id: string
          application_deadline?: string | null
          benefits?: string[] | null
          closed_at?: string | null
          contract_type?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          description_context?: string | null
          description_tone?: string | null
          desired_skills?: string[] | null
          education_level?: string | null
          expected_start_date?: string | null
          experience_years?: number | null
          id?: string
          languages?: Json | null
          openings_count?: number | null
          position?: string | null
          require_cover_letter?: boolean | null
          required_skills?: string[] | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_type?: string | null
          seniority?: string | null
          status?: Database["public"]["Enums"]["hr_job_status"]
          tags?: string[] | null
          title: string
          unit?: string | null
          updated_at?: string
          urgency?: string | null
          work_model?: string | null
        }
        Update: {
          account_id?: string
          application_deadline?: string | null
          benefits?: string[] | null
          closed_at?: string | null
          contract_type?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          description_context?: string | null
          description_tone?: string | null
          desired_skills?: string[] | null
          education_level?: string | null
          expected_start_date?: string | null
          experience_years?: number | null
          id?: string
          languages?: Json | null
          openings_count?: number | null
          position?: string | null
          require_cover_letter?: boolean | null
          required_skills?: string[] | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_type?: string | null
          seniority?: string | null
          status?: Database["public"]["Enums"]["hr_job_status"]
          tags?: string[] | null
          title?: string
          unit?: string | null
          updated_at?: string
          urgency?: string | null
          work_model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_jobs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_partners: {
        Row: {
          account_id: string
          address: string | null
          avatar_url: string | null
          bank_account: string | null
          bank_agency: string | null
          bank_name: string | null
          bank_pix_key: string | null
          birth_date: string | null
          city: string | null
          cpf: string | null
          created_at: string
          department: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          exit_date: string | null
          full_name: string
          gender: string | null
          holding_cnpj: string | null
          hr_department_id: string | null
          id: string
          join_date: string | null
          marital_property_regime: string | null
          marital_status: string | null
          nationality: string | null
          notes: string | null
          ownership_percentage: number | null
          partner_type: string | null
          phone: string | null
          pis_pasep: string | null
          position: string | null
          pro_labore: number | null
          profession: string | null
          rg: string | null
          social_contract_number: string | null
          state: string | null
          status: string | null
          updated_at: string
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          account_id: string
          address?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          bank_pix_key?: string | null
          birth_date?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          exit_date?: string | null
          full_name: string
          gender?: string | null
          holding_cnpj?: string | null
          hr_department_id?: string | null
          id?: string
          join_date?: string | null
          marital_property_regime?: string | null
          marital_status?: string | null
          nationality?: string | null
          notes?: string | null
          ownership_percentage?: number | null
          partner_type?: string | null
          phone?: string | null
          pis_pasep?: string | null
          position?: string | null
          pro_labore?: number | null
          profession?: string | null
          rg?: string | null
          social_contract_number?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          account_id?: string
          address?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          bank_pix_key?: string | null
          birth_date?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          exit_date?: string | null
          full_name?: string
          gender?: string | null
          holding_cnpj?: string | null
          hr_department_id?: string | null
          id?: string
          join_date?: string | null
          marital_property_regime?: string | null
          marital_status?: string | null
          nationality?: string | null
          notes?: string | null
          ownership_percentage?: number | null
          partner_type?: string | null
          phone?: string | null
          pis_pasep?: string | null
          position?: string | null
          pro_labore?: number | null
          profession?: string | null
          rg?: string | null
          social_contract_number?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_partners_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_partners_hr_department_id_fkey"
            columns: ["hr_department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_positions: {
        Row: {
          account_id: string
          behavioral_skills: string[] | null
          career_path: string | null
          created_at: string
          department_id: string | null
          description: string | null
          education_level: string | null
          experience_years: number | null
          id: string
          is_active: boolean
          next_position_id: string | null
          requirements: string | null
          responsibilities: string[] | null
          salary_max: number | null
          salary_min: number | null
          seniority: string | null
          technical_skills: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          behavioral_skills?: string[] | null
          career_path?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          education_level?: string | null
          experience_years?: number | null
          id?: string
          is_active?: boolean
          next_position_id?: string | null
          requirements?: string | null
          responsibilities?: string[] | null
          salary_max?: number | null
          salary_min?: number | null
          seniority?: string | null
          technical_skills?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          behavioral_skills?: string[] | null
          career_path?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          education_level?: string | null
          experience_years?: number | null
          id?: string
          is_active?: boolean
          next_position_id?: string | null
          requirements?: string | null
          responsibilities?: string[] | null
          salary_max?: number | null
          salary_min?: number | null
          seniority?: string | null
          technical_skills?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_positions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_positions_next_position_id_fkey"
            columns: ["next_position_id"]
            isOneToOne: false
            referencedRelation: "hr_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_salary_history: {
        Row: {
          account_id: string
          approved_by: string | null
          change_type: string
          collaborator_id: string
          created_at: string
          effective_date: string
          id: string
          new_department: string | null
          new_position: string | null
          new_salary: number | null
          notes: string | null
          previous_department: string | null
          previous_position: string | null
          previous_salary: number | null
          reason: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          approved_by?: string | null
          change_type?: string
          collaborator_id: string
          created_at?: string
          effective_date: string
          id?: string
          new_department?: string | null
          new_position?: string | null
          new_salary?: number | null
          notes?: string | null
          previous_department?: string | null
          previous_position?: string | null
          previous_salary?: number | null
          reason?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          approved_by?: string | null
          change_type?: string
          collaborator_id?: string
          created_at?: string
          effective_date?: string
          id?: string
          new_department?: string | null
          new_position?: string | null
          new_salary?: number | null
          notes?: string | null
          previous_department?: string | null
          previous_position?: string | null
          previous_salary?: number | null
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_salary_history_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_salary_history_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_salary_history_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "hr_collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_service_providers: {
        Row: {
          account_id: string
          address: string | null
          avatar_url: string | null
          bank_account: string | null
          bank_agency: string | null
          bank_name: string | null
          bank_pix_key: string | null
          birth_date: string | null
          city: string | null
          cnpj: string | null
          company_name: string | null
          contract_auto_renewal: boolean | null
          contract_down_payment: number | null
          contract_end_date: string | null
          contract_installment_value: number | null
          contract_installments_count: number | null
          contract_number: string | null
          contract_start_date: string | null
          contract_total_value: number | null
          cpf: string | null
          created_at: string
          department: string | null
          education_level: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          fee_amount: number | null
          full_name: string
          gender: string | null
          hire_date: string | null
          hr_department_id: string | null
          id: string
          marital_status: string | null
          notes: string | null
          payment_method: string | null
          phone: string | null
          position: string | null
          rg: string | null
          service_type: string | null
          state: string | null
          status: string | null
          termination_date: string | null
          trade_name: string | null
          updated_at: string
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          account_id: string
          address?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          bank_pix_key?: string | null
          birth_date?: string | null
          city?: string | null
          cnpj?: string | null
          company_name?: string | null
          contract_auto_renewal?: boolean | null
          contract_down_payment?: number | null
          contract_end_date?: string | null
          contract_installment_value?: number | null
          contract_installments_count?: number | null
          contract_number?: string | null
          contract_start_date?: string | null
          contract_total_value?: number | null
          cpf?: string | null
          created_at?: string
          department?: string | null
          education_level?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          fee_amount?: number | null
          full_name: string
          gender?: string | null
          hire_date?: string | null
          hr_department_id?: string | null
          id?: string
          marital_status?: string | null
          notes?: string | null
          payment_method?: string | null
          phone?: string | null
          position?: string | null
          rg?: string | null
          service_type?: string | null
          state?: string | null
          status?: string | null
          termination_date?: string | null
          trade_name?: string | null
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          account_id?: string
          address?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          bank_pix_key?: string | null
          birth_date?: string | null
          city?: string | null
          cnpj?: string | null
          company_name?: string | null
          contract_auto_renewal?: boolean | null
          contract_down_payment?: number | null
          contract_end_date?: string | null
          contract_installment_value?: number | null
          contract_installments_count?: number | null
          contract_number?: string | null
          contract_start_date?: string | null
          contract_total_value?: number | null
          cpf?: string | null
          created_at?: string
          department?: string | null
          education_level?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          fee_amount?: number | null
          full_name?: string
          gender?: string | null
          hire_date?: string | null
          hr_department_id?: string | null
          id?: string
          marital_status?: string | null
          notes?: string | null
          payment_method?: string | null
          phone?: string | null
          position?: string | null
          rg?: string | null
          service_type?: string | null
          state?: string | null
          status?: string | null
          termination_date?: string | null
          trade_name?: string | null
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_service_providers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_service_providers_hr_department_id_fkey"
            columns: ["hr_department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_time_records: {
        Row: {
          account_id: string
          break_end: string | null
          break_start: string | null
          clock_in: string | null
          clock_out: string | null
          collaborator_id: string
          created_at: string
          id: string
          justification: string | null
          notes: string | null
          overtime_hours: number | null
          record_date: string
          status: string
          total_hours: number | null
          updated_at: string
        }
        Insert: {
          account_id: string
          break_end?: string | null
          break_start?: string | null
          clock_in?: string | null
          clock_out?: string | null
          collaborator_id: string
          created_at?: string
          id?: string
          justification?: string | null
          notes?: string | null
          overtime_hours?: number | null
          record_date: string
          status?: string
          total_hours?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          break_end?: string | null
          break_start?: string | null
          clock_in?: string | null
          clock_out?: string | null
          collaborator_id?: string
          created_at?: string
          id?: string
          justification?: string | null
          notes?: string | null
          overtime_hours?: number | null
          record_date?: string
          status?: string
          total_hours?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_time_records_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_time_records_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "hr_collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_vacation_requests: {
        Row: {
          account_id: string
          approved_at: string | null
          approved_by: string | null
          collaborator_id: string
          created_at: string
          days_count: number
          end_date: string
          id: string
          notes: string | null
          rejection_reason: string | null
          request_type: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          approved_at?: string | null
          approved_by?: string | null
          collaborator_id: string
          created_at?: string
          days_count: number
          end_date: string
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          request_type?: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          approved_at?: string | null
          approved_by?: string | null
          collaborator_id?: string
          created_at?: string
          days_count?: number
          end_date?: string
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          request_type?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_vacation_requests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_vacation_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_vacation_requests_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "hr_collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      insights_dashboard_shares: {
        Row: {
          account_id: string
          created_at: string
          created_by: string
          dashboard_id: string
          expires_at: string | null
          id: string
          is_active: boolean
          rotated_at: string | null
          share_token: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by: string
          dashboard_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          rotated_at?: string | null
          share_token: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string
          dashboard_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          rotated_at?: string | null
          share_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_dashboard_shares_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_dashboard_shares_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_dashboard_shares_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "insights_dashboards"
            referencedColumns: ["id"]
          },
        ]
      }
      insights_dashboards: {
        Row: {
          account_id: string
          created_at: string | null
          display_order: number
          folder: string | null
          id: string
          name: string
          sector: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string | null
          display_order?: number
          folder?: string | null
          id?: string
          name: string
          sector?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string | null
          display_order?: number
          folder?: string | null
          id?: string
          name?: string
          sector?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_dashboards_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_dashboards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      insights_layouts: {
        Row: {
          account_id: string
          created_at: string
          id: string
          is_default: boolean
          layout: Json
          name: string
          shared_with: string[] | null
          type: string
          updated_at: string
          user_id: string
          widgets: Json
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          layout?: Json
          name?: string
          shared_with?: string[] | null
          type?: string
          updated_at?: string
          user_id: string
          widgets?: Json
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          layout?: Json
          name?: string
          shared_with?: string[] | null
          type?: string
          updated_at?: string
          user_id?: string
          widgets?: Json
        }
        Relationships: [
          {
            foreignKeyName: "insights_layouts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_layouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      insights_share_access_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          request_count: number
          reviewed_at: string | null
          reviewed_by: string | null
          share_id: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          request_count?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          share_id: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          request_count?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          share_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_share_access_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_share_access_requests_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "insights_dashboard_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      insights_visuals: {
        Row: {
          chart_type: string | null
          config: Json | null
          created_at: string | null
          dashboard_id: string
          id: string
          layout: Json | null
          title: string | null
        }
        Insert: {
          chart_type?: string | null
          config?: Json | null
          created_at?: string | null
          dashboard_id: string
          id?: string
          layout?: Json | null
          title?: string | null
        }
        Update: {
          chart_type?: string | null
          config?: Json | null
          created_at?: string | null
          dashboard_id?: string
          id?: string
          layout?: Json | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insights_visuals_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "insights_dashboards"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_credentials: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          profile_id: string
          token_type: string | null
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          profile_id: string
          token_type?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          profile_id?: string
          token_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_credentials_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "instagram_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_insights: {
        Row: {
          account_id: string
          created_at: string | null
          id: string
          imported_at: string | null
          metric_date: string
          metric_type: string
          profile_id: string
          value: number
        }
        Insert: {
          account_id: string
          created_at?: string | null
          id?: string
          imported_at?: string | null
          metric_date: string
          metric_type: string
          profile_id: string
          value?: number
        }
        Update: {
          account_id?: string
          created_at?: string | null
          id?: string
          imported_at?: string | null
          metric_date?: string
          metric_type?: string
          profile_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "instagram_insights_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_insights_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "instagram_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_post_options: {
        Row: {
          account_id: string
          created_at: string | null
          display_order: number | null
          id: string
          is_system_default: boolean | null
          option_type: string
          value: string
        }
        Insert: {
          account_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_system_default?: boolean | null
          option_type: string
          value: string
        }
        Update: {
          account_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_system_default?: boolean | null
          option_type?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_post_options_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_posts: {
        Row: {
          ai_objective: string | null
          ai_objective_confidence: number | null
          caption: string | null
          collaborator: string | null
          comments: number | null
          composition: string[] | null
          created_at: string
          engagement_rate: number | null
          followers_gained: number | null
          id: string
          instagram_id: string | null
          is_trending: boolean | null
          likes: number | null
          link_clicks: number
          permalink: string | null
          post_type: string
          posted_at: string
          profile_id: string
          profile_visits: number | null
          reach: number | null
          reposts: number | null
          saves: number | null
          shares: number | null
          specialist_version: string | null
          theme: string | null
          thumbnail_url: string | null
          updated_at: string
          views: number
          virality_rate: number | null
        }
        Insert: {
          ai_objective?: string | null
          ai_objective_confidence?: number | null
          caption?: string | null
          collaborator?: string | null
          comments?: number | null
          composition?: string[] | null
          created_at?: string
          engagement_rate?: number | null
          followers_gained?: number | null
          id?: string
          instagram_id?: string | null
          is_trending?: boolean | null
          likes?: number | null
          link_clicks?: number
          permalink?: string | null
          post_type: string
          posted_at: string
          profile_id: string
          profile_visits?: number | null
          reach?: number | null
          reposts?: number | null
          saves?: number | null
          shares?: number | null
          specialist_version?: string | null
          theme?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          views?: number
          virality_rate?: number | null
        }
        Update: {
          ai_objective?: string | null
          ai_objective_confidence?: number | null
          caption?: string | null
          collaborator?: string | null
          comments?: number | null
          composition?: string[] | null
          created_at?: string
          engagement_rate?: number | null
          followers_gained?: number | null
          id?: string
          instagram_id?: string | null
          is_trending?: boolean | null
          likes?: number | null
          link_clicks?: number
          permalink?: string | null
          post_type?: string
          posted_at?: string
          profile_id?: string
          profile_visits?: number | null
          reach?: number | null
          reposts?: number | null
          saves?: number | null
          shares?: number | null
          specialist_version?: string | null
          theme?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          views?: number
          virality_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_posts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "instagram_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_profiles: {
        Row: {
          account_id: string
          bio: string | null
          created_at: string
          display_name: string | null
          followers_count: number | null
          followers_previous_count: number | null
          following_count: number | null
          id: string
          ig_business_account_id: string | null
          is_active: boolean | null
          last_synced_at: string | null
          meta_access_token: string | null
          posts_count: number | null
          profile_picture_url: string | null
          sync_error: string | null
          token_expires_at: string | null
          updated_at: string
          username: string
        }
        Insert: {
          account_id: string
          bio?: string | null
          created_at?: string
          display_name?: string | null
          followers_count?: number | null
          followers_previous_count?: number | null
          following_count?: number | null
          id?: string
          ig_business_account_id?: string | null
          is_active?: boolean | null
          last_synced_at?: string | null
          meta_access_token?: string | null
          posts_count?: number | null
          profile_picture_url?: string | null
          sync_error?: string | null
          token_expires_at?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          account_id?: string
          bio?: string | null
          created_at?: string
          display_name?: string | null
          followers_count?: number | null
          followers_previous_count?: number | null
          following_count?: number | null
          id?: string
          ig_business_account_id?: string | null
          is_active?: boolean | null
          last_synced_at?: string | null
          meta_access_token?: string | null
          posts_count?: number | null
          profile_picture_url?: string | null
          sync_error?: string | null
          token_expires_at?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          account_id: string
          config: Json | null
          created_at: string
          display_name: string | null
          id: string
          pin_hash: string | null
          sector_id: string | null
          status: Database["public"]["Enums"]["integration_status"]
          type: Database["public"]["Enums"]["integration_type"]
        }
        Insert: {
          account_id: string
          config?: Json | null
          created_at?: string
          display_name?: string | null
          id?: string
          pin_hash?: string | null
          sector_id?: string | null
          status?: Database["public"]["Enums"]["integration_status"]
          type: Database["public"]["Enums"]["integration_type"]
        }
        Update: {
          account_id?: string
          config?: Json | null
          created_at?: string
          display_name?: string | null
          id?: string
          pin_hash?: string | null
          sector_id?: string | null
          status?: Database["public"]["Enums"]["integration_status"]
          type?: Database["public"]["Enums"]["integration_type"]
        }
        Relationships: [
          {
            foreignKeyName: "integrations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_chat_participants: {
        Row: {
          chat_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          chat_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          chat_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_participants_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "internal_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_chat_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_chats: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          id: string
          is_group: boolean | null
          name: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean | null
          name?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean | null
          name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chats_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_chats_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_messages: {
        Row: {
          audio_duration: number | null
          chat_id: string
          content: string | null
          created_at: string
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          is_edited: boolean | null
          message_type: string
          reply_to_id: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          audio_duration?: number | null
          chat_id: string
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_edited?: boolean | null
          message_type?: string
          reply_to_id?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          audio_duration?: number | null
          chat_id?: string
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_edited?: boolean | null
          message_type?: string
          reply_to_id?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "internal_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "internal_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_tasks: {
        Row: {
          account_id: string
          activity_type_id: string | null
          assigned_to: string | null
          checklist_item_id: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          custom_status_id: string | null
          deal_id: string | null
          description: string | null
          due_date: string | null
          due_time: string | null
          google_calendar_event_id: string | null
          id: string
          lead_id: string | null
          meeting_platform: string | null
          meeting_url: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          zoom_meeting_id: string | null
        }
        Insert: {
          account_id: string
          activity_type_id?: string | null
          assigned_to?: string | null
          checklist_item_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          custom_status_id?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          google_calendar_event_id?: string | null
          id?: string
          lead_id?: string | null
          meeting_platform?: string | null
          meeting_url?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          zoom_meeting_id?: string | null
        }
        Update: {
          account_id?: string
          activity_type_id?: string | null
          assigned_to?: string | null
          checklist_item_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          custom_status_id?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          google_calendar_event_id?: string | null
          id?: string
          lead_id?: string | null
          meeting_platform?: string | null
          meeting_url?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          zoom_meeting_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_tasks_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_tasks_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "stage_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "internal_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_tasks_custom_status_id_fkey"
            columns: ["custom_status_id"]
            isOneToOne: false
            referencedRelation: "task_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_field_values: {
        Row: {
          account_id: string
          created_at: string
          field_id: string
          id: string
          lead_id: string
          updated_at: string
          value_boolean: boolean | null
          value_date: string | null
          value_json: Json | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          field_id: string
          id?: string
          lead_id: string
          updated_at?: string
          value_boolean?: boolean | null
          value_date?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          field_id?: string
          id?: string
          lead_id?: string
          updated_at?: string
          value_boolean?: boolean | null
          value_date?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_field_values_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_field_values_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_timeline: {
        Row: {
          account_id: string
          created_at: string
          description: string | null
          event_type: string
          id: string
          lead_id: string
          metadata: Json | null
          title: string
          user_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          lead_id: string
          metadata?: Json | null
          title: string
          user_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          lead_id?: string
          metadata?: Json | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_timeline_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_timeline_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leadads_page_subscriptions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          page_access_token: string
          page_id: string
          page_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          page_access_token: string
          page_id: string
          page_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          page_access_token?: string
          page_id?: string
          page_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          account_id: string
          additional_bank_accounts: Json | null
          additional_phones: Json | null
          additional_pix_keys: Json | null
          avatar_url: string | null
          bank_account: string | null
          bank_account_type: string | null
          bank_agency: string | null
          bank_code: string | null
          bank_name: string | null
          birth_date: string | null
          business_city: string | null
          business_complement: string | null
          business_neighborhood: string | null
          business_niche: string | null
          business_segment: string | null
          business_state: string | null
          business_street: string | null
          business_street_number: string | null
          business_zip_code: string | null
          canal: string | null
          city: string | null
          cnpj: string | null
          companies: Json | null
          company_name: string | null
          complement: string | null
          converted_at: string | null
          converted_to_client_id: string | null
          cpf: string | null
          created_at: string
          email: string | null
          emails: Json | null
          external_id: string | null
          external_source: string | null
          full_name: string
          id: string
          instagram: string | null
          instagrams: Json | null
          mql: string | null
          neighborhood: string | null
          notes: string | null
          phone: string | null
          pix_key: string | null
          pix_key_type: string | null
          responsible_user_id: string | null
          revenue_range: string | null
          rg: string | null
          source: string | null
          state: string | null
          status: string
          street: string | null
          street_number: string | null
          tags: Json | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          account_id: string
          additional_bank_accounts?: Json | null
          additional_phones?: Json | null
          additional_pix_keys?: Json | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_code?: string | null
          bank_name?: string | null
          birth_date?: string | null
          business_city?: string | null
          business_complement?: string | null
          business_neighborhood?: string | null
          business_niche?: string | null
          business_segment?: string | null
          business_state?: string | null
          business_street?: string | null
          business_street_number?: string | null
          business_zip_code?: string | null
          canal?: string | null
          city?: string | null
          cnpj?: string | null
          companies?: Json | null
          company_name?: string | null
          complement?: string | null
          converted_at?: string | null
          converted_to_client_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          emails?: Json | null
          external_id?: string | null
          external_source?: string | null
          full_name: string
          id?: string
          instagram?: string | null
          instagrams?: Json | null
          mql?: string | null
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          responsible_user_id?: string | null
          revenue_range?: string | null
          rg?: string | null
          source?: string | null
          state?: string | null
          status?: string
          street?: string | null
          street_number?: string | null
          tags?: Json | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          account_id?: string
          additional_bank_accounts?: Json | null
          additional_phones?: Json | null
          additional_pix_keys?: Json | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_code?: string | null
          bank_name?: string | null
          birth_date?: string | null
          business_city?: string | null
          business_complement?: string | null
          business_neighborhood?: string | null
          business_niche?: string | null
          business_segment?: string | null
          business_state?: string | null
          business_street?: string | null
          business_street_number?: string | null
          business_zip_code?: string | null
          canal?: string | null
          city?: string | null
          cnpj?: string | null
          companies?: Json | null
          company_name?: string | null
          complement?: string | null
          converted_at?: string | null
          converted_to_client_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          emails?: Json | null
          external_id?: string | null
          external_source?: string | null
          full_name?: string
          id?: string
          instagram?: string | null
          instagrams?: Json | null
          mql?: string | null
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          responsible_user_id?: string | null
          revenue_range?: string | null
          rg?: string | null
          source?: string | null
          state?: string | null
          status?: string
          street?: string | null
          street_number?: string | null
          tags?: Json | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_to_client_id_fkey"
            columns: ["converted_to_client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "leads_converted_to_client_id_fkey"
            columns: ["converted_to_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      live_interactions: {
        Row: {
          account_id: string
          client_id: string
          count: number
          created_at: string
          id: string
          live_session_id: string
          type: Database["public"]["Enums"]["interaction_type"]
        }
        Insert: {
          account_id: string
          client_id: string
          count?: number
          created_at?: string
          id?: string
          live_session_id: string
          type: Database["public"]["Enums"]["interaction_type"]
        }
        Update: {
          account_id?: string
          client_id?: string
          count?: number
          created_at?: string
          id?: string
          live_session_id?: string
          type?: Database["public"]["Enums"]["interaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "live_interactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "live_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_interactions_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          account_id: string
          created_at: string
          end_time: string | null
          external_meeting_id: string | null
          id: string
          platform: Database["public"]["Enums"]["live_platform"]
          start_time: string
          title: string
        }
        Insert: {
          account_id: string
          created_at?: string
          end_time?: string | null
          external_meeting_id?: string | null
          id?: string
          platform: Database["public"]["Enums"]["live_platform"]
          start_time: string
          title: string
        }
        Update: {
          account_id?: string
          created_at?: string
          end_time?: string | null
          external_meeting_id?: string | null
          id?: string
          platform?: Database["public"]["Enums"]["live_platform"]
          start_time?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      marketing_ad_sets: {
        Row: {
          clicks: number | null
          conversions: number | null
          cpl: number | null
          created_at: string
          id: string
          impressions: number | null
          meta_campaign_id: string | null
          name: string
          platform: string | null
          spend: number | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          clicks?: number | null
          conversions?: number | null
          cpl?: number | null
          created_at?: string
          id?: string
          impressions?: number | null
          meta_campaign_id?: string | null
          name: string
          platform?: string | null
          spend?: number | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          clicks?: number | null
          conversions?: number | null
          cpl?: number | null
          created_at?: string
          id?: string
          impressions?: number | null
          meta_campaign_id?: string | null
          name?: string
          platform?: string | null
          spend?: number | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketing_ai_suggestion_reviews: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          decision: Database["public"]["Enums"]["marketing_ai_decision"]
          decision_notes: string | null
          edited_payload: Json | null
          id: string
          input_context: Json
          objective: string | null
          profile_id: string | null
          profile_platform: string | null
          profile_username: string | null
          reviewed_at: string
          reviewed_by: string | null
          source_function: string
          source_item_key: string | null
          suggestion_payload: Json
          suggestion_type: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          decision: Database["public"]["Enums"]["marketing_ai_decision"]
          decision_notes?: string | null
          edited_payload?: Json | null
          id?: string
          input_context?: Json
          objective?: string | null
          profile_id?: string | null
          profile_platform?: string | null
          profile_username?: string | null
          reviewed_at?: string
          reviewed_by?: string | null
          source_function: string
          source_item_key?: string | null
          suggestion_payload?: Json
          suggestion_type: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          decision?: Database["public"]["Enums"]["marketing_ai_decision"]
          decision_notes?: string | null
          edited_payload?: Json | null
          id?: string
          input_context?: Json
          objective?: string | null
          profile_id?: string | null
          profile_platform?: string | null
          profile_username?: string | null
          reviewed_at?: string
          reviewed_by?: string | null
          source_function?: string
          source_item_key?: string | null
          suggestion_payload?: Json
          suggestion_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_ai_suggestion_reviews_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_brand_voice: {
        Row: {
          account_id: string
          ai_summary: string | null
          created_at: string
          emoji_style: string | null
          example_posts: string[] | null
          forbidden_words: string[] | null
          hashtag_strategy: string | null
          id: string
          learned_from_instagram_at: string | null
          niche: string | null
          personality: string | null
          posts_analyzed_count: number | null
          signature_phrases: string[] | null
          target_audience: string | null
          tone_keywords: string[] | null
          updated_at: string
          updated_by: string | null
          values_and_mission: string | null
        }
        Insert: {
          account_id: string
          ai_summary?: string | null
          created_at?: string
          emoji_style?: string | null
          example_posts?: string[] | null
          forbidden_words?: string[] | null
          hashtag_strategy?: string | null
          id?: string
          learned_from_instagram_at?: string | null
          niche?: string | null
          personality?: string | null
          posts_analyzed_count?: number | null
          signature_phrases?: string[] | null
          target_audience?: string | null
          tone_keywords?: string[] | null
          updated_at?: string
          updated_by?: string | null
          values_and_mission?: string | null
        }
        Update: {
          account_id?: string
          ai_summary?: string | null
          created_at?: string
          emoji_style?: string | null
          example_posts?: string[] | null
          forbidden_words?: string[] | null
          hashtag_strategy?: string | null
          id?: string
          learned_from_instagram_at?: string | null
          niche?: string | null
          personality?: string | null
          posts_analyzed_count?: number | null
          signature_phrases?: string[] | null
          target_audience?: string | null
          tone_keywords?: string[] | null
          updated_at?: string
          updated_by?: string | null
          values_and_mission?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_brand_voice_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_copilot_conversations: {
        Row: {
          account_id: string
          created_at: string
          id: string
          is_pinned: boolean | null
          last_message_at: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          last_message_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          last_message_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_copilot_conversations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_copilot_messages: {
        Row: {
          account_id: string
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          role: string
          tool_call_id: string | null
          tool_calls: Json | null
          tool_name: string | null
          tool_result: Json | null
        }
        Insert: {
          account_id: string
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          tool_call_id?: string | null
          tool_calls?: Json | null
          tool_name?: string | null
          tool_result?: Json | null
        }
        Update: {
          account_id?: string
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          tool_call_id?: string | null
          tool_calls?: Json | null
          tool_name?: string | null
          tool_result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_copilot_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_copilot_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "marketing_copilot_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_copy_history: {
        Row: {
          account_id: string
          context: Json | null
          copy_type: string
          created_at: string
          created_by: string | null
          id: string
          idea_id: string | null
          is_favorite: boolean
          model: string | null
          output: string
          prompt: string
        }
        Insert: {
          account_id: string
          context?: Json | null
          copy_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          idea_id?: string | null
          is_favorite?: boolean
          model?: string | null
          output: string
          prompt: string
        }
        Update: {
          account_id?: string
          context?: Json | null
          copy_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          idea_id?: string | null
          is_favorite?: boolean
          model?: string | null
          output?: string
          prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_copy_history_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_copy_history_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "marketing_ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_hooks: {
        Row: {
          account_id: string
          category: string | null
          created_at: string
          created_by: string | null
          created_by_ai: boolean | null
          engagement_rate: number | null
          id: string
          is_favorite: boolean | null
          notes: string | null
          performance_score: number | null
          source: string
          source_platform: string | null
          source_post_id: string | null
          source_url: string | null
          tags: string[] | null
          text: string
          times_used: number | null
          updated_at: string
          views: number | null
        }
        Insert: {
          account_id: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          created_by_ai?: boolean | null
          engagement_rate?: number | null
          id?: string
          is_favorite?: boolean | null
          notes?: string | null
          performance_score?: number | null
          source?: string
          source_platform?: string | null
          source_post_id?: string | null
          source_url?: string | null
          tags?: string[] | null
          text: string
          times_used?: number | null
          updated_at?: string
          views?: number | null
        }
        Update: {
          account_id?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          created_by_ai?: boolean | null
          engagement_rate?: number | null
          id?: string
          is_favorite?: boolean | null
          notes?: string | null
          performance_score?: number | null
          source?: string
          source_platform?: string | null
          source_post_id?: string | null
          source_url?: string | null
          tags?: string[] | null
          text?: string
          times_used?: number | null
          updated_at?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_hooks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_idea_assignees: {
        Row: {
          created_at: string
          id: string
          idea_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idea_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idea_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_idea_assignees_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "marketing_ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_idea_checklist: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          idea_id: string
          is_completed: boolean
          position: number
          title: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          idea_id: string
          is_completed?: boolean
          position?: number
          title: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          idea_id?: string
          is_completed?: boolean
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_idea_checklist_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "marketing_ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_ideas: {
        Row: {
          account_id: string
          caption: string | null
          created_at: string
          created_by: string | null
          description: string | null
          format: string
          hook: string | null
          id: string
          planned_date: string | null
          platform: string
          position: number | null
          posted_at: string | null
          priority: string
          publish_platform: string | null
          published_at: string | null
          published_url: string | null
          reference_ids: string[] | null
          scheduled_at: string | null
          scheduled_for: string | null
          status: string
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          trend_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          caption?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          format?: string
          hook?: string | null
          id?: string
          planned_date?: string | null
          platform?: string
          position?: number | null
          posted_at?: string | null
          priority?: string
          publish_platform?: string | null
          published_at?: string | null
          published_url?: string | null
          reference_ids?: string[] | null
          scheduled_at?: string | null
          scheduled_for?: string | null
          status?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          trend_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          caption?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          format?: string
          hook?: string | null
          id?: string
          planned_date?: string | null
          platform?: string
          position?: number | null
          posted_at?: string | null
          priority?: string
          publish_platform?: string | null
          published_at?: string | null
          published_url?: string | null
          reference_ids?: string[] | null
          scheduled_at?: string | null
          scheduled_for?: string | null
          status?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          trend_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_ideas_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_ideas_trend_fk"
            columns: ["trend_id"]
            isOneToOne: false
            referencedRelation: "marketing_trends"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_performance_insights: {
        Row: {
          account_id: string
          created_at: string
          data: Json | null
          description: string
          id: string
          insight_type: string
          period_end: string | null
          period_start: string | null
          platform: string
          score: number | null
          title: string
        }
        Insert: {
          account_id: string
          created_at?: string
          data?: Json | null
          description: string
          id?: string
          insight_type: string
          period_end?: string | null
          period_start?: string | null
          platform: string
          score?: number | null
          title: string
        }
        Update: {
          account_id?: string
          created_at?: string
          data?: Json | null
          description?: string
          id?: string
          insight_type?: string
          period_end?: string | null
          period_start?: string | null
          platform?: string
          score?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_performance_insights_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_persona_ab_tests: {
        Row: {
          account_id: string
          chosen_variant: string | null
          clients_analyzed: number | null
          created_at: string
          decided_at: string | null
          explicit_feedback_a: string | null
          explicit_feedback_b: string | null
          field: string
          field_format: string
          final_value: Json | null
          highlights_snapshot: Json | null
          id: string
          instagram_username: string | null
          saved_at: string | null
          saved_without_edit: boolean | null
          user_id: string | null
          variant_a_has_highlights: boolean
          variant_a_suggestion: Json | null
          variant_b_suggestion: Json | null
        }
        Insert: {
          account_id: string
          chosen_variant?: string | null
          clients_analyzed?: number | null
          created_at?: string
          decided_at?: string | null
          explicit_feedback_a?: string | null
          explicit_feedback_b?: string | null
          field: string
          field_format: string
          final_value?: Json | null
          highlights_snapshot?: Json | null
          id?: string
          instagram_username?: string | null
          saved_at?: string | null
          saved_without_edit?: boolean | null
          user_id?: string | null
          variant_a_has_highlights?: boolean
          variant_a_suggestion?: Json | null
          variant_b_suggestion?: Json | null
        }
        Update: {
          account_id?: string
          chosen_variant?: string | null
          clients_analyzed?: number | null
          created_at?: string
          decided_at?: string | null
          explicit_feedback_a?: string | null
          explicit_feedback_b?: string | null
          field?: string
          field_format?: string
          final_value?: Json | null
          highlights_snapshot?: Json | null
          id?: string
          instagram_username?: string | null
          saved_at?: string | null
          saved_without_edit?: boolean | null
          user_id?: string | null
          variant_a_has_highlights?: boolean
          variant_a_suggestion?: Json | null
          variant_b_suggestion?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_persona_ab_tests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_personas: {
        Row: {
          account_id: string
          age_range: string | null
          ai_summary: string | null
          avatar_emoji: string | null
          biggest_dream: string | null
          biggest_fear: string | null
          business_size: string | null
          business_type: string | null
          channels: string[]
          clients_analyzed_count: number | null
          created_at: string
          daily_routine: string | null
          desires: string[]
          education: string | null
          emotional_triggers: string[]
          gender: string | null
          id: string
          is_default: boolean
          learned_from_clients_at: string | null
          location: string | null
          name: string
          notes: string | null
          objections: string[]
          pains: string[]
          profession: string | null
          references_consumed: string[]
          revenue_range: string | null
          updated_at: string
          vocabulary: string[]
          years_in_business: string | null
        }
        Insert: {
          account_id: string
          age_range?: string | null
          ai_summary?: string | null
          avatar_emoji?: string | null
          biggest_dream?: string | null
          biggest_fear?: string | null
          business_size?: string | null
          business_type?: string | null
          channels?: string[]
          clients_analyzed_count?: number | null
          created_at?: string
          daily_routine?: string | null
          desires?: string[]
          education?: string | null
          emotional_triggers?: string[]
          gender?: string | null
          id?: string
          is_default?: boolean
          learned_from_clients_at?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          objections?: string[]
          pains?: string[]
          profession?: string | null
          references_consumed?: string[]
          revenue_range?: string | null
          updated_at?: string
          vocabulary?: string[]
          years_in_business?: string | null
        }
        Update: {
          account_id?: string
          age_range?: string | null
          ai_summary?: string | null
          avatar_emoji?: string | null
          biggest_dream?: string | null
          biggest_fear?: string | null
          business_size?: string | null
          business_type?: string | null
          channels?: string[]
          clients_analyzed_count?: number | null
          created_at?: string
          daily_routine?: string | null
          desires?: string[]
          education?: string | null
          emotional_triggers?: string[]
          gender?: string | null
          id?: string
          is_default?: boolean
          learned_from_clients_at?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          objections?: string[]
          pains?: string[]
          profession?: string | null
          references_consumed?: string[]
          revenue_range?: string | null
          updated_at?: string
          vocabulary?: string[]
          years_in_business?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_personas_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_reference_boards: {
        Row: {
          account_id: string
          color: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          account_id: string
          color?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          color?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_reference_boards_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_references: {
        Row: {
          account_id: string
          board_id: string | null
          color_palette: string[] | null
          created_at: string
          created_by: string | null
          height: number | null
          id: string
          notes: string | null
          source_url: string | null
          storage_path: string | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string | null
          type: string
          updated_at: string
          url: string
          width: number | null
        }
        Insert: {
          account_id: string
          board_id?: string | null
          color_palette?: string[] | null
          created_at?: string
          created_by?: string | null
          height?: number | null
          id?: string
          notes?: string | null
          source_url?: string | null
          storage_path?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string | null
          type?: string
          updated_at?: string
          url: string
          width?: number | null
        }
        Update: {
          account_id?: string
          board_id?: string | null
          color_palette?: string[] | null
          created_at?: string
          created_by?: string | null
          height?: number | null
          id?: string
          notes?: string | null
          source_url?: string | null
          storage_path?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string | null
          type?: string
          updated_at?: string
          url?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_references_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_references_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "marketing_reference_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_task_sections: {
        Row: {
          account_id: string
          created_at: string
          display_order: number
          id: string
          is_collapsed: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_collapsed?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_collapsed?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_task_sections_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_task_subtasks: {
        Row: {
          account_id: string
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          display_order: number
          due_date: string | null
          id: string
          is_completed: boolean
          task_id: string
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          display_order?: number
          due_date?: string | null
          id?: string
          is_completed?: boolean
          task_id: string
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          display_order?: number
          due_date?: string | null
          id?: string
          is_completed?: boolean
          task_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_task_subtasks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_task_subtasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_task_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "marketing_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_tasks: {
        Row: {
          account_id: string
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          description: string | null
          display_order: number
          due_date: string | null
          id: string
          is_completed: boolean
          media_attachments: Json | null
          priority: Database["public"]["Enums"]["marketing_task_priority"]
          section_id: string | null
          status: Database["public"]["Enums"]["marketing_task_status"]
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          description?: string | null
          display_order?: number
          due_date?: string | null
          id?: string
          is_completed?: boolean
          media_attachments?: Json | null
          priority?: Database["public"]["Enums"]["marketing_task_priority"]
          section_id?: string | null
          status?: Database["public"]["Enums"]["marketing_task_status"]
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          description?: string | null
          display_order?: number
          due_date?: string | null
          id?: string
          is_completed?: boolean
          media_attachments?: Json | null
          priority?: Database["public"]["Enums"]["marketing_task_priority"]
          section_id?: string | null
          status?: Database["public"]["Enums"]["marketing_task_status"]
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_tasks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_tasks_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "marketing_task_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_trends: {
        Row: {
          account_id: string
          ai_adaptation: string | null
          ai_analysis: Json | null
          audio_name: string | null
          audio_title: string | null
          captured_at: string
          captured_by: string | null
          comments_count: number | null
          created_at: string
          creator_followers: number | null
          creator_handle: string | null
          description: string | null
          expires_at: string | null
          hype_score: number | null
          id: string
          is_archived: boolean
          likes_count: number | null
          media_url: string | null
          platform: string | null
          shares_count: number | null
          source: string
          source_url: string | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          views_count: number | null
        }
        Insert: {
          account_id: string
          ai_adaptation?: string | null
          ai_analysis?: Json | null
          audio_name?: string | null
          audio_title?: string | null
          captured_at?: string
          captured_by?: string | null
          comments_count?: number | null
          created_at?: string
          creator_followers?: number | null
          creator_handle?: string | null
          description?: string | null
          expires_at?: string | null
          hype_score?: number | null
          id?: string
          is_archived?: boolean
          likes_count?: number | null
          media_url?: string | null
          platform?: string | null
          shares_count?: number | null
          source?: string
          source_url?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          views_count?: number | null
        }
        Update: {
          account_id?: string
          ai_adaptation?: string | null
          ai_analysis?: Json | null
          audio_name?: string | null
          audio_title?: string | null
          captured_at?: string
          captured_by?: string | null
          comments_count?: number | null
          created_at?: string
          creator_followers?: number | null
          creator_handle?: string | null
          description?: string | null
          expires_at?: string | null
          hype_score?: number | null
          id?: string
          is_archived?: boolean
          likes_count?: number | null
          media_url?: string | null
          platform?: string | null
          shares_count?: number | null
          source?: string
          source_url?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_trends_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      members_book_settings: {
        Row: {
          access_password: string | null
          account_id: string
          created_at: string
          custom_description: string | null
          custom_title: string | null
          id: string
          is_enabled: boolean
          show_bio: boolean | null
          show_company: boolean
          show_email: boolean
          show_instagram: boolean
          show_phone: boolean
          show_products: boolean
          updated_at: string
        }
        Insert: {
          access_password?: string | null
          account_id: string
          created_at?: string
          custom_description?: string | null
          custom_title?: string | null
          id?: string
          is_enabled?: boolean
          show_bio?: boolean | null
          show_company?: boolean
          show_email?: boolean
          show_instagram?: boolean
          show_phone?: boolean
          show_products?: boolean
          updated_at?: string
        }
        Update: {
          access_password?: string | null
          account_id?: string
          created_at?: string
          custom_description?: string | null
          custom_title?: string | null
          id?: string
          is_enabled?: boolean
          show_bio?: boolean | null
          show_company?: boolean
          show_email?: boolean
          show_instagram?: boolean
          show_phone?: boolean
          show_products?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_book_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      members_book_visibility: {
        Row: {
          account_id: string
          client_id: string
          created_at: string
          display_order: number | null
          id: string
          is_visible: boolean
          updated_at: string
        }
        Insert: {
          account_id: string
          client_id: string
          created_at?: string
          display_order?: number | null
          id?: string
          is_visible?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string
          client_id?: string
          created_at?: string
          display_order?: number | null
          id?: string
          is_visible?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_book_visibility_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_book_visibility_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "members_book_visibility_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      message_events: {
        Row: {
          account_id: string
          audio_duration_sec: number | null
          client_id: string
          content_text: string | null
          conversation_id: string | null
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          group_name: string | null
          id: string
          is_group: boolean | null
          sent_at: string
          source: Database["public"]["Enums"]["message_source"]
        }
        Insert: {
          account_id: string
          audio_duration_sec?: number | null
          client_id: string
          content_text?: string | null
          conversation_id?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          group_name?: string | null
          id?: string
          is_group?: boolean | null
          sent_at: string
          source: Database["public"]["Enums"]["message_source"]
        }
        Update: {
          account_id?: string
          audio_duration_sec?: number | null
          client_id?: string
          content_text?: string | null
          conversation_id?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          group_name?: string | null
          id?: string
          is_group?: boolean | null
          sent_at?: string
          source?: Database["public"]["Enums"]["message_source"]
        }
        Relationships: [
          {
            foreignKeyName: "message_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "message_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais: {
        Row: {
          access_key: string | null
          account_id: string
          cancellation_reason: string | null
          city_code: string | null
          city_name: string | null
          client_id: string | null
          cnae_code: string | null
          cofins_amount: number | null
          competence_date: string | null
          created_at: string
          csll_amount: number | null
          description: string | null
          discount_amount: number | null
          external_id: string | null
          financial_entry_id: string | null
          icms_amount: number | null
          icms_rate: number | null
          id: string
          inss_amount: number | null
          invoice_number: string | null
          invoice_type: string
          ir_amount: number | null
          iss_amount: number | null
          iss_rate: number | null
          issue_date: string
          notes: string | null
          pdf_url: string | null
          pis_amount: number | null
          products_amount: number | null
          series: string | null
          service_code: string | null
          services_amount: number | null
          status: string
          total_amount: number
          updated_at: string
          verification_code: string | null
          xml_url: string | null
        }
        Insert: {
          access_key?: string | null
          account_id: string
          cancellation_reason?: string | null
          city_code?: string | null
          city_name?: string | null
          client_id?: string | null
          cnae_code?: string | null
          cofins_amount?: number | null
          competence_date?: string | null
          created_at?: string
          csll_amount?: number | null
          description?: string | null
          discount_amount?: number | null
          external_id?: string | null
          financial_entry_id?: string | null
          icms_amount?: number | null
          icms_rate?: number | null
          id?: string
          inss_amount?: number | null
          invoice_number?: string | null
          invoice_type?: string
          ir_amount?: number | null
          iss_amount?: number | null
          iss_rate?: number | null
          issue_date?: string
          notes?: string | null
          pdf_url?: string | null
          pis_amount?: number | null
          products_amount?: number | null
          series?: string | null
          service_code?: string | null
          services_amount?: number | null
          status?: string
          total_amount?: number
          updated_at?: string
          verification_code?: string | null
          xml_url?: string | null
        }
        Update: {
          access_key?: string | null
          account_id?: string
          cancellation_reason?: string | null
          city_code?: string | null
          city_name?: string | null
          client_id?: string | null
          cnae_code?: string | null
          cofins_amount?: number | null
          competence_date?: string | null
          created_at?: string
          csll_amount?: number | null
          description?: string | null
          discount_amount?: number | null
          external_id?: string | null
          financial_entry_id?: string | null
          icms_amount?: number | null
          icms_rate?: number | null
          id?: string
          inss_amount?: number | null
          invoice_number?: string | null
          invoice_type?: string
          ir_amount?: number | null
          iss_amount?: number | null
          iss_rate?: number | null
          issue_date?: string
          notes?: string | null
          pdf_url?: string | null
          pis_amount?: number | null
          products_amount?: number | null
          series?: string | null
          service_code?: string | null
          services_amount?: number | null
          status?: string
          total_amount?: number
          updated_at?: string
          verification_code?: string | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "notas_fiscais_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          account_id: string
          content: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          sector_id: string | null
          source_id: string | null
          source_type: string | null
          title: string
          triggered_by_user_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          account_id: string
          content?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          sector_id?: string | null
          source_id?: string | null
          source_type?: string | null
          title: string
          triggered_by_user_id?: string | null
          type?: string
          user_id: string
        }
        Update: {
          account_id?: string
          content?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          sector_id?: string | null
          source_id?: string | null
          source_type?: string | null
          title?: string
          triggered_by_user_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_triggered_by_user_id_fkey"
            columns: ["triggered_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          provider: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          provider: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          provider?: string
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      omie_integration_logs: {
        Row: {
          account_id: string
          action: string
          created_at: string
          deal_id: string | null
          error_message: string | null
          id: string
          omie_os_id: string | null
          request_payload: Json | null
          response_payload: Json | null
          status: string
        }
        Insert: {
          account_id: string
          action?: string
          created_at?: string
          deal_id?: string | null
          error_message?: string | null
          id?: string
          omie_os_id?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
        }
        Update: {
          account_id?: string
          action?: string
          created_at?: string
          deal_id?: string | null
          error_message?: string | null
          id?: string
          omie_os_id?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "omie_integration_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omie_integration_logs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      omie_settings: {
        Row: {
          account_id: string
          app_key: string
          app_secret: string
          created_at: string
          default_bank_account_code: string | null
          default_category_code: string | null
          default_city: string | null
          default_retem_iss: string
          default_service_code: string | null
          default_service_lc116_code: string | null
          default_tax_type: string
          field_mappings: Json | null
          id: string
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          account_id: string
          app_key?: string
          app_secret?: string
          created_at?: string
          default_bank_account_code?: string | null
          default_category_code?: string | null
          default_city?: string | null
          default_retem_iss?: string
          default_service_code?: string | null
          default_service_lc116_code?: string | null
          default_tax_type?: string
          field_mappings?: Json | null
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string
          app_key?: string
          app_secret?: string
          created_at?: string
          default_bank_account_code?: string | null
          default_category_code?: string | null
          default_city?: string | null
          default_retem_iss?: string
          default_service_code?: string | null
          default_service_lc116_code?: string | null
          default_tax_type?: string
          field_mappings?: Json | null
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "omie_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          account_id: string
          category: string
          contract_label: string
          created_at: string
          display_order: number
          has_entrada: boolean
          has_parcelas: boolean
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_id: string
          category?: string
          contract_label: string
          created_at?: string
          display_order?: number
          has_entrada?: boolean
          has_parcelas?: boolean
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          category?: string
          contract_label?: string
          created_at?: string
          display_order?: number
          has_entrada?: boolean
          has_parcelas?: boolean
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_filters: {
        Row: {
          account_id: string
          conditions: Json
          created_at: string
          created_by: string
          id: string
          is_public: boolean
          match_type: string
          name: string
          updated_at: string
        }
        Insert: {
          account_id: string
          conditions?: Json
          created_at?: string
          created_by: string
          id?: string
          is_public?: boolean
          match_type?: string
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          conditions?: Json
          created_at?: string
          created_by?: string
          id?: string
          is_public?: boolean
          match_type?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_filters_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_filters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          account_id: string
          color: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_id: string
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_folders: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          position: number | null
          sector_id: string | null
          updated_at: string
          visibility: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          position?: number | null
          sector_id?: string | null
          updated_at?: string
          visibility?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          position?: number | null
          sector_id?: string | null
          updated_at?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playbook_folders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_folders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_items: {
        Row: {
          account_id: string
          content_type: string
          created_at: string
          created_by: string | null
          folder_id: string | null
          id: string
          is_favorite: boolean | null
          last_used_at: string | null
          link_description: string | null
          link_title: string | null
          link_url: string | null
          list_items: Json | null
          media_caption: string | null
          media_duration: number | null
          media_filename: string | null
          media_size: number | null
          media_url: string | null
          name: string
          position: number | null
          sector_id: string | null
          template_body: string | null
          template_buttons: Json | null
          template_footer: string | null
          template_header: string | null
          text_content: string | null
          updated_at: string
          usage_count: number | null
          visibility: string | null
        }
        Insert: {
          account_id: string
          content_type: string
          created_at?: string
          created_by?: string | null
          folder_id?: string | null
          id?: string
          is_favorite?: boolean | null
          last_used_at?: string | null
          link_description?: string | null
          link_title?: string | null
          link_url?: string | null
          list_items?: Json | null
          media_caption?: string | null
          media_duration?: number | null
          media_filename?: string | null
          media_size?: number | null
          media_url?: string | null
          name: string
          position?: number | null
          sector_id?: string | null
          template_body?: string | null
          template_buttons?: Json | null
          template_footer?: string | null
          template_header?: string | null
          text_content?: string | null
          updated_at?: string
          usage_count?: number | null
          visibility?: string | null
        }
        Update: {
          account_id?: string
          content_type?: string
          created_at?: string
          created_by?: string | null
          folder_id?: string | null
          id?: string
          is_favorite?: boolean | null
          last_used_at?: string | null
          link_description?: string | null
          link_title?: string | null
          link_url?: string | null
          list_items?: Json | null
          media_caption?: string | null
          media_duration?: number | null
          media_filename?: string | null
          media_size?: number | null
          media_url?: string | null
          name?: string
          position?: number | null
          sector_id?: string | null
          template_body?: string | null
          template_buttons?: Json | null
          template_footer?: string | null
          template_header?: string | null
          text_content?: string | null
          updated_at?: string
          usage_count?: number | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playbook_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_items_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "playbook_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_bonuses: {
        Row: {
          account_id: string
          color: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          label: string
          product_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          label: string
          product_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          label?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_bonuses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_bonuses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          account_id: string
          allows_second_seat: boolean
          billing_period: Database["public"]["Enums"]["billing_period"]
          cash_price: number | null
          color: string | null
          created_at: string
          deliverables: Json | null
          description: string | null
          id: string
          installment_price: number | null
          is_active: boolean
          is_mls: boolean
          is_renewal: boolean
          mls_level: string | null
          mql_criteria: Json | null
          name: string
          payment_methods: Json | null
          price: number
          renewal_discount_percent: number | null
          updated_at: string
        }
        Insert: {
          account_id: string
          allows_second_seat?: boolean
          billing_period?: Database["public"]["Enums"]["billing_period"]
          cash_price?: number | null
          color?: string | null
          created_at?: string
          deliverables?: Json | null
          description?: string | null
          id?: string
          installment_price?: number | null
          is_active?: boolean
          is_mls?: boolean
          is_renewal?: boolean
          mls_level?: string | null
          mql_criteria?: Json | null
          name: string
          payment_methods?: Json | null
          price?: number
          renewal_discount_percent?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          allows_second_seat?: boolean
          billing_period?: Database["public"]["Enums"]["billing_period"]
          cash_price?: number | null
          color?: string | null
          created_at?: string
          deliverables?: Json | null
          description?: string | null
          id?: string
          installment_price?: number | null
          is_active?: boolean
          is_mls?: boolean
          is_renewal?: boolean
          mls_level?: string | null
          mql_criteria?: Json | null
          name?: string
          payment_methods?: Json | null
          price?: number
          renewal_discount_percent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      push_notification_preferences: {
        Row: {
          account_id: string
          created_at: string
          id: string
          notify_mentions: boolean
          notify_sectors: Json | null
          notify_system_alerts: boolean
          notify_task_assigned: boolean
          notify_zapp_messages: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          notify_mentions?: boolean
          notify_sectors?: Json | null
          notify_system_alerts?: boolean
          notify_task_assigned?: boolean
          notify_zapp_messages?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          notify_mentions?: boolean
          notify_sectors?: Json | null
          notify_system_alerts?: boolean
          notify_task_assigned?: boolean
          notify_zapp_messages?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_notification_preferences_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          account_id: string
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          identifier: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          identifier: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          identifier?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          account_id: string
          action_text: string
          client_id: string
          created_at: string
          id: string
          priority: Database["public"]["Enums"]["priority_level"]
          status: Database["public"]["Enums"]["recommendation_status"]
          title: string
        }
        Insert: {
          account_id: string
          action_text: string
          client_id: string
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["recommendation_status"]
          title: string
        }
        Update: {
          account_id?: string
          action_text?: string
          client_id?: string
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["recommendation_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "recommendations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_campaigns: {
        Row: {
          account_id: string
          auto_type: string | null
          campaign_type: Database["public"]["Enums"]["reminder_campaign_type"]
          completed_at: string | null
          created_at: string
          created_by: string | null
          delay_max_seconds: number
          delay_min_seconds: number
          email_subject: string | null
          event_id: string
          failed_count: number
          id: string
          message_template: string
          name: string
          responded_count: number
          scheduled_at: string | null
          scheduled_for: string | null
          send_email: boolean
          send_whatsapp: boolean
          sent_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["reminder_campaign_status"]
          total_recipients: number
          updated_at: string
        }
        Insert: {
          account_id: string
          auto_type?: string | null
          campaign_type?: Database["public"]["Enums"]["reminder_campaign_type"]
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delay_max_seconds?: number
          delay_min_seconds?: number
          email_subject?: string | null
          event_id: string
          failed_count?: number
          id?: string
          message_template: string
          name: string
          responded_count?: number
          scheduled_at?: string | null
          scheduled_for?: string | null
          send_email?: boolean
          send_whatsapp?: boolean
          sent_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["reminder_campaign_status"]
          total_recipients?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          auto_type?: string | null
          campaign_type?: Database["public"]["Enums"]["reminder_campaign_type"]
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delay_max_seconds?: number
          delay_min_seconds?: number
          email_subject?: string | null
          event_id?: string
          failed_count?: number
          id?: string
          message_template?: string
          name?: string
          responded_count?: number
          scheduled_at?: string | null
          scheduled_for?: string | null
          send_email?: boolean
          send_whatsapp?: boolean
          sent_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["reminder_campaign_status"]
          total_recipients?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_campaigns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_campaigns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_campaigns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_checkin_view"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_logs: {
        Row: {
          account_id: string
          channel: string
          client_id: string | null
          contract_id: string | null
          created_at: string
          error_message: string | null
          event_id: string | null
          id: string
          life_event_id: string | null
          reminder_id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          account_id: string
          channel: string
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          id?: string
          life_event_id?: string | null
          reminder_id: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          account_id?: string
          channel?: string
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          id?: string
          life_event_id?: string | null
          reminder_id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "reminder_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "client_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_checkin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_life_event_id_fkey"
            columns: ["life_event_id"]
            isOneToOne: false
            referencedRelation: "client_life_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_recipients: {
        Row: {
          account_id: string
          campaign_id: string
          client_id: string | null
          created_at: string
          email_error: string | null
          email_sent_at: string | null
          email_status: Database["public"]["Enums"]["reminder_recipient_status"]
          id: string
          participant_id: string | null
          recipient_email: string | null
          recipient_name: string
          recipient_phone: string | null
          responded_at: string | null
          response_data: Json | null
          send_order: number
          updated_at: string
          whatsapp_error: string | null
          whatsapp_sent_at: string | null
          whatsapp_status: Database["public"]["Enums"]["reminder_recipient_status"]
        }
        Insert: {
          account_id: string
          campaign_id: string
          client_id?: string | null
          created_at?: string
          email_error?: string | null
          email_sent_at?: string | null
          email_status?: Database["public"]["Enums"]["reminder_recipient_status"]
          id?: string
          participant_id?: string | null
          recipient_email?: string | null
          recipient_name: string
          recipient_phone?: string | null
          responded_at?: string | null
          response_data?: Json | null
          send_order?: number
          updated_at?: string
          whatsapp_error?: string | null
          whatsapp_sent_at?: string | null
          whatsapp_status?: Database["public"]["Enums"]["reminder_recipient_status"]
        }
        Update: {
          account_id?: string
          campaign_id?: string
          client_id?: string | null
          created_at?: string
          email_error?: string | null
          email_sent_at?: string | null
          email_status?: Database["public"]["Enums"]["reminder_recipient_status"]
          id?: string
          participant_id?: string | null
          recipient_email?: string | null
          recipient_name?: string
          recipient_phone?: string | null
          responded_at?: string | null
          response_data?: Json | null
          send_order?: number
          updated_at?: string
          whatsapp_error?: string | null
          whatsapp_sent_at?: string | null
          whatsapp_status?: Database["public"]["Enums"]["reminder_recipient_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reminder_recipients_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "reminder_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_recipients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "reminder_recipients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_recipients_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "event_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          account_id: string
          created_at: string
          days_before: number
          description: string | null
          email_subject: string | null
          email_template: string | null
          id: string
          is_active: boolean
          name: string
          reminder_type: string
          send_email: boolean
          send_notification: boolean
          send_whatsapp: boolean
          time_of_day: string
          updated_at: string
          whatsapp_template: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          days_before?: number
          description?: string | null
          email_subject?: string | null
          email_template?: string | null
          id?: string
          is_active?: boolean
          name: string
          reminder_type: string
          send_email?: boolean
          send_notification?: boolean
          send_whatsapp?: boolean
          time_of_day?: string
          updated_at?: string
          whatsapp_template?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          days_before?: number
          description?: string | null
          email_subject?: string | null
          email_template?: string | null
          id?: string
          is_active?: boolean
          name?: string
          reminder_type?: string
          send_email?: boolean
          send_notification?: boolean
          send_whatsapp?: boolean
          time_of_day?: string
          updated_at?: string
          whatsapp_template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      renewal_outcomes: {
        Row: {
          account_id: string
          client_id: string
          contract_id: string
          created_at: string
          id: string
          loss_notes: string | null
          loss_reason: string | null
          new_contract_id: string | null
          outcome: string
          renewal_value: number | null
          resolved_at: string | null
          resolved_by: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          client_id: string
          contract_id: string
          created_at?: string
          id?: string
          loss_notes?: string | null
          loss_reason?: string | null
          new_contract_id?: string | null
          outcome?: string
          renewal_value?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          client_id?: string
          contract_id?: string
          created_at?: string
          id?: string
          loss_notes?: string | null
          loss_reason?: string | null
          new_contract_id?: string | null
          outcome?: string
          renewal_value?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "renewal_outcomes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_outcomes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "renewal_outcomes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_outcomes_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "client_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_outcomes_new_contract_id_fkey"
            columns: ["new_contract_id"]
            isOneToOne: false
            referencedRelation: "client_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_outcomes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_events: {
        Row: {
          account_id: string
          client_id: string
          created_at: string
          evidence_snippet: string | null
          happened_at: string
          id: string
          image_url: string | null
          reason: string
          risk_level: Database["public"]["Enums"]["impact_level"]
          source: Database["public"]["Enums"]["risk_source"]
        }
        Insert: {
          account_id: string
          client_id: string
          created_at?: string
          evidence_snippet?: string | null
          happened_at: string
          id?: string
          image_url?: string | null
          reason: string
          risk_level?: Database["public"]["Enums"]["impact_level"]
          source: Database["public"]["Enums"]["risk_source"]
        }
        Update: {
          account_id?: string
          client_id?: string
          created_at?: string
          evidence_snippet?: string | null
          happened_at?: string
          id?: string
          image_url?: string | null
          reason?: string
          risk_level?: Database["public"]["Enums"]["impact_level"]
          source?: Database["public"]["Enums"]["risk_source"]
        }
        Relationships: [
          {
            foreignKeyName: "risk_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "risk_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      roi_events: {
        Row: {
          account_id: string
          category: Database["public"]["Enums"]["roi_category"]
          client_id: string
          created_at: string
          evidence_snippet: string | null
          happened_at: string
          id: string
          image_url: string | null
          impact: Database["public"]["Enums"]["impact_level"]
          roi_type: Database["public"]["Enums"]["roi_type"]
          source: Database["public"]["Enums"]["roi_source"]
        }
        Insert: {
          account_id: string
          category: Database["public"]["Enums"]["roi_category"]
          client_id: string
          created_at?: string
          evidence_snippet?: string | null
          happened_at: string
          id?: string
          image_url?: string | null
          impact?: Database["public"]["Enums"]["impact_level"]
          roi_type: Database["public"]["Enums"]["roi_type"]
          source: Database["public"]["Enums"]["roi_source"]
        }
        Update: {
          account_id?: string
          category?: Database["public"]["Enums"]["roi_category"]
          client_id?: string
          created_at?: string
          evidence_snippet?: string | null
          happened_at?: string
          id?: string
          image_url?: string | null
          impact?: Database["public"]["Enums"]["impact_level"]
          roi_type?: Database["public"]["Enums"]["roi_type"]
          source?: Database["public"]["Enums"]["roi_source"]
        }
        Relationships: [
          {
            foreignKeyName: "roi_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roi_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "roi_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "team_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roulette_prize_pools: {
        Row: {
          account_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roulette_prize_pools_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      roulette_prizes: {
        Row: {
          account_id: string
          cash_value: number
          color: string | null
          created_at: string
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          label: string
          pool_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          account_id: string
          cash_value?: number
          color?: string | null
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          label: string
          pool_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          account_id?: string
          cash_value?: number
          color?: string | null
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          label?: string
          pool_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "roulette_prizes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roulette_prizes_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "roulette_prize_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_call_analyses: {
        Row: {
          account_id: string
          ai_score: number | null
          analysis: string
          call_date: string | null
          call_outcome: string | null
          client_id: string | null
          created_at: string
          deal_id: string | null
          extracted_lead_name: string | null
          extracted_seller_name: string | null
          id: string
          outcome_notes: string | null
          product_id: string | null
          seller_user_id: string | null
          source_filename: string | null
          source_hash: string | null
          transcript_preview: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          ai_score?: number | null
          analysis: string
          call_date?: string | null
          call_outcome?: string | null
          client_id?: string | null
          created_at?: string
          deal_id?: string | null
          extracted_lead_name?: string | null
          extracted_seller_name?: string | null
          id?: string
          outcome_notes?: string | null
          product_id?: string | null
          seller_user_id?: string | null
          source_filename?: string | null
          source_hash?: string | null
          transcript_preview?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          ai_score?: number | null
          analysis?: string
          call_date?: string | null
          call_outcome?: string | null
          client_id?: string | null
          created_at?: string
          deal_id?: string | null
          extracted_lead_name?: string | null
          extracted_seller_name?: string | null
          id?: string
          outcome_notes?: string | null
          product_id?: string | null
          seller_user_id?: string | null
          source_filename?: string | null
          source_hash?: string | null
          transcript_preview?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_call_analyses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_call_analyses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "sales_call_analyses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_call_analyses_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_call_analyses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_call_analyses_seller_user_id_fkey"
            columns: ["seller_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_call_analyses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_goal_metrics: {
        Row: {
          account_id: string
          cargo: string
          created_at: string
          default_value: number
          display_order: number
          icon_name: string
          id: string
          is_currency: boolean
          metric_key: string
          metric_label: string
          metric_unit: string
        }
        Insert: {
          account_id: string
          cargo: string
          created_at?: string
          default_value?: number
          display_order?: number
          icon_name?: string
          id?: string
          is_currency?: boolean
          metric_key: string
          metric_label: string
          metric_unit?: string
        }
        Update: {
          account_id?: string
          cargo?: string
          created_at?: string
          default_value?: number
          display_order?: number
          icon_name?: string
          id?: string
          is_currency?: boolean
          metric_key?: string
          metric_label?: string
          metric_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_goal_metrics_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_goals: {
        Row: {
          account_id: string
          client_id: string
          created_at: string
          currency: string
          external_id: string | null
          goal_amount: number
          id: string
          period_end: string
          period_start: string
          updated_at: string
        }
        Insert: {
          account_id: string
          client_id: string
          created_at?: string
          currency?: string
          external_id?: string | null
          goal_amount?: number
          id?: string
          period_end: string
          period_start: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          client_id?: string
          created_at?: string
          currency?: string
          external_id?: string | null
          goal_amount?: number
          id?: string
          period_end?: string
          period_start?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_goals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "sales_goals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_history: {
        Row: {
          account_id: string
          address: string | null
          cep: string | null
          city: string | null
          client_name: string | null
          cnpj: string | null
          cpf: string | null
          created_at: string
          current_revenue: number | null
          email: string | null
          first_contact: string | null
          id: string
          notes: string | null
          origin: string | null
          payment_method: string | null
          payment_type: string | null
          phone: string | null
          product: string | null
          sale_date: string | null
          sale_value: number | null
          seller_name: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          address?: string | null
          cep?: string | null
          city?: string | null
          client_name?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          current_revenue?: number | null
          email?: string | null
          first_contact?: string | null
          id?: string
          notes?: string | null
          origin?: string | null
          payment_method?: string | null
          payment_type?: string | null
          phone?: string | null
          product?: string | null
          sale_date?: string | null
          sale_value?: number | null
          seller_name?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          address?: string | null
          cep?: string | null
          city?: string | null
          client_name?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          current_revenue?: number | null
          email?: string | null
          first_contact?: string | null
          id?: string
          notes?: string | null
          origin?: string | null
          payment_method?: string | null
          payment_type?: string | null
          phone?: string | null
          product?: string | null
          sale_date?: string | null
          sale_value?: number | null
          seller_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_history_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_incentive_plans: {
        Row: {
          account_id: string
          annual_bonus_enabled: boolean
          annual_bonus_payment_channel: string | null
          annual_bonus_rules: string | null
          annual_bonus_value: number
          bonus_base_value: number | null
          clawback_days: number
          clawback_enabled: boolean
          clawback_percent: number
          created_at: string
          description: string | null
          goal_value: number
          id: string
          is_active: boolean | null
          minimum_achievement_percent: number
          monthly_bonus_payment_channel: string | null
          name: string
          period_type: string
          position_id: string | null
          quarterly_bonus_enabled: boolean
          quarterly_bonus_payment_channel: string | null
          quarterly_bonus_rules: string | null
          quarterly_bonus_value: number
          quota_value: number
          uncapped_bonus_enabled: boolean
          uncapped_bonus_per_sale: number
          uncapped_bonus_type: string
          uncapped_threshold_percent: number
          updated_at: string
        }
        Insert: {
          account_id: string
          annual_bonus_enabled?: boolean
          annual_bonus_payment_channel?: string | null
          annual_bonus_rules?: string | null
          annual_bonus_value?: number
          bonus_base_value?: number | null
          clawback_days?: number
          clawback_enabled?: boolean
          clawback_percent?: number
          created_at?: string
          description?: string | null
          goal_value?: number
          id?: string
          is_active?: boolean | null
          minimum_achievement_percent?: number
          monthly_bonus_payment_channel?: string | null
          name: string
          period_type?: string
          position_id?: string | null
          quarterly_bonus_enabled?: boolean
          quarterly_bonus_payment_channel?: string | null
          quarterly_bonus_rules?: string | null
          quarterly_bonus_value?: number
          quota_value?: number
          uncapped_bonus_enabled?: boolean
          uncapped_bonus_per_sale?: number
          uncapped_bonus_type?: string
          uncapped_threshold_percent?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          annual_bonus_enabled?: boolean
          annual_bonus_payment_channel?: string | null
          annual_bonus_rules?: string | null
          annual_bonus_value?: number
          bonus_base_value?: number | null
          clawback_days?: number
          clawback_enabled?: boolean
          clawback_percent?: number
          created_at?: string
          description?: string | null
          goal_value?: number
          id?: string
          is_active?: boolean | null
          minimum_achievement_percent?: number
          monthly_bonus_payment_channel?: string | null
          name?: string
          period_type?: string
          position_id?: string | null
          quarterly_bonus_enabled?: boolean
          quarterly_bonus_payment_channel?: string | null
          quarterly_bonus_rules?: string | null
          quarterly_bonus_value?: number
          quota_value?: number
          uncapped_bonus_enabled?: boolean
          uncapped_bonus_per_sale?: number
          uncapped_bonus_type?: string
          uncapped_threshold_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_incentive_plans_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_incentive_plans_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "hr_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_incentive_product_rates: {
        Row: {
          commission_percent: number
          created_at: string
          fixed_amount: number | null
          id: string
          plan_id: string
          product_id: string | null
        }
        Insert: {
          commission_percent?: number
          created_at?: string
          fixed_amount?: number | null
          id?: string
          plan_id: string
          product_id?: string | null
        }
        Update: {
          commission_percent?: number
          created_at?: string
          fixed_amount?: number | null
          id?: string
          plan_id?: string
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_incentive_product_rates_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "sales_incentive_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_incentive_product_rates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_incentive_tiers: {
        Row: {
          bonus_multiplier: number
          created_at: string
          id: string
          label: string | null
          max_achievement_percent: number | null
          min_achievement_percent: number
          plan_id: string
        }
        Insert: {
          bonus_multiplier?: number
          created_at?: string
          id?: string
          label?: string | null
          max_achievement_percent?: number | null
          min_achievement_percent: number
          plan_id: string
        }
        Update: {
          bonus_multiplier?: number
          created_at?: string
          id?: string
          label?: string | null
          max_achievement_percent?: number | null
          min_achievement_percent?: number
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_incentive_tiers_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "sales_incentive_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_materials: {
        Row: {
          account_id: string
          content: string
          created_at: string
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          is_active: boolean
          material_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          content?: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_active?: boolean
          material_type: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          content?: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_active?: boolean
          material_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_materials_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_materials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_meetings: {
        Row: {
          account_id: string
          client_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          duration_minutes: number | null
          id: string
          lead_id: string | null
          meeting_type: string | null
          meeting_url: string | null
          notes: string | null
          responsible_user_id: string | null
          scheduled_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          duration_minutes?: number | null
          id?: string
          lead_id?: string | null
          meeting_type?: string | null
          meeting_url?: string | null
          notes?: string | null
          responsible_user_id?: string | null
          scheduled_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          duration_minutes?: number | null
          id?: string
          lead_id?: string | null
          meeting_type?: string | null
          meeting_url?: string | null
          notes?: string | null
          responsible_user_id?: string | null
          scheduled_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_meetings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_meetings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "sales_meetings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_meetings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_meetings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_meetings_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_monthly_goals: {
        Row: {
          account_id: string
          cargo: string
          created_at: string
          goal_type: string
          goal_value: number
          id: string
          notes: string | null
          super_goal_value: number | null
          updated_at: string
          user_id: string
          year_month: string
        }
        Insert: {
          account_id: string
          cargo?: string
          created_at?: string
          goal_type?: string
          goal_value?: number
          id?: string
          notes?: string | null
          super_goal_value?: number | null
          updated_at?: string
          user_id: string
          year_month: string
        }
        Update: {
          account_id?: string
          cargo?: string
          created_at?: string
          goal_type?: string
          goal_value?: number
          id?: string
          notes?: string | null
          super_goal_value?: number | null
          updated_at?: string
          user_id?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_monthly_goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_monthly_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_playbooks: {
        Row: {
          account_id: string
          content: string
          created_at: string
          generated_from: Json | null
          id: string
          is_favorite: boolean
          script_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          content: string
          created_at?: string
          generated_from?: Json | null
          id?: string
          is_favorite?: boolean
          script_type?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          content?: string
          created_at?: string
          generated_from?: Json | null
          id?: string
          is_favorite?: boolean
          script_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_playbooks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_playbooks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_product_goals: {
        Row: {
          account_id: string
          created_at: string
          id: string
          product_id: string
          target_quantity: number
          updated_at: string
          user_id: string
          year_month: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          product_id: string
          target_quantity?: number
          updated_at?: string
          user_id: string
          year_month: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          product_id?: string
          target_quantity?: number
          updated_at?: string
          user_id?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_product_goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_product_goals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_quotas: {
        Row: {
          account_id: string
          achieved_quantity: number | null
          achieved_value: number | null
          created_at: string
          id: string
          month: number
          notes: string | null
          product_id: string | null
          target_quantity: number | null
          target_value: number | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          account_id: string
          achieved_quantity?: number | null
          achieved_value?: number | null
          created_at?: string
          id?: string
          month: number
          notes?: string | null
          product_id?: string | null
          target_quantity?: number | null
          target_value?: number | null
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          account_id?: string
          achieved_quantity?: number | null
          achieved_value?: number | null
          created_at?: string
          id?: string
          month?: number
          notes?: string | null
          product_id?: string | null
          target_quantity?: number | null
          target_value?: number | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_quotas_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotas_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_records: {
        Row: {
          account_id: string
          amount: number
          client_id: string
          created_at: string
          currency: string
          description: string | null
          external_id: string | null
          id: string
          sale_date: string
        }
        Insert: {
          account_id: string
          amount?: number
          client_id: string
          created_at?: string
          currency?: string
          description?: string | null
          external_id?: string | null
          id?: string
          sale_date: string
        }
        Update: {
          account_id?: string
          amount?: number
          client_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          external_id?: string | null
          id?: string
          sale_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_records_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "sales_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_scripts: {
        Row: {
          account_id: string
          content: string
          created_at: string
          created_by: string | null
          funnel_stage: string | null
          id: string
          is_active: boolean
          objection_type: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          content: string
          created_at?: string
          created_by?: string | null
          funnel_stage?: string | null
          id?: string
          is_active?: boolean
          objection_type?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          funnel_stage?: string | null
          id?: string
          is_active?: boolean
          objection_type?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_scripts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_scripts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_spiffs: {
        Row: {
          account_id: string
          bonus_amount: number
          bonus_type: string
          created_at: string
          custom_prize_description: string | null
          description: string | null
          end_date: string
          id: string
          is_active: boolean
          name: string
          participant_user_ids: Json | null
          payment_tiers: Json | null
          plan_id: string | null
          prize_type: string
          product_id: string | null
          roulette_max_prize: number | null
          roulette_min_prize: number | null
          roulette_pool_id: string | null
          start_date: string
          target_quantity: number
          trigger_per_value: number | null
          trigger_sales_count: number
          trigger_week_start_day: number | null
          trigger_window_days: number
          trigger_window_type: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          bonus_amount?: number
          bonus_type?: string
          created_at?: string
          custom_prize_description?: string | null
          description?: string | null
          end_date?: string
          id?: string
          is_active?: boolean
          name: string
          participant_user_ids?: Json | null
          payment_tiers?: Json | null
          plan_id?: string | null
          prize_type?: string
          product_id?: string | null
          roulette_max_prize?: number | null
          roulette_min_prize?: number | null
          roulette_pool_id?: string | null
          start_date?: string
          target_quantity?: number
          trigger_per_value?: number | null
          trigger_sales_count?: number
          trigger_week_start_day?: number | null
          trigger_window_days?: number
          trigger_window_type?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          bonus_amount?: number
          bonus_type?: string
          created_at?: string
          custom_prize_description?: string | null
          description?: string | null
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          participant_user_ids?: Json | null
          payment_tiers?: Json | null
          plan_id?: string | null
          prize_type?: string
          product_id?: string | null
          roulette_max_prize?: number | null
          roulette_min_prize?: number | null
          roulette_pool_id?: string | null
          start_date?: string
          target_quantity?: number
          trigger_per_value?: number | null
          trigger_sales_count?: number
          trigger_week_start_day?: number | null
          trigger_window_days?: number
          trigger_window_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_spiffs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_spiffs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "sales_incentive_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_spiffs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_spiffs_roulette_pool_id_fkey"
            columns: ["roulette_pool_id"]
            isOneToOne: false
            referencedRelation: "roulette_prize_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_team_careers: {
        Row: {
          account_id: string
          area: string
          career_level_name: string
          cargo: string
          contract_type: string
          created_at: string
          fixed_salary: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          area?: string
          career_level_name?: string
          cargo?: string
          contract_type?: string
          created_at?: string
          fixed_salary?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          area?: string
          career_level_name?: string
          cargo?: string
          contract_type?: string
          created_at?: string
          fixed_salary?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_team_careers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_team_careers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_user_ote: {
        Row: {
          account_id: string
          base_salary_annual: number
          created_at: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
          variable_target_annual: number
          year: number
        }
        Insert: {
          account_id: string
          base_salary_annual?: number
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
          variable_target_annual?: number
          year: number
        }
        Update: {
          account_id?: string
          base_salary_annual?: number
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          variable_target_annual?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_user_ote_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      score_snapshots: {
        Row: {
          account_id: string
          client_id: string
          computed_at: string
          created_at: string
          escore: number
          id: string
          quadrant: Database["public"]["Enums"]["quadrant_type"]
          roizometer: number
          trend: Database["public"]["Enums"]["trend_type"]
        }
        Insert: {
          account_id: string
          client_id: string
          computed_at?: string
          created_at?: string
          escore?: number
          id?: string
          quadrant?: Database["public"]["Enums"]["quadrant_type"]
          roizometer?: number
          trend?: Database["public"]["Enums"]["trend_type"]
        }
        Update: {
          account_id?: string
          client_id?: string
          computed_at?: string
          created_at?: string
          escore?: number
          id?: string
          quadrant?: Database["public"]["Enums"]["quadrant_type"]
          roizometer?: number
          trend?: Database["public"]["Enums"]["trend_type"]
        }
        Relationships: [
          {
            foreignKeyName: "score_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "score_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_settings: {
        Row: {
          account_id: string
          created_at: string
          id: string
          pin_hash: string | null
          royzapp_admin_token_secret_name: string | null
          royzapp_enabled: boolean | null
          royzapp_host: string | null
          sector_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          pin_hash?: string | null
          royzapp_admin_token_secret_name?: string | null
          royzapp_enabled?: boolean | null
          royzapp_host?: string | null
          sector_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          pin_hash?: string | null
          royzapp_admin_token_secret_name?: string | null
          royzapp_enabled?: boolean | null
          royzapp_host?: string | null
          sector_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sector_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_logs: {
        Row: {
          account_id: string | null
          created_at: string
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_audit_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      spiff_spins: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          payment_notes: string | null
          payment_status: string
          prize_amount: number
          prize_id: string | null
          prize_label: string | null
          spiff_id: string
          spun_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_notes?: string | null
          payment_status?: string
          prize_amount?: number
          prize_id?: string | null
          prize_label?: string | null
          spiff_id: string
          spun_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_notes?: string | null
          payment_status?: string
          prize_amount?: number
          prize_id?: string | null
          prize_label?: string | null
          spiff_id?: string
          spun_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spiff_spins_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spiff_spins_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spiff_spins_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "roulette_prizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spiff_spins_spiff_id_fkey"
            columns: ["spiff_id"]
            isOneToOne: false
            referencedRelation: "sales_spiffs"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_checklist_items: {
        Row: {
          account_id: string
          action_type: string | null
          created_at: string
          description: string | null
          display_order: number
          due_date: string | null
          id: string
          is_active: boolean
          linked_task_id: string | null
          stage_id: string
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          action_type?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          due_date?: string | null
          id?: string
          is_active?: boolean
          linked_task_id?: string | null
          stage_id: string
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          action_type?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          due_date?: string | null
          id?: string
          is_active?: boolean
          linked_task_id?: string | null
          stage_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_checklist_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_checklist_items_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "internal_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_checklist_items_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "client_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          billing_period: string
          created_at: string
          description: string | null
          features: Json | null
          id: string
          is_active: boolean
          max_ai_analyses: number | null
          max_clients: number | null
          max_events: number | null
          max_forms: number | null
          max_products: number | null
          max_storage_mb: number | null
          max_users: number | null
          max_whatsapp_connections: number | null
          name: string
          plan_type: string
          price: number
          trial_days: number | null
          updated_at: string
        }
        Insert: {
          billing_period?: string
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          max_ai_analyses?: number | null
          max_clients?: number | null
          max_events?: number | null
          max_forms?: number | null
          max_products?: number | null
          max_storage_mb?: number | null
          max_users?: number | null
          max_whatsapp_connections?: number | null
          name: string
          plan_type?: string
          price?: number
          trial_days?: number | null
          updated_at?: string
        }
        Update: {
          billing_period?: string
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          max_ai_analyses?: number | null
          max_clients?: number | null
          max_events?: number | null
          max_forms?: number | null
          max_products?: number | null
          max_storage_mb?: number | null
          max_users?: number | null
          max_whatsapp_connections?: number | null
          name?: string
          plan_type?: string
          price?: number
          trial_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      super_admins: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          account_id: string
          bank_account: string | null
          bank_agency: string | null
          bank_name: string | null
          city: string | null
          complement: string | null
          contact_name: string | null
          created_at: string
          document: string | null
          document_type: string | null
          email: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          is_active: boolean
          name: string
          neighborhood: string | null
          notes: string | null
          phone: string | null
          pix_key: string | null
          state: string | null
          street: string | null
          street_number: string | null
          trade_name: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          account_id: string
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          city?: string | null
          complement?: string | null
          contact_name?: string | null
          created_at?: string
          document?: string | null
          document_type?: string | null
          email?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          is_active?: boolean
          name: string
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          pix_key?: string | null
          state?: string | null
          street?: string | null
          street_number?: string | null
          trade_name?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          account_id?: string
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          city?: string | null
          complement?: string | null
          contact_name?: string | null
          created_at?: string
          document?: string | null
          document_type?: string | null
          email?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          is_active?: boolean
          name?: string
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          pix_key?: string | null
          state?: string | null
          street?: string | null
          street_number?: string | null
          trade_name?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      support_knowledge_base: {
        Row: {
          category: string
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          keywords: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          content: string
          created_at: string
          external_message_id: string | null
          id: string
          message_type: string | null
          sender_id: string | null
          sender_type: string
          ticket_id: string
        }
        Insert: {
          content: string
          created_at?: string
          external_message_id?: string | null
          id?: string
          message_type?: string | null
          sender_id?: string | null
          sender_type: string
          ticket_id: string
        }
        Update: {
          content?: string
          created_at?: string
          external_message_id?: string | null
          id?: string
          message_type?: string | null
          sender_id?: string | null
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          account_id: string
          assigned_to: string | null
          avg_response_time_seconds: number | null
          client_name: string | null
          client_phone: string
          created_at: string
          escalated_at: string | null
          escalation_reason: string | null
          first_response_at: string | null
          id: string
          needs_human_attention: boolean | null
          priority: string | null
          resolved_at: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          assigned_to?: string | null
          avg_response_time_seconds?: number | null
          client_name?: string | null
          client_phone: string
          created_at?: string
          escalated_at?: string | null
          escalation_reason?: string | null
          first_response_at?: string | null
          id?: string
          needs_human_attention?: boolean | null
          priority?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          assigned_to?: string | null
          avg_response_time_seconds?: number | null
          client_name?: string | null
          client_phone?: string
          created_at?: string
          escalated_at?: string | null
          escalation_reason?: string | null
          first_response_at?: string | null
          id?: string
          needs_human_attention?: boolean | null
          priority?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      task_statuses: {
        Row: {
          account_id: string
          color: string
          created_at: string
          display_order: number
          icon: string
          id: string
          is_completed_status: boolean
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_id: string
          color?: string
          created_at?: string
          display_order?: number
          icon?: string
          id?: string
          is_completed_status?: boolean
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          color?: string
          created_at?: string
          display_order?: number
          icon?: string
          id?: string
          is_completed_status?: boolean
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_statuses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      team_insights_history: {
        Row: {
          account_id: string
          created_at: string
          generated_at: string
          id: string
          insights: Json
          member_name: string | null
          scope: string
        }
        Insert: {
          account_id: string
          created_at?: string
          generated_at?: string
          id?: string
          insights?: Json
          member_name?: string | null
          scope?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          generated_at?: string
          id?: string
          insights?: Json
          member_name?: string | null
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_insights_history_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      team_roles: {
        Row: {
          account_id: string
          area: string | null
          cargo: string | null
          color: string
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          is_system: boolean
          name: string
          seniority: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          area?: string | null
          cargo?: string | null
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_system?: boolean
          name: string
          seniority?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          area?: string | null
          cargo?: string | null
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_system?: boolean
          name?: string
          seniority?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_roles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      threecplus_agent_sessions: {
        Row: {
          account_id: string
          campaign_id: string | null
          campaign_name: string | null
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          pause_name: string | null
          session_type: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          account_id: string
          campaign_id?: string | null
          campaign_name?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          pause_name?: string | null
          session_type?: string
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          account_id?: string
          campaign_id?: string | null
          campaign_name?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          pause_name?: string | null
          session_type?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "threecplus_agent_sessions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threecplus_agent_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      threecplus_call_logs: {
        Row: {
          account_id: string
          acw_seconds: number | null
          call_id: string | null
          call_type: string
          campaign_id: string | null
          campaign_name: string | null
          client_id: string | null
          connected_at: string | null
          contact_name: string | null
          created_at: string
          deal_id: string | null
          direction: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          lead_id: string | null
          metadata: Json | null
          phone: string | null
          qualification: string | null
          qualification_name: string | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
          wait_seconds: number | null
        }
        Insert: {
          account_id: string
          acw_seconds?: number | null
          call_id?: string | null
          call_type?: string
          campaign_id?: string | null
          campaign_name?: string | null
          client_id?: string | null
          connected_at?: string | null
          contact_name?: string | null
          created_at?: string
          deal_id?: string | null
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          phone?: string | null
          qualification?: string | null
          qualification_name?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          wait_seconds?: number | null
        }
        Update: {
          account_id?: string
          acw_seconds?: number | null
          call_id?: string | null
          call_type?: string
          campaign_id?: string | null
          campaign_name?: string | null
          client_id?: string | null
          connected_at?: string | null
          contact_name?: string | null
          created_at?: string
          deal_id?: string | null
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          phone?: string | null
          qualification?: string | null
          qualification_name?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          wait_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "threecplus_call_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threecplus_call_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "threecplus_call_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threecplus_call_logs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threecplus_call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threecplus_call_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_credentials: {
        Row: {
          access_token: string | null
          account_id: string
          created_at: string
          id: string
          profile_id: string
          refresh_token: string | null
          scope: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          account_id: string
          created_at?: string
          id?: string
          profile_id: string
          refresh_token?: string | null
          scope?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          account_id?: string
          created_at?: string
          id?: string
          profile_id?: string
          refresh_token?: string | null
          scope?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_credentials_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiktok_credentials_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "tiktok_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_insights: {
        Row: {
          account_id: string
          created_at: string
          followers_count: number | null
          following_count: number | null
          id: string
          likes_count: number | null
          profile_id: string
          profile_views: number | null
          recorded_at: string
          videos_count: number | null
        }
        Insert: {
          account_id: string
          created_at?: string
          followers_count?: number | null
          following_count?: number | null
          id?: string
          likes_count?: number | null
          profile_id: string
          profile_views?: number | null
          recorded_at?: string
          videos_count?: number | null
        }
        Update: {
          account_id?: string
          created_at?: string
          followers_count?: number | null
          following_count?: number | null
          id?: string
          likes_count?: number | null
          profile_id?: string
          profile_views?: number | null
          recorded_at?: string
          videos_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_insights_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiktok_insights_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "tiktok_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_post_options: {
        Row: {
          account_id: string
          created_at: string
          display_order: number | null
          id: string
          option_type: string
          updated_at: string
          value: string
        }
        Insert: {
          account_id: string
          created_at?: string
          display_order?: number | null
          id?: string
          option_type: string
          updated_at?: string
          value: string
        }
        Update: {
          account_id?: string
          created_at?: string
          display_order?: number | null
          id?: string
          option_type?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_post_options_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_posts: {
        Row: {
          account_id: string
          ai_objective: string | null
          avg_watch_time: number | null
          caption: string | null
          category: string | null
          comments: number | null
          completion_rate: number | null
          created_at: string
          duration_seconds: number | null
          engagement_rate: number | null
          followers_gained: number | null
          hashtags: string[] | null
          id: string
          is_viral: boolean | null
          likes: number | null
          notes: string | null
          posted_at: string | null
          profile_id: string
          saves: number | null
          shares: number | null
          sound_name: string | null
          thumbnail_url: string | null
          tiktok_id: string | null
          updated_at: string
          video_url: string | null
          views: number | null
        }
        Insert: {
          account_id: string
          ai_objective?: string | null
          avg_watch_time?: number | null
          caption?: string | null
          category?: string | null
          comments?: number | null
          completion_rate?: number | null
          created_at?: string
          duration_seconds?: number | null
          engagement_rate?: number | null
          followers_gained?: number | null
          hashtags?: string[] | null
          id?: string
          is_viral?: boolean | null
          likes?: number | null
          notes?: string | null
          posted_at?: string | null
          profile_id: string
          saves?: number | null
          shares?: number | null
          sound_name?: string | null
          thumbnail_url?: string | null
          tiktok_id?: string | null
          updated_at?: string
          video_url?: string | null
          views?: number | null
        }
        Update: {
          account_id?: string
          ai_objective?: string | null
          avg_watch_time?: number | null
          caption?: string | null
          category?: string | null
          comments?: number | null
          completion_rate?: number | null
          created_at?: string
          duration_seconds?: number | null
          engagement_rate?: number | null
          followers_gained?: number | null
          hashtags?: string[] | null
          id?: string
          is_viral?: boolean | null
          likes?: number | null
          notes?: string | null
          posted_at?: string | null
          profile_id?: string
          saves?: number | null
          shares?: number | null
          sound_name?: string | null
          thumbnail_url?: string | null
          tiktok_id?: string | null
          updated_at?: string
          video_url?: string | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_posts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiktok_posts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "tiktok_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_profiles: {
        Row: {
          account_id: string
          bio: string | null
          created_at: string
          display_name: string | null
          followers_count: number | null
          followers_previous_count: number | null
          following_count: number | null
          id: string
          is_active: boolean | null
          last_synced_at: string | null
          likes_count: number | null
          profile_picture_url: string | null
          updated_at: string
          username: string
          videos_count: number | null
        }
        Insert: {
          account_id: string
          bio?: string | null
          created_at?: string
          display_name?: string | null
          followers_count?: number | null
          followers_previous_count?: number | null
          following_count?: number | null
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          likes_count?: number | null
          profile_picture_url?: string | null
          updated_at?: string
          username: string
          videos_count?: number | null
        }
        Update: {
          account_id?: string
          bio?: string | null
          created_at?: string
          display_name?: string | null
          followers_count?: number | null
          followers_previous_count?: number | null
          following_count?: number | null
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          likes_count?: number | null
          profile_picture_url?: string | null
          updated_at?: string
          username?: string
          videos_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_instance_preferences: {
        Row: {
          account_id: string
          created_at: string | null
          id: string
          integration_id: string
          sector_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string | null
          id?: string
          integration_id: string
          sector_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string | null
          id?: string
          integration_id?: string
          sector_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_instance_preferences_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_instance_preferences_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_integrations: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: number | null
          id: string
          metadata: Json | null
          provider: string
          refresh_token: string | null
          updated_at: string | null
          user_email: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at?: number | null
          id?: string
          metadata?: Json | null
          provider: string
          refresh_token?: string | null
          updated_at?: string | null
          user_email?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: number | null
          id?: string
          metadata?: Json | null
          provider?: string
          refresh_token?: string | null
          updated_at?: string | null
          user_email?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_meta_selected_accounts: {
        Row: {
          ad_account_id: string
          ad_account_name: string | null
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          ad_account_id: string
          ad_account_name?: string | null
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          ad_account_id?: string
          ad_account_name?: string | null
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_meta_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          meta_user_id: string | null
          meta_user_name: string | null
          scopes: string[] | null
          token_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          meta_user_id?: string | null
          meta_user_name?: string | null
          scopes?: string[] | null
          token_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          meta_user_id?: string | null
          meta_user_name?: string | null
          scopes?: string[] | null
          token_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sector_access: {
        Row: {
          account_id: string
          created_at: string
          id: string
          is_active: boolean
          role_in_sector: string
          sector_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          role_in_sector?: string
          sector_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          role_in_sector?: string
          sector_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sector_access_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sector_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          account_id: string
          city: string | null
          country: string | null
          created_at: string
          device_fingerprint: string | null
          expires_at: string
          id: string
          ip_address: string | null
          is_trusted: boolean
          last_active_at: string
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          city?: string | null
          country?: string | null
          created_at?: string
          device_fingerprint?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          is_trusted?: boolean
          last_active_at?: string
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          city?: string | null
          country?: string | null
          created_at?: string
          device_fingerprint?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          is_trusted?: boolean
          last_active_at?: string
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_team_roles: {
        Row: {
          created_at: string
          id: string
          team_role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          team_role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          team_role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_team_roles_team_role_id_fkey"
            columns: ["team_role_id"]
            isOneToOne: false
            referencedRelation: "team_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_team_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          account_id: string
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          email: string
          force_relogin_at: string | null
          id: string
          is_active: boolean
          is_also_admin: boolean
          meeting_email_advance: string | null
          meeting_email_template: string | null
          meeting_platform: string | null
          name: string
          role: Database["public"]["Enums"]["user_role"]
          team_role_id: string | null
          zapp_signature: string | null
          zapp_signature_enabled: boolean | null
        }
        Insert: {
          account_id: string
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          force_relogin_at?: string | null
          id?: string
          is_active?: boolean
          is_also_admin?: boolean
          meeting_email_advance?: string | null
          meeting_email_template?: string | null
          meeting_platform?: string | null
          name: string
          role?: Database["public"]["Enums"]["user_role"]
          team_role_id?: string | null
          zapp_signature?: string | null
          zapp_signature_enabled?: boolean | null
        }
        Update: {
          account_id?: string
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          force_relogin_at?: string | null
          id?: string
          is_active?: boolean
          is_also_admin?: boolean
          meeting_email_advance?: string | null
          meeting_email_template?: string | null
          meeting_platform?: string | null
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          team_role_id?: string | null
          zapp_signature?: string | null
          zapp_signature_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "users_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_team_role_id_fkey"
            columns: ["team_role_id"]
            isOneToOne: false
            referencedRelation: "team_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      vapid_keys: {
        Row: {
          created_at: string
          id: string
          private_key: string
          public_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          private_key: string
          public_key: string
        }
        Update: {
          created_at?: string
          id?: string
          private_key?: string
          public_key?: string
        }
        Relationships: []
      }
      video_call_sessions: {
        Row: {
          account_id: string
          analysis: string | null
          analysis_status: string | null
          client_id: string | null
          created_at: string
          daily_room_name: string
          daily_room_url: string
          deal_id: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          lead_id: string | null
          notes: string | null
          participant_name: string | null
          participant_phone: string | null
          recording_id: string | null
          recording_url: string | null
          scheduled_at: string | null
          started_at: string | null
          status: string
          transcription: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          analysis?: string | null
          analysis_status?: string | null
          client_id?: string | null
          created_at?: string
          daily_room_name: string
          daily_room_url: string
          deal_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          participant_name?: string | null
          participant_phone?: string | null
          recording_id?: string | null
          recording_url?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          transcription?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          analysis?: string | null
          analysis_status?: string | null
          client_id?: string | null
          created_at?: string
          daily_room_name?: string
          daily_room_url?: string
          deal_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          participant_name?: string | null
          participant_phone?: string | null
          recording_id?: string | null
          recording_url?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          transcription?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_call_sessions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_call_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "video_call_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_call_sessions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_call_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_call_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      vip_criteria: {
        Row: {
          account_id: string
          created_at: string
          min_ltv_months: number
          min_received: number
          product_ids: string[]
          top_n: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          min_ltv_months?: number
          min_received?: number
          product_ids?: string[]
          top_n?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          min_ltv_months?: number
          min_received?: number
          product_ids?: string[]
          top_n?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      vnps_snapshots: {
        Row: {
          account_id: string
          client_id: string
          computed_at: string
          created_at: string
          eligible_for_nps_ask: boolean
          escore: number
          explanation: string | null
          id: string
          risk_index: number
          roizometer: number
          trend: Database["public"]["Enums"]["trend_type"]
          vnps_class: Database["public"]["Enums"]["vnps_class"]
          vnps_score: number
        }
        Insert: {
          account_id: string
          client_id: string
          computed_at?: string
          created_at?: string
          eligible_for_nps_ask?: boolean
          escore?: number
          explanation?: string | null
          id?: string
          risk_index?: number
          roizometer?: number
          trend?: Database["public"]["Enums"]["trend_type"]
          vnps_class?: Database["public"]["Enums"]["vnps_class"]
          vnps_score?: number
        }
        Update: {
          account_id?: string
          client_id?: string
          computed_at?: string
          created_at?: string
          eligible_for_nps_ask?: boolean
          escore?: number
          explanation?: string | null
          id?: string
          risk_index?: number
          roizometer?: number
          trend?: Database["public"]["Enums"]["trend_type"]
          vnps_class?: Database["public"]["Enums"]["vnps_class"]
          vnps_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "vnps_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vnps_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "vnps_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          account_id: string
          created_at: string | null
          description: string | null
          headers: Json | null
          id: string
          is_active: boolean | null
          last_status_code: number | null
          last_triggered_at: string | null
          method: string
          name: string
          payload_template: Json | null
          secret_key: string | null
          trigger_event: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          account_id: string
          created_at?: string | null
          description?: string | null
          headers?: Json | null
          id?: string
          is_active?: boolean | null
          last_status_code?: number | null
          last_triggered_at?: string | null
          method?: string
          name: string
          payload_template?: Json | null
          secret_key?: string | null
          trigger_event?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          account_id?: string
          created_at?: string | null
          description?: string | null
          headers?: Json | null
          id?: string
          is_active?: boolean | null
          last_status_code?: number | null
          last_triggered_at?: string | null
          method?: string
          name?: string
          payload_template?: Json | null
          secret_key?: string | null
          trigger_event?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_group_participants: {
        Row: {
          account_id: string
          created_at: string | null
          group_jid: string
          id: string
          is_admin: boolean | null
          name: string | null
          phone: string
          synced_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          group_jid: string
          id?: string
          is_admin?: boolean | null
          name?: string | null
          phone: string
          synced_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          group_jid?: string
          id?: string
          is_admin?: boolean | null
          name?: string | null
          phone?: string
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_group_participants_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_groups: {
        Row: {
          account_id: string
          ai_analysis_enabled: boolean
          created_at: string
          description: string | null
          group_jid: string
          id: string
          last_sentiment_check: string | null
          name: string
          owner_phone: string | null
          participant_count: number | null
          sentiment: string | null
          sentiment_reason: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          ai_analysis_enabled?: boolean
          created_at?: string
          description?: string | null
          group_jid: string
          id?: string
          last_sentiment_check?: string | null
          name: string
          owner_phone?: string | null
          participant_count?: number | null
          sentiment?: string | null
          sentiment_reason?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          ai_analysis_enabled?: boolean
          created_at?: string
          description?: string | null
          group_jid?: string
          id?: string
          last_sentiment_check?: string | null
          name?: string
          owner_phone?: string | null
          participant_count?: number | null
          sentiment?: string | null
          sentiment_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_groups_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_channels: {
        Row: {
          account_id: string
          bio: string | null
          channel_id: string | null
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean | null
          last_synced_at: string | null
          profile_picture_url: string | null
          subscribers_count: number | null
          subscribers_previous_count: number | null
          total_views: number | null
          updated_at: string
          username: string
          videos_count: number | null
        }
        Insert: {
          account_id: string
          bio?: string | null
          channel_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          profile_picture_url?: string | null
          subscribers_count?: number | null
          subscribers_previous_count?: number | null
          total_views?: number | null
          updated_at?: string
          username: string
          videos_count?: number | null
        }
        Update: {
          account_id?: string
          bio?: string | null
          channel_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          profile_picture_url?: string | null
          subscribers_count?: number | null
          subscribers_previous_count?: number | null
          total_views?: number | null
          updated_at?: string
          username?: string
          videos_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "youtube_channels_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_videos: {
        Row: {
          account_id: string
          ai_objective: string | null
          avg_watch_time: number | null
          caption: string | null
          category: string | null
          channel_id: string
          comments: number | null
          completion_rate: number | null
          created_at: string
          dislikes: number | null
          duration_seconds: number | null
          engagement_rate: number | null
          followers_gained: number | null
          hashtags: string[] | null
          id: string
          is_viral: boolean | null
          likes: number | null
          notes: string | null
          posted_at: string | null
          saves: number | null
          shares: number | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          video_type: string | null
          video_url: string | null
          views: number | null
          youtube_id: string | null
        }
        Insert: {
          account_id: string
          ai_objective?: string | null
          avg_watch_time?: number | null
          caption?: string | null
          category?: string | null
          channel_id: string
          comments?: number | null
          completion_rate?: number | null
          created_at?: string
          dislikes?: number | null
          duration_seconds?: number | null
          engagement_rate?: number | null
          followers_gained?: number | null
          hashtags?: string[] | null
          id?: string
          is_viral?: boolean | null
          likes?: number | null
          notes?: string | null
          posted_at?: string | null
          saves?: number | null
          shares?: number | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          video_type?: string | null
          video_url?: string | null
          views?: number | null
          youtube_id?: string | null
        }
        Update: {
          account_id?: string
          ai_objective?: string | null
          avg_watch_time?: number | null
          caption?: string | null
          category?: string | null
          channel_id?: string
          comments?: number | null
          completion_rate?: number | null
          created_at?: string
          dislikes?: number | null
          duration_seconds?: number | null
          engagement_rate?: number | null
          followers_gained?: number | null
          hashtags?: string[] | null
          id?: string
          is_viral?: boolean | null
          likes?: number | null
          notes?: string | null
          posted_at?: string | null
          saves?: number | null
          shares?: number | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          video_type?: string | null
          video_url?: string | null
          views?: number | null
          youtube_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "youtube_videos_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_videos_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "youtube_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      zapp_agents: {
        Row: {
          account_id: string
          created_at: string
          current_chats: number
          department_id: string | null
          id: string
          is_active: boolean
          is_online: boolean
          last_activity_at: string | null
          max_concurrent_chats: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          current_chats?: number
          department_id?: string | null
          id?: string
          is_active?: boolean
          is_online?: boolean
          last_activity_at?: string | null
          max_concurrent_chats?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          current_chats?: number
          department_id?: string | null
          id?: string
          is_active?: boolean
          is_online?: boolean
          last_activity_at?: string | null
          max_concurrent_chats?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapp_agents_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_agents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "zapp_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_agents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      zapp_call_settings: {
        Row: {
          account_id: string
          auto_log_timeline: boolean | null
          config: Json | null
          created_at: string | null
          id: string
          is_enabled: boolean | null
          provider: string
          record_calls: boolean | null
          sector_id: string
          transcribe_calls: boolean | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          auto_log_timeline?: boolean | null
          config?: Json | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          provider?: string
          record_calls?: boolean | null
          sector_id: string
          transcribe_calls?: boolean | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          auto_log_timeline?: boolean | null
          config?: Json | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          provider?: string
          record_calls?: boolean | null
          sector_id?: string
          transcribe_calls?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zapp_call_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      zapp_calls: {
        Row: {
          account_id: string
          agent_id: string | null
          agent_name: string | null
          answered_at: string | null
          client_id: string | null
          contact_name: string | null
          created_at: string | null
          deal_id: string | null
          direction: string
          duration_seconds: number | null
          ended_at: string | null
          external_call_id: string | null
          id: string
          lead_id: string | null
          notes: string | null
          outcome: string | null
          phone_e164: string
          provider: string
          recording_duration_seconds: number | null
          recording_url: string | null
          sector_id: string
          started_at: string | null
          status: string
          transcription: string | null
          transcription_summary: string | null
          updated_at: string | null
          user_id: string | null
          zapp_conversation_id: string | null
        }
        Insert: {
          account_id: string
          agent_id?: string | null
          agent_name?: string | null
          answered_at?: string | null
          client_id?: string | null
          contact_name?: string | null
          created_at?: string | null
          deal_id?: string | null
          direction: string
          duration_seconds?: number | null
          ended_at?: string | null
          external_call_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          outcome?: string | null
          phone_e164: string
          provider?: string
          recording_duration_seconds?: number | null
          recording_url?: string | null
          sector_id: string
          started_at?: string | null
          status?: string
          transcription?: string | null
          transcription_summary?: string | null
          updated_at?: string | null
          user_id?: string | null
          zapp_conversation_id?: string | null
        }
        Update: {
          account_id?: string
          agent_id?: string | null
          agent_name?: string | null
          answered_at?: string | null
          client_id?: string | null
          contact_name?: string | null
          created_at?: string | null
          deal_id?: string | null
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          external_call_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          outcome?: string | null
          phone_e164?: string
          provider?: string
          recording_duration_seconds?: number | null
          recording_url?: string | null
          sector_id?: string
          started_at?: string | null
          status?: string
          transcription?: string | null
          transcription_summary?: string | null
          updated_at?: string | null
          user_id?: string | null
          zapp_conversation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zapp_calls_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_calls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "zapp_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_calls_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "zapp_calls_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_calls_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_calls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_calls_zapp_conversation_id_fkey"
            columns: ["zapp_conversation_id"]
            isOneToOne: false
            referencedRelation: "zapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      zapp_client_suggestions: {
        Row: {
          account_id: string
          created_at: string | null
          id: string
          match_details: Json | null
          match_score: number | null
          match_type: string
          status: string | null
          suggested_client_id: string
          updated_at: string | null
          zapp_conversation_id: string
        }
        Insert: {
          account_id: string
          created_at?: string | null
          id?: string
          match_details?: Json | null
          match_score?: number | null
          match_type: string
          status?: string | null
          suggested_client_id: string
          updated_at?: string | null
          zapp_conversation_id: string
        }
        Update: {
          account_id?: string
          created_at?: string | null
          id?: string
          match_details?: Json | null
          match_score?: number | null
          match_type?: string
          status?: string | null
          suggested_client_id?: string
          updated_at?: string | null
          zapp_conversation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapp_client_suggestions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_client_suggestions_suggested_client_id_fkey"
            columns: ["suggested_client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "zapp_client_suggestions_suggested_client_id_fkey"
            columns: ["suggested_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_client_suggestions_zapp_conversation_id_fkey"
            columns: ["zapp_conversation_id"]
            isOneToOne: false
            referencedRelation: "zapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      zapp_conversation_assignments: {
        Row: {
          account_id: string
          agent_id: string | null
          assigned_at: string | null
          close_ai_summary: string | null
          close_notes: string | null
          close_outcome: string | null
          close_summary: string | null
          closed_at: string | null
          closed_by: string | null
          conversation_id: string | null
          created_at: string
          department_id: string | null
          first_message_at: string | null
          first_response_at: string | null
          id: string
          last_client_message_at: string | null
          priority: number
          service_duration_minutes: number | null
          status: Database["public"]["Enums"]["zapp_assignment_status"]
          updated_at: string
          zapp_conversation_id: string | null
        }
        Insert: {
          account_id: string
          agent_id?: string | null
          assigned_at?: string | null
          close_ai_summary?: string | null
          close_notes?: string | null
          close_outcome?: string | null
          close_summary?: string | null
          closed_at?: string | null
          closed_by?: string | null
          conversation_id?: string | null
          created_at?: string
          department_id?: string | null
          first_message_at?: string | null
          first_response_at?: string | null
          id?: string
          last_client_message_at?: string | null
          priority?: number
          service_duration_minutes?: number | null
          status?: Database["public"]["Enums"]["zapp_assignment_status"]
          updated_at?: string
          zapp_conversation_id?: string | null
        }
        Update: {
          account_id?: string
          agent_id?: string | null
          assigned_at?: string | null
          close_ai_summary?: string | null
          close_notes?: string | null
          close_outcome?: string | null
          close_summary?: string | null
          closed_at?: string | null
          closed_by?: string | null
          conversation_id?: string | null
          created_at?: string
          department_id?: string | null
          first_message_at?: string | null
          first_response_at?: string | null
          id?: string
          last_client_message_at?: string | null
          priority?: number
          service_duration_minutes?: number | null
          status?: Database["public"]["Enums"]["zapp_assignment_status"]
          updated_at?: string
          zapp_conversation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zapp_conversation_assignments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_conversation_assignments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "zapp_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_conversation_assignments_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_conversation_assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_conversation_assignments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "zapp_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_conversation_assignments_zapp_conversation_id_fkey"
            columns: ["zapp_conversation_id"]
            isOneToOne: false
            referencedRelation: "zapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      zapp_conversation_tags: {
        Row: {
          account_id: string
          assignment_id: string
          created_at: string
          created_by: string | null
          id: string
          tag_id: string
        }
        Insert: {
          account_id: string
          assignment_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          tag_id: string
        }
        Update: {
          account_id?: string
          assignment_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapp_conversation_tags_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_conversation_tags_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "zapp_conversation_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_conversation_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_conversation_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "zapp_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      zapp_conversations: {
        Row: {
          account_id: string
          archived_at: string | null
          avatar_url: string | null
          channel: string
          client_id: string | null
          contact_name: string | null
          created_at: string
          deal_id: string | null
          external_thread_id: string | null
          group_jid: string | null
          id: string
          integration_id: string | null
          is_archived: boolean
          is_blocked: boolean
          is_favorite: boolean
          is_group: boolean
          is_muted: boolean
          is_pinned: boolean
          last_message_at: string | null
          last_message_preview: string | null
          lead_id: string | null
          muted_until: string | null
          phone_e164: string
          pinned_at: string | null
          sector_id: string | null
          unread_count: number | null
          updated_at: string
        }
        Insert: {
          account_id: string
          archived_at?: string | null
          avatar_url?: string | null
          channel?: string
          client_id?: string | null
          contact_name?: string | null
          created_at?: string
          deal_id?: string | null
          external_thread_id?: string | null
          group_jid?: string | null
          id?: string
          integration_id?: string | null
          is_archived?: boolean
          is_blocked?: boolean
          is_favorite?: boolean
          is_group?: boolean
          is_muted?: boolean
          is_pinned?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          muted_until?: string | null
          phone_e164: string
          pinned_at?: string | null
          sector_id?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          archived_at?: string | null
          avatar_url?: string | null
          channel?: string
          client_id?: string | null
          contact_name?: string | null
          created_at?: string
          deal_id?: string | null
          external_thread_id?: string | null
          group_jid?: string | null
          id?: string
          integration_id?: string | null
          is_archived?: boolean
          is_blocked?: boolean
          is_favorite?: boolean
          is_group?: boolean
          is_muted?: boolean
          is_pinned?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          muted_until?: string | null
          phone_e164?: string
          pinned_at?: string | null
          sector_id?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapp_conversations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "zapp_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_conversations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_conversations_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      zapp_departments: {
        Row: {
          account_id: string
          auto_distribution: boolean
          color: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          sector_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          auto_distribution?: boolean
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          sector_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          auto_distribution?: boolean
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          sector_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapp_departments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      zapp_messages: {
        Row: {
          account_id: string
          audio_duration_sec: number | null
          content: string | null
          created_at: string
          deleted_at: string | null
          delivery_status: string | null
          direction: string
          external_message_id: string | null
          id: string
          is_deleted: boolean | null
          is_edited: boolean | null
          media_download_status: string | null
          media_encrypted_url: string | null
          media_filename: string | null
          media_key: string | null
          media_mimetype: string | null
          media_type: string | null
          media_url: string | null
          mention_map: Json | null
          message_type: string | null
          quoted_content: string | null
          quoted_message_id: string | null
          quoted_sender_name: string | null
          sender_name: string | null
          sender_phone: string | null
          sent_at: string
          synced_from_history: boolean | null
          transcription: string | null
          updated_at: string | null
          zapp_conversation_id: string
        }
        Insert: {
          account_id: string
          audio_duration_sec?: number | null
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          delivery_status?: string | null
          direction: string
          external_message_id?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          media_download_status?: string | null
          media_encrypted_url?: string | null
          media_filename?: string | null
          media_key?: string | null
          media_mimetype?: string | null
          media_type?: string | null
          media_url?: string | null
          mention_map?: Json | null
          message_type?: string | null
          quoted_content?: string | null
          quoted_message_id?: string | null
          quoted_sender_name?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sent_at?: string
          synced_from_history?: boolean | null
          transcription?: string | null
          updated_at?: string | null
          zapp_conversation_id: string
        }
        Update: {
          account_id?: string
          audio_duration_sec?: number | null
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          delivery_status?: string | null
          direction?: string
          external_message_id?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          media_download_status?: string | null
          media_encrypted_url?: string | null
          media_filename?: string | null
          media_key?: string | null
          media_mimetype?: string | null
          media_type?: string | null
          media_url?: string | null
          mention_map?: Json | null
          message_type?: string | null
          quoted_content?: string | null
          quoted_message_id?: string | null
          quoted_sender_name?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sent_at?: string
          synced_from_history?: boolean | null
          transcription?: string | null
          updated_at?: string | null
          zapp_conversation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapp_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_messages_zapp_conversation_id_fkey"
            columns: ["zapp_conversation_id"]
            isOneToOne: false
            referencedRelation: "zapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      zapp_tags: {
        Row: {
          account_id: string
          color: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_id: string
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapp_tags_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      zapp_transfers: {
        Row: {
          account_id: string
          conversation_id: string
          created_at: string
          from_agent_id: string | null
          from_department_id: string | null
          id: string
          reason: string | null
          to_agent_id: string | null
          to_department_id: string | null
          transferred_at: string
          transferred_by: string
        }
        Insert: {
          account_id: string
          conversation_id: string
          created_at?: string
          from_agent_id?: string | null
          from_department_id?: string | null
          id?: string
          reason?: string | null
          to_agent_id?: string | null
          to_department_id?: string | null
          transferred_at?: string
          transferred_by: string
        }
        Update: {
          account_id?: string
          conversation_id?: string
          created_at?: string
          from_agent_id?: string | null
          from_department_id?: string | null
          id?: string
          reason?: string | null
          to_agent_id?: string | null
          to_department_id?: string | null
          transferred_at?: string
          transferred_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapp_transfers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_transfers_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_transfers_from_agent_id_fkey"
            columns: ["from_agent_id"]
            isOneToOne: false
            referencedRelation: "zapp_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_transfers_from_department_id_fkey"
            columns: ["from_department_id"]
            isOneToOne: false
            referencedRelation: "zapp_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_transfers_to_agent_id_fkey"
            columns: ["to_agent_id"]
            isOneToOne: false
            referencedRelation: "zapp_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_transfers_to_department_id_fkey"
            columns: ["to_department_id"]
            isOneToOne: false
            referencedRelation: "zapp_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapp_transfers_transferred_by_fkey"
            columns: ["transferred_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      zapsign_documents: {
        Row: {
          account_id: string
          client_id: string | null
          contract_id: string | null
          created_at: string
          external_id: string | null
          id: string
          name: string
          original_file_url: string | null
          signed_at: string | null
          signed_file_url: string | null
          signers: Json | null
          status: string
          updated_at: string
          zapsign_doc_token: string
          zapsign_template_id: string | null
        }
        Insert: {
          account_id: string
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          name: string
          original_file_url?: string | null
          signed_at?: string | null
          signed_file_url?: string | null
          signers?: Json | null
          status?: string
          updated_at?: string
          zapsign_doc_token: string
          zapsign_template_id?: string | null
        }
        Update: {
          account_id?: string
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          name?: string
          original_file_url?: string | null
          signed_at?: string | null
          signed_file_url?: string | null
          signers?: Json | null
          status?: string
          updated_at?: string
          zapsign_doc_token?: string
          zapsign_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zapsign_documents_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapsign_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_latest_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "zapsign_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapsign_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "client_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      client_latest_metrics: {
        Row: {
          account_id: string | null
          client_id: string | null
          contract: Json | null
          has_conversation: boolean | null
          message_count: number | null
          score: Json | null
          vnps: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      events_checkin_view: {
        Row: {
          account_id: string | null
          address: string | null
          id: string | null
          modality: Database["public"]["Enums"]["event_modality"] | null
          scheduled_at: string | null
          title: string | null
        }
        Insert: {
          account_id?: string | null
          address?: string | null
          id?: string | null
          modality?: Database["public"]["Enums"]["event_modality"] | null
          scheduled_at?: string | null
          title?: string | null
        }
        Update: {
          account_id?: string | null
          address?: string | null
          id?: string | null
          modality?: Database["public"]["Enums"]["event_modality"] | null
          scheduled_at?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_scheduled_contracts: { Args: never; Returns: number }
      admin_link_user_to_account: {
        Args: {
          p_email?: string
          p_name?: string
          p_role?: string
          target_account_id: string
          target_auth_user_id: string
        }
        Returns: string
      }
      admin_list_user_memberships: {
        Args: { target_auth_user_id: string }
        Returns: {
          account_id: string
          account_name: string
          is_active: boolean
          role: string
          user_id: string
        }[]
      }
      can_access_consultant_bonus: { Args: never; Returns: boolean }
      can_manage_spiff_payments: {
        Args: { _auth_user_id: string }
        Returns: boolean
      }
      check_force_relogin: {
        Args: { p_session_issued_at: string }
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          p_action: string
          p_identifier: string
          p_max_requests: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      cleanup_ai_analysis_queue: { Args: never; Returns: undefined }
      cleanup_old_login_attempts: { Args: never; Returns: undefined }
      cleanup_old_rate_limit_logs: { Args: never; Returns: undefined }
      compute_consultant_metric: {
        Args: {
          p_metric: string
          p_month: number
          p_product_id: string
          p_user_id: string
          p_year: number
        }
        Returns: number
      }
      convert_lead_to_client: { Args: { p_lead_id: string }; Returns: string }
      delete_account_cascade: { Args: { p_account_id: string }; Returns: Json }
      format_call_duration: { Args: { seconds: number }; Returns: string }
      generate_checkin_code: { Args: never; Returns: string }
      generate_registration_code: { Args: never; Returns: string }
      get_account_limits: { Args: never; Returns: Json }
      get_ai_queue_stats: { Args: never; Returns: Json }
      get_avg_won_to_onboarding_days: {
        Args: { p_account_id: string; p_months_back?: number }
        Returns: {
          avg_days: number
          max_days: number
          median_days: number
          min_days: number
          sample_count: number
        }[]
      }
      get_budget_vs_actual: {
        Args: { p_account_id: string; p_month?: number; p_year: number }
        Returns: {
          actual_amount: number
          budget_type: string
          category_id: string
          category_name: string
          cost_center_id: string
          cost_center_name: string
          planned_amount: number
          variance: number
          variance_percent: number
        }[]
      }
      get_client_profitability: {
        Args: {
          p_account_id: string
          p_end_date?: string
          p_start_date?: string
        }
        Returns: {
          client_id: string
          client_name: string
          entries_count: number
          margin: number
          profit: number
          total_costs: number
          total_revenue: number
        }[]
      }
      get_clients_without_contracts: {
        Args: { p_account_id: string }
        Returns: {
          client_id: string
        }[]
      }
      get_current_user_account_id: { Args: never; Returns: string }
      get_current_user_id: { Args: never; Returns: string }
      get_dashboard_contract_counts: {
        Args: { p_account_id: string }
        Returns: Json
      }
      get_dre_report: {
        Args: { p_account_id: string; p_end_date: string; p_start_date: string }
        Returns: {
          category_id: string
          category_name: string
          category_type: string
          display_order: number
          total_amount: number
        }[]
      }
      get_event_by_registration_code: {
        Args: { p_code: string }
        Returns: {
          account_id: string
          current_confirmed: number
          event_address: string
          event_description: string
          event_ends_at: string
          event_id: string
          event_modality: string
          event_scheduled_at: string
          event_title: string
          has_capacity: boolean
          max_capacity: number
          rsvp_form_fields: Json
        }[]
      }
      get_event_for_checkin: {
        Args: { p_checkin_code: string }
        Returns: {
          account_id: string
          address: string
          id: string
          modality: Database["public"]["Enums"]["event_modality"]
          scheduled_at: string
          title: string
        }[]
      }
      get_latest_recommendations_for_clients: {
        Args: { p_client_ids: string[] }
        Returns: {
          action_text: string
          client_id: string
        }[]
      }
      get_latest_risks_for_clients: {
        Args: { p_client_ids: string[] }
        Returns: {
          client_id: string
          reason: string
        }[]
      }
      get_latest_scores_for_clients: {
        Args: { p_client_ids: string[] }
        Returns: {
          client_id: string
          escore: number
          quadrant: string
          roizometer: number
          trend: string
        }[]
      }
      get_latest_vnps_for_clients: {
        Args: { p_client_ids: string[] }
        Returns: {
          client_id: string
          vnps_class: string
          vnps_score: number
        }[]
      }
      get_my_account_id: { Args: never; Returns: string }
      get_my_user_accounts: {
        Args: never
        Returns: {
          account_id: string
          account_name: string
          is_active: boolean
          is_super_admin: boolean
          role: string
          user_id: string
        }[]
      }
      get_participant_by_rsvp_token: {
        Args: { p_token: string }
        Returns: {
          client_name: string
          event_address: string
          event_description: string
          event_ends_at: string
          event_id: string
          event_meeting_url: string
          event_modality: string
          event_rsvp_closed: boolean
          event_rsvp_closure_message: string
          event_rsvp_deadline: string
          event_scheduled_at: string
          event_title: string
          guest_name: string
          participant_id: string
          rsvp_responded_at: string
          rsvp_status: string
        }[]
      }
      get_recurring_templates: {
        Args: { p_account_id: string }
        Returns: {
          amount: number
          category_name: string
          client_name: string
          description: string
          entry_type: string
          id: string
          next_due_date: string
          recurrence_end_date: string
          recurrence_type: string
          total_generated: number
        }[]
      }
      get_related_clients: {
        Args: { p_client_id: string }
        Returns: {
          client_id: string
          is_primary: boolean
          relationship_label: string
          relationship_type: Database["public"]["Enums"]["client_relationship_type"]
        }[]
      }
      get_synced_client_ids: {
        Args: { p_client_id: string }
        Returns: string[]
      }
      get_user_account_id: { Args: never; Returns: string }
      immutable_unaccent: { Args: { "": string }; Returns: string }
      increment_template_usage: {
        Args: { template_id: string }
        Returns: undefined
      }
      initialize_ai_agent_functions: {
        Args: { p_account_id: string }
        Returns: undefined
      }
      is_account_locked: { Args: { p_email: string }; Returns: boolean }
      is_account_owner: { Args: { _user_id?: string }; Returns: boolean }
      is_chat_participant: {
        Args: { p_chat_id: string; p_user_id: string }
        Returns: boolean
      }
      is_new_device: {
        Args: { p_device_fingerprint: string; p_user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id?: string }; Returns: boolean }
      next_digital_contract_number: {
        Args: { p_account_id: string }
        Returns: string
      }
      normalize_stage_name: { Args: { p_name: string }; Returns: string }
      process_recurring_entries: { Args: never; Returns: number }
      recalculate_consultant_bonus_payouts: {
        Args: { p_year?: number }
        Returns: {
          processed: number
          target_year: number
        }[]
      }
      record_login_attempt: {
        Args: {
          p_email: string
          p_ip_address: string
          p_success: boolean
          p_user_agent: string
        }
        Returns: undefined
      }
      record_rate_limit_hit: {
        Args: { p_action: string; p_identifier: string }
        Returns: undefined
      }
      refresh_client_latest_metrics: { Args: never; Returns: undefined }
      register_for_event: {
        Args: {
          p_code: string
          p_custom_fields?: Json
          p_email?: string
          p_name: string
          p_phone: string
          p_rg?: string
        }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      submit_rsvp_response: {
        Args: { p_status: string; p_token: string }
        Returns: Json
      }
      unaccent: { Args: { "": string }; Returns: string }
      unaccent_immutable: { Args: { p_text: string }; Returns: string }
      use_coupon: {
        Args: {
          p_account_id: string
          p_client_id?: string
          p_contract_id?: string
          p_coupon_id: string
          p_discount_applied?: number
          p_final_value?: number
          p_original_value?: number
        }
        Returns: boolean
      }
      user_belongs_to_account: {
        Args: { _account_id: string }
        Returns: boolean
      }
      user_is_chat_member: { Args: { p_chat_id: string }; Returns: boolean }
      validate_coupon: {
        Args: {
          p_account_id: string
          p_code: string
          p_product_id?: string
          p_value: number
        }
        Returns: Json
      }
    }
    Enums: {
      billing_period:
        | "monthly"
        | "quarterly"
        | "semiannual"
        | "annual"
        | "one_time"
      channel_type: "whatsapp"
      client_relationship_type:
        | "spouse"
        | "partner"
        | "dependent"
        | "associate"
        | "other"
        | "referral"
      client_status:
        | "active"
        | "paused"
        | "churn_risk"
        | "churned"
        | "no_contract"
      delivery_status: "pending" | "delivered" | "missed"
      discount_type: "percentage" | "fixed"
      event_category: "operation" | "marketing"
      event_checklist_status: "pending" | "in_progress" | "done" | "cancelled"
      event_cost_category:
        | "venue"
        | "catering"
        | "equipment"
        | "marketing"
        | "travel"
        | "accommodation"
        | "speakers"
        | "gifts"
        | "staff"
        | "technology"
        | "insurance"
        | "other"
      event_cost_status: "estimated" | "approved" | "paid" | "cancelled"
      event_gift_status: "planned" | "purchased" | "in_stock" | "distributed"
      event_media_type: "photo" | "video" | "document" | "other"
      event_modality: "online" | "presencial"
      event_rsvp_status:
        | "pending"
        | "confirmed"
        | "declined"
        | "waitlist"
        | "attended"
        | "no_show"
      event_team_role:
        | "organizer"
        | "coordinator"
        | "support"
        | "speaker"
        | "host"
        | "photographer"
        | "other"
        | "mentor"
      event_type:
        | "live"
        | "material"
        | "mentoria"
        | "workshop"
        | "masterclass"
        | "webinar"
        | "imersao"
        | "plantao"
        | "launch"
        | "campaign"
        | "content"
        | "partnership"
        | "fair"
        | "other"
        | "movimento"
        | "viagem"
        | "autoridade"
      hr_ai_analysis_status: "pending" | "processing" | "completed" | "failed"
      hr_candidate_stage:
        | "applied"
        | "screening"
        | "interview"
        | "technical_test"
        | "offer"
        | "hired"
        | "rejected"
      hr_job_status: "draft" | "active" | "on_hold" | "closed"
      impact_level: "low" | "medium" | "high"
      integration_status: "connected" | "disconnected"
      integration_type:
        | "zoom"
        | "google"
        | "clinica_ryka"
        | "pipedrive"
        | "whatsapp"
        | "liberty"
        | "ryka"
        | "omie"
        | "openai"
        | "evolution"
        | "3cplus"
      interaction_type:
        | "chat"
        | "qna"
        | "hand_raise"
        | "reaction"
        | "speaking_estimate"
      live_platform: "zoom" | "google_meet"
      marketing_ai_decision: "accepted" | "edited" | "rejected"
      marketing_task_priority: "low" | "medium" | "high"
      marketing_task_status: "pending" | "in_progress" | "done"
      message_direction: "client_to_team" | "team_to_client"
      message_source: "whatsapp_text" | "whatsapp_audio_transcript"
      payment_status:
        | "active"
        | "overdue"
        | "cancelled"
        | "trial"
        | "paused"
        | "pending"
      priority_level: "low" | "medium" | "high"
      quadrant_type:
        | "highE_lowROI"
        | "lowE_highROI"
        | "lowE_lowROI"
        | "highE_highROI"
      recommendation_status: "open" | "done" | "dismissed"
      reminder_campaign_status:
        | "draft"
        | "scheduled"
        | "sending"
        | "completed"
        | "cancelled"
      reminder_campaign_type: "notice" | "rsvp" | "checkin" | "feedback"
      reminder_recipient_status:
        | "pending"
        | "queued"
        | "sending"
        | "sent"
        | "failed"
        | "responded"
      risk_source:
        | "whatsapp_text"
        | "whatsapp_audio"
        | "zoom"
        | "google_meet"
        | "system"
        | "financial"
        | "event_no_show"
      roi_category:
        | "revenue"
        | "cost"
        | "time"
        | "process"
        | "clarity"
        | "confidence"
        | "tranquility"
        | "status_direction"
      roi_source:
        | "whatsapp_text"
        | "whatsapp_audio"
        | "zoom"
        | "google_meet"
        | "manual"
        | "financial"
        | "event_rsvp"
        | "event_attendance"
      roi_type: "tangible" | "intangible"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "pending" | "in_progress" | "done" | "overdue" | "cancelled"
      trend_type: "up" | "flat" | "down"
      user_role:
        | "admin"
        | "leader"
        | "mentor"
        | "cx"
        | "cs"
        | "consultor"
        | "head"
        | "gestor"
        | "viewer"
        | "member"
        | "super_admin"
      vnps_class: "detractor" | "neutral" | "promoter"
      zapp_agent_role: "admin" | "supervisor" | "agent"
      zapp_assignment_status:
        | "pending"
        | "active"
        | "waiting"
        | "closed"
        | "triage"
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
      billing_period: [
        "monthly",
        "quarterly",
        "semiannual",
        "annual",
        "one_time",
      ],
      channel_type: ["whatsapp"],
      client_relationship_type: [
        "spouse",
        "partner",
        "dependent",
        "associate",
        "other",
        "referral",
      ],
      client_status: [
        "active",
        "paused",
        "churn_risk",
        "churned",
        "no_contract",
      ],
      delivery_status: ["pending", "delivered", "missed"],
      discount_type: ["percentage", "fixed"],
      event_category: ["operation", "marketing"],
      event_checklist_status: ["pending", "in_progress", "done", "cancelled"],
      event_cost_category: [
        "venue",
        "catering",
        "equipment",
        "marketing",
        "travel",
        "accommodation",
        "speakers",
        "gifts",
        "staff",
        "technology",
        "insurance",
        "other",
      ],
      event_cost_status: ["estimated", "approved", "paid", "cancelled"],
      event_gift_status: ["planned", "purchased", "in_stock", "distributed"],
      event_media_type: ["photo", "video", "document", "other"],
      event_modality: ["online", "presencial"],
      event_rsvp_status: [
        "pending",
        "confirmed",
        "declined",
        "waitlist",
        "attended",
        "no_show",
      ],
      event_team_role: [
        "organizer",
        "coordinator",
        "support",
        "speaker",
        "host",
        "photographer",
        "other",
        "mentor",
      ],
      event_type: [
        "live",
        "material",
        "mentoria",
        "workshop",
        "masterclass",
        "webinar",
        "imersao",
        "plantao",
        "launch",
        "campaign",
        "content",
        "partnership",
        "fair",
        "other",
        "movimento",
        "viagem",
        "autoridade",
      ],
      hr_ai_analysis_status: ["pending", "processing", "completed", "failed"],
      hr_candidate_stage: [
        "applied",
        "screening",
        "interview",
        "technical_test",
        "offer",
        "hired",
        "rejected",
      ],
      hr_job_status: ["draft", "active", "on_hold", "closed"],
      impact_level: ["low", "medium", "high"],
      integration_status: ["connected", "disconnected"],
      integration_type: [
        "zoom",
        "google",
        "clinica_ryka",
        "pipedrive",
        "whatsapp",
        "liberty",
        "ryka",
        "omie",
        "openai",
        "evolution",
        "3cplus",
      ],
      interaction_type: [
        "chat",
        "qna",
        "hand_raise",
        "reaction",
        "speaking_estimate",
      ],
      live_platform: ["zoom", "google_meet"],
      marketing_ai_decision: ["accepted", "edited", "rejected"],
      marketing_task_priority: ["low", "medium", "high"],
      marketing_task_status: ["pending", "in_progress", "done"],
      message_direction: ["client_to_team", "team_to_client"],
      message_source: ["whatsapp_text", "whatsapp_audio_transcript"],
      payment_status: [
        "active",
        "overdue",
        "cancelled",
        "trial",
        "paused",
        "pending",
      ],
      priority_level: ["low", "medium", "high"],
      quadrant_type: [
        "highE_lowROI",
        "lowE_highROI",
        "lowE_lowROI",
        "highE_highROI",
      ],
      recommendation_status: ["open", "done", "dismissed"],
      reminder_campaign_status: [
        "draft",
        "scheduled",
        "sending",
        "completed",
        "cancelled",
      ],
      reminder_campaign_type: ["notice", "rsvp", "checkin", "feedback"],
      reminder_recipient_status: [
        "pending",
        "queued",
        "sending",
        "sent",
        "failed",
        "responded",
      ],
      risk_source: [
        "whatsapp_text",
        "whatsapp_audio",
        "zoom",
        "google_meet",
        "system",
        "financial",
        "event_no_show",
      ],
      roi_category: [
        "revenue",
        "cost",
        "time",
        "process",
        "clarity",
        "confidence",
        "tranquility",
        "status_direction",
      ],
      roi_source: [
        "whatsapp_text",
        "whatsapp_audio",
        "zoom",
        "google_meet",
        "manual",
        "financial",
        "event_rsvp",
        "event_attendance",
      ],
      roi_type: ["tangible", "intangible"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["pending", "in_progress", "done", "overdue", "cancelled"],
      trend_type: ["up", "flat", "down"],
      user_role: [
        "admin",
        "leader",
        "mentor",
        "cx",
        "cs",
        "consultor",
        "head",
        "gestor",
        "viewer",
        "member",
        "super_admin",
      ],
      vnps_class: ["detractor", "neutral", "promoter"],
      zapp_agent_role: ["admin", "supervisor", "agent"],
      zapp_assignment_status: [
        "pending",
        "active",
        "waiting",
        "closed",
        "triage",
      ],
    },
  },
} as const

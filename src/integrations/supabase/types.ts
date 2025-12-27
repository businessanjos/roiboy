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
          max_attempts: number
          message_id: string
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
          max_attempts?: number
          message_id: string
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
          max_attempts?: number
          message_id?: string
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
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analysis_queue_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "zapp_messages"
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
      client_contracts: {
        Row: {
          account_id: string
          client_id: string
          contract_type: string
          created_at: string
          currency: string
          end_date: string | null
          file_name: string | null
          file_url: string | null
          id: string
          notes: string | null
          parent_contract_id: string | null
          payment_option: string | null
          product_id: string | null
          start_date: string
          status: string
          status_changed_at: string | null
          status_reason: string | null
          updated_at: string
          value: number
        }
        Insert: {
          account_id: string
          client_id: string
          contract_type?: string
          created_at?: string
          currency?: string
          end_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          parent_contract_id?: string | null
          payment_option?: string | null
          product_id?: string | null
          start_date: string
          status?: string
          status_changed_at?: string | null
          status_reason?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          account_id?: string
          client_id?: string
          contract_type?: string
          created_at?: string
          currency?: string
          end_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          parent_contract_id?: string | null
          payment_option?: string | null
          product_id?: string | null
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
            referencedRelation: "clients"
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
      client_life_events: {
        Row: {
          account_id: string
          client_id: string
          created_at: string
          description: string | null
          event_date: string | null
          event_type: string
          id: string
          is_recurring: boolean
          reminder_days_before: number | null
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
          is_recurring?: boolean
          reminder_days_before?: number | null
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
          is_recurring?: boolean
          reminder_days_before?: number | null
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
            referencedRelation: "clients"
            referencedColumns: ["id"]
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
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_id: string
          additional_phones: Json | null
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          business_city: string | null
          business_complement: string | null
          business_neighborhood: string | null
          business_state: string | null
          business_street: string | null
          business_street_number: string | null
          business_zip_code: string | null
          city: string | null
          cnpj: string | null
          company_name: string | null
          complement: string | null
          contract_end_date: string | null
          contract_start_date: string | null
          cpf: string | null
          created_at: string
          emails: Json | null
          full_name: string
          id: string
          instagram: string | null
          is_mls: boolean
          logo_url: string | null
          mls_level: string | null
          neighborhood: string | null
          notes: string | null
          phone_e164: string
          responsible_user_id: string | null
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
          additional_phones?: Json | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          business_city?: string | null
          business_complement?: string | null
          business_neighborhood?: string | null
          business_state?: string | null
          business_street?: string | null
          business_street_number?: string | null
          business_zip_code?: string | null
          city?: string | null
          cnpj?: string | null
          company_name?: string | null
          complement?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          cpf?: string | null
          created_at?: string
          emails?: Json | null
          full_name: string
          id?: string
          instagram?: string | null
          is_mls?: boolean
          logo_url?: string | null
          mls_level?: string | null
          neighborhood?: string | null
          notes?: string | null
          phone_e164: string
          responsible_user_id?: string | null
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
          additional_phones?: Json | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          business_city?: string | null
          business_complement?: string | null
          business_neighborhood?: string | null
          business_state?: string | null
          business_street?: string | null
          business_street_number?: string | null
          business_zip_code?: string | null
          city?: string | null
          cnpj?: string | null
          company_name?: string | null
          complement?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          cpf?: string | null
          created_at?: string
          emails?: Json | null
          full_name?: string
          id?: string
          instagram?: string | null
          is_mls?: boolean
          logo_url?: string | null
          mls_level?: string | null
          neighborhood?: string | null
          notes?: string | null
          phone_e164?: string
          responsible_user_id?: string | null
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
            foreignKeyName: "clients_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "client_stages"
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
            referencedRelation: "clients"
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
      custom_fields: {
        Row: {
          account_id: string
          created_at: string
          display_order: number | null
          field_type: string
          id: string
          is_active: boolean | null
          is_required: boolean | null
          name: string
          options: Json | null
          show_in_clients: boolean
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          display_order?: number | null
          field_type: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          name: string
          options?: Json | null
          show_in_clients?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          display_order?: number | null
          field_type?: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          name?: string
          options?: Json | null
          show_in_clients?: boolean
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
          event_id: string
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
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
          event_id: string
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
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
          event_id?: string
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
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
          budget: number | null
          checkin_code: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          ends_at: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          expected_attendees: number | null
          id: string
          is_recurring: boolean
          material_url: string | null
          max_capacity: number | null
          meeting_url: string | null
          modality: Database["public"]["Enums"]["event_modality"]
          public_registration_code: string | null
          scheduled_at: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          address?: string | null
          budget?: number | null
          checkin_code?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          ends_at?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          expected_attendees?: number | null
          id?: string
          is_recurring?: boolean
          material_url?: string | null
          max_capacity?: number | null
          meeting_url?: string | null
          modality?: Database["public"]["Enums"]["event_modality"]
          public_registration_code?: string | null
          scheduled_at?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          address?: string | null
          budget?: number | null
          checkin_code?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          ends_at?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          expected_attendees?: number | null
          id?: string
          is_recurring?: boolean
          material_url?: string | null
          max_capacity?: number | null
          meeting_url?: string | null
          modality?: Database["public"]["Enums"]["event_modality"]
          public_registration_code?: string | null
          scheduled_at?: string | null
          status?: string | null
          title?: string
          updated_at?: string
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
      form_responses: {
        Row: {
          account_id: string
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          form_id: string
          id: string
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
        ]
      }
      forms: {
        Row: {
          account_id: string
          created_at: string
          description: string | null
          fields: Json
          id: string
          is_active: boolean
          require_client_info: boolean
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          require_client_info?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          require_client_info?: boolean
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
      integrations: {
        Row: {
          account_id: string
          config: Json | null
          created_at: string
          id: string
          status: Database["public"]["Enums"]["integration_status"]
          type: Database["public"]["Enums"]["integration_type"]
        }
        Insert: {
          account_id: string
          config?: Json | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["integration_status"]
          type: Database["public"]["Enums"]["integration_type"]
        }
        Update: {
          account_id?: string
          config?: Json | null
          created_at?: string
          id?: string
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
      internal_tasks: {
        Row: {
          account_id: string
          assigned_to: string | null
          checklist_item_id: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          custom_status_id: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          assigned_to?: string | null
          checklist_item_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          custom_status_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          assigned_to?: string | null
          checklist_item_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          custom_status_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
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
      notifications: {
        Row: {
          account_id: string
          content: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
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
      products: {
        Row: {
          account_id: string
          billing_period: Database["public"]["Enums"]["billing_period"]
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_mls: boolean
          mls_level: string | null
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          account_id: string
          billing_period?: Database["public"]["Enums"]["billing_period"]
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_mls?: boolean
          mls_level?: string | null
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          billing_period?: Database["public"]["Enums"]["billing_period"]
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_mls?: boolean
          mls_level?: string | null
          name?: string
          price?: number
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
            referencedRelation: "clients"
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
            referencedRelation: "clients"
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
            referencedRelation: "clients"
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
      team_roles: {
        Row: {
          account_id: string
          color: string
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_id: string
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_system?: boolean
          name?: string
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
      users: {
        Row: {
          account_id: string
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          is_also_admin: boolean
          name: string
          role: Database["public"]["Enums"]["user_role"]
          team_role_id: string | null
        }
        Insert: {
          account_id: string
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          is_also_admin?: boolean
          name: string
          role?: Database["public"]["Enums"]["user_role"]
          team_role_id?: string | null
        }
        Update: {
          account_id?: string
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          is_also_admin?: boolean
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          team_role_id?: string | null
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
            referencedRelation: "clients"
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
      zapp_conversation_assignments: {
        Row: {
          account_id: string
          agent_id: string | null
          assigned_at: string | null
          closed_at: string | null
          closed_by: string | null
          conversation_id: string | null
          created_at: string
          department_id: string | null
          first_response_at: string | null
          id: string
          priority: number
          status: Database["public"]["Enums"]["zapp_assignment_status"]
          updated_at: string
          zapp_conversation_id: string | null
        }
        Insert: {
          account_id: string
          agent_id?: string | null
          assigned_at?: string | null
          closed_at?: string | null
          closed_by?: string | null
          conversation_id?: string | null
          created_at?: string
          department_id?: string | null
          first_response_at?: string | null
          id?: string
          priority?: number
          status?: Database["public"]["Enums"]["zapp_assignment_status"]
          updated_at?: string
          zapp_conversation_id?: string | null
        }
        Update: {
          account_id?: string
          agent_id?: string | null
          assigned_at?: string | null
          closed_at?: string | null
          closed_by?: string | null
          conversation_id?: string | null
          created_at?: string
          department_id?: string | null
          first_response_at?: string | null
          id?: string
          priority?: number
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
          external_thread_id: string | null
          group_jid: string | null
          id: string
          is_archived: boolean
          is_blocked: boolean
          is_favorite: boolean
          is_group: boolean
          is_muted: boolean
          is_pinned: boolean
          last_message_at: string | null
          last_message_preview: string | null
          muted_until: string | null
          phone_e164: string
          pinned_at: string | null
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
          external_thread_id?: string | null
          group_jid?: string | null
          id?: string
          is_archived?: boolean
          is_blocked?: boolean
          is_favorite?: boolean
          is_group?: boolean
          is_muted?: boolean
          is_pinned?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          muted_until?: string | null
          phone_e164: string
          pinned_at?: string | null
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
          external_thread_id?: string | null
          group_jid?: string | null
          id?: string
          is_archived?: boolean
          is_blocked?: boolean
          is_favorite?: boolean
          is_group?: boolean
          is_muted?: boolean
          is_pinned?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          muted_until?: string | null
          phone_e164?: string
          pinned_at?: string | null
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
            referencedRelation: "clients"
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
          delivery_status: string | null
          direction: string
          external_message_id: string | null
          id: string
          media_download_status: string | null
          media_encrypted_url: string | null
          media_filename: string | null
          media_key: string | null
          media_mimetype: string | null
          media_type: string | null
          media_url: string | null
          message_type: string | null
          sender_name: string | null
          sender_phone: string | null
          sent_at: string
          zapp_conversation_id: string
        }
        Insert: {
          account_id: string
          audio_duration_sec?: number | null
          content?: string | null
          created_at?: string
          delivery_status?: string | null
          direction: string
          external_message_id?: string | null
          id?: string
          media_download_status?: string | null
          media_encrypted_url?: string | null
          media_filename?: string | null
          media_key?: string | null
          media_mimetype?: string | null
          media_type?: string | null
          media_url?: string | null
          message_type?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sent_at?: string
          zapp_conversation_id: string
        }
        Update: {
          account_id?: string
          audio_duration_sec?: number | null
          content?: string | null
          created_at?: string
          delivery_status?: string | null
          direction?: string
          external_message_id?: string | null
          id?: string
          media_download_status?: string | null
          media_encrypted_url?: string | null
          media_filename?: string | null
          media_key?: string | null
          media_mimetype?: string | null
          media_type?: string | null
          media_url?: string | null
          message_type?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sent_at?: string
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
      generate_checkin_code: { Args: never; Returns: string }
      generate_registration_code: { Args: never; Returns: string }
      get_account_limits: { Args: never; Returns: Json }
      get_ai_queue_stats: { Args: never; Returns: Json }
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
          event_scheduled_at: string
          event_title: string
          guest_name: string
          participant_id: string
          rsvp_responded_at: string
          rsvp_status: string
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
      get_user_account_id: { Args: never; Returns: string }
      initialize_ai_agent_functions: {
        Args: { p_account_id: string }
        Returns: undefined
      }
      is_account_locked: { Args: { p_email: string }; Returns: boolean }
      is_account_owner: { Args: { _user_id?: string }; Returns: boolean }
      is_new_device: {
        Args: { p_device_fingerprint: string; p_user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id?: string }; Returns: boolean }
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
      register_for_event: {
        Args: {
          p_code: string
          p_email?: string
          p_name: string
          p_phone: string
        }
        Returns: Json
      }
      submit_rsvp_response: {
        Args: { p_status: string; p_token: string }
        Returns: Json
      }
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
      interaction_type:
        | "chat"
        | "qna"
        | "hand_raise"
        | "reaction"
        | "speaking_estimate"
      live_platform: "zoom" | "google_meet"
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
      ],
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
      ],
      interaction_type: [
        "chat",
        "qna",
        "hand_raise",
        "reaction",
        "speaking_estimate",
      ],
      live_platform: ["zoom", "google_meet"],
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

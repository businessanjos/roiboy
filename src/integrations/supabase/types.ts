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
          is_mls: boolean
          logo_url: string | null
          mls_level: string | null
          neighborhood: string | null
          notes: string | null
          phone_e164: string
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
          is_mls?: boolean
          logo_url?: string | null
          mls_level?: string | null
          neighborhood?: string | null
          notes?: string | null
          phone_e164: string
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
          is_mls?: boolean
          logo_url?: string | null
          mls_level?: string | null
          neighborhood?: string | null
          notes?: string | null
          phone_e164?: string
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
            foreignKeyName: "event_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          account_id: string
          address: string | null
          checkin_code: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          is_recurring: boolean
          material_url: string | null
          meeting_url: string | null
          modality: Database["public"]["Enums"]["event_modality"]
          scheduled_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          address?: string | null
          checkin_code?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          is_recurring?: boolean
          material_url?: string | null
          meeting_url?: string | null
          modality?: Database["public"]["Enums"]["event_modality"]
          scheduled_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          address?: string | null
          checkin_code?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          is_recurring?: boolean
          material_url?: string | null
          meeting_url?: string | null
          modality?: Database["public"]["Enums"]["event_modality"]
          scheduled_at?: string | null
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
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
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
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
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
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
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
      users: {
        Row: {
          account_id: string
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          email: string
          id: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_checkin_code: { Args: never; Returns: string }
      get_account_limits: { Args: never; Returns: Json }
      get_user_account_id: { Args: never; Returns: string }
      is_account_owner: { Args: { _user_id?: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id?: string }; Returns: boolean }
    }
    Enums: {
      billing_period:
        | "monthly"
        | "quarterly"
        | "semiannual"
        | "annual"
        | "one_time"
      channel_type: "whatsapp"
      client_status: "active" | "paused" | "churn_risk" | "churned"
      delivery_status: "pending" | "delivered" | "missed"
      event_modality: "online" | "presencial"
      event_type: "live" | "material"
      impact_level: "low" | "medium" | "high"
      integration_status: "connected" | "disconnected"
      integration_type: "zoom" | "google" | "clinica_ryka" | "pipedrive"
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
      client_status: ["active", "paused", "churn_risk", "churned"],
      delivery_status: ["pending", "delivered", "missed"],
      event_modality: ["online", "presencial"],
      event_type: ["live", "material"],
      impact_level: ["low", "medium", "high"],
      integration_status: ["connected", "disconnected"],
      integration_type: ["zoom", "google", "clinica_ryka", "pipedrive"],
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
    },
  },
} as const

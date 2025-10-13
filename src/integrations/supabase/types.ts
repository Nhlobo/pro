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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      aod_documents: {
        Row: {
          attorney_id: string
          contract_end_date: string | null
          contract_start_date: string | null
          created_at: string
          deposit_amount: number | null
          document_url: string
          file_name: string
          id: string
          interest_rate_1_3_months: number | null
          interest_rate_12_months: number | null
          interest_rate_18_months: number | null
          interest_rate_24_months: number | null
          interest_rate_6_months: number | null
          last_payment_date: string | null
          law_firm_id: string
          next_payment_date: string | null
          notes: string | null
          payment_due_date: string | null
          payment_plan_structure: string | null
          payment_status: string | null
          payments_made: number | null
          total_contract_value: number | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          attorney_id: string
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          deposit_amount?: number | null
          document_url: string
          file_name: string
          id?: string
          interest_rate_1_3_months?: number | null
          interest_rate_12_months?: number | null
          interest_rate_18_months?: number | null
          interest_rate_24_months?: number | null
          interest_rate_6_months?: number | null
          last_payment_date?: string | null
          law_firm_id: string
          next_payment_date?: string | null
          notes?: string | null
          payment_due_date?: string | null
          payment_plan_structure?: string | null
          payment_status?: string | null
          payments_made?: number | null
          total_contract_value?: number | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          attorney_id?: string
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          deposit_amount?: number | null
          document_url?: string
          file_name?: string
          id?: string
          interest_rate_1_3_months?: number | null
          interest_rate_12_months?: number | null
          interest_rate_18_months?: number | null
          interest_rate_24_months?: number | null
          interest_rate_6_months?: number | null
          last_payment_date?: string | null
          law_firm_id?: string
          next_payment_date?: string | null
          notes?: string | null
          payment_due_date?: string | null
          payment_plan_structure?: string | null
          payment_status?: string | null
          payments_made?: number | null
          total_contract_value?: number | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "aod_documents_attorney_id_fkey"
            columns: ["attorney_id"]
            isOneToOne: false
            referencedRelation: "attorneys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aod_documents_law_firm_id_fkey"
            columns: ["law_firm_id"]
            isOneToOne: false
            referencedRelation: "law_firms"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_archives: {
        Row: {
          archived_date: string
          created_at: string
          created_by: string | null
          data: Json
          id: string
          law_firm_id: string | null
          period_end: string
          period_start: string
          period_type: string
          total_appointments: number
        }
        Insert: {
          archived_date?: string
          created_at?: string
          created_by?: string | null
          data: Json
          id?: string
          law_firm_id?: string | null
          period_end: string
          period_start: string
          period_type: string
          total_appointments?: number
        }
        Update: {
          archived_date?: string
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          law_firm_id?: string | null
          period_end?: string
          period_start?: string
          period_type?: string
          total_appointments?: number
        }
        Relationships: [
          {
            foreignKeyName: "appointment_archives_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_archives_law_firm_id_fkey"
            columns: ["law_firm_id"]
            isOneToOne: false
            referencedRelation: "law_firms"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_request_ratings: {
        Row: {
          appointment_request_id: string
          created_at: string
          final_response_at: string | null
          first_response_at: string | null
          id: string
          notes: string | null
          response_rating: string | null
          response_time_hours: number | null
          updated_at: string
        }
        Insert: {
          appointment_request_id: string
          created_at?: string
          final_response_at?: string | null
          first_response_at?: string | null
          id?: string
          notes?: string | null
          response_rating?: string | null
          response_time_hours?: number | null
          updated_at?: string
        }
        Update: {
          appointment_request_id?: string
          created_at?: string
          final_response_at?: string | null
          first_response_at?: string | null
          id?: string
          notes?: string | null
          response_rating?: string | null
          response_time_hours?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_request_ratings_appointment_request_id_fkey"
            columns: ["appointment_request_id"]
            isOneToOne: false
            referencedRelation: "appointment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_requests: {
        Row: {
          additional_notes: string | null
          approval_notes: string | null
          attorney_email: string | null
          claimant_first_name: string
          claimant_last_name: string
          confirmed_appointment_date: string | null
          created_at: string
          expert_type_requested: string
          guardian_name: string | null
          id: string
          is_minor: boolean
          law_firm_id: string
          matter_type: string
          preferred_date_type: string
          processed_at: string | null
          processed_by: string | null
          province: string
          referring_attorney_name: string
          requested_by: string
          special_requests: string[] | null
          status: string
          suggested_date: string | null
          suggested_month: string | null
          synced_appointment_id: string | null
          updated_at: string
        }
        Insert: {
          additional_notes?: string | null
          approval_notes?: string | null
          attorney_email?: string | null
          claimant_first_name: string
          claimant_last_name: string
          confirmed_appointment_date?: string | null
          created_at?: string
          expert_type_requested: string
          guardian_name?: string | null
          id?: string
          is_minor?: boolean
          law_firm_id: string
          matter_type: string
          preferred_date_type: string
          processed_at?: string | null
          processed_by?: string | null
          province: string
          referring_attorney_name: string
          requested_by: string
          special_requests?: string[] | null
          status?: string
          suggested_date?: string | null
          suggested_month?: string | null
          synced_appointment_id?: string | null
          updated_at?: string
        }
        Update: {
          additional_notes?: string | null
          approval_notes?: string | null
          attorney_email?: string | null
          claimant_first_name?: string
          claimant_last_name?: string
          confirmed_appointment_date?: string | null
          created_at?: string
          expert_type_requested?: string
          guardian_name?: string | null
          id?: string
          is_minor?: boolean
          law_firm_id?: string
          matter_type?: string
          preferred_date_type?: string
          processed_at?: string | null
          processed_by?: string | null
          province?: string
          referring_attorney_name?: string
          requested_by?: string
          special_requests?: string[] | null
          status?: string
          suggested_date?: string | null
          suggested_month?: string | null
          synced_appointment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_requests_synced_appointment_id_fkey"
            columns: ["synced_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          agreement_duration_months: number | null
          appointment_date: string
          case_status: string | null
          claimant_id: string
          created_at: string
          deposit_amount: number | null
          expert_id: string
          id: string
          law_firm_id: string
          matter_type: string | null
          payment_date: string | null
          payment_status: string | null
          payment_terms: string | null
          referring_attorney: string
          service_fee: number | null
          updated_at: string
        }
        Insert: {
          agreement_duration_months?: number | null
          appointment_date: string
          case_status?: string | null
          claimant_id: string
          created_at?: string
          deposit_amount?: number | null
          expert_id: string
          id?: string
          law_firm_id: string
          matter_type?: string | null
          payment_date?: string | null
          payment_status?: string | null
          payment_terms?: string | null
          referring_attorney: string
          service_fee?: number | null
          updated_at?: string
        }
        Update: {
          agreement_duration_months?: number | null
          appointment_date?: string
          case_status?: string | null
          claimant_id?: string
          created_at?: string
          deposit_amount?: number | null
          expert_id?: string
          id?: string
          law_firm_id?: string
          matter_type?: string | null
          payment_date?: string | null
          payment_status?: string | null
          payment_terms?: string | null
          referring_attorney?: string
          service_fee?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      assessment_report_archives: {
        Row: {
          archived_date: string
          completed_reports: number
          completion_rate: number
          created_at: string
          created_by: string
          expert_performance_data: Json
          id: string
          law_firm_id: string
          matter_type_data: Json
          monthly_trends_data: Json
          pending_reports: number
          period_end: string
          period_start: string
          period_type: string
          reports_taken_out: number
          total_assessments: number
        }
        Insert: {
          archived_date?: string
          completed_reports?: number
          completion_rate?: number
          created_at?: string
          created_by: string
          expert_performance_data?: Json
          id?: string
          law_firm_id: string
          matter_type_data?: Json
          monthly_trends_data?: Json
          pending_reports?: number
          period_end: string
          period_start: string
          period_type?: string
          reports_taken_out?: number
          total_assessments?: number
        }
        Update: {
          archived_date?: string
          completed_reports?: number
          completion_rate?: number
          created_at?: string
          created_by?: string
          expert_performance_data?: Json
          id?: string
          law_firm_id?: string
          matter_type_data?: Json
          monthly_trends_data?: Json
          pending_reports?: number
          period_end?: string
          period_start?: string
          period_type?: string
          reports_taken_out?: number
          total_assessments?: number
        }
        Relationships: []
      }
      attorneys: {
        Row: {
          address: string | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          law_firm: string | null
          law_firm_id: string | null
          location: string | null
          name: string
          phone: string | null
          specialization: string[] | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          law_firm?: string | null
          law_firm_id?: string | null
          location?: string | null
          name: string
          phone?: string | null
          specialization?: string[] | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          law_firm?: string | null
          law_firm_id?: string | null
          location?: string | null
          name?: string
          phone?: string | null
          specialization?: string[] | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attorneys_law_firm_id_fkey"
            columns: ["law_firm_id"]
            isOneToOne: false
            referencedRelation: "law_firms"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action_type: string
          changed_fields: Json | null
          created_at: string
          description: string | null
          function_area: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_email: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          changed_fields?: Json | null
          created_at?: string
          description?: string | null
          function_area: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_email?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          changed_fields?: Json | null
          created_at?: string
          description?: string | null
          function_area?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      case_sources: {
        Row: {
          appointment_id: string
          assessment_date: string
          created_at: string
          id: string
          law_firm_id: string
          source_details: string | null
          source_type: string
        }
        Insert: {
          appointment_id: string
          assessment_date: string
          created_at?: string
          id?: string
          law_firm_id: string
          source_details?: string | null
          source_type: string
        }
        Update: {
          appointment_id?: string
          assessment_date?: string
          created_at?: string
          id?: string
          law_firm_id?: string
          source_details?: string | null
          source_type?: string
        }
        Relationships: []
      }
      claimants: {
        Row: {
          auto_id: string
          contact_number: string | null
          created_at: string
          first_name: string
          id: string
          last_name: string
          law_firm_id: string
        }
        Insert: {
          auto_id: string
          contact_number?: string | null
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          law_firm_id: string
        }
        Update: {
          auto_id?: string
          contact_number?: string | null
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          law_firm_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claimants_law_firm_id_fkey"
            columns: ["law_firm_id"]
            isOneToOne: false
            referencedRelation: "law_firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_claimants_law_firm"
            columns: ["law_firm_id"]
            isOneToOne: false
            referencedRelation: "law_firms"
            referencedColumns: ["id"]
          },
        ]
      }
      document_cleanup_log: {
        Row: {
          cleanup_date: string
          created_at: string | null
          details: string | null
          id: string
          status: string
        }
        Insert: {
          cleanup_date?: string
          created_at?: string | null
          details?: string | null
          id?: string
          status: string
        }
        Update: {
          cleanup_date?: string
          created_at?: string | null
          details?: string | null
          id?: string
          status?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          appointment_id: string | null
          claimant_id: string | null
          created_at: string
          document_type: string
          expert_id: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          notes: string | null
          referring_attorney_id: string | null
          updated_at: string
          upload_date: string
          upload_time: string
          uploaded_by: string
        }
        Insert: {
          appointment_id?: string | null
          claimant_id?: string | null
          created_at?: string
          document_type: string
          expert_id?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          notes?: string | null
          referring_attorney_id?: string | null
          updated_at?: string
          upload_date?: string
          upload_time?: string
          uploaded_by: string
        }
        Update: {
          appointment_id?: string | null
          claimant_id?: string | null
          created_at?: string
          document_type?: string
          expert_id?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          notes?: string | null
          referring_attorney_id?: string | null
          updated_at?: string
          upload_date?: string
          upload_time?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_claimant_id_fkey"
            columns: ["claimant_id"]
            isOneToOne: false
            referencedRelation: "claimants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "medical_experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_referring_attorney_id_fkey"
            columns: ["referring_attorney_id"]
            isOneToOne: false
            referencedRelation: "law_firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      edit_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          original_data: Json
          record_id: string
          request_reason: string | null
          requested_by: string
          requested_changes: Json
          status: Database["public"]["Enums"]["approval_status"]
          table_name: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          original_data: Json
          record_id: string
          request_reason?: string | null
          requested_by: string
          requested_changes: Json
          status?: Database["public"]["Enums"]["approval_status"]
          table_name: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          original_data?: Json
          record_id?: string
          request_reason?: string | null
          requested_by?: string
          requested_changes?: Json
          status?: Database["public"]["Enums"]["approval_status"]
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_notifications: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean | null
          receive_appointment_requests: boolean | null
          receive_assessment_changes: boolean | null
          receive_payment_changes: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean | null
          receive_appointment_requests?: boolean | null
          receive_assessment_changes?: boolean | null
          receive_payment_changes?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean | null
          receive_appointment_requests?: boolean | null
          receive_assessment_changes?: boolean | null
          receive_payment_changes?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expert_reports: {
        Row: {
          appointment_id: string | null
          claimant_id: string
          created_at: string
          days_to_complete: number | null
          expert_id: string
          expert_performance: string | null
          id: string
          notes: string | null
          payment_date: string | null
          payment_status: string
          report_due_date: string | null
          report_status: string
          report_submitted_date: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          claimant_id: string
          created_at?: string
          days_to_complete?: number | null
          expert_id: string
          expert_performance?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_status?: string
          report_due_date?: string | null
          report_status?: string
          report_submitted_date?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          claimant_id?: string
          created_at?: string
          days_to_complete?: number | null
          expert_id?: string
          expert_performance?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_status?: string
          report_due_date?: string | null
          report_status?: string
          report_submitted_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_reports_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_reports_claimant_id_fkey"
            columns: ["claimant_id"]
            isOneToOne: false
            referencedRelation: "claimants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_reports_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "medical_experts"
            referencedColumns: ["id"]
          },
        ]
      }
      function_permissions: {
        Row: {
          created_at: string
          function_category: string
          function_name: string
          granted: boolean
          granted_by: string | null
          id: string
          sub_function: string | null
          updated_at: string
          user_id: string
          user_type: string
        }
        Insert: {
          created_at?: string
          function_category: string
          function_name: string
          granted?: boolean
          granted_by?: string | null
          id?: string
          sub_function?: string | null
          updated_at?: string
          user_id: string
          user_type: string
        }
        Update: {
          created_at?: string
          function_category?: string
          function_name?: string
          granted?: boolean
          granted_by?: string | null
          id?: string
          sub_function?: string | null
          updated_at?: string
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      law_firms: {
        Row: {
          address: string | null
          attorney_role: string | null
          code: string
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          matter_type: Database["public"]["Enums"]["matter_type"] | null
          name: string
          phone: string | null
          province: string | null
        }
        Insert: {
          address?: string | null
          attorney_role?: string | null
          code: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          matter_type?: Database["public"]["Enums"]["matter_type"] | null
          name: string
          phone?: string | null
          province?: string | null
        }
        Update: {
          address?: string | null
          attorney_role?: string | null
          code?: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          matter_type?: Database["public"]["Enums"]["matter_type"] | null
          name?: string
          phone?: string | null
          province?: string | null
        }
        Relationships: []
      }
      lead_search_history: {
        Row: {
          created_by: string
          id: string
          lead_type: string
          province: string
          results_found: number
          search_date: string
          search_query: string
        }
        Insert: {
          created_by: string
          id?: string
          lead_type: string
          province: string
          results_found?: number
          search_date?: string
          search_query: string
        }
        Update: {
          created_by?: string
          id?: string
          lead_type?: string
          province?: string
          results_found?: number
          search_date?: string
          search_query?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          address: string | null
          assigned_to: string | null
          contact_person: string | null
          conversion_probability: number | null
          created_at: string
          created_by: string
          email: string | null
          estimated_annual_value: number | null
          firm_name: string
          firm_size: string | null
          id: string
          last_contact_date: string | null
          lead_source: string
          lead_status: string
          lead_type: string
          next_follow_up_date: string | null
          notes: string | null
          phone: string | null
          practice_areas: string[] | null
          priority: string
          province: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          contact_person?: string | null
          conversion_probability?: number | null
          created_at?: string
          created_by: string
          email?: string | null
          estimated_annual_value?: number | null
          firm_name: string
          firm_size?: string | null
          id?: string
          last_contact_date?: string | null
          lead_source?: string
          lead_status?: string
          lead_type: string
          next_follow_up_date?: string | null
          notes?: string | null
          phone?: string | null
          practice_areas?: string[] | null
          priority?: string
          province: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          contact_person?: string | null
          conversion_probability?: number | null
          created_at?: string
          created_by?: string
          email?: string | null
          estimated_annual_value?: number | null
          firm_name?: string
          firm_size?: string | null
          id?: string
          last_contact_date?: string | null
          lead_source?: string
          lead_status?: string
          lead_type?: string
          next_follow_up_date?: string | null
          notes?: string | null
          phone?: string | null
          practice_areas?: string[] | null
          priority?: string
          province?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      medical_experts: {
        Row: {
          availability_notes: string | null
          consultation_fees: number | null
          contact_number: string | null
          court_fees: number | null
          created_at: string
          cv_document_url: string | null
          email: string | null
          expert_type: string
          first_name: string
          id: string
          last_name: string
          matter_types: string[] | null
          personal_assistant_contact: string | null
          personal_assistant_name: string | null
          practice_address: string | null
          province: string
          qualifications: string | null
          specializations: string[] | null
          status: string | null
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          availability_notes?: string | null
          consultation_fees?: number | null
          contact_number?: string | null
          court_fees?: number | null
          created_at?: string
          cv_document_url?: string | null
          email?: string | null
          expert_type: string
          first_name: string
          id?: string
          last_name: string
          matter_types?: string[] | null
          personal_assistant_contact?: string | null
          personal_assistant_name?: string | null
          practice_address?: string | null
          province: string
          qualifications?: string | null
          specializations?: string[] | null
          status?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          availability_notes?: string | null
          consultation_fees?: number | null
          contact_number?: string | null
          court_fees?: number | null
          created_at?: string
          cv_document_url?: string | null
          email?: string | null
          expert_type?: string
          first_name?: string
          id?: string
          last_name?: string
          matter_types?: string[] | null
          personal_assistant_contact?: string | null
          personal_assistant_name?: string | null
          practice_address?: string | null
          province?: string
          qualifications?: string | null
          specializations?: string[] | null
          status?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      pitch_logs: {
        Row: {
          attorney_id: string
          created_at: string
          created_by: string
          feedback_comments: string | null
          follow_up_reminder: string | null
          id: string
          law_firm_id: string | null
          pitch_date: string
          pitch_notes: string | null
        }
        Insert: {
          attorney_id: string
          created_at?: string
          created_by: string
          feedback_comments?: string | null
          follow_up_reminder?: string | null
          id?: string
          law_firm_id?: string | null
          pitch_date: string
          pitch_notes?: string | null
        }
        Update: {
          attorney_id?: string
          created_at?: string
          created_by?: string
          feedback_comments?: string | null
          follow_up_reminder?: string | null
          id?: string
          law_firm_id?: string | null
          pitch_date?: string
          pitch_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pitch_logs_attorney_id_fkey"
            columns: ["attorney_id"]
            isOneToOne: false
            referencedRelation: "attorneys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitch_logs_law_firm_id_fkey"
            columns: ["law_firm_id"]
            isOneToOne: false
            referencedRelation: "law_firms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          law_firm_id: string | null
          position: string | null
          role: string | null
          updated_at: string
          user_type: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          law_firm_id?: string | null
          position?: string | null
          role?: string | null
          updated_at?: string
          user_type?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          law_firm_id?: string | null
          position?: string | null
          role?: string | null
          updated_at?: string
          user_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_law_firm_id_fkey"
            columns: ["law_firm_id"]
            isOneToOne: false
            referencedRelation: "law_firms"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_results: {
        Row: {
          affected_object: string | null
          audit_date: string
          audit_type: string
          created_by: string
          finding_category: string
          finding_details: string | null
          finding_title: string
          id: string
          remediation_steps: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
        }
        Insert: {
          affected_object?: string | null
          audit_date?: string
          audit_type: string
          created_by?: string
          finding_category: string
          finding_details?: string | null
          finding_title: string
          id?: string
          remediation_steps?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          status?: string
        }
        Update: {
          affected_object?: string | null
          audit_date?: string
          audit_type?: string
          created_by?: string
          finding_category?: string
          finding_details?: string | null
          finding_title?: string
          id?: string
          remediation_steps?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
        }
        Relationships: []
      }
      sensitive_data_access_tokens: {
        Row: {
          access_count: number | null
          accessed_at: string | null
          created_at: string
          expires_at: string
          id: string
          resource_id: string
          resource_type: string
          revoked: boolean | null
          revoked_at: string | null
          revoked_by: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          access_count?: number | null
          accessed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          resource_id: string
          resource_type: string
          revoked?: boolean | null
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          access_count?: number | null
          accessed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          resource_id?: string
          resource_type?: string
          revoked?: boolean | null
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      targets: {
        Row: {
          created_at: string
          created_by: string
          id: string
          law_firm_id: string
          period_end: string
          period_start: string
          period_type: string
          target_assessments: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          law_firm_id: string
          period_end: string
          period_start: string
          period_type: string
          target_assessments: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          law_firm_id?: string
          period_end?: string
          period_start?: string
          period_type?: string
          target_assessments?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          granted: boolean
          granted_by: string | null
          id: string
          permission_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          granted_by?: string | null
          id?: string
          permission_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          granted_by?: string | null
          id?: string
          permission_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      audit_rls_policies: {
        Args: Record<PropertyKey, never>
        Returns: {
          has_delete_policy: boolean
          has_insert_policy: boolean
          has_select_policy: boolean
          has_update_policy: boolean
          policy_count: number
          rls_enabled: boolean
          severity: string
          table_name: string
        }[]
      }
      audit_security_definer_functions: {
        Args: Record<PropertyKey, never>
        Returns: {
          function_name: string
          has_search_path: boolean
          severity: string
        }[]
      }
      calculate_response_rating: {
        Args: { hours: number }
        Returns: string
      }
      can_access_pii: {
        Args: { data_type: string; target_user_id: string }
        Returns: boolean
      }
      can_edit_record: {
        Args: { created_date: string; record_id: string; table_name: string }
        Returns: boolean
      }
      can_view_expert_contacts: {
        Args: { expert_id: string }
        Returns: boolean
      }
      check_admin_by_email: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      check_data_retention_compliance: {
        Args: Record<PropertyKey, never>
        Returns: {
          action_required: string
          compliance_status: string
          oldest_record: string
          record_count: number
          table_name: string
        }[]
      }
      check_user_role: {
        Args: { required_role: string }
        Returns: boolean
      }
      cleanup_expired_tokens: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_old_documents: {
        Args: Record<PropertyKey, never>
        Returns: {
          deleted_count: number
          deletion_reason: string
          document_type: string
        }[]
      }
      clear_assessment_data: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      clear_medical_experts: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      encrypt_sensitive_field: {
        Args: { field_value: string }
        Returns: string
      }
      generate_access_token: {
        Args: {
          p_duration_minutes?: number
          p_resource_id: string
          p_resource_type: string
        }
        Returns: {
          expires_at: string
          token: string
        }[]
      }
      get_claimant_secure: {
        Args: { claimant_id: string }
        Returns: {
          auto_id: string
          contact_number_masked: string
          created_at: string
          first_name_masked: string
          id: string
          last_name_masked: string
          law_firm_id: string
        }[]
      }
      get_claimants_secure: {
        Args: Record<PropertyKey, never>
        Returns: {
          auto_id: string
          contact_number_masked: string
          created_at: string
          first_name_masked: string
          id: string
          last_name_masked: string
          law_firm_id: string
        }[]
      }
      get_cleanup_history: {
        Args: { limit_count?: number }
        Returns: {
          cleanup_date: string
          details: string
          status: string
        }[]
      }
      get_current_user_law_firm: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_referring_attorney: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_type: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_law_firm_safe: {
        Args: { firm_id: string }
        Returns: {
          address_masked: string
          attorney_role: string
          code: string
          contact_person: string
          created_at: string
          email_masked: string
          id: string
          name: string
          phone_masked: string
          province: string
        }[]
      }
      get_law_firms_list: {
        Args: Record<PropertyKey, never>
        Returns: {
          attorney_role: string
          code: string
          contact_person: string
          created_at: string
          email_masked: string
          id: string
          name: string
          phone_masked: string
          province: string
        }[]
      }
      get_medical_expert_display_safe: {
        Args: { expert_id: string }
        Returns: {
          address_masked: string
          availability_notes: string
          consultation_fees: number
          court_fees: number
          created_at: string
          cv_document_url: string
          email_masked: string
          expert_type: string
          first_name: string
          id: string
          last_name: string
          matter_types: string[]
          pa_name_masked: string
          pa_phone_masked: string
          phone_masked: string
          province: string
          qualifications: string
          specializations: string[]
          status: string
          updated_at: string
          years_experience: number
        }[]
      }
      get_medical_expert_safe: {
        Args: { expert_id: string }
        Returns: {
          availability_notes: string
          consultation_fees: number
          contact_number: string
          court_fees: number
          created_at: string
          cv_document_url: string
          email: string
          expert_type: string
          first_name: string
          id: string
          last_name: string
          personal_assistant_contact: string
          personal_assistant_name: string
          practice_address: string
          province: string
          qualifications: string
          specializations: string[]
          status: string
          updated_at: string
          years_experience: number
        }[]
      }
      get_medical_expert_safe_with_audit: {
        Args: { expert_id: string }
        Returns: {
          availability_notes: string
          consultation_fees: number
          contact_number: string
          court_fees: number
          created_at: string
          cv_document_url: string
          email: string
          expert_type: string
          first_name: string
          id: string
          last_name: string
          personal_assistant_contact: string
          personal_assistant_name: string
          practice_address: string
          province: string
          qualifications: string
          specializations: string[]
          status: string
          updated_at: string
          years_experience: number
        }[]
      }
      get_medical_experts_basic: {
        Args: Record<PropertyKey, never>
        Returns: {
          expert_type: string
          first_name: string
          id: string
          last_name: string
          province: string
          status: string
        }[]
      }
      get_medical_experts_secure: {
        Args: Record<PropertyKey, never>
        Returns: {
          address_masked: string
          availability_notes: string
          consultation_fees: number
          court_fees: number
          created_at: string
          cv_document_url: string
          email_masked: string
          expert_type: string
          first_name: string
          id: string
          last_name: string
          matter_types: string[]
          pa_name_masked: string
          pa_phone_masked: string
          phone_masked: string
          province: string
          qualifications: string
          specializations: string[]
          status: string
          updated_at: string
          years_experience: number
        }[]
      }
      get_scheduled_assessments_secure: {
        Args: Record<PropertyKey, never>
        Returns: {
          appointment_date: string
          appointment_id: string
          case_status: string
          claimant_auto_id: string
          claimant_name: string
          deposit_amount: number
          expert_name: string
          expert_type: string
          law_firm_id: string
          payment_date: string
          referring_attorney: string
          report_status: string
          report_submitted_date: string
        }[]
      }
      get_user_function_permissions: {
        Args: { target_user_id: string }
        Returns: {
          function_category: string
          function_name: string
          granted: boolean
          sub_function: string
          user_type: string
        }[]
      }
      get_user_law_firm_secure: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_admin_secure: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_main_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_primary_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_referring_attorney: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_system_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_within_edit_window: {
        Args: { created_date: string }
        Returns: boolean
      }
      log_audit_trail: {
        Args: {
          p_action_type: string
          p_description?: string
          p_function_area: string
          p_new_values?: Json
          p_old_values?: Json
          p_record_id: string
          p_table_name: string
        }
        Returns: string
      }
      log_security_event: {
        Args: {
          p_action: string
          p_details?: Json
          p_event_type: string
          p_resource_id?: string
          p_resource_type: string
          p_risk_level?: string
        }
        Returns: string
      }
      log_sensitive_data_access: {
        Args: {
          access_type: string
          accessed_record_id: string
          accessed_table: string
        }
        Returns: undefined
      }
      manual_document_cleanup: {
        Args: Record<PropertyKey, never>
        Returns: {
          deleted_count: number
          deletion_reason: string
          document_type: string
        }[]
      }
      mask_pii_data: {
        Args: {
          access_level?: string
          data_type: string
          original_value: string
        }
        Returns: string
      }
      mask_sensitive_data: {
        Args: { data_type: string; original_value: string }
        Returns: string
      }
      process_edit_request: {
        Args: {
          p_admin_notes?: string
          p_request_id: string
          p_status: Database["public"]["Enums"]["approval_status"]
        }
        Returns: boolean
      }
      request_edit_permission: {
        Args: {
          p_original_data: Json
          p_reason: string
          p_record_id: string
          p_requested_changes: Json
          p_table_name: string
        }
        Returns: string
      }
      require_2fa_for_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      revoke_access_token: {
        Args: { p_token: string }
        Returns: boolean
      }
      run_security_audit: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      sync_existing_appointment_requests: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_user_profile: {
        Args: {
          first_name_param?: string
          last_name_param?: string
          user_id_param: string
        }
        Returns: boolean
      }
      user_has_permission: {
        Args: { permission_name: string }
        Returns: boolean
      }
      validate_access_token: {
        Args: {
          p_resource_id: string
          p_resource_type: string
          p_token: string
        }
        Returns: boolean
      }
      validate_claimant_access: {
        Args: { claimant_law_firm_id: string }
        Returns: boolean
      }
      validate_law_firm_access_secure: {
        Args: { target_law_firm_id: string }
        Returns: boolean
      }
      validate_user_session: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      approval_status: "pending" | "approved" | "rejected"
      matter_type: "mva" | "med_neg" | "both"
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
      approval_status: ["pending", "approved", "rejected"],
      matter_type: ["mva", "med_neg", "both"],
    },
  },
} as const

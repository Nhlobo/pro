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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_audit_log: {
        Row: {
          action_type: string
          changed_at: string
          changed_by: string
          changed_table: string
          id: string
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          source: string
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          changed_at?: string
          changed_by: string
          changed_table: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          source?: string
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          changed_at?: string
          changed_by?: string
          changed_table?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          source?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      access_modules: {
        Row: {
          description: string | null
          group_name: string | null
          is_active: boolean
          module_key: string
          route_path: string
          title: string
        }
        Insert: {
          description?: string | null
          group_name?: string | null
          is_active?: boolean
          module_key: string
          route_path: string
          title: string
        }
        Update: {
          description?: string | null
          group_name?: string | null
          is_active?: boolean
          module_key?: string
          route_path?: string
          title?: string
        }
        Relationships: []
      }
      access_role_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          id: string
          role_key: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          id?: string
          role_key: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          id?: string
          role_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_role_assignments_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "access_roles"
            referencedColumns: ["role_key"]
          },
        ]
      }
      access_roles: {
        Row: {
          display_name: string
          role_key: string
        }
        Insert: {
          display_name: string
          role_key: string
        }
        Update: {
          display_name?: string
          role_key?: string
        }
        Relationships: []
      }
      access_session_versions: {
        Row: {
          changed_at: string
          changed_by: string | null
          force_reauth: boolean
          reason: string | null
          user_id: string
          version: number
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          force_reauth?: boolean
          reason?: string | null
          user_id: string
          version?: number
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          force_reauth?: boolean
          reason?: string | null
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      account_activations: {
        Row: {
          consumed_at: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          token_hash: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          token_hash: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      agreement_annexures: {
        Row: {
          agreement_id: string
          agreement_type: string
          created_at: string | null
          deliverables: string[] | null
          deliverables_released: boolean | null
          id: string
          is_paid: boolean | null
          notes: string | null
          paid_at: string | null
          payment_amount: number | null
          payment_percentage: number | null
          payment_stage: string
          phase_name: string
          phase_order: number
          released_at: string | null
          updated_at: string | null
        }
        Insert: {
          agreement_id: string
          agreement_type: string
          created_at?: string | null
          deliverables?: string[] | null
          deliverables_released?: boolean | null
          id?: string
          is_paid?: boolean | null
          notes?: string | null
          paid_at?: string | null
          payment_amount?: number | null
          payment_percentage?: number | null
          payment_stage: string
          phase_name: string
          phase_order: number
          released_at?: string | null
          updated_at?: string | null
        }
        Update: {
          agreement_id?: string
          agreement_type?: string
          created_at?: string | null
          deliverables?: string[] | null
          deliverables_released?: boolean | null
          id?: string
          is_paid?: boolean | null
          notes?: string | null
          paid_at?: string | null
          payment_amount?: number | null
          payment_percentage?: number | null
          payment_stage?: string
          phase_name?: string
          phase_order?: number
          released_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_published: boolean | null
          priority: string
          published_at: string | null
          target_audience: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_published?: boolean | null
          priority?: string
          published_at?: string | null
          target_audience?: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_published?: boolean | null
          priority?: string
          published_at?: string | null
          target_audience?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      aod_documents: {
        Row: {
          agreement_duration_term: string | null
          agreement_type: string | null
          auto_triggered: boolean | null
          contract_description: string | null
          contract_end_date: string | null
          contract_start_date: string | null
          created_at: string
          creditor_signature_date: string | null
          debtor_authorized_rep: string | null
          debtor_domicilium_address: string | null
          debtor_law_firm_name: string | null
          debtor_registration_number: string | null
          debtor_signature_date: string | null
          default_notice_count: number | null
          default_notice_sent_at: string | null
          default_status: string | null
          deposit_amount: number | null
          discount_amount: number | null
          discount_rate: number | null
          discount_reason: string | null
          document_status: string | null
          document_url: string
          file_name: string
          grace_period_days: number | null
          id: string
          interest_rate_1_3_months: number | null
          interest_rate_12_months: number | null
          interest_rate_18_months: number | null
          interest_rate_24_months: number | null
          interest_rate_6_months: number | null
          is_digitally_signed: boolean | null
          last_payment_date: string | null
          legal_escalation_notes: string | null
          linked_appointment_ids: string[]
          matter_types: string[] | null
          next_payment_date: string | null
          notes: string | null
          original_contract_value: number | null
          payment_due_date: string | null
          payment_frequency: string | null
          payment_plan_structure: string | null
          payment_status: string | null
          payments_made: number | null
          referring_attorney_id: string
          reports_released: number | null
          roll_out_plan_reference: string | null
          services_suspended: boolean | null
          signed_document_url: string | null
          total_amount_words: string | null
          total_contract_value: number | null
          total_reports_agreed: number | null
          trigger_reason: string | null
          updated_at: string
          uploaded_by: string | null
          witness1_name: string | null
          witness1_signature_date: string | null
          witness2_name: string | null
          witness2_signature_date: string | null
        }
        Insert: {
          agreement_duration_term?: string | null
          agreement_type?: string | null
          auto_triggered?: boolean | null
          contract_description?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          creditor_signature_date?: string | null
          debtor_authorized_rep?: string | null
          debtor_domicilium_address?: string | null
          debtor_law_firm_name?: string | null
          debtor_registration_number?: string | null
          debtor_signature_date?: string | null
          default_notice_count?: number | null
          default_notice_sent_at?: string | null
          default_status?: string | null
          deposit_amount?: number | null
          discount_amount?: number | null
          discount_rate?: number | null
          discount_reason?: string | null
          document_status?: string | null
          document_url: string
          file_name: string
          grace_period_days?: number | null
          id?: string
          interest_rate_1_3_months?: number | null
          interest_rate_12_months?: number | null
          interest_rate_18_months?: number | null
          interest_rate_24_months?: number | null
          interest_rate_6_months?: number | null
          is_digitally_signed?: boolean | null
          last_payment_date?: string | null
          legal_escalation_notes?: string | null
          linked_appointment_ids?: string[]
          matter_types?: string[] | null
          next_payment_date?: string | null
          notes?: string | null
          original_contract_value?: number | null
          payment_due_date?: string | null
          payment_frequency?: string | null
          payment_plan_structure?: string | null
          payment_status?: string | null
          payments_made?: number | null
          referring_attorney_id: string
          reports_released?: number | null
          roll_out_plan_reference?: string | null
          services_suspended?: boolean | null
          signed_document_url?: string | null
          total_amount_words?: string | null
          total_contract_value?: number | null
          total_reports_agreed?: number | null
          trigger_reason?: string | null
          updated_at?: string
          uploaded_by?: string | null
          witness1_name?: string | null
          witness1_signature_date?: string | null
          witness2_name?: string | null
          witness2_signature_date?: string | null
        }
        Update: {
          agreement_duration_term?: string | null
          agreement_type?: string | null
          auto_triggered?: boolean | null
          contract_description?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          creditor_signature_date?: string | null
          debtor_authorized_rep?: string | null
          debtor_domicilium_address?: string | null
          debtor_law_firm_name?: string | null
          debtor_registration_number?: string | null
          debtor_signature_date?: string | null
          default_notice_count?: number | null
          default_notice_sent_at?: string | null
          default_status?: string | null
          deposit_amount?: number | null
          discount_amount?: number | null
          discount_rate?: number | null
          discount_reason?: string | null
          document_status?: string | null
          document_url?: string
          file_name?: string
          grace_period_days?: number | null
          id?: string
          interest_rate_1_3_months?: number | null
          interest_rate_12_months?: number | null
          interest_rate_18_months?: number | null
          interest_rate_24_months?: number | null
          interest_rate_6_months?: number | null
          is_digitally_signed?: boolean | null
          last_payment_date?: string | null
          legal_escalation_notes?: string | null
          linked_appointment_ids?: string[]
          matter_types?: string[] | null
          next_payment_date?: string | null
          notes?: string | null
          original_contract_value?: number | null
          payment_due_date?: string | null
          payment_frequency?: string | null
          payment_plan_structure?: string | null
          payment_status?: string | null
          payments_made?: number | null
          referring_attorney_id?: string
          reports_released?: number | null
          roll_out_plan_reference?: string | null
          services_suspended?: boolean | null
          signed_document_url?: string | null
          total_amount_words?: string | null
          total_contract_value?: number | null
          total_reports_agreed?: number | null
          trigger_reason?: string | null
          updated_at?: string
          uploaded_by?: string | null
          witness1_name?: string | null
          witness1_signature_date?: string | null
          witness2_name?: string | null
          witness2_signature_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aod_documents_law_firm_id_fkey"
            columns: ["referring_attorney_id"]
            isOneToOne: false
            referencedRelation: "referring_attorneys"
            referencedColumns: ["id"]
          },
        ]
      }
      aod_payments: {
        Row: {
          aod_document_id: string
          created_at: string
          id: string
          payment_amount: number
          payment_date: string
          payment_notes: string | null
          payment_reference: string | null
          payment_type: string
          pop_attachment_id: string | null
          recorded_by: string | null
          reports_taken_out: number | null
          sageone_transaction_id: string | null
          updated_at: string
        }
        Insert: {
          aod_document_id: string
          created_at?: string
          id?: string
          payment_amount: number
          payment_date: string
          payment_notes?: string | null
          payment_reference?: string | null
          payment_type: string
          pop_attachment_id?: string | null
          recorded_by?: string | null
          reports_taken_out?: number | null
          sageone_transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          aod_document_id?: string
          created_at?: string
          id?: string
          payment_amount?: number
          payment_date?: string
          payment_notes?: string | null
          payment_reference?: string | null
          payment_type?: string
          pop_attachment_id?: string | null
          recorded_by?: string | null
          reports_taken_out?: number | null
          sageone_transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aod_payments_aod_document_id_fkey"
            columns: ["aod_document_id"]
            isOneToOne: false
            referencedRelation: "aod_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aod_payments_pop_attachment_id_fkey"
            columns: ["pop_attachment_id"]
            isOneToOne: false
            referencedRelation: "payment_pop_attachments"
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
          period_end: string
          period_start: string
          period_type: string
          referring_attorney_id: string | null
          total_appointments: number
        }
        Insert: {
          archived_date?: string
          created_at?: string
          created_by?: string | null
          data: Json
          id?: string
          period_end: string
          period_start: string
          period_type: string
          referring_attorney_id?: string | null
          total_appointments?: number
        }
        Update: {
          archived_date?: string
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          period_end?: string
          period_start?: string
          period_type?: string
          referring_attorney_id?: string | null
          total_appointments?: number
        }
        Relationships: [
          {
            foreignKeyName: "appointment_archives_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "access_compatibility_raw"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "appointment_archives_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_archives_law_firm_id_fkey"
            columns: ["referring_attorney_id"]
            isOneToOne: false
            referencedRelation: "referring_attorneys"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_checklist: {
        Row: {
          all_documents_received: boolean
          appointment_id: string
          attendance_status: string
          coordinator_signoff_at: string | null
          coordinator_signoff_name: string | null
          created_at: string
          id: string
          manager_signoff_at: string | null
          manager_signoff_name: string | null
          notes: string | null
          transport_required: boolean
          updated_at: string
        }
        Insert: {
          all_documents_received?: boolean
          appointment_id: string
          attendance_status?: string
          coordinator_signoff_at?: string | null
          coordinator_signoff_name?: string | null
          created_at?: string
          id?: string
          manager_signoff_at?: string | null
          manager_signoff_name?: string | null
          notes?: string | null
          transport_required?: boolean
          updated_at?: string
        }
        Update: {
          all_documents_received?: boolean
          appointment_id?: string
          attendance_status?: string
          coordinator_signoff_at?: string | null
          coordinator_signoff_name?: string | null
          created_at?: string
          id?: string
          manager_signoff_at?: string | null
          manager_signoff_name?: string | null
          notes?: string | null
          transport_required?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_checklist_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_checklist_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "deleted_appointments_view"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_reclassification_log: {
        Row: {
          appointment_id: string
          changed_at: string
          changed_by: string | null
          id: string
          new_case_status: string
          note: string | null
          previous_case_status: string | null
        }
        Insert: {
          appointment_id: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_case_status: string
          note?: string | null
          previous_case_status?: string | null
        }
        Update: {
          appointment_id?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_case_status?: string
          note?: string | null
          previous_case_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reclassification_log_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_reclassification_log_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "deleted_appointments_view"
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
          matter_type: string
          payment_reference: string | null
          pop_attachment_id: string | null
          preferred_date_type: string
          processed_at: string | null
          processed_by: string | null
          province: string
          referring_attorney_id: string
          referring_attorney_name: string
          requested_by: string
          sageone_transaction_id: string | null
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
          matter_type: string
          payment_reference?: string | null
          pop_attachment_id?: string | null
          preferred_date_type: string
          processed_at?: string | null
          processed_by?: string | null
          province: string
          referring_attorney_id: string
          referring_attorney_name: string
          requested_by: string
          sageone_transaction_id?: string | null
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
          matter_type?: string
          payment_reference?: string | null
          pop_attachment_id?: string | null
          preferred_date_type?: string
          processed_at?: string | null
          processed_by?: string | null
          province?: string
          referring_attorney_id?: string
          referring_attorney_name?: string
          requested_by?: string
          sageone_transaction_id?: string | null
          special_requests?: string[] | null
          status?: string
          suggested_date?: string | null
          suggested_month?: string | null
          synced_appointment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_requests_pop_attachment_id_fkey"
            columns: ["pop_attachment_id"]
            isOneToOne: false
            referencedRelation: "payment_pop_attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_requests_synced_appointment_id_fkey"
            columns: ["synced_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_requests_synced_appointment_id_fkey"
            columns: ["synced_appointment_id"]
            isOneToOne: false
            referencedRelation: "deleted_appointments_view"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          agreement_duration_months: number | null
          appointment_date: string
          assessment_code: string | null
          assigned_attorney_contact_id: string | null
          case_status: string | null
          claimant_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deposit_amount: number | null
          discount_amount: number | null
          discount_rate: number | null
          discount_type: string | null
          expert_id: string
          id: string
          manually_reclassified_at: string | null
          manually_reclassified_by: string | null
          matter_type: string | null
          payment_date: string | null
          payment_status: string | null
          payment_terms: string | null
          reclassification_note: string | null
          referring_attorney: string
          referring_attorney_id: string
          sageone_transaction_id: string | null
          sales_consultant_id: string | null
          service_fee: number | null
          updated_at: string
        }
        Insert: {
          agreement_duration_months?: number | null
          appointment_date: string
          assessment_code?: string | null
          assigned_attorney_contact_id?: string | null
          case_status?: string | null
          claimant_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deposit_amount?: number | null
          discount_amount?: number | null
          discount_rate?: number | null
          discount_type?: string | null
          expert_id: string
          id?: string
          manually_reclassified_at?: string | null
          manually_reclassified_by?: string | null
          matter_type?: string | null
          payment_date?: string | null
          payment_status?: string | null
          payment_terms?: string | null
          reclassification_note?: string | null
          referring_attorney: string
          referring_attorney_id: string
          sageone_transaction_id?: string | null
          sales_consultant_id?: string | null
          service_fee?: number | null
          updated_at?: string
        }
        Update: {
          agreement_duration_months?: number | null
          appointment_date?: string
          assessment_code?: string | null
          assigned_attorney_contact_id?: string | null
          case_status?: string | null
          claimant_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deposit_amount?: number | null
          discount_amount?: number | null
          discount_rate?: number | null
          discount_type?: string | null
          expert_id?: string
          id?: string
          manually_reclassified_at?: string | null
          manually_reclassified_by?: string | null
          matter_type?: string | null
          payment_date?: string | null
          payment_status?: string | null
          payment_terms?: string | null
          reclassification_note?: string | null
          referring_attorney?: string
          referring_attorney_id?: string
          sageone_transaction_id?: string | null
          sales_consultant_id?: string | null
          service_fee?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_assigned_attorney_contact_id_fkey"
            columns: ["assigned_attorney_contact_id"]
            isOneToOne: false
            referencedRelation: "referring_attorney_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_claimant_id_fkey"
            columns: ["claimant_id"]
            isOneToOne: false
            referencedRelation: "claimants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "medical_experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_referring_attorney_id_fkey"
            columns: ["referring_attorney_id"]
            isOneToOne: false
            referencedRelation: "referring_attorneys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_sales_consultant_id_fkey"
            columns: ["sales_consultant_id"]
            isOneToOne: false
            referencedRelation: "sales_consultants"
            referencedColumns: ["id"]
          },
        ]
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
          matter_type_data: Json
          monthly_trends_data: Json
          pending_reports: number
          period_end: string
          period_start: string
          period_type: string
          referring_attorney_id: string
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
          matter_type_data?: Json
          monthly_trends_data?: Json
          pending_reports?: number
          period_end: string
          period_start: string
          period_type?: string
          referring_attorney_id: string
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
          matter_type_data?: Json
          monthly_trends_data?: Json
          pending_reports?: number
          period_end?: string
          period_start?: string
          period_type?: string
          referring_attorney_id?: string
          reports_taken_out?: number
          total_assessments?: number
        }
        Relationships: []
      }
      attorney_access_codes: {
        Row: {
          access_code: string
          access_count: number
          appointment_id: string
          created_at: string
          deactivated_at: string | null
          deactivation_reason: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          last_accessed_at: string | null
          referring_attorney_id: string
        }
        Insert: {
          access_code: string
          access_count?: number
          appointment_id: string
          created_at?: string
          deactivated_at?: string | null
          deactivation_reason?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          referring_attorney_id: string
        }
        Update: {
          access_code?: string
          access_count?: number
          appointment_id?: string
          created_at?: string
          deactivated_at?: string | null
          deactivation_reason?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          referring_attorney_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attorney_access_codes_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attorney_access_codes_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "deleted_appointments_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attorney_access_codes_referring_attorney_id_fkey"
            columns: ["referring_attorney_id"]
            isOneToOne: false
            referencedRelation: "referring_attorneys"
            referencedColumns: ["id"]
          },
        ]
      }
      attorney_marketing_emails: {
        Row: {
          attorney_name: string
          collected_at: string
          created_by: string | null
          email: string
          id: string
          source: string | null
          updated_at: string
        }
        Insert: {
          attorney_name: string
          collected_at?: string
          created_by?: string | null
          email: string
          id?: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          attorney_name?: string
          collected_at?: string
          created_by?: string | null
          email?: string
          id?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      attorney_pitchlog: {
        Row: {
          attorney_type: string
          comment: string | null
          comment_2: string | null
          consultant_id: string | null
          contact_person: string
          created_at: string | null
          created_by: string | null
          deal_closed: boolean | null
          deal_closed_date: string | null
          email: string | null
          follow_up_date: string | null
          id: string
          identified_challenge: string | null
          law_firm_name: string
          matched_referring_attorney_id: string | null
          meeting_function: string | null
          month_year: string
          pitch_status: string
          practice_area: string
          province: string
          sales_person: string
          telephone: string | null
          updated_at: string | null
        }
        Insert: {
          attorney_type: string
          comment?: string | null
          comment_2?: string | null
          consultant_id?: string | null
          contact_person: string
          created_at?: string | null
          created_by?: string | null
          deal_closed?: boolean | null
          deal_closed_date?: string | null
          email?: string | null
          follow_up_date?: string | null
          id?: string
          identified_challenge?: string | null
          law_firm_name: string
          matched_referring_attorney_id?: string | null
          meeting_function?: string | null
          month_year: string
          pitch_status?: string
          practice_area: string
          province: string
          sales_person: string
          telephone?: string | null
          updated_at?: string | null
        }
        Update: {
          attorney_type?: string
          comment?: string | null
          comment_2?: string | null
          consultant_id?: string | null
          contact_person?: string
          created_at?: string | null
          created_by?: string | null
          deal_closed?: boolean | null
          deal_closed_date?: string | null
          email?: string | null
          follow_up_date?: string | null
          id?: string
          identified_challenge?: string | null
          law_firm_name?: string
          matched_referring_attorney_id?: string | null
          meeting_function?: string | null
          month_year?: string
          pitch_status?: string
          practice_area?: string
          province?: string
          sales_person?: string
          telephone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attorney_pitchlog_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "sales_consultants"
            referencedColumns: ["id"]
          },
        ]
      }
      attorneys: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          law_firm: string | null
          location: string | null
          name: string
          phone: string | null
          referring_attorney_id: string | null
          specialization: string[] | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          law_firm?: string | null
          location?: string | null
          name: string
          phone?: string | null
          referring_attorney_id?: string | null
          specialization?: string[] | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          law_firm?: string | null
          location?: string | null
          name?: string
          phone?: string | null
          referring_attorney_id?: string | null
          specialization?: string[] | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attorneys_law_firm_id_fkey"
            columns: ["referring_attorney_id"]
            isOneToOne: false
            referencedRelation: "referring_attorneys"
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
        }
        Relationships: []
      }
      auth_activation_tokens: {
        Row: {
          consumed_at: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          token_hash: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          token_hash: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      auth_active_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip: string | null
          last_seen_at: string
          revoked_at: string | null
          revoked_reason: string | null
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          ip?: string | null
          last_seen_at?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip?: string | null
          last_seen_at?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      auth_audit_log: {
        Row: {
          browser: string | null
          created_at: string
          device: string | null
          event_type: string
          id: string
          ip: string | null
          metadata: Json
          os: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device?: string | null
          event_type: string
          id?: string
          ip?: string | null
          metadata?: Json
          os?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          created_at?: string
          device?: string | null
          event_type?: string
          id?: string
          ip?: string | null
          metadata?: Json
          os?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auth_events: {
        Row: {
          browser: string | null
          created_at: string
          device: string | null
          email: string | null
          event_type: string
          id: string
          ip: string | null
          metadata: Json
          os: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device?: string | null
          email?: string | null
          event_type: string
          id?: string
          ip?: string | null
          metadata?: Json
          os?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          created_at?: string
          device?: string | null
          email?: string | null
          event_type?: string
          id?: string
          ip?: string | null
          metadata?: Json
          os?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auth_login_otps: {
        Row: {
          attempt_count: number
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          otp_hash: string
          purpose: string
          resend_count: number
          superseded_at: string | null
          user_id: string
        }
        Insert: {
          attempt_count?: number
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          otp_hash: string
          purpose?: string
          resend_count?: number
          superseded_at?: string | null
          user_id: string
        }
        Update: {
          attempt_count?: number
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          otp_hash?: string
          purpose?: string
          resend_count?: number
          superseded_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      auth_otp_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          purpose: string
          resend_count: number
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          purpose: string
          resend_count?: number
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          purpose?: string
          resend_count?: number
          user_id?: string
        }
        Relationships: []
      }
      auth_password_reset_tokens: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          token_hash: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          token_hash: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      case_management_reports: {
        Row: {
          claimant_id: string
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          notes: string | null
          updated_at: string | null
          upload_date: string | null
          uploaded_by: string
        }
        Insert: {
          claimant_id: string
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
          upload_date?: string | null
          uploaded_by: string
        }
        Update: {
          claimant_id?: string
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
          upload_date?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_management_reports_claimant_id_fkey"
            columns: ["claimant_id"]
            isOneToOne: false
            referencedRelation: "claimants"
            referencedColumns: ["id"]
          },
        ]
      }
      case_sources: {
        Row: {
          appointment_id: string
          assessment_date: string
          created_at: string
          id: string
          referring_attorney_id: string
          source_details: string | null
          source_type: string
        }
        Insert: {
          appointment_id: string
          assessment_date: string
          created_at?: string
          id?: string
          referring_attorney_id: string
          source_details?: string | null
          source_type: string
        }
        Update: {
          appointment_id?: string
          assessment_date?: string
          created_at?: string
          id?: string
          referring_attorney_id?: string
          source_details?: string | null
          source_type?: string
        }
        Relationships: []
      }
      case_timelines: {
        Row: {
          appointment_id: string
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          phase_name: string
          phase_order: number
          referring_attorney_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          phase_name: string
          phase_order: number
          referring_attorney_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          phase_name?: string
          phase_order?: number
          referring_attorney_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_timelines_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_timelines_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "deleted_appointments_view"
            referencedColumns: ["id"]
          },
        ]
      }
      claimants: {
        Row: {
          auto_id: string
          contact_number: string | null
          created_at: string
          first_name: string
          id: string
          last_name: string
          referring_attorney_id: string
        }
        Insert: {
          auto_id: string
          contact_number?: string | null
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          referring_attorney_id: string
        }
        Update: {
          auto_id?: string
          contact_number?: string | null
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          referring_attorney_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claimants_law_firm_id_fkey"
            columns: ["referring_attorney_id"]
            isOneToOne: false
            referencedRelation: "referring_attorneys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_claimants_law_firm"
            columns: ["referring_attorney_id"]
            isOneToOne: false
            referencedRelation: "referring_attorneys"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_strike_history: {
        Row: {
          action: string
          consultant_id: string
          created_at: string
          id: string
          payout_month: number | null
          payout_year: number | null
          performed_by: string | null
          reason: string | null
          strike_id: string | null
          strike_type: string | null
        }
        Insert: {
          action: string
          consultant_id: string
          created_at?: string
          id?: string
          payout_month?: number | null
          payout_year?: number | null
          performed_by?: string | null
          reason?: string | null
          strike_id?: string | null
          strike_type?: string | null
        }
        Update: {
          action?: string
          consultant_id?: string
          created_at?: string
          id?: string
          payout_month?: number | null
          payout_year?: number | null
          performed_by?: string | null
          reason?: string | null
          strike_id?: string | null
          strike_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultant_strike_history_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "sales_consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_strike_history_strike_id_fkey"
            columns: ["strike_id"]
            isOneToOne: false
            referencedRelation: "consultant_strikes"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_strikes: {
        Row: {
          consultant_id: string
          created_at: string
          expired: boolean | null
          expiry_date: string
          id: string
          issued_date: string
          payout_month: number | null
          payout_year: number | null
          reason: string | null
          type: string
          updated_at: string
        }
        Insert: {
          consultant_id: string
          created_at?: string
          expired?: boolean | null
          expiry_date: string
          id?: string
          issued_date?: string
          payout_month?: number | null
          payout_year?: number | null
          reason?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          consultant_id?: string
          created_at?: string
          expired?: boolean | null
          expiry_date?: string
          id?: string
          issued_date?: string
          payout_month?: number | null
          payout_year?: number | null
          reason?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultant_strikes_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "sales_consultants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_checklist: {
        Row: {
          appointment_id: string | null
          claimant_id: string
          created_at: string
          document_id: string | null
          document_type: string
          id: string
          is_submitted: boolean
          notes: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          claimant_id: string
          created_at?: string
          document_id?: string | null
          document_type: string
          id?: string
          is_submitted?: boolean
          notes?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          claimant_id?: string
          created_at?: string
          document_id?: string | null
          document_type?: string
          id?: string
          is_submitted?: boolean
          notes?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_checklist_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_checklist_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "deleted_appointments_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_checklist_claimant_id_fkey"
            columns: ["claimant_id"]
            isOneToOne: false
            referencedRelation: "claimants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_checklist_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
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
          access_level: string
          appointment_id: string | null
          approval_status: string
          claimant_id: string | null
          created_at: string
          document_type: string
          expert_id: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          is_visible_to_attorney: boolean
          is_visible_to_expert: boolean
          notes: string | null
          referring_attorney_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          updated_at: string
          upload_date: string
          upload_time: string
          uploaded_by: string
        }
        Insert: {
          access_level?: string
          appointment_id?: string | null
          approval_status?: string
          claimant_id?: string | null
          created_at?: string
          document_type: string
          expert_id?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_visible_to_attorney?: boolean
          is_visible_to_expert?: boolean
          notes?: string | null
          referring_attorney_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
          upload_date?: string
          upload_time?: string
          uploaded_by: string
        }
        Update: {
          access_level?: string
          appointment_id?: string | null
          approval_status?: string
          claimant_id?: string | null
          created_at?: string
          document_type?: string
          expert_id?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_visible_to_attorney?: boolean
          is_visible_to_expert?: boolean
          notes?: string | null
          referring_attorney_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
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
            foreignKeyName: "documents_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "deleted_appointments_view"
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
            referencedRelation: "referring_attorneys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "access_compatibility_raw"
            referencedColumns: ["user_id"]
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
      email_queue: {
        Row: {
          created_at: string | null
          email_type: string
          error_message: string | null
          forward_notes: string | null
          forwarded_at: string | null
          forwarded_by: string | null
          forwarded_to: string | null
          html_content: string
          id: string
          is_read: boolean | null
          is_responded: boolean | null
          metadata: Json | null
          read_at: string | null
          read_by: string | null
          recipient_email: string
          recipient_name: string | null
          related_record_id: string | null
          related_table: string | null
          responded_at: string | null
          responded_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sent_at: string | null
          status: string | null
          subject: string
        }
        Insert: {
          created_at?: string | null
          email_type: string
          error_message?: string | null
          forward_notes?: string | null
          forwarded_at?: string | null
          forwarded_by?: string | null
          forwarded_to?: string | null
          html_content: string
          id?: string
          is_read?: boolean | null
          is_responded?: boolean | null
          metadata?: Json | null
          read_at?: string | null
          read_by?: string | null
          recipient_email: string
          recipient_name?: string | null
          related_record_id?: string | null
          related_table?: string | null
          responded_at?: string | null
          responded_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
        }
        Update: {
          created_at?: string | null
          email_type?: string
          error_message?: string | null
          forward_notes?: string | null
          forwarded_at?: string | null
          forwarded_by?: string | null
          forwarded_to?: string | null
          html_content?: string
          id?: string
          is_read?: boolean | null
          is_responded?: boolean | null
          metadata?: Json | null
          read_at?: string | null
          read_by?: string | null
          recipient_email?: string
          recipient_name?: string | null
          related_record_id?: string | null
          related_table?: string | null
          responded_at?: string | null
          responded_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
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
      epp_attorneys: {
        Row: {
          contact_person: string | null
          created_at: string
          email: string | null
          firm_name: string
          id: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          contact_person?: string | null
          created_at?: string
          email?: string | null
          firm_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          contact_person?: string | null
          created_at?: string
          email?: string | null
          firm_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      epp_claimants: {
        Row: {
          created_at: string
          full_name: string
          id: string
          id_number_masked: string | null
          reference: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          id_number_masked?: string | null
          reference?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          id_number_masked?: string | null
          reference?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      epp_experts: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          hpcsa_number: string | null
          id: string
          notes: string | null
          phone: string | null
          profession: string
          province: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          hpcsa_number?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          profession: string
          province?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          hpcsa_number?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          profession?: string
          province?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      epp_invoices: {
        Row: {
          amount: number
          amount_paid: number
          attorney_id: string
          claimant_id: string | null
          created_at: string
          expert_id: string
          id: string
          invoice_date: string
          invoice_number: string | null
          notes: string | null
          outstanding_balance: number
          payment_status: Database["public"]["Enums"]["epp_payment_status"]
          planned_payment_date: string | null
          priority: Database["public"]["Enums"]["epp_priority"]
          report_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          amount_paid?: number
          attorney_id: string
          claimant_id?: string | null
          created_at?: string
          expert_id: string
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          notes?: string | null
          outstanding_balance?: number
          payment_status?: Database["public"]["Enums"]["epp_payment_status"]
          planned_payment_date?: string | null
          priority?: Database["public"]["Enums"]["epp_priority"]
          report_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          attorney_id?: string
          claimant_id?: string | null
          created_at?: string
          expert_id?: string
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          notes?: string | null
          outstanding_balance?: number
          payment_status?: Database["public"]["Enums"]["epp_payment_status"]
          planned_payment_date?: string | null
          priority?: Database["public"]["Enums"]["epp_priority"]
          report_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epp_invoices_attorney_id_fkey"
            columns: ["attorney_id"]
            isOneToOne: false
            referencedRelation: "epp_attorneys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epp_invoices_claimant_id_fkey"
            columns: ["claimant_id"]
            isOneToOne: false
            referencedRelation: "epp_claimants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epp_invoices_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "epp_experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epp_invoices_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "epp_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      epp_reports: {
        Row: {
          attorney_id: string
          case_type: Database["public"]["Enums"]["epp_case_type"]
          claimant_id: string | null
          created_at: string
          date_taken_out: string
          expert_id: string
          id: string
          notes: string | null
          report_type: string
          status: Database["public"]["Enums"]["epp_report_status"]
          updated_at: string
        }
        Insert: {
          attorney_id: string
          case_type?: Database["public"]["Enums"]["epp_case_type"]
          claimant_id?: string | null
          created_at?: string
          date_taken_out?: string
          expert_id: string
          id?: string
          notes?: string | null
          report_type: string
          status?: Database["public"]["Enums"]["epp_report_status"]
          updated_at?: string
        }
        Update: {
          attorney_id?: string
          case_type?: Database["public"]["Enums"]["epp_case_type"]
          claimant_id?: string | null
          created_at?: string
          date_taken_out?: string
          expert_id?: string
          id?: string
          notes?: string | null
          report_type?: string
          status?: Database["public"]["Enums"]["epp_report_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epp_reports_attorney_id_fkey"
            columns: ["attorney_id"]
            isOneToOne: false
            referencedRelation: "epp_attorneys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epp_reports_claimant_id_fkey"
            columns: ["claimant_id"]
            isOneToOne: false
            referencedRelation: "epp_claimants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epp_reports_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "epp_experts"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_access_codes: {
        Row: {
          access_code: string
          access_count: number
          appointment_id: string
          created_at: string
          deactivated_at: string | null
          deactivation_reason: string | null
          expert_id: string
          expires_at: string
          id: string
          is_active: boolean
          last_accessed_at: string | null
        }
        Insert: {
          access_code: string
          access_count?: number
          appointment_id: string
          created_at?: string
          deactivated_at?: string | null
          deactivation_reason?: string | null
          expert_id: string
          expires_at?: string
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
        }
        Update: {
          access_code?: string
          access_count?: number
          appointment_id?: string
          created_at?: string
          deactivated_at?: string | null
          deactivation_reason?: string | null
          expert_id?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_access_codes_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_access_codes_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "deleted_appointments_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_access_codes_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "medical_experts"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_availability: {
        Row: {
          created_at: string | null
          date: string
          end_time: string | null
          expert_id: string
          id: string
          is_available: boolean | null
          notes: string | null
          start_time: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          end_time?: string | null
          expert_id: string
          id?: string
          is_available?: boolean | null
          notes?: string | null
          start_time?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          end_time?: string | null
          expert_id?: string
          id?: string
          is_available?: boolean | null
          notes?: string | null
          start_time?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_availability_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "medical_experts"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_fee_change_history: {
        Row: {
          changed_by: string | null
          changed_by_name: string | null
          created_at: string
          expert_id: string
          fee_field: string
          id: string
          new_value: number
          old_value: number | null
          source: string
        }
        Insert: {
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          expert_id: string
          fee_field: string
          id?: string
          new_value: number
          old_value?: number | null
          source?: string
        }
        Update: {
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          expert_id?: string
          fee_field?: string
          id?: string
          new_value?: number
          old_value?: number | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_fee_change_history_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "medical_experts"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_fee_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          expert_id: string
          fee_field: string
          id: string
          new_value: number | null
          old_value: number | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          expert_id: string
          fee_field: string
          id?: string
          new_value?: number | null
          old_value?: number | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          expert_id?: string
          fee_field?: string
          id?: string
          new_value?: number | null
          old_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_fee_history_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "medical_experts"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_fee_review_requests: {
        Row: {
          created_at: string
          current_value: number | null
          effective_date: string
          expert_id: string
          fee_field: string
          id: string
          proposed_value: number
          reason: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["fee_review_status"]
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_value?: number | null
          effective_date: string
          expert_id: string
          fee_field: string
          id?: string
          proposed_value: number
          reason: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["fee_review_status"]
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_value?: number | null
          effective_date?: string
          expert_id?: string
          fee_field?: string
          id?: string
          proposed_value?: number
          reason?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["fee_review_status"]
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_fee_review_requests_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "medical_experts"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_payment_planner_snapshots: {
        Row: {
          approval_note: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          entries: Json
          filters: Json
          id: string
          label: string
          last_reminder_sent_at: string | null
          reminder_count: number
          submitted_by: string | null
          submitted_by_id: string | null
          submitted_for_approval_at: string | null
          totals: Json
          updated_at: string
        }
        Insert: {
          approval_note?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          entries?: Json
          filters?: Json
          id: string
          label: string
          last_reminder_sent_at?: string | null
          reminder_count?: number
          submitted_by?: string | null
          submitted_by_id?: string | null
          submitted_for_approval_at?: string | null
          totals?: Json
          updated_at?: string
        }
        Update: {
          approval_note?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          entries?: Json
          filters?: Json
          id?: string
          label?: string
          last_reminder_sent_at?: string | null
          reminder_count?: number
          submitted_by?: string | null
          submitted_by_id?: string | null
          submitted_for_approval_at?: string | null
          totals?: Json
          updated_at?: string
        }
        Relationships: []
      }
      expert_payments: {
        Row: {
          appointment_id: string
          created_at: string
          expert_id: string
          id: string
          payment_amount: number
          payment_date: string
          payment_notes: string | null
          payment_reference: string | null
          pop_attachment_id: string | null
          pop_file_name: string | null
          pop_url: string | null
          recorded_by: string | null
          sageone_transaction_id: string | null
          updated_at: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          expert_id: string
          id?: string
          payment_amount: number
          payment_date?: string
          payment_notes?: string | null
          payment_reference?: string | null
          pop_attachment_id?: string | null
          pop_file_name?: string | null
          pop_url?: string | null
          recorded_by?: string | null
          sageone_transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          expert_id?: string
          id?: string
          payment_amount?: number
          payment_date?: string
          payment_notes?: string | null
          payment_reference?: string | null
          pop_attachment_id?: string | null
          pop_file_name?: string | null
          pop_url?: string | null
          recorded_by?: string | null
          sageone_transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "deleted_appointments_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_payments_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "medical_experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_payments_pop_attachment_id_fkey"
            columns: ["pop_attachment_id"]
            isOneToOne: false
            referencedRelation: "payment_pop_attachments"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_private_sessions: {
        Row: {
          client_name: string | null
          created_at: string
          created_by: string | null
          end_time: string | null
          expert_id: string
          fee: number | null
          id: string
          location: string | null
          notes: string | null
          paid: boolean
          session_date: string
          start_time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          expert_id: string
          fee?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          paid?: boolean
          session_date: string
          start_time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          expert_id?: string
          fee?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          paid?: boolean
          session_date?: string
          start_time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_private_sessions_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "medical_experts"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "expert_reports_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "deleted_appointments_view"
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
      external_portal_access_links: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          ip_address: string | null
          revoked_at: string | null
          revoked_reason: string | null
          sent_to_email: string | null
          status: Database["public"]["Enums"]["external_portal_link_status"]
          token_hash: string
          used_at: string | null
          user_agent: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          sent_to_email?: string | null
          status?: Database["public"]["Enums"]["external_portal_link_status"]
          token_hash: string
          used_at?: string | null
          user_agent?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          sent_to_email?: string | null
          status?: Database["public"]["Enums"]["external_portal_link_status"]
          token_hash?: string
          used_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_portal_access_links_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "external_portal_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      external_portal_account_access: {
        Row: {
          created_at: string
          external_account_id: string
          firm_scope: string | null
          id: string
          portal_viewer_ref_id: string
          portal_viewer_type: string
        }
        Insert: {
          created_at?: string
          external_account_id: string
          firm_scope?: string | null
          id?: string
          portal_viewer_ref_id: string
          portal_viewer_type: string
        }
        Update: {
          created_at?: string
          external_account_id?: string
          firm_scope?: string | null
          id?: string
          portal_viewer_ref_id?: string
          portal_viewer_type?: string
        }
        Relationships: []
      }
      external_portal_account_emails: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          email: string
          id: string
          is_current: boolean
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          is_current?: boolean
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          is_current?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "external_portal_account_emails_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "external_portal_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      external_portal_accounts: {
        Row: {
          account_scope:
            | Database["public"]["Enums"]["external_portal_account_scope"]
            | null
          assigned_attorney_contact_id: string | null
          auth_user_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string
          expired_at: string | null
          expired_reason: string | null
          full_name: string
          id: string
          last_login_at: string | null
          last_login_ip: string | null
          medical_expert_id: string | null
          notes: string | null
          paused_at: string | null
          paused_reason: string | null
          phone: string | null
          portal_type: Database["public"]["Enums"]["external_portal_type"]
          referring_attorney_id: string | null
          registered_at: string | null
          status: Database["public"]["Enums"]["external_portal_account_status"]
          updated_at: string
        }
        Insert: {
          account_scope?:
            | Database["public"]["Enums"]["external_portal_account_scope"]
            | null
          assigned_attorney_contact_id?: string | null
          auth_user_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email: string
          expired_at?: string | null
          expired_reason?: string | null
          full_name: string
          id?: string
          last_login_at?: string | null
          last_login_ip?: string | null
          medical_expert_id?: string | null
          notes?: string | null
          paused_at?: string | null
          paused_reason?: string | null
          phone?: string | null
          portal_type: Database["public"]["Enums"]["external_portal_type"]
          referring_attorney_id?: string | null
          registered_at?: string | null
          status?: Database["public"]["Enums"]["external_portal_account_status"]
          updated_at?: string
        }
        Update: {
          account_scope?:
            | Database["public"]["Enums"]["external_portal_account_scope"]
            | null
          assigned_attorney_contact_id?: string | null
          auth_user_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          expired_at?: string | null
          expired_reason?: string | null
          full_name?: string
          id?: string
          last_login_at?: string | null
          last_login_ip?: string | null
          medical_expert_id?: string | null
          notes?: string | null
          paused_at?: string | null
          paused_reason?: string | null
          phone?: string | null
          portal_type?: Database["public"]["Enums"]["external_portal_type"]
          referring_attorney_id?: string | null
          registered_at?: string | null
          status?: Database["public"]["Enums"]["external_portal_account_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_portal_accounts_assigned_attorney_contact_id_fkey"
            columns: ["assigned_attorney_contact_id"]
            isOneToOne: false
            referencedRelation: "referring_attorney_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_portal_accounts_medical_expert_id_fkey"
            columns: ["medical_expert_id"]
            isOneToOne: false
            referencedRelation: "medical_experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_portal_accounts_referring_attorney_id_fkey"
            columns: ["referring_attorney_id"]
            isOneToOne: false
            referencedRelation: "referring_attorneys"
            referencedColumns: ["id"]
          },
        ]
      }
      external_portal_agreement_payments: {
        Row: {
          aod_document_id: string | null
          id: string
          payment_amount: number | null
          payment_date: string | null
          payment_notes: string | null
          payment_type: string | null
        }
        Insert: {
          aod_document_id?: string | null
          id: string
          payment_amount?: number | null
          payment_date?: string | null
          payment_notes?: string | null
          payment_type?: string | null
        }
        Update: {
          aod_document_id?: string | null
          id?: string
          payment_amount?: number | null
          payment_date?: string | null
          payment_notes?: string | null
          payment_type?: string | null
        }
        Relationships: []
      }
      external_portal_agreements: {
        Row: {
          contract_end_date: string | null
          contract_start_date: string | null
          created_at: string | null
          deposit_amount: number | null
          document_url: string | null
          file_name: string | null
          id: string
          next_payment_date: string | null
          payment_status: string | null
          referring_attorney_id: string | null
          total_contract_value: number | null
          total_reports_agreed: number | null
        }
        Insert: {
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          document_url?: string | null
          file_name?: string | null
          id: string
          next_payment_date?: string | null
          payment_status?: string | null
          referring_attorney_id?: string | null
          total_contract_value?: number | null
          total_reports_agreed?: number | null
        }
        Update: {
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          document_url?: string | null
          file_name?: string | null
          id?: string
          next_payment_date?: string | null
          payment_status?: string | null
          referring_attorney_id?: string | null
          total_contract_value?: number | null
          total_reports_agreed?: number | null
        }
        Relationships: []
      }
      external_portal_audit_logs: {
        Row: {
          account_id: string | null
          action: string
          actor_id: string | null
          actor_type: string
          details: Json
          id: string
          ip_address: string | null
          occurred_at: string
        }
        Insert: {
          account_id?: string | null
          action: string
          actor_id?: string | null
          actor_type?: string
          details?: Json
          id?: string
          ip_address?: string | null
          occurred_at?: string
        }
        Update: {
          account_id?: string | null
          action?: string
          actor_id?: string | null
          actor_type?: string
          details?: Json
          id?: string
          ip_address?: string | null
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_portal_audit_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "external_portal_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      external_portal_case_documents: {
        Row: {
          appointment_id: string
          created_at: string
          document_id: string
          document_type: string | null
          file_name: string
          file_path: string
          id: string
          is_visible_to_attorney: boolean
          is_visible_to_expert: boolean
          upload_date: string | null
          upload_time: string | null
        }
        Insert: {
          appointment_id: string
          created_at?: string
          document_id: string
          document_type?: string | null
          file_name: string
          file_path: string
          id?: string
          is_visible_to_attorney?: boolean
          is_visible_to_expert?: boolean
          upload_date?: string | null
          upload_time?: string | null
        }
        Update: {
          appointment_id?: string
          created_at?: string
          document_id?: string
          document_type?: string | null
          file_name?: string
          file_path?: string
          id?: string
          is_visible_to_attorney?: boolean
          is_visible_to_expert?: boolean
          upload_date?: string | null
          upload_time?: string | null
        }
        Relationships: []
      }
      external_portal_case_events: {
        Row: {
          appointment_id: string
          completed_at: string | null
          created_at: string
          id: string
          phase_name: string
          phase_order: number | null
          started_at: string | null
          status: string | null
          timeline_id: string | null
        }
        Insert: {
          appointment_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          phase_name: string
          phase_order?: number | null
          started_at?: string | null
          status?: string | null
          timeline_id?: string | null
        }
        Update: {
          appointment_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          phase_name?: string
          phase_order?: number | null
          started_at?: string | null
          status?: string | null
          timeline_id?: string | null
        }
        Relationships: []
      }
      external_portal_case_links: {
        Row: {
          account_id: string
          appointment_id: string
          granted_at: string
          granted_by: string | null
          id: string
          revoked_at: string | null
        }
        Insert: {
          account_id: string
          appointment_id: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
        }
        Update: {
          account_id?: string
          appointment_id?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_portal_case_links_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "external_portal_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_portal_case_links_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_portal_case_links_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "deleted_appointments_view"
            referencedColumns: ["id"]
          },
        ]
      }
      external_portal_case_messages: {
        Row: {
          account_id: string
          appointment_id: string
          body: string
          created_at: string
          id: string
          read_by_admin_at: string | null
          read_by_external_at: string | null
          sender_staff_id: string | null
          sender_type: string
        }
        Insert: {
          account_id: string
          appointment_id: string
          body: string
          created_at?: string
          id?: string
          read_by_admin_at?: string | null
          read_by_external_at?: string | null
          sender_staff_id?: string | null
          sender_type: string
        }
        Update: {
          account_id?: string
          appointment_id?: string
          body?: string
          created_at?: string
          id?: string
          read_by_admin_at?: string | null
          read_by_external_at?: string | null
          sender_staff_id?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_portal_case_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "external_portal_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_portal_case_messages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_portal_case_messages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "deleted_appointments_view"
            referencedColumns: ["id"]
          },
        ]
      }
      external_portal_cases: {
        Row: {
          appointment_date: string | null
          appointment_id: string
          assessment_code: string | null
          assigned_attorney_contact_id: string | null
          case_status: string | null
          claimant_auto_id: string | null
          claimant_contact_number: string | null
          claimant_first_name: string | null
          claimant_id: string | null
          claimant_last_name: string | null
          created_at: string
          deleted_at: string | null
          deposit_amount: number | null
          expert_first_name: string | null
          expert_id: string | null
          expert_last_name: string | null
          expert_practice_address: string | null
          expert_type: string | null
          id: string
          matter_type: string | null
          payment_date: string | null
          payment_status: string | null
          referring_attorney_contact_person: string | null
          referring_attorney_email: string | null
          referring_attorney_id: string | null
          referring_attorney_name: string | null
          referring_attorney_phone: string | null
          service_fee: number | null
          updated_at: string
        }
        Insert: {
          appointment_date?: string | null
          appointment_id: string
          assessment_code?: string | null
          assigned_attorney_contact_id?: string | null
          case_status?: string | null
          claimant_auto_id?: string | null
          claimant_contact_number?: string | null
          claimant_first_name?: string | null
          claimant_id?: string | null
          claimant_last_name?: string | null
          created_at?: string
          deleted_at?: string | null
          deposit_amount?: number | null
          expert_first_name?: string | null
          expert_id?: string | null
          expert_last_name?: string | null
          expert_practice_address?: string | null
          expert_type?: string | null
          id?: string
          matter_type?: string | null
          payment_date?: string | null
          payment_status?: string | null
          referring_attorney_contact_person?: string | null
          referring_attorney_email?: string | null
          referring_attorney_id?: string | null
          referring_attorney_name?: string | null
          referring_attorney_phone?: string | null
          service_fee?: number | null
          updated_at?: string
        }
        Update: {
          appointment_date?: string | null
          appointment_id?: string
          assessment_code?: string | null
          assigned_attorney_contact_id?: string | null
          case_status?: string | null
          claimant_auto_id?: string | null
          claimant_contact_number?: string | null
          claimant_first_name?: string | null
          claimant_id?: string | null
          claimant_last_name?: string | null
          created_at?: string
          deleted_at?: string | null
          deposit_amount?: number | null
          expert_first_name?: string | null
          expert_id?: string | null
          expert_last_name?: string | null
          expert_practice_address?: string | null
          expert_type?: string | null
          id?: string
          matter_type?: string | null
          payment_date?: string | null
          payment_status?: string | null
          referring_attorney_contact_person?: string | null
          referring_attorney_email?: string | null
          referring_attorney_id?: string | null
          referring_attorney_name?: string | null
          referring_attorney_phone?: string | null
          service_fee?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_portal_cases_assigned_attorney_contact_id_fkey"
            columns: ["assigned_attorney_contact_id"]
            isOneToOne: false
            referencedRelation: "referring_attorney_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_portal_cases_claimant_id_fkey"
            columns: ["claimant_id"]
            isOneToOne: false
            referencedRelation: "claimants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_portal_cases_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "medical_experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_portal_cases_referring_attorney_id_fkey"
            columns: ["referring_attorney_id"]
            isOneToOne: false
            referencedRelation: "referring_attorneys"
            referencedColumns: ["id"]
          },
        ]
      }
      external_portal_litigation_requests: {
        Row: {
          case_reference: string | null
          claimant_name: string | null
          completed_at: string | null
          description: string | null
          id: string
          referring_attorney_id: string | null
          requested_at: string | null
          requested_by: string | null
          response_document_name: string | null
          response_document_path: string | null
          response_document_uploaded_at: string | null
          service_type: string | null
          status: string | null
          urgency: string | null
        }
        Insert: {
          case_reference?: string | null
          claimant_name?: string | null
          completed_at?: string | null
          description?: string | null
          id: string
          referring_attorney_id?: string | null
          requested_at?: string | null
          requested_by?: string | null
          response_document_name?: string | null
          response_document_path?: string | null
          response_document_uploaded_at?: string | null
          service_type?: string | null
          status?: string | null
          urgency?: string | null
        }
        Update: {
          case_reference?: string | null
          claimant_name?: string | null
          completed_at?: string | null
          description?: string | null
          id?: string
          referring_attorney_id?: string | null
          requested_at?: string | null
          requested_by?: string | null
          response_document_name?: string | null
          response_document_path?: string | null
          response_document_uploaded_at?: string | null
          service_type?: string | null
          status?: string | null
          urgency?: string | null
        }
        Relationships: []
      }
      external_portal_login_history: {
        Row: {
          account_id: string | null
          email_attempted: string | null
          event_type: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          occurred_at: string
          success: boolean
          user_agent: string | null
        }
        Insert: {
          account_id?: string | null
          email_attempted?: string | null
          event_type: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          occurred_at?: string
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          account_id?: string | null
          email_attempted?: string | null
          event_type?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          occurred_at?: string
          success?: boolean
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_portal_login_history_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "external_portal_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      external_portal_messages: {
        Row: {
          account_id: string
          appointment_id: string | null
          body: string
          created_at: string
          id: string
          read_by_external_at: string | null
          read_by_staff_at: string | null
          sender_name: string
          sender_type: string
          sender_user_id: string | null
        }
        Insert: {
          account_id: string
          appointment_id?: string | null
          body: string
          created_at?: string
          id?: string
          read_by_external_at?: string | null
          read_by_staff_at?: string | null
          sender_name: string
          sender_type: string
          sender_user_id?: string | null
        }
        Update: {
          account_id?: string
          appointment_id?: string | null
          body?: string
          created_at?: string
          id?: string
          read_by_external_at?: string | null
          read_by_staff_at?: string | null
          sender_name?: string
          sender_type?: string
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_portal_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "external_portal_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_portal_messages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_portal_messages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "deleted_appointments_view"
            referencedColumns: ["id"]
          },
        ]
      }
      external_portal_notifications: {
        Row: {
          account_id: string
          appointment_id: string | null
          category: string
          created_at: string
          id: string
          message: string
          read_at: string | null
          title: string
        }
        Insert: {
          account_id: string
          appointment_id?: string | null
          category?: string
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          title: string
        }
        Update: {
          account_id?: string
          appointment_id?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_portal_notifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "external_portal_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_portal_notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_portal_notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "deleted_appointments_view"
            referencedColumns: ["id"]
          },
        ]
      }
      external_portal_otp_codes: {
        Row: {
          access_link_id: string | null
          account_id: string
          attempts: number
          code_hash: string
          created_at: string
          destination: string
          expires_at: string
          id: string
          ip_address: string | null
          max_attempts: number
          purpose: Database["public"]["Enums"]["external_portal_otp_purpose"]
          user_agent: string | null
          verified_at: string | null
        }
        Insert: {
          access_link_id?: string | null
          account_id: string
          attempts?: number
          code_hash: string
          created_at?: string
          destination: string
          expires_at: string
          id?: string
          ip_address?: string | null
          max_attempts?: number
          purpose: Database["public"]["Enums"]["external_portal_otp_purpose"]
          user_agent?: string | null
          verified_at?: string | null
        }
        Update: {
          access_link_id?: string | null
          account_id?: string
          attempts?: number
          code_hash?: string
          created_at?: string
          destination?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          max_attempts?: number
          purpose?: Database["public"]["Enums"]["external_portal_otp_purpose"]
          user_agent?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_portal_otp_codes_access_link_id_fkey"
            columns: ["access_link_id"]
            isOneToOne: false
            referencedRelation: "external_portal_access_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_portal_otp_codes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "external_portal_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      external_portal_sessions: {
        Row: {
          account_id: string
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          last_seen_at: string
          revoked_at: string | null
          revoked_reason: string | null
          session_token_hash: string
          user_agent: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          expires_at: string
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          session_token_hash: string
          user_agent?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          session_token_hash?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_portal_sessions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "external_portal_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      external_portal_settings: {
        Row: {
          access_link_expiry_hours: number
          auto_expire_on_all_cases_closed: boolean
          id: number
          otp_expiry_minutes: number
          otp_length: number
          otp_max_attempts: number
          session_expiry_hours: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          access_link_expiry_hours?: number
          auto_expire_on_all_cases_closed?: boolean
          id?: number
          otp_expiry_minutes?: number
          otp_length?: number
          otp_max_attempts?: number
          session_expiry_hours?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          access_link_expiry_hours?: number
          auto_expire_on_all_cases_closed?: boolean
          id?: number
          otp_expiry_minutes?: number
          otp_length?: number
          otp_max_attempts?: number
          session_expiry_hours?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      faq_articles: {
        Row: {
          answer: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean | null
          question: string
          sort_order: number | null
          target_audience: string
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean | null
          question: string
          sort_order?: number | null
          target_audience?: string
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean | null
          question?: string
          sort_order?: number | null
          target_audience?: string
          updated_at?: string
        }
        Relationships: []
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
      grouped_email_log: {
        Row: {
          appointment_date: string
          appointment_ids: string[]
          created_at: string
          email_sent_to: string
          id: string
          referring_attorney_id: string
          sent_at: string
        }
        Insert: {
          appointment_date: string
          appointment_ids: string[]
          created_at?: string
          email_sent_to: string
          id?: string
          referring_attorney_id: string
          sent_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_ids?: string[]
          created_at?: string
          email_sent_to?: string
          id?: string
          referring_attorney_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grouped_email_log_referring_attorney_id_fkey"
            columns: ["referring_attorney_id"]
            isOneToOne: false
            referencedRelation: "referring_attorneys"
            referencedColumns: ["id"]
          },
        ]
      }
      incentive_tiers: {
        Row: {
          created_at: string
          id: string
          label: string | null
          max_appointments: number | null
          medneg_amount: number
          min_appointments: number
          raf_amount: number
          tier_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          max_appointments?: number | null
          medneg_amount?: number
          min_appointments: number
          raf_amount?: number
          tier_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          max_appointments?: number | null
          medneg_amount?: number
          min_appointments?: number
          raf_amount?: number
          tier_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      internal_chat_acknowledgements: {
        Row: {
          acknowledged_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_acknowledgements_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "internal_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_chat_conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          kind: string
          last_message_at: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          kind?: string
          last_message_at?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          last_message_at?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      internal_chat_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          id: string
          requires_acknowledgement: boolean
          sender_id: string
          updated_at: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          requires_acknowledgement?: boolean
          sender_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          requires_acknowledgement?: boolean
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "internal_chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_chat_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "internal_chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_invoice_delivery_queue: {
        Row: {
          attempts: number
          claimed_at: string | null
          created_at: string
          id: string
          internal_invoice_id: string
          last_error: string | null
          processed_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          id?: string
          internal_invoice_id: string
          last_error?: string | null
          processed_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          id?: string
          internal_invoice_id?: string
          last_error?: string | null
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_invoice_delivery_queue_internal_invoice_id_fkey"
            columns: ["internal_invoice_id"]
            isOneToOne: false
            referencedRelation: "internal_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_invoice_email_log: {
        Row: {
          created_at: string
          id: string
          internal_invoice_id: string
          recipient_email: string
          resend_message_id: string | null
          sent_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          internal_invoice_id: string
          recipient_email: string
          resend_message_id?: string | null
          sent_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          internal_invoice_id?: string
          recipient_email?: string
          resend_message_id?: string | null
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_invoice_email_log_internal_invoice_id_fkey"
            columns: ["internal_invoice_id"]
            isOneToOne: true
            referencedRelation: "internal_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_invoice_events: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          internal_invoice_id: string
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          internal_invoice_id: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          internal_invoice_id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_invoice_events_internal_invoice_id_fkey"
            columns: ["internal_invoice_id"]
            isOneToOne: false
            referencedRelation: "internal_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_invoices: {
        Row: {
          amount: number
          appointment_id: string
          claimant_id: string | null
          created_at: string
          due_date: string | null
          expert_id: string | null
          id: string
          invoice_date: string
          invoice_number: string
          needs_review_flagged_at: string | null
          needs_review_reason: string | null
          reactivated_at: string | null
          reactivation_count: number
          referring_attorney_id: string | null
          status: string
          total_amount: number
          updated_at: string
          vat_amount: number
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          amount: number
          appointment_id: string
          claimant_id?: string | null
          created_at?: string
          due_date?: string | null
          expert_id?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          needs_review_flagged_at?: string | null
          needs_review_reason?: string | null
          reactivated_at?: string | null
          reactivation_count?: number
          referring_attorney_id?: string | null
          status?: string
          total_amount: number
          updated_at?: string
          vat_amount: number
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          amount?: number
          appointment_id?: string
          claimant_id?: string | null
          created_at?: string
          due_date?: string | null
          expert_id?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          needs_review_flagged_at?: string | null
          needs_review_reason?: string | null
          reactivated_at?: string | null
          reactivation_count?: number
          referring_attorney_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_invoices_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_invoices_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "deleted_appointments_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_invoices_claimant_id_fkey"
            columns: ["claimant_id"]
            isOneToOne: false
            referencedRelation: "claimants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_invoices_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "medical_experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_invoices_referring_attorney_id_fkey"
            columns: ["referring_attorney_id"]
            isOneToOne: false
            referencedRelation: "referring_attorneys"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_sage_queue: {
        Row: {
          attempts: number
          claimed_at: string | null
          created_at: string
          id: string
          internal_invoice_id: string
          last_error: string | null
          processed_at: string | null
          sage_reference: string | null
          status: string
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          id?: string
          internal_invoice_id: string
          last_error?: string | null
          processed_at?: string | null
          sage_reference?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          id?: string
          internal_invoice_id?: string
          last_error?: string | null
          processed_at?: string | null
          sage_reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_sage_queue_internal_invoice_id_fkey"
            columns: ["internal_invoice_id"]
            isOneToOne: true
            referencedRelation: "internal_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_search_history: {
        Row: {
          created_by: string | null
          id: string
          lead_type: string
          province: string
          results_found: number
          search_date: string
          search_query: string
        }
        Insert: {
          created_by?: string | null
          id?: string
          lead_type: string
          province: string
          results_found?: number
          search_date?: string
          search_query: string
        }
        Update: {
          created_by?: string | null
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
          created_by: string | null
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
          created_by?: string | null
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
          created_by?: string | null
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
      litigation_service_requests: {
        Row: {
          case_reference: string | null
          claimant_name: string
          completed_at: string | null
          description: string | null
          id: string
          notes: string | null
          referring_attorney_id: string | null
          requested_at: string
          requested_by: string | null
          response_document_name: string | null
          response_document_path: string | null
          response_document_uploaded_at: string | null
          response_document_uploaded_by: string | null
          service_type: string
          status: string
          trial_date: string | null
          updated_at: string
          urgency: string
        }
        Insert: {
          case_reference?: string | null
          claimant_name: string
          completed_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          referring_attorney_id?: string | null
          requested_at?: string
          requested_by?: string | null
          response_document_name?: string | null
          response_document_path?: string | null
          response_document_uploaded_at?: string | null
          response_document_uploaded_by?: string | null
          service_type: string
          status?: string
          trial_date?: string | null
          updated_at?: string
          urgency?: string
        }
        Update: {
          case_reference?: string | null
          claimant_name?: string
          completed_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          referring_attorney_id?: string | null
          requested_at?: string
          requested_by?: string | null
          response_document_name?: string | null
          response_document_path?: string | null
          response_document_uploaded_at?: string | null
          response_document_uploaded_by?: string | null
          service_type?: string
          status?: string
          trial_date?: string | null
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "litigation_service_requests_referring_attorney_id_fkey"
            columns: ["referring_attorney_id"]
            isOneToOne: false
            referencedRelation: "referring_attorneys"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_experts: {
        Row: {
          addendum_fees: number | null
          affidavit_fees: number | null
          assessment_turnaround_days: number | null
          availability_notes: string | null
          city: string | null
          consultation_fee_med_neg: number | null
          consultation_fee_mva: number | null
          consultation_fee_per_hour: number | null
          consultation_fees: number | null
          contact_number: string | null
          court_fees: number | null
          created_at: string
          cv_document_url: string | null
          email: string | null
          expert_type: string
          first_name: string
          hpcsa_document_url: string | null
          hpcsa_number: string | null
          id: string
          joint_minutes_fees: number | null
          languages: string[] | null
          last_name: string
          matter_types: string[] | null
          medico_legal_only: boolean | null
          medico_legal_years_experience: number | null
          merit_fees: number | null
          personal_assistant_contact: string | null
          personal_assistant_name: string | null
          practice_address: string | null
          practice_company_name: string | null
          practice_number: string | null
          province: string
          qualifications: string | null
          qualifications_document_url: string | null
          report_turnaround_days: number | null
          specializations: string[] | null
          status: string | null
          updated_at: string
          virtual_assessment: boolean | null
          years_experience: number | null
        }
        Insert: {
          addendum_fees?: number | null
          affidavit_fees?: number | null
          assessment_turnaround_days?: number | null
          availability_notes?: string | null
          city?: string | null
          consultation_fee_med_neg?: number | null
          consultation_fee_mva?: number | null
          consultation_fee_per_hour?: number | null
          consultation_fees?: number | null
          contact_number?: string | null
          court_fees?: number | null
          created_at?: string
          cv_document_url?: string | null
          email?: string | null
          expert_type: string
          first_name: string
          hpcsa_document_url?: string | null
          hpcsa_number?: string | null
          id?: string
          joint_minutes_fees?: number | null
          languages?: string[] | null
          last_name: string
          matter_types?: string[] | null
          medico_legal_only?: boolean | null
          medico_legal_years_experience?: number | null
          merit_fees?: number | null
          personal_assistant_contact?: string | null
          personal_assistant_name?: string | null
          practice_address?: string | null
          practice_company_name?: string | null
          practice_number?: string | null
          province: string
          qualifications?: string | null
          qualifications_document_url?: string | null
          report_turnaround_days?: number | null
          specializations?: string[] | null
          status?: string | null
          updated_at?: string
          virtual_assessment?: boolean | null
          years_experience?: number | null
        }
        Update: {
          addendum_fees?: number | null
          affidavit_fees?: number | null
          assessment_turnaround_days?: number | null
          availability_notes?: string | null
          city?: string | null
          consultation_fee_med_neg?: number | null
          consultation_fee_mva?: number | null
          consultation_fee_per_hour?: number | null
          consultation_fees?: number | null
          contact_number?: string | null
          court_fees?: number | null
          created_at?: string
          cv_document_url?: string | null
          email?: string | null
          expert_type?: string
          first_name?: string
          hpcsa_document_url?: string | null
          hpcsa_number?: string | null
          id?: string
          joint_minutes_fees?: number | null
          languages?: string[] | null
          last_name?: string
          matter_types?: string[] | null
          medico_legal_only?: boolean | null
          medico_legal_years_experience?: number | null
          merit_fees?: number | null
          personal_assistant_contact?: string | null
          personal_assistant_name?: string | null
          practice_address?: string | null
          practice_company_name?: string | null
          practice_number?: string | null
          province?: string
          qualifications?: string | null
          qualifications_document_url?: string | null
          report_turnaround_days?: number | null
          specializations?: string[] | null
          status?: string | null
          updated_at?: string
          virtual_assessment?: boolean | null
          years_experience?: number | null
        }
        Relationships: []
      }
      monthly_performance: {
        Row: {
          consultant_id: string
          created_at: string
          id: string
          incentive_earned: number | null
          medneg_appts: number
          medneg_incentive_earned: number | null
          month: number
          raf_appts: number
          raf_incentive_earned: number | null
          target_met: boolean | null
          total_appts: number
          updated_at: string
          warning_issued: boolean | null
          year: number
        }
        Insert: {
          consultant_id: string
          created_at?: string
          id?: string
          incentive_earned?: number | null
          medneg_appts?: number
          medneg_incentive_earned?: number | null
          month: number
          raf_appts?: number
          raf_incentive_earned?: number | null
          target_met?: boolean | null
          total_appts?: number
          updated_at?: string
          warning_issued?: boolean | null
          year: number
        }
        Update: {
          consultant_id?: string
          created_at?: string
          id?: string
          incentive_earned?: number | null
          medneg_appts?: number
          medneg_incentive_earned?: number | null
          month?: number
          raf_appts?: number
          raf_incentive_earned?: number | null
          target_met?: boolean | null
          total_appts?: number
          updated_at?: string
          warning_issued?: boolean | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_performance_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "sales_consultants"
            referencedColumns: ["id"]
          },
        ]
      }
      negligence_analysis_history: {
        Row: {
          ai_opinion: string | null
          analysis_result: Json
          case_id: string | null
          claimant_id: string | null
          created_at: string
          evidence_count: number
          file_name: string
          file_size: number | null
          file_type: string
          final_opinion: string | null
          id: string
          indicator_count: number
          overall_severity: string
          processing_time: number
          recommendation_count: number
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_opinion?: string | null
          analysis_result: Json
          case_id?: string | null
          claimant_id?: string | null
          created_at?: string
          evidence_count?: number
          file_name: string
          file_size?: number | null
          file_type: string
          final_opinion?: string | null
          id?: string
          indicator_count?: number
          overall_severity: string
          processing_time: number
          recommendation_count?: number
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_opinion?: string | null
          analysis_result?: Json
          case_id?: string | null
          claimant_id?: string | null
          created_at?: string
          evidence_count?: number
          file_name?: string
          file_size?: number | null
          file_type?: string
          final_opinion?: string | null
          id?: string
          indicator_count?: number
          overall_severity?: string
          processing_time?: number
          recommendation_count?: number
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "negligence_analysis_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negligence_analysis_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "deleted_appointments_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negligence_analysis_history_claimant_id_fkey"
            columns: ["claimant_id"]
            isOneToOne: false
            referencedRelation: "claimants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          category: string | null
          created_at: string
          email_sent: boolean | null
          id: string
          is_read: boolean
          message: string
          read_at: string | null
          related_record_id: string | null
          related_table: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          email_sent?: boolean | null
          id?: string
          is_read?: boolean
          message: string
          read_at?: string | null
          related_record_id?: string | null
          related_table?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          email_sent?: boolean | null
          id?: string
          is_read?: boolean
          message?: string
          read_at?: string | null
          related_record_id?: string | null
          related_table?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          token_hash: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          token_hash: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_pop_attachments: {
        Row: {
          created_at: string
          file_name: string | null
          file_path: string
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          notes: string | null
          payment_reference: string
          record_id: string
          record_type: string
          sageone_transaction_id: string | null
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_path: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          payment_reference: string
          record_id: string
          record_type: string
          sageone_transaction_id?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          payment_reference?: string
          record_id?: string
          record_type?: string
          sageone_transaction_id?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_pop_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "access_compatibility_raw"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payment_pop_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_report_allocations: {
        Row: {
          appointment_id: string | null
          claimant_id: string
          claimant_name: string
          created_at: string
          id: string
          payment_id: string
          payment_type: string
          referring_attorney_id: string
        }
        Insert: {
          appointment_id?: string | null
          claimant_id: string
          claimant_name: string
          created_at?: string
          id?: string
          payment_id: string
          payment_type: string
          referring_attorney_id: string
        }
        Update: {
          appointment_id?: string | null
          claimant_id?: string
          claimant_name?: string
          created_at?: string
          id?: string
          payment_id?: string
          payment_type?: string
          referring_attorney_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_report_allocations_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_report_allocations_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "deleted_appointments_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_report_allocations_claimant_id_fkey"
            columns: ["claimant_id"]
            isOneToOne: false
            referencedRelation: "claimants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_report_allocations_referring_attorney_id_fkey"
            columns: ["referring_attorney_id"]
            isOneToOne: false
            referencedRelation: "referring_attorneys"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_logs: {
        Row: {
          attorney_id: string
          created_at: string
          created_by: string | null
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
          created_by?: string | null
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
          created_by?: string | null
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
            referencedRelation: "referring_attorneys"
            referencedColumns: ["id"]
          },
        ]
      }
      pitchlog_weekly_summaries: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          month_year: string
          sales_person: string
          summary_comment: string | null
          updated_at: string
          week_number: number
          weekly_strategy: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          month_year: string
          sales_person: string
          summary_comment?: string | null
          updated_at?: string
          week_number: number
          weekly_strategy?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          month_year?: string
          sales_person?: string
          summary_comment?: string | null
          updated_at?: string
          week_number?: number
          weekly_strategy?: string | null
        }
        Relationships: []
      }
      position_module_overrides: {
        Row: {
          granted: boolean
          granted_at: string
          granted_by: string | null
          module_key: string
          position_key: string
          reason: string | null
        }
        Insert: {
          granted: boolean
          granted_at?: string
          granted_by?: string | null
          module_key: string
          position_key: string
          reason?: string | null
        }
        Update: {
          granted?: boolean
          granted_at?: string
          granted_by?: string | null
          module_key?: string
          position_key?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "position_module_overrides_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "access_modules"
            referencedColumns: ["module_key"]
          },
          {
            foreignKeyName: "position_module_overrides_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "staff_effective_module_access"
            referencedColumns: ["module_key"]
          },
          {
            foreignKeyName: "position_module_overrides_position_key_fkey"
            columns: ["position_key"]
            isOneToOne: false
            referencedRelation: "staff_positions"
            referencedColumns: ["position_key"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string
          attorney_contact_id: string | null
          created_at: string
          current_session_id: string | null
          deactivated_at: string | null
          deactivated_by: string | null
          deactivation_reason: string | null
          email: string | null
          expert_id: string | null
          failed_login_count: number
          first_name: string | null
          force_security_setup: boolean
          id: string
          is_active: boolean
          is_external_portal_user: boolean
          last_failed_login_at: string | null
          last_login_at: string | null
          last_name: string | null
          locked_until: string | null
          must_reset_password: boolean
          position: string | null
          referring_attorney_id: string | null
          role: string | null
          security_setup_completed: boolean
          security_setup_completed_at: string | null
          updated_at: string
          user_type: string | null
        }
        Insert: {
          account_status?: string
          attorney_contact_id?: string | null
          created_at?: string
          current_session_id?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          email?: string | null
          expert_id?: string | null
          failed_login_count?: number
          first_name?: string | null
          force_security_setup?: boolean
          id: string
          is_active?: boolean
          is_external_portal_user?: boolean
          last_failed_login_at?: string | null
          last_login_at?: string | null
          last_name?: string | null
          locked_until?: string | null
          must_reset_password?: boolean
          position?: string | null
          referring_attorney_id?: string | null
          role?: string | null
          security_setup_completed?: boolean
          security_setup_completed_at?: string | null
          updated_at?: string
          user_type?: string | null
        }
        Update: {
          account_status?: string
          attorney_contact_id?: string | null
          created_at?: string
          current_session_id?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          email?: string | null
          expert_id?: string | null
          failed_login_count?: number
          first_name?: string | null
          force_security_setup?: boolean
          id?: string
          is_active?: boolean
          is_external_portal_user?: boolean
          last_failed_login_at?: string | null
          last_login_at?: string | null
          last_name?: string | null
          locked_until?: string | null
          must_reset_password?: boolean
          position?: string | null
          referring_attorney_id?: string | null
          role?: string | null
          security_setup_completed?: boolean
          security_setup_completed_at?: string | null
          updated_at?: string
          user_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_attorney_contact_id_fkey"
            columns: ["attorney_contact_id"]
            isOneToOne: false
            referencedRelation: "referring_attorney_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "medical_experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_law_firm_id_fkey"
            columns: ["referring_attorney_id"]
            isOneToOne: false
            referencedRelation: "referring_attorneys"
            referencedColumns: ["id"]
          },
        ]
      }
      proofreading_history: {
        Row: {
          compressed_size: string | null
          compression_applied: boolean | null
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string
          id: string
          original_size: string | null
          processing_time: number | null
          quality_score: number
          result_data: Json | null
          status: string | null
          total_changes: number
          total_words: number
          updated_at: string
          user_id: string
        }
        Insert: {
          compressed_size?: string | null
          compression_applied?: boolean | null
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type: string
          id?: string
          original_size?: string | null
          processing_time?: number | null
          quality_score: number
          result_data?: Json | null
          status?: string | null
          total_changes?: number
          total_words?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          compressed_size?: string | null
          compression_applied?: boolean | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          id?: string
          original_size?: string | null
          processing_time?: number | null
          quality_score?: number
          result_data?: Json | null
          status?: string | null
          total_changes?: number
          total_words?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      record_locks: {
        Row: {
          expires_at: string | null
          id: string
          is_active: boolean
          lock_reason: string | null
          locked_at: string
          locked_by: string | null
          record_id: string
          table_name: string
        }
        Insert: {
          expires_at?: string | null
          id?: string
          is_active?: boolean
          lock_reason?: string | null
          locked_at?: string
          locked_by?: string | null
          record_id: string
          table_name: string
        }
        Update: {
          expires_at?: string | null
          id?: string
          is_active?: boolean
          lock_reason?: string | null
          locked_at?: string
          locked_by?: string | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      referring_attorney_contacts: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
          referring_attorney_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          referring_attorney_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          referring_attorney_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referring_attorney_contacts_referring_attorney_id_fkey"
            columns: ["referring_attorney_id"]
            isOneToOne: false
            referencedRelation: "referring_attorneys"
            referencedColumns: ["id"]
          },
        ]
      }
      referring_attorneys: {
        Row: {
          address: string | null
          attorney_role: string | null
          code: string
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          is_system_company: boolean | null
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
          is_system_company?: boolean | null
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
          is_system_company?: boolean | null
          matter_type?: Database["public"]["Enums"]["matter_type"] | null
          name?: string
          phone?: string | null
          province?: string | null
        }
        Relationships: []
      }
      report_deliveries: {
        Row: {
          confirmed_at: string | null
          confirmed_receipt: boolean
          delivered_at: string
          delivered_by: string | null
          delivered_to_attorney_id: string | null
          delivery_method: string
          expert_report_id: string
          id: string
          notes: string | null
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_receipt?: boolean
          delivered_at?: string
          delivered_by?: string | null
          delivered_to_attorney_id?: string | null
          delivery_method?: string
          expert_report_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          confirmed_at?: string | null
          confirmed_receipt?: boolean
          delivered_at?: string
          delivered_by?: string | null
          delivered_to_attorney_id?: string | null
          delivery_method?: string
          expert_report_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_deliveries_delivered_to_attorney_id_fkey"
            columns: ["delivered_to_attorney_id"]
            isOneToOne: false
            referencedRelation: "referring_attorneys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_deliveries_expert_report_id_fkey"
            columns: ["expert_report_id"]
            isOneToOne: false
            referencedRelation: "expert_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_reviews: {
        Row: {
          created_at: string
          expert_report_id: string
          id: string
          review_notes: string | null
          review_status: string
          reviewed_at: string | null
          reviewer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expert_report_id: string
          id?: string
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expert_report_id?: string
          id?: string
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_reviews_expert_report_id_fkey"
            columns: ["expert_report_id"]
            isOneToOne: false
            referencedRelation: "expert_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_versions: {
        Row: {
          created_at: string
          expert_report_id: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          upload_notes: string | null
          uploaded_by: string | null
          version_number: number
        }
        Insert: {
          created_at?: string
          expert_report_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          upload_notes?: string | null
          uploaded_by?: string | null
          version_number?: number
        }
        Update: {
          created_at?: string
          expert_report_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          upload_notes?: string | null
          uploaded_by?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_versions_expert_report_id_fkey"
            columns: ["expert_report_id"]
            isOneToOne: false
            referencedRelation: "expert_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      role_module_defaults: {
        Row: {
          is_default_on: boolean
          is_eligible: boolean
          module_key: string
          role_key: string
        }
        Insert: {
          is_default_on?: boolean
          is_eligible?: boolean
          module_key: string
          role_key: string
        }
        Update: {
          is_default_on?: boolean
          is_eligible?: boolean
          module_key?: string
          role_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_module_defaults_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "access_modules"
            referencedColumns: ["module_key"]
          },
          {
            foreignKeyName: "role_module_defaults_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "staff_effective_module_access"
            referencedColumns: ["module_key"]
          },
          {
            foreignKeyName: "role_module_defaults_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "access_roles"
            referencedColumns: ["role_key"]
          },
        ]
      }
      role_position_rules: {
        Row: {
          created_at: string
          is_allowed: boolean
          position_key: string
          role_key: string
        }
        Insert: {
          created_at?: string
          is_allowed?: boolean
          position_key: string
          role_key: string
        }
        Update: {
          created_at?: string
          is_allowed?: boolean
          position_key?: string
          role_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_position_rules_position_fk"
            columns: ["position_key"]
            isOneToOne: false
            referencedRelation: "staff_positions"
            referencedColumns: ["position_key"]
          },
          {
            foreignKeyName: "role_position_rules_role_fk"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "access_roles"
            referencedColumns: ["role_key"]
          },
        ]
      }
      sa_districts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          province: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          province: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          province?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      sage_customer_mappings: {
        Row: {
          created_at: string
          id: string
          referring_attorney_id: string
          sage_customer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          referring_attorney_id: string
          sage_customer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          referring_attorney_id?: string
          sage_customer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sage_customer_mappings_referring_attorney_id_fkey"
            columns: ["referring_attorney_id"]
            isOneToOne: true
            referencedRelation: "referring_attorneys"
            referencedColumns: ["id"]
          },
        ]
      }
      sage_integration_state: {
        Row: {
          id: boolean
          last_error: string | null
          last_run_at: string | null
          lease_until: string | null
          pause_reason: string | null
          paused: boolean
          processed_total: number
          updated_at: string
        }
        Insert: {
          id?: boolean
          last_error?: string | null
          last_run_at?: string | null
          lease_until?: string | null
          pause_reason?: string | null
          paused?: boolean
          processed_total?: number
          updated_at?: string
        }
        Update: {
          id?: boolean
          last_error?: string | null
          last_run_at?: string | null
          lease_until?: string | null
          pause_reason?: string | null
          paused?: boolean
          processed_total?: number
          updated_at?: string
        }
        Relationships: []
      }
      sage_oauth_tokens: {
        Row: {
          access_token: string | null
          business_id: string | null
          connected_at: string | null
          connected_by: string | null
          expires_at: string | null
          id: boolean
          refresh_token: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          business_id?: string | null
          connected_at?: string | null
          connected_by?: string | null
          expires_at?: string | null
          id?: boolean
          refresh_token?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          business_id?: string | null
          connected_at?: string | null
          connected_by?: string | null
          expires_at?: string | null
          id?: boolean
          refresh_token?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sageone_invoice_queue: {
        Row: {
          appointment_id: string
          attempts: number
          claimed_at: string | null
          created_at: string
          error: string | null
          id: string
          next_attempt_at: string
          payload: Json
          processed_at: string | null
          sageone_transaction_id: string | null
          status: string
        }
        Insert: {
          appointment_id: string
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          next_attempt_at?: string
          payload: Json
          processed_at?: string | null
          sageone_transaction_id?: string | null
          status?: string
        }
        Update: {
          appointment_id?: string
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          next_attempt_at?: string
          payload?: Json
          processed_at?: string | null
          sageone_transaction_id?: string | null
          status?: string
        }
        Relationships: []
      }
      sales_consultants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          region: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          region?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          region?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sales_performance_reports: {
        Row: {
          auto_comment: string | null
          congratulations: string | null
          consultant_id: string | null
          consultant_name: string
          created_at: string
          current_strikes: number
          deals_closed: number
          delivery_error: string | null
          delivery_status: string
          email: string | null
          id: string
          period_end: string
          period_start: string
          period_type: string
          report_html: string | null
          report_kind: string
          sent_at: string | null
          strike_risk_level: string
          target: number
          target_met: boolean
          user_id: string | null
        }
        Insert: {
          auto_comment?: string | null
          congratulations?: string | null
          consultant_id?: string | null
          consultant_name: string
          created_at?: string
          current_strikes?: number
          deals_closed?: number
          delivery_error?: string | null
          delivery_status?: string
          email?: string | null
          id?: string
          period_end: string
          period_start: string
          period_type: string
          report_html?: string | null
          report_kind?: string
          sent_at?: string | null
          strike_risk_level?: string
          target?: number
          target_met?: boolean
          user_id?: string | null
        }
        Update: {
          auto_comment?: string | null
          congratulations?: string | null
          consultant_id?: string | null
          consultant_name?: string
          created_at?: string
          current_strikes?: number
          deals_closed?: number
          delivery_error?: string | null
          delivery_status?: string
          email?: string | null
          id?: string
          period_end?: string
          period_start?: string
          period_type?: string
          report_html?: string | null
          report_kind?: string
          sent_at?: string | null
          strike_risk_level?: string
          target?: number
          target_met?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_performance_reports_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "sales_consultants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_team_targets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          notes: string | null
          period_month: number | null
          period_quarter: number | null
          period_type: string
          period_year: number
          team_target: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          period_month?: number | null
          period_quarter?: number | null
          period_type: string
          period_year: number
          team_target?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          period_month?: number | null
          period_quarter?: number | null
          period_type?: string
          period_year?: number
          team_target?: number
          updated_at?: string
        }
        Relationships: []
      }
      security_audit_results: {
        Row: {
          affected_object: string | null
          audit_date: string
          audit_type: string
          created_by: string | null
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
          created_by?: string | null
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
          created_by?: string | null
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
      short_term_agreement_payments: {
        Row: {
          agreement_id: string
          created_at: string
          id: string
          payment_amount: number
          payment_date: string
          payment_notes: string | null
          payment_type: string
          recorded_by: string | null
          reports_taken_out: number | null
          updated_at: string
        }
        Insert: {
          agreement_id: string
          created_at?: string
          id?: string
          payment_amount: number
          payment_date: string
          payment_notes?: string | null
          payment_type: string
          recorded_by?: string | null
          reports_taken_out?: number | null
          updated_at?: string
        }
        Update: {
          agreement_id?: string
          created_at?: string
          id?: string
          payment_amount?: number
          payment_date?: string
          payment_notes?: string | null
          payment_type?: string
          recorded_by?: string | null
          reports_taken_out?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "short_term_agreement_payments_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "short_term_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      short_term_agreements: {
        Row: {
          agreement_method: string
          agreement_reference: string | null
          auto_triggered: boolean | null
          contract_description: string | null
          contract_end_date: string
          contract_start_date: string
          created_at: string
          created_by: string
          creditor_signature_date: string | null
          debtor_authorized_rep: string | null
          debtor_domicilium_address: string | null
          debtor_law_firm_name: string | null
          debtor_registration_number: string | null
          debtor_signature_date: string | null
          default_notice_count: number | null
          default_notice_sent_at: string | null
          default_status: string | null
          deposit_amount: number | null
          discount_amount: number | null
          discount_rate: number | null
          discount_reason: string | null
          document_status: string | null
          document_url: string | null
          file_name: string | null
          grace_period_days: number | null
          id: string
          interest_rate_1_3_months: number | null
          interest_rate_12_months: number | null
          interest_rate_6_months: number | null
          is_digitally_signed: boolean | null
          last_payment_date: string | null
          legal_escalation_notes: string | null
          linked_appointment_ids: string[]
          matter_types: string[] | null
          next_payment_date: string | null
          notes: string | null
          payment_frequency: string | null
          payment_plan_structure: string | null
          payment_status: string | null
          payments_made: number | null
          referring_attorney_id: string
          reports_completed: number | null
          reports_released: number | null
          roll_out_plan_reference: string | null
          services_suspended: boolean | null
          signed_document_url: string | null
          status: string | null
          total_amount_words: string | null
          total_contract_value: number | null
          total_reports_agreed: number | null
          trigger_reason: string | null
          updated_at: string
          witness1_name: string | null
          witness1_signature_date: string | null
          witness2_name: string | null
          witness2_signature_date: string | null
        }
        Insert: {
          agreement_method: string
          agreement_reference?: string | null
          auto_triggered?: boolean | null
          contract_description?: string | null
          contract_end_date: string
          contract_start_date: string
          created_at?: string
          created_by: string
          creditor_signature_date?: string | null
          debtor_authorized_rep?: string | null
          debtor_domicilium_address?: string | null
          debtor_law_firm_name?: string | null
          debtor_registration_number?: string | null
          debtor_signature_date?: string | null
          default_notice_count?: number | null
          default_notice_sent_at?: string | null
          default_status?: string | null
          deposit_amount?: number | null
          discount_amount?: number | null
          discount_rate?: number | null
          discount_reason?: string | null
          document_status?: string | null
          document_url?: string | null
          file_name?: string | null
          grace_period_days?: number | null
          id?: string
          interest_rate_1_3_months?: number | null
          interest_rate_12_months?: number | null
          interest_rate_6_months?: number | null
          is_digitally_signed?: boolean | null
          last_payment_date?: string | null
          legal_escalation_notes?: string | null
          linked_appointment_ids?: string[]
          matter_types?: string[] | null
          next_payment_date?: string | null
          notes?: string | null
          payment_frequency?: string | null
          payment_plan_structure?: string | null
          payment_status?: string | null
          payments_made?: number | null
          referring_attorney_id: string
          reports_completed?: number | null
          reports_released?: number | null
          roll_out_plan_reference?: string | null
          services_suspended?: boolean | null
          signed_document_url?: string | null
          status?: string | null
          total_amount_words?: string | null
          total_contract_value?: number | null
          total_reports_agreed?: number | null
          trigger_reason?: string | null
          updated_at?: string
          witness1_name?: string | null
          witness1_signature_date?: string | null
          witness2_name?: string | null
          witness2_signature_date?: string | null
        }
        Update: {
          agreement_method?: string
          agreement_reference?: string | null
          auto_triggered?: boolean | null
          contract_description?: string | null
          contract_end_date?: string
          contract_start_date?: string
          created_at?: string
          created_by?: string
          creditor_signature_date?: string | null
          debtor_authorized_rep?: string | null
          debtor_domicilium_address?: string | null
          debtor_law_firm_name?: string | null
          debtor_registration_number?: string | null
          debtor_signature_date?: string | null
          default_notice_count?: number | null
          default_notice_sent_at?: string | null
          default_status?: string | null
          deposit_amount?: number | null
          discount_amount?: number | null
          discount_rate?: number | null
          discount_reason?: string | null
          document_status?: string | null
          document_url?: string | null
          file_name?: string | null
          grace_period_days?: number | null
          id?: string
          interest_rate_1_3_months?: number | null
          interest_rate_12_months?: number | null
          interest_rate_6_months?: number | null
          is_digitally_signed?: boolean | null
          last_payment_date?: string | null
          legal_escalation_notes?: string | null
          linked_appointment_ids?: string[]
          matter_types?: string[] | null
          next_payment_date?: string | null
          notes?: string | null
          payment_frequency?: string | null
          payment_plan_structure?: string | null
          payment_status?: string | null
          payments_made?: number | null
          referring_attorney_id?: string
          reports_completed?: number | null
          reports_released?: number | null
          roll_out_plan_reference?: string | null
          services_suspended?: boolean | null
          signed_document_url?: string | null
          status?: string | null
          total_amount_words?: string | null
          total_contract_value?: number | null
          total_reports_agreed?: number | null
          trigger_reason?: string | null
          updated_at?: string
          witness1_name?: string | null
          witness1_signature_date?: string | null
          witness2_name?: string | null
          witness2_signature_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "short_term_agreements_referring_attorney_id_fkey"
            columns: ["referring_attorney_id"]
            isOneToOne: false
            referencedRelation: "referring_attorneys"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_access_profiles: {
        Row: {
          created_at: string
          is_active: boolean
          position_key: string | null
          role_key: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          position_key?: string | null
          role_key: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          position_key?: string | null
          role_key?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_access_profiles_position_key_fkey"
            columns: ["position_key"]
            isOneToOne: false
            referencedRelation: "staff_positions"
            referencedColumns: ["position_key"]
          },
          {
            foreignKeyName: "staff_access_profiles_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "access_roles"
            referencedColumns: ["role_key"]
          },
        ]
      }
      staff_positions: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          is_active: boolean
          position_key: string
          role_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          is_active?: boolean
          position_key: string
          role_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          is_active?: boolean
          position_key?: string
          role_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_positions_role_fk"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "access_roles"
            referencedColumns: ["role_key"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          description: string
          id: string
          priority: string
          resolved_at: string | null
          status: string
          subject: string
          submitted_by: string | null
          submitted_by_email: string | null
          submitted_by_name: string | null
          submitted_by_role: string | null
          ticket_number: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          description: string
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject: string
          submitted_by?: string | null
          submitted_by_email?: string | null
          submitted_by_name?: string | null
          submitted_by_role?: string | null
          ticket_number: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          submitted_by?: string | null
          submitted_by_email?: string | null
          submitted_by_name?: string | null
          submitted_by_role?: string | null
          ticket_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
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
      ticket_messages: {
        Row: {
          created_at: string
          id: string
          is_internal_note: boolean | null
          message: string
          sender_id: string | null
          sender_name: string | null
          sender_role: string | null
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_internal_note?: boolean | null
          message: string
          sender_id?: string | null
          sender_name?: string | null
          sender_role?: string | null
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_internal_note?: boolean | null
          message?: string
          sender_id?: string | null
          sender_name?: string | null
          sender_role?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      trusted_device_challenges: {
        Row: {
          challenge: string
          created_at: string
          expires_at: string
          id: string
          purpose: string
          user_id: string
        }
        Insert: {
          challenge: string
          created_at?: string
          expires_at: string
          id?: string
          purpose: string
          user_id: string
        }
        Update: {
          challenge?: string
          created_at?: string
          expires_at?: string
          id?: string
          purpose?: string
          user_id?: string
        }
        Relationships: []
      }
      trusted_device_events: {
        Row: {
          created_at: string
          device_id: string | null
          event_type: string
          id: string
          metadata: Json
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          event_type: string
          id?: string
          metadata?: Json
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trusted_device_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "trusted_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      trusted_devices: {
        Row: {
          created_at: string
          credential_id: string
          device_label: string
          id: string
          ip_address: string | null
          last_used_at: string | null
          location_city: string | null
          location_country: string | null
          location_region: string | null
          platform: string | null
          public_key: string
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          sign_count: number
          transports: string[]
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          credential_id: string
          device_label?: string
          id?: string
          ip_address?: string | null
          last_used_at?: string | null
          location_city?: string | null
          location_country?: string | null
          location_region?: string | null
          platform?: string | null
          public_key: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          sign_count?: number
          transports?: string[]
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          credential_id?: string
          device_label?: string
          id?: string
          ip_address?: string | null
          last_used_at?: string | null
          location_city?: string | null
          location_country?: string | null
          location_region?: string | null
          platform?: string | null
          public_key?: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          sign_count?: number
          transports?: string[]
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_action_permissions: {
        Row: {
          action_key: string
          granted: boolean
          granted_at: string
          granted_by: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          action_key: string
          granted: boolean
          granted_at?: string
          granted_by: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          action_key?: string
          granted?: boolean
          granted_at?: string
          granted_by?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_activity_time: {
        Row: {
          activity_key: string
          activity_label: string
          created_at: string
          day: string
          id: string
          last_updated_at: string
          seconds_spent: number
          user_id: string
        }
        Insert: {
          activity_key: string
          activity_label: string
          created_at?: string
          day?: string
          id?: string
          last_updated_at?: string
          seconds_spent?: number
          user_id: string
        }
        Update: {
          activity_key?: string
          activity_label?: string
          created_at?: string
          day?: string
          id?: string
          last_updated_at?: string
          seconds_spent?: number
          user_id?: string
        }
        Relationships: []
      }
      user_attorney_links: {
        Row: {
          created_at: string
          id: string
          referring_attorney_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          referring_attorney_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          referring_attorney_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_attorney_links_referring_attorney_id_fkey"
            columns: ["referring_attorney_id"]
            isOneToOne: false
            referencedRelation: "referring_attorneys"
            referencedColumns: ["id"]
          },
        ]
      }
      user_module_overrides: {
        Row: {
          granted: boolean
          granted_at: string
          granted_by: string
          id: string
          module_key: string
          reason: string | null
          user_id: string
        }
        Insert: {
          granted: boolean
          granted_at?: string
          granted_by: string
          id?: string
          module_key: string
          reason?: string | null
          user_id: string
        }
        Update: {
          granted?: boolean
          granted_at?: string
          granted_by?: string
          id?: string
          module_key?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_module_overrides_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "access_modules"
            referencedColumns: ["module_key"]
          },
          {
            foreignKeyName: "user_module_overrides_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "staff_effective_module_access"
            referencedColumns: ["module_key"]
          },
        ]
      }
      user_passkeys: {
        Row: {
          aaguid: string | null
          counter: number
          created_at: string
          credential_id: string
          device_name: string | null
          id: string
          last_used_at: string | null
          public_key: string
          transports: string[] | null
          user_id: string
        }
        Insert: {
          aaguid?: string | null
          counter?: number
          created_at?: string
          credential_id: string
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          public_key: string
          transports?: string[] | null
          user_id: string
        }
        Update: {
          aaguid?: string | null
          counter?: number
          created_at?: string
          credential_id?: string
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          public_key?: string
          transports?: string[] | null
          user_id?: string
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
      user_roles: {
        Row: {
          created_at: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_configs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          is_active: boolean
          name: string
          secret: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          is_active?: boolean
          name: string
          secret?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          is_active?: boolean
          name?: string
          secret?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          error: string | null
          event_type: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          webhook_config_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type: string
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          webhook_config_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          webhook_config_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_webhook_config_id_fkey"
            columns: ["webhook_config_id"]
            isOneToOne: false
            referencedRelation: "webhook_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_operations_reports: {
        Row: {
          assessments_booked_count: number
          created_at: string
          delivery_error: string | null
          delivery_status: string
          generated_by: string | null
          generated_for_role: string | null
          generated_for_user_id: string | null
          id: string
          is_combined: boolean
          payments_count: number
          payments_total: number
          period_end: string
          period_start: string
          period_type: string
          province_deals_closed: Json
          recipients: string[]
          report_html: string | null
          sent_at: string | null
          submitted_reports_count: number
          top_expert_bookings_count: number
          top_expert_name: string | null
          top_expert_province: string | null
        }
        Insert: {
          assessments_booked_count?: number
          created_at?: string
          delivery_error?: string | null
          delivery_status?: string
          generated_by?: string | null
          generated_for_role?: string | null
          generated_for_user_id?: string | null
          id?: string
          is_combined?: boolean
          payments_count?: number
          payments_total?: number
          period_end: string
          period_start: string
          period_type?: string
          province_deals_closed?: Json
          recipients?: string[]
          report_html?: string | null
          sent_at?: string | null
          submitted_reports_count?: number
          top_expert_bookings_count?: number
          top_expert_name?: string | null
          top_expert_province?: string | null
        }
        Update: {
          assessments_booked_count?: number
          created_at?: string
          delivery_error?: string | null
          delivery_status?: string
          generated_by?: string | null
          generated_for_role?: string | null
          generated_for_user_id?: string | null
          id?: string
          is_combined?: boolean
          payments_count?: number
          payments_total?: number
          period_end?: string
          period_start?: string
          period_type?: string
          province_deals_closed?: Json
          recipients?: string[]
          report_html?: string | null
          sent_at?: string | null
          submitted_reports_count?: number
          top_expert_bookings_count?: number
          top_expert_name?: string | null
          top_expert_province?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      access_compatibility_raw: {
        Row: {
          email: string | null
          legacy_function_permission_rows: Json | null
          legacy_profiles_role: string | null
          legacy_user_roles: string | null
          new_system_module_data: Json | null
          new_system_role: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_role_assignments_role_key_fkey"
            columns: ["new_system_role"]
            isOneToOne: false
            referencedRelation: "access_roles"
            referencedColumns: ["role_key"]
          },
        ]
      }
      agreement_payment_status: {
        Row: {
          agreement_type: string | null
          created_at: string | null
          default_status: string | null
          deposit_amount: number | null
          document_status: string | null
          id: string | null
          last_payment_date: string | null
          next_payment_date: string | null
          payment_status: string | null
          referring_attorney_id: string | null
          reports_released: number | null
          services_suspended: boolean | null
          total_contract_value: number | null
          total_reports_agreed: number | null
        }
        Relationships: []
      }
      dashboard_completed_reports: {
        Row: {
          completed_reports_count: number | null
          completed_this_month: number | null
          completed_this_year: number | null
          last_completed_date: string | null
          law_firm_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_referring_attorney_id_fkey"
            columns: ["law_firm_id"]
            isOneToOne: false
            referencedRelation: "referring_attorneys"
            referencedColumns: ["id"]
          },
        ]
      }
      deleted_appointments_view: {
        Row: {
          appointment_date: string | null
          case_status: string | null
          claimant_auto_id: string | null
          claimant_name: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_by_email: string | null
          deposit_amount: number | null
          expert_name: string | null
          expert_type: string | null
          id: string | null
          law_firm_id: string | null
          matter_type: string | null
          referring_attorney: string | null
          service_fee: number | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_referring_attorney_id_fkey"
            columns: ["law_firm_id"]
            isOneToOne: false
            referencedRelation: "referring_attorneys"
            referencedColumns: ["id"]
          },
        ]
      }
      new_staff_access_directory: {
        Row: {
          created_at: string | null
          email: string | null
          is_active: boolean | null
          position_display_name: string | null
          position_key: string | null
          role_display_name: string | null
          role_key: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_access_profiles_position_key_fkey"
            columns: ["position_key"]
            isOneToOne: false
            referencedRelation: "staff_positions"
            referencedColumns: ["position_key"]
          },
          {
            foreignKeyName: "staff_access_profiles_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "access_roles"
            referencedColumns: ["role_key"]
          },
        ]
      }
      staff_effective_module_access: {
        Row: {
          access_source: string | null
          description: string | null
          group_name: string | null
          has_access: boolean | null
          module_is_active: boolean | null
          module_key: string | null
          position_key: string | null
          role_key: string | null
          route_path: string | null
          title: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_access_profiles_position_key_fkey"
            columns: ["position_key"]
            isOneToOne: false
            referencedRelation: "staff_positions"
            referencedColumns: ["position_key"]
          },
          {
            foreignKeyName: "staff_access_profiles_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "access_roles"
            referencedColumns: ["role_key"]
          },
        ]
      }
    }
    Functions: {
      admin_issue_consultant_strike: {
        Args: {
          p_consultant_id: string
          p_issued_date?: string
          p_payout_month?: number
          p_payout_year?: number
          p_reason?: string
          p_type: string
        }
        Returns: {
          consultant_id: string
          created_at: string
          expired: boolean | null
          expiry_date: string
          id: string
          issued_date: string
          payout_month: number | null
          payout_year: number | null
          reason: string | null
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "consultant_strikes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_override_consultant_strike: {
        Args: { p_reason?: string; p_strike_id: string }
        Returns: {
          consultant_id: string
          created_at: string
          expired: boolean | null
          expiry_date: string
          id: string
          issued_date: string
          payout_month: number | null
          payout_year: number | null
          reason: string | null
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "consultant_strikes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_aod_allocations: {
        Args: { p_allocations: Json; p_payment_date: string }
        Returns: Json
      }
      assign_appointment_attorney_contact: {
        Args: {
          p_appointment_id: string
          p_contact_email?: string
          p_contact_full_name: string
          p_contact_phone?: string
          p_referring_attorney_id: string
        }
        Returns: string
      }
      audit_rls_policies: {
        Args: never
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
        Args: never
        Returns: {
          function_name: string
          has_search_path: boolean
          severity: string
        }[]
      }
      bulk_update_function_permissions: {
        Args: { _changes: Json; _user_id: string }
        Returns: Json
      }
      calculate_response_rating: { Args: { hours: number }; Returns: string }
      can_access_payment_pop: {
        Args: { _record_id: string; _record_type: string }
        Returns: boolean
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
      change_staff_access_role: {
        Args: {
          p_position_key: string
          p_reason?: string
          p_role_key: string
          p_target_user_id: string
        }
        Returns: Json
      }
      check_admin_by_email: { Args: never; Returns: boolean }
      check_data_retention_compliance: {
        Args: never
        Returns: {
          action_required: string
          compliance_status: string
          oldest_record: string
          record_count: number
          table_name: string
        }[]
      }
      check_user_role: { Args: { required_role: string }; Returns: boolean }
      claim_internal_invoice_delivery_batch: {
        Args: { p_limit: number }
        Returns: {
          attempts: number
          claimed_at: string | null
          created_at: string
          id: string
          internal_invoice_id: string
          last_error: string | null
          processed_at: string | null
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "internal_invoice_delivery_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_expired_tokens: { Args: never; Returns: number }
      cleanup_old_documents: {
        Args: never
        Returns: {
          deleted_count: number
          deletion_reason: string
          document_type: string
        }[]
      }
      cleanup_old_proofreading_history: { Args: never; Returns: number }
      cleanup_read_notifications: { Args: never; Returns: undefined }
      clear_access_reauth_flag: { Args: never; Returns: boolean }
      clear_assessment_data: { Args: never; Returns: Json }
      clear_medical_experts: { Args: never; Returns: number }
      clear_medical_experts_by_province: {
        Args: { p_province: string }
        Returns: number
      }
      create_attorney_access_code: {
        Args: {
          p_appointment_id: string
          p_expires_in_days?: number
          p_referring_attorney_id: string
        }
        Returns: {
          access_code: string
          id: string
        }[]
      }
      create_internal_chat_conversation: {
        Args: { _kind: string; _participant_ids?: string[]; _title?: string }
        Returns: string
      }
      decrypt_pii: { Args: { ciphertext: string }; Returns: string }
      encrypt_pii: { Args: { plaintext: string }; Returns: string }
      encrypt_sensitive_field: {
        Args: { field_value: string }
        Returns: string
      }
      epp_can_manage: { Args: { _user_id: string }; Returns: boolean }
      epp_can_view: { Args: { _user_id: string }; Returns: boolean }
      expire_attorney_access_code: {
        Args: { p_appointment_id: string }
        Returns: boolean
      }
      external_portal_attorney_contacts_by_usage: {
        Args: { p_referring_attorney_id: string }
        Returns: {
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string
          referring_attorney_id: string
          usage_count: number
        }[]
      }
      external_portal_auto_expire_stale_accounts: {
        Args: never
        Returns: {
          account_id: string
        }[]
      }
      external_portal_log_audit: {
        Args: {
          _account_id: string
          _action: string
          _actor_id: string
          _actor_type: string
          _details?: Json
        }
        Returns: string
      }
      external_portal_medical_experts_by_usage: {
        Args: never
        Returns: {
          email: string
          first_name: string
          id: string
          last_name: string
          usage_count: number
        }[]
      }
      external_portal_permanently_delete_account: {
        Args: { _account_id: string }
        Returns: undefined
      }
      external_portal_referring_attorneys_by_usage: {
        Args: never
        Returns: {
          contact_person: string
          email: string
          id: string
          name: string
          usage_count: number
        }[]
      }
      external_portal_revoke_all_sessions: {
        Args: { _account_id: string; _reason?: string }
        Returns: number
      }
      external_portal_revoke_session: {
        Args: { _reason?: string; _session_id: string }
        Returns: undefined
      }
      external_portal_set_account_status: {
        Args: {
          _account_id: string
          _new_status: Database["public"]["Enums"]["external_portal_account_status"]
          _reason?: string
        }
        Returns: undefined
      }
      external_portal_staff_send_message: {
        Args: { _account_id: string; _appointment_id: string; _body: string }
        Returns: string
      }
      external_portal_unread_message_count: { Args: never; Returns: number }
      external_portal_update_account_contact: {
        Args: { _account_id: string; _contact_id: string }
        Returns: undefined
      }
      external_portal_update_account_scope: {
        Args: {
          _account_id: string
          _scope: Database["public"]["Enums"]["external_portal_account_scope"]
        }
        Returns: undefined
      }
      find_duplicate_experts: {
        Args: never
        Returns: {
          appointment_count: number
          created_at: string
          duplicate_group: number
          expert_id: string
          expert_type: string
          first_name: string
          last_name: string
          province: string
          status: string
        }[]
      }
      find_duplicate_referring_attorneys: {
        Args: never
        Returns: {
          appointment_count: number
          attorney_id: string
          claimant_count: number
          code: string
          contact_person: string
          created_at: string
          duplicate_group: number
          name: string
          province: string
        }[]
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
      generate_attorney_access_code: { Args: never; Returns: string }
      generate_expert_access_code: { Args: never; Returns: string }
      get_access_session_state: {
        Args: never
        Returns: {
          changed_at: string
          force_reauth: boolean
          user_id: string
          version: number
        }[]
      }
      get_app_roles: { Args: never; Returns: string[] }
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
        Args: never
        Returns: {
          auto_id: string
          contact_number_masked: string
          created_at: string
          first_name_masked: string
          id: string
          last_name_masked: string
          referring_attorney_id: string
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
      get_completed_reports_stats: {
        Args: never
        Returns: {
          completed_this_month: number
          completed_this_year: number
          last_completed_date: string
          total_completed: number
        }[]
      }
      get_consultant_deal_details: {
        Args: { p_consultant_id?: string; p_end: string; p_start: string }
        Returns: {
          appointment_date: string
          appointment_id: string
          claimant_auto_id: string
          claimant_name: string
          closed_date: string
          consultant_id: string
          consultant_name: string
          deposit_amount: number
          matter_type: string
          payment_status: string
          referring_attorney: string
          service_fee: number
          user_full_name: string
        }[]
      }
      get_consultant_monthly_stats: {
        Args: { p_month: number; p_year: number }
        Returns: {
          consultant_id: string
          medneg_appts: number
          raf_appts: number
          total_appts: number
        }[]
      }
      get_consultant_period_stats: {
        Args: { p_end: string; p_start: string }
        Returns: {
          consultant_id: string
          medneg_appts: number
          raf_appts: number
          total_appts: number
        }[]
      }
      get_current_user_attorney_contact: { Args: never; Returns: string }
      get_current_user_expert_id: { Args: never; Returns: string }
      get_current_user_external_portal_account_id: {
        Args: never
        Returns: string
      }
      get_current_user_is_active: { Args: never; Returns: boolean }
      get_current_user_portal_account_scope: {
        Args: never
        Returns: Database["public"]["Enums"]["external_portal_account_scope"]
      }
      get_current_user_referring_attorney: { Args: never; Returns: string }
      get_current_user_role: { Args: never; Returns: string }
      get_current_user_type: { Args: never; Returns: string }
      get_heatmap_demand_by_province: {
        Args: never
        Returns: {
          demand: number
          province: string
        }[]
      }
      get_heatmap_experts_by_province: {
        Args: never
        Returns: {
          expert_count: number
          expert_type: string
          matter_types: string[]
          province: string
        }[]
      }
      get_heatmap_province_stats: {
        Args: never
        Returns: {
          both_business: number
          demand: number
          experts: number
          experts_used: number
          med_neg_business: number
          other_business: number
          primary_experts: number
          province: string
          raf_business: number
        }[]
      }
      get_internal_chat_users: {
        Args: never
        Returns: {
          email: string
          first_name: string
          id: string
          last_name: string
          position: string
          role: string
        }[]
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
        Args: never
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
        Args: never
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
        Args: never
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
      get_new_staff_access_directory: {
        Args: never
        Returns: {
          created_at: string
          email: string
          is_active: boolean
          position_display_name: string
          position_key: string
          role_display_name: string
          role_key: string
          updated_at: string
          user_id: string
        }[]
      }
      get_quarter_actuals_by_consultant: {
        Args: { p_year: number }
        Returns: {
          medneg: number
          mva: number
          quarter: number
          sales_consultant_id: string
          total: number
        }[]
      }
      get_referring_attorneys_list: {
        Args: never
        Returns: {
          appointment_count: number
          attorney_role: string
          claimant_count: number
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
      get_sales_target_for_position: {
        Args: { _position: string; _user_type?: string }
        Returns: number
      }
      get_scheduled_assessments_secure: {
        Args: never
        Returns: {
          appointment_date: string
          appointment_id: string
          assessment_code: string
          case_status: string
          claimant_auto_id: string
          claimant_name: string
          deposit_amount: number
          expert_name: string
          expert_type: string
          payment_date: string
          referring_attorney: string
          referring_attorney_id: string
          report_notes: string
          report_status: string
          report_submitted_date: string
          sales_consultant_name: string
          service_fee: number
        }[]
      }
      get_staff_module_access: {
        Args: { p_user_id?: string }
        Returns: {
          access_source: string
          description: string
          group_name: string
          has_access: boolean
          module_key: string
          route_path: string
          title: string
        }[]
      }
      get_user_activity_summary: {
        Args: { _end: string; _start: string; _user_id: string }
        Returns: {
          activity_key: string
          activity_label: string
          pct_of_total: number
          total_seconds: number
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
      get_user_law_firm_secure: { Args: never; Returns: string }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_employee: { Args: never; Returns: boolean }
      is_admin_secure: { Args: never; Returns: boolean }
      is_chat_participant: {
        Args: { _conv_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_user: { Args: never; Returns: boolean }
      is_internal_user: { Args: { _user_id: string }; Returns: boolean }
      is_main_admin: { Args: never; Returns: boolean }
      is_new_system_admin: { Args: { check_user_id: string }; Returns: boolean }
      is_primary_admin: { Args: never; Returns: boolean }
      is_referring_attorney: { Args: never; Returns: boolean }
      is_sales_consultant_position: {
        Args: { _position: string; _user_type?: string }
        Returns: boolean
      }
      is_strict_admin: { Args: never; Returns: boolean }
      is_system_admin: { Args: never; Returns: boolean }
      is_within_edit_window: {
        Args: { created_date: string }
        Returns: boolean
      }
      issue_monthly_sales_strikes: {
        Args: { p_run_date?: string }
        Returns: {
          consultant_id: string
          consultant_name: string
          current_appts: number
          issued: boolean
          payout_month: number
          payout_year: number
          strike_count: number
          strike_type: string
          user_email: string
          user_id: string
        }[]
      }
      log_activity_time: {
        Args: {
          _activity_key: string
          _activity_label: string
          _seconds: number
        }
        Returns: undefined
      }
      log_audit_trail:
        | {
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
        | {
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
      log_auth_event: {
        Args: {
          _browser?: string
          _device?: string
          _event_type: string
          _ip?: string
          _metadata?: Json
          _os?: string
          _user_agent?: string
          _user_id: string
        }
        Returns: string
      }
      log_case_access: {
        Args: {
          p_description?: string
          p_record_id: string
          p_table_name: string
        }
        Returns: undefined
      }
      log_security_event:
        | {
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
        | {
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
        Args: never
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
      merge_and_delete_duplicate_attorney: {
        Args: { p_duplicate_attorney_id: string; p_primary_attorney_id: string }
        Returns: Json
      }
      merge_and_delete_duplicate_expert: {
        Args: { p_duplicate_expert_id: string; p_primary_expert_id: string }
        Returns: Json
      }
      merge_duplicate_referring_attorneys: {
        Args: never
        Returns: {
          duplicates_merged: number
          records_updated: number
        }[]
      }
      new_access_has_module: {
        Args: { p_module_key: string; p_user_id: string }
        Returns: boolean
      }
      new_access_is_admin: { Args: { p_user_id: string }; Returns: boolean }
      new_access_role_position_allowed: {
        Args: { p_position_key: string; p_role_key: string }
        Returns: boolean
      }
      new_current_user_has_module: {
        Args: { p_module_key: string }
        Returns: boolean
      }
      normalize_province: { Args: { raw: string }; Returns: string }
      process_edit_request: {
        Args: {
          p_admin_notes?: string
          p_request_id: string
          p_status: Database["public"]["Enums"]["approval_status"]
        }
        Returns: boolean
      }
      purge_expired_trusted_devices: { Args: never; Returns: undefined }
      reconcile_internal_invoices: {
        Args: { p_dry_run?: boolean }
        Returns: {
          action: string
          appointment_id: string
          current_service_fee: number
          matched_invoice_id: string
          matched_invoice_total: number
        }[]
      }
      record_auth_event: {
        Args: {
          _browser: string
          _device: string
          _email: string
          _event_type: string
          _ip: string
          _metadata: Json
          _os: string
          _user_agent: string
          _user_id: string
        }
        Returns: string
      }
      remove_duplicate_medical_experts: {
        Args: never
        Returns: {
          duplicates_removed: number
          kept_experts: number
        }[]
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
      require_2fa_for_admin: { Args: never; Returns: boolean }
      restore_appointment: { Args: { appointment_id: string }; Returns: Json }
      revoke_access_token: { Args: { p_token: string }; Returns: boolean }
      run_security_audit: { Args: never; Returns: Json }
      search_pitchlog_firm_suggestions: {
        Args: { p_search: string }
        Returns: {
          contact_person: string
          email: string
          law_firm_name: string
          province: string
          telephone: string
        }[]
      }
      send_appointment_reminders: { Args: never; Returns: undefined }
      send_missing_document_reminders: { Args: never; Returns: undefined }
      snapshot_monthly_performance: {
        Args: { p_run_date?: string }
        Returns: {
          consultant_id: string
          created_at: string
          id: string
          incentive_earned: number | null
          medneg_appts: number
          medneg_incentive_earned: number | null
          month: number
          raf_appts: number
          raf_incentive_earned: number | null
          target_met: boolean | null
          total_appts: number
          updated_at: string
          warning_issued: boolean | null
          year: number
        }[]
        SetofOptions: {
          from: "*"
          to: "monthly_performance"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      soft_delete_appointment: {
        Args: { appointment_id: string }
        Returns: undefined
      }
      sync_existing_appointment_requests: { Args: never; Returns: undefined }
      sync_external_portal_snapshots: { Args: never; Returns: undefined }
      test_function_permissions_upsert: { Args: never; Returns: Json }
      update_user_profile: {
        Args: {
          first_name_param?: string
          last_name_param?: string
          user_id_param: string
        }
        Returns: boolean
      }
      user_can_view_case_document: {
        Args: { p_file_path: string }
        Returns: boolean
      }
      user_has_function_permission: {
        Args: {
          _category: string
          _function: string
          _sub?: string
          _user_id: string
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
      validate_attorney_access_code: {
        Args: { p_access_code: string }
        Returns: {
          appointment_id: string
          error_message: string
          is_valid: boolean
        }[]
      }
      validate_claimant_access: {
        Args: { claimant_referring_attorney_id: string }
        Returns: boolean
      }
      validate_law_firm_access_secure: {
        Args: { target_law_firm_id: string }
        Returns: boolean
      }
      validate_user_session: { Args: never; Returns: boolean }
      verify_function_permissions_indexes: {
        Args: never
        Returns: {
          code: string
          index_name: string
          message: string
          severity: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "employee"
        | "referring_attorney"
        | "user"
        | "sales_consultant"
        | "medical_expert"
        | "finance"
        | "director"
      approval_status: "pending" | "approved" | "rejected"
      epp_case_type: "raf" | "medical_negligence"
      epp_payment_status: "unpaid" | "partial" | "paid" | "overdue"
      epp_priority: "low" | "normal" | "high" | "urgent"
      epp_report_status: "pending" | "in_progress" | "completed" | "released"
      external_portal_account_scope: "firm" | "individual"
      external_portal_account_status:
        | "active"
        | "paused"
        | "expired"
        | "deleted"
      external_portal_link_status: "pending" | "used" | "expired" | "revoked"
      external_portal_otp_purpose: "registration" | "login"
      external_portal_type: "attorney" | "expert"
      fee_review_status: "pending" | "approved" | "rejected"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "admin",
        "employee",
        "referring_attorney",
        "user",
        "sales_consultant",
        "medical_expert",
        "finance",
        "director",
      ],
      approval_status: ["pending", "approved", "rejected"],
      epp_case_type: ["raf", "medical_negligence"],
      epp_payment_status: ["unpaid", "partial", "paid", "overdue"],
      epp_priority: ["low", "normal", "high", "urgent"],
      epp_report_status: ["pending", "in_progress", "completed", "released"],
      external_portal_account_scope: ["firm", "individual"],
      external_portal_account_status: [
        "active",
        "paused",
        "expired",
        "deleted",
      ],
      external_portal_link_status: ["pending", "used", "expired", "revoked"],
      external_portal_otp_purpose: ["registration", "login"],
      external_portal_type: ["attorney", "expert"],
      fee_review_status: ["pending", "approved", "rejected"],
      matter_type: ["mva", "med_neg", "both"],
    },
  },
} as const

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
            foreignKeyName: "documents_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "medical_experts_directory"
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
          {
            foreignKeyName: "expert_reports_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "medical_experts_directory"
            referencedColumns: ["id"]
          },
        ]
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
      profiles: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          law_firm_id: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          law_firm_id?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          law_firm_id?: string | null
          role?: string | null
          updated_at?: string
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
    }
    Views: {
      medical_experts_directory: {
        Row: {
          availability_notes: string | null
          consultation_fees: number | null
          contact_number: string | null
          court_fees: number | null
          created_at: string | null
          cv_document_url: string | null
          email: string | null
          expert_type: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
          personal_assistant_contact: string | null
          personal_assistant_name: string | null
          practice_address: string | null
          province: string | null
          qualifications: string | null
          specializations: string[] | null
          status: string | null
          updated_at: string | null
          years_experience: number | null
        }
        Insert: {
          availability_notes?: string | null
          consultation_fees?: number | null
          contact_number?: never
          court_fees?: number | null
          created_at?: string | null
          cv_document_url?: never
          email?: never
          expert_type?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          personal_assistant_contact?: never
          personal_assistant_name?: never
          practice_address?: never
          province?: string | null
          qualifications?: string | null
          specializations?: string[] | null
          status?: string | null
          updated_at?: string | null
          years_experience?: number | null
        }
        Update: {
          availability_notes?: string | null
          consultation_fees?: number | null
          contact_number?: never
          court_fees?: number | null
          created_at?: string | null
          cv_document_url?: never
          email?: never
          expert_type?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          personal_assistant_contact?: never
          personal_assistant_name?: never
          practice_address?: never
          province?: string | null
          qualifications?: string | null
          specializations?: string[] | null
          status?: string | null
          updated_at?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_view_expert_contacts: {
        Args: { expert_id: string }
        Returns: boolean
      }
      cleanup_old_documents: {
        Args: Record<PropertyKey, never>
        Returns: {
          deleted_count: number
          deletion_reason: string
          document_type: string
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
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      manual_document_cleanup: {
        Args: Record<PropertyKey, never>
        Returns: {
          deleted_count: number
          deletion_reason: string
          document_type: string
        }[]
      }
    }
    Enums: {
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
      matter_type: ["mva", "med_neg", "both"],
    },
  },
} as const

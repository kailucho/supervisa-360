export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      advisors: {
        Row: {
          code: string
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      associations: {
        Row: {
          advisor_id: string
          bank_code: string
          created_at: string
          id: string
          name: string
          region_id: string
          status: Database["public"]["Enums"]["association_status"]
          updated_at: string
        }
        Insert: {
          advisor_id: string
          bank_code: string
          created_at?: string
          id?: string
          name: string
          region_id: string
          status?: Database["public"]["Enums"]["association_status"]
          updated_at?: string
        }
        Update: {
          advisor_id?: string
          bank_code?: string
          created_at?: string
          id?: string
          name?: string
          region_id?: string
          status?: Database["public"]["Enums"]["association_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "associations_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associations_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_goals: {
        Row: {
          created_at: string
          id: string
          month: number
          region_id: string
          supervisor_id: string
          target_visits: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          region_id: string
          supervisor_id: string
          target_visits: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          region_id?: string
          supervisor_id?: string
          target_visits?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_goals_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_goals_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_plan_advisor_assignments: {
        Row: {
          advisor_id: string
          id: string
          month: number
          monthly_plan_id: string
          region_id: string
          removed_at: string | null
          removed_by: string | null
          selected_at: string
          selected_by: string
          year: number
        }
        Insert: {
          advisor_id: string
          id?: string
          month: number
          monthly_plan_id: string
          region_id: string
          removed_at?: string | null
          removed_by?: string | null
          selected_at?: string
          selected_by: string
          year: number
        }
        Update: {
          advisor_id?: string
          id?: string
          month?: number
          monthly_plan_id?: string
          region_id?: string
          removed_at?: string | null
          removed_by?: string | null
          selected_at?: string
          selected_by?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_plan_advisor_assignments_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_plan_advisor_assignments_monthly_plan_id_fkey"
            columns: ["monthly_plan_id"]
            isOneToOne: false
            referencedRelation: "monthly_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_plan_advisor_assignments_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_plan_advisor_assignments_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_plan_advisor_assignments_selected_by_fkey"
            columns: ["selected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_plans: {
        Row: {
          configured_at: string | null
          created_at: string
          id: string
          month: number
          region_id: string
          supervisor_id: string
          updated_at: string
          year: number
        }
        Insert: {
          configured_at?: string | null
          created_at?: string
          id?: string
          month: number
          region_id: string
          supervisor_id: string
          updated_at?: string
          year: number
        }
        Update: {
          configured_at?: string | null
          created_at?: string
          id?: string
          month?: number
          region_id?: string
          supervisor_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_plans_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_plans_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      regional_monthly_goals: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          month: number
          region_id: string
          target_visits: number
          updated_at: string
          updated_by: string | null
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          month: number
          region_id: string
          target_visits: number
          updated_at?: string
          updated_by?: string | null
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          month?: number
          region_id?: string
          target_visits?: number
          updated_at?: string
          updated_by?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "regional_monthly_goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regional_monthly_goals_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regional_monthly_goals_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      visit_document_feedback: {
        Row: {
          created_at: string
          id: string
          mime_type: string
          original_name: string
          size_bytes: number
          storage_path: string
          updated_at: string
          uploaded_by: string
          visit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type: string
          original_name: string
          size_bytes: number
          storage_path: string
          updated_at?: string
          uploaded_by?: string
          visit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string
          original_name?: string
          size_bytes?: number
          storage_path?: string
          updated_at?: string
          uploaded_by?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_document_feedback_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_document_feedback_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: true
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_photos: {
        Row: {
          created_at: string
          id: string
          mime_type: string
          original_name: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
          visit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type: string
          original_name: string
          size_bytes: number
          storage_path: string
          uploaded_by?: string
          visit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string
          original_name?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_photos_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          association_id: string
          characteristic: Database["public"]["Enums"]["visit_characteristic"]
          created_at: string
          end_time: string | null
          general_comment: string | null
          id: string
          modality: Database["public"]["Enums"]["visit_modality"]
          performed_by: string | null
          performed_date: string | null
          result_updated_at: string | null
          scheduled_advisor_id: string
          scheduled_date: string
          scheduled_time: string | null
          score: number | null
          start_time: string | null
          status: Database["public"]["Enums"]["visit_status"]
          supervisor_id: string
          updated_at: string
          visit_type: Database["public"]["Enums"]["visit_type"]
        }
        Insert: {
          association_id: string
          characteristic: Database["public"]["Enums"]["visit_characteristic"]
          created_at?: string
          end_time?: string | null
          general_comment?: string | null
          id?: string
          modality: Database["public"]["Enums"]["visit_modality"]
          performed_by?: string | null
          performed_date?: string | null
          result_updated_at?: string | null
          scheduled_advisor_id: string
          scheduled_date: string
          scheduled_time?: string | null
          score?: number | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["visit_status"]
          supervisor_id: string
          updated_at?: string
          visit_type: Database["public"]["Enums"]["visit_type"]
        }
        Update: {
          association_id?: string
          characteristic?: Database["public"]["Enums"]["visit_characteristic"]
          created_at?: string
          end_time?: string | null
          general_comment?: string | null
          id?: string
          modality?: Database["public"]["Enums"]["visit_modality"]
          performed_by?: string | null
          performed_date?: string | null
          result_updated_at?: string | null
          scheduled_advisor_id?: string
          scheduled_date?: string
          scheduled_time?: string | null
          score?: number | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["visit_status"]
          supervisor_id?: string
          updated_at?: string
          visit_type?: Database["public"]["Enums"]["visit_type"]
        }
        Relationships: [
          {
            foreignKeyName: "visits_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_scheduled_advisor_id_fkey"
            columns: ["scheduled_advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_individual_monthly_progress: {
        Row: {
          has_goal: boolean | null
          individual_active: number | null
          individual_done: number | null
          individual_target: number | null
          month: number | null
          region_id: string | null
          region_name: string | null
          supervisor_id: string | null
          supervisor_name: string | null
          year: number | null
        }
        Relationships: []
      }
      v_joint_monthly_progress: {
        Row: {
          configured_joint_target: number | null
          effective_joint_target: number | null
          is_configured: boolean | null
          joint_active: number | null
          joint_done: number | null
          month: number | null
          region_id: string | null
          region_name: string | null
          suggested_joint_target: number | null
          year: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_advisor_to_monthly_plan: {
        Args: {
          p_advisor_id: string
          p_month: number
          p_region_id: string
          p_year: number
        }
        Returns: string
      }
      can_manage_visit_evidence: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      save_monthly_plan: {
        Args: {
          p_advisor_ids: string[]
          p_month: number
          p_region_id: string
          p_year: number
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "SUPERVISOR" | "SUPERVISION_MANAGER"
      association_status:
        | "NUEVA"
        | "NORMAL"
        | "MORA"
        | "DESERCION"
        | "REORGANIZACION"
        | "PROCESO_DISOLUCION"
        | "DISUELTA"
      visit_characteristic: "ANUNCIADA" | "ANONIMA" | "SORPRESIVA"
      visit_modality: "VIRTUAL" | "PRESENCIAL"
      visit_status:
        | "PROGRAMADA"
        | "REPROGRAMADA"
        | "CANCELADA"
        | "REALIZADA"
        | "NO_REALIZADA"
      visit_type: "ORDINARIA" | "SEGUIMIENTO" | "MORA" | "DESERCION" | "CIERRE"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["SUPERVISOR", "SUPERVISION_MANAGER"],
      association_status: [
        "NUEVA",
        "NORMAL",
        "MORA",
        "DESERCION",
        "REORGANIZACION",
        "PROCESO_DISOLUCION",
        "DISUELTA",
      ],
      visit_characteristic: ["ANUNCIADA", "ANONIMA", "SORPRESIVA"],
      visit_modality: ["VIRTUAL", "PRESENCIAL"],
      visit_status: [
        "PROGRAMADA",
        "REPROGRAMADA",
        "CANCELADA",
        "REALIZADA",
        "NO_REALIZADA",
      ],
      visit_type: ["ORDINARIA", "SEGUIMIENTO", "MORA", "DESERCION", "CIERRE"],
    },
  },
} as const


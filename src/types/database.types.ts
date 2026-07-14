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
          supervisor_id: string
          target_visits: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          supervisor_id: string
          target_visits: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          supervisor_id?: string
          target_visits?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_goals_supervisor_id_fkey"
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
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
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
      v_monthly_progress: {
        Row: {
          individual_active: number | null
          individual_done: number | null
          individual_target: number | null
          joint_active: number | null
          joint_done: number | null
          joint_target: number | null
          month: number | null
          supervisor_id: string | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_goals_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
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


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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      employee_files: {
        Row: {
          created_at: string
          employee_uuid: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          original_name: string
          validation_status?: string
        }
        Insert: {
          created_at?: string
          employee_uuid: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          original_name: string
          validation_status?: string
        }
        Update: {
          created_at?: string
          employee_uuid?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          original_name?: string
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_files_employee_uuid_fkey"
            columns: ["employee_uuid"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          access_status: boolean
          created_at: string
          department: string
          employee_id: string
          id: string
          is_admin: boolean
          name: string
        }
        Insert: {
          access_status?: boolean
          created_at?: string
          department: string
          employee_id: string
          id?: string
          is_admin?: boolean
          name: string
        }
        Update: {
          access_status?: boolean
          created_at?: string
          department?: string
          employee_id?: string
          id?: string
          is_admin?: boolean
          name?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          admin_notes: string | null
          best_practices_score: number
          code: string
          correct_count: number
          created_at: string
          department: string
          difficulty: string
          difficulty_score: number
          efficiency_score: number
          employee_code: string
          employee_name: string
          employee_uuid: string | null
          execution_error: string | null
          execution_output: string | null
          execution_status: string
          execution_time_ms: number
          expected_output: string | null
          file_id: string | null
          id: string
          is_published: boolean
          language: string
          logic_score: number
          output_match_reason: string | null
          output_match_score: number
          output_matched: boolean
          overall_score: number
          problem_type: string[]
          quality_score: number
          question: string
          readability_score: number
          report: Json
          reviewer_notes: string | null
          space_complexity: string
          syntax_score: number
          time_complexity: string
          total_questions: number
          verdict: string
          wrong_count: number
        }
        Insert: {
          admin_notes?: string | null
          best_practices_score?: number
          code: string
          correct_count?: number
          created_at?: string
          department: string
          difficulty?: string
          difficulty_score?: number
          efficiency_score?: number
          employee_code: string
          employee_name: string
          employee_uuid?: string | null
          execution_error?: string | null
          execution_output?: string | null
          execution_status?: string
          execution_time_ms?: number
          expected_output?: string | null
          file_id?: string | null
          id?: string
          is_published?: boolean
          language: string
          logic_score?: number
          output_match_reason?: string | null
          output_match_score?: number
          output_matched?: boolean
          overall_score?: number
          problem_type?: string[]
          quality_score?: number
          question: string
          readability_score?: number
          report?: Json
          reviewer_notes?: string | null
          space_complexity?: string
          syntax_score?: number
          time_complexity?: string
          total_questions?: number
          verdict: string
          wrong_count?: number
        }
        Update: {
          admin_notes?: string | null
          best_practices_score?: number
          code?: string
          correct_count?: number
          created_at?: string
          department?: string
          difficulty?: string
          difficulty_score?: number
          efficiency_score?: number
          employee_code?: string
          employee_name?: string
          employee_uuid?: string | null
          execution_error?: string | null
          execution_output?: string | null
          execution_status?: string
          execution_time_ms?: number
          expected_output?: string | null
          file_id?: string | null
          id?: string
          is_published?: boolean
          language?: string
          logic_score?: number
          output_match_reason?: string | null
          output_match_score?: number
          output_matched?: boolean
          overall_score?: number
          problem_type?: string[]
          quality_score?: number
          question?: string
          readability_score?: number
          report?: Json
          reviewer_notes?: string | null
          space_complexity?: string
          syntax_score?: number
          time_complexity?: string
          total_questions?: number
          verdict?: string
          wrong_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "submissions_employee_uuid_fkey"
            columns: ["employee_uuid"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "employee_files"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      authenticate_employee: {
        Args: {
          p_employee_id: string
          p_name: string
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
    Enums: {},
  },
} as const

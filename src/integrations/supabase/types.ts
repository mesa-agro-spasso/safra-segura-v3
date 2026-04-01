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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: Json | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value?: Json | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      operations: {
        Row: {
          breakeven_basis_brl: number | null
          commodity: string | null
          created_at: string | null
          created_by: string
          display_name: string | null
          gross_price_brl: number | null
          id: string
          notes: string | null
          origination_price_brl: number | null
          payment_date: string | null
          pricing_run_item_id: string | null
          purchased_basis_brl: number | null
          raw_data: Json | null
          sale_date: string | null
          status: string | null
          ticker: string | null
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          breakeven_basis_brl?: number | null
          commodity?: string | null
          created_at?: string | null
          created_by: string
          display_name?: string | null
          gross_price_brl?: number | null
          id?: string
          notes?: string | null
          origination_price_brl?: number | null
          payment_date?: string | null
          pricing_run_item_id?: string | null
          purchased_basis_brl?: number | null
          raw_data?: Json | null
          sale_date?: string | null
          status?: string | null
          ticker?: string | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          breakeven_basis_brl?: number | null
          commodity?: string | null
          created_at?: string | null
          created_by?: string
          display_name?: string | null
          gross_price_brl?: number | null
          id?: string
          notes?: string | null
          origination_price_brl?: number | null
          payment_date?: string | null
          pricing_run_item_id?: string | null
          purchased_basis_brl?: number | null
          raw_data?: Json | null
          sale_date?: string | null
          status?: string | null
          ticker?: string | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operations_pricing_run_item_id_fkey"
            columns: ["pricing_run_item_id"]
            isOneToOne: false
            referencedRelation: "pricing_run_items"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_run_items: {
        Row: {
          additional_discount_brl: number | null
          benchmark: string | null
          breakeven_basis_brl: number | null
          commodity: string | null
          costs: Json | null
          created_at: string | null
          created_by: string
          display_name: string | null
          futures_price_brl: number | null
          grain_reception_date: string | null
          gross_price_brl: number | null
          id: string
          insurance: Json | null
          origination_price_brl: number | null
          payment_date: string | null
          pricing_id: string | null
          pricing_run_id: string
          purchased_basis_brl: number | null
          sale_date: string | null
          target_basis_brl: number | null
          ticker: string | null
          trade_date_used: string | null
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          additional_discount_brl?: number | null
          benchmark?: string | null
          breakeven_basis_brl?: number | null
          commodity?: string | null
          costs?: Json | null
          created_at?: string | null
          created_by: string
          display_name?: string | null
          futures_price_brl?: number | null
          grain_reception_date?: string | null
          gross_price_brl?: number | null
          id?: string
          insurance?: Json | null
          origination_price_brl?: number | null
          payment_date?: string | null
          pricing_id?: string | null
          pricing_run_id: string
          purchased_basis_brl?: number | null
          sale_date?: string | null
          target_basis_brl?: number | null
          ticker?: string | null
          trade_date_used?: string | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          additional_discount_brl?: number | null
          benchmark?: string | null
          breakeven_basis_brl?: number | null
          commodity?: string | null
          costs?: Json | null
          created_at?: string | null
          created_by?: string
          display_name?: string | null
          futures_price_brl?: number | null
          grain_reception_date?: string | null
          gross_price_brl?: number | null
          id?: string
          insurance?: Json | null
          origination_price_brl?: number | null
          payment_date?: string | null
          pricing_id?: string | null
          pricing_run_id?: string
          purchased_basis_brl?: number | null
          sale_date?: string | null
          target_basis_brl?: number | null
          ticker?: string | null
          trade_date_used?: string | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_run_items_pricing_run_id_fkey"
            columns: ["pricing_run_id"]
            isOneToOne: false
            referencedRelation: "pricing_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_runs: {
        Row: {
          api_response: Json | null
          created_at: string | null
          created_by: string
          id: string
          notes: string | null
          request_payload: Json
          status: string | null
          updated_at: string | null
        }
        Insert: {
          api_response?: Json | null
          created_at?: string | null
          created_by: string
          id?: string
          notes?: string | null
          request_payload: Json
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          api_response?: Json | null
          created_at?: string | null
          created_by?: string
          id?: string
          notes?: string | null
          request_payload?: Json
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          active: boolean | null
          commodity: string
          created_at: string | null
          display_name: string
          id: string
          updated_at: string | null
          warehouse_id: string
        }
        Insert: {
          active?: boolean | null
          commodity: string
          created_at?: string | null
          display_name: string
          id?: string
          updated_at?: string | null
          warehouse_id: string
        }
        Update: {
          active?: boolean | null
          commodity?: string
          created_at?: string | null
          display_name?: string
          id?: string
          updated_at?: string | null
          warehouse_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const

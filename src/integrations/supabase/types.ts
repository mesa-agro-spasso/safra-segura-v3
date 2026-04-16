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
      hedge_orders: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          commodity: string
          confirmation_message: string | null
          created_at: string
          created_by: string | null
          display_code: string | null
          exchange: string
          executed_at: string | null
          executed_by: string | null
          executed_legs: Json | null
          id: string
          legs: Json
          notes: string | null
          operation_id: string
          order_message: string | null
          origination_price_brl: number
          status: string
          stonex_confirmation_text: string | null
          volume_sacks: number
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          commodity: string
          confirmation_message?: string | null
          created_at?: string
          created_by?: string | null
          display_code?: string | null
          exchange: string
          executed_at?: string | null
          executed_by?: string | null
          executed_legs?: Json | null
          id?: string
          legs?: Json
          notes?: string | null
          operation_id: string
          order_message?: string | null
          origination_price_brl: number
          status?: string
          stonex_confirmation_text?: string | null
          volume_sacks: number
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          commodity?: string
          confirmation_message?: string | null
          created_at?: string
          created_by?: string | null
          display_code?: string | null
          exchange?: string
          executed_at?: string | null
          executed_by?: string | null
          executed_legs?: Json | null
          id?: string
          legs?: Json
          notes?: string | null
          operation_id?: string
          order_message?: string | null
          origination_price_brl?: number
          status?: string
          stonex_confirmation_text?: string | null
          volume_sacks?: number
        }
        Relationships: [
          {
            foreignKeyName: "hedge_orders_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hedge_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hedge_orders_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hedge_orders_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
        ]
      }
      market_data: {
        Row: {
          commodity: string
          created_at: string
          currency: string
          date: string
          exchange_rate: number | null
          exp_date: string | null
          id: string
          ndf_estimated: number | null
          ndf_override: number | null
          ndf_spot: number | null
          ndf_spread: number | null
          price: number | null
          price_unit: string | null
          source: string
          ticker: string
          updated_at: string
        }
        Insert: {
          commodity: string
          created_at?: string
          currency: string
          date: string
          exchange_rate?: number | null
          exp_date?: string | null
          id?: string
          ndf_estimated?: number | null
          ndf_override?: number | null
          ndf_spot?: number | null
          ndf_spread?: number | null
          price?: number | null
          price_unit?: string | null
          source?: string
          ticker: string
          updated_at?: string
        }
        Update: {
          commodity?: string
          created_at?: string
          currency?: string
          date?: string
          exchange_rate?: number | null
          exp_date?: string | null
          id?: string
          ndf_estimated?: number | null
          ndf_override?: number | null
          ndf_spot?: number | null
          ndf_spread?: number | null
          price?: number | null
          price_unit?: string | null
          source?: string
          ticker?: string
          updated_at?: string
        }
        Relationships: []
      }
      mtm_snapshots: {
        Row: {
          calculated_at: string
          calculated_by: string | null
          futures_price_current: number
          id: string
          mtm_futures_brl: number
          mtm_ndf_brl: number
          mtm_option_brl: number
          mtm_per_sack_brl: number
          mtm_physical_brl: number
          mtm_total_brl: number
          operation_id: string
          physical_price_current: number
          snapshot_date: string
          spot_rate_current: number | null
          total_exposure_brl: number
          volume_sacks: number
        }
        Insert: {
          calculated_at?: string
          calculated_by?: string | null
          futures_price_current: number
          id?: string
          mtm_futures_brl: number
          mtm_ndf_brl?: number
          mtm_option_brl?: number
          mtm_per_sack_brl: number
          mtm_physical_brl: number
          mtm_total_brl: number
          operation_id: string
          physical_price_current: number
          snapshot_date?: string
          spot_rate_current?: number | null
          total_exposure_brl: number
          volume_sacks: number
        }
        Update: {
          calculated_at?: string
          calculated_by?: string | null
          futures_price_current?: number
          id?: string
          mtm_futures_brl?: number
          mtm_ndf_brl?: number
          mtm_option_brl?: number
          mtm_per_sack_brl?: number
          mtm_physical_brl?: number
          mtm_total_brl?: number
          operation_id?: string
          physical_price_current?: number
          snapshot_date?: string
          spot_rate_current?: number | null
          total_exposure_brl?: number
          volume_sacks?: number
        }
        Relationships: [
          {
            foreignKeyName: "mtm_snapshots_calculated_by_fkey"
            columns: ["calculated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mtm_snapshots_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
        ]
      }
      operations: {
        Row: {
          commodity: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          parent_operation_id: string | null
          pricing_snapshot_id: string | null
          status: string
          updated_at: string
          volume_sacks: number
          warehouse_id: string
        }
        Insert: {
          commodity: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          parent_operation_id?: string | null
          pricing_snapshot_id?: string | null
          status?: string
          updated_at?: string
          volume_sacks: number
          warehouse_id: string
        }
        Update: {
          commodity?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          parent_operation_id?: string | null
          pricing_snapshot_id?: string | null
          status?: string
          updated_at?: string
          volume_sacks?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_pricing_snapshot_id_fkey"
            columns: ["pricing_snapshot_id"]
            isOneToOne: false
            referencedRelation: "pricing_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          amount_brl: number
          created_at: string | null
          id: string
          notes: string | null
          operation_id: string
          realized_date: string | null
          registered_by: string | null
          scheduled_date: string
          status: string
          updated_at: string | null
        }
        Insert: {
          amount_brl: number
          created_at?: string | null
          id?: string
          notes?: string | null
          operation_id: string
          realized_date?: string | null
          registered_by?: string | null
          scheduled_date: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount_brl?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          operation_id?: string
          realized_date?: string | null
          registered_by?: string | null
          scheduled_date?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_combinations: {
        Row: {
          active: boolean
          additional_discount_brl: number
          benchmark: string
          brokerage_per_contract: number | null
          commodity: string
          created_at: string
          desk_cost_pct: number | null
          exp_date: string | null
          grain_reception_date: string | null
          id: string
          interest_rate: number | null
          is_spot: boolean
          payment_date: string | null
          reception_cost: number | null
          sale_date: string
          shrinkage_rate_monthly: number | null
          storage_cost: number | null
          storage_cost_type: string | null
          target_basis: number
          ticker: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          active?: boolean
          additional_discount_brl?: number
          benchmark: string
          brokerage_per_contract?: number | null
          commodity: string
          created_at?: string
          desk_cost_pct?: number | null
          exp_date?: string | null
          grain_reception_date?: string | null
          id?: string
          interest_rate?: number | null
          is_spot?: boolean
          payment_date?: string | null
          reception_cost?: number | null
          sale_date: string
          shrinkage_rate_monthly?: number | null
          storage_cost?: number | null
          storage_cost_type?: string | null
          target_basis: number
          ticker: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          active?: boolean
          additional_discount_brl?: number
          benchmark?: string
          brokerage_per_contract?: number | null
          commodity?: string
          created_at?: string
          desk_cost_pct?: number | null
          exp_date?: string | null
          grain_reception_date?: string | null
          id?: string
          interest_rate?: number | null
          is_spot?: boolean
          payment_date?: string | null
          reception_cost?: number | null
          sale_date?: string
          shrinkage_rate_monthly?: number | null
          storage_cost?: number | null
          storage_cost_type?: string | null
          target_basis?: number
          ticker?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_combinations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_parameters: {
        Row: {
          id: string
          sigma: number
          target_profit_brl_per_sack: number | null
          updated_at: string | null
        }
        Insert: {
          id: string
          sigma: number
          target_profit_brl_per_sack?: number | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          sigma?: number
          target_profit_brl_per_sack?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pricing_snapshots: {
        Row: {
          additional_discount_brl: number
          benchmark: string
          commodity: string
          created_at: string
          created_by: string | null
          exchange_rate: number | null
          futures_price_brl: number
          grain_reception_date: string
          id: string
          inputs_json: Json
          insurance_json: Json
          origination_price_brl: number
          outputs_json: Json
          payment_date: string
          sale_date: string
          target_basis_brl: number
          ticker: string
          trade_date: string
          warehouse_id: string
        }
        Insert: {
          additional_discount_brl?: number
          benchmark: string
          commodity: string
          created_at?: string
          created_by?: string | null
          exchange_rate?: number | null
          futures_price_brl: number
          grain_reception_date: string
          id?: string
          inputs_json?: Json
          insurance_json?: Json
          origination_price_brl: number
          outputs_json?: Json
          payment_date: string
          sale_date: string
          target_basis_brl: number
          ticker: string
          trade_date: string
          warehouse_id: string
        }
        Update: {
          additional_discount_brl?: number
          benchmark?: string
          commodity?: string
          created_at?: string
          created_by?: string | null
          exchange_rate?: number | null
          futures_price_brl?: number
          grain_reception_date?: string
          id?: string
          inputs_json?: Json
          insurance_json?: Json
          origination_price_brl?: number
          outputs_json?: Json
          payment_date?: string
          sale_date?: string
          target_basis_brl?: number
          ticker?: string
          trade_date?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_snapshots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_snapshots_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          access_level: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_admin: boolean
          status: string
          updated_at: string
        }
        Insert: {
          access_level?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_admin?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          access_level?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_admin?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          roles: string[]
          warehouse_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name: string
          id: string
          roles?: string[]
          warehouse_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          roles?: string[]
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          abbr: string
          active: boolean
          basis_config: Json
          brokerage_per_contract_b3: number | null
          brokerage_per_contract_cbot: number | null
          city: string | null
          created_at: string
          desk_cost_pct: number | null
          display_name: string
          id: string
          interest_rate: number | null
          interest_rate_period: string | null
          reception_cost: number | null
          shrinkage_rate_monthly: number | null
          state: string | null
          storage_cost: number | null
          storage_cost_type: string | null
          type: string
        }
        Insert: {
          abbr: string
          active?: boolean
          basis_config?: Json
          brokerage_per_contract_b3?: number | null
          brokerage_per_contract_cbot?: number | null
          city?: string | null
          created_at?: string
          desk_cost_pct?: number | null
          display_name: string
          id: string
          interest_rate?: number | null
          interest_rate_period?: string | null
          reception_cost?: number | null
          shrinkage_rate_monthly?: number | null
          state?: string | null
          storage_cost?: number | null
          storage_cost_type?: string | null
          type: string
        }
        Update: {
          abbr?: string
          active?: boolean
          basis_config?: Json
          brokerage_per_contract_b3?: number | null
          brokerage_per_contract_cbot?: number | null
          city?: string | null
          created_at?: string
          desk_cost_pct?: number | null
          display_name?: string
          id?: string
          interest_rate?: number | null
          interest_rate_period?: string | null
          reception_cost?: number | null
          shrinkage_rate_monthly?: number | null
          state?: string | null
          storage_cost?: number | null
          storage_cost_type?: string | null
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_hedge_order_display_code: {
        Args: {
          p_commodity: string
          p_trade_date: string
          p_warehouse_id: string
        }
        Returns: string
      }
      get_user_status: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
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

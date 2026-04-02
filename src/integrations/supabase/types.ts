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
      analysis_runs: {
        Row: {
          errors_count: number
          finished_at: string | null
          id: string
          pairs_approved: number
          pairs_blocked: number
          pairs_processed: number
          pairs_rejected: number
          started_at: string
          status: Database["public"]["Enums"]["analysis_run_status"]
          summary_json: Json | null
        }
        Insert: {
          errors_count?: number
          finished_at?: string | null
          id?: string
          pairs_approved?: number
          pairs_blocked?: number
          pairs_processed?: number
          pairs_rejected?: number
          started_at?: string
          status?: Database["public"]["Enums"]["analysis_run_status"]
          summary_json?: Json | null
        }
        Update: {
          errors_count?: number
          finished_at?: string | null
          id?: string
          pairs_approved?: number
          pairs_blocked?: number
          pairs_processed?: number
          pairs_rejected?: number
          started_at?: string
          status?: Database["public"]["Enums"]["analysis_run_status"]
          summary_json?: Json | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value_json: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value_json: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value_json?: Json
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          created_at: string
          details_json: Json | null
          event_type: string
          id: string
          message: string
          severity: string
          source: string
        }
        Insert: {
          created_at?: string
          details_json?: Json | null
          event_type: string
          id?: string
          message: string
          severity?: string
          source: string
        }
        Update: {
          created_at?: string
          details_json?: Json | null
          event_type?: string
          id?: string
          message?: string
          severity?: string
          source?: string
        }
        Relationships: []
      }
      indicators_snapshot: {
        Row: {
          atr_14: number | null
          avg_volume_20: number | null
          candle_open_time: number
          ema_20: number | null
          ema_21: number | null
          ema_50: number | null
          ema_9: number | null
          id: string
          inserted_at: string
          rsi_14: number | null
          sma_200: number | null
          symbol: string
          timeframe: string
          vwap: number | null
        }
        Insert: {
          atr_14?: number | null
          avg_volume_20?: number | null
          candle_open_time: number
          ema_20?: number | null
          ema_21?: number | null
          ema_50?: number | null
          ema_9?: number | null
          id?: string
          inserted_at?: string
          rsi_14?: number | null
          sma_200?: number | null
          symbol: string
          timeframe: string
          vwap?: number | null
        }
        Update: {
          atr_14?: number | null
          avg_volume_20?: number | null
          candle_open_time?: number
          ema_20?: number | null
          ema_21?: number | null
          ema_50?: number | null
          ema_9?: number | null
          id?: string
          inserted_at?: string
          rsi_14?: number | null
          sma_200?: number | null
          symbol?: string
          timeframe?: string
          vwap?: number | null
        }
        Relationships: []
      }
      market_candles: {
        Row: {
          close: number
          close_time: number
          high: number
          id: string
          inserted_at: string
          is_closed: boolean
          low: number
          open: number
          open_time: number
          source: string
          symbol: string
          timeframe: string
          volume: number
        }
        Insert: {
          close: number
          close_time: number
          high: number
          id?: string
          inserted_at?: string
          is_closed?: boolean
          low: number
          open: number
          open_time: number
          source?: string
          symbol: string
          timeframe: string
          volume: number
        }
        Update: {
          close?: number
          close_time?: number
          high?: number
          id?: string
          inserted_at?: string
          is_closed?: boolean
          low?: number
          open?: number
          open_time?: number
          source?: string
          symbol?: string
          timeframe?: string
          volume?: number
        }
        Relationships: []
      }
      pair_analysis_log: {
        Row: {
          alignment_1h: string | null
          analysis_run_id: string
          approved_reason: string | null
          blocked_reason: string | null
          classification:
            | Database["public"]["Enums"]["signal_classification"]
            | null
          created_at: string
          id: string
          raw_details_json: Json | null
          regime_4h: string | null
          rejected_reason: string | null
          score: number | null
          setup_15m: string | null
          symbol: string
        }
        Insert: {
          alignment_1h?: string | null
          analysis_run_id: string
          approved_reason?: string | null
          blocked_reason?: string | null
          classification?:
            | Database["public"]["Enums"]["signal_classification"]
            | null
          created_at?: string
          id?: string
          raw_details_json?: Json | null
          regime_4h?: string | null
          rejected_reason?: string | null
          score?: number | null
          setup_15m?: string | null
          symbol: string
        }
        Update: {
          alignment_1h?: string | null
          analysis_run_id?: string
          approved_reason?: string | null
          blocked_reason?: string | null
          classification?:
            | Database["public"]["Enums"]["signal_classification"]
            | null
          created_at?: string
          id?: string
          raw_details_json?: Json | null
          regime_4h?: string | null
          rejected_reason?: string | null
          score?: number | null
          setup_15m?: string | null
          symbol?: string
        }
        Relationships: [
          {
            foreignKeyName: "pair_analysis_log_analysis_run_id_fkey"
            columns: ["analysis_run_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_reconciliation_log: {
        Row: {
          checked_at: string
          id: string
          new_status: Database["public"]["Enums"]["signal_status"]
          notes: string | null
          previous_status: Database["public"]["Enums"]["signal_status"]
          resolution_candle_time: number | null
          resolution_price: number | null
          resolution_reason: string | null
          signal_id: string
        }
        Insert: {
          checked_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["signal_status"]
          notes?: string | null
          previous_status: Database["public"]["Enums"]["signal_status"]
          resolution_candle_time?: number | null
          resolution_price?: number | null
          resolution_reason?: string | null
          signal_id: string
        }
        Update: {
          checked_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["signal_status"]
          notes?: string | null
          previous_status?: Database["public"]["Enums"]["signal_status"]
          resolution_candle_time?: number | null
          resolution_price?: number | null
          resolution_reason?: string | null
          signal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signal_reconciliation_log_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
      }
      signals: {
        Row: {
          classification: Database["public"]["Enums"]["signal_classification"]
          close_price: number | null
          close_reason: string | null
          closed_time: string | null
          created_at: string
          direction: Database["public"]["Enums"]["signal_direction"]
          entry_price: number
          entry_time: string
          expiry_time: string
          id: string
          invalidation_reason: string | null
          justification: string | null
          mae: number | null
          mfe: number | null
          rr_ratio: number
          score: number
          score_details: Json | null
          status: Database["public"]["Enums"]["signal_status"]
          stop_loss: number
          strategy_version: string
          symbol: string
          take_profit_1: number
          take_profit_2: number
          take_profit_final: number
          updated_at: string
        }
        Insert: {
          classification: Database["public"]["Enums"]["signal_classification"]
          close_price?: number | null
          close_reason?: string | null
          closed_time?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["signal_direction"]
          entry_price: number
          entry_time: string
          expiry_time: string
          id?: string
          invalidation_reason?: string | null
          justification?: string | null
          mae?: number | null
          mfe?: number | null
          rr_ratio: number
          score: number
          score_details?: Json | null
          status?: Database["public"]["Enums"]["signal_status"]
          stop_loss: number
          strategy_version?: string
          symbol: string
          take_profit_1: number
          take_profit_2: number
          take_profit_final: number
          updated_at?: string
        }
        Update: {
          classification?: Database["public"]["Enums"]["signal_classification"]
          close_price?: number | null
          close_reason?: string | null
          closed_time?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["signal_direction"]
          entry_price?: number
          entry_time?: string
          expiry_time?: string
          id?: string
          invalidation_reason?: string | null
          justification?: string | null
          mae?: number | null
          mfe?: number | null
          rr_ratio?: number
          score?: number
          score_details?: Json | null
          status?: Database["public"]["Enums"]["signal_status"]
          stop_loss?: number
          strategy_version?: string
          symbol?: string
          take_profit_1?: number
          take_profit_2?: number
          take_profit_final?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      watchlist_pairs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          priority: number
          symbol: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          symbol: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      analysis_run_status: "RUNNING" | "COMPLETED" | "FAILED"
      app_role: "admin" | "analyst" | "viewer"
      signal_classification: "REJECTED" | "APPROVED" | "ELITE"
      signal_direction: "LONG" | "SHORT"
      signal_status:
        | "ACTIVE"
        | "TAKE_PROFIT_HIT"
        | "STOP_LOSS_HIT"
        | "EXPIRED"
        | "INVALIDATED"
        | "AMBIGUOUS"
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
      analysis_run_status: ["RUNNING", "COMPLETED", "FAILED"],
      app_role: ["admin", "analyst", "viewer"],
      signal_classification: ["REJECTED", "APPROVED", "ELITE"],
      signal_direction: ["LONG", "SHORT"],
      signal_status: [
        "ACTIVE",
        "TAKE_PROFIT_HIT",
        "STOP_LOSS_HIT",
        "EXPIRED",
        "INVALIDATED",
        "AMBIGUOUS",
      ],
    },
  },
} as const

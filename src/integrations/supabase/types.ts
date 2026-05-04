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
      accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          created_at: string
          created_by: string | null
          currency: string
          id: string
          initial_balance: number
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          initial_balance?: number
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          initial_balance?: number
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      batch_invoices: {
        Row: {
          account_id: string | null
          batch_id: string
          cancelled_at: string | null
          cost_mxn: number
          cost_usd: number
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          invoice_number: string
          notes: string | null
          payment_amount: number
          payment_currency: string
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          product_id: string
          sale_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          batch_id: string
          cancelled_at?: string | null
          cost_mxn?: number
          cost_usd?: number
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          notes?: string | null
          payment_amount?: number
          payment_currency?: string
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          product_id: string
          sale_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          batch_id?: string
          cancelled_at?: string | null
          cost_mxn?: number
          cost_usd?: number
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          payment_amount?: number
          payment_currency?: string
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          product_id?: string
          sale_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_invoices_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_invoices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "batch_invoices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_invoices_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_session_balances: {
        Row: {
          account_id: string
          actual_closing: number | null
          created_at: string
          currency: string
          difference: number | null
          expected_closing: number
          id: string
          opening_balance: number
          session_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          actual_closing?: number | null
          created_at?: string
          currency: string
          difference?: number | null
          expected_closing?: number
          id?: string
          opening_balance?: number
          session_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          actual_closing?: number | null
          created_at?: string
          currency?: string
          difference?: number | null
          expected_closing?: number
          id?: string
          opening_balance?: number
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_session_balances_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_session_balances_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          id: string
          notes: string | null
          opened_at: string
          opened_by: string | null
          session_date: string
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          session_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          session_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      currency_exchanges: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          currency_account_id: string | null
          customer_name: string | null
          exchange_rate: number
          id: string
          mxn_account_id: string | null
          mxn_equivalent: number
          notes: string | null
          operation: string
          operation_date: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency: string
          currency_account_id?: string | null
          customer_name?: string | null
          exchange_rate: number
          id?: string
          mxn_account_id?: string | null
          mxn_equivalent: number
          notes?: string | null
          operation: string
          operation_date?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          currency_account_id?: string | null
          customer_name?: string | null
          exchange_rate?: number
          id?: string
          mxn_account_id?: string | null
          mxn_equivalent?: number
          notes?: string | null
          operation?: string
          operation_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "currency_exchanges_currency_account_id_fkey"
            columns: ["currency_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "currency_exchanges_mxn_account_id_fkey"
            columns: ["mxn_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          notes: string | null
          phone_cu: string | null
          phone_mx: string
          updated_at: string | null
        }
        Insert: {
          address: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          phone_cu?: string | null
          phone_mx: string
          updated_at?: string | null
        }
        Update: {
          address?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone_cu?: string | null
          phone_mx?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          buy_rate: number
          created_at: string | null
          created_by: string | null
          currency: string
          id: string
          rate_type: string
          sell_rate: number
          updated_at: string | null
        }
        Insert: {
          buy_rate: number
          created_at?: string | null
          created_by?: string | null
          currency: string
          id?: string
          rate_type: string
          sell_rate: number
          updated_at?: string | null
        }
        Update: {
          buy_rate?: number
          created_at?: string | null
          created_by?: string | null
          currency?: string
          id?: string
          rate_type?: string
          sell_rate?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      financial_movements: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          movement_date: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          reference: string | null
          reference_id: string | null
          reference_type: string | null
          source: Database["public"]["Enums"]["movement_source"]
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          id?: string
          movement_date?: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          reference?: string | null
          reference_id?: string | null
          reference_type?: string | null
          source?: Database["public"]["Enums"]["movement_source"]
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          movement_date?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          reference?: string | null
          reference_id?: string | null
          reference_type?: string | null
          source?: Database["public"]["Enums"]["movement_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          currency: string
          id: string
          movement_type: string
          notes: string | null
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          currency: string
          id?: string
          movement_type: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          currency?: string
          id?: string
          movement_type?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          created_by: string | null
          cup_amount: number | null
          customer_id: string
          delivery_date: string | null
          delivery_notes: string | null
          delivery_status: Database["public"]["Enums"]["delivery_status"] | null
          eur_amount: number | null
          id: string
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          price_type: string | null
          total_mxn: number
          updated_at: string | null
          usd_amount: number | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          cup_amount?: number | null
          customer_id: string
          delivery_date?: string | null
          delivery_notes?: string | null
          delivery_status?:
            | Database["public"]["Enums"]["delivery_status"]
            | null
          eur_amount?: number | null
          id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          price_type?: string | null
          total_mxn: number
          updated_at?: string | null
          usd_amount?: number | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          cup_amount?: number | null
          customer_id?: string
          delivery_date?: string | null
          delivery_notes?: string | null
          delivery_status?:
            | Database["public"]["Enums"]["delivery_status"]
            | null
          eur_amount?: number | null
          id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          price_type?: string | null
          total_mxn?: number
          updated_at?: string | null
          usd_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sale_batch_consumption: {
        Row: {
          batch_id: string
          cost_mxn_per_unit: number
          cost_usd_per_unit: number
          created_at: string
          id: string
          product_id: string
          quantity: number
          sale_id: string
          total_cost_mxn: number
          total_cost_usd: number
        }
        Insert: {
          batch_id: string
          cost_mxn_per_unit?: number
          cost_usd_per_unit?: number
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          sale_id: string
          total_cost_mxn?: number
          total_cost_usd?: number
        }
        Update: {
          batch_id?: string
          cost_mxn_per_unit?: number
          cost_usd_per_unit?: number
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          sale_id?: string
          total_cost_mxn?: number
          total_cost_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_sale_batch_consumption_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sale_batch_consumption_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "pos_sale_batch_consumption_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sale_batch_consumption_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sale_payments: {
        Row: {
          account_id: string | null
          amount: number
          amount_mxn: number
          created_at: string
          created_by: string | null
          currency: string
          exchange_rate: number
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          sale_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          amount_mxn: number
          created_at?: string
          created_by?: string | null
          currency: string
          exchange_rate?: number
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          sale_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          amount_mxn?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          exchange_rate?: number
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_sale_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sales: {
        Row: {
          account_id: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          commission_currency: string
          commission_mxn: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          product_id: string | null
          product_name: string
          quantity: number
          sale_date: string
          sales_agent: string | null
          sales_agent_id: string | null
          status: string
          total_amount: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          commission_currency?: string
          commission_mxn?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          product_id?: string | null
          product_name: string
          quantity?: number
          sale_date?: string
          sales_agent?: string | null
          sales_agent_id?: string | null
          status?: string
          total_amount: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          commission_currency?: string
          commission_mxn?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_date?: string
          sales_agent?: string | null
          sales_agent_id?: string | null
          status?: string
          total_amount?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_sales_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "pos_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_sales_agent_id_fkey"
            columns: ["sales_agent_id"]
            isOneToOne: false
            referencedRelation: "sales_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      product_batches: {
        Row: {
          commission_mxn: number
          commission_usd: number
          cost_mxn: number
          cost_usd: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          product_id: string
          purchase_date: string
          quantity: number
          remaining_quantity: number
          supplier_invoice: string | null
          updated_at: string
        }
        Insert: {
          commission_mxn?: number
          commission_usd?: number
          cost_mxn?: number
          cost_usd?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id: string
          purchase_date?: string
          quantity: number
          remaining_quantity: number
          supplier_invoice?: string | null
          updated_at?: string
        }
        Update: {
          commission_mxn?: number
          commission_usd?: number
          cost_mxn?: number
          cost_usd?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          purchase_date?: string
          quantity?: number
          remaining_quantity?: number
          supplier_invoice?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          category: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          id: string
          is_active: boolean
          is_invoice_tracked: boolean
          name: string
          updated_at: string
        }
        Insert: {
          base_price?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_invoice_tracked?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_invoice_tracked?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_name: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      sales_agents: {
        Row: {
          created_at: string
          created_by: string | null
          default_commission_mxn: number
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_commission_mxn?: number
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_commission_mxn?: number
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          template: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          template: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          template?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      product_stock: {
        Row: {
          avg_cost_mxn: number | null
          avg_cost_usd: number | null
          product_id: string | null
          product_name: string | null
          stock: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      compute_expected_closing: {
        Args: { _account_id: string; _session_id: string }
        Returns: number
      }
      consume_batches_fifo: {
        Args: { _product_id: string; _quantity: number; _sale_id: string }
        Returns: number
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
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
      account_type: "cash" | "bank" | "wallet" | "other"
      app_role: "admin" | "local" | "delivery"
      delivery_status: "pending" | "in_transit" | "delivered"
      movement_source:
        | "sale"
        | "manual"
        | "commission"
        | "purchase"
        | "currency_exchange"
        | "purchase_invoice"
      movement_type: "income" | "expense"
      payment_method: "cash" | "transfer"
      payment_status: "pending" | "paid" | "verified"
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
      account_type: ["cash", "bank", "wallet", "other"],
      app_role: ["admin", "local", "delivery"],
      delivery_status: ["pending", "in_transit", "delivered"],
      movement_source: [
        "sale",
        "manual",
        "commission",
        "purchase",
        "currency_exchange",
        "purchase_invoice",
      ],
      movement_type: ["income", "expense"],
      payment_method: ["cash", "transfer"],
      payment_status: ["pending", "paid", "verified"],
    },
  },
} as const

/**
 * Tipos generados para el nuevo schema de base de datos
 * Basado en: supabase/migrations/00001_complete_schema.sql
 *
 * Para regenerar automáticamente después de desplegar:
 * npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      // ============================================
      // ORGANIZATIONS
      // ============================================
      organizations: {
        Row: {
          id: string
          name: string
          owner_id: string
          plan: 'free' | 'basic' | 'premium' | 'enterprise'
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_id: string
          plan?: 'free' | 'basic' | 'premium' | 'enterprise'
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          owner_id?: string
          plan?: 'free' | 'basic' | 'premium' | 'enterprise'
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      // ============================================
      // BRANCHES (Sucursales)
      // ============================================
      branches: {
        Row: {
          id: string
          organization_id: string
          name: string
          address: string | null
          phone: string | null
          qr_code: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          address?: string | null
          phone?: string | null
          qr_code?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          address?: string | null
          phone?: string | null
          qr_code?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // MEMBERSHIPS (Reemplaza perfiles + user_organization_roles)
      // ============================================
      memberships: {
        Row: {
          id: string
          user_id: string
          organization_id: string
          role: 'owner' | 'admin' | 'employee'
          branch_id: string | null
          display_name: string
          email: string | null
          xp: number
          is_active: boolean
          invited_by: string | null
          joined_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          organization_id: string
          role?: 'owner' | 'admin' | 'employee'
          branch_id?: string | null
          display_name: string
          email?: string | null
          xp?: number
          is_active?: boolean
          invited_by?: string | null
          joined_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          organization_id?: string
          role?: 'owner' | 'admin' | 'employee'
          branch_id?: string | null
          display_name?: string
          email?: string | null
          xp?: number
          is_active?: boolean
          invited_by?: string | null
          joined_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // SUPPLIERS (Proveedores)
      // ============================================
      suppliers: {
        Row: {
          id: string
          organization_id: string
          name: string
          tax_id: string | null
          phone: string | null
          email: string | null
          balance: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          tax_id?: string | null
          phone?: string | null
          email?: string | null
          balance?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          tax_id?: string | null
          phone?: string | null
          email?: string | null
          balance?: number
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // PRODUCTS (Productos)
      // ============================================
      products: {
        Row: {
          id: string
          organization_id: string
          name: string
          sale_price: number
          cost: number
          barcode: string | null
          category: string | null
          emoji: string | null
          min_stock: number
          is_service: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          sale_price: number
          cost?: number
          barcode?: string | null
          category?: string | null
          emoji?: string | null
          min_stock?: number
          is_service?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          sale_price?: number
          cost?: number
          barcode?: string | null
          category?: string | null
          emoji?: string | null
          min_stock?: number
          is_service?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // STOCK_BATCHES (Lotes de stock FIFO)
      // ============================================
      stock_batches: {
        Row: {
          id: string
          organization_id: string
          product_id: string
          branch_id: string
          quantity: number
          unit_cost: number | null
          batch_number: string | null
          expiration_date: string | null
          supplier_id: string | null
          status: 'available' | 'sold' | 'expired' | 'damaged'
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          product_id: string
          branch_id: string
          quantity?: number
          unit_cost?: number | null
          batch_number?: string | null
          expiration_date?: string | null
          supplier_id?: string | null
          status?: 'available' | 'sold' | 'expired' | 'damaged'
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          product_id?: string
          branch_id?: string
          quantity?: number
          unit_cost?: number | null
          batch_number?: string | null
          expiration_date?: string | null
          supplier_id?: string | null
          status?: 'available' | 'sold' | 'expired' | 'damaged'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // CASH_REGISTERS (Cajas diarias)
      // ============================================
      cash_registers: {
        Row: {
          id: string
          organization_id: string
          branch_id: string
          date: string
          opening_amount: number
          closing_amount: number | null
          expected_amount: number | null
          variance: number | null
          is_open: boolean
          opened_by: string | null
          closed_by: string | null
          opened_at: string
          closed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          branch_id: string
          date: string
          opening_amount?: number
          closing_amount?: number | null
          expected_amount?: number | null
          variance?: number | null
          is_open?: boolean
          opened_by?: string | null
          closed_by?: string | null
          opened_at?: string
          closed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          branch_id?: string
          date?: string
          opening_amount?: number
          closing_amount?: number | null
          expected_amount?: number | null
          variance?: number | null
          is_open?: boolean
          opened_by?: string | null
          closed_by?: string | null
          opened_at?: string
          closed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_registers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // SALES (Ventas - INMUTABLE)
      // ============================================
      sales: {
        Row: {
          id: string
          organization_id: string
          branch_id: string
          cash_register_id: string
          cashier_id: string | null
          total: number
          payment_method: 'cash' | 'card' | 'transfer' | 'wallet'
          local_id: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          branch_id: string
          cash_register_id: string
          cashier_id?: string | null
          total: number
          payment_method: 'cash' | 'card' | 'transfer' | 'wallet'
          local_id?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          // Sales are immutable - no updates allowed via RLS
          id?: never
          organization_id?: never
          branch_id?: never
          cash_register_id?: never
          cashier_id?: never
          total?: never
          payment_method?: never
          local_id?: never
          notes?: never
          created_at?: never
        }
        Relationships: [
          {
            foreignKeyName: "sales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // SALE_ITEMS (Líneas de venta - INMUTABLE)
      // ============================================
      sale_items: {
        Row: {
          id: string
          organization_id: string
          sale_id: string
          product_id: string
          stock_batch_id: string | null
          quantity: number
          unit_price: number
          unit_cost: number
          subtotal: number
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          sale_id: string
          product_id: string
          stock_batch_id?: string | null
          quantity: number
          unit_price: number
          unit_cost?: number
          subtotal: number
          created_at?: string
        }
        Update: {
          // Sale items are immutable
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // CASH_MOVEMENTS (Movimientos de caja - INMUTABLE)
      // ============================================
      cash_movements: {
        Row: {
          id: string
          organization_id: string
          cash_register_id: string
          type: 'income' | 'expense' | 'opening' | 'closing' | 'adjustment'
          amount: number
          category: string | null
          description: string | null
          sale_id: string | null
          user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          cash_register_id: string
          type: 'income' | 'expense' | 'opening' | 'closing' | 'adjustment'
          amount: number
          category?: string | null
          description?: string | null
          sale_id?: string | null
          user_id?: string | null
          created_at?: string
        }
        Update: {
          // Cash movements are immutable
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // PURCHASES (Compras)
      // ============================================
      purchases: {
        Row: {
          id: string
          organization_id: string
          supplier_id: string
          branch_id: string
          invoice_number: string | null
          date: string
          total: number
          payment_method: 'cash' | 'transfer' | 'check' | 'credit' | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          supplier_id: string
          branch_id: string
          invoice_number?: string | null
          date?: string
          total: number
          payment_method?: 'cash' | 'transfer' | 'check' | 'credit' | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          supplier_id?: string
          branch_id?: string
          invoice_number?: string | null
          date?: string
          total?: number
          payment_method?: 'cash' | 'transfer' | 'check' | 'credit' | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // ATTENDANCE (Fichaje)
      // ============================================
      attendance: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          branch_id: string
          check_in: string
          check_out: string | null
          hours_worked: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          branch_id: string
          check_in: string
          check_out?: string | null
          hours_worked?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          branch_id?: string
          check_in?: string
          check_out?: string | null
          hours_worked?: number | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // MISSIONS (Misiones/Gamificación)
      // ============================================
      missions: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          cash_register_id: string | null
          type: string
          description: string | null
          target_value: number
          current_value: number
          points: number
          is_completed: boolean
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          cash_register_id?: string | null
          type: string
          description?: string | null
          target_value?: number
          current_value?: number
          points?: number
          is_completed?: boolean
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          cash_register_id?: string | null
          type?: string
          description?: string | null
          target_value?: number
          current_value?: number
          points?: number
          is_completed?: boolean
          completed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // PENDING_INVITES (Invitaciones)
      // ============================================
      pending_invites: {
        Row: {
          id: string
          organization_id: string
          branch_id: string | null
          email: string
          token: string
          invited_by: string | null
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          branch_id?: string | null
          email: string
          token?: string
          invited_by?: string | null
          expires_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          branch_id?: string | null
          email?: string
          token?: string
          invited_by?: string | null
          expires_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_invites_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // PRICE_HISTORY (Historial de precios - INMUTABLE)
      // ============================================
      price_history: {
        Row: {
          id: string
          organization_id: string
          product_id: string
          old_price: number | null
          new_price: number
          old_cost: number | null
          new_cost: number | null
          changed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          product_id: string
          old_price?: number | null
          new_price: number
          old_cost?: number | null
          new_cost?: number | null
          changed_by?: string | null
          created_at?: string
        }
        Update: {
          // Price history is immutable
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
    }

    Views: {
      // ============================================
      // V_PRODUCTS_WITH_STOCK
      // ============================================
      v_products_with_stock: {
        Row: {
          id: string
          organization_id: string
          name: string
          sale_price: number
          cost: number
          barcode: string | null
          category: string | null
          emoji: string | null
          min_stock: number
          is_service: boolean
          is_active: boolean
          branch_id: string | null
          stock_available: number
        }
        Relationships: []
      }

      // ============================================
      // V_DAILY_SALES
      // ============================================
      v_daily_sales: {
        Row: {
          organization_id: string
          branch_id: string
          date: string
          payment_method: string
          sale_count: number
          total_amount: number
          total_profit: number | null
        }
        Relationships: []
      }

      // ============================================
      // V_EXPIRING_STOCK
      // ============================================
      v_expiring_stock: {
        Row: {
          id: string
          organization_id: string
          branch_id: string
          product_id: string
          product_name: string
          emoji: string | null
          quantity: number
          expiration_date: string
          days_until_expiry: number
          value_at_risk: number
        }
        Relationships: []
      }
    }

    Functions: {
      // ============================================
      // HELPER FUNCTIONS
      // ============================================
      get_my_org_id: {
        Args: Record<string, never>
        Returns: string | null
      }
      is_owner: {
        Args: Record<string, never>
        Returns: boolean
      }
      get_my_branch_id: {
        Args: Record<string, never>
        Returns: string | null
      }
      get_my_role: {
        Args: Record<string, never>
        Returns: string | null
      }

      // ============================================
      // BUSINESS RPCs
      // ============================================
      setup_organization: {
        Args: {
          p_org_name: string
          p_user_name: string
          p_email: string
        }
        Returns: Json
      }
      accept_invite: {
        Args: {
          p_token: string
          p_user_name: string
          p_email: string
        }
        Returns: Json
      }
      process_sale: {
        Args: {
          p_branch_id: string
          p_cash_register_id: string
          p_items: Json
          p_payment_method: string
          p_total: number
          p_local_id?: string | null
          p_notes?: string | null
        }
        Returns: string
      }
      cleanup_expired_invites: {
        Args: Record<string, never>
        Returns: number
      }
    }

    Enums: {
      // No enums defined - using CHECK constraints instead
    }

    CompositeTypes: {
      // No composite types defined
    }
  }
}

// ============================================
// HELPER TYPES
// ============================================

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Insertable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updatable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type Views<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row']

// Aliases para compatibilidad con código existente
export type Organization = Tables<'organizations'>
export type Branch = Tables<'branches'>
export type Membership = Tables<'memberships'>
export type Supplier = Tables<'suppliers'>
export type Product = Tables<'products'>
export type StockBatch = Tables<'stock_batches'>
export type CashRegister = Tables<'cash_registers'>
export type Sale = Tables<'sales'>
export type SaleItem = Tables<'sale_items'>
export type CashMovement = Tables<'cash_movements'>
export type Purchase = Tables<'purchases'>
export type Attendance = Tables<'attendance'>
export type Mission = Tables<'missions'>
export type PendingInvite = Tables<'pending_invites'>
export type PriceHistory = Tables<'price_history'>

// View types
export type ProductWithStock = Views<'v_products_with_stock'>
export type DailySales = Views<'v_daily_sales'>
export type ExpiringStock = Views<'v_expiring_stock'>

// Role type
export type UserRole = 'owner' | 'admin' | 'employee'

// Payment method type
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'wallet'

// Stock status type
export type StockStatus = 'available' | 'sold' | 'expired' | 'damaged'

// Cash movement type
export type CashMovementType = 'income' | 'expense' | 'opening' | 'closing' | 'adjustment'

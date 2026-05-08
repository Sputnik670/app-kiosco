/**
 * ════════════════════════════════════════════════════════════════════════════
 * TIPOS GENERADOS AUTOMÁTICAMENTE DESDE EL SCHEMA DE PRODUCCIÓN DE SUPABASE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Fuente: `npm run generate-types:cli` (project_id vrgexonzlrdptrplqpri)
 * Última regeneración: 8 de mayo de 2026 (Bloque 4 — saneamiento de deuda)
 *
 * NO EDITAR A MANO. Cuando agregues columnas o tablas a la DB, regenerá:
 *   npm run generate-types:cli
 *   (después renombrá types/tipos-db.ts → types/database.types.ts)
 *
 * Este archivo reemplaza la versión congelada en migración 00001 que existía
 * antes del 8-may-2026 y que requería 73 `as any` para tapar las tablas
 * faltantes (invoices, arca_*, mercadopago_*, payment_methods_config, etc.).
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

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
      arca_config: {
        Row: {
          cert_encrypted: string | null
          condicion_iva: string
          created_at: string | null
          cuit: string
          domicilio_fiscal: string | null
          id: string
          inicio_actividades: string | null
          is_active: boolean | null
          is_sandbox: boolean | null
          key_encrypted: string | null
          organization_id: string
          punto_venta: number
          razon_social: string
          tipo_contribuyente: string
          tipo_factura_default: string
          updated_at: string | null
        }
        Insert: {
          cert_encrypted?: string | null
          condicion_iva?: string
          created_at?: string | null
          cuit: string
          domicilio_fiscal?: string | null
          id?: string
          inicio_actividades?: string | null
          is_active?: boolean | null
          is_sandbox?: boolean | null
          key_encrypted?: string | null
          organization_id: string
          punto_venta?: number
          razon_social: string
          tipo_contribuyente?: string
          tipo_factura_default?: string
          updated_at?: string | null
        }
        Update: {
          cert_encrypted?: string | null
          condicion_iva?: string
          created_at?: string | null
          cuit?: string
          domicilio_fiscal?: string | null
          id?: string
          inicio_actividades?: string | null
          is_active?: boolean | null
          is_sandbox?: boolean | null
          key_encrypted?: string | null
          organization_id?: string
          punto_venta?: number
          razon_social?: string
          tipo_contribuyente?: string
          tipo_factura_default?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arca_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      arca_invoices: {
        Row: {
          branch_id: string | null
          cae: string | null
          cae_vencimiento: string | null
          cbte_numero: number | null
          cbte_tipo: number
          concepto: number
          created_at: string | null
          doc_nro: string
          doc_tipo: number
          error_message: string | null
          fecha_emision: string
          id: string
          imp_iva: number
          imp_neto: number
          imp_op_ex: number
          imp_tot_conc: number
          imp_total: number
          iva_detalle: Json | null
          organization_id: string
          punto_venta: number
          qr_data: string | null
          receptor_condicion_iva: string | null
          receptor_cuit: string | null
          receptor_domicilio: string | null
          receptor_nombre: string | null
          sale_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          cae?: string | null
          cae_vencimiento?: string | null
          cbte_numero?: number | null
          cbte_tipo: number
          concepto?: number
          created_at?: string | null
          doc_nro?: string
          doc_tipo?: number
          error_message?: string | null
          fecha_emision?: string
          id?: string
          imp_iva?: number
          imp_neto?: number
          imp_op_ex?: number
          imp_tot_conc?: number
          imp_total: number
          iva_detalle?: Json | null
          organization_id: string
          punto_venta: number
          qr_data?: string | null
          receptor_condicion_iva?: string | null
          receptor_cuit?: string | null
          receptor_domicilio?: string | null
          receptor_nombre?: string | null
          sale_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          cae?: string | null
          cae_vencimiento?: string | null
          cbte_numero?: number | null
          cbte_tipo?: number
          concepto?: number
          created_at?: string | null
          doc_nro?: string
          doc_tipo?: number
          error_message?: string | null
          fecha_emision?: string
          id?: string
          imp_iva?: number
          imp_neto?: number
          imp_op_ex?: number
          imp_tot_conc?: number
          imp_total?: number
          iva_detalle?: Json | null
          organization_id?: string
          punto_venta?: number
          qr_data?: string | null
          receptor_condicion_iva?: string | null
          receptor_cuit?: string | null
          receptor_domicilio?: string | null
          receptor_nombre?: string | null
          sale_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arca_invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arca_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arca_invoices_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arca_invoices_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_uninvoiced_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          branch_id: string
          check_in: string
          check_out: string | null
          created_at: string | null
          hours_worked: number | null
          id: string
          notes: string | null
          organization_id: string
          user_id: string
        }
        Insert: {
          branch_id: string
          check_in: string
          check_out?: string | null
          created_at?: string | null
          hours_worked?: number | null
          id?: string
          notes?: string | null
          organization_id: string
          user_id: string
        }
        Update: {
          branch_id?: string
          check_in?: string
          check_out?: string | null
          created_at?: string | null
          hours_worked?: number | null
          id?: string
          notes?: string | null
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_attendance_user_membership"
            columns: ["user_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["user_id", "organization_id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          organization_id: string
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          organization_id: string
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_schedules: {
        Row: {
          branch_id: string
          created_at: string | null
          id: string
          is_active: boolean
          open_time: string
          open_tolerance_minutes: number
          organization_id: string
          shift_name: string
          shift_order: number
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          open_time?: string
          open_tolerance_minutes?: number
          organization_id: string
          shift_name?: string
          shift_order?: number
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          open_time?: string
          open_tolerance_minutes?: number
          organization_id?: string
          shift_name?: string
          shift_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          mp_external_pos_id: string | null
          mp_store_id: string | null
          name: string
          organization_id: string
          phone: string | null
          qr_code: string | null
          qr_entry_url: string | null
          qr_exit_url: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          mp_external_pos_id?: string | null
          mp_store_id?: string | null
          name: string
          organization_id: string
          phone?: string | null
          qr_code?: string | null
          qr_entry_url?: string | null
          qr_exit_url?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          mp_external_pos_id?: string | null
          mp_store_id?: string | null
          name?: string
          organization_id?: string
          phone?: string | null
          qr_code?: string | null
          qr_entry_url?: string | null
          qr_exit_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          cash_register_id: string
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          organization_id: string
          sale_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          amount: number
          cash_register_id: string
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          organization_id: string
          sale_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          cash_register_id?: string
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          sale_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_uninvoiced_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          branch_id: string
          closed_at: string | null
          closed_by: string | null
          closing_amount: number | null
          created_at: string | null
          date: string
          expected_amount: number | null
          id: string
          is_open: boolean | null
          opened_at: string | null
          opened_by: string | null
          opening_amount: number
          organization_id: string
          variance: number | null
        }
        Insert: {
          branch_id: string
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          created_at?: string | null
          date: string
          expected_amount?: number | null
          id?: string
          is_open?: boolean | null
          opened_at?: string | null
          opened_by?: string | null
          opening_amount?: number
          organization_id: string
          variance?: number | null
        }
        Update: {
          branch_id?: string
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          created_at?: string | null
          date?: string
          expected_amount?: number | null
          id?: string
          is_open?: boolean | null
          opened_at?: string | null
          opened_by?: string | null
          opening_amount?: number
          organization_id?: string
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_registers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cash_registers_closed_by_membership"
            columns: ["closed_by", "organization_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["user_id", "organization_id"]
          },
          {
            foreignKeyName: "fk_cash_registers_opened_by_membership"
            columns: ["opened_by", "organization_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["user_id", "organization_id"]
          },
        ]
      }
      incidents: {
        Row: {
          branch_id: string | null
          cash_register_id: string | null
          created_at: string | null
          description: string
          employee_id: string
          employee_message: string | null
          id: string
          justification: string | null
          justification_type: string | null
          organization_id: string
          reported_by: string
          resolution: string | null
          resolution_notes: string | null
          resolution_type: string | null
          resolved_at: string | null
          severity: string
          status: string
          type: string
          xp_deducted: number | null
        }
        Insert: {
          branch_id?: string | null
          cash_register_id?: string | null
          created_at?: string | null
          description: string
          employee_id: string
          employee_message?: string | null
          id?: string
          justification?: string | null
          justification_type?: string | null
          organization_id: string
          reported_by: string
          resolution?: string | null
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          type?: string
          xp_deducted?: number | null
        }
        Update: {
          branch_id?: string | null
          cash_register_id?: string | null
          created_at?: string | null
          description?: string
          employee_id?: string
          employee_message?: string | null
          id?: string
          justification?: string | null
          justification_type?: string | null
          organization_id?: string
          reported_by?: string
          resolution?: string | null
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          type?: string
          xp_deducted?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sales: {
        Row: {
          created_at: string | null
          invoice_id: string
          sale_id: string
        }
        Insert: {
          created_at?: string | null
          invoice_id: string
          sale_id: string
        }
        Update: {
          created_at?: string | null
          invoice_id?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_sales_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_sales_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_sales_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_uninvoiced_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          branch_id: string
          cae: string | null
          cae_expiry: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string | null
          created_by: string | null
          customer_address: string | null
          customer_cuit: string | null
          customer_name: string | null
          customer_tax_status: string | null
          id: string
          invoice_number: number
          invoice_type: string
          is_mock: boolean | null
          issued_at: string | null
          organization_id: string
          point_of_sale: number
          status: string | null
          subtotal: number
          tax_amount: number | null
          total: number
        }
        Insert: {
          branch_id: string
          cae?: string | null
          cae_expiry?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_address?: string | null
          customer_cuit?: string | null
          customer_name?: string | null
          customer_tax_status?: string | null
          id?: string
          invoice_number: number
          invoice_type: string
          is_mock?: boolean | null
          issued_at?: string | null
          organization_id: string
          point_of_sale?: number
          status?: string | null
          subtotal: number
          tax_amount?: number | null
          total: number
        }
        Update: {
          branch_id?: string
          cae?: string | null
          cae_expiry?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_address?: string | null
          customer_cuit?: string | null
          customer_name?: string | null
          customer_tax_status?: string | null
          id?: string
          invoice_number?: number
          invoice_type?: string
          is_mock?: boolean | null
          issued_at?: string | null
          organization_id?: string
          point_of_sale?: number
          status?: string | null
          subtotal?: number
          tax_amount?: number | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          branch_id: string | null
          created_at: string | null
          display_name: string
          email: string | null
          id: string
          invited_by: string | null
          is_active: boolean | null
          joined_at: string | null
          organization_id: string
          qr_code: string
          role: string
          user_id: string
          xp: number | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          display_name: string
          email?: string | null
          id?: string
          invited_by?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          organization_id: string
          qr_code?: string
          role?: string
          user_id: string
          xp?: number | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          display_name?: string
          email?: string | null
          id?: string
          invited_by?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          organization_id?: string
          qr_code?: string
          role?: string
          user_id?: string
          xp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mercadopago_credentials: {
        Row: {
          access_token_encrypted: string
          collector_id: string
          connected_via: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_sandbox: boolean | null
          mp_pos_external_id: string | null
          mp_store_id: string | null
          organization_id: string
          public_key: string | null
          refresh_token_encrypted: string | null
          token_expires_at: string | null
          updated_at: string | null
          webhook_secret_encrypted: string | null
        }
        Insert: {
          access_token_encrypted: string
          collector_id: string
          connected_via?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_sandbox?: boolean | null
          mp_pos_external_id?: string | null
          mp_store_id?: string | null
          organization_id: string
          public_key?: string | null
          refresh_token_encrypted?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          webhook_secret_encrypted?: string | null
        }
        Update: {
          access_token_encrypted?: string
          collector_id?: string
          connected_via?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_sandbox?: boolean | null
          mp_pos_external_id?: string | null
          mp_store_id?: string | null
          organization_id?: string
          public_key?: string | null
          refresh_token_encrypted?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          webhook_secret_encrypted?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mercadopago_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mercadopago_orders: {
        Row: {
          amount: number
          branch_id: string
          cart_snapshot: Json | null
          cash_register_id: string | null
          confirmed_at: string | null
          created_at: string | null
          currency: string | null
          expires_at: string | null
          external_reference: string
          id: string
          mp_order_id: string | null
          mp_payment_id: string | null
          mp_transaction_id: string | null
          notes: string | null
          organization_id: string
          qr_data: string | null
          sale_id: string | null
          status: string
          webhook_received_at: string | null
        }
        Insert: {
          amount: number
          branch_id: string
          cart_snapshot?: Json | null
          cash_register_id?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          currency?: string | null
          expires_at?: string | null
          external_reference: string
          id?: string
          mp_order_id?: string | null
          mp_payment_id?: string | null
          mp_transaction_id?: string | null
          notes?: string | null
          organization_id: string
          qr_data?: string | null
          sale_id?: string | null
          status?: string
          webhook_received_at?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string
          cart_snapshot?: Json | null
          cash_register_id?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          currency?: string | null
          expires_at?: string | null
          external_reference?: string
          id?: string
          mp_order_id?: string | null
          mp_payment_id?: string | null
          mp_transaction_id?: string | null
          notes?: string | null
          organization_id?: string
          qr_data?: string | null
          sale_id?: string | null
          status?: string
          webhook_received_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mercadopago_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercadopago_orders_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercadopago_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercadopago_orders_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercadopago_orders_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_uninvoiced_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_templates: {
        Row: {
          branch_id: string | null
          created_at: string | null
          description: string
          id: string
          is_active: boolean | null
          organization_id: string
          points: number | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          is_active?: boolean | null
          organization_id: string
          points?: number | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string
          points?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          cash_register_id: string | null
          completed_at: string | null
          created_at: string | null
          current_value: number | null
          description: string | null
          id: string
          is_completed: boolean | null
          organization_id: string
          points: number | null
          target_value: number | null
          type: string
          user_id: string
        }
        Insert: {
          cash_register_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          id?: string
          is_completed?: boolean | null
          organization_id: string
          points?: number | null
          target_value?: number | null
          type: string
          user_id: string
        }
        Update: {
          cash_register_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          id?: string
          is_completed?: boolean | null
          organization_id?: string
          points?: number | null
          target_value?: number | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          fiscal_config: Json | null
          id: string
          name: string
          owner_id: string
          plan: string | null
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fiscal_config?: Json | null
          id?: string
          name: string
          owner_id: string
          plan?: string | null
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fiscal_config?: Json | null
          id?: string
          name?: string
          owner_id?: string
          plan?: string | null
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      owner_notes: {
        Row: {
          author_id: string
          branch_id: string | null
          category: string
          content: string
          created_at: string
          id: string
          note_date: string
          organization_id: string
          pinned: boolean
          title: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          branch_id?: string | null
          category?: string
          content: string
          created_at?: string
          id?: string
          note_date?: string
          organization_id: string
          pinned?: boolean
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          branch_id?: string | null
          category?: string
          content?: string
          created_at?: string
          id?: string
          note_date?: string
          organization_id?: string
          pinned?: boolean
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_notes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods_config: {
        Row: {
          alias_bank_name: string | null
          alias_cbu_cvu: string | null
          alias_enabled: boolean
          alias_instructions: string | null
          alias_titular_name: string | null
          alias_value: string | null
          created_at: string
          id: string
          organization_id: string
          posnet_mp_enabled: boolean
          posnet_mp_label: string | null
          posnet_mp_notes: string | null
          qr_static_enabled: boolean
          qr_static_holder_name: string | null
          qr_static_image_path: string | null
          qr_static_image_url: string | null
          qr_static_instructions: string | null
          updated_at: string
        }
        Insert: {
          alias_bank_name?: string | null
          alias_cbu_cvu?: string | null
          alias_enabled?: boolean
          alias_instructions?: string | null
          alias_titular_name?: string | null
          alias_value?: string | null
          created_at?: string
          id?: string
          organization_id: string
          posnet_mp_enabled?: boolean
          posnet_mp_label?: string | null
          posnet_mp_notes?: string | null
          qr_static_enabled?: boolean
          qr_static_holder_name?: string | null
          qr_static_image_path?: string | null
          qr_static_image_url?: string | null
          qr_static_instructions?: string | null
          updated_at?: string
        }
        Update: {
          alias_bank_name?: string | null
          alias_cbu_cvu?: string | null
          alias_enabled?: boolean
          alias_instructions?: string | null
          alias_titular_name?: string | null
          alias_value?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          posnet_mp_enabled?: boolean
          posnet_mp_label?: string | null
          posnet_mp_notes?: string | null
          qr_static_enabled?: boolean
          qr_static_holder_name?: string | null
          qr_static_image_path?: string | null
          qr_static_image_url?: string | null
          qr_static_instructions?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_invites: {
        Row: {
          branch_id: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invited_by: string | null
          organization_id: string
          token: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          organization_id: string
          token?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          organization_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_invites_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          id: string
          new_cost: number | null
          new_price: number
          old_cost: number | null
          old_price: number | null
          organization_id: string
          product_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_cost?: number | null
          new_price: number
          old_cost?: number | null
          old_price?: number | null
          organization_id: string
          product_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_cost?: number | null
          new_price?: number
          old_cost?: number | null
          old_price?: number | null
          organization_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_with_stock"
            referencedColumns: ["id"]
          },
        ]
      }
      product_catalog: {
        Row: {
          barcode: string
          brand: string | null
          category: string | null
          contributed_by: string | null
          created_at: string | null
          emoji: string | null
          id: string
          name: string
          source: string
          updated_at: string | null
        }
        Insert: {
          barcode: string
          brand?: string | null
          category?: string | null
          contributed_by?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          name: string
          source?: string
          updated_at?: string | null
        }
        Update: {
          barcode?: string
          brand?: string | null
          category?: string | null
          contributed_by?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          name?: string
          source?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          category: string | null
          cost: number | null
          created_at: string | null
          deactivated_at: string | null
          deactivation_reason: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          is_service: boolean | null
          min_stock: number | null
          name: string
          organization_id: string
          sale_price: number
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string | null
          deactivated_at?: string | null
          deactivation_reason?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          is_service?: boolean | null
          min_stock?: number | null
          name: string
          organization_id: string
          sale_price: number
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string | null
          deactivated_at?: string | null
          deactivation_reason?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          is_service?: boolean | null
          min_stock?: number | null
          name?: string
          organization_id?: string
          sale_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          branch_id: string
          created_at: string | null
          created_by: string | null
          date: string | null
          id: string
          invoice_number: string | null
          organization_id: string
          payment_method: string | null
          supplier_id: string
          total: number
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          id?: string
          invoice_number?: string | null
          organization_id: string
          payment_method?: string | null
          supplier_id: string
          total: number
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          id?: string
          invoice_number?: string | null
          organization_id?: string
          payment_method?: string | null
          supplier_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          product_id: string
          quantity: number
          sale_id: string
          stock_batch_id: string | null
          subtotal: number
          unit_cost: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          product_id: string
          quantity: number
          sale_id: string
          stock_batch_id?: string | null
          subtotal: number
          unit_cost?: number | null
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          product_id?: string
          quantity?: number
          sale_id?: string
          stock_batch_id?: string | null
          subtotal?: number
          unit_cost?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_with_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_uninvoiced_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_stock_batch_id_fkey"
            columns: ["stock_batch_id"]
            isOneToOne: false
            referencedRelation: "stock_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_stock_batch_id_fkey"
            columns: ["stock_batch_id"]
            isOneToOne: false
            referencedRelation: "v_expiring_stock"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          branch_id: string
          cash_register_id: string
          cashier_id: string | null
          created_at: string | null
          id: string
          local_id: string | null
          mp_order_id: string | null
          notes: string | null
          organization_id: string
          payment_method: string
          total: number
        }
        Insert: {
          branch_id: string
          cash_register_id: string
          cashier_id?: string | null
          created_at?: string | null
          id?: string
          local_id?: string | null
          mp_order_id?: string | null
          notes?: string | null
          organization_id: string
          payment_method: string
          total: number
        }
        Update: {
          branch_id?: string
          cash_register_id?: string
          cashier_id?: string | null
          created_at?: string | null
          id?: string
          local_id?: string | null
          mp_order_id?: string | null
          notes?: string | null
          organization_id?: string
          payment_method?: string
          total?: number
        }
        Relationships: [
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
          },
          {
            foreignKeyName: "sales_mp_order_id_fkey"
            columns: ["mp_order_id"]
            isOneToOne: false
            referencedRelation: "mercadopago_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_purchases: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          organization_id: string
          payment_method: string | null
          supplier_id: string
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          organization_id: string
          payment_method?: string | null
          supplier_id: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          organization_id?: string
          payment_method?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_purchases_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_purchases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_sales: {
        Row: {
          amount_charged: number
          branch_id: string
          cash_register_id: string | null
          commission: number
          created_at: string | null
          id: string
          notes: string | null
          organization_id: string
          payment_method: string | null
          service_type: string
          supplier_id: string
          total_collected: number
        }
        Insert: {
          amount_charged: number
          branch_id: string
          cash_register_id?: string | null
          commission?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          payment_method?: string | null
          service_type: string
          supplier_id: string
          total_collected: number
        }
        Update: {
          amount_charged?: number
          branch_id?: string
          cash_register_id?: string | null
          commission?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          payment_method?: string | null
          service_type?: string
          supplier_id?: string
          total_collected?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_sales_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_sales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_sales_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_batches: {
        Row: {
          batch_number: string | null
          branch_id: string
          created_at: string | null
          expiration_date: string | null
          id: string
          organization_id: string
          product_id: string
          quantity: number
          status: string | null
          supplier_id: string | null
          unit_cost: number | null
        }
        Insert: {
          batch_number?: string | null
          branch_id: string
          created_at?: string | null
          expiration_date?: string | null
          id?: string
          organization_id: string
          product_id: string
          quantity?: number
          status?: string | null
          supplier_id?: string | null
          unit_cost?: number | null
        }
        Update: {
          batch_number?: string | null
          branch_id?: string
          created_at?: string | null
          expiration_date?: string | null
          id?: string
          organization_id?: string
          product_id?: string
          quantity?: number
          status?: string | null
          supplier_id?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "stock_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_with_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          balance: number | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          markup_type: string | null
          markup_value: number | null
          name: string
          organization_id: string
          phone: string | null
          rubro: string | null
          supplier_type: string
          tax_id: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          markup_type?: string | null
          markup_value?: number | null
          name: string
          organization_id: string
          phone?: string | null
          rubro?: string | null
          supplier_type?: string
          tax_id?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          markup_type?: string | null
          markup_value?: number | null
          name?: string
          organization_id?: string
          phone?: string | null
          rubro?: string | null
          supplier_type?: string
          tax_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_config: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          tardanza_grave_min: number
          tardanza_tolerancia_min: number
          umbral_diferencia_grave: number
          umbral_diferencia_leve: number
          updated_at: string | null
          xp_apertura_puntual: number
          xp_cierre_limpio: number
          xp_diferencia_grave: number
          xp_mision_incumplida: number
          xp_tardanza_grave: number
          xp_tardanza_leve: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          tardanza_grave_min?: number
          tardanza_tolerancia_min?: number
          umbral_diferencia_grave?: number
          umbral_diferencia_leve?: number
          updated_at?: string | null
          xp_apertura_puntual?: number
          xp_cierre_limpio?: number
          xp_diferencia_grave?: number
          xp_mision_incumplida?: number
          xp_tardanza_grave?: number
          xp_tardanza_leve?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          tardanza_grave_min?: number
          tardanza_tolerancia_min?: number
          umbral_diferencia_grave?: number
          umbral_diferencia_leve?: number
          updated_at?: string | null
          xp_apertura_puntual?: number
          xp_cierre_limpio?: number
          xp_diferencia_grave?: number
          xp_mision_incumplida?: number
          xp_tardanza_grave?: number
          xp_tardanza_leve?: number
        }
        Relationships: [
          {
            foreignKeyName: "xp_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_events: {
        Row: {
          branch_id: string | null
          cash_register_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          event_type: string
          id: string
          incident_id: string | null
          organization_id: string
          points: number
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          cash_register_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_type: string
          id?: string
          incident_id?: string | null
          organization_id: string
          points: number
          user_id: string
        }
        Update: {
          branch_id?: string | null
          cash_register_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_type?: string
          id?: string
          incident_id?: string | null
          organization_id?: string
          points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_daily_sales: {
        Row: {
          branch_id: string | null
          date: string | null
          organization_id: string | null
          payment_method: string | null
          sale_count: number | null
          total_amount: number | null
          total_profit: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_expiring_stock: {
        Row: {
          branch_id: string | null
          days_until_expiry: number | null
          emoji: string | null
          expiration_date: string | null
          id: string | null
          organization_id: string | null
          product_id: string | null
          product_name: string | null
          quantity: number | null
          value_at_risk: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "stock_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_with_stock"
            referencedColumns: ["id"]
          },
        ]
      }
      v_products_with_stock: {
        Row: {
          barcode: string | null
          branch_id: string | null
          category: string | null
          cost: number | null
          emoji: string | null
          id: string | null
          is_active: boolean | null
          is_service: boolean | null
          min_stock: number | null
          name: string | null
          organization_id: string | null
          sale_price: number | null
          stock_available: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      v_uninvoiced_sales: {
        Row: {
          branch_id: string | null
          cash_register_id: string | null
          created_at: string | null
          id: string | null
          item_count: number | null
          items_preview: Json | null
          notes: string | null
          organization_id: string | null
          payment_method: string | null
          total: number | null
        }
        Insert: {
          branch_id?: string | null
          cash_register_id?: string | null
          created_at?: string | null
          id?: string | null
          item_count?: never
          items_preview?: never
          notes?: string | null
          organization_id?: string | null
          payment_method?: string | null
          total?: number | null
        }
        Update: {
          branch_id?: string | null
          cash_register_id?: string | null
          created_at?: string | null
          id?: string | null
          item_count?: never
          items_preview?: never
          notes?: string | null
          organization_id?: string | null
          payment_method?: string | null
          total?: number | null
        }
        Relationships: [
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
          },
          {
            foreignKeyName: "sales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invite: {
        Args: { p_email: string; p_token: string; p_user_name: string }
        Returns: Json
      }
      assign_user_role_v2: {
        Args: {
          p_invited_by?: string
          p_organization_id: string
          p_role?: string
          p_sucursal_id?: string
          p_user_id: string
        }
        Returns: string
      }
      cleanup_expired_invites: { Args: never; Returns: number }
      cleanup_old_audit_logs: {
        Args: { days_to_keep?: number }
        Returns: number
      }
      complete_employee_setup_v2: {
        Args: {
          p_email: string
          p_invite_token?: string
          p_profile_name: string
          p_user_id: string
        }
        Returns: Json
      }
      create_initial_setup_v2: {
        Args: {
          p_email: string
          p_org_name: string
          p_profile_name: string
          p_user_id: string
        }
        Returns: Json
      }
      deactivate_supplier: {
        Args: { supplier_id_input: string }
        Returns: boolean
      }
      es_owner_v2: { Args: never; Returns: boolean }
      expire_pending_mp_orders: { Args: never; Returns: number }
      get_my_branch_id: { Args: never; Returns: string }
      get_my_org_id: { Args: never; Returns: string }
      get_my_org_id_v2: { Args: never; Returns: string }
      get_my_role: { Args: never; Returns: string }
      get_next_invoice_number: {
        Args: {
          p_invoice_type: string
          p_org_id: string
          p_point_of_sale: number
        }
        Returns: number
      }
      is_org_admin: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      process_sale: {
        Args: {
          p_branch_id: string
          p_cash_register_id: string
          p_items: Json
          p_local_id?: string
          p_notes?: string
          p_payment_method: string
          p_total: number
        }
        Returns: string
      }
      process_sale_from_webhook: {
        Args: {
          p_branch_id: string
          p_cash_register_id: string
          p_items: Json
          p_notes?: string
          p_org_id: string
          p_payment_method: string
          p_total: number
        }
        Returns: string
      }
      setup_organization: {
        Args: { p_email: string; p_org_name: string; p_user_name: string }
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

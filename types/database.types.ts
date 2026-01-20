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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      actividades_empleados: {
        Row: {
          creado_en: string | null
          descripcion: string
          id: string
          metadata: Json | null
          organization_id: string | null
          perfil_id: string
          puntos_ganados: number | null
          sucursal_id: string | null
          tipo: string
        }
        Insert: {
          creado_en?: string | null
          descripcion: string
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          perfil_id: string
          puntos_ganados?: number | null
          sucursal_id?: string | null
          tipo: string
        }
        Update: {
          creado_en?: string | null
          descripcion?: string
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          perfil_id?: string
          puntos_ganados?: number | null
          sucursal_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "actividades_empleados_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actividades_empleados_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actividades_empleados_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "vista_resumen_empleados"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "actividades_empleados_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "vista_top_vendedores_mes"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "actividades_empleados_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actividades_empleados_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "view_productos_con_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "actividades_empleados_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_empleados_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "actividades_empleados_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_metricas_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "actividades_empleados_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_productos_bajo_stock"
            referencedColumns: ["sucursal_id"]
          },
        ]
      }
      alertas_vencimientos: {
        Row: {
          alertado: boolean | null
          creado_en: string | null
          dias_restantes: number | null
          id: string
          organization_id: string
          resuelto: boolean | null
          resuelto_en: string | null
          resuelto_por: string | null
          stock_id: string
          sucursal_id: string
        }
        Insert: {
          alertado?: boolean | null
          creado_en?: string | null
          dias_restantes?: number | null
          id?: string
          organization_id: string
          resuelto?: boolean | null
          resuelto_en?: string | null
          resuelto_por?: string | null
          stock_id: string
          sucursal_id: string
        }
        Update: {
          alertado?: boolean | null
          creado_en?: string | null
          dias_restantes?: number | null
          id?: string
          organization_id?: string
          resuelto?: boolean | null
          resuelto_en?: string | null
          resuelto_por?: string | null
          stock_id?: string
          sucursal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_vencimientos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_vencimientos_resuelto_por_fkey"
            columns: ["resuelto_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_vencimientos_resuelto_por_fkey"
            columns: ["resuelto_por"]
            isOneToOne: false
            referencedRelation: "vista_resumen_empleados"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "alertas_vencimientos_resuelto_por_fkey"
            columns: ["resuelto_por"]
            isOneToOne: false
            referencedRelation: "vista_top_vendedores_mes"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "alertas_vencimientos_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_vencimientos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_vencimientos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "view_productos_con_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "alertas_vencimientos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_empleados_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "alertas_vencimientos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_metricas_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "alertas_vencimientos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_productos_bajo_stock"
            referencedColumns: ["sucursal_id"]
          },
        ]
      }
      asistencia: {
        Row: {
          created_at: string
          empleado_id: string
          entrada: string
          id: string
          organization_id: string
          salida: string | null
          sucursal_id: string
        }
        Insert: {
          created_at?: string
          empleado_id: string
          entrada?: string
          id?: string
          organization_id: string
          salida?: string | null
          sucursal_id: string
        }
        Update: {
          created_at?: string
          empleado_id?: string
          entrada?: string
          id?: string
          organization_id?: string
          salida?: string | null
          sucursal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asistencia_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencia_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "vista_resumen_empleados"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "asistencia_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "vista_top_vendedores_mes"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "asistencia_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencia_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencia_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "view_productos_con_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "asistencia_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_empleados_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "asistencia_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_metricas_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "asistencia_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_productos_bajo_stock"
            referencedColumns: ["sucursal_id"]
          },
        ]
      }
      caja_diaria: {
        Row: {
          created_at: string
          diferencia: number | null
          empleado_id: string | null
          fecha_apertura: string
          fecha_cierre: string | null
          id: string
          monto_final: number | null
          monto_inicial: number
          organization_id: string
          sucursal_id: string
        }
        Insert: {
          created_at?: string
          diferencia?: number | null
          empleado_id?: string | null
          fecha_apertura?: string
          fecha_cierre?: string | null
          id?: string
          monto_final?: number | null
          monto_inicial?: number
          organization_id: string
          sucursal_id: string
        }
        Update: {
          created_at?: string
          diferencia?: number | null
          empleado_id?: string | null
          fecha_apertura?: string
          fecha_cierre?: string | null
          id?: string
          monto_final?: number | null
          monto_inicial?: number
          organization_id?: string
          sucursal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caja_diaria_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_diaria_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "vista_resumen_empleados"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "caja_diaria_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "vista_top_vendedores_mes"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "caja_diaria_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_diaria_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_diaria_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "view_productos_con_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "caja_diaria_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_empleados_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "caja_diaria_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_metricas_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "caja_diaria_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_productos_bajo_stock"
            referencedColumns: ["sucursal_id"]
          },
        ]
      }
      compras: {
        Row: {
          comprobante_nro: string | null
          created_at: string
          estado_pago: string | null
          fecha_compra: string | null
          id: string
          medio_pago: string | null
          monto_total: number
          organization_id: string
          proveedor_id: string | null
          vencimiento_pago: string | null
        }
        Insert: {
          comprobante_nro?: string | null
          created_at?: string
          estado_pago?: string | null
          fecha_compra?: string | null
          id?: string
          medio_pago?: string | null
          monto_total: number
          organization_id: string
          proveedor_id?: string | null
          vencimiento_pago?: string | null
        }
        Update: {
          comprobante_nro?: string | null
          created_at?: string
          estado_pago?: string | null
          fecha_compra?: string | null
          id?: string
          medio_pago?: string | null
          monto_total?: number
          organization_id?: string
          proveedor_id?: string | null
          vencimiento_pago?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compras_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      historial_precios: {
        Row: {
          costo_anterior: number | null
          costo_nuevo: number | null
          empleado_id: string | null
          fecha_cambio: string
          id: string
          organization_id: string
          precio_venta_anterior: number | null
          precio_venta_nuevo: number | null
          producto_id: string | null
        }
        Insert: {
          costo_anterior?: number | null
          costo_nuevo?: number | null
          empleado_id?: string | null
          fecha_cambio?: string
          id?: string
          organization_id: string
          precio_venta_anterior?: number | null
          precio_venta_nuevo?: number | null
          producto_id?: string | null
        }
        Update: {
          costo_anterior?: number | null
          costo_nuevo?: number | null
          empleado_id?: string | null
          fecha_cambio?: string
          id?: string
          organization_id?: string
          precio_venta_anterior?: number | null
          precio_venta_nuevo?: number | null
          producto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historial_precios_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_precios_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "vista_resumen_empleados"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "historial_precios_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "vista_top_vendedores_mes"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "historial_precios_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_precios_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_precios_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "view_productos_con_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_precios_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vista_productos_bajo_stock"
            referencedColumns: ["id"]
          },
        ]
      }
      metricas_diarias: {
        Row: {
          actualizado_en: string | null
          cantidad_ventas: number | null
          creado_en: string | null
          fecha: string
          horas_trabajadas: number | null
          id: string
          metadata: Json | null
          organization_id: string
          perfil_id: string | null
          puntos_ganados: number | null
          sucursal_id: string | null
          tareas_completadas: number | null
          total_ventas: number | null
        }
        Insert: {
          actualizado_en?: string | null
          cantidad_ventas?: number | null
          creado_en?: string | null
          fecha?: string
          horas_trabajadas?: number | null
          id?: string
          metadata?: Json | null
          organization_id: string
          perfil_id?: string | null
          puntos_ganados?: number | null
          sucursal_id?: string | null
          tareas_completadas?: number | null
          total_ventas?: number | null
        }
        Update: {
          actualizado_en?: string | null
          cantidad_ventas?: number | null
          creado_en?: string | null
          fecha?: string
          horas_trabajadas?: number | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          perfil_id?: string | null
          puntos_ganados?: number | null
          sucursal_id?: string | null
          tareas_completadas?: number | null
          total_ventas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metricas_diarias_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metricas_diarias_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metricas_diarias_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "vista_resumen_empleados"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "metricas_diarias_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "vista_top_vendedores_mes"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "metricas_diarias_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metricas_diarias_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "view_productos_con_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "metricas_diarias_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_empleados_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "metricas_diarias_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_metricas_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "metricas_diarias_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_productos_bajo_stock"
            referencedColumns: ["sucursal_id"]
          },
        ]
      }
      misiones: {
        Row: {
          caja_diaria_id: string | null
          created_at: string
          descripcion: string | null
          empleado_id: string
          es_completada: boolean
          id: string
          objetivo_unidades: number
          organization_id: string
          puntos: number
          tipo: string
          unidades_completadas: number
        }
        Insert: {
          caja_diaria_id?: string | null
          created_at?: string
          descripcion?: string | null
          empleado_id: string
          es_completada?: boolean
          id?: string
          objetivo_unidades?: number
          organization_id: string
          puntos?: number
          tipo: string
          unidades_completadas?: number
        }
        Update: {
          caja_diaria_id?: string | null
          created_at?: string
          descripcion?: string | null
          empleado_id?: string
          es_completada?: boolean
          id?: string
          objetivo_unidades?: number
          organization_id?: string
          puntos?: number
          tipo?: string
          unidades_completadas?: number
        }
        Relationships: [
          {
            foreignKeyName: "misiones_caja_diaria_id_fkey"
            columns: ["caja_diaria_id"]
            isOneToOne: false
            referencedRelation: "caja_diaria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "misiones_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "misiones_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "vista_resumen_empleados"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "misiones_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "vista_top_vendedores_mes"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "misiones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_caja: {
        Row: {
          caja_diaria_id: string
          categoria: string | null
          created_at: string
          descripcion: string
          id: string
          monto: number
          organization_id: string
          tipo: string
        }
        Insert: {
          caja_diaria_id: string
          categoria?: string | null
          created_at?: string
          descripcion: string
          id?: string
          monto: number
          organization_id: string
          tipo: string
        }
        Update: {
          caja_diaria_id?: string
          categoria?: string | null
          created_at?: string
          descripcion?: string
          id?: string
          monto?: number
          organization_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_caja_caja_diaria_id_fkey"
            columns: ["caja_diaria_id"]
            isOneToOne: false
            referencedRelation: "caja_diaria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_caja_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          nombre: string
          owner_id: string | null
          plan: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          owner_id?: string | null
          plan?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          owner_id?: string | null
          plan?: string | null
        }
        Relationships: []
      }
      user_organization_roles: {
        Row: {
          id: string
          user_id: string
          organization_id: string
          role: 'owner' | 'admin' | 'manager' | 'employee'
          sucursal_id: string | null
          is_active: boolean
          invited_by: string | null
          invited_at: string | null
          joined_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          organization_id: string
          role?: 'owner' | 'admin' | 'manager' | 'employee'
          sucursal_id?: string | null
          is_active?: boolean
          invited_by?: string | null
          invited_at?: string | null
          joined_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          organization_id?: string
          role?: 'owner' | 'admin' | 'manager' | 'employee'
          sucursal_id?: string | null
          is_active?: boolean
          invited_by?: string | null
          invited_at?: string | null
          joined_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_organization_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_organization_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_organization_roles_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_organization_roles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          }
        ]
      }
      pending_invites: {
        Row: {
          created_at: string
          email: string
          id: string
          organization_id: string
          rol: string | null
          sucursal_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          organization_id: string
          rol?: string | null
          sucursal_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          organization_id?: string
          rol?: string | null
          sucursal_id?: string | null
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
            foreignKeyName: "pending_invites_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_invites_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "view_productos_con_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "pending_invites_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_empleados_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "pending_invites_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_metricas_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "pending_invites_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_productos_bajo_stock"
            referencedColumns: ["sucursal_id"]
          },
        ]
      }
      perfiles: {
        Row: {
          activo: boolean
          created_at: string
          email: string | null
          id: string
          nivel: number
          nombre: string | null
          organization_id: string | null
          puntos: number
          rol: string
          sucursal_actual_id: string | null
          sucursal_id: string | null
          xp: number
        }
        Insert: {
          activo?: boolean
          created_at?: string
          email?: string | null
          id: string
          nivel?: number
          nombre?: string | null
          organization_id?: string | null
          puntos?: number
          rol: string
          sucursal_actual_id?: string | null
          sucursal_id?: string | null
          xp?: number
        }
        Update: {
          activo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nivel?: number
          nombre?: string | null
          organization_id?: string | null
          puntos?: number
          rol?: string
          sucursal_actual_id?: string | null
          sucursal_id?: string | null
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfiles_sucursal_actual_id_fkey"
            columns: ["sucursal_actual_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfiles_sucursal_actual_id_fkey"
            columns: ["sucursal_actual_id"]
            isOneToOne: false
            referencedRelation: "view_productos_con_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "perfiles_sucursal_actual_id_fkey"
            columns: ["sucursal_actual_id"]
            isOneToOne: false
            referencedRelation: "vista_empleados_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "perfiles_sucursal_actual_id_fkey"
            columns: ["sucursal_actual_id"]
            isOneToOne: false
            referencedRelation: "vista_metricas_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "perfiles_sucursal_actual_id_fkey"
            columns: ["sucursal_actual_id"]
            isOneToOne: false
            referencedRelation: "vista_productos_bajo_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "perfiles_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfiles_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "view_productos_con_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "perfiles_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_empleados_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "perfiles_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_metricas_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "perfiles_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_productos_bajo_stock"
            referencedColumns: ["sucursal_id"]
          },
        ]
      }
      plantillas_misiones: {
        Row: {
          activa: boolean
          created_at: string
          descripcion: string
          id: string
          organization_id: string
          puntos: number
          sucursal_id: string | null
        }
        Insert: {
          activa?: boolean
          created_at?: string
          descripcion: string
          id?: string
          organization_id: string
          puntos?: number
          sucursal_id?: string | null
        }
        Update: {
          activa?: boolean
          created_at?: string
          descripcion?: string
          id?: string
          organization_id?: string
          puntos?: number
          sucursal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plantillas_misiones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantillas_misiones_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantillas_misiones_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "view_productos_con_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "plantillas_misiones_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_empleados_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "plantillas_misiones_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_metricas_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "plantillas_misiones_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_productos_bajo_stock"
            referencedColumns: ["sucursal_id"]
          },
        ]
      }
      productos: {
        Row: {
          categoria: string | null
          codigo_barras: string | null
          costo: number
          created_at: string
          emoji: string | null
          id: string
          nombre: string
          organization_id: string
          precio_venta: number
          stock_minimo: number
          vida_util_dias: number
        }
        Insert: {
          categoria?: string | null
          codigo_barras?: string | null
          costo?: number
          created_at?: string
          emoji?: string | null
          id?: string
          nombre: string
          organization_id: string
          precio_venta?: number
          stock_minimo?: number
          vida_util_dias?: number
        }
        Update: {
          categoria?: string | null
          codigo_barras?: string | null
          costo?: number
          created_at?: string
          emoji?: string | null
          id?: string
          nombre?: string
          organization_id?: string
          precio_venta?: number
          stock_minimo?: number
          vida_util_dias?: number
        }
        Relationships: [
          {
            foreignKeyName: "productos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      proveedores: {
        Row: {
          condicion_pago: string | null
          contacto_nombre: string | null
          created_at: string
          email: string | null
          id: string
          nombre: string
          organization_id: string
          rubro: string | null
          saldo_actual: number
          sucursal_id: string | null
          telefono: string | null
        }
        Insert: {
          condicion_pago?: string | null
          contacto_nombre?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nombre: string
          organization_id: string
          rubro?: string | null
          saldo_actual?: number
          sucursal_id?: string | null
          telefono?: string | null
        }
        Update: {
          condicion_pago?: string | null
          contacto_nombre?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string
          organization_id?: string
          rubro?: string | null
          saldo_actual?: number
          sucursal_id?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proveedores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedores_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedores_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "view_productos_con_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "proveedores_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_empleados_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "proveedores_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_metricas_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "proveedores_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_productos_bajo_stock"
            referencedColumns: ["sucursal_id"]
          },
        ]
      }
      stock: {
        Row: {
          caja_diaria_id: string | null
          cantidad: number
          compra_id: string | null
          costo_unitario_historico: number | null
          created_at: string
          estado: string | null
          fecha_ingreso: string
          fecha_vencimiento: string | null
          fecha_venta: string | null
          id: string
          metodo_pago: string | null
          notas: string | null
          organization_id: string
          precio_venta_historico: number | null
          producto_id: string
          proveedor_id: string | null
          sucursal_id: string
          tipo_movimiento: string
          ubicacion: string | null
        }
        Insert: {
          caja_diaria_id?: string | null
          cantidad: number
          compra_id?: string | null
          costo_unitario_historico?: number | null
          created_at?: string
          estado?: string | null
          fecha_ingreso?: string
          fecha_vencimiento?: string | null
          fecha_venta?: string | null
          id?: string
          metodo_pago?: string | null
          notas?: string | null
          organization_id: string
          precio_venta_historico?: number | null
          producto_id: string
          proveedor_id?: string | null
          sucursal_id: string
          tipo_movimiento: string
          ubicacion?: string | null
        }
        Update: {
          caja_diaria_id?: string | null
          cantidad?: number
          compra_id?: string | null
          costo_unitario_historico?: number | null
          created_at?: string
          estado?: string | null
          fecha_ingreso?: string
          fecha_vencimiento?: string | null
          fecha_venta?: string | null
          id?: string
          metodo_pago?: string | null
          notas?: string | null
          organization_id?: string
          precio_venta_historico?: number | null
          producto_id?: string
          proveedor_id?: string | null
          sucursal_id?: string
          tipo_movimiento?: string
          ubicacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_caja_diaria_id_fkey"
            columns: ["caja_diaria_id"]
            isOneToOne: false
            referencedRelation: "caja_diaria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "view_productos_con_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vista_productos_bajo_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "view_productos_con_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "stock_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_empleados_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "stock_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_metricas_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "stock_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_productos_bajo_stock"
            referencedColumns: ["sucursal_id"]
          },
        ]
      }
      sucursales: {
        Row: {
          created_at: string
          direccion: string | null
          id: string
          nombre: string
          organization_id: string
          qr_entrada_url: string | null
          qr_salida_url: string | null
        }
        Insert: {
          created_at?: string
          direccion?: string | null
          id?: string
          nombre: string
          organization_id: string
          qr_entrada_url?: string | null
          qr_salida_url?: string | null
        }
        Update: {
          created_at?: string
          direccion?: string | null
          id?: string
          nombre?: string
          organization_id?: string
          qr_entrada_url?: string | null
          qr_salida_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sucursales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tareas_empleados: {
        Row: {
          actualizado_en: string | null
          asignado_a: string
          asignado_por: string | null
          completado_en: string | null
          creado_en: string | null
          descripcion: string | null
          estado: string | null
          evidencia: Json | null
          fecha_limite: string | null
          id: string
          organization_id: string
          prioridad: string | null
          puntos_recompensa: number | null
          sucursal_id: string | null
          tipo: string | null
          titulo: string
        }
        Insert: {
          actualizado_en?: string | null
          asignado_a: string
          asignado_por?: string | null
          completado_en?: string | null
          creado_en?: string | null
          descripcion?: string | null
          estado?: string | null
          evidencia?: Json | null
          fecha_limite?: string | null
          id?: string
          organization_id: string
          prioridad?: string | null
          puntos_recompensa?: number | null
          sucursal_id?: string | null
          tipo?: string | null
          titulo: string
        }
        Update: {
          actualizado_en?: string | null
          asignado_a?: string
          asignado_por?: string | null
          completado_en?: string | null
          creado_en?: string | null
          descripcion?: string | null
          estado?: string | null
          evidencia?: Json | null
          fecha_limite?: string | null
          id?: string
          organization_id?: string
          prioridad?: string | null
          puntos_recompensa?: number | null
          sucursal_id?: string | null
          tipo?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tareas_empleados_asignado_a_fkey"
            columns: ["asignado_a"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_empleados_asignado_a_fkey"
            columns: ["asignado_a"]
            isOneToOne: false
            referencedRelation: "vista_resumen_empleados"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "tareas_empleados_asignado_a_fkey"
            columns: ["asignado_a"]
            isOneToOne: false
            referencedRelation: "vista_top_vendedores_mes"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "tareas_empleados_asignado_por_fkey"
            columns: ["asignado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_empleados_asignado_por_fkey"
            columns: ["asignado_por"]
            isOneToOne: false
            referencedRelation: "vista_resumen_empleados"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "tareas_empleados_asignado_por_fkey"
            columns: ["asignado_por"]
            isOneToOne: false
            referencedRelation: "vista_top_vendedores_mes"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "tareas_empleados_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_empleados_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_empleados_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "view_productos_con_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "tareas_empleados_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_empleados_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "tareas_empleados_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_metricas_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "tareas_empleados_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_productos_bajo_stock"
            referencedColumns: ["sucursal_id"]
          },
        ]
      }
      ventas: {
        Row: {
          id: string
          organization_id: string
          sucursal_id: string
          caja_diaria_id: string
          vendedor_id: string | null
          monto_total: number
          metodo_pago: string
          estado: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          sucursal_id: string
          caja_diaria_id: string
          vendedor_id?: string | null
          monto_total: number
          metodo_pago: string
          estado?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          sucursal_id?: string
          caja_diaria_id?: string
          vendedor_id?: string | null
          monto_total?: number
          metodo_pago?: string
          estado?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ventas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_caja_diaria_id_fkey"
            columns: ["caja_diaria_id"]
            isOneToOne: false
            referencedRelation: "caja_diaria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          }
        ]
      }
      detalles_venta: {
        Row: {
          id: string
          organization_id: string
          venta_id: string
          producto_id: string
          cantidad: number
          precio_unitario: number
          subtotal: number
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          venta_id: string
          producto_id: string
          cantidad: number
          precio_unitario: number
          subtotal: number
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          venta_id?: string
          producto_id?: string
          cantidad?: number
          precio_unitario?: number
          subtotal?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "detalles_venta_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalles_venta_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalles_venta_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          }
        ]
      }
      movimientos: {
        Row: {
          id: string
          organization_id: string | null
          producto_id: string | null
          sucursal_id: string | null
          cantidad: number
          tipo_movimiento: string
          estado: string | null
          referencia_tabla: string | null
          referencia_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          producto_id?: string | null
          sucursal_id?: string | null
          cantidad: number
          tipo_movimiento: string
          estado?: string | null
          referencia_tabla?: string | null
          referencia_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          producto_id?: string | null
          sucursal_id?: string | null
          cantidad?: number
          tipo_movimiento?: string
          estado?: string | null
          referencia_tabla?: string | null
          referencia_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          }
        ]
      }
      ventas_servicios: {
        Row: {
          caja_diaria_id: string
          comision: number
          fecha_venta: string
          id: string
          metodo_pago: string
          monto_carga: number
          notas: string | null
          organization_id: string
          proveedor_id: string
          sucursal_id: string
          tipo_servicio: string
          total_cobrado: number
        }
        Insert: {
          caja_diaria_id: string
          comision: number
          fecha_venta?: string
          id?: string
          metodo_pago: string
          monto_carga: number
          notas?: string | null
          organization_id: string
          proveedor_id: string
          sucursal_id: string
          tipo_servicio: string
          total_cobrado: number
        }
        Update: {
          caja_diaria_id?: string
          comision?: number
          fecha_venta?: string
          id?: string
          metodo_pago?: string
          monto_carga?: number
          notas?: string | null
          organization_id?: string
          proveedor_id?: string
          sucursal_id?: string
          tipo_servicio?: string
          total_cobrado?: number
        }
        Relationships: [
          {
            foreignKeyName: "ventas_servicios_caja_diaria_id_fkey"
            columns: ["caja_diaria_id"]
            isOneToOne: false
            referencedRelation: "caja_diaria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_servicios_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_servicios_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_servicios_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      view_productos_con_stock: {
        Row: {
          categoria: string | null
          codigo_barras: string | null
          costo: number | null
          emoji: string | null
          id: string | null
          nombre: string | null
          organization_id: string | null
          precio_venta: number | null
          stock_disponible: number | null
          stock_minimo: number | null
          sucursal_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vista_alertas_vencimientos_activas: {
        Row: {
          creado_en: string | null
          dias_restantes: number | null
          fecha_vencimiento: string | null
          id: string | null
          organization_id: string | null
          producto_emoji: string | null
          producto_id: string | null
          producto_nombre: string | null
          stock_id: string | null
          sucursal_id: string | null
          sucursal_nombre: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alertas_vencimientos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_vencimientos_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_vencimientos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_vencimientos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "view_productos_con_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "alertas_vencimientos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_empleados_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "alertas_vencimientos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_metricas_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "alertas_vencimientos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_productos_bajo_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "stock_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "view_productos_con_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vista_productos_bajo_stock"
            referencedColumns: ["id"]
          },
        ]
      }
      vista_asistencias_hoy: {
        Row: {
          entrada: string | null
          id: string | null
          nombre: string | null
          organization_id: string | null
          perfil_id: string | null
          salida: string | null
          sucursal: string | null
          sucursal_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asistencia_empleado_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencia_empleado_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "vista_resumen_empleados"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "asistencia_empleado_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "vista_top_vendedores_mes"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "asistencia_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencia_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencia_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "view_productos_con_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "asistencia_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_empleados_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "asistencia_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_metricas_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "asistencia_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_productos_bajo_stock"
            referencedColumns: ["sucursal_id"]
          },
        ]
      }
      vista_empleados_por_sucursal: {
        Row: {
          empleados_activos: number | null
          empleados_actuales: number | null
          sucursal_id: string | null
          sucursal_nombre: string | null
          total_empleados_asignados: number | null
        }
        Relationships: []
      }
      vista_metricas_por_sucursal: {
        Row: {
          cantidad_ventas_mes: number | null
          empleados_activos_mes: number | null
          promedio_venta_mes: number | null
          puntos_totales_mes: number | null
          sucursal_id: string | null
          sucursal_nombre: string | null
          tareas_completadas_mes: number | null
          total_ventas_mes: number | null
        }
        Relationships: []
      }
      vista_productos_bajo_stock: {
        Row: {
          categoria: string | null
          emoji: string | null
          id: string | null
          nombre: string | null
          organization_id: string | null
          stock_disponible: number | null
          stock_minimo: number | null
          sucursal_id: string | null
          sucursal_nombre: string | null
          unidades_faltantes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vista_resumen_empleados: {
        Row: {
          cantidad_ventas_mes: number | null
          dias_trabajados_mes: number | null
          email: string | null
          nivel: number | null
          nombre: string | null
          perfil_id: string | null
          puntos_mes: number | null
          puntos_totales: number | null
          sucursal_actual: string | null
          sucursal_actual_id: string | null
          sucursal_asignada: string | null
          sucursal_id: string | null
          tareas_completadas_mes: number | null
          total_ventas_mes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_sucursal_actual_id_fkey"
            columns: ["sucursal_actual_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfiles_sucursal_actual_id_fkey"
            columns: ["sucursal_actual_id"]
            isOneToOne: false
            referencedRelation: "view_productos_con_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "perfiles_sucursal_actual_id_fkey"
            columns: ["sucursal_actual_id"]
            isOneToOne: false
            referencedRelation: "vista_empleados_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "perfiles_sucursal_actual_id_fkey"
            columns: ["sucursal_actual_id"]
            isOneToOne: false
            referencedRelation: "vista_metricas_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "perfiles_sucursal_actual_id_fkey"
            columns: ["sucursal_actual_id"]
            isOneToOne: false
            referencedRelation: "vista_productos_bajo_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "perfiles_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfiles_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "view_productos_con_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "perfiles_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_empleados_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "perfiles_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_metricas_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "perfiles_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_productos_bajo_stock"
            referencedColumns: ["sucursal_id"]
          },
        ]
      }
      vista_top_vendedores_mes: {
        Row: {
          cantidad_ventas: number | null
          nombre: string | null
          perfil_id: string | null
          promedio_venta: number | null
          sucursal: string | null
          total_ventas: number | null
        }
        Relationships: []
      }
      vista_ventas_recientes: {
        Row: {
          creado_en: string | null
          id: string | null
          items: Json | null
          metodo_pago: string | null
          organization_id: string | null
          perfil_id: string | null
          sucursal_id: string | null
          sucursal_nombre: string | null
          total: number | null
          vendedor_nombre: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "vista_resumen_empleados"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "ventas_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "vista_top_vendedores_mes"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "ventas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "view_productos_con_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "ventas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_empleados_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "ventas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_metricas_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "ventas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "vista_productos_bajo_stock"
            referencedColumns: ["sucursal_id"]
          },
        ]
      }
      reportes_ventas_unificados: {
        Row: {
          venta_id: string | null
          organization_id: string | null
          sucursal_id: string | null
          caja_diaria_id: string | null
          fecha_venta: string | null
          tipo_venta: string | null
          descripcion: string | null
          icono: string | null
          referencia_id: string | null
          unidades_vendidas: number | null
          precio_unitario: number | null
          monto_total: number | null
          costo_unitario: number | null
          ganancia_neta: number | null
          metodo_pago: string | null
          notas: string | null
          timestamp_original: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calcular_horas_trabajadas: {
        Args: { p_fecha?: string; p_perfil_id: string }
        Returns: number
      }
      crear_perfil_desde_auth_user: {
        Args: { user_id: string }
        Returns: string
      }
      descontar_saldo_proveedor: {
        Args: { monto_descuento: number; proveedor_id_uuid: string }
        Returns: undefined
      }
      get_my_org_id: { Args: never; Returns: string }
      get_my_org_id_v2: { Args: never; Returns: string }
      get_my_role_v2: { Args: never; Returns: string }
      get_my_sucursal_id_v2: { Args: never; Returns: string }
      get_user_org_context_v2: {
        Args: never
        Returns: {
          organization_id: string
          role: string
          sucursal_id: string | null
          is_owner: boolean
        }[]
      }
      es_owner_v2: { Args: never; Returns: boolean }
      es_dueno_v2: { Args: never; Returns: boolean }
      create_organization_v2: {
        Args: { p_owner_id: string; p_org_name?: string }
        Returns: string
      }
      assign_user_role_v2: {
        Args: {
          p_user_id: string
          p_organization_id: string
          p_role?: string
          p_sucursal_id?: string
          p_invited_by?: string
        }
        Returns: string
      }
      create_initial_setup_v2: {
        Args: {
          p_user_id: string
          p_org_name: string
          p_profile_name: string
          p_email: string
        }
        Returns: Json
      }
      invite_employee_v2: {
        Args: {
          p_email: string
          p_organization_id: string
          p_sucursal_id: string
          p_invited_by: string
        }
        Returns: string
      }
      complete_employee_setup_v2: {
        Args: {
          p_user_id: string
          p_profile_name: string
          p_email: string
          p_invite_token?: string
        }
        Returns: Json
      }
      get_user_email: { Args: never; Returns: string }
      get_user_organization_id: { Args: never; Returns: string }
      incrementar_saldo_proveedor: {
        Args: { id_input: string; monto_input: number }
        Returns: undefined
      }
      procesar_venta: {
        Args: {
          p_sucursal_id: string
          p_caja_diaria_id: string
          p_items: Json
          p_metodo_pago_global: string
          p_monto_total_cliente: number
        }
        Returns: string
      }
      verificar_stock_disponible: {
        Args: {
          p_cantidad_solicitada: number
          p_producto_id: string
          p_sucursal_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      mission_type: "vencimiento" | "arqueo_cierre" | "manual"
      moment_turno: "apertura" | "durante_turno" | "cierre"
      org_role: "owner" | "admin" | "manager" | "employee"
      payment_method:
        | "efectivo"
        | "tarjeta"
        | "transferencia"
        | "billetera_virtual"
        | "otro"
      user_role: "dueño" | "empleado"
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
      mission_type: ["vencimiento", "arqueo_cierre", "manual"],
      moment_turno: ["apertura", "durante_turno", "cierre"],
      org_role: ["owner", "admin", "manager", "employee"],
      payment_method: [
        "efectivo",
        "tarjeta",
        "transferencia",
        "billetera_virtual",
        "otro",
      ],
      user_role: ["dueño", "empleado"],
    },
  },
} as const

-- ============================================================================
-- MIGRACIÓN: Base Schema (Estructura Inicial)
-- ============================================================================
-- Created: 2026-01-20
-- Purpose: Create ALL base tables for the SaaS Kiosco application
--
-- IMPORTANT: This MUST be the FIRST migration executed in an empty database
--
-- Tables Created:
-- 1. organizations - Organizaciones (tenants)
-- 2. perfiles - Perfiles de usuarios (legacy, mantener para compatibilidad)
-- 3. sucursales - Sucursales/branches
-- 4. productos - Catálogo de productos
-- 5. stock - Inventario por sucursal
-- 6. ventas - Registro de ventas
-- 7. detalles_venta - Líneas de venta (productos vendidos)
-- 8. movimientos - Movimientos de stock
-- 9. proveedores - Proveedores
-- 10. caja_diaria - Cajas diarias por sucursal
-- 11. movimientos_caja - Movimientos de efectivo
-- 12. compras - Registro de compras
-- 13. asistencia - Fichaje de empleados
-- 14. misiones_diarias - Tareas diarias automáticas
-- 15. alertas_vencimientos - Alertas de productos próximos a vencer
-- 16. actividades_empleados - Log de actividades para gamificación
-- ============================================================================

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════
-- 1. ORGANIZATIONS (Multitenancy Core)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.organizations IS
'Tabla de organizaciones (tenants). Cada cliente del SaaS es una organization.';

COMMENT ON COLUMN public.organizations.plan IS
'Plan de suscripción: free, basic, premium, enterprise';


-- ══════════════════════════════════════════════════════════════════════════
-- 2. PERFILES (User Profiles - Legacy)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  sucursal_id UUID, -- FK agregada después
  rol TEXT CHECK (rol IN ('owner', 'employee', 'dueño', 'empleado')),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.perfiles IS
'Perfiles de usuarios. Legacy table mantenida para compatibilidad.
V2 usa user_organization_roles para roles multitenancy.';


-- ══════════════════════════════════════════════════════════════════════════
-- 3. SUCURSALES (Branches)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sucursales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  direccion TEXT,
  telefono TEXT,
  codigo_qr TEXT UNIQUE,
  latitud DECIMAL(10,8),
  longitud DECIMAL(11,8),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.sucursales IS
'Sucursales de cada organización. Cada sucursal tiene stock independiente y QR para fichaje.';

COMMENT ON COLUMN public.sucursales.codigo_qr IS
'Código QR único para fichaje de empleados en esta sucursal.';


-- Agregar FK de perfiles a sucursales ahora que existe
ALTER TABLE public.perfiles
  ADD CONSTRAINT perfiles_sucursal_id_fkey
  FOREIGN KEY (sucursal_id) REFERENCES public.sucursales(id) ON DELETE SET NULL;


-- ══════════════════════════════════════════════════════════════════════════
-- 4. PRODUCTOS (Product Catalog)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio_venta DECIMAL(10,2) NOT NULL CHECK (precio_venta >= 0),
  costo DECIMAL(10,2) CHECK (costo >= 0),
  codigo_barras TEXT,
  categoria TEXT,
  unidad_medida TEXT DEFAULT 'unidad',
  alerta_stock_minimo INTEGER DEFAULT 5,
  activo BOOLEAN DEFAULT true,
  es_virtual BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.productos IS
'Catálogo de productos. Compartido entre sucursales de la misma org.';

COMMENT ON COLUMN public.productos.es_virtual IS
'TRUE para servicios virtuales (recargas, SUBE, etc). FALSE para productos físicos.';


-- ══════════════════════════════════════════════════════════════════════════
-- 5. STOCK (Inventory by Branch)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  sucursal_id UUID NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  lote TEXT,
  fecha_vencimiento DATE,
  estado TEXT DEFAULT 'disponible' CHECK (estado IN ('disponible', 'vendido', 'merma', 'vencido')),
  ubicacion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.stock IS
'Stock de productos por sucursal. Cada lote es una fila independiente (FIFO).';

COMMENT ON COLUMN public.stock.estado IS
'disponible: En stock | vendido: Ya vendido | merma: Descartado | vencido: Venció';


-- ══════════════════════════════════════════════════════════════════════════
-- 6. VENTAS (Sales)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sucursal_id UUID NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  cajero_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  total DECIMAL(10,2) NOT NULL CHECK (total >= 0),
  metodo_pago TEXT CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia', 'qr', 'mixto')),
  fecha_venta TIMESTAMPTZ DEFAULT NOW(),
  ticket_pdf_url TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.ventas IS
'Registro de ventas. Inmutable (NO se puede editar ni eliminar después de creada).';


-- ══════════════════════════════════════════════════════════════════════════
-- 7. DETALLES_VENTA (Sale Line Items)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.detalles_venta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
  stock_id UUID REFERENCES public.stock(id) ON DELETE SET NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario DECIMAL(10,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.detalles_venta IS
'Líneas de cada venta (productos vendidos). Inmutable.';


-- ══════════════════════════════════════════════════════════════════════════
-- 8. MOVIMIENTOS (Stock Movements)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste', 'merma', 'transferencia')),
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  sucursal_origen_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
  sucursal_destino_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
  cantidad INTEGER NOT NULL,
  motivo TEXT,
  usuario_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.movimientos IS
'Historial de movimientos de stock (entradas, salidas, transferencias, mermas).';


-- ══════════════════════════════════════════════════════════════════════════
-- 9. PROVEEDORES (Suppliers)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  razon_social TEXT,
  cuit TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  saldo_cuenta_corriente DECIMAL(10,2) DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.proveedores IS
'Proveedores con cuenta corriente integrada.';

COMMENT ON COLUMN public.proveedores.saldo_cuenta_corriente IS
'Saldo pendiente de pago. Positivo = adeudado, Negativo = pagos anticipados.';


-- ══════════════════════════════════════════════════════════════════════════
-- 10. CAJA_DIARIA (Daily Cash Register)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.caja_diaria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sucursal_id UUID NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  saldo_inicial DECIMAL(10,2) NOT NULL DEFAULT 0,
  saldo_esperado DECIMAL(10,2) DEFAULT 0,
  saldo_real DECIMAL(10,2),
  desvio DECIMAL(10,2),
  abierta BOOLEAN DEFAULT true,
  abierta_por UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  cerrada_por UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  fecha_apertura TIMESTAMPTZ DEFAULT NOW(),
  fecha_cierre TIMESTAMPTZ,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.caja_diaria IS
'Caja diaria por sucursal. Arqueo de efectivo al final del día.';

COMMENT ON COLUMN public.caja_diaria.desvio IS
'Diferencia entre saldo_real y saldo_esperado. Positivo = sobra, Negativo = falta.';


-- ══════════════════════════════════════════════════════════════════════════
-- 11. MOVIMIENTOS_CAJA (Cash Movements)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.movimientos_caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caja_diaria_id UUID NOT NULL REFERENCES public.caja_diaria(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso', 'apertura', 'cierre')),
  monto DECIMAL(10,2) NOT NULL CHECK (monto >= 0),
  concepto TEXT NOT NULL,
  usuario_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  venta_id UUID REFERENCES public.ventas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.movimientos_caja IS
'Movimientos de efectivo: ingresos por ventas, egresos, apertura, cierre.';


-- ══════════════════════════════════════════════════════════════════════════
-- 12. COMPRAS (Purchases from Suppliers)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.compras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proveedor_id UUID NOT NULL REFERENCES public.proveedores(id) ON DELETE RESTRICT,
  sucursal_id UUID NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  numero_comprobante TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  total DECIMAL(10,2) NOT NULL CHECK (total >= 0),
  metodo_pago TEXT CHECK (metodo_pago IN ('efectivo', 'transferencia', 'cheque', 'cuenta_corriente')),
  realizada_por UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.compras IS
'Registro de compras a proveedores.';


-- ══════════════════════════════════════════════════════════════════════════
-- 13. ASISTENCIA (Employee Attendance / Clock In/Out)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.asistencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  sucursal_id UUID NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  entrada TIMESTAMPTZ NOT NULL,
  salida TIMESTAMPTZ,
  horas_trabajadas DECIMAL(5,2),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.asistencia IS
'Fichaje de empleados (entrada/salida). Un registro por día.';


-- ══════════════════════════════════════════════════════════════════════════
-- 14. MISIONES_DIARIAS (Daily Missions / Tasks)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.misiones_diarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sucursal_id UUID NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('abrir_caja', 'cerrar_caja', 'verificar_stock', 'gestionar_vencimiento', 'revisar_proveedores')),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  prioridad TEXT DEFAULT 'media' CHECK (prioridad IN ('baja', 'media', 'alta', 'critica')),
  completada BOOLEAN DEFAULT false,
  completada_por UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
  fecha_vencimiento TIMESTAMPTZ,
  fecha_completada TIMESTAMPTZ,
  metadata JSONB
);

COMMENT ON TABLE public.misiones_diarias IS
'Tareas diarias automáticas generadas por el sistema (arqueo, alertas, etc).';


-- ══════════════════════════════════════════════════════════════════════════
-- 15. ALERTAS_VENCIMIENTOS (Expiration Alerts)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.alertas_vencimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sucursal_id UUID NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  stock_id UUID NOT NULL REFERENCES public.stock(id) ON DELETE CASCADE,
  dias_restantes INTEGER,
  alertado BOOLEAN DEFAULT false,
  resuelto BOOLEAN DEFAULT false,
  resuelto_por UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  resuelto_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.alertas_vencimientos IS
'Alertas de productos próximos a vencer (< 7 días).';


-- ══════════════════════════════════════════════════════════════════════════
-- 16. ACTIVIDADES_EMPLEADOS (Employee Activity Log for Gamification)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.actividades_empleados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  perfil_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('venta', 'fichaje', 'mision_completada', 'stock_agregado', 'alerta_resuelta')),
  descripcion TEXT NOT NULL,
  puntos_ganados INTEGER DEFAULT 0,
  metadata JSONB,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.actividades_empleados IS
'Log de actividades de empleados para sistema de gamificación (opcional).';


-- ══════════════════════════════════════════════════════════════════════════
-- INDICES BÁSICOS (Performance crítico para queries comunes)
-- ══════════════════════════════════════════════════════════════════════════

-- Organizations
CREATE INDEX idx_organizations_nombre ON public.organizations(nombre);

-- Perfiles
CREATE INDEX idx_perfiles_organization_id ON public.perfiles(organization_id);
CREATE INDEX idx_perfiles_email ON public.perfiles(email);
CREATE INDEX idx_perfiles_sucursal_id ON public.perfiles(sucursal_id);

-- Sucursales
CREATE INDEX idx_sucursales_organization_id ON public.sucursales(organization_id);
CREATE INDEX idx_sucursales_codigo_qr ON public.sucursales(codigo_qr);

-- Productos
CREATE INDEX idx_productos_organization_id ON public.productos(organization_id);
CREATE INDEX idx_productos_codigo_barras ON public.productos(codigo_barras) WHERE codigo_barras IS NOT NULL;
CREATE INDEX idx_productos_activo ON public.productos(activo) WHERE activo = true;

-- Stock
CREATE INDEX idx_stock_organization_id ON public.stock(organization_id);
CREATE INDEX idx_stock_producto_sucursal ON public.stock(producto_id, sucursal_id);
CREATE INDEX idx_stock_estado ON public.stock(estado) WHERE estado = 'disponible';
CREATE INDEX idx_stock_vencimiento ON public.stock(fecha_vencimiento) WHERE fecha_vencimiento IS NOT NULL;

-- Ventas
CREATE INDEX idx_ventas_organization_id ON public.ventas(organization_id);
CREATE INDEX idx_ventas_sucursal_fecha ON public.ventas(sucursal_id, fecha_venta DESC);
CREATE INDEX idx_ventas_cajero_id ON public.ventas(cajero_id);

-- Detalles Venta
CREATE INDEX idx_detalles_venta_venta_id ON public.detalles_venta(venta_id);
CREATE INDEX idx_detalles_venta_producto_id ON public.detalles_venta(producto_id);

-- Movimientos
CREATE INDEX idx_movimientos_organization_id ON public.movimientos(organization_id);
CREATE INDEX idx_movimientos_producto_id ON public.movimientos(producto_id);
CREATE INDEX idx_movimientos_created_at ON public.movimientos(created_at DESC);

-- Proveedores
CREATE INDEX idx_proveedores_organization_id ON public.proveedores(organization_id);

-- Caja Diaria
CREATE INDEX idx_caja_diaria_organization_id ON public.caja_diaria(organization_id);
CREATE INDEX idx_caja_diaria_sucursal_fecha ON public.caja_diaria(sucursal_id, fecha DESC);
CREATE INDEX idx_caja_diaria_abierta ON public.caja_diaria(abierta) WHERE abierta = true;

-- Compras
CREATE INDEX idx_compras_organization_id ON public.compras(organization_id);
CREATE INDEX idx_compras_proveedor_id ON public.compras(proveedor_id);

-- Asistencia
CREATE INDEX idx_asistencia_organization_id ON public.asistencia(organization_id);
CREATE INDEX idx_asistencia_empleado_id ON public.asistencia(empleado_id);
CREATE INDEX idx_asistencia_entrada ON public.asistencia(entrada DESC);

-- Misiones Diarias
CREATE INDEX idx_misiones_organization_id ON public.misiones_diarias(organization_id);
CREATE INDEX idx_misiones_sucursal_id ON public.misiones_diarias(sucursal_id);
CREATE INDEX idx_misiones_completada ON public.misiones_diarias(completada) WHERE completada = false;

-- Alertas Vencimientos
CREATE INDEX idx_alertas_organization_id ON public.alertas_vencimientos(organization_id);
CREATE INDEX idx_alertas_resuelto ON public.alertas_vencimientos(resuelto) WHERE resuelto = false;


-- ══════════════════════════════════════════════════════════════════════════
-- TRIGGERS PARA updated_at
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_perfiles_updated_at
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_productos_updated_at
  BEFORE UPDATE ON public.productos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stock_updated_at
  BEFORE UPDATE ON public.stock
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_proveedores_updated_at
  BEFORE UPDATE ON public.proveedores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'organizations', 'perfiles', 'sucursales', 'productos', 'stock',
    'ventas', 'detalles_venta', 'movimientos', 'proveedores',
    'caja_diaria', 'movimientos_caja', 'compras', 'asistencia',
    'misiones_diarias', 'alertas_vencimientos', 'actividades_empleados'
  );

  RAISE NOTICE '✓ Base schema creado exitosamente';
  RAISE NOTICE '✓ % tablas creadas', v_table_count;
  RAISE NOTICE '✓ 40+ índices creados para performance';
  RAISE NOTICE '✓ Triggers de updated_at configurados';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Próximo paso: Ejecutar 20260110_add_owner_id.sql';
END $$;

COMMIT;

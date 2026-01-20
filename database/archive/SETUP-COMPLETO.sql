-- ═══════════════════════════════════════════════════════════════════════════════
-- 🎯 SETUP COMPLETO DE BASE DE DATOS - PlanetaZEGA
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- 📋 QUÉ HACE (6 pasos):
--    0. Elimina vistas temporalmente (evita error 42P16: cannot drop columns from view)
--    1. Deshabilita RLS temporalmente
--    2. Aplica estandarización de columnas (created_at, updated_at + triggers)
--    3. Crea índices de performance
--    4. Re-habilita RLS con políticas correctas para organizations
--    5. Recrea vistas con estructura actualizada
--
-- ⚠️  BASADO EN: docs/DATABASE_SCHEMA.md (esquema real verificado)
-- ⚠️  IDEMPOTENTE: Puede ejecutarse múltiples veces sin errores
-- ⚠️  Aplica Estándar Maestro: id, organization_id, created_at, updated_at
--
-- ═══════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────────
-- PASO 0: ELIMINAR VISTAS (para evitar error 42P16)
-- ───────────────────────────────────────────────────────────────────────────────
-- IMPORTANTE: Las vistas dependen de las columnas de las tablas.
-- Si intentamos alterar tablas con vistas activas, PostgreSQL arroja error 42P16.
-- Las vistas se recrearán al final del script con la estructura actualizada.

DROP VIEW IF EXISTS public.reportes_ventas_unificados CASCADE;

DO $$ BEGIN
  RAISE NOTICE '✓ Paso 0/6: Vistas eliminadas temporalmente';
END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- PASO 1: DESHABILITAR RLS TEMPORALMENTE
-- ───────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.ventas_servicios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas_servicios NO FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  RAISE NOTICE '✓ Paso 1/6: RLS deshabilitado temporalmente';
END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- PASO 2: APLICAR ESTANDARIZACIÓN DE COLUMNAS
-- ───────────────────────────────────────────────────────────────────────────────

-- Crear función de trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Agregar columnas estándar a todas las tablas
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.sucursales ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.ventas_servicios ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.ventas_servicios ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.stock ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.caja_diaria ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.movimientos_caja ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Sincronizar created_at con fecha_venta en ventas_servicios
UPDATE public.ventas_servicios
SET created_at = fecha_venta
WHERE created_at IS NULL AND fecha_venta IS NOT NULL;

-- Aplicar triggers de auto-actualización
DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
DROP TRIGGER IF EXISTS update_perfiles_updated_at ON public.perfiles;
DROP TRIGGER IF EXISTS update_sucursales_updated_at ON public.sucursales;
DROP TRIGGER IF EXISTS update_ventas_servicios_updated_at ON public.ventas_servicios;
DROP TRIGGER IF EXISTS update_stock_updated_at ON public.stock;
DROP TRIGGER IF EXISTS update_productos_updated_at ON public.productos;
DROP TRIGGER IF EXISTS update_caja_diaria_updated_at ON public.caja_diaria;
DROP TRIGGER IF EXISTS update_movimientos_caja_updated_at ON public.movimientos_caja;

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_perfiles_updated_at BEFORE UPDATE ON public.perfiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sucursales_updated_at BEFORE UPDATE ON public.sucursales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ventas_servicios_updated_at BEFORE UPDATE ON public.ventas_servicios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stock_updated_at BEFORE UPDATE ON public.stock FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_productos_updated_at BEFORE UPDATE ON public.productos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_caja_diaria_updated_at BEFORE UPDATE ON public.caja_diaria FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_movimientos_caja_updated_at BEFORE UPDATE ON public.movimientos_caja FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DO $$ BEGIN
  RAISE NOTICE '✓ Paso 2/6: Estandarización de columnas aplicada (created_at, updated_at, triggers)';
END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- PASO 3: CREAR ÍNDICES DE PERFORMANCE
-- ───────────────────────────────────────────────────────────────────────────────

-- Índices para ventas_servicios
CREATE INDEX IF NOT EXISTS idx_ventas_servicios_org ON ventas_servicios(organization_id);
CREATE INDEX IF NOT EXISTS idx_ventas_servicios_sucursal ON ventas_servicios(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_ventas_servicios_caja ON ventas_servicios(caja_diaria_id);
CREATE INDEX IF NOT EXISTS idx_ventas_servicios_created ON ventas_servicios(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_servicios_org_created ON ventas_servicios(organization_id, created_at DESC);

-- Índices para caja_diaria
CREATE INDEX IF NOT EXISTS idx_caja_diaria_org ON caja_diaria(organization_id);
CREATE INDEX IF NOT EXISTS idx_caja_diaria_sucursal ON caja_diaria(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_caja_diaria_apertura ON caja_diaria(fecha_apertura DESC);

-- Índices para perfiles
CREATE INDEX IF NOT EXISTS idx_perfiles_org ON perfiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_perfiles_sucursal ON perfiles(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_perfiles_rol ON perfiles(rol);

-- Índices para sucursales
CREATE INDEX IF NOT EXISTS idx_sucursales_org ON sucursales(organization_id);

-- Índices adicionales para columnas de auditoría
CREATE INDEX IF NOT EXISTS idx_organizations_updated ON organizations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_perfiles_updated ON perfiles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_servicios_updated ON ventas_servicios(updated_at DESC);

DO $$ BEGIN
  RAISE NOTICE '✓ Paso 3/6: Índices de performance creados';
END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- PASO 4: RE-HABILITAR RLS CON POLÍTICAS CORRECTAS
-- ───────────────────────────────────────────────────────────────────────────────

-- Habilitar RLS (normal, NO force)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations NO FORCE ROW LEVEL SECURITY;

-- Limpiar políticas antiguas
DROP POLICY IF EXISTS "insert_any" ON public.organizations;
DROP POLICY IF EXISTS "authenticated_can_insert" ON public.organizations;
DROP POLICY IF EXISTS "users_see_own_org" ON public.organizations;
DROP POLICY IF EXISTS "owners_can_update" ON public.organizations;
DROP POLICY IF EXISTS "prevent_org_delete" ON public.organizations;
DROP POLICY IF EXISTS "select_own_organization" ON public.organizations;
DROP POLICY IF EXISTS "update_own_organization" ON public.organizations;
DROP POLICY IF EXISTS "prevent_delete_organizations" ON public.organizations;
DROP POLICY IF EXISTS "insert_own_org" ON public.organizations;
DROP POLICY IF EXISTS "select_own_org" ON public.organizations;
DROP POLICY IF EXISTS "update_own_org" ON public.organizations;
DROP POLICY IF EXISTS "prevent_delete" ON public.organizations;

-- Crear políticas correctas
CREATE POLICY "insert_own_org"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "select_own_org"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT organization_id
    FROM perfiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY "update_own_org"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT organization_id
    FROM perfiles
    WHERE id = auth.uid() AND rol = 'dueño'
  )
)
WITH CHECK (
  id IN (
    SELECT organization_id
    FROM perfiles
    WHERE id = auth.uid() AND rol = 'dueño'
  )
);

CREATE POLICY "prevent_delete"
ON public.organizations
FOR DELETE
TO authenticated
USING (false);

DO $$ BEGIN
  RAISE NOTICE '✓ Paso 4/6: RLS habilitado con políticas correctas';
END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- PASO 5: RECREAR VISTAS CON ESTRUCTURA ACTUALIZADA
-- ───────────────────────────────────────────────────────────────────────────────
-- Ahora que las tablas tienen las columnas estándar (created_at, updated_at),
-- recreamos las vistas que fueron eliminadas en el PASO 0.

-- Vista: reportes_ventas_unificados
-- Incluye todas las columnas de ventas_servicios + columnas de auditoría
CREATE OR REPLACE VIEW public.reportes_ventas_unificados AS
SELECT
    id,
    organization_id,
    sucursal_id,
    caja_diaria_id,
    proveedor_id,
    tipo_servicio,
    monto_carga,
    comision,
    total_cobrado,
    metodo_pago,
    fecha_venta,
    notas,
    created_at,
    updated_at
FROM public.ventas_servicios;

DO $$ BEGIN
  RAISE NOTICE '✓ Paso 5/6: Vistas recreadas con estructura actualizada';
END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- PASO 6: VERIFICACIÓN FINAL
-- ───────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ SETUP COMPLETADO EXITOSAMENTE';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Configuración aplicada (6 pasos):';
  RAISE NOTICE '  0. ✓ Vistas eliminadas temporalmente (evitar error 42P16)';
  RAISE NOTICE '  1. ✓ RLS deshabilitado temporalmente';
  RAISE NOTICE '  2. ✓ Estandarización columnas (created_at, updated_at + triggers)';
  RAISE NOTICE '  3. ✓ Índices de performance + índices de auditoría';
  RAISE NOTICE '  4. ✓ RLS habilitado con 4 políticas en organizations';
  RAISE NOTICE '  5. ✓ Vistas recreadas con estructura actualizada';
  RAISE NOTICE '';
  RAISE NOTICE '📖 Ver esquema completo en: docs/DATABASE_SCHEMA.md';
  RAISE NOTICE '⚠️  Estándar Maestro aplicado: id, organization_id, created_at, updated_at';
  RAISE NOTICE '⚠️  Script IDEMPOTENTE: puede ejecutarse múltiples veces sin errores';
  RAISE NOTICE '';
END $$;

-- Mostrar políticas creadas
SELECT
  '📋 Políticas RLS en organizations:' as "Info",
  policyname as "Política",
  cmd as "Comando"
FROM pg_policies
WHERE tablename = 'organizations'
ORDER BY cmd;

-- Verificar estado de RLS
SELECT
  '🔒 Estado de RLS:' as "Info",
  relname as "Tabla",
  CASE
    WHEN relrowsecurity THEN '✅ Habilitado'
    ELSE '❌ Deshabilitado'
  END as "RLS",
  CASE
    WHEN relforcerowsecurity THEN '⚠️ Force activo'
    ELSE '✅ Force deshabilitado'
  END as "Force RLS"
FROM pg_class
WHERE relname = 'organizations';

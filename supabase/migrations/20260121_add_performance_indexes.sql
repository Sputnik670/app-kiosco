-- ============================================================================
-- MIGRATION: Add Performance Indexes for Production
-- ============================================================================
-- Created: 2026-01-21
-- Purpose: Create indexes to optimize query performance
-- Priority: HIGH - Critical for 50+ employees, 10+ branches
--
-- Indexes Strategy:
-- - organization_id: CRITICAL for RLS performance
-- - Foreign keys: Improve JOIN performance
-- - Frequent WHERE clauses: Speed up common queries
-- - Partial indexes: For common filtered queries
--
-- Expected Performance Improvement:
-- - RLS queries: 10-100x faster
-- - Sales queries: 5-20x faster
-- - Inventory queries: 10-50x faster
-- ============================================================================

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════
-- 1. ORGANIZATION_ID INDEXES (CRITICAL for RLS)
-- ══════════════════════════════════════════════════════════════════════════

-- Products
CREATE INDEX IF NOT EXISTS idx_productos_organization_id
ON productos(organization_id);

-- Stock (most queried table)
CREATE INDEX IF NOT EXISTS idx_stock_organization_id
ON stock(organization_id);

CREATE INDEX IF NOT EXISTS idx_stock_organization_sucursal
ON stock(organization_id, sucursal_id);

CREATE INDEX IF NOT EXISTS idx_stock_organization_producto
ON stock(organization_id, producto_id);

-- Sales
CREATE INDEX IF NOT EXISTS idx_ventas_organization_id
ON ventas(organization_id);

CREATE INDEX IF NOT EXISTS idx_ventas_organization_fecha
ON ventas(organization_id, fecha_venta DESC);

-- Note: detalles_venta no tiene organization_id (hereda de ventas)

-- Movements (audit)
CREATE INDEX IF NOT EXISTS idx_movimientos_organization_id
ON movimientos(organization_id);

-- Note: movimientos_caja no tiene organization_id (hereda de caja_diaria)

-- Branches
CREATE INDEX IF NOT EXISTS idx_sucursales_organization_id
ON sucursales(organization_id);

-- Attendance
CREATE INDEX IF NOT EXISTS idx_asistencia_organization_id
ON asistencia(organization_id);

-- Suppliers
CREATE INDEX IF NOT EXISTS idx_proveedores_organization_id
ON proveedores(organization_id);

-- Cash register
CREATE INDEX IF NOT EXISTS idx_caja_diaria_organization_id
ON caja_diaria(organization_id);

-- Purchases
CREATE INDEX IF NOT EXISTS idx_compras_organization_id
ON compras(organization_id);

-- Missions
CREATE INDEX IF NOT EXISTS idx_misiones_organization_id
ON misiones_diarias(organization_id);

DO $$ BEGIN
  RAISE NOTICE '✅ Created organization_id indexes on all tables';
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- 2. FOREIGN KEY INDEXES (Improve JOIN performance)
-- ══════════════════════════════════════════════════════════════════════════

-- Stock foreign keys
CREATE INDEX IF NOT EXISTS idx_stock_producto_id
ON stock(producto_id);

CREATE INDEX IF NOT EXISTS idx_stock_sucursal_id
ON stock(sucursal_id);

-- Sales foreign keys
CREATE INDEX IF NOT EXISTS idx_ventas_sucursal_id
ON ventas(sucursal_id);

CREATE INDEX IF NOT EXISTS idx_ventas_cajero_id
ON ventas(cajero_id);

CREATE INDEX IF NOT EXISTS idx_detalles_venta_venta_id
ON detalles_venta(venta_id);

CREATE INDEX IF NOT EXISTS idx_detalles_venta_producto_id
ON detalles_venta(producto_id);

-- Movements foreign keys
CREATE INDEX IF NOT EXISTS idx_movimientos_producto_id
ON movimientos(producto_id);

CREATE INDEX IF NOT EXISTS idx_movimientos_sucursal_origen_id
ON movimientos(sucursal_origen_id);

CREATE INDEX IF NOT EXISTS idx_movimientos_sucursal_destino_id
ON movimientos(sucursal_destino_id);

-- Attendance foreign keys
CREATE INDEX IF NOT EXISTS idx_asistencia_empleado_id
ON asistencia(empleado_id);

CREATE INDEX IF NOT EXISTS idx_asistencia_sucursal_id
ON asistencia(sucursal_id);

-- Cash movements foreign keys
CREATE INDEX IF NOT EXISTS idx_movimientos_caja_caja_diaria_id
ON movimientos_caja(caja_diaria_id);

-- Note: misiones_diarias no tiene empleado_id (son automáticas, solo tienen completada_por)

DO $$ BEGIN
  RAISE NOTICE '✅ Created foreign key indexes';
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- 3. BUSINESS LOGIC INDEXES (Common queries)
-- ══════════════════════════════════════════════════════════════════════════

-- Barcode search (very common in sales)
CREATE INDEX IF NOT EXISTS idx_productos_codigo_barras
ON productos(codigo_barras)
WHERE codigo_barras IS NOT NULL;

-- Product search by name (COMMENTED - requires pg_trgm extension)
-- Uncomment after enabling: CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS idx_productos_nombre
-- ON productos USING gin (nombre gin_trgm_ops);

-- Stock state filtering (available stock queries)
CREATE INDEX IF NOT EXISTS idx_stock_estado
ON stock(estado)
WHERE estado = 'disponible';

-- Partial index for available stock per branch
CREATE INDEX IF NOT EXISTS idx_stock_disponible
ON stock(producto_id, sucursal_id, estado)
WHERE estado = 'disponible';

-- Expiration date queries (critical alerts)
CREATE INDEX IF NOT EXISTS idx_stock_vencimiento
ON stock(fecha_vencimiento)
WHERE fecha_vencimiento IS NOT NULL AND estado = 'disponible';

CREATE INDEX IF NOT EXISTS idx_stock_vencimiento_sucursal
ON stock(sucursal_id, fecha_vencimiento)
WHERE fecha_vencimiento IS NOT NULL AND estado = 'disponible';

-- Sales date range queries (reports)
CREATE INDEX IF NOT EXISTS idx_ventas_fecha
ON ventas(fecha_venta DESC);

-- Attendance date queries
CREATE INDEX IF NOT EXISTS idx_asistencia_entrada
ON asistencia(entrada DESC);

CREATE INDEX IF NOT EXISTS idx_asistencia_empleado_fecha
ON asistencia(empleado_id, entrada DESC);

-- Active cash registers (abierta = true means open, false means closed)
CREATE INDEX IF NOT EXISTS idx_caja_diaria_abierta
ON caja_diaria(abierta)
WHERE abierta = true;

-- Active missions (completada = false means pending/in progress)
CREATE INDEX IF NOT EXISTS idx_misiones_pendientes
ON misiones_diarias(completada)
WHERE completada = false;

CREATE INDEX IF NOT EXISTS idx_misiones_completada_por
ON misiones_diarias(completada_por)
WHERE completada = true;

DO $$ BEGIN
  RAISE NOTICE '✅ Created business logic indexes';
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- 4. COMPOSITE INDEXES (Multi-column queries)
-- ══════════════════════════════════════════════════════════════════════════

-- Stock lookup by product + branch + state (procesar_venta)
CREATE INDEX IF NOT EXISTS idx_stock_lookup
ON stock(producto_id, sucursal_id, estado, cantidad)
WHERE estado = 'disponible' AND cantidad > 0;

-- Sales by branch + date (dashboard queries)
CREATE INDEX IF NOT EXISTS idx_ventas_sucursal_fecha
ON ventas(sucursal_id, fecha_venta DESC);

-- Attendance by employee + date range
CREATE INDEX IF NOT EXISTS idx_asistencia_empleado_rango
ON asistencia(empleado_id, entrada, salida);

-- Cash movements by register + type
CREATE INDEX IF NOT EXISTS idx_movimientos_caja_tipo
ON movimientos_caja(caja_diaria_id, tipo, created_at DESC);

DO $$ BEGIN
  RAISE NOTICE '✅ Created composite indexes';
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- 5. AUTHORIZATION INDEXES (user_organization_roles)
-- ══════════════════════════════════════════════════════════════════════════

-- User lookup (used in EVERY RLS policy via get_my_org_id_v2)
CREATE INDEX IF NOT EXISTS idx_user_org_roles_user_id
ON user_organization_roles(user_id)
WHERE is_active = true;

-- Organization lookup
CREATE INDEX IF NOT EXISTS idx_user_org_roles_organization_id
ON user_organization_roles(organization_id)
WHERE is_active = true;

-- Composite for role checks
CREATE INDEX IF NOT EXISTS idx_user_org_roles_user_org_role
ON user_organization_roles(user_id, organization_id, role)
WHERE is_active = true;

DO $$ BEGIN
  RAISE NOTICE '✅ Created authorization indexes';
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- VERIFICATION: List all created indexes
-- ══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  index_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%';

  RAISE NOTICE '══════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION COMPLETE: Add Performance Indexes';
  RAISE NOTICE '══════════════════════════════════════════════════════';
  RAISE NOTICE 'Total indexes created: %', index_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Index categories:';
  RAISE NOTICE '  1. organization_id indexes (RLS performance)';
  RAISE NOTICE '  2. Foreign key indexes (JOIN performance)';
  RAISE NOTICE '  3. Business logic indexes (common queries)';
  RAISE NOTICE '  4. Composite indexes (multi-column queries)';
  RAISE NOTICE '  5. Authorization indexes (user_organization_roles)';
  RAISE NOTICE '══════════════════════════════════════════════════════';
END $$;

-- List indexes by table for reference
SELECT
  tablename,
  COUNT(*) as num_indexes,
  string_agg(indexname, ', ' ORDER BY indexname) as index_names
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'productos', 'stock', 'ventas', 'detalles_venta', 'movimientos',
    'sucursales', 'asistencia', 'proveedores', 'caja_diaria',
    'movimientos_caja', 'user_organization_roles'
  )
GROUP BY tablename
ORDER BY num_indexes DESC, tablename;

COMMIT;

-- ============================================================================
-- POST-MIGRATION RECOMMENDATIONS
-- ============================================================================
-- 1. Run ANALYZE to update statistics:
--    ANALYZE;
--
-- 2. Monitor index usage after 1 week:
--    SELECT schemaname, tablename, indexname, idx_scan
--    FROM pg_stat_user_indexes
--    WHERE schemaname = 'public'
--    ORDER BY idx_scan ASC;
--
-- 3. Consider additional indexes based on slow queries:
--    - Check pg_stat_statements for slow queries
--    - Use EXPLAIN ANALYZE to verify index usage
--
-- 4. For text search, enable pg_trgm extension:
--    CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- ============================================================================

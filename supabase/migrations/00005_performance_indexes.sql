-- ============================================================================
-- MIGRATION 00005: Performance Indexes for Frequent Queries
-- ============================================================================
-- Fecha: 2026-02-25
-- Generado por: kiosco-database agent
--
-- Este script agrega indices faltantes identificados al auditar las queries
-- en lib/actions/*.ts y lib/repositories/*.ts contra el schema existente.
--
-- IMPORTANTE: Solo CREATE INDEX IF NOT EXISTS para ser idempotente.
-- No modifica datos ni estructura de tablas.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. PRODUCTS: Composite para busqueda por barcode dentro de una org
-- ============================================================================
-- Query: searchProductos() en producto.repository.ts
--   .eq('organization_id', orgId).or('name.ilike...', 'barcode.ilike...')
-- Query: searchProductsAction() en ventas.actions.ts (via v_products_with_stock)
-- El indice existente idx_products_barcode es single-column sin org_id.
-- Este composite acelera la busqueda filtrada por tenant.

CREATE INDEX IF NOT EXISTS idx_products_org_barcode
  ON products(organization_id, barcode)
  WHERE barcode IS NOT NULL;

-- ============================================================================
-- 2. PRODUCTS: Composite para busqueda por categoria dentro de una org
-- ============================================================================
-- Query: getProductosByCategoria() en producto.repository.ts
--   .eq('organization_id', orgId).eq('category', cat).eq('is_active', true)

CREATE INDEX IF NOT EXISTS idx_products_org_category
  ON products(organization_id, category)
  WHERE is_active = true;

-- ============================================================================
-- 3. CASH_REGISTERS: Composite para buscar caja abierta por sucursal
-- ============================================================================
-- Query: getCajaActivaAction() en cash.actions.ts
--   .eq('branch_id', sucursalId).eq('is_open', true)
-- Query: getActiveShiftAction() en shift.actions.ts
--   .eq('opened_by', user.id).eq('branch_id', branchId).eq('is_open', true)
-- Los indices existentes son branch+date y is_open parcial.
-- Este composite cubre el patron mas frecuente.

CREATE INDEX IF NOT EXISTS idx_cash_reg_branch_open
  ON cash_registers(branch_id, is_open)
  WHERE is_open = true;

-- ============================================================================
-- 4. CASH_REGISTERS: Indice para queries del ranking por empleado
-- ============================================================================
-- Query: getTeamRankingAction() en stats.actions.ts
--   .in('opened_by', employeeIds).eq('is_open', false).gte('opened_at', fecha)
-- Batch query para todos los empleados de la org.

CREATE INDEX IF NOT EXISTS idx_cash_reg_opened_by
  ON cash_registers(opened_by, is_open, opened_at DESC);

-- ============================================================================
-- 5. ATTENDANCE: Composite para fichaje por empleado + sucursal
-- ============================================================================
-- Query: getAttendanceStatusAction() / toggleAttendanceAction()
--   .eq('user_id', userId).eq('branch_id', sucursalId).is('check_out', null)
-- Los indices existentes son single-column (user_id y check_in separados).

CREATE INDEX IF NOT EXISTS idx_attendance_user_branch
  ON attendance(user_id, branch_id, check_in DESC);

-- ============================================================================
-- 6. MISSIONS: Composite para consulta de misiones por empleado
-- ============================================================================
-- Query: getEmployeeMissionsAction() en missions.actions.ts
--   .eq('user_id', empleadoId).or('cash_register_id.eq...,cash_register_id.is.null')
-- Query: getTeamRankingAction() en stats.actions.ts
--   .eq('user_id', emp.id).eq('is_completed', true).gte('created_at', fecha)

CREATE INDEX IF NOT EXISTS idx_missions_user_completed
  ON missions(user_id, is_completed, created_at DESC);

-- Indice adicional para buscar misiones por cash_register
CREATE INDEX IF NOT EXISTS idx_missions_cash_register
  ON missions(cash_register_id)
  WHERE cash_register_id IS NOT NULL;

-- ============================================================================
-- 7. STOCK_BATCHES: Composite para queries de vencimiento por sucursal
-- ============================================================================
-- Query: getExpiringStockAction() / getCriticalStockAction()
--   .eq('branch_id', branchId).eq('status', 'available')
--   .not('expiration_date', 'is', null).lte('expiration_date', fecha)
-- El idx_stock_fifo cubre (product_id, branch_id, expiration_date)
-- pero no filtra por status. Este indice cubre el patron de alertas.

CREATE INDEX IF NOT EXISTS idx_stock_branch_status_expiry
  ON stock_batches(branch_id, status, expiration_date ASC)
  WHERE status = 'available' AND expiration_date IS NOT NULL;

-- ============================================================================
-- 8. SALES: Composite para filtro por caja + metodo de pago
-- ============================================================================
-- Query: closeShiftAction() / cerrarCajaAction()
--   .eq('cash_register_id', shiftId).eq('payment_method', 'cash')
-- El idx_sales_cash_reg es single-column. Agregar payment_method
-- evita un filter adicional en el cierre de caja (operacion critica).

CREATE INDEX IF NOT EXISTS idx_sales_cashreg_payment
  ON sales(cash_register_id, payment_method);

-- ============================================================================
-- 9. MEMBERSHIPS: Composite para queries de ranking y roles
-- ============================================================================
-- Query: getTeamRankingAction() en stats.actions.ts
--   .eq('organization_id', orgId).eq('role', 'employee').eq('is_active', true)
-- Query: getEmployeesForMissionsAction() en missions.actions.ts
--   Mismo patron de filtro.
-- El unique constraint cubre (user_id, org_id) pero no role/is_active.

CREATE INDEX IF NOT EXISTS idx_memberships_org_role_active
  ON memberships(organization_id, role)
  WHERE is_active = true;

-- ============================================================================
-- VERIFICACION
-- ============================================================================

DO $$
DECLARE
  v_index_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%';

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '  INDICES DE PERFORMANCE CREADOS';
  RAISE NOTICE '============================================';
  RAISE NOTICE '  Total indices en schema public: %', v_index_count;
  RAISE NOTICE '';
  RAISE NOTICE '  Nuevos indices:';
  RAISE NOTICE '    - idx_products_org_barcode';
  RAISE NOTICE '    - idx_products_org_category';
  RAISE NOTICE '    - idx_cash_reg_branch_open';
  RAISE NOTICE '    - idx_cash_reg_opened_by';
  RAISE NOTICE '    - idx_attendance_user_branch';
  RAISE NOTICE '    - idx_missions_user_completed';
  RAISE NOTICE '    - idx_missions_cash_register';
  RAISE NOTICE '    - idx_stock_branch_status_expiry';
  RAISE NOTICE '    - idx_sales_cashreg_payment';
  RAISE NOTICE '    - idx_memberships_org_role_active';
  RAISE NOTICE '============================================';
END $$;

COMMIT;

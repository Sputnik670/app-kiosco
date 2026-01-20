-- ============================================================================
-- MIGRATION: Enable Row Level Security on All Operational Tables
-- ============================================================================
-- Created: 2026-01-20
-- Purpose: Enable RLS to enforce multitenancy data isolation
-- Security: CRITICAL - Must be executed before creating policies
--
-- IMPORTANT: This migration is IDEMPOTENT (safe to run multiple times)
--
-- Tables secured:
-- - productos, stock, ventas, detalles_venta, movimientos
-- - sucursales, asistencia, proveedores
-- - caja_diaria, movimientos_caja, compras
-- - perfiles, user_organization_roles, pending_invites
-- - historial_precios, misiones, movimientos_misiones
-- ============================================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 1: CORE BUSINESS TABLES (Products, Stock, Sales)
-- ──────────────────────────────────────────────────────────────────────────

-- Enable RLS on productos (Products catalog)
ALTER TABLE IF EXISTS public.productos ENABLE ROW LEVEL SECURITY;

-- Enable RLS on stock (Inventory per branch)
ALTER TABLE IF EXISTS public.stock ENABLE ROW LEVEL SECURITY;

-- Enable RLS on ventas (Sales transactions)
ALTER TABLE IF EXISTS public.ventas ENABLE ROW LEVEL SECURITY;

-- Enable RLS on detalles_venta (Sales line items)
ALTER TABLE IF EXISTS public.detalles_venta ENABLE ROW LEVEL SECURITY;

-- Enable RLS on movimientos (Stock movements audit)
ALTER TABLE IF EXISTS public.movimientos ENABLE ROW LEVEL SECURITY;

-- Enable RLS on historial_precios (Price history)
ALTER TABLE IF EXISTS public.historial_precios ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 2: BRANCH & ATTENDANCE TABLES
-- ──────────────────────────────────────────────────────────────────────────

-- Enable RLS on sucursales (Branches/Kiosks)
ALTER TABLE IF EXISTS public.sucursales ENABLE ROW LEVEL SECURITY;

-- Enable RLS on asistencia (Employee attendance - GDPR protected)
ALTER TABLE IF EXISTS public.asistencia ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 3: SUPPLIERS & PURCHASES
-- ──────────────────────────────────────────────────────────────────────────

-- Enable RLS on proveedores (Suppliers)
ALTER TABLE IF EXISTS public.proveedores ENABLE ROW LEVEL SECURITY;

-- Enable RLS on compras (Purchase orders)
ALTER TABLE IF EXISTS public.compras ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 4: CASH REGISTER & FINANCIAL TRANSACTIONS
-- ──────────────────────────────────────────────────────────────────────────

-- Enable RLS on caja_diaria (Daily cash register)
ALTER TABLE IF EXISTS public.caja_diaria ENABLE ROW LEVEL SECURITY;

-- Enable RLS on movimientos_caja (Cash movements)
ALTER TABLE IF EXISTS public.movimientos_caja ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 5: USERS & AUTHORIZATION
-- ──────────────────────────────────────────────────────────────────────────

-- Enable RLS on perfiles (User profiles - legacy)
ALTER TABLE IF EXISTS public.perfiles ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_organization_roles (V2 authorization table)
ALTER TABLE IF EXISTS public.user_organization_roles ENABLE ROW LEVEL SECURITY;

-- Enable RLS on pending_invites (Employee invitations)
ALTER TABLE IF EXISTS public.pending_invites ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 6: GAMIFICATION & MISSIONS
-- ──────────────────────────────────────────────────────────────────────────

-- Enable RLS on misiones (Employee missions/tasks)
ALTER TABLE IF EXISTS public.misiones ENABLE ROW LEVEL SECURITY;

-- Enable RLS on movimientos_misiones (Mission history)
ALTER TABLE IF EXISTS public.movimientos_misiones ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 7: ADDITIONAL TABLES (if they exist)
-- ──────────────────────────────────────────────────────────────────────────

-- Enable RLS on alertas_vencimientos (Expiry alerts)
ALTER TABLE IF EXISTS public.alertas_vencimientos ENABLE ROW LEVEL SECURITY;

-- Enable RLS on servicios_virtuales (Virtual services like SUBE)
ALTER TABLE IF EXISTS public.servicios_virtuales ENABLE ROW LEVEL SECURITY;

-- Enable RLS on transacciones_servicios (Service transactions)
ALTER TABLE IF EXISTS public.transacciones_servicios ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────────
-- VERIFICATION: Check that RLS is enabled
-- ──────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  tables_without_rls TEXT[];
  table_name TEXT;
BEGIN
  -- Check all critical tables
  SELECT ARRAY_AGG(t.tablename)
  INTO tables_without_rls
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.tablename IN (
      'productos', 'stock', 'ventas', 'detalles_venta', 'movimientos',
      'sucursales', 'asistencia', 'proveedores', 'caja_diaria',
      'movimientos_caja', 'compras', 'perfiles', 'user_organization_roles',
      'pending_invites', 'historial_precios', 'misiones', 'movimientos_misiones'
    )
    AND t.rowsecurity = false;

  IF array_length(tables_without_rls, 1) > 0 THEN
    RAISE WARNING 'The following tables still have RLS DISABLED: %', tables_without_rls;
    RAISE EXCEPTION 'Migration failed: Not all tables have RLS enabled';
  ELSE
    RAISE NOTICE '✅ SUCCESS: Row Level Security enabled on all critical tables';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION QUERIES
-- ============================================================================
-- Run these queries manually to verify RLS is enabled:
--
-- 1. List all tables with RLS status:
--    SELECT tablename, rowsecurity
--    FROM pg_tables
--    WHERE schemaname = 'public'
--    ORDER BY tablename;
--
-- 2. Count enabled RLS tables:
--    SELECT
--      COUNT(*) FILTER (WHERE rowsecurity = true) as rls_enabled,
--      COUNT(*) FILTER (WHERE rowsecurity = false) as rls_disabled
--    FROM pg_tables
--    WHERE schemaname = 'public';
-- ============================================================================

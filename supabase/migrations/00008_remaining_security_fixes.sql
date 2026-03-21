-- ============================================================================
-- MIGRATION 00008: Remaining Security Fixes (Documentación)
-- ============================================================================
-- Fecha: 2026-03-21
-- Descripcion:
--   Documenta fixes de seguridad que ya fueron aplicados manualmente en
--   producción entre sesiones. Esta migración es idempotente (IF NOT EXISTS
--   y DROP IF EXISTS) para que pueda correrse sobre la DB actual sin errores.
--
-- Fixes incluidos:
--   1. SET search_path en expire_pending_mp_orders() y process_sale()
--   2. Políticas DELETE/UPDATE false en service_sales
--   3. Políticas UPDATE false + DELETE owner-only en service_purchases
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. FIX: SET search_path en funciones SECURITY DEFINER
-- ============================================================================
-- Estas funciones ya tenían search_path=public en producción al momento de
-- crear esta migración. Los ALTER son idempotentes.

ALTER FUNCTION expire_pending_mp_orders() SET search_path TO 'public';
ALTER FUNCTION process_sale(UUID, JSONB, TEXT, NUMERIC) SET search_path TO 'public';

-- ============================================================================
-- 2. FIX: service_sales — bloquear UPDATE y DELETE explícitamente
-- ============================================================================
-- Las ventas de servicios son inmutables. Estas políticas previenen que un
-- cliente malicioso intente modificar o borrar registros vía PostgREST.

-- DROP IF EXISTS para idempotencia
DROP POLICY IF EXISTS "service_sales_no_update" ON service_sales;
DROP POLICY IF EXISTS "service_sales_no_delete" ON service_sales;

CREATE POLICY "service_sales_no_update" ON service_sales
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "service_sales_no_delete" ON service_sales
  FOR DELETE TO authenticated
  USING (false);

-- ============================================================================
-- 3. FIX: service_purchases — bloquear UPDATE, DELETE solo para owner
-- ============================================================================
-- Las compras de crédito de servicios no deberían editarse post-creación.
-- Solo el owner puede eliminar (para correcciones).

DROP POLICY IF EXISTS "service_purchases_no_update" ON service_purchases;
DROP POLICY IF EXISTS "service_purchases_delete" ON service_purchases;

CREATE POLICY "service_purchases_no_update" ON service_purchases
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "service_purchases_delete" ON service_purchases
  FOR DELETE TO authenticated
  USING (organization_id = get_my_org_id() AND is_owner());

-- ============================================================================
-- VERIFICACION
-- ============================================================================

DO $$
DECLARE
  v_sp_search_path TEXT;
  v_ss_no_update BOOLEAN;
  v_ss_no_delete BOOLEAN;
  v_sp_no_update BOOLEAN;
  v_sp_delete_owner BOOLEAN;
BEGIN
  -- Verificar search_path en process_sale
  SELECT array_to_string(proconfig, ',')
    FROM pg_proc WHERE proname = 'process_sale' AND prosecdef = true
    LIMIT 1
    INTO v_sp_search_path;

  -- Verificar políticas de service_sales
  SELECT EXISTS(
    SELECT 1 FROM pg_policies
    WHERE tablename = 'service_sales' AND policyname = 'service_sales_no_update'
  ) INTO v_ss_no_update;

  SELECT EXISTS(
    SELECT 1 FROM pg_policies
    WHERE tablename = 'service_sales' AND policyname = 'service_sales_no_delete'
  ) INTO v_ss_no_delete;

  -- Verificar políticas de service_purchases
  SELECT EXISTS(
    SELECT 1 FROM pg_policies
    WHERE tablename = 'service_purchases' AND policyname = 'service_purchases_no_update'
  ) INTO v_sp_no_update;

  SELECT EXISTS(
    SELECT 1 FROM pg_policies
    WHERE tablename = 'service_purchases' AND policyname = 'service_purchases_delete'
  ) INTO v_sp_delete_owner;

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '  MIGRACION 00008: REMAINING SECURITY FIXES';
  RAISE NOTICE '============================================';
  RAISE NOTICE '  process_sale search_path: %', COALESCE(v_sp_search_path, 'NO CONFIG');
  RAISE NOTICE '  service_sales no_update:  %', CASE WHEN v_ss_no_update THEN 'OK' ELSE 'FALLO' END;
  RAISE NOTICE '  service_sales no_delete:  %', CASE WHEN v_ss_no_delete THEN 'OK' ELSE 'FALLO' END;
  RAISE NOTICE '  service_purch no_update:  %', CASE WHEN v_sp_no_update THEN 'OK' ELSE 'FALLO' END;
  RAISE NOTICE '  service_purch delete:     %', CASE WHEN v_sp_delete_owner THEN 'OK' ELSE 'FALLO' END;
  RAISE NOTICE '============================================';

  IF NOT (v_ss_no_update AND v_ss_no_delete AND v_sp_no_update AND v_sp_delete_owner) THEN
    RAISE EXCEPTION 'Migracion 00008 fallo verificacion';
  END IF;
END $$;

COMMIT;

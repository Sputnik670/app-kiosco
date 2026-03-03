-- ============================================================================
-- MIGRATION: Add organization_id Validation to RPC Functions
-- ============================================================================
-- Created: 2026-01-20
-- Purpose: Add security validations to prevent cross-tenant data manipulation
-- Security: CRITICAL - Validates that all resources belong to user's org
--
-- Functions Updated:
-- - procesar_venta (CRITICAL - prevents selling products from other orgs)
-- - verificar_stock_disponible (validates product/branch ownership)
-- - incrementar_saldo_proveedor (validates supplier ownership)
-- - descontar_saldo_proveedor (validates supplier ownership)
-- - calcular_horas_trabajadas (filters attendance by org)
--
-- Dependencies:
-- - 20260112_create_v2_functions.sql (get_my_org_id_v2, es_owner_v2)
-- - 20260120_enable_rls_all_tables.sql (RLS must be enabled)
-- - 20260120_create_rls_policies.sql (RLS policies must exist)
-- ============================================================================

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════
-- 1. PROCESAR_VENTA (CRITICAL - Sales Transaction Engine)
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.procesar_venta(
  p_sucursal_id UUID,
  p_caja_diaria_id UUID,
  p_items JSONB,
  p_metodo_pago_global TEXT,
  p_monto_total_cliente NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_organization_id UUID;
  v_vendedor_id UUID;
  v_venta_id UUID;
  v_item JSONB;
  v_producto_id UUID;
  v_cantidad_solicitada INTEGER;
  v_precio_unitario NUMERIC;
  v_subtotal NUMERIC;
  v_producto_nombre TEXT;
  v_stock_disponible INTEGER;
  v_cantidad_restante INTEGER;
  v_stock_record RECORD;
  v_cantidad_a_descontar INTEGER;
  v_monto_total_calculado NUMERIC := 0;
BEGIN
  -- ═══════════════════════════════════════════════════════════════════════
  -- SECURITY VALIDATION: Verify that branch and cash register belong to user's org
  -- ═══════════════════════════════════════════════════════════════════════

  -- Get user's organization_id using V2 function
  SELECT public.get_my_org_id_v2() INTO v_organization_id;
  v_vendedor_id := auth.uid();

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no tiene organización asignada';
  END IF;

  -- Validate that branch belongs to user's organization
  IF NOT EXISTS (
    SELECT 1 FROM public.sucursales
    WHERE id = p_sucursal_id
    AND organization_id = v_organization_id
  ) THEN
    RAISE EXCEPTION 'La sucursal no pertenece a tu organización';
  END IF;

  -- Validate that cash register belongs to user's organization
  IF NOT EXISTS (
    SELECT 1 FROM public.caja_diaria
    WHERE id = p_caja_diaria_id
    AND organization_id = v_organization_id
  ) THEN
    RAISE EXCEPTION 'La caja diaria no pertenece a tu organización';
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════
  -- ORIGINAL TRANSACTION LOGIC (with additional org validations)
  -- ═══════════════════════════════════════════════════════════════════════

  -- Create Sales Record
  INSERT INTO public.ventas (
    organization_id, sucursal_id, caja_diaria_id, vendedor_id, monto_total, metodo_pago
  ) VALUES (
    v_organization_id, p_sucursal_id, p_caja_diaria_id, v_vendedor_id, p_monto_total_cliente, p_metodo_pago_global
  ) RETURNING id INTO v_venta_id;

  -- Process Items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_producto_id := (v_item->>'producto_id')::UUID;
    v_cantidad_solicitada := (v_item->>'cantidad')::INTEGER;

    -- Get product data WITH ORG VALIDATION
    SELECT precio_venta, nombre INTO v_precio_unitario, v_producto_nombre
    FROM public.productos
    WHERE id = v_producto_id
    AND organization_id = v_organization_id; -- ✅ SECURITY: Validate org ownership

    IF v_precio_unitario IS NULL THEN
      RAISE EXCEPTION 'Producto % no encontrado en tu organización', v_producto_id;
    END IF;

    v_subtotal := v_precio_unitario * v_cantidad_solicitada;
    v_monto_total_calculado := v_monto_total_calculado + v_subtotal;

    -- PESSIMISTIC LOCK: Validate Global Stock WITH ORG VALIDATION
    SELECT COALESCE(SUM(cantidad_disponible), 0) INTO v_stock_disponible
    FROM public.stock
    WHERE producto_id = v_producto_id
    AND sucursal_id = p_sucursal_id
    AND estado = 'disponible'
    AND organization_id = v_organization_id -- ✅ SECURITY: Validate org ownership
    FOR UPDATE;

    IF v_stock_disponible < v_cantidad_solicitada THEN
        RAISE EXCEPTION 'Stock insuficiente para %', v_producto_nombre;
    END IF;

    -- Deduct Stock (FIFO by expiration date) WITH ORG VALIDATION
    v_cantidad_restante := v_cantidad_solicitada;
    FOR v_stock_record IN
        SELECT id, cantidad_disponible FROM public.stock
        WHERE producto_id = v_producto_id
        AND sucursal_id = p_sucursal_id
        AND estado = 'disponible'
        AND cantidad_disponible > 0
        AND organization_id = v_organization_id -- ✅ SECURITY: Validate org ownership
        ORDER BY fecha_vencimiento ASC NULLS LAST
        FOR UPDATE
    LOOP
        EXIT WHEN v_cantidad_restante <= 0;
        v_cantidad_a_descontar := LEAST(v_stock_record.cantidad_disponible, v_cantidad_restante);

        UPDATE public.stock
        SET cantidad_disponible = cantidad_disponible - v_cantidad_a_descontar,
            estado = CASE WHEN (cantidad_disponible - v_cantidad_a_descontar) = 0 THEN 'agotado' ELSE estado END
        WHERE id = v_stock_record.id;

        -- Register Stock Movement
        INSERT INTO public.movimientos (
            organization_id, producto_id, sucursal_id, cantidad, tipo_movimiento, estado, referencia_tabla, referencia_id
        ) VALUES (
            v_organization_id, v_producto_id, p_sucursal_id, v_cantidad_a_descontar, 'salida', 'vendido', 'ventas', v_venta_id
        );

        v_cantidad_restante := v_cantidad_restante - v_cantidad_a_descontar;
    END LOOP;

    -- Create Sales Detail
    INSERT INTO public.detalles_venta (
        organization_id, venta_id, producto_id, cantidad, precio_unitario, subtotal
    ) VALUES (
        v_organization_id, v_venta_id, v_producto_id, v_cantidad_solicitada, v_precio_unitario, v_subtotal
    );
  END LOOP;

  -- Register Cash Movement (Income)
  INSERT INTO public.movimientos_caja (
    organization_id, caja_diaria_id, tipo, monto, categoria, descripcion
  ) VALUES (
    v_organization_id, p_caja_diaria_id, 'ingreso', p_monto_total_cliente, 'ventas', 'Venta #' || substring(v_venta_id::text, 1, 8)
  );

  RETURN v_venta_id;
END;
$$;

COMMENT ON FUNCTION public.procesar_venta(UUID, UUID, JSONB, TEXT, NUMERIC) IS
'Motor transaccional de ventas con validación de organization_id.
✅ SEGURO: Valida que sucursal, caja, productos y stock pertenecen a la org del usuario.
- Bloqueo pesimista para evitar race conditions
- Descuento FIFO de stock por fecha de vencimiento
- Registro automático de movimientos de stock y caja';

GRANT EXECUTE ON FUNCTION public.procesar_venta(UUID, UUID, JSONB, TEXT, NUMERIC) TO authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- 2. VERIFICAR_STOCK_DISPONIBLE (Stock Validation)
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.verificar_stock_disponible(
  p_producto_id UUID,
  p_sucursal_id UUID,
  p_cantidad INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_stock_disponible INTEGER;
  v_organization_id UUID;
BEGIN
  -- Security validation
  SELECT public.get_my_org_id_v2() INTO v_organization_id;

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no tiene organización asignada';
  END IF;

  -- Validate that product and branch belong to the org
  IF NOT EXISTS (
    SELECT 1 FROM public.productos
    WHERE id = p_producto_id
    AND organization_id = v_organization_id
  ) THEN
    RETURN false; -- Product doesn't exist in this org
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.sucursales
    WHERE id = p_sucursal_id
    AND organization_id = v_organization_id
  ) THEN
    RETURN false; -- Branch doesn't exist in this org
  END IF;

  SELECT COALESCE(SUM(cantidad_disponible), 0) INTO v_stock_disponible
  FROM public.stock
  WHERE producto_id = p_producto_id
    AND sucursal_id = p_sucursal_id
    AND estado = 'disponible'
    AND organization_id = v_organization_id; -- ✅ SECURITY: Validate org ownership

  RETURN v_stock_disponible >= p_cantidad;
END;
$$;

COMMENT ON FUNCTION public.verificar_stock_disponible(UUID, UUID, INTEGER) IS
'Verifica stock disponible con validación de organization_id.
✅ SEGURO: Solo retorna stock de productos/sucursales de la org del usuario.';

GRANT EXECUTE ON FUNCTION public.verificar_stock_disponible(UUID, UUID, INTEGER) TO authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- 3. INCREMENTAR_SALDO_PROVEEDOR (Increment Supplier Balance)
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.incrementar_saldo_proveedor(
  id_input UUID,
  monto_input NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_nuevo_saldo NUMERIC;
  v_organization_id UUID;
BEGIN
  -- Security validation
  SELECT public.get_my_org_id_v2() INTO v_organization_id;

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no tiene organización asignada';
  END IF;

  -- Validate positive amount
  IF monto_input <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser positivo';
  END IF;

  -- Atomic increment WITH ORG VALIDATION
  UPDATE public.proveedores
  SET saldo_actual = COALESCE(saldo_actual, 0) + monto_input
  WHERE id = id_input
  AND organization_id = v_organization_id -- ✅ SECURITY: Validate org ownership
  RETURNING saldo_actual INTO v_nuevo_saldo;

  IF v_nuevo_saldo IS NULL THEN
    RAISE EXCEPTION 'Proveedor no encontrado o no pertenece a tu organización';
  END IF;

  RETURN v_nuevo_saldo;
END;
$$;

COMMENT ON FUNCTION public.incrementar_saldo_proveedor(UUID, NUMERIC) IS
'Incrementa saldo de proveedor con validación de organization_id.
✅ SEGURO: Solo modifica proveedores de la org del usuario.';

GRANT EXECUTE ON FUNCTION public.incrementar_saldo_proveedor(UUID, NUMERIC) TO authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- 4. DESCONTAR_SALDO_PROVEEDOR (Decrement Supplier Balance)
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.descontar_saldo_proveedor(
  id_input UUID,
  monto_input NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_saldo_actual NUMERIC;
  v_nuevo_saldo NUMERIC;
  v_organization_id UUID;
BEGIN
  -- Security validation
  SELECT public.get_my_org_id_v2() INTO v_organization_id;

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no tiene organización asignada';
  END IF;

  -- Validate positive amount
  IF monto_input <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser positivo';
  END IF;

  -- Check sufficient balance with lock AND ORG VALIDATION
  SELECT saldo_actual INTO v_saldo_actual
  FROM public.proveedores
  WHERE id = id_input
  AND organization_id = v_organization_id -- ✅ SECURITY: Validate org ownership
  FOR UPDATE;

  IF v_saldo_actual IS NULL THEN
    RAISE EXCEPTION 'Proveedor no encontrado o no pertenece a tu organización';
  END IF;

  IF COALESCE(v_saldo_actual, 0) < monto_input THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponible: %', COALESCE(v_saldo_actual, 0);
  END IF;

  -- Atomic decrement
  UPDATE public.proveedores
  SET saldo_actual = COALESCE(saldo_actual, 0) - monto_input
  WHERE id = id_input
  AND organization_id = v_organization_id
  RETURNING saldo_actual INTO v_nuevo_saldo;

  RETURN v_nuevo_saldo;
END;
$$;

COMMENT ON FUNCTION public.descontar_saldo_proveedor(UUID, NUMERIC) IS
'Decrementa saldo de proveedor con validación de organization_id.
✅ SEGURO: Solo modifica proveedores de la org del usuario.
Valida saldo suficiente antes de descontar.';

GRANT EXECUTE ON FUNCTION public.descontar_saldo_proveedor(UUID, NUMERIC) TO authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- 5. CALCULAR_HORAS_TRABAJADAS (Calculate Worked Hours)
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.calcular_horas_trabajadas(
  p_empleado_id UUID,
  p_fecha_inicio TIMESTAMPTZ,
  p_fecha_fin TIMESTAMPTZ
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_total_horas NUMERIC;
  v_organization_id UUID;
BEGIN
  -- Security validation
  SELECT public.get_my_org_id_v2() INTO v_organization_id;

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no tiene organización asignada';
  END IF;

  SELECT COALESCE(
    SUM(
      EXTRACT(EPOCH FROM (COALESCE(salida, NOW()) - entrada)) / 3600
    ),
    0
  ) INTO v_total_horas
  FROM public.asistencia
  WHERE empleado_id = p_empleado_id
    AND organization_id = v_organization_id -- ✅ SECURITY: Filter by org
    AND entrada >= p_fecha_inicio
    AND entrada < p_fecha_fin;

  RETURN ROUND(v_total_horas, 2);
END;
$$;

COMMENT ON FUNCTION public.calcular_horas_trabajadas(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS
'Calcula horas trabajadas con validación de organization_id.
✅ SEGURO: Solo calcula horas de empleados de la org del usuario.';

GRANT EXECUTE ON FUNCTION public.calcular_horas_trabajadas(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- VERIFICATION: Check that all functions were updated
-- ══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  missing_functions TEXT[];
BEGIN
  -- Check that all critical functions exist
  SELECT ARRAY_AGG(func_name)
  INTO missing_functions
  FROM (
    SELECT unnest(ARRAY[
      'procesar_venta',
      'verificar_stock_disponible',
      'incrementar_saldo_proveedor',
      'descontar_saldo_proveedor',
      'calcular_horas_trabajadas'
    ]) AS func_name
  ) expected
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = func_name
    AND pronamespace = 'public'::regnamespace
  );

  IF array_length(missing_functions, 1) > 0 THEN
    RAISE WARNING 'The following functions are missing: %', missing_functions;
    RAISE EXCEPTION 'Migration failed: Not all functions were created';
  ELSE
    RAISE NOTICE '✅ SUCCESS: All RPC functions updated with organization_id validation';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION TESTING
-- ============================================================================
-- Test these scenarios manually after migration:
--
-- 1. Test procesar_venta with products from user's org (should work)
-- 2. Test procesar_venta with branch from another org (should fail)
-- 3. Test incrementar_saldo_proveedor with supplier from user's org (should work)
-- 4. Test incrementar_saldo_proveedor with supplier from another org (should fail)
-- 5. Test calcular_horas_trabajadas with employee from user's org (should work)
--
-- Expected behavior:
-- - All operations on user's own org resources should succeed
-- - All operations on other orgs' resources should raise exception
-- - Error messages should clearly indicate "no pertenece a tu organización"
-- ============================================================================

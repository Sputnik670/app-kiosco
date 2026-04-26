-- ============================================================================
-- MIGRATION 00013: Mercado Pago Cart Snapshot (Plan B)
-- ============================================================================
-- Fecha: 2026-04-26
-- Descripcion: Desacopla el registro de la venta del UI. Cuando el cliente
--              paga el QR, el webhook crea la sale server-side a partir de
--              cart_snapshot, sin depender de que el dialog siga abierto en
--              el celular del kiosquero.
--
-- Cambios:
--   - mercadopago_orders.cart_snapshot   JSONB        (nullable)
--   - mercadopago_orders.cash_register_id UUID FK     (nullable)
--   - FUNCTION process_sale_from_webhook(...)         (paralela a process_sale)
--
-- IMPORTANTE: esta migracion es IDEMPOTENTE. Las columnas usan IF NOT EXISTS
-- y la funcion usa CREATE OR REPLACE — correrla de nuevo no rompe nada si
-- ya fue aplicada via Supabase MCP.
--
-- Por que la columna nueva, en vez de reusar branch_id?
--   sales.cash_register_id es NOT NULL — necesitamos guardarlo al momento
--   del QR para poder crear la sale despues, aunque la caja se haya cerrado.
--
-- Por que un RPC nuevo, en vez de reusar process_sale?
--   process_sale usa get_my_org_id() y auth.uid() — desde el webhook no hay
--   sesion (service_role), entonces falla con "usuario no tiene organizacion
--   asignada". El nuevo RPC recibe p_org_id explicito y deja cashier_id NULL.
--
-- Por que NO chequear is_open en el RPC nuevo?
--   Entre que el cliente escanea el QR y MP nos avisa pueden pasar minutos.
--   Si la caja se cerro en el medio, no queremos perder la venta — el QR
--   ya estaba autorizado por una caja abierta. El webhook prioriza no
--   perder ventas por sobre la consistencia operativa de la caja.
--
-- Por que NO registrar cash_movements?
--   Solo aplica a payment_method='cash'. Este RPC siempre recibe 'mercadopago'.
--
-- SEGURIDAD CRITICA:
--   El RPC acepta p_org_id por parametro. Si lo dejaramos GRANT a authenticated,
--   un cliente malicioso podria pasarle el org_id de otra organizacion y crear
--   sales ajenas. SOLO debe llamarlo el webhook (service_role).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ALTER TABLE: mercadopago_orders — agregar cart_snapshot
-- ============================================================================
-- JSONB con el carrito al momento de generar el QR. Estructura esperada:
--   [
--     { "product_id": "uuid", "quantity": 2, "unit_price": 150.00, "subtotal": 300.00 },
--     ...
--   ]
-- Nullable: las ordenes creadas antes de esta migracion no tienen snapshot.

ALTER TABLE mercadopago_orders
  ADD COLUMN IF NOT EXISTS cart_snapshot JSONB;

COMMENT ON COLUMN mercadopago_orders.cart_snapshot IS
  'Snapshot del carrito al generar el QR. Lo usa el webhook para crear la sale cuando MP confirma el pago, sin depender del UI.';

-- ============================================================================
-- 2. ALTER TABLE: mercadopago_orders — agregar cash_register_id
-- ============================================================================
-- FK a cash_registers. Necesario porque sales.cash_register_id es NOT NULL,
-- y el webhook tiene que saber a que caja imputar la venta — sin importar
-- si esa caja sigue abierta al momento del cobro.
-- Nullable: las ordenes creadas antes de esta migracion no tienen el dato.

ALTER TABLE mercadopago_orders
  ADD COLUMN IF NOT EXISTS cash_register_id UUID REFERENCES cash_registers(id) ON DELETE SET NULL;

COMMENT ON COLUMN mercadopago_orders.cash_register_id IS
  'Caja en la que se genero el QR. El webhook lo usa para crear la sale aunque la caja ya este cerrada al momento del cobro.';

-- Indice para queries que listan ordenes por caja (poco frecuente, pero util)
CREATE INDEX IF NOT EXISTS idx_mp_orders_cash_reg
  ON mercadopago_orders(cash_register_id)
  WHERE cash_register_id IS NOT NULL;

-- ============================================================================
-- 3. RPC: process_sale_from_webhook
-- ============================================================================
-- Version paralela de process_sale, pensada para ser invocada desde un webhook
-- corriendo con service_role (sin sesion authenticated). Recibe p_org_id
-- explicito y deja cashier_id NULL.
--
-- Diferencias con process_sale:
--   - p_org_id explicito en vez de get_my_org_id()
--   - cashier_id = NULL en vez de auth.uid()
--   - NO valida is_open en cash_registers (ver razon en header)
--   - NO inserta en cash_movements (este RPC solo se usa para mercadopago,
--     que no es cash)
--   - NO acepta p_local_id (idempotencia la maneja el caller via
--     mercadopago_orders.sale_id IS NULL check)

CREATE OR REPLACE FUNCTION process_sale_from_webhook(
  p_org_id UUID,
  p_branch_id UUID,
  p_cash_register_id UUID,
  p_items JSONB,
  p_payment_method TEXT,
  p_total DECIMAL,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sale_id UUID;
  v_item JSONB;
BEGIN
  -- Validaciones de inputs
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'p_org_id es requerido';
  END IF;

  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION 'p_branch_id es requerido';
  END IF;

  IF p_cash_register_id IS NULL THEN
    RAISE EXCEPTION 'p_cash_register_id es requerido';
  END IF;

  -- Verificar que la caja existe y pertenece a la org (NO chequea is_open)
  IF NOT EXISTS (
    SELECT 1 FROM cash_registers
    WHERE id = p_cash_register_id
      AND organization_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Caja % no existe o no pertenece a la organizacion', p_cash_register_id;
  END IF;

  -- Verificar que la sucursal pertenece a la org
  IF NOT EXISTS (
    SELECT 1 FROM branches
    WHERE id = p_branch_id
      AND organization_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Sucursal % no existe o no pertenece a la organizacion', p_branch_id;
  END IF;

  -- Crear venta (cashier_id NULL: la creo el webhook, no un usuario)
  INSERT INTO sales (
    organization_id,
    branch_id,
    cash_register_id,
    cashier_id,
    total,
    payment_method,
    notes
  ) VALUES (
    p_org_id,
    p_branch_id,
    p_cash_register_id,
    NULL,
    p_total,
    p_payment_method,
    p_notes
  )
  RETURNING id INTO v_sale_id;

  -- Procesar items (mismo loop que process_sale)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO sale_items (
      organization_id,
      sale_id,
      product_id,
      quantity,
      unit_price,
      unit_cost,
      subtotal
    )
    SELECT
      p_org_id,
      v_sale_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unit_price')::DECIMAL,
      p.cost,
      (v_item->>'subtotal')::DECIMAL
    FROM products p
    WHERE p.id = (v_item->>'product_id')::UUID;

    -- Descontar stock FIFO (mismo orden que process_sale)
    UPDATE stock_batches
    SET quantity = quantity - (v_item->>'quantity')::INTEGER
    WHERE id = (
      SELECT id FROM stock_batches
      WHERE organization_id = p_org_id
        AND product_id = (v_item->>'product_id')::UUID
        AND branch_id = p_branch_id
        AND status = 'available'
        AND quantity > 0
      ORDER BY expiration_date NULLS LAST, created_at
      LIMIT 1
    );
  END LOOP;

  -- NO insertamos en cash_movements: este RPC solo se llama para mercadopago,
  -- que no es 'cash'. Si en el futuro se reusa para cash, agregar el bloque
  -- pero pensar bien que user_id poner (NULL podria romper NOT NULL constraint).

  RETURN v_sale_id;
END;
$$;

COMMENT ON FUNCTION process_sale_from_webhook IS
  'Crea sale + sale_items + descuenta stock FIFO desde un webhook con service_role. Paralelo a process_sale pero recibe org_id explicito y deja cashier_id NULL. NO valida is_open en la caja para no perder ventas si se cerro entre el QR y la confirmacion de MP.';

-- ============================================================================
-- 4. PERMISOS — CRITICO
-- ============================================================================
-- Este RPC acepta p_org_id por parametro. Si lo dejaramos llamable por
-- authenticated, un cliente malicioso podria pasarle el org_id de otra
-- organizacion y crear sales ajenas. SOLO el webhook (service_role) debe
-- poder ejecutarlo.

REVOKE EXECUTE ON FUNCTION process_sale_from_webhook(UUID, UUID, UUID, JSONB, TEXT, DECIMAL, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION process_sale_from_webhook(UUID, UUID, UUID, JSONB, TEXT, DECIMAL, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION process_sale_from_webhook(UUID, UUID, UUID, JSONB, TEXT, DECIMAL, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION process_sale_from_webhook(UUID, UUID, UUID, JSONB, TEXT, DECIMAL, TEXT) TO service_role;

-- ============================================================================
-- VERIFICACION
-- ============================================================================

DO $$
DECLARE
  v_col_snapshot BOOLEAN;
  v_col_cashreg BOOLEAN;
  v_fn_exists BOOLEAN;
  v_fn_authenticated_can_execute BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mercadopago_orders' AND column_name = 'cart_snapshot'
  ) INTO v_col_snapshot;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mercadopago_orders' AND column_name = 'cash_register_id'
  ) INTO v_col_cashreg;

  SELECT EXISTS(
    SELECT 1 FROM pg_proc
    WHERE proname = 'process_sale_from_webhook' AND prosecdef = true
  ) INTO v_fn_exists;

  -- Sanity check: authenticated NO debe poder ejecutar este RPC
  SELECT has_function_privilege(
    'authenticated',
    'process_sale_from_webhook(UUID, UUID, UUID, JSONB, TEXT, DECIMAL, TEXT)',
    'EXECUTE'
  ) INTO v_fn_authenticated_can_execute;

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '  MIGRACION 00013: MP CART SNAPSHOT (PLAN B)';
  RAISE NOTICE '============================================';
  RAISE NOTICE '  cart_snapshot column:           %', CASE WHEN v_col_snapshot THEN 'OK' ELSE 'FALLO' END;
  RAISE NOTICE '  cash_register_id column:        %', CASE WHEN v_col_cashreg THEN 'OK' ELSE 'FALLO' END;
  RAISE NOTICE '  process_sale_from_webhook fn:   %', CASE WHEN v_fn_exists THEN 'OK' ELSE 'FALLO' END;
  RAISE NOTICE '  authenticated NO puede ejecutar:%', CASE WHEN NOT v_fn_authenticated_can_execute THEN 'OK' ELSE 'FALLO (riesgo!)' END;
  RAISE NOTICE '============================================';

  IF NOT (v_col_snapshot AND v_col_cashreg AND v_fn_exists) THEN
    RAISE EXCEPTION 'Migracion 00013 fallo verificacion de objetos';
  END IF;

  IF v_fn_authenticated_can_execute THEN
    RAISE EXCEPTION 'Migracion 00013 fallo verificacion de seguridad: authenticated puede ejecutar process_sale_from_webhook';
  END IF;
END $$;

COMMIT;

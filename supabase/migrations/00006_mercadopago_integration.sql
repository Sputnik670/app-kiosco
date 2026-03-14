-- ============================================================================
-- MIGRATION 00006: Mercado Pago QR Integration
-- ============================================================================
-- Fecha: 2026-03-14
-- Descripcion: Tablas y politicas para integrar Mercado Pago QR como medio
--              de pago en el punto de venta.
--
-- Tablas nuevas:
--   - mercadopago_credentials: Credenciales encriptadas por organizacion
--   - mercadopago_orders: Ordenes QR vinculadas a ventas
--
-- Alteraciones:
--   - sales.payment_method: agrega 'mercadopago' como valor valido
--   - sales.mp_order_id: FK a mercadopago_orders
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. EXTENSION pgcrypto (para encriptar credenciales)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 2. TABLA: mercadopago_credentials
-- ============================================================================
-- Almacena las credenciales de MP por organizacion.
-- access_token y webhook_secret se guardan encriptados con pgp_sym_encrypt.
-- La clave de encriptacion viene de una variable de entorno del servidor.

CREATE TABLE mercadopago_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Datos sensibles (se encriptan via server action antes de guardar)
  access_token_encrypted TEXT NOT NULL,
  webhook_secret_encrypted TEXT NOT NULL,

  -- Datos en texto plano (no sensibles, necesarios en frontend)
  public_key TEXT NOT NULL,
  collector_id TEXT NOT NULL,

  -- Estado
  is_sandbox BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT uq_mp_creds_org UNIQUE(organization_id)
);

COMMENT ON TABLE mercadopago_credentials IS 'Credenciales de Mercado Pago por organizacion. Tokens encriptados con pgcrypto.';
COMMENT ON COLUMN mercadopago_credentials.access_token_encrypted IS 'Access token encriptado con pgp_sym_encrypt. Desencriptar solo en server actions.';
COMMENT ON COLUMN mercadopago_credentials.collector_id IS 'User ID del vendedor en MP. Necesario para crear ordenes QR.';

-- Indice para busqueda por org
CREATE INDEX idx_mp_creds_org ON mercadopago_credentials(organization_id);

-- ============================================================================
-- 3. TABLA: mercadopago_orders
-- ============================================================================
-- Cada orden QR se vincula a una venta. El flujo es:
--   1. Se crea la venta con payment_method='mercadopago' y total
--   2. Se crea la orden QR en MP y se guarda aqui
--   3. El webhook actualiza el status cuando el cliente paga
--   4. La UI pollea el status hasta confirmacion o timeout

CREATE TABLE mercadopago_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,

  -- Referencia externa para idempotencia
  external_reference TEXT NOT NULL,

  -- Monto
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'ARS',

  -- QR
  qr_data TEXT,

  -- Estado: pending -> confirmed | failed | expired | cancelled
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'failed', 'expired', 'cancelled')),

  -- IDs de Mercado Pago
  mp_payment_id TEXT,
  mp_order_id TEXT,
  mp_transaction_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 minutes'),
  confirmed_at TIMESTAMPTZ,
  webhook_received_at TIMESTAMPTZ,

  notes TEXT,

  CONSTRAINT uq_mp_order_ext_ref UNIQUE(organization_id, external_reference)
);

COMMENT ON TABLE mercadopago_orders IS 'Ordenes QR de Mercado Pago. Vinculadas 1:1 con ventas pagadas por MP.';
COMMENT ON COLUMN mercadopago_orders.external_reference IS 'Referencia unica para idempotencia. Formato: sale_{sale_id}';
COMMENT ON COLUMN mercadopago_orders.qr_data IS 'String EMVCo para generar la imagen QR en el frontend.';
COMMENT ON COLUMN mercadopago_orders.status IS 'pending=esperando pago, confirmed=pagado, failed=rechazado, expired=timeout, cancelled=cancelado';

-- Indices para queries frecuentes
CREATE INDEX idx_mp_orders_org_status ON mercadopago_orders(organization_id, status);
CREATE INDEX idx_mp_orders_sale ON mercadopago_orders(sale_id);
CREATE INDEX idx_mp_orders_branch ON mercadopago_orders(branch_id, created_at DESC);
CREATE INDEX idx_mp_orders_pending ON mercadopago_orders(status, expires_at)
  WHERE status = 'pending';

-- ============================================================================
-- 4. ALTER sales: agregar 'mercadopago' como metodo de pago
-- ============================================================================
-- El CHECK constraint actual solo permite: cash, card, transfer, wallet
-- Necesitamos agregar mercadopago.

ALTER TABLE sales
  DROP CONSTRAINT IF EXISTS sales_payment_method_check;

ALTER TABLE sales
  ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IN ('cash', 'card', 'transfer', 'wallet', 'mercadopago'));

-- ============================================================================
-- 5. ALTER sales: agregar columna mp_order_id
-- ============================================================================

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS mp_order_id UUID REFERENCES mercadopago_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_mp_order ON sales(mp_order_id)
  WHERE mp_order_id IS NOT NULL;

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

-- mercadopago_credentials: solo el owner de la org puede ver/modificar
ALTER TABLE mercadopago_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mp_creds_select" ON mercadopago_credentials
  FOR SELECT TO authenticated
  USING (organization_id = get_my_org_id());

CREATE POLICY "mp_creds_insert" ON mercadopago_credentials
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY "mp_creds_update" ON mercadopago_credentials
  FOR UPDATE TO authenticated
  USING (organization_id = get_my_org_id());

CREATE POLICY "mp_creds_delete" ON mercadopago_credentials
  FOR DELETE TO authenticated
  USING (organization_id = get_my_org_id());

CREATE POLICY "mp_creds_service" ON mercadopago_credentials
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- mercadopago_orders: lectura para todos los miembros, escritura via service_role
ALTER TABLE mercadopago_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mp_orders_select" ON mercadopago_orders
  FOR SELECT TO authenticated
  USING (organization_id = get_my_org_id());

CREATE POLICY "mp_orders_insert" ON mercadopago_orders
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY "mp_orders_update" ON mercadopago_orders
  FOR UPDATE TO authenticated
  USING (organization_id = get_my_org_id());

-- No se borran ordenes (auditoria)
CREATE POLICY "mp_orders_no_delete" ON mercadopago_orders
  FOR DELETE TO authenticated
  USING (false);

CREATE POLICY "mp_orders_service" ON mercadopago_orders
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 7. FUNCION: auto-expirar ordenes pendientes
-- ============================================================================
-- Funcion que puede llamarse periodicamente (cron o desde la app)
-- para marcar como expiradas las ordenes que pasaron su expires_at.

CREATE OR REPLACE FUNCTION expire_pending_mp_orders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE mercadopago_orders
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION expire_pending_mp_orders IS 'Expira ordenes QR pendientes que superaron su tiempo limite. Retorna cantidad de ordenes expiradas.';

-- ============================================================================
-- 8. TRIGGER: updated_at automatico para credenciales
-- ============================================================================

CREATE OR REPLACE FUNCTION update_mp_creds_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mp_creds_updated_at
  BEFORE UPDATE ON mercadopago_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_mp_creds_updated_at();

-- ============================================================================
-- VERIFICACION
-- ============================================================================

DO $$
DECLARE
  v_mp_creds BOOLEAN;
  v_mp_orders BOOLEAN;
  v_sales_col BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'mercadopago_credentials') INTO v_mp_creds;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'mercadopago_orders') INTO v_mp_orders;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'mp_order_id') INTO v_sales_col;

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '  MIGRACION 00006: MERCADO PAGO QR';
  RAISE NOTICE '============================================';
  RAISE NOTICE '  mercadopago_credentials: %', CASE WHEN v_mp_creds THEN 'OK' ELSE 'FALLO' END;
  RAISE NOTICE '  mercadopago_orders:      %', CASE WHEN v_mp_orders THEN 'OK' ELSE 'FALLO' END;
  RAISE NOTICE '  sales.mp_order_id:       %', CASE WHEN v_sales_col THEN 'OK' ELSE 'FALLO' END;
  RAISE NOTICE '============================================';

  IF NOT (v_mp_creds AND v_mp_orders AND v_sales_col) THEN
    RAISE EXCEPTION 'Migracion 00006 fallo verificacion';
  END IF;
END $$;

COMMIT;

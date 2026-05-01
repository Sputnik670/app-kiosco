-- ============================================================================
-- MIGRATION 00010: Payment methods expansion (Posnet MP / QR fijo / Alias)
-- ============================================================================
-- Fecha: 2026-04-24
-- Descripcion:
--   El dueño puede habilitar 3 modalidades nuevas de cobro manual que complementan
--   el QR dinámico de Mercado Pago ya integrado:
--     1. Posnet MP (lector físico — solo registra que el cobro se hizo ahí)
--     2. QR fijo (imagen del QR estático de MP que el cliente escanea desde afuera)
--     3. Alias / CVU (transferencia directa)
--
--   Son métodos "manuales" (no tienen flujo automatizado) — la confirmación
--   del cobro la hace el cajero al tocar "Ya cobré" luego de verificar en su
--   app de MP o banco.
--
-- Alteraciones:
--   - sales.payment_method CHECK: agrega 'posnet_mp', 'qr_static_mp', 'transfer_alias'
--   - Nueva tabla payment_methods_config (1:1 por organización, RLS)
--   - Nuevo bucket de storage 'payment-assets' para subir la imagen del QR fijo
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Ampliar CHECK de sales.payment_method
-- ============================================================================

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IN (
    'cash',            -- Efectivo
    'card',            -- Tarjeta genérica (débito/crédito por posnet no-MP)
    'transfer',        -- Transferencia bancaria tradicional (legacy)
    'wallet',          -- Billetera virtual genérica (legacy)
    'mercadopago',     -- QR dinámico MP (flujo OAuth + webhook, ya integrado)
    'posnet_mp',       -- Posnet físico de Mercado Pago (solo registro)
    'qr_static_mp',    -- QR fijo de Mercado Pago (imagen estática)
    'transfer_alias'   -- Transferencia por alias/CVU
  ));

COMMENT ON CONSTRAINT sales_payment_method_check ON sales IS
  'Métodos de cobro habilitados. cash/card/transfer/wallet legacy. mercadopago = QR dinámico con webhook. posnet_mp/qr_static_mp/transfer_alias = métodos manuales (confirmación del cajero).';

-- ============================================================================
-- 2. Tabla payment_methods_config — una fila por organización
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_methods_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- POSNET MP (lector físico)
  posnet_mp_enabled BOOLEAN NOT NULL DEFAULT false,
  posnet_mp_label TEXT,
  posnet_mp_notes TEXT,

  -- QR FIJO MP
  qr_static_enabled BOOLEAN NOT NULL DEFAULT false,
  qr_static_image_url TEXT,
  qr_static_image_path TEXT,
  qr_static_holder_name TEXT,
  qr_static_instructions TEXT,

  -- ALIAS / TRANSFERENCIA
  alias_enabled BOOLEAN NOT NULL DEFAULT false,
  alias_value TEXT,
  alias_cbu_cvu TEXT,
  alias_titular_name TEXT,
  alias_bank_name TEXT,
  alias_instructions TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_pmc_org UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_pmc_org ON payment_methods_config(organization_id);

CREATE OR REPLACE FUNCTION update_pmc_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pmc_updated_at ON payment_methods_config;
CREATE TRIGGER trg_pmc_updated_at
  BEFORE UPDATE ON payment_methods_config
  FOR EACH ROW
  EXECUTE FUNCTION update_pmc_updated_at();

-- ============================================================================
-- 3. Row Level Security
-- ============================================================================

ALTER TABLE payment_methods_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pmc_select ON payment_methods_config;
CREATE POLICY pmc_select ON payment_methods_config
  FOR SELECT TO authenticated
  USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS pmc_insert ON payment_methods_config;
CREATE POLICY pmc_insert ON payment_methods_config
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_org_id() AND is_owner());

DROP POLICY IF EXISTS pmc_update ON payment_methods_config;
CREATE POLICY pmc_update ON payment_methods_config
  FOR UPDATE TO authenticated
  USING (organization_id = get_my_org_id() AND is_owner())
  WITH CHECK (organization_id = get_my_org_id() AND is_owner());

DROP POLICY IF EXISTS pmc_delete ON payment_methods_config;
CREATE POLICY pmc_delete ON payment_methods_config
  FOR DELETE TO authenticated
  USING (organization_id = get_my_org_id() AND is_owner());

-- ============================================================================
-- 4. Storage bucket para QR fijo
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-assets',
  'payment-assets',
  true,
  2097152,
  ARRAY['image/png','image/jpeg','image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS payment_assets_select ON storage.objects;
CREATE POLICY payment_assets_select ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'payment-assets');

DROP POLICY IF EXISTS payment_assets_insert ON storage.objects;
CREATE POLICY payment_assets_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-assets'
    AND is_owner()
    AND (storage.foldername(name))[1] = get_my_org_id()::text
  );

DROP POLICY IF EXISTS payment_assets_update ON storage.objects;
CREATE POLICY payment_assets_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'payment-assets'
    AND is_owner()
    AND (storage.foldername(name))[1] = get_my_org_id()::text
  );

DROP POLICY IF EXISTS payment_assets_delete ON storage.objects;
CREATE POLICY payment_assets_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'payment-assets'
    AND is_owner()
    AND (storage.foldername(name))[1] = get_my_org_id()::text
  );

COMMIT;

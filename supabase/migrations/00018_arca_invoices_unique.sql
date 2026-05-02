-- ============================================================================
-- 00018_arca_invoices_unique.sql
-- ============================================================================
-- Agrega indices UNIQUE parciales a arca_invoices para garantizar:
--   (a) Una venta solo se factura una vez (status='authorized').
--   (b) No se duplican comprobantes autorizados localmente por punto de venta
--       y tipo (defensa contra bugs en código — AFIP ya rechazaría duplicados,
--       pero esto blinda nuestro lado por si algún día hay race condition).
--
-- Por qué partial UNIQUE: arca_invoices guarda intentos fallidos
-- (status='error') sin cbte_numero. Esos rows NO deben competir contra el
-- UNIQUE — solo los autorizados.
--
-- Ambos indices son IF NOT EXISTS — la migration es idempotente.
-- ============================================================================

-- (a) Una venta = una factura autorizada
CREATE UNIQUE INDEX IF NOT EXISTS arca_invoices_sale_authorized_unique
  ON public.arca_invoices (sale_id)
  WHERE sale_id IS NOT NULL AND status = 'authorized';

-- (b) Un número de comprobante = una sola fila autorizada por (org, tipo, pv)
CREATE UNIQUE INDEX IF NOT EXISTS arca_invoices_voucher_unique
  ON public.arca_invoices (organization_id, cbte_tipo, punto_venta, cbte_numero)
  WHERE cbte_numero IS NOT NULL AND status = 'authorized';

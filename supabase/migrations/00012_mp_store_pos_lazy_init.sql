-- ============================================================================
-- MERCADO PAGO: Columnas legacy reservadas (Store + POS)
-- ============================================================================
--
-- Contexto: La idea original era crear QRs dinámicos in-store con el endpoint
-- /instore/orders/qr/seller/.../pos/.../qrs, que requiere registrar Store + POS
-- por API. Probamos auto-registrarlos en runtime (helper ensureStoreAndPOS) y
-- la API de MP rechazaba los POST /users/{id}/stores en cuentas de apps recién
-- creadas, probablemente por permisos OAuth insuficientes.
--
-- Pivot (2026-04-25): pasamos a /checkout/preferences. El QR encodea un
-- init_point URL en vez de un EMVCo string. Funciona con cualquier OAuth.
--
-- Estas columnas existen en la DB pero por ahora no se usan. Las dejamos para
-- no hacer DROP en prod y por si en el futuro reactivamos el camino in-store.
-- ============================================================================

ALTER TABLE mercadopago_credentials
  ADD COLUMN IF NOT EXISTS mp_store_id text,
  ADD COLUMN IF NOT EXISTS mp_pos_external_id text;

COMMENT ON COLUMN mercadopago_credentials.mp_store_id IS
  'LEGACY (no usado): ID del Store de MP. Reservado para futura reactivación del camino in-store QR.';
COMMENT ON COLUMN mercadopago_credentials.mp_pos_external_id IS
  'LEGACY (no usado): external_id del POS de MP. Reservado para futura reactivación del camino in-store QR.';

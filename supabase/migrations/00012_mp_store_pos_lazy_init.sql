-- ============================================================================
-- MERCADO PAGO: Cache de Store + POS para lazy init
-- ============================================================================
--
-- Contexto: Para crear QRs dinámicos in-store, MP requiere que cada cuenta
-- tenga registrado un Store y un POS. En vez de pedírselo al kiosquero
-- manualmente, el código los crea automáticamente la primera vez que se
-- intenta cobrar con QR. Estos campos guardan los IDs para no recrearlos.
--
-- Si ambos están NULL, el helper ensureStoreAndPOS() los crea.
-- Si están seteados, se usan directamente.
-- ============================================================================

ALTER TABLE mercadopago_credentials
  ADD COLUMN IF NOT EXISTS mp_store_id text,
  ADD COLUMN IF NOT EXISTS mp_pos_external_id text;

COMMENT ON COLUMN mercadopago_credentials.mp_store_id IS
  'ID del Store creado en MP (lazy init). Si NULL, hay que crearlo.';
COMMENT ON COLUMN mercadopago_credentials.mp_pos_external_id IS
  'external_id del POS registrado en MP. Se usa en la URL del endpoint QR.';

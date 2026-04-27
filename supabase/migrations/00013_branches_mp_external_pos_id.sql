-- ============================================================================
-- MERCADO PAGO: external_pos_id por sucursal (Branch)
-- ============================================================================
--
-- Contexto: Migrar de Preferences API → endpoint EMVCo
-- /instore/orders/qr/seller/collectors/{user_id}/pos/{external_pos_id}/qrs
-- para que el QR sea interoperable (Naranja X, Brubank, Ualá, MODO,
-- Cuenta DNI, etc.) y no solo lo lea la app de Mercado Pago.
--
-- Decisión de modelo: 1 POS de MP = 1 sucursal (branch), NO 1 cash_register.
-- cash_registers es per-día (turno), branches es persistente.
--
-- Las columnas legacy mercadopago_credentials.mp_store_id y mp_pos_external_id
-- (migration 00012) quedan as-is — eran a nivel org y no las usa el flujo nuevo.
-- ============================================================================

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS mp_external_pos_id text;

CREATE UNIQUE INDEX IF NOT EXISTS branches_mp_pos_org_uniq
  ON branches (organization_id, mp_external_pos_id)
  WHERE mp_external_pos_id IS NOT NULL;

COMMENT ON COLUMN branches.mp_external_pos_id IS
  'external_pos_id registrado en Mercado Pago para esta sucursal. Se usa al generar QRs EMVCo via /instore/orders/qr/seller/collectors/{user_id}/pos/{external_pos_id}/qrs. Null = sucursal sin POS registrado en MP. Formato: KIOSCO_<branch_id_hex_sin_guiones>.';

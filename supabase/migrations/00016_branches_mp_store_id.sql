-- ═══════════════════════════════════════════════════════════════════════════════
-- 00016_branches_mp_store_id.sql
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Agrega la columna `mp_store_id` a `branches` para persistir el ID del Store
-- de Mercado Pago asociado a cada sucursal.
--
-- Contexto: el flujo correcto de registro EMVCo en MP requiere primero crear
-- un Store (POST /users/{user_id}/stores) y después un POS bajo ese Store
-- (POST /pos con `store_id`). Hasta el 27-abr-2026 el código intentaba
-- registrar el POS llamando a un endpoint inexistente
-- (PUT /instore/orders/qr/.../pos/{external_pos_id}), lo que dejaba el POS
-- nunca registrado del lado de MP. Resultado: el QR generado solo lo leía
-- la app de Mercado Pago — Naranja X / MODO / Cuenta DNI lo rechazaban.
--
-- Esta columna habilita la implementación correcta (Stores+POS) y permite
-- recovery: si la creación del POS falla, el `mp_store_id` ya quedó persistido
-- y un retry no duplica el Store.
--
-- 1 sucursal = 1 store de MP. UNIQUE por organización para garantizar que
-- no se asocie el mismo store a dos sucursales por error.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS mp_store_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS branches_mp_store_id_unique
  ON branches (organization_id, mp_store_id)
  WHERE mp_store_id IS NOT NULL;

COMMENT ON COLUMN branches.mp_store_id IS
  'ID del Store de Mercado Pago asociado a esta sucursal. Generado por MP al crear el store via POST /users/{user_id}/stores. Se persiste para asociar el POS y reusar el store en re-registros.';

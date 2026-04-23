-- ============================================================================
-- MIGRATION 00009 — Fichaje QR por empleado (no por sucursal)
-- ============================================================================
--
-- CONTEXTO:
-- Hasta 00008 el fichaje funcionaba con QR estático impreso en cada sucursal
-- (branches.qr_entrada_url + qr_salida_url). Problema de seguridad: un empleado
-- le saca foto al QR y puede fichar desde su casa.
--
-- SOLUCIÓN:
-- Cada membership (empleado en una org) tiene su propio QR (UUID único). El
-- dueño imprime una tarjeta por empleado. El kiosco tiene un scanner que lee
-- la tarjeta del empleado → abre/cierra turno de ESE empleado.
--
-- Esta migración solo agrega la columna. El código app usa el nuevo flujo en
-- processEmployeeQRScanAction(). Las columnas qr_entrada_url/qr_salida_url
-- en branches quedan DEPRECATED pero no se borran todavía (sprint de gracia).
-- ============================================================================

-- 1) Agregar columna qr_code a memberships
--    DEFAULT gen_random_uuid() asegura que las filas nuevas tienen QR desde el insert.
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS qr_code UUID DEFAULT gen_random_uuid();

-- 2) Backfill: generar QR para filas existentes que quedaron NULL
--    (por si la columna se agregó sin default en algún entorno previo).
UPDATE memberships
SET qr_code = gen_random_uuid()
WHERE qr_code IS NULL;

-- 3) NOT NULL una vez que todas las filas tienen valor
ALTER TABLE memberships
  ALTER COLUMN qr_code SET NOT NULL;

-- 4) Unicidad global: el QR identifica al empleado de forma única cross-org
ALTER TABLE memberships
  ADD CONSTRAINT memberships_qr_code_unique UNIQUE (qr_code);

-- 5) Índice para lookups rápidos en el scan
CREATE INDEX IF NOT EXISTS idx_memberships_qr_code
  ON memberships (qr_code);

-- 6) Documentación
COMMENT ON COLUMN memberships.qr_code IS
  'UUID único usado como código de tarjeta de fichaje. El dueño imprime una tarjeta por empleado; el scanner del kiosco lee el QR y abre/cierra turno. Reemplaza el flujo viejo de branches.qr_entrada_url/qr_salida_url.';

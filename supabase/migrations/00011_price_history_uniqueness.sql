-- ============================================================================
-- PRICE HISTORY: Prevenir duplicados a nivel DB (defense-in-depth)
-- ============================================================================
--
-- Contexto: Bug de duplicación detectado en producción (2026-04-24). Dos
-- fuentes escribían en price_history para el mismo evento:
--   1) INSERT manual en server actions (`processComplexStockEntry`, etc.)
--   2) Trigger `trigger_log_price_change` al hacer UPDATE en `products`.
--
-- El código ya fue arreglado (commit 5d5ce7e) removiendo los INSERT manuales.
-- Esta migración agrega una defensa extra a nivel base de datos para que,
-- aunque en el futuro algún código se rompa, Postgres rechace duplicados.
--
-- También robustece el trigger:
--   - `IS DISTINCT FROM` en lugar de `!=` (maneja NULLs correctamente)
--   - `ON CONFLICT DO NOTHING` (si hay duplicado, el trigger no falla)
--   - `SET search_path TO 'public'` (hardening de SECURITY DEFINER, per
--     recomendación de Supabase Security Advisor)
-- ============================================================================

-- Índice único: bloquea inserts idénticos para el mismo producto en el mismo
-- segundo. COALESCE fuerza a que dos NULL se traten como iguales (por default
-- PostgreSQL considera NULLs como distintos en UNIQUE constraints).
CREATE UNIQUE INDEX IF NOT EXISTS price_history_no_duplicates_idx
ON price_history (
  product_id,
  COALESCE(old_price, -1),
  COALESCE(new_price, -1),
  COALESCE(old_cost, -1),
  COALESCE(new_cost, -1),
  date_trunc('second', created_at)
);

-- Trigger robustecido
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.sale_price IS DISTINCT FROM NEW.sale_price
     OR OLD.cost IS DISTINCT FROM NEW.cost THEN
    INSERT INTO price_history (
      organization_id, product_id,
      old_price, new_price,
      old_cost, new_cost,
      changed_by
    )
    VALUES (
      NEW.organization_id, NEW.id,
      OLD.sale_price, NEW.sale_price,
      OLD.cost, NEW.cost,
      auth.uid()
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path TO 'public';

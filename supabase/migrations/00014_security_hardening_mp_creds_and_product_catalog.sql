-- ============================================================================
-- MIGRATION 00014: Security Hardening — MP Credentials + Product Catalog
-- ============================================================================
-- Fecha: 2026-04-26
-- Descripcion: Endurecimiento de RLS y permisos.
--
-- Origen:
--   - Hallazgos del AUDIT-FINDINGS.md (24-abr-2026) abiertos en BAJO.
--   - Revisión de hoy: anon tenía GRANTs amplios en mercadopago_credentials
--     (RLS los filtraba pero el GRANT igual no debería existir).
--   - Revisión de hoy: webhook_secret_encrypted en mercadopago_credentials
--     era NULL. Causa raíz del HMAC mismatch (ver fix paralelo en
--     app/api/mercadopago/oauth/callback/route.ts).
--
-- Cambios:
--   (1) mp_creds_select: SELECT solo para owner (antes: cualquier miembro org).
--   (2) REVOKE ALL en mercadopago_credentials para rol anon — defensa en
--       profundidad. RLS ya bloquea filas, pero el GRANT no debería existir.
--   (3) product_catalog INSERT: WITH CHECK (contributed_by = auth.uid()) —
--       previene contribuciones spoofeando el contributed_by.
--
-- IDEMPOTENTE: DROP POLICY IF EXISTS + CREATE POLICY. Correrla de nuevo
-- es safe si ya fue aplicada via Supabase MCP.
-- ============================================================================

BEGIN;

-- ─── (1) mercadopago_credentials: SELECT a owner ────────────────────────────
-- Antes: cualquier miembro de la org podía leer credenciales encriptadas.
-- Ahora: solo el owner. Los tokens no llegan al cliente igual (server-side),
-- pero achicamos la superficie.

DROP POLICY IF EXISTS mp_creds_select ON mercadopago_credentials;

CREATE POLICY mp_creds_select ON mercadopago_credentials
  FOR SELECT TO authenticated
  USING ((organization_id = get_my_org_id()) AND is_owner());

-- ─── (2) mercadopago_credentials: REVOKE de anon ────────────────────────────
-- anon nunca debería tocar esta tabla. La RLS ya filtra filas pero el GRANT
-- es la primera barrera. Defensa en profundidad.

REVOKE ALL ON mercadopago_credentials FROM anon;

-- ─── (3) product_catalog INSERT: atar contributed_by a auth.uid() ──────────
-- Antes: WITH CHECK (true) — cualquier user podía insertar setando
-- contributed_by a otro UUID (impersonando contribuciones).
-- Ahora: el contributed_by tiene que coincidir con el user que inserta.

DROP POLICY IF EXISTS "Authenticated users can insert to catalog" ON product_catalog;

CREATE POLICY "Authenticated users can insert to catalog" ON product_catalog
  FOR INSERT TO authenticated
  WITH CHECK (contributed_by = auth.uid());

-- ─── VERIFICACIÓN ───────────────────────────────────────────────────────────

DO $$
DECLARE
  v_mp_select_qual TEXT;
  v_anon_select BOOLEAN;
  v_anon_insert BOOLEAN;
  v_pc_insert_check TEXT;
BEGIN
  SELECT qual INTO v_mp_select_qual
  FROM pg_policies
  WHERE tablename = 'mercadopago_credentials' AND policyname = 'mp_creds_select';

  SELECT has_table_privilege('anon', 'mercadopago_credentials', 'SELECT') INTO v_anon_select;
  SELECT has_table_privilege('anon', 'mercadopago_credentials', 'INSERT') INTO v_anon_insert;

  SELECT with_check INTO v_pc_insert_check
  FROM pg_policies
  WHERE tablename = 'product_catalog' AND policyname = 'Authenticated users can insert to catalog';

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '  MIGRACION 00014: SECURITY HARDENING';
  RAISE NOTICE '============================================';
  RAISE NOTICE '  mp_creds_select usa is_owner():     %', v_mp_select_qual LIKE '%is_owner()%';
  RAISE NOTICE '  anon SELECT mp_credentials (false): %', v_anon_select;
  RAISE NOTICE '  anon INSERT mp_credentials (false): %', v_anon_insert;
  RAISE NOTICE '  product_catalog ata contributed_by: %', v_pc_insert_check LIKE '%contributed_by%';
  RAISE NOTICE '============================================';

  IF v_anon_select OR v_anon_insert THEN
    RAISE EXCEPTION 'Migracion 00014 fallo: anon todavia tiene privilegios sobre mercadopago_credentials';
  END IF;

  IF v_mp_select_qual NOT LIKE '%is_owner()%' THEN
    RAISE EXCEPTION 'Migracion 00014 fallo: mp_creds_select no incluye is_owner()';
  END IF;

  IF v_pc_insert_check NOT LIKE '%contributed_by%' THEN
    RAISE EXCEPTION 'Migracion 00014 fallo: product_catalog INSERT no exige contributed_by = auth.uid()';
  END IF;
END $$;

COMMIT;

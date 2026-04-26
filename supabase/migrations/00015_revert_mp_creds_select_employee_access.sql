-- ============================================================================
-- MIGRATION 00015: Revert mp_creds_select endurecimiento
-- ============================================================================
-- Fecha: 2026-04-26
-- Descripción: revertir el endurecimiento de mp_creds_select aplicado en 00014.
--
-- Problema que se manifestó tras 00014:
--   El cobro QR Mercado Pago lo opera cualquier empleado desde la caja
--   (caja-ventas.tsx → createMercadoPagoOrderAction). El action lee la fila
--   de mercadopago_credentials con el cliente del server action, sujeto a RLS.
--   Si el SELECT exige is_owner(), un empleado nunca puede generar QR. Eso
--   rompe el caso de uso principal del POS.
--
-- Razón de seguridad por la que el revert es aceptable:
--   Los tokens están encriptados con AES-256-GCM y MP_ENCRYPTION_KEY (env var
--   de Vercel, no en DB). Un empleado que vea la fila a través de RLS NO
--   tiene la key de descifrado — solo el server action la tiene. La fila
--   encriptada por sí sola no entrega los tokens en claro, así que el riesgo
--   de exposición de credenciales es mínimo.
--
-- Lo que NO se revierte (sigue endurecido):
--   - INSERT/UPDATE/DELETE siguen siendo solo is_owner() (configurar/rotar
--     credenciales sigue siendo prerrogativa del dueño).
--   - REVOKE ALL FROM anon en mercadopago_credentials (de 00014, sigue activo).
--   - product_catalog INSERT con contributed_by = auth.uid() (de 00014, sigue
--     activo).
--
-- Idempotente: DROP POLICY IF EXISTS + CREATE POLICY.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS mp_creds_select ON mercadopago_credentials;

CREATE POLICY mp_creds_select ON mercadopago_credentials
  FOR SELECT TO authenticated
  USING (organization_id = get_my_org_id());

-- Verificación
DO $$
DECLARE
  v_qual TEXT;
BEGIN
  SELECT qual INTO v_qual
  FROM pg_policies
  WHERE tablename = 'mercadopago_credentials' AND policyname = 'mp_creds_select';

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '  MIGRACION 00015: REVERT mp_creds_select';
  RAISE NOTICE '============================================';
  RAISE NOTICE '  USING actual: %', v_qual;
  RAISE NOTICE '============================================';

  IF v_qual LIKE '%is_owner%' THEN
    RAISE EXCEPTION 'Migracion 00015 fallo: la policy todavía exige is_owner()';
  END IF;
END $$;

COMMIT;

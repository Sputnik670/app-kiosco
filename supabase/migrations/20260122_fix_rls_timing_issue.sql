-- ============================================================================
-- Fix: RLS Timing Issue for Initial Setup
-- ============================================================================
-- Problema: Las funciones get_my_org_id_v2() y es_owner_v2() están marcadas
-- como STABLE, lo que permite que PostgreSQL cachee sus resultados durante
-- una transacción. Esto causa que cuando create_initial_setup_v2() asigna
-- el rol owner y luego intenta crear la sucursal, las políticas RLS usan
-- el valor cacheado (NULL) en lugar del valor recién insertado.
--
-- Solución: Cambiar las funciones de STABLE a VOLATILE para forzar
-- re-evaluación en cada llamada.
-- ============================================================================

-- Fix: get_my_org_id_v2 - cambiar de STABLE a VOLATILE
CREATE OR REPLACE FUNCTION public.get_my_org_id_v2()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
VOLATILE  -- Cambiado de STABLE a VOLATILE para evitar caching
PARALLEL SAFE
AS $$
  SELECT organization_id
  FROM public.user_organization_roles
  WHERE user_id = auth.uid()
    AND is_active = true
  ORDER BY
    CASE role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'manager' THEN 3 ELSE 4 END,
    created_at ASC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_org_id_v2() IS
'V2: Devuelve el organization_id del usuario actual.
VOLATILE para evitar caching durante initial setup.
Prioriza: owner > admin > manager > employee';

-- Fix: es_owner_v2 - cambiar de STABLE a VOLATILE
CREATE OR REPLACE FUNCTION public.es_owner_v2()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
VOLATILE  -- Cambiado de STABLE a VOLATILE para evitar caching
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_organization_roles
    WHERE user_id = auth.uid()
      AND role = 'owner'
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.es_owner_v2() IS
'V2: Verifica si el usuario actual es owner.
VOLATILE para evitar caching durante initial setup.';

-- Verificación
DO $$
BEGIN
  RAISE NOTICE '✓ get_my_org_id_v2: cambiado a VOLATILE para evitar caching';
  RAISE NOTICE '✓ es_owner_v2: cambiado a VOLATILE para evitar caching';
  RAISE NOTICE '✓ Las políticas RLS ahora re-evaluarán estas funciones en cada INSERT';
END $$;

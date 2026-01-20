-- ===============================================================================
-- PLANETAZEGA - CURRENT DATABASE LOGIC
-- ===============================================================================
--
-- ARCHIVO CONSOLIDADO DE TODAS LAS FUNCIONES RPC EN PRODUCCION
-- Generado: 2026-01-10
--
-- PROPOSITO:
--   Versionar toda la logica critica de base de datos para que sea
--   reproducible y auditable. Este archivo debe mantenerse sincronizado
--   con las funciones en Supabase.
--
-- CONTENIDO:
--   1. Funciones de Seguridad (get_my_org_id, es_dueno)
--   2. Funcion de Onboarding (create_initial_setup)
--   3. Motor de Ventas (procesar_venta, verificar_stock_disponible)
--   4. Gestion de Proveedores (incrementar_saldo_proveedor, descontar_saldo_proveedor)
--   5. Utilidades (calcular_horas_trabajadas, update_updated_at_column)
--
-- ===============================================================================


-- ===============================================================================
-- 1. FUNCIONES DE SEGURIDAD
-- ===============================================================================

-- -----------------------------------------------------------------------------
-- get_my_org_id()
-- Funcion base para RLS multi-tenant
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
PARALLEL SAFE
AS $$
  SELECT organization_id
  FROM public.perfiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_org_id() IS
'Retorna el organization_id del usuario autenticado actual.
Funcion base para todas las politicas RLS multi-tenant.
Uso: WHERE organization_id = get_my_org_id()';

GRANT EXECUTE ON FUNCTION public.get_my_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_org_id() TO anon;


-- -----------------------------------------------------------------------------
-- es_dueno()
-- Verifica si el usuario actual es dueno de su organizacion
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.es_dueno()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT rol = 'dueño' FROM public.perfiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

COMMENT ON FUNCTION public.es_dueno() IS
'Retorna TRUE si el usuario autenticado tiene rol de dueno.
Util para RLS que requiere permisos de administrador.';

GRANT EXECUTE ON FUNCTION public.es_dueno() TO authenticated;


-- ===============================================================================
-- 2. FUNCION DE ONBOARDING
-- ===============================================================================

-- -----------------------------------------------------------------------------
-- create_initial_setup(p_user_id, p_org_name, p_profile_name, p_email)
--
-- Crea organization + perfil + sucursal en una transaccion atomica.
-- Resuelve el problema "Chicken/Egg" de RLS donde:
--   - No puedes crear perfil sin organization_id
--   - No puedes obtener organization_id sin tener perfil
--
-- PARAMETROS (desde organization.repository.ts:54):
--   p_user_id: string (UUID del usuario de Supabase Auth)
--   p_org_name: string (nombre de la organizacion)
--   p_profile_name: string (nombre del perfil)
--   p_email: string (email del usuario)
--
-- RETORNA: JSON con {organization, perfil, sucursal}
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_initial_setup(
  p_user_id UUID,
  p_org_name TEXT,
  p_profile_name TEXT,
  p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
  v_sucursal_id UUID;
  v_org JSONB;
  v_perfil JSONB;
  v_sucursal JSONB;
BEGIN
  -- 1. Crear Organization
  INSERT INTO public.organizations (nombre)
  VALUES (COALESCE(p_org_name, 'Mi Negocio'))
  RETURNING id INTO v_org_id;

  -- 2. Crear Sucursal inicial (Casa Matriz)
  INSERT INTO public.sucursales (organization_id, nombre, direccion)
  VALUES (v_org_id, 'Casa Matriz', NULL)
  RETURNING id INTO v_sucursal_id;

  -- 3. Crear Perfil del Dueno
  INSERT INTO public.perfiles (id, organization_id, sucursal_id, rol, nombre, email)
  VALUES (p_user_id, v_org_id, v_sucursal_id, 'dueño', p_profile_name, p_email);

  -- 4. Construir respuesta JSON
  SELECT jsonb_build_object(
    'id', o.id,
    'nombre', o.nombre,
    'created_at', o.created_at
  ) INTO v_org FROM public.organizations o WHERE o.id = v_org_id;

  SELECT jsonb_build_object(
    'id', p.id,
    'organization_id', p.organization_id,
    'sucursal_id', p.sucursal_id,
    'rol', p.rol,
    'nombre', p.nombre,
    'email', p.email
  ) INTO v_perfil FROM public.perfiles p WHERE p.id = p_user_id;

  SELECT jsonb_build_object(
    'id', s.id,
    'organization_id', s.organization_id,
    'nombre', s.nombre
  ) INTO v_sucursal FROM public.sucursales s WHERE s.id = v_sucursal_id;

  RETURN jsonb_build_object(
    'organization', v_org,
    'perfil', v_perfil,
    'sucursal', v_sucursal
  );
END;
$$;

COMMENT ON FUNCTION public.create_initial_setup(UUID, TEXT, TEXT, TEXT) IS
'Crea el setup inicial completo para un nuevo dueno:
1. Crea la organizacion
2. Crea una sucursal "Casa Matriz"
3. Crea el perfil del dueno vinculado
Resuelve el problema Chicken/Egg de RLS.';

GRANT EXECUTE ON FUNCTION public.create_initial_setup(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_initial_setup(UUID, TEXT, TEXT, TEXT) TO anon;


-- ===============================================================================
-- 3. MOTOR DE VENTAS
-- ===============================================================================

-- -----------------------------------------------------------------------------
-- verificar_stock_disponible(p_producto_id, p_sucursal_id, p_cantidad)
-- Verifica si hay stock suficiente sin bloquearlo
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verificar_stock_disponible(
  p_producto_id UUID,
  p_sucursal_id UUID,
  p_cantidad INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_stock_disponible INTEGER;
BEGIN
  SELECT COALESCE(SUM(cantidad_disponible), 0) INTO v_stock_disponible
  FROM public.stock
  WHERE producto_id = p_producto_id
    AND sucursal_id = p_sucursal_id
    AND estado = 'disponible';

  RETURN v_stock_disponible >= p_cantidad;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verificar_stock_disponible(UUID, UUID, INTEGER) TO authenticated;


-- -----------------------------------------------------------------------------
-- procesar_venta(p_sucursal_id, p_caja_diaria_id, p_items, p_metodo_pago, p_monto_total)
--
-- Motor transaccional de ventas con:
--   - Bloqueo pesimista (FOR UPDATE)
--   - Descuento FIFO por fecha de vencimiento
--   - Registro automatico de movimientos de stock y caja
--
-- PARAMETROS (desde ventas.actions.ts:218):
--   p_sucursal_id: UUID
--   p_caja_diaria_id: UUID
--   p_items: JSONB (array de {producto_id, cantidad})
--   p_metodo_pago_global: TEXT
--   p_monto_total_cliente: NUMERIC
--
-- RETORNA: UUID de la venta creada
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.procesar_venta(
  p_sucursal_id UUID,
  p_caja_diaria_id UUID,
  p_items JSONB,
  p_metodo_pago_global TEXT,
  p_monto_total_cliente NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_organization_id UUID;
  v_vendedor_id UUID;
  v_venta_id UUID;
  v_item JSONB;
  v_producto_id UUID;
  v_cantidad_solicitada INTEGER;
  v_precio_unitario NUMERIC;
  v_subtotal NUMERIC;
  v_producto_nombre TEXT;
  v_stock_disponible INTEGER;
  v_cantidad_restante INTEGER;
  v_stock_record RECORD;
  v_cantidad_a_descontar INTEGER;
  v_monto_total_calculado NUMERIC := 0;
BEGIN
  -- Obtener ID de organizacion y vendedor
  SELECT organization_id, id INTO v_organization_id, v_vendedor_id
  FROM public.perfiles WHERE id = auth.uid() LIMIT 1;

  -- Crear la Venta
  INSERT INTO public.ventas (
    organization_id, sucursal_id, caja_diaria_id, vendedor_id, monto_total, metodo_pago
  ) VALUES (
    v_organization_id, p_sucursal_id, p_caja_diaria_id, v_vendedor_id, p_monto_total_cliente, p_metodo_pago_global
  ) RETURNING id INTO v_venta_id;

  -- Procesar Items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_producto_id := (v_item->>'producto_id')::UUID;
    v_cantidad_solicitada := (v_item->>'cantidad')::INTEGER;

    -- Obtener datos producto
    SELECT precio_venta, nombre INTO v_precio_unitario, v_producto_nombre
    FROM public.productos WHERE id = v_producto_id;

    v_subtotal := v_precio_unitario * v_cantidad_solicitada;
    v_monto_total_calculado := v_monto_total_calculado + v_subtotal;

    -- BLOQUEO PESIMISTA: Validar Stock Global
    SELECT COALESCE(SUM(cantidad_disponible), 0) INTO v_stock_disponible
    FROM public.stock
    WHERE producto_id = v_producto_id AND sucursal_id = p_sucursal_id AND estado = 'disponible'
    FOR UPDATE;

    IF v_stock_disponible < v_cantidad_solicitada THEN
        RAISE EXCEPTION 'Stock insuficiente para %', v_producto_nombre;
    END IF;

    -- Descontar Stock (FIFO por fecha de vencimiento)
    v_cantidad_restante := v_cantidad_solicitada;
    FOR v_stock_record IN
        SELECT id, cantidad_disponible FROM public.stock
        WHERE producto_id = v_producto_id AND sucursal_id = p_sucursal_id AND estado = 'disponible' AND cantidad_disponible > 0
        ORDER BY fecha_vencimiento ASC NULLS LAST
        FOR UPDATE
    LOOP
        EXIT WHEN v_cantidad_restante <= 0;
        v_cantidad_a_descontar := LEAST(v_stock_record.cantidad_disponible, v_cantidad_restante);

        UPDATE public.stock
        SET cantidad_disponible = cantidad_disponible - v_cantidad_a_descontar,
            estado = CASE WHEN (cantidad_disponible - v_cantidad_a_descontar) = 0 THEN 'agotado' ELSE estado END
        WHERE id = v_stock_record.id;

        -- Registrar Movimiento de Stock
        INSERT INTO public.movimientos (
            organization_id, producto_id, sucursal_id, cantidad, tipo_movimiento, estado, referencia_tabla, referencia_id
        ) VALUES (
            v_organization_id, v_producto_id, p_sucursal_id, v_cantidad_a_descontar, 'salida', 'vendido', 'ventas', v_venta_id
        );

        v_cantidad_restante := v_cantidad_restante - v_cantidad_a_descontar;
    END LOOP;

    -- Crear Detalle de Venta
    INSERT INTO public.detalles_venta (
        organization_id, venta_id, producto_id, cantidad, precio_unitario, subtotal
    ) VALUES (
        v_organization_id, v_venta_id, v_producto_id, v_cantidad_solicitada, v_precio_unitario, v_subtotal
    );
  END LOOP;

  -- Registrar Movimiento de Caja (Ingreso)
  INSERT INTO public.movimientos_caja (
    organization_id, caja_diaria_id, tipo, monto, categoria, descripcion
  ) VALUES (
    v_organization_id, p_caja_diaria_id, 'ingreso', p_monto_total_cliente, 'ventas', 'Venta #' || substring(v_venta_id::text, 1, 8)
  );

  RETURN v_venta_id;
END;
$$;

COMMENT ON FUNCTION public.procesar_venta(UUID, UUID, JSONB, TEXT, NUMERIC) IS
'Motor transaccional de ventas.
- Bloqueo pesimista para evitar race conditions
- Descuento FIFO de stock por fecha de vencimiento
- Registro automatico de movimientos de stock y caja';

GRANT EXECUTE ON FUNCTION public.procesar_venta(UUID, UUID, JSONB, TEXT, NUMERIC) TO authenticated;


-- ===============================================================================
-- 4. GESTION DE PROVEEDORES
-- ===============================================================================

-- -----------------------------------------------------------------------------
-- incrementar_saldo_proveedor(id_input, monto_input)
--
-- Incrementa atomicamente el saldo de un proveedor.
-- Evita race conditions al usar incremento relativo.
--
-- PARAMETROS (desde provider.actions.ts:258):
--   id_input: UUID del proveedor
--   monto_input: NUMERIC monto a incrementar (debe ser positivo)
--
-- RETORNA: NUMERIC nuevo saldo
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.incrementar_saldo_proveedor(
  id_input UUID,
  monto_input NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_nuevo_saldo NUMERIC;
BEGIN
  -- Validar monto positivo
  IF monto_input <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser positivo';
  END IF;

  -- Incremento atomico
  UPDATE public.proveedores
  SET saldo_actual = COALESCE(saldo_actual, 0) + monto_input
  WHERE id = id_input
  RETURNING saldo_actual INTO v_nuevo_saldo;

  IF v_nuevo_saldo IS NULL THEN
    RAISE EXCEPTION 'Proveedor no encontrado';
  END IF;

  RETURN v_nuevo_saldo;
END;
$$;

COMMENT ON FUNCTION public.incrementar_saldo_proveedor(UUID, NUMERIC) IS
'Incrementa atomicamente el saldo de un proveedor.
Usado para recargas de billeteras virtuales (SUBE, recargas celular, etc.)';

GRANT EXECUTE ON FUNCTION public.incrementar_saldo_proveedor(UUID, NUMERIC) TO authenticated;


-- -----------------------------------------------------------------------------
-- descontar_saldo_proveedor(id_input, monto_input)
-- Decrementa atomicamente el saldo de un proveedor.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.descontar_saldo_proveedor(
  id_input UUID,
  monto_input NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_saldo_actual NUMERIC;
  v_nuevo_saldo NUMERIC;
BEGIN
  -- Validar monto positivo
  IF monto_input <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser positivo';
  END IF;

  -- Verificar saldo suficiente con bloqueo
  SELECT saldo_actual INTO v_saldo_actual
  FROM public.proveedores
  WHERE id = id_input
  FOR UPDATE;

  IF v_saldo_actual IS NULL THEN
    RAISE EXCEPTION 'Proveedor no encontrado';
  END IF;

  IF COALESCE(v_saldo_actual, 0) < monto_input THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponible: %', COALESCE(v_saldo_actual, 0);
  END IF;

  -- Decremento atomico
  UPDATE public.proveedores
  SET saldo_actual = COALESCE(saldo_actual, 0) - monto_input
  WHERE id = id_input
  RETURNING saldo_actual INTO v_nuevo_saldo;

  RETURN v_nuevo_saldo;
END;
$$;

COMMENT ON FUNCTION public.descontar_saldo_proveedor(UUID, NUMERIC) IS
'Decrementa atomicamente el saldo de un proveedor.
Usado cuando se vende una recarga virtual.';

GRANT EXECUTE ON FUNCTION public.descontar_saldo_proveedor(UUID, NUMERIC) TO authenticated;


-- ===============================================================================
-- 5. UTILIDADES
-- ===============================================================================

-- -----------------------------------------------------------------------------
-- calcular_horas_trabajadas(p_empleado_id, p_fecha_inicio, p_fecha_fin)
-- Calcula las horas trabajadas de un empleado en un rango de fechas
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calcular_horas_trabajadas(
  p_empleado_id UUID,
  p_fecha_inicio TIMESTAMPTZ,
  p_fecha_fin TIMESTAMPTZ
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_total_horas NUMERIC;
BEGIN
  SELECT COALESCE(
    SUM(
      EXTRACT(EPOCH FROM (COALESCE(salida, NOW()) - entrada)) / 3600
    ),
    0
  ) INTO v_total_horas
  FROM public.asistencia
  WHERE empleado_id = p_empleado_id
    AND entrada >= p_fecha_inicio
    AND entrada < p_fecha_fin;

  RETURN ROUND(v_total_horas, 2);
END;
$$;

COMMENT ON FUNCTION public.calcular_horas_trabajadas(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS
'Calcula el total de horas trabajadas por un empleado en un periodo.
Considera turnos sin salida como "aun presente" usando NOW().';

GRANT EXECUTE ON FUNCTION public.calcular_horas_trabajadas(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;


-- -----------------------------------------------------------------------------
-- update_updated_at_column()
-- Trigger para actualizar automaticamente la columna updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_updated_at_column() IS
'Funcion trigger para actualizar automaticamente updated_at en cada UPDATE.
Aplicada a todas las tablas principales via triggers BEFORE UPDATE.';


-- ===============================================================================
-- TRIGGERS DE ACTUALIZACION AUTOMATICA
-- ===============================================================================
-- Estos triggers deben existir en todas las tablas con columna updated_at

-- CREATE TRIGGER update_organizations_updated_at
--   BEFORE UPDATE ON organizations
--   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- CREATE TRIGGER update_perfiles_updated_at
--   BEFORE UPDATE ON perfiles
--   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- CREATE TRIGGER update_sucursales_updated_at
--   BEFORE UPDATE ON sucursales
--   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- CREATE TRIGGER update_productos_updated_at
--   BEFORE UPDATE ON productos
--   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- CREATE TRIGGER update_stock_updated_at
--   BEFORE UPDATE ON stock
--   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- CREATE TRIGGER update_ventas_updated_at
--   BEFORE UPDATE ON ventas
--   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- CREATE TRIGGER update_caja_diaria_updated_at
--   BEFORE UPDATE ON caja_diaria
--   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- CREATE TRIGGER update_movimientos_caja_updated_at
--   BEFORE UPDATE ON movimientos_caja
--   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===============================================================================
-- FIN DEL ARCHIVO
-- ===============================================================================
--
-- NOTAS DE MANTENIMIENTO:
--   1. Al modificar una funcion, actualizar este archivo Y Supabase
--   2. Probar cambios en staging antes de produccion
--   3. Documentar cambios en el historial de git
--
-- FUNCIONES LISTADAS EN SUPABASE (OpenAPI spec):
--   - get_user_organization_id (alias de get_my_org_id)
--   - incrementar_saldo_proveedor
--   - get_my_org_id
--   - create_initial_setup
--   - get_current_user_org_id (alias de get_my_org_id)
--   - calcular_horas_trabajadas
--   - procesar_venta
--   - get_user_email
--   - crear_perfil_desde_auth_user (deprecada?)
--   - descontar_saldo_proveedor
--   - verificar_stock_disponible
--   - es_dueno
--
-- ===============================================================================

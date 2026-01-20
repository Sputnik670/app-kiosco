-- ===============================================================================
-- FIX & SETUP MOTOR DE VENTAS (v1.3.0 - FINAL CLEAN INSTALL)
-- ===============================================================================

-- 1. LIMPIEZA NUCLEAR: Borramos tablas Y la función conflictiva
DROP TABLE IF EXISTS public.detalles_venta CASCADE;
DROP TABLE IF EXISTS public.ventas CASCADE;
DROP TABLE IF EXISTS public.movimientos CASCADE;

-- ESTA ES LA LÍNEA MÁGICA QUE ARREGLA EL ERROR 42P13:
DROP FUNCTION IF EXISTS public.procesar_venta(uuid, uuid, jsonb, text, numeric);

-- 2. CREAR TABLA MOVIMIENTOS (Historial de stock)
CREATE TABLE IF NOT EXISTS public.movimientos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES organizations(id),
    producto_id uuid REFERENCES productos(id),
    sucursal_id uuid REFERENCES sucursales(id),
    cantidad integer NOT NULL,
    tipo_movimiento text NOT NULL, -- 'entrada', 'salida', 'ajuste'
    estado text, -- 'vendido', 'mermado', 'disponible'
    referencia_tabla text, -- 'ventas', 'compras'
    referencia_id uuid,
    created_at timestamptz DEFAULT now()
);

-- 3. CREAR TABLA VENTAS (Esquema Nuevo Correcto en Inglés)
CREATE TABLE public.ventas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    sucursal_id uuid NOT NULL REFERENCES sucursales(id),
    caja_diaria_id uuid NOT NULL REFERENCES caja_diaria(id),
    vendedor_id uuid REFERENCES perfiles(id),
    monto_total numeric(10,2) NOT NULL,
    metodo_pago text NOT NULL,
    estado text NOT NULL DEFAULT 'completada',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. CREAR TABLA DETALLES_VENTA
CREATE TABLE public.detalles_venta (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    venta_id uuid NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id uuid NOT NULL REFERENCES productos(id),
    cantidad integer NOT NULL,
    precio_unitario numeric(10,2) NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. HABILITAR RLS (Seguridad)
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalles_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ventas_all_own" ON ventas USING (organization_id = public.get_my_org_id());
CREATE POLICY "detalles_all_own" ON detalles_venta USING (organization_id = public.get_my_org_id());
CREATE POLICY "movimientos_all_own" ON movimientos USING (organization_id = public.get_my_org_id());

-- 6. FUNCIÓN PROCESAR_VENTA (Motor Transaccional)
CREATE OR REPLACE FUNCTION public.procesar_venta(
  p_sucursal_id uuid,
  p_caja_diaria_id uuid,
  p_items jsonb,
  p_metodo_pago_global text,
  p_monto_total_cliente numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_organization_id uuid;
  v_vendedor_id uuid;
  v_venta_id uuid;
  v_item jsonb;
  v_producto_id uuid;
  v_cantidad_solicitada integer;
  v_precio_unitario numeric;
  v_subtotal numeric;
  v_producto_nombre text;
  v_stock_disponible integer;
  v_cantidad_restante integer;
  v_stock_record record;
  v_cantidad_a_descontar integer;
  v_monto_total_calculado numeric := 0;
BEGIN
  -- Obtener ID de organización y vendedor
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
    v_producto_id := (v_item->>'producto_id')::uuid;
    v_cantidad_solicitada := (v_item->>'cantidad')::integer;

    -- Obtener datos producto
    SELECT precio_venta, nombre INTO v_precio_unitario, v_producto_nombre
    FROM public.productos WHERE id = v_producto_id;

    v_subtotal := v_precio_unitario * v_cantidad_solicitada;
    v_monto_total_calculado := v_monto_total_calculado + v_subtotal;

    -- 🔒 BLOQUEO PESIMISTA: Validar Stock Global
    SELECT COALESCE(SUM(cantidad_disponible), 0) INTO v_stock_disponible
    FROM public.stock
    WHERE producto_id = v_producto_id AND sucursal_id = p_sucursal_id AND estado = 'disponible'
    FOR UPDATE;

    IF v_stock_disponible < v_cantidad_solicitada THEN
        RAISE EXCEPTION 'Stock insuficiente para %', v_producto_nombre;
    END IF;

    -- Descontar Stock (FIFO)
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

        -- Registrar Movimiento
        INSERT INTO public.movimientos (
            organization_id, producto_id, sucursal_id, cantidad, tipo_movimiento, estado, referencia_tabla, referencia_id
        ) VALUES (
            v_organization_id, v_producto_id, p_sucursal_id, v_cantidad_a_descontar, 'salida', 'vendido', 'ventas', v_venta_id
        );

        v_cantidad_restante := v_cantidad_restante - v_cantidad_a_descontar;
    END LOOP;

    -- Crear Detalle
    INSERT INTO public.detalles_venta (
        organization_id, venta_id, producto_id, cantidad, precio_unitario, subtotal
    ) VALUES (
        v_organization_id, v_venta_id, v_producto_id, v_cantidad_solicitada, v_precio_unitario, v_subtotal
    );
  END LOOP;

  -- Registrar Movimiento de Caja (Ingreso) - SIN created_at
  INSERT INTO public.movimientos_caja (
    organization_id, caja_diaria_id, tipo, monto, categoria, descripcion
  ) VALUES (
    v_organization_id, p_caja_diaria_id, 'ingreso', p_monto_total_cliente, 'ventas', 'Venta #' || substring(v_venta_id::text, 1, 8)
  );

  RETURN v_venta_id;
END;
$$;
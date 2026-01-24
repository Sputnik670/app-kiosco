-- ============================================================================
-- Add emoji column to productos table
-- ============================================================================
-- Problema: El código de la aplicación usa la columna 'emoji' en productos
-- para mostrar íconos visuales de los productos, pero la columna no existe
-- en el esquema de la base de datos.
--
-- Error: "Could not find the 'emoji' column of 'productos' in the schema cache"
--
-- Solución: Agregar la columna emoji con un valor por defecto.
-- ============================================================================

-- Agregar columna emoji a la tabla productos
ALTER TABLE public.productos
ADD COLUMN IF NOT EXISTS emoji TEXT DEFAULT '📦';

COMMENT ON COLUMN public.productos.emoji IS
'Emoji visual para identificar rápidamente el producto en la UI.
Por defecto: 📦 (caja de paquete)';

-- Verificación
DO $$
BEGIN
  RAISE NOTICE '✓ Columna emoji agregada a la tabla productos';
  RAISE NOTICE '✓ Valor por defecto: 📦';
END $$;

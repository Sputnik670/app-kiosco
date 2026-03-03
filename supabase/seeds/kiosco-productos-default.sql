-- ============================================================================
-- SEED: Catálogo default de productos típicos de kiosco argentino
-- ============================================================================
-- ~130 productos organizados por categoría
-- Uso: Se invoca durante onboarding de un nuevo cliente
-- Los precios son orientativos (ARS marzo 2026) y el dueño los ajusta
--
-- IMPORTANTE: Este script requiere que ya exista una organización.
-- Reemplazar ':org_id' con el UUID de la organización destino.
-- ============================================================================

-- Función helper para insertar productos de seed en una organización
CREATE OR REPLACE FUNCTION seed_default_products(target_org_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN

-- ── BEBIDAS SIN ALCOHOL ─────────────────────────────────────────────────────
INSERT INTO products (organization_id, name, sale_price, cost, category, emoji, barcode, min_stock) VALUES
  (target_org_id, 'Coca-Cola 500ml',            1200,  750, 'Bebidas', '🥤', '7790895000638', 10),
  (target_org_id, 'Coca-Cola 1.5L',             2200, 1400, 'Bebidas', '🥤', '7790895001338', 8),
  (target_org_id, 'Coca-Cola 2.25L',            2800, 1800, 'Bebidas', '🥤', '7790895002250', 6),
  (target_org_id, 'Coca-Cola Zero 500ml',       1200,  750, 'Bebidas', '🥤', '7790895006005', 8),
  (target_org_id, 'Sprite 500ml',               1200,  750, 'Bebidas', '🥤', '7790895050008', 8),
  (target_org_id, 'Fanta 500ml',                1200,  750, 'Bebidas', '🥤', '7790895060007', 8),
  (target_org_id, 'Pepsi 500ml',                1100,  700, 'Bebidas', '🥤', '7791813420507', 8),
  (target_org_id, 'Agua Mineral Villavicencio 500ml', 900, 500, 'Bebidas', '💧', '7792799000509', 15),
  (target_org_id, 'Agua Mineral c/gas 500ml',    900,  500, 'Bebidas', '💧', '7792799001509', 10),
  (target_org_id, 'Agua saborizada Levité 500ml',1000, 600, 'Bebidas', '💧', '7790895070006', 8),
  (target_org_id, 'Powerade 500ml',             1400,  900, 'Bebidas', '🏃', '7790895080005', 6),
  (target_org_id, 'Gatorade 500ml',             1500,  950, 'Bebidas', '🏃', '7792170110501', 6),
  (target_org_id, 'Speed Max 250ml',            1300,  800, 'Bebidas', '⚡', '7790895090004', 8),
  (target_org_id, 'Red Bull 250ml',             2500, 1700, 'Bebidas', '⚡', '9002490100070', 5),
  (target_org_id, 'Jugo Cepita 1L',             1800, 1100, 'Bebidas', '🧃', '7790895040009', 6),
  (target_org_id, 'Jugo BC La Campagnola 1L',   1600, 1000, 'Bebidas', '🧃', '7790580120010', 6),
  (target_org_id, 'Mate cocido Taragüí x20',     800,  450, 'Bebidas', '🧉', '7790387010206', 10),
  (target_org_id, 'Café instantáneo Nescafé 50g',2000, 1300, 'Bebidas', '☕', '7613033526510', 5)
ON CONFLICT DO NOTHING;
GET DIAGNOSTICS inserted_count = ROW_COUNT;

-- ── CERVEZAS Y ALCOHOL ──────────────────────────────────────────────────────
INSERT INTO products (organization_id, name, sale_price, cost, category, emoji, min_stock) VALUES
  (target_org_id, 'Cerveza Quilmes 1L',         2200, 1400, 'Bebidas Alcohólicas', '🍺', 10),
  (target_org_id, 'Cerveza Brahma 1L',          2000, 1250, 'Bebidas Alcohólicas', '🍺', 8),
  (target_org_id, 'Cerveza Stella Artois 1L',   2500, 1600, 'Bebidas Alcohólicas', '🍺', 6),
  (target_org_id, 'Cerveza Andes 1L',           2100, 1350, 'Bebidas Alcohólicas', '🍺', 6),
  (target_org_id, 'Cerveza Corona 710ml',       2800, 1800, 'Bebidas Alcohólicas', '🍺', 5),
  (target_org_id, 'Cerveza Patagonia 730ml',    3000, 2000, 'Bebidas Alcohólicas', '🍺', 4),
  (target_org_id, 'Cerveza Quilmes Lata 473ml', 1500,  950, 'Bebidas Alcohólicas', '🍺', 12),
  (target_org_id, 'Fernet Branca 750ml',        8500, 5500, 'Bebidas Alcohólicas', '🥃', 5),
  (target_org_id, 'Fernet Branca 450ml',        5500, 3500, 'Bebidas Alcohólicas', '🥃', 5),
  (target_org_id, 'Fernet 1882 750ml',          6500, 4200, 'Bebidas Alcohólicas', '🥃', 4),
  (target_org_id, 'Gancia 950ml',               4000, 2500, 'Bebidas Alcohólicas', '🍷', 3),
  (target_org_id, 'Vino tinto brik 1L',         2500, 1500, 'Bebidas Alcohólicas', '🍷', 5),
  (target_org_id, 'Vodka Smirnoff 700ml',       7000, 4500, 'Bebidas Alcohólicas', '🍸', 3),
  (target_org_id, 'Aperol 750ml',               9000, 6000, 'Bebidas Alcohólicas', '🍹', 2)
ON CONFLICT DO NOTHING;

-- ── CIGARRILLOS ─────────────────────────────────────────────────────────────
INSERT INTO products (organization_id, name, sale_price, cost, category, emoji, min_stock) VALUES
  (target_org_id, 'Marlboro Box 20',            3500, 2800, 'Cigarrillos', '🚬', 15),
  (target_org_id, 'Marlboro Gold Box 20',       3500, 2800, 'Cigarrillos', '🚬', 10),
  (target_org_id, 'Camel Box 20',               3200, 2600, 'Cigarrillos', '🚬', 8),
  (target_org_id, 'Lucky Strike Box 20',        3000, 2400, 'Cigarrillos', '🚬', 8),
  (target_org_id, 'Philip Morris Box 20',       2800, 2200, 'Cigarrillos', '🚬', 8),
  (target_org_id, 'Chesterfield Box 20',        2600, 2100, 'Cigarrillos', '🚬', 8),
  (target_org_id, 'Jockey Club Suave 20',       2200, 1800, 'Cigarrillos', '🚬', 10),
  (target_org_id, 'Red Point 20',               2000, 1600, 'Cigarrillos', '🚬', 10),
  (target_org_id, 'Encendedor BIC',              800,  400, 'Cigarrillos', '🔥', 20),
  (target_org_id, 'Papel para armar',            600,  350, 'Cigarrillos', '📜', 10)
ON CONFLICT DO NOTHING;

-- ── GOLOSINAS Y ALFAJORES ───────────────────────────────────────────────────
INSERT INTO products (organization_id, name, sale_price, cost, category, emoji, min_stock) VALUES
  (target_org_id, 'Alfajor Havanna',            1800, 1100, 'Golosinas', '🍫', 10),
  (target_org_id, 'Alfajor Cachafaz Triple',    1200,  750, 'Golosinas', '🍫', 10),
  (target_org_id, 'Alfajor Jorgito Negro',       800,  480, 'Golosinas', '🍫', 15),
  (target_org_id, 'Alfajor Jorgelin',            700,  420, 'Golosinas', '🍫', 15),
  (target_org_id, 'Alfajor Terrabusi Triple',   1000,  600, 'Golosinas', '🍫', 12),
  (target_org_id, 'Alfajor Capitán del Espacio',  600, 350, 'Golosinas', '🍫', 15),
  (target_org_id, 'Alfajor Guaymallén Triple',    400, 220, 'Golosinas', '🍫', 20),
  (target_org_id, 'Alfajor Tatín',                500, 280, 'Golosinas', '🍫', 15),
  (target_org_id, 'Chicle Beldent x3',            500, 300, 'Golosinas', '🫧', 15),
  (target_org_id, 'Chicle Topline x8',            700, 420, 'Golosinas', '🫧', 10),
  (target_org_id, 'Caramelos Flynn Paff x10',     300, 170, 'Golosinas', '🍬', 15),
  (target_org_id, 'Caramelos Media Hora',          300, 170, 'Golosinas', '🍬', 10),
  (target_org_id, 'Chocolate Milka 100g',        1500,  950, 'Golosinas', '🍫', 8),
  (target_org_id, 'Chocolate Cofler 100g',       1200,  750, 'Golosinas', '🍫', 8),
  (target_org_id, 'Bon o Bon x1',                 400, 220, 'Golosinas', '🍬', 15),
  (target_org_id, 'Rhodesia x1',                  350, 200, 'Golosinas', '🍫', 15),
  (target_org_id, 'Mogul gomitas 80g',             800, 480, 'Golosinas', '🍬', 10),
  (target_org_id, 'Sugus x8',                     500, 300, 'Golosinas', '🍬', 10)
ON CONFLICT DO NOTHING;

-- ── SNACKS ──────────────────────────────────────────────────────────────────
INSERT INTO products (organization_id, name, sale_price, cost, category, emoji, min_stock) VALUES
  (target_org_id, 'Papas Lays Clásicas 150g',   2000, 1250, 'Snacks', '🥔', 8),
  (target_org_id, 'Papas Lays Clásicas 75g',    1200,  750, 'Snacks', '🥔', 10),
  (target_org_id, 'Doritos 150g',                2000, 1250, 'Snacks', '🌮', 6),
  (target_org_id, 'Cheetos 120g',                1500,  900, 'Snacks', '🧀', 6),
  (target_org_id, 'Palitos salados 200g',         900,  550, 'Snacks', '🥨', 8),
  (target_org_id, 'Maní con cáscara 200g',       1000,  600, 'Snacks', '🥜', 8),
  (target_org_id, 'Maní tostado pelado 200g',    1200,  750, 'Snacks', '🥜', 6),
  (target_org_id, 'Papas Día tubo 150g',         1000,  600, 'Snacks', '🥔', 8),
  (target_org_id, 'Conitos 3D 80g',              1000,  600, 'Snacks', '🔺', 8),
  (target_org_id, 'Chizitos 120g',                900,  550, 'Snacks', '🧀', 8)
ON CONFLICT DO NOTHING;

-- ── GALLETITAS ──────────────────────────────────────────────────────────────
INSERT INTO products (organization_id, name, sale_price, cost, category, emoji, min_stock) VALUES
  (target_org_id, 'Galletitas Oreo x117g',      1200,  750, 'Galletitas', '🍪', 8),
  (target_org_id, 'Galletitas Toddy 126g',      1000,  600, 'Galletitas', '🍪', 8),
  (target_org_id, 'Galletitas Terrabusi Variedad 400g', 2000, 1250, 'Galletitas', '🍪', 6),
  (target_org_id, 'Galletitas Criollitas 300g',  1200,  750, 'Galletitas', '🍪', 8),
  (target_org_id, 'Galletitas Express 300g',     1000,  600, 'Galletitas', '🍪', 8),
  (target_org_id, 'Galletitas Rumba 112g',        800,  480, 'Galletitas', '🍪', 8),
  (target_org_id, 'Galletitas Pepitos 119g',     1100,  680, 'Galletitas', '🍪', 8),
  (target_org_id, 'Obleas Terrabusi x100g',       900,  550, 'Galletitas', '🍪', 6)
ON CONFLICT DO NOTHING;

-- ── LÁCTEOS ─────────────────────────────────────────────────────────────────
INSERT INTO products (organization_id, name, sale_price, cost, category, emoji, min_stock) VALUES
  (target_org_id, 'Leche La Serenísima 1L',     1800, 1200, 'Lácteos', '🥛', 10),
  (target_org_id, 'Yogur Ser bebible 200g',       800,  480, 'Lácteos', '🥛', 8),
  (target_org_id, 'Yogur La Serenísima 200g',     700,  420, 'Lácteos', '🥛', 8),
  (target_org_id, 'Queso crema Casancrem 300g', 2200, 1400, 'Lácteos', '🧀', 5),
  (target_org_id, 'Dulce de leche La Serenísima 400g', 2500, 1600, 'Lácteos', '🤎', 5),
  (target_org_id, 'Manteca La Serenísima 200g', 2000, 1300, 'Lácteos', '🧈', 5),
  (target_org_id, 'Queso rallado 150g',         1500,  950, 'Lácteos', '🧀', 5),
  (target_org_id, 'Postre Serenito 100g',        600,  350, 'Lácteos', '🍮', 8)
ON CONFLICT DO NOTHING;

-- ── PANADERÍA Y FIAMBRES ────────────────────────────────────────────────────
INSERT INTO products (organization_id, name, sale_price, cost, category, emoji, min_stock) VALUES
  (target_org_id, 'Pan lactal Bimbo 350g',      1800, 1100, 'Panadería', '🍞', 8),
  (target_org_id, 'Pan lactal Fargo 400g',      1600, 1000, 'Panadería', '🍞', 8),
  (target_org_id, 'Tostadas Light 200g',        1200,  750, 'Panadería', '🍞', 6),
  (target_org_id, 'Facturas (unidad)',            500,  300, 'Panadería', '🥐', 20),
  (target_org_id, 'Medialunas (unidad)',          400,  230, 'Panadería', '🥐', 20),
  (target_org_id, 'Jamón cocido 200g',           2000, 1300, 'Fiambres', '🥩', 5),
  (target_org_id, 'Queso cremoso 200g',          1800, 1100, 'Fiambres', '🧀', 5),
  (target_org_id, 'Salame 200g',                 2200, 1400, 'Fiambres', '🥩', 4)
ON CONFLICT DO NOTHING;

-- ── ALMACÉN / DESPENSA ──────────────────────────────────────────────────────
INSERT INTO products (organization_id, name, sale_price, cost, category, emoji, min_stock) VALUES
  (target_org_id, 'Yerba Taragüí 500g',         2500, 1600, 'Almacén', '🧉', 10),
  (target_org_id, 'Yerba Playadito 500g',        2200, 1400, 'Almacén', '🧉', 8),
  (target_org_id, 'Azúcar Ledesma 1kg',         1200,  750, 'Almacén', '🍚', 8),
  (target_org_id, 'Aceite Cocinero 900ml',       2200, 1400, 'Almacén', '🫒', 5),
  (target_org_id, 'Fideos Matarazzo 500g',       1000,  600, 'Almacén', '🍝', 8),
  (target_org_id, 'Arroz Gallo 1kg',             1500,  950, 'Almacén', '🍚', 6),
  (target_org_id, 'Sal fina Celusal 500g',        500,  280, 'Almacén', '🧂', 5),
  (target_org_id, 'Mayonesa Hellmanns 237g',     1800, 1100, 'Almacén', '🥫', 6),
  (target_org_id, 'Ketchup Heinz 397g',          2000, 1250, 'Almacén', '🍅', 4),
  (target_org_id, 'Mermelada BC 454g',           1500,  950, 'Almacén', '🍓', 5),
  (target_org_id, 'Harina 000 1kg',               800,  480, 'Almacén', '🌾', 5),
  (target_org_id, 'Atún La Campagnola 170g',     1500,  950, 'Almacén', '🐟', 6)
ON CONFLICT DO NOTHING;

-- ── LIMPIEZA / HIGIENE ──────────────────────────────────────────────────────
INSERT INTO products (organization_id, name, sale_price, cost, category, emoji, min_stock) VALUES
  (target_org_id, 'Papel higiénico x4',         2000, 1300, 'Limpieza', '🧻', 8),
  (target_org_id, 'Servilletas x100',             800,  480, 'Limpieza', '🧻', 8),
  (target_org_id, 'Jabón Rexona 125g',            700,  420, 'Limpieza', '🧼', 6),
  (target_org_id, 'Desodorante Rexona 150ml',   2500, 1600, 'Limpieza', '🧴', 4),
  (target_org_id, 'Shampoo Sedal 340ml',         2800, 1800, 'Limpieza', '🧴', 4),
  (target_org_id, 'Lavandina Ayudín 1L',          800,  480, 'Limpieza', '🧹', 5),
  (target_org_id, 'Detergente Magistral 500ml',  1500,  950, 'Limpieza', '🧹', 5),
  (target_org_id, 'Bolsas residuos x10',          600,  350, 'Limpieza', '🗑️', 6)
ON CONFLICT DO NOTHING;

-- ── HELADOS / CONGELADOS ────────────────────────────────────────────────────
INSERT INTO products (organization_id, name, sale_price, cost, category, emoji, min_stock) VALUES
  (target_org_id, 'Helado palito Frigor',        1200,  750, 'Helados', '🍦', 10),
  (target_org_id, 'Bombón helado Cofler',        1500,  950, 'Helados', '🍦', 8),
  (target_org_id, 'Helado Pote Frigor 1L',       5000, 3200, 'Helados', '🍨', 4),
  (target_org_id, 'Hamburguesas Paty x4',        3500, 2200, 'Congelados', '🍔', 5),
  (target_org_id, 'Empanadas congeladas x6',     3000, 1900, 'Congelados', '🥟', 5)
ON CONFLICT DO NOTHING;

-- ── SERVICIOS (Recargas) ────────────────────────────────────────────────────
INSERT INTO products (organization_id, name, sale_price, cost, category, emoji, min_stock, is_service) VALUES
  (target_org_id, 'Recarga SUBE',                   0,    0, 'Servicios', '🚌', 0, true),
  (target_org_id, 'Recarga Claro',                   0,    0, 'Servicios', '📱', 0, true),
  (target_org_id, 'Recarga Personal',                0,    0, 'Servicios', '📱', 0, true),
  (target_org_id, 'Recarga Movistar',                0,    0, 'Servicios', '📱', 0, true),
  (target_org_id, 'Recarga DirecTV',                 0,    0, 'Servicios', '📺', 0, true)
ON CONFLICT DO NOTHING;

-- ── VARIOS / BAZAR ──────────────────────────────────────────────────────────
INSERT INTO products (organization_id, name, sale_price, cost, category, emoji, min_stock) VALUES
  (target_org_id, 'Pilas AA x2',                 1200,  750, 'Varios', '🔋', 8),
  (target_org_id, 'Pilas AAA x2',                1200,  750, 'Varios', '🔋', 6),
  (target_org_id, 'Cinta adhesiva',               500,  280, 'Varios', '📎', 5),
  (target_org_id, 'Bolsa de hielo 2kg',          1000,  600, 'Varios', '🧊', 10),
  (target_org_id, 'Carbón 3kg',                  2500, 1500, 'Varios', '🔥', 5),
  (target_org_id, 'Preservativos x3',            1500,  900, 'Varios', '💊', 6),
  (target_org_id, 'Fósforos x1',                   200, 100, 'Varios', '🔥', 15),
  (target_org_id, 'Sorbetes x10',                  300, 150, 'Varios', '🥤', 10),
  (target_org_id, 'Vasos descartables x10',        500, 280, 'Varios', '🥤', 8)
ON CONFLICT DO NOTHING;

RETURN inserted_count;
END;
$$;

COMMENT ON FUNCTION seed_default_products(UUID) IS
  'Carga catálogo default de ~130 productos típicos de kiosco argentino para una organización nueva.';

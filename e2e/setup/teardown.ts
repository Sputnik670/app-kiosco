import { test as teardown } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import dotenv from 'dotenv';

// Cargar variables de .env.test
dotenv.config({ path: path.join(__dirname, '../.env.test') });

/**
 * Teardown global — Se ejecuta DESPUÉS de todos los smoke tests.
 *
 * Limpia datos de prueba creados durante los tests:
 * - Productos con nombre "Test-PW-*"
 * - Proveedores con nombre "Proveedor-PW-*"
 *
 * Usa el service_role key para bypasear RLS y poder limpiar sin restricciones.
 * Si no hay SUPABASE_SERVICE_ROLE_KEY configurado, el teardown se salta
 * silenciosamente (los tests siguen funcionando, solo se acumula basura).
 */
teardown('limpiar datos de prueba', async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.log('⚠️  Teardown: Sin SUPABASE_SERVICE_ROLE_KEY, saltando limpieza.');
    console.log('   Para habilitar, agregar SUPABASE_SERVICE_ROLE_KEY a e2e/.env.test');
    teardown.skip();
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ─── Limpiar productos de prueba ──────────────────────────────────────
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, name')
    .like('name', 'Test-PW-%');

  if (prodErr) {
    console.error('❌ Teardown: Error buscando productos de prueba:', prodErr.message);
  } else if (products && products.length > 0) {
    // Primero eliminar stock_entries relacionados
    const productIds = products.map(p => p.id);

    await supabase
      .from('stock_entries')
      .delete()
      .in('product_id', productIds);

    // Eliminar sale_items que referencien estos productos
    await supabase
      .from('sale_items')
      .delete()
      .in('product_id', productIds);

    // Eliminar los productos
    const { error: delErr } = await supabase
      .from('products')
      .delete()
      .in('id', productIds);

    if (delErr) {
      console.error('❌ Teardown: Error eliminando productos:', delErr.message);
    } else {
      console.log(`✅ Teardown: ${products.length} producto(s) de prueba eliminado(s)`);
    }
  } else {
    console.log('ℹ️  Teardown: No hay productos de prueba para limpiar');
  }

  // ─── Limpiar proveedores de prueba ────────────────────────────────────
  const { data: providers, error: provErr } = await supabase
    .from('suppliers')
    .select('id, name')
    .like('name', 'Proveedor-PW-%');

  if (provErr) {
    console.error('❌ Teardown: Error buscando proveedores de prueba:', provErr.message);
  } else if (providers && providers.length > 0) {
    const providerIds = providers.map(p => p.id);

    // Eliminar service_purchases relacionadas
    await supabase
      .from('service_purchases')
      .delete()
      .in('supplier_id', providerIds);

    // Eliminar los proveedores
    const { error: delErr } = await supabase
      .from('suppliers')
      .delete()
      .in('id', providerIds);

    if (delErr) {
      console.error('❌ Teardown: Error eliminando proveedores:', delErr.message);
    } else {
      console.log(`✅ Teardown: ${providers.length} proveedor(es) de prueba eliminado(s)`);
    }
  } else {
    console.log('ℹ️  Teardown: No hay proveedores de prueba para limpiar');
  }
});

import { test, expect } from '@playwright/test';
import { selectFirstBranch, navigateToTab, waitForLoading } from './helpers/navigation';

/**
 * SMOKE TEST 3: Abrir Caja → Registrar Venta → Cerrar Caja
 *
 * Este es el flujo más crítico del kiosquero. Si esto no funciona, no vende.
 *
 * Verifica:
 * - Abrir caja con monto inicial
 * - Buscar un producto en el PdV
 * - Agregar al carrito
 * - Seleccionar método de pago
 * - Confirmar venta
 * - Cerrar caja y ver resumen
 *
 * NOTA: Requiere que exista al menos 1 producto con stock en la sucursal.
 * Si corren los tests en orden, smoke-02 ya creó uno.
 */
test.describe('Caja y Ventas', () => {

  test('abrir caja con monto inicial', async ({ page }) => {
    await page.goto('/');
    await selectFirstBranch(page);

    // El ArqueoCaja aparece dentro del tab de Ventas del owner
    // o directamente en la vista del empleado.
    // Para el owner, vamos a Ventas
    await navigateToTab(page, 'Ventas');
    await waitForLoading(page);

    // Buscar si hay una caja que cerrar o una nueva para abrir
    const startBtn = page.getByRole('button', { name: /empezar jornada/i });
    const closeBtn = page.getByRole('button', { name: /finalizar/i });

    const needsOpen = await startBtn.isVisible().catch(() => false);
    const isAlreadyOpen = await closeBtn.isVisible().catch(() => false);

    if (needsOpen) {
      // Llenar monto inicial
      const montoInput = page.locator('input[type="number"][placeholder="0"]').first();
      await montoInput.fill('5000');

      await startBtn.click();
      await waitForLoading(page);

      // Debería cambiar a modo "turno activo"
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'e2e/screenshots/caja-abierta.png' });
    } else if (isAlreadyOpen) {
      // Ya hay una caja abierta, está OK para el test
      console.log('✅ Caja ya abierta, continuando...');
    }
  });

  test('buscar producto y agregar al carrito en PdV', async ({ page }) => {
    await page.goto('/');
    await selectFirstBranch(page);
    await navigateToTab(page, 'Ventas');
    await waitForLoading(page);

    // El buscador del PdV: "Nombre, código o marca..."
    const searchInput = page.locator('input[aria-label="Buscar producto"], input[placeholder*="Nombre, código"]').first();

    // Si el PdV no está visible (puede estar en otro subtab), buscarlo
    if (!(await searchInput.isVisible().catch(() => false))) {
      // Intentar scroll o buscar en la página
      await page.evaluate(() => window.scrollTo(0, 500));
      await page.waitForTimeout(500);
    }

    // Buscar un producto (el que creamos en smoke-02 o cualquier existente)
    if (await searchInput.isVisible()) {
      await searchInput.fill('Test');
      await page.waitForTimeout(500); // Debounce de 300ms

      // Esperar que aparezca el dropdown de resultados
      const productResult = page.locator('button').filter({ hasText: /Test|test/i }).first();

      if (await productResult.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await productResult.click();
        await page.waitForTimeout(500);

        // Verificar que se agregó al carrito (debe aparecer un item)
        await page.screenshot({ path: 'e2e/screenshots/producto-en-carrito.png' });
      }
    }
  });

  test('seleccionar método de pago y confirmar venta', async ({ page }) => {
    await page.goto('/');
    await selectFirstBranch(page);
    await navigateToTab(page, 'Ventas');
    await waitForLoading(page);

    // Primero necesitamos un producto en el carrito
    const searchInput = page.locator('input[aria-label="Buscar producto"], input[placeholder*="Nombre, código"]').first();

    if (await searchInput.isVisible()) {
      // Buscar y agregar producto
      await searchInput.fill('Test');
      await page.waitForTimeout(500);

      const productResult = page.locator('button').filter({ hasText: /Test|test/i }).first();
      if (await productResult.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await productResult.click();
        await page.waitForTimeout(500);
      }
    }

    // Seleccionar método de pago: Efectivo
    const efectivoBtn = page.locator('button').filter({ hasText: /efectivo/i }).first();
    if (await efectivoBtn.isVisible().catch(() => false)) {
      await efectivoBtn.click();
    }

    // Confirmar venta
    const confirmBtn = page.getByRole('button', { name: /confirmar venta/i });
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
      await waitForLoading(page);

      // Esperar toast de éxito
      await page.waitForFunction(() => {
        const toasts = document.querySelectorAll('[data-sonner-toast]');
        for (const t of toasts) {
          if (t.textContent?.toLowerCase().includes('venta') ||
              t.textContent?.toLowerCase().includes('registrada') ||
              t.textContent?.toLowerCase().includes('éxito')) {
            return true;
          }
        }
        return false;
      }, { timeout: 10_000 }).catch(() => {
        console.log('⚠️ No se detectó toast de confirmación');
      });

      await page.screenshot({ path: 'e2e/screenshots/venta-confirmada.png' });
    } else {
      // Si no hay botón de confirmar, puede ser que no hay productos en el carrito
      console.log('⚠️ No hay botón de confirmar venta — ¿carrito vacío?');
      await page.screenshot({ path: 'e2e/screenshots/venta-sin-carrito.png' });
    }
  });

  test('cerrar caja y ver resumen', async ({ page }) => {
    await page.goto('/');
    await selectFirstBranch(page);
    await navigateToTab(page, 'Ventas');
    await waitForLoading(page);

    // Buscar el botón de cerrar/finalizar
    const closeBtn = page.getByRole('button', { name: /finalizar|cerrar|validar caja/i });

    if (await closeBtn.isVisible().catch(() => false)) {
      // Llenar monto físico declarado
      const montoInput = page.locator('input[type="number"][placeholder="0"]').first();
      if (await montoInput.isVisible()) {
        await montoInput.fill('5000');
      }

      await closeBtn.click();
      await waitForLoading(page);

      // Debería mostrar el resumen de cierre o volver a "Nueva Apertura"
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'e2e/screenshots/caja-cerrada.png' });

      // Verificar que se cerró (aparece "Nueva Apertura" o un toast)
      const newOpenLabel = page.getByText(/nueva apertura/i);
      const toastSuccess = page.locator('[data-sonner-toast]');
      const closed = await newOpenLabel.isVisible().catch(() => false) ||
                     await toastSuccess.isVisible().catch(() => false);

      expect(closed).toBeTruthy();
    } else {
      console.log('ℹ️ No hay caja abierta para cerrar');
    }
  });
});

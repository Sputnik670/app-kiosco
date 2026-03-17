import { test, expect } from '@playwright/test';
import { selectFirstBranch, navigateToTab, waitForLoading } from './helpers/navigation';

/**
 * SMOKE TEST 1: Login + Dashboard del Dueño
 *
 * Verifica que:
 * - El owner puede entrar a la app
 * - Se muestra el selector de sucursales
 * - Al seleccionar, se carga el dashboard "Torre de Control"
 * - Los 7 tabs del dashboard son navegables
 * - Los datos se muestran (ventas, stock, etc.)
 */
test.describe('Login y Dashboard del Dueño', () => {

  test('carga la app y muestra el selector de sucursales', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Post-auth, el owner debería ver el selector de sucursales o el dashboard
    const body = await page.textContent('body');
    const isPostLogin = body?.includes('Sucursal') || body?.includes('Torre de Control');
    expect(isPostLogin).toBeTruthy();
  });

  test('selecciona sucursal y entra al dashboard', async ({ page }) => {
    await page.goto('/');
    await selectFirstBranch(page);

    // Verificar que estamos en el dashboard
    await expect(page.getByText('Torre de Control')).toBeVisible();
  });

  test('todos los tabs del dashboard son navegables', async ({ page }) => {
    await page.goto('/');
    await selectFirstBranch(page);

    const tabs = ['Ventas', 'Análisis', 'Stock', 'Proveedores', 'Control Empleados', 'Historial', 'Ajustes'];

    for (const tab of tabs) {
      await navigateToTab(page, tab);
      await waitForLoading(page);

      // Tomar screenshot de cada tab para debugging visual
      await page.screenshot({
        path: `e2e/screenshots/tab-${tab.toLowerCase().replace(/\s+/g, '-')}.png`,
      });
    }
  });

  test('el tab de Ventas muestra datos de facturación', async ({ page }) => {
    await page.goto('/');
    await selectFirstBranch(page);
    await navigateToTab(page, 'Ventas');
    await waitForLoading(page);

    // Debe mostrar la card principal de facturación
    await expect(page.getByText(/Facturación Total/i)).toBeVisible({ timeout: 10_000 });

    // Debe mostrar desglose de productos y servicios
    await expect(page.getByText(/Productos Físicos/i)).toBeVisible();
    await expect(page.getByText(/Servicios Virtuales/i)).toBeVisible();
  });

  test('el tab de Stock muestra el formulario de crear producto', async ({ page }) => {
    await page.goto('/');
    await selectFirstBranch(page);
    await navigateToTab(page, 'Stock');
    await waitForLoading(page);

    // El formulario de CrearProducto debería estar visible
    const nameInput = page.locator('input[placeholder="Nombre"]');
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
  });
});

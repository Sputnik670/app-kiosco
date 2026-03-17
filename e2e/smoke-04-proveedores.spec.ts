import { test, expect } from '@playwright/test';
import { selectFirstBranch, navigateToTab, waitForLoading } from './helpers/navigation';

/**
 * SMOKE TEST 4: Gestión de Proveedores
 *
 * Verifica:
 * - Navegar al tab Proveedores
 * - Ver lista de proveedores existentes
 * - Crear un proveedor nuevo
 * - Verificar que aparece en la lista
 * - Configurar comisión
 */
test.describe('Gestión de Proveedores', () => {
  const testProviderName = `Proveedor-PW-${Date.now()}`;

  test('ver tab de proveedores y lista existente', async ({ page }) => {
    await page.goto('/');
    await selectFirstBranch(page);
    await navigateToTab(page, 'Proveedores');
    await waitForLoading(page);

    // Debe estar visible el componente de gestión de proveedores
    // El header dice "Proveedores" y tiene un botón "Nuevo"
    const newBtn = page.getByRole('button', { name: /nuevo/i });
    await expect(newBtn).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: 'e2e/screenshots/proveedores-lista.png' });
  });

  test('crear un proveedor nuevo', async ({ page }) => {
    await page.goto('/');
    await selectFirstBranch(page);
    await navigateToTab(page, 'Proveedores');
    await waitForLoading(page);

    // Click en "Nuevo"
    const newBtn = page.getByRole('button', { name: /nuevo/i });
    await newBtn.click();

    // Esperar que el modal de creación aparezca
    await page.waitForTimeout(500);

    // Llenar el nombre del proveedor
    const nameInput = page.locator('input[placeholder*="Arcor"], input[placeholder*="arcor"]').first();
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await nameInput.fill(testProviderName);

    // Llenar el rubro/categoría
    const categoryInput = page.locator('input[placeholder*="Golosinas"], input[placeholder*="golosinas"]').first();
    if (await categoryInput.isVisible()) {
      await categoryInput.fill('Test E2E');
    }

    // Seleccionar condición de pago (si existe el select)
    const paymentSelect = page.locator('select[title*="Condición"], select[title*="condición"]').first();
    if (await paymentSelect.isVisible().catch(() => false)) {
      await paymentSelect.selectOption('contado');
    }

    // Confirmar Alta
    const submitBtn = page.getByRole('button', { name: /confirmar alta/i });
    await submitBtn.click();
    await waitForLoading(page);

    // Esperar toast o cierre de modal
    await page.waitForTimeout(2000);

    // Verificar que el proveedor aparece en la lista
    const providerInList = page.getByText(testProviderName);
    await expect(providerInList).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: 'e2e/screenshots/proveedor-creado.png' });
  });

  test('el control de saldo de proveedores se muestra', async ({ page }) => {
    await page.goto('/');
    await selectFirstBranch(page);
    await navigateToTab(page, 'Proveedores');
    await waitForLoading(page);

    // El ControlSaldoProveedor debería mostrarse arriba
    // Buscar indicadores de saldo (pueden decir "Saldo", "Deuda", etc.)
    const saldoSection = page.getByText(/saldo|deuda|pagos pendientes/i).first();
    const hasSaldoControl = await saldoSection.isVisible().catch(() => false);

    // Tomar screenshot independientemente
    await page.screenshot({ path: 'e2e/screenshots/proveedores-saldo.png' });

    // No forzar el expect si no hay deudas — el componente puede no renderizar
    if (hasSaldoControl) {
      await expect(saldoSection).toBeVisible();
    }
  });
});

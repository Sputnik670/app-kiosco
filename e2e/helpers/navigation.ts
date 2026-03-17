import { Page, expect } from '@playwright/test';

/**
 * Helpers de navegación para App Kiosco.
 * El flujo post-login es: SeleccionarSucursal → Dashboard (owner) o VistaEmpleado (empleado).
 */

/** Selecciona la primera sucursal disponible y entra al dashboard */
export async function selectFirstBranch(page: Page) {
  // Esperar a que aparezca el selector de sucursales o ya estemos en el dashboard
  await page.waitForFunction(() => {
    const body = document.body.textContent || '';
    return (
      body.includes('Torre de Control') ||
      body.includes('Sucursal') ||
      body.includes('Seleccionar')
    );
  }, { timeout: 15_000 });

  // Si ya estamos en el dashboard, no hacer nada
  const inDashboard = await page.getByText('Torre de Control').isVisible().catch(() => false);
  if (inDashboard) return;

  // Click en la primera sucursal disponible
  const sucursalCard = page.locator('button, [role="button"], .cursor-pointer')
    .filter({ hasText: /sucursal/i })
    .first();

  if (await sucursalCard.isVisible()) {
    await sucursalCard.click();
  }

  // Esperar a que cargue el dashboard
  await expect(page.getByText('Torre de Control')).toBeVisible({ timeout: 15_000 });
}

/** Navega a un tab específico del dashboard */
export async function navigateToTab(page: Page, tabName: string) {
  const tab = page.getByRole('button', { name: new RegExp(tabName, 'i') }).first();
  await tab.click();
  // Esperar a que el contenido del tab cargue (lazy loaded)
  await page.waitForTimeout(1000);
}

/** Espera a que desaparezca cualquier spinner de carga */
export async function waitForLoading(page: Page) {
  // Esperar a que no haya spinners visibles
  await page.locator('.animate-spin').waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
}

/** Formatea un número como moneda ARS para comparación */
export function formatARS(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount);
}

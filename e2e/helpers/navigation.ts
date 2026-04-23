import { Page, expect } from '@playwright/test';

/**
 * Helpers de navegación para App Kiosco.
 * El flujo post-login es: SeleccionarSucursal → Dashboard (owner) o VistaEmpleado (empleado).
 */

/** Selecciona la primera sucursal disponible y entra al dashboard */
export async function selectFirstBranch(page: Page) {
  // Esperar a que termine la hidratación: o estamos en el dashboard
  // ("Torre de Control") o en el selector ("¿Dónde operamos hoy?").
  // El heading del selector es más específico que "Sucursal" (que también
  // aparece en muchas otras vistas) así que lo buscamos como ancla.
  await page.waitForFunction(() => {
    const body = document.body.textContent || '';
    return (
      body.includes('Torre de Control') ||
      body.includes('¿Dónde operamos hoy?') ||
      body.includes('Seleccionar')
    );
  }, { timeout: 20_000 });

  // Si ya estamos en el dashboard, no hacer nada
  const inDashboard = await page.getByText('Torre de Control').isVisible().catch(() => false);
  if (inDashboard) return;

  // Estamos en el selector. El primer botón que NO es "Actualizar Lista" ni
  // el botón de Next.js DevTools es la primera sucursal.
  // Usamos toBeVisible() en vez de isVisible() para que auto-espere la
  // hidratación de React en dev (isVisible es sync y falla en la race).
  const selector = page.getByRole('heading', { name: /dónde operamos hoy/i });
  await expect(selector).toBeVisible({ timeout: 10_000 });

  // La primera sucursal es el primer botón dentro del Card que no sea
  // "Actualizar Lista". Usamos un selector por rol filtrando por nombre
  // exclusorio. Alternativa robusta: primer <button> con ArrowRight.
  const sucursalBtn = page
    .getByRole('button')
    .filter({ hasNot: page.getByText(/actualizar lista|open next\.js dev tools/i) })
    .first();

  await expect(sucursalBtn).toBeVisible({ timeout: 10_000 });
  await sucursalBtn.click();

  // Esperar a que cargue el dashboard. 30s porque en dev el primer render
  // compila componentes lazy y Supabase sa-east-1 puede tardar.
  await expect(page.getByText('Torre de Control')).toBeVisible({ timeout: 30_000 });
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

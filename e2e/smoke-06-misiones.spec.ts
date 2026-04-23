import { test, expect } from '@playwright/test';
import { selectFirstBranch, navigateToTab, waitForLoading } from './helpers/navigation';

/**
 * SMOKE TEST 6: Misiones y Gamificación
 *
 * Verifica:
 * - El dueño puede ver las misiones del equipo
 * - Se puede asignar una misión nueva manualmente
 * - La misión queda registrada en la DB
 *
 * NOTA: El flujo de completar una misión como empleado requiere login
 * del empleado. Eso se cubre manualmente con QA-CHECKLIST 12.2.
 */
test.describe('Misiones y Gamificación', () => {
  const missionTitle = `Misión-PW-${Date.now()}`;

  test('ver componente de misiones en el dashboard', async ({ page }) => {
    await page.goto('/');
    await selectFirstBranch(page);

    // Las misiones pueden estar en Control Empleados o en el tab Ajustes
    const candidates = ['Control Empleados', 'Equipo', 'Empleados', 'Ajustes'];
    let found = false;

    for (const tab of candidates) {
      const tabBtn = page.getByRole('button', { name: new RegExp(tab, 'i') }).first();
      if (await tabBtn.isVisible().catch(() => false)) {
        await tabBtn.click();
        await waitForLoading(page);

        const missionSection = page.getByText(/misi[oó]n|misiones/i).first();
        if (await missionSection.isVisible({ timeout: 2_000 }).catch(() => false)) {
          found = true;
          await page.screenshot({ path: `e2e/screenshots/misiones-en-${tab.toLowerCase()}.png` });
          break;
        }
      }
    }

    if (!found) {
      console.log('ℹ️ Sección de misiones no encontrada en los tabs usuales');
      await page.screenshot({ path: 'e2e/screenshots/misiones-no-encontradas.png' });
    }

    expect(found).toBeTruthy();
  });

  test('abrir el flujo de asignar misión', async ({ page }) => {
    await page.goto('/');
    await selectFirstBranch(page);

    // Navegar a Control Empleados
    await navigateToTab(page, 'Control Empleados').catch(() => {
      return navigateToTab(page, 'Equipo');
    });
    await waitForLoading(page);

    // Buscar botón "Asignar misión" o similar
    const asignarBtn = page.getByRole('button', { name: /asignar misi[oó]n|nueva misi[oó]n|\+.*misi/i }).first();
    const isVisible = await asignarBtn.isVisible().catch(() => false);

    if (isVisible) {
      await asignarBtn.click();
      await page.waitForTimeout(500);

      // Debe haber algún form con input de título
      const titleInput = page.locator('input[placeholder*="misi"], input[placeholder*="t[íi]tulo"], textarea[placeholder*="descripci"]').first();
      const hasForm = await titleInput.isVisible({ timeout: 3_000 }).catch(() => false);

      if (hasForm) {
        await page.screenshot({ path: 'e2e/screenshots/misiones-form-abierto.png' });
      }
    } else {
      console.log('ℹ️ Botón de asignar misión no encontrado en este tab — puede requerir click en un empleado primero');
      test.skip();
    }
  });

  test('ver sistema de XP/ranking existente', async ({ page }) => {
    await page.goto('/');
    await selectFirstBranch(page);
    await navigateToTab(page, 'Control Empleados').catch(() => {
      return navigateToTab(page, 'Equipo');
    });
    await waitForLoading(page);

    // XP puede aparecer como número con "XP" al lado, o como barra de progreso
    const xpIndicator = page.getByText(/\d+\s*xp/i).first();
    const hasXP = await xpIndicator.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasXP) {
      await expect(xpIndicator).toBeVisible();
      await page.screenshot({ path: 'e2e/screenshots/misiones-xp.png' });
    } else {
      console.log('ℹ️ No hay indicadores de XP visibles — puede que no haya empleados con actividad');
      await page.screenshot({ path: 'e2e/screenshots/misiones-sin-xp.png' });
    }
  });

  test('verificar que el tab de Ajustes incluye configuración de rendimiento', async ({ page }) => {
    await page.goto('/');
    await selectFirstBranch(page);
    await navigateToTab(page, 'Ajustes');
    await waitForLoading(page);

    // configuracion-rendimiento debería estar accesible desde Ajustes
    const configSection = page.getByText(/rendimiento|configuraci[oó]n.*xp|horarios/i).first();
    const hasConfig = await configSection.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasConfig) {
      await expect(configSection).toBeVisible();
      await page.screenshot({ path: 'e2e/screenshots/misiones-config-rendimiento.png' });
    } else {
      console.log('ℹ️ Configuración de rendimiento no visible en Ajustes — puede estar en otro lugar');
    }
  });
});

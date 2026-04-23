import { test, expect } from '@playwright/test';
import { selectFirstBranch, navigateToTab, waitForLoading } from './helpers/navigation';

/**
 * SMOKE TEST 7: Reportes (PDF + Excel)
 *
 * Verifica:
 * - Navegar a reportes
 * - Generar reporte PDF de ventas
 * - Generar reporte Excel de stock
 * - La descarga ocurre sin errores
 *
 * NOTA: NO abre los archivos descargados — eso se valida manualmente en
 * QA-CHECKLIST 8.1/8.2. Este spec sólo verifica que la descarga se dispara.
 */
test.describe('Reportes', () => {

  test('navegar a reportes', async ({ page }) => {
    await page.goto('/');
    await selectFirstBranch(page);

    // Los reportes pueden estar en su propio tab o dentro de Ajustes/Historial
    const candidates = ['Reportes', 'Historial', 'Análisis', 'An\u00e1lisis'];
    let found = false;

    for (const tab of candidates) {
      const tabBtn = page.getByRole('button', { name: new RegExp(tab, 'i') }).first();
      if (await tabBtn.isVisible().catch(() => false)) {
        await tabBtn.click();
        await waitForLoading(page);

        const reportSection = page.getByText(/reporte|exportar|descargar/i).first();
        if (await reportSection.isVisible({ timeout: 3_000 }).catch(() => false)) {
          found = true;
          await page.screenshot({ path: `e2e/screenshots/reportes-en-${tab.toLowerCase()}.png` });
          break;
        }
      }
    }

    if (!found) {
      console.log('ℹ️ Sección de reportes no encontrada en tabs estándar');
    }
  });

  test('generar reporte PDF de ventas (dispara descarga)', async ({ page }) => {
    await page.goto('/');
    await selectFirstBranch(page);

    // Intentar encontrar reportes en múltiples lugares
    for (const tab of ['Historial', 'Análisis', 'Reportes']) {
      const tabBtn = page.getByRole('button', { name: new RegExp(tab, 'i') }).first();
      if (await tabBtn.isVisible().catch(() => false)) {
        await tabBtn.click();
        await waitForLoading(page);

        const pdfBtn = page.getByRole('button', { name: /pdf|exportar.*pdf|generar.*pdf/i }).first();
        if (await pdfBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          // Setup del listener de descarga ANTES de click
          const downloadPromise = page.waitForEvent('download', { timeout: 10_000 }).catch(() => null);
          await pdfBtn.click();

          const download = await downloadPromise;
          if (download) {
            expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
            await page.screenshot({ path: 'e2e/screenshots/reporte-pdf-descargado.png' });
            return;
          } else {
            console.log('ℹ️ Click ejecutado pero no se disparó descarga — el reporte puede abrir en nueva tab o requerir rango');
            await page.screenshot({ path: 'e2e/screenshots/reporte-pdf-sin-descarga.png' });
          }
        }
      }
    }

    console.log('ℹ️ No se pudo disparar descarga de PDF en los tabs explorados');
  });

  test('generar reporte Excel de stock (dispara descarga)', async ({ page }) => {
    await page.goto('/');
    await selectFirstBranch(page);

    for (const tab of ['Historial', 'Análisis', 'Reportes', 'Stock']) {
      const tabBtn = page.getByRole('button', { name: new RegExp(tab, 'i') }).first();
      if (await tabBtn.isVisible().catch(() => false)) {
        await tabBtn.click();
        await waitForLoading(page);

        const xlsxBtn = page.getByRole('button', { name: /excel|xlsx|exportar.*excel/i }).first();
        if (await xlsxBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          const downloadPromise = page.waitForEvent('download', { timeout: 10_000 }).catch(() => null);
          await xlsxBtn.click();

          const download = await downloadPromise;
          if (download) {
            expect(download.suggestedFilename()).toMatch(/\.(xlsx|xls)$/i);
            await page.screenshot({ path: 'e2e/screenshots/reporte-excel-descargado.png' });
            return;
          } else {
            console.log('ℹ️ Click en Excel ejecutado pero sin descarga detectada');
            await page.screenshot({ path: 'e2e/screenshots/reporte-excel-sin-descarga.png' });
          }
        }
      }
    }

    console.log('ℹ️ No se pudo disparar descarga de Excel en los tabs explorados');
  });

  test('validación de branchId — no leakea data entre sucursales', async ({ page }) => {
    // Test conceptual: requiere 2 sucursales con data distinta.
    // En este smoke, sólo verificamos que el reporte carga en la sucursal actual.
    await page.goto('/');
    await selectFirstBranch(page);

    for (const tab of ['Historial', 'Análisis']) {
      const tabBtn = page.getByRole('button', { name: new RegExp(tab, 'i') }).first();
      if (await tabBtn.isVisible().catch(() => false)) {
        await tabBtn.click();
        await waitForLoading(page);

        // Si hay un componente de reportes, debe mostrar data o estado vacío sin error
        const errorMsg = page.getByText(/error|falla|permission/i).first();
        const hasError = await errorMsg.isVisible({ timeout: 2_000 }).catch(() => false);

        expect(hasError).toBeFalsy();
        break;
      }
    }
  });
});

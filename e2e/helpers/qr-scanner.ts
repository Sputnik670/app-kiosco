/**
 * Helpers para tests de QR Scanner
 */

import { Page, expect } from '@playwright/test';

export interface QRTestData {
  sucursal_id: string;
  tipo: 'entrada' | 'salida';
  url?: string;
}

/**
 * Simula el escaneo de un QR
 * Nota: Esto requiere que el componente tenga un modo de prueba
 */
export async function simulateQRScan(page: Page, qrData: QRTestData) {
  // Construir URL del QR
  const qrUrl = qrData.url || `/fichaje?sucursal_id=${qrData.sucursal_id}&tipo=${qrData.tipo}`;
  
  // Si el componente tiene un modo de prueba, podemos inyectar el QR directamente
  await page.evaluate((url) => {
    // Disparar evento personalizado con el QR
    window.dispatchEvent(new CustomEvent('qr-scanned', { detail: { url } }));
  }, qrUrl);
}

/**
 * Verifica que el scanner esté abierto y funcionando
 */
export async function verifyScannerOpen(page: Page) {
  // Verificar que el dialog del scanner está visible
  await expect(
    page.locator('text=/iniciando.*cámara/i').or(
      page.locator('text=/escaneando/i')
    )
  ).toBeVisible({ timeout: 10000 });
}

/**
 * Captura logs de consola relacionados con el scanner
 */
export function captureScannerLogs(page: Page): Array<{ type: string; text: string; timestamp: number }> {
  const logs: Array<{ type: string; text: string; timestamp: number }> = [];
  
  page.on('console', msg => {
    const text = msg.text();
    if (
      text.includes('QR') ||
      text.includes('cámara') ||
      text.includes('Video') ||
      text.includes('stream') ||
      text.includes('scanner') ||
      text.includes('fichaje')
    ) {
      logs.push({
        type: msg.type(),
        text,
        timestamp: Date.now(),
      });
    }
  });
  
  return logs;
}

/**
 * Verifica que se haya redirigido correctamente después del escaneo
 */
export async function verifyRedirectAfterScan(page: Page, expectedPath: string) {
  // Esperar a que la redirección ocurra
  await page.waitForURL(new RegExp(expectedPath), { timeout: 10000 });
  
  // Verificar que estamos en la página correcta
  expect(page.url()).toContain(expectedPath);
}

/**
 * Abre el scanner QR desde la vista del empleado
 */
export async function openQRScanner(page: Page) {
  // Buscar el botón para abrir el scanner
  const scannerButton = page.locator('[data-testid="escanear-qr-button"]').or(
    page.getByRole('button', { name: /escanear.*qr/i }).or(
      page.getByRole('button', { name: /fichaje/i })
    )
  );
  
  if (await scannerButton.isVisible()) {
    await scannerButton.click();
    await verifyScannerOpen(page);
  } else {
    throw new Error('No se encontró el botón para abrir el scanner QR');
  }
}


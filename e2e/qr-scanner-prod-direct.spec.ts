import { test, expect, chromium } from '@playwright/test';

/**
 * Test directo para producción - NO usa webServer
 * Ejecutar: npx playwright test e2e/qr-scanner-prod-direct.spec.ts --project=chromium
 *
 * IMPORTANTE: Configurar variables de entorno antes de ejecutar:
 * - TEST_BASE_URL (default: https://app-cadena-kiosco-24-7.vercel.app)
 * - TEST_EMPLOYEE_EMAIL
 * - TEST_EMPLOYEE_PASSWORD
 */

const BASE_URL = process.env.TEST_BASE_URL || 'https://app-cadena-kiosco-24-7.vercel.app';
const EMPLOYEE_EMAIL = process.env.TEST_EMPLOYEE_EMAIL || '';
const EMPLOYEE_PASSWORD = process.env.TEST_EMPLOYEE_PASSWORD || '';

test.describe('QR Scanner - Producción (Directo)', () => {
  test('Capturar logs y errores del scanner', async () => {
    // Crear contexto sin webServer
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Arrays para almacenar logs
    const logs: Array<{ type: string; text: string; timestamp: number }> = [];
    const errors: Array<{ message: string; stack?: string }> = [];
    const failedRequests: Array<{ url: string; error: string }> = [];

    console.log(`🌐 Navegando a: ${BASE_URL}`);

    // Capturar logs
    page.on('console', msg => {
      const logEntry = {
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now()
      };
      logs.push(logEntry);
      console.log(`[CONSOLE ${msg.type()}]:`, msg.text());
    });

    page.on('pageerror', error => {
      errors.push({
        message: error.message,
        stack: error.stack
      });
      console.error(`[PAGE ERROR]:`, error.message);
    });

    page.on('requestfailed', request => {
      failedRequests.push({
        url: request.url(),
        error: request.failure()?.errorText || 'Unknown'
      });
      console.error(`[REQUEST FAILED]:`, request.url());
    });

    try {
      // Navegar
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log('✅ Página cargada');
      
      await page.waitForTimeout(3000);

      // Login
      console.log('🔐 Intentando login...');
      const emailInput = page.locator('input[type="email"], input[name*="email" i]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      const submitButton = page.locator('button[type="submit"], button:has-text("Iniciar"), button:has-text("Entrar")').first();

      if (await emailInput.count() > 0 && await passwordInput.count() > 0) {
        await emailInput.fill(EMPLOYEE_EMAIL);
        await passwordInput.fill(EMPLOYEE_PASSWORD);
        await submitButton.click();
        console.log('✅ Login enviado');
        await page.waitForTimeout(5000);
      }

      // Buscar botón QR
      console.log('🔍 Buscando botón QR...');
      const qrButton = page.locator('button:has-text("QR"), button:has-text("Escanear"), [data-testid*="qr" i]').first();
      
      if (await qrButton.count() > 0 && await qrButton.isVisible()) {
        console.log('✅ Botón encontrado, haciendo clic...');
        await qrButton.click();
        await page.waitForTimeout(8000);

        // Buscar scanner
        const scanner = page.locator('[data-testid="qr-scanner-dialog"], text=/iniciando.*cámara/i, text=/escaneando/i');
        if (await scanner.count() > 0) {
          console.log('✅ Scanner abierto!');
          await page.waitForTimeout(5000);
        }
      }

      // Resumen
      console.log('\n📊 RESUMEN:');
      console.log(`Logs: ${logs.length}`);
      console.log(`Errores: ${errors.length}`);
      console.log(`Requests fallidos: ${failedRequests.length}`);

      const scannerLogs = logs.filter(l => 
        l.text.toLowerCase().includes('qr') ||
        l.text.toLowerCase().includes('cámara') ||
        l.text.toLowerCase().includes('video') ||
        l.text.toLowerCase().includes('stream') ||
        l.text.toLowerCase().includes('scanner')
      );

      if (scannerLogs.length > 0) {
        console.log('\n📋 LOGS DEL SCANNER:');
        scannerLogs.forEach(l => console.log(`[${l.type}] ${l.text}`));
      }

      if (errors.length > 0) {
        console.log('\n❌ ERRORES:');
        errors.forEach(e => console.error(e.message));
      }

    } finally {
      await browser.close();
    }
  });
});






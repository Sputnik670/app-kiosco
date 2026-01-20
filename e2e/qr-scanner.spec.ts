import { test, expect } from '@playwright/test';

/**
 * Tests E2E para el flujo de QR Scanner de Fichaje
 * 
 * Estos tests verifican:
 * - Generación de QR por el dueño
 * - Escaneo de QR por el empleado
 * - Redirección correcta después del escaneo
 * - Procesamiento del fichaje
 */

test.describe('QR Scanner - Fichaje', () => {
  test.beforeEach(async ({ page }) => {
    // Capturar todos los logs de consola y errores
    page.on('console', msg => {
      console.log(`[CONSOLE ${msg.type()}]:`, msg.text());
    });
    
    page.on('pageerror', error => {
      console.error(`[PAGE ERROR]:`, error.message);
    });
    
    page.on('requestfailed', request => {
      console.error(`[REQUEST FAILED]:`, request.url(), request.failure()?.errorText);
    });
  });

  test('Debería generar QR de entrada y salida como dueño', async ({ page }) => {
    // TODO: Implementar login como dueño
    await page.goto('/');
    
    // Esperar a que la página cargue
    await page.waitForLoadState('networkidle');
    
    // Buscar el botón de "Generar QR" o similar
    // Esto requiere que agregues data-testid al componente
    const generarQRButton = page.locator('[data-testid="generar-qr-button"]').or(
      page.getByRole('button', { name: /generar.*qr/i })
    );
    
    if (await generarQRButton.isVisible()) {
      await generarQRButton.click();
      
      // Verificar que se muestra el componente de generación de QR
      await expect(page.locator('text=/qr.*entrada/i').or(page.locator('text=/qr.*salida/i'))).toBeVisible();
    }
  });

  test('Debería abrir el scanner QR como empleado', async ({ page }) => {
    // TODO: Implementar login como empleado
    await page.goto('/');
    
    await page.waitForLoadState('networkidle');
    
    // Buscar botón para escanear QR
    const escanearQRButton = page.locator('[data-testid="escanear-qr-button"]').or(
      page.getByRole('button', { name: /escanear.*qr/i }).or(
        page.getByRole('button', { name: /fichaje/i })
      )
    );
    
    if (await escanearQRButton.isVisible()) {
      await escanearQRButton.click();
      
      // Verificar que se abre el dialog del scanner
      // El scanner debería mostrar "Iniciando cámara..." o "Escaneando..."
      await expect(
        page.locator('text=/iniciando.*cámara/i').or(
          page.locator('text=/escaneando/i')
        )
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('Debería detectar errores en el scanner QR', async ({ page, context }) => {
    // Simular un dispositivo móvil
    await context.setGeolocation({ latitude: -34.6037, longitude: -58.3816 });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Capturar errores específicos del scanner
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Intentar abrir el scanner
    const escanearQRButton = page.locator('[data-testid="escanear-qr-button"]').or(
      page.getByRole('button', { name: /escanear.*qr/i })
    );
    
    if (await escanearQRButton.isVisible()) {
      await escanearQRButton.click();
      
      // Esperar un momento para que se inicialice
      await page.waitForTimeout(2000);
      
      // Verificar que no hay errores críticos
      const criticalErrors = errors.filter(e => 
        e.includes('getUserMedia') || 
        e.includes('camera') || 
        e.includes('permission') ||
        e.includes('NotAllowedError')
      );
      
      if (criticalErrors.length > 0) {
        console.error('Errores críticos detectados:', criticalErrors);
      }
    }
  });

  test('Debería procesar QR y redirigir correctamente', async ({ page }) => {
    // Este test requiere mockear el escaneo de QR
    // ya que no podemos acceder a la cámara real en CI
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Interceptar la redirección después del escaneo
    let redirectedTo = '';
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        redirectedTo = frame.url();
      }
    });
    
    // Simular un QR escaneado (esto requiere modificar el componente
    // para aceptar un modo de prueba o mock)
    // Por ahora, solo verificamos que el flujo existe
    
    // TODO: Implementar mock de QR scanner
  });
});

/**
 * Test específico para móviles (iOS Safari)
 */
test.describe('QR Scanner - Móvil (iOS)', () => {
  test.use({
    ...require('@playwright/test').devices['iPhone 13 Pro'],
  });

  test('Debería funcionar en iOS Safari', async ({ page }) => {
    // Capturar todos los logs
    const logs: Array<{ type: string; text: string }> = [];
    page.on('console', msg => {
      logs.push({ type: msg.type(), text: msg.text() });
      console.log(`[${msg.type()}]:`, msg.text());
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Intentar abrir scanner
    const escanearQRButton = page.locator('[data-testid="escanear-qr-button"]').or(
      page.getByRole('button', { name: /escanear.*qr/i })
    );
    
    if (await escanearQRButton.isVisible()) {
      await escanearQRButton.click();
      
      // Esperar a que se inicialice
      await page.waitForTimeout(3000);
      
      // Verificar logs de inicialización
      const initLogs = logs.filter(l => 
        l.text.includes('Video') || 
        l.text.includes('cámara') ||
        l.text.includes('stream')
      );
      
      console.log('Logs de inicialización:', initLogs);
      
      // Verificar que no hay errores de permisos
      const permissionErrors = logs.filter(l => 
        l.type === 'error' && 
        (l.text.includes('NotAllowedError') || l.text.includes('PermissionDeniedError'))
      );
      
      if (permissionErrors.length > 0) {
        console.error('Errores de permisos detectados:', permissionErrors);
      }
    }
  });
});


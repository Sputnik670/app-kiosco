import { test, expect } from '@playwright/test';

/**
 * Test para capturar errores del QR Scanner en PRODUCCIÓN
 * 
 * Para ejecutar:
 * PLAYWRIGHT_TEST_BASE_URL=https://tu-app.vercel.app npm run test:e2e:qr:prod
 */

// Usar la URL de producción si está configurada
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'https://app-cadena-kiosco-24-7.vercel.app';

// Credenciales de empleado para testing
const EMPLOYEE_EMAIL = process.env.TEST_EMPLOYEE_EMAIL || 'entornomincyt@gmail.com';
const EMPLOYEE_PASSWORD = process.env.TEST_EMPLOYEE_PASSWORD || 'RamYLu.2021';

test.describe('QR Scanner - Producción', () => {
  // Deshabilitar webServer para tests de producción
  test.use({ baseURL: BASE_URL });
  
  test('Debería capturar logs y errores del scanner en producción', async ({ page }) => {
    // Array para almacenar todos los logs
    const logs: Array<{ type: string; text: string; timestamp: number }> = [];
    const errors: Array<{ message: string; stack?: string }> = [];
    const failedRequests: Array<{ url: string; error: string }> = [];

    console.log(`🌐 Navegando a: ${BASE_URL}`);

    // Capturar logs de consola
    page.on('console', msg => {
      const logEntry = {
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now()
      };
      logs.push(logEntry);
      console.log(`[CONSOLE ${msg.type()}]:`, msg.text());
    });

    // Capturar errores de página
    page.on('pageerror', error => {
      errors.push({
        message: error.message,
        stack: error.stack
      });
      console.error(`[PAGE ERROR]:`, error.message);
      if (error.stack) {
        console.error(`[STACK]:`, error.stack.substring(0, 300));
      }
    });

    // Capturar requests fallidos
    page.on('requestfailed', request => {
      failedRequests.push({
        url: request.url(),
        error: request.failure()?.errorText || 'Unknown error'
      });
      console.error(`[REQUEST FAILED]:`, request.url(), request.failure()?.errorText);
    });

    // Navegar a producción
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    console.log('⏳ Esperando a que la página cargue...');
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      console.log('⚠️ Network idle timeout, continuando...');
    });

    // Intentar hacer login como empleado
    console.log('🔐 Intentando hacer login como empleado...');
    try {
      // Buscar campos de email y password
      const emailInput = page.locator('input[type="email"], input[name*="email" i], input[placeholder*="email" i]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      const submitButton = page.locator('button[type="submit"], button:has-text("Iniciar"), button:has-text("Entrar"), button:has-text("Login")').first();

      const emailCount = await emailInput.count();
      const passwordCount = await passwordInput.count();

      if (emailCount > 0 && passwordCount > 0) {
        console.log('✅ Campos de login encontrados, llenando formulario...');
        await emailInput.fill(EMPLOYEE_EMAIL);
        await passwordInput.fill(EMPLOYEE_PASSWORD);
        
        if (await submitButton.count() > 0) {
          await submitButton.click();
          console.log('✅ Formulario enviado, esperando autenticación...');
          
          // Esperar a que la autenticación complete (redirección o cambio de UI)
          await page.waitForTimeout(5000);
          
          // Verificar si estamos autenticados (la URL cambió o aparece el dashboard)
          const currentUrl = page.url();
          console.log(`📍 URL después del login: ${currentUrl}`);
        }
      } else {
        console.log('⚠️ No se encontraron campos de login, puede que ya estés autenticado o la página sea diferente');
      }
    } catch (loginError: any) {
      console.log(`⚠️ Error durante login (puede que ya estés autenticado): ${loginError.message}`);
    }

    // Esperar un momento para que todo se inicialice después del login
    await page.waitForTimeout(3000);

    // Buscar botones relacionados con QR o fichaje
    console.log('🔍 Buscando botones de QR/Fichaje...');
    
    const possibleButtons = [
      page.locator('[data-testid="escanear-qr-button"]'),
      page.locator('button:has-text("QR")'),
      page.locator('button:has-text("Fichaje")'),
      page.locator('button:has-text("Escanear")'),
      page.locator('button:has-text("Escanear QR")'),
      page.locator('[aria-label*="QR" i]'),
      page.locator('[aria-label*="fichaje" i]'),
      // Buscar por icono de QR
      page.locator('button:has(svg)').filter({ hasText: /qr|fichaje/i }),
    ];

    let buttonFound = false;
    for (const button of possibleButtons) {
      const count = await button.count();
      if (count > 0) {
        const isVisible = await button.isVisible().catch(() => false);
        if (isVisible) {
          const buttonText = await button.textContent().catch(() => '');
          console.log(`✅ Botón encontrado: "${buttonText}"`);
          buttonFound = true;
          
          try {
            console.log('🖱️ Haciendo clic en el botón...');
            await button.scrollIntoViewIfNeeded();
            await button.click({ timeout: 5000 });
            
            console.log('⏳ Esperando que aparezca el scanner (5 segundos)...');
            await page.waitForTimeout(5000);
            
            // Buscar el dialog del scanner
            const scannerDialog = page.locator('[data-testid="qr-scanner-dialog"]');
            const loadingText = page.locator('text=/iniciando.*cámara/i');
            const scanningText = page.locator('text=/escaneando/i');
            
            const scannerVisible = await scannerDialog.isVisible({ timeout: 3000 }).catch(() => false) ||
                                 await loadingText.isVisible({ timeout: 3000 }).catch(() => false) ||
                                 await scanningText.isVisible({ timeout: 3000 }).catch(() => false);
            
            if (scannerVisible) {
              console.log('✅ Scanner abierto! Capturando logs...');
              
              // Esperar más tiempo para capturar logs de inicialización
              await page.waitForTimeout(8000);
              
              // Filtrar logs relevantes del scanner
              const scannerLogs = logs.filter(l => {
                const text = l.text.toLowerCase();
                return text.includes('qr') ||
                       text.includes('cámara') ||
                       text.includes('camera') ||
                       text.includes('video') ||
                       text.includes('stream') ||
                       text.includes('scanner') ||
                       text.includes('fichaje') ||
                       text.includes('getusermedia') ||
                       text.includes('permission') ||
                       text.includes('metadata') ||
                       text.includes('reproduciéndose') ||
                       text.includes('playing');
              });
              
              console.log('\n📊 ============================================');
              console.log('📊 LOGS DEL SCANNER QR:');
              console.log('📊 ============================================');
              if (scannerLogs.length > 0) {
                scannerLogs.forEach(log => {
                  const emoji = log.type === 'error' ? '❌' : log.type === 'warn' ? '⚠️' : '✅';
                  console.log(`${emoji} [${log.type.toUpperCase()}] ${log.text}`);
                });
              } else {
                console.log('⚠️ No se capturaron logs específicos del scanner');
                console.log('📝 Esto puede indicar que:');
                console.log('   - El scanner no se inicializó');
                console.log('   - Los logs no están siendo emitidos');
                console.log('   - Hay un problema de permisos silencioso');
              }
              
              // Mostrar todos los logs si no hay logs específicos
              if (scannerLogs.length === 0 && logs.length > 0) {
                console.log('\n📋 Todos los logs capturados:');
                logs.slice(-20).forEach(log => {
                  console.log(`[${log.type}] ${log.text.substring(0, 100)}`);
                });
              }
              
            } else {
              console.log('⚠️ Scanner no se abrió o no es visible');
              console.log('📝 Verificando qué hay en la página...');
              
              // Capturar screenshot para debugging
              await page.screenshot({ path: 'test-results/scanner-not-opened.png', fullPage: true });
              console.log('📸 Screenshot guardado en test-results/scanner-not-opened.png');
            }
            
          } catch (clickError: any) {
            console.error('❌ Error al interactuar con el botón:', clickError.message);
          }
          
          break;
        }
      }
    }
    
    if (!buttonFound) {
      console.log('\n⚠️ ============================================');
      console.log('⚠️ NO SE ENCONTRÓ BOTÓN DE QR/FICHAJE');
      console.log('⚠️ ============================================');
      console.log('📝 Posibles razones:');
      console.log('   1. El usuario no está autenticado');
      console.log('   2. El usuario no es un empleado');
      console.log('   3. El componente no está renderizado');
      console.log('   4. La página requiere login primero');
      
      // Capturar screenshot de la página actual
      await page.screenshot({ path: 'test-results/no-button-found.png', fullPage: true });
      console.log('📸 Screenshot guardado en test-results/no-button-found.png');
      
      // Mostrar URL actual
      console.log(`\n🌐 URL actual: ${page.url()}`);
      
      // Mostrar título de la página
      const title = await page.title().catch(() => 'N/A');
      console.log(`📄 Título: ${title}`);
    }
    
    // Mostrar resumen de errores
    if (errors.length > 0) {
      console.log('\n❌ ============================================');
      console.log('❌ ERRORES DE PÁGINA ENCONTRADOS:');
      console.log('❌ ============================================');
      errors.forEach((err, index) => {
        console.log(`\n${index + 1}. ${err.message}`);
        if (err.stack) {
          const stackLines = err.stack.split('\n').slice(0, 5);
          console.log('   Stack:', stackLines.join('\n   '));
        }
      });
    }
    
    // Mostrar requests fallidos
    if (failedRequests.length > 0) {
      console.log('\n🔴 ============================================');
      console.log('🔴 REQUESTS FALLIDOS:');
      console.log('🔴 ============================================');
      failedRequests.forEach((req, index) => {
        console.log(`\n${index + 1}. ${req.url}`);
        console.log(`   Error: ${req.error}`);
      });
    }
    
    // Verificar errores de permisos específicos
    const permissionErrors = logs.filter(l => 
      l.type === 'error' && (
        l.text.includes('NotAllowedError') ||
        l.text.includes('PermissionDeniedError') ||
        l.text.includes('getUserMedia') ||
        l.text.includes('camera permission')
      )
    );
    
    if (permissionErrors.length > 0) {
      console.log('\n⚠️ ============================================');
      console.log('⚠️ ERRORES DE PERMISOS DE CÁMARA:');
      console.log('⚠️ ============================================');
      permissionErrors.forEach(err => {
        console.error(`[${err.type}] ${err.text}`);
      });
    }
    
    // Resumen final
    console.log('\n📈 ============================================');
    console.log('📈 RESUMEN FINAL:');
    console.log('📈 ============================================');
    console.log(`Total logs capturados: ${logs.length}`);
    console.log(`Total errores: ${errors.length}`);
    console.log(`Total requests fallidos: ${failedRequests.length}`);
    console.log(`Errores de permisos: ${permissionErrors.length}`);
    console.log(`Botón encontrado: ${buttonFound ? '✅ Sí' : '❌ No'}`);
  });
});


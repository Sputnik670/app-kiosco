import { test, expect } from '@playwright/test';

/**
 * Test simplificado para capturar errores del QR Scanner
 * Este test se enfoca en capturar logs y errores sin depender de autenticación
 */

test.describe('QR Scanner - Captura de Errores', () => {
  test('Debería capturar logs y errores al intentar abrir el scanner', async ({ page }) => {
    // Array para almacenar todos los logs
    const logs: Array<{ type: string; text: string; timestamp: number }> = [];
    const errors: Array<{ message: string; stack?: string }> = [];
    const failedRequests: Array<{ url: string; error: string }> = [];

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
        console.error(`[STACK]:`, error.stack);
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

    // Navegar a la página principal
    console.log('🌐 Navegando a la página principal...');
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    console.log('⏳ Esperando a que la página cargue completamente...');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      console.log('⚠️ Network idle timeout, continuando...');
    });

    // Esperar un momento para que todo se inicialice
    await page.waitForTimeout(2000);

    // Buscar cualquier botón relacionado con QR o fichaje
    console.log('🔍 Buscando botones de QR/Fichaje...');
    
    const possibleButtons = [
      page.locator('[data-testid="escanear-qr-button"]'),
      page.locator('button:has-text("QR")'),
      page.locator('button:has-text("Fichaje")'),
      page.locator('button:has-text("Escanear")'),
      page.locator('[aria-label*="QR" i]'),
      page.locator('[aria-label*="fichaje" i]'),
    ];

    let buttonFound = false;
    for (const button of possibleButtons) {
      const count = await button.count();
      if (count > 0) {
        const isVisible = await button.isVisible().catch(() => false);
        if (isVisible) {
          console.log(`✅ Botón encontrado: ${await button.textContent().catch(() => '')}`);
          buttonFound = true;
          
          // Intentar hacer clic
          try {
            console.log('🖱️ Intentando hacer clic en el botón...');
            await button.click({ timeout: 5000 });
            
            // Esperar a que aparezca el dialog del scanner
            console.log('⏳ Esperando que aparezca el scanner...');
            await page.waitForTimeout(3000);
            
            // Buscar el dialog del scanner
            const scannerDialog = page.locator('[data-testid="qr-scanner-dialog"]').or(
              page.locator('text=/iniciando.*cámara/i').or(
                page.locator('text=/escaneando/i')
              )
            );
            
            const scannerVisible = await scannerDialog.isVisible({ timeout: 5000 }).catch(() => false);
            
            if (scannerVisible) {
              console.log('✅ Scanner abierto correctamente');
              
              // Esperar más tiempo para capturar logs de inicialización
              await page.waitForTimeout(5000);
              
              // Filtrar logs relevantes
              const scannerLogs = logs.filter(l => 
                l.text.toLowerCase().includes('qr') ||
                l.text.toLowerCase().includes('cámara') ||
                l.text.toLowerCase().includes('video') ||
                l.text.toLowerCase().includes('stream') ||
                l.text.toLowerCase().includes('scanner') ||
                l.text.toLowerCase().includes('fichaje') ||
                l.text.toLowerCase().includes('getusermedia') ||
                l.text.toLowerCase().includes('permission')
              );
              
              console.log('\n📊 RESUMEN DE LOGS DEL SCANNER:');
              console.log('================================');
              scannerLogs.forEach(log => {
                console.log(`[${log.type.toUpperCase()}] ${log.text}`);
              });
              
              if (errors.length > 0) {
                console.log('\n❌ ERRORES ENCONTRADOS:');
                console.log('=======================');
                errors.forEach(err => {
                  console.error(`Error: ${err.message}`);
                  if (err.stack) {
                    console.error(`Stack: ${err.stack.substring(0, 200)}...`);
                  }
                });
              }
              
              if (failedRequests.length > 0) {
                console.log('\n🔴 REQUESTS FALLIDOS:');
                console.log('====================');
                failedRequests.forEach(req => {
                  console.error(`URL: ${req.url}`);
                  console.error(`Error: ${req.error}`);
                });
              }
              
              // Verificar si hay errores de permisos
              const permissionErrors = logs.filter(l => 
                l.type === 'error' && (
                  l.text.includes('NotAllowedError') ||
                  l.text.includes('PermissionDeniedError') ||
                  l.text.includes('getUserMedia')
                )
              );
              
              if (permissionErrors.length > 0) {
                console.log('\n⚠️ ERRORES DE PERMISOS DETECTADOS:');
                console.log('===================================');
                permissionErrors.forEach(err => {
                  console.error(`[${err.type}] ${err.text}`);
                });
              }
              
            } else {
              console.log('⚠️ Scanner no se abrió o no es visible');
            }
            
          } catch (clickError: any) {
            console.error('❌ Error al hacer clic:', clickError.message);
          }
          
          break;
        }
      }
    }
    
    if (!buttonFound) {
      console.log('⚠️ No se encontró ningún botón de QR/Fichaje');
      console.log('📝 Esto puede ser porque:');
      console.log('   - El usuario no está autenticado');
      console.log('   - El usuario no es un empleado');
      console.log('   - El componente no está renderizado');
      
      // Mostrar todos los logs capturados de todas formas
      console.log('\n📊 TODOS LOS LOGS CAPTURADOS:');
      console.log('============================');
      logs.forEach(log => {
        console.log(`[${log.type.toUpperCase()}] ${log.text}`);
      });
    }
    
    // Mostrar resumen final
    console.log('\n📈 RESUMEN FINAL:');
    console.log('================');
    console.log(`Total logs: ${logs.length}`);
    console.log(`Total errores: ${errors.length}`);
    console.log(`Total requests fallidos: ${failedRequests.length}`);
    
    // Guardar logs en un archivo (opcional)
    // Esto se puede hacer después si es necesario
  });
});


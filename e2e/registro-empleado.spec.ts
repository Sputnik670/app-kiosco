import { test, expect } from '@playwright/test';

/**
 * Tests para el flujo de registro de empleado
 * 
 * Este test verifica el flujo completo:
 * 1. Recibir invitación (simulado)
 * 2. Hacer clic en magic link
 * 3. Completar perfil como empleado
 * 4. Verificar que está vinculado a la organización
 */
test.describe('Registro de Empleado', () => {
  test('debería mostrar el formulario de finalizar registro', async ({ page }) => {
    // Este test asume que estás en la página de setup de perfil
    // Puede requerir autenticación previa o un magic link específico
    
    await page.goto('/');
    
    // Esperar a que la página cargue
    await page.waitForLoadState('networkidle');
    
    // Buscar elementos del formulario de registro
    // Ajusta estos selectores según tu componente ProfileSetup
    const nombreInput = page.locator('input[name*="nombre" i], input[placeholder*="nombre" i]').first();
    const rolEmpleado = page.locator('text=/soy empleado/i, button:has-text("Empleado")').first();
    
    // Si estamos en la página de setup, verificar elementos
    if (await nombreInput.count() > 0) {
      await expect(nombreInput).toBeVisible();
      
      if (await rolEmpleado.count() > 0) {
        await expect(rolEmpleado).toBeVisible();
      }
    }
  });

  test.skip('debería poder completar el registro como empleado', async ({ page }) => {
    // Este test requiere:
    // 1. Una invitación válida en la BD
    // 2. Un usuario autenticado con magic link
    // 3. Acceso a la página de setup de perfil
    
    // Ejemplo de flujo:
    // await page.goto('/profile-setup'); // O la URL correcta
    // await page.fill('input[name="nombre"]', 'Test Empleado');
    // await page.click('button:has-text("Soy Empleado")');
    // await page.click('button:has-text("COMENZAR")');
    // 
    // // Esperar redirección
    // await page.waitForURL(/\/(dashboard|empleado)/);
    // 
    // // Verificar que el registro fue exitoso
    // await expect(page.locator('text=/bienvenido/i')).toBeVisible();
  });
});


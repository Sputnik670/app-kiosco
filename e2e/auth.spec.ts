import { test, expect } from '@playwright/test';

/**
 * Tests de autenticación
 * 
 * NOTA: Estos tests requieren que tengas configuradas las variables de entorno:
 * - TEST_USER_EMAIL
 * - TEST_USER_PASSWORD
 * 
 * O puedes usar Magic Link si está habilitado en Supabase.
 */
test.describe('Autenticación', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('debería mostrar el formulario de login', async ({ page }) => {
    // Buscar elementos comunes del formulario de login
    const emailInput = page.locator('input[type="email"], input[name*="email" i], input[placeholder*="email" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    // Verificar que los campos existen (uno u otro debe estar presente)
    const hasEmailField = await emailInput.count() > 0;
    const hasPasswordField = await passwordInput.count() > 0;
    
    expect(hasEmailField || hasPasswordField).toBeTruthy();
  });

  test('debería poder navegar a la página de login', async ({ page }) => {
    // Si hay un enlace de login, hacer clic
    const loginLink = page.locator('a:has-text("Iniciar"), a:has-text("Login"), a[href*="login"]').first();
    
    if (await loginLink.count() > 0) {
      await loginLink.click();
      await page.waitForLoadState('networkidle');
      
      // Verificar que estamos en la página de login
      const url = page.url();
      expect(url).toMatch(/login/i);
    }
  });

  // Test de login completo (requiere credenciales de test)
  test.skip('debería poder iniciar sesión con credenciales válidas', async ({ page }) => {
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      test.skip();
      return;
    }

    // Navegar a login si es necesario
    await page.goto('/login');

    // Llenar el formulario
    const emailInput = page.locator('input[type="email"], input[name*="email" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"], button:has-text("Iniciar"), button:has-text("Entrar")').first();

    await emailInput.fill(testEmail);
    await passwordInput.fill(testPassword);
    await submitButton.click();

    // Esperar a que la autenticación complete
    await page.waitForURL(/\/(dashboard|app|home)/, { timeout: 10000 });

    // Verificar que estamos autenticados (ajusta según tu app)
    const url = page.url();
    expect(url).not.toMatch(/login/);
  });
});


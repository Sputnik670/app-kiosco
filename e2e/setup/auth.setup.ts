import { test as setup, expect } from '@playwright/test';
import * as path from 'path';

/**
 * Setup para autenticación en tests
 * 
 * Este archivo se ejecuta antes de los tests para autenticar al usuario
 * y guardar el estado de la sesión.
 */

const authFile = path.join(__dirname, '../.auth/user.json');

setup('autenticar usuario de prueba', async ({ page }) => {
  const testEmail = process.env.TEST_USER_EMAIL;
  const testPassword = process.env.TEST_USER_PASSWORD;

  // Saltar si no hay credenciales configuradas
  if (!testEmail || !testPassword) {
    setup.skip();
    return;
  }

  // Ir a la página de login
  await page.goto('/login');

  // Llenar y enviar el formulario de login
  const emailInput = page.locator('input[type="email"], input[name*="email" i]').first();
  const passwordInput = page.locator('input[type="password"]').first();
  const submitButton = page.locator('button[type="submit"], button:has-text("Iniciar")').first();

  await emailInput.fill(testEmail);
  await passwordInput.fill(testPassword);
  await submitButton.click();

  // Esperar a que la autenticación complete
  await page.waitForURL(/\/(dashboard|app|home)/, { timeout: 10000 });

  // Guardar el estado de autenticación
  await page.context().storageState({ path: authFile });
});


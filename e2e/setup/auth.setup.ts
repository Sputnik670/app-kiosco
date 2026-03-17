import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Cargar variables de .env.test
dotenv.config({ path: path.join(__dirname, '../.env.test') });

const OWNER_AUTH_FILE = path.join(__dirname, '../.auth/owner.json');

/**
 * Auth Setup — Se ejecuta UNA VEZ antes de todos los tests.
 * Guarda el estado de sesión para reutilizar en los smoke tests.
 */
setup('autenticar como dueño', async ({ page }) => {
  const email = process.env.TEST_OWNER_EMAIL;
  const password = process.env.TEST_OWNER_PASSWORD;

  if (!email || !password) {
    console.error('⚠️  Falta TEST_OWNER_EMAIL y/o TEST_OWNER_PASSWORD en e2e/.env.test');
    console.error('   Copiar e2e/.env.test.example como e2e/.env.test y completar.');
    setup.skip();
    return;
  }

  // Asegurar directorio .auth
  const authDir = path.dirname(OWNER_AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  await page.goto('/');

  // Esperar a que cargue el formulario de login
  const emailInput = page.locator('input[type="email"]').first();
  await expect(emailInput).toBeVisible({ timeout: 15_000 });

  // Login
  await emailInput.fill(email);
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(password);

  const submitBtn = page.getByRole('button', { name: /iniciar sesión/i });
  await submitBtn.click();

  // Esperar a que se cargue el perfil (aparece el selector de sucursal o el dashboard)
  await page.waitForFunction(() => {
    const body = document.body.textContent || '';
    return (
      body.includes('Sucursal') ||
      body.includes('Torre de Control') ||
      body.includes('Onboarding') ||
      body.includes('Seleccionar')
    );
  }, { timeout: 20_000 });

  // Guardar estado
  await page.context().storageState({ path: OWNER_AUTH_FILE });
  console.log('✅ Auth setup completado — sesión guardada');
});

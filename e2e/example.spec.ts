import { test, expect } from '@playwright/test';

/**
 * Test de ejemplo para verificar que Playwright está configurado correctamente
 */
test('la página principal carga correctamente', async ({ page }) => {
  await page.goto('/');
  
  // Esperar a que la página cargue
  await page.waitForLoadState('networkidle');
  
  // Verificar que la página tiene contenido
  const body = page.locator('body');
  await expect(body).toBeVisible();
});

test('el título de la página es correcto', async ({ page }) => {
  await page.goto('/');
  
  // Verificar el título de la página (ajusta según tu aplicación)
  await expect(page).toHaveTitle(/Kiosco 24hs/i);
});


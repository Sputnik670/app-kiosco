import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Configuración de Playwright para App Kiosco
 *
 * Para correr los tests:
 *   1. Crear .env.test con TEST_OWNER_EMAIL y TEST_OWNER_PASSWORD
 *   2. npm run dev (en otra terminal)
 *   3. npm run test:e2e
 *
 * Para ver los tests en pantalla:
 *   npm run test:e2e:headed
 *   npm run test:e2e:ui
 */
export default defineConfig({
  testDir: './e2e',

  /* Timeout generoso — Supabase auth puede tardar */
  timeout: 60_000,
  expect: { timeout: 10_000 },

  fullyParallel: false, // Los smoke tests son secuenciales (comparten estado de DB)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1, // Secuencial para evitar conflictos de datos

  reporter: [
    ['html', { open: 'never' }],
    ['list'], // Muestra progreso en terminal
  ],

  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Mobile-first: el kiosquero usa celular
    ...devices['Pixel 5'],
  },

  projects: [
    // Setup: autenticación (se ejecuta primero)
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts/,
    },
    // Smoke tests principales (mobile)
    {
      name: 'smoke-mobile',
      dependencies: ['auth-setup'],
      use: {
        ...devices['Pixel 5'],
        storageState: path.join(__dirname, 'e2e/.auth/owner.json'),
      },
      testMatch: /smoke-.*\.spec\.ts/,
    },
    // Smoke tests en desktop (opcional)
    {
      name: 'smoke-desktop',
      dependencies: ['auth-setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, 'e2e/.auth/owner.json'),
      },
      testMatch: /smoke-.*\.spec\.ts/,
    },
    // Teardown: limpia datos de prueba (Test-PW-*, Proveedor-PW-*)
    {
      name: 'teardown',
      dependencies: ['smoke-mobile', 'smoke-desktop'],
      testMatch: /teardown\.ts/,
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

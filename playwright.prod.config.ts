import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración de Playwright para tests en PRODUCCIÓN
 *
 * IMPORTANTE: No usar webServer (prueba sitio ya desplegado)
 *
 * Uso:
 * npx playwright test --config=playwright.prod.config.ts
 *
 * Variables de entorno requeridas:
 * - TEST_BASE_URL (default: https://app-cadena-kiosco-24-7.vercel.app)
 * - TEST_EMPLOYEE_EMAIL
 * - TEST_EMPLOYEE_PASSWORD
 */
export default defineConfig({
  testDir: './e2e',

  /* Tests en producción son más lentos, ejecutar secuencialmente */
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry en producción para manejar flakiness de red */
  retries: 2,

  /* Workers limitados para no sobrecargar producción */
  workers: 1,

  /* Reporter to use */
  reporter: [
    ['html'],
    ['list']
  ],

  /* Timeout aumentado para producción */
  timeout: 60 * 1000, // 60 segundos por test

  /* Shared settings for all the projects below */
  use: {
    /* Base URL desde variable de entorno o default a producción */
    baseURL: process.env.TEST_BASE_URL || 'https://app-cadena-kiosco-24-7.vercel.app',

    /* Collect trace always en producción para debugging */
    trace: 'on',

    /* Screenshot siempre en producción */
    screenshot: 'on',

    /* Video siempre en producción */
    video: 'on',

    /* Timeouts de navegación aumentados */
    navigationTimeout: 30 * 1000,
    actionTimeout: 15 * 1000,
  },

  /* Solo Chromium para tests de producción (más rápido) */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* NO usar webServer en producción - el sitio ya está desplegado */
});


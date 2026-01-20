# 🧪 Tests E2E con Playwright

## 📋 Descripción

Este directorio contiene los tests end-to-end (E2E) para Kiosco 24hs usando Playwright. Los tests verifican el funcionamiento completo de la aplicación desde la perspectiva del usuario.

## 🚀 Inicio Rápido

### Prerrequisitos

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Instalar navegadores de Playwright**:
   ```bash
   npx playwright install
   ```

### Ejecutar Tests

```bash
# Ejecutar todos los tests
npm run test:e2e

# Ejecutar tests con UI interactiva
npm run test:e2e:ui

# Ejecutar tests en modo debug
npm run test:e2e:debug

# Ejecutar solo tests de QR Scanner
npm run test:e2e:qr

# Ejecutar tests en dispositivos móviles
npm run test:e2e:mobile
```

## 📁 Estructura

```
e2e/
├── qr-scanner.spec.ts      # Tests del flujo de QR Scanner
├── auth.spec.ts            # Tests de autenticación
├── registro-empleado.spec.ts # Tests de registro
├── helpers/                # Helpers reutilizables
│   └── qr-scanner.ts       # Helpers para tests de QR
├── setup/                  # Setup de tests
│   └── auth.setup.ts       # Autenticación para tests
└── README.md               # Este archivo
```

## 🎯 Tests de QR Scanner

Los tests de QR Scanner (`qr-scanner.spec.ts`) verifican:

1. **Generación de QR**: Que el dueño pueda generar QRs de entrada y salida
2. **Apertura del Scanner**: Que el empleado pueda abrir el scanner
3. **Detección de Errores**: Captura de errores de cámara y permisos
4. **Redirección**: Que después del escaneo se redirija correctamente
5. **Compatibilidad Móvil**: Tests específicos para iOS Safari

### Captura de Logs

Los tests capturan automáticamente:
- ✅ Logs de consola (`console.log`, `console.error`, etc.)
- ✅ Errores de página (`pageerror`)
- ✅ Requests fallidos
- ✅ Logs específicos del scanner QR

### Ejemplo de Salida

Cuando ejecutas los tests, verás logs como:

```
[CONSOLE log]: 📹 Video metadata cargada
[CONSOLE log]: ▶️ Video reproduciéndose
[CONSOLE log]: 🎯 onDecodeResult llamado
[CONSOLE log]: 🔍 QR detectado: /fichaje?sucursal_id=xxx&tipo=entrada
[CONSOLE log]: ✅ URL detectada, redirigiendo...
```

Si hay errores:

```
[PAGE ERROR]: NotAllowedError: Permission denied
[REQUEST FAILED]: https://api.example.com/endpoint
```

## 🔧 Configuración

### Variables de Entorno

Crea un archivo `.env.local` con:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=tu_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_key

# Tests (opcional)
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=password123
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000
```

### Configuración de Playwright

La configuración está en `playwright.config.ts`. Incluye:

- **Proyectos**: Desktop Chrome, Safari, Mobile Chrome, Mobile Safari
- **Trace**: Captura de trace en fallos
- **Screenshots**: Screenshots automáticos en fallos
- **Video**: Videos de sesiones fallidas

## 📱 Testing en Móviles

Playwright puede simular dispositivos móviles:

```bash
# Solo tests móviles
npm run test:e2e:mobile

# Test específico en iPhone
npx playwright test --project=mobile-safari e2e/qr-scanner.spec.ts
```

## 🐛 Debugging

### Modo Debug

```bash
npm run test:e2e:debug
```

Esto abre Playwright Inspector donde puedes:
- Ver el estado de la página
- Ejecutar comandos paso a paso
- Ver logs en tiempo real
- Inspeccionar elementos

### Ver Reporte HTML

```bash
npm run test:e2e:report
```

Esto abre un reporte HTML con:
- Screenshots de fallos
- Videos de sesiones
- Traces completos
- Logs de consola

## 📊 Interpretar Resultados

### Test Exitoso

```
✓ e2e/qr-scanner.spec.ts:5:3 › QR Scanner - Fichaje › Debería abrir el scanner QR como empleado (2.3s)
```

### Test Fallido

```
✘ e2e/qr-scanner.spec.ts:5:3 › QR Scanner - Fichaje › Debería abrir el scanner QR como empleado (5.2s)

Error: expect(received).toBeVisible()

Expected: visible
Received: hidden

  15 |     await expect(
> 16 |       page.locator('text=/escaneando/i')
     |            ^
  17 |     ).toBeVisible({ timeout: 10000 });
```

El reporte HTML incluirá:
- Screenshot del momento del fallo
- Video de la sesión completa
- Trace con todos los eventos

## 🔍 Troubleshooting

### "No se encontró el botón para abrir el scanner"

**Solución**: Agrega `data-testid="escanear-qr-button"` al botón en `components/vista-empleado.tsx`

### "Error de permisos de cámara"

**Solución**: Los tests no pueden acceder a la cámara real. Usa mocks o verifica que el componente maneje correctamente la ausencia de permisos.

### "Tests muy lentos"

**Solución**: 
- Usa `page.waitForLoadState('networkidle')` en lugar de `waitForTimeout`
- Reduce el número de proyectos ejecutados en paralelo
- Usa `test.setTimeout()` para tests específicos

## 📝 Agregar Nuevos Tests

1. **Crear archivo de test**:
   ```typescript
   // e2e/mi-test.spec.ts
   import { test, expect } from '@playwright/test';
   
   test('mi test', async ({ page }) => {
     await page.goto('/');
     // ...
   });
   ```

2. **Usar helpers**:
   ```typescript
   import { openQRScanner } from './helpers/qr-scanner';
   
   test('usar helper', async ({ page }) => {
     await openQRScanner(page);
   });
   ```

3. **Agregar data-testid**:
   Agrega `data-testid` a los componentes para facilitar los tests.

## 🎯 Próximos Pasos

- [ ] Agregar más tests para otros flujos
- [ ] Implementar mocks para cámara en tests
- [ ] Agregar tests de performance
- [ ] Integrar con CI/CD

## 📚 Recursos

- [Documentación de Playwright](https://playwright.dev/)
- [Guía de Testing](https://playwright.dev/docs/best-practices)
- [HERRAMIENTAS_QA_SEGURIDAD.md](../HERRAMIENTAS_QA_SEGURIDAD.md)

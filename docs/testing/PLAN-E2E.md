# Plan de Automatización E2E (Playwright)

> Roadmap para llegar a cobertura automatizada completa de la app. Se implementa iterativamente.
> Última actualización: 21 de abril de 2026

---

## Estado actual

### Tests automatizados existentes

| Spec | Cubre | Estado |
|------|-------|--------|
| `smoke-01-login-dashboard.spec.ts` | Login owner + navegación de 7 tabs | ✅ Activo |
| `smoke-02-crear-producto.spec.ts` | Alta de producto con stock | ✅ Activo |
| `smoke-03-caja-venta.spec.ts` | Abrir caja → venta → cerrar | ✅ Activo |
| `smoke-04-proveedores.spec.ts` | Crear proveedor + ver saldos | ✅ Activo |
| `smoke-05-empleados.spec.ts` | Invitar + listar + ranking | ✅ **NUEVO** — 21 abr |
| `smoke-06-misiones.spec.ts` | Ver misiones + XP + config rendimiento | ✅ **NUEVO** — 21 abr |
| `smoke-07-reportes.spec.ts` | Generar PDF + Excel | ✅ **NUEVO** — 21 abr |
| `qr-scanner*.spec.ts` | Scanner QR fichaje | ✅ Activo |
| `auth.spec.ts` | Auth básico | ✅ Activo |
| `registro-empleado.spec.ts` | Registro empleado | ✅ Activo |

### Cobertura estimada

- **Flujos críticos de demo:** 85% ✅
- **Módulos completos end-to-end:** 50%
- **Edge cases y errores:** 20%

---

## Qué falta por automatizar

### Prioridad Alta (próxima iteración)

#### 1. `smoke-08-sucursales.spec.ts`
- Crear 2da sucursal
- Cambiar entre sucursales
- Verificar aislamiento de datos (producto creado en A no aparece en B)
- **Criticidad:** Alta — es el selling point de "multi-sucursal"

#### 2. `smoke-09-servicios-virtuales.spec.ts`
- Widget SUBE: carga con comisión
- Widget recargas: seleccionar operadora
- Verificar que aparece en `service_sales` y en dashboard
- **Criticidad:** Alta — es el diferencial competitivo

#### 3. `smoke-10-facturacion.spec.ts`
- Crear comprobante interno desde venta existente
- Verificar que se genera PDF/HTML imprimible
- **Criticidad:** Media

#### 4. `smoke-11-scanner-barcode.spec.ts`
- Mockear el resultado del scanner (ya que no hay cámara en CI)
- Verificar que `lookupCatalogAction()` y `lookupOpenFoodFactsAction()` se llaman
- Verificar que el producto se crea con data del catálogo
- **Criticidad:** Alta — bug crítico fue arreglado en marzo, regresión sería costosa

### Prioridad Media

#### 5. `smoke-12-incidentes-descargo.spec.ts`
- Crear incidente (ajuste manual XP negativo)
- Login como empleado → ver incidente → escribir descargo
- Login como dueño → resolver con tipo
- **Criticidad:** Media — flujo complejo con 2 roles

#### 6. `smoke-13-vencimientos.spec.ts`
- Crear producto con fecha de vencimiento próxima
- Verificar que aparece en alertas
- Generar reporte de vencimientos
- **Criticidad:** Baja-Media

#### 7. `smoke-14-happy-hour.spec.ts`
- Configurar franja HH
- Hacer venta dentro de la franja
- Verificar descuento aplicado
- **Criticidad:** Baja

### Prioridad Baja (post-MVP)

- `smoke-15-mercadopago.spec.ts` — cuando el módulo esté listo
- `smoke-16-arca.spec.ts` — cuando el módulo esté listo
- `smoke-17-pwa-offline.spec.ts` — cuando se implemente PWA

---

## Gaps técnicos conocidos

Estos son los items que dificultan tests estables. Arreglarlos mejora la calidad de TODA la suite.

### Gap 1: Falta de `data-testid` en componentes

Los specs actuales dependen de selectores frágiles tipo `page.getByText(/facturación/i)`. Si cambia el copy, el test se rompe.

**Solución:** agregar `data-testid` a los elementos clave. Prioridad alta para:

- `data-testid="tab-ventas"`, `"tab-stock"`, etc. en el dashboard
- `data-testid="pdv-search"` en el buscador del punto de venta
- `data-testid="confirmar-venta"` en el botón principal
- `data-testid="invitar-empleado"` en el CTA
- `data-testid="asignar-mision"` en el flujo de misiones
- `data-testid="generar-pdf"`, `"generar-excel"` en reportes

Ver `e2e/helpers/test-ids.md` para la lista viva.

### Gap 2: No hay setup de data de test

Los tests asumen que la DB tiene al menos 1 sucursal, 1 producto, etc. Si corrés sobre una org vacía, fallan todos.

**Solución:** crear `e2e/setup/seed.ts` que idempotentemente crea:
- Organización "E2E Test Org"
- Sucursal "E2E Branch"
- 1 proveedor, 3 productos con stock
- 1 empleado invitado

Correr antes de cada suite. Limpiar con `teardown.ts`.

### Gap 3: Sólo se testea como owner

Hay toda una superficie (vista empleado, fichaje, descargos) que requiere sesión de empleado. Los specs actuales no hacen auth switching.

**Solución:** fixture de Playwright con dos sesiones autenticadas:

```ts
export const test = base.extend({
  ownerPage: async ({ browser }, use) => { /* sesión owner */ },
  employeePage: async ({ browser }, use) => { /* sesión empleado */ },
});
```

### Gap 4: No hay mocks de cámara

Los tests de scanner (barcode + QR fichaje) no pueden correr en CI headless sin cámara real. Los qr-scanner specs actuales intentan workarounds pero son frágiles.

**Solución:** usar el protocolo de Chromium para inyectar un video de muestra como `MediaStream`. Playwright soporta esto con `--use-fake-device-for-media-stream` y `--use-file-for-fake-video-capture=path.y4m`.

### Gap 5: Downloads no siempre detectados

El spec de reportes depende de `page.waitForEvent('download')`. Si el reporte se abre en nueva tab en lugar de descargar, el test no lo detecta.

**Solución:** doble check — si no hay download, verificar que apareció nueva página con content-type PDF.

---

## Cómo ejecutar la suite completa

```powershell
# Instalar dependencias (una vez)
npm install
npx playwright install

# Correr TODOS los tests
npm run test:e2e

# Correr sólo los smoke nuevos
npx playwright test smoke-05 smoke-06 smoke-07

# Modo UI interactivo (recomendado para debugging)
npm run test:e2e:ui

# Ver reporte HTML del último run
npm run test:e2e:report
```

### Variables de entorno requeridas

En `e2e/.env.test`:

```
PLAYWRIGHT_TEST_BASE_URL=https://app-kiosco-chi.vercel.app
TEST_USER_EMAIL=tu-email-de-test@gmail.com
TEST_USER_PASSWORD=tu-password-de-test
```

---

## Cuándo correr qué

| Contexto | Qué ejecutar | Duración |
|----------|--------------|----------|
| **Antes de un push a main** | `npm run test:e2e` completo | 5-10 min |
| **Antes de una demo** | `docs/testing/PRE-DEMO-CHECK.md` manual | 15 min |
| **Después de cambio grande** | QA-CHECKLIST manual completo + E2E | 90-120 min |
| **Cambio en 1 módulo** | Spec correspondiente sólo (`smoke-XX`) | 1-2 min |
| **Sanity check diario** | `smoke-01-login-dashboard` | 30 seg |

---

## Priorización para las próximas sesiones

**Sprint 1 (1-2 sesiones de trabajo):**
1. Agregar `data-testid` a componentes clave (Gap 1)
2. Implementar `e2e/setup/seed.ts` (Gap 2)
3. Escribir `smoke-08-sucursales` y `smoke-09-servicios-virtuales`

**Sprint 2 (1 sesión):**
4. Fixture de doble sesión owner/empleado (Gap 3)
5. Escribir `smoke-12-incidentes-descargo`

**Sprint 3 (iterativo):**
6. Resto de smoke specs según aparezcan bugs o módulos críticos

---

## Costo estimado

- Setup completo (gaps 1-3 resueltos + specs 08-12): ~6-8 horas de trabajo de IA asistida
- Mantenimiento mensual: ~1 hora (actualizar selectores cuando cambia UI)

El ROI es claro: **si un bug llega a producción porque no había test, el costo de reputación con un cliente piloto es mayor al de haber escrito el test.**

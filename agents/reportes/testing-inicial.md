# Reporte de Testing Inicial - App Kiosco

> Fecha: 2026-02-25
> Agente: kiosco-testing
> Framework: Vitest 4.0.18 + jsdom
> Cobertura previa: 0%

---

## Cobertura actual: 17.2% global | 100% auth-helpers | 93.6% ventas | 90.8% cash | 77.5% inventory

---

## 1. Setup realizado

| Componente | Estado |
|------------|--------|
| `vitest` + `@vitest/coverage-v8` | Instalado |
| `@testing-library/react` + `jsdom` | Instalado |
| `vitest.config.ts` | Creado (alias @/, jsdom, coverage v8) |
| `tests/setup.ts` | Creado (mock next/headers + logger) |
| `tests/mocks/supabase.ts` | Creado (mock chainable Supabase client) |
| `tests/unit/actions/` | 4 archivos de test |
| Scripts `test` y `test:coverage` | Agregados a package.json |

### Estructura de directorios

```
tests/
├── setup.ts                              — Mock global (next/headers, logger)
├── mocks/
│   └── supabase.ts                       — Mock chainable de Supabase client
├── unit/
│   └── actions/
│       ├── auth-helpers.test.ts           — 16 tests
│       ├── ventas.actions.test.ts         — 21 tests
│       ├── cash.actions.test.ts           — 22 tests
│       └── inventory.actions.test.ts      — 23 tests
├── integration/                           — (vacío, para P1)
└── unit/
    ├── repositories/                      — (vacío, para P1)
    └── services/                          — (vacío, para P2)
```

---

## 2. Tests creados y resultados

### auth-helpers.test.ts — 16/16 PASS

| Test | Resultado |
|------|-----------|
| verifyAuth: devuelve contexto para usuario autenticado | PASS |
| verifyAuth: lanza error si no hay sesión | PASS |
| verifyAuth: lanza error si getUser devuelve error | PASS |
| verifyAuth: lanza error sin organización | PASS |
| verifyAuth: lanza error si user.id es undefined | PASS |
| verifyOwner: permite acceso a owner | PASS |
| verifyOwner: rechaza employee | PASS |
| verifyOwner: rechaza sin sesión | PASS |
| verifyOwner: rechaza sin organización | PASS |
| verifyMembership: devuelve contexto completo | PASS |
| verifyMembership: devuelve role=owner | PASS |
| verifyMembership: lanza error sin sesión | PASS |
| verifyMembership: lanza error sin membership | PASS |
| verifyMembership: lanza error si query falla | PASS |
| getServerOrgId: devuelve org_id | PASS |
| getServerOrgId: lanza error si no hay org | PASS |

**Cobertura: 100% stmts, 100% branches, 100% functions, 100% lines**

### ventas.actions.test.ts — 21/21 PASS

| Test | Resultado |
|------|-----------|
| searchProducts: búsqueda exitosa | PASS |
| searchProducts: query vacío → lista vacía | PASS |
| searchProducts: sin branchId → error | PASS |
| searchProducts: sin auth → error | PASS |
| searchProducts: error Supabase | PASS |
| confirmSale: venta válida con RPC | PASS |
| confirmSale: sin items → error | PASS |
| confirmSale: sin branchId → error | PASS |
| confirmSale: sin cashRegisterId → error | PASS |
| confirmSale: total <= 0 → error | PASS |
| confirmSale: total negativo → error | PASS |
| confirmSale: sin auth → error | PASS |
| confirmSale: error RPC → error | PASS |
| confirmSale: método card | PASS |
| confirmSale: método transfer | PASS |
| confirmSale: método wallet | PASS |
| confirmSale: localId offline | PASS |
| getRecentSales: ventas recientes | PASS |
| getRecentSales: sin auth → error | PASS |
| getSaleDetail: detalle completo | PASS |
| getSaleDetail: sin auth → error | PASS |

**Cobertura: 93.6% stmts, 71.4% branches, 100% functions, 93.3% lines**

### cash.actions.test.ts — 22/22 PASS

| Test | Resultado |
|------|-----------|
| abrirCaja: apertura correcta | PASS |
| abrirCaja: sin auth → error | PASS |
| abrirCaja: falla INSERT → error | PASS |
| cerrarCaja: arqueo perfecto (diff <= $100) | PASS |
| cerrarCaja: arqueo fallido (diff > $100) | PASS |
| cerrarCaja: caja no existe | PASS |
| cerrarCaja: usuario no autorizado | PASS |
| cerrarCaja: sin auth → error | PASS |
| getCajaActiva: caja abierta | PASS |
| getCajaActiva: sin turno (PGRST116) | PASS |
| getCajaActiva: sin auth → error | PASS |
| createCashMovement: ingreso | PASS |
| createCashMovement: egreso | PASS |
| createCashMovement: monto <= 0 | PASS |
| createCashMovement: monto negativo | PASS |
| createCashMovement: descripción vacía | PASS |
| createCashMovement: tipo inválido | PASS |
| createCashMovement: sin turnoId | PASS |
| createCashMovement: sin auth → error | PASS |
| getShiftMovements: devuelve movimientos | PASS |
| getShiftMovements: sin cajaId | PASS |
| getShiftMovements: sin auth → error | PASS |

**Cobertura: 90.8% stmts, 73.0% branches, 84.6% functions, 90.6% lines**

### inventory.actions.test.ts — 23/23 PASS

| Test | Resultado |
|------|-----------|
| handleProductScan: barcode encontrado | PASS |
| handleProductScan: barcode no existe | PASS |
| handleProductScan: barcode vacío | PASS |
| handleProductScan: sin organizationId | PASS |
| handleProductScan: sin sucursalId | PASS |
| handleProductScan: error repositorio | PASS |
| handleProductScan: case-insensitive | PASS |
| getStockSummary: stock agregado multi-producto | PASS |
| getStockSummary: lista vacía → [] | PASS |
| getStockSummary: error DB → stock 0 | PASS |
| getStockSummary: agrega lotes FIFO | PASS |
| processComplexStockEntry: entrada correcta | PASS |
| processComplexStockEntry: actualiza costo | PASS |
| processComplexStockEntry: falla entrada | PASS |
| processComplexStockEntry: sin auth → error | PASS |
| getExpiringStock: stock próximo a vencer | PASS |
| getExpiringStock: sin auth → error | PASS |
| getCriticalStock: stock < 7 días | PASS |
| getCriticalStock: sin branchId | PASS |
| getCriticalStock: sin auth → error | PASS |
| processStockLoss: marca como damaged | PASS |
| processStockLoss: sin stockId | PASS |
| processStockLoss: sin auth → error | PASS |

**Cobertura: 77.5% stmts, 59.8% branches, 66.7% functions, 79.4% lines**

---

## 3. Cobertura por archivo

| Archivo | % Stmts | % Branch | % Funcs | % Lines | Estado |
|---------|---------|----------|---------|---------|--------|
| `auth-helpers.ts` | **100** | **100** | **100** | **100** | Completo |
| `ventas.actions.ts` | **93.6** | 71.4 | **100** | **93.3** | Bueno |
| `cash.actions.ts` | **90.8** | 73.0 | 84.6 | **90.6** | Bueno |
| `inventory.actions.ts` | 77.5 | 59.8 | 66.7 | 79.4 | Aceptable |
| `shift.actions.ts` | 0 | 0 | 0 | 0 | Pendiente |
| `attendance.actions.ts` | 0 | 0 | 0 | 0 | Pendiente |
| `stats.actions.ts` | 0 | 0 | 0 | 0 | Pendiente |
| Otros (10 archivos) | 0 | 0 | 0 | 0 | Pendiente |

---

## 4. Bugs encontrados durante testing

Ninguno. Los tests validan el comportamiento esperado correctamente.

---

## 5. Tests P1 pendientes

| Prioridad | Archivo | Tests a crear |
|-----------|---------|---------------|
| P1 | `shift.actions.ts` | openShift, closeShift con arqueo, getActiveShift |
| P1 | `attendance.actions.ts` | toggle entrada/salida, QR scan, status check |
| P1 | `product.actions.ts` | CRUD productos, búsqueda barcode, role checks |
| P1 | `missions.actions.ts` | crear misión, completar, XP rewards |
| P1 | `auth.actions.ts` | login, signup, invitar empleado, remove |
| P2 | `stats.actions.ts` | ranking batch, owner stats |
| P2 | `dashboard.actions.ts` | métricas de dashboard |
| P2 | `reports.actions.ts` | generación PDF/Excel |
| P2 | `invoicing.actions.ts` | facturación ARCA |
| P2 | `provider.actions.ts` | gestión proveedores |

---

## 6. Comandos

```bash
# Ejecutar todos los tests
npm test

# Ejecutar con watch mode
npm run test:watch

# Ejecutar con cobertura
npm run test:coverage

# Ejecutar un archivo específico
npx vitest run tests/unit/actions/ventas.actions.test.ts
```

---

## 7. Resumen

| Métrica | Valor |
|---------|-------|
| Tests totales | 82 |
| Tests pasando | 82 (100%) |
| Tests fallando | 0 |
| Archivos testeados | 4 (auth-helpers, ventas, cash, inventory) |
| Archivos sin tests | 12 |
| Cobertura global (stmts) | 17.2% |
| Cobertura archivos P0 (promedio) | 90.5% |
| Tiempo de ejecución | ~2s |

---

*Reporte generado por el agente kiosco-testing. 82 tests P0 creados y pasando.*

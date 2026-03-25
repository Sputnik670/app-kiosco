# Estado del Proyecto — App Kiosco

> **Este es tu mapa. Cuando te sientas perdido, vení acá.**
> Última actualización: 25 de marzo de 2026

---

## Qué es esto

SaaS de gestión para cadenas de kioscos en Argentina. Cloud, mobile-first, con servicios virtuales integrados y gamificación de empleados. Único en el mercado.

**URL producción:** https://app-kiosco-chi.vercel.app
**Repo:** https://github.com/Sputnik670/app-kiosco.git
**Supabase:** proyecto `vrgexonzlrdptrplqpri` (sa-east-1)

---

## Módulos y su Estado

### FUNCIONANDO (listos para demo/piloto)

| Módulo | Qué hace | Archivos clave |
|--------|----------|----------------|
| **Punto de Venta** | Vender productos, scanner, métodos de pago | `caja-ventas.tsx` / `ventas.actions.ts` |
| **Inventario + Scanner** | Productos, stock, scanner barcode con auto-fill OpenFoodFacts + catálogo compartido | `crear-producto.tsx` / `product.actions.ts` |
| **Proveedores** | Alta, saldo, historial de pagos | `gestion-proveedores.tsx` / `provider.actions.ts` |
| **Dashboard Dueño** | Ventas del día, margen, tendencias, timeline | `dashboard-dueno.tsx` / `dashboard.actions.ts` |
| **Reportes** | PDF y Excel de ventas, stock, vencimientos | `reports/` / `reports.actions.ts` |
| **Empleados** | Invitar, roles, permisos por sucursal | `invitar-empleado.tsx` / `employee.actions.ts` |
| **Fichaje QR** | Control de asistencia con QR impreso | `generar-qr-fichaje.tsx` / `qr-fichaje-scanner.tsx` |
| **Gamificación** | Misiones, ranking, badges, capital, Happy Hour | `misiones-empleado.tsx` / `team-ranking.tsx` |
| **Multi-sucursal** | Crear/gestionar sucursales, datos aislados | `gestion-sucursales.tsx` / `branch.actions.ts` |
| **Servicios Virtuales** | SUBE + recargas con comisión configurable | `widget-sube.tsx` / `service.actions.ts` |
| **Facturación interna** | Comprobantes internos (NO fiscal) | `facturacion/` / `invoicing.actions.ts` |

### EN DESARROLLO

| Módulo | Estado | Qué falta |
|--------|--------|-----------|
| **Mercado Pago QR** | OAuth implementado, webhook activo | Testear flujo completo de pago en producción |
| **ARCA** | Configuración y servicio base | Completar flujo de facturación electrónica |

### PLANIFICADO (no arrancado)

| Módulo | Prioridad | Nota |
|--------|-----------|------|
| **Modo offline / PWA** | Alta | Docs de implementación listos en `.skills/pwa-implementation/` |

### DESCARTADO

| Módulo | Por qué | Fecha |
|--------|---------|-------|
| Actualización masiva de precios | Decisión de Ram | 17 marzo 2026 |
| Facturación fiscal AFIP | Se integrará con servicios existentes si hace falta | Marzo 2026 |
| Hardware propietario | No es nuestro modelo | Marzo 2026 |

---

## Estructura del Proyecto

```
App-kiosco-main/
├── app/                    → Rutas de Next.js (App Router)
│   ├── page.tsx            → Entrada principal (auth + routing)
│   └── api/                → API routes (mercadopago, productos)
├── components/             → Componentes React (74 archivos)
│   ├── dashboard/          → Tabs del dashboard del dueño
│   ├── facturacion/        → Facturación interna
│   ├── pwa/                → Componentes PWA
│   └── reports/            → Generación de reportes
├── lib/
│   ├── actions/            → Server actions (23 archivos) ← LÓGICA DE NEGOCIO
│   ├── offline/            → IndexedDB, sync, cache (módulo offline)
│   └── repositories/       → Acceso a datos (browser client)
├── hooks/                  → Custom React hooks
├── agents/                 → 4 agentes activos + conocimiento + archivo
├── .skills/                → Skills del proyecto (ver abajo)
├── docs/
│   ├── comercial/          → Guión demo, ventajas, legales (.docx)
│   └── archivo/            → Docs viejos archivados
├── e2e/                    → Tests E2E (Playwright)
├── tests/                  → Tests unitarios (Vitest)
├── supabase/migrations/    → 7 migraciones SQL
├── CLAUDE.md               → Instrucciones para Claude (tech-leader)
├── ESTADO_PROYECTO.md      → ESTE ARCHIVO (mapa del proyecto)
└── AUDIT-FINDINGS.md       → Hallazgos de seguridad y performance
```

---

## Agentes: 4 Activos + Base de Conocimiento

Los agentes están en `agents/` y son instrucciones que Claude sigue en momentos específicos del flujo de trabajo.

| Agente | Para qué | Cuándo se usa |
|--------|----------|---------------|
| **inicio-sesion** | Sync git, reportar estado, pendientes | SIEMPRE al abrir el proyecto |
| **revision-codigo** | Patrones, reglas de seguridad, bugs conocidos | ANTES de escribir o modificar código |
| **pre-deploy** | Checklist de seguridad, tests, compilación | ANTES de pushear a main |
| **comercial** | Competencia, onboarding, demos, precios | Al preparar demos o hablar con clientes |

**Base de conocimiento** (`agents/conocimiento/`): 9 archivos con bugs conocidos, decisiones tomadas, patrones de código, proceso de onboarding, métricas, competencia e integraciones. Es la memoria del proyecto que los 4 agentes consultan.

**Reportes históricos** (`agents/reportes/`): 16 reportes de auditorías previas (feb-marzo 2026).

**Agentes archivados** (`agents/archivo/`): Los 17 agentes originales (orquestador, arquitectura, database, seguridad, etc.) están archivados. Su contenido útil se absorbió en los 4 agentes activos y la base de conocimiento.

---

## Skills del Proyecto

| Skill | Dónde | Para qué |
|-------|-------|----------|
| **competitive-research** | `.skills/competitive-research/` | Análisis de competidores |
| **git-sync** | `.skills/git-sync/` | Sincronizar repo entre PCs |
| **pwa-implementation** | `.skills/pwa-implementation/` | Docs para implementar offline |

---

## Testing

| Tipo | Framework | Archivos | Estado |
|------|-----------|----------|--------|
| **Unit tests** | Vitest | `tests/unit/` (7 tests) | Funcionales, cubren auth, caja, inventario, ventas, offline |
| **E2E Smoke** | Playwright | `e2e/smoke-01` a `smoke-04` | Funcionales, cubren login→producto→venta→proveedores |
| **E2E Viejos** | Playwright | `e2e/auth.spec.ts`, `qr-scanner*.spec.ts` | ARCHIVADOS (obsoletos, reemplazados por smoke) |

Para correr tests: `npm test` (vitest) o `npm run test:e2e` (playwright).

---

## Documentos Comerciales

En `docs/comercial/`:
- `guion-demo-completo.docx` — Guión de presentación paso a paso (14 pasos + objeciones)
- `ventajas-competitivas.docx` — 7 razones para elegirnos (con tabla comparativa)
- `documentacion-legal.docx` — Términos, privacidad, SLA (placeholders para nombre/CUIT)

---

## Pendientes Concretos (en orden de prioridad)

### Para el piloto
1. ~~Testear Mercado Pago QR en producción con pago real~~ (en curso)
2. Aplicar fixes de seguridad DB del AUDIT-FINDINGS.md (RLS de incidents, owner_notes, MP credentials)
3. Aplicar optimizaciones de performance del AUDIT-FINDINGS.md (dynamic imports)
4. Probar con el primer cliente real

### Para después del piloto
5. Modo offline / PWA con sync
6. Evaluar cuentas corrientes (fiado) si hay demanda
7. Evaluar integración con facturación fiscal si hay demanda

### Infraestructura
8. Comprar dominio propio
9. Email profesional (soporte@)
10. Definir nombre de marca

---

## Decisiones Importantes Tomadas

| Fecha | Decisión | Por qué |
|-------|----------|---------|
| Mar 17 | Descartar actualización masiva de precios | Decisión de Ram |
| Mar 2026 | Facturación AFIP = integrarse, no construir | Demasiado complejo, mejor usar Facturalo Simple/Alegra |
| Mar 2026 | Catálogo precargado y fiado = posponer | El onboarding personalizado cubre eso por ahora |
| Mar 2026 | Precio $199/mes por cadena completa | Competencia cobra $15k/mes por sucursal |
| Mar 2026 | Primer mes gratis | Reducir barrera de entrada |
| Mar 19 | Limpieza y reorganización del proyecto | Docs archivados, estructura docs/, ESTADO_PROYECTO.md creado |
| Mar 19 | Fixes: margen, N+1, injection, branchId, touch targets | Auditoría de código, 7 fixes aplicados |
| Mar 19 | Docs comerciales creados | Guión demo, ventajas competitivas, legales (.docx) |
| Mar 19 | Skill git-sync creado | Sincronización automática entre PCs |
| Mar 25 | Scanner barcode: fix OpenFoodFacts (server-side) | Fetch desde browser fallaba silenciosamente → movido a server action |
| Mar 25 | Catálogo compartido `product_catalog` | Tabla Supabase compartida entre todos los usuarios para auto-fill de productos por barcode |
| Mar 25 | Flujo scanner: catálogo propio → OFF → manual | 3 pasos de búsqueda al escanear código de barras |

---

## Competidor Principal

**Sistar Simple** (sistar.com.ar) — Cloud, multi-sucursal. Tiene AFIP y fiado, no tiene servicios virtuales ni gamificación. Precio estimado $15k/mes por sucursal vs nuestros $199/mes por toda la cadena.

Análisis completo en: `.skills/competitive-research/reports/`

---

> Si algo de acá no está claro o no coincide con la realidad, decile a Claude que lo actualice.

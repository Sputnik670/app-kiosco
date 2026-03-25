# Historial de Decisiones Producto

Documento que registra todas las decisiones de producto, estrategia y arquitectura. Incluye por qué se hizo, cuándo se hizo, y estado actual.

---

## Decisiones Estratégicas Aprobadas

### 1. Stack: Next.js + React 19 + TypeScript

**Cuándo**: Enero 2025
**Quién aprobó**: Ram (dueño/tech-lead)
**Estado**: IMPLEMENTADO

**Por qué**:
- React 19 = nuevas features (Server Components, actions)
- TypeScript = type safety para kiosqueros no-dev
- Next.js App Router = server actions sin API routes explícitas
- Vercel deploy = push a main = deploy automático (cero DevOps)

**Alternativas descartadas**:
- Vue: menos ecosystem para Argentina
- SvelteKit: más pequeño, menos soporte
- Express.js: requiere full DevOps

**Impacto**: Decisión fundacional, no reversible sin rewrite total.

---

### 2. Supabase para Backend (Auth PKCE + PostgreSQL + RLS)

**Cuándo**: Enero 2025
**Quién aprobó**: Ram
**Estado**: IMPLEMENTADO

**Por qué**:
- PostgreSQL = estable, bien conocida
- Supabase Auth = OAuth2 PKCE (no API keys)
- RLS = seguridad a nivel DB (policy + query)
- Serverless = cero infraestructura

**Alternativas descartadas**:
- Firebase: Firestore no es RDBMS, costos altos
- PlanetScale: MySQL, menos control
- AWS RDS: requiere DevOps

**Arquitectura RLS**:
```sql
-- Cada tabla filtra por org_id + user_id
-- Ejemplo: usuarios de org A NO ven datos de org B
```

---

### 3. Mobile-First Design

**Cuándo**: Enero 2025
**Quién aprobó**: Ram
**Estado**: IMPLEMENTADO

**Por qué**:
- El kiosquero usa celular, no PC
- WiFi débil en kioscos → PWA offline
- Arquitectura táctil (botones 44x44px mínimo)

**Impacto en desarrollo**:
- Tailwind mobile-first breakpoints
- Test siempre a 360px (Pixel 5)
- touch-friendly inputs
- Colores high-contrast (exterior + sol)

---

### 4. OAuth para Mercado Pago (no tokens manuales)

**Cuándo**: Marzo 2026
**Quién aprobó**: Ram
**Estado**: IMPLEMENTADO

**Por qué**:
- Kiosquero NO es developer
- No tiene cuenta developer en MP
- OAuth flow = "Conectar con MP" con cuenta normal
- Token se cifra en DB, nunca se expone al cliente

**Alternativa descartada**:
- Pedir al kiosquero que genere API keys → riesgo, confusión

**Implementación**:
```typescript
// Usuario toca: "Conectar con MP"
// → OAuth redirect a MP
// → Usuario autoriza
// → Callback: token se cifra, se guarda
```

---

### 5. Servicios Virtuales con Comisión Integrada

**Cuándo**: Febrero 2026
**Quién aprobó**: Ram
**Estado**: IMPLEMENTADO (SUBE + Cargas Virtuales)

**Por qué**:
- Diferenciador único → ningún competidor integra SUBE + recargas + stock
- Kiosquero puede vender servicios SIN salir de la app
- Comisión automática: marca_pago - comisión = ganancia neta
- Argentina: SUBE es crítica, recargas son 30% de ventas kiosquero

**Tabla unificada**: `service_sales` (para SUBE, Cargas Virtuales, futuros)

**Comisión por proveedor**:
```typescript
provider.markup_type: 'percentage' | 'fixed'
provider.markup_value: 2.5 | 50 // % o pesos

// Cálculo:
commission = type === 'percentage'
  ? (amount * value) / 100
  : value
```

---

### 6. Gamificación de Empleados

**Cuándo**: Noviembre 2024 (fase pre-piloto)
**Quién aprobó**: Ram
**Estado**: IMPLEMENTADO

**Características**:
- Misiones (semanales/diarias)
- Ranking de equipos
- Capital (puntos) → badges/rewards
- Happy Hour (happy hour challenge entre sucursales)

**Por qué**:
- Diferenciador único → único en el segmento a nivel mundial
- Kiosqueros = trabajadores jóvenes → gamificación es motivador
- Ayuda a retener talento en cadena

**Impacto**: Uso recurrente, engagement, NPS positivo

---

### 7. Multi-Sucursal desde Día 1

**Cuándo**: Enero 2025
**Quién aprobó**: Ram
**Estado**: IMPLEMENTADO

**Por qué**:
- Target: cadenas de kioscos (no kioscos individuales)
- Visibilidad central: dueño ve todas las sucursales
- Control de stock: traspasar entre sucursales
- Reportes consolidados

**Estructura**:
```
organizations (cadena)
  ├── branches (cada kiosco)
  │   ├── products (stock por sucursal)
  │   ├── sales
  │   ├── employees
  │   └── ...
  └── reports (consolidados)
```

---

### 8. PWA + Offline Completo (Planificado)

**Cuándo**: Enero 2025 (decision), Marzo 2026 (roadmap)
**Quién aprobó**: Ram
**Estado**: ROADMAP (no iniciado)

**Por qué**:
- WiFi mala en kioscos
- Kiosquero no puede parar si cae internet
- Sincronización automática al reconectar

**Implementación futura**:
- Service Worker + IndexedDB
- Queue de transacciones offline
- Sync automático: intenta enviar cada 10s

---

## Decisiones Descartadas (Con Motivo)

### 1. Facturación AFIP/ARCA

**Descartada**: Enero 2025
**Razón**: Fuera de scope
**Decisión**: La app es gestión + visibilidad, NO facturación fiscal

**Evidencia**:
- Kiosqueros no necesitan factura fiscal (venta al público)
- Cadenas grandes usan sistemas separados (Facturalo Simple, Alegra)
- Integración AFIP = complejidad + mantenimiento
- ROI bajo para MVP

**Si futura necesidad**:
- Integración con Facturalo Simple (API REST)
- O Alegra (SaaS argentino)
- Nunca build in-house

---

### 2. Hardware Propietario (Impresoras Fiscales)

**Descartada**: Enero 2025
**Razón**: Alto costo, baja adopción

**Alternativa**: Imprimir en cualquier printer WiFi + papel térmica

**Problema original**:
- Impresoras fiscales = $5k USD+
- Cada sucursal necesita una
- Baja adopción en kioscos

---

### 3. ERP Contable Completo

**Descartada**: Enero 2025
**Razón**: Fuera de scope, especialista en contabilidad necesario

**Qué sí hacemos**: Reportes operativos (ventas diarias, stock, comisiones)
**Qué NO hacemos**: Asientos contables, balance sheet, impuestos

**Kiosquero sigue usando**: Contador tradicional para impuestos

---

### 4. Catálogo Precargado de Productos

**Descartada**: Enero 2025, Pospuesto indefinidamente
**Razón**: Costo operacional + mantenimiento de datos

**Realidad**:
- Cada kiosquero tiene productos diferentes
- Marcas locales varían mucho por región
- Precios cambian semanalmente (inflación Argentina)

**Solución actual**: Onboarding personalizado con Ram
- Ram ayuda a cargar stock manual
- 15-30 min presencial/videollamada
- Costo: absorbe Ram (diferenciador de servicio)

---

### 5. Cuentas Corrientes de Clientes (Fiado)

**Descartada**: Enero 2025, Pospuesto indefinidamente
**Razón**: Complejo + requiere cobranza, compliance

**Realidad**:
- Algunos kiosqueros venden fiado
- Requiere sistema de cobranza, recordatorios, deuda
- Risk: malas deudas, compliance con leyes de protección de datos

**Solución actual**: Onboarding personalizado con Ram
- Ram diseña proceso manual compatible con app
- Futuro: si hay demanda, revisar

---

### 6. OpenClaw Integration

**Descartada**: Marzo 2026
**Razón**: Riesgos de seguridad + no aporta al caso de uso

**Investigación**:
- OpenClaw = proveedor AI/automation
- Ofrece: skills, agents, workflows
- Riesgos encontrados:
  - Data exfiltration (credenciales guardadas inseguro)
  - Exposed instances (webhooks sin auth)
  - Malicious skills (código no auditado)
  - Vendor lock-in

**Caso de uso**: "Automatizar tareas repetitivas"
- Ya solucionado con server actions + cron jobs
- No necesitamos external skills

**Decisión**: Mantener arquitectura interna, control total

---

### 7. Integración con Sistemas de POS Legacy

**Descartada**: Enero 2025
**Razón**: Incompatibles, baja ROI, migrante mejor

**Sistemas legacy encontrados**:
- MaxKiosco (Windows local, sin API)
- Sistema X (propietario, no documentado)
- Libreta + calculadora (aún mayoría)

**Decisión**: Migración zero-trust
- No integramos con legacy
- Ofrecemos onboarding cero-fricción
- Kiosquero empieza de cero en App Kiosco

---

## Decisiones Reversibles (Pueden Cambiar)

### 1. Push automático a main = deploy

**Estado**: APROBADO, pero puede cambiar
**Cuándo cambiar**: Si hay errores en prod (bugs no detectados)

**Alternativa futura**:
```
main → staging
staging → testing manual 24h
staging → prod (manual approval)
```

**Decisión actual**: Con MVP pequeño, push automático OK. Revisar en Q2 2026.

---

### 2. Comisión Fija por Proveedor

**Estado**: SIMPLE Y FUNCIONAL

**Alternativa futura**:
- Comisión dinámica por vendedor (si empleado vende más, más comisión)
- Comisión por horario (happy hour = 2x)
- Comisión por meta (si cadena vende X, comisión baja)

**Decidir en**: Piloto real (después primer mes)

---

### 3. RLS Policy a Nivel org_id

**Estado**: SEGURO, pero granular

**Alternativa futura**:
- RLS a nivel branch (cada sucursal datos separados)
- RLS a nivel user (cada empleado ve solo su turno)

**Decidir en**: Cuando escale a 10+ sucursales por cadena

---

## Decisiones Por Revisar Pronto

### 1. Vercel Free Tier Limits

**Current**:
- Deployments: unlimited
- Functions: 100GB-hours/month ✓
- Bandwidth: 1TB/month ✓
- Build time: 6000 minutes/month ✓

**Cuándo escalar**: Si > 100 usuarios concurrentes
**Costo estimado**: $20-50/mes con Pro

---

### 2. Supabase Free Tier Limits

**Current**:
- Database: 500MB ✓
- Auth: unlimited ✓
- RLS: unlimited ✓
- Backups: 7 días ✓

**Cuándo escalar**: Si > 500M de datos (datos históricos)
**Costo estimado**: $25-100/mes con Pro

---

### 3. Precio del Producto

**Estado**: NO DEFINIDO AÚN

**Opciones evaluadas**:
- Freemium: gratis 1 mes, luego $99/mes
- Subscription: $99/mes por cadena (todas sucursales)
- Pay-as-you-go: $0.05 por venta (competidor Sistar)

**Decisión**: Después del piloto real
- Necesitamos ver: retención, soporte, COGS
- Target: margen 40%+ (SaaS standard)

---

## Matriz de Decisiones

| Decisión | Estado | Crítica | Reversible | Review |
|----------|--------|---------|-----------|--------|
| Tech Stack | Aprobado | ✓ | ✗ | No |
| Supabase | Aprobado | ✓ | ✗ | No |
| Mobile-First | Aprobado | ✓ | ✗ | No |
| MP OAuth | Aprobado | ✓ | ✓ | No |
| Gamificación | Aprobado | ✗ | ✓ | Sí (post-piloto) |
| Multi-Sucursal | Aprobado | ✓ | ✓ | No |
| Push automático | Aprobado | ✗ | ✓ | Sí (Q2 2026) |
| Servicios Virtuales | Aprobado | ✗ | ✓ | No |
| Precio | Pendiente | ✓ | ✓ | Sí (post-piloto) |
| Offline | Roadmap | ✗ | ✓ | Sí (Q2 2026) |

---

## Quién Aprueba Qué

| Actor | Rol | Aprueba |
|-------|-----|---------|
| Ram | Dueño / Tech-lead | Todas las decisiones, features, roadmap, precio |
| Claude (Agent) | Desarrollador | Implementación, patterns, bugs |

**Proceso de aprobación**:
1. Claude propone cambio en issue/thread
2. Ram lo revisa (24-48h)
3. Ram aprueba en chat o Vercel
4. Claude implementa
5. Push a main = deploy automático

---

## Decisiones Recientes (Marzo 2026)

### 9. Descarte de Actualización Masiva de Precios

**Cuándo**: 2026-03-17
**Quién aprobó**: Ram
**Estado**: DESCARTADO

**Por qué**:
- El componente `actualizacion-masiva-precios.tsx` existe pero no se continúa desarrollando
- La funcionalidad no aporta al caso de uso principal del kiosquero
- Los precios se actualizan producto por producto o durante onboarding

---

### 10. Timeline Unificada como Vista Principal del Dueño

**Cuándo**: 2026-03-17
**Quién aprobó**: Ram (implementado)
**Estado**: IMPLEMENTADO

**Por qué**:
- El dueño necesita ver TODO lo que pasó en un día en un solo lugar
- Antes: tenía que navegar entre ventas, inventario, equipo por separado
- Ahora: timeline cronológica con 7 tipos de eventos + resumen diario

**Impacto**: Mejora significativa en la experiencia del dueño. Reduce tiempo de revisión diaria.

---

### 11. Sistema de Incidentes Owner↔Employee

**Cuándo**: 2026-03-17
**Quién aprobó**: Ram (implementado)
**Estado**: IMPLEMENTADO

**Por qué**:
- El dueño necesita reportar problemas (diferencias de caja, pérdidas de stock) al empleado
- El empleado necesita poder justificarse
- Trazabilidad: queda registro de incidentes y resoluciones
- Complementa gamificación: incidentes afectan ranking de equipo

---

### 12. Diario del Dueño (Notas)

**Cuándo**: 2026-03-17
**Quién aprobó**: Ram (implementado)
**Estado**: IMPLEMENTADO

**Por qué**:
- El dueño anotaba cosas en cuaderno o WhatsApp
- Ahora tiene un sistema integrado con categorías y calendario
- Las notas aparecen en la timeline → contexto completo del día

---

### 13. Renombre "Panel de Control" → "Torre de Control"

**Cuándo**: 2026-03-16
**Quién aprobó**: Ram
**Estado**: IMPLEMENTADO

**Por qué**: Mejor branding. "Torre de Control" transmite visibilidad y autoridad sobre el negocio.

---

### 14. Rate Limiting y Validación Zod Implementados

**Cuándo**: 2026-03-17
**Quién aprobó**: Claude (implementación técnica, decisión de seguridad)
**Estado**: IMPLEMENTADO

**Por qué**:
- Rate limiting: 10 req/min para auth, 60 req/min para API → previene abuso
- Zod schemas: validación de todos los inputs antes de llegar a la DB → previene inyección
- Ambos eran pendientes P1 de la auditoría de seguridad de Feb 2025

---

### 15. Descarte de Actualización Masiva de Precios

**Cuándo**: 2026-03-17
**Quién aprobó**: Ram
**Estado**: DESCARTADO

**Por qué**: El dueño decidió no continuar con esta feature. Componente stubbed, 420 líneas de código muerto eliminadas de product.actions.ts.

---

### 16. Fixes de Auditoría de Código (7 correcciones)

**Cuándo**: 2026-03-19
**Quién aprobó**: Ram
**Estado**: IMPLEMENTADO

**Fixes aplicados**:
- Dashboard: margen hardcodeado → lee unit_cost real de sale_items
- tab-historial: N+1 queries → batch con .in() + Promise.all
- ventas.actions: filter injection → sanitizado en .or() query
- reports.actions: branchId sin validar → validateBranchOwnership()
- user.actions: console.log con emails → eliminados
- tab-timeline: touch targets chicos → mínimo 36px
- product.actions: 420 líneas de código muerto → eliminadas

---

### 17. Reorganización del Proyecto

**Cuándo**: 2026-03-19
**Quién aprobó**: Ram
**Estado**: IMPLEMENTADO

**Qué se hizo**:
- Creado `ESTADO_PROYECTO.md` como mapa central del proyecto
- 7 docs obsoletos de la raíz archivados en `docs/archivo/`
- 3 docs comerciales organizados en `docs/comercial/`
- Tests E2E obsoletos (7) archivados, smoke tests (4) conservados
- Creado skill `git-sync` para sincronización multi-PC
- Actualizado CLAUDE.md con contexto actual
- Limpieza de screenshots y credenciales en archivos de test

---

### 18. Scanner Barcode: Fetch Server-Side (no client)

**Cuándo**: 2026-03-25
**Quién aprobó**: Ram (testeó en producción)
**Estado**: IMPLEMENTADO

**Problema**: El `fetch()` a OpenFoodFacts desde el browser del celular fallaba silenciosamente porque `User-Agent` es un header prohibido en la Fetch API del browser. Probado con 10+ productos, todos devolvían "no encontrado".

**Decisión**: Mover TODOS los fetch a APIs externas a server actions. El request sale del servidor de Vercel (Node.js), donde no hay restricciones de headers ni CORS.

**Regla nueva**: NUNCA hacer `fetch()` a APIs externas desde componentes `"use client"` en mobile. Siempre usar server actions.

**Impacto**: Scanner ahora funciona al 100% en iOS Safari y Android Chrome.

---

### 19. Catálogo Compartido de Productos (product_catalog)

**Cuándo**: 2026-03-25
**Quién aprobó**: Ram
**Estado**: IMPLEMENTADO

**Qué es**: Tabla Supabase compartida entre TODAS las organizaciones. Cuando un usuario crea un producto con código de barras, la info (nombre, marca, categoría) se guarda en esta tabla. Cualquier otro usuario que escanee el mismo código obtiene auto-fill.

**Por qué**:
- OpenFoodFacts tiene poca cobertura de productos argentinos (barcode 779)
- Cada producto cargado por un usuario beneficia a todos
- Efecto red: cuantos más usuarios, mejor la base de datos
- Ventaja competitiva vs competidores

**Flujo de escaneo**:
1. ¿Ya existe en mi catálogo? → avisa
2. ¿Está en catálogo compartido? → auto-fill
3. ¿Está en OpenFoodFacts? → auto-fill
4. No encontrado → completar manual → se guarda para todos

**Tabla**: `product_catalog` (barcode UNIQUE, name, brand, category, emoji, source, contributed_by)

---

### 20. Documentación Comercial Creada

**Cuándo**: 2026-03-19
**Quién aprobó**: Ram
**Estado**: COMPLETADO

**Documentos creados** (en `docs/comercial/`):
- `guion-demo-completo.docx` — 14 pasos + objeciones + checklist
- `ventajas-competitivas.docx` — 7 razones con tabla comparativa
- `documentacion-legal.docx` — Términos, privacidad (Ley 25.326), SLA
- Todos con placeholders para nombre de marca y CUIT (TBD)
- Modelo: $199/mes por cadena, primer mes gratis, monotributista


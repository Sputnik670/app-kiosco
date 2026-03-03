# Agentes de Optimización - App Kiosco

Sistema de 17 agentes especializados para llevar la app de prueba a producto SaaS listo para escalar a +10 cadenas de kioscos.

## Mapa de agentes

### Coordinación
| # | Agente | Carpeta | Responsabilidad |
|---|--------|---------|-----------------|
| 1 | **Orquestador** | `kiosco-orquestador/` | CTO virtual. Coordina a todos, decide prioridades, delega al agente correcto |

### Capa de personas (quién usa el producto)
| # | Agente | Carpeta | Responsabilidad |
|---|--------|---------|-----------------|
| 2 | **Persona Dueño** | `kiosco-persona-dueno/` | Piensa como Beto, 48 años, dueño de 5 kioscos. Valida que cada feature le resuelva un problema real |
| 3 | **Persona Empleado** | `kiosco-persona-empleado/` | Piensa como Lucía, 26 años, kiosquera 8hs/día. Valida que todo sea rápido y sin fricciones |

### Capa técnica (cómo se construye)
| # | Agente | Carpeta | Responsabilidad |
|---|--------|---------|-----------------|
| 4 | **Arquitectura** | `kiosco-arquitectura/` | Patrones, deuda técnica, separación de responsabilidades |
| 5 | **Base de Datos** | `kiosco-database/` | Schema, índices, queries, migraciones |
| 6 | **Testing** | `kiosco-testing/` | Unit tests (Vitest), E2E (Playwright), cobertura |
| 7 | **Performance** | `kiosco-performance/` | Bundle, rendering, carga en dispositivos económicos |
| 8 | **Seguridad** | `kiosco-seguridad/` | RLS, auth, aislamiento multi-tenant |
| 9 | **Offline/PWA** | `kiosco-offline/` | IndexedDB, Service Worker, sync, modo sin conexión |
| 10 | **DevOps** | `kiosco-devops/` | Vercel, CI/CD, Sentry, migraciones en producción |

### Capa de producto (qué se construye)
| # | Agente | Carpeta | Responsabilidad |
|---|--------|---------|-----------------|
| 11 | **UX/Estética** | `kiosco-ux/` | Interfaz, accesibilidad, consistencia visual |
| 12 | **Analytics** | `kiosco-analytics/` | KPIs, dashboards, gráficos con Recharts |
| 13 | **Reportes** | `kiosco-reportes/` | PDF (tickets, cierres), Excel (exports de datos) |
| 14 | **Onboarding** | `kiosco-onboarding/` | Setup de nuevos clientes, multi-tenant, planes |

### Capa de dominio (conocimiento del negocio)
| # | Agente | Carpeta | Responsabilidad |
|---|--------|---------|-----------------|
| 15 | **Inventario** | `kiosco-inventario/` | FIFO, lotes, vencimientos, proveedores |
| 16 | **Facturación** | `kiosco-facturacion/` | ARCA/AFIP, CAE, tipos de factura (fase 2) |
| 17 | **Gamificación** | `kiosco-gamificacion/` | Misiones, XP, rankings, engagement |

## Cómo usar

### En Claude Code (terminal)

Siempre empezá por el Orquestador si no sabés por dónde arrancar:

```
Lee agents/kiosco-orquestador/SKILL.md y decime qué priorizar hoy
```

Para tareas específicas, invocá al agente directamente:

```
Lee agents/kiosco-seguridad/SKILL.md y hacé una auditoría completa de RLS
```

```
Lee agents/kiosco-persona-empleado/SKILL.md y evaluá el flujo de venta
```

```
Lee agents/kiosco-inventario/SKILL.md y auditá el sistema FIFO
```

### Trabajo conjunto entre agentes

Cada agente tiene una sección "Áreas de trabajo conjunto" que define con qué otros agentes se coordina. Para tareas complejas, el Orquestador define el orden:

```
Ejemplo: "Implementar transferencia de stock entre sucursales"

1. Persona Dueño     → ¿Beto lo necesita?
2. Inventario        → Diseñar la lógica FIFO
3. Database          → Schema + índices
4. Seguridad         → RLS en las nuevas tablas
5. Arquitectura      → Actions + repositorios
6. Persona Empleado  → ¿Lucía lo puede usar rápido?
7. UX                → Interfaz
8. Offline           → ¿Funciona sin internet?
9. Testing           → Tests del flujo
```

### Orden recomendado para solidificar la base

```
Fase 1 — Blindar (semana 1-2):
  Seguridad → Database → Arquitectura → Testing

Fase 2 — Optimizar (semana 3-4):
  Performance → Offline/PWA → DevOps

Fase 3 — Pulir producto (mes 2):
  Persona Empleado + UX → Persona Dueño + Analytics → Reportes

Fase 4 — Escalar (mes 2-3):
  Onboarding → Inventario → Gamificación

Fase 5 — Facturación (cuando haya clientes):
  Facturación ARCA
```

## Convenciones

- Cada agente tiene "Lo que NO hacer" — límites claros para no pisar trabajo de otros
- Cada agente genera reportes con formato estandarizado
- Los agentes no ejecutan cambios destructivos sin confirmación
- Los cambios de DB generan scripts SQL, no se aplican automáticamente
- Las personas (Dueño/Empleado) validan ANTES de que los técnicos implementen
- El Orquestador coordina cuando hay duda sobre quién debe actuar

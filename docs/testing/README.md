# Testing — Guía de Uso

> Punto de entrada para todo lo relacionado con QA de App Kiosco.

---

## Qué hay acá

Esta carpeta contiene las herramientas de testing del producto, diseñadas para que **vos (no-dev)** puedas validar que la app funciona antes de cada demo o deploy.

| Archivo | Propósito | Cuándo usarlo |
|---------|-----------|---------------|
| **QA-CHECKLIST.md** | Protocolo completo de testing manual (110+ escenarios) | Antes de un release grande o cuando toques muchos módulos |
| **PRE-DEMO-CHECK.md** | Check rápido de 15 min para antes de una demo | Antes de cada llamada con un prospecto |
| **PLAN-E2E.md** | Roadmap de los tests automatizados (Playwright) | Cuando quieras agregar o expandir tests automáticos |

Tests automatizados: en `/e2e/` (Playwright specs).

---

## Flujo recomendado según el momento

### Antes de una demo con un prospecto
1. Corré **PRE-DEMO-CHECK.md** (15 min manual)
2. Si todo ok → demo confirmada
3. Si algo falla → NO hacés demo en vivo, usás Plan B

### Antes de un deploy a producción (push a main)
1. Corré los tests automáticos: `npm run test:e2e`
2. Si hay cambios en un módulo grande, corré la sección correspondiente del **QA-CHECKLIST.md** (15-30 min del módulo afectado)
3. Si los tests pasan → push

### Cuando quieras validar la app entera
1. Corré **QA-CHECKLIST.md** completo (90-120 min)
2. Te deja como bonus: una org con data realista, lista para demos

### Cuando agregás un módulo nuevo o cambias uno existente
1. Actualizá la sección correspondiente del **QA-CHECKLIST.md**
2. Agregá/actualizá el spec Playwright correspondiente en `/e2e/`
3. Corré el spec individual para validar

---

## Cómo correr los tests automáticos

```powershell
# Una sola vez, instalar:
npm install
npx playwright install

# Correr todos los tests
npm run test:e2e

# Modo UI interactivo (ver qué hace el test en vivo)
npm run test:e2e:ui

# Correr un solo spec
npx playwright test smoke-05

# Ver reporte HTML detallado del último run
npm run test:e2e:report
```

### Pre-requisitos

1. Tener una cuenta de test en `e2e/.env.test` (copiar de `.env.test.example`).
2. La cuenta debe tener al menos 1 sucursal con 1 producto para que los tests que asumen data funcionen.

---

## Reportar un bug encontrado

Cuando el checklist o los tests encuentran un problema:

1. Marcar **[FAIL]** en el checklist, anotar en "Observación" qué viste.
2. Tomar screenshot si es visual.
3. Anotar en la tabla de "Log de bugs" al final del QA-CHECKLIST.
4. Decidir severidad:
   - **Crítica** → frena la demo, frena el deploy. Arreglar YA.
   - **Alta** → impacta flujo principal pero hay workaround. Arreglar esta semana.
   - **Media** → molestia pero no bloqueante. Próximo sprint.
   - **Baja** → cosmético o edge case raro. Backlog.

---

## Troubleshooting

### "Los tests automáticos tardan mucho"
- Corré sólo el spec que te interesa: `npx playwright test smoke-03`
- O corré en UI mode: `npm run test:e2e:ui` (más rápido para debugging)

### "El test pasa en mi máquina pero falla en otra"
- Probable causa: data distinta en la DB. Ver Gap 2 en `PLAN-E2E.md`.
- Solución temporal: correr sobre la misma org de test en ambas máquinas.

### "El QA manual me toma mucho tiempo"
- Es normal la primera vez. La segunda ya conocés los flujos y bajás a 60 min.
- Si realmente no tenés tiempo, corré sólo las secciones de los módulos que modificaste.

### "Un test automático es flaky (a veces pasa, a veces falla)"
- Agregar `data-testid` al elemento correspondiente (Gap 1 en `PLAN-E2E.md`).
- Aumentar timeouts en casos de red lenta.

---

## Próximas mejoras planeadas

Ver `PLAN-E2E.md` sección "Priorización para las próximas sesiones". Los gaps más importantes a cerrar:

1. Agregar `data-testid` a componentes clave (hace los tests más estables)
2. Crear seed script de data de test (`e2e/setup/seed.ts`)
3. Escribir specs para sucursales, servicios virtuales y scanner barcode

---

## Filosofía

> "Tu inseguridad vendiendo viene de no confiar en que el producto no se va a romper. Este stack de testing existe para que tengas ese piso de confianza."

La meta no es tener 100% de coverage. La meta es que **antes de cada demo sepas con seguridad** que los 6-7 flujos que vas a mostrar funcionan. El checklist pre-demo te da eso en 15 minutos.

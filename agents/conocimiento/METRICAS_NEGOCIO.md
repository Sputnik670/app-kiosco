# Métricas de Negocio y KPIs

Documento que establece los KPIs del producto y cómo medirlos. Actualizado al 15 de marzo 2026 (antes del piloto real).

---

## Métricas del Piloto (Fase 1: Marzo-Abril 2026)

### Objetivo General
**Validar que App Kiosco resuelve el problema real: "Cadena de kioscos necesita visibilidad + control sin papeles".**

---

## KPI #1: Time-to-First-Sale

**Definición**: Tiempo desde que se crea la organización hasta que se registra la primera venta.

**Métrica**: ⏱️ Minutos desde `organizations.created_at` a `sales.created_at`

**Target**: < 15 minutos

**Por qué**:
- Si toma > 15 min, UI es confusa o onboarding falla
- Si toma < 5 min, kiosquero entendió rápido

**Cómo medir**:
```sql
SELECT
  o.id,
  DATE(o.created_at) as onboarding_day,
  EXTRACT(MINUTE FROM (MIN(s.created_at) - o.created_at)) as minutes_to_first_sale
FROM organizations o
LEFT JOIN sales s ON s.org_id = o.id
WHERE o.created_at > '2026-03-15'
GROUP BY o.id
ORDER BY minutes_to_first_sale DESC;
```

**Análisis**:
- Target: mediana < 15 min
- Rojo: si mediana > 30 min → revisar onboarding

---

## KPI #2: Ventas Diarias Registradas

**Definición**: % de ventas reales registradas en la app vs cuaderno del kiosquero

**Métrica**: (sales_en_app / sales_reales) * 100

**Target**: > 80%

**Por qué**:
- Si < 80%, kiosquero sigue usando cuaderno → app no agrega valor
- Si > 95%, app es confiable para ellos

**Cómo medir**:
```
Día 1 de piloto:
  - Dueño anota ventas en cuaderno (real)
  - Claude ejecuta: SELECT COUNT(*) FROM sales WHERE org_id = ? AND DATE(created_at) = TODAY
  - Compar: (app_count / libro_count) * 100

Repetir diariamente para semana 1
```

**Análisis**:
- Semana 1: < 70% → problema de UX, entrenar más
- Semana 2: 70-85% → normal, aprendizaje
- Semana 3: > 85% → excelente

---

## KPI #3: Diferencia de Caja Promedio

**Definición**: Discrepancia entre dinero físico vs registrado en app (diferencia = efectivo - app)

**Métrica**: ABS(cash_registers.physical_amount - cash_registers.registered_amount) en pesos

**Target**: < $5.000 (máximo 5% en cadenas que venden $100k/día)

**Por qué**:
- Kiosqueros perdían plata por errores o hurto
- App debe igualar caja automáticamente
- < $5k = error de redondeo, aceptable
- > $10k = hay un problema (robo, error de entrada)

**Cómo medir**:
```sql
SELECT
  cr.id,
  cr.physical_amount,
  cr.registered_amount,
  ABS(cr.physical_amount - cr.registered_amount) as variance,
  DATE(cr.closed_at) as day
FROM cash_registers cr
WHERE cr.org_id = ? AND cr.status = 'closed'
ORDER BY closed_at DESC;

-- Promedio semanal
SELECT
  DATE_TRUNC('week', cr.closed_at) as week,
  AVG(ABS(cr.physical_amount - cr.registered_amount)) as avg_variance
FROM cash_registers cr
WHERE cr.org_id = ?
GROUP BY week
ORDER BY week DESC;
```

**Análisis**:
- Semana 1: var > $10k → entrenar más a empleados
- Semana 2: var $5-10k → mejorando
- Semana 3+: var < $5k → excelente

---

## KPI #4: Empleados Fichando Diariamente

**Definición**: % de empleados que registran entrada/salida en la app

**Métrica**: (empleados_con_fichaje / empleados_totales) * 100

**Target**: 100% (o 90% mínimo)

**Por qué**:
- Fichaje = control de asistencia + base de gamificación
- Si < 90%, empleados olvidan o desconfían del sistema

**Cómo medir**:
```sql
SELECT
  DATE(a.clocked_in_at) as day,
  COUNT(DISTINCT CASE WHEN a.clocked_in_at IS NOT NULL THEN a.user_id END) as employees_clocked_in,
  COUNT(DISTINCT m.user_id) as total_employees_active,
  (COUNT(DISTINCT CASE WHEN a.clocked_in_at IS NOT NULL THEN a.user_id END) * 100 / COUNT(DISTINCT m.user_id)) as pct_clocked_in
FROM memberships m
LEFT JOIN attendance a ON a.user_id = m.user_id AND DATE(a.clocked_in_at) = CURRENT_DATE
WHERE m.org_id = ? AND m.role != 'owner'
GROUP BY DATE(a.clocked_in_at)
ORDER BY day DESC;
```

**Análisis**:
- Semana 1: < 70% → QR colocación, capacitación
- Semana 2: 70-90% → normal
- Semana 3+: > 90% → excelente

---

## KPI #5: Abandono del Dueño

**Definición**: Dueño no usa la app por > 7 días

**Métrica**: últimoLogin > 7 días

**Target**: 0% en primer mes

**Por qué**:
- Si dueño abandona, cadena muere
- Métrica de éxito fundamental

**Cómo medir**:
```sql
SELECT
  u.id,
  u.email,
  MAX(al.created_at) as last_login,
  (CURRENT_TIMESTAMP - MAX(al.created_at)) as days_since_login
FROM users u
LEFT JOIN auth_logs al ON al.user_id = u.id
WHERE u.org_id = ? AND u.role = 'owner'
GROUP BY u.id
HAVING (CURRENT_TIMESTAMP - MAX(al.created_at)) > INTERVAL '7 days'
ORDER BY last_login DESC;
```

**Análisis**:
- Semana 1: si dueño no entra > 2 días → contactar (técnico o capacitación)
- Semana 2-4: si no entra > 7 días → piloto fallido
- Si 0 abandonos en mes → excelente

---

## KPI #6: NPS del Dueño (Net Promoter Score)

**Definición**: Pregunta: "¿Qué tan probable es que recomiendes App Kiosco a otro dueño?" (0-10)

**Métrica**: (Promoters - Detractors) / Total * 100

- Promoters: 9-10
- Passives: 7-8
- Detractors: 0-6

**Target**: > 7/10 (o 70% promoters)

**Por qué**:
- NPS > 50 es excelente para SaaS
- NPS > 70 = producto viral
- NPS < 0 = producto fallido

**Cómo medir**: Encuesta directa
```
Contactar al dueño via email o WhatsApp:
"¿Qué tan probable es que recomiendes App Kiosco? 0-10"
Si selecciona 9-10: "¿Por qué? ¿Qué te gustó?"
Si selecciona 0-6: "¿Qué falta? ¿Qué cambiarías?"
```

**Análisis**:
- > 8: excelente, listo para escalar
- 6-8: bueno, pero hay mejoras
- < 6: problema, revisar feature principal

---

## Métricas Operacionales (Futuro Roadmap)

Estas se medirán en Fase 2 (después del piloto):

### Crecimiento
- MAU (Monthly Active Users): usuarios únicos/mes
- MRR (Monthly Recurring Revenue): ingresos recurrentes
- Churn: % usuarios que abandonan/mes

### Engagement
- DAU/MAU ratio: engagement consistency
- Eventos por usuario: promedio de acciones/usuario/día
- Reporte usado por semana: % que accede a reportes

### Operacional
- Tiempo de caja: segundos para registrar venta
- Tiempo de soporte: minutos para resolver issue
- Uptime: % disponibilidad (target > 99.5%)

### Económico
- COGS (Cost of Goods Sold): Supabase + Vercel
- CAC (Customer Acquisition Cost): $ invertido / cliente adquirido
- LTV (Lifetime Value): revenue esperado por cliente
- LTV/CAC ratio: debe ser > 3:1

---

## Modelo de Negocio Objetivo

### Precio

**Investigación actual** (marzo 2026):

| Competidor | Precio | Público | Limitaciones |
|------------|--------|--------|--------------|
| Sistar Simple | ~$15k/mes | Cadenas grandes | Por sucursal |
| Verby | $499/mes | Pymes | Simple |
| Bsale | $99/mes | Tiendas | Genérico |
| **App Kiosco Target** | **$199/mes** | Cadenas medianas | Ilimitadas sucursales |

**Modelo propuesto**:
- Subscription: $199/mes por cadena (todas sucursales)
- Gratuito: primer mes (onboarding)
- Cancelación: automática, sin penalidad

### Ingresos Proyectados (Año 1)

```
Mes 1 (piloto):    1 cadena × $199 = $199
Mes 3 (lancemos):  10 cadenas × $199 = $1,990
Mes 6:             30 cadenas × $199 = $5,970
Mes 12:            50 cadenas × $199 = $9,950

Churn esperado: 10% / mes (SaaS early stage)
MRR Año 1 (end): ~$8,000 (después de churn)
```

### Costos Operativos (Año 1)

```
Supabase Pro:        $100/mes × 12 = $1,200
Vercel Pro:          $50/mes × 12 = $600
Domain + email:      $20 × 12 = $240
Stripe (MP fees 3%): ~$300
Soporte (Ram):       $0 (onboarding manejo Ram)
---
Total COGS:          ~$2,340/año
Margen bruto:        ($8,000 × 12 - $2,340) / ($8,000 × 12) = 97.6%
```

**¿Es viable?**: Sí, pero necesitamos 50+ cadenas simultáneas para ROI positivo.

---

## Dashboard de Monitoreo

**Dónde ver**:
1. **Google Sheets** (actualizado diariamente):
   - Columna A: Métrica
   - Columna B: Target
   - Columna C: Actual
   - Columna D: % Progress
   - Columna E: Análisis

2. **Supabase Studio**:
   - Database > Editors
   - Query métricas SQL (arriba)

3. **Vercel Analytics**:
   - Vercel > Analytics
   - Deployments, uptime, function performance

---

## Ciclo de Revisión

### Semanal (lunes mañana)
- Checklist de métricas con Ram
- Decisiones sobre cambios

### Mensual (primer día del mes)
- Análisis profundo de KPIs
- Actualizar roadmap si necesario
- NPS survey al dueño

### Trimestral (primer día del trimestre)
- Revisar modelo de negocio
- Decisiones sobre precio/features
- Planning Q siguiente

---

## Meta Final (EOY 2026)

**Objetivo**: 50 cadenas de kioscos usando App Kiosco, NPS > 70, MRR > $8,000.

**Criterios de éxito**:
- [ ] Piloto completado sin churn (1 cadena, 30 días)
- [ ] NPS >= 7 del dueño piloto
- [ ] Diferencia de caja < $5,000 promedio
- [ ] Empleados fichando > 90%
- [ ] Time to sale < 15 min
- [ ] 10+ cadenas en beta (Q2)
- [ ] 50+ cadenas en producción (Q4)
- [ ] MRR > $8,000 (Q4)
- [ ] Churn < 15%/mes (Q4)


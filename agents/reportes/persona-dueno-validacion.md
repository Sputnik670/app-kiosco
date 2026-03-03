# Validacion del Dashboard del Dueno (Persona Beto)

**Fecha**: 2026-03-02
**Agente**: kiosco-persona-dueno
**Estado**: FUNCIONAL CON MEJORAS NECESARIAS

---

## KPIs visibles sin scrollear

| KPI | Presente | Visible sin scroll | Claro para Beto | Estado |
|-----|----------|-------------------|-----------------|--------|
| Ventas del dia (total) | SI | SI (tab Sales) | SI - monto grande | APROBADO |
| N transacciones | SI | SI (en stats) | SI | APROBADO |
| Stock critico | SI | NO (tab separada Alerts) | SI cuando lo encuentra | NECESITA MEJORA |
| Empleados activos | PARCIAL | NO (tab Supervision) | Muestra asistencias | NECESITA MEJORA |
| Capital en riesgo (vencimientos) | SI | SI (CapitalBadges en header) | SI | APROBADO |

**Problema principal**: Los 5 KPIs estan distribuidos en tabs diferentes. Beto necesita verlos TODOS de un vistazo sin cambiar de tab. Falta un resumen consolidado en la primera vista.

## Tabs/Secciones del dashboard

| Tab | Contenido | Valor para Beto | Problemas |
|-----|-----------|-----------------|-----------|
| Caja y Ventas | Total vendido, desglose pago, grafico, ventas recientes | ALTO | Falta comparativa vs ayer |
| Stock | Lista productos, busqueda, edicion | MEDIO | Mucha info, poco accionable |
| Panel de Utilidades | Metricas BI: gross, net, margin, ROI | ALTO | Margen estimado al 60% fijo |
| Supervision 360 | Turnos audit, asistencias, ranking | ALTO | Bien para control de empleados |
| Reportes | Export PDF/Excel (ventas, caja, stock, vencimientos) | ALTO | Completo y funcional |
| Alta de Catalogo | Crear producto con scanner | MEDIO | Bien para setup inicial |
| Proveedores | Gestion + saldo proveedor | MEDIO | Falta historial de compras |
| Mi Equipo | Ranking + invitar + QR fichaje | ALTO | Bien integrado |
| Advertencias Stock | Stock bajo + vencimientos | ALTO | Deberia estar mas visible |

## Test de Beto por feature

| Feature | Ahorra tiempo | Ahorra plata | Da control | Usable | Veredicto |
|---------|---------------|-------------|-----------|--------|-----------|
| Dashboard ventas con grafico | SI | Indirecto | SI | SI | IMPLEMENTAR |
| Selector de sucursal | SI | NO | SI | SI | IMPLEMENTAR |
| Capital badges en header | SI | SI (detecta riesgo) | SI | SI | IMPLEMENTAR |
| Supervision turnos | SI (no va al kiosco) | SI (detecta faltantes) | SI | SI | IMPLEMENTAR |
| Reportes PDF/Excel | SI | SI (para contador) | SI | SI | IMPLEMENTAR |
| Ranking empleados | NO | Indirecto | SI | SI | IMPLEMENTAR |
| QR fichaje | SI | SI | SI | SI | IMPLEMENTAR |
| Panel utilidades (BI) | SI | SI | SI | PARCIAL (margen estimado) | MEJORAR |

## Problemas encontrados

### P1 - Sin resumen "de un vistazo" (KPIs consolidados)
- **Impacto**: Beto abre la app y ve solo la tab de ventas. Tiene que navegar 3 tabs para entender el estado completo
- **Fix**: Agregar cards de resumen al inicio: Ventas hoy, Alertas activas, Empleados fichados, Capital en riesgo

### P2 - Margen calculado con estimacion fija del 60%
- **Codigo**: `dashboard.actions.ts:298` - `const estimatedCost = gross * 0.6`
- **Impacto**: El margen es ficticio. Beto toma decisiones con datos falsos
- **Fix**: Usar el costo real del producto (`products.cost`) cuando existe, fallback al 60% solo si no hay costo

### P3 - Sin comparativa entre sucursales
- **Impacto**: Beto tiene 5 kioscos pero solo puede ver 1 a la vez
- **Fix**: Agregar tab "Comparativa" con ranking de sucursales por ventas/margen/faltantes

### P4 - Sin notificaciones push
- **Impacto**: Beto no se entera de faltantes de caja hasta que abre la app
- **Fix**: Implementar push notifications para: diferencia de caja > umbral, stock critico, empleado no ficho

### P5 - 9 tabs son demasiadas
- **Impacto**: Scroll horizontal con 9 tabs es confuso en mobile
- **Fix**: Agrupar en 5 tabs max: Resumen, Operacion (ventas+caja), Inventario (stock+alertas+catalogo), Equipo, Reportes

## Features faltantes (TIER 1 - necesarias)

| Feature | Justificacion | Prioridad |
|---------|---------------|-----------|
| Resumen consolidado | Ver TODO en una pantalla | CRITICA |
| Comparativa sucursales | Decidir cual kiosco rinde | ALTA |
| Notificaciones push | Enterarse sin abrir la app | ALTA |
| Margen real por producto | Tomar decisiones con datos reales | ALTA |
| Prediccion de pedidos | Comprar basado en datos, no intuicion | MEDIA |

## Recomendaciones

1. **Consolidar tabs**: De 9 a 5 tabs maximo
2. **Dashboard landing**: Primera vista debe mostrar los 5 KPIs clave sin scroll
3. **Margen real**: Reemplazar estimacion 60% por costo real del producto
4. **Alertas proactivas**: Badge con numero de alertas activas en el header
5. **Multi-sucursal**: Vista comparativa de todas las sucursales en una tabla

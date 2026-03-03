# Auditoria de Analytics y KPIs

**Fecha**: 2026-03-02
**Agente**: kiosco-analytics
**Analytics maturity**: INTERMEDIO

---

## KPIs implementados vs faltantes

| KPI | Categoria | Estado | Prioridad | Datos disponibles |
|-----|-----------|--------|-----------|-------------------|
| Ventas del dia (total $) | Operativo | IMPLEMENTADO | - | v_daily_sales |
| N transacciones | Operativo | IMPLEMENTADO | - | v_daily_sales.sale_count |
| Ticket promedio | Operativo | IMPLEMENTADO | - | Calculado client-side |
| Stock critico (bajo minimo) | Operativo | IMPLEMENTADO | - | v_products_with_stock |
| Capital en riesgo (vencimientos) | Operativo | IMPLEMENTADO | - | v_expiring_stock |
| Desglose metodos de pago | Operativo | IMPLEMENTADO | - | v_daily_sales por payment_method |
| Top 5 productos vendidos | Tactico | IMPLEMENTADO | - | sale_items + products |
| Turnos audit (diferencia caja) | Tactico | IMPLEMENTADO | - | cash_registers.variance |
| Ranking empleados (XP, ventas) | Tactico | IMPLEMENTADO | - | memberships + sales + missions |
| Metricas BI (gross, net, margin, ROI) | Estrategico | IMPLEMENTADO | - | Calculado server-side |
| Ventas por hora (patron demanda) | Tactico | NO IMPLEMENTADO | MEDIA | sales.created_at disponible |
| Comparativa sucursales | Tactico | NO IMPLEMENTADO | ALTA | Datos existen, falta UI |
| Tendencia mes a mes | Estrategico | NO IMPLEMENTADO | MEDIA | Datos existen |
| Rotacion de inventario | Estrategico | NO IMPLEMENTADO | MEDIA | stock_batches tiene datos |
| Empleados activos hoy | Operativo | PARCIAL | ALTA | attendance existe pero no en dashboard landing |

## Queries actuales

| Archivo:funcion | Queries DB | Problema | Optimizacion |
|-----------------|-----------|----------|--------------|
| dashboard.actions.ts:getOwnerStatsAction | 5 queries | Query de movements no filtra por fecha, query de sale_items puede ser grande | Consolidar en RPC |
| dashboard.actions.ts:getInventoryCriticalAction | 2 queries | Usa vistas optimizadas, eficiente | OK |
| dashboard.actions.ts:getDailySalesChartAction | 1 query | Usa v_daily_sales, eficiente | OK |
| stats.actions.ts:getTeamRankingAction | 4 queries | Optimizado con batch queries (no N+1) | OK |
| inventory.actions.ts:getStockSummary | 1 query | Batch con .in(), eficiente | OK |

**Nota positiva**: Las queries ya fueron optimizadas (documentado "2026-02-25 - Eliminado patron N+1"). Las vistas de Postgres (`v_daily_sales`, `v_expiring_stock`, `v_products_with_stock`) son una excelente decision.

## Funciones RPC propuestas

```sql
-- Dashboard summary consolidado (reemplaza 5 queries de getOwnerStatsAction)
CREATE OR REPLACE FUNCTION get_dashboard_summary(
  p_branch_id UUID,
  p_date_from DATE,
  p_date_to DATE
) RETURNS JSON AS $$
  SELECT json_build_object(
    'total_sales', (
      SELECT COALESCE(SUM(total_amount), 0)
      FROM v_daily_sales
      WHERE branch_id = p_branch_id AND date BETWEEN p_date_from AND p_date_to
    ),
    'sale_count', (
      SELECT COALESCE(SUM(sale_count), 0)
      FROM v_daily_sales
      WHERE branch_id = p_branch_id AND date BETWEEN p_date_from AND p_date_to
    ),
    'low_stock_count', (
      SELECT COUNT(*)
      FROM v_products_with_stock
      WHERE branch_id = p_branch_id AND stock_available <= COALESCE(min_stock, 5) AND is_active AND NOT is_service
    ),
    'expiring_count', (
      SELECT COUNT(*)
      FROM v_expiring_stock
      WHERE branch_id = p_branch_id AND days_until_expiry <= 7
    ),
    'expiring_value', (
      SELECT COALESCE(SUM(value_at_risk), 0)
      FROM v_expiring_stock
      WHERE branch_id = p_branch_id
    )
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Comparativa de sucursales (nueva feature)
CREATE OR REPLACE FUNCTION get_branches_comparison(
  p_org_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS JSON AS $$
  SELECT json_agg(branch_data)
  FROM (
    SELECT
      b.id,
      b.name,
      COALESCE(SUM(vds.total_amount), 0) as total_ventas,
      COALESCE(SUM(vds.sale_count), 0) as num_ventas,
      (SELECT COUNT(*) FROM v_products_with_stock vps
       WHERE vps.branch_id = b.id AND vps.stock_available <= COALESCE(vps.min_stock, 5)) as alertas_stock
    FROM branches b
    LEFT JOIN v_daily_sales vds ON vds.branch_id = b.id AND vds.date = p_date
    WHERE b.organization_id = p_org_id AND b.is_active
    GROUP BY b.id, b.name
    ORDER BY total_ventas DESC
  ) branch_data;
$$ LANGUAGE sql SECURITY DEFINER;
```

## Visualizaciones

| Grafico | Existe | Tipo | Datos | Mobile-friendly |
|---------|--------|------|-------|-----------------|
| Ventas por dia | SI | Recharts (via chartData) | v_daily_sales agregado | SI |
| Desglose metodos pago | SI | Cards con porcentajes | PaymentBreakdown | SI |
| Top productos | SI | Lista ordenada | sale_items | SI |
| Tendencia mensual | NO | - | Datos disponibles | - |
| Ventas por hora | NO | - | sales.created_at | - |
| Comparativa sucursales | NO | - | Datos disponibles | - |

## Recomendaciones

| Recomendacion | Impacto | Esfuerzo |
|---------------|---------|----------|
| RPC get_dashboard_summary (1 query vs 5) | ALTO - reduce latencia 4x | BAJO |
| Comparativa sucursales con ranking | ALTO - feature mas pedida por duenos | MEDIO |
| Reemplazar margen estimado 60% por costo real | ALTO - datos reales vs ficticios | BAJO |
| Grafico de ventas por hora | MEDIO - optimizar horarios | MEDIO |
| Dashboard landing con 5 KPIs | ALTO - time-to-insight | MEDIO |

# Auditoria de Inventario y FIFO

**Fecha**: 2026-03-02
**Agente**: kiosco-inventario
**Estado del inventario**: FUNCIONAL

---

## FIFO

- **Implementado**: SI
- **Descuento correcto al vender**: SI (via RPC `process_sale` que maneja FIFO automaticamente)
- **Costo por lote**: SI (`unit_cost` en `stock_batches`)
- **Detalle**: El repositorio `stock.repository.ts` implementa FIFO correctamente:
  - `createStockEntrada`: Crea lote con `status: 'available'`, `unit_cost`, `expiration_date`
  - `createStockSalida` (deprecado): Busca lote mas antiguo con `order('created_at', { ascending: true })`
  - El RPC `process_sale` de PostgreSQL maneja FIFO automaticamente (preferido)

## Schema de stock

| Campo esperado | Existe | Columna real | Notas |
|----------------|--------|-------------|-------|
| id | SI | id (UUID) | PK |
| product_id | SI | product_id | FK a products |
| branch_id | SI | branch_id | FK a branches |
| quantity | SI | quantity | Entero |
| cost_price | SI | unit_cost | Decimal |
| expiry_date | SI | expiration_date | DATE, nullable |
| batch_number | NO | - | No implementado |
| received_at | SI | created_at | Timestamp auto |
| supplier_id | SI | supplier_id | FK a suppliers |
| status | SI | status | 'available', 'sold', 'expired', 'damaged' |
| organization_id | SI | organization_id | Multi-tenant |

**Schema correcto** - Solo falta `batch_number` (opcional, no critico).

## Alertas

| Alerta | Implementada | Funciona | Detalles |
|--------|-------------|----------|----------|
| Stock bajo (< minimo) | SI | SI | `getInventoryCriticalAction` usa `v_products_with_stock` con `min_stock` |
| Por vencer (< 7 dias) | SI | SI | `getCriticalStockAction` filtra `expiration_date < 7 dias` |
| Por vencer (< 10 dias) | SI | SI | `getExpiringStockAction` para vista empleado |
| Vencidos | SI | SI | `marcarProductosVencidos` actualiza status a 'expired' |
| Capital en riesgo | SI | SI | Vista `v_expiring_stock` con `value_at_risk` |

## Proveedores

| Feature | Estado | Detalles |
|---------|--------|----------|
| Tabla suppliers | SI | nombre, balance, is_active |
| Asociar producto-proveedor | SI | `supplier_id` en stock_batches |
| Balance/saldo proveedor | SI | `ControlSaldoProveedor` componente |
| Historial compras por proveedor | NO | Solo se registra en stock_batches individualmente |
| Orden de compra automatica | NO | No implementado |
| Comparar precios entre proveedores | NO | No implementado |

## Flujos evaluados

| Flujo | Estado | Problemas |
|-------|--------|-----------|
| Ingreso de mercaderia | FUNCIONAL | `processComplexStockEntry` completo con costo, vencimiento, proveedor |
| Descuento por venta | FUNCIONAL | RPC `process_sale` FIFO automatico |
| Alerta stock bajo | FUNCIONAL | Vista `v_products_with_stock` con umbral configurable |
| Alerta vencimiento | FUNCIONAL | `getExpiringStockAction` + `getCriticalStockAction` |
| Merma/retiro de vencidos | FUNCIONAL | `processStockLossAction` marca como 'damaged' |
| Busqueda por barcode | FUNCIONAL | `handleProductScan` con barcode exact match |
| Busqueda por nombre | FUNCIONAL | `searchProductos` en repository con query parcial |
| Transferencia entre sucursales | NO IMPLEMENTADO | Mencionada como feature futura |

## Mejoras propuestas

| Mejora | Impacto en el negocio | Esfuerzo |
|--------|----------------------|----------|
| Orden de compra automatica basada en stock bajo | Evita quiebres de stock (-20% ventas perdidas) | ALTO |
| Historial de compras por proveedor | Comparar precios, negociar mejor | MEDIO |
| Transferencia entre sucursales | Optimizar stock entre locales | ALTO |
| Lote batch_number | Trazabilidad para ARCA/AFIP | BAJO |
| Alerta de sobre-stock | Evitar capital parado | MEDIO |
| Catalogo pre-cargado de productos tipicos | Acelerar onboarding 10x | MEDIO |

## SQL de optimizacion

```sql
-- Indice para busqueda FIFO (ya deberia existir en migracion 00005)
CREATE INDEX IF NOT EXISTS idx_stock_batches_fifo
ON stock_batches(product_id, branch_id, status, created_at ASC)
WHERE status = 'available';

-- Indice para alertas de vencimiento
CREATE INDEX IF NOT EXISTS idx_stock_batches_expiry
ON stock_batches(branch_id, expiration_date)
WHERE status = 'available' AND expiration_date IS NOT NULL;

-- RPC para resumen de stock por sucursal (evitar N queries)
CREATE OR REPLACE FUNCTION get_branch_stock_summary(p_branch_id UUID)
RETURNS JSON AS $$
  SELECT json_build_object(
    'total_products', (SELECT COUNT(DISTINCT product_id) FROM stock_batches WHERE branch_id = p_branch_id AND status = 'available'),
    'total_units', (SELECT COALESCE(SUM(quantity), 0) FROM stock_batches WHERE branch_id = p_branch_id AND status = 'available'),
    'expiring_7d', (SELECT COUNT(*) FROM stock_batches WHERE branch_id = p_branch_id AND status = 'available' AND expiration_date < CURRENT_DATE + 7),
    'total_value', (SELECT COALESCE(SUM(quantity * COALESCE(unit_cost, 0)), 0) FROM stock_batches WHERE branch_id = p_branch_id AND status = 'available')
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

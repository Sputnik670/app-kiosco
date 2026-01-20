# 📊 DATABASE SCHEMA - PlanetaZEGA

> Documentación completa del esquema de la base de datos en Supabase
> Actualizado: 5 de Enero 2026

---

## 📋 Tabla de Contenidos

- [organizations](#organizations)
- [perfiles](#perfiles)
- [sucursales](#sucursales)
- [ventas_servicios](#ventas_servicios) ⭐
- [stock](#stock)
- [productos](#productos)
- [caja_diaria](#caja_diaria)
- [movimientos_caja](#movimientos_caja)
- [Otras Tablas](#otras-tablas)

---

## organizations

Tabla principal de organizaciones (multi-tenant).

### Columnas

| Columna | Tipo | NOT NULL | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | uuid | ✅ | gen_random_uuid() | ID único |
| `nombre` | text | ✅ | - | Nombre de la organización |
| `plan` | text | ❌ | null | Plan de suscripción |
| `created_at` | timestamptz | ✅ | now() | Fecha de creación |
| `updated_at` | timestamptz | ✅ | now() | Última actualización (auto) |

**Ejemplo:**
```json
{
  "id": "eafcefd0-13ca-4d5d-a9bf-892b192cd303",
  "nombre": "Kiosco de ramiro.ira92",
  "plan": null,
  "created_at": "2026-01-05T00:55:31.250704+00:00"
}
```

---

## perfiles

Perfiles de usuarios (dueños y empleados).

### Columnas

| Columna | Tipo | NOT NULL | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | uuid | ✅ | auth.uid() | ID del usuario (Supabase Auth) |
| `organization_id` | uuid | ✅ | - | FK → organizations |
| `sucursal_id` | uuid | ❌ | null | FK → sucursales (empleados) |
| `sucursal_actual_id` | uuid | ❌ | null | Sucursal actual (asistencia) |
| `rol` | text | ✅ | - | 'dueño' o 'empleado' |
| `nombre` | text | ✅ | - | Nombre del usuario |
| `email` | text | ✅ | - | Email |
| `xp` | integer | ✅ | 0 | Puntos de experiencia |
| `puntos` | integer | ✅ | 0 | Puntos de gamificación |
| `nivel` | integer | ✅ | 1 | Nivel del empleado |
| `activo` | boolean | ✅ | true | Usuario activo |
| `created_at` | timestamptz | ✅ | now() | Fecha de creación |
| `updated_at` | timestamptz | ✅ | now() | Última actualización (auto) |

---

## sucursales

Sucursales de cada organización.

### Columnas

| Columna | Tipo | NOT NULL | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | uuid | ✅ | gen_random_uuid() | ID único |
| `organization_id` | uuid | ✅ | - | FK → organizations |
| `nombre` | text | ✅ | - | Nombre de la sucursal |
| `direccion` | text | ❌ | null | Dirección física |
| `qr_entrada_url` | text | ❌ | null | URL QR para entrada |
| `qr_salida_url` | text | ❌ | null | URL QR para salida |
| `created_at` | timestamptz | ✅ | now() | Fecha de creación |
| `updated_at` | timestamptz | ✅ | now() | Última actualización (auto) |

---

## ventas_servicios

⭐ **Tabla principal de ingresos** - Ventas de servicios virtuales (recargas, pagos).

### Columnas

| Columna | Tipo | NOT NULL | Descripción |
|---------|------|----------|-------------|
| `id` | uuid | ✅ | ID único (auto-generado) |
| `organization_id` | uuid | ✅ | FK → organizations |
| `sucursal_id` | uuid | ✅ | FK → sucursales |
| `caja_diaria_id` | uuid | ✅ | FK → caja_diaria |
| `proveedor_id` | uuid | ✅ | FK → proveedores |
| `tipo_servicio` | text | ✅ | Nombre del servicio ('Claro', 'Movistar', etc.) |
| `monto_carga` | numeric | ✅ | Monto recargado al cliente |
| `comision` | numeric | ✅ | Comisión cobrada |
| `total_cobrado` | numeric | ✅ | Total cobrado (monto_carga + comision) |
| `metodo_pago` | text | ✅ | 'efectivo' o 'billetera_virtual' |
| `fecha_venta` | timestamptz | ✅ | Fecha/hora de la venta (legado) |
| `notas` | text | ❌ | Notas adicionales (opcional) |
| `created_at` | timestamptz | ✅ | Fecha de creación (sincronizado con fecha_venta) |
| `updated_at` | timestamptz | ✅ | Última actualización (auto) |

**Ejemplo de INSERT (del código):**
```javascript
await supabase.from('ventas_servicios').insert({
  organization_id: turno.organization_id,
  sucursal_id: sucursalId,
  caja_diaria_id: turnoId,
  proveedor_id: proveedorServicios.id,
  tipo_servicio: "Claro",
  monto_carga: 1000,
  comision: 50,
  total_cobrado: 1050,
  metodo_pago: "efectivo"
})
```

**⚠️ IMPORTANTE:**
- NO tiene columna `empleado_id`
- Mantiene `fecha_venta` por compatibilidad (legado)
- Ahora también tiene `created_at` estándar (sincronizado con fecha_venta)
- NO tiene columna `nombre_servicio` (usa `tipo_servicio`)
- NO tiene columna `emoji_servicio`

---

## stock

Movimientos de inventario (entradas/salidas de productos).

### Columnas (basado en código)

| Columna | Tipo | NOT NULL | Descripción |
|---------|------|----------|-------------|
| `id` | uuid | ✅ | ID único |
| `organization_id` | uuid | ✅ | FK → organizations |
| `sucursal_id` | uuid | ✅ | FK → sucursales |
| `producto_id` | uuid | ✅ | FK → productos |
| `cantidad` | integer | ✅ | Cantidad del movimiento |
| `tipo_movimiento` | text | ✅ | 'entrada' o 'salida' |
| `fecha_vencimiento` | date | ✅ | Fecha de vencimiento del lote |
| `estado` | text | ✅ | 'disponible', 'vendido', 'vencido' |
| `proveedor_id` | uuid | ❌ | FK → proveedores (opcional) |
| `compra_id` | uuid | ❌ | FK → compras (opcional) |
| `costo_unitario_historico` | numeric | ❌ | Costo al momento de compra |
| `fecha_ingreso` | timestamptz | ✅ | Fecha del movimiento |
| `created_at` | timestamptz | ✅ | Fecha de creación |
| `updated_at` | timestamptz | ✅ | Última actualización (auto) |

**⚠️ NO hay tabla `stock_items`** - El stock guarda cada movimiento directamente.

---

## productos

Catálogo de productos.

### Columnas (estimadas)

| Columna | Tipo | NOT NULL | Descripción |
|---------|------|----------|-------------|
| `id` | uuid | ✅ | ID único |
| `organization_id` | uuid | ✅ | FK → organizations |
| `nombre` | text | ✅ | Nombre del producto |
| `emoji` | text | ❌ | Emoji representativo |
| `codigo_barras` | text | ❌ | Código de barras |
| `categoria` | text | ❌ | Categoría |
| `precio_venta` | numeric | ❌ | Precio de venta |
| `costo` | numeric | ❌ | Costo del producto |
| `created_at` | timestamptz | ✅ | Fecha de creación |
| `updated_at` | timestamptz | ✅ | Última actualización (auto) |

---

## caja_diaria

Turnos de caja (apertura/cierre).

### Columnas (estimadas)

| Columna | Tipo | NOT NULL | Descripción |
|---------|------|----------|-------------|
| `id` | uuid | ✅ | ID único |
| `organization_id` | uuid | ✅ | FK → organizations |
| `sucursal_id` | uuid | ✅ | FK → sucursales |
| `empleado_id` | uuid | ✅ | FK → perfiles |
| `fecha_apertura` | timestamptz | ✅ | Fecha/hora de apertura |
| `fecha_cierre` | timestamptz | ❌ | Fecha/hora de cierre (null = abierta) |
| `monto_inicial` | numeric | ✅ | Monto al abrir |
| `monto_final` | numeric | ❌ | Monto al cerrar |
| `turno` | text | ❌ | 'mañana', 'tarde', 'noche' |
| `created_at` | timestamptz | ✅ | Fecha de creación |
| `updated_at` | timestamptz | ✅ | Última actualización (auto) |

---

## movimientos_caja

Movimientos de dinero en la caja.

### Columnas (basado en código)

| Columna | Tipo | NOT NULL | Descripción |
|---------|------|----------|-------------|
| `id` | uuid | ✅ | ID único |
| `caja_diaria_id` | uuid | ✅ | FK → caja_diaria |
| `organization_id` | uuid | ✅ | FK → organizations |
| `monto` | numeric | ✅ | Monto del movimiento |
| `tipo` | text | ✅ | 'ingreso' o 'egreso' |
| `categoria` | text | ✅ | 'servicios_virtuales', 'proveedores', etc. |
| `descripcion` | text | ❌ | Descripción del movimiento |
| `created_at` | timestamptz | ✅ | Fecha de creación |
| `updated_at` | timestamptz | ✅ | Última actualización (auto) |

---

## Otras Tablas

Las siguientes tablas existen pero están vacías (estructura parcial):

- `asistencia` - Control de asistencia de empleados
- `misiones` - Sistema de gamificación
- `plantillas_misiones` - Templates de misiones
- `compras` - Registro de compras a proveedores
- `proveedores` - Catálogo de proveedores
- `historial_precios` - Histórico de cambios de precio
- `pending_invites` - Invitaciones pendientes
- `actividades_empleados` - Log de actividades
- `alertas_vencimientos` - Alertas de productos por vencer
- `metricas_diarias` - Métricas del negocio
- `servicios_virtuales` - Catálogo de servicios
- `tareas_empleados` - Sistema de tareas
- `ventas` - Ventas de productos físicos (no implementado)

---

## 🔗 Relaciones Principales

```
organizations
  ├─ perfiles (organization_id)
  ├─ sucursales (organization_id)
  ├─ productos (organization_id)
  └─ ventas_servicios (organization_id)

sucursales
  ├─ perfiles (sucursal_id)
  ├─ caja_diaria (sucursal_id)
  └─ ventas_servicios (sucursal_id)

caja_diaria
  ├─ movimientos_caja (caja_diaria_id)
  └─ ventas_servicios (caja_diaria_id)
```

---

## ⚠️ Notas Importantes

1. **NO existe tabla `stock_items`** - Stock es tabla única
2. **NO existe tabla `ventas_items`** - Ventas no está implementado para productos físicos
3. **ventas_servicios NO tiene `empleado_id`** - No se registra quién vende
4. **ventas_servicios mantiene `fecha_venta` (legado)** - Ahora también tiene `created_at` estándar
5. **TODAS las tablas tienen `created_at` y `updated_at`** (Estándar Maestro)
6. **Multi-tenant por `organization_id`** - RLS debe filtrar por esta columna
7. **Triggers automáticos actualizan `updated_at`** en cada UPDATE

---

## 📝 Fuente de Información

- ✅ organizations, perfiles, sucursales: Datos reales de Supabase
- ✅ ventas_servicios: Código fuente `components/widget-servicios.tsx`
- ✅ stock: Código fuente `components/agregar-stock.tsx`
- ⚠️ Otras tablas: Estimadas (están vacías)

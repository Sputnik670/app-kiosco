# 📚 Repositorios - PlanetaZEGA

> Capa de acceso a datos siguiendo el patrón Repository

---

## 🎯 Principios de Diseño

### Estándar Maestro

Todos los repositorios siguen estos principios:

1. **Patrón de respuesta unificado**: `{ data, error }`
2. **Sin lógica de negocio**: Solo traducción DB ↔ código
3. **Tipado estricto**: Uso de tipos generados de Supabase
4. **Esquema estandarizado**: Todas las tablas tienen `id`, `organization_id`, `created_at`, `updated_at`

### Patrón de Respuesta

Todos los repositorios SIEMPRE retornan:

```typescript
{
  data: T | null,
  error: Error | null
}
```

**Reglas:**
- ✅ Si éxito: `{ data: resultado, error: null }`
- ❌ Si fallo: `{ data: null, error: new Error(mensaje) }`
- ⚠️ NUNCA lanzar excepciones - siempre capturar y retornar `error`

---

## 📂 Estructura

```
lib/repositories/
├── organization.repository.ts   ← Gestión de organizaciones
├── producto.repository.ts       ← Gestión de productos ✅ NUEVO
├── stock.repository.ts          ← Gestión de inventario ✅ NUEVO
├── perfil.repository.ts         ← Gestión de perfiles (TODO)
├── sucursal.repository.ts       ← Gestión de sucursales (TODO)
└── README.md                    ← Este archivo
```

---

## 🏢 organization.repository.ts

### Funciones Disponibles

#### 1. `createInitialSetup()`

Crea el setup completo para un nuevo usuario:
1. Organización
2. Perfil de dueño
3. Sucursal principal

**Parámetros:**
```typescript
interface CreateInitialSetupParams {
  userId: string        // ID de Supabase Auth
  profileName: string   // Nombre del dueño
  email: string         // Email del usuario
  orgName?: string      // Nombre del negocio (default: 'Mi Negocio')
}
```

**Retorno:**
```typescript
{
  data: {
    organization: Organization,
    perfil: Perfil,
    sucursal: Sucursal
  } | null,
  error: Error | null
}
```

**Uso:**
```typescript
import { createInitialSetup } from '@/lib/repositories/organization.repository'

const { data, error } = await createInitialSetup({
  userId: 'auth-user-id',
  profileName: 'Juan Pérez',
  email: 'juan@example.com',
  orgName: 'Kiosco de Juan'
})

if (error) {
  console.error('Error:', error.message)
  return
}

console.log('Setup creado:', data.organization.nombre)
```

---

#### 2. `getOrganizationById()`

Obtiene una organización por ID.

**Parámetros:**
```typescript
organizationId: string
```

**Retorno:**
```typescript
{
  data: Organization | null,
  error: Error | null
}
```

---

#### 3. `updateOrganization()`

Actualiza campos de una organización.

**Parámetros:**
```typescript
organizationId: string
updates: Partial<OrganizationInsert>
```

**Retorno:**
```typescript
{
  data: Organization | null,
  error: Error | null
}
```

**Uso:**
```typescript
const { data, error } = await updateOrganization('org-id', {
  nombre: 'Nuevo Nombre',
  plan: 'premium'
})
```

---

## 🛠️ Estándar Maestro

Todos los repositorios siguen el **Estándar Maestro** definido en `docs/DATABASE_SCHEMA.md`:

```
Columnas obligatorias en TODAS las tablas:
- id              (uuid, PK)
- organization_id (uuid, FK → organizations)
- created_at      (timestamptz, auto)
- updated_at      (timestamptz, auto + trigger)
```

---

## ⚠️ Reglas de Desarrollo

### ✅ HACER
- Usar tipos de `@/types/database.types`
- Retornar siempre `{ data, error }`
- Capturar TODOS los errores
- Documentar con JSDoc
- Seguir nombres exactos de `docs/DATABASE_SCHEMA.md`

### ❌ NO HACER
- Lanzar excepciones (`throw`)
- Agregar validaciones de negocio
- Mezclar lógica de UI
- Inventar nombres de columnas
- Usar `any` como tipo

---

## 📖 Referencia

- **Esquema de DB:** `docs/DATABASE_SCHEMA.md`
- **Tipos TypeScript:** `types/database.types.ts`
- **Cliente Supabase:** `lib/supabase.ts`

---

---

## 📦 producto.repository.ts

### Funciones Disponibles

#### 1. `createProducto()`
Crea un nuevo producto en el catálogo.

**Parámetros:**
```typescript
interface CreateProductoParams {
  organizationId: string
  nombre: string
  emoji?: string | null
  codigoBarras?: string | null
  categoria?: string | null
  precioVenta?: number | null
  costo?: number | null
}
```

**Uso:**
```typescript
const { data, error } = await createProducto({
  organizationId: org.id,
  nombre: 'Coca Cola 500ml',
  emoji: '🥤',
  codigoBarras: '7790123456789',
  categoria: 'Bebidas',
  precioVenta: 2500,
  costo: 1500,
})
```

#### 2. `listProductosByOrganization()`
Lista todos los productos de una organización.

#### 3. `searchProductos()`
Busca productos por nombre o código de barras.

#### 4. `updateProducto()` y `deleteProducto()`
Actualiza o elimina productos.

---

## 📊 stock.repository.ts

### Conceptos Clave

**⚠️ IMPORTANTE:**
- **NO existe tabla `stock_items`**: Solo existe la tabla `stock`
- Cada fila representa un **movimiento** (entrada o salida)
- Stock disponible = SUM(entradas) - SUM(salidas)

### Funciones Disponibles

#### 1. `createStockEntrada()`
Registra una entrada de stock (compra o carga inicial).

**Parámetros:**
```typescript
interface CreateStockEntradaParams {
  organizationId: string
  sucursalId: string
  productoId: string
  cantidad: number
  fechaVencimiento: string // Formato: YYYY-MM-DD
  proveedorId?: string | null
  compraId?: string | null
  costoUnitarioHistorico?: number | null
}
```

**Uso:**
```typescript
const { data, error } = await createStockEntrada({
  organizationId: org.id,
  sucursalId: sucursal.id,
  productoId: producto.id,
  cantidad: 24,
  fechaVencimiento: '2026-12-31',
  costoUnitarioHistorico: 1500,
})
```

#### 2. `createStockSalida()`
Registra una salida de stock (venta).

**⚠️ NOTA:** Esta función NO valida stock disponible. Debes validar antes usando `getStockDisponible()`.

#### 3. `getStockDisponible()`
Calcula el stock disponible de un producto.

**Uso:**
```typescript
const { data: stockActual, error } = await getStockDisponible(
  org.id,
  sucursal.id,
  producto.id
)

console.log(`Stock disponible: ${stockActual} unidades`)
```

#### 4. `getProductosProximosAVencer()`
Obtiene productos próximos a vencer (alertas).

#### 5. `marcarProductosVencidos()`
Actualiza el estado de productos vencidos (ejecutar diariamente).

---

## ✅ Casos de Uso Completos

### Caso 1: Onboarding de nuevo dueño

```typescript
import { createInitialSetup } from '@/lib/repositories/organization.repository'

const { data, error } = await createInitialSetup({
  userId: user.id,
  profileName: 'María González',
  email: 'maria@example.com',
  orgName: 'Kiosco Don José',
})

if (error) {
  console.error('Error en onboarding:', error)
  return
}

console.log('Setup completo:', data)
// data = { organization, perfil, sucursal }
```

### Caso 2: Cargar inventario inicial

```typescript
import { createProducto } from '@/lib/repositories/producto.repository'
import { createStockEntrada } from '@/lib/repositories/stock.repository'

// 1. Crear producto
const { data: producto, error: prodError } = await createProducto({
  organizationId: org.id,
  nombre: 'Alfajor Jorgito',
  emoji: '🍫',
  categoria: 'Golosinas',
  precioVenta: 800,
  costo: 500,
})

// 2. Registrar stock inicial
const { data: stock, error: stockError } = await createStockEntrada({
  organizationId: org.id,
  sucursalId: sucursal.id,
  productoId: producto.id,
  cantidad: 50,
  fechaVencimiento: '2026-06-30',
  costoUnitarioHistorico: 500,
})
```

### Caso 3: Registrar venta de producto

```typescript
import { getStockDisponible, createStockSalida } from '@/lib/repositories/stock.repository'

// 1. Verificar stock
const { data: stockDisponible } = await getStockDisponible(
  org.id,
  sucursal.id,
  producto.id
)

if (stockDisponible < 1) {
  console.error('Sin stock disponible')
  return
}

// 2. Registrar venta
const { data: salida, error } = await createStockSalida({
  organizationId: org.id,
  sucursalId: sucursal.id,
  productoId: producto.id,
  cantidad: 1,
})
```

---

## 🚀 Próximos Repositorios

- [ ] `perfil.repository.ts` - Gestión de perfiles
- [ ] `sucursal.repository.ts` - Gestión de sucursales
- [ ] `venta.repository.ts` - Gestión de ventas de servicios
- [ ] `caja.repository.ts` - Gestión de caja diaria

# Patrones de Código Aprobados

Todos los new features deben seguir estos patrones exactamente. Son la forma estándar en App Kiosco y garantizan compatibilidad, seguridad y mantenibilidad.

---

## 1. Server Actions Pattern

**Ubicación**: `lib/actions/*.actions.ts`

**Template**:

```typescript
'use server'

import { verifyAuth, verifyOwner } from '@/lib/actions/auth-helpers'

export async function myActionName(
  param1: string,
  param2: number
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    // Para acciones de cualquier usuario autenticado:
    const { supabase, orgId, user } = await verifyAuth()

    // Para acciones SOLO del dueño:
    const { supabase, orgId, user } = await verifyOwner()

    // Lógica de negocio
    const { data, error } = await supabase
      .from('some_table')
      .select('*')
      .eq('org_id', orgId)

    if (error) {
      return { success: false, error: error.message }
    }

    // Procesar datos...

    return { success: true, data }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return { success: false, error: message }
  }
}
```

**Reglas críticas**:
- SIEMPRE retornar `{ success: boolean, error?: string, data?: any }`
- SIEMPRE usar `try/catch`
- NUNCA importar `@/lib/supabase` (client de navegador) — usar `verifyAuth()` o `verifyOwner()`
- NUNCA exponer secretos en el cliente (env vars del servidor quedan en el servidor)
- SIEMPRE incluir `org_id` en WHERE para aislar datos por organización (RLS)

---

## 2. Client Component Pattern

**Ubicación**: `app/*/` o `components/`

**Template**:

```typescript
'use client'

import { useState, useCallback, useEffect } from 'react'
import { myActionName } from '@/lib/actions/my-actions'

interface ComponentState {
  loading: boolean
  data: DataType | null
  error: string | null
}

export default function MyComponent() {
  const [state, setState] = useState<ComponentState>({
    loading: true,
    data: null,
    error: null,
  })

  // Fetch data
  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))

    const result = await myActionName()

    if (result.success) {
      setState((prev) => ({
        ...prev,
        data: result.data,
        loading: false,
      }))
    } else {
      setState((prev) => ({
        ...prev,
        error: result.error || 'Error desconocido',
        loading: false,
      }))
    }
  }, [])

  // Load on mount
  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (state.loading) {
    return <div className="p-4">Cargando...</div>
  }

  if (state.error) {
    return <div className="p-4 text-red-600">{state.error}</div>
  }

  return (
    <div>
      {/* Render data */}
      {state.data && <div>{JSON.stringify(state.data)}</div>}
    </div>
  )
}
```

**Reglas**:
- Usar `useCallback` para funciones de fetch
- Usar `useEffect` para carregar en mount (con dependencias correctas)
- Estados separados: `loading`, `data`, `error`
- NUNCA llamar a Supabase directamente desde cliente (usar server actions)
- Para formas: usar `useState` para controlar inputs, enviar data con server action

---

## 3. Form with Server Action Pattern

**Template**:

```typescript
'use client'

import { useState } from 'react'
import { updateProductAction } from '@/lib/actions/product.actions'

export default function EditProductForm({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    sale_price: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await updateProductAction(productId, {
      name: formData.name,
      sale_price: Number(formData.sale_price),
    })

    if (result.success) {
      // Toast, redirect, etc.
      setFormData({ name: '', sale_price: '' })
    } else {
      setError(result.error || 'Error desconocido')
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Nombre
        </label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          disabled={loading}
          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="price" className="block text-sm font-medium">
          Precio
        </label>
        <input
          id="price"
          type="number"
          step="0.01"
          value={formData.sale_price}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, sale_price: e.target.value }))
          }
          disabled={loading}
          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-md transition"
      >
        {loading ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  )
}
```

---

## 4. DECIMAL Type Handling

**NUNCA hacer esto**:

```typescript
// MALO 1: comparación directa
if (product.sale_price !== oldPrice) { ... }

// MALO 2: aritmética sin casteo
const total = items.reduce((sum, item) => sum + item.price, 0)

// MALO 3: conversión incompleta
const price = product.sale_price * 1.1 // NaN si es string
```

**SIEMPRE hacer esto**:

```typescript
// CORRECTO 1: comparación con tolerancia
if (Math.abs(Number(product.sale_price) - Number(oldPrice)) > 0.01) {
  // Precios son diferentes (tolerancia de 1 centavo)
}

// CORRECTO 2: suma con casteo
const total = items.reduce((sum, item) => sum + Number(item.price), 0)

// CORRECTO 3: aritmética segura
const price = Number(product.sale_price) * 1.1

// CORRECTO 4: en comparaciones de arrays
const hasDiscounted = products.some(
  (p) => Math.abs(Number(p.sale_price) - Number(p.cost_price)) > 0.01
)
```

**En Supabase queries**: Cast en la query cuando sea posible:

```typescript
const { data } = await supabase
  .from('sales')
  .select(
    `*,
     products(id, name, sale_price::text)`
  )
  .eq('org_id', orgId)

// Al procesar:
data.forEach((sale) => {
  const total = Number(sale.amount) // cast de string a number
})
```

---

## 5. Table Queries with RLS

**Template**:

```typescript
// SIEMPRE incluir org_id para aislar datos por organización

// SELECT
const { data, error } = await supabase
  .from('products')
  .select('id, name, sale_price')
  .eq('org_id', orgId)
  .order('created_at', { ascending: false })

// INSERT
const { data, error } = await supabase
  .from('products')
  .insert({
    org_id: orgId, // CRÍTICO
    name: 'Leche',
    sale_price: '45.50',
  })

// UPDATE
const { data, error } = await supabase
  .from('products')
  .update({ sale_price: '48.00' })
  .eq('id', productId)
  .eq('org_id', orgId) // verificación doble

// DELETE
const { data, error } = await supabase
  .from('products')
  .delete()
  .eq('id', productId)
  .eq('org_id', orgId) // verificación doble
```

**Regla**: SIEMPRE `.eq('org_id', orgId)` en WHERE, incluso si la RLS lo valida. Defensa en profundidad.

---

## 6. Component Color Conventions

Colores estandarizados por contexto:

```typescript
// Comisiones, precios, valores monetarios
<span className="text-indigo-600">Comisión: $500</span>
<span className="text-violet-600">Precio base: $1000</span>

// Dinero, ingresos, éxito
<span className="text-emerald-600">+$1500 vendido</span>
<span className="bg-emerald-50 text-emerald-700">Pagado</span>

// Peligro, eliminación, errores
<button className="bg-red-600 hover:bg-red-700 text-white">Eliminar</button>
<span className="text-red-600">Error: stock insuficiente</span>

// Mercado Pago, integraciones
<button className="bg-sky-600 hover:bg-sky-700">Conectar con MP</button>

// Estado neutral/info
<span className="text-slate-600">Pendiente</span>
<span className="bg-blue-50 text-blue-700">Info: nuevo producto</span>
```

---

## 7. Mobile-First Design

App Kiosco es mobile-first. El kiosquero usa celular, no PC.

**Responsive breakpoints**:
```typescript
// Tailwind defaults
// sm: 640px (tablets)
// md: 768px (tablets large)
// lg: 1024px (desktop)

// Siempre diseñar para 360px primero
```

**Touch targets**:
- MÍNIMO 44x44px para botones
- NUNCA botones < 40px en mobile
- Padding: `p-3` o `p-4` entre elementos interactivos

**Test**:
```bash
# Simular resolución del kiosquero
# En Chrome DevTools: Dimensions > 360 x 640
```

**Bad**:
```typescript
<button className="p-1 text-xs">Aceptar</button> // muy pequeño
```

**Good**:
```typescript
<button className="w-full p-3 text-sm font-medium bg-indigo-600 text-white rounded-md">
  Aceptar
</button>
```

---

## 8. Error Handling & User Feedback

**Server action errors**:

```typescript
export async function deleteProduct(
  productId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, orgId } = await verifyAuth()

    // Validaciones ANTES de mutation
    const { data: product } = await supabase
      .from('products')
      .select('stock')
      .eq('id', productId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (!product) {
      return { success: false, error: 'Producto no encontrado' }
    }

    if (Number(product.stock) > 0) {
      return { success: false, error: 'No se puede eliminar producto con stock' }
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
      .eq('org_id', orgId)

    if (error) {
      return { success: false, error: 'Error al eliminar: ' + error.message }
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return { success: false, error: message }
  }
}
```

**Client feedback**:

```typescript
'use client'

import { useState } from 'react'
import { toast } from 'sonner' // usar sonner para toasts

const handleDelete = async () => {
  try {
    const result = await deleteProduct(productId)

    if (result.success) {
      toast.success('Producto eliminado')
      // router.push('/productos')
    } else {
      toast.error(result.error || 'Error desconocido')
    }
  } catch (error) {
    toast.error('Error inesperado')
  }
}
```

---

## 9. Logging (No console.log)

Usar el logger centralizado, nunca `console.log` en producción:

```typescript
import { logger } from '@/lib/logging'

// En server actions
logger.info('user_created', { userId: user.id, orgId })
logger.warn('low_stock_alert', { productId, stock })
logger.error('payment_failed', { orderId, reason: error.message })

// En componentes (client)
// Los logs de client quedan en el browser console, safe
console.log('[DEBUG]', 'component mounted')
```

---

## 10. Testing Pattern

Tests deben ser simples y enfocados:

```typescript
// __tests__/product.actions.test.ts

import { createProduct, updateProduct } from '@/lib/actions/product.actions'

describe('Product Actions', () => {
  it('should create a product with valid data', async () => {
    const result = await createProduct({
      name: 'Leche entera',
      cost_price: 25.5,
      sale_price: 45.5,
    })

    expect(result.success).toBe(true)
    expect(result.data).toHaveProperty('id')
  })

  it('should return error for invalid price', async () => {
    const result = await createProduct({
      name: 'Agua',
      cost_price: -10, // INVALID
      sale_price: 5,
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('precio')
  })

  it('should handle DECIMAL values correctly', async () => {
    const result = await updateProduct('prod_123', {
      sale_price: 199.99,
    })

    expect(result.success).toBe(true)
    // Verify in DB: Number(retrieved.sale_price) === 199.99
  })
})
```


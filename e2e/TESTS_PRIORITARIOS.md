# 🎯 Tests Prioritarios para Kiosco 24hs

Esta es una lista de tests E2E que deberían implementarse en orden de prioridad.

## ✅ Ya Implementados

- [x] Test básico de carga de página
- [x] Test básico de autenticación (estructura)
- [x] Test básico de registro de empleado (estructura)

## 🔥 Prioridad Alta (Semana 1-2)

### 1. Autenticación Completa
- [ ] Login como dueño con email/password
- [ ] Login con Magic Link
- [ ] Logout
- [ ] Verificar redirección según rol
- [ ] Manejo de credenciales inválidas

### 2. Flujo de Registro de Empleado
- [ ] Recepción de invitación (simulado)
- [ ] Clic en magic link
- [ ] Completar formulario de perfil
- [ ] Verificar vinculación a organización
- [ ] Verificar acceso al dashboard de empleado

### 3. Gestión de Productos
- [ ] Crear nuevo producto
- [ ] Buscar producto por código de barras
- [ ] Actualizar precio de producto
- [ ] Ver lista de productos
- [ ] Eliminar producto

### 4. Gestión de Stock
- [ ] Agregar stock a producto existente
- [ ] Ver stock disponible
- [ ] Ver productos con stock crítico
- [ ] Registrar entrada de stock con compra

## 📊 Prioridad Media (Semana 3-4)

### 5. Ventas
- [ ] Abrir caja diaria
- [ ] Registrar venta de producto
- [ ] Calcular total correctamente
- [ ] Actualizar stock después de venta
- [ ] Generar ticket de venta
- [ ] Procesar pago con múltiples métodos

### 6. Gestión de Caja
- [ ] Apertura de caja con monto inicial
- [ ] Registro de movimientos (ingreso/egreso)
- [ ] Cierre de caja y cálculo de diferencia
- [ ] Ver historial de cajas

### 7. Gestión de Proveedores
- [ ] Crear nuevo proveedor
- [ ] Ver lista de proveedores
- [ ] Actualizar saldo de proveedor
- [ ] Registrar compra a proveedor

## 🎨 Prioridad Baja (Semana 5+)

### 8. Misiones y Gamificación
- [ ] Asignar misión a empleado
- [ ] Completar misión
- [ ] Ver ranking de empleados
- [ ] Verificar XP y puntos

### 9. Gestión de Sucursales
- [ ] Crear nueva sucursal
- [ ] Cambiar de sucursal
- [ ] Ver stock por sucursal

### 10. Reportes y Analytics
- [ ] Ver dashboard de dueño
- [ ] Ver métricas de ventas
- [ ] Exportar reportes

## 🛠️ Tests de Integración con Supabase

### RLS (Row Level Security)
- [ ] Usuario solo ve datos de su organización
- [ ] Empleado no puede acceder a funciones de dueño
- [ ] Invitaciones pendientes funcionan correctamente

### Validaciones de Base de Datos
- [ ] Constraints de base de datos se cumplen
- [ ] Foreign keys funcionan correctamente
- [ ] Índices mejoran performance

## 📝 Notas para Implementación

### Data Test IDs Recomendados

Para facilitar los tests, considera agregar `data-testid` a elementos clave:

```tsx
// Ejemplo
<Button data-testid="login-submit">Iniciar Sesión</Button>
<input data-testid="product-search" />
```

### Helpers Útiles

Crea helpers para operaciones comunes:
- `loginAsOwner()` - Login como dueño
- `loginAsEmployee()` - Login como empleado
- `createTestProduct()` - Crear producto de prueba
- `cleanupTestData()` - Limpiar datos de prueba

### Fixtures de Playwright

Usa fixtures para compartir estado entre tests:

```typescript
import { test as base } from '@playwright/test';

export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    // Setup de autenticación
    await use(page);
  },
});
```


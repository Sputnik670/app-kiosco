# Checklist de Prueba Manual — App Kiosco

> **Fecha:** 22 de abril de 2026
> **Ambiente:** Producción (`https://app-kiosco-chi.vercel.app`)
> **Owner de prueba:** `ramiro.ira92@gmail.com`
> **Empleado de prueba:** `entornomincyt@gmail.com`
> **Duración estimada:** 40 min

## Objetivo

Validar que los 4 fixes de auth del deploy anterior, los fixes de scanner (25 mar), los fixes de proveedores (29 mar) y el fix del loop de `useOnlineStatus` (hoy) siguen funcionando en producción. Cubrir los 7 flujos críticos que los smokes de Playwright testeaban.

## Convenciones

- Todo lo que crees durante la prueba lo prefijás con `TEST-MANUAL-<hora>` (ej: `TEST-MANUAL-1430-Galletitas`). Al final hay una sección de cleanup.
- Si algo no cumple el "Esperado", parás ahí, me mandás screenshot y diagnosticamos.
- Antes de arrancar: abrí la app en **modo incógnito** (para arrancar sin cookies viejas) y tené DevTools abierto (F12) para ver la consola.

---

## Sección 1 — Auth y selección de sucursal

### 1.1 — Login owner

- [ ] **Acción:** Abrir `https://app-kiosco-chi.vercel.app` en incógnito.
- [ ] **Esperado:** Pantalla de login "Kiosco App" con campos Email y Contraseña.
- [ ] **Esperado (fix 2026-04-22):** NO aparece botón "Continuar con Google" ni "Ingresar sin contraseña".
- [ ] **Acción:** Ingresar `ramiro.ira92@gmail.com` + tu password + Iniciar Sesión.
- [ ] **Esperado:** Toast verde "¡Bienvenido!" + redirect a la pantalla "¿Dónde operamos hoy?".

### 1.2 — Selección de sucursal

- [ ] **Esperado:** Ver al menos "Sucursal Principal" con ícono de pin azul.
- [ ] **Acción:** Click en Sucursal Principal.
- [ ] **Esperado:** Entra al dashboard, header muestra "Torre de Control".

### 1.3 — Recuperar contraseña (NO completar el reset)

- [ ] **Acción:** Logout (botón en el header).
- [ ] **Esperado:** Vuelve a la pantalla de login.
- [ ] **Acción:** Click en "¿Olvidaste tu contraseña?".
- [ ] **Esperado:** El campo de password desaparece. Título cambia a "Recuperar contraseña".
- [ ] **Acción:** Poner `ramiro.ira92@gmail.com` + Enviar enlace de recuperación.
- [ ] **Esperado:** Toast "Enlace de recuperación enviado". Vuelve al formulario de login.
- [ ] **Acción:** Volver a loguearte normalmente.

### 1.4 — Indicador de conexión (fix de hoy — loop infinito)

- [ ] **Esperado:** En el dashboard, DevTools consola NO debe tener "Maximum update depth exceeded".
- [ ] **Acción:** Abrir DevTools > Network > Throttling: **Offline**.
- [ ] **Esperado:** Aparece banner offline (o cambia el ícono de conexión a rojo).
- [ ] **Acción:** Volver a Throttling: **No throttling**.
- [ ] **Esperado:** Banner desaparece. Console log `[Connection] Online`.

---

## Sección 2 — Dashboard Dueño + tabs

### 2.1 — Navegación de tabs

- [ ] **Acción:** Tocar cada tab en orden: Ventas → Análisis → Stock → Proveedores → Control Empleados → Historial → Ajustes.
- [ ] **Esperado:** Cada tab carga sin error (puede haber spinner 1-2 seg por lazy loading). No hay pantalla blanca ni error en consola.

### 2.2 — KPIs del dashboard (tab Análisis)

- [ ] **Esperado:** KPIs como "Ventas hoy", "Margen", etc., con valores numéricos (no "undefined" ni "$NaN").
- [ ] **Esperado (fix margen real):** Si tenés ventas con productos con `unit_cost` > 0, el margen no es el 30% fijo hardcodeado, sino el margen real calculado.

---

## Sección 3 — Inventario

### 3.1 — Crear producto con scanner (fix 25 mar — OpenFoodFacts)

- [ ] **Acción:** Ir a tab Stock → Crear producto.
- [ ] **Acción:** Usar el lector de código de barras desde el celular o, en desktop, poner un código manualmente (ej: `7790040001954` — Coca-Cola).
- [ ] **Esperado:** Si es un producto conocido, auto-completa nombre, marca, categoría desde OpenFoodFacts o `product_catalog`. Si no, pide cargar manual.
- [ ] **Acción:** Completar nombre `TEST-MANUAL-<hora>-CocaCola`, precio $500, stock 10.
- [ ] **Acción:** Click en "Confirmar Alta".
- [ ] **Esperado:** Toast de éxito + producto aparece en lista de inventario.

### 3.2 — Editar producto

- [ ] **Acción:** Buscar `TEST-MANUAL-` en inventario → click en el producto.
- [ ] **Acción:** Cambiar precio a $550 → guardar.
- [ ] **Esperado:** Precio actualizado en la lista.

---

## Sección 4 — Proveedores (fix 29 mar — supplier_type + soft-delete)

### 4.1 — Crear proveedor de productos

- [ ] **Acción:** Ir a tab Proveedores → botón "Nuevo".
- [ ] **Esperado:** Modal abre con selector de tipo (Producto / Servicio).
- [ ] **Acción:** Elegir **Producto** + nombre `TEST-MANUAL-<hora>-Provee` + categoría "Bebidas" + guardar.
- [ ] **Esperado:** Aparece en sección "Proveedores de productos" con badge de tipo.

### 4.2 — Crear proveedor de servicios

- [ ] **Acción:** Click en "Nuevo" otra vez.
- [ ] **Acción:** Elegir **Servicio** + nombre `TEST-MANUAL-<hora>-ServProvee` + comisión 3% + guardar.
- [ ] **Esperado:** Aparece en sección "Proveedores de servicios" (separada de productos).

### 4.3 — Soft-delete (fix 29 mar — RPC `deactivate_supplier`)

- [ ] **Acción:** Click en el botón de borrar del proveedor `TEST-MANUAL-<hora>-Provee`.
- [ ] **Acción:** Confirmar la eliminación.
- [ ] **Esperado:** Desaparece de la lista sin error. (Antes del fix, tiraba error silencioso por RLS del RETURNING.)

---

## Sección 5 — Caja y venta completa

### 5.1 — Abrir caja

- [ ] **Acción:** Tab Ventas → "Empezar jornada".
- [ ] **Acción:** Poner monto inicial $5000 → confirmar.
- [ ] **Esperado:** Estado cambia a "Turno activo". Aparece el punto de venta (PdV).

### 5.2 — Buscar producto y vender

- [ ] **Acción:** En el PdV, buscar `TEST-MANUAL-` → click en el producto.
- [ ] **Esperado:** Producto aparece en el carrito con cantidad 1 y precio $550.
- [ ] **Acción:** Seleccionar método de pago **Efectivo**.
- [ ] **Acción:** Click en "Confirmar venta".
- [ ] **Esperado:** Toast de éxito. Carrito se vacía. Stock del producto bajó en 1 (ir a tab Stock a verificar).

### 5.3 — Vender un servicio virtual (SUBE o cargas)

- [ ] **Acción:** Volver al PdV → ir al widget de SUBE o servicios.
- [ ] **Acción:** Cargar una venta de servicio de $100 (elegir proveedor `TEST-MANUAL-<hora>-ServProvee` si el widget lo pide).
- [ ] **Esperado:** Venta registrada. La comisión del proveedor se aplicó según markup.

### 5.4 — Cerrar caja

- [ ] **Acción:** Click en "Cerrar caja".
- [ ] **Esperado:** Resumen muestra:
  - Monto inicial: $5000
  - Venta en efectivo: $550 (de 5.2)
  - Venta de servicio: $100 (de 5.3)
  - Monto esperado en caja: $5650
- [ ] **Acción:** Confirmar cierre.
- [ ] **Esperado:** Toast de éxito. Estado vuelve a "Caja cerrada".

---

## Sección 6 — Empleados

### 6.1 — Ver lista de empleados

- [ ] **Acción:** Tab Control Empleados.
- [ ] **Esperado:** Lista muestra al menos al empleado de prueba (`entornomincyt@gmail.com`). Si no está, saltar a 6.2.

### 6.2 — Invitar empleado (probar flujo sin mandar)

- [ ] **Acción:** Click "Invitar empleado".
- [ ] **Esperado:** Modal abre con campo email y rol.
- [ ] **Acción:** Llenar con `test-manual-<hora>@ejemplo-nopeque.com` → cancelar (NO enviar).
- [ ] **Esperado:** Modal cierra sin crear registro.

### 6.3 — Ranking de equipo

- [ ] **Acción:** Scrollear para ver el ranking / XP.
- [ ] **Esperado:** Si hay empleados con actividad, se ve el ranking. Si no, mensaje "sin datos aún".

---

## Sección 7 — Misiones (gamificación)

- [ ] **Acción:** Tab Control Empleados → sub-sección Misiones (o tab Misiones si aplica).
- [ ] **Acción:** Asignar una misión simple (ej: "Vender 10 productos hoy") al empleado de prueba.
- [ ] **Esperado:** Misión aparece en el listado. Si el empleado logueado la mira, debe verla en su vista.

---

## Sección 8 — Reportes

### 8.1 — Reporte de stock

- [ ] **Acción:** Tab Reportes → Reporte de stock → Generar PDF.
- [ ] **Esperado:** PDF se descarga. Abrirlo y verificar que aparece `TEST-MANUAL-<hora>-CocaCola` con su stock actual.

### 8.2 — Reporte de ventas

- [ ] **Acción:** Reporte de ventas → rango "Hoy" → Generar Excel.
- [ ] **Esperado:** XLSX se descarga. Abrirlo y verificar que aparecen las ventas de 5.2 y 5.3.

---

## Sección 9 — Vista empleado (opcional, 5 min)

- [ ] **Acción:** Logout.
- [ ] **Acción:** Login con `entornomincyt@gmail.com` + password.
- [ ] **Esperado:** Entra a la vista de empleado (NO al dashboard de dueño). Ve fichaje, sus misiones, su XP.
- [ ] **Acción:** Logout + volver al owner.

---

## Sección 10 — Cleanup

- [ ] **Acción:** Como owner, ir a inventario y eliminar todos los productos `TEST-MANUAL-*`.
- [ ] **Acción:** Ir a proveedores y eliminar los `TEST-MANUAL-*` restantes.
- [ ] **Acción:** Si creaste una misión de prueba, eliminarla.

---

## Resultado

Al terminar, marcá con OK o FAIL cada sección y me pasás el resumen. Si hay FAIL, screenshot + descripción.

| Sección | Estado | Notas |
|---|---|---|
| 1. Auth | | |
| 2. Dashboard | | |
| 3. Inventario | | |
| 4. Proveedores | | |
| 5. Caja/venta | | |
| 6. Empleados | | |
| 7. Misiones | | |
| 8. Reportes | | |
| 9. Vista empleado | | |
| 10. Cleanup | | |

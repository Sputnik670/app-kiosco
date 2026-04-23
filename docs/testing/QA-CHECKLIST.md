# QA Checklist — App Kiosco

> Protocolo de testeo manual completo para validar que toda la app funciona antes de cada demo o deploy a producción.
> Última actualización: 21 de abril de 2026

---

## Cómo usar este documento

1. **Ejecutalo de arriba hacia abajo en una sola corrida.** Está diseñado como un flujo secuencial que va cargando datos reales y encadenando escenarios.
2. Cada escenario tiene un **checkbox [ ]**. Cuando pasa, lo cambiás a **[x]** directamente en VSCode.
3. Si algo falla: marcalo **[FAIL]** y anotá qué viste en la sección `Observación`. No sigas, arreglá primero.
4. **Duración esperada completa:** 90-120 minutos si todo funciona. Si encontrás bugs, más.
5. **Entorno:** corré sobre **producción** (`https://app-kiosco-chi.vercel.app`) o un proyecto Supabase de staging. No sobre la DB real de un cliente.

**Módulos cubiertos:** Auth, Multi-sucursal, Proveedores, Inventario, Scanner Barcode, Caja/Ventas, Servicios Virtuales, Dashboard, Reportes, Facturación interna, Empleados, Fichaje QR, Misiones, XP/Gamificación, Incidentes, Happy Hour.

**Excluidos** (en desarrollo): Mercado Pago QR, ARCA. Ver `docs/testing/PLAN-E2E.md` para cuándo incluirlos.

---

## 0. Pre-requisitos

Antes de arrancar, verificá esto:

- [ ] **Navegador abierto:** Chrome o Edge, en modo incógnito (evita cache).
- [ ] **Dos cuentas de test:** un email que será el dueño y otro que será el empleado. Podés usar aliases tipo `tu+dueno@gmail.com` y `tu+empleado@gmail.com` — Gmail los trata como un buzón pero Supabase como cuentas separadas.
- [ ] **Celular con cámara** a mano para los tests de scanner barcode y QR de fichaje.
- [ ] **Acceso a `https://app-kiosco-chi.vercel.app`** con el proyecto desplegado.
- [ ] **Cronómetro/reloj** para los tests de horarios (fichaje y XP).
- [ ] **Timestamp de inicio:** anotá aquí la hora de arranque → `____:____`

---

## 1. Autenticación y Registro

### 1.1 Registro de nuevo dueño
- [ ] **Objetivo:** un usuario nuevo puede crear su cuenta y queda como `owner` de una nueva organización.
- **Pasos:**
  1. Ir a la URL de producción en una pestaña incógnito.
  2. Click en "Crear cuenta" / "Registrarme".
  3. Ingresar email del dueño y contraseña (mínimo 8 caracteres).
  4. Revisar el inbox, hacer click en el email de confirmación.
  5. Completar el formulario de perfil (nombre, nombre del negocio).
- **Resultado esperado:** Queda logueado, ve la pantalla de "Seleccionar Sucursal" o el onboarding inicial.
- **Observación:**

### 1.2 Login con email y password
- [ ] **Objetivo:** un usuario existente puede volver a entrar.
- **Pasos:**
  1. Hacer logout (ícono arriba a la derecha o menú).
  2. Ingresar email y password del dueño recién creado.
  3. Click "Iniciar sesión".
- **Resultado esperado:** Entra directamente al selector de sucursales o dashboard.
- **Observación:**

### 1.3 Credenciales inválidas
- [ ] **Objetivo:** el sistema bloquea credenciales malas con un mensaje claro.
- **Pasos:**
  1. Logout.
  2. Ingresar el email correcto pero una password random.
  3. Click "Iniciar sesión".
- **Resultado esperado:** Mensaje de error visible ("credenciales inválidas" o similar). NO debe entrar.
- **Observación:**

### 1.4 Logout
- [ ] **Objetivo:** cerrar sesión deja la app inaccesible sin nuevo login.
- **Pasos:**
  1. Estando logueado, click en logout.
  2. Intentar ir directo a `/dashboard` por URL.
- **Resultado esperado:** Redirige al login. No muestra datos privados.
- **Observación:**

---

## 2. Onboarding y Multi-sucursal

### 2.1 Primera sucursal al crear cuenta
- [ ] **Objetivo:** el onboarding crea la primera sucursal sin fricción.
- **Pasos:**
  1. Con el usuario recién registrado, completar el wizard de onboarding si aparece.
  2. Crear sucursal principal: nombre "Sucursal Centro", dirección opcional.
- **Resultado esperado:** La sucursal queda creada y seleccionada automáticamente. Se ve el dashboard.
- **Observación:**

### 2.2 Crear segunda sucursal
- [ ] **Objetivo:** una cadena puede tener varias sucursales con datos aislados.
- **Pasos:**
  1. Ir al tab "Ajustes" → "Gestión de Sucursales" (o menú equivalente).
  2. Click "Nueva sucursal".
  3. Nombre "Sucursal Norte", guardar.
- **Resultado esperado:** Aparece en la lista. Badge de activa/inactiva correcto.
- **Observación:**

### 2.3 Cambiar entre sucursales
- [ ] **Objetivo:** el selector cambia el contexto y los datos se actualizan.
- **Pasos:**
  1. Volver al selector (logo o avatar → cambiar sucursal).
  2. Entrar a "Sucursal Norte".
  3. Ir al tab Stock.
- **Resultado esperado:** Muestra 0 productos (sucursal nueva, sin stock). NO debe mostrar los productos de Centro.
- **Observación:**

### 2.4 Aislamiento de datos entre sucursales (crítico RLS)
- [ ] **Objetivo:** cada sucursal ve SÓLO sus propios datos.
- **Pasos:**
  1. Volver a "Sucursal Centro".
  2. Crear 1 producto (siguiendo el paso 4.1 más abajo si hace falta).
  3. Cambiar a "Sucursal Norte".
  4. Verificar en Stock.
- **Resultado esperado:** El producto creado en Centro NO aparece en Norte.
- **Observación:**

---

## 3. Proveedores

### 3.1 Crear proveedor de productos
- [ ] **Objetivo:** dar de alta un proveedor tipo "producto".
- **Pasos:**
  1. Tab "Proveedores" → botón "Nuevo".
  2. Tipo: Producto.
  3. Nombre: "Arcor", rubro: "Golosinas", condición de pago: "Cuenta corriente".
  4. Guardar.
- **Resultado esperado:** Aparece en la lista, en la sección de proveedores de producto.
- **Observación:**

### 3.2 Crear proveedor de servicios
- [ ] **Objetivo:** dar de alta un proveedor tipo "servicio" con comisión.
- **Pasos:**
  1. "Nuevo" proveedor → Tipo: Servicio.
  2. Nombre: "Pago Fácil", markup tipo: porcentaje, valor: 5%.
  3. Guardar.
- **Resultado esperado:** Aparece en la sección de servicios, con badge visible y porcentaje.
- **Observación:**

### 3.3 Lista agrupada por tipo
- [ ] **Objetivo:** la UI separa visualmente producto/servicio.
- **Pasos:**
  1. Ver la lista completa de proveedores.
- **Resultado esperado:** Se ven 2 secciones claras: "Proveedores de productos" (Arcor) y "Proveedores de servicios" (Pago Fácil). Badge del tipo en cada tarjeta.
- **Observación:**

### 3.4 Editar proveedor
- [ ] **Objetivo:** puedo modificar datos del proveedor.
- **Pasos:**
  1. Click en "Arcor" → editar.
  2. Cambiar rubro a "Golosinas y Galletas", guardar.
- **Resultado esperado:** El cambio persiste al refrescar la página.
- **Observación:**

### 3.5 Soft-delete proveedor (RLS + SECURITY DEFINER)
- [ ] **Objetivo:** eliminar proveedor lo desactiva sin errores (fix aplicado en marzo).
- **Pasos:**
  1. Click en "Pago Fácil" → "Eliminar" / ícono de tacho.
  2. Confirmar.
- **Resultado esperado:** Desaparece de la lista. NO debe salir error tipo "permission denied".
- **Observación:**

### 3.6 Control de saldo de proveedor
- [ ] **Objetivo:** el componente de saldos se muestra correctamente.
- **Pasos:**
  1. En el tab de Proveedores, scrollear hasta el bloque de "Saldos" o "Deudas".
- **Resultado esperado:** Se ve el componente, aunque esté vacío (no hay compras aún). No hay errores de consola.
- **Observación:**

---

## 4. Inventario y Productos

### 4.1 Crear producto manualmente
- [ ] **Objetivo:** crear un producto sin scanner funciona.
- **Pasos:**
  1. Tab "Stock" → formulario superior.
  2. Nombre: "Coca-Cola 500ml", categoría: "Bebidas", costo: 300, precio venta: 500, stock inicial: 20.
  3. Proveedor: "Arcor" (o el que hayas creado).
  4. Click "Confirmar alta".
- **Resultado esperado:** Toast verde de éxito. El producto aparece en la lista de abajo. Margen calculado correctamente (200 pesos, 40%).
- **Observación:**

### 4.2 Crear 3 productos más para tener inventario
- [ ] **Objetivo:** poblar inventario para los tests de caja y reportes.
- **Pasos:** Repetir 4.1 con:
  - "Sprite 500ml" — costo 300, venta 500, stock 15
  - "Papas Lays 100g" — costo 400, venta 650, stock 10
  - "Chicles Beldent" — costo 100, venta 180, stock 50
- **Resultado esperado:** 4 productos totales visibles en inventario.
- **Observación:**

### 4.3 Buscar producto en el inventario
- [ ] **Objetivo:** el buscador filtra sin romperse (fix de filter injection aplicado).
- **Pasos:**
  1. En el input de búsqueda, tipear "coca".
  2. Luego probar con caracteres raros: `coca,(test)`.
- **Resultado esperado:** Filtra correctamente en el primer caso. En el segundo, NO rompe ni arroja error 500 — sólo devuelve 0 resultados o sanitiza.
- **Observación:**

### 4.4 Editar precio de producto
- [ ] **Objetivo:** cambiar el precio de venta se guarda y persiste.
- **Pasos:**
  1. Click en "Coca-Cola 500ml" → editar.
  2. Cambiar precio venta a 550.
  3. Guardar.
- **Resultado esperado:** Precio actualizado. Al refrescar, sigue en 550. Margen recalculado (250 / 45%).
- **Observación:**

### 4.5 Agregar stock a producto existente
- [ ] **Objetivo:** reposición sin crear producto nuevo.
- **Pasos:**
  1. Click en "Coca-Cola" → "Agregar stock" o "+".
  2. Cantidad: 10, costo unitario: 320 (precio actualizado).
  3. Opcionalmente asociar a proveedor.
  4. Guardar.
- **Resultado esperado:** Stock sube a 30 unidades. Queda registro en historial de compras.
- **Observación:**

### 4.6 Scanner barcode — producto en catálogo compartido
- [ ] **Objetivo:** al escanear un código conocido, se autocompleta desde `product_catalog`.
- **Pasos:**
  1. Desde el celular, ir al creador de productos.
  2. Abrir scanner.
  3. Escanear un código de barras de algo común (agua mineral, galletitas).
- **Resultado esperado:** Si está en catálogo, se autocompleta nombre/marca/categoría. Si no, consulta OpenFoodFacts server-side y trae datos (probablemente).
- **Observación:**

### 4.7 Scanner barcode — producto desconocido + contribución al catálogo
- [ ] **Objetivo:** cuando escaneás algo nuevo, se guarda en el catálogo compartido.
- **Pasos:**
  1. Escanear un producto argentino raro o local que no esté en OpenFoodFacts.
  2. Completar manualmente: nombre, marca, categoría.
  3. Guardar el producto.
- **Resultado esperado:** El producto queda en tu inventario Y contribuye al `product_catalog`. (Verificable: si escaneás el mismo código de nuevo en otra cuenta demo, debería autocompletar).
- **Observación:**

### 4.8 Gestión de vencimientos
- [ ] **Objetivo:** cargar fecha de vencimiento y verla en alertas.
- **Pasos:**
  1. Editar "Papas Lays" → agregar fecha de vencimiento a 15 días.
  2. Ir al tab de Alertas o al componente `gestion-vencimientos`.
- **Resultado esperado:** Aparece en la lista de "próximos a vencer".
- **Observación:**

---

## 5. Caja y Ventas (flujo crítico)

### 5.1 Abrir caja con monto inicial
- [ ] **Objetivo:** iniciar turno.
- **Pasos:**
  1. Tab "Ventas" → botón "Empezar jornada".
  2. Monto inicial: 5000.
  3. Confirmar.
- **Resultado esperado:** La caja pasa a "turno activo". Aparece el punto de venta.
- **Observación:**

### 5.2 Registrar venta por búsqueda de nombre
- [ ] **Objetivo:** buscar por texto, agregar al carrito, cobrar.
- **Pasos:**
  1. En el buscador del PdV, escribir "coca".
  2. Click sobre "Coca-Cola 500ml" en el dropdown.
  3. Verificar que se sumó al carrito con precio correcto.
  4. Método de pago: Efectivo.
  5. Click "Confirmar venta".
- **Resultado esperado:** Toast de éxito. El carrito se limpia. El stock de Coca bajó de 30 a 29.
- **Observación:**

### 5.3 Venta con múltiples productos y métodos de pago
- [ ] **Objetivo:** venta compleja con split de pago.
- **Pasos:**
  1. Agregar 2 Papas Lays + 3 Chicles Beldent.
  2. Total esperado: (2 × 650) + (3 × 180) = 1300 + 540 = 1840.
  3. Pagar: 1000 en Efectivo + 840 en Débito.
  4. Confirmar.
- **Resultado esperado:** Venta registrada. Stock actualizado en ambos productos. Métodos de pago desglosados correctamente.
- **Observación:**

### 5.4 Venta con descuento
- [ ] **Objetivo:** aplicar descuento manual al carrito.
- **Pasos:**
  1. Agregar 1 Sprite.
  2. Aplicar descuento 10% o monto fijo.
  3. Confirmar venta.
- **Resultado esperado:** Total con descuento correcto. Se registra en la venta.
- **Observación:**

### 5.5 Registrar movimiento de caja (ingreso/egreso)
- [ ] **Objetivo:** agregar o quitar dinero de la caja sin venta.
- **Pasos:**
  1. Componente "Registrar movimientos".
  2. Tipo: egreso, monto: 500, concepto: "Compra agua".
  3. Guardar.
- **Resultado esperado:** Movimiento registrado. Resumen de caja ajustado.
- **Observación:**

### 5.6 Cerrar caja y ver arqueo
- [ ] **Objetivo:** cierre con diferencia registrada correctamente.
- **Pasos:**
  1. Click "Finalizar jornada" o "Validar caja".
  2. Monto físico declarado: 6500 (el esperado: 5000 inicial + ventas en efectivo - egresos).
  3. Confirmar.
- **Resultado esperado:** Se muestra la diferencia (si hay). El turno queda cerrado. Vuelve a "Nueva apertura". Si la diferencia es mayor al tolerado, el sistema podría aplicar penalización XP al empleado (ver 13).
- **Observación:**

### 5.7 Comparación decimal (regla técnica crítica)
- [ ] **Objetivo:** validar que precios no comparen con `!==` sino con tolerancia 0.01.
- **Pasos:**
  1. Crear un producto con precio 99.99.
  2. Venderlo.
  3. Verificar que la venta se registra bien y no tira "precio no coincide" o similar.
- **Resultado esperado:** La venta pasa sin errores decimales.
- **Observación:**

---

## 6. Servicios Virtuales

### 6.1 Widget SUBE — carga
- [ ] **Objetivo:** vender una carga SUBE con comisión automática.
- **Pasos:**
  1. En el PdV o widget SUBE, ingresar monto de carga: 1000.
  2. El sistema calcula comisión según markup del proveedor.
  3. Confirmar.
- **Resultado esperado:** Se registra la venta en `service_sales`. Monto cobrado al cliente = carga + comisión.
- **Observación:**

### 6.2 Widget de recargas (Claro, Movistar, etc.)
- [ ] **Objetivo:** cargar servicios virtuales distintos a SUBE.
- **Pasos:**
  1. Widget de servicios → elegir operadora.
  2. Monto y datos requeridos.
  3. Confirmar.
- **Resultado esperado:** Venta de servicio registrada. Comisión calculada.
- **Observación:**

### 6.3 Ver ventas de servicios en dashboard
- [ ] **Objetivo:** las ventas de servicios se diferencian de productos en el dashboard.
- **Pasos:**
  1. Tab "Ventas" del dashboard owner.
  2. Ver "Servicios Virtuales" separado de "Productos Físicos".
- **Resultado esperado:** Facturación total incluye ambos. Desglose claro.
- **Observación:**

---

## 7. Dashboard del Dueño

### 7.1 Torre de Control — todos los tabs cargan
- [ ] **Objetivo:** los 7 tabs navegables sin error.
- **Pasos:** Navegar a cada tab en este orden:
  - [ ] Ventas
  - [ ] Análisis
  - [ ] Stock
  - [ ] Proveedores
  - [ ] Control Empleados
  - [ ] Historial
  - [ ] Ajustes
- **Resultado esperado:** Cada tab carga sin pantalla en blanco ni error. El tiempo de carga es razonable (<3s).
- **Observación:**

### 7.2 Dashboard — margen REAL (no hardcodeado, fix marzo)
- [ ] **Objetivo:** el margen mostrado usa `unit_cost` real de la venta.
- **Pasos:**
  1. Tab "Análisis" → ver margen del día.
- **Resultado esperado:** El % de margen matchea con los costos reales que cargaste. Si todos los productos tienen costo 60% del precio, margen debería estar cerca del 40%.
- **Observación:**

### 7.3 Tab Historial — sin N+1 (fix marzo)
- [ ] **Objetivo:** el historial carga rápido aun con muchos empleados.
- **Pasos:**
  1. Tab "Historial" con al menos 3 empleados cargados (ver sección 10).
- **Resultado esperado:** Carga en <3s. No se ven múltiples requests consecutivos en DevTools → Network (deberían ser queries batcheadas con `.in(...)`).
- **Observación:**

### 7.4 Tab Timeline — touch targets móviles
- [ ] **Objetivo:** desde el celular, los botones son tocables (36px mínimo).
- **Pasos:**
  1. Abrir la app en el celular.
  2. Ir al tab Timeline.
- **Resultado esperado:** Los botones y filtros se pueden tocar sin zoom. Ningún elemento corta en la viewport de 360px.
- **Observación:**

### 7.5 Alertas
- [ ] **Objetivo:** ver productos con stock crítico y vencimientos próximos.
- **Pasos:**
  1. Vender Coca-Cola hasta dejarla con <5 unidades.
  2. Ir al tab de Alertas.
- **Resultado esperado:** Coca-Cola aparece como "stock bajo". Las Papas Lays (con vencimiento cercano del 4.8) aparecen como "por vencer".
- **Observación:**

### 7.6 Supervisión
- [ ] **Objetivo:** ver actividad reciente por empleado.
- **Pasos:**
  1. Tab Control Empleados o Supervisión.
- **Resultado esperado:** Lista de empleados, última actividad, métricas básicas.
- **Observación:**

### 7.7 Diario del dueño
- [ ] **Objetivo:** el componente `diario-dueno` muestra resumen del día.
- **Pasos:**
  1. Ir a la sección de diario/resumen.
- **Resultado esperado:** Facturación del día, ventas totales, productos más vendidos, etc.
- **Observación:**

---

## 8. Reportes

### 8.1 Generar reporte PDF de ventas
- [ ] **Objetivo:** export PDF funciona con data real.
- **Pasos:**
  1. Ir a Reportes.
  2. Elegir rango: "últimos 7 días".
  3. Tipo: Ventas.
  4. Export PDF.
- **Resultado esperado:** Se descarga un PDF legible con las ventas del período, totales y métodos de pago.
- **Observación:**

### 8.2 Generar reporte Excel de stock
- [ ] **Objetivo:** export Excel funciona.
- **Pasos:**
  1. Reportes → Stock actual.
  2. Export XLSX.
- **Resultado esperado:** Descarga Excel con nombre, categoría, stock, precio, costo, margen de cada producto.
- **Observación:**

### 8.3 Reporte de vencimientos
- [ ] **Objetivo:** listado de productos próximos a vencer.
- **Pasos:**
  1. Reportes → Vencimientos.
  2. Rango: próximos 30 días.
- **Resultado esperado:** Aparece Papas Lays (con vencimiento cargado en 4.8).
- **Observación:**

### 8.4 Validación de branchId (fix seguridad marzo)
- [ ] **Objetivo:** los reportes respetan la sucursal seleccionada (no leakean data de otra sucursal).
- **Pasos:**
  1. Estando en Sucursal Centro, generar un reporte.
  2. Cambiar a Sucursal Norte, generar el mismo reporte.
- **Resultado esperado:** Los datos son distintos (Norte está vacía). No se ven ventas ni productos de Centro.
- **Observación:**

---

## 9. Facturación Interna (NO fiscal)

### 9.1 Crear comprobante interno
- [ ] **Objetivo:** generar comprobante desde una venta.
- **Pasos:**
  1. Ir a Facturación interna.
  2. Seleccionar una venta reciente (de las que hiciste en 5.2-5.4).
  3. Llenar datos del cliente (nombre, opcional CUIT).
  4. Generar.
- **Resultado esperado:** Comprobante creado, aparece en la lista.
- **Observación:**

### 9.2 Imprimir/descargar comprobante
- [ ] **Objetivo:** el comprobante se puede entregar al cliente.
- **Pasos:**
  1. Desde la lista, abrir el comprobante.
  2. Imprimir o descargar.
- **Resultado esperado:** Se abre versión imprimible con todos los datos. Queda claro que NO es fiscal.
- **Observación:**

---

## 10. Gestión de Empleados

### 10.1 Invitar empleado
- [ ] **Objetivo:** enviar invitación a un empleado nuevo.
- **Pasos:**
  1. Tab "Control Empleados" o "Equipo".
  2. Click "Invitar empleado".
  3. Email del empleado (usar tu segundo email de test).
  4. Asignar sucursal: Centro. Rol: Empleado (no owner).
  5. Enviar.
- **Resultado esperado:** Se envía email de invitación. Aparece como "pendiente" en la lista.
- **Observación:**

### 10.2 Aceptar invitación (desde la cuenta del empleado)
- [ ] **Objetivo:** el empleado completa registro y queda vinculado.
- **Pasos:**
  1. Abrir otro navegador / incógnito con el email del empleado.
  2. Click en el link del email.
  3. Completar perfil.
- **Resultado esperado:** Queda logueado como empleado de la organización del dueño. Ve la `VistaEmpleado` (no el dashboard).
- **Observación:**

### 10.3 Cambiar rol/permisos de empleado
- [ ] **Objetivo:** el dueño puede promover a encargado o cambiar sucursal.
- **Pasos:**
  1. Como dueño, ir al empleado recién aceptado.
  2. Cambiar rol o asignar a otra sucursal.
- **Resultado esperado:** El cambio persiste. Al refrescar la sesión del empleado, ve la nueva configuración.
- **Observación:**

### 10.4 VistaEmpleado carga correctamente
- [ ] **Objetivo:** el empleado ve su interfaz simplificada.
- **Pasos:**
  1. Logueado como empleado.
- **Resultado esperado:** Ve: fichaje, misiones, caja (si tiene permiso), sus propios incidentes. NO ve gestión de proveedores ni ajustes de organización.
- **Observación:**

---

## 11. Fichaje QR

### 11.1 Generar QR de entrada/salida (dueño)
- [ ] **Objetivo:** imprimir QRs para pegar en el kiosco.
- **Pasos:**
  1. Dueño → "Generar QR fichaje".
  2. Elegir sucursal Centro, tipo: Entrada.
  3. Generar.
- **Resultado esperado:** Se muestra QR en pantalla. Opción de imprimir.
- **Observación:**

### 11.2 Scanner QR — fichaje entrada (empleado)
- [ ] **Objetivo:** el empleado ficha entrada escaneando.
- **Pasos:**
  1. Desde el celular del empleado, abrir la app (logueado como empleado).
  2. Click "Escanear QR" / "Fichar".
  3. Apuntar a la pantalla con el QR generado en 11.1.
- **Resultado esperado:** Se detecta el QR y redirige a `/fichaje?...&tipo=entrada`. Se registra el fichaje. Toast de éxito.
- **Observación:**

### 11.3 Scanner QR — fichaje salida
- [ ] **Objetivo:** ciclo completo entrada → salida.
- **Pasos:** repetir 11.2 con QR de tipo "Salida".
- **Resultado esperado:** Fichaje cerrado. Horas trabajadas calculadas.
- **Observación:**

### 11.4 Reloj de control visible
- [ ] **Objetivo:** el componente `reloj-control` muestra estado actual.
- **Pasos:**
  1. Como empleado, ver el reloj de control.
- **Resultado esperado:** Muestra hora actual, estado (dentro/fuera), horas acumuladas del día.
- **Observación:**

---

## 12. Misiones y Gamificación

### 12.1 Asignar misión manual
- [ ] **Objetivo:** el dueño asigna una misión a un empleado.
- **Pasos:**
  1. Componente `asignar-mision`.
  2. Empleado: el de 10.2. Misión: "Reponer estantería de bebidas", XP: 15.
  3. Asignar.
- **Resultado esperado:** Aparece en la vista del empleado como pendiente.
- **Observación:**

### 12.2 Completar misión (empleado)
- [ ] **Objetivo:** el empleado marca misión completa.
- **Pasos:**
  1. Como empleado, ver misiones.
  2. Marcar como completa.
- **Resultado esperado:** Misión pasa a "completada". XP se suma al empleado.
- **Observación:**

### 12.3 Misiones por plantilla automáticas
- [ ] **Objetivo:** verificar si la generación automática al abrir caja crea misiones del día.
- **Pasos:**
  1. Cerrar la caja del día (si está abierta).
  2. Abrir una nueva.
- **Resultado esperado:** Se generan misiones automáticas del día (si hay templates configurados en `mission_templates`). NOTA: Módulo marcado como "verificar" en ESTADO_PROYECTO.
- **Observación:**

### 12.4 Ranking de empleados
- [ ] **Objetivo:** ver ranking de XP.
- **Pasos:**
  1. Componente `team-ranking`.
- **Resultado esperado:** Muestra empleados ordenados por XP con avatares y badges.
- **Observación:**

### 12.5 Capital badges
- [ ] **Objetivo:** ver los badges ganados.
- **Pasos:**
  1. Ver `capital-badges` del empleado.
- **Resultado esperado:** Muestra badges obtenidos o progreso hacia el siguiente.
- **Observación:**

---

## 13. XP Automático y Configuración de Rendimiento

### 13.1 Configurar horarios de sucursal
- [ ] **Objetivo:** setear horarios de apertura/cierre para que el XP automático funcione.
- **Pasos:**
  1. `configuracion-rendimiento` → horarios.
  2. Apertura: 08:00, cierre: 20:00.
  3. Guardar.
- **Resultado esperado:** Valores persisten.
- **Observación:**

### 13.2 Configurar valores XP
- [ ] **Objetivo:** ajustar cuánto suma/resta cada evento.
- **Pasos:**
  1. Mismo componente → valores XP.
  2. Apertura puntual: +20, cierre limpio: +30, tardanza: -25, etc.
- **Resultado esperado:** Valores guardados y usados en los cálculos automáticos.
- **Observación:**

### 13.3 XP por apertura puntual
- [ ] **Objetivo:** abrir caja a horario suma XP.
- **Pasos:**
  1. Como empleado, abrir caja dentro del rango horario configurado.
- **Resultado esperado:** +20 XP automático al empleado.
- **Observación:**

### 13.4 XP por tardanza
- [ ] **Objetivo:** abrir caja tarde resta XP.
- **Pasos:**
  1. Configurar apertura a 08:00. Abrir caja a las 10:00 (o simular editando horario a uno pasado).
- **Resultado esperado:** -25 XP automático. Se crea un `incident` tipo tardanza.
- **Observación:**

### 13.5 XP por diferencia de caja
- [ ] **Objetivo:** cerrar con diferencia mayor al tolerado resta XP.
- **Pasos:**
  1. Cerrar caja declarando un monto que difiere significativamente del esperado.
- **Resultado esperado:** -40 XP. Incidente creado.
- **Observación:**

### 13.6 Ajuste manual XP (dueño premia/sanciona)
- [ ] **Objetivo:** dar puntos extra o quitar por decisión del dueño.
- **Pasos:**
  1. `ajuste-manual-xp` → empleado. Monto: +10, motivo: "Buena atención al cliente".
  2. Confirmar.
- **Resultado esperado:** XP ajustado. Queda log formal con mensaje.
- **Observación:**

### 13.7 Analytics de rendimiento
- [ ] **Objetivo:** ver evolución del empleado.
- **Pasos:**
  1. `xp-analytics` → empleado.
- **Resultado esperado:** Gráficos / resumen diario, semanal, mensual. Ver tendencia.
- **Observación:**

---

## 14. Incidentes y Descargos

### 14.1 Empleado ve su incidente
- [ ] **Objetivo:** el incidente creado por tardanza aparece al empleado.
- **Pasos:**
  1. Logueado como empleado, ir a `mis-incidentes`.
- **Resultado esperado:** Lista con el incidente de tardanza creado en 13.4.
- **Observación:**

### 14.2 Empleado escribe descargo (obligatorio)
- [ ] **Objetivo:** el empleado DEBE justificar antes de que el dueño resuelva.
- **Pasos:**
  1. Click en el incidente → "Descargo".
  2. Escribir: "Se me pinchó la moto en camino".
  3. Guardar.
- **Resultado esperado:** Descargo registrado. Estado del incidente pasa a "con descargo".
- **Observación:**

### 14.3 Dueño ve y resuelve con tipo formal
- [ ] **Objetivo:** el dueño puede leer y tipificar.
- **Pasos:**
  1. Como dueño → `gestion-incidentes`.
  2. Ver incidente con descargo.
  3. Resolver tipo "Justificada", agregar comentario, confirmar.
- **Resultado esperado:** Incidente resuelto. Queda registro con tipo y comentarios de ambos lados.
- **Observación:**

### 14.4 Dueño no puede resolver sin descargo (si es regla)
- [ ] **Objetivo:** validar la regla "descargo obligatorio".
- **Pasos:**
  1. Crear nuevo incidente (ej: ajuste manual negativo).
  2. Antes de que el empleado escriba descargo, intentar resolverlo como dueño.
- **Resultado esperado:** No permite resolver, o marca como "pendiente de descargo". (Verificar si esta regla está implementada a nivel UI o backend.)
- **Observación:**

---

## 15. Happy Hour

### 15.1 Configurar Happy Hour
- [ ] **Objetivo:** aplicar descuento automático en franja horaria.
- **Pasos:**
  1. Componente `happy-hour` → configurar franja 14:00-16:00 con 15% off.
  2. Guardar.
- **Resultado esperado:** Config persiste.
- **Observación:**

### 15.2 Descuento aplicado en venta durante HH
- [ ] **Objetivo:** al vender en franja HH, el descuento se aplica automático.
- **Pasos:**
  1. Ajustar franja a la hora actual (o cambiar hora del sistema).
  2. Hacer venta.
- **Resultado esperado:** Descuento del 15% aplicado. Aparece la bandera de "Happy Hour" en la UI del PdV.
- **Observación:**

---

## 16. Seguridad y RLS (validaciones cross-módulo)

### 16.1 Empleado NO accede a ajustes de organización
- [ ] **Objetivo:** RLS de permisos de rol.
- **Pasos:**
  1. Logueado como empleado, intentar ir a `/ajustes/organizacion` por URL.
- **Resultado esperado:** Redirige o muestra "sin permisos". No puede editar proveedores ni sucursales.
- **Observación:**

### 16.2 Empleado NO ve datos de otra organización
- [ ] **Objetivo:** aislamiento multi-tenant.
- **Pasos:**
  1. (Requiere 2 organizaciones distintas con data). Como empleado de org A, verificar que no ve productos de org B.
- **Resultado esperado:** Completamente aislado.
- **Observación:**

### 16.3 Sin console.log con datos de usuario
- [ ] **Objetivo:** verificar que no se exponen emails ni IDs (fix marzo).
- **Pasos:**
  1. Abrir DevTools → Console mientras navegás la app.
  2. Hacer login, venta, crear producto, etc.
- **Resultado esperado:** NO hay logs con emails o UUIDs del usuario. Los logs son técnicos (errores, tracking de render), no PII.
- **Observación:**

### 16.4 Vistas con security_invoker
- [ ] **Objetivo:** las vistas `v_products_with_stock` y `v_expiring_stock` respetan RLS.
- **Pasos:**
  1. Verificar como empleado que sólo ve productos de su sucursal.
- **Resultado esperado:** Las vistas aplican RLS del invocador.
- **Observación:**

---

## 17. Performance y UX móvil

### 17.1 Viewport 360px (mobile mínimo)
- [ ] **Objetivo:** la app funciona en el celular más chico usable.
- **Pasos:**
  1. DevTools → modo dispositivo → iPhone SE (375px) o más chico.
  2. Recorrer todos los tabs.
- **Resultado esperado:** Nada se corta, botones son tocables, texto legible.
- **Observación:**

### 17.2 Dashboard usa dynamic imports
- [ ] **Objetivo:** el dashboard carga rápido, otros tabs bajo demanda.
- **Pasos:**
  1. DevTools → Network → limpiar.
  2. Entrar al dashboard.
  3. Ver qué se descarga.
  4. Cambiar a tab Proveedores.
  5. Verificar que sólo ahí se descarga el chunk de gestión-proveedores.
- **Resultado esperado:** Carga inicial rápida, chunks por tab bajo demanda.
- **Observación:**

### 17.3 Vista empleado tarda <3s
- [ ] **Objetivo:** la vista del empleado no laguea (módulo marcado como "9 componentes sin dynamic import").
- **Pasos:**
  1. Logueado como empleado, medir tiempo hasta que la UI sea interactiva.
- **Resultado esperado:** <3s en conexión 4G simulada. Si es más lento, registrar en observación (es mejora pendiente).
- **Observación:**

---

## 18. Smoke final — cierre y resumen

### 18.1 Revisar dashboard con toda la data cargada
- [ ] **Objetivo:** después de ejecutar todo el checklist, el dashboard debe verse lleno y coherente.
- **Pasos:**
  1. Volver al dashboard del dueño.
- **Resultado esperado:**
  - Facturación del día > 0
  - Productos vendidos coherentes con las ventas
  - Margen calculado con costos reales
  - Empleados con XP acumulado
  - Incidentes con estado correcto
- **Observación:**

### 18.2 Generar reporte final
- [ ] **Objetivo:** exportar un reporte que resuma la sesión de testing.
- **Pasos:**
  1. Reportes → Ventas del día → PDF.
- **Resultado esperado:** PDF consistente con lo visto en pantalla.
- **Observación:**

### 18.3 Log de bugs encontrados
- [ ] Hacer lista de bugs encontrados durante el run:

| # | Módulo | Severidad | Descripción | Screenshot |
|---|--------|-----------|-------------|------------|
|   |        |           |             |            |

---

## Cierre

**Timestamp de fin:** `____:____`
**Duración total:** `____` min
**Total escenarios:** ~110
**PASS:** `____` / `____`
**FAIL:** `____`

Si todos los FAIL se arreglaron y re-testearon: **listo para demo / deploy**.

---

## Apéndice A — Data de demo resultante

Después de ejecutar todo, deberías tener en la app:
- 1 organización, 2 sucursales
- 1 dueño + 1 empleado
- 2 proveedores (1 producto, 1 servicio)
- 4 productos físicos con stock
- ~5-10 ventas de distintos tipos
- Algunas cargas de servicios virtuales
- Empleado con XP, incidentes con descargo resuelto
- Misiones asignadas y completadas

Esa data es perfecta para hacer una demo a un prospecto sin empezar de cero.

## Apéndice B — Flujo corto de pre-demo

Si no tenés 90 min antes de una demo, usá `docs/testing/PRE-DEMO-CHECK.md` (15 min).

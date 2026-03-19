# TEST E2E COMPLETO — Kiosco 24hs SaaS

**Fecha:** 2026-03-04
**URL:** https://app-kiosco-chi.vercel.app
**Ejecutor:** Manual (Bro)
**Objetivo:** Validar cada funcionalidad click por click. Marcar ✅ o ❌ y anotar observaciones.

---

## CÓMO USAR ESTE TEST

Cada test tiene:
- **Nº** → Identificador único
- **Acción** → Lo que tenés que hacer (click por click)
- **Resultado Esperado** → Lo que debería pasar
- **[ ]** → Checkbox para marcar PASS/FAIL
- **Notas** → Espacio para observaciones

Usá dos cuentas:
- **Cuenta Dueño:** Tu cuenta actual (ramiro.ira92@gmail.com)
- **Cuenta Empleado:** Necesitás una segunda cuenta (podés usar un email alternativo)

---

## FLUJO 1: AUTENTICACIÓN Y REGISTRO

### 1A — Login del Dueño (cuenta existente)

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 1.1 | Abrir https://app-kiosco-chi.vercel.app en incógnito | Se muestra el formulario de login (AuthForm) | [ ] | |
| 1.2 | Ingresar email: ramiro.ira92@gmail.com | Campo acepta el email | [ ] | |
| 1.3 | Ingresar contraseña y hacer click en "Iniciar Sesión" | Login exitoso, redirección al selector de sucursales | [ ] | |
| 1.4 | Verificar que NO aparecen errores en la pantalla | Sin toasts de error, sin pantallas rotas | [ ] | |

### 1B — Registro de cuenta nueva (Owner)

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 1.5 | Abrir app en incógnito, click en "Registrarse" | Se muestra formulario de registro | [ ] | |
| 1.6 | Ingresar email nuevo + contraseña (min 6 chars) | Campos aceptados sin error | [ ] | |
| 1.7 | Click "Crear Cuenta" | Toast de éxito o redirección a ProfileSetup | [ ] | |
| 1.8 | Si pide verificar email → ir al email y confirmar | Link de confirmación funciona | [ ] | |

### 1C — Profile Setup (primera vez)

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 1.9 | En la pantalla ProfileSetup, seleccionar rol "Dueño" | Se muestra formulario de nombre | [ ] | |
| 1.10 | Ingresar nombre (min 3 caracteres) | Campo validado | [ ] | |
| 1.11 | Click "Continuar/Crear" | Se crea organization + membership, redirección a OnboardingWizard | [ ] | |

### 1D — Recuperar contraseña

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 1.12 | En login, click "Olvidé mi contraseña" | Se muestra campo de email para recovery | [ ] | |
| 1.13 | Ingresar email y enviar | Toast "Link de recuperación enviado" | [ ] | |
| 1.14 | Abrir email y seguir link de reset | Se abre formulario para nueva contraseña | [ ] | |

### 1E — Logout

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 1.15 | Estando logueado, buscar botón de "Cerrar Sesión" o flecha atrás | Se muestra botón visible | [ ] | |
| 1.16 | Click en cerrar sesión | Redirección a AuthForm, estado limpio | [ ] | |

---

## FLUJO 2: ONBOARDING WIZARD (Dueño nuevo sin sucursales)

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 2.1 | Login con cuenta de dueño nuevo (sin sucursales) | Se muestra OnboardingWizard en vez del dashboard | [ ] | |
| 2.2 | Pantalla de bienvenida visible | Mensaje de bienvenida + instrucciones | [ ] | |
| 2.3 | Paso "Crear primera sucursal": ingresar nombre | Campo acepta texto (obligatorio) | [ ] | |
| 2.4 | Ingresar dirección (opcional) | Campo acepta texto | [ ] | |
| 2.5 | Click "Crear Sucursal" | Sucursal creada, avanza al siguiente paso | [ ] | |
| 2.6 | Completar wizard hasta el final | Botón "Empezar" visible | [ ] | |
| 2.7 | Click "Empezar" | Redirección al dashboard con la sucursal creada | [ ] | |

---

## FLUJO 3: SELECCIÓN DE SUCURSAL (Dueño)

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 3.1 | Login como dueño (con sucursales existentes) | Se muestra pantalla SeleccionarSucursal | [ ] | |
| 3.2 | Verificar que se listan todas las sucursales | Cada sucursal con nombre + dirección + icono MapPin | [ ] | |
| 3.3 | Click en "Sucursal Principal" | Redirección al Dashboard del Dueño con esa sucursal | [ ] | |
| 3.4 | Verificar header del dashboard muestra el nombre de sucursal | "Sucursal Principal" visible en selector | [ ] | |
| 3.5 | Botón "Actualizar Lista" funciona | Recarga la lista sin errores | [ ] | |

---

## FLUJO 4: DASHBOARD DEL DUEÑO — HEADER Y NAVEGACIÓN

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 4.1 | Verificar header oscuro con "Torre de Control" | Título visible con icono ✨ | [ ] | |
| 4.2 | Verificar selector de sucursal en header | Dropdown con todas las sucursales | [ ] | |
| 4.3 | Cambiar sucursal desde el selector | Dashboard recarga datos de la nueva sucursal | [ ] | |
| 4.4 | Click en ícono de engranaje (⚙️) | Se abre modal "Configuración de Sucursales" | [ ] | |
| 4.5 | Verificar que en el modal se pueden crear/eliminar sucursales | Formulario visible + lista de existentes | [ ] | |
| 4.6 | Cerrar modal con X o click afuera | Modal se cierra correctamente | [ ] | |
| 4.7 | Click flecha atrás (←) en header | Logout + vuelta a selector de sucursal | [ ] | |

### 4A — Tabs del Dashboard

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 4.8 | Click tab "Stock" | Se muestra sección de inventario | [ ] | |
| 4.9 | Click tab "Ventas" | Se muestra sección de ventas con gráficos | [ ] | |
| 4.10 | Click tab "Proveedores" | Se muestra gestión de proveedores | [ ] | |
| 4.11 | Click tab "Control Empleados" | Se muestra supervisión de equipo | [ ] | |
| 4.12 | Click tab "Análisis" | Se muestra sección de análisis/reportes | [ ] | |
| 4.13 | Verificar que cada tab carga sin errores de consola | 0 errores en DevTools → Console | [ ] | |

---

## FLUJO 5: GESTIÓN DE SUCURSALES (desde engranaje)

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 5.1 | Abrir modal de engranaje → campo "Nombre" | Campo disponible para nueva sucursal | [ ] | |
| 5.2 | Ingresar nombre "Kiosco Test 2" + dirección | Campos aceptados | [ ] | |
| 5.3 | Click "Crear Sucursal" | Toast éxito, sucursal aparece en la lista | [ ] | |
| 5.4 | Verificar sucursal nueva en el selector del header | "Kiosco Test 2" disponible en dropdown | [ ] | |
| 5.5 | Eliminar "Kiosco Test 2" (si hay botón de eliminar) | Sucursal eliminada de la lista | [ ] | |
| 5.6 | Verificar que no se puede eliminar la última sucursal | Mensaje de error o botón deshabilitado | [ ] | |

---

## FLUJO 6: STOCK — CREAR PRODUCTO

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 6.1 | Ir a tab "Stock" → buscar botón "Crear Producto" | Botón visible | [ ] | |
| 6.2 | Click "Crear Producto" | Se abre formulario/modal de creación | [ ] | |
| 6.3 | Dejar campos vacíos y click guardar | Validación: error en campos obligatorios | [ ] | |
| 6.4 | Rellenar: Nombre="Coca Cola 500ml", Categoría=Bebidas, Precio=1500, Costo=900, Emoji=🥤, Cantidad=20 | Campos aceptados | [ ] | |
| 6.5 | Click "Crear" | Toast éxito, producto aparece en la lista de stock | [ ] | |
| 6.6 | Verificar que se creó price_history | (Verificar en Supabase si querés profundizar) | [ ] | |
| 6.7 | Crear otro producto con código de barras: "7790895000119" | Escaneo o ingreso manual funciona | [ ] | |
| 6.8 | Intentar crear producto con el mismo código de barras | Error: "Código de barras ya existe" | [ ] | |

### 6A — Escáner de código de barras

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 6.9 | Si hay botón de escanear → click | Se abre la cámara del dispositivo | [ ] | |
| 6.10 | Escanear un producto real (EAN-13) | Código detectado y rellenado en campo | [ ] | |
| 6.11 | Si no hay cámara → verificar que se puede ingresar manual | Campo de texto acepta código | [ ] | |

---

## FLUJO 7: STOCK — AGREGAR STOCK (Lotes)

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 7.1 | En tab Stock, buscar "Agregar Stock" o equivalente | Botón/opción visible | [ ] | |
| 7.2 | Seleccionar producto existente | Lista de productos disponible | [ ] | |
| 7.3 | Ingresar cantidad: 50 | Campo acepta número | [ ] | |
| 7.4 | Ingresar fecha de vencimiento (ej: 2026-04-01) | Campo de fecha funciona | [ ] | |
| 7.5 | Click "Agregar" | Toast éxito, stock actualizado | [ ] | |
| 7.6 | Verificar que el stock total del producto aumentó | Lista muestra nuevo total | [ ] | |
| 7.7 | Agregar otro lote del mismo producto con vencimiento diferente | Dos lotes coexisten (FIFO) | [ ] | |

---

## FLUJO 8: STOCK — EDITAR Y ELIMINAR PRODUCTO

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 8.1 | En la lista de stock, buscar botón editar en un producto | Botón visible (lápiz o similar) | [ ] | |
| 8.2 | Click editar → cambiar precio de 1500 a 1800 | Campo editable | [ ] | |
| 8.3 | Guardar cambio | Toast éxito, precio actualizado | [ ] | |
| 8.4 | Verificar que se creó un registro en price_history | Nuevo registro con precio anterior | [ ] | |
| 8.5 | Buscar botón "Eliminar" producto | Botón visible | [ ] | |
| 8.6 | Click eliminar → confirmar | Producto marcado como inactivo (soft delete) | [ ] | |
| 8.7 | Verificar que el producto ya no aparece en la lista | Lista actualizada sin el producto | [ ] | |

---

## FLUJO 9: PROVEEDORES

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 9.1 | Ir a tab "Proveedores" | Se muestra la pantalla de gestión | [ ] | |
| 9.2 | Click "Crear Proveedor" o equivalente | Formulario visible | [ ] | |
| 9.3 | Rellenar: Nombre="Distribuidora Pepsi", Teléfono, CUIT | Campos aceptados | [ ] | |
| 9.4 | Click guardar | Toast éxito, proveedor en la lista | [ ] | |
| 9.5 | Click en el proveedor creado | Se muestra detalle con saldo | [ ] | |
| 9.6 | "Recargar Saldo": ingresar monto $50000 | Campo acepta monto | [ ] | |
| 9.7 | Confirmar recarga | Saldo actualizado a $50000 | [ ] | |
| 9.8 | Verificar historial de movimientos del proveedor | Movimiento de recarga visible | [ ] | |

### 9A — Servicios (SUBE, Recargas)

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 9.9 | En proveedores, buscar widget de SUBE | Widget visible | [ ] | |
| 9.10 | Buscar widget de Recargas Virtuales | Widget visible | [ ] | |
| 9.11 | Interactuar con cada widget | Funcionalidad correspondiente se ejecuta | [ ] | |

---

## FLUJO 10: CONTROL DE EMPLEADOS (Dueño)

### 10A — Invitar Empleado

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 10.1 | Ir a tab "Control Empleados" | Sección de gestión de equipo visible | [ ] | |
| 10.2 | Buscar botón "Invitar Empleado" | Botón visible | [ ] | |
| 10.3 | Ingresar email del empleado | Campo acepta email válido | [ ] | |
| 10.4 | Seleccionar sucursal de asignación | Dropdown con sucursales | [ ] | |
| 10.5 | Click "Enviar Invitación" | Toast "Invitación enviada" | [ ] | |
| 10.6 | Verificar que la invitación aparece en "Pendientes" | Email + sucursal + fecha visibles | [ ] | |

### 10B — Cancelar Invitación

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 10.7 | En invitaciones pendientes, click "Cancelar" | Confirmación o acción directa | [ ] | |
| 10.8 | Invitación eliminada de la lista | Lista actualizada | [ ] | |

### 10C — Generar QR de Fichaje

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 10.9 | Buscar botón "Generar QR Fichaje" | Botón visible | [ ] | |
| 10.10 | Click → seleccionar sucursal si necesario | Formulario de generación | [ ] | |
| 10.11 | Generar QR de ENTRADA | QR visible con URL tipo fichaje?sucursal_id=XXX&tipo=entrada | [ ] | |
| 10.12 | Generar QR de SALIDA | QR visible con URL tipo fichaje?sucursal_id=XXX&tipo=salida | [ ] | |
| 10.13 | QRs son diferentes entre sí | Entrada ≠ Salida | [ ] | |
| 10.14 | QR se puede descargar/imprimir | Opción de guardar imagen | [ ] | |

### 10D — Asistencia y Fichaje

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 10.15 | En Control Empleados, ver tabla de asistencia | Lista de fichajes del equipo | [ ] | |
| 10.16 | Filtrar por fecha si disponible | Filtro funciona | [ ] | |
| 10.17 | Ver horas trabajadas por empleado | Cálculo visible | [ ] | |

### 10E — Ranking del Equipo

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 10.18 | Buscar sección "Ranking" o "Team Ranking" | Lista de empleados por XP | [ ] | |
| 10.19 | Verificar que muestra nivel + XP + barra de progreso | Datos visibles por empleado | [ ] | |

### 10F — Misiones (crear como dueño)

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 10.20 | Buscar botón "Asignar Misión" o equivalente | Botón visible | [ ] | |
| 10.21 | Rellenar: Descripción="Limpiar estantes", Puntos=100 | Campos aceptados | [ ] | |
| 10.22 | Seleccionar empleado (si disponible) | Dropdown con empleados activos | [ ] | |
| 10.23 | Click crear | Toast éxito, misión creada | [ ] | |

---

## FLUJO 11: VENTAS (Tab del Dueño)

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 11.1 | Ir a tab "Ventas" | Se muestra panel de ventas | [ ] | |
| 11.2 | Verificar gráfico de ventas diarias | Gráfico visible (puede estar vacío si no hay datos) | [ ] | |
| 11.3 | Verificar lista de ventas recientes | Tabla con ventas (fecha, monto, método de pago) | [ ] | |
| 11.4 | Verificar desglose por método de pago | Efectivo/Tarjeta/Transferencia/Billetera | [ ] | |
| 11.5 | Verificar productos más vendidos | Top productos visible | [ ] | |
| 11.6 | Filtrar por rango de fechas (si disponible) | Datos se actualizan según filtro | [ ] | |

---

## FLUJO 12: ANÁLISIS Y REPORTES (Tab del Dueño)

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 12.1 | Ir a tab "Análisis" | Se muestra panel de análisis | [ ] | |
| 12.2 | Verificar KPIs: Ingresos, Beneficio Neto, Margen | Números visibles (pueden ser $0 sin datos) | [ ] | |
| 12.3 | Verificar métricas de Efectivo vs Trazable | Desglose visible | [ ] | |
| 12.4 | Generar reporte de ventas (si botón disponible) | Reporte generado | [ ] | |
| 12.5 | Exportar como PDF | PDF descargado | [ ] | |
| 12.6 | Exportar como CSV (si disponible) | CSV descargado | [ ] | |

---

## FLUJO 13: CAPITAL BADGES (Header del Dashboard)

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 13.1 | En el dashboard, verificar badges de capital en header | Badges visibles junto al título | [ ] | |
| 13.2 | Verificar que muestran montos formateados en ARS | Formato $XX.XXX | [ ] | |

---

## FLUJO 14: EMPLEADO — ONBOARDING COMPLETO

> **Prerequisito:** Necesitás una segunda cuenta de email para probar como empleado.

### 14A — Recibir invitación

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 14.1 | Desde cuenta dueño: invitar email del empleado (Flujo 10A) | Invitación enviada | [ ] | |
| 14.2 | Abrir email del empleado | Email con magic link recibido | [ ] | |
| 14.3 | Click en magic link del email | Redirección a la app | [ ] | |

### 14B — Profile Setup (Empleado)

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 14.4 | En ProfileSetup, seleccionar "Empleado" | Formulario de nombre + token/email | [ ] | |
| 14.5 | Ingresar nombre (min 3 chars) | Campo validado | [ ] | |
| 14.6 | Click "Continuar" | accept_invite() ejecutado, membership creada | [ ] | |
| 14.7 | Verificar redirección a pantalla de fichaje (QR scanner) | Se muestra EscanearQRFichaje | [ ] | |

---

## FLUJO 15: EMPLEADO — FICHAJE (QR)

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 15.1 | En pantalla de fichaje, click "Escanear QR del Local" | Se abre el escáner de cámara | [ ] | |
| 15.2 | Escanear QR de ENTRADA de la sucursal | QR detectado, toast "QR de entrada escaneado" | [ ] | |
| 15.3 | Verificar redirección al dashboard empleado | VistaEmpleado visible con la sucursal correcta | [ ] | |
| 15.4 | Verificar que en DB se creó registro attendance (check_in = now, check_out = NULL) | (Verificar en Supabase) | [ ] | |

### 15A — Fichaje vía URL directa

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 15.5 | Navegar a: /fichaje?sucursal_id=ID&tipo=entrada | Fichaje de entrada registrado | [ ] | |
| 15.6 | Navegar a: /fichaje?sucursal_id=ID&tipo=salida | Fichaje de salida registrado | [ ] | |
| 15.7 | Intentar doble entrada (ya con check_in activo) | Error: "Ya tienes una entrada registrada" | [ ] | |
| 15.8 | Intentar salida sin entrada previa | Error: "No tienes una entrada para cerrar" | [ ] | |
| 15.9 | Intentar salida en sucursal diferente a la de entrada | Error: "Tu entrada fue registrada en otro local" | [ ] | |

---

## FLUJO 16: EMPLEADO — DASHBOARD Y TURNO

### 16A — Vista General

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 16.1 | Verificar header del empleado | Nombre + nivel XP + barra progreso + sucursal | [ ] | |
| 16.2 | Verificar tabs disponibles | Caja, Misiones, Vencimientos | [ ] | |

### 16B — Abrir Turno (Caja)

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 16.3 | En tab "Caja", click "Abrir Turno" | Formulario de monto inicial | [ ] | |
| 16.4 | Ingresar monto inicial: $5000 | Campo acepta número | [ ] | |
| 16.5 | Confirmar apertura | Toast éxito, turno activo, interfaz de ventas visible | [ ] | |
| 16.6 | Verificar que se creó cash_registers con is_open=true | (Verificar en Supabase) | [ ] | |

---

## FLUJO 17: EMPLEADO — REALIZAR VENTA

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 17.1 | En interfaz de ventas, buscar producto por nombre | Campo de búsqueda funciona, resultados aparecen | [ ] | |
| 17.2 | Click en producto → se agrega al carrito | Producto aparece en carrito con cantidad 1 | [ ] | |
| 17.3 | Modificar cantidad con botón "+" | Cantidad incrementa, subtotal se actualiza | [ ] | |
| 17.4 | Modificar cantidad con botón "-" | Cantidad decrementa | [ ] | |
| 17.5 | Agregar un segundo producto al carrito | Dos items en el carrito, total general actualizado | [ ] | |
| 17.6 | Eliminar un producto del carrito | Producto removido, total actualizado | [ ] | |
| 17.7 | Seleccionar método de pago: "Efectivo" | Opción seleccionada | [ ] | |
| 17.8 | Click "Confirmar Venta" | Toast éxito, carrito vacío, venta registrada | [ ] | |
| 17.9 | Verificar que stock del producto disminuyó | Stock actualizado (FIFO) | [ ] | |
| 17.10 | Verificar que XP del empleado aumentó (+10) | XP incrementado | [ ] | |

### 17A — Venta con otros métodos de pago

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 17.11 | Repetir venta con "Tarjeta" | Venta registrada con método tarjeta | [ ] | |
| 17.12 | Repetir venta con "Transferencia" | Venta registrada con método transferencia | [ ] | |
| 17.13 | Repetir venta con "Billetera Digital" | Venta registrada con método wallet | [ ] | |

### 17B — Venta por código de barras

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 17.14 | Click en ícono de escáner en búsqueda | Cámara se abre | [ ] | |
| 17.15 | Escanear código de barras de producto | Producto encontrado y agregado al carrito | [ ] | |
| 17.16 | Ingresar código de barras manualmente | Producto encontrado | [ ] | |
| 17.17 | Ingresar código de barras inexistente | "Producto no encontrado" | [ ] | |

### 17C — Venta sin stock suficiente

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 17.18 | Intentar agregar cantidad mayor al stock disponible | Error o advertencia de stock insuficiente | [ ] | |
| 17.19 | Intentar confirmar venta de producto sin stock | Error: stock insuficiente | [ ] | |

### 17D — Ticket/Recibo

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 17.20 | Si hay opción de imprimir recibo → activar | Checkbox o botón visible | [ ] | |
| 17.21 | Confirmar venta con recibo | PDF generado con detalle de venta | [ ] | |

---

## FLUJO 18: EMPLEADO — MOVIMIENTOS DE CAJA

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 18.1 | Buscar botón "Registrar Movimiento" | Botón visible | [ ] | |
| 18.2 | Seleccionar tipo "Ingreso" | Opción seleccionada | [ ] | |
| 18.3 | Ingresar monto: $2000, descripción: "Recarga SUBE cobrada" | Campos aceptados | [ ] | |
| 18.4 | Confirmar | Toast éxito, movimiento registrado | [ ] | |
| 18.5 | Registrar movimiento de tipo "Egreso", $500, "Compra de bolsas" | Movimiento de egreso registrado | [ ] | |
| 18.6 | Ver historial de movimientos del turno | Lista con todos los movimientos | [ ] | |
| 18.7 | Verificar que el balance refleja: 5000 + ventas + 2000 - 500 | Cálculo correcto | [ ] | |

---

## FLUJO 19: EMPLEADO — CERRAR TURNO (ARQUEO)

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 19.1 | Click "Cerrar Turno" o "Cerrar Caja" | Se muestra formulario de arqueo | [ ] | |
| 19.2 | Sistema muestra "Monto Esperado" calculado | Monto visible (apertura + ingresos - egresos + ventas efectivo) | [ ] | |
| 19.3 | Ingresar "Monto Declarado" igual al esperado | Campo acepta número | [ ] | |
| 19.4 | Confirmar cierre | Toast éxito: "Turno cerrado - Arqueo exitoso" | [ ] | |
| 19.5 | Verificar que is_open = false en cash_registers | (Verificar en Supabase) | [ ] | |

### 19A — Arqueo con diferencia

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 19.6 | Abrir nuevo turno, hacer una venta cash | Turno abierto con venta registrada | [ ] | |
| 19.7 | Cerrar turno con monto declarado MENOR al esperado | Arqueo muestra desvío negativo | [ ] | |
| 19.8 | Verificar que el desvío queda registrado | Flag exitoArqueo=false, desvío registrado | [ ] | |

---

## FLUJO 20: EMPLEADO — MISIONES

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 20.1 | Ir a tab "Misiones" | Lista de misiones asignadas | [ ] | |
| 20.2 | Ver misión creada por el dueño (Flujo 10F) | Misión visible con descripción y puntos | [ ] | |
| 20.3 | Click "Completar" en la misión | Toast éxito, XP otorgado | [ ] | |
| 20.4 | Verificar que XP del empleado aumentó (+100 puntos) | Barra de progreso actualizada | [ ] | |
| 20.5 | Verificar que la misión aparece como completada | Estado "Completada" o check visible | [ ] | |

---

## FLUJO 21: EMPLEADO — VENCIMIENTOS

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 21.1 | Ir a tab "Vencimientos" | Lista de productos próximos a vencer | [ ] | |
| 21.2 | Si hay productos con vencimiento < 7 días → se muestran | Producto + fecha + cantidad visible | [ ] | |
| 21.3 | Si no hay productos por vencer → mensaje informativo | "No hay productos próximos a vencer" | [ ] | |

---

## FLUJO 22: EMPLEADO — FICHAJE SALIDA

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 22.1 | Escanear QR de SALIDA (o navegar URL fichaje con tipo=salida) | Check-out registrado | [ ] | |
| 22.2 | Verificar que attendance record tiene check_out = now | (Verificar en Supabase) | [ ] | |
| 22.3 | Verificar redirección post check-out | Vuelve a pantalla de fichaje o login | [ ] | |

---

## FLUJO 23: MODO OFFLINE (PWA)

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 23.1 | Desactivar WiFi/datos en el dispositivo | App detecta modo offline | [ ] | |
| 23.2 | Indicador de offline visible | Badge o banner de "Sin conexión" | [ ] | |
| 23.3 | Realizar una venta en modo offline | Venta aceptada localmente (IndexedDB) | [ ] | |
| 23.4 | Reactivar conexión | Sync automático se ejecuta | [ ] | |
| 23.5 | Verificar que la venta se sincronizó a Supabase | Venta visible en dashboard del dueño | [ ] | |
| 23.6 | Indicador de sync exitoso | Toast o badge de "Sincronizado" | [ ] | |

---

## FLUJO 24: EDGE CASES Y SEGURIDAD

| Nº | Acción | Resultado Esperado | ✓/✗ | Notas |
|----|--------|--------------------|-----|-------|
| 24.1 | Acceder a / sin estar logueado | Redirige a AuthForm | [ ] | |
| 24.2 | Empleado intenta acceder a funciones de dueño | No disponibles / no visibles | [ ] | |
| 24.3 | Dueño intenta ver datos de otra organización | RLS bloquea, no ve datos ajenos | [ ] | |
| 24.4 | Ingresar caracteres especiales en campos de texto | App no se rompe, se sanitizan correctamente | [ ] | |
| 24.5 | Doble click rápido en "Confirmar Venta" | Solo se registra 1 venta (no duplicados) | [ ] | |
| 24.6 | Sesión expirada → intentar acción | Redirección a login con mensaje apropiado | [ ] | |
| 24.7 | Navegar a URL inexistente | Página 404 o redirección a home | [ ] | |

---

## RESUMEN DE COBERTURA

| Área | Tests | Prioridad |
|------|-------|-----------|
| Autenticación | 16 tests | 🔴 CRÍTICA |
| Onboarding Wizard | 7 tests | 🔴 CRÍTICA |
| Selección Sucursal | 5 tests | 🟡 ALTA |
| Dashboard Header/Nav | 13 tests | 🟡 ALTA |
| Gestión Sucursales | 6 tests | 🟡 ALTA |
| Stock — Crear Producto | 11 tests | 🔴 CRÍTICA |
| Stock — Agregar Lotes | 7 tests | 🟡 ALTA |
| Stock — Editar/Eliminar | 7 tests | 🟡 ALTA |
| Proveedores | 11 tests | 🟢 MEDIA |
| Control Empleados | 23 tests | 🔴 CRÍTICA |
| Ventas (Dueño) | 6 tests | 🟡 ALTA |
| Análisis/Reportes | 6 tests | 🟢 MEDIA |
| Capital Badges | 2 tests | 🟢 MEDIA |
| Empleado — Onboarding | 7 tests | 🔴 CRÍTICA |
| Empleado — Fichaje QR | 9 tests | 🔴 CRÍTICA |
| Empleado — Turno/Caja | 4 tests | 🔴 CRÍTICA |
| Empleado — Ventas | 21 tests | 🔴 CRÍTICA |
| Empleado — Movimientos | 7 tests | 🟡 ALTA |
| Empleado — Arqueo | 8 tests | 🔴 CRÍTICA |
| Empleado — Misiones | 5 tests | 🟢 MEDIA |
| Empleado — Vencimientos | 3 tests | 🟢 MEDIA |
| Empleado — Fichaje Salida | 3 tests | 🟡 ALTA |
| Modo Offline (PWA) | 6 tests | 🟡 ALTA |
| Edge Cases / Seguridad | 7 tests | 🔴 CRÍTICA |
| **TOTAL** | **~200 tests** | |

---

## NOTAS PARA DESPUÉS DEL TEST

Después de ejecutar todos los tests, anotá:

1. **Tests que fallaron (❌):** Para cada uno, descripción del error y screenshot si es posible
2. **Funcionalidades que faltan:** Cosas que esperabas que existieran y no están
3. **Redundancias detectadas:** Funciones duplicadas o que se solapan
4. **Mejoras de UX:** Cosas que funcionan pero son confusas o lentas
5. **Errores de consola:** Abrir DevTools (F12) → Console mientras testeas

Con esa info vamos a priorizar las optimizaciones herramienta por herramienta.

---

**Documento generado por Claude — Tech Lead de Kiosco 24hs**

# Evaluacion de experiencia del empleado (Persona Lucia)

**Fecha**: 2026-03-02
**Agente**: kiosco-persona-empleado
**Estado**: NECESITA TRABAJO

---

## Flujos evaluados

| Flujo | Taps actuales | Taps target | Estado |
|-------|--------------|-------------|--------|
| Venta simple (1-3 productos, efectivo) | ~7 taps | <= 8 | APROBADO |
| Apertura de caja | 3 taps (ingresar monto + confirmar) | <= 4 | APROBADO |
| Cierre/Arqueo de caja | 3 taps (ingresar monto + confirmar) | <= 6 | APROBADO |
| Fichaje entrada | 2 taps (boton + QR scan) | <= 2 | APROBADO |
| Fichaje salida | 2 taps (boton + QR scan) | <= 2 | APROBADO |
| Ingreso de stock | ~6 taps (scan + cantidad + vencimiento + costo + confirmar) | <= 5 | NECESITA MEJORA |

## Detalle por flujo

### Venta simple
- **Busqueda**: Input con debounce 300ms correcto (`caja-ventas.tsx:122`)
- **Barcode scanner**: Integrado con html5-qrcode, auto-add si match exacto (`caja-ventas.tsx:106-108`)
- **Carrito**: Incremento/decremento con botones +/- visibles
- **Metodo pago**: 3 botones claros (Efectivo, Virtual, Tarjeta) en grid 3 columnas
- **Confirmar**: Boton grande h-20 "CONFIRMAR VENTA"
- **Total visible**: SI, siempre visible en la parte inferior (`caja-ventas.tsx:334`)
- **Productos frecuentes/favoritos**: NO IMPLEMENTADO - falta acceso rapido

### Apertura de caja
- Input numerico grande h-20 para monto inicial (`arqueo-caja.tsx:182`)
- Boton "EMPEZAR JORNADA" h-16 verde esmeralda
- Aviso de auditoria claro antes de empezar
- **Flujo correcto y rapido**

### Cierre de caja (Arqueo)
- Muestra base inicial + hora de apertura
- Input h-24 para monto contado (muy grande, facil de usar)
- Boton "FINALIZAR Y VALIDAR CAJA" h-20 rojo
- Muestra diferencia con toast + confetti si coincide
- **Flujo excelente para Lucia**

### Fichaje
- `RelojControl` integrado en la vista empleado (`vista-empleado.tsx:131-137`)
- Boton QR o boton manual segun configuracion
- 1 tap para entrada, 1 tap para salida
- Muestra hora de ingreso cuando esta fichada

### Ingreso de stock
- `processComplexStockEntry` acepta: cantidad, fecha vencimiento, costo, proveedor
- Scanner de barcode disponible
- **Problema**: Requiere muchos campos por producto (6 taps minimo)

## Problemas encontrados

### P1 - Sin productos favoritos/frecuentes
- **Pantalla**: caja-ventas.tsx
- **Problema**: No hay seccion de productos mas vendidos a 1 tap
- **Impacto**: Lucia tiene que buscar "Marlboro" cada vez en vez de tener un boton directo
- **Fix propuesto**: Agregar grid de 6-8 productos top basado en historial de ventas

### P2 - Header dice "Punto de Venta" en vez de "Caja"
- **Pantalla**: caja-ventas.tsx:199
- **Problema**: Vocabulario tecnico "Punto de Venta" - Lucia dice "Caja"
- **Impacto**: Menor, pero suma a la sensacion de app para programadores
- **Fix propuesto**: Cambiar a "Caja" o "Mi Caja"

### P3 - Interfaz bloqueada sin fichaje no explica bien
- **Pantalla**: vista-empleado.tsx:162-172
- **Problema**: El mensaje "DEBES FICHAR TU ENTRADA" esta en mayusculas agresivas
- **Impacto**: Lucia se siente presionada, no guiada
- **Fix propuesto**: Tono mas amigable + boton directo para fichar ahi mismo

### P4 - Ingreso de stock complejo
- **Pantalla**: processComplexStockEntry en inventory.actions.ts
- **Problema**: Requiere fecha vencimiento obligatoria (no nullable para no-perecederos en la UI)
- **Impacto**: Lucía carga pilas o encendedores y tiene que inventar una fecha
- **Fix propuesto**: Hacer fecha vencimiento opcional, solo mostrar para perecederos

### P5 - Tabs de navegacion pequenas
- **Pantalla**: vista-empleado.tsx:186-205
- **Problema**: Tabs "Ventas", "Misiones", "Alertas" tienen text de 10px
- **Impacto**: En Samsung A14 con pantalla de 6.6", son dificiles de leer
- **Fix propuesto**: Aumentar a 12px minimo, iconos de 4x4

## Test de Lucia: NECESITA TRABAJO

| Pantalla | Resultado | Detalle |
|----------|-----------|---------|
| Login/Fichaje | APROBADO | 2 taps, rapido |
| Apertura caja | APROBADO | 3 taps, input grande |
| Venta simple | APROBADO CON RESERVAS | Falta productos frecuentes |
| Cierre caja | APROBADO | Excelente UX con confetti |
| Misiones | APROBADO | Claras, con progreso visual |
| Alertas vencimiento | APROBADO | Modal de merma bien explicado |

**Veredicto**: Lucia puede usar la app pero le falta velocidad en el flujo de venta por la ausencia de productos frecuentes. El 70% de sus ventas son los mismos 20 productos.

## Soporte Offline

| Capacidad | Estado | Detalle |
|-----------|--------|---------|
| Vender sin internet | IMPLEMENTADO | `useOfflineVentas` con IndexedDB |
| Buscar productos offline | IMPLEMENTADO | `productCache.searchOffline` |
| Indicador visual offline | IMPLEMENTADO | Badge rojo "OFFLINE" + boton ambar |
| Sync automatico al reconectar | IMPLEMENTADO | `scheduleSyncAfterReconnect` con debounce 2s |
| Ventas pendientes visibles | IMPLEMENTADO | Badge con contador de pendientes |
| Background Sync (app cerrada) | IMPLEMENTADO | Service Worker con `sync-ventas` tag |
| Ticket offline | IMPLEMENTADO | Banner naranja "PENDIENTE SYNC" en PDF |

**Resultado offline: EXCELENTE** - El soporte offline es robusto con IndexedDB, sync automatico, y feedback visual claro.

## Vocabulario a corregir

| Actual | Sugerido |
|--------|----------|
| "Punto de Venta" | "Caja" |
| "Interfaz Bloqueada" | "Ficha tu entrada para empezar" |
| "Hoja de Ruta" (misiones) | "Mis Tareas del Dia" |
| "Ejecutar Retiro de Stock" | "Sacar productos vencidos" |
| "Confirmar Accion Realizada" | "Listo, lo hice" |

## Gamificacion

- **Misiones visibles**: SI, en tab "Misiones" con progreso visual (`misiones-empleado.tsx`)
- **XP y nivel**: SI, en header del empleado con barra de progreso (`vista-empleado.tsx:118-124`)
- **Confetti al completar**: SI (`triggerConfetti` en arqueo y misiones)
- **Ranking del equipo**: Existe en dashboard dueno, no en vista empleado
- **Problema**: El empleado no ve su ranking relativo (no sabe si va 1ro o ultimo)
- **Fix propuesto**: Agregar mini-ranking o posicion en la vista empleado

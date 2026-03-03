# Verificacion de Reportes PDF/Excel

**Fecha**: 2026-03-02
**Agente**: kiosco-reportes
**Estado de reportes**: COMPLETO

---

## Dependencias

| Paquete | Instalado | Uso |
|---------|-----------|-----|
| jspdf | SI | Generacion de PDFs (lazy loaded) |
| jspdf-autotable | SI | Tablas en PDFs |
| xlsx (SheetJS) | SI | Generacion de Excel (lazy loaded) |

**Nota**: Ambas librerias se cargan con `dynamic import()` para no agregar ~700KB al bundle inicial. Excelente decision.

## Reportes existentes

| Reporte | Formato | Funciona | Datos completos | Diseno profesional |
|---------|---------|----------|-----------------|-------------------|
| Ticket de venta | PDF (80mm termico) | SI | SI (items, total, pago, vendedor, offline) | SI |
| Cierre de caja (auditoria) | PDF (A4) | SI | SI (apertura, ventas, movimientos, diferencia) | SI |
| Reporte de ventas | PDF + Excel | SI | SI (resumen + detalle + desglose pago) | SI |
| Reporte de caja diaria | PDF + Excel | SI | SI (turno, ventas, movimientos, arqueo) | SI |
| Reporte de stock | PDF + Excel | SI | SI (productos, cantidades, costos, valores) | SI |
| Productos por vencer | PDF + Excel | SI | SI (lotes, dias, capital en riesgo) | SI |

## Reportes faltantes

| Reporte | Prioridad | Formato | Esfuerzo |
|---------|-----------|---------|----------|
| Resumen diario consolidado (todas sucursales) | ALTA | PDF | MEDIO |
| Asistencia mensual (para liquidacion) | ALTA | Excel | MEDIO |
| Comparativa sucursales | MEDIA | PDF + Excel | ALTO |
| Ranking de empleados mensual | BAJA | PDF | BAJO |
| Factura electronica ARCA | ALTA (legal) | PDF | ALTO |

## Codigo analizado

### `lib/generar-ticket.ts`
- **Ticket de venta** (80mm termico): Formato correcto con items, total, metodo pago, vendedor
- **Soporte offline**: Banner naranja "PENDIENTE SYNC" con ID local - excelente
- **Cierre de caja** (A4): Tabla completa con auditoria, colores semanticos para diferencias
- **Calidad**: Profesional, con autoTable para tablas limpias

### `lib/services/pdf-generator.ts`
- 4 tipos de reportes: ventas, caja, stock, vencimientos
- Header estandarizado con titulo, subtitulo, fecha de generacion
- Footer con paginacion
- Colores semanticos (success/danger/warning)
- **Calidad**: Excelente

### `lib/services/excel-generator.ts`
- 4 tipos de reportes: ventas, caja, stock, vencimientos
- Multiples hojas (Resumen + Detalle)
- Headers claros en cada hoja
- Descarga como Blob con nombre de archivo descriptivo
- **Calidad**: Excelente

### `components/reports/index.tsx`
- UI completa para seleccionar tipo de reporte
- Selector de fechas con calendario
- Selector de caja especifica (para reporte de caja)
- Toggle PDF/Excel con botones visuales
- Boton "GENERAR REPORTE" grande y claro
- **Calidad**: Excelente UX - 1 flujo para todos los reportes

## Problemas encontrados

### P1 - Nombre hardcodeado "Kiosco 24hs" en tickets
- **Archivo**: `generar-ticket.ts:38,220`
- **Problema**: El nombre de la organizacion esta hardcodeado
- **Fix**: Recibir nombre de organizacion como parametro

### P2 - Sin direccion/CUIT en ticket de venta
- **Archivo**: `generar-ticket.ts`
- **Problema**: Ticket solo dice "Kiosco 24hs" sin direccion ni datos fiscales
- **Fix**: Agregar direccion de sucursal y CUIT cuando facturacion este implementada

### P3 - Ticket no calcula vuelto
- **Archivo**: `generar-ticket.ts` (generarTicketVenta)
- **Problema**: No muestra "Recibido: $X / Vuelto: $Y" para pagos en efectivo
- **Fix**: Agregar campo montoRecibido en DatosVenta y calcular vuelto

## Recomendaciones

1. **Desacoplar nombre de organizacion** del hardcode "Kiosco 24hs"
2. **Agregar vuelto** al ticket de venta para pagos en efectivo
3. **Implementar resumen diario** multi-sucursal para el dueno
4. **Reporte de asistencia mensual** para liquidacion de sueldos
5. **Tamano de archivos**: Verificar que PDFs no excedan 2MB (limite WhatsApp)

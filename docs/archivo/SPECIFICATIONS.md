# SPECIFICATIONS - App Kiosco SaaS

> Documento de referencia para los 17 agentes del directorio `agents/`.
> Cada agente debe leer este archivo para entender prioridades, métricas y límites.
> Última actualización: 2026-02-25

---

## 1. Visión del producto

SaaS POS multi-tenant para cadenas de kioscos en Argentina.
Reemplaza cuadernos, WhatsApp y Excel con una app que funciona
en el celular del kiosquero, con o sin internet.

Target inicial: +10 cadenas de kioscos (cada una con 1-8 sucursales).

---

## 2. Stakeholders

### Beto (Dueño de cadena, 40-55 años)
- Tiene 3-8 kioscos, 5-20 empleados
- Quiere: control de caja, stock sin vencimientos, saber qué sucursal rinde
- No quiere: complejidad, pasos extras, jerga técnica
- Compara con: su cuaderno y Excel (la barra es baja, pero la confianza es alta)

### Lucía (Empleada kiosquera, 20-35 años)
- Atiende 8 horas, celular Android gama media
- Quiere: cobrar rápido, no equivocarse en el vuelto, irse a horario
- No quiere: pasos extras, app lenta, cosas que no entiende
- Benchmark: Samsung A14, 3GB RAM, WiFi inestable

---

## 3. Estado actual de features

### CORE — Operación diaria
| Feature | Estado | Archivos clave | Notas |
|---------|--------|---------------|-------|
| Login / Auth | ✅ Funcional | auth.actions.ts, auth-form.tsx | Email + magic links |
| Multi-tenant (orgs/branches) | ✅ Funcional | organization.repository.ts | RLS verificado 18/18 tablas |
| Auth en Server Actions | ✅ Funcional | auth-helpers.ts | verifyAuth/verifyOwner centralizados |
| Selección de sucursal | ✅ Funcional | seleccionar-sucursal.tsx | |
| Crear venta | ✅ Funcional | ventas.actions.ts, caja-ventas.tsx | Búsqueda + barcode |
| Apertura de caja | ✅ Funcional | shift.actions.ts | |
| Cierre/Arqueo de caja | ✅ Funcional | arqueo-caja.tsx | Calcula diferencia |
| Movimientos de caja | ✅ Funcional | cash.actions.ts | Ingresos/egresos |
| Fichaje QR | ✅ Funcional | qr-fichaje-scanner.tsx | Entrada/salida |

### INVENTARIO — Stock y productos
| Feature | Estado | Archivos clave | Notas |
|---------|--------|---------------|-------|
| Catálogo de productos | ✅ Funcional | product.actions.ts, producto.repository.ts | CRUD completo |
| Búsqueda por barcode | ✅ Funcional | caja-ventas.tsx | html5-qrcode |
| Stock FIFO | ⚠️ Parcial | stock.repository.ts, inventory.actions.ts | Lógica existe, verificar descuento correcto |
| Alertas stock bajo | ⚠️ Parcial | inventory.actions.ts | Query existe, UI no verificada |
| Alertas vencimiento | ⚠️ Parcial | stock.repository.ts | Datos existen, alertas no verificadas |
| Gestión de proveedores | ⚠️ Parcial | provider.actions.ts, gestion-proveedores.tsx | CRUD existe |
| Transferencia entre sucursales | ❌ Pendiente | — | No implementado |

### DASHBOARDS — Vista del dueño
| Feature | Estado | Archivos clave | Notas |
|---------|--------|---------------|-------|
| Dashboard dueño (5 tabs) | ✅ Funcional | dashboard-dueno.tsx | |
| Ventas del día por sucursal | ⚠️ Verificar | stats.actions.ts | Query existe |
| Diferencias de caja por turno | ⚠️ Verificar | dashboard.actions.ts | |
| Control de empleados (fichaje) | ⚠️ Verificar | attendance.actions.ts | |
| Análisis ventas por tipo pago | ⚠️ Verificar | stats.actions.ts | |
| Valor de inventario en stock | ⚠️ Parcial | — | Datos existen, vista no |
| Comparativa entre sucursales | ❌ Pendiente | — | No implementado |

### GAMIFICACIÓN
| Feature | Estado | Archivos clave | Notas |
|---------|--------|---------------|-------|
| Misiones diarias | ⚠️ Parcial | missions.actions.ts | Generación + completar |
| Templates de misiones | ⚠️ Parcial | 00002_mission_templates.sql | Schema aplicado |
| XP y ranking | ⚠️ Parcial | misiones-empleado.tsx | UI existe |
| Asignar misiones (dueño) | ⚠️ Parcial | asignar-mision.tsx | |

### REPORTES
| Feature | Estado | Archivos clave | Notas |
|---------|--------|---------------|-------|
| Ticket de venta (PDF) | ⚠️ Parcial | generar-ticket.ts | Existe, verificar formato |
| Cierre de caja (PDF) | ⚠️ Parcial | pdf-generator.ts | Existe |
| Export ventas (Excel) | ⚠️ Parcial | excel-generator.ts | Existe |
| Export stock (Excel) | ⚠️ Parcial | excel-generator.ts | |

### FACTURACIÓN ARCA
| Feature | Estado | Archivos clave | Notas |
|---------|--------|---------------|-------|
| Servicio ARCA | ⚠️ Mock | arca.service.ts | CAEs falsos, no AFIP real |
| UI de facturación | ⚠️ Parcial | components/facturacion/ | No integrada al dashboard |
| Migración DB facturación | ❌ No aplicada | 00003_invoicing.sql | Schema listo, no en DB |

### OFFLINE / PWA
| Feature | Estado | Archivos clave | Notas |
|---------|--------|---------------|-------|
| PWA installable | ✅ Funcional | manifest.json, sw.js | |
| Ventas offline | ⚠️ Parcial | indexed-db.ts, use-offline-ventas.ts | Lógica existe, edge cases no testeados |
| Sync al volver online | ⚠️ Parcial | use-offline-ventas.ts | Retry no verificado |

### INFRAESTRUCTURA
| Feature | Estado | Archivos clave | Notas |
|---------|--------|---------------|-------|
| CI/CD | ❌ Pendiente | — | No hay pipeline |
| Monitoreo (Sentry) | ❌ Pendiente | logging.ts | Logger listo, Sentry no |
| Health check endpoint | ❌ Pendiente | — | |

---

## 4. Prioridades de trabajo

### P0 — Blindar (sin esto no se escala)
1. ~~Seguridad: auth en Server Actions~~ ✅ COMPLETADO
2. Database: índices para queries frecuentes + aplicar migraciones 00003/00004
3. Testing: tests unitarios para ventas, caja, stock (flujos críticos)
4. Inventario: verificar que FIFO descuenta correctamente

### P1 — Solidificar (para los primeros 10 clientes)
5. Offline/PWA: validar sync completo sin pérdida de ventas
6. Performance: lazy load de jsPDF, xlsx, html5-qrcode
7. Dashboard MVP: verificar los 5 KPIs del dueño
8. Onboarding: flujo < 30 minutos para nuevo cliente
9. DevOps: CI/CD básico antes de deployar a producción

### P2 — Pulir (mejorar el producto)
10. UX: optimizar flujos de Lucía (< 8 taps por venta)
11. Reportes: verificar PDF/Excel existentes
12. Gamificación: misiones diarias simples funcionando
13. Analytics: dashboard completo del dueño

### P3 — Expandir (cuando haya clientes pagando)
14. Facturación ARCA (requiere certificado digital real)
15. Comparativa avanzada entre sucursales
16. Transferencia de stock entre sucursales
17. Predicción de pedidos

---

## 5. Dashboard del dueño — KPIs prioritarios

Estos son los 5 paneles que Beto necesita ver al abrir la app:

1. **Control de caja por turno**
   - Quién abrió, cuánto hay, diferencia actual
   - Historial de diferencias por empleado

2. **Stock e inventario**
   - Productos con stock bajo (< mínimo)
   - Productos por vencer (< 7 días)
   - Valor total del inventario en mercadería

3. **Ventas del día**
   - Total por sucursal
   - Desglose por método de pago (efectivo/digital)
   - Ticket promedio

4. **Control de empleados**
   - Quién fichó hoy (y quién no)
   - Horas trabajadas por empleado
   - Puntualidad

5. **Proveedores**
   - Últimas compras
   - Balance con cada proveedor

---

## 6. Métricas de performance

### Operación (lo que siente Lucía)
| Acción | Target | Cómo medir |
|--------|--------|-----------|
| Buscar producto | < 300ms | Debounce + query local |
| Agregar a venta | < 100ms | Estado local |
| Calcular total | < 50ms | Cálculo en memoria |
| Procesar cobro | < 2s | Server action + sync |
| Cargar app (primer uso del día) | < 1.5s | FCP en 4G |
| Arqueo de caja | Datos en < 1s | Query optimizada |

### Técnicas (lo que mide DevOps)
| Métrica | Target |
|---------|--------|
| Initial JS bundle | < 300KB |
| Build time | < 60s |
| Uptime | 99.5% (MVP) |
| Datos históricos | 1 año |

### Escala (lo que mide el Orquestador)
| Métrica | MVP | Fase 2 |
|---------|-----|--------|
| Organizaciones | 10-50 | 100+ |
| Empleados por org | 1-100 | 1-500 |
| Sucursales por org | 1-8 | 1-50 |
| Ventas diarias por sucursal | ~200 | ~1000 |

---

## 7. Constraints

### Tecnológicos (no cambiar)
- Framework: Next.js 16 (App Router)
- Backend: Supabase (PostgreSQL + Auth + RLS)
- UI: Radix/shadcn (estilo "new-york")
- CSS: Tailwind 4
- Offline: PWA + IndexedDB
- Patrón: Server Actions (no REST API)
- Repos: Repository pattern para acceso a datos

### De negocio
- Facturación ARCA depende de certificado digital del cliente
- Los kioscos operan en Argentina (pesos, horario GMT-3)
- Los empleados no tienen email corporativo (usan Gmail/Hotmail personal)
- El dueño comparte reportes por WhatsApp (PDF < 2MB)

### De dispositivo
- Android 10+ con Chrome 90+
- Pantalla mínima: 5.5"
- RAM mínima: 3GB
- Almacenamiento disponible: 100MB para PWA + datos offline
- Conexión: 3G mínimo, WiFi inestable

---

## 8. Definiciones de "listo"

### Una feature está LISTA cuando:
1. Funciona en el flujo completo (no solo la query o solo la UI)
2. Tiene auth verificado (verifyAuth/verifyOwner según corresponda)
3. El RLS protege los datos
4. Funciona en mobile (Samsung A14)
5. Los errores se manejan y muestran mensajes claros
6. Tiene al menos 1 test del happy path

### Un agente TERMINÓ su tarea cuando:
1. Generó el reporte en el formato de su SKILL.md
2. Los cambios compilan sin errores (npm run build)
3. No rompió funcionalidad existente
4. Documentó qué tocó y por qué

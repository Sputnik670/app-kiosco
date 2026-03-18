# Reporte Orquestador - Estado Completo Pre-Piloto

**Fecha**: 2026-03-02
**Fase**: P2 - Mapeo completo antes de piloto real
**Build**: Pendiente verificacion
**Tests**: 146 tests (P0)

---

## Estado por area (checklist)

| Area | Agente | Estado | Score | Bloqueante para piloto? |
|------|--------|--------|-------|------------------------|
| Empleado (Lucia) | persona-empleado | NECESITA TRABAJO | 7/10 | NO (funcional, mejoras de UX) |
| Dueno (Beto) | persona-dueno | FUNCIONAL CON MEJORAS | 6/10 | NO (funcional, falta consolidar KPIs) |
| Inventario FIFO | inventario | FUNCIONAL | 8/10 | NO |
| Reportes PDF/Excel | reportes | COMPLETO | 9/10 | NO |
| Analytics KPIs | analytics | INTERMEDIO | 7/10 | NO (KPIs basicos OK, faltan avanzados) |
| Onboarding | onboarding | FUNCIONAL | 6/10 | PARCIAL (catalogo pre-cargado critico) |
| UX/Accesibilidad | ux | BUENO | 7/10 | NO |
| Seguridad (P0) | seguridad | COMPLETADO | 9/10 | NO (RLS auditado) |
| Database (P0) | database | COMPLETADO | 9/10 | NO |
| Testing (P0) | testing | COMPLETADO | 8/10 | NO (146 tests) |
| Offline/PWA (P0) | offline | COMPLETADO | 9/10 | NO (excelente soporte) |
| Performance (P1) | performance | COMPLETADO | 8/10 | NO |
| DevOps (P1) | devops | COMPLETADO | 8/10 | NO |

**Promedio general**: 7.7/10 - APTO PARA PILOTO CON CAVEATS

---

## Bugs encontrados (prioridad)

### CRITICOS (bloquean piloto)
Ninguno encontrado. La app es funcional para un piloto controlado.

### ALTOS (deben corregirse antes de escalar a +5 kioscos)

| # | Bug/Issue | Area | Archivo | Impacto |
|---|-----------|------|---------|---------|
| 1 | Margen estimado hardcodeado al 60% | Analytics | `dashboard.actions.ts:298` | Metricas financieras ficticias |
| 2 | Nombre "Kiosco 24hs" hardcodeado en tickets | Reportes | `generar-ticket.ts:38,220` | Tickets no personalizados |
| 3 | Sin catalogo pre-cargado de productos | Onboarding | - | Time-to-value de 30+ minutos |
| 4 | 9 tabs en dashboard dueno | UX | `dashboard-header.tsx:23-33` | Overwhelm en mobile |
| 5 | Sin resumen consolidado de KPIs | Dashboard | `dashboard-dueno.tsx` | Dueno tiene que navegar 3 tabs |

### MEDIOS (mejorar UX/experiencia)

| # | Issue | Area | Impacto |
|---|-------|------|---------|
| 6 | Sin productos favoritos/frecuentes en caja | Empleado | Venta mas lenta de lo necesario |
| 7 | Vocabulario tecnico en varias pantallas | UX | Confusion para usuarios no-tech |
| 8 | Texto micro (9-10px) en tabs y labels | UX/Accesibilidad | Dificil de leer en dispositivos economicos |
| 9 | Sin comparativa entre sucursales | Analytics | Dueno no puede decidir que kiosco rinde |
| 10 | Magic link como unico registro | Onboarding | Friccion de 60-120s en el primer uso |
| 11 | Ticket sin calculo de vuelto | Reportes | Dato util para el cliente que falta |
| 12 | Empleado no ve su ranking | Gamificacion | Menor motivacion |

### BAJOS (nice to have)

| # | Issue | Area |
|---|-------|------|
| 13 | Sin notificaciones push | Dashboard |
| 14 | Sin orden de compra automatica | Inventario |
| 15 | Sin transferencia entre sucursales | Inventario |
| 16 | Sin skeleton loaders (usa spinner) | UX |
| 17 | aria-labels faltantes en botones de icono | Accesibilidad |

---

## Recomendaciones antes de piloto

### Fase inmediata (antes del primer kiosco piloto)

1. **Corregir margen hardcodeado** (Bug #1) - 1 hora de trabajo
   - Usar `products.cost` real cuando existe
   - Fallback 60% solo si no hay costo registrado

2. **Desacoplar nombre de organizacion** (Bug #2) - 30 minutos
   - Pasar nombre de org como parametro al generador de tickets

3. **Reducir tabs del dashboard** (Bug #4) - 2 horas
   - De 9 tabs a 5: Resumen, Operacion, Inventario, Equipo, Reportes

4. **Agregar resumen de KPIs en landing** (Bug #5) - 3 horas
   - 5 cards al inicio: Ventas hoy, Transacciones, Alertas, Empleados, Capital riesgo

### Fase pre-escala (antes de +5 kioscos)

5. **Catalogo pre-cargado** (Bug #3) - 1 dia
   - 200 productos tipicos de kiosco argentino con precios estimados
   - Clasificados por categoria (bebidas, cigarrillos, golosinas, etc.)

6. **Registro con password** (Bug #10) - 2 horas
   - Agregar opcion email+password ademas de magic link

7. **Productos frecuentes en caja** (Bug #6) - 3 horas
   - Grid de 6-8 productos top basado en historial

8. **Comparativa sucursales** (Bug #9) - 4 horas
   - RPC `get_branches_comparison` + UI simple de ranking

### Fase post-piloto (basado en feedback real)

9. **Notificaciones push** para alertas criticas
10. **Orden de compra automatica** basada en stock bajo
11. **Facturacion ARCA/AFIP** (requerimiento legal)
12. **Sistema de planes** (free/pro/enterprise) para monetizacion

---

## Proximos pasos

### Semana 1-2: Preparacion piloto
- [ ] Corregir bugs #1, #2, #4, #5 (margen, tickets, tabs, KPIs)
- [ ] Ejecutar build + tests para verificar estabilidad
- [ ] Seleccionar 1 kiosco real para piloto
- [ ] Configurar org + sucursal + empleado de prueba

### Semana 3-4: Piloto con 1 kiosco
- [ ] Desplegar en produccion
- [ ] Entrenar al dueno y 1-2 empleados
- [ ] Monitorear errores y recopilar feedback
- [ ] Implementar bugs #6, #7, #8 basado en feedback

### Mes 2: Escalar a 3-5 kioscos
- [ ] Implementar catalogo pre-cargado (#3)
- [ ] Implementar comparativa sucursales (#9)
- [ ] Implementar registro con password (#10)
- [ ] Definir pricing y sistema de planes

### Mes 3+: Escalar a +10 kioscos
- [ ] Facturacion ARCA/AFIP
- [ ] Notificaciones push
- [ ] Orden de compra automatica
- [ ] App nativa o PWA mejorada

---

## Metricas de exito del piloto

| Metrica | Target | Como medir |
|---------|--------|-----------|
| Time-to-first-sale | < 15 minutos | Timestamp org_created -> primera venta |
| Ventas diarias registradas | > 80% del total real | Comparar con cuaderno existente |
| Diferencia de caja promedio | < $5.000 | cash_registers.variance |
| Empleados fichando diariamente | 100% | attendance records |
| Abandono del dueno | 0% en primer mes | Login activity |
| NPS del dueno | > 7/10 | Encuesta directa |

---

*Reporte generado por el Agente Orquestador - CTO Virtual de App Kiosco*
*Basado en auditoria de codigo fuente de los 7 agentes especializados*

---

## Actualización 2026-03-18

**Commits revisados**: 14 commits en últimas 48h
- 74a2192 documentacion
- 8729f52 para nuevo deploy
- 74c2d14 cambio hardcodeado en costos
- 31c9a0b feat: timeline unificada + roadmap actualizado
- 7a3d8eb chore: excluir .next_old/ y artefactos de build del tracking
- af60612 fixes ventas
- bfc307e Fixes varios v10
- 7b9e595 notas para dueño
- 3fa8eb3 feat: tab Historial + alertas mejoradas
- 1ec1b59 fix: allowedOrigins para 403 + saldo visible en servicios virtuales
- 39b130b fix: usar processVirtualRechargeAction en servicios
- e74842f fix: agregar toast de error visible en widget servicios virtuales
- 9022d66 fix: toast de error en SUBE + corregir tabla memberships en API productos
- d2beb59 fix: seguridad API productos + botón SUBE + comisiones servicios virtuales

**Features nuevas detectadas**:
1. **Sistema de Timeline Unificada** — `tab-timeline.tsx` + `timeline.actions.ts`: Vista cronológica de TODAS las actividades del negocio (ventas, servicios, compras, movimientos de caja, cambios de precio, incidentes, notas) en un solo lugar con navegación por calendario.
2. **Diario del Dueño** — `diario-dueno.tsx` + `notes.actions.ts`: Sistema de notas personales con 7 categorías (general, precios, proveedores, empleados, sucursales, finanzas, idea), búsqueda, filtrado y pin.
3. **Sistema de Incidentes** — `gestion-incidentes.tsx` + `mis-incidentes.tsx` + `incidents.actions.ts`: Flujo completo owner→employee para reportar y resolver incidentes (errores, diferencias de caja, pérdida de stock, asistencia).
4. **Tab Historial** — `tab-historial.tsx`: Registros históricos con 3 secciones (movimientos + ranking productos, inventario + pérdidas, equipo + métricas empleados).
5. **Tab Alertas Mejorada** — `tab-alerts.tsx`: Alertas separadas entre "por vencer" y "ya vencidos" + stock bajo.
6. **Rate Limiting** — `lib/rate-limit.ts` + middleware: 10 req/min para auth, 60 req/min para API.
7. **Validación Zod Completa** — `lib/validations/index.ts`: Schemas para todos los inputs de server actions.

**Bugs resueltos**:
- Bug #1 (margen hardcodeado 60%) → RESUELTO en commit 74c2d14
- H7 (branch.actions.ts sin role check) → RESUELTO (ahora usa verifyOwner)
- H11 (user.actions.ts importaba browser client) → RESUELTO
- M6 (sin validación Zod) → RESUELTO con lib/validations/index.ts
- Rate limiting ausente → RESUELTO con lib/rate-limit.ts
- Middleware sin protección de rutas → RESUELTO
- Toast de errores invisible en servicios virtuales → RESUELTO
- API productos sin validación de membresía → RESUELTO
- Comisiones de servicios virtuales incorrectas → RESUELTO

**Bugs nuevos detectados**:
- dashboard.actions.ts:228 llama redundantemente a get_my_org_id() (race condition menor)
- tab-historial.tsx usa browser client directo en vez de server actions (debería migrarse)

**Roadmap changes**:
- Dashboard renombrado de "Panel de Control" a "Torre de Control"
- Nuevas tabs: historial (timeline), ajustes (integraciones MP/ARCA)
- Actualización masiva de precios DESCARTADA por Ram (2026-03-17)
- ARCA en desarrollo activo

**Score actualizado**: 8.5/10

**Próximas 3 prioridades**:
1. Completar integración ARCA → agente desarrollo → Habilitaría facturación parcial para clientes que lo necesiten
2. Migrar tab-historial.tsx de browser client a server actions → agente seguridad → Consistencia de seguridad y performance
3. Iniciar planificación PWA/Offline → agente offline → Diferenciador clave para kioscos con WiFi inestable

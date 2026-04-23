# Pre-Demo Check — 15 minutos

> Correr ANTES de cada llamada con un prospecto. Si algo falla, cancelás la demo o usás la otra PC.
> Si esto sale todo verde, tu demo no va a romperse en vivo.

---

## Arranque (2 min)

- [ ] Abrir navegador limpio (incógnito o con cache limpia)
- [ ] Ir a `https://app-kiosco-chi.vercel.app`
- [ ] Loguearme con cuenta de **demo** (NO con tu cuenta real de desarrollo)
- [ ] Verificar: estoy en la sucursal "Demo" con data pre-cargada

Si algo falla acá, abortá. Usá el otro navegador o la otra PC.

---

## 1. Login + Dashboard (1 min)
- [ ] El login carga rápido (<2s)
- [ ] El selector de sucursal aparece o entro directo al dashboard
- [ ] Se ve "Torre de Control" con números de ejemplo

Si ves pantalla blanca o error: **abortar demo**.

---

## 2. Flujo estrella — Venta con scanner (3 min)

Este es **el flujo número uno** que impresiona a un kiosquero.

- [ ] Tab "Ventas" → ya hay caja abierta (o abro con $5000)
- [ ] Busco "coca" en el buscador → aparece en el dropdown
- [ ] Click para agregar al carrito
- [ ] (Opcional, si hago demo con celular) escaneo un código de barras → se autocompleta
- [ ] Selecciono "Efectivo" y confirmo
- [ ] Veo toast verde de éxito
- [ ] El stock bajó en 1 unidad

Si el scanner no funciona: tengo el plan B — demo con búsqueda por nombre.

---

## 3. Flujo diferenciador — HR + Misiones (3 min)

Este es **el argumento de venta** para este prospecto en particular.

- [ ] Tab "Control Empleados" carga con al menos 2 empleados de demo
- [ ] Se ve el ranking con XP y badges
- [ ] Click en un empleado → veo sus misiones del día
- [ ] Puedo asignar misión nueva: "Reponer estantería", 15 XP
- [ ] Aparece marcada como pendiente

Si esto falla: la demo se cae. **Testear en serio antes.**

---

## 4. Fichaje QR (2 min)

- [ ] Como dueño: genero QR de entrada
- [ ] El QR se muestra en pantalla grande (imprimible)
- [ ] (Opcional con celular) Escaneo → fichaje registrado → toast de éxito

---

## 5. Servicios virtuales (2 min)

Diferencial vs competencia.

- [ ] Widget SUBE: carga de $500 con comisión automática
- [ ] Widget recargas: seleccionar operadora, confirmar
- [ ] Las dos ventas aparecen en el dashboard separadas de productos físicos

---

## 6. Reportes (1 min)

- [ ] Generar PDF de ventas del día — se descarga
- [ ] Abre correctamente, formato legible

---

## 7. Dashboard — vista final (1 min)

- [ ] Tab "Análisis": veo margen real (no hardcodeado)
- [ ] Tab "Alertas": se ve al menos un producto con stock crítico
- [ ] Tab "Historial": carga rápido con lista de movimientos

---

## Red flags — si ves alguna, **no hagas la demo sobre prod**:

- Pantalla blanca o error 500 en cualquier tab
- Toast rojo de error al confirmar una venta
- Logs de error en consola (F12 → Console) con datos sensibles
- Tiempo de carga > 5 segundos en cualquier pantalla

---

## Plan B si algo está roto

1. Usá el screen recording que grabaste cuando todo funcionaba (creá uno si no lo tenés).
2. Demostrá con mockups o prototipo visual.
3. Sé honesto: "el módulo X lo estamos puliendo esta semana, te lo muestro el miércoles".

**Nunca hagas una demo en vivo sin haber pasado este check.**

---

## Cierre

- Timestamp de check: `____:____`
- Resultado: `[ ] Todo OK - demo confirmada  [ ] Algo falló - posponer`
- Bug blocker encontrado (si aplica):

---

> Para el test completo de la app, ver `QA-CHECKLIST.md` (90-120 min).

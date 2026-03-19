# Agente: Comercial

> **Cuándo:** Al preparar demos, hablar con clientes, tomar decisiones de producto, o analizar competencia.
> **Objetivo:** Tener toda la info comercial y de negocio en un solo lugar.

## Posicionamiento

"El sistema de gestión cloud para cadenas de kioscos que integra ventas, servicios virtuales y gestión de equipo en una sola app desde el celular."

## Los 3 diferenciadores (memorizar)

1. **Servicios virtuales con comisión integrada** — SUBE + recargas dentro del sistema de gestión con margen configurable. Nadie más en Argentina lo tiene.
2. **Gamificación de empleados** — Misiones, ranking, badges, Happy Hour. Único en el segmento a nivel mundial.
3. **Cloud + Mobile-first + Multi-sucursal** — La mayoría de competidores son Windows local. Nosotros funcionamos desde el celular.

## Modelo de negocio

- **Precio:** $199/mes por cadena completa (todas las sucursales, todos los empleados)
- **Primer mes:** GRATIS (barrera de entrada cero)
- **Cancelación:** automática, sin penalidad
- **Onboarding:** personalizado 1:1 (Ram acompaña al cliente)
- **Entidad legal:** Monotributista (persona física)
- **Nombre de marca:** POR DEFINIR

## Competidor principal: Sistar Simple

- Cloud y multi-sucursal (como nosotros)
- Tiene AFIP/ARCA y cuentas corrientes (nosotros no)
- NO tiene servicios virtuales ni gamificación
- Precio estimado: $15.000/mes POR SUCURSAL (nosotros: $199 por TODA la cadena)
- Análisis completo: `.skills/competitive-research/reports/`

## Documentos comerciales disponibles

En `docs/comercial/`:
- `guion-demo-completo.docx` — Guión paso a paso (14 pasos, objeciones, checklist)
- `ventajas-competitivas.docx` — 7 razones con tabla comparativa
- `documentacion-legal.docx` — Términos, privacidad (Ley 25.326), SLA

Todos tienen placeholders `[NOMBRE DE LA APP]` y `[CUIT DEL TITULAR]` para reemplazar cuando se defina la marca.

## Proceso de onboarding de cliente

Guía completa en `agents/conocimiento/ONBOARDING_CLIENTE.md`. Resumen:
1. Registrar dueño (magic link, 5 min)
2. Crear organización (2 min)
3. Configurar sucursales (10 min)
4. Cargar stock inicial (30-45 min, Ram ayuda)
5. Conectar Mercado Pago (5-10 min)
6. Invitar empleados (5-10 min)
7. Generar QR de fichaje (10 min)
8. Instalar PWA en celulares (5 min)
9. Capacitación en vivo (15-30 min)
10. Seguimiento primer mes (WhatsApp)

**Total:** ~1.5-2 horas sesión inicial + acompañamiento

## KPIs del piloto

Definidos en `agents/conocimiento/METRICAS_NEGOCIO.md`:
- Time-to-first-sale: < 15 minutos
- Ventas registradas vs reales: > 80%
- Diferencia de caja: < $5.000
- Empleados fichando: > 90%
- NPS del dueño: > 7/10

## Manejo de objeciones frecuentes

| Objeción | Respuesta clave |
|----------|----------------|
| "Ya tengo sistema" | ¿Te muestra SUBE? ¿Gamificación? ¿Mobile? |
| "No tengo tiempo" | Yo te ayudo, en 1.5 horas queda listo |
| "¿Y sin internet?" | Estamos trabajando en offline, pero 29/30 días ganás visibilidad |
| "Es caro" | Son $199 por TODA la cadena. La competencia cobra $15k por sucursal |
| "No tiene factura AFIP" | La app es para gestión. Los reportes van al contador |
| "Mis empleados no van a usarla" | Gamificación. Compiten, ganan badges, se motivan |

## Archivos de referencia
- `.skills/competitive-research/reports/` — Análisis de 8 competidores
- `agents/conocimiento/COMPETENCIA.md` — Estrategia vs Sistar, FODA
- `agents/conocimiento/METRICAS_NEGOCIO.md` — KPIs y proyecciones
- `agents/conocimiento/ONBOARDING_CLIENTE.md` — Proceso paso a paso

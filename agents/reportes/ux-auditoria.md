# Auditoria de UX y Consistencia Visual

**Fecha**: 2026-03-02
**Agente**: kiosco-ux
**UX Score**: 7/10

---

## Resumen

La app tiene un estilo visual cohesivo y moderno basado en shadcn/ui + Tailwind. El diseno es mobile-first con bordes redondeados agresivos (`rounded-[2rem]`+), tipografia bold/black, y esquema de colores slate. Las areas de mejora principales son: consistencia en spacing, accesibilidad (contraste, labels), y reduccion de complejidad en el dashboard del dueno.

## Problemas de usabilidad (impactan al kiosquero)

| Pantalla | Problema | Impacto | Fix propuesto |
|----------|----------|---------|---------------|
| caja-ventas | Input busqueda placeholder "BUSCAR O ESCANEAR..." poco descriptivo | Lucia no sabe que puede escribir nombre | "Buscar producto por nombre o codigo..." |
| caja-ventas | Boton Escanear dentro del input (absolute positioned) | En pantallas chicas se superpone con texto | Mover boton debajo del input |
| vista-empleado | 3 tabs con iconos de 3.5x3.5 y texto 10px | Dificil de leer en Samsung A14 | Aumentar a iconos 4x4 y texto 12px |
| dashboard-dueno | 9 tabs en scroll horizontal | Overwhelm, no se ven todas | Reducir a 5 tabs agrupadas |
| arqueo-caja | Input de monto h-24 texto 5xl | Excelente para touch | Mantener |
| profile-setup | Password input sin indicador de fuerza | Usuario no sabe si es buena | Agregar indicador de fuerza |
| reloj-control | Boton QR con texto largo "ESCANEAR QR ENTRADA" | Se corta en mobile | Usar solo icono + "ENTRADA" |

## Inconsistencias visuales

| Componente | Inconsistencia | Fix con Tailwind |
|------------|---------------|-----------------|
| Cards | rounded-[2rem] vs rounded-[2.5rem] vs rounded-2xl | Estandarizar a `rounded-[2rem]` |
| Buttons confirm | h-14, h-16, h-20 en distintas pantallas | Estandarizar: primario h-16, grande h-20 |
| Text labels | text-[9px], text-[10px], text-[11px] arbitrarios | Estandarizar: micro=text-[10px], small=text-xs |
| Padding cards | p-4, p-5, p-6, p-8 en distintos cards | Estandarizar: compact=p-4, normal=p-6, spacious=p-8 |
| Badge styles | Mezcla de bg-red-500, bg-emerald-500, bg-blue-600 | OK (semantico), pero inconsistente en border-0 vs default |
| Font weights | font-bold, font-black mezclados | Estandarizar: headers=font-black, body=font-bold, light=font-medium |

## Accesibilidad

| Elemento | Problema WCAG | Nivel | Fix |
|----------|--------------|-------|-----|
| caja-ventas input | Solo placeholder, sin label visible | AA | Agregar `<Label>` arriba del input |
| Botones de metodo pago | Solo texto, sin aria-label | A | Agregar `aria-label="Pagar con efectivo"` etc |
| Badge OFFLINE | Texto blanco sobre rojo | AA | OK, pero verificar contrast ratio exacto |
| Text micro (9px) | Debajo del minimo recomendado 12px | AAA | Aumentar a minimo 10px, idealmente 11px |
| Tabs de navegacion | Sin `role="tablist"` / `role="tab"` | A | Agregar roles ARIA semanticos |
| Iconos solos (LogOut) | Sin aria-label | A | Agregar `aria-label="Cerrar sesion"` |
| Focus indicators | shadcn default (ring) presente | AA | OK |
| Progress bar XP | Sin texto alternativo | A | Agregar `aria-label="Nivel X, Y% progreso"` |

## Tipografia y jerarquia

- **Font**: No se carga font custom visible en layout.tsx (usa system fonts via Tailwind)
- **Jerarquia usada**:
  - Page title: `text-2xl font-black uppercase tracking-tighter`
  - Section title: `text-xl font-black uppercase`
  - Card title: `text-sm font-black uppercase`
  - Labels: `text-[10px] font-black uppercase tracking-widest`
  - Body: `text-xs font-bold`
- **Problema**: Demasiado uso de `uppercase` - todo se ve igual en importancia
- **Fix**: Reservar uppercase solo para headers principales y badges

## Colores y contraste

- **Esquema principal**: slate-900 (header) + slate-50 (background) + blue-600 (accent)
- **Semanticos**: emerald para exito/apertura, red para cierre/danger, amber para warning/offline
- **Contraste**: Generalmente bueno. Problemas potenciales:
  - `text-slate-400` sobre `bg-white` puede no pasar WCAG AA para texto small
  - `text-blue-300` sobre `bg-slate-900` es borderline
- **CSS variables**: shadcn usa variables CSS para temas (correcto)

## Mobile-first

- **Responsive**: SI - componentes usan `flex-col sm:flex-row` pattern
- **Horizontal scroll**: Tabs del dashboard pueden causar scroll horizontal (9 tabs)
- **Touch targets**: Buttons principales >= 44px (h-14, h-16, h-20) - BUENO
- **Thumb zone**: Boton confirmar venta esta abajo de la pantalla - BUENO
- **Bottom nav**: No hay bottom nav persistente - empleado usa tabs en el contenido

## Quick wins esteticos

| Cambio | Impacto visual |
|--------|---------------|
| Agregar skeleton loaders en vez de Loader2 spinner | App se siente mas rapida |
| Reducir tabs dueno de 9 a 5 | Menos overwhelm |
| Agregar sombras sutiles a cards interactivas | Mejor jerarquia visual |
| Estandarizar border-radius a 2rem | Consistencia |
| Agregar transicion suave al cambiar tabs | Mas profesional |

## Componentes UI disponibles (shadcn)

Primitivos encontrados en `components/ui/`:
- button, card, input, label, badge, dialog
- popover, calendar, select, separator
- progress, tabs, checkbox, radio-group, alert
- **Faltantes comunes**: toast (usa sonner directamente), skeleton (no encontrado), switch, slider
- **Recomendacion**: Agregar `skeleton.tsx` de shadcn para loading states consistentes

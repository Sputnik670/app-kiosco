# Prompts para explorar logos de KioscoApp

> Para usar en Nivel B. Generá varias opciones y cuando tengas 2-3 finalistas, definí la paleta final y meteme el logo al header de los templates reemplazando el wordmark `<span>`.

## Guías que aplican a todas las variantes

- **Paleta base**: indigo `#4f46e5` + violet `#7c3aed`. Podés probar variantes con negro sólido, blanco sobre indigo, o mono en indigo.
- **Fondo**: transparente (PNG o SVG). NO generar con fondo blanco o gris.
- **Formato**: pedir cuadrado 1:1 para app icon / favicon. Pedir horizontal 3:1 o 4:1 para header de mail / sitio web.
- **Legibilidad a 48px**: el logo tiene que leerse en miniatura (header de mail, favicon). Formas demasiado detalladas pierden al chiquitito.
- **Contexto cultural**: "kiosco" en Argentina = tienda de barrio con vidrieras llenas, diarios, golosinas, recarga de celular. No confundir con "kiosk" americano (máquina expendedora o info-point).
- **Evitar**: clip art, gradientes psicodélicos, 3D fotorrealista, sombras pesadas, tipografía Papyrus/Comic Sans.

---

## Variante 1 — Wordmark moderno (recomendada para empezar)

**Dirección:** tipografía custom o muy cuidada, sin icono. La más rápida de llevar a producción porque es solo texto.

### Midjourney / Flux
```
Modern SaaS wordmark logo "KioscoApp", clean geometric sans-serif typography, "Kiosco" in indigo #4f46e5 and "App" in violet #7c3aed, subtle letter spacing, minimal, professional tech startup branding, transparent background, vector style, high contrast, flat design --ar 4:1 --style raw
```

### ChatGPT (DALL-E 3)
```
Create a modern SaaS wordmark logo for "KioscoApp" — a Spanish-language business management app. Use a clean geometric sans-serif typeface. The word "Kiosco" should be in indigo (#4f46e5) and "App" in violet (#7c3aed). Subtle letter spacing, flat vector design, transparent background, professional tech branding aesthetic. Horizontal layout, 4:1 aspect ratio. No icons, only typography.
```

---

## Variante 2 — Combinación icono + wordmark

**Dirección:** un símbolo al lado del texto. Más versátil para marketing (se puede usar el icono solo para el app icon).

### Midjourney / Flux
```
Minimal combination mark logo for "KioscoApp", featuring a stylized small shop storefront icon with rolled-up awning, simplified to basic geometric shapes, next to clean sans-serif wordmark "KioscoApp", indigo and violet color palette, flat vector design, transparent background, Latin American small business aesthetic but modern and tech-forward --ar 4:1 --style raw
```

### ChatGPT (DALL-E 3)
```
Design a combination mark logo for "KioscoApp", a Spanish-language kiosk management SaaS. Left side: minimal stylized icon of a small neighborhood shop storefront (think Argentine "kiosco" with a little awning), reduced to clean geometric shapes. Right side: the wordmark "KioscoApp" in a modern sans-serif. Color palette: indigo #4f46e5 and violet #7c3aed. Flat vector, transparent background, no photo-realism, no 3D.
```

---

## Variante 3 — Monogram / app icon

**Dirección:** solo la letra K o KA en un contenedor. Pensado específicamente para app icon / favicon.

### Midjourney / Flux
```
App icon logo for "KioscoApp", bold letter "K" monogram on rounded square background with soft gradient from indigo #4f46e5 to violet #7c3aed, geometric, minimal, modern SaaS aesthetic in the style of Notion or Linear, clean vector, transparent background around the rounded square --ar 1:1 --style raw
```

### ChatGPT (DALL-E 3)
```
Create an app icon for "KioscoApp". Design: a rounded square (squircle) with a smooth gradient background from indigo #4f46e5 (top-left) to violet #7c3aed (bottom-right). Inside, a bold geometric letter "K" in white, centered, modern sans-serif. Style reference: similar clean-geometric feel to the Linear.app or Notion app icons. Flat vector, 1:1 square, transparent surrounding the squircle.
```

---

## Variante 4 — Playful / ilustrativo

**Dirección:** más amigable, con guiño a la cultura del kiosco argentino (persianas, cartelitos, caramelos). Más cálido, menos "corporate SaaS".

### Midjourney / Flux
```
Friendly illustrative logo for "KioscoApp", cute minimalist flat illustration of a small Argentine neighborhood kiosco with colorful awning, small speech bubble with WiFi icon to show it's connected/cloud, indigo and violet dominant with small accents of warm yellow, rounded soft geometric style, not childish but approachable, flat vector transparent background, wordmark "KioscoApp" below or beside --ar 4:3 --style raw
```

### ChatGPT (DALL-E 3)
```
Design a warm, approachable logo for "KioscoApp", a business management app for Argentine neighborhood shops. Include: a small cute flat illustration of a "kiosco" storefront (Argentine style — small window shop with rolled awning), with a tiny WiFi or cloud signal symbol to indicate it's connected. Color palette: mainly indigo #4f46e5 and violet #7c3aed with small warm yellow accent. Style: flat vector, rounded soft shapes, minimalist but friendly (not childish). Include "KioscoApp" wordmark in sans-serif next to or below the illustration. Transparent background.
```

---

## Variante 5 — Geométrico minimalista abstracto

**Dirección:** forma abstracta sin representar nada literalmente. Lo más "SaaS moderno", muy tech startup.

### Midjourney / Flux
```
Abstract geometric logo mark for "KioscoApp", composed of overlapping indigo and violet rounded shapes forming subtle suggestion of a letter K or a stylized arrow going up and right, gradient fill from #4f46e5 to #7c3aed, extreme minimalism, modern tech startup aesthetic like Stripe or Vercel, perfectly balanced composition, flat vector, transparent background --ar 1:1 --style raw
```

### ChatGPT (DALL-E 3)
```
Create an abstract geometric logo mark for "KioscoApp". Use 2-3 overlapping rounded geometric shapes (circles, rounded rectangles, or soft triangles) in indigo #4f46e5 and violet #7c3aed, with gradient transitions. The composition should subtly evoke either the letter "K" or an upward-right growth arrow, without being literal. Extreme minimalism. Style reference: Stripe, Vercel, or Linear logos. Flat vector, transparent background, 1:1 square format.
```

---

## Workflow sugerido para elegir

1. **Generá 4-6 variantes de cada dirección** (5 direcciones × 5 variantes = ~25 opciones).
2. **Achicá a thumbnail** (48×48 o 32×32 px) cada candidato. Las que siguen siendo reconocibles pasan de ronda.
3. **Probalas en contexto real** — pegá la mejor de cada dirección en el header del template `01-confirm-signup.html` reemplazando el wordmark `<span>` por un `<img>`, y miralas en el cliente de mail. Lo que se ve lindo aislado puede quedar raro ahí.
4. **Pedile opinión a 3 kiosqueros**. En serio. Vos sos desarrollador, ellos son el target. Su reacción es más útil que la de diseñadores.
5. **Cuando tengas la elegida**, pedí estas entregas al generador o a un diseñador:
   - SVG (vector editable, sobre todo para web)
   - PNG transparente 512×512 (app icon)
   - PNG transparente 180×48 (email header)
   - PNG transparente versión monocromática blanca (para fondos oscuros)
   - Favicon 32×32 y 16×16

## Notas sobre derechos

Si generás con Midjourney o DALL-E 3 en sus planes pagos, los términos te ceden los derechos comerciales. Con Flux (si lo usás vía fal.ai o Replicate) también. Verificá los TOS actualizados antes de usarlo comercialmente.

Si querés seguridad total, lo generado con IA podés usarlo como **referencia** y después contratar un freelancer en Workana o Fiverr ($20-80 USD) que te lo redibuje en vector limpio con entregables profesionales. Eso resuelve cualquier duda legal y te deja un archivo editable para el futuro.

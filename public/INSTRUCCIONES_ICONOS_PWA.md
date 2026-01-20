# 🎨 ICONOS PWA - Guía de Generación

## 📋 Íconos Requeridos

Para que la app sea instalable como PWA, necesitas generar estos íconos:

| Archivo | Tamaño | Propósito |
|---------|--------|-----------|
| `icon-192.png` | 192x192px | Ícono estándar Android |
| `icon-512.png` | 512x512px | Ícono de alta resolución |
| `icon-apple-touch.png` | 180x180px | Ícono para iOS (Home Screen) |
| `icon-venta.png` | 96x96px | Shortcut "Nueva Venta" |
| `icon-inventario.png` | 96x96px | Shortcut "Ver Inventario" |
| `icon-dashboard.png` | 96x96px | Shortcut "Dashboard" |
| `favicon.ico` | 32x32px | Favicon del navegador |

## 🚀 Generación Rápida

### Opción 1: Generador Online (Recomendado)

1. Ve a: https://realfavicongenerator.net/
2. Sube tu logo (mínimo 512x512px)
3. Selecciona:
   - ✅ iOS Safari
   - ✅ Android Chrome
   - ✅ Desktop browsers
4. Descarga el paquete ZIP
5. Extrae todos los archivos en la carpeta `public/`

### Opción 2: ImageMagick (Terminal)

Si tienes un logo en `logo.png`:

```bash
# Instalar ImageMagick
# Windows: choco install imagemagick
# Mac: brew install imagemagick
# Linux: sudo apt-get install imagemagick

# Generar todos los tamaños
cd public
convert logo.png -resize 192x192 icon-192.png
convert logo.png -resize 512x512 icon-512.png
convert logo.png -resize 180x180 icon-apple-touch.png
convert logo.png -resize 96x96 icon-venta.png
convert logo.png -resize 96x96 icon-inventario.png
convert logo.png -resize 96x96 icon-dashboard.png
convert logo.png -resize 32x32 favicon.ico
```

### Opción 3: Figma/Sketch/Photoshop

1. Crea un artboard cuadrado de 512x512px
2. Diseña tu ícono (usa colores de la marca)
3. Exporta en los tamaños indicados arriba
4. Guarda en `public/`

## 🎨 Recomendaciones de Diseño

### Colores de Marca
Basado en tu `layout.tsx`:
- **Primario (Dark):** `#0f172a` (slate-900)
- **Acento:** Azul/Verde según tu branding
- **Fondo:** Blanco `#ffffff`

### Mejores Prácticas
- ✅ **Fondo sólido:** Evita transparencias en el ícono principal
- ✅ **Contraste alto:** El ícono debe ser legible a 48x48px
- ✅ **Sin texto:** Usa símbolos visuales (ej: caja registradora 💰, carrito 🛒)
- ✅ **Safe zone:** Deja 10% de margen en los bordes
- ✅ **Forma consistente:** Usa la misma forma base en todos los tamaños

### Ejemplo de Diseño Sugerido

```
┌─────────────────┐
│                 │
│    ┌─────┐     │  <- Safe zone (10%)
│    │  🏪 │     │  <- Ícono de kiosco/tienda
│    │ 💵  │     │  <- Elemento secundario (dinero)
│    └─────┘     │
│                 │
└─────────────────┘
```

## 📸 Screenshots (Opcional pero Recomendado)

Para mejorar la experiencia de instalación:

```bash
# Screenshot móvil (iPhone 13)
screenshot-mobile.png -> 390x844px

# Screenshot desktop
screenshot-desktop.png -> 1920x1080px
```

**Cómo capturar:**
1. Abre la app en el navegador
2. F12 → Device Toolbar → iPhone 13 Pro
3. Captura screenshot del dashboard principal
4. Guarda como `screenshot-mobile.png`

## 🔍 Verificación

Después de agregar los íconos:

```bash
# 1. Verificar que todos los archivos existen
ls public/*.png public/favicon.ico

# 2. Iniciar servidor de desarrollo
npm run dev

# 3. Abrir en navegador
# Chrome: DevTools → Application → Manifest
# Safari iOS: Compartir → Añadir a pantalla de inicio

# 4. Verificar PWA score
# https://web.dev/measure/
```

## ✅ Checklist Final

- [ ] `icon-192.png` generado
- [ ] `icon-512.png` generado
- [ ] `icon-apple-touch.png` generado
- [ ] `favicon.ico` generado
- [ ] Icons shortcuts creados (venta, inventario, dashboard)
- [ ] Screenshots capturados (opcional)
- [ ] Manifest validado en Chrome DevTools
- [ ] PWA instalable en Android
- [ ] PWA instalable en iOS

## 🚨 Íconos Temporales

Si necesitas deployar YA y no tienes diseños listos, usa estos placeholders:

```bash
# Crear íconos placeholder con color sólido
convert -size 192x192 xc:"#0f172a" -pointsize 100 -fill white -gravity center -annotate +0+0 "K" icon-192.png
convert -size 512x512 xc:"#0f172a" -pointsize 280 -fill white -gravity center -annotate +0+0 "K" icon-512.png
convert -size 180x180 xc:"#0f172a" -pointsize 90 -fill white -gravity center -annotate +0+0 "K" icon-apple-touch.png
```

Reemplázalos con diseños profesionales lo antes posible.

---

**Generado por:** Claude Sonnet 4.5
**Fecha:** 3 de enero de 2026
**Proyecto:** Kiosco App - Sistema SaaS Multi-Tenant

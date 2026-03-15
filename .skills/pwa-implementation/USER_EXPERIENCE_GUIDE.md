# PWA Installation - User Experience Guide

This guide shows what users will see when they use Kiosco App on Android and iOS.

---

## ANDROID USER EXPERIENCE

### Step 1: Opening the App (First Time)

```
┌─────────────────────────────────┐
│ app-kiosco-chi.vercel.app       │
├─────────────────────────────────┤
│                                 │
│   [Kiosco App Interface]        │
│                                 │
│   • Dashboard                   │
│   • Nueva Venta                 │
│   • Inventario                  │
│                                 │
├─────────────────────────────────┤
│  [Normal app content]           │
│                                 │
│  User sees app, uses normally   │
└─────────────────────────────────┘

→ User is using the app as usual
→ No interruption, no banner yet
```

### Step 2: After 30 Seconds (Auto Install Banner)

```
┌─────────────────────────────────┐
│ app-kiosco-chi.vercel.app       │
├─────────────────────────────────┤
│                                 │
│   [Kiosco App Interface]        │
│                                 │
│   • Dashboard                   │
│   • Nueva Venta                 │
│   • Inventario                  │
│                                 │
├─────────────────────────────────┤
│  [Indigo-Violet Gradient]       │ ← STICKY BANNER
│  📥 Instalar Kiosco App         │
│     Acceso rápido desde ...     │
│                    [✕] [Instalar] │
└─────────────────────────────────┘

Banner appears at bottom
User can:
  • Click "Instalar" → native prompt
  • Click "✕" → dismiss for 30 days
```

### Step 3a: User Clicks "Instalar"

```
┌─────────────────────────────────┐
│ Install Kiosco App?             │ ← Native Chrome Dialog
├─────────────────────────────────┤
│                                 │
│ Kiosco App - Gestión Inteligente│
│                                 │
│ Sistema profesional de gestión  │
│ para kioscos y comercios        │
│ pequeños.                       │
│                                 │
│ [Cancel]  [Install]             │ ← Native buttons
│                                 │
└─────────────────────────────────┘

→ Chrome's native install dialog
→ User confirms
→ App installed to home screen
```

### Step 3b: User Clicks "✕" (Dismiss)

```
Banner closes
Doesn't show again for 30 days
(unless user clears localStorage)

Same as before, but banner gone
```

### Step 4: App Installed on Home Screen

```
┌──────────────────────────────────┐
│ Android Home Screen              │
├──────────────────────────────────┤
│                                  │
│  [Contacts]  [Messages]  [Google]│
│                                  │
│  [Photos]    [Kiosco App] [Maps] │  ← Icon appears here!
│              📦🏪$
│
│  [Settings]  [Play Store]  [+]   │
│                                  │
└──────────────────────────────────┘

Kiosco App now available on home screen
Taps open in standalone mode (full screen, no URL bar)
```

### Step 5: Using Installed App

```
┌─────────────────────────────────┐
│                       ⏰ 09:30   │ ← No URL bar!
├─────────────────────────────────┤
│ 📦 Kiosco App                   │
│                                 │
│   • Dashboard                   │
│   • Nueva Venta                 │
│   • Inventario                  │
│                                 │
│   [Using app as PWA]            │
│                                 │
└─────────────────────────────────┘

Full-screen, no browser chrome
Feels like native app
```

### Step 6: New Version Available (After Deployment)

```
┌─────────────────────────────────┐
│ 📦 Kiosco App                   │
│                                 │
│   • Dashboard                   │
│   • Nueva Venta                 │
│   • Inventario                  │
│                                 │
├─────────────────────────────────┤
│                             ▲   │
│  🔄 Nueva versión disponible  │ ← Toast at bottom
│     Toca actualizar para      │
│     obtener mejoras           │
│            [Actualizar] →→→→→ │
└─────────────────────────────────┘

→ User clicks "Actualizar"
→ Page reloads with latest code
→ Toast disappears
```

---

## iOS USER EXPERIENCE

### Step 1: Opening the App (First Time)

```
Safari on iOS
URL: app-kiosco-chi.vercel.app

┌─────────────────────────────────┐
│ app-kiosco-chi.vercel.app  < | □ │
├─────────────────────────────────┤
│                                 │
│   [Kiosco App Interface]        │
│                                 │
│   • Dashboard                   │
│   • Nueva Venta                 │
│   • Inventario                  │
│                                 │
│  [Normal app content]           │
│                                 │
└─────────────────────────────────┘

→ Safari browser chrome visible
→ No auto-install on iOS
→ User must manually install
```

### Step 2: After 30 Seconds (Manual Instructions)

```
┌─────────────────────────────────┐
│ app-kiosco-chi.vercel.app       │
├─────────────────────────────────┤
│                                 │
│   [Kiosco App Interface]        │
│                                 │
├─────────────────────────────────┤
│ [Indigo-Violet Gradient]        │ ← STICKY BANNER
│ Instalar Kiosco App       [✕]   │
│                                 │
│ Pasos:                          │
│  1. Tocá el botón Compartir     │
│  2. Selecciona "Agregar a ...   │
│  3. Confirma con "Agregar"      │
│                                 │
│ [Mostrar opciones] ↴↴↴          │
└─────────────────────────────────┘

Banner appears with step-by-step guide
User can:
  • Click "Mostrar opciones" → share sheet
  • Click "✕" → dismiss
```

### Step 3a: User Clicks "Mostrar opciones"

```
┌─────────────────────────────────┐
│                                 │ ← Share Sheet Opens
│            [  ]                 │
│         [Copy]                  │
│     [Mail] [Messages]           │
│  [Notes] [Reminders]            │
│                                 │
│  [Save to Files] [Add to ...] ← │
│     ↓
│  [Print] [More...]             │
│                                 │
│  [Cancel]                       │
└─────────────────────────────────┘

Safari share sheet opens
User needs to find "Add to Home Screen"
(Usually in "More..." section)
```

### Step 3b: User Selects "Add to Home Screen"

```
┌─────────────────────────────────┐
│ Add to Home Screen              │
├─────────────────────────────────┤
│                                 │
│ [App Icon] Kiosco App           │
│                                 │
│ Add                             │
│ Kiosco App - Gestión Inteligente│
│                                 │
│ [Cancel]  [Add] ←→ User taps    │
│                                 │
└─────────────────────────────────┘

Simple dialog with pre-filled name
User confirms
```

### Step 4: App Installed on Home Screen

```
┌──────────────────────────────────┐
│ iOS Home Screen                  │
├──────────────────────────────────┤
│                                  │
│  [Slack]  [Instagram]  [Kiosco] │ ← Icon appears here!
│           [App]        📦🏪$
│
│  [Settings] [Maps] [Calendar]   │
│                                  │
│ Edit Home Screen                 │
│ Add Home Screen                  │
│                                  │
└──────────────────────────────────┘

Kiosco App now on home screen
Full icon with label
```

### Step 5: Using Installed App

```
┌─────────────────────────────────┐
│  ⏰ 09:30  ▓▓  🔋100%           │ ← Status bar only
├─────────────────────────────────┤
│ Kiosco App                      │
│                                 │
│   • Dashboard                   │
│   • Nueva Venta                 │
│   • Inventario                  │
│                                 │
│   [Using app as PWA]            │
│                                 │
│                                 │
└─────────────────────────────────┘

Full-screen, no Safari chrome
Feels like native app
Status bar shows time/battery only
Home indicator at bottom (iPhone X+)
```

### Step 6: User Clicks "✕" (Dismiss)

```
Banner closes
Doesn't show again for 30 days

Same experience as before
But no install instructions visible
```

### Step 7: New Version Available

```
Same as Android Step 6:

┌─────────────────────────────────┐
│ Kiosco App                      │
│                                 │
│   • Dashboard                   │
│   • Nueva Venta                 │
│   • Inventario                  │
│                                 │
├─────────────────────────────────┤
│                             ▲   │
│  🔄 Nueva versión disponible  │ ← Toast
│     Toca actualizar para      │
│     obtener mejoras           │
│            [Actualizar]       │
└─────────────────────────────────┘

→ User clicks "Actualizar"
→ App reloads with latest version
→ Toast disappears
```

---

## DESKTOP USER EXPERIENCE (Chrome)

### Step 1: Using Chrome Browser

```
Chrome on Desktop
https://app-kiosco-chi.vercel.app

┌─────────────────────────────────────────────┐
│ <  >  🔄  https://app-kiosco-chi.vercel.app │
├─────────────────────────────────────────────┤
│                                             │
│   [Kiosco App Interface]                    │
│                                             │
│   • Dashboard                               │
│   • Nueva Venta                             │
│   • Inventario                              │
│                                             │
│                                             │
│                                             │
│                                             │
└─────────────────────────────────────────────┘

→ Full browser chrome visible
→ Works in browser normally
→ Install option available
```

### Step 2: Install Option

```
Chrome address bar shows:
📍 app-kiosco-chi.vercel.app  [+] [☆]

Click [+] to install
↓
Same as Android dialog:
[Cancel] [Install Kiosco App]
```

### Step 3: Installed as App

```
Separate app window:

┌─────────────────────────────┐
│ 🏪 Kiosco App               │ ← Window title
├─────────────────────────────┤
│                             │
│   [Kiosco App Interface]    │
│                             │
│   • Dashboard               │
│   • Nueva Venta             │
│   • Inventario              │
│                             │
│                             │
└─────────────────────────────┘

Runs in standalone mode
No address bar, no tabs
Appears in taskbar as separate app
```

---

## COMPARISON: BEFORE vs AFTER

### BEFORE (Without PWA Install)

```
User discovers Kiosco App
    ↓
Opens in Safari/Chrome
    ↓
Uses web interface
    ↓
Every time: new tab, new browser session
    ↓
No home screen shortcut
    ↓
Less engagement
```

### AFTER (With PWA Install)

```
User discovers Kiosco App
    ↓
Opens in Safari/Chrome (30s)
    ↓
Install banner appears
    ↓
One-click install (Android) or
Follow 3 steps (iOS)
    ↓
App on home screen
    ↓
Opens from home screen
    ↓
Full-screen app experience
    ↓
Higher engagement
    ↓
Automatic updates
```

---

## VISUAL ELEMENTS

### Install Banner (Android)

```
Color: Indigo (primary) → Violet (accent)
Height: ~60-80px (mobile optimized)
Position: Sticky at bottom (safe area)
Dismissible: ✕ button (left side)
Action: "Instalar" button (right side)
Icons: 📥 Download icon (left)
Text: Bold title + secondary text
```

### Install Banner (iOS)

```
Color: Same indigo → violet gradient
Height: ~120-160px (more space for instructions)
Position: Sticky at bottom
Dismissible: ✕ button (top right)
Content: 3 numbered steps
Action: "Mostrar opciones" button (bottom)
Icons: None (text-only for clarity)
Text: Clear, numbered instructions
```

### Update Toast

```
Color: Emerald (positive) → Teal (accent)
Height: ~60-80px
Position: Fixed at bottom-right corner
Timeout: 10 seconds (auto-dismiss)
Action: "Actualizar" button
Icon: 🔄 Spinning refresh icon
Text: Bold title + secondary text
Animation: Slide in from bottom
```

---

## INTERACTION PATTERNS

### Install Banner

- **Initial state**: Hidden
- **Trigger**: 30 seconds after page load
- **Show condition**: `canInstall && !isInstalled && !isDismissed`
- **User action**: Click button OR dismiss
- **Result**: Open prompt OR hide for 30 days

### Update Toast

- **Initial state**: Hidden
- **Trigger**: Service Worker `updatefound` event
- **Show condition**: New SW version available
- **User action**: Click "Actualizar" OR wait 10s
- **Result**: Reload with new code OR auto-dismiss

---

## ACCESSIBILITY

### Screen Reader Support

**Install Banner:**
- Role: `banner` or `region`
- Label: "Instalar Kiosco App"
- Button labels: "Instalar", "Cerrar"

**Update Toast:**
- Role: `alert`
- Live region: `aria-live="polite"`
- Button label: "Actualizar"

### Keyboard Navigation

- Tab to navigate buttons
- Enter/Space to activate
- Dismiss with Escape key (optional)

### Color Contrast

- Banner text: White on indigo (#0f172a) ✓ WCAG AAA
- Button text: High contrast colors
- Toast text: White on emerald ✓ WCAG AAA

---

## USER FLOW SUMMARY

### Android User Journey

```
Day 1: First visit
  → App opens
  → Wait 30s
  → See install banner
  → Click "Instalar"
  → Confirm in native dialog
  → App added to home screen ✓

Day 2+: Returning
  → Open from home screen
  → Full-screen experience
  → Bookmark-like experience
```

### iOS User Journey

```
Day 1: First visit
  → App opens in Safari
  → Wait 30s
  → See install instructions
  → Tap "Mostrar opciones"
  → Share sheet opens
  → Select "Add to Home Screen"
  → Confirm ✓

Day 2+: Returning
  → Open from home screen
  → Full-screen experience
  → App-like behavior
```

### Update Journey (Both Platforms)

```
Day X: New version deployed
  → Next time user opens app
  → SW update detected
  → Toast appears: "Nueva versión"
  → User clicks "Actualizar"
  → Page reloads
  → Using new version ✓
```

---

## SUCCESS METRICS

### Installation

- % of users who see banner
- % of users who click "Install"
- % of users who confirm in native dialog
- Conversion rate (visits → installed)

### Updates

- % of users who see update notification
- % of users who click "Actualizar"
- Time to adoption of new version
- User retention after update

### Usage

- Session duration (before/after install)
- Returning user rate
- Feature usage (if PWA-specific features added)
- Home screen icon usage

---

## TROUBLESHOOTING FOR USERS

### "I don't see the install prompt"

1. ✓ Check if already installed
2. ✓ Wait 30 seconds
3. ✓ Refresh the page
4. ✓ Check browser version (Chrome 34+, Safari on iOS, etc.)

### "I accidentally dismissed the prompt"

1. Open Settings → Apps → Kiosco App → Clear cache
2. Or: Open Settings → Safari → Clear cache
3. Reload page
4. Prompt should appear again

### "My app shows old version"

1. Click "Actualizar" in toast notification
2. Or: Close app and reopen
3. Or: Check for updates: Settings → App → About

---

## CONCLUSION

The PWA installation experience is designed to:

✓ **Be non-intrusive**: Doesn't interrupt on first load
✓ **Respect user choice**: Easy to dismiss or install
✓ **Work across platforms**: Android native + iOS manual
✓ **Feel native**: Full-screen, home screen icon
✓ **Update seamlessly**: Zero-downtime updates
✓ **Increase engagement**: Higher returning user rate

**Result**: Professional app experience that drives user engagement and retention.

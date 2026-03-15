# PWA Implementation - Kiosco App

## Overview

This directory contains the complete PWA (Progressive Web App) implementation for Kiosco App, including polished installation and update prompts.

## Components

### 1. **InstallPrompt** (`components/pwa/install-prompt.tsx`)

Smart installation banner that adapts to platform:

**Android:**
- Shows native Chrome install prompt
- Sticky footer banner with "Instalar" button
- Dismissible for 30 days
- Appears after 30 seconds of app usage

**iOS:**
- Manual instructions (Share → Add to Home Screen)
- Informative banner with step-by-step guide
- Share button to trigger native share sheet
- Dismissible

**Features:**
- Automatically hides if already installed
- Respects user dismissal (localStorage: `kiosco-pwa-install-dismissed`)
- Configurable show delay and position
- Mobile-first design with proper safe areas
- sonner toast notifications for feedback

### 2. **UpdatePrompt** (`components/pwa/update-prompt.tsx`)

Notifies users when a new version of the Service Worker is available.

**Features:**
- Listens to Service Worker `updatefound` events
- Shows non-intrusive notification with "Actualizar" button
- Triggers `SKIP_WAITING` message to activate new SW
- Auto-dismisses after 10 seconds
- Auto-reloads page when new SW becomes active
- Emerald/teal color scheme for positive action

### 3. **usePWAInstall Hook** (`hooks/use-pwa-install.ts`)

Reusable hook for PWA installation logic:

```typescript
const { canInstall, isInstalled, isIOS, isDismissed, installApp, dismissPrompt } =
  usePWAInstall()
```

**Returns:**
- `canInstall: boolean` — beforeinstallprompt event available
- `isInstalled: boolean` — Running in standalone/installed mode
- `isIOS: boolean` — iOS device detected
- `isDismissed: boolean` — User previously dismissed prompt
- `installApp()` — Trigger install prompt and handle user choice
- `dismissPrompt()` — Mark as dismissed (persists to localStorage)

## Integration

### In Root Layout

Components are already integrated in `app/layout.tsx`:

```tsx
<PWAProvider showConnectionStatus={true} connectionStatusPosition="top">
  {children}
  <InstallPrompt position="bottom" showDelay={30000} />
  <UpdatePrompt autoDismissDelay={10000} />
</PWAProvider>
```

**Props:**
- `InstallPrompt.position`: "bottom" (default) or "inline"
- `InstallPrompt.showDelay`: ms before showing (default: 30000)
- `UpdatePrompt.autoDismissDelay`: ms before auto-dismiss (default: 10000)

### For Protected Routes

If you want to show install prompt only to authenticated users, move it inside a client component that checks auth:

```tsx
// components/pwa/protected-install-prompt.tsx
'use client'

import { useAuth } from '@/hooks/use-auth'
import { InstallPrompt } from '@/components/pwa'

export function ProtectedInstallPrompt() {
  const { user } = useAuth()
  if (!user) return null
  return <InstallPrompt position="bottom" showDelay={30000} />
}
```

## Service Worker Integration

The Service Worker already supports the required messages:

### SKIP_WAITING

When user clicks "Actualizar", `UpdatePrompt` sends:

```javascript
registration.waiting.postMessage({ type: 'SKIP_WAITING' })
```

The SW (`public/sw.js`) handles this at line 697:

```javascript
case 'SKIP_WAITING':
  self.skipWaiting()
  break
```

This activates the new SW immediately instead of waiting for all clients to close.

## Apple Touch Icon

### Current Setup

`manifest.json` now includes both SVG and PNG options:

```json
{
  "src": "/icon.svg",
  "type": "image/svg+xml"
},
{
  "src": "/apple-touch-icon.png",
  "type": "image/png"
}
```

### Generation Script

Script: `scripts/generate-apple-touch-icon.js`

**To generate PNG (iOS < 15 compatibility):**

```bash
npm install -D sharp
node scripts/generate-apple-touch-icon.js
```

This creates `/public/apple-touch-icon.png` (180x180).

**Note:** iOS 15+ natively supports SVG in apple-touch-icon, so the PNG is optional for modern devices.

## Manifest Configuration

Updated `/public/manifest.json` includes:

- ✓ App name: "Kiosco App - Gestión Inteligente"
- ✓ Short name: "Kiosco App"
- ✓ Display: standalone
- ✓ Theme color: #0f172a (dark slate)
- ✓ SVG icons (192, 512, maskable)
- ✓ PNG icon for apple-touch-icon (180)
- ✓ Shortcuts for quick actions (Nueva Venta, Stock, Dashboard)
- ✓ Dark theme colors

## Data Persistence

### Install Dismissal

Uses browser `localStorage` with key: `kiosco-pwa-install-dismissed`

```typescript
// Set
localStorage.setItem('kiosco-pwa-install-dismissed', 'true')

// Get
const isDismissed = localStorage.getItem('kiosco-pwa-install-dismissed') === 'true'

// Clear (when app is installed)
localStorage.removeItem('kiosco-pwa-install-dismissed')
```

## Colors & Styling

### Theme Colors

- **Install Banner (Android):** Indigo → Violet gradient (`from-indigo-600 to-violet-600`)
- **Install Banner (iOS):** Same indigo/violet gradient
- **Update Toast:** Emerald → Teal gradient (`from-emerald-600 to-teal-600`)
- **Buttons:** Indigo-600, white text (contrast)

These match the app's design system from `shadcn/ui` + Tailwind.

### Safe Areas

Components respect iOS safe areas with `safe-bottom` class for notch/home indicator clearance.

## Testing

### On Desktop (Chrome)

1. Open DevTools → Application → Manifest
2. Should show "Install app" option
3. Verify manifest.json loads correctly
4. Check icons display in manifest viewer

### On Android

1. Install/add to home screen via Chrome menu
2. Install prompt should appear after ~30s
3. Click "Instalar" and confirm
4. App should appear on home screen
5. Test opening: should show `display-mode: standalone`

### On iOS

1. Open Safari
2. Share button → "Add to Home Screen"
3. Manual instructions should appear in app
4. Verify app appears on home screen
5. Test opening: should show `navigator.standalone === true`

### Service Worker Update

1. Deploy new version with SW changes
2. Refresh page in app
3. "Nueva versión disponible" toast should appear
4. Click "Actualizar" → page reloads with new SW
5. Verify updated code/assets are loaded

## Browser Support

| Feature | Chrome | Safari | Firefox | Edge |
|---------|--------|--------|---------|------|
| Install Prompt | ✓ (34+) | Manual iOS | ✗ | ✓ (79+) |
| Standalone | ✓ | ✓ (iOS 15.1+) | ✗ | ✓ |
| Service Worker | ✓ (40+) | ✓ (11.1+) | ✓ (44+) | ✓ (17+) |
| Web App Icons | ✓ | ✓ (iOS 15+) | ✓ | ✓ |

## Troubleshooting

### Install Prompt Not Showing

1. **Check criteria met:**
   - ✓ HTTPS (Vercel automatic)
   - ✓ Valid manifest.json
   - ✓ Service Worker registered
   - ✓ Not already installed
   - ✓ User hasn't dismissed it

2. **Debug in Chrome DevTools:**
   ```javascript
   // Check if SW is ready
   navigator.serviceWorker.ready.then(reg => console.log('SW ready:', reg))

   // Check manifest
   fetch('/manifest.json').then(r => r.json()).then(console.log)

   // Simulate beforeinstallprompt event
   // (in console, after 30s):
   // localStorage.removeItem('kiosco-pwa-install-dismissed')
   // location.reload()
   ```

### Update Prompt Not Showing

1. **Ensure SW message handler is present:**
   ```javascript
   // In public/sw.js
   case 'SKIP_WAITING':
     self.skipWaiting()
     break
   ```

2. **Check for SW updates:**
   ```javascript
   navigator.serviceWorker.ready.then(reg => {
     reg.addEventListener('updatefound', () => {
       console.log('Update found!')
     })
   })
   ```

3. **Test with manual check:**
   ```javascript
   navigator.serviceWorker.getRegistrations().then(regs => {
     regs.forEach(reg => reg.update())
   })
   ```

### Icons Not Displaying

1. **SVG Support:**
   - Ensure `/public/icon.svg` exists and is valid
   - Test: Open directly in browser

2. **PNG Fallback:**
   - Generate: `npm install -D sharp && node scripts/generate-apple-touch-icon.js`
   - Verify `/public/apple-touch-icon.png` exists

3. **Manifest icons array:**
   - Check `/public/manifest.json` icons are listed
   - Verify sizes and types are correct

## Related Files

- `/app/layout.tsx` — Root layout with PWA components
- `/components/pwa/pwa-provider.tsx` — PWA context and SW registration
- `/components/pwa/connection-status.tsx` — Online/offline indicator
- `/public/manifest.json` — Web app manifest
- `/public/sw.js` — Service Worker with caching strategies
- `/public/offline.html` — Offline fallback page
- `/next.config.ts` — PWA configuration via @ducanh2912/next-pwa

## Future Enhancements

1. **Periodic SW updates**: Check for updates every 30min
2. **Install analytics**: Track install success rate
3. **Notification permissions**: Ask for push notifications on install
4. **Offline pages**: Offline-specific UI for sync status
5. **Biometric unlock**: Face/fingerprint unlock on installed app (iOS 16+)

## References

- [MDN: Web App Manifests](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Web.dev: Install Prompt](https://web.dev/customize-install/)
- [Apple: Web App Configuration](https://developer.apple.com/library/archive/documentation/AppleWebApps/Reference/SafariWebContent/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

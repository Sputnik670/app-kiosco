# PWA Installation - Quick Start

## What Was Implemented

✓ **Install Prompt** — Smart banner for Android + manual instructions for iOS
✓ **Update Notification** — Toast when new app version is available
✓ **usePWAInstall Hook** — Reusable logic for custom implementations
✓ **Icon Setup** — SVG icons + PNG fallback for iOS
✓ **Documentation** — Complete guides for all use cases

## How It Works

### For Users

**Android:**
1. User opens app
2. After 30 seconds, "Instalar Kiosco App" banner appears
3. Click "Instalar" to add app to home screen
4. App runs in standalone mode (full screen, like native app)

**iOS:**
1. User opens app in Safari
2. After 30 seconds, install instructions appear
3. User taps Share → "Add to Home Screen"
4. App appears on home screen and runs in standalone mode

**Updates:**
1. New version deployed to Vercel
2. "Nueva versión disponible" toast appears
3. User clicks "Actualizar" → page refreshes with latest code

### For Developers

Everything is **automatic** and **zero-config**:

```tsx
// In app/layout.tsx
<PWAProvider>
  {children}
  <InstallPrompt position="bottom" showDelay={30000} />
  <UpdatePrompt autoDismissDelay={10000} />
</PWAProvider>
```

That's it. The components handle everything:
- Detecting platform (iOS vs Android)
- Showing/hiding based on state
- Persisting user preferences
- Handling Service Worker updates

## Files Changed/Created

### New Files
```
hooks/use-pwa-install.ts                    — Install prompt hook
components/pwa/install-prompt.tsx           — Install banner/instructions
components/pwa/update-prompt.tsx            — Update notification toast
scripts/generate-apple-touch-icon.js        — PNG icon generator
.skills/pwa-implementation/README.md        — Full documentation
.skills/pwa-implementation/USAGE_EXAMPLES.md — Code examples
.skills/pwa-implementation/QUICKSTART.md    — This file
```

### Updated Files
```
app/layout.tsx              — Added InstallPrompt & UpdatePrompt
components/pwa/index.ts     — Exported new components
public/manifest.json        — Added PNG icon entry
```

## Customization

### Show Install Prompt Only to Authenticated Users

```tsx
// components/pwa/authenticated-install.tsx
'use client'
import { useAuth } from '@/hooks/use-auth'
import { InstallPrompt } from '@/components/pwa'

export function ProtectedInstallPrompt() {
  const { user } = useAuth()
  if (!user) return null
  return <InstallPrompt />
}
```

Then in `app/layout.tsx`:
```tsx
<PWAProvider>
  {children}
  <ProtectedInstallPrompt />  {/* Instead of InstallPrompt */}
  <UpdatePrompt />
</PWAProvider>
```

### Change Timing

```tsx
{/* Faster: 10 seconds instead of 30 */}
<InstallPrompt position="bottom" showDelay={10000} />

{/* No auto-dismiss on update */}
<UpdatePrompt autoDismissDelay={Infinity} />
```

### Use Hook Directly

```tsx
'use client'
import { usePWAInstall } from '@/hooks/use-pwa-install'

export function MyComponent() {
  const { isInstalled, canInstall, isIOS, installApp } = usePWAInstall()

  if (isInstalled) return <p>Thanks for installing! ✓</p>
  if (!canInstall) return null

  return (
    <button onClick={() => installApp()}>
      {isIOS ? 'Show Steps' : 'Install'}
    </button>
  )
}
```

## Testing

### On Android

1. Open app in Chrome
2. Wait 30 seconds
3. "Instalar Kiosco App" banner appears
4. Click "Instalar"
5. App appears on home screen

### On iOS

1. Open app in Safari
2. Wait 30 seconds
3. Instructions banner appears
4. Tap Share → "Add to Home Screen"
5. App appears on home screen

### Test Update Notification

```javascript
// In browser console:
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.update())
})

// Should see "Nueva versión disponible" toast after a few seconds
```

### Clear Dismissed State

```javascript
// In browser console (to re-show install prompt):
localStorage.removeItem('kiosco-pwa-install-dismissed')
location.reload()
```

## Analytics

### Track Install Success

```tsx
<InstallPrompt
  onInstallSuccess={() => {
    console.log('Installation successful')
    // Send to analytics, redirect, etc.
  }}
/>
```

### Track Update Completion

```tsx
<UpdatePrompt
  onUpdate={() => {
    console.log('App updated to latest version')
  }}
/>
```

## Icon Generation

### Use Existing SVG (Current)

No action needed. Uses `/public/icon.svg` in manifest.

### Generate PNG Fallback (Optional)

For iOS < 15 compatibility:

```bash
npm install -D sharp
node scripts/generate-apple-touch-icon.js
```

Creates `/public/apple-touch-icon.png` (180x180).

## Browser Support

| Browser | Install | Updates | Offline |
|---------|---------|---------|---------|
| Chrome Android | ✓ | ✓ | ✓ |
| Safari iOS | Manual | ✓ | ✓ |
| Firefox Android | ✗ (manual) | ✓ | ✓ |
| Chrome Desktop | ✓ | ✓ | ✓ |
| Safari macOS | ✗ | ✓ | ✓ |

## Troubleshooting

### Install Prompt Not Showing

1. Check HTTPS: ✓ (Vercel automatic)
2. Check manifest: `curl https://app-kiosco-chi.vercel.app/manifest.json`
3. Clear cache: `localStorage.removeItem('kiosco-pwa-install-dismissed')`
4. Reload page and wait 30 seconds

### Icons Look Blurry

Generate PNG fallback:
```bash
npm install -D sharp
node scripts/generate-apple-touch-icon.js
```

### Update Prompt Not Working

1. Change `public/sw.js` (any change)
2. Deploy to Vercel
3. Manually check: `navigator.serviceWorker.getRegistrations().then(r => r[0].update())`

## Related Docs

- **Full Docs:** `.skills/pwa-implementation/README.md`
- **Code Examples:** `.skills/pwa-implementation/USAGE_EXAMPLES.md`
- **Project Instructions:** `CLAUDE.md` (this codebase)

## Next Steps (Optional)

1. **Analytics** — Track install/update success rates
2. **Biometric** — Ask for face/fingerprint on install (iOS 16+)
3. **Notifications** — Push notifications on install
4. **Offline Pages** — Better offline UI
5. **Periodic Sync** — Sync data in background

For any of these, see `.skills/pwa-implementation/README.md` → "Future Enhancements"

---

**Questions?** Check the full documentation or existing code in `/components/pwa/` and `/hooks/use-pwa-install.ts`.

**Ready to test?** Deploy to main → automatic Vercel deployment → test on real devices.

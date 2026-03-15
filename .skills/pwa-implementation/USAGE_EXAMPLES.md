# PWA Implementation - Usage Examples

## Basic Usage (Already Integrated)

The PWA components are automatically integrated in the root layout:

```tsx
// app/layout.tsx
<PWAProvider showConnectionStatus={true} connectionStatusPosition="top">
  {children}
  <InstallPrompt position="bottom" showDelay={30000} />
  <UpdatePrompt autoDismissDelay={10000} />
</PWAProvider>
```

This is already set up and working. No additional configuration needed.

---

## Using the Hook Directly

If you need to access PWA installation state in your own component:

### Basic Hook Usage

```tsx
'use client'

import { usePWAInstall } from '@/hooks/use-pwa-install'
import { Button } from '@/components/ui/button'

export function MyInstallButton() {
  const { canInstall, isInstalled, isIOS, installApp } = usePWAInstall()

  if (isInstalled) {
    return <p>App already installed ✓</p>
  }

  if (!canInstall) {
    return null // Install not available
  }

  const handleClick = async () => {
    const success = await installApp()
    if (success) {
      console.log('Installation successful!')
    }
  }

  return (
    <Button onClick={handleClick}>
      {isIOS ? 'Show Install Steps' : 'Install App'}
    </Button>
  )
}
```

### Checking Installation Status

```tsx
'use client'

import { usePWAInstall } from '@/hooks/use-pwa-install'

export function InstallStatus() {
  const { isInstalled, isIOS, canInstall, isDismissed } = usePWAInstall()

  return (
    <div>
      <p>Installed: {isInstalled ? '✓' : '✗'}</p>
      <p>Can Install: {canInstall ? '✓' : '✗'}</p>
      <p>iOS: {isIOS ? 'Yes' : 'No'}</p>
      <p>Dismissed: {isDismissed ? 'Yes' : 'No'}</p>
    </div>
  )
}
```

### Custom Install UI

```tsx
'use client'

import { usePWAInstall } from '@/hooks/use-pwa-install'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

export function CustomInstallCard() {
  const { canInstall, isInstalled, installApp, dismissPrompt } = usePWAInstall()

  if (!canInstall || isInstalled) return null

  return (
    <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-lg">
      <div className="flex items-center gap-3 mb-4">
        <Download className="w-6 h-6" />
        <h3 className="font-bold">Install Kiosco App</h3>
      </div>

      <p className="text-sm mb-4 opacity-90">
        Get instant access from your home screen
      </p>

      <div className="flex gap-2">
        <Button
          onClick={() => installApp()}
          className="flex-1 bg-white text-blue-600 hover:bg-gray-100"
        >
          Install
        </Button>
        <Button
          onClick={() => dismissPrompt()}
          variant="outline"
          className="text-white border-white hover:bg-white hover:text-blue-600"
        >
          Skip
        </Button>
      </div>
    </div>
  )
}
```

---

## Showing Install Prompt for Authenticated Users Only

```tsx
'use client'

import { useAuth } from '@/hooks/use-auth'
import { InstallPrompt } from '@/components/pwa'

export function AuthenticatedInstallPrompt() {
  const session = useAuth()

  // Only show to logged-in users
  if (!session?.user) {
    return null
  }

  return <InstallPrompt position="bottom" showDelay={30000} />
}
```

Then use in layout:

```tsx
// app/layout.tsx
<PWAProvider>
  {children}
  <AuthenticatedInstallPrompt />
  <UpdatePrompt />
</PWAProvider>
```

---

## Customizing the InstallPrompt Component

### Change Position and Delay

```tsx
// Show at top instead of bottom
<InstallPrompt position="bottom" showDelay={5000} />

// Or inline (not fixed)
<InstallPrompt position="inline" showDelay={10000} />
```

### Handle Installation Success

```tsx
<InstallPrompt
  position="bottom"
  showDelay={30000}
  onInstallSuccess={() => {
    console.log('App installed successfully')
    // Navigate, show celebration, etc.
  }}
/>
```

### Custom Callback Example

```tsx
'use client'

import { InstallPrompt } from '@/components/pwa'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function SmartInstallPrompt() {
  const router = useRouter()

  return (
    <InstallPrompt
      position="bottom"
      showDelay={30000}
      onInstallSuccess={() => {
        toast.success('Bienvenido a Kiosco App instalado!')
        // Optionally navigate to a specific page
        // router.push('/dashboard')
      }}
    />
  )
}
```

---

## Customizing the UpdatePrompt Component

### Change Auto-Dismiss Delay

```tsx
// Don't auto-dismiss (user must click)
<UpdatePrompt autoDismissDelay={Infinity} />

// Dismiss faster (5 seconds)
<UpdatePrompt autoDismissDelay={5000} />
```

### Handle Update Completion

```tsx
<UpdatePrompt
  autoDismissDelay={10000}
  onUpdate={() => {
    console.log('App updated to latest version')
    // Could track in analytics, show celebration, etc.
  }}
/>
```

---

## Advanced: Manual Service Worker Update Check

If you want to check for updates on a schedule or button click:

```tsx
'use client'

import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

export function ManualUpdateCheck() {
  const checkForUpdates = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      await registration.update()
      console.log('Checked for SW updates')
    } catch (error) {
      console.error('Error checking for updates:', error)
    }
  }, [])

  return (
    <Button onClick={checkForUpdates} variant="outline">
      <RefreshCw className="w-4 h-4 mr-2" />
      Check for Updates
    </Button>
  )
}
```

---

## Testing the Install Prompt

### Simulate on Desktop (Chrome)

```javascript
// In Chrome DevTools Console:

// 1. Clear dismissed state
localStorage.removeItem('kiosco-pwa-install-dismissed')

// 2. Reload
location.reload()

// Install prompt should appear after 30 seconds (or sooner if you modify showDelay)
```

### Manual Trigger

```javascript
// Force show even if dismissed
localStorage.removeItem('kiosco-pwa-install-dismissed')

// Simulate the event (Chrome will show native prompt)
window.dispatchEvent(new Event('beforeinstallprompt'))
```

### Check Installation Status

```javascript
// Is installed (standalone mode)?
console.log(window.matchMedia('(display-mode: standalone)').matches)

// Service Worker ready?
navigator.serviceWorker.ready.then(reg => {
  console.log('SW ready:', reg.scope)
})

// Manifest loaded?
fetch('/manifest.json')
  .then(r => r.json())
  .then(m => console.log('Manifest:', m))
```

---

## Testing Service Worker Updates

### Simulate Update on Local Dev

1. **Make a change to `public/sw.js`**
   ```javascript
   // Change the SW_VERSION
   const SW_VERSION = '4.2.0'  // was 4.1.0
   ```

2. **Rebuild and reload**
   ```bash
   npm run build
   npm run dev
   ```

3. **In browser, manually check for updates:**
   ```javascript
   navigator.serviceWorker.getRegistrations().then(regs => {
     regs.forEach(reg => reg.update())
   })
   ```

4. **Look for "Nueva versión disponible" toast**

### In Production (Vercel)

1. **Deploy new version**
   - Push to `main` → automatic Vercel deployment

2. **Check for updates automatically**
   - Browser periodically checks for SW updates
   - Or user manually refreshes page

3. **Update prompt should appear** if new SW is available

---

## Analytics & Tracking

### Track Install Success

```tsx
'use client'

import { InstallPrompt } from '@/components/pwa'
import { trackEvent } from '@/lib/analytics'

export function TrackedInstallPrompt() {
  return (
    <InstallPrompt
      onInstallSuccess={() => {
        trackEvent('pwa_install_success', {
          timestamp: new Date().toISOString(),
        })
      }}
    />
  )
}
```

### Track Dismissals

```tsx
'use client'

import { usePWAInstall } from '@/hooks/use-pwa-install'
import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics'

export function DismissalTracker() {
  const { isDismissed } = usePWAInstall()

  useEffect(() => {
    if (isDismissed) {
      trackEvent('pwa_install_dismissed', {
        timestamp: new Date().toISOString(),
      })
    }
  }, [isDismissed])

  return null
}
```

---

## Troubleshooting Custom Implementation

### "canInstall is always false"

Check:
1. ✓ Running on HTTPS (https://app-kiosco-chi.vercel.app)
2. ✓ Valid manifest.json
3. ✓ Service Worker is active
4. ✓ App not already installed

### "Update prompt never shows"

Check:
1. ✓ Service Worker file (`public/sw.js`) has changed
2. ✓ SKIP_WAITING message handler exists in SW
3. ✓ Browser is checking for SW updates (automatic or manual)

### "Icons not displaying on home screen"

Check:
1. ✓ `manifest.json` has icon entries
2. ✓ Icon files exist and are accessible
3. ✓ Generate PNG: `node scripts/generate-apple-touch-icon.js`

---

## Best Practices

1. **Don't be too aggressive with the install prompt**
   - Default 30s delay is good
   - Dismiss means "don't show for 30 days"
   - Respect user choice

2. **Make update prominent but not intrusive**
   - Toast notification is good
   - Auto-dismiss helps
   - Some users may be busy

3. **Test on real devices**
   - Desktop Chrome is different from Android
   - iOS requires Safari (different flow)
   - Test on actual phones when possible

4. **Monitor usage**
   - Track install success rate
   - Monitor update adoption
   - Use analytics to improve UX

5. **Keep manifest updated**
   - Icons should match brand
   - Colors should match theme
   - Shortcuts should match app features

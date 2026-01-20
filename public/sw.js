/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔧 SERVICE WORKER - KIOSCO APP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Versión: 2.0.0
 * Estrategias de caché:
 * - Stale-While-Revalidate: Activos estáticos (fuentes, iconos, CSS, JS)
 * - Network First: Páginas y datos dinámicos
 * - Network Only: API de Supabase
 *
 * Nota: @ducanh2912/next-pwa genera este archivo en producción.
 * Este archivo sirve como fallback y para desarrollo.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const SW_VERSION = '2.0.0';
const STATIC_CACHE = 'kiosco-static-v2';
const DYNAMIC_CACHE = 'kiosco-dynamic-v2';
const FONTS_CACHE = 'kiosco-fonts-v2';

// Archivos a precachear
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/offline.html',
];

// Patrones de URL para estrategias de caché
const STATIC_PATTERNS = [
  /\.(?:js|css|woff2?|ttf|eot)$/i,
  /\.(?:png|jpg|jpeg|gif|svg|ico|webp)$/i,
];

const FONT_PATTERNS = [
  /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
];

const IGNORE_PATTERNS = [
  /\.supabase\.co/i,
  /vercel/i,
  /analytics/i,
  /_next\/webpack-hmr/i,
];

// ───────────────────────────────────────────────────────────────────────────────
// INSTALACIÓN
// ───────────────────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  console.log(`[SW ${SW_VERSION}] Instalando...`);

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Precacheando activos críticos');
        return Promise.allSettled(
          PRECACHE_ASSETS.map(url =>
            cache.add(url).catch(err => {
              console.warn(`[SW] Error cacheando ${url}:`, err.message);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ───────────────────────────────────────────────────────────────────────────────
// ACTIVACIÓN
// ───────────────────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  console.log(`[SW ${SW_VERSION}] Activando...`);

  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, FONTS_CACHE];

  event.waitUntil(
    caches.keys()
      .then(cacheNames =>
        Promise.all(
          cacheNames
            .filter(name => !currentCaches.includes(name))
            .map(name => {
              console.log('[SW] Eliminando caché obsoleto:', name);
              return caches.delete(name);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ───────────────────────────────────────────────────────────────────────────────
// ESTRATEGIA DE FETCH
// ───────────────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar peticiones que no debemos cachear
  if (IGNORE_PATTERNS.some(pattern => pattern.test(url.href))) {
    return;
  }

  // Solo manejar peticiones GET
  if (request.method !== 'GET') {
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STALE-WHILE-REVALIDATE: Fuentes de Google
  // ─────────────────────────────────────────────────────────────────────────────
  if (FONT_PATTERNS.some(pattern => pattern.test(url.href))) {
    event.respondWith(staleWhileRevalidate(request, FONTS_CACHE));
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STALE-WHILE-REVALIDATE: Activos estáticos
  // ─────────────────────────────────────────────────────────────────────────────
  if (STATIC_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // NETWORK FIRST: Páginas y datos dinámicos
  // ─────────────────────────────────────────────────────────────────────────────
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

// ───────────────────────────────────────────────────────────────────────────────
// ESTRATEGIAS DE CACHÉ
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Stale-While-Revalidate: Devuelve caché inmediatamente mientras actualiza
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  // Fetch en paralelo para actualizar caché
  const fetchPromise = fetch(request)
    .then(response => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Devolver caché si existe, sino esperar fetch
  return cachedResponse || fetchPromise;
}

/**
 * Network First: Intenta red primero, fallback a caché
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request, {
      timeout: 10000 // 10 segundos timeout
    });

    // Cachear respuesta exitosa
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Fallback a caché
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      console.log('[SW] Sirviendo desde caché:', request.url);
      return cachedResponse;
    }

    // Si es navegación y no hay caché, mostrar offline.html
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline.html');
      if (offlinePage) {
        return offlinePage;
      }
    }

    throw error;
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// SINCRONIZACIÓN EN SEGUNDO PLANO
// ───────────────────────────────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  console.log('[SW] Evento sync:', event.tag);

  if (event.tag === 'sync-ventas') {
    event.waitUntil(syncVentasPendientes());
  }

  if (event.tag === 'sync-asistencia') {
    event.waitUntil(syncAsistenciaPendiente());
  }
});

/**
 * Sincroniza ventas guardadas en IndexedDB cuando hay conexión
 */
async function syncVentasPendientes() {
  console.log('[SW] Sincronizando ventas pendientes...');

  try {
    // Abrir IndexedDB
    const db = await openDB('kiosco-offline', 1);
    const tx = db.transaction('ventas-pendientes', 'readonly');
    const store = tx.objectStore('ventas-pendientes');
    const ventas = await store.getAll();

    if (ventas.length === 0) {
      console.log('[SW] No hay ventas pendientes');
      return;
    }

    console.log(`[SW] Sincronizando ${ventas.length} ventas...`);

    // Enviar cada venta al servidor
    for (const venta of ventas) {
      try {
        const response = await fetch('/api/ventas/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(venta),
        });

        if (response.ok) {
          // Eliminar venta sincronizada
          const deleteTx = db.transaction('ventas-pendientes', 'readwrite');
          await deleteTx.objectStore('ventas-pendientes').delete(venta.id);
        }
      } catch (err) {
        console.error('[SW] Error sincronizando venta:', err);
      }
    }

    // Notificar al cliente
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_COMPLETE', ventas: ventas.length });
    });

  } catch (error) {
    console.error('[SW] Error en sincronización:', error);
  }
}

/**
 * Sincroniza registros de asistencia pendientes
 */
async function syncAsistenciaPendiente() {
  console.log('[SW] Sincronizando asistencia pendiente...');
  // Similar a syncVentasPendientes pero para asistencia
}

/**
 * Helper para abrir IndexedDB
 */
function openDB(name, version) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('ventas-pendientes')) {
        db.createObjectStore('ventas-pendientes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('asistencia-pendiente')) {
        db.createObjectStore('asistencia-pendiente', { keyPath: 'id' });
      }
    };
  });
}

// ───────────────────────────────────────────────────────────────────────────────
// NOTIFICACIONES PUSH
// ───────────────────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};

  const title = data.title || 'Kiosco App';
  const options = {
    body: data.body || 'Tienes una nueva notificación',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: data.tag || 'default',
    data: data.url || '/',
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Ver ahora' },
      { action: 'close', title: 'Cerrar' }
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    const urlToOpen = event.notification.data;
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(windowClients => {
        // Si hay una ventana abierta, enfocarla
        for (const client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Si no, abrir nueva ventana
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
    );
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// MENSAJES DESDE EL CLIENTE
// ───────────────────────────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.keys().then(names =>
          Promise.all(names.map(name => caches.delete(name)))
        ).then(() => {
          event.ports?.[0]?.postMessage({ success: true });
        })
      );
      break;

    case 'GET_VERSION':
      event.ports?.[0]?.postMessage({ version: SW_VERSION });
      break;

    case 'CACHE_URLS':
      if (Array.isArray(data?.urls)) {
        event.waitUntil(
          caches.open(STATIC_CACHE).then(cache =>
            cache.addAll(data.urls)
          )
        );
      }
      break;
  }
});

console.log(`[SW ${SW_VERSION}] Service Worker cargado`);

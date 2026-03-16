/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔧 SERVICE WORKER - KIOSCO APP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Versión: 4.0.0
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

const SW_VERSION = '4.1.0';
const STATIC_CACHE = 'kiosco-static-v4';
const DYNAMIC_CACHE = 'kiosco-dynamic-v4';
const FONTS_CACHE = 'kiosco-fonts-v4';
// CRITICAL: Must match lib/offline/indexed-db.ts constants
const OFFLINE_DB_NAME = 'kiosco-offline';
const OFFLINE_DB_VERSION = 3;

// Archivos a precachear (incluye rutas críticas para empleados)
const PRECACHE_ASSETS = [
  '/',
  '/fichaje',
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

const IMAGE_STORAGE_PATTERNS = [
  /\.supabase\.co\/storage\/v1\/object\/.*\.(?:png|jpg|jpeg|gif|webp|svg)$/i,
];

const IGNORE_PATTERNS = [
  /\.supabase\.co\/(?!storage\/v1\/object\/.*\.(?:png|jpg|jpeg|gif|webp|svg)$)/i,
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
  // STALE-WHILE-REVALIDATE: Imágenes de productos (Supabase Storage)
  // ─────────────────────────────────────────────────────────────────────────────
  if (IMAGE_STORAGE_PATTERNS.some(pattern => pattern.test(url.href))) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
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
    // Use AbortController for timeout (fetch() does not support timeout option)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const networkResponse = await fetch(request, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

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
 * Usa backoff exponencial para reintentos
 */
async function syncVentasPendientes() {
  console.log('[SW] Sincronizando ventas pendientes...');

  try {
    const db = await openDB(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    const ventas = await getAllFromStore(db, 'ventas-pendientes');

    // Filtrar solo ventas pendientes (no las que ya están sincronizando o fallaron muchas veces)
    const ventasPendientes = ventas.filter(v =>
      v.estado === 'pending' && v.intentos < 5
    );

    if (ventasPendientes.length === 0) {
      console.log('[SW] No hay ventas pendientes para sincronizar');
      notifyClients({ type: 'SYNC_STATUS', status: 'idle', pendingCount: 0 });
      return;
    }

    console.log(`[SW] Sincronizando ${ventasPendientes.length} ventas...`);
    notifyClients({ type: 'SYNC_STATUS', status: 'syncing', pendingCount: ventasPendientes.length });

    let syncedCount = 0;
    let failedCount = 0;

    // Procesar ventas secuencialmente
    for (const venta of ventasPendientes) {
      try {
        // Marcar como sincronizando
        await updateVentaEstado(db, venta.id, 'syncing');

        // Preparar payload para la API
        const payload = {
          localId: venta.id,
          sucursalId: venta.sucursal_id,
          turnoId: venta.turno_id,
          organizationId: venta.organization_id,
          items: venta.items.map(item => ({
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            nombre: item.nombre,
            subtotal: item.subtotal,
          })),
          metodoPago: venta.metodo_pago,
          montoTotal: venta.monto_total,
          vendedorId: venta.vendedor_id,
          createdAt: venta.created_at,
        };

        const response = await fetch('/api/ventas/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          // Eliminar venta sincronizada
          await deleteFromStore(db, 'ventas-pendientes', venta.id);
          syncedCount++;
          console.log(`[SW] Venta ${venta.id} sincronizada como ${result.ventaId}`);
        } else {
          // Marcar como fallida e incrementar intentos
          await updateVentaFailed(db, venta.id, result.error || 'Error desconocido');
          failedCount++;
          console.error(`[SW] Error sincronizando venta ${venta.id}:`, result.error);
        }
      } catch (err) {
        // Error de red u otro
        await updateVentaFailed(db, venta.id, err.message || 'Error de red');
        failedCount++;
        console.error(`[SW] Error de red sincronizando venta ${venta.id}:`, err);
      }

      // Pequeña pausa entre ventas para no saturar
      await sleep(100);
    }

    // Obtener conteo actualizado
    const remainingVentas = await getAllFromStore(db, 'ventas-pendientes');
    const pendingCount = remainingVentas.filter(v => v.estado !== 'synced').length;

    // Notificar resultado
    notifyClients({
      type: 'SYNC_COMPLETE',
      syncedCount,
      failedCount,
      pendingCount,
    });

    console.log(`[SW] Sync completado: ${syncedCount} ok, ${failedCount} failed, ${pendingCount} pendientes`);

  } catch (error) {
    console.error('[SW] Error en sincronización:', error);
    notifyClients({ type: 'SYNC_ERROR', error: error.message });
  }
}

/**
 * Sincroniza registros de asistencia pendientes
 */
async function syncAsistenciaPendiente() {
  console.log('[SW] Sincronizando asistencia pendiente...');

  try {
    const db = await openDB(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    const asistencias = await getAllFromStore(db, 'asistencia-pendiente');

    // Filtrar solo las pendientes que no agotaron reintentos
    const pendientes = asistencias.filter(a =>
      (a.estado === 'pending' || a.estado === 'failed') && a.intentos < 5
    );

    if (pendientes.length === 0) {
      console.log('[SW] No hay fichajes pendientes para sincronizar');
      return;
    }

    console.log(`[SW] Sincronizando ${pendientes.length} fichajes...`);

    let syncedCount = 0;
    let failedCount = 0;

    // Procesar secuencialmente (las entradas deben ir antes que las salidas)
    // Ordenar: entradas primero, luego salidas por timestamp
    pendientes.sort((a, b) => {
      if (a.tipo !== b.tipo) return a.tipo === 'entrada' ? -1 : 1;
      return a.timestamp - b.timestamp;
    });

    for (const fichaje of pendientes) {
      try {
        // Marcar como sincronizando
        await updateItemEstado(db, 'asistencia-pendiente', fichaje.id, 'syncing');

        const payload = {
          localId: fichaje.id,
          organizationId: fichaje.organization_id,
          branchId: fichaje.branch_id,
          userId: fichaje.user_id,
          tipo: fichaje.tipo,
          timestamp: fichaje.timestamp,
          attendanceId: fichaje.attendance_id || null,
        };

        const response = await fetch('/api/asistencia/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          // Eliminar fichaje sincronizado
          await deleteFromStore(db, 'asistencia-pendiente', fichaje.id);
          syncedCount++;
          console.log(`[SW] Fichaje ${fichaje.id} (${fichaje.tipo}) sincronizado`);
        } else {
          // Marcar como fallido
          await updateItemFailed(db, 'asistencia-pendiente', fichaje.id, result.error || 'Error desconocido');
          failedCount++;
          console.error(`[SW] Error sincronizando fichaje ${fichaje.id}:`, result.error);
        }
      } catch (err) {
        await updateItemFailed(db, 'asistencia-pendiente', fichaje.id, err.message || 'Error de red');
        failedCount++;
        console.error(`[SW] Error de red sincronizando fichaje ${fichaje.id}:`, err);
      }

      // Pausa entre fichajes
      await sleep(100);
    }

    console.log(`[SW] Sync asistencia completado: ${syncedCount} ok, ${failedCount} failed`);

    // Notificar clientes
    notifyClients({
      type: 'ATTENDANCE_SYNC_COMPLETE',
      syncedCount,
      failedCount,
    });

  } catch (error) {
    console.error('[SW] Error en sincronización de asistencia:', error);
  }
}

/**
 * Actualiza estado de un item en cualquier store
 */
async function updateItemEstado(db, storeName, id, estado) {
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);

  return new Promise((resolve, reject) => {
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (!item) { resolve(); return; }
      item.estado = estado;
      item.intentos = (item.intentos || 0) + (estado === 'syncing' ? 1 : 0);
      item.ultimo_intento = Date.now();
      const putReq = store.put(item);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Marca un item como fallido
 */
async function updateItemFailed(db, storeName, id, errorMsg) {
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);

  return new Promise((resolve, reject) => {
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (!item) { resolve(); return; }
      item.estado = 'failed';
      item.ultimo_error = errorMsg;
      const putReq = store.put(item);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// ───────────────────────────────────────────────────────────────────────────────
// HELPERS DE INDEXEDDB
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Abre la base de datos IndexedDB
 */
function openDB(name, version) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Store para ventas pendientes
      // MUST match lib/offline/indexed-db.ts schema exactly
      if (!db.objectStoreNames.contains('ventas-pendientes')) {
        const ventasStore = db.createObjectStore('ventas-pendientes', { keyPath: 'id' });
        ventasStore.createIndex('estado', 'estado', { unique: false });
        ventasStore.createIndex('sucursal_id', 'sucursal_id', { unique: false });
        ventasStore.createIndex('created_at', 'created_at', { unique: false });
      }

      // Store para productos cacheados
      // MUST match lib/offline/indexed-db.ts: compound keyPath ['id', 'sucursal_id']
      if (!db.objectStoreNames.contains('productos-cache')) {
        const productosStore = db.createObjectStore('productos-cache', { keyPath: ['id', 'sucursal_id'] });
        productosStore.createIndex('sucursal_id', 'sucursal_id', { unique: false });
        productosStore.createIndex('nombre', 'nombre', { unique: false });
        productosStore.createIndex('codigo_barras', 'codigo_barras', { unique: false });
        productosStore.createIndex('cached_at', 'cached_at', { unique: false });
      }

      // Store para asistencia pendiente (v3)
      if (!db.objectStoreNames.contains('asistencia-pendiente')) {
        const asistenciaStore = db.createObjectStore('asistencia-pendiente', { keyPath: 'id' });
        asistenciaStore.createIndex('estado', 'estado', { unique: false });
        asistenciaStore.createIndex('branch_id', 'branch_id', { unique: false });
        asistenciaStore.createIndex('created_at', 'created_at', { unique: false });
      }

      // Store para metadata de sync
      if (!db.objectStoreNames.contains('sync-metadata')) {
        db.createObjectStore('sync-metadata', { keyPath: 'key' });
      }
    };
  });
}

/**
 * Obtiene todos los registros de un store
 */
function getAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

/**
 * Elimina un registro de un store
 */
function deleteFromStore(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Actualiza el estado de una venta
 */
function updateVentaEstado(db, ventaId, estado) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('ventas-pendientes', 'readwrite');
    const store = tx.objectStore('ventas-pendientes');
    const getRequest = store.get(ventaId);

    getRequest.onsuccess = () => {
      const venta = getRequest.result;
      if (venta) {
        venta.estado = estado;
        // Incrementar intentos al marcar como syncing (match app-side behavior)
        if (estado === 'syncing') {
          venta.intentos = (venta.intentos || 0) + 1;
          venta.ultimo_intento = Date.now();
        }
        const putRequest = store.put(venta);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Marca una venta como fallida
 */
function updateVentaFailed(db, ventaId, errorMsg) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('ventas-pendientes', 'readwrite');
    const store = tx.objectStore('ventas-pendientes');
    const getRequest = store.get(ventaId);

    getRequest.onsuccess = () => {
      const venta = getRequest.result;
      if (venta) {
        venta.estado = 'failed';
        // intentos already incremented by updateVentaEstado('syncing')
        venta.ultimo_error = errorMsg;
        venta.ultimo_intento = Date.now();
        const putRequest = store.put(venta);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Resetea una venta para reintento: estado → pending, intentos → 0, limpia error
 */
function resetVentaForRetry(db, ventaId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('ventas-pendientes', 'readwrite');
    const store = tx.objectStore('ventas-pendientes');
    const getRequest = store.get(ventaId);

    getRequest.onsuccess = () => {
      const venta = getRequest.result;
      if (venta) {
        venta.estado = 'pending';
        venta.intentos = 0;
        venta.ultimo_error = null;
        const putRequest = store.put(venta);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Notifica a todos los clientes
 */
async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.postMessage(message);
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
  // SEGURIDAD: Solo aceptar mensajes del mismo origen
  if (event.origin && event.origin !== self.location.origin) {
    console.warn('[SW] Mensaje rechazado de origen no autorizado:', event.origin);
    return;
  }
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

    case 'FORCE_SYNC':
      // Sincronización manual solicitada desde el cliente (ventas + asistencia)
      console.log('[SW] Sincronización manual solicitada');
      event.waitUntil(
        Promise.all([
          syncVentasPendientes(),
          syncAsistenciaPendiente(),
        ]).then(() => {
          event.ports?.[0]?.postMessage({ success: true });
        }).catch(err => {
          event.ports?.[0]?.postMessage({ success: false, error: err.message });
        })
      );
      break;

    case 'FORCE_SYNC_ATTENDANCE':
      // Sincronización manual de solo asistencia
      console.log('[SW] Sincronización manual de asistencia solicitada');
      event.waitUntil(
        syncAsistenciaPendiente().then(() => {
          event.ports?.[0]?.postMessage({ success: true });
        }).catch(err => {
          event.ports?.[0]?.postMessage({ success: false, error: err.message });
        })
      );
      break;

    case 'RETRY_FAILED':
      // Reintentar ventas fallidas
      console.log('[SW] Reintento de ventas fallidas solicitado');
      event.waitUntil(
        retryFailedVentas().then(result => {
          event.ports?.[0]?.postMessage(result);
        })
      );
      break;

    case 'GET_PENDING_COUNT':
      // Obtener cantidad de ventas pendientes
      event.waitUntil(
        getPendingCount().then(count => {
          event.ports?.[0]?.postMessage({ count });
        })
      );
      break;
  }
});

/**
 * Reintenta ventas que fallaron (resetea sus intentos)
 */
async function retryFailedVentas() {
  try {
    const db = await openDB(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    const ventas = await getAllFromStore(db, 'ventas-pendientes');
    const failedVentas = ventas.filter(v => v.estado === 'failed');

    if (failedVentas.length === 0) {
      return { success: true, retriedCount: 0 };
    }

    // Resetear estado a pending Y reiniciar intentos
    for (const venta of failedVentas) {
      await resetVentaForRetry(db, venta.id);
    }

    // Iniciar sincronización
    await syncVentasPendientes();

    return { success: true, retriedCount: failedVentas.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Obtiene la cantidad de ventas pendientes
 */
async function getPendingCount() {
  try {
    const db = await openDB(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    const ventas = await getAllFromStore(db, 'ventas-pendientes');
    return ventas.filter(v => v.estado !== 'synced').length;
  } catch (error) {
    console.error('[SW] Error obteniendo pending count:', error);
    return 0;
  }
}

console.log(`[SW ${SW_VERSION}] Service Worker cargado`);

// public/sw.js  —  TechMold POS Service Worker
// Handles: offline caching, background sync, offline sale queue

const CACHE_VERSION = 'v1'
const STATIC_CACHE = `techmold-static-${CACHE_VERSION}`
const DATA_CACHE = `techmold-data-${CACHE_VERSION}`
const OFFLINE_QUEUE_KEY = 'offline-sale-queue'

// Pages & assets to precache on install
const PRECACHE_URLS = [
  '/dashboard/pos',
  '/dashboard/inventory',
  '/dashboard/customers',
  '/dashboard/reports',
  '/dashboard/settings',
  '/offline',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/apple-touch-icon.png',
]

// Supabase API base
const SUPABASE_URL = 'https://zdsmlialmxvkwdliagto.supabase.co'

// ─────────────────────────────────────────────────────────────────────────────
// INSTALL — precache static shell
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing TechMold Service Worker...')
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('[SW] Precache partial failure (OK in dev):', err)
      })
    }).then(() => {
      console.log('[SW] Installed. Skipping waiting...')
      return self.skipWaiting()
    })
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVATE — clean old caches, claim clients
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...')
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== STATIC_CACHE && name !== DATA_CACHE)
          .map(name => {
            console.log('[SW] Deleting old cache:', name)
            return caches.delete(name)
          })
      )
    }).then(() => {
      console.log('[SW] Activated. Claiming clients...')
      return self.clients.claim()
    })
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// FETCH — network-first for API, cache-first for static
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET for Supabase writes (handled by background sync)
  if (request.method !== 'GET') return

  // Supabase REST API — network-first, fall back to cache
  if (url.origin === SUPABASE_URL) {
    event.respondWith(networkFirstThenCache(request, DATA_CACHE))
    return
  }

  // Next.js internal / hot reload — pass through
  if (url.pathname.startsWith('/_next/webpack-hmr') ||
      url.pathname.startsWith('/_next/static/development')) {
    return
  }

  // Next.js static chunks — cache-first (immutable)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirstThenNetwork(request, STATIC_CACHE))
    return
  }

  // App pages — network-first, fall back to cached page or /offline
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirstWithOfflineFallback(request))
    return
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND SYNC — flush offline sale queue when back online
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag)
  if (event.tag === 'sync-offline-sales') {
    event.waitUntil(syncOfflineSales())
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// PUSH NOTIFICATIONS (future use)
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title || 'TechMold POS', {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: data.tag || 'techmold-notification',
      data: { url: data.url || '/dashboard/pos' }
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/dashboard/pos')
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE HANDLER — communicate with app
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  if (event.data?.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION })
  }
  if (event.data?.type === 'QUEUE_SALE') {
    // Triggered from app when offline — store sale in IDB for later sync
    queueOfflineSale(event.data.payload).then(() => {
      event.ports[0]?.postMessage({ success: true })
    })
  }
  if (event.data?.type === 'GET_QUEUE_COUNT') {
    getOfflineQueueCount().then(count => {
      event.ports[0]?.postMessage({ count })
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function networkFirstThenCache(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const networkResponse = await fetch(request.clone())
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    return new Response(JSON.stringify({ error: 'Offline — no cached data' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function cacheFirstThenNetwork(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const networkResponse = await fetch(request)
    await cache.put(request, networkResponse.clone())
    return networkResponse
  } catch {
    return new Response('Offline', { status: 503 })
  }
}

async function networkFirstWithOfflineFallback(request) {
  const cache = await caches.open(STATIC_CACHE)
  try {
    const networkResponse = await fetch(request.clone())
    if (request.method === 'GET' && networkResponse.ok) {
      await cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlinePage = await cache.match('/offline')
      if (offlinePage) return offlinePage
    }
    return new Response('Offline — no cached version available', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
}

// IndexedDB helpers for offline queue
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('techmold-offline', 1)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('offline_sales')) {
        const store = db.createObjectStore('offline_sales', { keyPath: 'localId', autoIncrement: true })
        store.createIndex('status', 'status', { unique: false })
        store.createIndex('created_at', 'created_at', { unique: false })
      }
      if (!db.objectStoreNames.contains('cached_products')) {
        db.createObjectStore('cached_products', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('cached_customers')) {
        db.createObjectStore('cached_customers', { keyPath: 'id' })
      }
    }
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror = (e) => reject(e.target.error)
  })
}

async function queueOfflineSale(salePayload) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_sales', 'readwrite')
    const store = tx.objectStore('offline_sales')
    const record = {
      ...salePayload,
      status: 'pending',
      created_at: new Date().toISOString(),
      sync_attempts: 0
    }
    const req = store.add(record)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getOfflineQueueCount() {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction('offline_sales', 'readonly')
      const store = tx.objectStore('offline_sales')
      const index = store.index('status')
      const req = index.count(IDBKeyRange.only('pending'))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(0)
    })
  } catch {
    return 0
  }
}

async function syncOfflineSales() {
  console.log('[SW] Syncing offline sales...')
  let db
  try {
    db = await openDB()
  } catch (err) {
    console.error('[SW] Could not open IDB:', err)
    return
  }

  // Get all pending sales
  const pendingSales = await new Promise((resolve) => {
    const tx = db.transaction('offline_sales', 'readonly')
    const store = tx.objectStore('offline_sales')
    const index = store.index('status')
    const req = index.getAll(IDBKeyRange.only('pending'))
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => resolve([])
  })

  console.log(`[SW] Found ${pendingSales.length} pending offline sales`)

  for (const sale of pendingSales) {
    try {
      // Get auth token from clients
      const allClients = await self.clients.matchAll()
      let token = null
      for (const client of allClients) {
        // Request auth token from the app
        const channel = new MessageChannel()
        client.postMessage({ type: 'GET_AUTH_TOKEN' }, [channel.port2])
        token = await new Promise(resolve => {
          channel.port1.onmessage = (e) => resolve(e.data?.token)
          setTimeout(() => resolve(null), 2000)
        })
        if (token) break
      }

      if (!token) {
        console.warn('[SW] No auth token available, skipping sync')
        continue
      }

      const { localId, status, sync_attempts, created_at: _c, ...saleData } = sale

      // POST sale to Supabase
      const response = await fetch(`${SUPABASE_URL}/rest/v1/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpkc21saWFsbXh2a3dkbGlhZ3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTg5NDksImV4cCI6MjA4ODc5NDk0OX0.p0YK6ts-vkQCMfj5KhRQvFCwhiX6hb2CvK5jHqDiJRg',
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(saleData.sale)
      })

      if (response.ok) {
        const [createdSale] = await response.json()

        // Post sale items
        if (saleData.items?.length > 0) {
          const itemsWithSaleId = saleData.items.map(item => ({
            ...item,
            sale_id: createdSale.id
          }))
          await fetch(`${SUPABASE_URL}/rest/v1/sale_items`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpkc21saWFsbXh2a3dkbGlhZ3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTg5NDksImV4cCI6MjA4ODc5NDk0OX0.p0YK6ts-vkQCMfj5KhRQvFCwhiX6hb2CvK5jHqDiJRg',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(itemsWithSaleId)
          })
        }

        // Mark as synced in IDB
        const updateTx = db.transaction('offline_sales', 'readwrite')
        const updateStore = updateTx.objectStore('offline_sales')
        const updated = { ...sale, status: 'synced', synced_at: new Date().toISOString(), remote_id: createdSale.id }
        updateStore.put(updated)

        // Notify all clients
        const clients = await self.clients.matchAll()
        clients.forEach(client => {
          client.postMessage({ type: 'SALE_SYNCED', localId, remoteId: createdSale.id })
        })

        console.log(`[SW] Sale ${localId} synced → ${createdSale.id}`)
      } else {
        console.error('[SW] Failed to sync sale:', response.status, await response.text())
        // Increment attempts
        const updateTx = db.transaction('offline_sales', 'readwrite')
        const updateStore = updateTx.objectStore('offline_sales')
        updateStore.put({ ...sale, sync_attempts: (sale.sync_attempts || 0) + 1 })
      }
    } catch (err) {
      console.error('[SW] Error syncing sale:', err)
    }
  }

  // Notify clients that sync completed
  const allClients = await self.clients.matchAll()
  allClients.forEach(client => {
    client.postMessage({ type: 'SYNC_COMPLETE' })
  })
}

// lib/offline-db.ts
// IndexedDB wrapper for offline caching of products, customers, and sale queue

const DB_NAME = 'techmold-offline'
const DB_VERSION = 1

export interface OfflineSale {
  localId?: number
  sale: Record<string, unknown>
  items: Record<string, unknown>[]
  status: 'pending' | 'syncing' | 'synced' | 'failed'
  created_at: string
  sync_attempts: number
  synced_at?: string
  remote_id?: string
  receipt_number?: string
}

export interface CachedProduct {
  id: string
  name: string
  sku: string
  barcode?: string
  category: string
  brand: string
  price: number
  cost_price: number
  stock_quantity: number
  min_stock_level: number
  tax_rate: number
  is_active: boolean
  cached_at: string
}

export interface CachedCustomer {
  id: string
  name: string
  email?: string
  phone?: string
  loyalty_points: number
  total_spent: number
  cached_at: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains('offline_sales')) {
        const store = db.createObjectStore('offline_sales', {
          keyPath: 'localId',
          autoIncrement: true,
        })
        store.createIndex('status', 'status', { unique: false })
        store.createIndex('created_at', 'created_at', { unique: false })
      }

      if (!db.objectStoreNames.contains('cached_products')) {
        const ps = db.createObjectStore('cached_products', { keyPath: 'id' })
        ps.createIndex('category', 'category', { unique: false })
        ps.createIndex('sku', 'sku', { unique: true })
      }

      if (!db.objectStoreNames.contains('cached_customers')) {
        db.createObjectStore('cached_customers', { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' })
      }
    }

    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result)
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error)
  })
}

// ── Products ─────────────────────────────────────────────────────────────────

export async function cacheProducts(products: CachedProduct[]): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(['cached_products', 'meta'], 'readwrite')
  const store = tx.objectStore('cached_products')
  const meta = tx.objectStore('meta')

  const now = new Date().toISOString()
  for (const product of products) {
    store.put({ ...product, cached_at: now })
  }
  meta.put({ key: 'products_cached_at', value: now })

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getCachedProducts(): Promise<CachedProduct[]> {
  const db = await openDB()
  const tx = db.transaction('cached_products', 'readonly')
  const store = tx.objectStore('cached_products')

  return new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

export async function updateCachedProductStock(productId: string, delta: number): Promise<void> {
  const db = await openDB()
  const tx = db.transaction('cached_products', 'readwrite')
  const store = tx.objectStore('cached_products')

  return new Promise((resolve, reject) => {
    const req = store.get(productId)
    req.onsuccess = () => {
      const product = req.result
      if (product) {
        product.stock_quantity = Math.max(0, product.stock_quantity + delta)
        store.put(product)
      }
      resolve()
    }
    req.onerror = () => reject(req.error)
  })
}

// ── Customers ─────────────────────────────────────────────────────────────────

export async function cacheCustomers(customers: CachedCustomer[]): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(['cached_customers', 'meta'], 'readwrite')
  const store = tx.objectStore('cached_customers')
  const meta = tx.objectStore('meta')

  const now = new Date().toISOString()
  for (const customer of customers) {
    store.put({ ...customer, cached_at: now })
  }
  meta.put({ key: 'customers_cached_at', value: now })

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getCachedCustomers(): Promise<CachedCustomer[]> {
  const db = await openDB()
  const tx = db.transaction('cached_customers', 'readonly')
  const store = tx.objectStore('cached_customers')

  return new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

// ── Offline Sale Queue ────────────────────────────────────────────────────────

export async function queueOfflineSale(sale: Omit<OfflineSale, 'localId'>): Promise<number> {
  const db = await openDB()
  const tx = db.transaction('offline_sales', 'readwrite')
  const store = tx.objectStore('offline_sales')

  return new Promise((resolve, reject) => {
    const req = store.add(sale)
    req.onsuccess = () => resolve(req.result as number)
    req.onerror = () => reject(req.error)
  })
}

export async function getPendingOfflineSales(): Promise<OfflineSale[]> {
  const db = await openDB()
  const tx = db.transaction('offline_sales', 'readonly')
  const store = tx.objectStore('offline_sales')
  const index = store.index('status')

  return new Promise((resolve, reject) => {
    const req = index.getAll(IDBKeyRange.only('pending'))
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

export async function getAllOfflineSales(): Promise<OfflineSale[]> {
  const db = await openDB()
  const tx = db.transaction('offline_sales', 'readonly')
  const store = tx.objectStore('offline_sales')

  return new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => resolve((req.result || []).sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ))
    req.onerror = () => reject(req.error)
  })
}

export async function markSaleSynced(localId: number, remoteId: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction('offline_sales', 'readwrite')
  const store = tx.objectStore('offline_sales')

  return new Promise((resolve, reject) => {
    const req = store.get(localId)
    req.onsuccess = () => {
      const sale = req.result
      if (sale) {
        store.put({ ...sale, status: 'synced', remote_id: remoteId, synced_at: new Date().toISOString() })
      }
      resolve()
    }
    req.onerror = () => reject(req.error)
  })
}

export async function getOfflineQueueCount(): Promise<number> {
  try {
    const db = await openDB()
    const tx = db.transaction('offline_sales', 'readonly')
    const store = tx.objectStore('offline_sales')
    const index = store.index('status')

    return new Promise((resolve) => {
      const req = index.count(IDBKeyRange.only('pending'))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(0)
    })
  } catch {
    return 0
  }
}

export async function getCacheAge(key: 'products_cached_at' | 'customers_cached_at'): Promise<number> {
  try {
    const db = await openDB()
    const tx = db.transaction('meta', 'readonly')
    const store = tx.objectStore('meta')

    return new Promise((resolve) => {
      const req = store.get(key)
      req.onsuccess = () => {
        if (!req.result) { resolve(Infinity); return }
        const age = Date.now() - new Date(req.result.value).getTime()
        resolve(age)
      }
      req.onerror = () => resolve(Infinity)
    })
  } catch {
    return Infinity
  }
}

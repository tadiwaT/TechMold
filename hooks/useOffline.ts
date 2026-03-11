// hooks/useOffline.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getOfflineQueueCount, markSaleSynced } from '@/lib/offline-db'

export interface OfflineState {
  isOnline: boolean
  isOffline: boolean
  pendingCount: number
  isSyncing: boolean
  lastSyncAt: Date | null
  swReady: boolean
}

export function useOffline() {
  const [state, setState] = useState<OfflineState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    pendingCount: 0,
    isSyncing: false,
    lastSyncAt: null,
    swReady: false,
  })

  const authTokenRef = useRef<string | null>(null)

  // Store latest auth token so SW can retrieve it
  const setAuthToken = useCallback((token: string | null) => {
    authTokenRef.current = token
  }, [])

  const updatePendingCount = useCallback(async () => {
    const count = await getOfflineQueueCount()
    setState(prev => ({ ...prev, pendingCount: count }))
  }, [])

  // Register service worker
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })

        console.log('[useOffline] SW registered:', reg.scope)

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[useOffline] SW update available')
            }
          })
        })

        setState(prev => ({ ...prev, swReady: true }))
        updatePendingCount()
      } catch (err) {
        console.warn('[useOffline] SW registration failed:', err)
      }
    }

    register()

    // Listen for messages from SW
    const handleSWMessage = (event: MessageEvent) => {
      const { type, localId, remoteId } = event.data || {}

      if (type === 'SALE_SYNCED') {
        if (localId && remoteId) {
          markSaleSynced(localId, remoteId)
        }
        updatePendingCount()
      }

      if (type === 'SYNC_COMPLETE') {
        setState(prev => ({ ...prev, isSyncing: false, lastSyncAt: new Date() }))
        updatePendingCount()
      }

      if (type === 'GET_AUTH_TOKEN') {
        // SW is asking for auth token
        event.ports?.[0]?.postMessage({ token: authTokenRef.current })
      }
    }

    navigator.serviceWorker.addEventListener('message', handleSWMessage)
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSWMessage)
    }
  }, [updatePendingCount])

  // Network status listeners
  useEffect(() => {
    const handleOnline = () => {
      console.log('[useOffline] Back online!')
      setState(prev => ({ ...prev, isOnline: true, isOffline: false }))

      // Trigger background sync
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then(reg => {
          // @ts-expect-error - SyncManager not yet in TS types
          reg.sync.register('sync-offline-sales').catch(console.warn)
          setState(prev => ({ ...prev, isSyncing: true }))
        })
      }
    }

    const handleOffline = () => {
      console.log('[useOffline] Gone offline')
      setState(prev => ({ ...prev, isOnline: false, isOffline: true }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Poll pending count every 30s
    const interval = setInterval(updatePendingCount, 30_000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [updatePendingCount])

  const triggerSync = useCallback(() => {
    if (!state.isOnline) return
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then(reg => {
        // @ts-expect-error
        reg.sync.register('sync-offline-sales').catch(console.warn)
        setState(prev => ({ ...prev, isSyncing: true }))
      })
    }
  }, [state.isOnline])

  return { ...state, setAuthToken, triggerSync, updatePendingCount }
}

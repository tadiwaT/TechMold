'use client'
// app/offline/page.tsx — shown by SW when user navigates while offline

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function OfflinePage() {
  const [pendingCount, setPendingCount] = useState(0)
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)

    // Get pending queue count from SW
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const channel = new MessageChannel()
      navigator.serviceWorker.controller.postMessage({ type: 'GET_QUEUE_COUNT' }, [channel.port2])
      channel.port1.onmessage = (e) => setPendingCount(e.data?.count || 0)
    }

    const handleOnline = () => {
      setIsOnline(true)
      setTimeout(() => { window.location.href = '/dashboard/pos' }, 1500)
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-md">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
            style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="1.5" strokeLinecap="round">
              <line x1="1" y1="1" x2="23" y2="23"/>
              <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
              <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
              <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
              <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
              <line x1="12" y1="20" x2="12.01" y2="20"/>
            </svg>
          </div>
        </div>

        <h1 className="font-display font-bold text-2xl text-center mb-2 text-gradient">
          {isOnline ? 'Back Online!' : "You're Offline"}
        </h1>
        <p className="text-sm text-center mb-6" style={{ color: 'var(--text-muted)' }}>
          {isOnline
            ? 'Reconnected! Redirecting to POS...'
            : 'TechMold POS still works — sales are saved locally and sync when reconnected.'}
        </p>

        {/* Status */}
        <div className="rounded-xl p-4 mb-5 flex items-center gap-3"
          style={{
            background: isOnline ? 'rgba(63,185,80,0.08)' : 'rgba(248,81,73,0.08)',
            border: `1px solid ${isOnline ? 'rgba(63,185,80,0.25)' : 'rgba(248,81,73,0.25)'}`,
          }}>
          <div className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ background: isOnline ? 'var(--success)' : 'var(--danger)' }} />
          <span className="text-sm font-medium" style={{ color: isOnline ? 'var(--success)' : 'var(--danger)' }}>
            {isOnline ? 'Connected · Syncing...' : 'No internet connection'}
          </span>
        </div>

        {pendingCount > 0 && (
          <div className="rounded-xl p-4 mb-5"
            style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)' }}>
            <div className="flex items-center gap-2 mb-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--neon)" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
              <span className="text-sm font-semibold" style={{ color: 'var(--neon)' }}>
                {pendingCount} sale{pendingCount !== 1 ? 's' : ''} queued
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Will sync automatically when you reconnect to the internet.
            </p>
          </div>
        )}

        {/* Quick nav */}
        <div className="space-y-2 mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Cached pages available offline
          </p>
          {[
            { href: '/dashboard/pos', label: 'POS Terminal', emoji: '🖥️', desc: 'Process sales' },
            { href: '/dashboard/inventory', label: 'Inventory', emoji: '📦', desc: 'View stock' },
            { href: '/dashboard/customers', label: 'Customers', emoji: '👥', desc: 'Customer list' },
            { href: '/dashboard/reports', label: 'Reports', emoji: '📊', desc: 'Analytics' },
          ].map(item => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,212,255,0.3)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
            >
              <span className="text-xl">{item.emoji}</span>
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.label}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.desc}</div>
              </div>
              <svg className="ml-auto" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}>
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </Link>
          ))}
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
          style={{ background: 'linear-gradient(135deg, #00D4FF, #0ea5e9)', color: '#080c10' }}
        >
          Try Reconnecting
        </button>
      </div>
    </div>
  )
}

'use client'
// components/ui/PWAInstallBanner.tsx

import { useState } from 'react'
import { usePWAInstall } from '@/hooks/usePWAInstall'

export function PWAInstallBanner() {
  const { canInstall, isInstalled, isInstalling, platform, install } = usePWAInstall()
  const [dismissed, setDismissed] = useState(false)
  const [showIOSGuide, setShowIOSGuide] = useState(false)

  if (isInstalled || dismissed) return null

  // iOS: show manual instructions
  if (platform === 'ios' && !dismissed) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all mx-3 mb-2"
          style={{
            background: 'rgba(0,212,255,0.08)',
            border: '1px solid rgba(0,212,255,0.2)',
            color: 'var(--neon)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L12 16M12 2L8 6M12 2L16 6"/><path d="M20 16v4H4v-4"/>
          </svg>
          Install on iPhone
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="w-full max-w-sm rounded-2xl p-5 glass-bright mb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                  Install TechMold POS
                </h3>
                <button onClick={() => setShowIOSGuide(false)} style={{ color: 'var(--text-muted)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <div className="space-y-3">
                {[
                  { step: '1', icon: '⬆️', text: 'Tap the Share button at the bottom of Safari' },
                  { step: '2', icon: '📋', text: 'Scroll down and tap "Add to Home Screen"' },
                  { step: '3', icon: '✅', text: 'Tap "Add" to install TechMold POS' },
                ].map(s => (
                  <div key={s.step} className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: 'var(--neon)', color: '#080c10' }}>{s.step}</div>
                    <div>
                      <span className="mr-2">{s.icon}</span>
                      <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{s.text}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs mt-3 text-center" style={{ color: 'var(--text-muted)' }}>
                Opens as a full-screen app with offline support
              </p>
            </div>
          </div>
        )}
      </>
    )
  }

  // Chrome/Edge/Android: native install prompt
  if (!canInstall) return null

  return (
    <div className="mx-3 mb-2 flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)' }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #00D4FF, #6366f1)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Install App</div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Works offline</div>
      </div>
      <button
        onClick={install}
        disabled={isInstalling}
        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0"
        style={{ background: 'var(--neon)', color: '#080c10' }}
      >
        {isInstalling ? '...' : 'Install'}
      </button>
      <button onClick={() => setDismissed(true)} style={{ color: 'var(--text-muted)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  )
}

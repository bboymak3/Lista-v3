'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

export function UpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NEW_VERSION') {
        setShowUpdate(true)
      }
    }
    navigator.serviceWorker.addEventListener('message', handleMessage)

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) {
        setShowUpdate(true)
      }
      reg?.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setShowUpdate(true)
            }
          })
        }
      })
    })

    const interval = setInterval(() => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.update()
      })
    }, 5 * 60 * 1000)

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage)
      clearInterval(interval)
    }
  }, [])

  const handleUpdate = () => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
    })
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }

  if (!showUpdate) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-emerald-600 text-white rounded-lg shadow-xl p-4 max-w-xs">
      <div className="flex items-start gap-3">
        <RefreshCw className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-sm">Nueva versión disponible</p>
          <p className="text-xs text-emerald-100 mt-1">
            Hay una versión más reciente del sistema. Actualiza para tener las últimas mejoras.
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              onClick={handleUpdate}
              className="bg-white text-emerald-700 hover:bg-emerald-50 h-8"
            >
              Actualizar ahora
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowUpdate(false)}
              className="text-white hover:bg-emerald-700 h-8"
            >
              Más tarde
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

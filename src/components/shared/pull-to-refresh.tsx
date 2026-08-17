'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void
  children: React.ReactNode
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const startY = useRef(0)
  const pulling = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Solo activar si el scroll está arriba
      if (window.scrollY > 0) return
      startY.current = e.touches[0].clientY
      pulling.current = true
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!pulling.current || isRefreshing) return
      const currentY = e.touches[0].clientY
      const diff = currentY - startY.current
      if (diff > 0 && diff < 100) {
        setPullDistance(diff)
      }
    }

    const handleTouchEnd = async () => {
      if (!pulling.current) return
      pulling.current = false
      if (pullDistance > 70) {
        setIsRefreshing(true)
        setPullDistance(60)
        try {
          await onRefresh()
        } finally {
          setTimeout(() => {
            setIsRefreshing(false)
            setPullDistance(0)
          }, 500)
        }
      } else {
        setPullDistance(0)
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [pullDistance, isRefreshing, onRefresh])

  return (
    <div ref={containerRef} className="relative">
      {/* Indicador de pull */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center text-emerald-600 transition-transform"
          style={{
            height: isRefreshing ? 60 : pullDistance,
            transform: `translateY(${-100 + (isRefreshing ? 60 : pullDistance)}%)`,
          }}
        >
          {isRefreshing ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <RefreshCw
              className="w-6 h-6 transition-transform"
              style={{ transform: `rotate(${pullDistance * 3.6}deg)` }}
            />
          )}
        </div>
      )}
      {children}
    </div>
  )
}

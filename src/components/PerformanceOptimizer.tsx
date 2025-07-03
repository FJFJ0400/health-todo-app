'use client'

import { useEffect, useCallback, useRef } from 'react'
import { api } from '../../lib/supabase'

interface PerformanceOptimizerProps {
  userId: string
  children: React.ReactNode
}

export default function PerformanceOptimizer({ userId, children }: PerformanceOptimizerProps) {
  const cleanupRef = useRef<Array<() => void>>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // 메모리 정리 함수
  const addCleanup = useCallback((cleanupFn: () => void) => {
    cleanupRef.current.push(cleanupFn)
  }, [])

  // 성능 모니터링
  useEffect(() => {
    if (typeof window === 'undefined') return

    // 메모리 사용량 모니터링
    const monitorMemory = () => {
      if ('memory' in performance && performance.memory) {
        const memory = performance.memory as { usedJSHeapSize: number; totalJSHeapSize: number }
        const memoryUsage = memory.usedJSHeapSize / memory.totalJSHeapSize
        
        // 메모리 사용량이 90% 이상이면 경고
        if (memoryUsage > 0.9) {
          console.warn('높은 메모리 사용량 감지:', memoryUsage * 100 + '%')
          // 캐시 일부 정리
          api.cache.clear()
        }
      }
    }

    // 주기적으로 메모리 모니터링 (30초마다)
    intervalRef.current = setInterval(monitorMemory, 30000)
    addCleanup(() => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    })

    // 페이지 가시성 변경 감지
    const handleVisibilityChange = () => {
      if (document.hidden) {
        api.cache.clear()
      } else {
        api.cache.preloadUserData(userId)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    addCleanup(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    })

    // 네트워크 상태 모니터링
    const handleOnline = () => {
      console.log('온라인 상태 복구')
      api.syncPendingOperations()
    }

    const handleOffline = () => {
      console.log('오프라인 상태 감지')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    addCleanup(() => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    })

    return () => {
      // 모든 cleanup 함수 실행
      cleanupRef.current.forEach(cleanup => cleanup())
      cleanupRef.current = []
    }
  }, [userId, addCleanup])

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      // 캐시 정리
      api.cache.invalidateUser(userId)
      
      // 남은 cleanup 함수들 실행
      cleanupRef.current.forEach(cleanup => cleanup())
    }
  }, [userId])

  return <>{children}</>
} 
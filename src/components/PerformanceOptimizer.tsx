'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { api } from '../../lib/supabase'

interface PerformanceOptimizerProps {
  userId: string
  children: React.ReactNode
}

export default function PerformanceOptimizer({ userId, children }: PerformanceOptimizerProps) {
  const cleanupRef = useRef<Array<() => void>>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // 메모리 정리 함수
  const addCleanup = useCallback((cleanupFn: () => void) => {
    cleanupRef.current.push(cleanupFn)
  }, [])

  // 성능 모니터링
  useEffect(() => {
    if (typeof window === 'undefined') return

    // 메모리 사용량 모니터링
    const monitorMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as { memory: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory
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

    // 페이지 가시성 변경 감지 (백그라운드에서 리소스 절약)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 페이지가 숨겨지면 캐시 정리 및 리소스 절약
        api.cache.clear()
      } else {
        // 페이지가 다시 보이면 데이터 사전 로드
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

    // 이미지 지연 로딩을 위한 Intersection Observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement
            if (img.dataset.src) {
              img.src = img.dataset.src
              img.removeAttribute('data-src')
              observerRef.current?.unobserve(img)
            }
          }
        })
      },
      { rootMargin: '50px' }
    )

    addCleanup(() => {
      observerRef.current?.disconnect()
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

// 지연 로딩 이미지 컴포넌트
export function LazyImage({ 
  src, 
  alt, 
  className = '', 
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNjY2MiLz48L3N2Zz4=' 
}: {
  src: string
  alt: string
  className?: string
  placeholder?: string
}) {
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && imgRef.current) {
            const img = imgRef.current
            img.src = src
            observer.unobserve(img)
          }
        })
      },
      { rootMargin: '50px' }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [src])

  return (
    <img
      ref={imgRef}
      src={placeholder}
      alt={alt}
      className={className}
      loading="lazy"
    />
  )
}

// 디바운스 훅
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// 쓰로틀 훅
export function useThrottle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastExecutedRef = useRef<number>(0)

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now()
      
      if (now - lastExecutedRef.current >= delay) {
        lastExecutedRef.current = now
        return func(...args)
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        
        timeoutRef.current = setTimeout(() => {
          lastExecutedRef.current = Date.now()
          func(...args)
        }, delay - (now - lastExecutedRef.current))
      }
    }) as T,
    [func, delay]
  )
} 
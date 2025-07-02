import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { User } from '@supabase/supabase-js'

export const supabase = createClientComponentClient()

// 캐시 관리
class DataCache {
  private cache = new Map<string, { data: any, timestamp: number, ttl: number }>()
  
  set(key: string, data: any, ttl: number = 300000) { // 기본 5분 TTL
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }
  
  get(key: string) {
    const cached = this.cache.get(key)
    if (!cached) return null
    
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key)
      return null
    }
    
    return cached.data
  }
  
  delete(key: string) {
    this.cache.delete(key)
  }
  
  clear() {
    this.cache.clear()
  }
  
  invalidatePattern(pattern: string) {
    const keys = Array.from(this.cache.keys())
    keys.forEach(key => {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    })
  }
}

const dataCache = new DataCache()

// 타입 정의
export interface Profile {
  id: string
  nickname: string
  avatar_url?: string
  created_at: string
}

export interface UserMission {
  id: string
  user_id: string
  title: string
  category: 'physical' | 'emotional' | 'social' | 'spiritual'
  frequency: 'daily' | 'weekly' | 'monthly'
  sticker: string
  is_custom: boolean
  created_at: string
}

export interface MissionCompletion {
  id: string
  user_id: string
  mission_id: string
  completed_at: string
}

// 배치 처리용 큐
class BatchQueue {
  private queue: Array<() => Promise<any>> = []
  private processing = false
  private batchSize = 10
  
  add(operation: () => Promise<any>) {
    this.queue.push(operation)
    this.process()
  }
  
  private async process() {
    if (this.processing || this.queue.length === 0) return
    
    this.processing = true
    
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize)
      try {
        await Promise.all(batch.map(op => op()))
      } catch (error) {
        console.error('배치 처리 오류:', error)
      }
      
      // 작은 지연을 추가하여 메인 스레드가 블록되지 않도록 함
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    
    this.processing = false
  }
}

const batchQueue = new BatchQueue()

// API 함수들
export const api = {
  // 프로필 생성 또는 가져오기
  async ensureProfile(user: User) {
    const cacheKey = `profile:${user.id}`
    let cached = dataCache.get(cacheKey)
    if (cached) return cached
    
    try {
      // 기존 프로필 확인
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (existingProfile && !fetchError) {
        dataCache.set(cacheKey, existingProfile)
        return existingProfile
      }

      // 프로필이 없으면 생성
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert([
          {
            id: user.id,
            nickname: user.user_metadata?.full_name || user.email?.split('@')[0] || '사용자',
            avatar_url: user.user_metadata?.avatar_url || null,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single()

      if (createError) throw createError
      dataCache.set(cacheKey, newProfile)
      return newProfile
    } catch (error) {
      console.error('프로필 생성 오류:', error)
      throw error
    }
  },

  // 미션 가져오기 (캐싱 적용)
  async getUserMissions(userId: string, useCache: boolean = true) {
    const cacheKey = `missions:${userId}`
    
    if (useCache) {
      const cached = dataCache.get(cacheKey)
      if (cached) return cached
    }
    
    const { data, error } = await supabase
      .from('user_missions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    
    if (error) throw error
    
    const result = data || []
    dataCache.set(cacheKey, result)
    return result
  },

  // 미션 만들기 (낙관적 업데이트)
  async createMission(mission: Omit<UserMission, 'id' | 'created_at'>) {
    // 낙관적 업데이트를 위한 임시 ID
    const tempMission = {
      ...mission,
      id: `temp_${Date.now()}`,
      created_at: new Date().toISOString()
    }
    
    // 캐시 무효화
    dataCache.invalidatePattern(`missions:${mission.user_id}`)
    
    try {
      const { data, error } = await supabase
        .from('user_missions')
        .insert([mission])
        .select()
        .single()
      
      if (error) throw error
      
      // 캐시 업데이트
      const cacheKey = `missions:${mission.user_id}`
      const cachedMissions = dataCache.get(cacheKey) || []
      dataCache.set(cacheKey, [...cachedMissions, data])
      
      return data
    } catch (error) {
      // 낙관적 업데이트 롤백
      dataCache.invalidatePattern(`missions:${mission.user_id}`)
      throw error
    }
  },

  // 미션 삭제 (배치 처리)
  async deleteMission(missionId: string) {
    return new Promise((resolve, reject) => {
      batchQueue.add(async () => {
        try {
          const { error } = await supabase
            .from('user_missions')
            .delete()
            .eq('id', missionId)
          
          if (error) throw error
          
          // 관련 캐시 무효화
          dataCache.invalidatePattern('missions:')
          dataCache.invalidatePattern('completions:')
          
          resolve(undefined)
        } catch (error) {
          reject(error)
        }
      })
    })
  },

  // 오늘 완료한 미션들 가져오기 (캐싱 적용)
  async getTodayCompletions(userId: string, useCache: boolean = true) {
    const today = new Date().toISOString().split('T')[0]
    const cacheKey = `completions:${userId}:${today}`
    
    if (useCache) {
      const cached = dataCache.get(cacheKey)
      if (cached) return cached
    }
    
    const { data, error } = await supabase
      .from('mission_completions')
      .select('*')
      .eq('user_id', userId)
      .gte('completed_at', `${today}T00:00:00.000Z`)
      .lte('completed_at', `${today}T23:59:59.999Z`)
    
    if (error) throw error
    
    const result = data || []
    // 완료 데이터는 자주 변경되므로 짧은 TTL 적용
    dataCache.set(cacheKey, result, 60000) // 1분
    return result
  },

  // 미션 완료하기 (낙관적 업데이트)
  async completeMission(userId: string, missionId: string) {
    // 낙관적 업데이트를 위한 임시 완료 데이터
    const tempCompletion = {
      id: `temp_${Date.now()}`,
      user_id: userId,
      mission_id: missionId,
      completed_at: new Date().toISOString()
    }
    
    try {
      const { data, error } = await supabase
        .from('mission_completions')
        .insert([{
          user_id: userId,
          mission_id: missionId
        }])
        .select()
        .single()
      
      if (error) throw error
      
      // 캐시 업데이트
      const today = new Date().toISOString().split('T')[0]
      const cacheKey = `completions:${userId}:${today}`
      const cachedCompletions = dataCache.get(cacheKey) || []
      dataCache.set(cacheKey, [...cachedCompletions, data], 60000)
      
      return data
    } catch (error) {
      // 낙관적 업데이트 롤백
      const today = new Date().toISOString().split('T')[0]
      dataCache.delete(`completions:${userId}:${today}`)
      throw error
    }
  },

  // 미션 완료 취소 (배치 처리)
  async uncompleteMission(userId: string, missionId: string) {
    return new Promise((resolve, reject) => {
      batchQueue.add(async () => {
        try {
          const today = new Date().toISOString().split('T')[0]
          const { error } = await supabase
            .from('mission_completions')
            .delete()
            .eq('user_id', userId)
            .eq('mission_id', missionId)
            .gte('completed_at', `${today}T00:00:00.000Z`)
            .lte('completed_at', `${today}T23:59:59.999Z`)
          
          if (error) throw error
          
          // 캐시 무효화
          dataCache.delete(`completions:${userId}:${today}`)
          
          resolve(undefined)
        } catch (error) {
          reject(error)
        }
      })
    })
  },

  // 캐시 관리 함수들
  cache: {
    clear: () => dataCache.clear(),
    invalidateUser: (userId: string) => {
      dataCache.invalidatePattern(userId)
    },
    preloadUserData: async (userId: string) => {
      // 사용자 데이터 사전 로드
      const promises = [
        api.getUserMissions(userId),
        api.getTodayCompletions(userId)
      ]
      await Promise.all(promises)
    }
  },

  // 네트워크 상태 확인
  async checkConnection() {
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1)
      return !error
    } catch {
      return false
    }
  },

  // 일괄 동기화 (오프라인 지원)
  async syncPendingOperations() {
    // 오프라인 상태에서 저장된 작업들을 동기화
    const pendingOps = localStorage.getItem('pendingOperations')
    if (!pendingOps) return
    
    try {
      const operations = JSON.parse(pendingOps)
      await Promise.all(operations.map((op: any) => {
        switch (op.type) {
          case 'create_mission':
            return api.createMission(op.data)
          case 'complete_mission':
            return api.completeMission(op.data.userId, op.data.missionId)
          case 'delete_mission':
            return api.deleteMission(op.data.missionId)
          default:
            return Promise.resolve()
        }
      }))
      
      localStorage.removeItem('pendingOperations')
    } catch (error) {
      console.error('동기화 오류:', error)
    }
  }
}
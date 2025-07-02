import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { User } from '@supabase/auth-helpers-nextjs'

export const supabase = createClientComponentClient()

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

// API 함수들
export const api = {
  // 프로필 생성 또는 가져오기
  async ensureProfile(user: User) {
    try {
      // 기존 프로필 확인
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (existingProfile && !fetchError) {
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
      return newProfile
    } catch (error) {
      console.error('프로필 생성 오류:', error)
      throw error
    }
  },

  // 미션 가져오기
  async getUserMissions(userId: string) {
    const { data, error } = await supabase
      .from('user_missions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    
    if (error) throw error
    return data || []
  },

  // 미션 만들기
  async createMission(mission: Omit<UserMission, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('user_missions')
      .insert([mission])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // 미션 삭제
  async deleteMission(missionId: string) {
    const { error } = await supabase
      .from('user_missions')
      .delete()
      .eq('id', missionId)
    
    if (error) throw error
  },

  // 오늘 완료한 미션들 가져오기
  async getTodayCompletions(userId: string) {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('mission_completions')
      .select('*')
      .eq('user_id', userId)
      .gte('completed_at', `${today}T00:00:00.000Z`)
      .lte('completed_at', `${today}T23:59:59.999Z`)
    
    if (error) throw error
    return data || []
  },

  // 미션 완료하기
  async completeMission(userId: string, missionId: string) {
    const { data, error } = await supabase
      .from('mission_completions')
      .insert([{
        user_id: userId,
        mission_id: missionId
      }])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // 미션 완료 취소
  async uncompleteMission(userId: string, missionId: string) {
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase
      .from('mission_completions')
      .delete()
      .eq('user_id', userId)
      .eq('mission_id', missionId)
      .gte('completed_at', `${today}T00:00:00.000Z`)
      .lte('completed_at', `${today}T23:59:59.999Z`)
    
    if (error) throw error
  }
}
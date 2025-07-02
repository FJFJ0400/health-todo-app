'use client'

import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { supabase, api, UserMission, MissionCompletion } from '../../lib/supabase'
import { User } from '@supabase/supabase-js'
import LoadingSpinner from './LoadingSpinner'

interface TodoAppProps {
  user: User
}

const categories = {
  physical: { name: '신체', color: 'bg-red-500', lightColor: 'bg-red-50' },
  emotional: { name: '정서', color: 'bg-blue-500', lightColor: 'bg-blue-50' },
  social: { name: '사회', color: 'bg-green-500', lightColor: 'bg-green-50' },
  spiritual: { name: '영성', color: 'bg-purple-500', lightColor: 'bg-purple-50' }
}

const stickerOptions = ['🏃‍♂️', '💪', '🧘‍♀️', '📚', '🎵', '🎨', '🤝', '❤️', '🌱', '⭐', '🔥', '✨']

// 미션 아이템 컴포넌트 메모이제이션
const MissionItem = memo(({ 
  mission, 
  category, 
  isCompleted, 
  onComplete, 
  onDelete 
}: {
  mission: UserMission
  category: { name: string, color: string, lightColor: string }
  isCompleted: boolean
  onComplete: () => void
  onDelete: () => void
}) => (
  <div
    className={`${category.lightColor} rounded-lg p-4 border-2 ${
      isCompleted ? 'border-green-400' : 'border-transparent'
    }`}
  >
    <div className="flex items-center justify-between mb-2">
      <span className="text-2xl">{mission.sticker}</span>
      <button
        onClick={onDelete}
        className="text-gray-400 hover:text-red-500 text-sm"
      >
        ✕
      </button>
    </div>
    
    <h4 className="font-medium text-gray-900 mb-2">{mission.title}</h4>
    
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-600 bg-white/50 px-2 py-1 rounded">
        {mission.frequency === 'daily' ? '매일' : 
         mission.frequency === 'weekly' ? '매주' : '매월'}
      </span>
      
      <button
        onClick={onComplete}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          isCompleted
            ? 'bg-green-500 text-white'
            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
        }`}
      >
        {isCompleted ? '완료!' : '완료'}
      </button>
    </div>
  </div>
))

MissionItem.displayName = 'MissionItem'

// 스티커 선택 컴포넌트 메모이제이션
const StickerSelector = memo(({ 
  selectedSticker, 
  onStickerChange 
}: {
  selectedSticker: string
  onStickerChange: (sticker: string) => void
}) => (
  <div className="flex flex-wrap gap-2">
    {stickerOptions.map((sticker) => (
      <button
        key={sticker}
        type="button"
        onClick={() => onStickerChange(sticker)}
        className={`text-2xl p-2 rounded-lg border-2 ${
          selectedSticker === sticker ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
        }`}
      >
        {sticker}
      </button>
    ))}
  </div>
))

StickerSelector.displayName = 'StickerSelector'

function TodoApp({ user }: TodoAppProps) {
  const [missions, setMissions] = useState<UserMission[]>([])
  const [completions, setCompletions] = useState<MissionCompletion[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newMission, setNewMission] = useState({
    title: '',
    category: 'physical' as keyof typeof categories,
    frequency: 'daily' as 'daily' | 'weekly' | 'monthly',
    sticker: '⭐'
  })

  // 데이터 로딩 함수들 메모이제이션
  const loadMissions = useCallback(async () => {
    try {
      const data = await api.getUserMissions(user.id)
      setMissions(data)
    } catch (error) {
      console.error('미션 로드 오류:', error)
    }
  }, [user.id])

  const loadTodayCompletions = useCallback(async () => {
    try {
      const data = await api.getTodayCompletions(user.id)
      setCompletions(data)
      setLoading(false)
    } catch (error) {
      console.error('완료 기록 로드 오류:', error)
      setLoading(false)
    }
  }, [user.id])

  // 초기 데이터 로드
  useEffect(() => {
    let isMounted = true
    
    Promise.all([
      loadMissions(),
      loadTodayCompletions()
    ]).catch(error => {
      console.error('데이터 로드 오류:', error)
      if (isMounted) setLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [loadMissions, loadTodayCompletions])

  // 실시간 업데이트 구독
  useEffect(() => {
    const missionsChannel = supabase.channel('missions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_missions',
        filter: `user_id=eq.${user.id}`
      }, () => {
        loadMissions()
      })
      .subscribe()

    const completionsChannel = supabase.channel('completions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mission_completions',
        filter: `user_id=eq.${user.id}`
      }, () => {
        loadTodayCompletions()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(missionsChannel)
      supabase.removeChannel(completionsChannel)
    }
  }, [user.id, loadMissions, loadTodayCompletions])

  // 미션 추가 핸들러 메모이제이션
  const handleAddMission = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMission.title.trim()) return

    try {
      const mission = await api.createMission({
        user_id: user.id,
        title: newMission.title,
        category: newMission.category,
        frequency: newMission.frequency,
        sticker: newMission.sticker,
        is_custom: true
      })
      
      setMissions(prev => [...prev, mission])
      setNewMission({ title: '', category: 'physical', frequency: 'daily', sticker: '⭐' })
      setShowAddForm(false)
    } catch (error) {
      alert('미션 추가 오류: ' + (error as Error).message)
    }
  }, [newMission, user.id])

  // 미션 완료/취소 핸들러 메모이제이션
  const handleCompleteMission = useCallback(async (missionId: string) => {
    try {
      const isCompleted = completions.some(c => c.mission_id === missionId)
      
      if (isCompleted) {
        await api.uncompleteMission(user.id, missionId)
        setCompletions(prev => prev.filter(c => c.mission_id !== missionId))
      } else {
        const completion = await api.completeMission(user.id, missionId)
        setCompletions(prev => [...prev, completion])
      }
    } catch (error) {
      alert('미션 상태 변경 오류: ' + (error as Error).message)
    }
  }, [completions, user.id])

  // 미션 삭제 핸들러 메모이제이션
  const handleDeleteMission = useCallback(async (missionId: string) => {
    if (!confirm('이 미션을 삭제하시겠습니까?')) return

    try {
      await api.deleteMission(missionId)
      setMissions(prev => prev.filter(m => m.id !== missionId))
      setCompletions(prev => prev.filter(c => c.mission_id !== missionId))
    } catch (error) {
      alert('미션 삭제 오류: ' + (error as Error).message)
    }
  }, [])

  // 미션 완료 여부 확인 함수 메모이제이션
  const isMissionCompleted = useCallback((missionId: string) => {
    return completions.some(c => c.mission_id === missionId)
  }, [completions])

  // 진행률 계산 메모이제이션
  const progress = useMemo(() => {
    if (missions.length === 0) return 0
    return Math.round((completions.length / missions.length) * 100)
  }, [missions.length, completions.length])

  // 카테고리별 미션 그룹핑 메모이제이션
  const missionsByCategory = useMemo(() => {
    return Object.entries(categories).map(([categoryKey, category]) => ({
      key: categoryKey,
      category,
      missions: missions.filter(m => m.category === categoryKey)
    })).filter(group => group.missions.length > 0)
  }, [missions])

  // 새 미션 입력 핸들러들 메모이제이션
  const handleNewMissionChange = useCallback((field: string, value: string) => {
    setNewMission(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleStickerChange = useCallback((sticker: string) => {
    setNewMission(prev => ({ ...prev, sticker }))
  }, [])

  // 로그아웃 핸들러 메모이제이션
  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  // 폼 토글 핸들러 메모이제이션
  const toggleAddForm = useCallback(() => {
    setShowAddForm(prev => !prev)
  }, [])

  if (loading) {
    return <LoadingSpinner fullScreen size="lg" text="미션을 불러오는 중..." />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Health To-Do</h1>
          <button
            onClick={handleSignOut}
            className="text-gray-600 hover:text-gray-900 text-sm"
          >
            로그아웃
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Progress Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">오늘의 진행률</h2>
            <span className="text-2xl font-bold text-blue-600">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {completions.length} / {missions.length} 미션 완료
          </p>
        </div>

        {/* Add Mission Button */}
        <div className="mb-6">
          <button
            onClick={toggleAddForm}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + 새 미션 추가
          </button>
        </div>

        {/* Add Mission Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <form onSubmit={handleAddMission} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  미션 제목
                </label>
                <input
                  type="text"
                  value={newMission.title}
                  onChange={(e) => handleNewMissionChange('title', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="예: 30분 걷기"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    카테고리
                  </label>
                  <select
                    value={newMission.category}
                    onChange={(e) => handleNewMissionChange('category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(categories).map(([key, cat]) => (
                      <option key={key} value={key}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    빈도
                  </label>
                  <select
                    value={newMission.frequency}
                    onChange={(e) => handleNewMissionChange('frequency', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="daily">매일</option>
                    <option value="weekly">매주</option>
                    <option value="monthly">매월</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    스티커
                  </label>
                  <StickerSelector 
                    selectedSticker={newMission.sticker}
                    onStickerChange={handleStickerChange}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  추가
                </button>
                <button
                  type="button"
                  onClick={toggleAddForm}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Missions by Category */}
        {missionsByCategory.map(({ key, category, missions: categoryMissions }) => (
          <div key={key} className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-4 h-4 rounded-full ${category.color}`}></div>
              <h3 className="text-lg font-semibold text-gray-900">{category.name}</h3>
              <span className="text-sm text-gray-500">({categoryMissions.length})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryMissions.map((mission) => (
                <MissionItem
                  key={mission.id}
                  mission={mission}
                  category={category}
                  isCompleted={isMissionCompleted(mission.id)}
                  onComplete={() => handleCompleteMission(mission.id)}
                  onDelete={() => handleDeleteMission(mission.id)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Empty State */}
        {missions.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">미션이 없습니다</h3>
            <p className="text-gray-600 mb-4">첫 번째 건강 미션을 추가해보세요!</p>
            <button
              onClick={toggleAddForm}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              미션 추가하기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(TodoApp) 
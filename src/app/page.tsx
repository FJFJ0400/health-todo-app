'use client'

import { useEffect, useState } from 'react'
import { supabase, api } from '../../lib/supabase'
import { User } from '@supabase/supabase-js'
import AuthComponent from '../components/Auth'
import TodoApp from '../components/TodoApp'

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 현재 세션 확인
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        try {
          // 기존 세션 있을 때도 프로필 확인/생성
          await api.ensureProfile(session.user)
          setUser(session.user)
        } catch (error) {
          console.error('프로필 생성 실패:', error)
          setUser(session.user) // 프로필 생성 실패해도 로그인 상태는 유지
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    }

    getSession()

    // 인증 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          try {
            // 로그인 시 프로필 자동 생성
            await api.ensureProfile(session.user)
            setUser(session.user)
          } catch (error) {
            console.error('프로필 생성 실패:', error)
            setUser(session.user) // 프로필 생성 실패해도 로그인 상태는 유지
          }
        } else {
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return user ? <TodoApp user={user} /> : <AuthComponent />
}

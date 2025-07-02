'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AuthComponent() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (isSignUp) {
        // 회원가입
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nickname: nickname
            }
          }
        })

        if (error) throw error

        if (data.user && !data.session) {
          setMessage('회원가입이 완료되었습니다! 이메일을 확인해주세요.')
        } else if (data.session) {
          setMessage('회원가입 및 로그인이 완료되었습니다!')
        }
      } else {
        // 로그인
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (error) throw error
        setMessage('로그인 성공!')
      }
    } catch (error: any) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setMessage('')
    
    try {
      console.log('Google 로그인 시도 중...')
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })
      
      console.log('Google 로그인 응답:', { data, error })
      
      if (error) {
        console.error('Google 로그인 에러:', error)
        throw error
      }
      
    } catch (error: any) {
      console.error('Google 로그인 실패:', error)
      setMessage(`Google 로그인 오류: ${error.message}`)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 via-blue-600 to-blue-800">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* 헤더 */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">✨</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Health To-Do
            </h1>
            <p className="text-gray-600">건강한 습관을 만들어가세요</p>
          </div>

          {/* Google 로그인 */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 mb-4 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? '로그인 중...' : 'Google로 계속하기'}
          </button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">또는</span>
            </div>
          </div>

          {/* 탭 전환 */}
          <div className="flex mb-6">
            <button
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-l-lg border ${
                !isSignUp
                  ? 'bg-pink-500 text-white border-pink-500'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              로그인
            </button>
            <button
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-r-lg border ${
                isSignUp
                  ? 'bg-pink-500 text-white border-pink-500'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              회원가입
            </button>
          </div>

          {/* 폼 */}
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                required
              />
            </div>

            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  닉네임
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 transition-all duration-200"
            >
              {loading ? '처리 중...' : isSignUp ? '회원가입' : '로그인'}
            </button>
          </form>

          {message && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${
              message.includes('성공') || message.includes('완료')
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 
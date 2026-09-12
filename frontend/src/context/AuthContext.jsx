import { createContext, useContext, useState, useEffect } from 'react'
import { getMe } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(() => {
    try { return JSON.parse(localStorage.getItem('aegis_user')) } catch { return null }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('aegis_token')
    if (!token) { setLoading(false); return }
    getMe()
      .then(u => { setUser(u); localStorage.setItem('aegis_user', JSON.stringify(u)) })
      .catch(() => { logout() })
      .finally(() => setLoading(false))
  }, [])

  function saveAuth(token, userData) {
    localStorage.setItem('aegis_token', token)
    localStorage.setItem('aegis_user', JSON.stringify(userData))
    setUser(userData)
  }

  function logout() {
    localStorage.removeItem('aegis_token')
    localStorage.removeItem('aegis_user')
    sessionStorage.clear()
    setUser(null)
    window.location.href = '/login'
  }

  // Authenticated = user exists and not suspended
  const isAuthenticated = !!user && user.is_active !== false
  const isPending       = false

  return (
    <AuthContext.Provider value={{
      user, loading, saveAuth, logout,
      isAuthenticated, isPending,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

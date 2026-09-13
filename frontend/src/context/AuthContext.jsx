import { createContext, useContext, useState, useEffect } from 'react'
import { getMe } from '../services/api'

const AuthContext = createContext(null)

function clearStorage() {
  localStorage.removeItem('aegis_token')
  localStorage.removeItem('aegis_user')
  sessionStorage.clear()
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null) // always start null — verify from server
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('aegis_token')
    if (!token) {
      setLoading(false)
      return
    }
    // Verify token is still valid with server
    getMe()
      .then(u => {
        setUser(u)
        localStorage.setItem('aegis_user', JSON.stringify(u))
      })
      .catch(() => {
        // Token expired or invalid — clear everything silently
        // Do NOT redirect — just clear so next login works clean
        clearStorage()
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  function saveAuth(token, userData) {
    // Clear first to ensure no stale data
    clearStorage()
    localStorage.setItem('aegis_token', token)
    localStorage.setItem('aegis_user', JSON.stringify(userData))
    setUser(userData)
  }

  function logout() {
    clearStorage()
    setUser(null)
    // Use replace so browser back button doesn't restore the session
    window.location.replace('/login')
  }

  const isAuthenticated = !!user && user.is_active !== false

  return (
    <AuthContext.Provider value={{
      user, loading, saveAuth, logout, isAuthenticated,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

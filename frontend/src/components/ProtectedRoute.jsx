import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from './Spinner'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-cyber-bg">
      <Spinner size="lg" />
    </div>
  )
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}


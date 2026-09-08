import { useState, useEffect } from 'react'
import { getDashboardStats } from '../services/api'

export function useDashboard() {
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(e => setError(e?.response?.data?.detail ?? 'Failed to load stats'))
      .finally(() => setLoading(false))
  }, [])

  return { stats, loading, error }
}

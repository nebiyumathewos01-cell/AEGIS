import { useState, useEffect, useCallback } from 'react'
import { getAlerts } from '../services/api'

export function useAlerts(params = {}) {
  const [data, setData]       = useState({ total: 0, items: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const key = JSON.stringify(params)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getAlerts(params)
      setData(res)
    } catch (e) {
      setError(e?.response?.data?.detail ?? 'Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [key]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  return { data, loading, error, refresh: load }
}

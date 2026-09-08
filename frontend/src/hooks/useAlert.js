import { useState, useEffect, useCallback } from 'react'
import { getAlert } from '../services/api'

export function useAlert(id) {
  const [alert, setAlert]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await getAlert(id)
      setAlert(res)
    } catch (e) {
      setError(e?.response?.data?.detail ?? 'Failed to load alert')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  return { alert, loading, error, refresh: load }
}

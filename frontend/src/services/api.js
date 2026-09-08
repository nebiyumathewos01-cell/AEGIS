import axios from 'axios'

// In production (Vercel), VITE_API_URL is set to your Railway backend URL.
// In development, Vite proxy handles /api → localhost:8000.
const BASE = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: `${BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
})

// ── Alerts ────────────────────────────────────────────────────────────────────
export const getAlerts = (params = {}) =>
  api.get('/alerts', { params }).then(r => r.data)

export const getAlert = (id) =>
  api.get(`/alerts/${id}`).then(r => r.data)

export const submitAlert = (payload) =>
  api.post('/alerts', payload).then(r => r.data)

export const uploadAlertFile = (file, source = 'generic') => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post(`/alerts/upload?source=${source}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const analyzeAlert = (id) =>
  api.post(`/alerts/${id}/analyze`).then(r => r.data)

export const updateAlertStatus = (id, status) =>
  api.put(`/alerts/${id}/status`, { status }).then(r => r.data)

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getDashboardStats = () =>
  api.get('/dashboard/stats').then(r => r.data)

// ── Demo ──────────────────────────────────────────────────────────────────────
export const getDemoScenarios = () =>
  api.get('/demo/scenarios').then(r => r.data)

export const loadDemoScenario = (id) =>
  api.post(`/demo/scenarios/${id}/load`).then(r => r.data)

export const getDemoRaw = (id) =>
  api.get(`/demo/scenarios/${id}/raw`).then(r => r.data)

// ── Investigations ────────────────────────────────────────────────────────────
export const addNote = (alertId, payload) =>
  api.post(`/investigations/${alertId}/notes`, payload).then(r => r.data)

// ── Threat Intelligence ───────────────────────────────────────────────────────
export const lookupIOC = (ioc) =>
  api.post('/threat-intelligence/ip', { ioc }).then(r => r.data)

// ── Reports ───────────────────────────────────────────────────────────────────
export const getReportData = (id) =>
  api.get(`/reports/${id}`).then(r => r.data)

export default api

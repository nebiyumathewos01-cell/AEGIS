import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: `${BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('aegis_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-logout on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      // Only redirect if it's NOT a login/register attempt
      const url = err.config?.url || ''
      const isAuthAttempt = url.includes('/auth/login') || url.includes('/auth/register')
      if (!isAuthAttempt) {
        localStorage.removeItem('aegis_token')
        localStorage.removeItem('aegis_user')
        sessionStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const register = (data) =>
  api.post('/auth/register', data).then(r => r.data)

export const login = (data) =>
  api.post('/auth/login/json', data).then(r => r.data)

export const getMe = () =>
  api.get('/auth/me').then(r => r.data)

// ── Agent ─────────────────────────────────────────────────────────────────────
export const runAgentInvestigation = (alertId) =>
  api.post(`/agent/${alertId}/investigate`).then(r => r.data)

export const getAgentStatus = (alertId) =>
  api.get(`/agent/${alertId}/status`).then(r => r.data)
export const getEnvironmentProfile = () =>
  api.get('/environment').then(r => r.data)

export const saveEnvironmentProfile = (data) =>
  api.put('/environment', data).then(r => r.data)

// ── Playbook ──────────────────────────────────────────────────────────────────
export const generatePlaybook  = (alertId) =>
  api.post(`/playbook/${alertId}/generate`).then(r => r.data)

export const getPlaybook       = (alertId) =>
  api.get(`/playbook/${alertId}`).then(r => r.data)

export const updatePlaybookStep = (alertId, stepNumber, status) =>
  api.put(`/playbook/${alertId}/steps`, { step_number: stepNumber, status }).then(r => r.data)

// ── Analysis with language ────────────────────────────────────────────────────
export const analyzeAlertLang = (id, language = 'en') =>
  api.post(`/alerts/${id}/analyze?language=${language}`).then(r => r.data)

// ── Sources ───────────────────────────────────────────────────────────────────
export const getAlertSources = () =>
  api.get('/alerts/sources').then(r => r.data)

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

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminSetup    = (data) => api.post('/admin/setup', data).then(r => r.data)
export const getAdminStats = () => api.get('/admin/stats').then(r => r.data)
export const getAdminUsers = (status) =>
  api.get('/admin/users', { params: status ? { status } : {} }).then(r => r.data)
export const approveUser   = (id) => api.put(`/admin/users/${id}/approve`).then(r => r.data)
export const rejectUser    = (id) => api.put(`/admin/users/${id}/reject`).then(r => r.data)
export const suspendUser   = (id) => api.put(`/admin/users/${id}/suspend`).then(r => r.data)
export const unsuspendUser = (id) => api.put(`/admin/users/${id}/unsuspend`).then(r => r.data)

// ── Audit ─────────────────────────────────────────────────────────────────────
export const getAuditLogs = (params = {}) =>
  api.get('/audit/logs', { params }).then(r => r.data)

export const getAuditSummary = () =>
  api.get('/audit/summary').then(r => r.data)

// ── Demo ──────────────────────────────────────────────────────────────────────
export const getDemoScenarios = () =>
  api.get('/demo/scenarios').then(r => r.data)

export const loadDemoScenario = (id) =>
  api.post(`/demo/scenarios/${id}/load`).then(r => r.data)

export const loadAllScenarios = () =>
  api.post('/demo/load-all').then(r => r.data)

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

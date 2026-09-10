import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Alerts from './pages/Alerts'
import AlertDetail from './pages/AlertDetail'
import NewAlert from './pages/NewAlert'
import ThreatIntelligence from './pages/ThreatIntelligence'
import Investigations from './pages/Investigations'
import Reports from './pages/Reports'
import AuditLog from './pages/AuditLog'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={
            <ProtectedRoute><Layout /></ProtectedRoute>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"           element={<Dashboard />} />
            <Route path="alerts"              element={<Alerts />} />
            <Route path="alerts/new"          element={<NewAlert />} />
            <Route path="alerts/:id"          element={<AlertDetail />} />
            <Route path="investigations"      element={<Investigations />} />
            <Route path="threat-intelligence" element={<ThreatIntelligence />} />
            <Route path="reports/:id"         element={<Reports />} />
            <Route path="audit"               element={<AuditLog />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

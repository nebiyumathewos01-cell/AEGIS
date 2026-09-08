import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Alerts from './pages/Alerts'
import AlertDetail from './pages/AlertDetail'
import NewAlert from './pages/NewAlert'
import ThreatIntelligence from './pages/ThreatIntelligence'
import Investigations from './pages/Investigations'
import Reports from './pages/Reports'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="alerts/new" element={<NewAlert />} />
          <Route path="alerts/:id" element={<AlertDetail />} />
          <Route path="investigations" element={<Investigations />} />
          <Route path="threat-intelligence" element={<ThreatIntelligence />} />
          <Route path="reports/:id" element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

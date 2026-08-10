import { Navigate, Route, Routes } from 'react-router'
import { BrandPage } from '../pages/BrandPage/BrandPage'
import { LoginPage } from '../pages/LoginPage/LoginPage'
import { ProtectedRoute } from './ProtectedRoute'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/brand" element={<ProtectedRoute><BrandPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

import { Navigate, Route, Routes } from 'react-router'
import { LoginPage } from '../pages/LoginPage/LoginPage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/brand" element={<h1>Configuração da marca</h1>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

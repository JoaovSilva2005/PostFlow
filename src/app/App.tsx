import { Navigate, Route, Routes } from 'react-router'
import { BrandPage } from '../pages/BrandPage/BrandPage'
import { CalendarPage } from '../pages/CalendarPage/CalendarPage'
import { ChatPage } from '../pages/ChatPage/ChatPage'
import { LoginPage } from '../pages/LoginPage/LoginPage'
import { ProtectedRoute } from './ProtectedRoute'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/brand"
        element={
          <ProtectedRoute>
            <BrandPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <CalendarPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

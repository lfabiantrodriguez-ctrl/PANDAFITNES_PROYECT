import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { getStoredSession, saveStoredSession, clearStoredSession } from './utils/session'
import { ConfigService } from './services/ConfigService'
import PublicHome from './pages/PublicHome'
import ProtectedApp from './layouts/ProtectedApp'

function App() {
  const storedSession = useMemo(() => getStoredSession(), [])
  const [token, setToken] = useState(storedSession.token)
  const [user, setUser] = useState(storedSession.user)

  useEffect(() => {
    // Inicializar branding dinámico (título y favicon de la pestaña)
    ConfigService.getConfig().catch(() => {})
  }, [])

  const saveSession = useCallback((nextToken, nextUser) => {
    saveStoredSession(nextToken, nextUser)
    setToken(nextToken)
    setUser(nextUser)
  }, [])

  const logout = useCallback(() => {
    clearStoredSession()
    setToken(null)
    setUser(null)
  }, [])

  return (
    <Routes>
      <Route
        path="/"
        element={<PublicHome onLogin={saveSession} token={token} user={user} />}
      />
      <Route
        path="/login"
        element={<PublicHome onLogin={saveSession} token={token} user={user} initialLoginOpen={true} />}
      />
      <Route
        path="/app/*"
        element={
          <ProtectedApp token={token} user={user} onLogout={logout} setUser={setUser} />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App

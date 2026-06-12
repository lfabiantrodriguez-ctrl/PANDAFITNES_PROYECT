import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { getStoredSession, saveStoredSession, clearStoredSession } from './utils/session'
import PublicHome from './pages/PublicHome'
import LoginPage from './pages/LoginPage'
import ProtectedApp from './layouts/ProtectedApp'

function App() {
  const storedSession = useMemo(() => getStoredSession(), [])
  const [token, setToken] = useState(storedSession.token)
  const [user, setUser] = useState(storedSession.user)

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
      <Route path="/" element={<PublicHome />} />
      <Route
        path="/login"
        element={<LoginPage onLogin={saveSession} token={token} user={user} />}
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

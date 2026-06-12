import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { AuthService } from '../services/AuthService'
import AppLayout from './AppLayout'

export default function ProtectedApp({ token, user, onLogout, setUser }) {
  const location = useLocation()

  useEffect(() => {
    async function refreshSession() {
      if (!token) {
        return
      }

      try {
        const data = await AuthService.getMe(token)
        localStorage.setItem('panda_user', JSON.stringify(data.user))
        setUser(data.user)
      } catch {
        onLogout()
      }
    }

    refreshSession()
  }, [token, onLogout, setUser])

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <AppLayout token={token} user={user} onLogout={onLogout} />
}

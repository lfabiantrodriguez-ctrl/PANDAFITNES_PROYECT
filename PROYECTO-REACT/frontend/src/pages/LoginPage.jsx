import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AuthService } from '../services/AuthService'

export const ROLE_HOME = {
  admin: '/app/check-in',
  cliente: '/app/aforo',
}

export default function LoginPage({ onLogin, token, user }) {
  const navigate = useNavigate()
  const [dni, setDni] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState({ loading: false, error: '' })

  if (token && user) {
    return <Navigate to={ROLE_HOME[user.rol] || '/app/perfil'} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus({ loading: true, error: '' })

    try {
      const data = await AuthService.login(dni, password)
      onLogin(data.token, data.user)
      navigate(ROLE_HOME[data.user.rol] || '/app/perfil', { replace: true })
    } catch (error) {
      setStatus({ loading: false, error: error.message })
      return
    }

    setStatus({ loading: false, error: '' })
  }

  return (
    <main className="login-page">
      <section className="login-container">
        <button className="back-link" type="button" onClick={() => navigate('/')}>
          Volver al inicio
        </button>
        <div className="login-logo">PANDA<span>FITNESS</span></div>
        <div className="login-tagline">Plataforma de Control Operativo Integral</div>

        <form onSubmit={handleSubmit}>
          <div className="form-element">
            <label className="element-label" htmlFor="dni">DNI</label>
            <input
              id="dni"
              className="input-field"
              type="text"
              inputMode="numeric"
              value={dni}
              onChange={(event) => setDni(event.target.value)}
              placeholder="Ingrese su DNI"
              required
            />
          </div>

          <div className="form-element">
            <label className="element-label" htmlFor="password">Contrasena</label>
            <input
              id="password"
              className="input-field"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Ingrese su contrasena"
              required
            />
          </div>

          {status.error && <p className="form-error">{status.error}</p>}

          <button className="action-btn btn-dark btn-full" type="submit" disabled={status.loading}>
            {status.loading ? 'Validando...' : 'Ingresar de Forma Segura'}
          </button>
        </form>
      </section>
    </main>
  )
}

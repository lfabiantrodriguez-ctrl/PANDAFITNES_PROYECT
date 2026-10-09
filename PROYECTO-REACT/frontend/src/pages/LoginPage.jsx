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
  const [status, setStatus] = useState({ loading: false })
  const [errors, setErrors] = useState({})

  if (token && user) {
    return <Navigate to={ROLE_HOME[user.rol] || '/app/perfil'} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const newErrors = {}
    if (!dni.trim()) {
      newErrors.dni = 'Por favor ingrese su número de DNI'
    } else if (!/^\d{8}$/.test(dni.trim())) {
      newErrors.dni = 'El DNI debe tener exactamente 8 dígitos numéricos'
    }

    if (!password) {
      newErrors.password = 'Por favor ingrese su contraseña'
    } else if (password.length < 6) {
      newErrors.password = 'La contraseña debe contener al menos 6 caracteres'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setStatus({ loading: true })
    setErrors({})

    try {
      const data = await AuthService.login(dni.trim(), password)
      onLogin(data.token, data.user)
      navigate(ROLE_HOME[data.user.rol] || '/app/perfil', { replace: true })
    } catch (error) {
      const msg = error.message || 'Error al iniciar sesión'
      setStatus({ loading: false })
      const lower = msg.toLowerCase()
      if (lower.includes('dni') || lower.includes('usuario') || lower.includes('no encontrado') || lower.includes('no existe')) {
        setErrors({ dni: msg })
      } else if (lower.includes('contrase') || lower.includes('password') || lower.includes('credenciales')) {
        setErrors({ password: msg })
      } else {
        setErrors({ dni: 'Verifique los datos ingresados', password: msg })
      }
      return
    }

    setStatus({ loading: false })
  }

  return (
    <main className="login-page">
      <section className="login-container">
        <button className="back-link" type="button" onClick={() => navigate('/')}>
          Volver al inicio
        </button>
        <div className="login-logo">PANDA<span>FITNESS</span></div>
        <div className="login-tagline">Plataforma de Control Operativo Integral</div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-element" style={{ marginBottom: '16px' }}>
            <label className="element-label" htmlFor="dni">DNI</label>
            <input
              id="dni"
              className={`input-field ${errors.dni ? 'is-invalid' : ''}`}
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={dni}
              onChange={(event) => {
                const val = event.target.value.replace(/\D/g, '').slice(0, 8)
                setDni(val)
                setErrors((prev) => ({ ...prev, dni: '' }))
              }}
              placeholder="Ingrese su DNI (8 dígitos)"
              style={errors.dni ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
            />
            {errors.dni && (
              <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.8rem', color: '#dc2626' }}>
                <i className="bi bi-exclamation-circle-fill"></i>
                <span>{errors.dni}</span>
              </div>
            )}
          </div>

          <div className="form-element" style={{ marginBottom: '16px' }}>
            <label className="element-label" htmlFor="password">Contraseña</label>
            <input
              id="password"
              className={`input-field ${errors.password ? 'is-invalid' : ''}`}
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setErrors((prev) => ({ ...prev, password: '' }))
              }}
              placeholder="Ingrese su contraseña"
              style={errors.password ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
            />
            {errors.password && (
              <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.8rem', color: '#dc2626' }}>
                <i className="bi bi-exclamation-circle-fill"></i>
                <span>{errors.password}</span>
              </div>
            )}
          </div>

          <button className="action-btn btn-dark btn-full" type="submit" disabled={status.loading} style={{ marginTop: '8px' }}>
            {status.loading ? 'Validando...' : 'Ingresar de Forma Segura'}
          </button>
        </form>
      </section>
    </main>
  )
}

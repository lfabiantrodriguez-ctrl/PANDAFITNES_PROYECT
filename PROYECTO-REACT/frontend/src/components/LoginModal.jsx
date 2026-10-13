import {homeFor} from '../utils/access'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthService } from '../services/AuthService'
import {createBackdropGesture} from '../utils/modalBackdrop'

export const ROLE_HOME = {
  admin: '/app/check-in',
  cliente: '/app/aforo',
}

export default function LoginModal({ isOpen, onClose, onLogin, initialDni = '' }) {
  const navigate = useNavigate()
  const [backdrop] = useState(createBackdropGesture)
  useEffect(() => { backdrop.reset() }, [isOpen, backdrop])
  
  // Modos del modal: 'login' | 'forgot_step1' | 'forgot_step2'
  const [viewMode, setViewMode] = useState('login')

  // Estado de Login
  const [dni, setDni] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberUser, setRememberUser] = useState(false)

  // Estado de Recuperar Contraseña
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [maskedEmail, setMaskedEmail] = useState('')

  // Estado de feedback y errores por casillero
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })
  const [fieldErrors, setFieldErrors] = useState({})

  // Configuración de empresa
  const [logoSrc, setLogoSrc] = useState('/logo-panda.png')
  const [companyName, setCompanyName] = useState('Panda Fitness')

  useEffect(() => {
    fetch('/api/configuracion')
      .then((res) => res.json())
      .then((data) => {
        if (data.empresa_logo) setLogoSrc(data.empresa_logo)
        if (data.empresa_nombre) setCompanyName(data.empresa_nombre)
      })
      .catch(() => {})

    function handleConfigUpdated(event) {
      if (event.detail) {
        if (event.detail.empresa_logo) setLogoSrc(event.detail.empresa_logo)
        if (event.detail.empresa_nombre) setCompanyName(event.detail.empresa_nombre)
      }
    }
    window.addEventListener('panda_config_updated', handleConfigUpdated)
    return () => window.removeEventListener('panda_config_updated', handleConfigUpdated)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setViewMode('login')
      const savedDni = localStorage.getItem('panda_remembered_dni')
      if (savedDni) {
        setDni(savedDni)
        setRememberUser(true)
      } else if (initialDni) {
        setDni(initialDni)
      }
      setStatus({ loading: false, error: '', success: '' })
      setFieldErrors({})
    }
  }, [isOpen, initialDni])

  // Cerrar con tecla Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Iniciar sesión tradicional
  async function handleLoginSubmit(event) {
    event.preventDefault()
    const errors = {}
    if (!dni.trim()) {
      errors.dni = 'Ingresa tu DNI'
    }
    if (!password) {
      errors.password = 'Ingresa tu contraseña'
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setStatus({ loading: true, error: '', success: '' })

    try {
      const data = await AuthService.login(dni, password)
      
      if (rememberUser) {
        localStorage.setItem('panda_remembered_dni', dni.trim())
        localStorage.setItem('panda_remember_user', 'true')
      } else {
        localStorage.removeItem('panda_remembered_dni')
        localStorage.removeItem('panda_remember_user')
      }

      onLogin(data.token, data.user)
      onClose()
      navigate(homeFor(data.user), { replace: true })
    } catch (error) {
      const msg = error.message || 'Error al iniciar sesión'
      const lower = msg.toLowerCase()
      if (lower.includes('usuario no encontrado') || lower.includes('no registrado') || lower.includes('no existe')) {
        setFieldErrors({ dni: 'No encontramos ninguna cuenta con este DNI' })
      } else if (lower.includes('contraseña') || lower.includes('password') || lower.includes('incorrecta')) {
        setFieldErrors({ password: 'Contraseña incorrecta. Verifica mayúsculas y minúsculas.' })
      } else if (lower.includes('credenciales')) {
        setFieldErrors({ password: 'Credenciales inválidas. Verifica tu usuario y contraseña.' })
      } else {
        setFieldErrors({ general: msg })
      }
      setStatus({ loading: false, error: '', success: '' })
    }
  }

  // Paso 1: Solicitar código de recuperación
  async function handleRequestCode(e) {
    e.preventDefault()
    const errors = {}
    if (!recoveryIdentifier.trim()) {
      errors.recoveryIdentifier = 'Ingresa tu DNI (8 dígitos) o correo electrónico registrado'
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setStatus({ loading: true, error: '', success: '' })
    try {
      const res = await AuthService.forgotPassword(recoveryIdentifier)
      setMaskedEmail(res.emailMasked || recoveryIdentifier)
      setStatus({ loading: false, error: '', success: `Código enviado a ${res.emailMasked || 'tu correo'}` })
      setViewMode('forgot_step2')
    } catch (err) {
      const msg = err.message || 'Error al solicitar el código'
      const lower = msg.toLowerCase()
      if (lower.includes('no encontrado') || lower.includes('no existe') || lower.includes('usuario')) {
        setFieldErrors({ recoveryIdentifier: 'No existe ninguna cuenta registrada con este DNI o correo' })
      } else {
        setFieldErrors({ recoveryIdentifier: msg })
      }
      setStatus({ loading: false, error: '', success: '' })
    }
  }

  // Paso 2: Restablecer contraseña con código
  async function handleResetPassword(e) {
    e.preventDefault()
    const errors = {}
    if (!recoveryCode || recoveryCode.length < 6) {
      errors.recoveryCode = 'El código de seguridad debe tener 6 dígitos numéricos'
    }
    if (!newPassword || newPassword.length < 8) {
      errors.newPassword = 'La contraseña debe tener al menos 8 caracteres'
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      errors.newPassword = 'Debe incluir al menos una mayúscula, una minúscula y un número'
    }
    if (!confirmPassword) {
      errors.confirmPassword = 'Por favor confirma la contraseña'
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Las contraseñas no coinciden'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setStatus({ loading: true, error: '', success: '' })
    try {
      const res = await AuthService.resetPassword(recoveryIdentifier, recoveryCode, newPassword)
      setStatus({ loading: false, error: '', success: res.message || 'Contraseña actualizada. Inicia sesión.' })
      setPassword('')
      setTimeout(() => {
        setViewMode('login')
      }, 1500)
    } catch (err) {
      const msg = err.message || 'Error al restablecer contraseña'
      const lower = msg.toLowerCase()
      if (lower.includes('código') || lower.includes('codigo') || lower.includes('expirado') || lower.includes('inválido') || lower.includes('invalido')) {
        setFieldErrors({ recoveryCode: 'Código incorrecto o expirado. Verifica el código enviado.' })
      } else {
        setFieldErrors({ newPassword: msg })
      }
      setStatus({ loading: false, error: '', success: '' })
    }
  }

  return (
    <div className="plm-overlay"
      onPointerDownCapture={backdrop.pointerDown}
      onPointerMoveCapture={backdrop.pointerMove}
      onPointerUpCapture={backdrop.pointerUp}
      onPointerCancel={backdrop.reset}
      onClick={event=>{if(backdrop.shouldDismiss(event))onClose()}}
      role="dialog" aria-modal="true" aria-labelledby="plm-login-title">
      <div className="plm-card" onClick={(e) => e.stopPropagation()}>
        {/* Botón cerrar */}
        <button className="plm-close-btn" onClick={onClose} type="button" aria-label="Cerrar modal">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        {/* Encabezado con Logo oficial del Panda musculoso */}
        <div className="plm-header-container">
          <div className="plm-logo-badge">
            <img
              src={logoSrc}
              alt="Logo Panda Fitness"
              className="plm-logo-image"
              onError={(e) => {
                e.target.onerror = null
                e.target.src = '/logo-panda.png'
              }}
            />
          </div>

          <div className="plm-status-pill">
            <span className="plm-pulse-dot"></span>
            <span>
              {viewMode === 'login' ? 'Acceso al Sistema' : 'Recuperar Contraseña'}
            </span>
          </div>

          <h2 id="plm-login-title" className="plm-main-title">
            {(() => {
              const parts = (companyName || 'Panda Fitness').trim().split(/\s+/)
              if (parts.length === 1) return parts[0]
              return (
                <>
                  {parts[0]}<span>{parts.slice(1).join(' ')}</span>
                </>
              )
            })()}
          </h2>

          <p className="plm-sub-text">
            {viewMode === 'login' && 'Ingresa con tu DNI y contraseña'}
            {viewMode === 'forgot_step1' && 'Ingresa tu DNI o correo para enviarte un código de seguridad'}
            {viewMode === 'forgot_step2' && `Ingresa el código enviado a ${maskedEmail}`}
          </p>
        </div>

        {/* Feedback de Éxito / Error General */}
        {status.success && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '11px 14px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: '12px',
            color: '#065f46',
            fontSize: '0.86rem',
            fontWeight: 600,
            marginBottom: '16px',
          }}>
            <span>✓ {status.success}</span>
          </div>
        )}

        {fieldErrors.general && (
          <div className="plm-error-banner" style={{ marginBottom: '16px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{fieldErrors.general}</span>
          </div>
        )}

        {/* =======================================================
            VISTA 1: INICIO DE SESIÓN
            ======================================================= */}
        {viewMode === 'login' && (
          <>
            <form onSubmit={handleLoginSubmit} className="plm-form-body">
              {/* Campo DNI */}
              <div className="plm-field-group">
                <label htmlFor="plm-input-dni" className="plm-field-label">
                  DNI
                </label>
                <div className="plm-input-wrapper">
                  <span className="plm-input-icon">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </span>
                  <input
                    id="plm-input-dni"
                    className="plm-text-input"
                    type="text"
                    value={dni}
                    onChange={(e) => {
                      setDni(e.target.value)
                      if (fieldErrors.dni) setFieldErrors(prev => ({ ...prev, dni: '' }))
                    }}
                    placeholder="Ingresa tu DNI"
                    autoFocus
                    style={fieldErrors.dni ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                  />
                </div>
                {fieldErrors.dni && (
                  <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <i className="bi bi-exclamation-circle-fill"></i>
                    <span>{fieldErrors.dni}</span>
                  </div>
                )}
              </div>

              {/* Campo Contraseña */}
              <div className="plm-field-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="plm-input-password" className="plm-field-label">
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('forgot_step1')
                      setRecoveryIdentifier(dni)
                      setStatus({ loading: false, error: '', success: '' })
                      setFieldErrors({})
                    }}
                    style={{
                      background: 'none',
                      border: 0,
                      color: '#166534',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="plm-input-wrapper">
                  <span className="plm-input-icon">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </span>
                  <input
                    id="plm-input-password"
                    className="plm-text-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }))
                    }}
                    placeholder="Ingresa tu contraseña"
                    style={fieldErrors.password ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                  />
                  <button
                    type="button"
                    className="plm-eye-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? (
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
                {fieldErrors.password && (
                  <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <i className="bi bi-exclamation-circle-fill"></i>
                    <span>{fieldErrors.password}</span>
                  </div>
                )}
              </div>

              {/* Opción: Recordar mi usuario */}
              <div className="plm-options-row">
                <label className="plm-remember-checkbox">
                  <input
                    type="checkbox"
                    id="plm-remember"
                    checked={rememberUser}
                    onChange={(e) => setRememberUser(e.target.checked)}
                  />
                  <span className="plm-custom-check">
                    {rememberUser && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </span>
                  <span className="plm-remember-text">Recordar mi usuario</span>
                </label>
              </div>

              {/* Botón de Ingreso */}
              <button
                className="plm-submit-button"
                type="submit"
                disabled={status.loading}
              >
                {status.loading ? (
                  <span className="plm-loading-content">
                    <span className="plm-loading-spinner"></span>
                    Validando acceso...
                  </span>
                ) : (
                  <span>Entrar al Sistema</span>
                )}
              </button>
            </form>
          </>
        )}

        {/* =======================================================
            VISTA 2: RECUPERAR CONTRASEÑA - PASO 1 (SOLICITAR CÓDIGO)
            ======================================================= */}
        {viewMode === 'forgot_step1' && (
          <form onSubmit={handleRequestCode} className="plm-form-body">
            <div className="plm-field-group">
              <label htmlFor="recovery-id" className="plm-field-label">
                DNI Registrado
              </label>
              <div className="plm-input-wrapper">
                <span className="plm-input-icon">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                </span>
                <input
                  id="recovery-id"
                  className="plm-text-input"
                  type="text"
                  value={recoveryIdentifier}
                  onChange={(e) => {
                    setRecoveryIdentifier(e.target.value)
                    if (fieldErrors.recoveryIdentifier) setFieldErrors(prev => ({ ...prev, recoveryIdentifier: '' }))
                  }}
                  placeholder="Ej. 00000000 o correo@gmail.com"
                  autoFocus
                  style={fieldErrors.recoveryIdentifier ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                />
              </div>
              {fieldErrors.recoveryIdentifier && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{fieldErrors.recoveryIdentifier}</span>
                </div>
              )}
            </div>

            <button
              className="plm-submit-button"
              type="submit"
              disabled={status.loading}
            >
              {status.loading ? (
                <span className="plm-loading-content">
                  <span className="plm-loading-spinner"></span>
                  Enviando código...
                </span>
              ) : (
                <span>Enviar Código de Seguridad</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setViewMode('login'); setStatus({ loading: false, error: '', success: '' }); setFieldErrors({}) }}
              style={{
                background: 'none',
                border: 0,
                color: '#64748b',
                fontSize: '0.88rem',
                cursor: 'pointer',
                textAlign: 'center',
                marginTop: '4px',
                fontWeight: 600,
              }}
            >
              ← Volver al Inicio de Sesión
            </button>
          </form>
        )}

        {/* =======================================================
            VISTA 3: RECUPERAR CONTRASEÑA - PASO 2 (INGRESAR CÓDIGO Y NUEVA CLAVE)
            ======================================================= */}
        {viewMode === 'forgot_step2' && (
          <form onSubmit={handleResetPassword} className="plm-form-body">
            {/* Código de 6 dígitos */}
            <div className="plm-field-group">
              <label htmlFor="recovery-code" className="plm-field-label">
                Código de 6 dígitos
              </label>
              <div className="plm-input-wrapper">
                <input
                  id="recovery-code"
                  className="plm-text-input"
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  value={recoveryCode}
                  onChange={(e) => {
                    setRecoveryCode(e.target.value.replace(/\D/g, ''))
                    if (fieldErrors.recoveryCode) setFieldErrors(prev => ({ ...prev, recoveryCode: '' }))
                  }}
                  placeholder="123456"
                  autoFocus
                  style={{
                    textAlign: 'center',
                    letterSpacing: '6px',
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    ...(fieldErrors.recoveryCode ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {})
                  }}
                />
              </div>
              {fieldErrors.recoveryCode && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{fieldErrors.recoveryCode}</span>
                </div>
              )}
            </div>

            {/* Nueva Contraseña */}
            <div className="plm-field-group">
              <label htmlFor="recovery-new-pwd" className="plm-field-label">
                Nueva Contraseña
              </label>
              <div className="plm-input-wrapper">
                <input
                  id="recovery-new-pwd"
                  className="plm-text-input"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value)
                    if (fieldErrors.newPassword) setFieldErrors(prev => ({ ...prev, newPassword: '' }))
                  }}
                  placeholder="Mínimo 8 caracteres (mayús, minús, número)"
                  style={fieldErrors.newPassword ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                />
                <button
                  type="button"
                  className="plm-eye-toggle"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? '👁️' : '🔒'}
                </button>
              </div>
              {fieldErrors.newPassword && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{fieldErrors.newPassword}</span>
                </div>
              )}
            </div>

            {/* Confirmar Nueva Contraseña */}
            <div className="plm-field-group">
              <label htmlFor="recovery-confirm-pwd" className="plm-field-label">
                Confirmar Contraseña
              </label>
              <div className="plm-input-wrapper">
                <input
                  id="recovery-confirm-pwd"
                  className="plm-text-input"
                  type={showNewPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    if (fieldErrors.confirmPassword) setFieldErrors(prev => ({ ...prev, confirmPassword: '' }))
                  }}
                  placeholder="Repite la nueva contraseña"
                  style={fieldErrors.confirmPassword ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                />
              </div>
              {fieldErrors.confirmPassword && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{fieldErrors.confirmPassword}</span>
                </div>
              )}
            </div>

            <button
              className="plm-submit-button"
              type="submit"
              disabled={status.loading}
            >
              {status.loading ? (
                <span className="plm-loading-content">
                  <span className="plm-loading-spinner"></span>
                  Actualizando...
                </span>
              ) : (
                <span>Restablecer Contraseña</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setViewMode('forgot_step1'); setStatus({ loading: false, error: '', success: '' }); setFieldErrors({}) }}
              style={{
                background: 'none',
                border: 0,
                color: '#64748b',
                fontSize: '0.88rem',
                cursor: 'pointer',
                textAlign: 'center',
                marginTop: '4px',
                fontWeight: 600,
              }}
            >
              ← Solicitar otro código
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

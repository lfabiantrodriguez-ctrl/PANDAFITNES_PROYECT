import { useEffect, useState } from 'react'
import ViewTitle from '../components/ViewTitle'
import { ProfileService } from '../services/ProfileService'
import { MembershipService } from '../services/MembershipService'
import { saveStoredSession } from '../utils/session'
import { formatDate } from '../utils/formatters'

function PasswordInput({ value, onChange, label, showState, onToggle }) {
    return (
      <div className="form-element">
        <label className="element-label">{label}</label>
        <div className="pwd-input-wrapper">
          <input
            className="input-field"
            type={showState ? 'text' : 'password'}
            value={value}
            onChange={onChange}
            required
          />
          <button
            type="button"
            className="pwd-toggle-btn"
            onClick={onToggle}
            tabIndex={-1}
            aria-label={showState ? 'Ocultar contrasena' : 'Mostrar contrasena'}
          >
            {showState ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      </div>
    )
  }

export default function ProfileView({ user, token, setUser }) {
  const [editing, setEditing] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [showCurrentPwd, setShowCurrentPwd] = useState(false)
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  const [membership, setMembership] = useState(null)
  const [payments, setPayments] = useState([])
  const [loadingMembership, setLoadingMembership] = useState(false)

  const [form, setForm] = useState({
    nombre: user.nombre,
    apellido: user.apellido,
    email: user.email,
    telefono: user.telefono || '',
  })

  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  useEffect(() => {
    if (user.rol === 'cliente') {
      setLoadingMembership(true)
      Promise.all([
        MembershipService.getMyMembership(token),
        MembershipService.getMyPayments(token),
      ])
        .then(([memData, payData]) => {
          if (memData.membership) setMembership(memData.membership)
          if (payData.payments) setPayments(payData.payments)
        })
        .catch(() => {})
        .finally(() => setLoadingMembership(false))
    }
  }, [token, user.rol])

  function updateField(field, value) {
    setForm((c) => ({ ...c, [field]: value }))
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  }

  function isValidPhone(value) {
    return value === '' || /^\d{7,15}$/.test(value)
  }

  async function saveProfile(e) {
    e.preventDefault()
    setProcessing(true)
    setMessage('')
    setMessageType('')

    if (!form.nombre.trim() || !form.apellido.trim()) {
      setMessage('Nombre y apellido son obligatorios')
      setMessageType('error')
      setProcessing(false)
      return
    }

    if (!form.email.trim() || !isValidEmail(form.email)) {
      setMessage('Ingrese un correo valido')
      setMessageType('error')
      setProcessing(false)
      return
    }

    if (!isValidPhone(form.telefono)) {
      setMessage('Telefono debe contener entre 7 y 15 digitos numericos')
      setMessageType('error')
      setProcessing(false)
      return
    }

    try {
      const res = await ProfileService.updateProfile(token, form)
      const updatedUser = res.user
      saveStoredSession(token, updatedUser)
      if (setUser) setUser(updatedUser)
      setMessage('Perfil actualizado correctamente. Se ha enviado una notificacion a tu correo.')
      setMessageType('success')
      setEditing(false)
    } catch (err) {
      setMessage(err.message)
      setMessageType('error')
    } finally {
      setProcessing(false)
    }
  }

  async function changePassword(e) {
    e.preventDefault()
    setProcessing(true)
    setMessage('')
    setMessageType('')

    if (!pwd.currentPassword || !pwd.newPassword || !pwd.confirmPassword) {
      setMessage('Complete todos los campos de contrasena')
      setMessageType('error')
      setProcessing(false)
      return
    }

    if (pwd.newPassword !== pwd.confirmPassword) {
      setMessage('La nueva contrasena y su confirmacion no coinciden')
      setMessageType('error')
      setProcessing(false)
      return
    }

    if (pwd.newPassword.length < 6) {
      setMessage('La nueva contrasena debe tener al menos 6 caracteres')
      setMessageType('error')
      setProcessing(false)
      return
    }

    try {
      await ProfileService.changePassword(token, {
        currentPassword: pwd.currentPassword,
        newPassword: pwd.newPassword,
      })
      setMessage('Contrasena actualizada correctamente. Se ha enviado una notificacion a tu correo.')
      setMessageType('success')
      setPwd({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      setMessage(err.message)
      setMessageType('error')
    } finally {
      setProcessing(false)
    }
  }

  

  return (
    <>
      <ViewTitle
        title="Perfil de Usuario"
        text="Informacion principal de la cuenta autenticada en Panda Fitness."
      />

      {message && (
        <div className={`system-notice compact-notice ${messageType === 'error' ? 'notice-error' : ''}`}>
          {message}
        </div>
      )}

      <div className="profile-modern-grid">
        <div className="profile-modern-section">
          <div className="profile-modern-header">
            <div className="profile-avatar">
              <span>{user.nombre.charAt(0)}{user.apellido.charAt(0)}</span>
            </div>
            <div className="profile-header-info">
              <h2>{user.nombre} {user.apellido}</h2>
              <span className="profile-role-badge">{user.rol === 'admin' ? 'Administrador' : 'Socio'}</span>
            </div>
          </div>

          {!editing ? (
            <div className="profile-info-cards">
              <div className="profile-info-item">
                <span className="profile-info-label">DNI</span>
                <span className="profile-info-value">{user.dni}</span>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">Correo electronico</span>
                <span className="profile-info-value">{user.email}</span>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">Telefono</span>
                <span className="profile-info-value">{user.telefono || 'No registrado'}</span>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">Rol</span>
                <span className="profile-info-value">{user.rol === 'admin' ? 'Administrador / Recepcionista' : 'Socio / Cliente'}</span>
              </div>
              <button className="action-btn btn-emerald profile-edit-btn" type="button" onClick={() => setEditing(true)}>
                Editar Perfil
              </button>
            </div>
          ) : (
            <form onSubmit={saveProfile} className="profile-edit-form">
              <div className="form-grid">
                <div className="form-element">
                  <label className="element-label">Nombres</label>
                  <input className="input-field" value={form.nombre} onChange={(e) => updateField('nombre', e.target.value)} required />
                </div>
                <div className="form-element">
                  <label className="element-label">Apellidos</label>
                  <input className="input-field" value={form.apellido} onChange={(e) => updateField('apellido', e.target.value)} required />
                </div>
                <div className="form-element">
                  <label className="element-label">Correo</label>
                  <input className="input-field" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} required />
                </div>
                <div className="form-element">
                  <label className="element-label">Telefono</label>
                  <input className="input-field" value={form.telefono} onChange={(e) => updateField('telefono', e.target.value)} />
                </div>
              </div>
              <div className="form-actions">
                <button className="action-btn btn-emerald" type="submit" disabled={processing}>Guardar Cambios</button>
                <button className="action-btn btn-light" type="button" onClick={() => setEditing(false)} disabled={processing}>Cancelar</button>
              </div>
            </form>
          )}

          <div className="profile-divider" />

          <h3 className="profile-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Cambiar Contrasena
          </h3>
          <form onSubmit={changePassword} className="profile-pwd-form">
            <div className="form-grid">
              <PasswordInput
                label="Contrasena actual"
                value={pwd.currentPassword}
                onChange={(e) => setPwd((p) => ({ ...p, currentPassword: e.target.value }))}
                showState={showCurrentPwd}
                onToggle={() => setShowCurrentPwd((s) => !s)}
              />
              <PasswordInput
                label="Nueva contrasena"
                value={pwd.newPassword}
                onChange={(e) => setPwd((p) => ({ ...p, newPassword: e.target.value }))}
                showState={showNewPwd}
                onToggle={() => setShowNewPwd((s) => !s)}
              />
              <PasswordInput
                label="Confirmar nueva contrasena"
                value={pwd.confirmPassword}
                onChange={(e) => setPwd((p) => ({ ...p, confirmPassword: e.target.value }))}
                showState={showConfirmPwd}
                onToggle={() => setShowConfirmPwd((s) => !s)}
              />
            </div>
            <div className="form-actions">
              <button className="action-btn btn-emerald" type="submit" disabled={processing}>Cambiar Contrasena</button>
            </div>
          </form>
        </div>

        {user.rol === 'cliente' && (
          <div className="profile-modern-sidebar">
            <div className="profile-modern-card">
              <h3 className="profile-section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Mi Membresia
              </h3>
              {loadingMembership ? (
                <p className="profile-loading">Cargando informacion...</p>
              ) : membership ? (
                <div className="membership-info">
                  <div className="membership-plan-name">{membership.planNombre}</div>
                  <div className="membership-detail-row">
                    <span>Inicio</span>
                    <strong>{formatDate(membership.fechaInicio)}</strong>
                  </div>
                  <div className="membership-detail-row">
                    <span>Vencimiento</span>
                    <strong>{formatDate(membership.fechaFin)}</strong>
                  </div>
                  <div className="membership-detail-row">
                    <span>Estado</span>
                    <span className={`badge-status ${membership.estado === 'activo' && membership.diasRestantes > 0 ? 'badge-valid' : 'badge-alert'}`}>
                      {membership.estado === 'activo' && membership.diasRestantes > 0 ? 'Activo' : 'Expirado'}
                    </span>
                  </div>
                  <div className={`membership-days-remaining ${membership.diasRestantes <= 5 && membership.diasRestantes > 0 ? 'days-warning' : membership.diasRestantes > 0 ? 'days-ok' : 'days-expired'}`}>
                    {membership.diasRestantes > 0 ? (
                      <>
                        <span className="days-number">{membership.diasRestantes}</span>
                        <span className="days-label">dias restantes</span>
                        {membership.diasRestantes <= 5 && (
                          <p className="days-alert-text">Tu plan esta por concluir. Acercate al gimnasio para renovar tu membresia.</p>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="days-number">0</span>
                        <span className="days-label">dias restantes</span>
                        <p className="days-alert-text">Tu membresia ha expirado. Acercate al gimnasio para renovar.</p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="membership-empty">
                  <p>No tienes una membresia activa.</p>
                </div>
              )}
            </div>

            <div className="profile-modern-card">
              <h3 className="profile-section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                Historial de Pagos
              </h3>
              {loadingMembership ? (
                <p className="profile-loading">Cargando pagos...</p>
              ) : payments.length > 0 ? (
                <div className="payments-list">
                  {payments.map((pay) => (
                    <div key={pay.id} className="payment-item">
                      <div className="payment-top">
                        <span className="payment-plan">{pay.planNombre}</span>
                        <span className="payment-amount">S/. {Number(pay.monto).toFixed(2)}</span>
                      </div>
                      <div className="payment-bottom">
                        <span className="payment-date">{formatDate(pay.fechaPago)}</span>
                        <span className="payment-method">{pay.metodoPago}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="membership-empty">
                  <p>No hay pagos registrados.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

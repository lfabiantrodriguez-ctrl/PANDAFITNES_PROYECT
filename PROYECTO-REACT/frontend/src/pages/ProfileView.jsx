import { useState } from 'react'
import ViewTitle from '../components/ViewTitle'
import { ProfileService } from '../services/ProfileService'
import { saveStoredSession } from '../utils/session'

export default function ProfileView({ user, token, setUser }) {
  const [editing, setEditing] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [form, setForm] = useState({
    nombre: user.nombre,
    apellido: user.apellido,
    email: user.email,
    telefono: user.telefono || '',
  })

  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

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
      setMessage('Perfil actualizado correctamente')
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
      setMessage('Contrasena actualizada correctamente')
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

      {!editing && (
        <section className="profile-card">
          <div className="profile-row">
            <span>Nombre</span>
            <strong>{user.nombre} {user.apellido}</strong>
          </div>
          <div className="profile-row">
            <span>DNI</span>
            <strong>{user.dni}</strong>
          </div>
          <div className="profile-row">
            <span>Correo</span>
            <strong>{user.email}</strong>
          </div>
          <div className="profile-row">
            <span>Telefono</span>
            <strong>{user.telefono || 'No registrado'}</strong>
          </div>
          <div className="profile-row">
            <span>Rol</span>
            <strong>{user.rol === 'admin' ? 'Administrador / Recepcionista' : 'Socio / Cliente'}</strong>
          </div>

          <div style={{ marginTop: 12 }}>
            <button className="action-btn btn-emerald" type="button" onClick={() => setEditing(true)}>
              Editar Perfil
            </button>
          </div>
        </section>
      )}

      {editing && (
        <section className="profile-card">
          <form onSubmit={saveProfile}>
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
              <button className="action-btn btn-emerald" type="submit" disabled={processing}>Guardar</button>
              <button className="action-btn btn-light" type="button" onClick={() => setEditing(false)} disabled={processing}>Cancelar</button>
            </div>
          </form>
        </section>
      )}

      <section className="profile-card" style={{ marginTop: 20 }}>
        <h3>Cambiar Contrasena</h3>
        <form onSubmit={changePassword}>
          <div className="form-grid">
            <div className="form-element">
              <label className="element-label">Contrasena actual</label>
              <input className="input-field" type="password" value={pwd.currentPassword} onChange={(e) => setPwd((p) => ({ ...p, currentPassword: e.target.value }))} required />
            </div>
            <div className="form-element">
              <label className="element-label">Nueva contrasena</label>
              <input className="input-field" type="password" value={pwd.newPassword} onChange={(e) => setPwd((p) => ({ ...p, newPassword: e.target.value }))} required />
            </div>
            <div className="form-element">
              <label className="element-label">Confirmar nueva</label>
              <input className="input-field" type="password" value={pwd.confirmPassword} onChange={(e) => setPwd((p) => ({ ...p, confirmPassword: e.target.value }))} required />
            </div>
          </div>

          <div className="form-actions">
            <button className="action-btn btn-emerald" type="submit" disabled={processing}>Cambiar Contrasena</button>
          </div>
        </form>
      </section>
    </>
  )
}

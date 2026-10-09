import { useEffect, useRef, useState } from 'react'
import ModalDialog from '../components/ModalDialog'
import { ProfileService } from '../services/ProfileService'
import { MembershipService } from '../services/MembershipService'
import { saveStoredSession } from '../utils/session'
import { formatDate } from '../utils/formatters'

export default function ProfileView({ user, token, setUser }) {
  const [showPwdModal, setShowPwdModal] = useState(false)
  const [showObjectiveModal, setShowObjectiveModal] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [showCurrentPwd, setShowCurrentPwd] = useState(false)
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  const [membership, setMembership] = useState(null)
  const [loadingMembership, setLoadingMembership] = useState(false)

  const fileInputRef = useRef(null)

  const defaultPreferences = {
    avisosMembresia: true,
    novedadesPandita: true,
    promocionesCorreo: false,
  }

  const [form, setForm] = useState({
    nombre: user?.nombre || '',
    apellido: user?.apellido || '',
    dni: user?.dni || '',
    email: user?.email || '',
    telefono: user?.telefono || '',
    fecha_nacimiento: user?.fecha_nacimiento ? user.fecha_nacimiento.slice(0, 10) : '',
    direccion: user?.direccion || '',
    contacto_emergencia: user?.contacto_emergencia || '',
    telefono_emergencia: user?.telefono_emergencia || '',
    avatar_url: user?.avatar_url || '',
    preferencias: user?.preferencias || defaultPreferences,
    dias_objetivo: user?.dias_objetivo || '1,2,4,5',
  })

  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  // Cargar membresía si el usuario es cliente
  useEffect(() => {
    if (user?.rol === 'cliente') {
      setLoadingMembership(true)
      MembershipService.getMyMembership(token)
        .then((memData) => {
          if (memData?.membership) setMembership(memData.membership)
        })
        .catch(() => {})
        .finally(() => setLoadingMembership(false))
    }
  }, [token, user?.rol])

  const [errors, setErrors] = useState({})
  const [pwdErrors, setPwdErrors] = useState({})

  // Reglas de validación para contraseña
  const hasMinLength = pwd.newPassword.length >= 8
  const hasUpper = /[A-Z]/.test(pwd.newPassword)
  const hasLower = /[a-z]/.test(pwd.newPassword)
  const hasNumber = /[0-9]/.test(pwd.newPassword)
  const allPwdRulesMet = hasMinLength && hasUpper && hasLower && hasNumber
  const passwordsMatch = pwd.newPassword === pwd.confirmPassword && pwd.confirmPassword.length > 0

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  // Filtrar nombres para solo permitir letras y espacios
  function handleNombreChange(e) {
    const clean = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '')
    updateField('nombre', clean)
  }

  // Filtrar apellidos para solo permitir letras y espacios
  function handleApellidoChange(e) {
    const clean = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '')
    updateField('apellido', clean)
  }

  // Filtrar DNI para exactamente dígitos numéricos (máximo 8)
  function handleDniChange(e) {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 8)
    updateField('dni', clean)
  }

  // Filtrar teléfono para dígitos numéricos de Perú (máximo 9)
  function handlePhoneChange(e) {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 9)
    updateField('telefono', clean)
  }

  // Filtrar teléfono de emergencia (máximo 9 dígitos)
  function handleEmergencyPhoneChange(e) {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 9)
    updateField('telefono_emergencia', clean)
  }

  // Subir foto desde el ordenador / móvil
  function handleAvatarFile(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setMessage('El archivo seleccionado debe ser una imagen válida')
      setMessageType('error')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage('La imagen seleccionada no debe superar 5MB de tamaño')
      setMessageType('error')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      updateField('avatar_url', event.target?.result)
      setMessage('Foto seleccionada. Recuerda hacer clic en "Guardar cambios" para conservarla.')
      setMessageType('success')
    }
    reader.readAsDataURL(file)
  }

  function togglePreference(key) {
    const current = form.preferencias?.[key] ?? defaultPreferences[key]
    const updated = {
      ...(form.preferencias || defaultPreferences),
      [key]: !current,
    }
    updateField('preferencias', updated)
  }

  // Formatear texto del objetivo semanal
  function getObjetivoTexto() {
    const diasMap = {
      1: 'lunes',
      2: 'martes',
      3: 'miércoles',
      4: 'jueves',
      5: 'viernes',
      6: 'sábado',
      7: 'domingo',
    }
    const raw = String(form.dias_objetivo || '1,2,4,5').split(',').map((d) => d.trim()).filter(Boolean)
    if (raw.length === 0) return 'Sin días configurados'
    const nombres = raw.map((d) => diasMap[d] || d)
    return `${raw.length} días: ${nombres.join(', ')}.`
  }

  async function saveProfile(e) {
    if (e && e.preventDefault) e.preventDefault()
    setProcessing(true)
    setMessage('')
    setMessageType('')
    const newErrors = {}

    // Validación Nombre
    if (!form.nombre.trim()) {
      newErrors.nombre = 'El nombre es obligatorio'
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(form.nombre.trim())) {
      newErrors.nombre = 'El nombre solo debe contener letras y espacios'
    }

    // Validación Apellidos
    if (!form.apellido.trim()) {
      newErrors.apellido = 'Los apellidos son obligatorios'
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(form.apellido.trim())) {
      newErrors.apellido = 'Los apellidos solo deben contener letras y espacios'
    }

    // Validación DNI (exactamente 8 dígitos numéricos)
    if (form.dni && !/^\d{8}$/.test(form.dni.trim())) {
      newErrors.dni = 'El DNI debe tener exactamente 8 dígitos numéricos'
    }

    // Validación Correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!form.email.trim()) {
      newErrors.email = 'El correo electrónico es obligatorio'
    } else if (!emailRegex.test(form.email.trim())) {
      newErrors.email = 'Ingresa un correo electrónico válido (ej. usuario@gmail.com)'
    }

    // Validación Teléfono (Perú: exactamente 9 dígitos si se ingresa)
    if (form.telefono && !/^\d{9}$/.test(form.telefono.trim())) {
      newErrors.telefono = 'El teléfono debe tener exactamente 9 dígitos numéricos (Perú)'
    }

    // Validación Teléfono de Emergencia (9 dígitos si se ingresa)
    if (form.telefono_emergencia && !/^\d{9}$/.test(form.telefono_emergencia.trim())) {
      newErrors.telefono_emergencia = 'El teléfono de emergencia debe contener 9 dígitos numéricos'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      setMessage('Por favor corrige los campos marcados en rojo')
      setMessageType('error')
      setProcessing(false)
      return
    }

    setErrors({})

    try {
      const res = await ProfileService.updateProfile(token, form)
      const updatedUser = res.user
      saveStoredSession(token, updatedUser)
      if (setUser) setUser(updatedUser)
      setMessage('✓ Tus cambios han sido guardados exitosamente.')
      setMessageType('success')
    } catch (err) {
      const errMsg = err.message || 'Error al guardar el perfil'
      const lower = errMsg.toLowerCase()
      if (lower.includes('dni')) {
        setErrors((prev) => ({ ...prev, dni: errMsg }))
      } else if (lower.includes('correo') || lower.includes('email')) {
        setErrors((prev) => ({ ...prev, email: errMsg }))
      } else if (lower.includes('teléfono') || lower.includes('telefono')) {
        setErrors((prev) => ({ ...prev, telefono: errMsg }))
      } else if (lower.includes('nombre')) {
        setErrors((prev) => ({ ...prev, nombre: errMsg }))
      } else if (lower.includes('apellido')) {
        setErrors((prev) => ({ ...prev, apellido: errMsg }))
      }
      setMessage(errMsg)
      setMessageType('error')
    } finally {
      setProcessing(false)
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setProcessing(true)
    setMessage('')
    setMessageType('')
    const pErrors = {}

    if (!pwd.currentPassword) {
      pErrors.currentPassword = 'Debes ingresar tu contraseña actual'
    }

    if (!pwd.newPassword) {
      pErrors.newPassword = 'Debes ingresar la nueva contraseña'
    } else if (!allPwdRulesMet) {
      pErrors.newPassword = 'Debe cumplir los requisitos mínimos (8 caracteres, mayúscula, minúscula y número)'
    }

    if (!pwd.confirmPassword) {
      pErrors.confirmPassword = 'Debes confirmar la nueva contraseña'
    } else if (pwd.newPassword !== pwd.confirmPassword) {
      pErrors.confirmPassword = 'Las contraseñas no coinciden'
    }

    if (Object.keys(pErrors).length > 0) {
      setPwdErrors(pErrors)
      setProcessing(false)
      return
    }

    setPwdErrors({})

    try {
      await ProfileService.changePassword(token, {
        currentPassword: pwd.currentPassword,
        newPassword: pwd.newPassword,
      })
      setMessage('✓ Contraseña actualizada correctamente.')
      setMessageType('success')
      setPwd({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setShowPwdModal(false)
    } catch (err) {
      const errMsg = err.message || 'Error al actualizar la contraseña'
      if (errMsg.toLowerCase().includes('actual')) {
        setPwdErrors({ currentPassword: errMsg })
      } else {
        setPwdErrors({ newPassword: errMsg })
      }
    } finally {
      setProcessing(false)
    }
  }

  const socioCode = `NP-${String(user?.id || 1).padStart(4, '0')}`

  return (
    <div className="container-fluid px-0 pb-5" style={{ maxWidth: '1240px' }}>
      {/* CABECERA SUPERIOR FIGMA STYLE */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4 pt-1">
        <div>
          <h2 className="fw-bold text-dark mb-1" style={{ fontSize: '1.9rem', letterSpacing: '-0.5px' }}>
            Tu perfil, a tu manera
          </h2>
          <p className="text-muted mb-0" style={{ fontSize: '0.96rem' }}>
            Mantén tus datos al día para acompañarte mejor.
          </p>
        </div>

        <button
          type="button"
          className="btn fw-bold px-4 py-2 d-inline-flex align-items-center gap-2 shadow-sm"
          onClick={saveProfile}
          disabled={processing}
          style={{
            background: '#c4f039',
            color: '#111d15',
            border: 'none',
            borderRadius: '12px',
            fontSize: '0.95rem',
            paddingTop: '0.65rem',
            paddingBottom: '0.65rem',
            transition: 'all 0.2s ease',
          }}
        >
          <i className="bi bi-check-lg fs-5"></i>
          {processing ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {/* MENSAJES DE ALERTA O FEEDBACK */}
      {message && (
        <div
          className={`alert ${
            messageType === 'error' ? 'alert-danger border-danger-subtle' : 'alert-success border-success-subtle'
          } d-flex align-items-center justify-content-between gap-3 py-3 px-4 rounded-3 border mb-4 shadow-sm`}
          role="alert"
        >
          <div className="d-flex align-items-center gap-2">
            <i
              className={`bi ${
                messageType === 'error' ? 'bi-exclamation-triangle-fill text-danger' : 'bi-check-circle-fill text-success'
              } fs-5`}
            ></i>
            <span className="fw-medium">{message}</span>
          </div>
          <button
            type="button"
            className="btn-close"
            aria-label="Cerrar"
            onClick={() => setMessage('')}
          ></button>
        </div>
      )}

      {/* LAYOUT PRINCIPAL A DOS COLUMNAS */}
      <div className="row g-4">
        {/* ================= COLUMNA IZQUIERDA ================= */}
        <div className="col-12 col-lg-7">
          <div className="d-flex flex-column gap-4">
            {/* CARD 1: DATOS PERSONALES */}
            <div
              className="card border shadow-sm"
              style={{
                borderRadius: '18px',
                borderColor: '#e2e8f0',
                background: '#ffffff',
              }}
            >
              <div className="card-body p-4">
                <h5 className="fw-bold text-dark mb-4" style={{ fontSize: '1.2rem' }}>
                  Datos personales
                </h5>

                {/* Avatar y Datos de Cabecera */}
                <div className="d-flex flex-wrap align-items-center gap-3 mb-4 pb-3 border-bottom">
                  <div className="position-relative">
                    {form.avatar_url ? (
                      <img
                        src={form.avatar_url}
                        alt="Foto de perfil"
                        className="rounded-circle shadow-sm object-fit-cover"
                        style={{
                          width: '76px',
                          height: '76px',
                          border: '3px solid #c4f039',
                        }}
                      />
                    ) : (
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm"
                        style={{
                          width: '76px',
                          height: '76px',
                          background: '#111d15',
                          color: '#c4f039',
                          border: '3px solid #c4f039',
                          fontSize: '1.6rem',
                        }}
                      >
                        {form.nombre?.charAt(0) || 'P'}
                        {form.apellido?.charAt(0) || 'F'}
                      </div>
                    )}
                  </div>

                  <div className="flex-grow-1">
                    <h4 className="m-0 fw-bold text-dark" style={{ fontSize: '1.25rem' }}>
                      {form.nombre || 'Usuario'} {form.apellido || ''}
                    </h4>
                    <p className="text-muted small mb-2">
                      {socioCode} · {user?.rol === 'admin' ? 'Administrador' : 'Socio activo'}
                    </p>

                    <div className="d-flex align-items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-dark fw-semibold d-inline-flex align-items-center gap-2 px-3 py-1"
                        style={{ borderRadius: '8px' }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <i className="bi bi-camera"></i> Cambiar foto
                      </button>

                      {form.avatar_url && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger px-2 py-1"
                          style={{ borderRadius: '8px' }}
                          title="Quitar foto"
                          onClick={() => updateField('avatar_url', '')}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      )}

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="d-none"
                        onChange={handleAvatarFile}
                      />
                    </div>
                  </div>
                </div>

                {/* Formulario de Datos Personales */}
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark small mb-1">
                      Nombre * - Validación administrativa
                    </label>
                    <input
                      type="text"
                      className={`form-control ${errors.nombre ? 'is-invalid' : ''}`}
                      style={{
                        borderRadius: '10px',
                        borderColor: errors.nombre ? '#ef4444' : '#cbd5e1',
                        backgroundColor: errors.nombre ? '#fef2f2' : '#ffffff',
                      }}
                      value={form.nombre}
                      onChange={handleNombreChange}
                      placeholder="Tu nombre"
                      required
                    />
                    {errors.nombre ? (
                      <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                        <i className="bi bi-exclamation-circle-fill"></i>
                        <span>{errors.nombre}</span>
                      </div>
                    ) : (
                      <small className="text-muted" style={{ fontSize: '0.74rem' }}>
                        Solo letras y espacios
                      </small>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark small mb-1">
                      Apellidos * - Validación administrativa
                    </label>
                    <input
                      type="text"
                      className={`form-control ${errors.apellido ? 'is-invalid' : ''}`}
                      style={{
                        borderRadius: '10px',
                        borderColor: errors.apellido ? '#ef4444' : '#cbd5e1',
                        backgroundColor: errors.apellido ? '#fef2f2' : '#ffffff',
                      }}
                      value={form.apellido}
                      onChange={handleApellidoChange}
                      placeholder="Tus apellidos"
                      required
                    />
                    {errors.apellido ? (
                      <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                        <i className="bi bi-exclamation-circle-fill"></i>
                        <span>{errors.apellido}</span>
                      </div>
                    ) : (
                      <small className="text-muted" style={{ fontSize: '0.74rem' }}>
                        Solo letras y espacios
                      </small>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark small mb-1">
                      DNI * - Validación administrativa
                    </label>
                    <div className="input-group">
                      <span
                        className="input-group-text bg-light border-end-0 text-muted"
                        style={{
                          borderRadius: '10px 0 0 10px',
                          borderColor: errors.dni ? '#ef4444' : '#cbd5e1',
                        }}
                      >
                        <i className="bi bi-card-text"></i>
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={8}
                        className={`form-control border-start-0 ${errors.dni ? 'is-invalid' : ''}`}
                        style={{
                          borderRadius: '0 10px 10px 0',
                          borderColor: errors.dni ? '#ef4444' : '#cbd5e1',
                          backgroundColor: errors.dni ? '#fef2f2' : '#ffffff',
                        }}
                        value={form.dni}
                        onChange={handleDniChange}
                        placeholder="8 dígitos"
                        required
                      />
                    </div>
                    {errors.dni ? (
                      <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                        <i className="bi bi-exclamation-circle-fill"></i>
                        <span>{errors.dni}</span>
                      </div>
                    ) : (
                      <small className="text-muted" style={{ fontSize: '0.74rem' }}>
                        Exactamente 8 números (sin letras)
                      </small>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark small mb-1">
                      Fecha de nacimiento · Validación
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      style={{ borderRadius: '10px', borderColor: '#cbd5e1' }}
                      value={form.fecha_nacimiento}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => updateField('fecha_nacimiento', e.target.value)}
                    />
                    <small className="text-muted" style={{ fontSize: '0.74rem' }}>
                      Fecha oficial de nacimiento
                    </small>
                  </div>
                </div>

                {/* NOTA DE IDENTIDAD FIGMA */}
                <div
                  className="p-3 rounded-3 d-flex gap-3 align-items-start mt-4"
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <i className="bi bi-info-circle text-primary fs-5 mt-1"></i>
                  <div>
                    <strong className="d-block text-dark small mb-1">Cambios de identidad</strong>
                    <p className="mb-0 text-muted" style={{ fontSize: '0.82rem', lineHeight: 1.45 }}>
                      Si modificas tu nombre, apellidos o fecha de nacimiento, recepción validará el cambio antes de aplicarlo. El resto de tus datos se actualiza al guardar.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: CONTACTO Y EMERGENCIA */}
            <div
              className="card border shadow-sm"
              style={{
                borderRadius: '18px',
                borderColor: '#e2e8f0',
                background: '#ffffff',
              }}
            >
              <div className="card-body p-4">
                <h5 className="fw-bold text-dark mb-4" style={{ fontSize: '1.2rem' }}>
                  Contacto y emergencia
                </h5>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark small mb-1">
                      Correo electrónico *
                    </label>
                    <input
                      type="email"
                      className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                      style={{
                        borderRadius: '10px',
                        borderColor: errors.email ? '#ef4444' : '#cbd5e1',
                        backgroundColor: errors.email ? '#fef2f2' : '#ffffff',
                      }}
                      value={form.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      placeholder="nombre@ejemplo.com"
                      required
                    />
                    {errors.email ? (
                      <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                        <i className="bi bi-exclamation-circle-fill"></i>
                        <span>{errors.email}</span>
                      </div>
                    ) : (
                      <small className="text-muted d-block mt-1" style={{ fontSize: '0.74rem' }}>
                        Un nuevo correo requiere confirmación por correo.
                      </small>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark small mb-1">
                      Teléfono *
                    </label>
                    <div className="input-group">
                      <span
                        className="input-group-text bg-light border-end-0 text-muted"
                        style={{
                          borderRadius: '10px 0 0 10px',
                          borderColor: errors.telefono ? '#ef4444' : '#cbd5e1',
                        }}
                      >
                        +51
                      </span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={9}
                        className={`form-control border-start-0 ${errors.telefono ? 'is-invalid' : ''}`}
                        style={{
                          borderRadius: '0 10px 10px 0',
                          borderColor: errors.telefono ? '#ef4444' : '#cbd5e1',
                          backgroundColor: errors.telefono ? '#fef2f2' : '#ffffff',
                        }}
                        value={form.telefono}
                        onChange={handlePhoneChange}
                        placeholder="9XXXXXXXX"
                        required
                      />
                    </div>
                    {errors.telefono ? (
                      <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                        <i className="bi bi-exclamation-circle-fill"></i>
                        <span>{errors.telefono}</span>
                      </div>
                    ) : (
                      <small className="text-muted d-block mt-1" style={{ fontSize: '0.74rem' }}>
                        9 dígitos numéricos (Perú)
                      </small>
                    )}
                  </div>

                  <div className="col-12">
                    <label className="form-label fw-semibold text-dark small mb-1">
                      Dirección (opcional)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      style={{ borderRadius: '10px', borderColor: '#cbd5e1' }}
                      value={form.direccion}
                      onChange={(e) => updateField('direccion', e.target.value)}
                      placeholder="Ej. Av. Salaverry 1234, Lima"
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark small mb-1">
                      Contacto de emergencia (opcional)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      style={{ borderRadius: '10px', borderColor: '#cbd5e1' }}
                      value={form.contacto_emergencia}
                      onChange={(e) => updateField('contacto_emergencia', e.target.value)}
                      placeholder="Ej. Ana Torres - Hermana"
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark small mb-1">
                      Teléfono de emergencia (opcional)
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={9}
                      className={`form-control ${errors.telefono_emergencia ? 'is-invalid' : ''}`}
                      style={{
                        borderRadius: '10px',
                        borderColor: errors.telefono_emergencia ? '#ef4444' : '#cbd5e1',
                        backgroundColor: errors.telefono_emergencia ? '#fef2f2' : '#ffffff',
                      }}
                      value={form.telefono_emergencia}
                      onChange={handleEmergencyPhoneChange}
                      placeholder="9XXXXXXXX"
                    />
                    {errors.telefono_emergencia ? (
                      <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                        <i className="bi bi-exclamation-circle-fill"></i>
                        <span>{errors.telefono_emergencia}</span>
                      </div>
                    ) : (
                      <small className="text-muted" style={{ fontSize: '0.74rem' }}>
                        9 dígitos numéricos si se registra
                      </small>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= COLUMNA DERECHA ================= */}
        <div className="col-12 col-lg-5">
          <div className="d-flex flex-column gap-4">
            {/* CARD 3: DATOS DE CUENTA */}
            <div
              className="card border shadow-sm"
              style={{
                borderRadius: '18px',
                borderColor: '#e2e8f0',
                background: '#ffffff',
              }}
            >
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="fw-bold text-dark m-0" style={{ fontSize: '1.2rem' }}>
                    Datos de cuenta
                  </h5>
                  <span
                    className="badge rounded-pill fw-semibold px-3 py-1"
                    style={{
                      background: '#ecfccb',
                      color: '#365314',
                      border: '1px solid #d9f99d',
                      fontSize: '0.75rem',
                    }}
                  >
                    ● Correo verificado
                  </span>
                </div>

                <div className="mb-3">
                  <span className="text-muted small d-block mb-1">Número de socio</span>
                  <div className="fs-3 fw-bold text-dark tracking-wide" style={{ letterSpacing: '0.5px' }}>
                    {socioCode}
                  </div>
                  <div className="text-muted small mt-1">
                    {user?.rol === 'admin' ? (
                      <span className="badge bg-dark text-white px-2 py-1">Administrador General · Sistema</span>
                    ) : loadingMembership ? (
                      <span>Cargando membresía...</span>
                    ) : membership ? (
                      <span>
                        Plan {membership.planNombre} · Vigencia hasta el {formatDate(membership.fechaFin)}
                      </span>
                    ) : (
                      <span>Socio Registrado · Sin membresía activa</span>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-top">
                  <label className="form-label fw-semibold text-dark small mb-1">Contraseña</label>
                  <input
                    type="password"
                    className="form-control bg-light"
                    style={{ borderRadius: '10px', letterSpacing: '3px' }}
                    value="••••••••••••••••"
                    disabled
                    readOnly
                  />

                  <button
                    type="button"
                    className="btn btn-outline-dark fw-bold w-100 py-2 mt-3 d-flex align-items-center justify-content-center gap-2 shadow-sm"
                    style={{ borderRadius: '10px' }}
                    onClick={() => {
                      setPwd({ currentPassword: '', newPassword: '', confirmPassword: '' })
                      setShowPwdModal(true)
                    }}
                  >
                    <i className="bi bi-key-fill"></i> Cambiar contraseña
                  </button>

                  <small className="text-muted d-block mt-2" style={{ fontSize: '0.76rem', lineHeight: 1.4 }}>
                    Tu número de socio no se puede editar. El club nunca te pedirá tu contraseña.
                  </small>
                </div>
              </div>
            </div>

            {/* CARD 4: TUS PREFERENCIAS */}
            <div
              className="card border shadow-sm"
              style={{
                borderRadius: '18px',
                borderColor: '#e2e8f0',
                background: '#ffffff',
              }}
            >
              <div className="card-body p-4">
                <h5 className="fw-bold text-dark mb-3" style={{ fontSize: '1.2rem' }}>
                  Tus preferencias
                </h5>

                {/* Objetivo semanal */}
                <div className="mb-4 pb-3 border-bottom">
                  <span className="text-muted small fw-semibold d-block mb-1">Objetivo semanal</span>
                  <p className="text-dark fw-medium small mb-2">{getObjetivoTexto()}</p>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary fw-semibold px-3 py-1 rounded-pill"
                    onClick={() => setShowObjectiveModal(true)}
                  >
                    Editar objetivo
                  </button>
                </div>

                {/* Switches de notificaciones */}
                <div className="d-flex flex-column gap-3 mb-4">
                  {/* Switch 1: Avisos de membresía */}
                  <div
                    className="d-flex align-items-center justify-content-between p-2 rounded-3"
                    style={{ background: '#f8fafc' }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <i
                        className={`bi ${
                          form.preferencias?.avisosMembresia ? 'bi-check2-circle text-success' : 'bi-circle text-muted'
                        } fs-5`}
                      ></i>
                      <div>
                        <div className="small fw-semibold text-dark">Avisos de membresía</div>
                        <div className="text-muted" style={{ fontSize: '0.74rem' }}>
                          {form.preferencias?.avisosMembresia ? 'Activados' : 'Desactivados'}
                        </div>
                      </div>
                    </div>
                    <div className="form-check form-switch m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                        checked={Boolean(form.preferencias?.avisosMembresia)}
                        onChange={() => togglePreference('avisosMembresia')}
                      />
                    </div>
                  </div>

                  {/* Switch 2: Novedades de mi pandita */}
                  <div
                    className="d-flex align-items-center justify-content-between p-2 rounded-3"
                    style={{ background: '#f8fafc' }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <i
                        className={`bi ${
                          form.preferencias?.novedadesPandita ? 'bi-check2-circle text-success' : 'bi-circle text-muted'
                        } fs-5`}
                      ></i>
                      <div>
                        <div className="small fw-semibold text-dark">Novedades de mi pandita</div>
                        <div className="text-muted" style={{ fontSize: '0.74rem' }}>
                          {form.preferencias?.novedadesPandita ? 'Activadas' : 'Desactivadas'}
                        </div>
                      </div>
                    </div>
                    <div className="form-check form-switch m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                        checked={Boolean(form.preferencias?.novedadesPandita)}
                        onChange={() => togglePreference('novedadesPandita')}
                      />
                    </div>
                  </div>

                  {/* Switch 3: Promociones por correo */}
                  <div
                    className="d-flex align-items-center justify-content-between p-2 rounded-3"
                    style={{ background: '#f8fafc' }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <i
                        className={`bi ${
                          form.preferencias?.promocionesCorreo ? 'bi-check2-circle text-success' : 'bi-dash-circle text-muted'
                        } fs-5`}
                      ></i>
                      <div>
                        <div className="small fw-semibold text-dark">Promociones por correo</div>
                        <div className="text-muted" style={{ fontSize: '0.74rem' }}>
                          {form.preferencias?.promocionesCorreo ? 'Activadas' : 'Desactivadas'}
                        </div>
                      </div>
                    </div>
                    <div className="form-check form-switch m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                        checked={Boolean(form.preferencias?.promocionesCorreo)}
                        onChange={() => togglePreference('promocionesCorreo')}
                      />
                    </div>
                  </div>
                </div>

                {/* Idioma */}
                <div className="pt-3 border-top d-flex justify-content-between align-items-center">
                  <span className="text-muted small">Idioma</span>
                  <span className="badge bg-light text-dark border px-3 py-2 fw-semibold">
                    Español (Perú)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= MODAL: CAMBIAR CONTRASEÑA ================= */}
      <ModalDialog
        isOpen={showPwdModal}
        onClose={() => setShowPwdModal(false)}
        title="Cambiar Contraseña"
        subtitle="Ingresa tu clave actual y define tu nueva contraseña segura"
        badge="Seguridad"
        size="md"
      >
        <form onSubmit={handleChangePassword}>
          <div className="d-flex flex-column gap-3">
            {/* Clave actual */}
            <div>
              <label className="form-label fw-bold small text-dark">Contraseña Actual *</label>
              <div className="input-group">
                <input
                  className={`form-control ${pwdErrors.currentPassword ? 'is-invalid' : ''}`}
                  style={{
                    borderRadius: '10px 0 0 10px',
                    borderColor: pwdErrors.currentPassword ? '#ef4444' : '#cbd5e1',
                    backgroundColor: pwdErrors.currentPassword ? '#fef2f2' : '#ffffff',
                  }}
                  type={showCurrentPwd ? 'text' : 'password'}
                  required
                  placeholder="Tu contraseña actual"
                  value={pwd.currentPassword}
                  onChange={(e) => {
                    setPwd({ ...pwd, currentPassword: e.target.value })
                    if (pwdErrors.currentPassword) setPwdErrors((prev) => ({ ...prev, currentPassword: '' }))
                  }}
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  style={{ borderRadius: '0 10px 10px 0' }}
                  onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                >
                  <i className={`bi ${showCurrentPwd ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
              {pwdErrors.currentPassword && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{pwdErrors.currentPassword}</span>
                </div>
              )}
            </div>

            {/* Nueva clave */}
            <div>
              <label className="form-label fw-bold small text-dark">Nueva Contraseña *</label>
              <div className="input-group">
                <input
                  className={`form-control ${pwdErrors.newPassword ? 'is-invalid' : ''}`}
                  style={{
                    borderRadius: '10px 0 0 10px',
                    borderColor: pwdErrors.newPassword ? '#ef4444' : '#cbd5e1',
                    backgroundColor: pwdErrors.newPassword ? '#fef2f2' : '#ffffff',
                  }}
                  type={showNewPwd ? 'text' : 'password'}
                  required
                  placeholder="Mínimo 8 caracteres"
                  value={pwd.newPassword}
                  onChange={(e) => {
                    setPwd({ ...pwd, newPassword: e.target.value })
                    if (pwdErrors.newPassword) setPwdErrors((prev) => ({ ...prev, newPassword: '' }))
                  }}
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  style={{ borderRadius: '0 10px 10px 0' }}
                  onClick={() => setShowNewPwd(!showNewPwd)}
                >
                  <i className={`bi ${showNewPwd ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
              {pwdErrors.newPassword && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{pwdErrors.newPassword}</span>
                </div>
              )}

              {/* LISTA DINÁMICA DE REQUISITOS EN VIVO */}
              <div className="p-3 rounded-3 mt-2" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div className="small fw-bold text-dark mb-2">Requisitos de la nueva contraseña:</div>
                <div className="d-flex flex-column gap-1">
                  <div className={`d-flex align-items-center gap-2 small ${hasMinLength ? 'text-success fw-semibold' : 'text-muted'}`}>
                    <i className={`bi ${hasMinLength ? 'bi-check-circle-fill text-success' : 'bi-circle text-muted'}`}></i>
                    <span>Mínimo 8 caracteres</span>
                  </div>
                  <div className={`d-flex align-items-center gap-2 small ${hasUpper ? 'text-success fw-semibold' : 'text-muted'}`}>
                    <i className={`bi ${hasUpper ? 'bi-check-circle-fill text-success' : 'bi-circle text-muted'}`}></i>
                    <span>Al menos una letra mayúscula (A-Z)</span>
                  </div>
                  <div className={`d-flex align-items-center gap-2 small ${hasLower ? 'text-success fw-semibold' : 'text-muted'}`}>
                    <i className={`bi ${hasLower ? 'bi-check-circle-fill text-success' : 'bi-circle text-muted'}`}></i>
                    <span>Al menos una letra minúscula (a-z)</span>
                  </div>
                  <div className={`d-flex align-items-center gap-2 small ${hasNumber ? 'text-success fw-semibold' : 'text-muted'}`}>
                    <i className={`bi ${hasNumber ? 'bi-check-circle-fill text-success' : 'bi-circle text-muted'}`}></i>
                    <span>Al menos un número (0-9)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Confirmar nueva clave */}
            <div>
              <label className="form-label fw-bold small text-dark">Confirmar Nueva Contraseña *</label>
              <div className="input-group">
                <input
                  className={`form-control ${pwdErrors.confirmPassword ? 'is-invalid' : ''}`}
                  style={{
                    borderRadius: '10px 0 0 10px',
                    borderColor: pwdErrors.confirmPassword ? '#ef4444' : '#cbd5e1',
                    backgroundColor: pwdErrors.confirmPassword ? '#fef2f2' : '#ffffff',
                  }}
                  type={showConfirmPwd ? 'text' : 'password'}
                  required
                  placeholder="Repite la nueva contraseña"
                  value={pwd.confirmPassword}
                  onChange={(e) => {
                    setPwd({ ...pwd, confirmPassword: e.target.value })
                    if (pwdErrors.confirmPassword) setPwdErrors((prev) => ({ ...prev, confirmPassword: '' }))
                  }}
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  style={{ borderRadius: '0 10px 10px 0' }}
                  onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                >
                  <i className={`bi ${showConfirmPwd ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>

              {pwdErrors.confirmPassword ? (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{pwdErrors.confirmPassword}</span>
                </div>
              ) : pwd.confirmPassword ? (
                <div className="mt-1">
                  {passwordsMatch ? (
                    <small className="text-success fw-semibold d-flex align-items-center gap-1">
                      <i className="bi bi-check-circle-fill"></i> Las contraseñas coinciden
                    </small>
                  ) : (
                    <small className="text-danger fw-semibold d-flex align-items-center gap-1">
                      <i className="bi bi-x-circle-fill"></i> Las contraseñas no coinciden
                    </small>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
            <button
              type="button"
              className="btn btn-outline-dark px-4 py-2 fw-semibold"
              style={{ borderRadius: '10px' }}
              onClick={() => setShowPwdModal(false)}
              disabled={processing}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn fw-bold px-4 py-2 shadow-sm"
              disabled={processing || !allPwdRulesMet || !passwordsMatch || !pwd.currentPassword}
              style={{
                background: allPwdRulesMet && passwordsMatch && pwd.currentPassword ? '#c4f039' : '#e2e8f0',
                color: allPwdRulesMet && passwordsMatch && pwd.currentPassword ? '#111d15' : '#94a3b8',
                border: 'none',
                borderRadius: '10px',
              }}
            >
              {processing ? 'Actualizando...' : 'Actualizar Contraseña'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ================= MODAL: EDITAR OBJETIVO SEMANAL ================= */}
      <ModalDialog
        isOpen={showObjectiveModal}
        onClose={() => setShowObjectiveModal(false)}
        title="Objetivo Semanal de Entrenamiento"
        subtitle="Selecciona los días previstos en los que entrenarás cada semana"
        badge="Mi Pandita"
        size="md"
      >
        <div>
          <p className="text-muted small mb-3">
            Elige los días habituales de tu rutina. Esto ayuda a tu pandita a calcular tu racha y tus bambús ganados.
          </p>

          <div className="d-flex flex-wrap gap-2 mb-4">
            {[
              { id: '1', nombre: 'Lunes' },
              { id: '2', nombre: 'Martes' },
              { id: '3', nombre: 'Miércoles' },
              { id: '4', nombre: 'Jueves' },
              { id: '5', nombre: 'Viernes' },
              { id: '6', nombre: 'Sábado' },
              { id: '7', nombre: 'Domingo' },
            ].map((d) => {
              const currentList = String(form.dias_objetivo || '').split(',').map((x) => x.trim())
              const isSelected = currentList.includes(d.id)

              return (
                <button
                  key={d.id}
                  type="button"
                  className={`btn btn-sm px-3 py-2 fw-bold rounded-pill transition-all ${
                    isSelected ? 'btn-dark' : 'btn-outline-secondary'
                  }`}
                  style={
                    isSelected
                      ? { background: '#111d15', color: '#c4f039', border: '1px solid #111d15' }
                      : { borderRadius: '20px' }
                  }
                  onClick={() => {
                    let nextList = []
                    if (isSelected) {
                      nextList = currentList.filter((x) => x !== d.id)
                    } else {
                      nextList = [...currentList, d.id].sort()
                    }
                    updateField('dias_objetivo', nextList.join(','))
                  }}
                >
                  {isSelected ? '✓ ' : '+ '}
                  {d.nombre}
                </button>
              )
            })}
          </div>

          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button
              type="button"
              className="btn btn-dark fw-bold px-4 py-2"
              style={{ background: '#c4f039', color: '#111d15', border: 'none', borderRadius: '10px' }}
              onClick={() => {
                setShowObjectiveModal(false)
                saveProfile()
              }}
            >
              Guardar Objetivo
            </button>
          </div>
        </div>
      </ModalDialog>
    </div>
  )
}

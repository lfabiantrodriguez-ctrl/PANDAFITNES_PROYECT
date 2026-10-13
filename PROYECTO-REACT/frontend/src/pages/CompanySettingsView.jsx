import { useEffect, useState, useRef } from 'react'
import ViewTitle from '../components/ViewTitle'
import {moduleLabel} from '../utils/access'
import { ConfigService } from '../services/ConfigService'

export default function CompanySettingsView({ token }) {
  const fileInputRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const [fieldErrors, setFieldErrors] = useState({})

  const [formData, setFormData] = useState({
    empresa_nombre: 'Panda Fitness',
    empresa_descripcion: 'Centro de Entrenamiento & Fitness Integral',
    empresa_logo: '/logo-panda.png',
    max_capacidad: '50',
    horario_semana_modalidad: 'partido', // 'continuo' | 'partido'
    horario_semana_corrido_inicio: '06:30',
    horario_semana_corrido_fin: '22:00',
    horario_semana_manana_inicio: '06:30',
    horario_semana_manana_fin: '11:00',
    horario_semana_tarde_inicio: '16:00',
    horario_semana_tarde_fin: '22:00',
    horario_sabado_estado: '1', // '1' | '0'
    horario_sabado_inicio: '07:00',
    horario_sabado_fin: '12:00',
    horario_domingo_abierto: '0',
    horario_domingo_inicio: '08:00',
    horario_domingo_fin: '13:00',
    estado_operativo: 'normal', // 'normal' | 'cerrado_emergencia' | 'horario_especial'
    aviso_activo: '0', // '0' | '1'
    aviso_titulo: 'Comunicado del Club',
    aviso_mensaje: '',
    landing_hero_titulo: 'Entrena, Evoluciona y Gana Premios en Panda Fitness',
    landing_hero_subtitulo: 'Tu centro de entrenamiento inteligente con monitoreo de aforo en vivo, mascota virtual interactiva que evoluciona con tu esfuerzo y recompensas reales.',
    landing_gym_direccion: 'Av. Principal Los Olivos 450, Centro Deportivo Panda',
    landing_gym_telefono: '+51 987 654 321',
    landing_gym_mapa_url: 'https://maps.google.com',
    landing_redes_instagram: 'pandafitness_oficial',
    landing_redes_tiktok: '@pandafitness_gym',
    landing_redes_facebook: 'pandafitnessclub',
    landing_redes_whatsapp: '+51 987 654 321',
    landing_imagenes_gym: '',
  })

  const [logoPreview, setLogoPreview] = useState('/logo-panda.png')

  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true)
        const data = await ConfigService.getConfig()
        setFormData({
          empresa_nombre: data.empresa_nombre || 'Panda Fitness',
          empresa_descripcion: data.empresa_descripcion || 'Centro de Entrenamiento & Fitness Integral',
          empresa_logo: data.empresa_logo || '/logo-panda.png',
          max_capacidad: data.max_capacidad || '50',
          horario_semana_modalidad: data.horario_semana_modalidad || 'partido',
          horario_semana_corrido_inicio: data.horario_semana_corrido_inicio || '06:30',
          horario_semana_corrido_fin: data.horario_semana_corrido_fin || '22:00',
          horario_semana_manana_inicio: data.horario_semana_manana_inicio || '06:30',
          horario_semana_manana_fin: data.horario_semana_manana_fin || '11:00',
          horario_semana_tarde_inicio: data.horario_semana_tarde_inicio || '16:00',
          horario_semana_tarde_fin: data.horario_semana_tarde_fin || '22:00',
          horario_sabado_estado: data.horario_sabado_estado !== undefined ? data.horario_sabado_estado : '1',
          horario_sabado_inicio: data.horario_sabado_inicio || '07:00',
          horario_sabado_fin: data.horario_sabado_fin || '12:00',
          horario_domingo_abierto: data.horario_domingo_abierto || '0',
          horario_domingo_inicio: data.horario_domingo_inicio || '08:00',
          horario_domingo_fin: data.horario_domingo_fin || '13:00',
          estado_operativo: data.estado_operativo || 'normal',
          aviso_activo: data.aviso_activo || '0',
          aviso_titulo: data.aviso_titulo || 'Comunicado del Club',
          aviso_mensaje: data.aviso_mensaje || '',
          landing_hero_titulo: data.landing_hero_titulo || 'Entrena, Evoluciona y Gana Premios en Panda Fitness',
          landing_hero_subtitulo: data.landing_hero_subtitulo || 'Tu centro de entrenamiento inteligente con monitoreo de aforo en vivo, mascota virtual interactiva que evoluciona con tu esfuerzo y recompensas reales.',
          landing_gym_direccion: data.landing_gym_direccion || 'Av. Principal Los Olivos 450, Centro Deportivo Panda',
          landing_gym_telefono: data.landing_gym_telefono || '+51 987 654 321',
          landing_gym_mapa_url: data.landing_gym_mapa_url || 'https://maps.google.com',
          landing_redes_instagram: data.landing_redes_instagram || 'pandafitness_oficial',
          landing_redes_tiktok: data.landing_redes_tiktok || '@pandafitness_gym',
          landing_redes_facebook: data.landing_redes_facebook || 'pandafitnessclub',
          landing_redes_whatsapp: data.landing_redes_whatsapp || '+51 987 654 321',
          landing_imagenes_gym: data.landing_imagenes_gym || '',
        })
        setLogoPreview(data.empresa_logo || '/logo-panda.png')
      } catch (err) {
        setMessage('Error al cargar la configuración: ' + err.message)
        setMessageType('error')
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
  }, [])

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setMessage('Por favor, selecciona un archivo de imagen válido (PNG, JPG, SVG, WebP).')
      setMessageType('error')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage('El archivo excede el tamaño máximo permitido de 5MB.')
      setMessageType('error')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result
      setLogoPreview(base64)
      setFormData((prev) => ({ ...prev, empresa_logo: base64 }))
      setMessage('Nueva imagen cargada. Presiona "Guardar Configuración" para aplicarla en todo el sistema.')
      setMessageType('info')
    }
    reader.readAsDataURL(file)
  }

  function handleRestoreDefaultLogo() {
    setLogoPreview('/logo-panda.png')
    setFormData((prev) => ({ ...prev, empresa_logo: '/logo-panda.png' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
    setMessage('Se restauró el logo oficial del Panda. Guarda los cambios para confirmar.')
    setMessageType('info')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = {}

    if (!formData.empresa_nombre?.trim()) {
      errors.empresa_nombre = 'El nombre de la empresa o gimnasio es obligatorio.'
    }
    if (!formData.empresa_descripcion?.trim()) {
      errors.empresa_descripcion = 'La descripción o eslogan comercial es obligatorio.'
    }
    const cap = Number(formData.max_capacidad)
    if (!formData.max_capacidad || isNaN(cap) || cap < 1) {
      errors.max_capacidad = 'El aforo máximo debe ser un número entero mayor a 0.'
    }

    if (formData.horario_semana_modalidad === 'continuo') {
      if (formData.horario_semana_corrido_inicio >= formData.horario_semana_corrido_fin) {
        errors.horario_semana_corrido = 'La hora de apertura debe ser anterior a la hora de cierre.'
      }
    } else {
      if (formData.horario_semana_manana_inicio >= formData.horario_semana_manana_fin) {
        errors.horario_semana_manana = 'El turno mañana debe abrir antes de cerrar.'
      }
      if (formData.horario_semana_tarde_inicio >= formData.horario_semana_tarde_fin) {
        errors.horario_semana_tarde = 'El turno tarde/noche debe iniciar antes de finalizar.'
      }
    }

    if (formData.horario_sabado_estado === '1') {
      if (formData.horario_sabado_inicio >= formData.horario_sabado_fin) {
        errors.horario_sabado = 'El horario de sábado debe abrir antes de cerrar.'
      }
    }

    if (formData.horario_domingo_abierto === '1') {
      if (formData.horario_domingo_inicio >= formData.horario_domingo_fin) {
        errors.horario_domingo = 'El horario de domingo debe abrir antes de cerrar.'
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setSaving(true)
    setMessage('')

    try {
      const res = await ConfigService.updateConfig(token, formData)
      setMessage(res.message || 'Configuración guardada exitosamente. Se actualizó el logotipo, nombre y horarios.')
      setMessageType('success')
      // Sincronizar dinámicamente favicon, título de pestaña y barra lateral
      ConfigService.applyBranding(formData)
      window.dispatchEvent(new CustomEvent('panda_config_updated', { detail: formData }))
    } catch (err) {
      setMessage(err.message || 'Error al guardar la configuración.')
      setMessageType('error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <ViewTitle title={moduleLabel('configuracion')} subtitle="Cargando parámetros del gimnasio..." />
        <div className="dashboard-panel" style={{ textAlign: 'center', padding: '40px' }}>
          <span className="spinner-border" style={{ borderColor: '#c4f039', borderTopColor: '#111d15' }}></span>
          <p style={{ marginTop: '12px', color: '#64748b' }}>Cargando datos de configuración...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      <ViewTitle
        title={moduleLabel('configuracion')}
        subtitle="Administra la identidad corporativa de tu club: logotipo oficial, nombre comercial, horarios de atención y avisos de emergencia."
      />

      {message && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '12px',
            fontWeight: 600,
            fontSize: '0.92rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background:
              messageType === 'success'
                ? '#ecfdf5'
                : messageType === 'info'
                ? '#eff6ff'
                : '#fef2f2',
            border:
              messageType === 'success'
                ? '1px solid #a7f3d0'
                : messageType === 'info'
                ? '1px solid #bfdbfe'
                : '1px solid #fecaca',
            color:
              messageType === 'success'
                ? '#065f46'
                : messageType === 'info'
                ? '#1e40af'
                : '#b91c1c',
          }}
        >
          {messageType === 'success' ? '✓ ' : messageType === 'info' ? 'ℹ ' : '⚠ '}
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '24px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '20px', width: '100%', maxWidth: '100%' }}>
          {/* Tarjeta 1: Logotipo de la Empresa */}
          <div className="dashboard-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>
              🖼️ Logotipo de la Empresa
            </h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.88rem' }}>
              Este logotipo se mostrará automáticamente en la pestaña del navegador (favicon), la barra lateral del sistema, pantalla de bienvenida y login.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
              {/* Preview Circular */}
              <div
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  border: '3px solid #c4f039',
                  boxShadow: '0 10px 25px rgba(196, 240, 57, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  padding: '6px',
                  boxSizing: 'border-box',
                }}
              >
                <img
                  src={logoPreview}
                  alt="Vista previa del logo"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }}
                  onError={(e) => {
                    e.target.onerror = null
                    e.target.src = '/logo-panda.png'
                  }}
                />
              </div>

              {/* Botones de acción para logo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: '1 1 200px' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  id="logo-file-input"
                />

                <button
                  type="button"
                  className="action-btn"
                  style={{
                    background: '#c4f039',
                    color: '#111d15',
                    border: 0,
                    borderRadius: '10px',
                    padding: '10px 16px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(196, 240, 57, 0.35)',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  Subir Nueva Imagen
                </button>

                <button
                  type="button"
                  className="action-btn"
                  style={{
                    background: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    padding: '8px 14px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                  onClick={handleRestoreDefaultLogo}
                >
                  Restaurar Logo Panda Original
                </button>
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Datos Comerciales */}
          <div className="dashboard-panel" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>
              🏢 Información de la Empresa
            </h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.88rem' }}>
              Actualiza el nombre que aparecerá en el encabezado, título de la ventana y comprobantes.
            </p>

            <div className="form-element">
              <label className="element-label" htmlFor="nombre-empresa">
                Nombre de la Empresa / Gimnasio *
              </label>
              <input
                id="nombre-empresa"
                className="input-field"
                type="text"
                value={formData.empresa_nombre}
                onChange={(e) => {
                  setFormData({ ...formData, empresa_nombre: e.target.value })
                  if (fieldErrors.empresa_nombre) setFieldErrors((prev) => ({ ...prev, empresa_nombre: '' }))
                }}
                placeholder="Ej. Panda Fitness"
                style={fieldErrors.empresa_nombre ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
              />
              {fieldErrors.empresa_nombre && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{fieldErrors.empresa_nombre}</span>
                </div>
              )}
            </div>

            <div className="form-element">
              <label className="element-label" htmlFor="descripcion-empresa">
                Descripción / Eslogan Comercial *
              </label>
              <textarea
                id="descripcion-empresa"
                className="input-field"
                rows={3}
                value={formData.empresa_descripcion}
                onChange={(e) => {
                  setFormData({ ...formData, empresa_descripcion: e.target.value })
                  if (fieldErrors.empresa_descripcion) setFieldErrors((prev) => ({ ...prev, empresa_descripcion: '' }))
                }}
                placeholder="Ej. Centro de Entrenamiento & Fitness Integral"
                style={{ resize: 'vertical', ...(fieldErrors.empresa_descripcion ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}) }}
              />
              {fieldErrors.empresa_descripcion && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{fieldErrors.empresa_descripcion}</span>
                </div>
              )}
            </div>

            <div className="form-element">
              <label className="element-label" htmlFor="capacidad-empresa">
                Aforo Máximo de Instalaciones *
              </label>
              <input
                id="capacidad-empresa"
                className="input-field"
                type="number"
                min="1"
                max="500"
                value={formData.max_capacidad}
                onChange={(e) => {
                  setFormData({ ...formData, max_capacidad: e.target.value })
                  if (fieldErrors.max_capacidad) setFieldErrors((prev) => ({ ...prev, max_capacidad: '' }))
                }}
                style={fieldErrors.max_capacidad ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
              />
              {fieldErrors.max_capacidad && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{fieldErrors.max_capacidad}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tarjeta 3: ESTADO OPERATIVO Y AVISOS DE EMERGENCIA */}
        <div
          className="dashboard-panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            border: formData.estado_operativo === 'cerrado_emergencia' ? '2px solid #f87171' : '1px solid #e2e8f0',
            background: formData.estado_operativo === 'cerrado_emergencia' ? '#fffbfb' : '#ffffff',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.4rem' }}>📢</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.18rem', color: '#0f172a', fontWeight: 800 }}>
                  Estado Operativo & Avisos / Emergencias a los Socios
                </h3>
                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.88rem' }}>
                  Permite notificar al instante a todos los socios en su dashboard si el club está cerrado por imprevistos, mantenimiento o tiene horario especial.
                </p>
              </div>
            </div>

            <span
              style={{
                padding: '6px 14px',
                borderRadius: '999px',
                fontWeight: 800,
                fontSize: '0.82rem',
                background:
                  formData.estado_operativo === 'cerrado_emergencia'
                    ? '#fee2e2'
                    : formData.estado_operativo === 'horario_especial'
                    ? '#fef3c7'
                    : '#ecfdf5',
                color:
                  formData.estado_operativo === 'cerrado_emergencia'
                    ? '#b91c1c'
                    : formData.estado_operativo === 'horario_especial'
                    ? '#b45309'
                    : '#047857',
              }}
            >
              {formData.estado_operativo === 'cerrado_emergencia'
                ? '🔴 Cerrado por Emergencia'
                : formData.estado_operativo === 'horario_especial'
                ? '🟡 Horario Especial'
                : '🟢 Operación Normal'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '20px', width: '100%', maxWidth: '100%' }}>
            <div className="form-element">
              <label className="element-label" htmlFor="estado-operativo-select">
                Estado Actual del Gimnasio
              </label>
              <select
                id="estado-operativo-select"
                className="input-field"
                value={formData.estado_operativo}
                onChange={(e) => setFormData({ ...formData, estado_operativo: e.target.value })}
              >
                <option value="normal">🟢 Abierto con normalidad (Horario habitual)</option>
                <option value="cerrado_emergencia">🔴 Cerrado por Mantenimiento / Emergencia (Sin acceso)</option>
                <option value="horario_especial">🟡 Horario Especial (Feriados o eventos especiales)</option>
              </select>
            </div>

            <div className="form-element" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <label className="element-label" style={{ marginBottom: '8px' }}>
                Difusión de Comunicado a Socios
              </label>
              <div className="form-check form-switch d-flex align-items-center gap-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="switch-aviso-activo"
                  style={{ width: '48px', height: '24px', cursor: 'pointer' }}
                  checked={formData.aviso_activo === '1'}
                  onChange={(e) => setFormData({ ...formData, aviso_activo: e.target.checked ? '1' : '0' })}
                />
                <label className="form-check-label fw-bold text-dark" htmlFor="switch-aviso-activo" style={{ cursor: 'pointer', fontSize: '0.92rem' }}>
                  {formData.aviso_activo === '1' ? 'Activo (Visible en Dashboard de Socios)' : 'Desactivado'}
                </label>
              </div>
            </div>
          </div>

          {formData.aviso_activo === '1' && (
            <div style={{ display: 'grid', gap: '14px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div className="form-element">
                <label className="element-label" htmlFor="aviso-titulo-input">
                  Título del Comunicado / Alerta *
                </label>
                <input
                  id="aviso-titulo-input"
                  className="input-field"
                  type="text"
                  placeholder="Ej: Cierre temporal por mantenimiento eléctrico o feriado"
                  value={formData.aviso_titulo}
                  onChange={(e) => setFormData({ ...formData, aviso_titulo: e.target.value })}
                />
              </div>

              <div className="form-element">
                <label className="element-label" htmlFor="aviso-mensaje-input">
                  Mensaje detallado para los socios *
                </label>
                <textarea
                  id="aviso-mensaje-input"
                  className="input-field"
                  rows={3}
                  placeholder="Ej: Estimados socios, hoy viernes las instalaciones permanecerán cerradas a partir de las 14:00 por mantenimiento programado de la sala de pesas. Retomamos atención el sábado a las 07:00 am."
                  value={formData.aviso_mensaje}
                  onChange={(e) => setFormData({ ...formData, aviso_mensaje: e.target.value })}
                />
              </div>

              {/* Vista previa en vivo */}
              <div style={{ marginTop: '6px' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Vista previa de la alerta (tal como la verán los socios en su inicio):
                </span>
                <div
                  style={{
                    marginTop: '8px',
                    padding: '14px 18px',
                    borderRadius: '12px',
                    background: formData.estado_operativo === 'cerrado_emergencia' ? '#fef2f2' : '#fffbeb',
                    border: `1.5px solid ${formData.estado_operativo === 'cerrado_emergencia' ? '#f87171' : '#fcd34d'}`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  <span style={{ fontSize: '1.4rem' }}>📢</span>
                  <div>
                    <strong style={{ color: formData.estado_operativo === 'cerrado_emergencia' ? '#991b1b' : '#92400e', fontSize: '0.96rem' }}>
                      {formData.aviso_titulo || 'Aviso Importante'}
                    </strong>
                    <p style={{ margin: '4px 0 0', color: formData.estado_operativo === 'cerrado_emergencia' ? '#7f1d1d' : '#78350f', fontSize: '0.88rem' }}>
                      {formData.aviso_mensaje || 'Ingresa el mensaje que se mostrará aquí a los socios.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tarjeta 4: HORARIOS DE ATENCIÓN OFICIALES DEL CLUB */}
        <div className="dashboard-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.4rem' }}>⏰</span>
              <h3 style={{ margin: 0, fontSize: '1.18rem', color: '#0f172a', fontWeight: 800 }}>
                Horarios de Atención del Club
              </h3>
            </div>
            <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
              Configura cómo opera el club de Lunes a Viernes (jornada corrida o dividida en 2 turnos con descanso al mediodía) y fines de semana.
            </p>
          </div>

          {/* Selector de Modalidad para Lunes a Viernes */}
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '10px' }}>
              Modalidad de Operación (Lunes a Viernes):
            </span>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn-sm d-flex align-items-center gap-2 px-3 py-2 ${
                  formData.horario_semana_modalidad === 'continuo' ? 'btn-dark shadow-sm' : 'btn-outline-secondary'
                }`}
                style={{
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  background: formData.horario_semana_modalidad === 'continuo' ? '#111d15' : '#ffffff',
                  color: formData.horario_semana_modalidad === 'continuo' ? '#c4f039' : '#475569',
                  border: formData.horario_semana_modalidad === 'continuo' ? '1.5px solid #c4f039' : '1px solid #cbd5e1',
                }}
                onClick={() => setFormData({ ...formData, horario_semana_modalidad: 'continuo' })}
              >
                <span>⚡ Horario Corrido / Continuo</span>
                <span className="badge rounded-pill" style={{ background: formData.horario_semana_modalidad === 'continuo' ? '#c4f039' : '#e2e8f0', color: '#111d15' }}>
                  Sin Cierre
                </span>
              </button>

              <button
                type="button"
                className={`btn btn-sm d-flex align-items-center gap-2 px-3 py-2 ${
                  formData.horario_semana_modalidad === 'partido' ? 'btn-dark shadow-sm' : 'btn-outline-secondary'
                }`}
                style={{
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  background: formData.horario_semana_modalidad === 'partido' ? '#111d15' : '#ffffff',
                  color: formData.horario_semana_modalidad === 'partido' ? '#c4f039' : '#475569',
                  border: formData.horario_semana_modalidad === 'partido' ? '1.5px solid #c4f039' : '1px solid #cbd5e1',
                }}
                onClick={() => setFormData({ ...formData, horario_semana_modalidad: 'partido' })}
              >
                <span>🌗 Dos Turnos (Mañana y Tarde)</span>
                <span className="badge rounded-pill" style={{ background: formData.horario_semana_modalidad === 'partido' ? '#c4f039' : '#e2e8f0', color: '#111d15' }}>
                  Con Descanso
                </span>
              </button>
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              {formData.horario_semana_modalidad === 'continuo'
                ? 'El gimnasio permanecerá abierto sin interrupción desde la hora de apertura hasta el cierre de la noche.'
                : 'El gimnasio cierra al mediodía (por almuerzo o mantenimiento de instalaciones) y reabre para el turno de la tarde/noche.'}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '20px', width: '100%', maxWidth: '100%' }}>
            {formData.horario_semana_modalidad === 'continuo' ? (
              /* Lunes a Viernes - Jornada Corrida */
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1.5px solid #86efac',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  gridColumn: 'span 2',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: '#0f172a', fontSize: '0.98rem' }}>🏢 Lunes a Viernes - Jornada Completa Corrida</strong>
                  <span style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: '6px', fontWeight: 800 }}>
                    Continuo Sin Pausa
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
                  <div className="form-element">
                    <label className="element-label" style={{ fontSize: '0.8rem' }} htmlFor="h-sem-corrido-ini">Hora de Apertura *</label>
                    <input
                      id="h-sem-corrido-ini"
                      type="time"
                      className="input-field"
                      value={formData.horario_semana_corrido_inicio}
                      onChange={(e) => {
                        setFormData({ ...formData, horario_semana_corrido_inicio: e.target.value })
                        if (fieldErrors.horario_semana_corrido) setFieldErrors((prev) => ({ ...prev, horario_semana_corrido: '' }))
                      }}
                      style={fieldErrors.horario_semana_corrido ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                    />
                  </div>
                  <div className="form-element">
                    <label className="element-label" style={{ fontSize: '0.8rem' }} htmlFor="h-sem-corrido-fin">Hora de Cierre Noche *</label>
                    <input
                      id="h-sem-corrido-fin"
                      type="time"
                      className="input-field"
                      value={formData.horario_semana_corrido_fin}
                      onChange={(e) => {
                        setFormData({ ...formData, horario_semana_corrido_fin: e.target.value })
                        if (fieldErrors.horario_semana_corrido) setFieldErrors((prev) => ({ ...prev, horario_semana_corrido: '' }))
                      }}
                      style={fieldErrors.horario_semana_corrido ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                    />
                  </div>
                </div>
                {fieldErrors.horario_semana_corrido && (
                  <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', color: '#dc2626' }}>
                    <i className="bi bi-exclamation-circle-fill"></i>
                    <span>{fieldErrors.horario_semana_corrido}</span>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Lunes a Viernes - Mañana */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>🌅 Lun a Vie - Turno Mañana</strong>
                    <span style={{ fontSize: '0.75rem', background: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>Activo</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-element">
                      <label className="element-label" style={{ fontSize: '0.8rem' }} htmlFor="h-sem-man-ini">Apertura</label>
                      <input
                        id="h-sem-man-ini"
                        type="time"
                        className="input-field"
                        value={formData.horario_semana_manana_inicio}
                        onChange={(e) => {
                          setFormData({ ...formData, horario_semana_manana_inicio: e.target.value })
                          if (fieldErrors.horario_semana_manana) setFieldErrors((prev) => ({ ...prev, horario_semana_manana: '' }))
                        }}
                        style={fieldErrors.horario_semana_manana ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                      />
                    </div>
                    <div className="form-element">
                      <label className="element-label" style={{ fontSize: '0.8rem' }} htmlFor="h-sem-man-fin">Cierre Mañana</label>
                      <input
                        id="h-sem-man-fin"
                        type="time"
                        className="input-field"
                        value={formData.horario_semana_manana_fin}
                        onChange={(e) => {
                          setFormData({ ...formData, horario_semana_manana_fin: e.target.value })
                          if (fieldErrors.horario_semana_manana) setFieldErrors((prev) => ({ ...prev, horario_semana_manana: '' }))
                        }}
                        style={fieldErrors.horario_semana_manana ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                      />
                    </div>
                  </div>
                  {fieldErrors.horario_semana_manana && (
                    <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', color: '#dc2626' }}>
                      <i className="bi bi-exclamation-circle-fill"></i>
                      <span>{fieldErrors.horario_semana_manana}</span>
                    </div>
                  )}
                </div>

                {/* Lunes a Viernes - Tarde/Noche */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>🌇 Lun a Vie - Turno Tarde/Noche</strong>
                    <span style={{ fontSize: '0.75rem', background: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>Activo</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-element">
                      <label className="element-label" style={{ fontSize: '0.8rem' }} htmlFor="h-sem-tar-ini">Reapertura Tarde</label>
                      <input
                        id="h-sem-tar-ini"
                        type="time"
                        className="input-field"
                        value={formData.horario_semana_tarde_inicio}
                        onChange={(e) => {
                          setFormData({ ...formData, horario_semana_tarde_inicio: e.target.value })
                          if (fieldErrors.horario_semana_tarde) setFieldErrors((prev) => ({ ...prev, horario_semana_tarde: '' }))
                        }}
                        style={fieldErrors.horario_semana_tarde ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                      />
                    </div>
                    <div className="form-element">
                      <label className="element-label" style={{ fontSize: '0.8rem' }} htmlFor="h-sem-tar-fin">Cierre Noche</label>
                      <input
                        id="h-sem-tar-fin"
                        type="time"
                        className="input-field"
                        value={formData.horario_semana_tarde_fin}
                        onChange={(e) => {
                          setFormData({ ...formData, horario_semana_tarde_fin: e.target.value })
                          if (fieldErrors.horario_semana_tarde) setFieldErrors((prev) => ({ ...prev, horario_semana_tarde: '' }))
                        }}
                        style={fieldErrors.horario_semana_tarde ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                      />
                    </div>
                  </div>
                  {fieldErrors.horario_semana_tarde && (
                    <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', color: '#dc2626' }}>
                      <i className="bi bi-exclamation-circle-fill"></i>
                      <span>{fieldErrors.horario_semana_tarde}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Sábados */}
            <div
              style={{
                background: formData.horario_sabado_estado === '0' ? '#fef2f2' : '#f8fafc',
                border: formData.horario_sabado_estado === '0' ? '1px solid #fca5a5' : '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>⚡ Sábados</strong>
                <span
                  style={{
                    fontSize: '0.75rem',
                    background: formData.horario_sabado_estado === '0' ? '#fee2e2' : '#fef3c7',
                    color: formData.horario_sabado_estado === '0' ? '#b91c1c' : '#b45309',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontWeight: 700,
                  }}
                >
                  {formData.horario_sabado_estado === '0' ? 'Cerrado' : 'Jornada Especial'}
                </span>
              </div>

              <div className="form-element">
                <label className="element-label" style={{ fontSize: '0.8rem' }} htmlFor="h-sab-estado">Atención los Sábados</label>
                <select
                  id="h-sab-estado"
                  className="input-field"
                  value={formData.horario_sabado_estado}
                  onChange={(e) => setFormData({ ...formData, horario_sabado_estado: e.target.value })}
                >
                  <option value="1">Abierto (Jornada de Entrenamiento)</option>
                  <option value="0">Cerrado (Descanso de fin de semana)</option>
                </select>
              </div>

              {formData.horario_sabado_estado !== '0' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-element">
                    <label className="element-label" style={{ fontSize: '0.8rem' }} htmlFor="h-sab-ini">Apertura</label>
                    <input
                      id="h-sab-ini"
                      type="time"
                      className="input-field"
                      value={formData.horario_sabado_inicio}
                      onChange={(e) => {
                        setFormData({ ...formData, horario_sabado_inicio: e.target.value })
                        if (fieldErrors.horario_sabado) setFieldErrors((prev) => ({ ...prev, horario_sabado: '' }))
                      }}
                      style={fieldErrors.horario_sabado ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                    />
                  </div>
                  <div className="form-element">
                    <label className="element-label" style={{ fontSize: '0.8rem' }} htmlFor="h-sab-fin">Cierre Sábado</label>
                    <input
                      id="h-sab-fin"
                      type="time"
                      className="input-field"
                      value={formData.horario_sabado_fin}
                      onChange={(e) => {
                        setFormData({ ...formData, horario_sabado_fin: e.target.value })
                        if (fieldErrors.horario_sabado) setFieldErrors((prev) => ({ ...prev, horario_sabado: '' }))
                      }}
                      style={fieldErrors.horario_sabado ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                    />
                  </div>
                </div>
              )}
              {fieldErrors.horario_sabado && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', color: '#dc2626' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{fieldErrors.horario_sabado}</span>
                </div>
              )}
            </div>

            {/* Domingos */}
            <div
              style={{
                background: formData.horario_domingo_abierto === '1' ? '#f0fdf4' : '#f8fafc',
                border: formData.horario_domingo_abierto === '1' ? '1px solid #86efac' : '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>☕ Domingos</strong>
                <span
                  style={{
                    fontSize: '0.75rem',
                    background: formData.horario_domingo_abierto === '1' ? '#ecfdf5' : '#f1f5f9',
                    color: formData.horario_domingo_abierto === '1' ? '#047857' : '#64748b',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontWeight: 700,
                  }}
                >
                  {formData.horario_domingo_abierto === '1' ? 'Abierto' : 'Cerrado'}
                </span>
              </div>

              <div className="form-element">
                <label className="element-label" style={{ fontSize: '0.8rem' }} htmlFor="h-dom-estado">Atención los Domingos</label>
                <select
                  id="h-dom-estado"
                  className="input-field"
                  value={formData.horario_domingo_abierto}
                  onChange={(e) => setFormData({ ...formData, horario_domingo_abierto: e.target.value })}
                >
                  <option value="0">Cerrado (Descanso de instalaciones)</option>
                  <option value="1">Abierto (Permitir ingreso)</option>
                </select>
              </div>

              {formData.horario_domingo_abierto === '1' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-element">
                    <label className="element-label" style={{ fontSize: '0.8rem' }} htmlFor="h-dom-ini">Apertura</label>
                    <input
                      id="h-dom-ini"
                      type="time"
                      className="input-field"
                      value={formData.horario_domingo_inicio}
                      onChange={(e) => {
                        setFormData({ ...formData, horario_domingo_inicio: e.target.value })
                        if (fieldErrors.horario_domingo) setFieldErrors((prev) => ({ ...prev, horario_domingo: '' }))
                      }}
                      style={fieldErrors.horario_domingo ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                    />
                  </div>
                  <div className="form-element">
                    <label className="element-label" style={{ fontSize: '0.8rem' }} htmlFor="h-dom-fin">Cierre Domingo</label>
                    <input
                      id="h-dom-fin"
                      type="time"
                      className="input-field"
                      value={formData.horario_domingo_fin}
                      onChange={(e) => {
                        setFormData({ ...formData, horario_domingo_fin: e.target.value })
                        if (fieldErrors.horario_domingo) setFieldErrors((prev) => ({ ...prev, horario_domingo: '' }))
                      }}
                      style={fieldErrors.horario_domingo ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                    />
                  </div>
                </div>
              )}
              {fieldErrors.horario_domingo && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', color: '#dc2626' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{fieldErrors.horario_domingo}</span>
                </div>
              )}
            </div>
          </div>

          {/* Resumen en Vivo de Horarios Vinculados */}
          <div
            style={{
              background: '#111d15',
              borderRadius: '14px',
              padding: '18px 22px',
              border: '1.5px solid #233c2a',
              marginTop: '8px',
            }}
          >
            <div style={{ color: '#c4f039', fontWeight: 800, fontSize: '0.86rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
              👁️ Vista Previa en Vivo de Horarios Vinculados (Portal Web, Dashboard y App):
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', color: '#e2e8f0' }}>
              <div>
                <strong style={{ color: '#ffffff' }}>• Lunes a Viernes: </strong>
                {formData.horario_semana_modalidad === 'continuo'
                  ? `${formData.horario_semana_corrido_inicio} a ${formData.horario_semana_corrido_fin} (Horario Corrido)`
                  : `${formData.horario_semana_manana_inicio} a ${formData.horario_semana_manana_fin} (Mañana) / ${formData.horario_semana_tarde_inicio} a ${formData.horario_semana_tarde_fin} (Tarde/Noche)`}
              </div>
              <div>
                <strong style={{ color: '#ffffff' }}>• Sábados: </strong>
                {formData.horario_sabado_estado === '0'
                  ? 'Cerrado'
                  : `${formData.horario_sabado_inicio} a ${formData.horario_sabado_fin}`}
              </div>
              <div>
                <strong style={{ color: '#ffffff' }}>• Domingos: </strong>
                {formData.horario_domingo_abierto === '1'
                  ? `${formData.horario_domingo_inicio} a ${formData.horario_domingo_fin}`
                  : 'Cerrado (Descanso de instalaciones)'}
              </div>
            </div>
          </div>
        </div>

        {/* Tarjeta 4: Personalización del Portal Web Público y Landing Page */}
        <div className="dashboard-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '1.2rem', color: '#0f172a', fontWeight: 800 }}>
                🌐 Portal Web y Landing Page Pública
              </h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.88rem' }}>
                Configura los textos promocionales, dirección, redes sociales e información de la página principal del club.
              </p>
            </div>

            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: '1.5px solid #111d15',
                background: '#ffffff',
                color: '#111d15',
                fontWeight: 800,
                fontSize: '0.82rem',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Ver Portal Web Público</span>
              <span>↗</span>
            </a>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '20px', width: '100%', maxWidth: '100%' }}>
            {/* Título Hero */}
            <div className="form-element">
              <label className="element-label" htmlFor="landing-titulo">
                Título Principal del Hero (Eslogan)
              </label>
              <input
                id="landing-titulo"
                type="text"
                className="input-field"
                value={formData.landing_hero_titulo}
                onChange={(e) => setFormData({ ...formData, landing_hero_titulo: e.target.value })}
                placeholder="Ej: Entrena, Evoluciona y Gana Premios en Panda Fitness"
              />
            </div>

            {/* Teléfono / WhatsApp */}
            <div className="form-element">
              <label className="element-label" htmlFor="landing-tel">
                Teléfono / WhatsApp de Contacto
              </label>
              <input
                id="landing-tel"
                type="text"
                className="input-field"
                value={formData.landing_gym_telefono}
                onChange={(e) => setFormData({ ...formData, landing_gym_telefono: e.target.value, landing_redes_whatsapp: e.target.value })}
                placeholder="Ej: +51 987 654 321"
              />
            </div>

            {/* Dirección Física */}
            <div className="form-element">
              <label className="element-label" htmlFor="landing-dir">
                Dirección Física del Gimnasio
              </label>
              <input
                id="landing-dir"
                type="text"
                className="input-field"
                value={formData.landing_gym_direccion}
                onChange={(e) => setFormData({ ...formData, landing_gym_direccion: e.target.value })}
                placeholder="Ej: Av. Principal Los Olivos 450, Centro Deportivo"
              />
            </div>

            {/* Enlace a Google Maps */}
            <div className="form-element">
              <label className="element-label" htmlFor="landing-mapa">
                Enlace de Ubicación en Google Maps
              </label>
              <input
                id="landing-mapa"
                type="url"
                className="input-field"
                value={formData.landing_gym_mapa_url}
                onChange={(e) => setFormData({ ...formData, landing_gym_mapa_url: e.target.value })}
                placeholder="https://maps.google.com/..."
              />
            </div>
          </div>

          {/* Subtítulo Hero */}
          <div className="form-element">
            <label className="element-label" htmlFor="landing-sub">
              Subtítulo y Descripción de la Portada
            </label>
            <textarea
              id="landing-sub"
              className="input-field"
              rows="2"
              value={formData.landing_hero_subtitulo}
              onChange={(e) => setFormData({ ...formData, landing_hero_subtitulo: e.target.value })}
              placeholder="Describe los beneficios y servicios de Panda Fitness..."
            />
          </div>

          {/* Redes Sociales */}
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <strong style={{ display: 'block', marginBottom: '12px', fontSize: '0.92rem', color: '#0f172a' }}>
              📱 Redes Sociales del Gimnasio
            </strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>Instagram</label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.landing_redes_instagram}
                  onChange={(e) => setFormData({ ...formData, landing_redes_instagram: e.target.value })}
                  placeholder="@pandafitness_oficial"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>TikTok</label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.landing_redes_tiktok}
                  onChange={(e) => setFormData({ ...formData, landing_redes_tiktok: e.target.value })}
                  placeholder="@pandafitness_gym"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>Facebook</label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.landing_redes_facebook}
                  onChange={(e) => setFormData({ ...formData, landing_redes_facebook: e.target.value })}
                  placeholder="pandafitnessclub"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Acciones Final */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '14px' }}>
          <button
            type="submit"
            className="action-btn"
            disabled={saving}
            style={{
              minWidth: '240px',
              padding: '14px 28px',
              borderRadius: '12px',
              background: '#c4f039',
              color: '#111d15',
              fontWeight: 800,
              fontSize: '1rem',
              border: 0,
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: '0 8px 20px rgba(196, 240, 57, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
            }}
          >
            {saving ? (
              <>
                <span className="spinner-border" style={{ width: '16px', height: '16px', borderColor: '#111d15', borderTopColor: 'transparent' }}></span>
                Guardando cambios...
              </>
            ) : (
              'Guardar Configuración'
            )}
          </button>
        </div>

        {/* Botón Flotante para Celular (Abajo) */}
        <div
          className="d-md-none position-fixed"
          style={{
            bottom: '76px',
            right: '16px',
            zIndex: 1035,
          }}
        >
          <button
            type="submit"
            className="btn btn-dark shadow-lg d-flex align-items-center gap-2 px-4 py-3 fw-bold rounded-pill"
            disabled={saving}
            style={{
              background: '#c4f039',
              color: '#111d15',
              border: 'none',
              boxShadow: '0 8px 24px rgba(196, 240, 57, 0.45)',
            }}
          >
            <span>{saving ? 'Guardando...' : '✓ Guardar'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}

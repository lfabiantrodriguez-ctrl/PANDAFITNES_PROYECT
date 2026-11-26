import { useEffect, useRef, useState } from 'react'
import ViewTitle from '../components/ViewTitle'
import { ConfigService } from '../services/ConfigService'
import { ZkService } from '../services/ZkService'
import { moduleLabel } from '../utils/access'
import '../styles/CompanySettings.css'

const TABS = [
  { id: 'general', label: 'Datos y logo', icon: 'bi-building' },
  { id: 'status', label: 'Estado y avisos', icon: 'bi-megaphone' },
  { id: 'schedule', label: 'Horarios', icon: 'bi-clock' },
  { id: 'contact', label: 'Contacto y redes', icon: 'bi-globe' },
  { id: 'zk', label: 'Huellero / ZKTeco', icon: 'bi-hdd-network' },
]

function FieldError({ message }) {
  if (!message) return null
  return (
    <div className="cs-error-text">
      <i className="bi bi-exclamation-circle-fill" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

export default function CompanySettingsView({ token }) {
  const fileInputRef = useRef(null)
  const [activeTab, setActiveTab] = useState('general')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const [fieldErrors, setFieldErrors] = useState({})
  const [zkInfo, setZkInfo] = useState(null)
  const [zkMarcaciones, setZkMarcaciones] = useState([])
  const [zkLoading, setZkLoading] = useState(false)
  const [zkBusy, setZkBusy] = useState(false)
  const [zkFeedback, setZkFeedback] = useState({ type: '', text: '' })

  const [formData, setFormData] = useState({
    empresa_nombre: 'Panda Fitness',
    empresa_descripcion: 'Centro de Entrenamiento & Fitness Integral',
    empresa_logo: '/logo-panda.png',
    max_capacidad: '50',
    horario_semana_modalidad: 'partido',
    horario_semana_corrido_inicio: '06:30',
    horario_semana_corrido_fin: '22:00',
    horario_semana_manana_inicio: '06:30',
    horario_semana_manana_fin: '11:00',
    horario_semana_tarde_inicio: '16:00',
    horario_semana_tarde_fin: '22:00',
    horario_sabado_estado: '1',
    horario_sabado_modalidad: 'continuo',
    horario_sabado_inicio: '07:00',
    horario_sabado_fin: '12:00',
    horario_sabado_tarde_inicio: '16:00',
    horario_sabado_tarde_fin: '20:00',
    horario_domingo_abierto: '0',
    horario_domingo_modalidad: 'continuo',
    horario_domingo_inicio: '08:00',
    horario_domingo_fin: '13:00',
    horario_domingo_tarde_inicio: '16:00',
    horario_domingo_tarde_fin: '20:00',
    estado_operativo: 'normal',
    aviso_activo: '0',
    aviso_titulo: 'Comunicado del Club',
    aviso_mensaje: '',
    landing_gym_direccion: 'Av. Principal Los Olivos 450, Centro Deportivo Panda',
    landing_gym_telefono: '+51 987 654 321',
    landing_gym_mapa_url: 'https://maps.google.com',
    landing_redes_instagram: 'pandafitness_oficial',
    landing_redes_tiktok: '@pandafitness_gym',
    landing_redes_whatsapp: '+51 987 654 321',
    pago_yape_numero: '987654321',
    pago_plin_numero: '987654321',
    pago_titular: 'Panda Fitness Club',
    pago_transferencia_cuenta: '',
    pago_instrucciones: 'Realiza el Yape o Plin y adjunta tu pantallazo al solicitar la renovación para validarlo rápido.',
  })

  const [logoPreview, setLogoPreview] = useState('/logo-panda.png')

  useEffect(() => {
    let active = true
    ConfigService.getConfig()
      .then((data) => {
        if (!active || !data) return
        setFormData((prev) => ({
          ...prev,
          empresa_nombre: data.empresa_nombre || prev.empresa_nombre,
          empresa_descripcion: data.empresa_descripcion || prev.empresa_descripcion,
          empresa_logo: data.empresa_logo || prev.empresa_logo,
          max_capacidad: data.max_capacidad || prev.max_capacidad,
          horario_semana_modalidad: data.horario_semana_modalidad || prev.horario_semana_modalidad,
          horario_semana_corrido_inicio: data.horario_semana_corrido_inicio || prev.horario_semana_corrido_inicio,
          horario_semana_corrido_fin: data.horario_semana_corrido_fin || prev.horario_semana_corrido_fin,
          horario_semana_manana_inicio: data.horario_semana_manana_inicio || prev.horario_semana_manana_inicio,
          horario_semana_manana_fin: data.horario_semana_manana_fin || prev.horario_semana_manana_fin,
          horario_semana_tarde_inicio: data.horario_semana_tarde_inicio || prev.horario_semana_tarde_inicio,
          horario_semana_tarde_fin: data.horario_semana_tarde_fin || prev.horario_semana_tarde_fin,
          horario_sabado_estado: data.horario_sabado_estado !== undefined ? data.horario_sabado_estado : prev.horario_sabado_estado,
          horario_sabado_modalidad: data.horario_sabado_modalidad || prev.horario_sabado_modalidad,
          horario_sabado_inicio: data.horario_sabado_inicio || prev.horario_sabado_inicio,
          horario_sabado_fin: data.horario_sabado_fin || prev.horario_sabado_fin,
          horario_sabado_tarde_inicio: data.horario_sabado_tarde_inicio || prev.horario_sabado_tarde_inicio,
          horario_sabado_tarde_fin: data.horario_sabado_tarde_fin || prev.horario_sabado_tarde_fin,
          horario_domingo_abierto: data.horario_domingo_abierto || prev.horario_domingo_abierto,
          horario_domingo_modalidad: data.horario_domingo_modalidad || prev.horario_domingo_modalidad,
          horario_domingo_inicio: data.horario_domingo_inicio || prev.horario_domingo_inicio,
          horario_domingo_fin: data.horario_domingo_fin || prev.horario_domingo_fin,
          horario_domingo_tarde_inicio: data.horario_domingo_tarde_inicio || prev.horario_domingo_tarde_inicio,
          horario_domingo_tarde_fin: data.horario_domingo_tarde_fin || prev.horario_domingo_tarde_fin,
          estado_operativo: data.estado_operativo || prev.estado_operativo,
          aviso_activo: data.aviso_activo || prev.aviso_activo,
          aviso_titulo: data.aviso_titulo || prev.aviso_titulo,
          aviso_mensaje: data.aviso_mensaje || '',
          landing_gym_direccion: data.landing_gym_direccion || prev.landing_gym_direccion,
          landing_gym_telefono: data.landing_gym_telefono || prev.landing_gym_telefono,
          landing_gym_mapa_url: data.landing_gym_mapa_url || prev.landing_gym_mapa_url,
          landing_redes_instagram: data.landing_redes_instagram || prev.landing_redes_instagram,
          landing_redes_tiktok: data.landing_redes_tiktok || prev.landing_redes_tiktok,
          landing_redes_whatsapp: data.landing_redes_whatsapp || prev.landing_redes_whatsapp,
          pago_yape_numero: data.pago_yape_numero ?? prev.pago_yape_numero,
          pago_plin_numero: data.pago_plin_numero ?? prev.pago_plin_numero,
          pago_titular: data.pago_titular ?? prev.pago_titular,
          pago_transferencia_cuenta: data.pago_transferencia_cuenta ?? prev.pago_transferencia_cuenta,
          pago_instrucciones: data.pago_instrucciones ?? prev.pago_instrucciones,
        }))
        setLogoPreview(data.empresa_logo || '/logo-panda.png')
      })
      .catch((err) => {
        if (!active) return
        setMessage('Error al cargar: ' + err.message)
        setMessageType('error')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setMessage('Selecciona una imagen válida (PNG, JPG, SVG o WebP).')
      setMessageType('error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('La imagen no debe superar 5 MB.')
      setMessageType('error')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result
      setLogoPreview(base64)
      setFormData((prev) => ({ ...prev, empresa_logo: base64 }))
      setMessage('Imagen lista. Guarda los cambios para aplicarla.')
      setMessageType('info')
    }
    reader.readAsDataURL(file)
  }

  function handleRestoreDefaultLogo() {
    setLogoPreview('/logo-panda.png')
    setFormData((prev) => ({ ...prev, empresa_logo: '/logo-panda.png' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
    setMessage('Logo original restaurado. Guarda los cambios para confirmar.')
    setMessageType('info')
  }

  async function loadZkData() {
    if (!token) return
    setZkLoading(true)
    setZkFeedback({ type: '', text: '' })
    try {
      const [info, list] = await Promise.all([
        ZkService.getTokenInfo(token),
        ZkService.getRecentMarcaciones(token, 15),
      ])
      setZkInfo(info)
      setZkMarcaciones(list)
    } catch (err) {
      setZkFeedback({ type: 'error', text: err.message || 'No se pudo cargar la configuración ZKTeco.' })
    } finally {
      setZkLoading(false)
    }
  }

  async function handleRegenerateZkToken() {
    if (!token || zkBusy) return
    setZkBusy(true)
    setZkFeedback({ type: '', text: '' })
    try {
      const res = await ZkService.regenerateToken(token)
      setZkInfo((prev) => (prev ? { ...prev, token: res.token } : { token: res.token, webhookPath: '/api/zk/marcaciones' }))
      setZkFeedback({
        type: 'success',
        text: 'Token ZKTeco regenerado. Actualiza config.ini en los agentes puente conectados.',
      })
    } catch (err) {
      setZkFeedback({ type: 'error', text: err.message || 'Error al regenerar el token ZKTeco.' })
    } finally {
      setZkBusy(false)
    }
  }

  async function handlePingZk() {
    if (!zkInfo?.token || zkBusy) return
    setZkBusy(true)
    setZkFeedback({ type: '', text: '' })
    try {
      const res = await ZkService.pingWebhook(zkInfo.token)
      setZkFeedback({
        type: 'success',
        text: `Webhook activo (${res.club || 'Panda Fitness'}). Token validado correctamente.`,
      })
    } catch (err) {
      setZkFeedback({ type: 'error', text: err.message || 'Error al validar webhook ZKTeco.' })
    } finally {
      setZkBusy(false)
    }
  }

  async function handleCopyText(text, label) {
    try {
      await navigator.clipboard.writeText(text)
      setZkFeedback({ type: 'info', text: `${label} copiado al portapapeles.` })
    } catch {
      setZkFeedback({ type: 'error', text: `No se pudo copiar ${label}. Cópialo manualmente.` })
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = {}

    if (!formData.empresa_nombre?.trim()) {
      errors.empresa_nombre = 'Ingresa el nombre del club.'
    }
    if (!formData.empresa_descripcion?.trim()) {
      errors.empresa_descripcion = 'Ingresa una descripción breve.'
    }
    const cap = Number(formData.max_capacidad)
    if (!formData.max_capacidad || Number.isNaN(cap) || cap < 1) {
      errors.max_capacidad = 'El aforo debe ser mayor a 0.'
    }

    if (formData.aviso_activo === '1') {
      if (!formData.aviso_titulo?.trim()) {
        errors.aviso_titulo = 'Ingresa el título del aviso.'
      }
      if (!formData.aviso_mensaje?.trim()) {
        errors.aviso_mensaje = 'Ingresa el mensaje del aviso.'
      }
    }

    if (formData.horario_semana_modalidad === 'continuo') {
      if (formData.horario_semana_corrido_inicio >= formData.horario_semana_corrido_fin) {
        errors.horario_semana_corrido = 'La apertura debe ser menor al cierre.'
      }
    } else {
      if (formData.horario_semana_manana_inicio >= formData.horario_semana_manana_fin) {
        errors.horario_semana_manana = 'La apertura debe ser menor al cierre.'
      }
      if (formData.horario_semana_tarde_inicio >= formData.horario_semana_tarde_fin) {
        errors.horario_semana_tarde = 'La apertura debe ser menor al cierre.'
      }
    }

    if (formData.horario_sabado_estado === '1') {
      if (formData.horario_sabado_inicio >= formData.horario_sabado_fin) {
        errors.horario_sabado = 'La apertura debe ser menor al cierre.'
      } else if (
        formData.horario_sabado_modalidad === 'partido' &&
        formData.horario_sabado_tarde_inicio >= formData.horario_sabado_tarde_fin
      ) {
        errors.horario_sabado = 'La apertura de tarde debe ser menor al cierre.'
      }
    }

    if (formData.horario_domingo_abierto === '1') {
      if (formData.horario_domingo_inicio >= formData.horario_domingo_fin) {
        errors.horario_domingo = 'La apertura debe ser menor al cierre.'
      } else if (
        formData.horario_domingo_modalidad === 'partido' &&
        formData.horario_domingo_tarde_inicio >= formData.horario_domingo_tarde_fin
      ) {
        errors.horario_domingo = 'La apertura de tarde debe ser menor al cierre.'
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      if (errors.empresa_nombre || errors.empresa_descripcion || errors.max_capacidad) {
        setActiveTab('general')
      } else if (errors.aviso_titulo || errors.aviso_mensaje) {
        setActiveTab('status')
      } else {
        setActiveTab('schedule')
      }
      return
    }

    setFieldErrors({})
    setSaving(true)
    setMessage('')

    try {
      const res = await ConfigService.updateConfig(token, formData)
      setMessage(res.message || 'Configuración guardada.')
      setMessageType('success')
      ConfigService.applyBranding(formData)
      window.dispatchEvent(new CustomEvent('panda_config_updated', { detail: formData }))
      window.dispatchEvent(new Event('panda_notifications_updated'))
    } catch (err) {
      setMessage(err.message || 'Error al guardar.')
      setMessageType('error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <ViewTitle title={moduleLabel('configuracion')} subtitle="Parámetros del club." />
        <div className="dashboard-panel" style={{ textAlign: 'center', padding: '40px' }}>
          <span className="spinner-border" style={{ borderColor: '#c4f039', borderTopColor: '#111d15' }} />
          <p className="cs-subtext" style={{ marginTop: '12px' }}>Cargando configuración...</p>
        </div>
      </div>
    )
  }

  const statusMeta =
    formData.estado_operativo === 'cerrado_emergencia'
      ? { cls: 'is-closed', label: 'Cerrado', icon: 'bi-x-circle-fill' }
      : formData.estado_operativo === 'horario_especial'
      ? { cls: 'is-special', label: 'Horario especial', icon: 'bi-exclamation-circle-fill' }
      : { cls: 'is-normal', label: 'Normal', icon: 'bi-check-circle-fill' }

  return (
    <div className="dashboard-page">
      <ViewTitle title={moduleLabel('configuracion')} subtitle="Logo, datos del club, horarios y contacto." />

      <div className="cs-tabs" role="tablist" aria-label="Secciones de configuración">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`cs-tab-btn ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id)
              if (tab.id === 'zk' && !zkInfo) {
                loadZkData()
              }
            }}
          >
            <i className={`bi ${tab.icon}`} aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab !== 'zk' && message && (
        <div
          className={`cs-alert ${
            messageType === 'success' ? 'is-success' : messageType === 'info' ? 'is-info' : 'is-error'
          }`}
          role="status"
        >
          <i
            className={`bi ${
              messageType === 'success'
                ? 'bi-check-circle-fill'
                : messageType === 'info'
                ? 'bi-info-circle-fill'
                : 'bi-exclamation-triangle-fill'
            }`}
            aria-hidden="true"
          />
          <span>{message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="cs-form">
        {activeTab === 'general' && (
          <div className="cs-grid-2">
            <div className="dashboard-panel cs-panel">
              <div>
                <h3 className="cs-panel-title">
                  <i className="bi bi-image" aria-hidden="true" /> Logotipo
                </h3>
                <p className="cs-subtext">Visible en el sistema, acceso y pestaña.</p>
              </div>

              <div className="cs-logo-row">
                <div className="cs-logo-circle">
                  <img
                    src={logoPreview}
                    alt="Vista previa del logo"
                    onError={(e) => {
                      e.target.onerror = null
                      e.target.src = '/logo-panda.png'
                    }}
                  />
                </div>

                <div className="cs-logo-actions">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    id="logo-file-input"
                  />
                  <button type="button" className="cs-btn-lime" onClick={() => fileInputRef.current?.click()}>
                    <i className="bi bi-upload" aria-hidden="true" />
                    <span>Subir imagen</span>
                  </button>
                  <button type="button" className="cs-btn-muted" onClick={handleRestoreDefaultLogo}>
                    <i className="bi bi-arrow-counterclockwise" aria-hidden="true" />
                    <span>Restaurar original</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="dashboard-panel cs-panel">
              <div>
                <h3 className="cs-panel-title">
                  <i className="bi bi-building" aria-hidden="true" /> Datos del club
                </h3>
                <p className="cs-subtext">Nombre comercial, descripción y aforo.</p>
              </div>

              <div className="form-element">
                <label className="element-label" htmlFor="nombre-empresa">Nombre *</label>
                <input
                  id="nombre-empresa"
                  className={`input-field ${fieldErrors.empresa_nombre ? 'cs-input-error' : ''}`}
                  type="text"
                  value={formData.empresa_nombre}
                  onChange={(e) => {
                    setFormData({ ...formData, empresa_nombre: e.target.value })
                    if (fieldErrors.empresa_nombre) setFieldErrors((prev) => ({ ...prev, empresa_nombre: '' }))
                  }}
                  placeholder="Panda Fitness"
                />
                <FieldError message={fieldErrors.empresa_nombre} />
              </div>

              <div className="form-element">
                <label className="element-label" htmlFor="descripcion-empresa">Descripción breve *</label>
                <input
                  id="descripcion-empresa"
                  className={`input-field ${fieldErrors.empresa_descripcion ? 'cs-input-error' : ''}`}
                  type="text"
                  value={formData.empresa_descripcion}
                  onChange={(e) => {
                    setFormData({ ...formData, empresa_descripcion: e.target.value })
                    if (fieldErrors.empresa_descripcion) setFieldErrors((prev) => ({ ...prev, empresa_descripcion: '' }))
                  }}
                  placeholder="Centro de Entrenamiento & Fitness Integral"
                />
                <FieldError message={fieldErrors.empresa_descripcion} />
              </div>

              <div className="form-element">
                <label className="element-label" htmlFor="capacidad-empresa">Aforo máximo *</label>
                <input
                  id="capacidad-empresa"
                  className={`input-field ${fieldErrors.max_capacidad ? 'cs-input-error' : ''}`}
                  type="number"
                  min="1"
                  max="500"
                  value={formData.max_capacidad}
                  onChange={(e) => {
                    setFormData({ ...formData, max_capacidad: e.target.value })
                    if (fieldErrors.max_capacidad) setFieldErrors((prev) => ({ ...prev, max_capacidad: '' }))
                  }}
                />
                <FieldError message={fieldErrors.max_capacidad} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'status' && (
          <div
            className="dashboard-panel cs-panel"
            style={
              formData.estado_operativo === 'cerrado_emergencia'
                ? { border: '1.5px solid #f87171', background: '#fffbfb' }
                : undefined
            }
          >
            <div className="cs-panel-head">
              <div>
                <h3 className="cs-panel-title">
                  <i className="bi bi-megaphone" aria-hidden="true" /> Estado operativo y avisos
                </h3>
                <p className="cs-subtext">Controla la disponibilidad y alertas en el portal.</p>
              </div>
              <span className={`cs-status-pill ${statusMeta.cls}`}>
                <i className={`bi ${statusMeta.icon}`} aria-hidden="true" />
                <span>{statusMeta.label}</span>
              </span>
            </div>

            <div className="cs-grid-2">
              <div className="form-element">
                <label className="element-label" htmlFor="estado-operativo-select">Estado del club</label>
                <select
                  id="estado-operativo-select"
                  className="input-field"
                  value={formData.estado_operativo}
                  onChange={(e) => setFormData({ ...formData, estado_operativo: e.target.value })}
                >
                  <option value="normal">Normal (Horario habitual)</option>
                  <option value="horario_especial">Horario especial</option>
                  <option value="cerrado_emergencia">Cerrado por emergencia</option>
                </select>
              </div>

              <div className="form-element" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <label className="element-label" htmlFor="switch-aviso-activo" style={{ marginBottom: '8px' }}>
                  Aviso público
                </label>
                <div className="form-check form-switch d-flex align-items-center gap-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="switch-aviso-activo"
                    style={{ width: '46px', height: '24px', cursor: 'pointer' }}
                    checked={formData.aviso_activo === '1'}
                    onChange={(e) => setFormData({ ...formData, aviso_activo: e.target.checked ? '1' : '0' })}
                  />
                  <label className="form-check-label fw-bold text-dark" htmlFor="switch-aviso-activo" style={{ cursor: 'pointer', fontSize: '0.9rem' }}>
                    {formData.aviso_activo === '1' ? 'Visible' : 'Desactivado'}
                  </label>
                </div>
              </div>
            </div>

            {formData.aviso_activo === '1' && (
              <div className="cs-box">
                <div className="form-element">
                  <label className="element-label" htmlFor="aviso-titulo-input">Título *</label>
                  <input
                    id="aviso-titulo-input"
                    className={`input-field ${fieldErrors.aviso_titulo ? 'cs-input-error' : ''}`}
                    type="text"
                    placeholder="Ej. Horario por feriado"
                    value={formData.aviso_titulo}
                    onChange={(e) => {
                      setFormData({ ...formData, aviso_titulo: e.target.value })
                      if (fieldErrors.aviso_titulo) setFieldErrors((prev) => ({ ...prev, aviso_titulo: '' }))
                    }}
                  />
                  <FieldError message={fieldErrors.aviso_titulo} />
                </div>

                <div className="form-element">
                  <label className="element-label" htmlFor="aviso-mensaje-input">Mensaje *</label>
                  <textarea
                    id="aviso-mensaje-input"
                    className={`input-field ${fieldErrors.aviso_mensaje ? 'cs-input-error' : ''}`}
                    rows={2}
                    placeholder="Mensaje breve para los socios..."
                    value={formData.aviso_mensaje}
                    onChange={(e) => {
                      setFormData({ ...formData, aviso_mensaje: e.target.value })
                      if (fieldErrors.aviso_mensaje) setFieldErrors((prev) => ({ ...prev, aviso_mensaje: '' }))
                    }}
                  />
                  <FieldError message={fieldErrors.aviso_mensaje} />
                </div>

                <div className={`cs-notice-preview ${formData.estado_operativo === 'cerrado_emergencia' ? 'is-closed' : ''}`}>
                  <i className="bi bi-info-circle-fill" aria-hidden="true" />
                  <div>
                    <strong>{formData.aviso_titulo || 'Comunicado'}: </strong>
                    <span>{formData.aviso_mensaje || 'Vista previa del mensaje.'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="dashboard-panel cs-panel">
            <div>
              <h3 className="cs-panel-title">
                <i className="bi bi-clock" aria-hidden="true" /> Horarios de atención
              </h3>
              <p className="cs-subtext">Define el horario semanal, sábados y domingos.</p>
            </div>

            <div className="cs-box">
              <span className="element-label">Lunes a viernes</span>
              <div className="cs-mode-group">
                <button
                  type="button"
                  className={`cs-mode-btn ${formData.horario_semana_modalidad === 'continuo' ? 'is-selected' : ''}`}
                  onClick={() => setFormData({ ...formData, horario_semana_modalidad: 'continuo' })}
                >
                  <i className="bi bi-clock-history" aria-hidden="true" />
                  <span>Continuo</span>
                </button>
                <button
                  type="button"
                  className={`cs-mode-btn ${formData.horario_semana_modalidad === 'partido' ? 'is-selected' : ''}`}
                  onClick={() => setFormData({ ...formData, horario_semana_modalidad: 'partido' })}
                >
                  <i className="bi bi-calendar2-week" aria-hidden="true" />
                  <span>Dos turnos</span>
                </button>
              </div>
            </div>

            <div className="cs-grid-2">
              {formData.horario_semana_modalidad === 'continuo' ? (
                <div className="cs-box is-open" style={{ gridColumn: '1 / -1' }}>
                  <div className="cs-box-head">
                    <strong>
                      <i className="bi bi-calendar-check" aria-hidden="true" /> Lunes a viernes
                    </strong>
                    <span className="cs-badge is-green">Continuo</span>
                  </div>
                  <div className="cs-time-grid">
                    <div className="form-element">
                      <label className="element-label" htmlFor="h-sem-corrido-ini">Apertura</label>
                      <input
                        id="h-sem-corrido-ini"
                        type="time"
                        className={`input-field ${fieldErrors.horario_semana_corrido ? 'cs-input-error' : ''}`}
                        value={formData.horario_semana_corrido_inicio}
                        onChange={(e) => {
                          setFormData({ ...formData, horario_semana_corrido_inicio: e.target.value })
                          if (fieldErrors.horario_semana_corrido) setFieldErrors((prev) => ({ ...prev, horario_semana_corrido: '' }))
                        }}
                      />
                    </div>
                    <div className="form-element">
                      <label className="element-label" htmlFor="h-sem-corrido-fin">Cierre</label>
                      <input
                        id="h-sem-corrido-fin"
                        type="time"
                        className={`input-field ${fieldErrors.horario_semana_corrido ? 'cs-input-error' : ''}`}
                        value={formData.horario_semana_corrido_fin}
                        onChange={(e) => {
                          setFormData({ ...formData, horario_semana_corrido_fin: e.target.value })
                          if (fieldErrors.horario_semana_corrido) setFieldErrors((prev) => ({ ...prev, horario_semana_corrido: '' }))
                        }}
                      />
                    </div>
                  </div>
                  <FieldError message={fieldErrors.horario_semana_corrido} />
                </div>
              ) : (
                <>
                  <div className="cs-box">
                    <div className="cs-box-head">
                      <strong>
                        <i className="bi bi-sunrise" aria-hidden="true" /> Turno mañana
                      </strong>
                      <span className="cs-badge is-green">Lun - Vie</span>
                    </div>
                    <div className="cs-time-grid">
                      <div className="form-element">
                        <label className="element-label" htmlFor="h-sem-man-ini">Apertura</label>
                        <input
                          id="h-sem-man-ini"
                          type="time"
                          className={`input-field ${fieldErrors.horario_semana_manana ? 'cs-input-error' : ''}`}
                          value={formData.horario_semana_manana_inicio}
                          onChange={(e) => {
                            setFormData({ ...formData, horario_semana_manana_inicio: e.target.value })
                            if (fieldErrors.horario_semana_manana) setFieldErrors((prev) => ({ ...prev, horario_semana_manana: '' }))
                          }}
                        />
                      </div>
                      <div className="form-element">
                        <label className="element-label" htmlFor="h-sem-man-fin">Cierre</label>
                        <input
                          id="h-sem-man-fin"
                          type="time"
                          className={`input-field ${fieldErrors.horario_semana_manana ? 'cs-input-error' : ''}`}
                          value={formData.horario_semana_manana_fin}
                          onChange={(e) => {
                            setFormData({ ...formData, horario_semana_manana_fin: e.target.value })
                            if (fieldErrors.horario_semana_manana) setFieldErrors((prev) => ({ ...prev, horario_semana_manana: '' }))
                          }}
                        />
                      </div>
                    </div>
                    <FieldError message={fieldErrors.horario_semana_manana} />
                  </div>

                  <div className="cs-box">
                    <div className="cs-box-head">
                      <strong>
                        <i className="bi bi-sunset" aria-hidden="true" /> Turno tarde
                      </strong>
                      <span className="cs-badge is-green">Lun - Vie</span>
                    </div>
                    <div className="cs-time-grid">
                      <div className="form-element">
                        <label className="element-label" htmlFor="h-sem-tar-ini">Apertura</label>
                        <input
                          id="h-sem-tar-ini"
                          type="time"
                          className={`input-field ${fieldErrors.horario_semana_tarde ? 'cs-input-error' : ''}`}
                          value={formData.horario_semana_tarde_inicio}
                          onChange={(e) => {
                            setFormData({ ...formData, horario_semana_tarde_inicio: e.target.value })
                            if (fieldErrors.horario_semana_tarde) setFieldErrors((prev) => ({ ...prev, horario_semana_tarde: '' }))
                          }}
                        />
                      </div>
                      <div className="form-element">
                        <label className="element-label" htmlFor="h-sem-tar-fin">Cierre</label>
                        <input
                          id="h-sem-tar-fin"
                          type="time"
                          className={`input-field ${fieldErrors.horario_semana_tarde ? 'cs-input-error' : ''}`}
                          value={formData.horario_semana_tarde_fin}
                          onChange={(e) => {
                            setFormData({ ...formData, horario_semana_tarde_fin: e.target.value })
                            if (fieldErrors.horario_semana_tarde) setFieldErrors((prev) => ({ ...prev, horario_semana_tarde: '' }))
                          }}
                        />
                      </div>
                    </div>
                    <FieldError message={fieldErrors.horario_semana_tarde} />
                  </div>
                </>
              )}

              <div
                className={`cs-box ${formData.horario_sabado_estado === '0' ? 'is-closed' : ''}`}
                style={{ gridColumn: '1 / -1' }}
              >
                <div className="cs-box-head">
                  <strong>
                    <i className="bi bi-calendar-day" aria-hidden="true" /> Sábado
                  </strong>
                  <span className={`cs-badge ${formData.horario_sabado_estado === '0' ? 'is-red' : 'is-amber'}`}>
                    {formData.horario_sabado_estado === '0' ? 'Cerrado' : 'Abierto'}
                  </span>
                </div>
                <div className="cs-day-row">
                  <div className="form-element">
                    <label className="element-label" htmlFor="h-sab-estado">Estado</label>
                    <select
                      id="h-sab-estado"
                      className="input-field"
                      value={formData.horario_sabado_estado}
                      onChange={(e) => setFormData({ ...formData, horario_sabado_estado: e.target.value })}
                    >
                      <option value="1">Abierto</option>
                      <option value="0">Cerrado</option>
                    </select>
                  </div>
                  {formData.horario_sabado_estado !== '0' && (
                    <div className="form-element">
                      <label className="element-label" htmlFor="h-sab-mod">Modalidad</label>
                      <select
                        id="h-sab-mod"
                        className="input-field"
                        value={formData.horario_sabado_modalidad}
                        onChange={(e) => setFormData({ ...formData, horario_sabado_modalidad: e.target.value })}
                      >
                        <option value="continuo">Continuo</option>
                        <option value="partido">Dos turnos</option>
                      </select>
                    </div>
                  )}
                  {formData.horario_sabado_estado !== '0' && (
                    <>
                      <div className="form-element">
                        <label className="element-label" htmlFor="h-sab-ini">
                          {formData.horario_sabado_modalidad === 'partido' ? 'Mañana apertura' : 'Apertura'}
                        </label>
                        <input
                          id="h-sab-ini"
                          type="time"
                          className={`input-field ${fieldErrors.horario_sabado ? 'cs-input-error' : ''}`}
                          value={formData.horario_sabado_inicio}
                          onChange={(e) => {
                            setFormData({ ...formData, horario_sabado_inicio: e.target.value })
                            if (fieldErrors.horario_sabado) setFieldErrors((prev) => ({ ...prev, horario_sabado: '' }))
                          }}
                        />
                      </div>
                      <div className="form-element">
                        <label className="element-label" htmlFor="h-sab-fin">
                          {formData.horario_sabado_modalidad === 'partido' ? 'Mañana cierre' : 'Cierre'}
                        </label>
                        <input
                          id="h-sab-fin"
                          type="time"
                          className={`input-field ${fieldErrors.horario_sabado ? 'cs-input-error' : ''}`}
                          value={formData.horario_sabado_fin}
                          onChange={(e) => {
                            setFormData({ ...formData, horario_sabado_fin: e.target.value })
                            if (fieldErrors.horario_sabado) setFieldErrors((prev) => ({ ...prev, horario_sabado: '' }))
                          }}
                        />
                      </div>
                    </>
                  )}
                  {formData.horario_sabado_estado !== '0' && formData.horario_sabado_modalidad === 'partido' && (
                    <>
                      <div className="form-element">
                        <label className="element-label" htmlFor="h-sab-tar-ini">Tarde apertura</label>
                        <input
                          id="h-sab-tar-ini"
                          type="time"
                          className={`input-field ${fieldErrors.horario_sabado ? 'cs-input-error' : ''}`}
                          value={formData.horario_sabado_tarde_inicio}
                          onChange={(e) => {
                            setFormData({ ...formData, horario_sabado_tarde_inicio: e.target.value })
                            if (fieldErrors.horario_sabado) setFieldErrors((prev) => ({ ...prev, horario_sabado: '' }))
                          }}
                        />
                      </div>
                      <div className="form-element">
                        <label className="element-label" htmlFor="h-sab-tar-fin">Tarde cierre</label>
                        <input
                          id="h-sab-tar-fin"
                          type="time"
                          className={`input-field ${fieldErrors.horario_sabado ? 'cs-input-error' : ''}`}
                          value={formData.horario_sabado_tarde_fin}
                          onChange={(e) => {
                            setFormData({ ...formData, horario_sabado_tarde_fin: e.target.value })
                            if (fieldErrors.horario_sabado) setFieldErrors((prev) => ({ ...prev, horario_sabado: '' }))
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
                <FieldError message={fieldErrors.horario_sabado} />
              </div>

              <div
                className={`cs-box ${formData.horario_domingo_abierto === '1' ? 'is-open' : ''}`}
                style={{ gridColumn: '1 / -1' }}
              >
                <div className="cs-box-head">
                  <strong>
                    <i className="bi bi-calendar-event" aria-hidden="true" /> Domingo
                  </strong>
                  <span className={`cs-badge ${formData.horario_domingo_abierto === '1' ? 'is-green' : ''}`}>
                    {formData.horario_domingo_abierto === '1' ? 'Abierto' : 'Cerrado'}
                  </span>
                </div>
                <div className="cs-day-row">
                  <div className="form-element">
                    <label className="element-label" htmlFor="h-dom-estado">Estado</label>
                    <select
                      id="h-dom-estado"
                      className="input-field"
                      value={formData.horario_domingo_abierto}
                      onChange={(e) => setFormData({ ...formData, horario_domingo_abierto: e.target.value })}
                    >
                      <option value="0">Cerrado</option>
                      <option value="1">Abierto</option>
                    </select>
                  </div>
                  {formData.horario_domingo_abierto === '1' && (
                    <div className="form-element">
                      <label className="element-label" htmlFor="h-dom-mod">Modalidad</label>
                      <select
                        id="h-dom-mod"
                        className="input-field"
                        value={formData.horario_domingo_modalidad}
                        onChange={(e) => setFormData({ ...formData, horario_domingo_modalidad: e.target.value })}
                      >
                        <option value="continuo">Continuo</option>
                        <option value="partido">Dos turnos</option>
                      </select>
                    </div>
                  )}
                  {formData.horario_domingo_abierto === '1' && (
                    <>
                      <div className="form-element">
                        <label className="element-label" htmlFor="h-dom-ini">
                          {formData.horario_domingo_modalidad === 'partido' ? 'Mañana apertura' : 'Apertura'}
                        </label>
                        <input
                          id="h-dom-ini"
                          type="time"
                          className={`input-field ${fieldErrors.horario_domingo ? 'cs-input-error' : ''}`}
                          value={formData.horario_domingo_inicio}
                          onChange={(e) => {
                            setFormData({ ...formData, horario_domingo_inicio: e.target.value })
                            if (fieldErrors.horario_domingo) setFieldErrors((prev) => ({ ...prev, horario_domingo: '' }))
                          }}
                        />
                      </div>
                      <div className="form-element">
                        <label className="element-label" htmlFor="h-dom-fin">
                          {formData.horario_domingo_modalidad === 'partido' ? 'Mañana cierre' : 'Cierre'}
                        </label>
                        <input
                          id="h-dom-fin"
                          type="time"
                          className={`input-field ${fieldErrors.horario_domingo ? 'cs-input-error' : ''}`}
                          value={formData.horario_domingo_fin}
                          onChange={(e) => {
                            setFormData({ ...formData, horario_domingo_fin: e.target.value })
                            if (fieldErrors.horario_domingo) setFieldErrors((prev) => ({ ...prev, horario_domingo: '' }))
                          }}
                        />
                      </div>
                    </>
                  )}
                  {formData.horario_domingo_abierto === '1' && formData.horario_domingo_modalidad === 'partido' && (
                    <>
                      <div className="form-element">
                        <label className="element-label" htmlFor="h-dom-tar-ini">Tarde apertura</label>
                        <input
                          id="h-dom-tar-ini"
                          type="time"
                          className={`input-field ${fieldErrors.horario_domingo ? 'cs-input-error' : ''}`}
                          value={formData.horario_domingo_tarde_inicio}
                          onChange={(e) => {
                            setFormData({ ...formData, horario_domingo_tarde_inicio: e.target.value })
                            if (fieldErrors.horario_domingo) setFieldErrors((prev) => ({ ...prev, horario_domingo: '' }))
                          }}
                        />
                      </div>
                      <div className="form-element">
                        <label className="element-label" htmlFor="h-dom-tar-fin">Tarde cierre</label>
                        <input
                          id="h-dom-tar-fin"
                          type="time"
                          className={`input-field ${fieldErrors.horario_domingo ? 'cs-input-error' : ''}`}
                          value={formData.horario_domingo_tarde_fin}
                          onChange={(e) => {
                            setFormData({ ...formData, horario_domingo_tarde_fin: e.target.value })
                            if (fieldErrors.horario_domingo) setFieldErrors((prev) => ({ ...prev, horario_domingo: '' }))
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
                <FieldError message={fieldErrors.horario_domingo} />
              </div>
            </div>

            <div className="cs-schedule-summary">
              <span>
                <strong>Lun - Vie:</strong>{' '}
                {formData.horario_semana_modalidad === 'continuo'
                  ? `${formData.horario_semana_corrido_inicio} - ${formData.horario_semana_corrido_fin}`
                  : `${formData.horario_semana_manana_inicio} - ${formData.horario_semana_manana_fin} / ${formData.horario_semana_tarde_inicio} - ${formData.horario_semana_tarde_fin}`}
              </span>
              <span>
                <strong>Sábado:</strong>{' '}
                {formData.horario_sabado_estado === '0'
                  ? 'Cerrado'
                  : formData.horario_sabado_modalidad === 'partido'
                  ? `${formData.horario_sabado_inicio} - ${formData.horario_sabado_fin} / ${formData.horario_sabado_tarde_inicio} - ${formData.horario_sabado_tarde_fin}`
                  : `${formData.horario_sabado_inicio} - ${formData.horario_sabado_fin}`}
              </span>
              <span>
                <strong>Domingo:</strong>{' '}
                {formData.horario_domingo_abierto === '1'
                  ? formData.horario_domingo_modalidad === 'partido'
                    ? `${formData.horario_domingo_inicio} - ${formData.horario_domingo_fin} / ${formData.horario_domingo_tarde_inicio} - ${formData.horario_domingo_tarde_fin}`
                    : `${formData.horario_domingo_inicio} - ${formData.horario_domingo_fin}`
                  : 'Cerrado'}
              </span>
            </div>
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="dashboard-panel cs-panel">
            <div className="cs-panel-head">
              <div>
                <h3 className="cs-panel-title">
                  <i className="bi bi-globe" aria-hidden="true" /> Contacto y redes
                </h3>
                <p className="cs-subtext">Datos visibles en la página pública.</p>
              </div>

              <a href="/" target="_blank" rel="noreferrer" className="cs-btn-outline">
                <span>Ver portal</span>
                <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
              </a>
            </div>

            <div className="cs-grid-2">
              <div className="form-element">
                <label className="element-label" htmlFor="landing-dir">
                  <i className="bi bi-geo-alt" aria-hidden="true" /> Dirección
                </label>
                <input
                  id="landing-dir"
                  type="text"
                  className="input-field"
                  value={formData.landing_gym_direccion}
                  onChange={(e) => setFormData({ ...formData, landing_gym_direccion: e.target.value })}
                  placeholder="Av. Principal 450"
                />
              </div>

              <div className="form-element">
                <label className="element-label" htmlFor="landing-mapa">
                  <i className="bi bi-map" aria-hidden="true" /> Enlace Google Maps
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

              <div className="form-element">
                <label className="element-label" htmlFor="landing-tel">
                  <i className="bi bi-telephone" aria-hidden="true" /> Teléfono / WhatsApp
                </label>
                <input
                  id="landing-tel"
                  type="text"
                  className="input-field"
                  value={formData.landing_gym_telefono}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      landing_gym_telefono: e.target.value,
                      landing_redes_whatsapp: e.target.value,
                    })
                  }
                  placeholder="+51 987 654 321"
                />
              </div>
            </div>

            <div className="cs-box">
              <strong style={{ fontSize: '0.9rem', color: '#111d15', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <i className="bi bi-share" aria-hidden="true" /> Redes sociales
              </strong>
              <div className="cs-grid-3">
                <div className="form-element">
                  <label className="element-label" htmlFor="landing-ig">
                    <i className="bi bi-instagram" aria-hidden="true" /> Instagram
                  </label>
                  <input
                    id="landing-ig"
                    type="text"
                    className="input-field"
                    value={formData.landing_redes_instagram}
                    onChange={(e) => setFormData({ ...formData, landing_redes_instagram: e.target.value })}
                    placeholder="pandafitness_oficial"
                  />
                </div>

                <div className="form-element">
                  <label className="element-label" htmlFor="landing-tt">
                    <i className="bi bi-tiktok" aria-hidden="true" /> TikTok
                  </label>
                  <input
                    id="landing-tt"
                    type="text"
                    className="input-field"
                    value={formData.landing_redes_tiktok}
                    onChange={(e) => setFormData({ ...formData, landing_redes_tiktok: e.target.value })}
                    placeholder="@pandafitness_gym"
                  />
                </div>
              </div>
            </div>

            <div className="cs-box">
              <strong style={{ fontSize: '0.9rem', color: '#111d15', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <i className="bi bi-wallet2" aria-hidden="true" /> Pagos digitales para renovaciones (Yape / Plin / Cuenta)
              </strong>
              <p className="cs-subtext" style={{ marginBottom: '12px' }}>
                Estos datos se muestran al socio dentro de <strong>Mi membresía</strong> cuando elige renovar con comprobante.
              </p>
              <div className="cs-grid-2">
                <div className="form-element">
                  <label className="element-label" htmlFor="pago-yape">Número Yape</label>
                  <input
                    id="pago-yape"
                    type="text"
                    className="input-field"
                    value={formData.pago_yape_numero}
                    onChange={(e) => setFormData({ ...formData, pago_yape_numero: e.target.value })}
                    placeholder="987654321"
                  />
                </div>
                <div className="form-element">
                  <label className="element-label" htmlFor="pago-plin">Número Plin</label>
                  <input
                    id="pago-plin"
                    type="text"
                    className="input-field"
                    value={formData.pago_plin_numero}
                    onChange={(e) => setFormData({ ...formData, pago_plin_numero: e.target.value })}
                    placeholder="987654321"
                  />
                </div>
                <div className="form-element">
                  <label className="element-label" htmlFor="pago-titular">Titular de la cuenta</label>
                  <input
                    id="pago-titular"
                    type="text"
                    className="input-field"
                    value={formData.pago_titular}
                    onChange={(e) => setFormData({ ...formData, pago_titular: e.target.value })}
                    placeholder="Panda Fitness Club"
                  />
                </div>
                <div className="form-element">
                  <label className="element-label" htmlFor="pago-cuenta">Cuenta bancaria / CCI (opcional)</label>
                  <input
                    id="pago-cuenta"
                    type="text"
                    className="input-field"
                    value={formData.pago_transferencia_cuenta}
                    onChange={(e) => setFormData({ ...formData, pago_transferencia_cuenta: e.target.value })}
                    placeholder="BCP / Interbank / CCI"
                  />
                </div>
              </div>
              <div className="form-element" style={{ marginTop: '10px' }}>
                <label className="element-label" htmlFor="pago-instrucciones">Indicaciones para el socio</label>
                <input
                  id="pago-instrucciones"
                  type="text"
                  className="input-field"
                  value={formData.pago_instrucciones}
                  onChange={(e) => setFormData({ ...formData, pago_instrucciones: e.target.value })}
                  placeholder="Realiza el pago y sube tu captura para aprobar tu renovación."
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'zk' && (
          <div className="dashboard-panel cs-panel">
            <div className="cs-panel-head">
              <div>
                <h3 className="cs-panel-title">
                  <i className="bi bi-hdd-network" aria-hidden="true" /> Integración Huellero Biométrico (ZKTeco / USB)
                </h3>
                <p className="cs-subtext">
                  Conecta un reloj biométrico ZKTeco por red LAN/Wi-Fi, cable USB, pendrive attlog.dat o lector USB de escritorio. El User ID en el equipo debe coincidir con el DNI del socio.
                </p>
              </div>
              <button
                type="button"
                className="cs-btn-muted"
                onClick={loadZkData}
                disabled={zkLoading}
              >
                <i className="bi bi-arrow-clockwise" aria-hidden="true" />
                <span>{zkLoading ? 'Actualizando...' : 'Actualizar'}</span>
              </button>
            </div>

            {zkFeedback.text && (
              <div
                className={`cs-alert ${
                  zkFeedback.type === 'success'
                    ? 'is-success'
                    : zkFeedback.type === 'info'
                    ? 'is-info'
                    : 'is-error'
                }`}
                role="status"
              >
                <i
                  className={`bi ${
                    zkFeedback.type === 'success'
                      ? 'bi-check-circle-fill'
                      : zkFeedback.type === 'info'
                      ? 'bi-info-circle-fill'
                      : 'bi-exclamation-triangle-fill'
                  }`}
                  aria-hidden="true"
                />
                <span>{zkFeedback.text}</span>
              </div>
            )}

            <div className="cs-grid-2">
              <div className="cs-box">
                <strong style={{ fontSize: '0.9rem', color: '#111d15' }}>
                  <i className="bi bi-link-45deg me-1" aria-hidden="true" /> Endpoint Webhook (POST)
                </strong>
                <div className="d-flex gap-2 mt-2">
                  <input
                    type="text"
                    readOnly
                    className="input-field"
                    value={`${window.location.origin}${zkInfo?.webhookPath || '/api/zk/marcaciones'}`}
                  />
                  <button
                    type="button"
                    className="cs-btn-muted"
                    onClick={() =>
                      handleCopyText(
                        `${window.location.origin}${zkInfo?.webhookPath || '/api/zk/marcaciones'}`,
                        'URL del webhook'
                      )
                    }
                  >
                    <i className="bi bi-clipboard" aria-hidden="true" />
                  </button>
                </div>
                <small className="text-muted d-block mt-1">
                  Usado por los agentes locales en Python para enviar marcaciones al servidor.
                </small>
              </div>

              <div className="cs-box">
                <strong style={{ fontSize: '0.9rem', color: '#111d15' }}>
                  <i className="bi bi-key me-1" aria-hidden="true" /> Header X-ZK-Token
                </strong>
                <div className="d-flex gap-2 mt-2">
                  <input
                    type="text"
                    readOnly
                    className="input-field"
                    value={zkInfo?.token || (zkLoading ? 'Cargando...' : 'Sin token')}
                  />
                  <button
                    type="button"
                    className="cs-btn-muted"
                    disabled={!zkInfo?.token}
                    onClick={() => handleCopyText(zkInfo?.token || '', 'X-ZK-Token')}
                  >
                    <i className="bi bi-clipboard" aria-hidden="true" />
                  </button>
                </div>
                <div className="d-flex flex-wrap gap-2 mt-2">
                  <button
                    type="button"
                    className="cs-btn-lime"
                    disabled={zkBusy || !zkInfo?.token}
                    onClick={handlePingZk}
                  >
                    <i className="bi bi-wifi" aria-hidden="true" />
                    <span>Probar conexión (Ping)</span>
                  </button>
                  <button
                    type="button"
                    className="cs-btn-muted"
                    disabled={zkBusy}
                    onClick={handleRegenerateZkToken}
                  >
                    <i className="bi bi-arrow-repeat" aria-hidden="true" />
                    <span>Regenerar token</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="cs-grid-2 mt-3">
              <div className="cs-box">
                <strong style={{ fontSize: '0.88rem', color: '#111d15' }}>
                  <i className="bi bi-ethernet me-1" aria-hidden="true" /> 1. Reloj ZKTeco por Red (LAN / Wi-Fi)
                </strong>
                <p className="cs-subtext mt-1 mb-0">
                  Configura IP y Token en <code>tools/zkteco-agent/config.ini</code> y ejecuta{' '}
                  <code>tools/zkteco-agent/iniciar_agente.bat</code> (usa puerto TCP 4370).
                </p>
              </div>

              <div className="cs-box">
                <strong style={{ fontSize: '0.88rem', color: '#111d15' }}>
                  <i className="bi bi-usb-drive me-1" aria-hidden="true" /> 2. Memoria USB / Pendrive (attlog.dat)
                </strong>
                <p className="cs-subtext mt-1 mb-0">
                  Descarga <code>attlog.dat</code> desde el reloj e impórtalo en Control de Acceso con el botón{' '}
                  <strong>Importar USB (.dat)</strong>, o usa la autodetección de <code>zk_live_agent.py</code>.
                </p>
              </div>

              <div className="cs-box">
                <strong style={{ fontSize: '0.88rem', color: '#111d15' }}>
                  <i className="bi bi-usb-plug me-1" aria-hidden="true" /> 3. Cable USB directo al reloj (zkemkeeper)
                </strong>
                <p className="cs-subtext mt-1 mb-0">
                  Para modelos con puerto USB Client e interfaz COM SDK registrada en Windows. Ejecuta{' '}
                  <code>tools/zkteco-agent/iniciar_usb_cable.bat</code>.
                </p>
              </div>

              <div className="cs-box">
                <strong style={{ fontSize: '0.88rem', color: '#111d15' }}>
                  <i className="bi bi-usb-symbol me-1" aria-hidden="true" /> 4. Lector USB de escritorio (ZK4500/9500 / U.are.U)
                </strong>
                <p className="cs-subtext mt-1 mb-0">
                  Ejecuta <code>tools/usb-reader-agent/iniciar_lector_usb.bat</code> en recepción para habilitar el modo{' '}
                  <strong>Lector USB</strong> dentro de Registro de Huella y Control de Acceso.
                </p>
              </div>
            </div>

            <div className="cs-box mt-3">
              <strong style={{ fontSize: '0.9rem', color: '#111d15' }}>
                <i className="bi bi-clock-history me-1" aria-hidden="true" /> Últimas marcaciones recibidas por hardware
              </strong>
              <div className="table-responsive mt-2">
                <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.84rem' }}>
                  <thead>
                    <tr>
                      <th>DNI</th>
                      <th>Socio</th>
                      <th>Fecha y Hora</th>
                      <th>Origen</th>
                      <th>Dispositivo</th>
                      <th>Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zkMarcaciones.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted py-3">
                          Aún no se registran marcaciones desde huellero o archivo USB.
                        </td>
                      </tr>
                    ) : (
                      zkMarcaciones.map((item) => (
                        <tr key={item.id}>
                          <td className="fw-semibold">{item.dni}</td>
                          <td>{item.nombre ? `${item.nombre} ${item.apellido || ''}`.trim() : 'No registrado'}</td>
                          <td>{String(item.fechaHora || '').replace('T', ' ').slice(0, 19)}</td>
                          <td>
                            <span className="badge text-bg-dark">{item.origen}</span>
                          </td>
                          <td>{item.dispositivo || '-'}</td>
                          <td>
                            <span className="badge text-bg-light border">{item.resultado}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab !== 'zk' && (
          <>
            <div className="cs-footer-actions">
              <button type="submit" className="cs-save-btn" disabled={saving}>
                {saving ? (
                  <>
                    <span
                      className="spinner-border"
                      style={{ width: '16px', height: '16px', borderColor: '#111d15', borderTopColor: 'transparent' }}
                    />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg" aria-hidden="true" />
                    <span>Guardar cambios</span>
                  </>
                )}
              </button>
            </div>

            <div className="d-md-none position-fixed" style={{ bottom: 'calc(92px + env(safe-area-inset-bottom, 0px))', right: '16px', zIndex: 1035 }}>
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
                <i className="bi bi-check-lg" aria-hidden="true" />
                <span>{saving ? 'Guardando...' : 'Guardar'}</span>
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}

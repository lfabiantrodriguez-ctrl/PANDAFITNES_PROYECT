import { useCallback, useEffect, useMemo, useState } from 'react'
import ViewTitle from '../components/ViewTitle'
import {moduleLabel} from '../utils/access'
import ModalDialog from '../components/ModalDialog'
import { GuestService } from '../services/GuestService'
import { getTodayPeru } from '../utils/formatters'

function formatToLocalDateTime(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatToLocalTime(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function isWithinOpeningHours(date) {
  const day = date.getDay()
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const time = hours * 100 + minutes

  const inRange = (startH, startM, endH, endM) => {
    const start = startH * 100 + startM
    const end = endH * 100 + endM
    return time >= start && time <= end
  }

  if (day >= 1 && day <= 5) {
    return inRange(6, 30, 11, 0) || inRange(16, 0, 22, 0)
  }

  if (day === 6) {
    return inRange(7, 0, 12, 0)
  }

  return false
}

function getDefaultGuestSchedule() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  const fecha = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const horaInicio = formatToLocalTime(now)
  const end = new Date(now)
  end.setMinutes(end.getMinutes() + 60)

  return {
    fecha,
    horaInicio,
    fechaFin: formatToLocalDateTime(end),
  }
}

function isGymOpenNow() {
  return isWithinOpeningHours(new Date())
}

export default function GuestsView({ token }) {
  const today = useMemo(() => getTodayPeru(), [])
  const defaultSchedule = useMemo(() => getDefaultGuestSchedule(), [])
  const [gymOpenNow, setGymOpenNow] = useState(isGymOpenNow())
  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedGuest, setSelectedGuest] = useState(null)
  const [message, setMessage] = useState('')
  const [formStatus, setFormStatus] = useState({ loading: false, error: '' })
  const [searchTerm, setSearchTerm] = useState('')

  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    fecha: defaultSchedule.fecha,
    horaInicio: defaultSchedule.horaInicio,
    fechaFin: defaultSchedule.fechaFin,
    duracionHoras: '1',
    testMode: false,
  })

  const loadGuests = useCallback(async () => {
    setLoading(true)
    try {
      const data = await GuestService.getGuests(token)
      setGuests(data.guests || [])
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadGuests()
  }, [loadGuests])

  useEffect(() => {
    const interval = setInterval(() => {
      setGymOpenNow(isGymOpenNow())
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const start = new Date(`${form.fecha}T${form.horaInicio}:00`)
    if (Number.isNaN(start.getTime())) return
    const duration = Number(form.duracionHoras) || 1
    const end = new Date(start)
    end.setMinutes(end.getMinutes() + duration * 60)
    const nextEnd = formatToLocalDateTime(end)
    if (form.fechaFin !== nextEnd) {
      setForm((current) => ({ ...current, fechaFin: nextEnd }))
    }
  }, [form.fecha, form.horaInicio, form.duracionHoras, form.fechaFin])

  const [fieldErrors, setFieldErrors] = useState({})

  function updateField(field, value) {
    let cleanVal = value
    if (field === 'nombre') cleanVal = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '')
    if (field === 'telefono') cleanVal = value.replace(/\D/g, '').slice(0, 9)
    setForm((current) => ({ ...current, [field]: cleanVal }))
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  function resetForm() {
    const schedule = getDefaultGuestSchedule()
    setForm({
      nombre: '',
      telefono: '',
      fecha: schedule.fecha,
      horaInicio: schedule.horaInicio,
      fechaFin: schedule.fechaFin,
      duracionHoras: '1',
      testMode: false,
    })
    setFieldErrors({})
    setFormStatus({ loading: false, error: '' })
  }

  async function handleCreateGuest(event) {
    event.preventDefault()
    setFormStatus({ loading: true, error: '' })
    setMessage('')
    const errors = {}

    if (!form.nombre.trim()) {
      errors.nombre = 'El nombre completo es obligatorio'
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(form.nombre.trim())) {
      errors.nombre = 'El nombre solo debe contener letras y espacios'
    }

    if (form.telefono && !/^\d{9}$/.test(form.telefono.trim())) {
      errors.telefono = 'El teléfono debe contener 9 dígitos numéricos (Perú)'
    }

    if (!form.fecha) {
      errors.fecha = 'Selecciona una fecha válida'
    }

    if (!form.horaInicio) {
      errors.horaInicio = 'Selecciona la hora de llegada'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setFormStatus({ loading: false, error: '' })
      return
    }

    setFieldErrors({})

    try {
      await GuestService.createGuest(token, {
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim(),
        fechaInicio: `${form.fecha}T${form.horaInicio}:00`,
        fechaFin: form.fechaFin,
        duracionHoras: Number(form.duracionHoras),
        bypassSchedule: !!form.testMode,
      })
      await loadGuests()
      resetForm()
      setShowForm(false)
      setMessage('Cliente diario registrado exitosamente.')
    } catch (error) {
      const errMsg = error.message || 'Error al registrar cliente diario'
      const lower = errMsg.toLowerCase()
      if (lower.includes('nombre')) {
        setFieldErrors((prev) => ({ ...prev, nombre: errMsg }))
      } else if (lower.includes('teléfono') || lower.includes('telefono')) {
        setFieldErrors((prev) => ({ ...prev, telefono: errMsg }))
      } else {
        setFormStatus({ loading: false, error: errMsg })
      }
      return
    }

    setFormStatus({ loading: false, error: '' })
  }

  const filteredGuests = useMemo(() => {
    if (!searchTerm.trim()) return guests
    const q = searchTerm.toLowerCase().trim()
    return guests.filter(
      (g) => g.nombre?.toLowerCase().includes(q) || g.telefono?.toLowerCase().includes(q)
    )
  }, [guests, searchTerm])

  const calculateFee = (hours) => {
    const h = Number(hours) || 1
    if (h === 1) return 5
    if (h === 2) return 8
    if (h === 3) return 11
    return h * 5
  }

  return (
    <>
      <div className="view-header-row d-flex flex-wrap justify-content-between align-items-center gap-3">
        <ViewTitle
          title={moduleLabel('invitados')}
          text="Control de pases diarios, ingresos por horas y cobranzas en recepción."
        />

        {/* Botón Desktop */}
        <button
          className="btn d-none d-md-inline-flex align-items-center gap-2 px-4 py-2 fw-bold shadow-sm"
          type="button"
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          style={{ background: '#c4f039', color: '#111d15', fontWeight: 800, borderRadius: '12px', border: 'none', boxShadow: '0 4px 14px rgba(196, 240, 57, 0.35)' }}
        >
          <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>+</span>
          <span>Nuevo Cliente Diario</span>
        </button>
      </div>

      {message && (
        <div className="alert alert-success d-flex align-items-center gap-2 py-3 px-4 rounded-3 border mb-4" style={{ background: '#ecfccb', color: '#1b4d24', borderColor: '#d9f99d' }}>
          <span>✓</span>
          <span>{message}</span>
        </div>
      )}

      {/* Buscador de Clientes */}
      <div className="mb-4">
        <input
          type="text"
          className="form-control form-control-lg border shadow-sm"
          placeholder="Buscar por nombre o teléfono del cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ borderRadius: '12px', fontSize: '0.95rem' }}
        />
      </div>

      {/* VISTA DESKTOP: TABLA CORPORATIVA CON ENCABEZADOS DE ALTO CONTRASTE */}
      <div className="card border shadow-sm d-none d-md-block" style={{ borderRadius: '16px', overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table table-hover align-middle m-0">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Ingreso</th>
                <th>Salida Prevista</th>
                <th>Tarifa</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="8" className="text-center py-4 text-muted">
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Cargando clientes diarios...
                  </td>
                </tr>
              )}
              {!loading && filteredGuests.length === 0 && (
                <tr>
                  <td colSpan="8" className="text-center py-4 text-muted">
                    No hay clientes diarios registrados en esta fecha.
                  </td>
                </tr>
              )}
              {!loading &&
                filteredGuests.map((guest) => (
                  <tr key={guest.id}>
                    <td className="px-3 fw-bold text-dark">#CD-{guest.id}</td>
                    <td className="px-3 fw-bold text-dark">{guest.nombre}</td>
                    <td className="px-3 text-muted">{guest.telefono || 'Sin teléfono'}</td>
                    <td className="px-3">{guest.fechaInicio ? new Date(guest.fechaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="px-3">{guest.fechaFin ? new Date(guest.fechaFin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="px-3 fw-bold">S/. {Number(guest.monto || calculateFee(guest.duracionHoras)).toFixed(2)}</td>
                    <td className="px-3">
                      <span className="badge bg-dark text-white px-2 py-1 text-uppercase" style={{ fontSize: '0.72rem' }}>
                        {guest.estado || 'Activo'}
                      </span>
                    </td>
                    <td className="px-3 text-end">
                      <button
                        className="btn btn-sm btn-outline-dark fw-bold px-3 py-1"
                        style={{ borderRadius: '8px', fontSize: '0.8rem' }}
                        type="button"
                        onClick={() => setSelectedGuest(guest)}
                      >
                        Ver Detalle
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* VISTA MÓVIL: TARJETAS NATIVAS ERGONÓMICAS (OPTIMIZADAS PARA EL PULGAR) */}
      <div className="d-block d-md-none mb-4">
        {loading && (
          <div className="text-center py-4 text-muted bg-white border rounded-3 p-3">
            <span className="spinner-border spinner-border-sm me-2"></span>
            Cargando clientes diarios...
          </div>
        )}
        {!loading && filteredGuests.length === 0 && (
          <div className="text-center py-4 text-muted bg-white border rounded-3 p-3">
            No hay clientes diarios registrados en esta fecha.
          </div>
        )}
        {!loading && (
          <div className="mobile-card-list">
            {filteredGuests.map((guest) => (
              <div key={guest.id} className="mobile-data-card">
                {/* Header */}
                <div className="mobile-card-header">
                  <div className="mobile-card-identity">
                    <div className="mobile-card-avatar" style={{ fontSize: '0.76rem' }}>
                      CD
                    </div>
                    <div className="mobile-card-titles">
                      <h4 className="mobile-card-title">{guest.nombre}</h4>
                      <p className="mobile-card-subtitle">
                        <span className="mobile-card-code me-2">#CD-{guest.id}</span>
                        <span>{guest.telefono || 'Sin teléfono'}</span>
                      </p>
                    </div>
                  </div>
                  <div>
                    <span className="badge bg-dark text-white px-2 py-1 text-uppercase" style={{ fontSize: '0.68rem' }}>
                      {guest.estado || 'Activo'}
                    </span>
                  </div>
                </div>

                {/* Grid */}
                <div className="mobile-card-body-grid">
                  <div className="mobile-card-field">
                    <div className="mobile-card-label">Horario Entrada / Salida</div>
                    <div className="mobile-card-value" style={{ fontSize: '0.8rem' }}>
                      <span>🕒 {guest.fechaInicio ? new Date(guest.fechaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                      <span className="text-muted mx-1">→</span>
                      <span>{guest.fechaFin ? new Date(guest.fechaFin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                    </div>
                  </div>

                  <div className="mobile-card-field">
                    <div className="mobile-card-label">Tarifa Abonada</div>
                    <div className="mobile-card-value text-success fw-bold">
                      S/. {Number(guest.monto || calculateFee(guest.duracionHoras)).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Acción */}
                <div className="mobile-card-actions">
                  <button
                    className="btn btn-sm btn-dark fw-bold w-100 py-2 d-flex align-items-center justify-content-center gap-2"
                    style={{
                      borderRadius: '10px',
                      background: '#111d15',
                      color: '#c4f039',
                      fontSize: '0.84rem',
                      border: 'none',
                    }}
                    type="button"
                    onClick={() => setSelectedGuest(guest)}
                  >
                    <span>📋</span>
                    <span>Ver Detalle del Pase</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL 1: REGISTRAR CLIENTE DIARIO */}
      <ModalDialog
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Registrar Cliente Diario"
        subtitle="Registra el pase por horas y tarifa de un usuario sin membresía"
        badge="Acceso Diario"
        size="md"
      >
        <form onSubmit={handleCreateGuest}>
          {formStatus.error && (
            <div className="alert alert-danger py-2 px-3 small mb-3">
              {formStatus.error}
            </div>
          )}

          <div className="row g-3">
            <div className="col-12">
              <label className="form-label fw-bold small text-dark" htmlFor="guest-nombre">
                Nombre Completo *
              </label>
              <input
                id="guest-nombre"
                className={`form-control ${fieldErrors.nombre ? 'is-invalid' : ''}`}
                style={{
                  borderRadius: '10px',
                  borderColor: fieldErrors.nombre ? '#ef4444' : '#cbd5e1',
                  backgroundColor: fieldErrors.nombre ? '#fef2f2' : '#ffffff',
                }}
                type="text"
                required
                placeholder="Ej. Juan Pérez"
                value={form.nombre}
                onChange={(e) => updateField('nombre', e.target.value)}
              />
              {fieldErrors.nombre && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{fieldErrors.nombre}</span>
                </div>
              )}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label fw-bold small text-dark" htmlFor="guest-tel">
                Teléfono / WhatsApp
              </label>
              <input
                id="guest-tel"
                className={`form-control ${fieldErrors.telefono ? 'is-invalid' : ''}`}
                style={{
                  borderRadius: '10px',
                  borderColor: fieldErrors.telefono ? '#ef4444' : '#cbd5e1',
                  backgroundColor: fieldErrors.telefono ? '#fef2f2' : '#ffffff',
                }}
                type="tel"
                placeholder="9 dígitos"
                value={form.telefono}
                onChange={(e) => updateField('telefono', e.target.value)}
              />
              {fieldErrors.telefono && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{fieldErrors.telefono}</span>
                </div>
              )}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label fw-bold small text-dark" htmlFor="guest-duracion">
                Tiempo de Permanencia *
              </label>
              <select
                id="guest-duracion"
                className="form-select"
                style={{ borderRadius: '10px', borderColor: '#cbd5e1' }}
                value={form.duracionHoras}
                onChange={(e) => updateField('duracionHoras', e.target.value)}
              >
                <option value="1">1 Hora (S/. 5.00)</option>
                <option value="2">2 Horas (S/. 8.00)</option>
                <option value="3">3 Horas (S/. 11.00)</option>
              </select>
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label fw-bold small text-dark" htmlFor="guest-fecha">
                Fecha
              </label>
              <input
                id="guest-fecha"
                className={`form-control ${fieldErrors.fecha ? 'is-invalid' : ''}`}
                style={{
                  borderRadius: '10px',
                  borderColor: fieldErrors.fecha ? '#ef4444' : '#cbd5e1',
                  backgroundColor: fieldErrors.fecha ? '#fef2f2' : '#ffffff',
                }}
                type="date"
                required
                value={form.fecha}
                onChange={(e) => updateField('fecha', e.target.value)}
              />
              {fieldErrors.fecha && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{fieldErrors.fecha}</span>
                </div>
              )}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label fw-bold small text-dark" htmlFor="guest-hora">
                Hora de Llegada
              </label>
              <input
                id="guest-hora"
                className={`form-control ${fieldErrors.horaInicio ? 'is-invalid' : ''}`}
                style={{
                  borderRadius: '10px',
                  borderColor: fieldErrors.horaInicio ? '#ef4444' : '#cbd5e1',
                  backgroundColor: fieldErrors.horaInicio ? '#fef2f2' : '#ffffff',
                }}
                type="time"
                required
                value={form.horaInicio}
                onChange={(e) => updateField('horaInicio', e.target.value)}
              />
              {fieldErrors.horaInicio && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{fieldErrors.horaInicio}</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-3 mt-4 rounded-3 border bg-light d-flex justify-content-between align-items-center">
            <div>
              <strong className="text-dark">Total a Cobrar</strong>
              <div className="text-muted small">Tolerancia de 10 min al finalizar</div>
            </div>
            <span className="badge bg-dark text-white fs-6 px-3 py-2">
              S/. {calculateFee(form.duracionHoras).toFixed(2)}
            </span>
          </div>

          <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
            <button
              type="button"
              className="btn btn-outline-dark px-4 py-2 fw-semibold"
              onClick={() => setShowForm(false)}
              disabled={formStatus.loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn px-4 py-2 fw-bold shadow-sm"
              disabled={formStatus.loading}
              style={{ background: '#c4f039', color: '#111d15', fontWeight: 800, border: 'none', borderRadius: '10px', boxShadow: '0 4px 14px rgba(196, 240, 57, 0.35)' }}
            >
              {formStatus.loading ? 'Registrando...' : 'Registrar Pase'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* MODAL 2: DETALLE DEL CLIENTE DIARIO */}
      <ModalDialog
        isOpen={!!selectedGuest}
        onClose={() => setSelectedGuest(null)}
        title={selectedGuest ? selectedGuest.nombre : 'Detalle del Cliente'}
        subtitle={selectedGuest ? `Pase Diario #CD-${selectedGuest.id}` : ''}
        badge="Ticket de Ingreso"
        size="md"
        footer={
          <button
            type="button"
            className="btn w-100 fw-bold py-2"
            onClick={() => setSelectedGuest(null)}
            style={{ background: '#121e17', color: '#c4f039', fontWeight: 800, border: '1.5px solid #c4f039', borderRadius: '10px' }}
          >
            Cerrar
          </button>
        }
      >
        {selectedGuest && (
          <div className="d-flex flex-column gap-3">
            <div className="p-3 rounded-3 border bg-light d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted small d-block">Estado de Pase</span>
                <strong className="text-capitalize text-dark fs-5">
                  {selectedGuest.estado || 'Activo'}
                </strong>
              </div>
              <span className="badge bg-success text-white px-3 py-2 text-uppercase" style={{ background: '#ecfccb !important', color: '#1b4d24 !important' }}>
                S/. {Number(selectedGuest.monto || calculateFee(selectedGuest.duracionHoras)).toFixed(2)}
              </span>
            </div>

            <div className="row g-2">
              <div className="col-6">
                <div className="p-2 border rounded bg-white">
                  <span className="text-muted small d-block">Ingreso Registrado</span>
                  <strong className="text-dark">
                    {selectedGuest.fechaInicio ? new Date(selectedGuest.fechaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </strong>
                </div>
              </div>
              <div className="col-6">
                <div className="p-2 border rounded bg-white">
                  <span className="text-muted small d-block">Salida Programada</span>
                  <strong className="text-dark">
                    {selectedGuest.fechaFin ? new Date(selectedGuest.fechaFin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </strong>
                </div>
              </div>
              <div className="col-12">
                <div className="p-2 border rounded bg-white">
                  <span className="text-muted small d-block">Teléfono</span>
                  <span className="text-dark">{selectedGuest.telefono || 'Sin teléfono registrado'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* BOTÓN FLOTANTE EN MÓVIL (ABAJO AL ALCANCE DEL PULGAR) */}
      <div
        className="d-md-none position-fixed"
        style={{
          bottom: '76px',
          right: '16px',
          zIndex: 1035,
        }}
      >
        <button
          className="btn shadow-lg d-flex align-items-center gap-2 px-4 py-3 fw-bold rounded-pill"
          type="button"
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          style={{
            background: '#c4f039',
            color: '#111d15',
            fontWeight: 800,
            border: 'none',
            boxShadow: '0 8px 24px rgba(196, 240, 57, 0.45)',
          }}
        >
          <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>+</span>
          <span>Cliente Diario</span>
        </button>
      </div>
    </>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import ViewTitle from '../components/ViewTitle'
import FormInput from '../components/FormInput'
import { GuestService } from '../services/GuestService'

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
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const defaultSchedule = useMemo(() => getDefaultGuestSchedule(), [])
  const [gymOpenNow, setGymOpenNow] = useState(isGymOpenNow())
  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [formStatus, setFormStatus] = useState({ loading: false, error: '' })
  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    fecha: defaultSchedule.fecha,
    horaInicio: defaultSchedule.horaInicio,
    fechaFin: defaultSchedule.fechaFin,
    duracionHoras: '1',
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
    if (!gymOpenNow && showForm) {
      setShowForm(false)
      setMessage('El gimnasio está cerrado. Los registros de invitados solo se permiten en horario de atención.')
    }
  }, [gymOpenNow, showForm])

  useEffect(() => {
    const start = new Date(`${form.fecha}T${form.horaInicio}:00`)
    if (Number.isNaN(start.getTime())) {
      return
    }
    const duration = Number(form.duracionHoras) || 1
    const end = new Date(start)
    end.setMinutes(end.getMinutes() + duration * 60)
    const nextEnd = formatToLocalDateTime(end)
    if (form.fechaFin !== nextEnd) {
      setForm((current) => ({ ...current, fechaFin: nextEnd }))
    }
  }, [form.fecha, form.horaInicio, form.duracionHoras, form.fechaFin])

  useEffect(() => {
    if (showForm && gymOpenNow) {
      const schedule = getDefaultGuestSchedule()
      setForm((current) => ({
        ...current,
        fecha: schedule.fecha,
        horaInicio: schedule.horaInicio,
        fechaFin: schedule.fechaFin,
      }))
    }
  }, [showForm, gymOpenNow])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
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
    })
    setFormStatus({ loading: false, error: '' })
  }

  async function handleCreateGuest(event) {
    event.preventDefault()
    setFormStatus({ loading: true, error: '' })
    setMessage('')

    if (!isGymOpenNow()) {
      setFormStatus({ loading: false, error: 'No se puede registrar invitados fuera del horario de atención.' })
      return
    }

    const start = new Date(`${form.fecha}T${form.horaInicio}:00`)
    const now = new Date()
    if (Number.isNaN(start.getTime())) {
      setFormStatus({ loading: false, error: 'Por favor ingresa una hora de inicio válida' })
      return
    }

    if (start < now) {
      setFormStatus({ loading: false, error: 'La hora de inicio no puede ser anterior al momento actual' })
      return
    }

    if (!isWithinOpeningHours(start)) {
      setFormStatus({ loading: false, error: 'La hora de inicio debe estar dentro del horario de atención del gimnasio.' })
      return
    }

    const end = new Date(start)
    const duration = Number(form.duracionHoras) || 1
    end.setMinutes(end.getMinutes() + duration * 60)

    if (!isWithinOpeningHours(end)) {
      setFormStatus({ loading: false, error: 'La hora de salida debe estar dentro del horario de atención del gimnasio.' })
      return
    }

    try {
      await GuestService.createGuest(token, {
        nombre: form.nombre,
        telefono: form.telefono,
        fechaInicio: `${form.fecha}T${form.horaInicio}:00`,
        fechaFin: form.fechaFin,
      })
      await loadGuests()
      resetForm()
      setShowForm(false)
      setMessage('Invitado registrado correctamente. Se considerará en aforo y pago diario.')
    } catch (error) {
      setFormStatus({ loading: false, error: error.message })
    } finally {
      setFormStatus((current) => ({ ...current, loading: false }))
    }
  }

  return (
    <>
      <div className="view-header-row">
        <ViewTitle
          title="Gestión de Invitados"
          text="Registra ingresos diarios de usuarios sin membresía y controla el pago de S/. 7.00."
        />
        <button
          className="action-btn btn-emerald"
          type="button"
          onClick={() => setShowForm((value) => !value)}
          disabled={!gymOpenNow}
        >
          {showForm ? 'Ocultar Formulario' : 'Nuevo Invitado'}
        </button>
      </div>

      {!gymOpenNow && (
        <div className="system-notice compact-notice warning-notice">
          El gimnasio está cerrado. Solo se pueden registrar invitados dentro del horario de atención.
        </div>
      )}

      {message && <div className="system-notice compact-notice">{message}</div>}

      {showForm && (
        <section className="member-form-panel">
          <div className="form-panel-title">
            <div>
              <p className="stat-label">Registro diario</p>
              <h2>Nuevo Invitado</h2>
            </div>
            <span className="plan-pill">Pago diario S/. 7.00</span>
          </div>

          <form onSubmit={handleCreateGuest}>
            <div className="form-grid">
              <FormInput label="Nombre completo" value={form.nombre} onChange={(value) => updateField('nombre', value)} />
              <FormInput label="Teléfono" value={form.telefono} onChange={(value) => updateField('telefono', value)} />
              <div className="form-status-note">
                <p>El ingreso se registra dentro del horario de atención:</p>
                <ul>
                  <li>Lun-Vie: 06:30-11:00 y 16:00-22:00</li>
                  <li>Sáb: 07:00-12:00</li>
                </ul>
              </div>

              <div className="form-element">
                <label className="element-label" htmlFor="fecha-inicio-invitado">Fecha</label>
                <input
                  id="fecha-inicio-invitado"
                  className="input-field"
                  type="date"
                  value={form.fecha}
                  readOnly
                  required
                />
              </div>

              <div className="form-element">
                <label className="element-label" htmlFor="hora-inicio-invitado">Hora</label>
                <input
                  id="hora-inicio-invitado"
                  className="input-field"
                  type="time"
                  value={form.horaInicio}
                  onChange={(event) => updateField('horaInicio', event.target.value)}
                  required
                />
              </div>

              <div className="form-element">
                <label className="element-label" htmlFor="fecha-fin-invitado">Fin</label>
                <input
                  id="fecha-fin-invitado"
                  className="input-field"
                  type="datetime-local"
                  value={form.fechaFin}
                  readOnly
                />
              </div>

                      <div className="form-element">
                <label className="element-label" htmlFor="duracion-invitado">Duración</label>
                <select
                  id="duracion-invitado"
                  className="input-field"
                  value={form.duracionHoras}
                  onChange={(event) => updateField('duracionHoras', event.target.value)}
                >
                  <option value="1">1 hora</option>
                  <option value="1.5">1:30 horas</option>
                  <option value="2">2 horas</option>
                  <option value="2.5">2:30 horas</option>
                  <option value="3">3 horas</option>
                </select>
              </div>
            </div>

            {formStatus.error && <p className="form-error">{formStatus.error}</p>}

            <div className="form-actions">
              <button className="action-btn btn-emerald" type="submit" disabled={formStatus.loading}>
                {formStatus.loading ? 'Guardando...' : 'Registrar Invitado'}
              </button>
              <button className="action-btn btn-light" type="button" onClick={resetForm}>
                Limpiar
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="table-frame">
        <table className="corporate-table">
          <thead>
            <tr>
              <th>Invitado</th>
              <th>Teléfono</th>
              <th>Horario</th>
              <th>Duración</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="5">Cargando invitados...</td>
              </tr>
            )}
            {!loading && guests.length === 0 && (
              <tr>
                <td colSpan="5">No hay invitados registrados.</td>
              </tr>
            )}
            {!loading && guests.map((guest) => {
              const start = guest.fechaInicio ? new Date(guest.fechaInicio) : null
              const end = guest.fechaFin ? new Date(guest.fechaFin) : null
              const duration = start && end ? Math.round((end - start) / (1000 * 60)) : null
              const durationLabel = duration
                ? `${Math.floor(duration / 60)}h${duration % 60 === 0 ? '' : `:${String(duration % 60).padStart(2, '0')}`}`
                : '-'

              return (
                <tr key={guest.id}>
                  <td>{guest.nombre || '-'}</td>
                  <td>{guest.telefono || '-'}</td>
                  <td>{guest.fechaInicio && guest.fechaFin ? `${guest.fechaInicio} → ${guest.fechaFin}` : '-'}</td>
                  <td>{durationLabel}</td>
                  <td>{guest.estado || 'activo'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

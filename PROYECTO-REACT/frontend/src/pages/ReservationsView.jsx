import { useEffect, useMemo, useState } from 'react'
import ViewTitle from '../components/ViewTitle'
import { ReservationService } from '../services/ReservationService'

function formatHourLabel(value) {
  return `${String(Number(value)).padStart(2, '0')}:00`
}

function formatDateTimeString(dateTimeStr) {
  if (!dateTimeStr) return ''
  const date = new Date(dateTimeStr.replace(' ', 'T'))
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatTimeString(dateTimeStr) {
  if (!dateTimeStr) return ''
  const date = new Date(dateTimeStr.replace(' ', 'T'))
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getTodayString = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const emptyDashboard = { totalReservations: 0, peakHour: null, peakCount: 0, hourlyStats: [] }

export default function ReservationsView({ token }) {
  const today = useMemo(() => getTodayString(), [])
  const sevenDaysAgo = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - 7)
    return date.toISOString().slice(0, 10)
  }, [])

  const [form, setForm] = useState({
    fecha: today,
    horaEntrada: '',
    duracionMinutos: '60',
  })
  const [range, setRange] = useState({ startDate: sevenDaysAgo, endDate: today })
  const [dashboard, setDashboard] = useState(emptyDashboard)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })
  
  const [myReservations, setMyReservations] = useState([])
  const [myReservationsLoading, setMyReservationsLoading] = useState(false)

  // Fetch reservations history and active ones
  async function loadMyReservations() {
    if (!token) return
    try {
      const data = await ReservationService.getMyReservations(token)
      setMyReservations(Array.isArray(data.reservas) ? data.reservas : [])
    } catch (err) {
      console.error('Error al cargar mis reservas:', err)
    }
  }

  // Load dashboard stats
  async function loadDashboard() {
    if (!token) return
    setDashboardLoading(true)
    try {
      const data = await ReservationService.getReservationDashboard(token, range)
      setDashboard({
        totalReservations: data.totalReservations ?? 0,
        peakHour: data.peakHour ?? null,
        peakCount: data.peakCount ?? 0,
        hourlyStats: Array.isArray(data.hourlyStats) ? data.hourlyStats : [],
      })
    } catch (error) {
      setDashboard({ totalReservations: 0, peakHour: null, peakCount: 0, hourlyStats: [] })
    } finally {
      setDashboardLoading(false)
    }
  }

  // Fetch active reservations periodically (auto-refresh)
  useEffect(() => {
    loadMyReservations()
    const timer = setInterval(loadMyReservations, 15000)
    return () => clearInterval(timer)
  }, [token])

  useEffect(() => {
    loadDashboard()
  }, [token, range.startDate, range.endDate])

  // Get active and cancelled reservations
  const activeReservation = useMemo(() => {
    return myReservations.find(r => r.estado === 'pendiente' || r.estado === 'confirmada')
  }, [myReservations])

  const cancelledTodayReservation = useMemo(() => {
    if (activeReservation) return null
    return myReservations.find(r => {
      if (r.estado !== 'cancelada') return false
      const rDate = r.horaEntrada.slice(0, 10)
      return rDate === today
    })
  }, [myReservations, activeReservation, today])

  // Generate 15-minute intervals based on official gym schedule
  const availableTimes = useMemo(() => {
    if (!form.fecha) return []
    
    const date = new Date(form.fecha + 'T00:00:00')
    const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    if (dayOfWeek === 0) {
      return [] // Closed on Sunday
    }

    let allSlots = []
    if (dayOfWeek === 6) {
      // Saturday: 7:00 AM to 12:00 PM
      let current = 7 * 60
      const end = 12 * 60
      while (current <= end) {
        const h = Math.floor(current / 60)
        const m = current % 60
        allSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
        current += 15
      }
    } else {
      // Mon-Fri: 6:30 AM to 11:00 AM and 4:00 PM to 10:00 PM
      let current = 6 * 60 + 30
      const end1 = 11 * 60
      while (current <= end1) {
        const h = Math.floor(current / 60)
        const m = current % 60
        allSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
        current += 15
      }
      current = 16 * 60
      const end2 = 22 * 60
      while (current <= end2) {
        const h = Math.floor(current / 60)
        const m = current % 60
        allSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
        current += 15
      }
    }

    // Filter out past slots if selectedDate is today
    if (form.fecha === today) {
      const now = new Date()
      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      allSlots = allSlots.filter(slot => {
        const [h, m] = slot.split(':').map(Number)
        const slotMinutes = h * 60 + m
        return slotMinutes > currentMinutes
      })
    }

    return allSlots
  }, [form.fecha, today])

  // Select the first available time if the current selection is no longer valid
  useEffect(() => {
    if (availableTimes.length > 0) {
      if (!availableTimes.includes(form.horaEntrada)) {
        setForm(current => ({ ...current, horaEntrada: availableTimes[0] }))
      }
    } else {
      setForm(current => ({ ...current, horaEntrada: '' }))
    }
  }, [availableTimes, form.horaEntrada])

  function updateField(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus({ loading: true, error: '', success: '' })

    if (!form.fecha || !form.horaEntrada || !form.duracionMinutos) {
      setStatus({ loading: false, error: 'Por favor, complete todos los campos.', success: '' })
      return
    }

    try {
      await ReservationService.createReservation(token, {
        fecha: form.fecha,
        horaEntrada: form.horaEntrada,
        duracionMinutos: form.duracionMinutos,
      })
      setStatus({ loading: false, error: '', success: 'Reserva registrada correctamente.' })
      loadMyReservations()
      loadDashboard()
    } catch (error) {
      setStatus({ loading: false, error: error.message || 'No se pudo registrar la reserva', success: '' })
    }
  }

  const isSundaySelected = useMemo(() => {
    if (!form.fecha) return false
    const date = new Date(form.fecha + 'T00:00:00')
    return date.getDay() === 0
  }, [form.fecha])

  return (
    <>
      <ViewTitle
        title="Módulo de Reservas"
        text="Planifica tu entrenamiento y asegura tu cupo en el gimnasio."
      />

      <section className="content-box-md">
        
        {/* Reservation summary view if there is an active reservation */}
        {activeReservation ? (
          <div style={{ display: 'grid', gap: '16px', marginTop: '10px' }}>
            <div className="system-notice success-notice" style={{ padding: '24px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Tienes una Reserva Activa
              </h3>
              <div style={{ display: 'grid', gap: '8px', fontSize: '1.05em' }}>
                <p style={{ margin: 0 }}><strong>Fecha:</strong> {formatDateTimeString(activeReservation.horaEntrada)}</p>
                <p style={{ margin: 0 }}>
                  <strong>Horario:</strong> {formatTimeString(activeReservation.horaEntrada)} - {formatTimeString(activeReservation.horaSalida)}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Estado:</strong> <span style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{activeReservation.estado}</span>
                </p>
              </div>
              
              <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid rgba(0,0,0,0.1)' }} />
              
              <p style={{ margin: 0, fontSize: '0.92em', lineHeight: '1.5em', color: '#1f2937' }}>
                <strong>Aviso de Tolerancia:</strong> Cuentas con un máximo de <strong>15 minutos de tolerancia</strong> desde tu hora programada para confirmar tu ingreso en recepción. Si transcurre ese plazo sin registrar tu entrada, la reserva será cancelada automáticamente y liberada para otros socios.
              </p>
            </div>
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.9em' }}>
              * Solo se permite una reserva activa por día. Para agendar otro horario, debes esperar a que finalice o sea cancelada la actual.
            </p>
          </div>
        ) : (
          /* Form view if no active reservation */
          <div>
            {/* Show notice if reservation was cancelled due to tolerance expiration today */}
            {cancelledTodayReservation && (
              <div className="system-notice warning-notice" style={{ marginBottom: '20px', padding: '16px', borderRadius: '8px' }}>
                <strong>Reserva cancelada:</strong> Tu reserva de hoy a las {formatTimeString(cancelledTodayReservation.horaEntrada)} fue cancelada automáticamente porque expiró tu tiempo de tolerancia de 15 minutos. De igual manera, puedes realizar una nueva reserva para hoy en un horario diferente.
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
              <h3>Registrar Nueva Reserva</h3>

              <div className="form-element">
                <label className="element-label" htmlFor="res-fecha">Fecha de asistencia</label>
                <input
                  id="res-fecha"
                  className="input-field"
                  type="date"
                  min={today}
                  value={form.fecha}
                  onChange={(event) => updateField('fecha', event.target.value)}
                  required
                />
              </div>

              {isSundaySelected ? (
                <div className="form-error" style={{ padding: '12px', borderRadius: '6px' }}>
                  El gimnasio permanece cerrado los domingos. Por favor, selecciona otra fecha.
                </div>
              ) : (
                <>
                  <div className="form-element">
                    <label className="element-label" htmlFor="res-hora">Hora de llegada</label>
                    <select
                      id="res-hora"
                      className="input-field"
                      value={form.horaEntrada}
                      onChange={(event) => updateField('horaEntrada', event.target.value)}
                      required
                    >
                      {availableTimes.length === 0 ? (
                        <option value="">No hay horarios disponibles para hoy</option>
                      ) : (
                        availableTimes.map(time => (
                          <option key={time} value={time}>{time}</option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="form-element">
                    <label className="element-label" htmlFor="res-permanencia">Tiempo de permanencia</label>
                    <select
                      id="res-permanencia"
                      className="input-field"
                      value={form.duracionMinutos}
                      onChange={(event) => updateField('duracionMinutos', event.target.value)}
                      required
                    >
                      <option value="60">60 minutos (1 hora)</option>
                      <option value="90">90 minutos (1.5 horas)</option>
                      <option value="120">120 minutos (2 horas)</option>
                      <option value="150">150 minutos (2.5 horas)</option>
                      <option value="180">180 minutos (3 horas - Máximo)</option>
                    </select>
                  </div>
                </>
              )}

              {status.error && <p className="form-error">{status.error}</p>}
              {status.success && <div className="system-notice success-notice">{status.success}</div>}

              <button
                className="action-btn btn-emerald btn-full"
                type="submit"
                disabled={status.loading || isSundaySelected || availableTimes.length === 0}
              >
                {status.loading ? 'Registrando...' : 'Registrar Reserva'}
              </button>
            </form>
          </div>
        )}

        <hr style={{ margin: '32px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />

        {/* Dashboard and Stats section */}
        
      </section>
    </>
  )
}

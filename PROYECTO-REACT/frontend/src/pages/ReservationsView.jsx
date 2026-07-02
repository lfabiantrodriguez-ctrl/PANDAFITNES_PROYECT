import { useEffect, useMemo, useState } from 'react'
import ViewTitle from '../components/ViewTitle'
import FormField from '../components/FormField'
import { ReservationService } from '../services/ReservationService'

function formatHourLabel(value) {
  return `${String(Number(value)).padStart(2, '0')}:00`
}

const emptyDashboard = { totalReservations: 0, peakHour: null, peakCount: 0, hourlyStats: [] }

export default function ReservationsView({ token }) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const sevenDaysAgo = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - 7)
    return date.toISOString().slice(0, 10)
  }, [])

  const [form, setForm] = useState({
    fecha: today,
    horaEntrada: '18:30',
    duracionMinutos: '90',
  })
  const [range, setRange] = useState({ startDate: sevenDaysAgo, endDate: today })
  const [dashboard, setDashboard] = useState(emptyDashboard)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

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

  useEffect(() => {
    loadDashboard()
  }, [token, range.startDate, range.endDate])

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus({ loading: true, error: '', success: '' })

    try {
      await ReservationService.createReservation(token, {
        fecha: form.fecha,
        horaEntrada: form.horaEntrada,
        duracionMinutos: form.duracionMinutos,
      })
      setStatus({ loading: false, error: '', success: 'Reserva registrada correctamente.' })
    } catch (error) {
      setStatus({ loading: false, error: error.message || 'No se pudo registrar la reserva', success: '' })
    }
  }

  return (
    <>
      <ViewTitle
        title="Planificacion de Asistencia Obligatoria"
        text="El sistema calcula aforos cruzando hora de llegada con permanencia establecida."
      />
      <section className="content-box-md">
        <div className="system-notice">
          <strong>Regulacion de Capacidad:</strong> al registrar esta informacion, el sistema
          reservara el cupo y considerara 15 minutos de tolerancia para el ingreso.
        </div>

        <div style={{ marginTop: '16px', marginBottom: '20px', display: 'grid', gap: '12px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <label className="element-label" style={{ flex: 1, minWidth: '180px' }}>
              Fecha inicial
              <input
                className="input-field"
                type="date"
                value={range.startDate}
                onChange={(event) => setRange((current) => ({ ...current, startDate: event.target.value }))}
              />
            </label>
            <label className="element-label" style={{ flex: 1, minWidth: '180px' }}>
              Fecha final
              <input
                className="input-field"
                type="date"
                value={range.endDate}
                onChange={(event) => setRange((current) => ({ ...current, endDate: event.target.value }))}
              />
            </label>
          </div>

          <div className="system-notice success-notice" style={{ display: 'grid', gap: '8px' }}>
            <strong>Dashboard de reservas</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <span><strong>Total:</strong> {dashboard?.totalReservations ?? 0}</span>
              <span><strong>Hora pico:</strong> {dashboard && dashboard.peakHour !== null ? formatHourLabel(dashboard.peakHour) : 'Sin datos'}</span>
              <span><strong>Reservas en la hora pico:</strong> {dashboard?.peakCount ?? 0}</span>
            </div>
          </div>

          {dashboardLoading ? (
            <p className="form-error">Analizando el rango seleccionado...</p>
          ) : dashboard?.hourlyStats?.length ? (
            <div style={{ border: '1px solid #dce8e5', borderRadius: '12px', padding: '12px', display: 'grid', gap: '8px' }}>
              <strong>Horas con más reservas</strong>
              {dashboard.hourlyStats.map((item) => {
                const width = `${Math.max(12, (item.count / Math.max(dashboard.peakCount, 1)) * 100)}%`
                return (
                  <div key={item.hour} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 40px', alignItems: 'center', gap: '8px' }}>
                    <span>{formatHourLabel(item.hour)}</span>
                    <div style={{ height: '8px', borderRadius: '999px', background: '#e8f5f1', overflow: 'hidden' }}>
                      <div style={{ width, height: '100%', background: '#16a34a', borderRadius: '999px' }} />
                    </div>
                    <strong>{item.count}</strong>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="form-error">No hay reservas registradas para ese rango de fechas.</p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <FormField
            label="Fecha seleccionada"
            type="date"
            value={form.fecha}
            onChange={(event) => updateField('fecha', event.target.value)}
          />
          <FormField
            label="Hora de llegada planificada"
            type="time"
            value={form.horaEntrada}
            onChange={(event) => updateField('horaEntrada', event.target.value)}
          />
          <div className="form-element">
            <label className="element-label" htmlFor="stay">Tiempo de permanencia declarado</label>
            <select
              id="stay"
              className="input-field"
              value={form.duracionMinutos}
              onChange={(event) => updateField('duracionMinutos', event.target.value)}
            >
              <option value="60">60 minutos</option>
              <option value="90">90 minutos</option>
              <option value="120">120 minutos</option>
            </select>
          </div>

          {status.error && <p className="form-error">{status.error}</p>}
          {status.success && <div className="system-notice success-notice">{status.success}</div>}

          <button className="action-btn btn-emerald btn-full" type="submit" disabled={status.loading}>
            {status.loading ? 'Registrando reserva...' : 'Validar Aforo y Registrar Reserva'}
          </button>
        </form>
      </section>
    </>
  )
}

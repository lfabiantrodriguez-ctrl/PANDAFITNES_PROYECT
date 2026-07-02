import { useEffect, useMemo, useState } from 'react'
import ViewTitle from '../components/ViewTitle'
import { ReservationService } from '../services/ReservationService'

const emptyDashboard = {
  totalReservations: 0,
  peakHour: null,
  peakHours: [],
  peakCount: 0,
  hourlyStats: [],
}

function formatHourLabel(value) {
  return `${String(Number(value)).padStart(2, '0')}:00`
}

export default function DashboardReservationsView({ token }) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const sevenDaysAgo = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - 7)
    return date.toISOString().slice(0, 10)
  }, [])

  const [range, setRange] = useState({ startDate: sevenDaysAgo, endDate: today })
  const [dashboard, setDashboard] = useState(emptyDashboard)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sortedHours = useMemo(() => {
    return [...dashboard.hourlyStats].sort((a, b) => a.hour - b.hour)
  }, [dashboard.hourlyStats])

  async function loadDashboard() {
    if (!token) return

    setLoading(true)
    setError('')

    try {
      const data = await ReservationService.getReservationDashboard(token, range)
      setDashboard({
        totalReservations: data.totalReservations ?? 0,
        peakHour: data.peakHour ?? null,
        peakHours: Array.isArray(data.peakHours) ? data.peakHours : [],
        peakCount: data.peakCount ?? 0,
        hourlyStats: Array.isArray(data.hourlyStats) ? data.hourlyStats : [],
      })
    } catch (loadError) {
      setDashboard(emptyDashboard)
      setError(loadError.message || 'No se pudo cargar el dashboard de reservas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [token, range.startDate, range.endDate])

  const peakHoursLabel = dashboard.peakHours.length
    ? dashboard.peakHours.map(formatHourLabel).join(', ')
    : dashboard.peakHour !== null
    ? formatHourLabel(dashboard.peakHour)
    : 'Sin datos'

  const cards = [
    {
      label: 'Reservas totales',
      value: dashboard.totalReservations,
      description: 'Cantidad total de reservas en el rango seleccionado.',
    },
    {
      label: 'Hora pico',
      value: peakHoursLabel,
      description: 'Horas con mayor número de reservas.',
    },
    {
      label: 'Reservas pico',
      value: dashboard.peakCount,
      description: 'Reservas registradas en la hora más demandada.',
    },
  ]

  const peakValue = dashboard.peakCount || 1

  return (
    <>
      <ViewTitle
        title="Dashboard de Reservas"
        text="Analiza los horarios con mayor demanda y toma decisiones rápidas sobre tus ciclos de reservas."
      />

      <section className="dashboard-page">
        <div className="dashboard-panel dashboard-panel-top">
          <div className="dashboard-panel-header">
            <div>
              <h2 className="dashboard-panel-title">Filtrar rango de fechas</h2>
              <p className="dashboard-panel-subtitle">
                Selecciona un intervalo para mostrar las horas pico de reservas y el comportamiento por hora.
              </p>
            </div>
          </div>

          <div className="dashboard-range-picker">
            <div className="dashboard-range-item">
              <span className="element-label">Fecha inicial</span>
              <input
                className="input-field"
                type="date"
                value={range.startDate}
                onChange={(event) => setRange((current) => ({ ...current, startDate: event.target.value }))}
              />
            </div>

            <div className="dashboard-range-item">
              <span className="element-label">Fecha final</span>
              <input
                className="input-field"
                type="date"
                value={range.endDate}
                onChange={(event) => setRange((current) => ({ ...current, endDate: event.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="dashboard-cards-row">
          {cards.map((card) => (
            <article key={card.label} className="dashboard-info-card">
              <span className="dashboard-info-label">{card.label}</span>
              <strong className="dashboard-info-value">{card.value}</strong>
              <p className="dashboard-info-text">{card.description}</p>
            </article>
          ))}
        </div>

        <div className="dashboard-grid">
          <section className="dashboard-chart-panel">
            <div className="dashboard-panel-header dashboard-chart-panel-header">
              <div>
                <h2 className="dashboard-panel-title">Horas pico de reservas</h2>
                <p className="dashboard-panel-subtitle">
                  Las barras representan la cantidad de reservas por hora dentro del rango seleccionado.
                </p>
              </div>
              <div className="dashboard-summary-meta">
                <span>{range.startDate}</span>
                <span>→</span>
                <span>{range.endDate}</span>
              </div>
            </div>

            {loading ? (
              <p className="form-error">Cargando datos del dashboard...</p>
            ) : error ? (
              <p className="form-error">{error}</p>
            ) : sortedHours.length ? (
              <div className="dashboard-chart">
                {sortedHours.map((item) => (
                  <div key={item.hour} className="dashboard-chart-row">
                    <span className="dashboard-chart-label">{formatHourLabel(item.hour)}</span>
                    <div className="dashboard-chart-bar-wrapper">
                      <div
                        className="dashboard-chart-bar"
                        style={{ width: `${Math.max(10, (item.count / peakValue) * 100)}%` }}
                      />
                    </div>
                    <strong className="dashboard-chart-value">{item.count}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="form-error">No hay reservas registradas para ese rango de fechas.</p>
            )}
          </section>

          <aside className="dashboard-metrics-panel">
            <div className="dashboard-panel-header">
              <h2 className="dashboard-panel-title">Detalle de picos</h2>
            </div>

            <div className="dashboard-detail-block">
              <span className="dashboard-detail-label">Horas pico</span>
              <p className="dashboard-detail-value">{peakHoursLabel}</p>
            </div>

            <div className="dashboard-detail-block">
              <span className="dashboard-detail-label">Reservas en hora pico</span>
              <p className="dashboard-detail-value">{dashboard.peakCount}</p>
            </div>

            <div className="dashboard-detail-block">
              <span className="dashboard-detail-label">Resumen</span>
              <p className="dashboard-detail-text">
                El dashboard muestra las horas con mayor carga de reservas para ayudarte a detectar momentos críticos.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}

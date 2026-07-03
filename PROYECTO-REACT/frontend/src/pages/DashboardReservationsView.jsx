import { useCallback, useEffect, useMemo, useState } from 'react'
import ViewTitle from '../components/ViewTitle'
import { CapacityService } from '../services/CapacityService'
import { ReservationService } from '../services/ReservationService'
import { SocioService } from '../services/SocioService'
import { AttendanceService } from '../services/AttendanceService'

const emptyDashboard = {
  totalReservations: 0,
  peakHour: null,
  peakHours: [],
  peakCount: 0,
  hourlyStats: [],
}

const sections = [
  { key: 'principal', label: 'Principal' },
  { key: 'aforo', label: 'Aforo' },
  { key: 'reservas', label: 'Reservas' },
  { key: 'clientes', label: 'Clientes' },
]

function formatHourLabel(value) {
  return `${String(Number(value)).padStart(2, '0')}:00`
}

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function DashboardReservationsView({ token, user }) {
  const isAdmin = user?.rol === 'admin'
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const sevenDaysAgo = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - 7)
    return date.toISOString().slice(0, 10)
  }, [])

  const [activeSection, setActiveSection] = useState('principal')
  const [range, setRange] = useState({ startDate: sevenDaysAgo, endDate: today })
  const [reservationDashboard, setReservationDashboard] = useState(emptyDashboard)
  const [capacity, setCapacity] = useState({ actual: 0, maximo: 0, actualizadoEn: null })
  const [clients, setClients] = useState([])
  const [activeClients, setActiveClients] = useState([])
  const [attendanceCount, setAttendanceCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sortedHours = useMemo(() => {
    return [...reservationDashboard.hourlyStats].sort((a, b) => a.hour - b.hour)
  }, [reservationDashboard.hourlyStats])

  const peakHoursLabel = useMemo(() => {
    if (reservationDashboard.peakHours.length) {
      return reservationDashboard.peakHours.map(formatHourLabel).join(', ')
    }
    if (reservationDashboard.peakHour !== null) {
      return formatHourLabel(reservationDashboard.peakHour)
    }
    return 'Sin datos'
  }, [reservationDashboard])

  const occupancyPercent = useMemo(() => {
    if (!capacity.maximo) return 0
    return Math.min(100, Math.round((capacity.actual / capacity.maximo) * 100))
  }, [capacity])

  const totalClients = clients.length
  const totalActiveClients = activeClients.length

  const summaryCards = [
    {
      label: 'Clientes totales',
      value: totalClients,
      description: 'Número de socios registrados en el gimnasio.',
    },
    {
      label: 'Clientes en sala',
      value: totalActiveClients,
      description: 'Usuarios con entrada activa actualmente.',
    },
    {
      label: 'Reservas en rango',
      value: reservationDashboard.totalReservations,
      description: 'Reservas confirmadas y pendientes dentro del rango seleccionado.',
    },
    {
      label: 'Ocupación actual',
      value: `${occupancyPercent}%`,
      description: `Capacidad utilizada de ${capacity.maximo || 0} personas.`,
    },
  ]

  const dashboardCards = [
    {
      label: 'Reservas totales',
      value: reservationDashboard.totalReservations,
      description: 'Cantidad de reservas en el periodo seleccionado.',
    },
    {
      label: 'Hora pico',
      value: peakHoursLabel,
      description: 'Horas con mayor número de reservas.',
    },
    {
      label: 'Reservas pico',
      value: reservationDashboard.peakCount,
      description: 'Reservas en la hora con mayor demanda.',
    },
  ]

  const loadDashboardData = useCallback(async () => {
    if (!token) return

    setLoading(true)
    setError('')

    try {
      const reservationData = await ReservationService.getReservationDashboard(token, range)

      setReservationDashboard({
        totalReservations: reservationData.totalReservations ?? 0,
        peakHour: reservationData.peakHour ?? null,
        peakHours: Array.isArray(reservationData.peakHours) ? reservationData.peakHours : [],
        peakCount: reservationData.peakCount ?? 0,
        hourlyStats: Array.isArray(reservationData.hourlyStats) ? reservationData.hourlyStats : [],
      })

      if (isAdmin) {
        const [capacityData, socioData, attendanceData] = await Promise.all([
          CapacityService.getCapacity(),
          SocioService.getSocios(token),
          AttendanceService.getActiveClients(token),
        ])

        setCapacity({
          actual: Number(capacityData.actual || 0),
          maximo: Number(capacityData.maximo || 0),
          actualizadoEn: capacityData.actualizadoEn || null,
        })

        setClients(Array.isArray(socioData.socios) ? socioData.socios : [])
        setActiveClients(Array.isArray(attendanceData.clients) ? attendanceData.clients : [])
      } else {
        const attendanceSummary = await AttendanceService.getUserAttendanceSummary(token)
        setAttendanceCount(Number(attendanceSummary.attendanceCount || 0))
      }
    } catch (loadError) {
      setError(loadError.message || 'No se pudo cargar los datos del dashboard')
    } finally {
      setLoading(false)
    }
  }, [token, range])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  const clientSummaryCards = [
    {
      label: 'Reservas totales',
      value: reservationDashboard.totalReservations,
      description: 'Reservas realizadas por ti en el rango seleccionado.',
    },
    {
      label: 'Veces asistido',
      value: attendanceCount,
      description: 'Accesos registrados al gimnasio como socio.',
    },
    {
      label: 'Hora pico personal',
      value: peakHoursLabel,
      description: 'Horas con más reservas personales.',
    },
  ]

  function renderPrincipal() {
    return (
      <>
        <div className="dashboard-cards-row dashboard-summary-row">
          {summaryCards.map((card) => (
            <article key={card.label} className="dashboard-info-card">
              <span className="dashboard-info-label">{card.label}</span>
              <strong className="dashboard-info-value">{card.value}</strong>
              <p className="dashboard-info-text">{card.description}</p>
            </article>
          ))}
        </div>

        <div className="dashboard-panel dashboard-panel-top">
          <div className="dashboard-panel-header">
            <div>
              <h2 className="dashboard-panel-title">Resumen de actividad</h2>
              <p className="dashboard-panel-subtitle">
                Estos indicadores muestran el estado del gimnasio en el rango seleccionado.
              </p>
            </div>
          </div>

          <div className="dashboard-range-picker dashboard-range-picker-full">
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

        <div className="dashboard-grid">
          <section className="dashboard-chart-panel">
            <div className="dashboard-panel-header dashboard-chart-panel-header">
              <div>
                <h2 className="dashboard-panel-title">Tendencia de reservas por hora</h2>
                <p className="dashboard-panel-subtitle">
                  El comportamiento por hora muestra la carga de reservas en el periodo seleccionado.
                </p>
              </div>
            </div>

            {loading ? (
              <p className="form-error">Cargando datos...</p>
            ) : sortedHours.length ? (
              <div className="dashboard-chart">
                {sortedHours.map((item) => (
                  <div key={item.hour} className="dashboard-chart-row">
                    <span className="dashboard-chart-label">{formatHourLabel(item.hour)}</span>
                    <div className="dashboard-chart-bar-wrapper">
                      <div
                        className="dashboard-chart-bar"
                        style={{ width: `${Math.max(12, (item.count / Math.max(reservationDashboard.peakCount, 1)) * 100)}%` }}
                      />
                    </div>
                    <strong className="dashboard-chart-value">{item.count}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="form-error">No hay datos para esta vista.</p>
            )}
          </section>

          <aside className="dashboard-metrics-panel">
            <div className="dashboard-panel-header">
              <h2 className="dashboard-panel-title">Indicadores clave</h2>
            </div>
            <div className="dashboard-detail-block">
              <span className="dashboard-detail-label">Clientes activos ahora</span>
              <p className="dashboard-detail-value">{totalActiveClients}</p>
            </div>
            <div className="dashboard-detail-block">
              <span className="dashboard-detail-label">Capacidad actual</span>
              <p className="dashboard-detail-value">{capacity.actual}/{capacity.maximo}</p>
            </div>
            <div className="dashboard-detail-block">
              <span className="dashboard-detail-label">Ultima actualización</span>
              <p className="dashboard-detail-text">{capacity.actualizadoEn ? formatDateTime(capacity.actualizadoEn) : 'Sin datos'}</p>
            </div>
          </aside>
        </div>
      </>
    )
  }

  function renderAforo() {
    return (
      <>
        <div className="dashboard-panel dashboard-panel-top">
          <div className="dashboard-panel-header">
            <div>
              <h2 className="dashboard-panel-title">Aforo y ocupación</h2>
              <p className="dashboard-panel-subtitle">
                Consulta cuántas personas hay dentro del gimnasio y cómo se comporta la demanda a lo largo del día.
              </p>
            </div>
            <div className="dashboard-summary-meta">
              <span>Actual: {capacity.actual}</span>
              <span> / </span>
              <span>Máximo: {capacity.maximo}</span>
            </div>
          </div>

          <div className="dashboard-range-picker dashboard-range-picker-full">
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
          <article className="dashboard-info-card">
            <span className="dashboard-info-label">Ocupación total</span>
            <strong className="dashboard-info-value">{capacity.actual}/{capacity.maximo}</strong>
            <p className="dashboard-info-text">Personas dentro del gimnasio en este momento.</p>
          </article>
          <article className="dashboard-info-card">
            <span className="dashboard-info-label">Porcentaje de uso</span>
            <strong className="dashboard-info-value">{occupancyPercent}%</strong>
            <p className="dashboard-info-text">Porcentaje de la capacidad disponible utilizada actualmente.</p>
          </article>
          <article className="dashboard-info-card">
            <span className="dashboard-info-label">Clientes registrados</span>
            <strong className="dashboard-info-value">{totalClients}</strong>
            <p className="dashboard-info-text">Número total de socios en la base de datos.</p>
          </article>
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel-header dashboard-chart-panel-header">
            <div>
              <h2 className="dashboard-panel-title">Actividad de reserva por hora</h2>
              <p className="dashboard-panel-subtitle">
                El gráfico muestra las reservas confirmadas y pendientes dentro del rango seleccionado.
              </p>
            </div>
          </div>

          {loading ? (
            <p className="form-error">Cargando datos de aforo...</p>
          ) : sortedHours.length ? (
            <div className="dashboard-chart">
              {sortedHours.map((item) => (
                <div key={item.hour} className="dashboard-chart-row">
                  <span className="dashboard-chart-label">{formatHourLabel(item.hour)}</span>
                  <div className="dashboard-chart-bar-wrapper">
                    <div
                      className="dashboard-chart-bar"
                      style={{ width: `${Math.max(12, (item.count / Math.max(reservationDashboard.peakCount, 1)) * 100)}%` }}
                    />
                  </div>
                  <strong className="dashboard-chart-value">{item.count}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="form-error">No hay reservas activas en ese rango.</p>
          )}
        </div>
      </>
    )
  }

  function renderReservas() {
    return (
      <>
        <div className="dashboard-panel dashboard-panel-top">
          <div className="dashboard-panel-header">
            <div>
              <h2 className="dashboard-panel-title">Reservas</h2>
              <p className="dashboard-panel-subtitle">
                Visualiza el detalle de horas pico y el comportamiento de las reservas.
              </p>
            </div>
          </div>

          <div className="dashboard-range-picker dashboard-range-picker-full">
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
          {dashboardCards.map((card) => (
            <article key={card.label} className="dashboard-info-card">
              <span className="dashboard-info-label">{card.label}</span>
              <strong className="dashboard-info-value">{card.value}</strong>
              <p className="dashboard-info-text">{card.description}</p>
            </article>
          ))}
        </div>

        <div className="dashboard-grid">
          <section className="dashboard-chart-panel">
            {loading ? (
              <p className="form-error">Cargando reservas...</p>
            ) : sortedHours.length ? (
              <div className="dashboard-chart">
                {sortedHours.map((item) => (
                  <div key={item.hour} className="dashboard-chart-row">
                    <span className="dashboard-chart-label">{formatHourLabel(item.hour)}</span>
                    <div className="dashboard-chart-bar-wrapper">
                      <div
                        className="dashboard-chart-bar"
                        style={{ width: `${Math.max(12, (item.count / Math.max(reservationDashboard.peakCount, 1)) * 100)}%` }}
                      />
                    </div>
                    <strong className="dashboard-chart-value">{item.count}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="form-error">No hay datos de reservas para ese rango.</p>
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
              <p className="dashboard-detail-value">{reservationDashboard.peakCount}</p>
            </div>

            <div className="dashboard-detail-block">
              <span className="dashboard-detail-label">Rango analizado</span>
              <p className="dashboard-detail-text">{range.startDate} → {range.endDate}</p>
            </div>
          </aside>
        </div>
      </>
    )
  }

  function renderClientes() {
    return (
      <>
        <div className="dashboard-panel dashboard-panel-top">
          <div className="dashboard-panel-header">
            <div>
              <h2 className="dashboard-panel-title">Clientes en sala</h2>
              <p className="dashboard-panel-subtitle">
                Usuarios que actualmente se encuentran dentro del gimnasio con su hora de ingreso.
              </p>
            </div>
          </div>
        </div>

        <div className="dashboard-panel dashboard-panel-top">
          <div className="table-frame">
            <table className="corporate-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>DNI</th>
                  <th>Ingreso</th>
                  <th>Salida</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4">Cargando clientes activos...</td>
                  </tr>
                ) : activeClients.length ? (
                  activeClients.map((client) => (
                    <tr key={client.id}>
                      <td>{client.nombre} {client.apellido}</td>
                      <td>{client.dni}</td>
                      <td>{formatDateTime(client.horaEntrada)}</td>
                      <td>{client.horaSalida ? formatDateTime(client.horaSalida) : 'En curso'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4">No hay clientes dentro del gimnasio en este momento.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <ViewTitle
        title={isAdmin ? 'Dashboard Administrativo' : 'Mi Dashboard'}
        text={isAdmin
          ? 'Resumen de los indicadores clave del gimnasio: aforo, reservas y clientes activos.'
          : 'Resumen de tus reservas y asistencias como socio.'
        }
      />

      <section className="dashboard-page">
        {error && <p className="form-error">{error}</p>}

        {isAdmin ? (
          <>
            <div className="dashboard-tabs">
              {sections.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  className={`dashboard-tab-button${activeSection === section.key ? ' active' : ''}`}
                  onClick={() => setActiveSection(section.key)}
                >
                  {section.label}
                </button>
              ))}
            </div>

            {activeSection === 'principal' && renderPrincipal()}
            {activeSection === 'aforo' && renderAforo()}
            {activeSection === 'reservas' && renderReservas()}
            {activeSection === 'clientes' && renderClientes()}
          </>
        ) : (
          <>
            <div className="dashboard-cards-row dashboard-summary-row">
              {clientSummaryCards.map((card) => (
                <article key={card.label} className="dashboard-info-card">
                  <span className="dashboard-info-label">{card.label}</span>
                  <strong className="dashboard-info-value">{card.value}</strong>
                  <p className="dashboard-info-text">{card.description}</p>
                </article>
              ))}
            </div>

            <div className="dashboard-panel dashboard-panel-top">
              <div className="dashboard-panel-header">
                <div>
                  <h2 className="dashboard-panel-title">Tu actividad personal</h2>
                  <p className="dashboard-panel-subtitle">
                    Estas métricas son solo de tus reservas y tu asistencia.
                  </p>
                </div>
              </div>
            </div>

            <div className="dashboard-grid">
              <section className="dashboard-chart-panel">
                {loading ? (
                  <p className="form-error">Cargando datos...</p>
                ) : sortedHours.length ? (
                  <div className="dashboard-chart">
                    {sortedHours.map((item) => (
                      <div key={item.hour} className="dashboard-chart-row">
                        <span className="dashboard-chart-label">{formatHourLabel(item.hour)}</span>
                        <div className="dashboard-chart-bar-wrapper">
                          <div
                            className="dashboard-chart-bar"
                            style={{ width: `${Math.max(12, (item.count / Math.max(reservationDashboard.peakCount, 1)) * 100)}%` }}
                          />
                        </div>
                        <strong className="dashboard-chart-value">{item.count}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="form-error">Aun no tienes reservas en el rango seleccionado.</p>
                )}
              </section>

              <aside className="dashboard-metrics-panel">
                <div className="dashboard-panel-header">
                  <h2 className="dashboard-panel-title">Tu historial</h2>
                </div>
                <div className="dashboard-detail-block">
                  <span className="dashboard-detail-label">Total de reservas</span>
                  <p className="dashboard-detail-value">{reservationDashboard.totalReservations}</p>
                </div>
                <div className="dashboard-detail-block">
                  <span className="dashboard-detail-label">Veces asistido</span>
                  <p className="dashboard-detail-value">{attendanceCount}</p>
                </div>
                <div className="dashboard-detail-block">
                  <span className="dashboard-detail-label">Horas pico</span>
                  <p className="dashboard-detail-text">{peakHoursLabel}</p>
                </div>
              </aside>
            </div>
          </>
        )}
      </section>
    </>
  )
}

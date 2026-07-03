import { useCallback, useEffect, useMemo, useState } from 'react'
import ViewTitle from '../components/ViewTitle'
import { CapacityService } from '../services/CapacityService'
import { ReservationService } from '../services/ReservationService'
import { SocioService } from '../services/SocioService'
import { AttendanceService } from '../services/AttendanceService'

const sections = [
  { key: 'principal', label: 'Principal' },
  { key: 'aforo', label: 'Aforo' },
  { key: 'reservas', label: 'Reservas' },
  { key: 'clientes', label: 'Clientes' },
]

function formatHourLabel(value) {
  if (value === null || value === undefined) return 'Sin datos'
  return `${String(Number(value)).padStart(2, '0')}:00`
}

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value.replace ? value.replace(' ', 'T') : value)
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatDateOnly(value) {
  if (!value) return ''
  const date = new Date(value.replace ? value.replace(' ', 'T') : value)
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatTimeOnly(value) {
  if (!value) return ''
  const date = new Date(value.replace ? value.replace(' ', 'T') : value)
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function DashboardReservationsView({ token, user }) {
  const isAdmin = user?.rol === 'admin'
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  // State shared/administered
  const [activeSection, setActiveSection] = useState('principal')
  const [capacity, setCapacity] = useState({ actual: 0, maximo: 0, actualizadoEn: null })
  const [clients, setClients] = useState([])
  const [activeClients, setActiveClients] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // State for Socio
  const [socioReservations, setSocioReservations] = useState([])
  const [attendanceCount, setAttendanceCount] = useState(0)

  // State for Admin Aforo Historial
  const [historyFilter, setHistoryFilter] = useState({ fecha: today, hora: '10:00' })
  const [historyResult, setHistoryResult] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')

  // State for Admin Reservas (Today & search by client)
  const [todayStats, setTodayStats] = useState({ totalReservations: 0, peakHour: null, peakHours: [] })
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState(null) // { user, reservas }
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')

  const occupancyPercent = useMemo(() => {
    if (!capacity.maximo) return 0
    return Math.min(100, Math.round((capacity.actual / capacity.maximo) * 100))
  }, [capacity])

  const totalClients = clients.length
  const totalActiveClients = activeClients.length

  // Personal peak hour calculation on client side
  const personalPeakHour = useMemo(() => {
    if (!socioReservations.length) return 'Sin datos'
    const hoursCount = {}
    socioReservations.forEach((r) => {
      if (!r.horaEntrada || r.estado === 'cancelada' || r.estado === 'no_show') return
      const date = new Date(r.horaEntrada.replace(' ', 'T'))
      if (Number.isNaN(date.getTime())) return
      const hour = date.getHours()
      hoursCount[hour] = (hoursCount[hour] || 0) + 1
    })

    let maxHour = null
    let maxCount = 0
    Object.entries(hoursCount).forEach(([h, count]) => {
      if (count > maxCount) {
        maxCount = count
        maxHour = Number(h)
      }
    })

    return maxHour !== null ? `${String(maxHour).padStart(2, '0')}:00` : 'Sin datos'
  }, [socioReservations])

  // Load all dashboard data
  const loadDashboardData = useCallback(async () => {
    if (!token) return

    setLoading(true)
    setError('')

    try {
      if (isAdmin) {
        // Load admin general parameters
        const [capacityData, socioData, attendanceData, todayReservationsData] = await Promise.all([
          CapacityService.getCapacity(),
          SocioService.getSocios(token),
          AttendanceService.getActiveClients(token),
          ReservationService.getReservationDashboard(token, { startDate: today, endDate: today }),
        ])

        setCapacity({
          actual: Number(capacityData.actual || 0),
          maximo: Number(capacityData.maximo || 0),
          actualizadoEn: capacityData.actualizadoEn || null,
        })

        setClients(Array.isArray(socioData.socios) ? socioData.socios : [])
        setActiveClients(Array.isArray(attendanceData.clients) ? attendanceData.clients : [])
        
        // Reservas de hoy stats
        setTodayStats({
          totalReservations: todayReservationsData.totalReservations ?? 0,
          peakHour: todayReservationsData.peakHour ?? null,
          peakHours: Array.isArray(todayReservationsData.peakHours) ? todayReservationsData.peakHours : [],
        })
      } else {
        // Load socio specific data
        const [reservationsData, attendanceSummary] = await Promise.all([
          ReservationService.getMyReservations(token),
          AttendanceService.getUserAttendanceSummary(token),
        ])

        setSocioReservations(Array.isArray(reservationsData.reservas) ? reservationsData.reservas : [])
        setAttendanceCount(Number(attendanceSummary.attendanceCount || 0))
      }
    } catch (loadError) {
      setError(loadError.message || 'No se pudo cargar los datos del dashboard')
    } finally {
      setLoading(false)
    }
  }, [token, isAdmin, today])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // Admin historical capacity handler
  async function handleHistoryQuery(event) {
    event.preventDefault()
    if (!historyFilter.fecha || !historyFilter.hora) {
      setHistoryError('Por favor seleccione una fecha y hora válidas')
      return
    }

    setHistoryLoading(true)
    setHistoryError('')
    setHistoryResult(null)

    try {
      const data = await CapacityService.getHistoricalCapacity(historyFilter.fecha, historyFilter.hora)
      setHistoryResult(data)
    } catch (err) {
      setHistoryError(err.message || 'Error al consultar el aforo histórico')
    } finally {
      setHistoryLoading(false)
    }
  }

  // Admin search reservations by client DNI or Name handler
  async function handleSearchClient(event) {
    event.preventDefault()
    const query = searchQuery.trim()
    if (!query) {
      setSearchError('Por favor ingrese el DNI o nombre del socio')
      return
    }

    setSearchLoading(true)
    setSearchError('')
    setSearchResult(null)

    try {
      const data = await ReservationService.getSocioReservations(token, query)
      setSearchResult({
        user: data.user,
        reservas: Array.isArray(data.reservas) ? data.reservas : [],
      })
    } catch (err) {
      setSearchError(err.message || 'No se encontraron reservas para el socio ingresado')
    } finally {
      setSearchLoading(false)
    }
  }

  // Map state tags
  function getDisplayStatus(estado) {
    if (estado === 'confirmada') {
      return { label: 'Finalizada', className: 'badge-valid' }
    }
    if (estado === 'pendiente') {
      return { label: 'Pendiente', className: 'badge-warning', style: { background: '#fef3c7', color: '#d97706' } }
    }
    return { label: 'Cancelada', className: 'badge-alert' }
  }

  // Calculate duration in minutes
  function getDurationInMinutes(entryStr, exitStr) {
    if (!entryStr || !exitStr) return 'N/A'
    const entry = new Date(entryStr.replace(' ', 'T'))
    const exit = new Date(exitStr.replace(' ', 'T'))
    if (Number.isNaN(entry.getTime()) || Number.isNaN(exit.getTime())) return 'N/A'
    const diffMs = exit.getTime() - entry.getTime()
    return `${Math.round(diffMs / 60000)} min`
  }

  // -----------------------------------------------------------------
  // ADMIN RENDER VIEWS
  // -----------------------------------------------------------------

  function renderPrincipalAdmin() {
    return (
      <div className="dashboard-cards-row dashboard-summary-row" style={{ marginTop: '16px' }}>
        <article className="dashboard-info-card">
          <span className="dashboard-info-label">Clientes Totales</span>
          <strong className="dashboard-info-value">{totalClients}</strong>
          <p className="dashboard-info-text">Socios registrados en la base de datos.</p>
        </article>

        <article className="dashboard-info-card">
          <span className="dashboard-info-label">Clientes en Sala</span>
          <strong className="dashboard-info-value">{totalActiveClients}</strong>
          <p className="dashboard-info-text">Usuarios entrenando en sala en este momento.</p>
        </article>

        <article className="dashboard-info-card">
          <span className="dashboard-info-label">Ocupación Actual</span>
          <strong className="dashboard-info-value">{occupancyPercent}%</strong>
          <p className="dashboard-info-text">Capacidad utilizada de {capacity.maximo} personas.</p>
        </article>
      </div>
    )
  }

  function renderAforoAdmin() {
    const historicalPercent = historyResult && historyResult.maximo 
      ? Math.min(100, Math.round((historyResult.actual / historyResult.maximo) * 100))
      : 0;

    return (
      <div style={{ display: 'grid', gap: '24px', marginTop: '16px' }}>
        {/* Real-time capacity */}
        <section className="dashboard-panel">
          <h2 className="dashboard-panel-title">Aforo en tiempo real</h2>
          <p className="dashboard-panel-subtitle">Control actual de afluencia de personas en el local.</p>

          <div className="dashboard-cards-row" style={{ marginTop: '12px' }}>
            <article className="dashboard-info-card">
              <span className="dashboard-info-label">Ocupación Total</span>
              <strong className="dashboard-info-value">{capacity.actual} / {capacity.maximo}</strong>
              <p className="dashboard-info-text">Personas activas en sala en este instante.</p>
            </article>

            <article className="dashboard-info-card">
              <span className="dashboard-info-label">Porcentaje de Uso</span>
              <strong className="dashboard-info-value">{occupancyPercent}%</strong>
              <p className="dashboard-info-text">Porcentaje de aforo máximo alcanzado.</p>
            </article>
          </div>
        </section>

        {/* Historical capacity */}
        <section className="dashboard-panel">
          <h2 className="dashboard-panel-title">Historial de Aforo</h2>
          <p className="dashboard-panel-subtitle">Consulta cuánta ocupación hubo en una fecha y hora específicas.</p>

          <form onSubmit={handleHistoryQuery} className="dashboard-range-picker" style={{ margin: '16px 0', gap: '16px' }}>
            <div className="dashboard-range-item">
              <span className="element-label">Día</span>
              <input
                className="input-field"
                type="date"
                value={historyFilter.fecha}
                onChange={(event) => setHistoryFilter(prev => ({ ...prev, fecha: event.target.value }))}
                required
              />
            </div>
            <div className="dashboard-range-item">
              <span className="element-label">Hora</span>
              <input
                className="input-field"
                type="time"
                value={historyFilter.hora}
                onChange={(event) => setHistoryFilter(prev => ({ ...prev, hora: event.target.value }))}
                required
              />
            </div>
            <button className="action-btn btn-dark" type="submit" disabled={historyLoading} style={{ alignSelf: 'flex-end', height: '40px' }}>
              {historyLoading ? 'Consultando...' : 'Consultar'}
            </button>
          </form>

          {historyError && <p className="form-error">{historyError}</p>}

          {historyResult && (
            <div className="system-notice success-notice" style={{ marginTop: '12px', padding: '16px', borderRadius: '8px' }}>
              <h4>📊 Aforo en el momento seleccionado:</h4>
              <p style={{ fontSize: '1.2em', margin: '8px 0 0 0' }}>
                Ocupación registrada: <strong>{historyResult.actual} / {historyResult.maximo}</strong> personas (<strong>{historicalPercent}%</strong>).
              </p>
            </div>
          )}
        </section>
      </div>
    )
  }

  function renderReservasAdmin() {
    const formattedPeakHour = todayStats.peakHours.length > 0
      ? todayStats.peakHours.map(formatHourLabel).join(', ')
      : todayStats.peakHour !== null
        ? formatHourLabel(todayStats.peakHour)
        : 'Sin datos';

    return (
      <div style={{ display: 'grid', gap: '24px', marginTop: '16px' }}>
        {/* Today stats */}
        <section className="dashboard-panel">
          <h2 className="dashboard-panel-title">Reservas para el día de hoy</h2>
          <p className="dashboard-panel-subtitle">Resumen diario del flujo programado de visitas.</p>

          <div className="dashboard-cards-row" style={{ marginTop: '12px' }}>
            <article className="dashboard-info-card">
              <span className="dashboard-info-label">Reservas Totales Hoy</span>
              <strong className="dashboard-info-value">{todayStats.totalReservations}</strong>
              <p className="dashboard-info-text">Cantidad de reservas activas o realizadas para el día de hoy.</p>
            </article>

            <article className="dashboard-info-card">
              <span className="dashboard-info-label">Hora Pico</span>
              <strong className="dashboard-info-value">{formattedPeakHour}</strong>
              <p className="dashboard-info-text">Horas con mayor cantidad de visitas reservadas.</p>
            </article>
          </div>
        </section>

        {/* History by client */}
        <section className="dashboard-panel">
          <h2 className="dashboard-panel-title">Historial de reserva por cliente</h2>
          <p className="dashboard-panel-subtitle">Busca todas las reservas realizadas por un socio en el sistema.</p>

          <form onSubmit={handleSearchClient} className="dashboard-range-picker" style={{ margin: '16px 0', gap: '16px' }}>
            <div className="dashboard-range-item" style={{ flex: 1 }}>
              <span className="element-label">DNI o Nombre del socio</span>
              <input
                className="input-field"
                type="text"
                placeholder="Ingrese DNI (8 dígitos) o nombre completo del socio"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                required
              />
            </div>
            <button className="action-btn btn-dark" type="submit" disabled={searchLoading} style={{ alignSelf: 'flex-end', height: '40px' }}>
              {searchLoading ? 'Buscando...' : 'Buscar'}
            </button>
          </form>

          {searchError && <p className="form-error">{searchError}</p>}

          {searchResult && (
            <div style={{ marginTop: '16px', display: 'grid', gap: '16px' }}>
              {/* Socio card detail (Sugerencia implementada) */}
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#111827' }}>Socio Encontrado:</h4>
                <p style={{ margin: '4px 0' }}><strong>Nombre:</strong> {searchResult.user.nombre} {searchResult.user.apellido}</p>
                <p style={{ margin: '4px 0' }}><strong>DNI:</strong> {searchResult.user.dni} | <strong>Email:</strong> {searchResult.user.email}</p>
              </div>

              {/* Table */}
              <div className="table-frame">
                <table className="corporate-table">
                  <thead>
                    <tr>
                      <th>Día</th>
                      <th>Hora Ingreso</th>
                      <th>Hora Salida</th>
                      <th>Duración</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResult.reservas.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '12px' }}>El socio no registra reservas históricas.</td>
                      </tr>
                    ) : (
                      searchResult.reservas.map((r) => {
                        const statusObj = getDisplayStatus(r.estado)
                        return (
                          <tr key={r.id}>
                            <td>{formatDateOnly(r.horaEntrada)}</td>
                            <td>{formatTimeOnly(r.horaEntrada)}</td>
                            <td>{formatTimeOnly(r.horaSalida)}</td>
                            <td>{getDurationInMinutes(r.horaEntrada, r.horaSalida)}</td>
                            <td>
                              <span className={`badge-status ${statusObj.className}`} style={statusObj.style || {}}>
                                {statusObj.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    )
  }

  function renderClientesAdmin() {
    return (
      <div style={{ marginTop: '16px' }}>
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
      </div>
    )
  }

  // -----------------------------------------------------------------
  // SOCIO RENDER VIEWS
  // -----------------------------------------------------------------

  function renderSocioView() {
    return (
      <div style={{ display: 'grid', gap: '24px', marginTop: '16px' }}>
        {/* KPI Cards summary */}
        <div className="dashboard-cards-row dashboard-summary-row">
          <article className="dashboard-info-card">
            <span className="dashboard-info-label">Total de Reservas</span>
            <strong className="dashboard-info-value">{socioReservations.length}</strong>
            <p className="dashboard-info-text">Reservas totales agendadas en tu historial.</p>
          </article>

          <article className="dashboard-info-card">
            <span className="dashboard-info-label">Veces Asistido</span>
            <strong className="dashboard-info-value">{attendanceCount}</strong>
            <p className="dashboard-info-text">Accesos confirmados en la recepción del gimnasio.</p>
          </article>

          <article className="dashboard-info-card">
            <span className="dashboard-info-label">Hora Pico Personal</span>
            <strong className="dashboard-info-value">{personalPeakHour}</strong>
            <p className="dashboard-info-text">Tu horario preferido para entrenar.</p>
          </article>
        </div>

        {/* Reservas list table */}
        <section className="dashboard-panel">
          <h2 className="dashboard-panel-title">Mis Reservas</h2>
          <p className="dashboard-panel-subtitle">Historial completo y estado de tus agendas registradas.</p>

          <div className="table-frame" style={{ marginTop: '16px' }}>
            <table className="corporate-table">
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Hora Ingreso</th>
                  <th>Hora Salida</th>
                  <th>Duración</th> {/* Sugerencia implementada */}
                  <th>Creado el</th> {/* Sugerencia implementada */}
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '12px' }}>Cargando reservas...</td>
                  </tr>
                ) : socioReservations.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '12px' }}>Aún no has registrado ninguna reserva.</td>
                  </tr>
                ) : (
                  socioReservations.map((r) => {
                    const statusObj = getDisplayStatus(r.estado)
                    return (
                      <tr key={r.id}>
                        <td>{formatDateOnly(r.horaEntrada)}</td>
                        <td>{formatTimeOnly(r.horaEntrada)}</td>
                        <td>{formatTimeOnly(r.horaSalida)}</td>
                        <td>{getDurationInMinutes(r.horaEntrada, r.horaSalida)}</td>
                        <td>{formatDateTime(r.creadoEn)}</td>
                        <td>
                          <span className={`badge-status ${statusObj.className}`} style={statusObj.style || {}}>
                            {statusObj.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    )
  }

  // -----------------------------------------------------------------
  // MAIN RETURN RENDER
  // -----------------------------------------------------------------

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

            {activeSection === 'principal' && renderPrincipalAdmin()}
            {activeSection === 'aforo' && renderAforoAdmin()}
            {activeSection === 'reservas' && renderReservasAdmin()}
            {activeSection === 'clientes' && renderClientesAdmin()}
          </>
        ) : (
          renderSocioView()
        )}
      </section>
    </>
  )
}

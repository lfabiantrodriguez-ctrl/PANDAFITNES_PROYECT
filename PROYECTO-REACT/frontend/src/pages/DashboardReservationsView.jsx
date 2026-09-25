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
  const today = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

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
  const [capacityRangeFilter, setCapacityRangeFilter] = useState({ startDate: today, endDate: today })
  const [capacityRangeResult, setCapacityRangeResult] = useState(null)
  const [capacityRangeLoading, setCapacityRangeLoading] = useState(false)
  const [capacityRangeError, setCapacityRangeError] = useState('')

  // State for Admin Reservas (Today & search by client)
  const [todayStats, setTodayStats] = useState({ totalReservations: 0, peakHour: null, peakHours: [] })
  const [historyReservationFilter, setHistoryReservationFilter] = useState({ startDate: today, endDate: today })
  const [historyReservationResult, setHistoryReservationResult] = useState(null)
  const [historyReservationLoading, setHistoryReservationLoading] = useState(false)
  const [historyReservationError, setHistoryReservationError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState(null) // { user, reservas }
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')

  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('')
  const [attendanceSearchResult, setAttendanceSearchResult] = useState(null) // { user, asistencias }
  const [attendanceSearchLoading, setAttendanceSearchLoading] = useState(false)
  const [attendanceSearchError, setAttendanceSearchError] = useState('')

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

        setHistoryReservationResult({
          ...todayReservationsData,
          reservas: Array.isArray(todayReservationsData.reservas) ? todayReservationsData.reservas : [],
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

  useEffect(() => {
    if (!isAdmin) return

    const interval = setInterval(() => {
      loadDashboardData()
    }, 15000)

    return () => clearInterval(interval)
  }, [isAdmin, loadDashboardData])

  // Admin historical capacity handler
  async function handleCapacityRangeQuery(event) {
    event.preventDefault()
    const { startDate, endDate } = capacityRangeFilter

    if (!startDate || !endDate) {
      setCapacityRangeError('Por favor ingrese un rango de fechas válido')
      return
    }

    if (startDate > endDate) {
      setCapacityRangeError('La fecha de inicio no puede ser mayor que la fecha de fin')
      return
    }

    setCapacityRangeLoading(true)
    setCapacityRangeError('')
    setCapacityRangeResult(null)

    try {
      const data = await CapacityService.getCapacityRange(startDate, endDate)
      setCapacityRangeResult(data)
    } catch (err) {
      setCapacityRangeError(err.message || 'Error al consultar el historial de aforo')
    } finally {
      setCapacityRangeLoading(false)
    }
  }

  async function handleReservationHistoryQuery(event) {
    event.preventDefault()
    const { startDate, endDate } = historyReservationFilter

    if (!startDate || !endDate) {
      setHistoryReservationError('Por favor ingrese un rango de fechas válido')
      return
    }

    if (startDate > endDate) {
      setHistoryReservationError('La fecha de inicio no puede ser mayor que la fecha de fin')
      return
    }

    setHistoryReservationLoading(true)
    setHistoryReservationError('')
    setHistoryReservationResult(null)

    try {
      const data = await ReservationService.getReservationDashboard(token, { startDate, endDate })
      setHistoryReservationResult(data)
    } catch (err) {
      setHistoryReservationError(err.message || 'Error al consultar el historial de reservas')
    } finally {
      setHistoryReservationLoading(false)
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

  async function handleSearchAttendance(event) {
    event.preventDefault()
    const query = attendanceSearchQuery.trim()
    if (!query) {
      setAttendanceSearchError('Por favor ingrese el DNI o nombre del socio')
      return
    }

    setAttendanceSearchLoading(true)
    setAttendanceSearchError('')
    setAttendanceSearchResult(null)

    try {
      const data = await AttendanceService.searchBySocio(token, query)
      setAttendanceSearchResult({
        user: data.user,
        asistencias: Array.isArray(data.asistencias) ? data.asistencias : [],
      })
    } catch (err) {
      setAttendanceSearchError(err.message || 'No se encontraron asistencias para el socio ingresado')
    } finally {
      setAttendanceSearchLoading(false)
    }
  }

  // Map state tags
  function getDisplayStatus(estado) {
    if (estado === 'finalizada') {
      return { label: 'Finalizada', className: 'badge-valid' }
    }
    if (estado === 'confirmada') {
      return { label: 'Confirmada', className: 'badge-valid' }
    }
    if (estado === 'pendiente') {
      return { label: 'Pendiente', className: 'badge-warning', style: { background: '#fef3c7', color: '#d97706' } }
    }
    if (estado === 'cancelada') {
      return { label: 'Cancelada', className: 'badge-alert' }
    }
    return { label: String(estado).charAt(0).toUpperCase() + String(estado).slice(1), className: 'badge-warning' }
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
          <p className="dashboard-panel-subtitle">Consulta cuánta ocupación hubo en un rango de fechas.</p>

          <form onSubmit={handleCapacityRangeQuery} className="dashboard-range-picker" style={{ display: 'grid', gap: '16px', margin: '16px 0' }}>
            <div className="dashboard-range-item">
              <span className="element-label">Desde</span>
              <input
                className="input-field"
                type="date"
                value={capacityRangeFilter.startDate}
                onChange={(event) => setCapacityRangeFilter(prev => ({ ...prev, startDate: event.target.value }))}
                required
              />
            </div>
            <div className="dashboard-range-item">
              <span className="element-label">Hasta</span>
              <input
                className="input-field"
                type="date"
                value={capacityRangeFilter.endDate}
                onChange={(event) => setCapacityRangeFilter(prev => ({ ...prev, endDate: event.target.value }))}
                required
              />
            </div>
            <button className="action-btn btn-dark" type="submit" disabled={capacityRangeLoading} style={{ alignSelf: 'flex-end', height: '40px' }}>
              {capacityRangeLoading ? 'Consultando...' : 'Consultar rango'}
            </button>
          </form>

          {capacityRangeError && <p className="form-error">{capacityRangeError}</p>}

          {capacityRangeResult && (
            <div className="system-notice success-notice" style={{ marginTop: '12px', padding: '16px', borderRadius: '8px' }}>
              <h4>📊 Aforo en el rango seleccionado:</h4>
              <p style={{ margin: '8px 0 0 0' }}>
                Rango: <strong>{capacityRangeResult.startDate}</strong> hasta <strong>{capacityRangeResult.endDate}</strong>
              </p>
              <div className="table-frame" style={{ marginTop: '16px' }}>
                <table className="corporate-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Asistentes</th>
                      <th>Clientes diarios</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capacityRangeResult.dailySummary.map((row) => (
                      <tr key={row.fecha}>
                        <td>{row.fecha}</td>
                        <td>{row.attendances}</td>
                        <td>{row.guests}</td>
                        <td>{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="dashboard-panel">
          <h2 className="dashboard-panel-title">Historial de Asistencias</h2>
          <p className="dashboard-panel-subtitle">Busca las asistencias registradas de un socio por DNI o nombre.</p>

          <form onSubmit={handleSearchAttendance} className="dashboard-range-picker" style={{ margin: '16px 0', gap: '16px' }}>
            <div className="dashboard-range-item" style={{ flex: 1 }}>
              <span className="element-label">DNI o Nombre del socio</span>
              <input
                className="input-field"
                type="text"
                placeholder="Ingrese DNI (8 dígitos) o nombre completo"
                value={attendanceSearchQuery}
                onChange={(event) => setAttendanceSearchQuery(event.target.value)}
                required
              />
            </div>
            <button className="action-btn btn-dark" type="submit" disabled={attendanceSearchLoading} style={{ alignSelf: 'flex-end', height: '40px' }}>
              {attendanceSearchLoading ? 'Buscando...' : 'Buscar'}
            </button>
          </form>

          {attendanceSearchError && <p className="form-error">{attendanceSearchError}</p>}

          {attendanceSearchResult && (
            <div style={{ marginTop: '16px', display: 'grid', gap: '16px' }}>
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#111827' }}>Socio</h4>
                <p style={{ margin: '4px 0' }}><strong>Nombre:</strong> {attendanceSearchResult.user.nombre} {attendanceSearchResult.user.apellido}</p>
                <p style={{ margin: '4px 0' }}><strong>DNI:</strong> {attendanceSearchResult.user.dni} | <strong>Email:</strong> {attendanceSearchResult.user.email}</p>
                <p style={{ margin: '4px 0' }}><strong>Total Asistencias:</strong> {attendanceSearchResult.asistencias.length}</p>
              </div>

              <div className="table-frame">
                <table className="corporate-table">
                  <thead>
                    <tr>
                      <th>Día</th>
                      <th>Ingreso</th>
                      <th>Salida</th>
                      <th>Duración</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceSearchResult.asistencias.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '12px' }}>No se encontraron asistencias para este socio.</td>
                      </tr>
                    ) : (
                      attendanceSearchResult.asistencias.map((asistencia) => {
                        const duration = getDurationInMinutes(asistencia.horaEntrada, asistencia.horaSalida)
                        return (
                          <tr key={`att-${asistencia.id}`}>
                            <td>{formatDateOnly(asistencia.horaEntrada)}</td>
                            <td>{formatTimeOnly(asistencia.horaEntrada)}</td>
                            <td>{asistencia.horaSalida ? formatTimeOnly(asistencia.horaSalida) : 'En curso'}</td>
                            <td>{duration}</td>
                            <td>{asistencia.estado === 'activo' ? 'Activo' : 'Finalizada'}</td>
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
          <h2 className="dashboard-panel-title">Reservas de Socios</h2>
          <p className="dashboard-panel-subtitle">Listado de todas las reservas hechas por socios dentro del rango seleccionado.</p>

          <form onSubmit={handleReservationHistoryQuery} className="dashboard-range-picker" style={{ display: 'grid', gap: '16px', margin: '16px 0' }}>
            <div className="dashboard-range-item">
              <span className="element-label">Desde</span>
              <input
                className="input-field"
                type="date"
                value={historyReservationFilter.startDate}
                onChange={(event) => setHistoryReservationFilter(prev => ({ ...prev, startDate: event.target.value }))}
                required
              />
            </div>
            <div className="dashboard-range-item">
              <span className="element-label">Hasta</span>
              <input
                className="input-field"
                type="date"
                value={historyReservationFilter.endDate}
                onChange={(event) => setHistoryReservationFilter(prev => ({ ...prev, endDate: event.target.value }))}
                required
              />
            </div>
            <button className="action-btn btn-dark" type="submit" disabled={historyReservationLoading} style={{ alignSelf: 'flex-end', height: '40px' }}>
              {historyReservationLoading ? 'Consultando...' : 'Consultar reservas'}
            </button>
          </form>

          {historyReservationError && <p className="form-error">{historyReservationError}</p>}

          {historyReservationResult && (
            <div className="table-frame" style={{ marginTop: '16px' }}>
              <table className="corporate-table">
                <thead>
                  <tr>
                    <th>Socio</th>
                    <th>DNI</th>
                    <th>Fecha</th>
                    <th>Ingreso</th>
                    <th>Salida</th>
                    <th>Duración</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(!Array.isArray(historyReservationResult.reservas) || historyReservationResult.reservas.length === 0) ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '12px' }}>No hay reservas de socios para el rango seleccionado.</td>
                    </tr>
                  ) : (
                    historyReservationResult.reservas.map((reserva) => {
                      const statusObj = getDisplayStatus(reserva.estado)
                      return (
                        <tr key={reserva.id}>
                          <td>{reserva.nombre} {reserva.apellido}</td>
                          <td>{reserva.dni}</td>
                          <td>{formatDateOnly(reserva.horaEntrada)}</td>
                          <td>{formatTimeOnly(reserva.horaEntrada)}</td>
                          <td>{formatTimeOnly(reserva.horaSalida)}</td>
                          <td>{getDurationInMinutes(reserva.horaEntrada, reserva.horaSalida)}</td>
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
          )}
        </section>

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
        title={isAdmin ? 'Dashboard de Control' : 'Mi Dashboard'}
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

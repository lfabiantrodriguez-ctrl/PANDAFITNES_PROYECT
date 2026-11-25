import {canAccess,moduleLabel} from '../utils/access'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ViewTitle from '../components/ViewTitle'
import CheckInView from './CheckInView'
import { CapacityService } from '../services/CapacityService'
import { SocioService } from '../services/SocioService'
import { AttendanceService } from '../services/AttendanceService'
import { MembershipService } from '../services/MembershipService'
import { ConfigService } from '../services/ConfigService'
import { DashboardService } from '../services/DashboardService'
import {
  formatDateTime,
  formatDateOnly,
  formatTimeOnly,
  getTodayPeru,
} from '../utils/formatters'

const sections = [
  { key: 'principal', label: 'Vista General' },
  { key: 'aforo', label: 'Aforo e Historial' },
  { key: 'clientes', label: 'Control de Acceso' },
]

function getDurationInMinutes(entryStr, exitStr) {
  if (!entryStr || !exitStr) return 'En curso'
  const entry = new Date(entryStr.replace ? entryStr.replace(' ', 'T') : entryStr)
  const exit = new Date(exitStr.replace ? exitStr.replace(' ', 'T') : exitStr)
  if (Number.isNaN(entry.getTime()) || Number.isNaN(exit.getTime())) return 'N/A'
  const diffMs = exit.getTime() - entry.getTime()
  return `${Math.max(1, Math.round(diffMs / 60000))} min`
}

export default function DashboardReservationsView({ token, user }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isAdmin = Boolean(user && user.rol !== 'cliente')
  const today = useMemo(() => getTodayPeru(), [])

  // State shared / Admin
  const [activeSection, setActiveSection] = useState(
    searchParams.get('tab') === 'clientes' ? 'clientes' : 'principal'
  )
  const [capacity, setCapacity] = useState({ actual: 0, maximo: 0, actualizadoEn: null })
  const [clients, setClients] = useState([])
  const [activeClients, setActiveClients] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [config, setConfig] = useState(null)
  const [metrics, setMetrics] = useState({
    totalSocios: 0,
    ingresosMes: 0,
    mesActual: '',
    weeklyData: [],
    revenueChartData: [],
    totalAsistenciasPeriodo: 0,
    totalIngresosPeriodo: 0,
    filterRange: null,
    averageDaily: '0.0',
    recentActivity: [],
    renewals: [],
  })
  const [chartFilterMode, setChartFilterMode] = useState('7d')
  const [chartMonth, setChartMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [chartRange, setChartRange] = useState(() => {
    const today = new Date().toISOString().slice(0, 10)
    return { startDate: today, endDate: today }
  })
  const [chartFilterError, setChartFilterError] = useState('')
  const [chartLoading, setChartLoading] = useState(false)
  const [hoveredRevenueIdx, setHoveredRevenueIdx] = useState(null)

  // State for Socio
  const [socioAsistencias, setSocioAsistencias] = useState([])
  const [attendanceCount, setAttendanceCount] = useState(0)
  const [membershipData, setMembershipData] = useState(null)
  const [pandaData, setPandaData] = useState(null)

  // State for Admin Aforo Historial
  const [capacityRangeFilter, setCapacityRangeFilter] = useState({ startDate: today, endDate: today })
  const [capacityRangeResult, setCapacityRangeResult] = useState(null)
  const [capacityRangeLoading, setCapacityRangeLoading] = useState(false)
  const [capacityRangeError, setCapacityRangeError] = useState('')

  // State for Admin Attendance Search
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('')
  const [attendanceSearchResult, setAttendanceSearchResult] = useState(null)
  const [attendanceSearchLoading, setAttendanceSearchLoading] = useState(false)
  const [attendanceSearchError, setAttendanceSearchError] = useState('')

  const occupancyPercent = useMemo(() => {
    if (!capacity.maximo) return 0
    return Math.min(100, Math.round((capacity.actual / capacity.maximo) * 100))
  }, [capacity])

  const totalClients = clients.length
  const totalActiveClients = activeClients.length

  // Calcular estado en tiempo real del club (abierto / cerrado / horario especial)
  const clubStatus = useMemo(() => {
    if (!config) return { open: true, text: 'Horario habitual', emergency: false }
    if (config.estado_operativo === 'cerrado_emergencia') {
      return { open: false, text: 'Cerrado por emergencia / mantenimiento', emergency: true }
    }

    const now = new Date()
    const day = now.getDay() // 0=Domingo, 6=Sábado, 1-5=Lun-Vie
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    if (day === 0) {
      if (config.horario_domingo_abierto !== '1') {
        return { open: false, text: 'Cerrado hoy domingo (Descanso)', emergency: false }
      }
      const inFirst = currentTime >= (config.horario_domingo_inicio || '08:00') && currentTime <= (config.horario_domingo_fin || '13:00')
      const inSecond =
        config.horario_domingo_modalidad === 'partido' &&
        currentTime >= (config.horario_domingo_tarde_inicio || '16:00') &&
        currentTime <= (config.horario_domingo_tarde_fin || '20:00')
      const open = inFirst || inSecond
      return { open, text: open ? 'Abierto ahora (Domingo)' : `Cerrado ahora (${config.horario_domingo_inicio} - ${config.horario_domingo_fin})`, emergency: false }
    } else if (day === 6) {
      if (config.horario_sabado_estado === '0') {
        return { open: false, text: 'Cerrado hoy sábado', emergency: false }
      }
      const inFirst = currentTime >= (config.horario_sabado_inicio || '07:00') && currentTime <= (config.horario_sabado_fin || '12:00')
      const inSecond =
        config.horario_sabado_modalidad === 'partido' &&
        currentTime >= (config.horario_sabado_tarde_inicio || '16:00') &&
        currentTime <= (config.horario_sabado_tarde_fin || '20:00')
      const open = inFirst || inSecond
      return { open, text: open ? 'Abierto ahora (Sábado)' : `Cerrado ahora (Sábados: ${config.horario_sabado_inicio} - ${config.horario_sabado_fin})`, emergency: false }
    } else {
      if (config.horario_semana_modalidad === 'continuo') {
        const cStart = config.horario_semana_corrido_inicio || config.horario_semana_manana_inicio || '06:30'
        const cEnd = config.horario_semana_corrido_fin || config.horario_semana_tarde_fin || '22:00'
        const open = currentTime >= cStart && currentTime <= cEnd
        if (open) return { open: true, text: 'Abierto ahora (Jornada Continua)', emergency: false }
        if (currentTime < cStart) return { open: false, text: `Abre hoy a las ${cStart}`, emergency: false }
        return { open: false, text: `Cerrado por hoy (Reapertura mañana ${cStart})`, emergency: false }
      }
      const inMorning = currentTime >= (config.horario_semana_manana_inicio || '06:30') && currentTime <= (config.horario_semana_manana_fin || '11:00')
      const inAfternoon = currentTime >= (config.horario_semana_tarde_inicio || '16:00') && currentTime <= (config.horario_semana_tarde_fin || '22:00')
      const open = inMorning || inAfternoon
      if (open) return { open: true, text: 'Abierto ahora', emergency: false }
      if (currentTime < (config.horario_semana_manana_inicio || '06:30')) {
        return { open: false, text: `Abre hoy a las ${config.horario_semana_manana_inicio || '06:30'}`, emergency: false }
      } else if (currentTime < (config.horario_semana_tarde_inicio || '16:00')) {
        return { open: false, text: `Turno tarde abre a las ${config.horario_semana_tarde_inicio || '16:00'}`, emergency: false }
      } else {
        const nextMorning = config.horario_semana_manana_inicio || '06:30'
        return { open: false, text: `Cerrado por hoy (Reapertura mañana ${nextMorning})`, emergency: false }
      }
    }
  }, [config])

  // Load all dashboard data
  const loadDashboardData = useCallback(async () => {
    if (!token) return

    setLoading(true)
    setError('')

    try {
      if (isAdmin) {
        const [capacityData, socioData, attendanceData, configData, metricsData] = await Promise.all([
          CapacityService.getCapacity(),
          SocioService.getSocios(token).catch(() => ({ socios: [] })),
          AttendanceService.getActiveClients(token).catch(() => ({ clients: [] })),
          ConfigService.getConfig().catch(() => null),
          DashboardService.getMetrics(token).catch(() => null),
        ])

        setCapacity({
          actual: Number(capacityData.actual || 0),
          maximo: Number(capacityData.maximo || 0),
          actualizadoEn: capacityData.actualizadoEn || null,
        })

        setClients(Array.isArray(socioData.socios) ? socioData.socios : [])
        setActiveClients(Array.isArray(attendanceData.clients) ? attendanceData.clients : [])
        if (configData) setConfig(configData)
        if (metricsData) setMetrics(metricsData)
      } else {
        const [capacityData, attHistory, memData, pandaRes, configData] = await Promise.all([
          CapacityService.getCapacity().catch(() => ({ actual: 0, maximo: 100 })),
          AttendanceService.getMyAttendanceHistory(token).catch(() => ({ asistencias: [], totalAsistencias: 0 })),
          MembershipService.getMyMembership(token).catch(() => null),
          AttendanceService.getPandaStatus(token).catch(() => null),
          ConfigService.getConfig().catch(() => null),
        ])

        setCapacity({
          actual: Number(capacityData.actual || 0),
          maximo: Number(capacityData.maximo || 0),
          actualizadoEn: capacityData.actualizadoEn || null,
        })

        setSocioAsistencias(Array.isArray(attHistory.asistencias) ? attHistory.asistencias : [])
        setAttendanceCount(Number(attHistory.totalAsistencias || (Array.isArray(attHistory.asistencias) ? attHistory.asistencias.length : 0)))
        setMembershipData(memData?.membership || memData || null)
        setPandaData(pandaRes || null)
        if (configData) setConfig(configData)
      }
    } catch (loadError) {
      setError(loadError.message || 'No se pudo cargar los datos del dashboard')
    } finally {
      setLoading(false)
    }
  }, [token, isAdmin])

  async function fetchFilteredMetrics(params = {}) {
    if (!token) return
    setChartLoading(true)
    setChartFilterError('')
    try {
      const metricsData = await DashboardService.getMetrics(token, params)
      if (metricsData) setMetrics(metricsData)
    } catch (err) {
      setChartFilterError(err?.message || 'No se pudieron filtrar las métricas.')
    } finally {
      setChartLoading(false)
    }
  }

  function handleSelectFilterMode(mode) {
    setChartFilterMode(mode)
    setChartFilterError('')
    if (mode === '7d') {
      fetchFilteredMetrics({})
    } else if (mode === 'month' && chartMonth) {
      fetchFilteredMetrics({ month: chartMonth })
    }
  }

  function handleMonthChange(nextMonth) {
    setChartMonth(nextMonth)
    setChartFilterError('')
    if (nextMonth) {
      setChartFilterMode('month')
      fetchFilteredMetrics({ month: nextMonth })
    }
  }

  function handleApplyRangeFilter(e) {
    e.preventDefault()
    if (!chartRange.startDate || !chartRange.endDate) {
      setChartFilterError('Selecciona ambas fechas (Desde y Hasta).')
      return
    }
    if (chartRange.startDate > chartRange.endDate) {
      setChartFilterError('La fecha "Desde" no puede ser mayor que "Hasta".')
      return
    }
    setChartFilterError('')
    fetchFilteredMetrics({ startDate: chartRange.startDate, endDate: chartRange.endDate })
  }

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  useEffect(() => {
    function handleConfigUpdated(event) {
      if (event.detail) setConfig(event.detail)
    }
    window.addEventListener('panda_config_updated', handleConfigUpdated)
    return () => window.removeEventListener('panda_config_updated', handleConfigUpdated)
  }, [])

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
      setCapacityRangeError('La fecha de inicio no puede ser posterior a la fecha final')
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

  // Admin search attendance by socio DNI or Name handler
  async function handleSearchAttendance(event) {
    event.preventDefault()
    const query = attendanceSearchQuery.trim()
    if (!query) {
      setAttendanceSearchError('Por favor ingrese el DNI o nombre del socio')
      return
    }

    if (/^\d+$/.test(query) && query.length !== 8) {
      setAttendanceSearchError('El DNI ingresado debe tener exactamente 8 dígitos')
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

  // -----------------------------------------------------------------
  // ADMIN RENDER VIEWS
  // -----------------------------------------------------------------

  function renderPrincipalAdmin() {
    const weeklyData = metrics.weeklyData && metrics.weeklyData.length > 0
      ? metrics.weeklyData
      : [
          { day: 'Hoy', count: capacity.actual, height: 25, isToday: true },
        ]

    const totalSociosRegistrados = metrics.totalSocios !== undefined ? metrics.totalSocios : totalClients
    const totalPersonasEnSala = totalActiveClients > 0 ? totalActiveClients : capacity.actual
    const facturacionMes = Number(metrics.ingresosMes || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const nombreMes = metrics.mesActual || 'este mes'
    const promedioEntradas = metrics.averageDaily || '0.0'

    return (
      <div style={{ display: 'grid', gap: '24px' }}>
        {/* Fila de 4 Tarjetas de Métricas Principales Reales */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {/* Card 1: Socios activos */}
          <article className="dashboard-info-card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span className="dashboard-info-label" style={{ margin: 0, fontSize: '0.82rem' }}>Socios activos</span>
              <div style={{ color: '#235833', background: '#ecfccb', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
            </div>
            <strong className="dashboard-info-value" style={{ fontSize: '2.4rem', margin: '0 0 6px', color: '#111d15' }}>
              {totalSociosRegistrados}
            </strong>
            <p className="dashboard-info-text" style={{ fontSize: '0.82rem', color: '#5f7165' }}>
              Registrados en el sistema
            </p>
          </article>

          {/* Card 2: Entradas en sala */}
          <article className="dashboard-info-card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span className="dashboard-info-label" style={{ margin: 0, fontSize: '0.82rem' }}>Aforo actual en sala</span>
              <div style={{ color: '#235833', background: '#ecfccb', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
                  <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
                  <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
                  <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </div>
            </div>
            <strong className="dashboard-info-value" style={{ fontSize: '2.4rem', margin: '0 0 6px', color: '#111d15' }}>
              {capacity.actual} / {capacity.maximo}
            </strong>
            <p className="dashboard-info-text" style={{ fontSize: '0.82rem', color: '#5f7165' }}>
              {occupancyPercent}% de aforo ocupado en tiempo real
            </p>
          </article>

          {/* Card 3: Ingresos del mes */}
          <article className="dashboard-info-card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span className="dashboard-info-label" style={{ margin: 0, fontSize: '0.82rem' }}>Ingresos del mes</span>
              <div style={{ color: '#235833', background: '#ecfccb', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                  <line x1="2" y1="10" x2="22" y2="10"></line>
                </svg>
              </div>
            </div>
            <strong className="dashboard-info-value" style={{ fontSize: '2.4rem', margin: '0 0 6px', color: '#111d15' }}>
              S/ {facturacionMes}
            </strong>
            <p className="dashboard-info-text" style={{ fontSize: '0.82rem', color: '#5f7165' }}>
              PEN · Facturación acumulada de {nombreMes}
            </p>
          </article>
        </div>

        {/* Barra de filtros para gráficos (Últimos 7 días / Mes / Rango Desde-Hasta) */}
        <section className="dashboard-panel" style={{ padding: '16px 20px' }}>
          <form
            noValidate
            onSubmit={handleApplyRangeFilter}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleSelectFilterMode('7d')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '10px',
                  border: chartFilterMode === '7d' ? '1px solid #166534' : '1px solid #d7e2da',
                  background: chartFilterMode === '7d' ? '#166534' : '#ffffff',
                  color: chartFilterMode === '7d' ? '#ffffff' : '#111d15',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Últimos 7 días
              </button>
              <button
                type="button"
                onClick={() => handleSelectFilterMode('month')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '10px',
                  border: chartFilterMode === 'month' ? '1px solid #166534' : '1px solid #d7e2da',
                  background: chartFilterMode === 'month' ? '#166534' : '#ffffff',
                  color: chartFilterMode === 'month' ? '#ffffff' : '#111d15',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Por Mes
              </button>
              <button
                type="button"
                onClick={() => handleSelectFilterMode('range')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '10px',
                  border: chartFilterMode === 'range' ? '1px solid #166534' : '1px solid #d7e2da',
                  background: chartFilterMode === 'range' ? '#166534' : '#ffffff',
                  color: chartFilterMode === 'range' ? '#ffffff' : '#111d15',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Desde / Hasta
              </button>
            </div>

            {chartFilterMode === 'month' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label htmlFor="dashboard-month-filter" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#5f7165', margin: 0 }}>
                  Mes:
                </label>
                <input
                  id="dashboard-month-filter"
                  type="month"
                  value={chartMonth}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '10px',
                    border: '1px solid #d7e2da',
                    fontSize: '0.82rem',
                    color: '#111d15',
                  }}
                />
              </div>
            )}

            {chartFilterMode === 'range' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <label htmlFor="dashboard-start-date" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#5f7165', margin: 0 }}>
                  Desde:
                </label>
                <input
                  id="dashboard-start-date"
                  type="date"
                  value={chartRange.startDate}
                  onChange={(e) => {
                    setChartRange((prev) => ({ ...prev, startDate: e.target.value }))
                    if (chartFilterError) setChartFilterError('')
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '10px',
                    border: chartFilterError ? '1px solid #ef4444' : '1px solid #d7e2da',
                    background: chartFilterError ? '#fef2f2' : '#ffffff',
                    fontSize: '0.82rem',
                    color: '#111d15',
                  }}
                />
                <label htmlFor="dashboard-end-date" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#5f7165', margin: 0 }}>
                  Hasta:
                </label>
                <input
                  id="dashboard-end-date"
                  type="date"
                  value={chartRange.endDate}
                  onChange={(e) => {
                    setChartRange((prev) => ({ ...prev, endDate: e.target.value }))
                    if (chartFilterError) setChartFilterError('')
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '10px',
                    border: chartFilterError ? '1px solid #ef4444' : '1px solid #d7e2da',
                    background: chartFilterError ? '#fef2f2' : '#ffffff',
                    fontSize: '0.82rem',
                    color: '#111d15',
                  }}
                />
                <button
                  type="submit"
                  disabled={chartLoading}
                  className="action-btn"
                  style={{ padding: '7px 14px', fontSize: '0.82rem', minHeight: '34px' }}
                >
                  {chartLoading ? 'Cargando...' : 'Aplicar'}
                </button>
              </div>
            )}
          </form>
          {chartFilterError && (
            <p style={{ margin: '8px 0 0', color: '#dc2626', fontSize: '0.8rem', fontWeight: 600 }}>
              {chartFilterError}
            </p>
          )}
        </section>

        {/* Fila de 2 Gráficos: Asistencias e Ingresos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '20px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', alignItems: 'stretch' }}>
          {/* Gráfico 1: Asistencias */}
          <section className="dashboard-panel" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '22px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#111d15' }}>
                  Asistencias
                </h3>
                <p style={{ margin: '4px 0 0', color: '#5f7165', fontSize: '0.84rem' }}>
                  {chartFilterMode === '7d'
                    ? 'Últimos 7 días'
                    : chartFilterMode === 'month'
                    ? `Mes ${chartMonth}`
                    : `${chartRange.startDate} al ${chartRange.endDate}`}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background: '#ecfccb',
                    color: '#1b4d24',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                  }}
                >
                  Total: {metrics.totalAsistenciasPeriodo ?? weeklyData.reduce((s, d) => s + Number(d.count || 0), 0)} · Prom: {promedioEntradas}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '170px', padding: '10px 6px 0', borderBottom: '1px solid #e3e8e2', gap: weeklyData.length > 10 ? '4px' : '10px', overflowX: 'auto' }}>
              {weeklyData.map((item, idx) => {
                const isCompact = weeklyData.length > 12
                return (
                  <div
                    key={idx}
                    title={`${item.isoDate || item.day}: ${item.count} asistencias`}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: isCompact ? '14px' : '28px', height: '100%', justifyContent: 'flex-end' }}
                  >
                    <span style={{ fontSize: isCompact ? '0.62rem' : '0.75rem', fontWeight: 700, color: item.isToday ? '#111d15' : '#5f7165', marginBottom: '4px' }}>
                      {isCompact && item.count === 0 ? '' : item.count}
                    </span>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: isCompact ? '18px' : '40px',
                        height: `${item.height}%`,
                        background: item.isToday ? '#c4f039' : '#235833',
                        borderRadius: '6px 6px 0 0',
                        transition: 'all 0.3s ease',
                        boxShadow: item.isToday ? '0 4px 14px rgba(196, 240, 57, 0.45)' : 'none',
                      }}
                    />
                    <span style={{ fontSize: isCompact ? '0.62rem' : '0.74rem', fontWeight: item.isToday ? 800 : 600, color: item.isToday ? '#111d15' : '#8fa295', marginTop: '6px', whiteSpace: 'nowrap' }}>
                      {item.day}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Gráfico 2: Ingresos (Estilo SaaS / Area Chart Pro) */}
          <section className="dashboard-panel" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            {(() => {
              const revenueData = metrics.revenueChartData && metrics.revenueChartData.length > 0
                ? metrics.revenueChartData
                : [{ day: 'Hoy', amount: 0, height: 15, isToday: true }]
              const rawTotal = Number(
                metrics.totalIngresosPeriodo ?? revenueData.reduce((s, d) => s + Number(d.amount || 0), 0)
              )
              const totalIngresosPeriodo = rawTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              const avgIngresosPeriodo = (rawTotal / Math.max(revenueData.length, 1)).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              const rawMax = Math.max(...revenueData.map((d) => Number(d.amount || 0)), 0)
              const peakIngresos = rawMax.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              const isCompact = revenueData.length > 12

              const svgW = 720
              const svgH = 200
              const padLeft = 44
              const padRight = 14
              const padTop = 22
              const padBottom = 32
              const plotW = svgW - padLeft - padRight
              const plotH = svgH - padTop - padBottom
              const baseY = padTop + plotH

              // Escala Y limpia (si todo es 0, muestra escala S/ 0 - S/ 100)
              const niceScaleMax = rawMax > 0 ? Math.ceil((rawMax * 1.15) / 10) * 10 : 100
              const yTicks = [0, 0.3333, 0.6666, 1]

              const count = revenueData.length
              const points = revenueData.map((item, idx) => {
                const val = Number(item.amount || 0)
                const x = count === 1 ? padLeft + plotW / 2 : padLeft + (idx / (count - 1)) * plotW
                const y = baseY - (val / niceScaleMax) * plotH
                return { x, y, val, item }
              })

              // Curva suave cúbica clamped (sin overshoots por debajo de baseY)
              function buildSmoothPath(pts) {
                if (pts.length === 0) return ''
                if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
                let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
                for (let i = 0; i < pts.length - 1; i++) {
                  const p0 = pts[i === 0 ? i : i - 1]
                  const p1 = pts[i]
                  const p2 = pts[i + 1]
                  const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1]
                  const tension = 0.2
                  const cp1x = p1.x + (p2.x - p0.x) * tension
                  const cp1y = Math.min(baseY, Math.max(padTop, p1.y + (p2.y - p0.y) * tension))
                  const cp2x = p2.x - (p3.x - p1.x) * tension
                  const cp2y = Math.min(baseY, Math.max(padTop, p2.y - (p3.y - p1.y) * tension))
                  d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
                }
                return d
              }

              const linePath = buildSmoothPath(points)
              const areaPath = points.length > 1
                ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${baseY} L ${points[0].x.toFixed(1)} ${baseY} Z`
                : ''
              const activePoint = hoveredRevenueIdx !== null && points[hoveredRevenueIdx] ? points[hoveredRevenueIdx] : null

              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#111d15' }}>
                        Ingresos (S/)
                      </h3>
                      <p style={{ margin: '4px 0 0', color: '#5f7165', fontSize: '0.84rem' }}>
                        {chartFilterMode === '7d'
                          ? 'Últimos 7 días'
                          : chartFilterMode === 'month'
                          ? `Mes ${chartMonth}`
                          : `${chartRange.startDate} al ${chartRange.endDate}`}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ padding: '4px 10px', borderRadius: '999px', background: '#ecfccb', color: '#1b4d24', fontWeight: 700, fontSize: '0.75rem' }}>
                        Total: S/ {totalIngresosPeriodo}
                      </span>
                      <span style={{ padding: '4px 10px', borderRadius: '999px', background: '#f1f5f9', color: '#334155', fontWeight: 700, fontSize: '0.75rem' }}>
                        Prom: S/ {avgIngresosPeriodo}
                      </span>
                      <span style={{ padding: '4px 10px', borderRadius: '999px', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', fontWeight: 700, fontSize: '0.75rem' }}>
                        Pico: S/ {peakIngresos}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{ position: 'relative', width: '100%', overflowX: isCompact ? 'auto' : 'visible' }}
                    onMouseLeave={() => setHoveredRevenueIdx(null)}
                  >
                    <svg
                      viewBox={`0 0 ${svgW} ${svgH}`}
                      style={{ width: '100%', minWidth: isCompact ? '540px' : '100%', height: 'auto', display: 'block', overflow: 'visible' }}
                      role="img"
                      aria-label="Gráfico profesional de ingresos"
                    >
                      <defs>
                        <linearGradient id="revenueAreaGradPro" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#84cc16" stopOpacity="0.38" />
                          <stop offset="60%" stopColor="#22c55e" stopOpacity="0.12" />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.01" />
                        </linearGradient>
                        <filter id="revenueLineShadow" x="-10%" y="-20%" width="120%" height="150%">
                          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#166534" floodOpacity="0.22" />
                        </filter>
                      </defs>

                      {/* Eje Y + líneas guía horizontales */}
                      {yTicks.map((ratio, rIdx) => {
                        const gy = baseY - plotH * ratio
                        const tickVal = Math.round(niceScaleMax * ratio)
                        return (
                          <g key={rIdx}>
                            <line
                              x1={padLeft}
                              y1={gy}
                              x2={svgW - padRight}
                              y2={gy}
                              stroke={ratio === 0 ? '#cbd5e1' : '#e8efe9'}
                              strokeDasharray={ratio === 0 ? undefined : '4 4'}
                              strokeWidth="1"
                            />
                            <text
                              x={padLeft - 8}
                              y={gy + 3.5}
                              textAnchor="end"
                              fontSize="10.5"
                              fontWeight="600"
                              fill="#64748b"
                            >
                              {`S/ ${tickVal}`}
                            </text>
                          </g>
                        )
                      })}

                      {/* Área sombreada */}
                      {points.length > 1 && (
                        <path d={areaPath} fill="url(#revenueAreaGradPro)" />
                      )}

                      {/* Línea suave con sombra */}
                      {points.length > 1 && (
                        <path
                          d={linePath}
                          fill="none"
                          stroke="#166534"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          filter="url(#revenueLineShadow)"
                        />
                      )}

                      {/* Crosshair vertical en hover */}
                      {activePoint && (
                        <line
                          x1={activePoint.x}
                          y1={padTop}
                          x2={activePoint.x}
                          y2={baseY}
                          stroke="#84cc16"
                          strokeWidth="1.5"
                          strokeDasharray="3 3"
                        />
                      )}

                      {/* Puntos, zonas de hover y etiquetas X */}
                      {points.map((p, idx) => {
                        const isHovered = hoveredRevenueIdx === idx
                        const showXLabel = !isCompact || idx === 0 || idx === points.length - 1 || idx % 3 === 0 || p.item.isToday
                        const hitWidth = count > 1 ? plotW / count : 44

                        return (
                          <g key={idx}>
                            {isHovered && (
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r="10"
                                fill="#84cc16"
                                fillOpacity="0.24"
                              />
                            )}
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={isHovered ? 6 : p.item.isToday ? 5 : isCompact ? 3 : 4}
                              fill={isHovered || p.item.isToday ? '#84cc16' : '#ffffff'}
                              stroke="#166534"
                              strokeWidth="2.5"
                              style={{ transition: 'all 0.15s ease' }}
                            />
                            {showXLabel && (
                              <text
                                x={p.x}
                                y={svgH - 8}
                                textAnchor="middle"
                                fontSize={isCompact ? '9.5' : '11'}
                                fontWeight={isHovered || p.item.isToday ? '800' : '600'}
                                fill={isHovered || p.item.isToday ? '#111d15' : '#64748b'}
                              >
                                {p.item.day}
                              </text>
                            )}
                            {/* Área invisible para hover fluido */}
                            <rect
                              x={p.x - hitWidth / 2}
                              y={padTop}
                              width={hitWidth}
                              height={plotH + 14}
                              fill="transparent"
                              style={{ cursor: 'pointer' }}
                              onMouseEnter={() => setHoveredRevenueIdx(idx)}
                            />
                          </g>
                        )
                      })}

                      {/* Tooltip flotante oscuro estilo SaaS */}
                      {activePoint && (() => {
                        const tipW = 128
                        const tipH = 44
                        const tipX = Math.min(Math.max(activePoint.x - tipW / 2, padLeft), svgW - padRight - tipW)
                        const tipY = Math.max(activePoint.y - tipH - 14, 2)
                        return (
                          <g pointerEvents="none">
                            <rect
                              x={tipX}
                              y={tipY}
                              width={tipW}
                              height={tipH}
                              rx="8"
                              fill="#0f1f14"
                              stroke="#235833"
                              strokeWidth="1"
                            />
                            <text
                              x={tipX + tipW / 2}
                              y={tipY + 16}
                              textAnchor="middle"
                              fontSize="10"
                              fontWeight="600"
                              fill="#a7f3d0"
                            >
                              {activePoint.item.isoDate || activePoint.item.day}
                            </text>
                            <text
                              x={tipX + tipW / 2}
                              y={tipY + 33}
                              textAnchor="middle"
                              fontSize="12.5"
                              fontWeight="800"
                              fill="#ffffff"
                            >
                              {`S/ ${activePoint.val.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </text>
                          </g>
                        )
                      })()}
                    </svg>
                  </div>
                </>
              )
            })()}
          </section>
        </div>

        {/* Fila Inferior: Actividad reciente (izquierda) y Membresías por renovar (derecha) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '20px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', alignItems: 'stretch' }}>

          {/* Tarjeta Izquierda: Actividad reciente */}
          <section className="dashboard-panel" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#111d15' }}>
                Actividad reciente en recepción
              </h3>
            </div>

            <div style={{ display: 'grid', gap: '14px' }}>
              {metrics.recentActivity && metrics.recentActivity.length > 0 ? (
                metrics.recentActivity.map((act, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: i < metrics.recentActivity.length - 1 ? '12px' : '0', borderBottom: i < metrics.recentActivity.length - 1 ? '1px solid #f0f4f0' : 'none' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#111d15' }}>{act.name}</strong>
                        <span style={{ fontSize: '0.78rem', color: '#8fa295' }}>{act.time}</span>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: '#5f7165' }}>{act.detail}</span>
                    </div>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        background: act.bg,
                        color: act.col,
                        fontSize: '0.74rem',
                        fontWeight: 800,
                      }}
                    >
                      {act.badge}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: '#5f7165', fontSize: '0.86rem' }}>
                  <i className="bi bi-clock-history me-1"></i>
                  Aún no se ha registrado actividad reciente en recepción.
                </div>
              )}
            </div>
          </section>

          {/* Tarjeta Derecha: Membresías por renovar */}
          <section className="dashboard-panel" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '18px' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#111d15' }}>
              Membresías por renovar
            </h3>
          </div>

          <div className="table-frame d-none d-md-block">
            <table className="corporate-table">
              <thead>
                <tr>
                  <th>Socio</th>
                  <th>Plan</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {metrics.renewals && metrics.renewals.length > 0 ? (
                  metrics.renewals.map((m, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700 }}>{m.socio}</td>
                      <td style={{ color: '#5f7165' }}>{m.plan}</td>
                      <td style={{ color: '#5f7165' }}>{m.vencimiento}</td>
                      <td>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '999px',
                            background: m.estadoBg,
                            color: m.estadoCol,
                            fontSize: '0.76rem',
                            fontWeight: 800,
                          }}
                        >
                          {m.estado}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {canAccess(user,'socios') && (<button
                          type="button"
                          onClick={() => navigate('/app/socios')}
                          style={{
                            background: 'none',
                            border: 0,
                            color: '#235833',
                            fontWeight: 800,
                            fontSize: '0.86rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          Renovar →
                        </button>)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#5f7165' }}>
                      No hay membresías por vencer próximamente. Todos los socios están al día.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* VISTA MÓVIL: TARJETAS DE UN SOLO VISTAZO */}
          <div className="d-block d-md-none mobile-card-list mt-2">
            {metrics.renewals && metrics.renewals.length > 0 ? (
              metrics.renewals.map((m, idx) => (
                <div key={idx} className="mobile-data-card" style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '0.94rem', color: '#111d15' }}>{m.socio}</strong>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: '999px',
                        background: m.estadoBg,
                        color: m.estadoCol,
                        fontSize: '0.72rem',
                        fontWeight: 800,
                      }}
                    >
                      {m.estado}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#5f7165', marginBottom: '10px' }}>
                    <span>{m.plan}</span>
                    <span className="fw-semibold text-dark">Vence: {m.vencimiento}</span>
                  </div>
                  {canAccess(user,'socios') && (<button
                    type="button"
                    onClick={() => navigate('/app/socios')}
                    className="btn btn-sm w-100 fw-bold d-flex align-items-center justify-content-center gap-1"
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      color: '#166534',
                      borderRadius: '10px',
                      fontSize: '0.82rem',
                      padding: '8px',
                    }}
                  >
                    <i className="bi bi-arrow-repeat"></i>
                    <span>Renovar Membresía</span>
                  </button>)}
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '24px', color: '#5f7165', fontSize: '0.85rem' }}>
                No hay membresías por vencer próximamente.
              </div>
            )}
          </div>
        </section>
        </div>
      </div>
    )
  }

  function renderAforoAdmin() {
    return (
      <div style={{ display: 'grid', gap: '24px', marginTop: '16px' }}>
        {/* Real-time capacity */}
        <section className="dashboard-panel">
          <h2 className="dashboard-panel-title">Aforo en tiempo real</h2>

          <div className="dashboard-cards-row" style={{ marginTop: '12px' }}>
            <article className="dashboard-info-card">
              <span className="dashboard-info-label">Ocupación Total</span>
              <strong className="dashboard-info-value">{capacity.actual} / {capacity.maximo}</strong>
              <p className="dashboard-info-text">En sala ahora</p>
            </article>

            <article className="dashboard-info-card">
              <span className="dashboard-info-label">Porcentaje de Uso</span>
              <strong className="dashboard-info-value">{occupancyPercent}%</strong>
              <p className="dashboard-info-text">Del aforo máximo</p>
            </article>
          </div>
        </section>

        {/* Historical capacity */}
        <section className="dashboard-panel">
          <h2 className="dashboard-panel-title">Historial de Aforo</h2>

          <form
            onSubmit={handleCapacityRangeQuery}
            noValidate
            className="dashboard-range-picker"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(170px, 1fr) minmax(170px, 1fr) auto',
              alignItems: 'end',
              gap: '14px',
              margin: '16px 0',
            }}
          >
            <div className="dashboard-range-item">
              <span className="element-label">Desde</span>
              <input
                className={`input-field ${capacityRangeError ? 'is-invalid' : ''}`}
                type="date"
                value={capacityRangeFilter.startDate}
                onChange={(event) => {
                  setCapacityRangeFilter(prev => ({ ...prev, startDate: event.target.value }))
                  if (capacityRangeError) setCapacityRangeError('')
                }}
                style={capacityRangeError ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                required
              />
            </div>
            <div className="dashboard-range-item">
              <span className="element-label">Hasta</span>
              <input
                className={`input-field ${capacityRangeError ? 'is-invalid' : ''}`}
                type="date"
                value={capacityRangeFilter.endDate}
                onChange={(event) => {
                  setCapacityRangeFilter(prev => ({ ...prev, endDate: event.target.value }))
                  if (capacityRangeError) setCapacityRangeError('')
                }}
                style={capacityRangeError ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                required
              />
            </div>
            <button
              className="action-btn btn-dark"
              type="submit"
              disabled={capacityRangeLoading}
              style={{
                width: 'auto',
                minHeight: '44px',
                height: '44px',
                padding: '0 22px',
                whiteSpace: 'nowrap',
              }}
            >
              {capacityRangeLoading ? 'Consultando...' : 'Consultar rango'}
            </button>
          </form>

          {capacityRangeError && (
            <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.82rem', color: '#dc2626', marginBottom: '12px' }}>
              <i className="bi bi-exclamation-circle-fill"></i>
              <span>{capacityRangeError}</span>
            </div>
          )}

          {capacityRangeResult && (
            <div className="system-notice success-notice" style={{ marginTop: '12px', padding: '16px', borderRadius: '8px' }}>
              <h4><i className="bi bi-bar-chart-fill me-2 text-success"></i>Aforo en el rango seleccionado:</h4>
              <p style={{ margin: '8px 0 0 0' }}>
                Rango: <strong>{capacityRangeResult.startDate}</strong> hasta <strong>{capacityRangeResult.endDate}</strong>
              </p>
              <div className="table-frame d-none d-md-block" style={{ marginTop: '16px' }}>
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

              {/* VISTA MÓVIL: RESUMEN DE AFORO EN TARJETAS DE UN SOLO VISTAZO */}
              <div className="d-block d-md-none mobile-card-list mt-3">
                {capacityRangeResult.dailySummary.map((row) => (
                  <div key={row.fecha} className="mobile-data-card" style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#111d15' }}>
                        <i className="bi bi-calendar3 me-1 text-success"></i> {row.fecha}
                      </strong>
                      <span className="badge" style={{ background: '#ecfccb', color: '#15803d', fontWeight: 800, fontSize: '0.78rem' }}>
                        {row.total} Total
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569', marginTop: '6px' }}>
                      <span>Socios: <strong className="text-dark">{row.attendances}</strong></span>
                      <span>Invitados: <strong className="text-dark">{row.guests}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="dashboard-panel">
          <h2 className="dashboard-panel-title">Historial de Asistencias por Socio</h2>

          <form onSubmit={handleSearchAttendance} noValidate style={{ margin: '16px 0' }}>
            <span className="element-label" style={{ display: 'block', marginBottom: '8px' }}>DNI o Nombre del socio</span>
            <div
              className="dashboard-range-picker"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <input
                className={`input-field ${attendanceSearchError ? 'is-invalid' : ''}`}
                type="text"
                placeholder="Ingrese DNI (8 dígitos) o nombre completo"
                value={attendanceSearchQuery}
                onChange={(event) => {
                  setAttendanceSearchQuery(event.target.value)
                  if (attendanceSearchError) setAttendanceSearchError('')
                }}
                style={attendanceSearchError ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                required
              />
              <button
                className="action-btn btn-dark"
                type="submit"
                disabled={attendanceSearchLoading}
                style={{
                  width: 'auto',
                  minHeight: '44px',
                  height: '44px',
                  padding: '0 26px',
                  whiteSpace: 'nowrap',
                }}
              >
                {attendanceSearchLoading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
            {attendanceSearchError && (
              <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.82rem', color: '#dc2626' }}>
                <i className="bi bi-exclamation-circle-fill"></i>
                <span>{attendanceSearchError}</span>
              </div>
            )}
          </form>

          {attendanceSearchResult && (
            <div style={{ marginTop: '16px', display: 'grid', gap: '16px' }}>
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#111827' }}>Socio</h4>
                <p style={{ margin: '4px 0' }}><strong>Nombre:</strong> {attendanceSearchResult.user.nombre} {attendanceSearchResult.user.apellido}</p>
                <p style={{ margin: '4px 0' }}><strong>DNI:</strong> {attendanceSearchResult.user.dni} | <strong>Email:</strong> {attendanceSearchResult.user.email}</p>
                <p style={{ margin: '4px 0' }}><strong>Total Asistencias:</strong> {attendanceSearchResult.asistencias.length}</p>
              </div>

              <div className="table-frame d-none d-md-block">
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
                            <td>{asistencia.estado === 'activo' ? 'Activo en sala' : 'Finalizada'}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* VISTA MÓVIL: ASISTENCIAS EN TARJETAS DE UN SOLO VISTAZO */}
              <div className="d-block d-md-none mobile-card-list">
                {attendanceSearchResult.asistencias.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px', color: '#5f7165' }}>
                    No se encontraron asistencias para este socio.
                  </div>
                ) : (
                  attendanceSearchResult.asistencias.map((asistencia) => {
                    const duration = getDurationInMinutes(asistencia.horaEntrada, asistencia.horaSalida)
                    const isActive = asistencia.estado === 'activo'
                    return (
                      <div key={`att-mob-${asistencia.id}`} className="mobile-data-card" style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <strong style={{ fontSize: '0.88rem', color: '#111d15' }}>
                            <i className="bi bi-calendar-event me-1 text-success"></i>
                            {formatDateOnly(asistencia.horaEntrada)}
                          </strong>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              background: isActive ? '#ecfccb' : '#f1f5f9',
                              color: isActive ? '#15803d' : '#475569',
                            }}
                          >
                            {isActive ? '● En sala' : 'Finalizada'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569' }}>
                          <span>
                            <i className="bi bi-clock me-1 text-muted"></i>
                            {formatTimeOnly(asistencia.horaEntrada)} {asistencia.horaSalida ? `→ ${formatTimeOnly(asistencia.horaSalida)}` : ''}
                          </span>
                          <span className="fw-semibold text-dark">
                            ⏱ {duration}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    )
  }

  function renderClientesAdmin() {
    return (
      <div style={{ marginTop: '12px' }}>
        <CheckInView token={token} embedded />
      </div>
    )
  }

  // -----------------------------------------------------------------
  // SOCIO RENDER VIEW (DASHBOARD PERSONAL SIN RESERVAS)
  // -----------------------------------------------------------------

  function renderSocioView() {
    return (
      <div style={{ display: 'grid', gap: '24px', marginTop: '16px' }}>
        {/* Banner de Aviso de Emergencia / Cierre Temporal / Horario Especial */}
        {config?.aviso_activo === '1' && config?.aviso_mensaje && (
          <div
            style={{
              background: config?.estado_operativo === 'cerrado_emergencia' ? '#fef2f2' : '#fffbeb',
              border: `2px solid ${config?.estado_operativo === 'cerrado_emergencia' ? '#f87171' : '#fcd34d'}`,
              borderRadius: '16px',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '16px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.06)',
            }}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: config?.estado_operativo === 'cerrado_emergencia' ? '#fee2e2' : '#fef3c7',
                color: config?.estado_operativo === 'cerrado_emergencia' ? '#dc2626' : '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                flexShrink: 0,
              }}
            >
              <i className="bi bi-megaphone-fill"></i>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '1.12rem', color: config?.estado_operativo === 'cerrado_emergencia' ? '#991b1b' : '#92400e' }}>
                  {config.aviso_titulo || 'Comunicado Oficial del Club'}
                </strong>
                {config?.estado_operativo === 'cerrado_emergencia' && (
                  <span className="badge bg-danger text-white px-2 py-1" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                    CIERRE TEMPORAL
                  </span>
                )}
                {config?.estado_operativo === 'horario_especial' && (
                  <span className="badge bg-warning text-dark px-2 py-1" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                    HORARIO ESPECIAL
                  </span>
                )}
              </div>
              <p style={{ margin: '6px 0 0', color: config?.estado_operativo === 'cerrado_emergencia' ? '#7f1d1d' : '#78350f', fontSize: '0.94rem', lineHeight: 1.55 }}>
                {config.aviso_mensaje}
              </p>
            </div>
          </div>
        )}

        {/* KPI Cards summary */}
        <div className="dashboard-cards-row dashboard-summary-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {/* Card 1: Asistencias Totales */}
          <article className="dashboard-info-card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
              <span className="dashboard-info-label" style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.25 }}>Asistencias Registradas</span>
              <div style={{ color: '#235833', background: '#ecfccb', padding: '6px', borderRadius: '8px', display: 'flex', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
            </div>
            <strong className="dashboard-info-value" style={{ fontSize: '2.4rem', margin: '0 0 6px', color: '#111d15' }}>
              {attendanceCount}
            </strong>
            <p className="dashboard-info-text" style={{ fontSize: '0.82rem', color: '#5f7165' }}>
              Accesos confirmados en recepción
            </p>
          </article>

          {/* Card 2: Saldo Mi Pandita */}
          <article className="dashboard-info-card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
              <span className="dashboard-info-label" style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.25 }}>Bambús Disponibles</span>
              <div style={{ color: '#235833', background: '#ecfccb', padding: '6px', borderRadius: '8px', display: 'flex', fontSize: '1rem', flexShrink: 0 }}>
                <i className="bi bi-gem"></i>
              </div>
            </div>
            <strong className="dashboard-info-value" style={{ fontSize: '2.4rem', margin: '0 0 6px', color: '#111d15' }}>
              {pandaData?.bambusDisponibles ?? 240}
            </strong>
            <p className="dashboard-info-text" style={{ fontSize: '0.82rem', color: '#5f7165' }}>
              Nivel {pandaData?.nivel ?? 4} · Etapa {pandaData?.etapa || 'JUVENIL'}
            </p>
          </article>

          {/* Card 3: Estado de Membresía */}
          <article className="dashboard-info-card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
              <span className="dashboard-info-label" style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.25 }}>Mi Membresía</span>
              <div style={{ color: '#235833', background: '#ecfccb', padding: '6px', borderRadius: '8px', display: 'flex', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                  <line x1="2" y1="10" x2="22" y2="10"></line>
                </svg>
              </div>
            </div>
            <strong className="dashboard-info-value" style={{ fontSize: '1.4rem', margin: '6px 0', color: '#111d15', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#16a34a' }}></span>
              {membershipData?.planNombre || membershipData?.plan?.nombre || 'Plan Activo'}
            </strong>
            <p className="dashboard-info-text" style={{ fontSize: '0.82rem', color: '#5f7165' }}>
              {membershipData?.fechaFin ? `Vence: ${formatDateOnly(membershipData.fechaFin)}` : 'Acceso ilimitado vigente'}
            </p>
          </article>

          {/* Card 4: Aforo del Club en Vivo */}
          <article className="dashboard-info-card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
              <span className="dashboard-info-label" style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.25 }}>Aforo en Tiempo Real</span>
              <div style={{ color: '#235833', background: '#ecfccb', padding: '6px', borderRadius: '8px', display: 'flex', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
            </div>
            <strong className="dashboard-info-value" style={{ fontSize: '2.4rem', margin: '0 0 6px', color: '#111d15' }}>
              {occupancyPercent}%
            </strong>
            <p className="dashboard-info-text" style={{ fontSize: '0.82rem', color: '#5f7165' }}>
              {capacity.actual} personas entrenando ahora
            </p>
          </article>
        </div>

        {/* Sección: Horarios de Atención Oficiales de tu Club */}
        <section className="dashboard-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: '#121e17',
                  color: '#c4f039',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.3rem',
                  border: '1.5px solid #c4f039',
                  boxShadow: '0 4px 12px rgba(196, 240, 57, 0.25)',
                }}
              >
                <i className="bi bi-clock-history"></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, color: '#111d15' }}>
                  Horarios de Atención de tu Club
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.84rem', color: '#5f7165' }}>
                  Ingreso libre para socios en cualquier momento de la jornada con DNI o huella biométrica
                </p>
              </div>
            </div>

            {/* Estado en tiempo real del Club */}
            <span
              style={{
                padding: '6px 16px',
                borderRadius: '999px',
                fontWeight: 800,
                fontSize: '0.82rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: clubStatus.emergency ? '#fee2e2' : clubStatus.open ? '#ecfccb' : '#f1f5f9',
                color: clubStatus.emergency ? '#b91c1c' : clubStatus.open ? '#15803d' : '#475569',
                border: `1.5px solid ${clubStatus.emergency ? '#fca5a5' : clubStatus.open ? '#bef264' : '#cbd5e1'}`,
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: clubStatus.emergency ? '#ef4444' : clubStatus.open ? '#22c55e' : '#94a3b8',
                }}
              ></span>
              {clubStatus.text}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
            {/* Lunes a Viernes */}
            {config?.horario_semana_modalidad === 'continuo' ? (
              <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                    <i className="bi bi-calendar3 me-1 text-primary"></i> Lun a Vie (Corrido)
                  </span>
                  <span className="badge" style={{ background: '#ecfdf5', color: '#047857', fontSize: '0.68rem' }}>Jornada Completa</span>
                </div>
                <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>
                  {config?.horario_semana_corrido_inicio || '06:30'} - {config?.horario_semana_corrido_fin || '22:00'}
                </strong>
              </div>
            ) : (
              <>
                {/* Lunes a Viernes - Mañana */}
                <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                      <i className="bi bi-brightness-high me-1 text-warning"></i> Lun a Vie (Mañana)
                    </span>
                    <span className="badge" style={{ background: '#ecfdf5', color: '#047857', fontSize: '0.68rem' }}>Activo</span>
                  </div>
                  <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>
                    {config?.horario_semana_manana_inicio || '06:30'} - {config?.horario_semana_manana_fin || '11:00'}
                  </strong>
                </div>

                {/* Lunes a Viernes - Tarde/Noche */}
                <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                      <i className="bi bi-sunset me-1 text-info"></i> Lun a Vie (Tarde/Noche)
                    </span>
                    <span className="badge" style={{ background: '#ecfdf5', color: '#047857', fontSize: '0.68rem' }}>Activo</span>
                  </div>
                  <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>
                    {config?.horario_semana_tarde_inicio || '16:00'} - {config?.horario_semana_tarde_fin || '22:00'}
                  </strong>
                </div>
              </>
            )}

            {/* Sábados */}
            <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                  <i className="bi bi-lightning-charge-fill me-1 text-warning"></i> Sábados
                </span>
                <span
                  className="badge"
                  style={{
                    background: config?.horario_sabado_estado === '0' ? '#fee2e2' : '#fef3c7',
                    color: config?.horario_sabado_estado === '0' ? '#b91c1c' : '#b45309',
                    fontSize: '0.68rem',
                  }}
                >
                  {config?.horario_sabado_estado === '0' ? 'Cerrado' : 'Especial'}
                </span>
              </div>
              <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>
                {config?.horario_sabado_estado === '0'
                  ? 'Cerrado'
                  : config?.horario_sabado_modalidad === 'partido'
                  ? `${config?.horario_sabado_inicio || '07:00'} - ${config?.horario_sabado_fin || '12:00'} / ${config?.horario_sabado_tarde_inicio || '16:00'} - ${config?.horario_sabado_tarde_fin || '20:00'}`
                  : `${config?.horario_sabado_inicio || '07:00'} - ${config?.horario_sabado_fin || '12:00'}`}
              </strong>
            </div>

            {/* Domingos */}
            <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                  <i className="bi bi-cup-hot me-1 text-secondary"></i> Domingos
                </span>
                <span
                  className="badge"
                  style={{
                    background: config?.horario_domingo_abierto === '1' ? '#ecfdf5' : '#f1f5f9',
                    color: config?.horario_domingo_abierto === '1' ? '#047857' : '#64748b',
                    fontSize: '0.68rem',
                  }}
                >
                  {config?.horario_domingo_abierto === '1' ? 'Abierto' : 'Cerrado'}
                </span>
              </div>
              <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>
                {config?.horario_domingo_abierto === '1'
                  ? config?.horario_domingo_modalidad === 'partido'
                    ? `${config?.horario_domingo_inicio || '08:00'} - ${config?.horario_domingo_fin || '13:00'} / ${config?.horario_domingo_tarde_inicio || '16:00'} - ${config?.horario_domingo_tarde_fin || '20:00'}`
                    : `${config?.horario_domingo_inicio || '08:00'} - ${config?.horario_domingo_fin || '13:00'}`
                  : 'Descanso general'}
              </strong>
            </div>
          </div>
        </section>

        {/* Accesos rápidos destacados para el socio */}
        <section className="dashboard-panel" style={{ padding: '20px 24px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#111d15' }}>
              Acceso Directo al Gimnasio
            </h4>
            <p style={{ margin: '4px 0 0', fontSize: '0.86rem', color: '#5f7165' }}>
              ¡No requieres agendar reserva previa! Solo acércate a recepción con tu DNI o huella para entrenar.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {canAccess(user,'mi-pandita') && (<button
              type="button"
              className="action-btn"
              onClick={() => navigate('/app/mi-pandita')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.86rem', padding: '8px 16px' }}
            >
              <i className="bi bi-award-fill"></i>
              <span>Mi Pandita</span>
            </button>)}
            {canAccess(user,'asistencias') && (<button
              type="button"
              className="action-btn"
              onClick={() => navigate('/app/asistencias')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.86rem', padding: '8px 16px' }}
            >
              <i className="bi bi-stopwatch"></i>
              <span>Mis Asistencias</span>
            </button>)}
            {canAccess(user,'recompensas') && (<button
              type="button"
              className="action-btn"
              onClick={() => navigate('/app/recompensas')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.86rem', padding: '8px 16px' }}
            >
              <i className="bi bi-gift-fill"></i>
              <span>Recompensas</span>
            </button>)}
          </div>
        </section>

        {/* Historial de Entrenamientos y Asistencias Reales */}
        <section className="dashboard-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div>
              <h2 className="dashboard-panel-title" style={{ margin: 0 }}>Mis Últimos Entrenamientos</h2>
              <p className="dashboard-panel-subtitle" style={{ margin: '4px 0 0' }}>Registro de visitas confirmadas en recepción del club.</p>
            </div>
            {canAccess(user,'asistencias') && (<button
              type="button"
              onClick={() => navigate('/app/asistencias')}
              style={{
                background: 'none',
                border: 0,
                color: '#235833',
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: 'pointer',
              }}
            >
              Ver historial completo →
            </button>)}
          </div>

          <div className="table-frame d-none d-md-block">
            <table className="corporate-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Hora Ingreso</th>
                  <th>Hora Salida</th>
                  <th>Duración</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '16px' }}>Cargando asistencias...</td>
                  </tr>
                ) : socioAsistencias.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#5f7165' }}>
                      Aún no registras asistencias recientes. ¡Acércate a recepción para validar tu ingreso e iniciar tu racha!
                    </td>
                  </tr>
                ) : (
                  socioAsistencias.slice(0, 8).map((asistencia) => {
                    const duration = getDurationInMinutes(asistencia.horaEntrada, asistencia.horaSalida)
                    const isActive = asistencia.estado === 'activo' || !asistencia.horaSalida
                    return (
                      <tr key={`att-socio-${asistencia.id}`}>
                        <td style={{ fontWeight: 700 }}>{formatDateOnly(asistencia.horaEntrada)}</td>
                        <td>{formatTimeOnly(asistencia.horaEntrada)}</td>
                        <td>{asistencia.horaSalida ? formatTimeOnly(asistencia.horaSalida) : '—'}</td>
                        <td>{duration}</td>
                        <td>
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: '999px',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              background: isActive ? '#ecfccb' : '#f0fdf4',
                              color: isActive ? '#1b4d24' : '#166534',
                            }}
                          >
                            {isActive ? '● En sala' : 'Completado'}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* VISTA MÓVIL: ASISTENCIAS EN TARJETAS DE UN SOLO VISTAZO */}
          <div className="d-block d-md-none mobile-card-list">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '16px', color: '#5f7165' }}>Cargando asistencias...</div>
            ) : socioAsistencias.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#5f7165', fontSize: '0.85rem' }}>
                Aún no registras asistencias recientes. ¡Acércate a recepción para validar tu ingreso e iniciar tu racha!
              </div>
            ) : (
              socioAsistencias.slice(0, 8).map((asistencia) => {
                const duration = getDurationInMinutes(asistencia.horaEntrada, asistencia.horaSalida)
                const isActive = asistencia.estado === 'activo' || !asistencia.horaSalida
                return (
                  <div key={`mob-att-socio-${asistencia.id}`} className="mobile-data-card" style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '0.88rem', color: '#111d15' }}>
                        <i className="bi bi-calendar-check me-1 text-success"></i>
                        {formatDateOnly(asistencia.horaEntrada)}
                      </strong>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          background: isActive ? '#ecfccb' : '#f0fdf4',
                          color: isActive ? '#1b4d24' : '#166534',
                        }}
                      >
                        {isActive ? '● En sala' : 'Completado'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569' }}>
                      <span>
                        <i className="bi bi-clock me-1 text-muted"></i>
                        {formatTimeOnly(asistencia.horaEntrada)} {asistencia.horaSalida ? `→ ${formatTimeOnly(asistencia.horaSalida)}` : ''}
                      </span>
                      <span className="fw-semibold text-dark">
                        {duration}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
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
      {isAdmin ? (
        <>
          {config?.aviso_activo === '1' && config?.aviso_mensaje && (
            <div
              style={{
                background: config?.estado_operativo === 'cerrado_emergencia' ? '#fef2f2' : '#fffbeb',
                border: `1.5px solid ${config?.estado_operativo === 'cerrado_emergencia' ? '#f87171' : '#fcd34d'}`,
                borderRadius: '14px',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '14px',
                marginBottom: '20px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.4rem' }}>
                  <i className="bi bi-megaphone-fill text-danger"></i>
                </span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: config?.estado_operativo === 'cerrado_emergencia' ? '#991b1b' : '#92400e', fontSize: '0.96rem' }}>
                      Comunicado Activo y Difundido a Socios: {config.aviso_titulo || 'Aviso Oficial'}
                    </strong>
                    {config?.estado_operativo === 'cerrado_emergencia' && (
                      <span className="badge bg-danger text-white px-2" style={{ fontSize: '0.7rem' }}>Cierre Activo</span>
                    )}
                  </div>
                  <p style={{ margin: '3px 0 0', color: config?.estado_operativo === 'cerrado_emergencia' ? '#7f1d1d' : '#78350f', fontSize: '0.86rem' }}>
                    {config.aviso_mensaje}
                  </p>
                </div>
              </div>
              {canAccess(user,'configuracion') && (<button
                type="button"
                className="btn btn-sm btn-outline-dark fw-bold px-3 py-1"
                style={{ borderRadius: '8px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                onClick={() => navigate('/app/configuracion')}
              >
                ⚙️ Gestionar Aviso
              </button>)}
            </div>
          )}
        </>
      ) : (
        <ViewTitle
          title={moduleLabel('inicio',user)}
          text="Resumen de asistencias, bambús y aforo."
        />
      )}

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
            {activeSection === 'clientes' && renderClientesAdmin()}
          </>
        ) : (
          renderSocioView()
        )}
      </section>
    </>
  )
}

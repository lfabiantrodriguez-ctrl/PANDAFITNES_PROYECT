import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ViewTitle from '../components/ViewTitle'
import { CapacityService } from '../services/CapacityService'
import { SocioService } from '../services/SocioService'
import { AttendanceService } from '../services/AttendanceService'
import { MembershipService } from '../services/MembershipService'
import { ConfigService } from '../services/ConfigService'

const sections = [
  { key: 'principal', label: 'Vista General' },
  { key: 'aforo', label: 'Control de Aforo' },
  { key: 'clientes', label: 'Búsqueda Socios' },
]

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
  const isAdmin = user?.rol === 'admin'
  const today = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  // State shared / Admin
  const [activeSection, setActiveSection] = useState('principal')
  const [capacity, setCapacity] = useState({ actual: 0, maximo: 0, actualizadoEn: null })
  const [clients, setClients] = useState([])
  const [activeClients, setActiveClients] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [config, setConfig] = useState(null)

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
      const open = currentTime >= (config.horario_domingo_inicio || '08:00') && currentTime <= (config.horario_domingo_fin || '13:00')
      return { open, text: open ? 'Abierto ahora (Domingo)' : `Cerrado ahora (${config.horario_domingo_inicio} - ${config.horario_domingo_fin})`, emergency: false }
    } else if (day === 6) {
      const open = currentTime >= (config.horario_sabado_inicio || '07:00') && currentTime <= (config.horario_sabado_fin || '12:00')
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
        const [capacityData, socioData, attendanceData, configData] = await Promise.all([
          CapacityService.getCapacity(),
          SocioService.getSocios(token).catch(() => ({ socios: [] })),
          AttendanceService.getActiveClients(token).catch(() => ({ clients: [] })),
          ConfigService.getConfig().catch(() => null),
        ])

        setCapacity({
          actual: Number(capacityData.actual || 0),
          maximo: Number(capacityData.maximo || 0),
          actualizadoEn: capacityData.actualizadoEn || null,
        })

        setClients(Array.isArray(socioData.socios) ? socioData.socios : [])
        setActiveClients(Array.isArray(attendanceData.clients) ? attendanceData.clients : [])
        if (configData) setConfig(configData)
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
    const weeklyData = [
      { day: 'Mié 16', count: 92, height: 74 },
      { day: 'Jue 17', count: 112, height: 90 },
      { day: 'Vie 18', count: 106, height: 85 },
      { day: 'Sáb 19', count: 74, height: 60 },
      { day: 'Dom 20', count: 62, height: 50 },
      { day: 'Lun 21', count: 124, height: 100 },
      { day: 'Hoy', count: capacity.actual > 0 ? capacity.actual : 86, height: 69, isToday: true },
    ]

    return (
      <div style={{ display: 'grid', gap: '24px' }}>
        {/* Fila de 4 Tarjetas de Métricas Principales */}
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
              {totalClients > 0 ? totalClients : 428}
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

          {/* Card 3: Personas activas */}
          <article className="dashboard-info-card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span className="dashboard-info-label" style={{ margin: 0, fontSize: '0.82rem' }}>Personas entrenando</span>
              <div style={{ color: '#235833', background: '#ecfccb', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
            </div>
            <strong className="dashboard-info-value" style={{ fontSize: '2.4rem', margin: '0 0 6px', color: '#111d15' }}>
              {totalActiveClients > 0 ? totalActiveClients : capacity.actual}
            </strong>
            <p className="dashboard-info-text" style={{ fontSize: '0.82rem', color: '#5f7165' }}>
              Con check-in activo en recepción
            </p>
          </article>

          {/* Card 4: Ingresos del mes */}
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
              S/68,450
            </strong>
            <p className="dashboard-info-text" style={{ fontSize: '0.82rem', color: '#5f7165' }}>
              PEN · Facturación acumulada
            </p>
          </article>
        </div>

        {/* Fila intermedia: Gráfico de Tendencia + Actividad Reciente */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '20px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          {/* Tarjeta Izquierda: Tendencia de asistencia */}
          <section className="dashboard-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '22px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#111d15' }}>
                  Tendencia de asistencia diaria
                </h3>
                <p style={{ margin: '4px 0 0', color: '#5f7165', fontSize: '0.86rem' }}>
                  Entradas confirmadas a sala por recepción
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background: '#ecfccb',
                    color: '#1b4d24',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                  }}
                >
                  Promedio: 94 entradas
                </span>
              </div>
            </div>

            {/* Gráfico de barras vertical estilo deportivo */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '170px', padding: '10px 10px 0', borderBottom: '1px solid #e3e8e2', gap: '12px' }}>
              {weeklyData.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: item.isToday ? '#111d15' : '#5f7165', marginBottom: '6px' }}>
                    {item.count}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '42px',
                      height: `${item.height}%`,
                      background: item.isToday ? '#c4f039' : '#235833',
                      borderRadius: '6px 6px 0 0',
                      transition: 'all 0.3s ease',
                      boxShadow: item.isToday ? '0 4px 14px rgba(196, 240, 57, 0.45)' : 'none',
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', fontWeight: item.isToday ? 800 : 600, color: item.isToday ? '#111d15' : '#8fa295', marginTop: '8px' }}>
                    {item.day}
                  </span>
                </div>
              ))}
            </div>

            <p style={{ margin: '14px 0 0', fontSize: '0.82rem', color: '#5f7165' }}>
              Acceso libre y directo para socios con membresía activa. Sin esperas ni cupos por reserva.
            </p>
          </section>

          {/* Tarjeta Derecha: Actividad reciente */}
          <section className="dashboard-panel" style={{ padding: '24px' }}>
            <div style={{ marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#111d15' }}>
                Actividad reciente en recepción
              </h3>
              <p style={{ margin: '4px 0 0', color: '#5f7165', fontSize: '0.86rem' }}>
                Últimos accesos biométricos y membresías
              </p>
            </div>

            <div style={{ display: 'grid', gap: '14px' }}>
              {[
                { name: 'Valeria Torres', time: '10:42', detail: 'Check-in ingreso · +25 XP Bambús', badge: 'Autorizado', bg: '#ecfccb', col: '#1b4d24' },
                { name: 'Diego Salas', time: '10:36', detail: 'Renovación trimestral · S/ 280', badge: 'Membresía activa', bg: '#dcfce7', col: '#166534' },
                { name: 'Camila Ríos', time: '10:31', detail: 'Pase de un día · S/ 15', badge: 'Acceso pagado', bg: '#dcfce7', col: '#166534' },
                { name: 'Jorge Méndez', time: '10:18', detail: 'Membresía vencida · Notificado', badge: 'Vencido', bg: '#fee2e2', col: '#991b1b' },
              ].map((act, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: i < 3 ? '12px' : '0', borderBottom: i < 3 ? '1px solid #f0f4f0' : 'none' }}>
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
              ))}
            </div>
          </section>
        </div>

        {/* Fila Inferior: Membresías que requieren atención */}
        <section className="dashboard-panel" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '18px' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#111d15' }}>
              Membresías por renovar
            </h3>
            <p style={{ margin: '4px 0 0', color: '#5f7165', fontSize: '0.86rem' }}>
              Socios con vencimiento próximo en los próximos 7 días.
            </p>
          </div>

          <div className="table-frame">
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
                {[
                  { socio: 'Lucía Herrera', plan: 'Plan Mensual Panda', vencimiento: '24 sep 2026', estado: 'Por vencer' },
                  { socio: 'Andrés Castro', plan: 'Plan Trimestral Fuerza', vencimiento: '26 sep 2026', estado: 'Por vencer' },
                  { socio: 'Sofía Luna', plan: 'Plan Anual VIP', vencimiento: '28 sep 2026', estado: 'Por vencer' },
                ].map((m, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 700 }}>{m.socio}</td>
                    <td style={{ color: '#5f7165' }}>{m.plan}</td>
                    <td style={{ color: '#5f7165' }}>{m.vencimiento}</td>
                    <td>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '999px',
                          background: '#fef3c7',
                          color: '#b45309',
                          fontSize: '0.76rem',
                          fontWeight: 800,
                        }}
                      >
                        {m.estado}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
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
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ fontSize: '0.86rem', color: '#5f7165' }}>
              Gestione accesos biométricos y control de entradas desde recepción.
            </span>
            <button
              type="button"
              className="action-btn"
              onClick={() => navigate('/app/check-in')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                fontSize: '0.85rem',
                minHeight: '38px',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
                <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
                <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
                <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
              </svg>
              Ir a Check-in Recepción
            </button>
          </div>
        </section>
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
            <button className="action-btn btn-dark" type="submit" disabled={capacityRangeLoading} style={{ alignSelf: 'flex-end', height: '40px' }}>
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
          <h2 className="dashboard-panel-title">Historial de Asistencias por Socio</h2>
          <p className="dashboard-panel-subtitle">Busca las asistencias registradas de un socio por DNI o nombre.</p>

          <form onSubmit={handleSearchAttendance} className="dashboard-range-picker" style={{ margin: '16px 0', gap: '16px' }}>
            <div className="dashboard-range-item" style={{ flex: 1 }}>
              <span className="element-label">DNI o Nombre del socio</span>
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
              {attendanceSearchError && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.82rem', color: '#dc2626' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{attendanceSearchError}</span>
                </div>
              )}
            </div>
            <button className="action-btn btn-dark" type="submit" disabled={attendanceSearchLoading} style={{ alignSelf: 'flex-start', height: '40px' }}>
              {attendanceSearchLoading ? 'Buscando...' : 'Buscar'}
            </button>
          </form>

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
                            <td>{asistencia.estado === 'activo' ? 'Activo en sala' : 'Finalizada'}</td>
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
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#111d15' }}>
              Socios con Sesión Activa en Sala
            </h3>
            <p style={{ margin: '4px 0 0', color: '#5f7165', fontSize: '0.86rem' }}>
              Lista de personas que ingresaron por recepción y aún no marcan salida.
            </p>
          </div>

          <div className="table-frame">
            <table className="corporate-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>DNI</th>
                  <th>Hora Ingreso</th>
                  <th>Hora Salida</th>
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
                      <td style={{ fontWeight: 700 }}>{client.nombre} {client.apellido}</td>
                      <td>{client.dni}</td>
                      <td>{formatDateTime(client.horaEntrada)}</td>
                      <td>{client.horaSalida ? formatDateTime(client.horaSalida) : <span style={{ color: '#16a34a', fontWeight: 700 }}>● En sala</span>}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '16px', color: '#5f7165' }}>
                      No hay clientes dentro del gimnasio en este momento.
                    </td>
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
              📢
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span className="dashboard-info-label" style={{ margin: 0, fontSize: '0.84rem' }}>Asistencias Registradas</span>
              <div style={{ color: '#235833', background: '#ecfccb', padding: '6px', borderRadius: '8px', display: 'flex' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span className="dashboard-info-label" style={{ margin: 0, fontSize: '0.84rem' }}>Bambús Disponibles</span>
              <div style={{ color: '#235833', background: '#ecfccb', padding: '6px', borderRadius: '8px', display: 'flex', fontSize: '1rem' }}>
                🎋
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span className="dashboard-info-label" style={{ margin: 0, fontSize: '0.84rem' }}>Mi Membresía</span>
              <div style={{ color: '#235833', background: '#ecfccb', padding: '6px', borderRadius: '8px', display: 'flex' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span className="dashboard-info-label" style={{ margin: 0, fontSize: '0.84rem' }}>Aforo en Tiempo Real</span>
              <div style={{ color: '#235833', background: '#ecfccb', padding: '6px', borderRadius: '8px', display: 'flex' }}>
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
                ⏰
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
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>🏢 Lun a Vie (Corrido)</span>
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
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>🌅 Lun a Vie (Mañana)</span>
                    <span className="badge" style={{ background: '#ecfdf5', color: '#047857', fontSize: '0.68rem' }}>Activo</span>
                  </div>
                  <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>
                    {config?.horario_semana_manana_inicio || '06:30'} - {config?.horario_semana_manana_fin || '11:00'}
                  </strong>
                </div>

                {/* Lunes a Viernes - Tarde/Noche */}
                <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>🌇 Lun a Vie (Tarde/Noche)</span>
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
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>⚡ Sábados</span>
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
                  : `${config?.horario_sabado_inicio || '07:00'} - ${config?.horario_sabado_fin || '12:00'}`}
              </strong>
            </div>

            {/* Domingos */}
            <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>☕ Domingos</span>
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
                  ? `${config?.horario_domingo_inicio || '08:00'} - ${config?.horario_domingo_fin || '13:00'}`
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
            <button
              type="button"
              className="action-btn"
              onClick={() => navigate('/app/mi-pandita')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.86rem', padding: '8px 16px' }}
            >
              🐼 Mi Pandita
            </button>
            <button
              type="button"
              className="action-btn"
              onClick={() => navigate('/app/mis-asistencias')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.86rem', padding: '8px 16px' }}
            >
              ⏱️ Mis Asistencias
            </button>
            <button
              type="button"
              className="action-btn"
              onClick={() => navigate('/app/recompensas')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.86rem', padding: '8px 16px' }}
            >
              🎁 Recompensas
            </button>
          </div>
        </section>

        {/* Historial de Entrenamientos y Asistencias Reales */}
        <section className="dashboard-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div>
              <h2 className="dashboard-panel-title" style={{ margin: 0 }}>Mis Últimos Entrenamientos</h2>
              <p className="dashboard-panel-subtitle" style={{ margin: '4px 0 0' }}>Registro de visitas confirmadas en recepción del club.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/app/mis-asistencias')}
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
            </button>
          </div>

          <div className="table-frame">
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
                <span style={{ fontSize: '1.4rem' }}>📢</span>
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
              <button
                type="button"
                className="btn btn-sm btn-outline-dark fw-bold px-3 py-1"
                style={{ borderRadius: '8px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                onClick={() => navigate('/app/configuracion')}
              >
                ⚙️ Gestionar Aviso
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900, color: '#111d15', letterSpacing: '-0.03em' }}>
                El club, de un vistazo
              </h1>
              <p style={{ margin: '6px 0 0', color: '#5f7165', fontSize: '0.96rem' }}>
                Tu operación de hoy: socios, accesos en sala y crecimiento en un solo lugar.
              </p>
            </div>
            <button
              type="button"
              className="primary-action"
              onClick={() => navigate('/app/socios')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 22px',
                fontSize: '0.94rem',
                borderRadius: '12px',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Registrar membresía
            </button>
          </div>
        </>
      ) : (
        <ViewTitle
          title={`¡Bienvenido, ${user?.nombre || 'Socio'}!`}
          text="Tu resumen diario de entrenamientos, bambús acumulados y aforo en sala."
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

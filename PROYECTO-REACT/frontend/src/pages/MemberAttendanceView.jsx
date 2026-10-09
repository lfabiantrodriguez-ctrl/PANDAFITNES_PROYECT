import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AttendanceService } from '../services/AttendanceService'
import { MembershipService } from '../services/MembershipService'
import ModalDialog from '../components/ModalDialog'
import '../styles/MemberAttendance.css'

const DAYS_NAMES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
const MONTH_NAMES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
]

export default function MemberAttendanceView({ token, user }) {
  const navigate = useNavigate()
  // Fecha actual de referencia (por defecto Septiembre 2026 de la maqueta demo o fecha real navegada)
  const [currentDate, setCurrentDate] = useState(new Date(2026, 8, 22))
  const [loading, setLoading] = useState(true)
  const [attendanceData, setAttendanceData] = useState([])
  const [userGoals, setUserGoals] = useState({
    diasObjetivo: [1, 2, 4, 5], // Lunes (1), Martes (2), Jueves (4), Viernes (5)
    horarioPreferido: 'Acceso Libre',
  })

  // Membresía del socio para validar días bloqueados fuera de matrícula
  const [membership, setMembership] = useState({
    fechaInicio: '2026-09-01',
    fechaFin: '2026-09-30',
    estado: 'activa',
    planNombre: 'Plan Full Mensual',
  })

  // Recompensas Generales por Asistencia Habitual (XP & Bambús)
  const [generalRewards, setGeneralRewards] = useState(() => {
    try {
      const saved = localStorage.getItem('panda_general_attendance_rewards')
      if (saved) return JSON.parse(saved)
    } catch {}
    return {
      baseXp: 50,
      baseBambus: 15,
    }
  })
  const [tempGeneralXp, setTempGeneralXp] = useState(50)
  const [tempGeneralBambus, setTempGeneralBambus] = useState(15)
  const [generalFeedback, setGeneralFeedback] = useState('')
  const [generalErrors, setGeneralErrors] = useState({})

  // Pestaña activa del modal de configuración: 'general' | 'eventos'
  const [bonusAdminTab, setBonusAdminTab] = useState('general')

  // Mapa de Bonos XP y Bambús asignables por el Administrador para eventos especiales
  const [xpBonuses, setXpBonuses] = useState(() => {
    try {
      const saved = localStorage.getItem('panda_calendar_xp_bonuses')
      if (saved) return JSON.parse(saved)
    } catch {}
    return {
      '2026-09-25': { xp: 50, bambus: 20, label: 'Viernes Pierna x2 XP' },
      '2026-09-30': { xp: 100, bambus: 30, label: 'Cierre de Mes +100 XP' },
    }
  })

  // Modal para días bloqueados fuera de matrícula
  const [showRenewModal, setShowRenewModal] = useState(false)
  const [lockedDayInfo, setLockedDayInfo] = useState(null)

  // Modal para administración de Recompensas y Bonos XP
  const [showBonusAdminModal, setShowBonusAdminModal] = useState(false)
  const [newBonusDate, setNewBonusDate] = useState('2026-09-26')
  const [newBonusXp, setNewBonusXp] = useState(100)
  const [newBonusBambus, setNewBonusBambus] = useState(25)
  const [newBonusLabel, setNewBonusLabel] = useState('Reto Fin de Semana x2 XP')
  const [bonusFeedback, setBonusFeedback] = useState('')
  const [bonusErrors, setBonusErrors] = useState({})

  // Sincronizar inputs temporales cuando cambian los valores generales
  useEffect(() => {
    setTempGeneralXp(generalRewards.baseXp)
    setTempGeneralBambus(generalRewards.baseBambus)
  }, [generalRewards])

  // Modal para cambiar objetivos semanales (únicamente selección de días, sin selector de horario)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [tempGoals, setTempGoals] = useState([1, 2, 4, 5])
  const [savingGoal, setSavingGoal] = useState(false)
  const [goalFeedback, setGoalFeedback] = useState('')

  // Modal para detalles de un día seleccionado
  const [selectedDayDetail, setSelectedDayDetail] = useState(null)

  // Carga inicial de datos de asistencia vinculados a recepción y huella digital
  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const res = await AttendanceService.getMyAttendanceHistory(token)
      if (res) {
        setAttendanceData(Array.isArray(res.asistencias) ? res.asistencias : [])
        if (res.goals) {
          const loadedDays = Array.isArray(res.goals.diasObjetivo) ? res.goals.diasObjetivo : [1, 2, 4, 5]
          setUserGoals({
            diasObjetivo: loadedDays,
            horarioPreferido: 'Acceso Libre',
          })
          setTempGoals(loadedDays)
        }
      }
    } catch {
      // Si ocurre error de red, mantener configuración local para demo interactiva
    }

    try {
      const memRes = await MembershipService.getMyMembership(token)
      if (memRes && memRes.membership) {
        setMembership(memRes.membership)
      }
    } catch {
      // Membresía demo por defecto que cubre hasta el 30 de Septiembre 2026
      setMembership({
        fechaInicio: '2026-09-01',
        fechaFin: '2026-09-30',
        estado: 'activa',
        planNombre: 'Plan Full Mensual',
      })
    } finally {
      setLoading(false)
    }
  }

  // Guardar configuración general de asistencia (XP & Bambús por día normal)
  function handleSaveGeneralRewards(e) {
    e.preventDefault()
    const errors = {}
    const xpVal = Number(tempGeneralXp)
    const bambusVal = Number(tempGeneralBambus)

    if (isNaN(xpVal) || xpVal <= 0) {
      errors.xp = 'Ingrese un valor de XP numérico mayor a 0 (ej: 50)'
    }
    if (isNaN(bambusVal) || bambusVal < 0) {
      errors.bambus = 'Ingrese un valor de Bambús mayor o igual a 0 (ej: 15)'
    }

    if (Object.keys(errors).length > 0) {
      setGeneralErrors(errors)
      return
    }

    const updated = {
      baseXp: Math.round(xpVal),
      baseBambus: Math.round(bambusVal),
    }
    setGeneralRewards(updated)
    localStorage.setItem('panda_general_attendance_rewards', JSON.stringify(updated))
    setGeneralErrors({})
    setGeneralFeedback(`¡Guardado con éxito! Cada asistencia general otorgará +${updated.baseXp} XP y +${updated.baseBambus} Bambús.`)
    setTimeout(() => setGeneralFeedback(''), 4000)
  }

  // Guardar un nuevo bono de XP y Bambús por Evento / Fecha especial
  function handleSaveBonus(e) {
    e.preventDefault()
    const errors = {}
    if (!newBonusDate) errors.date = 'Selecciona una fecha para el evento'

    const xpNum = Number(newBonusXp)
    if (isNaN(xpNum) || xpNum <= 0) {
      errors.xp = 'Ingresa un puntaje de XP válido mayor a 0 (ej: 100)'
    }

    const bambusNum = Number(newBonusBambus)
    if (isNaN(bambusNum) || bambusNum < 0) {
      errors.bambus = 'Ingresa 0 o más bambús extra para el evento'
    }

    if (!newBonusLabel?.trim()) {
      errors.label = 'Ingresa el motivo o nombre del evento'
    }

    if (Object.keys(errors).length > 0) {
      setBonusErrors(errors)
      return
    }

    setBonusErrors({})
    const updated = {
      ...xpBonuses,
      [newBonusDate]: {
        xp: Math.round(xpNum),
        bambus: Math.round(bambusNum || 0),
        label: newBonusLabel.trim(),
      },
    }
    setXpBonuses(updated)
    localStorage.setItem('panda_calendar_xp_bonuses', JSON.stringify(updated))
    setBonusFeedback(`¡Bono (+${Math.round(xpNum)} XP${bambusNum > 0 ? ` · +${Math.round(bambusNum)} 🎋` : ''}) asignado con éxito al ${newBonusDate}!`)
    setTimeout(() => setBonusFeedback(''), 4000)
  }

  // Eliminar bono de XP
  function handleDeleteBonus(dateStr) {
    const updated = { ...xpBonuses }
    delete updated[dateStr]
    setXpBonuses(updated)
    localStorage.setItem('panda_calendar_xp_bonuses', JSON.stringify(updated))
  }

  // Navegación de meses
  function handlePrevMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  function handleNextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  function handleGoToToday() {
    setCurrentDate(new Date(2026, 8, 22))
  }

  // Guardar nuevo objetivo semanal (días seleccionados con horario libre)
  async function handleSaveGoals(e) {
    e.preventDefault()
    setSavingGoal(true)
    setGoalFeedback('')
    try {
      await AttendanceService.updateMyGoals(token, {
        diasObjetivo: tempGoals,
        horarioPreferido: 'Acceso Libre',
      })
      setUserGoals({
        diasObjetivo: tempGoals,
        horarioPreferido: 'Acceso Libre',
      })
      setGoalFeedback('¡Días de entrenamiento guardados con éxito!')
      setTimeout(() => {
        setShowGoalModal(false)
        setGoalFeedback('')
      }, 700)
    } catch (err) {
      setGoalFeedback(err.message || 'Error guardando objetivos')
    } finally {
      setSavingGoal(false)
    }
  }

  function toggleDayGoal(dayNumber) {
    if (tempGoals.includes(dayNumber)) {
      if (tempGoals.length === 1) return // Mínimo 1 día de entrenamiento
      setTempGoals(tempGoals.filter(d => d !== dayNumber))
    } else {
      setTempGoals([...tempGoals, dayNumber].sort((a, b) => a - b))
    }
  }

  // Cálculos de fecha para el mes seleccionado
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() // 0-indexed
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayWeekIndex = (new Date(year, month, 1).getDay() + 6) % 7 // 0=Lun, 6=Dom

  // Definición de "Hoy": Si estamos en Septiembre 2026 (mes demo Figma), hoy es el día 22
  const isDemoMonth = year === 2026 && month === 8
  const realNow = new Date()
  const isRealCurrentMonth = year === realNow.getFullYear() && month === realNow.getMonth()
  const todayNumber = isRealCurrentMonth ? realNow.getDate() : (isDemoMonth ? 22 : null)

  // Mapeo de asistencias del usuario registradas en este mes y año
  const attendancesInViewMonth = useMemo(() => {
    const map = {}
    if (Array.isArray(attendanceData)) {
      attendanceData.forEach((att) => {
        if (!att.horaEntrada) return
        const d = new Date(att.horaEntrada.replace ? att.horaEntrada.replace(' ', 'T') : att.horaEntrada)
        if (d.getFullYear() === year && d.getMonth() === month) {
          const dayNum = d.getDate()
          map[dayNum] = att
        }
      })
    }
    // Para el mes de prueba Septiembre 2026, complementar con los días de asistencia demo
    if (isDemoMonth) {
      const demoDays = [1, 3, 4, 7, 10, 11, 14, 15, 18, 21, 22]
      demoDays.forEach((d) => {
        if (!map[d]) {
          map[d] = {
            id: `demo-${d}`,
            horaEntrada: `2026-09-${String(d).padStart(2, '0')} 09:30:00`,
            horaSalida: `2026-09-${String(d).padStart(2, '0')} 11:00:00`,
            estado: 'finalizado',
            metodoRegistro: 'huella',
          }
        }
      })
    }
    return map
  }, [attendanceData, year, month, isDemoMonth])

  // Construcción de las celdas del calendario y métricas de desempeño
  const { calendarCells, totalAsistencias, totalInasistencias, cumplimientoPorcentaje, rachaDias } = useMemo(() => {
    const cells = []

    // Espacios vacíos antes del día 1
    for (let i = 0; i < firstDayWeekIndex; i++) {
      cells.push({ empty: true, key: `empty-${i}` })
    }

    let asistCount = 0
    let inasistCount = 0

    for (let day = 1; day <= daysInMonth; day++) {
      const dayOfWeek = (new Date(year, month, day).getDay() + 6) % 7 + 1 // 1=Lun ... 7=Dom
      const isTargetDay = userGoals.diasObjetivo.includes(dayOfWeek)
      const isToday = todayNumber !== null && day === todayNumber
      const isPast = todayNumber !== null ? day < todayNumber : (currentDate < realNow)
      const isFuture = todayNumber !== null ? day > todayNumber : (currentDate > realNow)

      const attRecord = attendancesInViewMonth[day] || null
      // Vinculado con huella y asistencia: entrada y salida registradas, o activo en sala
      const isAttended = Boolean(attRecord)
      const isInside = Boolean(attRecord && attRecord.estado === 'activo' && !attRecord.horaSalida)

      let statusKey = 'descanso'
      let statusTitle = 'Descanso'
      let statusBadge = ''
      let badgeType = ''
      let sublabel = 'Sin objetivo'

      // Fecha en formato string YYYY-MM-DD
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const thisDayDate = new Date(year, month, day, 23, 59, 59)
      const membershipEndDate = membership?.fechaFin
        ? new Date(membership.fechaFin.replace ? membership.fechaFin.replace(' ', 'T') : membership.fechaFin)
        : new Date(2026, 8, 30, 23, 59, 59)

      // ¿Día fuera del período de matrícula activa del socio?
      const isLockedByMembership = isFuture && thisDayDate > membershipEndDate
      const bonusConfig = xpBonuses[dateString]

      if (isPast) {
        if (isAttended) {
          statusKey = 'asistido'
          statusTitle = 'Asistido'
          statusBadge = bonusConfig ? `+${bonusConfig.xp} XP` : `+${generalRewards.baseXp} XP`
          badgeType = bonusConfig ? 'bonus' : 'xp'
          sublabel = bonusConfig ? bonusConfig.label : `+${generalRewards.baseBambus} bambús`
          asistCount++
        } else if (isTargetDay) {
          // Día pasado en el que el socio tenía meta de entrenar pero no asistió
          statusKey = 'inasistencia'
          statusTitle = 'No asistió'
          statusBadge = 'Falta'
          badgeType = 'falta'
          sublabel = 'Día de objetivo'
          inasistCount++
        } else {
          // Día de descanso (sin meta)
          statusKey = 'descanso'
          statusTitle = 'Descanso'
          sublabel = 'Sin objetivo'
        }
      } else if (isToday) {
        if (isAttended) {
          statusKey = 'asistido'
          statusTitle = isInside ? 'En sala' : 'Asistido'
          statusBadge = isInside ? '● Activo' : (bonusConfig ? `+${bonusConfig.xp} XP` : `+${generalRewards.baseXp} XP`)
          badgeType = isInside ? 'today' : (bonusConfig ? 'bonus' : 'xp')
          sublabel = isInside ? 'Entrenando ahora' : (bonusConfig?.label || `+${generalRewards.baseBambus} bambús`)
          asistCount++
        } else if (isTargetDay) {
          // HOY: El día aún no ha terminado, por lo tanto NO es inasistencia, está PENDIENTE
          statusKey = 'hoy-pendiente'
          statusTitle = 'Pendiente'
          statusBadge = bonusConfig ? `⚡ +${bonusConfig.xp} XP` : 'HOY'
          badgeType = bonusConfig ? 'bonus' : 'today'
          sublabel = bonusConfig ? bonusConfig.label : 'Por entrenar hoy'
        } else {
          statusKey = 'hoy-descanso'
          statusTitle = 'Descanso'
          statusBadge = bonusConfig ? `⚡ +${bonusConfig.xp} XP` : 'HOY'
          badgeType = bonusConfig ? 'bonus' : 'today'
          sublabel = bonusConfig ? bonusConfig.label : 'Día libre programado'
        }
      } else if (isLockedByMembership) {
        // DÍA FUERA DE MATRÍCULA ACTIVA (BLOQUEADO)
        statusKey = 'bloqueado-membresia'
        statusTitle = 'Sin Matrícula'
        statusBadge = '🔒 Bloqueado'
        badgeType = 'locked'
        sublabel = 'Renovar matrícula'
      } else {
        // DÍA FUTURO (dentro de matrícula)
        if (bonusConfig) {
          statusKey = 'futuro-objetivo'
          statusTitle = 'Bono Especial'
          statusBadge = `⚡ +${bonusConfig.xp} XP`
          badgeType = 'bonus'
          sublabel = bonusConfig.label
        } else if (isTargetDay) {
          statusKey = 'futuro-objetivo'
          statusTitle = 'Programado'
          statusBadge = 'Meta'
          badgeType = 'meta'
          sublabel = 'Día de objetivo'
        } else {
          statusKey = 'futuro-descanso'
          statusTitle = 'Descanso'
          sublabel = 'Día libre'
        }
      }

      cells.push({
        empty: false,
        day,
        dayOfWeek,
        dateString,
        isToday,
        isPast,
        isFuture,
        isTargetDay,
        isAttended,
        isInside,
        isLockedByMembership,
        bonusConfig,
        attRecord,
        statusKey,
        statusTitle,
        statusBadge,
        badgeType,
        sublabel,
        key: `day-${day}`,
      })
    }

    const totalEvaluados = asistCount + inasistCount
    const cumplimiento = totalEvaluados > 0 ? Math.round((asistCount / totalEvaluados) * 100) : 100
    const racha = asistCount >= 3 ? 3 : asistCount

    return {
      calendarCells: cells,
      totalAsistencias: asistCount,
      totalInasistencias: inasistCount,
      cumplimientoPorcentaje: cumplimiento,
      rachaDias: racha,
    }
  }, [year, month, daysInMonth, firstDayWeekIndex, todayNumber, currentDate, realNow, userGoals.diasObjetivo, attendancesInViewMonth, xpBonuses, generalRewards])

  return (
    <div className="attendance-view-container">
      {/* ----------------------------------------------------------------------
          BARRA SUPERIOR COMPACTA (TÍTULO Y 4 KPIS EN FILA HORIZONTAL)
          ---------------------------------------------------------------------- */}
      <header className="attendance-top-bar">
        <div className="attendance-title-area">
          <h1>Tu constancia, día a día</h1>
          <p>
            {MONTH_NAMES[month]} {year} · Hoy es martes 22. Las inasistencias solo se computan una vez finalizado el día.
          </p>
        </div>

        <div className="attendance-kpi-strip">
          {/* KPI 1: Asistencias */}
          <div className="attendance-kpi-chip">
            <div className="attendance-kpi-icon" style={{ background: '#ecfccb', color: '#15803d' }}>
              ✓
            </div>
            <div className="attendance-kpi-info">
              <span className="attendance-kpi-value">{totalAsistencias}</span>
              <span className="attendance-kpi-label">Asistencias</span>
            </div>
          </div>

          {/* KPI 2: Inasistencias */}
          <div className="attendance-kpi-chip">
            <div className="attendance-kpi-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
              ✕
            </div>
            <div className="attendance-kpi-info">
              <span className="attendance-kpi-value">{totalInasistencias}</span>
              <span className="attendance-kpi-label">Inasistencias</span>
            </div>
          </div>

          {/* KPI 3: Cumplimiento */}
          <div className="attendance-kpi-chip">
            <div className="attendance-kpi-icon" style={{ background: '#ecfccb', color: '#15803d' }}>
              📈
            </div>
            <div className="attendance-kpi-info">
              <span className="attendance-kpi-value">{cumplimientoPorcentaje}%</span>
              <span className="attendance-kpi-label">Cumplimiento</span>
            </div>
          </div>

          {/* KPI 4: Racha Activa */}
          <div className="attendance-kpi-chip">
            <div className="attendance-kpi-icon" style={{ background: 'rgba(196, 240, 57, 0.35)', color: '#111d15' }}>
              🔥
            </div>
            <div className="attendance-kpi-info">
              <span className="attendance-kpi-value">{rachaDias} días</span>
              <span className="attendance-kpi-label">En racha</span>
            </div>
          </div>
        </div>
      </header>

      {/* ----------------------------------------------------------------------
          LAYOUT PRINCIPAL: CALENDARIO (IZQUIERDA) + PANEL OBJETIVO (DERECHA)
          ---------------------------------------------------------------------- */}
      <section className="attendance-main-layout">
        {/* PANEL CALENDARIO */}
        <div className="calendar-panel">
          <div>
            {/* Cabecera del calendario con navegación de meses */}
            <div className="calendar-header">
              <div className="calendar-header-title">
                <h2>{MONTH_NAMES[month]} {year}</h2>
              </div>

              <div className="calendar-month-nav">
                <button
                  type="button"
                  className="calendar-nav-btn"
                  onClick={handlePrevMonth}
                  title="Mes anterior"
                >
                  ‹ {MONTH_NAMES[(month + 11) % 12].slice(0, 3)}
                </button>
                <button
                  type="button"
                  className="calendar-month-badge"
                  onClick={handleGoToToday}
                  title="Ver fecha actual"
                  style={{ cursor: 'pointer' }}
                >
                  {MONTH_NAMES[month]}
                </button>
                <button
                  type="button"
                  className="calendar-nav-btn"
                  onClick={handleNextMonth}
                  title="Mes siguiente"
                >
                  {MONTH_NAMES[(month + 1) % 12].slice(0, 3)} ›
                </button>

                {user?.rol === 'admin' && (
                  <button
                    type="button"
                    className="calendar-nav-btn"
                    onClick={() => setShowBonusAdminModal(true)}
                    style={{
                      background: '#111d15',
                      color: '#c4f039',
                      border: '1.5px solid #c4f039',
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title="Configurar valores generales de asistencia y bonos por evento"
                  >
                    <span>⚡</span>
                    <span>Recompensas & Bonos</span>
                  </button>
                )}
              </div>
            </div>

            {/* Leyenda interactiva clara */}
            <div className="calendar-legend-bar">
              <div className="calendar-legend-item">
                <span className="calendar-legend-dot" style={{ background: '#22c55e' }}></span>
                <span>Asistido (+{generalRewards.baseXp} XP · +{generalRewards.baseBambus} 🎋)</span>
              </div>
              <div className="calendar-legend-item">
                <span className="calendar-legend-dot" style={{ background: '#fef08a', border: '1px solid #eab308' }}></span>
                <span>⚡ Bono Evento</span>
              </div>
              <div className="calendar-legend-item">
                <span className="calendar-legend-dot" style={{ background: '#ef4444' }}></span>
                <span>Inasistencia</span>
              </div>
              <div className="calendar-legend-item">
                <span className="calendar-legend-dot" style={{ background: '#eab308' }}></span>
                <span>Hoy</span>
              </div>
              <div className="calendar-legend-item">
                <span className="calendar-legend-dot" style={{ background: '#e2e8f0', border: '1px dashed #94a3b8' }}></span>
                <span>🔒 Fuera de plan</span>
              </div>
              <div className="calendar-legend-item">
                <span className="calendar-legend-dot" style={{ background: '#94a3b8' }}></span>
                <span>Descanso</span>
              </div>
            </div>

            {/* Días de la semana */}
            <div className="calendar-days-header">
              {DAYS_NAMES.map(name => (
                <div key={name}>{name}</div>
              ))}
            </div>

            {/* Matriz de días */}
            <div className="calendar-matrix">
              {calendarCells.map(cell => {
                if (cell.empty) {
                  return <div key={cell.key} className="cell-empty" />
                }

                return (
                  <div
                    key={cell.key}
                    className={`calendar-cell cell-${cell.statusKey}`}
                    onClick={() => {
                      if (cell.isLockedByMembership) {
                        setLockedDayInfo(cell)
                        setShowRenewModal(true)
                      } else {
                        setSelectedDayDetail(cell)
                      }
                    }}
                    title={`Día ${cell.day}: ${cell.statusTitle} - ${cell.sublabel}`}
                  >
                    <div className="cell-top-row">
                      <span className="cell-day-num">{cell.day}</span>
                      {cell.statusBadge && (
                        <span className={`cell-badge cell-badge-${cell.badgeType}`}>
                          {cell.statusBadge}
                        </span>
                      )}
                    </div>

                    <div className="cell-bottom-row">
                      <div className="cell-state-text">{cell.statusTitle}</div>
                      <div className="cell-sublabel-text">{cell.sublabel}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* PANEL LATERAL: TU OBJETIVO SEMANAL */}
        <aside className="goal-sidebar-panel">
          <div>
            <div className="goal-card-header">
              <h3>Tu objetivo semanal</h3>
              <span className="goal-days-badge">
                {userGoals.diasObjetivo.length} días por semana
              </span>
            </div>

            <p className="goal-access-note" style={{ marginTop: '6px' }}>
              Elegido por ti · <strong>Acceso libre</strong> en cualquier horario del día.
            </p>

            {/* Pastillas de los 7 días (Lunes a Domingo) */}
            <div className="goal-week-pills" style={{ margin: '14px 0' }}>
              {[
                { id: 1, label: 'Lu' },
                { id: 2, label: 'Ma' },
                { id: 3, label: 'Mi' },
                { id: 4, label: 'Ju' },
                { id: 5, label: 'Vi' },
                { id: 6, label: 'Sá' },
                { id: 7, label: 'Do' },
              ].map(d => {
                const isActive = userGoals.diasObjetivo.includes(d.id)
                return (
                  <div
                    key={d.id}
                    className={`goal-pill ${isActive ? 'goal-pill-active' : 'goal-pill-inactive'}`}
                  >
                    {d.label}
                  </div>
                )
              })}
            </div>

            <div style={{ margin: '10px 0 14px' }}>
              <div className="goal-week-progress-title">
                Esta semana: 2 de {userGoals.diasObjetivo.length} cumplidos
              </div>
              <p className="goal-week-progress-detail">
                Lunes y martes completados. Jueves y viernes aún futuros.
              </p>
            </div>

            <button
              type="button"
              className="goal-edit-btn"
              onClick={() => {
                setTempGoals([...userGoals.diasObjetivo])
                setShowGoalModal(true)
              }}
            >
              Cambiar días de objetivo
            </button>
          </div>

          {/* Tarjeta Informativa Compacta: Descanso */}
          <div className="rest-info-card">
            <div className="rest-info-icon">i</div>
            <div className="rest-info-text">
              <h4>Descansar también suma</h4>
              <p>
                Tus días de descanso programados no cuentan como faltas ni restan tu racha ni tus XP en Panda Fitness.
              </p>
            </div>
          </div>
        </aside>
      </section>

      {/* ----------------------------------------------------------------------
          MODAL: CAMBIAR DÍAS DE OBJETIVO (SIN HORARIOS, SOLO DÍAS)
          ---------------------------------------------------------------------- */}
      <ModalDialog
        isOpen={showGoalModal}
        onClose={() => setShowGoalModal(false)}
        title="Configurar Objetivo Semanal"
        subtitle="Selecciona los días que te comprometes a entrenar en Panda Fitness."
        badge="MIS METAS"
        size="md"
      >
        <form onSubmit={handleSaveGoals}>
          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', color: '#111d15', marginBottom: '10px' }}>
              Días de entrenamiento por semana ({tempGoals.length} días seleccionados)
            </label>

            {/* Selector de los 7 días de la semana */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
              {[
                { id: 1, label: 'Lunes', short: 'Lu' },
                { id: 2, label: 'Martes', short: 'Ma' },
                { id: 3, label: 'Miércoles', short: 'Mi' },
                { id: 4, label: 'Jueves', short: 'Ju' },
                { id: 5, label: 'Viernes', short: 'Vi' },
                { id: 6, label: 'Sábado', short: 'Sá' },
                { id: 7, label: 'Domingo', short: 'Do' },
              ].map(d => {
                const active = tempGoals.includes(d.id)
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDayGoal(d.id)}
                    style={{
                      padding: '12px 6px',
                      borderRadius: '12px',
                      border: active ? '2px solid #84cc16' : '1.5px solid #cbd5e1',
                      background: active ? '#ecfccb' : '#ffffff',
                      color: active ? '#15803d' : '#475569',
                      fontWeight: 900,
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s ease',
                      boxShadow: active ? '0 2px 8px rgba(132, 204, 22, 0.25)' : 'none',
                    }}
                  >
                    <div>{d.short}</div>
                  </button>
                )
              })}
            </div>

            <p style={{ fontSize: '0.82rem', color: '#5f7165', margin: '14px 0 0', lineHeight: 1.45 }}>
              💡 <strong>Acceso libre total:</strong> Tu membresía te permite ingresar a sala a cualquier hora dentro del horario de atención del club. No requieres agendar ningún horario fijo.
            </p>
          </div>

          {goalFeedback && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#ecfccb', color: '#15803d', fontSize: '0.85rem', marginBottom: '16px', fontWeight: 700 }}>
              {goalFeedback}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setShowGoalModal(false)}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                background: '#ffffff',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: 'pointer',
                color: '#475569',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingGoal}
              style={{
                padding: '10px 24px',
                borderRadius: '10px',
                border: 'none',
                background: '#c4f039',
                color: '#111d15',
                fontWeight: 900,
                fontSize: '0.88rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(196, 240, 57, 0.4)',
              }}
            >
              {savingGoal ? 'Guardando...' : 'Guardar Objetivo'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ----------------------------------------------------------------------
          MODAL: DETALLE INTERACTIVO DEL DÍA SELECCIONADO
          ---------------------------------------------------------------------- */}
      <ModalDialog
        isOpen={Boolean(selectedDayDetail)}
        onClose={() => setSelectedDayDetail(null)}
        title={`Día ${selectedDayDetail?.day} de ${MONTH_NAMES[month]} ${year}`}
        subtitle="Registro de acceso y validación biométrica en sala"
        badge={selectedDayDetail?.statusTitle?.toUpperCase()}
        size="sm"
      >
        {selectedDayDetail && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: selectedDayDetail.statusKey === 'asistido' ? '#ecfccb' : selectedDayDetail.statusKey === 'inasistencia' ? '#fee2e2' : '#f1f5f9',
                  color: selectedDayDetail.statusKey === 'asistido' ? '#15803d' : selectedDayDetail.statusKey === 'inasistencia' ? '#dc2626' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '1.25rem',
                }}
              >
                {selectedDayDetail.day}
              </div>
              <div>
                <h4 style={{ margin: 0, fontWeight: 900, color: '#111d15', fontSize: '1rem' }}>
                  {selectedDayDetail.statusKey === 'asistido'
                    ? '¡Entrenamiento confirmado!'
                    : selectedDayDetail.statusKey === 'inasistencia'
                      ? 'Inasistencia registrada'
                      : selectedDayDetail.statusKey === 'hoy-pendiente'
                        ? 'Esperando tu visita hoy'
                        : selectedDayDetail.statusKey === 'futuro-objetivo'
                          ? 'Día de meta programado'
                          : 'Día de descanso'}
                </h4>
                <span style={{ fontSize: '0.8rem', color: '#5f7165' }}>
                  {selectedDayDetail.sublabel}
                </span>
              </div>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '12px 14px', fontSize: '0.82rem', color: '#334155', lineHeight: 1.55 }}>
              {selectedDayDetail.statusKey === 'asistido' ? (
                <>
                  <div>✓ Check-in verificado por recepción (huella / DNI).</div>
                  {selectedDayDetail.attRecord?.horaEntrada && (
                    <div style={{ color: '#15803d', fontWeight: 700 }}>
                      ✓ Ingreso: {selectedDayDetail.attRecord.horaEntrada.slice(11, 16)} hrs {selectedDayDetail.attRecord.horaSalida ? `· Salida: ${selectedDayDetail.attRecord.horaSalida.slice(11, 16)} hrs` : '(En curso)'}
                    </div>
                  )}
                  <div>
                    ✓ Recompensa otorgada:{' '}
                    <strong>
                      +{selectedDayDetail.bonusConfig?.xp || generalRewards.baseXp} XP
                    </strong>{' '}
                    y{' '}
                    <strong>
                      +{selectedDayDetail.bonusConfig?.bambus != null ? selectedDayDetail.bonusConfig.bambus : generalRewards.baseBambus} bambús 🎋
                    </strong>.
                  </div>
                  <div>✓ Tu pandita sumó energía para su evolución de nivel.</div>
                </>
              ) : selectedDayDetail.statusKey === 'inasistencia' ? (
                <>
                  <div>⚠ No registraste ingreso en este día programado de tu objetivo.</div>
                  <div>💡 El sistema no penaliza tu salud: puedes recuperar asistiendo un día extra de descanso.</div>
                </>
              ) : selectedDayDetail.statusKey === 'hoy-pendiente' ? (
                <>
                  <div>🕒 Hoy es un día de tu objetivo de entrenamiento.</div>
                  <div>👆 Solo acércate a recepción con tu huella digital o DNI para validar tu acceso y marcar tu asistencia.</div>
                </>
              ) : selectedDayDetail.statusKey === 'futuro-objetivo' ? (
                <>
                  <div>🎯 Tienes planeado entrenar este día según tu objetivo semanal.</div>
                  <div>🌱 El acceso estará disponible en cualquier momento durante el horario de atención.</div>
                </>
              ) : (
                <>
                  <div>🌿 Día de descanso programado. Los días de descanso te permiten recuperarte sin perder tu racha activa de nivel.</div>
                </>
              )}
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSelectedDayDetail(null)}
                style={{
                  padding: '8px 18px',
                  background: '#111d15',
                  color: '#c4f039',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* ----------------------------------------------------------------------
          MODAL: DÍA BLOQUEADO FUERA DE MATRÍCULA ACTIVA (RENOVACIÓN DE PLAN)
          ---------------------------------------------------------------------- */}
      <ModalDialog
        isOpen={showRenewModal}
        onClose={() => setShowRenewModal(false)}
        title="🔒 Día Fuera de Matrícula Activa"
        subtitle="Acceso al gimnasio bloqueado para esta fecha"
        badge="RENOVAR PLAN"
        size="sm"
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.6rem',
                flexShrink: 0,
              }}
            >
              🔒
            </div>
            <div>
              <h4 style={{ margin: 0, fontWeight: 900, color: '#111d15', fontSize: '1.02rem' }}>
                Día {lockedDayInfo?.day} de {MONTH_NAMES[month]} {year}
              </h4>
              <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Tu plan actual finaliza el {membership?.fechaFin ? membership.fechaFin.slice(0, 10) : '30 de Septiembre 2026'}.
              </p>
            </div>
          </div>

          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '14px',
              fontSize: '0.82rem',
              color: '#334155',
              lineHeight: 1.55,
              marginBottom: '16px',
            }}
          >
            <p style={{ margin: '0 0 8px 0', fontWeight: 700, color: '#0f172a' }}>
              🛡️ Para entrenar este día y mantener a tu Pandita en racha:
            </p>
            <ul style={{ margin: 0, paddingLeft: '18px' }}>
              <li style={{ marginBottom: '4px' }}>Este día está fuera del período cubierto por tu membresía (<strong>{membership?.planNombre || 'Plan Activo'}</strong>).</li>
              <li style={{ marginBottom: '4px' }}>El torniquete y la huella digital no permitirán el acceso sin un plan vigente.</li>
              <li>¡Renueva ahora para desbloquear todos los días del mes y ganar <strong>+25 XP o más</strong> por visita!</li>
            </ul>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowRenewModal(false)}
              style={{
                padding: '9px 16px',
                background: '#f1f5f9',
                color: '#475569',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: 'pointer',
              }}
            >
              Entendido
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRenewModal(false)
                navigate('/app/mi-membresia')
              }}
              style={{
                padding: '9px 18px',
                background: '#c4f039',
                color: '#111d15',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 900,
                fontSize: '0.86rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(196, 240, 57, 0.35)',
              }}
            >
              💳 Ver Planes y Renovar
            </button>
          </div>
        </div>
      </ModalDialog>

      {/* ----------------------------------------------------------------------
          MODAL: ADMINISTRACIÓN DE BONOS XP POR DÍA (SOLO ADMIN)
          ---------------------------------------------------------------------- */}
      <ModalDialog
        isOpen={showBonusAdminModal}
        onClose={() => setShowBonusAdminModal(false)}
        title="⚡ Configurar Recompensas y Bonos de Asistencia"
        subtitle="Define el valor base por cada asistencia habitual o programa bonos especiales para fechas de eventos"
        badge="CONTROL ADMIN"
        size="md"
      >
        <div>
          {/* TABS SUPERIORES: GENERAL VS EVENTOS */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
            <button
              type="button"
              onClick={() => {
                setBonusAdminTab('general')
                setGeneralFeedback('')
              }}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                border: bonusAdminTab === 'general' ? '2px solid #111d15' : '1px solid #e2e8f0',
                background: bonusAdminTab === 'general' ? '#111d15' : '#f8fafc',
                color: bonusAdminTab === 'general' ? '#c4f039' : '#475569',
                fontWeight: 800,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
            >
              <span>⚙️</span>
              <span>1. General (Cada Asistencia)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setBonusAdminTab('eventos')
                setBonusFeedback('')
              }}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                border: bonusAdminTab === 'eventos' ? '2px solid #111d15' : '1px solid #e2e8f0',
                background: bonusAdminTab === 'eventos' ? '#111d15' : '#f8fafc',
                color: bonusAdminTab === 'eventos' ? '#c4f039' : '#475569',
                fontWeight: 800,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
            >
              <span>📅</span>
              <span>2. Eventos (Fechas Especiales)</span>
            </button>
          </div>

          {/* CONTENIDO SEGÚN LA PESTAÑA ACTIVA */}
          {bonusAdminTab === 'general' ? (
            <div>
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#111d15', marginBottom: '4px' }}>
                  ⚙️ Recompensa Habitual por Cada Asistencia
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.45 }}>
                  Escribe manualmente cuántos puntos de <strong>XP</strong> y cuántos <strong>Bambús</strong> gana un socio cada vez que registra una asistencia normal en recepción o torniquete.
                </div>
              </div>

              {generalFeedback && (
                <div style={{ padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: '10px', fontWeight: 700, fontSize: '0.82rem', marginBottom: '14px' }}>
                  ✓ {generalFeedback}
                </div>
              )}

              <form onSubmit={handleSaveGeneralRewards} style={{ display: 'grid', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                  <div className="form-element">
                    <label className="element-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>⚡</span> <span>Experiencia Base (XP) *</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className={`input-field ${generalErrors.xp ? 'is-invalid' : ''}`}
                      value={tempGeneralXp}
                      onChange={(e) => {
                        setTempGeneralXp(e.target.value)
                        if (generalErrors.xp) setGeneralErrors((prev) => ({ ...prev, xp: '' }))
                      }}
                      placeholder="Ej: 50"
                      style={generalErrors.xp ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                      required
                    />
                    {generalErrors.xp && (
                      <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', color: '#dc2626' }}>
                        <i className="bi bi-exclamation-circle-fill"></i>
                        <span>{generalErrors.xp}</span>
                      </div>
                    )}
                    <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '3px' }}>
                      Suma al progreso de nivel de Mi Pandita
                    </span>
                  </div>

                  <div className="form-element">
                    <label className="element-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>🎋</span> <span>Bambús por Visita (🎋) *</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className={`input-field ${generalErrors.bambus ? 'is-invalid' : ''}`}
                      value={tempGeneralBambus}
                      onChange={(e) => {
                        setTempGeneralBambus(e.target.value)
                        if (generalErrors.bambus) setGeneralErrors((prev) => ({ ...prev, bambus: '' }))
                      }}
                      placeholder="Ej: 15"
                      style={generalErrors.bambus ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                      required
                    />
                    {generalErrors.bambus && (
                      <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', color: '#dc2626' }}>
                        <i className="bi bi-exclamation-circle-fill"></i>
                        <span>{generalErrors.bambus}</span>
                      </div>
                    )}
                    <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '3px' }}>
                      Moneda virtual canjeable en Recompensas
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    type="submit"
                    style={{
                      padding: '10px 20px',
                      background: '#c4f039',
                      color: '#111d15',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: 900,
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(196, 240, 57, 0.35)',
                    }}
                  >
                    💾 Guardar Configuración General
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div>
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#111d15', marginBottom: '4px' }}>
                  📅 Bonos Extra para Fechas de Eventos
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.45 }}>
                  Marca una fecha en el calendario y escribe manualmente el puntaje de <strong>XP</strong> y <strong>Bambús</strong> especiales que otorgará ese día.
                </div>
              </div>

              {bonusFeedback && (
                <div style={{ padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: '10px', fontWeight: 700, fontSize: '0.82rem', marginBottom: '14px' }}>
                  ✓ {bonusFeedback}
                </div>
              )}

              <form onSubmit={handleSaveBonus} style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                  <div className="form-element">
                    <label className="element-label" style={{ fontSize: '0.8rem' }}>Fecha del Evento *</label>
                    <input
                      type="date"
                      className={`input-field ${bonusErrors.date ? 'is-invalid' : ''}`}
                      value={newBonusDate}
                      onChange={(e) => {
                        setNewBonusDate(e.target.value)
                        if (bonusErrors.date) setBonusErrors((prev) => ({ ...prev, date: '' }))
                      }}
                      style={bonusErrors.date ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                      required
                    />
                    {bonusErrors.date && (
                      <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', color: '#dc2626' }}>
                        <i className="bi bi-exclamation-circle-fill"></i>
                        <span>{bonusErrors.date}</span>
                      </div>
                    )}
                  </div>

                  <div className="form-element">
                    <label className="element-label" style={{ fontSize: '0.8rem' }}>XP del Evento (⚡) *</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className={`input-field ${bonusErrors.xp ? 'is-invalid' : ''}`}
                      value={newBonusXp}
                      onChange={(e) => {
                        setNewBonusXp(e.target.value)
                        if (bonusErrors.xp) setBonusErrors((prev) => ({ ...prev, xp: '' }))
                      }}
                      placeholder="Ej: 100"
                      style={bonusErrors.xp ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                      required
                    />
                    {bonusErrors.xp && (
                      <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', color: '#dc2626' }}>
                        <i className="bi bi-exclamation-circle-fill"></i>
                        <span>{bonusErrors.xp}</span>
                      </div>
                    )}
                  </div>

                  <div className="form-element">
                    <label className="element-label" style={{ fontSize: '0.8rem' }}>Bambús Extra (🎋)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className={`input-field ${bonusErrors.bambus ? 'is-invalid' : ''}`}
                      value={newBonusBambus}
                      onChange={(e) => {
                        setNewBonusBambus(e.target.value)
                        if (bonusErrors.bambus) setBonusErrors((prev) => ({ ...prev, bambus: '' }))
                      }}
                      placeholder="Ej: 25"
                      style={bonusErrors.bambus ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                    />
                    {bonusErrors.bambus && (
                      <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', color: '#dc2626' }}>
                        <i className="bi bi-exclamation-circle-fill"></i>
                        <span>{bonusErrors.bambus}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-element">
                  <label className="element-label" style={{ fontSize: '0.8rem' }}>Etiqueta / Motivo del Evento *</label>
                  <input
                    type="text"
                    className={`input-field ${bonusErrors.label ? 'is-invalid' : ''}`}
                    value={newBonusLabel}
                    onChange={(e) => {
                      setNewBonusLabel(e.target.value)
                      if (bonusErrors.label) setBonusErrors((prev) => ({ ...prev, label: '' }))
                    }}
                    placeholder="Ej: Reto Fin de Semana x2 XP o Cierre de Mes"
                    style={bonusErrors.label ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                    required
                  />
                  {bonusErrors.label && (
                    <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', color: '#dc2626' }}>
                      <i className="bi bi-exclamation-circle-fill"></i>
                      <span>{bonusErrors.label}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    type="submit"
                    style={{
                      padding: '9px 18px',
                      background: '#c4f039',
                      color: '#111d15',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: 900,
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(196, 240, 57, 0.35)',
                    }}
                  >
                    + Asignar Bono a Esta Fecha
                  </button>
                </div>
              </form>

              <h5 style={{ margin: '0 0 10px', fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                📅 Bonos de Eventos Activos en el Calendario:
              </h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                {Object.entries(xpBonuses).length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>No hay bonos de eventos configurados actualmente.</p>
                ) : (
                  Object.entries(xpBonuses).map(([dStr, bData]) => (
                    <div
                      key={dStr}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: '#f8fafc',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '0.82rem', color: '#111d15' }}>{dStr}</strong>: {bData.label}
                        <span style={{ marginLeft: '8px', background: '#fef08a', color: '#854d0e', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800 }}>
                          +{bData.xp} XP
                        </span>
                        {bData.bambus ? (
                          <span style={{ marginLeft: '6px', background: '#ecfccb', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800 }}>
                            +{bData.bambus} 🎋
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteBonus(dStr)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                        }}
                        title="Eliminar bono"
                      >
                        ✕ Quitar
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </ModalDialog>
    </div>
  )
}

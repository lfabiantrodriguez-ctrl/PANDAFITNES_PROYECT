import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AttendanceService } from '../services/AttendanceService'
import { MembershipService } from '../services/MembershipService'
import ModalDialog from '../components/ModalDialog'
import {moduleLabel} from '../utils/access'
import '../styles/MemberAttendance.css'
import usePandaAccount from '../hooks/usePandaAccount'
import {peruDate} from '../utils/pandaProgress'
import { formatTimePeru, formatDate } from '../utils/formatters'

const DAYS_NAMES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
const MONTH_NAMES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
]

export default function MemberAttendanceView({ token, user }) {
  const navigate = useNavigate()
  const {data:account,error,refresh}=usePandaAccount(token)
  // Fecha actual de referencia (por defecto Septiembre 2026 de la maqueta demo o fecha real navegada)
  const [currentDate, setCurrentDate] = useState(new Date(peruDate(new Date())+'T12:00:00'))
  const [loading, setLoading] = useState(true)
  const [attendanceData, setAttendanceData] = useState([])
  const [userGoals, setUserGoals] = useState({
    diasObjetivo: [1, 2, 4, 5], // Lunes (1), Martes (2), Jueves (4), Viernes (5)
    horarioPreferido: 'Acceso Libre',
  })

  // Membresía del socio para validar días bloqueados fuera de matrícula
  const [membership, setMembership] = useState(null)

  // Recompensas Generales por Asistencia Habitual (XP & Bambús)
  const generalRewards={baseXp:account?.baseXp ?? 25,baseBambus:account?.baseBambus ?? 10}
  const [tempGeneralXp, setTempGeneralXp] = useState(50)
  const [tempGeneralBambus, setTempGeneralBambus] = useState(15)
  const [generalFeedback, setGeneralFeedback] = useState('')
  const [generalErrors, setGeneralErrors] = useState({})

  // Pestaña activa del modal de configuración: 'general' | 'eventos'
  const [bonusAdminTab, setBonusAdminTab] = useState('general')

  // Mapa de Bonos XP y Bambús asignables por el Administrador para eventos especiales
  const xpBonuses=(account?.xpBonuses && typeof account.xpBonuses === 'object' && !Array.isArray(account.xpBonuses)) ? account.xpBonuses : {}

  // Modal para días bloqueados fuera de matrícula
  const [showRenewModal, setShowRenewModal] = useState(false)
  const [lockedDayInfo, setLockedDayInfo] = useState(null)

  // Modal para administración de Recompensas y Bonos XP
  const [showBonusAdminModal, setShowBonusAdminModal] = useState(false)
  const [newBonusDate, setNewBonusDate] = useState(() => peruDate(new Date()))
  const [newBonusXp, setNewBonusXp] = useState(50)
  const [newBonusBambus, setNewBonusBambus] = useState(20)
  const [newBonusLabel, setNewBonusLabel] = useState('')
  const [bonusFeedback, setBonusFeedback] = useState('')
  const [bonusErrors, setBonusErrors] = useState({})
  const [savingRules, setSavingRules] = useState(false)

  // Sincronizar inputs temporales cuando cambian los valores generales
  useEffect(() => {
    setTempGeneralXp(generalRewards.baseXp)
    setTempGeneralBambus(generalRewards.baseBambus)
  }, [generalRewards.baseXp, generalRewards.baseBambus])

  // Modal para cambiar objetivos semanales (únicamente selección de días, sin selector de horario)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [tempGoals, setTempGoals] = useState([1, 2, 4, 5])
  const [savingGoal, setSavingGoal] = useState(false)
  const [goalFeedback, setGoalFeedback] = useState('')

  // Modal para detalles de un día seleccionado
  const [selectedDayDetail, setSelectedDayDetail] = useState(null)

  const loadData=refresh
  useEffect(()=>{
    if(!account) return
    setAttendanceData(account.asistencias)
    setUserGoals(account.goals)
    setTempGoals(account.goals.diasObjetivo)
    setLoading(false)
  },[account])
  useEffect(()=>{
    let active=true
    MembershipService.getMyMembership(token).then(res=>{if(active)setMembership(res.membership || null)}).catch(()=>{if(active)setMembership(null)})
    return ()=>{active=false}
  },[token])

  // Navegación de meses
  function handlePrevMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  function handleNextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  function handleGoToToday() {
    setCurrentDate(new Date(peruDate(new Date())+'T12:00:00'))
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

  async function handleSaveGeneralRewards(e) {
    e.preventDefault()
    setGeneralFeedback('')
    const errs = {}
    const xpVal = Number(tempGeneralXp)
    const bambusVal = Number(tempGeneralBambus)
    if (tempGeneralXp === '' || !Number.isFinite(xpVal) || xpVal < 1) {
      errs.xp = 'Ingresa un valor de XP mayor o igual a 1.'
    }
    if (tempGeneralBambus === '' || !Number.isFinite(bambusVal) || bambusVal < 0) {
      errs.bambus = 'Ingresa un valor de bambús igual o mayor a 0.'
    }
    if (Object.keys(errs).length > 0) {
      setGeneralErrors(errs)
      return
    }
    setGeneralErrors({})
    setSavingRules(true)
    try {
      await AttendanceService.updateAttendanceRules(token, {
        baseXp: Math.round(xpVal),
        baseBambus: Math.round(bambusVal),
      })
      await refresh()
      window.dispatchEvent(new Event('panda-progress-updated'))
      setGeneralFeedback('Puntos base actualizados.')
    } catch (err) {
      setGeneralErrors({ xp: err.message || 'No se pudo guardar.' })
    } finally {
      setSavingRules(false)
    }
  }

  async function handleAddBonus(e) {
    e.preventDefault()
    setBonusFeedback('')
    const errs = {}
    if (!newBonusDate || !/^\d{4}-\d{2}-\d{2}$/.test(newBonusDate)) {
      errs.date = 'Selecciona una fecha válida.'
    }
    const xpVal = Number(newBonusXp)
    if (newBonusXp === '' || !Number.isFinite(xpVal) || xpVal < 1) {
      errs.xp = 'Mínimo 1 XP.'
    }
    const bambusVal = Number(newBonusBambus)
    if (newBonusBambus === '' || !Number.isFinite(bambusVal) || bambusVal < 0) {
      errs.bambus = 'Mínimo 0 bambús.'
    }
    if (!String(newBonusLabel || '').trim()) {
      errs.label = 'Ingresa el nombre de la promoción o evento.'
    }
    if (Object.keys(errs).length > 0) {
      setBonusErrors(errs)
      return
    }
    setBonusErrors({})
    setSavingRules(true)
    try {
      const updatedBonuses = {
        ...xpBonuses,
        [newBonusDate]: {
          xp: Math.round(xpVal),
          bambus: Math.round(bambusVal),
          label: newBonusLabel.trim(),
        },
      }
      await AttendanceService.updateAttendanceRules(token, { xpBonuses: updatedBonuses })
      await refresh()
      window.dispatchEvent(new Event('panda-progress-updated'))
      setNewBonusLabel('')
      setBonusFeedback(`Bono asignado para el ${newBonusDate}.`)
    } catch (err) {
      setBonusErrors({ label: err.message || 'No se pudo asignar el bono.' })
    } finally {
      setSavingRules(false)
    }
  }

  async function handleDeleteBonus(dateStr) {
    setBonusFeedback('')
    setSavingRules(true)
    try {
      const updatedBonuses = { ...xpBonuses }
      delete updatedBonuses[dateStr]
      await AttendanceService.updateAttendanceRules(token, { xpBonuses: updatedBonuses })
      await refresh()
      window.dispatchEvent(new Event('panda-progress-updated'))
      setBonusFeedback(`Bono del ${dateStr} eliminado.`)
    } catch (err) {
      setBonusErrors({ label: err.message || 'No se pudo eliminar el bono.' })
    } finally {
      setSavingRules(false)
    }
  }

  // Cálculos de fecha para el mes seleccionado
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() // 0-indexed
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayWeekIndex = (new Date(year, month, 1).getDay() + 6) % 7 // 0=Lun, 6=Dom

  const realNow=new Date((account?.today || peruDate(new Date()))+'T12:00:00')
  const isRealCurrentMonth=year===realNow.getFullYear() && month===realNow.getMonth()
  const todayNumber=isRealCurrentMonth?realNow.getDate():null

  // Mapeo de asistencias del usuario registradas en este mes y año
  const attendancesInViewMonth = useMemo(() => {
    const map = {}
    if (Array.isArray(attendanceData)) {
      attendanceData.forEach((att) => {
        if (!att.horaEntrada) return
        const d = new Date(peruDate(att.horaEntrada)+'T12:00:00')
        if (d.getFullYear() === year && d.getMonth() === month) {
          const dayNum = d.getDate()
          map[dayNum] = att
        }
      })
    }
    return map
  }, [attendanceData, year, month ])

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
      // ¿Día fuera del período de matrícula activa del socio?
      const isLockedByMembership = !isAttended && (!membership?.fechaInicio || !membership?.fechaFin || dateString < String(membership.fechaInicio).slice(0,10) || dateString > String(membership.fechaFin).slice(0,10))
      const bonusConfig = xpBonuses[dateString]

      if (isLockedByMembership) {
        statusKey = 'bloqueado-membresia'
        statusTitle = 'Fuera de plan'
        statusBadge = 'Sin matrícula'
        badgeType = 'locked'
        sublabel = 'Sin plan vigente para esta fecha'
      } else if (isPast) {
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
          statusBadge = bonusConfig ? ` +${bonusConfig.xp} XP` : 'HOY'
          badgeType = bonusConfig ? 'bonus' : 'today'
          sublabel = bonusConfig ? bonusConfig.label : 'Por entrenar hoy'
        } else {
          statusKey = 'hoy-descanso'
          statusTitle = 'Descanso'
          statusBadge = bonusConfig ? ` +${bonusConfig.xp} XP` : 'HOY'
          badgeType = bonusConfig ? 'bonus' : 'today'
          sublabel = bonusConfig ? bonusConfig.label : 'Día libre programado'
        }
      } else if (isLockedByMembership) {
        // DÍA FUERA DE MATRÍCULA ACTIVA (BLOQUEADO)
        statusKey = 'bloqueado-membresia'
        statusTitle = 'Sin Matrícula'
        statusBadge = ' Bloqueado'
        badgeType = 'locked'
        sublabel = 'Renovar matrícula'
      } else {
        // DÍA FUTURO (dentro de matrícula)
        if (bonusConfig) {
          statusKey = 'futuro-objetivo'
          statusTitle = 'Bono Especial'
          statusBadge = ` +${bonusConfig.xp} XP`
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
    const cumplimiento = totalEvaluados > 0 ? Math.round((asistCount / totalEvaluados) * 100) : 0
    const racha = account?.racha ?? 0

    return {
      calendarCells: cells,
      totalAsistencias: asistCount,
      totalInasistencias: inasistCount,
      cumplimientoPorcentaje: cumplimiento,
      rachaDias: racha,
    }
  }, [year, month, daysInMonth, firstDayWeekIndex, todayNumber, currentDate, realNow, userGoals.diasObjetivo, attendancesInViewMonth, xpBonuses, generalRewards, account?.racha, membership?.fechaInicio, membership?.fechaFin])

  if(!account) return <div className="attendance-view-container"><p role="status">{error || 'Cargando tus registros…'}</p>{error&&<button className="btn btn-dark" onClick={refresh}>Volver a consultar</button>}</div>
  const weekStart=new Date(realNow);weekStart.setDate(realNow.getDate()-((realNow.getDay()+6)%7))
  const weekKey=peruDate(weekStart)
  const weekCount=account.diasAsistidos.filter(d=>d>=weekKey && d<=account.today).length
  return (
    <div className="attendance-view-container">
      {/* ----------------------------------------------------------------------
          BARRA SUPERIOR COMPACTA (RESUMEN Y 4 KPIS EN FILA HORIZONTAL)
          ---------------------------------------------------------------------- */}
      <header className="attendance-top-bar">
        <div className="attendance-title-area">
          <p>
            {MONTH_NAMES[month]} {year} · Hoy: {realNow.toLocaleDateString('es-PE',{weekday:'long',day:'numeric'})}
          </p>
        </div>

        <div className="attendance-kpi-strip">
          {/* KPI 1: Asistencias */}
          <div className="attendance-kpi-chip">
            <div className="attendance-kpi-icon" style={{ background: '#ecfccb', color: '#15803d' }}>
              <i className="bi bi-check-lg" aria-hidden="true" />
            </div>
            <div className="attendance-kpi-info">
              <span className="attendance-kpi-value">{totalAsistencias}</span>
              <span className="attendance-kpi-label">Asistencias</span>
            </div>
          </div>

          {/* KPI 2: Inasistencias */}
          <div className="attendance-kpi-chip">
            <div className="attendance-kpi-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
              <i className="bi bi-x-lg" aria-hidden="true" />
            </div>
            <div className="attendance-kpi-info">
              <span className="attendance-kpi-value">{totalInasistencias}</span>
              <span className="attendance-kpi-label">Inasistencias</span>
            </div>
          </div>

          {/* KPI 3: Cumplimiento */}
          <div className="attendance-kpi-chip">
            <div className="attendance-kpi-icon" style={{ background: '#ecfccb', color: '#15803d' }}><i className="bi bi-graph-up-arrow" aria-hidden="true"/></div>
            <div className="attendance-kpi-info">
              <span className="attendance-kpi-value">{cumplimientoPorcentaje}%</span>
              <span className="attendance-kpi-label">Cumplimiento</span>
            </div>
          </div>

          {/* KPI 4: Racha Activa */}
          <div className="attendance-kpi-chip">
            <div className="attendance-kpi-icon" style={{ background: 'rgba(196, 240, 57, 0.35)', color: '#111d15' }}><i className="bi bi-fire" aria-hidden="true"/></div>
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
                    <span><i className="bi bi-lightning-charge" aria-hidden="true"/></span>
                    <span>Reglas de puntos</span>
                  </button>
                )}
              </div>
            </div>

            {/* Leyenda interactiva clara */}
            <div className="calendar-legend-bar">
              <div className="calendar-legend-item">
                <span className="calendar-legend-dot" style={{ background: '#22c55e' }}></span>
                <span>Asistido (+{generalRewards.baseXp} XP · +{generalRewards.baseBambus} )</span>
              </div>
              <div className="calendar-legend-item">
                <span className="calendar-legend-dot" style={{ background: '#fef08a', border: '1px solid #eab308' }}></span>
                <span> Bono Evento</span>
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
                <span> Fuera de plan</span>
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
                Esta semana: {weekCount} de {userGoals.diasObjetivo.length} cumplidos
              </div>
              <p className="goal-week-progress-detail">
                Las visitas confirmadas en recepción actualizan tu objetivo.
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
        <form onSubmit={handleSaveGoals} noValidate>
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

          </div>

          {goalFeedback && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#ecfccb', color: '#15803d', fontSize: '0.85rem', marginBottom: '16px', fontWeight: 700 }}>
              {goalFeedback}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
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
                  <div> Check-in verificado por recepción (huella / DNI).</div>
                  {selectedDayDetail.attRecord?.horaEntrada && (
                    <div style={{ color: '#15803d', fontWeight: 700 }}>
                       Ingreso: {formatTimePeru(selectedDayDetail.attRecord.horaEntrada)} hrs {selectedDayDetail.attRecord.horaSalida ? `· Salida: ${formatTimePeru(selectedDayDetail.attRecord.horaSalida)} hrs` : '(En curso)'}
                    </div>
                  )}
                  <div>
                     Recompensa otorgada:{' '}
                    <strong>
                      +{selectedDayDetail.bonusConfig?.xp || generalRewards.baseXp} XP
                    </strong>{' '}
                    y{' '}
                    <strong>
                      +{selectedDayDetail.bonusConfig?.bambus != null ? selectedDayDetail.bonusConfig.bambus : generalRewards.baseBambus} bambús 
                    </strong>.
                  </div>
                  <div> Tu pandita sumó energía para su evolución de nivel.</div>
                </>
              ) : selectedDayDetail.statusKey === 'inasistencia' ? (
                <>
                  <div> No registraste ingreso en este día programado de tu objetivo.</div>
                  <div> El sistema no penaliza tu salud: puedes recuperar asistiendo un día extra de descanso.</div>
                </>
              ) : selectedDayDetail.statusKey === 'hoy-pendiente' ? (
                <>
                  <div> Hoy es un día de tu objetivo de entrenamiento.</div>
                  <div> Solo acércate a recepción con tu huella digital o DNI para validar tu acceso y marcar tu asistencia.</div>
                </>
              ) : selectedDayDetail.statusKey === 'futuro-objetivo' ? (
                <>
                  <div> Tienes planeado entrenar este día según tu objetivo semanal.</div>
                  <div> El acceso estará disponible en cualquier momento durante el horario de atención.</div>
                </>
              ) : (
                <>
                  <div> Día de descanso programado. Los días de descanso te permiten recuperarte sin perder tu racha activa de nivel.</div>
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
        title=" Día Fuera de Matrícula Activa"
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
              
            </div>
            <div>
              <h4 style={{ margin: 0, fontWeight: 900, color: '#111d15', fontSize: '1.02rem' }}>
                Día {lockedDayInfo?.day} de {MONTH_NAMES[month]} {year}
              </h4>
              <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Tu plan actual finaliza el {membership?.fechaFin ? formatDate(membership.fechaFin) : 'Sin membresía registrada'}.
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
               Para entrenar este día y mantener a tu Pandita en racha:
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
               Ver Planes y Renovar
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
        title="Reglas de Puntos y Promociones"
        subtitle="Puntos base por asistencia y bonos por fecha."
        badge="ADMIN"
        size="md"
      >
        <div>
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
              }}
            >
              <i className="bi bi-sliders"></i>
              <span>Puntos por Día</span>
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
              }}
            >
              <i className="bi bi-calendar-event"></i>
              <span>Días con Promoción ({Object.keys(xpBonuses).length})</span>
            </button>
          </div>

          {bonusAdminTab === 'general' ? (
            <form onSubmit={handleSaveGeneralRewards} noValidate style={{ display: 'grid', gap: '14px' }}>
              {generalFeedback && (
                <div style={{ padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: '10px', fontWeight: 700, fontSize: '0.82rem' }}>
                  ✓ {generalFeedback}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                <div className="form-element">
                  <label className="element-label" style={{ fontSize: '0.8rem' }}>
                    Experiencia por Asistencia (XP) *
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
                    style={generalErrors.xp ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                  />
                  {generalErrors.xp && (
                    <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', color: '#dc2626' }}>
                      <i className="bi bi-exclamation-circle-fill"></i>
                      <span>{generalErrors.xp}</span>
                    </div>
                  )}
                </div>

                <div className="form-element">
                  <label className="element-label" style={{ fontSize: '0.8rem' }}>
                    Bambús por Asistencia *
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
                    style={generalErrors.bambus ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                  />
                  {generalErrors.bambus && (
                    <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem', color: '#dc2626' }}>
                      <i className="bi bi-exclamation-circle-fill"></i>
                      <span>{generalErrors.bambus}</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowBonusAdminModal(false)}
                  className="btn btn-outline-dark px-3 py-2"
                  style={{ borderRadius: '10px', fontSize: '0.84rem', fontWeight: 700 }}
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={savingRules}
                  style={{
                    padding: '9px 18px',
                    background: '#c4f039',
                    color: '#111d15',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 900,
                    fontSize: '0.84rem',
                    cursor: savingRules ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingRules ? 'Guardando...' : 'Guardar Puntos Base'}
                </button>
              </div>
            </form>
          ) : (
            <div>
              {bonusFeedback && (
                <div style={{ padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: '10px', fontWeight: 700, fontSize: '0.82rem', marginBottom: '12px' }}>
                  ✓ {bonusFeedback}
                </div>
              )}

              <form onSubmit={handleAddBonus} noValidate style={{ display: 'grid', gap: '12px', marginBottom: '18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  <div className="form-element">
                    <label className="element-label" style={{ fontSize: '0.78rem' }}>Fecha *</label>
                    <input
                      type="date"
                      className={`input-field ${bonusErrors.date ? 'is-invalid' : ''}`}
                      value={newBonusDate}
                      onChange={(e) => {
                        setNewBonusDate(e.target.value)
                        if (bonusErrors.date) setBonusErrors((prev) => ({ ...prev, date: '' }))
                      }}
                      style={bonusErrors.date ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                    />
                    {bonusErrors.date && (
                      <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.76rem', color: '#dc2626' }}>
                        <i className="bi bi-exclamation-circle-fill"></i>
                        <span>{bonusErrors.date}</span>
                      </div>
                    )}
                  </div>

                  <div className="form-element">
                    <label className="element-label" style={{ fontSize: '0.78rem' }}>XP del Día *</label>
                    <input
                      type="number"
                      min="1"
                      className={`input-field ${bonusErrors.xp ? 'is-invalid' : ''}`}
                      value={newBonusXp}
                      onChange={(e) => {
                        setNewBonusXp(e.target.value)
                        if (bonusErrors.xp) setBonusErrors((prev) => ({ ...prev, xp: '' }))
                      }}
                      style={bonusErrors.xp ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                    />
                    {bonusErrors.xp && (
                      <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.76rem', color: '#dc2626' }}>
                        <i className="bi bi-exclamation-circle-fill"></i>
                        <span>{bonusErrors.xp}</span>
                      </div>
                    )}
                  </div>

                  <div className="form-element">
                    <label className="element-label" style={{ fontSize: '0.78rem' }}>Bambús del Día *</label>
                    <input
                      type="number"
                      min="0"
                      className={`input-field ${bonusErrors.bambus ? 'is-invalid' : ''}`}
                      value={newBonusBambus}
                      onChange={(e) => {
                        setNewBonusBambus(e.target.value)
                        if (bonusErrors.bambus) setBonusErrors((prev) => ({ ...prev, bambus: '' }))
                      }}
                      style={bonusErrors.bambus ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                    />
                    {bonusErrors.bambus && (
                      <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.76rem', color: '#dc2626' }}>
                        <i className="bi bi-exclamation-circle-fill"></i>
                        <span>{bonusErrors.bambus}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-element">
                  <label className="element-label" style={{ fontSize: '0.78rem' }}>Nombre de la Promoción / Evento *</label>
                  <input
                    type="text"
                    className={`input-field ${bonusErrors.label ? 'is-invalid' : ''}`}
                    value={newBonusLabel}
                    onChange={(e) => {
                      setNewBonusLabel(e.target.value)
                      if (bonusErrors.label) setBonusErrors((prev) => ({ ...prev, label: '' }))
                    }}
                    placeholder="Ej: Viernes x2 XP o Reto Fin de Semana"
                    style={bonusErrors.label ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                  />
                  {bonusErrors.label && (
                    <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.76rem', color: '#dc2626' }}>
                      <i className="bi bi-exclamation-circle-fill"></i>
                      <span>{bonusErrors.label}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={savingRules}
                    style={{
                      padding: '9px 18px',
                      background: '#c4f039',
                      color: '#111d15',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: 900,
                      fontSize: '0.84rem',
                      cursor: savingRules ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {savingRules ? 'Guardando...' : '+ Asignar Bono'}
                  </button>
                </div>
              </form>

              <h5 style={{ margin: '0 0 8px', fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
                Fechas con Promoción Activa:
              </h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                {Object.entries(xpBonuses).length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Sin fechas especiales configuradas.</p>
                ) : (
                  Object.entries(xpBonuses)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([dStr, bData]) => (
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
                          <strong style={{ fontSize: '0.82rem', color: '#111d15' }}>{dStr}</strong> · {bData.label}
                          <span style={{ marginLeft: '8px', background: '#fef08a', color: '#854d0e', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800 }}>
                            +{bData.xp} XP
                          </span>
                          <span style={{ marginLeft: '6px', background: '#ecfccb', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800 }}>
                            +{bData.bambus ?? generalRewards.baseBambus} bambús
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={savingRules}
                          onClick={() => handleDeleteBonus(dStr)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                          }}
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

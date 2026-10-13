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
  const xpBonuses={}

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

  if(!account) return <div className="attendance-view-container"><h1>{moduleLabel('asistencias',user)}</h1><p role="status">{error || 'Cargando tus registros…'}</p>{error&&<button className="btn btn-dark" onClick={refresh}>Volver a consultar</button>}</div>
  const weekStart=new Date(realNow);weekStart.setDate(realNow.getDate()-((realNow.getDay()+6)%7))
  const weekKey=peruDate(weekStart)
  const weekCount=account.diasAsistidos.filter(d=>d>=weekKey && d<=account.today).length
  return (
    <div className="attendance-view-container">
      {/* ----------------------------------------------------------------------
          BARRA SUPERIOR COMPACTA (TÍTULO Y 4 KPIS EN FILA HORIZONTAL)
          ---------------------------------------------------------------------- */}
      <header className="attendance-top-bar">
        <div className="attendance-title-area">
          <h1>{moduleLabel('asistencias',user)}</h1>
          <p>
            {MONTH_NAMES[month]} {year} · Hoy es {realNow.toLocaleDateString('es-PE',{weekday:'long',day:'numeric'})}. Las inasistencias solo se computan una vez finalizado el día.
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
               <strong>Acceso libre total:</strong> Tu membresía te permite ingresar a sala a cualquier hora dentro del horario de atención del club. No requieres agendar ningún horario fijo.
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
      <ModalDialog isOpen={showBonusAdminModal} onClose={()=>setShowBonusAdminModal(false)} title="Puntos por asistencia" badge="Reglas del club"><p>Cada día con una entrada registrada suma {generalRewards.baseXp} XP y {generalRewards.baseBambus} bambús. Los descansos programados no cortan tu racha. Los canjes descuentan el saldo guardado.</p><button className="btn btn-dark" onClick={()=>setShowBonusAdminModal(false)}>Entendido</button></ModalDialog>
    </div>
  )
}

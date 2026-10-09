import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AttendanceService } from '../services/AttendanceService'
import PandaCharacterSVG from '../components/PandaCharacterSVG'
import ViewTitle from '../components/ViewTitle'

const PANDA_QUOTES = [
  '¡A entrenar duro hoy! 💪',
  '¡Ufff, qué fuerte! 💪🐼',
  '¡Siente ese bombeo muscular! 🔥',
  '¡Una repetición más, no te rindas! ⚡',
  '¡El bambú me da superpoderes! 🎋',
  '¡Hoy rompemos récord en el club! 🏆',
  '¡Disciplina sobre motivación! 🦍',
  '¡Panda fit, socio invencible! ✨',
]

const STAGES = [
  {
    key: 'bebe',
    name: 'Panda Bebé',
    levelLabel: 'Niveles 1-2 · Desde 0 XP',
    desc: 'Pequeño, curioso y juguetón con mancuernitas de goma',
    reqXp: 0,
  },
  {
    key: 'juvenil',
    name: 'Panda Juvenil',
    levelLabel: 'Nivel Intermedio (3-4) · Desde 300 XP',
    desc: 'Activo, con cinta deportiva en la frente y cardio dinámico',
    reqXp: 300,
  },
  {
    key: 'musculoso',
    name: 'Panda Musculoso',
    levelLabel: 'Nivel Avanzado (5+) · Desde 1,000 XP',
    desc: 'Espalda ancha, bíceps definidos y levantamiento olímpico',
    reqXp: 1000,
  },
]

export default function MyPandaView({ token, user }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  // Datos del Panda
  const [pandaData, setPandaData] = useState({
    xp: 1250,
    nivel: 4,
    etapa: 'JUVENIL',
    etapaKey: 'juvenil',
    racha: 3,
    asistenciasMes: 15,
    nextNivelXp: 1500,
    currentLevelBaseXp: 1000,
    xpEnNivel: 250,
    xpFaltante: 250,
    bambusDisponibles: 240,
    bambusGanados: 340,
    hasCheckedInToday: true,
  })

  // Etapa seleccionada en el carrusel interactivo (0: bebe, 1: juvenil, 2: musculoso)
  const [activeStageIndex, setActiveStageIndex] = useState(1)

  // Estados de animación y juego
  const [isTraining, setIsTraining] = useState(false)
  const [repCount, setRepCount] = useState(15)
  const [speechBubbleLeft, setSpeechBubbleLeft] = useState('¡A entrenar duro hoy! 💪')
  const [speechBubbleRight, setSpeechBubbleRight] = useState('¡Disciplina sobre motivación! 🦍')
  const [floatingXp, setFloatingXp] = useState([]) // [{ id, text, offsetX }]

  // Mostrar / Ocultar textos informativos
  const [showInfoDetails, setShowInfoDetails] = useState(true)

  // Notificación temporal
  const [notification, setNotification] = useState('')

  useEffect(() => {
    loadPandaStatus()
  }, [])

  async function loadPandaStatus() {
    try {
      const res = await AttendanceService.getPandaStatus(token)
      if (res) {
        setPandaData((prev) => ({
          ...prev,
          xp: res.xp ?? prev.xp,
          nivel: res.nivel ?? prev.nivel,
          etapa: res.etapa ?? prev.etapa,
          etapaKey: res.etapaKey ?? prev.etapaKey,
          racha: res.racha ?? prev.racha,
          bambusDisponibles: res.bambusDisponibles ?? prev.bambusDisponibles,
          nextNivelXp: res.nextNivelXp ?? prev.nextNivelXp,
          currentLevelBaseXp: res.currentLevelBaseXp ?? prev.currentLevelBaseXp,
          xpEnNivel: res.xpEnNivel ?? prev.xpEnNivel,
          xpFaltante: res.xpFaltante ?? prev.xpFaltante,
        }))

        // Asignar índice inicial según nivel
        if (res.etapaKey === 'bebe') setActiveStageIndex(0)
        else if (res.etapaKey === 'musculoso') setActiveStageIndex(2)
        else setActiveStageIndex(1)
      }
    } catch {
      // Conservar valores iniciales
    } finally {
      setLoading(false)
    }
  }

  // Tocar al Panda para entrenar
  function handlePandaTap(e) {
    setIsTraining(true)
    setRepCount((prev) => prev + 1)

    // Cambiar frase de motivación al azar
    const randomQuote = PANDA_QUOTES[Math.floor(Math.random() * PANDA_QUOTES.length)]
    if (Math.random() > 0.5) {
      setSpeechBubbleLeft(randomQuote)
    } else {
      setSpeechBubbleRight(randomQuote)
    }

    // Vibración si el dispositivo la soporta
    if (navigator?.vibrate) {
      navigator.vibrate(40)
    }

    // Efecto de burbuja flotante +5 XP
    const newId = Date.now() + Math.random()
    const offsetX = (Math.random() - 0.5) * 80
    setFloatingXp((prev) => [...prev, { id: newId, text: '+5 XP 💥', offsetX }])

    setTimeout(() => {
      setFloatingXp((prev) => prev.filter((item) => item.id !== newId))
    }, 1200)

    setTimeout(() => {
      setIsTraining(false)
    }, 650)
  }

  // Simular o alternar asistencia de hoy
  function handleToggleCheckIn() {
    setPandaData((prev) => {
      const nextChecked = !prev.hasCheckedInToday
      const xpIncrement = nextChecked ? 100 : 0
      const nextXp = prev.xp + xpIncrement
      return {
        ...prev,
        hasCheckedInToday: nextChecked,
        xp: nextXp,
        racha: nextChecked ? prev.racha + 1 : Math.max(0, prev.racha - 1),
        asistenciasMes: nextChecked ? prev.asistenciasMes + 1 : Math.max(0, prev.asistenciasMes - 1),
        bambusDisponibles: nextChecked ? prev.bambusDisponibles + 15 : prev.bambusDisponibles,
      }
    })

    if (!pandaData.hasCheckedInToday) {
      setNotification('🎉 ¡Asistencia registrada! +100 XP y +15 Bambús añadidos a tu cuenta.')
    } else {
      setNotification('ℹ️ Asistencia alternada para pruebas.')
    }
    setTimeout(() => setNotification(''), 3000)
  }

  // Alimentar al Panda con 1 Bambú
  function handleFeedPanda() {
    if (pandaData.bambusDisponibles < 1) {
      setNotification('🎋 No tienes suficientes bambús disponibles para alimentar a tu Pandita.')
      setTimeout(() => setNotification(''), 2500)
      return
    }

    setPandaData((prev) => ({
      ...prev,
      bambusDisponibles: prev.bambusDisponibles - 1,
      xp: prev.xp + 10,
    }))
    setSpeechBubbleRight('¡Ñam! ¡El bambú me da fuerza! 🎋✨')
    setIsTraining(true)
    setTimeout(() => setIsTraining(false), 900)

    setNotification('🎋 ¡Le diste un bambú a tu Pandita! +10 XP de energía')
    setTimeout(() => setNotification(''), 2500)
  }

  // Navegar carrusel hacia la izquierda
  function handlePrevStage() {
    setActiveStageIndex((prev) => (prev > 0 ? prev - 1 : STAGES.length - 1))
  }

  // Navegar carrusel hacia la derecha
  function handleNextStage() {
    setActiveStageIndex((prev) => (prev < STAGES.length - 1 ? prev + 1 : 0))
  }

  const currentStage = STAGES[activeStageIndex]
  const prevStageIndex = (activeStageIndex - 1 + STAGES.length) % STAGES.length
  const nextStageIndex = (activeStageIndex + 1) % STAGES.length
  const prevStage = STAGES[prevStageIndex]
  const nextStage = STAGES[nextStageIndex]

  // Cálculo de porcentaje de barra de progreso
  const progressPercent = Math.min(
    100,
    Math.round(
      ((pandaData.xp - pandaData.currentLevelBaseXp) /
        (pandaData.nextNivelXp - pandaData.currentLevelBaseXp)) *
        100
    ) || 75
  )

  return (
    <div className="dashboard-page" style={{ maxWidth: '1360px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* HEADER DE LA VISTA ADAPTADO A COMPUTADORA */}
      <div className="view-header-row d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <ViewTitle
            title="Mi Pandita Fit (Gamificación & Hábitos)"
            text="Tu compañero virtual de entrenamiento. Suma experiencia con cada visita, evoluciona de nivel y canjea tus bambús por beneficios reales."
          />
        </div>

        {/* CHIPS DE RESUMEN SUPERIOR */}
        <div className="d-flex flex-wrap align-items-center gap-2">
          <div
            style={{
              background: '#111d15',
              border: '1px solid #233c2a',
              borderRadius: '12px',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 800,
            }}
          >
            <span style={{ color: '#c4f039' }}>⭐ NIVEL {pandaData.nivel}</span>
            <span style={{ color: '#64748b' }}>•</span>
            <span style={{ color: '#94a3b8' }}>{currentStage.name}</span>
          </div>

          <div
            style={{
              background: '#111d15',
              border: '1px solid rgba(249, 115, 22, 0.4)',
              borderRadius: '12px',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#f97316',
              fontSize: '0.85rem',
              fontWeight: 800,
            }}
          >
            <span>🔥 RACHA: {pandaData.racha} DÍAS</span>
          </div>

          <div
            style={{
              background: '#111d15',
              border: '1px solid rgba(196, 240, 57, 0.4)',
              borderRadius: '12px',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#c4f039',
              fontSize: '0.85rem',
              fontWeight: 800,
            }}
          >
            <span>🎋 {pandaData.bambusDisponibles} BAMBÚS</span>
          </div>
        </div>
      </div>

      {/* NOTIFICACIÓN FLOTANTE / TOAST */}
      {notification && (
        <div
          style={{
            background: '#c4f039',
            color: '#111d15',
            padding: '12px 20px',
            borderRadius: '14px',
            fontWeight: 800,
            fontSize: '0.9rem',
            textAlign: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            marginBottom: '20px',
            animation: 'fadeIn 0.25s ease',
          }}
        >
          {notification}
        </div>
      )}

      {/* GRID PRINCIPAL RESPONSIVE ADAPTADO A COMPUTADORA */}
      <div className="pandita-desktop-grid">
        {/* COLUMNA IZQUIERDA: ARENA DEL PANDA & EVOLUCIÓN */}
        <div className="pandita-left-col">
          {/* ARENA CARD */}
          <div
            style={{
              background: 'linear-gradient(145deg, #0d1510 0%, #132218 100%)',
              borderRadius: '24px',
              border: '1.5px solid #1f3325',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)',
              padding: '28px 24px',
              marginBottom: '24px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* BARRA DE PROGRESO DE NIVEL Y XP */}
            <div style={{ marginBottom: '24px' }}>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                <div>
                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      color: '#84cc16',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    PROGRESO DE ENTRENAMIENTO
                  </span>
                  <h3
                    style={{
                      fontSize: '1.18rem',
                      fontWeight: 900,
                      color: '#ffffff',
                      margin: '2px 0 0 0',
                    }}
                  >
                    NIVEL {pandaData.nivel} · <span style={{ color: '#c4f039' }}>{currentStage.name}</span>
                  </h3>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 900,
                      color: '#c4f039',
                      background: 'rgba(196, 240, 57, 0.12)',
                      border: '1px solid rgba(196, 240, 57, 0.3)',
                      padding: '4px 10px',
                      borderRadius: '999px',
                    }}
                  >
                    ▲ +100 XP por Asistencia
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 900,
                      color: '#a3e635',
                      background: 'rgba(163, 230, 53, 0.1)',
                      border: '1px solid rgba(163, 230, 53, 0.25)',
                      padding: '4px 10px',
                      borderRadius: '999px',
                    }}
                  >
                    🎋 +15 Bambús
                  </span>
                </div>
              </div>

              {/* BARRA GLOW DE XP */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '16px',
                  background: '#09100a',
                  borderRadius: '9999px',
                  border: '1px solid #1f3325',
                  overflow: 'visible',
                  marginBottom: '8px',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)',
                }}
              >
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    borderRadius: '9999px',
                    background: 'linear-gradient(90deg, #65a30d 0%, #84cc16 50%, #c4f039 100%)',
                    boxShadow: '0 0 16px rgba(196, 240, 57, 0.7), 0 0 4px #c4f039',
                    transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    right: '-4px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, #fde047 0%, #ca8a04 100%)',
                    border: '2px solid #ffffff',
                    boxShadow: '0 0 12px rgba(253, 224, 71, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                  }}
                >
                  ⭐
                </div>
              </div>

              <div className="d-flex justify-content-between align-items-center" style={{ fontSize: '0.78rem', fontWeight: 800 }}>
                <span style={{ color: '#94a3b8' }}>
                  {pandaData.xp.toLocaleString()} / {pandaData.nextNivelXp.toLocaleString()} XP ({progressPercent}%)
                </span>
                <span style={{ color: '#c4f039' }}>
                  Faltan {(pandaData.nextNivelXp - pandaData.xp).toLocaleString()} XP para Nivel {pandaData.nivel + 1}
                </span>
              </div>
            </div>

            {/* ESCENARIO DEL PANDA INTERACTIVO */}
            <div
              style={{
                position: 'relative',
                background: 'radial-gradient(circle at 50% 50%, #15271a 0%, #0a110c 75%)',
                borderRadius: '24px',
                border: '1px solid rgba(196, 240, 57, 0.2)',
                padding: '32px 20px 24px',
                overflow: 'hidden',
                marginBottom: '20px',
              }}
            >
              {/* Estrellas doradas */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '12px',
                  fontSize: '1.4rem',
                  marginBottom: '10px',
                  filter: 'drop-shadow(0 0 10px rgba(250, 204, 21, 0.75))',
                }}
              >
                <span>⭐</span>
                <span style={{ transform: 'translateY(-6px)' }}>⭐</span>
                <span>⭐</span>
              </div>

              {/* Burbujas de diálogo motivacionales */}
              <div style={{ position: 'relative', height: '42px', marginBottom: '8px' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: 0,
                    background: '#c4f039',
                    color: '#111d15',
                    padding: '6px 14px',
                    borderRadius: '14px 14px 0 14px',
                    fontSize: '0.82rem',
                    fontWeight: 900,
                    boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    animation: 'bounce 2.5s infinite',
                  }}
                  onClick={handlePandaTap}
                >
                  {speechBubbleLeft}
                </div>

                <div
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: 0,
                    background: '#c4f039',
                    color: '#111d15',
                    padding: '6px 14px',
                    borderRadius: '14px 14px 14px 0',
                    fontSize: '0.82rem',
                    fontWeight: 900,
                    boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                  onClick={handlePandaTap}
                >
                  {speechBubbleRight}
                </div>
              </div>

              {/* Escenario y controles de etapa */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                {/* Botón Izquierdo Etapa */}
                <button
                  type="button"
                  onClick={handlePrevStage}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '16px',
                    padding: '12px 14px',
                    color: '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                    minWidth: '78px',
                  }}
                  title={`Ver ${prevStage.name}`}
                >
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#c4f039' }}>‹</div>
                  <div style={{ fontSize: '1.4rem' }}>🐼</div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, marginTop: '2px' }}>
                    {prevStage.name}
                  </div>
                </button>

                {/* Personaje SVG interactivo */}
                <div style={{ flex: '1 1 auto', position: 'relative', textAlign: 'center' }}>
                  <PandaCharacterSVG
                    stage={currentStage.key}
                    isTraining={isTraining}
                    reps={repCount}
                    onPandaTap={handlePandaTap}
                  />

                  {/* Burbujas flotantes de XP */}
                  {floatingXp.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        position: 'absolute',
                        top: '40%',
                        left: `calc(50% + ${item.offsetX}px)`,
                        transform: 'translate(-50%, -50%)',
                        background: '#c4f039',
                        color: '#111d15',
                        padding: '6px 14px',
                        borderRadius: '9999px',
                        fontSize: '0.85rem',
                        fontWeight: 900,
                        pointerEvents: 'none',
                        animation: 'floatUp 1.2s forwards',
                        boxShadow: '0 4px 16px rgba(196, 240, 57, 0.7)',
                        zIndex: 20,
                      }}
                    >
                      {item.text}
                    </div>
                  ))}
                </div>

                {/* Botón Derecho Etapa */}
                <button
                  type="button"
                  onClick={handleNextStage}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '16px',
                    padding: '12px 14px',
                    color: '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                    minWidth: '78px',
                  }}
                  title={`Ver ${nextStage.name}`}
                >
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#c4f039' }}>›</div>
                  <div style={{ fontSize: '1.4rem' }}>🦍</div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, marginTop: '2px' }}>
                    {nextStage.name}
                  </div>
                </button>
              </div>

              {/* Indicadores y datos de la etapa */}
              <div style={{ textAlign: 'center', marginTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                  {STAGES.map((s, idx) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setActiveStageIndex(idx)}
                      style={{
                        width: idx === activeStageIndex ? '24px' : '8px',
                        height: '8px',
                        borderRadius: '9999px',
                        border: 'none',
                        background: idx === activeStageIndex ? '#c4f039' : 'rgba(255, 255, 255, 0.2)',
                        cursor: 'pointer',
                        transition: 'all 0.25s',
                        padding: 0,
                      }}
                    />
                  ))}
                </div>

                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#ffffff' }}>
                  {currentStage.name}
                </div>
                <div style={{ fontSize: '0.84rem', color: '#84cc16', fontWeight: 800 }}>
                  {currentStage.levelLabel}
                </div>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
                  {currentStage.desc}
                </p>
              </div>
            </div>

            {/* BOTONES DE ENTRENAMIENTO Y ALIMENTACIÓN */}
            <div className="d-flex flex-wrap justify-content-center align-items-center gap-3">
              <button
                type="button"
                onClick={handlePandaTap}
                style={{
                  background: '#1a2e21',
                  border: '1.5px solid #c4f039',
                  color: '#c4f039',
                  padding: '12px 28px',
                  borderRadius: '14px',
                  fontSize: '0.92rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(196, 240, 57, 0.2)',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>💪</span>
                <span>¡Hacer Repetición! ({repCount})</span>
              </button>

              <button
                type="button"
                onClick={handleFeedPanda}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1.5px solid rgba(255,255,255,0.18)',
                  color: '#ffffff',
                  padding: '12px 24px',
                  borderRadius: '14px',
                  fontSize: '0.92rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>🎋</span>
                <span>Dar Bambú (-1) (+10 XP)</span>
              </button>
            </div>
          </div>

          {/* GALERÍA DE LAS 3 ETAPAS DE EVOLUCIÓN */}
          <div
            style={{
              background: '#0d1510',
              borderRadius: '20px',
              border: '1px solid #1f3325',
              padding: '20px 24px',
            }}
          >
            <h4 style={{ fontSize: '0.96rem', fontWeight: 900, color: '#ffffff', marginBottom: '14px' }}>
              🧬 Fases de Evolución del Panda
            </h4>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '14px',
              }}
            >
              {STAGES.map((stg, i) => {
                const isCurrent = i === activeStageIndex
                return (
                  <div
                    key={stg.key}
                    onClick={() => setActiveStageIndex(i)}
                    style={{
                      background: isCurrent ? '#16271c' : '#111d15',
                      border: isCurrent ? '1.5px solid #c4f039' : '1px solid #1f3325',
                      borderRadius: '16px',
                      padding: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span style={{ fontSize: '1.4rem' }}>{i === 2 ? '🦍' : '🐼'}</span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: isCurrent ? '#c4f039' : 'rgba(255,255,255,0.08)',
                          color: isCurrent ? '#111d15' : '#94a3b8',
                        }}
                      >
                        {isCurrent ? 'ACTIVO' : stg.reqXp <= pandaData.xp ? 'DESBLOQUEADO' : 'BLOQUEADO 🔒'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#ffffff' }}>
                      {stg.name}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#84cc16', fontWeight: 700, margin: '2px 0 4px' }}>
                      {stg.levelLabel}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.3 }}>
                      {stg.desc}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: ASISTENCIAS, MÉTRICAS, TIENDA Y GUÍA */}
        <div className="pandita-right-col">
          {/* CARD DE ASISTENCIA DEL DÍA (CHECK-IN) */}
          <div
            onClick={handleToggleCheckIn}
            style={{
              background: 'linear-gradient(135deg, #112015 0%, #15271b 100%)',
              border: '2px solid #84cc16',
              borderRadius: '20px',
              padding: '20px',
              marginBottom: '20px',
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(132, 204, 22, 0.2)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            title="Toca para registrar o simular asistencia"
          >
            <div className="d-flex align-items-center gap-3">
              <div
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '16px',
                  background: '#c4f039',
                  color: '#111d15',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.6rem',
                  fontWeight: 900,
                  flexShrink: 0,
                  boxShadow: '0 0 14px rgba(196, 240, 57, 0.5)',
                }}
              >
                ✓
              </div>
              <div>
                <div
                  style={{
                    fontSize: '0.96rem',
                    fontWeight: 900,
                    color: '#c4f039',
                    lineHeight: 1.25,
                  }}
                >
                  {pandaData.hasCheckedInToday
                    ? '🏆 ¡ASISTENCIA DEL DÍA REGISTRADA EN RECEPCIÓN!'
                    : '⚡ REGISTRAR ASISTENCIA DE HOY (+100 XP)'}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '4px' }}>
                  {pandaData.hasCheckedInToday
                    ? 'Check-in validado en torniquete. ¡Excelente disciplina!'
                    : 'Pasa por recepción o simula tu entrenamiento diario.'}
                </div>
              </div>
            </div>
          </div>

          {/* MÉTRICAS DE HÁBITOS & ENTRENAMIENTO */}
          <div
            style={{
              background: '#0d1510',
              borderRadius: '20px',
              border: '1px solid #1f3325',
              padding: '20px',
              marginBottom: '20px',
            }}
          >
            <h4 style={{ fontSize: '0.94rem', fontWeight: 900, color: '#ffffff', marginBottom: '14px' }}>
              📊 Estadísticas de Rendimiento
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              {/* Asistencias este mes */}
              <div
                style={{
                  background: '#152219',
                  borderRadius: '16px',
                  padding: '14px',
                  border: '1px solid #233c2a',
                }}
              >
                <div className="d-flex align-items-center gap-2 mb-1">
                  <span style={{ fontSize: '1.3rem' }}>📅</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8' }}>ESTE MES</span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff' }}>
                  {pandaData.asistenciasMes}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#84cc16', fontWeight: 700 }}>
                  Asistencias registradas
                </div>
              </div>

              {/* Racha activa */}
              <div
                style={{
                  background: '#152219',
                  borderRadius: '16px',
                  padding: '14px',
                  border: '1px solid #233c2a',
                }}
              >
                <div className="d-flex align-items-center gap-2 mb-1">
                  <span style={{ fontSize: '1.3rem', animation: 'pulse 1.5s infinite' }}>🔥</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8' }}>RACHA</span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f97316' }}>
                  {pandaData.racha} Días
                </div>
                <div style={{ fontSize: '0.7rem', color: '#fdba74', fontWeight: 700 }}>
                  Fuego de disciplina
                </div>
              </div>
            </div>

            {/* Saldo de Bambús */}
            <div
              style={{
                background: '#152219',
                borderRadius: '16px',
                padding: '14px',
                border: '1px solid #233c2a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div className="d-flex align-items-center gap-3">
                <span style={{ fontSize: '1.8rem' }}>🎋</span>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8' }}>
                    SALDO DISPONIBLE
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#c4f039' }}>
                    {pandaData.bambusDisponibles} Bambús
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/app/recompensas')}
                style={{
                  background: '#c4f039',
                  color: '#111d15',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '10px',
                  fontWeight: 900,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                Canjear
              </button>
            </div>
          </div>

          {/* ACCESOS DIRECTOS */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginBottom: '20px',
            }}
          >
            <button
              type="button"
              onClick={() => navigate('/app/recompensas')}
              style={{
                background: '#142218',
                border: '1.5px solid #c4f039',
                borderRadius: '16px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div className="d-flex align-items-center gap-3">
                <span style={{ fontSize: '1.3rem' }}>🎁</span>
                <span>Tienda de Premios & Descuentos</span>
              </div>
              <span style={{ color: '#c4f039' }}>➔</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/app/asistencias')}
              style={{
                background: '#142218',
                border: '1px solid #233c2a',
                borderRadius: '16px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div className="d-flex align-items-center gap-3">
                <span style={{ fontSize: '1.3rem' }}>📖</span>
                <span>Historial de Asistencias & XP</span>
              </div>
              <span style={{ color: '#94a3b8' }}>➔</span>
            </button>
          </div>

          {/* GUÍA Y REGLAS DEL JUEGO */}
          <div
            style={{
              background: '#0d1510',
              borderRadius: '20px',
              border: '1px solid #1f3325',
              padding: '20px',
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h4 style={{ fontSize: '0.94rem', fontWeight: 900, color: '#c4f039', margin: 0 }}>
                🎮 Reglas y Guía de Gamificación
              </h4>
              <button
                type="button"
                onClick={() => setShowInfoDetails((prev) => !prev)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#84cc16',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {showInfoDetails ? 'Ocultar' : 'Expandir'}
              </button>
            </div>

            {showInfoDetails ? (
              <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.55 }}>
                <div style={{ marginBottom: '10px' }}>
                  <strong style={{ color: '#c4f039' }}>⚡ +100 XP por Asistencia:</strong>
                  <p style={{ margin: '2px 0 0 0', color: '#94a3b8' }}>
                    Cada check-in en el club suma experiencia a tu Panda y acelera su paso al siguiente nivel.
                  </p>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <strong style={{ color: '#f97316' }}>🔥 Racha de Disciplina:</strong>
                  <p style={{ margin: '2px 0 0 0', color: '#94a3b8' }}>
                    No dejes pasar más de 48 horas sin entrenar para mantener tu racha y ganar bambús extra.
                  </p>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <strong style={{ color: '#38bdf8' }}>🐼 Evolución Física:</strong>
                  <p style={{ margin: '2px 0 0 0', color: '#94a3b8' }}>
                    0 XP: Panda Bebé · 300 XP: Panda Juvenil · 1,000 XP: Panda Musculoso.
                  </p>
                </div>
                <div>
                  <strong style={{ color: '#a855f7' }}>🎋 Premios Reales:</strong>
                  <p style={{ margin: '2px 0 0 0', color: '#94a3b8' }}>
                    Canjea tus bambús acumulados directamente en recepción por shakes de proteína, pases y merchandising oficial.
                  </p>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
                Suma +100 XP por cada visita al gimnasio, mantén tu racha activa y evoluciona tu Panda de Bebé a Musculoso para canjear premios.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ESTILOS CSS RESPONSIVOS PARA EL GRID DE COMPUTADORA Y MÓVIL */}
      <style>{`
        .pandita-desktop-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(360px, 0.85fr);
          gap: 24px;
          align-items: start;
        }
        @media (max-width: 992px) {
          .pandita-desktop-grid {
            grid-template-columns: 1fr;
          }
        }
        @keyframes floatUp {
          0% { opacity: 0; transform: translate(-50%, 0) scale(0.8); }
          30% { opacity: 1; transform: translate(-50%, -20px) scale(1.1); }
          100% { opacity: 0; transform: translate(-50%, -60px) scale(0.9); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}

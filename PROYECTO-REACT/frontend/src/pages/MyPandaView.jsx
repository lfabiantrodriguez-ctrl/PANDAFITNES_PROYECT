import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { canAccess } from '../utils/access'
import usePandaAccount from '../hooks/usePandaAccount'
import PandaCharacterSVG from '../components/PandaCharacterSVG'

const PANDA_QUOTES = [
  '¡A entrenar duro hoy! Sin excusas.',
  '¡Ufff, qué buen bombeo muscular!',
  '¡Una repetición más, tú puedes!',
  '¡La disciplina vence a la motivación!',
  '¡El bambú y las pesas me dan poder!',
  '¡Hoy rompemos récords en el club!',
  '¡Panda fit, socio invencible!',
  '¡Constancia diaria, resultados reales!',
]

const PANDA_SNACKS = [
  {
    id: 'bambu',
    name: 'Brote de Bambú',
    shortName: 'Bambú',
    hint: 'Snack favorito',
    emoji: '🎋',
    energy: 25,
    quote: '¡Mmm, qué fresco este bambú! ¡Energía al máximo!',
    popText: '+Energía Bambú',
    accentBg: '#f0fdf4',
    accentBorder: '#86efac',
  },
  {
    id: 'batido',
    name: 'Batido Proteico',
    shortName: 'Batido',
    hint: 'Recuperación',
    emoji: '🥤',
    energy: 30,
    quote: '¡Pura proteína para seguir levantando fuerte!',
    popText: '+Fuerza Pro',
    accentBg: '#fefce8',
    accentBorder: '#fde047',
  },
  {
    id: 'agua',
    name: 'Agua Mineral',
    shortName: 'Agua',
    hint: 'Hidratación',
    emoji: '💧',
    energy: 20,
    quote: '¡Bien hidratado para romper récords hoy!',
    popText: '+Hidratación',
    accentBg: '#f0f9ff',
    accentBorder: '#7dd3fc',
  },
]

const STAGES = [
  {
    index: 0,
    key: 'bebe',
    name: '01 · Panda Bebé',
    shortName: 'Bebé',
    levelLabel: 'Niveles 1-2 · 0 a 299 XP',
    desc: 'Cuerpo pequeño y redondeado, etapa inicial de aprendizaje y técnica.',
    reqXp: 0,
    iconClass: 'bi-egg-fill',
  },
  {
    index: 1,
    key: 'intermedio',
    name: '02 · Panda Intermedio',
    shortName: 'Intermedio',
    levelLabel: 'Niveles 3-4 · 300 a 999 XP',
    desc: 'Postura atlética, mayor tono muscular en pecho, hombros y brazos.',
    reqXp: 300,
    iconClass: 'bi-lightning-fill',
  },
  {
    index: 2,
    key: 'musculoso',
    name: '03 · Panda Musculoso',
    shortName: 'Musculoso',
    levelLabel: 'Nivel Avanzado 5+ · 1,000+ XP',
    desc: 'Físico imponente, músculos marcados y fuerza máxima.',
    reqXp: 1000,
    iconClass: 'bi-shield-shaded',
  },
]

export default function MyPandaView({ token, user }) {
  const navigate = useNavigate()
  const { data: pandaData, error, refresh } = usePandaAccount(token)

  // Etapa visible en pantalla (por defecto coincide con la etapa real del socio)
  const [activeStageIndex, setActiveStageIndex] = useState(0)

  // Interacción con el Panda 2D
  const [isTraining, setIsTraining] = useState(false)
  const [repCount, setRepCount] = useState(0)
  const [sessionEnergy, setSessionEnergy] = useState(40)
  const [draggingSnack, setDraggingSnack] = useState(null)
  const [isDragOverPanda, setIsDragOverPanda] = useState(false)
  const [speechBubble, setSpeechBubble] = useState('¡A entrenar duro hoy! Sin excusas.')
  const [floatingXp, setFloatingXp] = useState([])
  const speechTimerRef = useRef(null)

  // Modales informativos conectados a datos reales
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [showEvolutionModal, setShowEvolutionModal] = useState(false)
  const [showStreakModal, setShowStreakModal] = useState(false)
  const [showBambusModal, setShowBambusModal] = useState(false)
  const [showGuideModal, setShowGuideModal] = useState(false)

  function showTimedSpeech(message) {
    setSpeechBubble(message)
    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current)
    }
    speechTimerRef.current = setTimeout(() => {
      setSpeechBubble('')
    }, 10000)
  }

  useEffect(() => {
    speechTimerRef.current = setTimeout(() => {
      setSpeechBubble('')
    }, 10000)
    return () => {
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (pandaData) {
      setActiveStageIndex({ bebe: 0, intermedio: 1, musculoso: 2 }[pandaData.etapaKey] ?? 0)
    }
  }, [pandaData?.etapaKey])

  function triggerFloatingPop(text) {
    const newId = Date.now() + Math.random()
    const offsetX = (Math.random() - 0.5) * 90
    setFloatingXp((prev) => [...prev, { id: newId, text, offsetX }])

    setTimeout(() => {
      setFloatingXp((prev) => prev.filter((item) => item.id !== newId))
    }, 1050)
  }

  function handlePandaTap(e) {
    if (e && e.stopPropagation) e.stopPropagation()
    setIsTraining(true)
    setRepCount((prev) => prev + 1)
    setSessionEnergy((prev) => Math.min(100, prev + 8))

    const randomQuote = PANDA_QUOTES[Math.floor(Math.random() * PANDA_QUOTES.length)]
    showTimedSpeech(randomQuote)

    if (navigator?.vibrate) {
      navigator.vibrate(35)
    }

    triggerFloatingPop('¡Vamos!')

    setTimeout(() => {
      setIsTraining(false)
    }, 520)
  }

  function handleFeedPanda(snack) {
    if (!snack) return
    setIsTraining(true)
    setRepCount((prev) => prev + 1)
    setSessionEnergy((prev) => Math.min(100, prev + snack.energy))
    showTimedSpeech(snack.quote)
    triggerFloatingPop(`${snack.emoji} ${snack.popText}`)

    if (navigator?.vibrate) {
      navigator.vibrate([30, 20, 30])
    }

    setTimeout(() => {
      setIsTraining(false)
    }, 620)
  }

  function handlePrevStage() {
    setActiveStageIndex((prev) => (prev > 0 ? prev - 1 : STAGES.length - 1))
  }

  function handleNextStage() {
    setActiveStageIndex((prev) => (prev < STAGES.length - 1 ? prev + 1 : 0))
  }

  if (!pandaData) {
    return (
      <div
        className="panda-view-wrapper"
        style={{ display: 'grid', placeItems: 'center', color: '#111d15', minHeight: '420px' }}
      >
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <p role="status" style={{ fontWeight: 600, color: '#5f7165', marginBottom: '12px' }}>
            {error || 'Cargando tu pandita…'}
          </p>
          {error && (
            <button type="button" className="btn btn-outline-success btn-sm fw-bold" onClick={refresh}>
              Volver a consultar
            </button>
          )}
        </div>
      </div>
    )
  }

  const realStageIndex = { bebe: 0, intermedio: 1, musculoso: 2 }[pandaData.etapaKey] ?? 0
  const currentStage = STAGES[activeStageIndex]
  const isCurrentUserStage = activeStageIndex === realStageIndex
  const isStageUnlocked = Number(pandaData.xp || 0) >= currentStage.reqXp

  const progressPercent = Math.min(
    100,
    Math.round(
      ((pandaData.xp - pandaData.currentLevelBaseXp) /
        Math.max(1, pandaData.nextNivelXp - pandaData.currentLevelBaseXp)) *
        100
    )
  )

  const canGoRewards = canAccess(user, 'recompensas') || canAccess(user, 'mis-recompensas')
  const rewardsRoute = canAccess(user, 'recompensas') ? '/app/recompensas' : '/app/mis-recompensas'
  const canGoAttendance = canAccess(user, 'asistencias')

  return (
    <div className="panda-view-wrapper">
      {/* ======================================================== */}
      {/* FILA SUPERIOR: SELECTOR DE ETAPA Y ACCESOS DE INFO       */}
      {/* ======================================================== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          width: '100%',
        }}
      >
        {/* Selector de etapa + estado real de desbloqueo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#f8faf7',
              border: '1px solid #d9e4d7',
              borderRadius: '999px',
              padding: '4px 10px',
            }}
          >
            <button
              type="button"
              onClick={handlePrevStage}
              aria-label="Etapa anterior"
              style={{
                background: '#ffffff',
                border: '1px solid #dbe4da',
                color: '#166534',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <i className="bi bi-chevron-left"></i>
            </button>

            <button
              type="button"
              onClick={() => setShowEvolutionModal(true)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '2px 8px',
                fontSize: '0.9rem',
                fontWeight: 800,
                color: '#111d15',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
              title="Ver etapas de evolución"
            >
              <i className={`bi ${currentStage.iconClass}`} style={{ color: '#166534' }}></i>
              <span>{currentStage.name}</span>
            </button>

            <button
              type="button"
              onClick={handleNextStage}
              aria-label="Etapa siguiente"
              style={{
                background: '#ffffff',
                border: '1px solid #dbe4da',
                color: '#166534',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>

          <span
            style={{
              padding: '5px 12px',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 800,
              background: isCurrentUserStage ? '#ecfccb' : isStageUnlocked ? '#f0fdf4' : '#f1f5f9',
              color: isCurrentUserStage ? '#166534' : isStageUnlocked ? '#15803d' : '#475569',
              border: `1px solid ${isCurrentUserStage ? '#bef264' : '#dbe4da'}`,
            }}
          >
            {isCurrentUserStage
              ? 'Tu etapa actual'
              : isStageUnlocked
              ? 'Etapa desbloqueada'
              : `Requiere ${currentStage.reqXp} XP`}
          </span>
        </div>

        {/* Botones de información alineados a la derecha */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowEvolutionModal(true)}
            style={{
              padding: '8px 14px',
              borderRadius: '12px',
              background: '#f8faf7',
              border: '1px solid #d9e4d7',
              color: '#111d15',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="bi bi-award-fill" style={{ color: '#166534' }}></i>
            <span>Evolución</span>
          </button>

          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            style={{
              padding: '8px 14px',
              borderRadius: '12px',
              background: '#f8faf7',
              border: '1px solid #d9e4d7',
              color: '#111d15',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="bi bi-question-circle-fill" style={{ color: '#5f7165' }}></i>
            <span>Guía</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* ESCENARIO PRINCIPAL: SNACKS + PANDA + META EVOLUCIÓN     */}
      {/* ======================================================== */}
      <div className="panda-stage-canvas">
        <div className="panda-stage-arena">
          {/* Columna Izquierda: Comida / Snacks arrastrables tipo Pou */}
          <aside className="panda-side-card panda-arena-snacks" aria-label="Alimentos para tu panda">
            <div>
              <h6 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#111d15' }}>
                Alimenta a tu panda
              </h6>
              <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: '#5f7165' }}>
                Arrastra hacia el panda o toca para darle
              </p>
            </div>

            <div className="panda-snacks-list">
              {PANDA_SNACKS.map((snack) => (
                <button
                  key={snack.id}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    setDraggingSnack(snack)
                    if (e.dataTransfer) {
                      e.dataTransfer.setData('text/plain', snack.id)
                      e.dataTransfer.effectAllowed = 'move'
                    }
                  }}
                  onDragEnd={() => {
                    setDraggingSnack(null)
                    setIsDragOverPanda(false)
                  }}
                  onClick={() => handleFeedPanda(snack)}
                  title={`Arrastra o toca para darle ${snack.name}`}
                  style={{
                    background: snack.accentBg,
                    border: `1.5px solid ${snack.accentBorder}`,
                    borderRadius: '14px',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'grab',
                    textAlign: 'left',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '1.5rem', lineHeight: 1, flexShrink: 0 }} aria-hidden="true">
                    {snack.emoji}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#111d15', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {snack.shortName}
                    </div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#5f7165' }}>
                      {snack.hint}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* Columna Central: Burbuja grande arriba + Panda 2D interactivo */}
          <div
            className="panda-arena-center"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              padding: '6px 0',
            }}
          >
            {/* Burbuja de diálogo grande sobre el panda (dura 10s y desaparece sin mover al panda) */}
            <div style={{ minHeight: '86px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              {speechBubble && (
                <button
                  type="button"
                  onClick={handlePandaTap}
                  title="Toca para motivar a tu panda"
                  className="panda-speech-bubble"
                >
                  <i className="bi bi-chat-quote-fill" style={{ color: '#166534', fontSize: '1.2rem', flexShrink: 0 }}></i>
                  <span>{speechBubble}</span>
                </button>
              )}
            </div>

            {/* Zona de Drop + Halo circular centrado sin bordes rectangulares */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                if (!isDragOverPanda) setIsDragOverPanda(true)
              }}
              onDragLeave={() => setIsDragOverPanda(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragOverPanda(false)
                const snackId = e.dataTransfer?.getData('text/plain')
                const found = draggingSnack || PANDA_SNACKS.find((s) => s.id === snackId)
                if (found) handleFeedPanda(found)
                setDraggingSnack(null)
              }}
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: '380px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: '999px',
                outline: isDragOverPanda ? '3px dashed #84cc16' : '3px dashed transparent',
                outlineOffset: '6px',
                background: isDragOverPanda ? 'rgba(196, 240, 57, 0.14)' : 'transparent',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Halo circular puro que muere antes de los bordes */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  width: 'min(70vw, 310px)',
                  height: 'min(70vw, 310px)',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(196, 240, 57, 0.24) 0%, rgba(196, 240, 57, 0) 70%)',
                  pointerEvents: 'none',
                }}
              />

              <PandaCharacterSVG
                stage={currentStage.key}
                isTraining={isTraining}
                onPandaTap={handlePandaTap}
                showAura={isCurrentUserStage && currentStage.key === 'musculoso'}
              />

              {isDragOverPanda && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '14%',
                    background: '#111d15',
                    color: '#c4f039',
                    padding: '5px 14px',
                    borderRadius: '999px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    pointerEvents: 'none',
                    zIndex: 25,
                  }}
                >
                  ¡Suelta aquí para alimentar!
                </div>
              )}

              {/* Partículas flotantes al tocar o alimentar */}
              {floatingXp.map((item) => (
                <div
                  key={item.id}
                  style={{
                    position: 'absolute',
                    top: '38%',
                    left: `calc(50% + ${item.offsetX}px)`,
                    transform: 'translate(-50%, -50%)',
                    background: '#c4f039',
                    color: '#111d15',
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    fontSize: '0.86rem',
                    fontWeight: 900,
                    pointerEvents: 'none',
                    animation: 'floatUp 1.05s forwards',
                    boxShadow: '0 6px 16px rgba(132, 204, 22, 0.45)',
                    zIndex: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <i className="bi bi-lightning-charge-fill"></i>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>

            {/* Estado de sesión + asistencia del día */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
              <span
                style={{
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  color: '#5f7165',
                  background: '#ffffff',
                  border: '1px solid #e3e8e2',
                  padding: '4px 12px',
                  borderRadius: '999px',
                }}
              >
                {repCount} {repCount === 1 ? 'ánimo' : 'ánimos'} en esta sesión
              </span>
              <span
                style={{
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  color: pandaData.hasCheckedInToday ? '#166534' : '#64748b',
                  background: pandaData.hasCheckedInToday ? '#ecfccb' : '#ffffff',
                  border: `1px solid ${pandaData.hasCheckedInToday ? '#bef264' : '#e3e8e2'}`,
                  padding: '4px 12px',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <i className={pandaData.hasCheckedInToday ? 'bi bi-check-circle-fill' : 'bi bi-clock'}></i>
                <span>{pandaData.hasCheckedInToday ? 'Asistencia registrada hoy' : 'Sin check-in hoy'}</span>
              </span>
            </div>
          </div>

          {/* Columna Derecha: Energía de sesión + Meta real de evolución */}
          <aside className="panda-side-card panda-arena-meta" aria-label="Estado y meta de evolución">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#111d15' }}>Energía de sesión</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#166534' }}>{sessionEnergy}%</span>
              </div>
              <div style={{ background: '#edf2ec', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${sessionEnergy}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #a3e635 0%, #166534 100%)',
                    borderRadius: '999px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <p style={{ margin: '5px 0 0', fontSize: '0.7rem', color: '#5f7165' }}>
                Sube animando o alimentando a tu panda
              </p>
            </div>

            <div style={{ borderTop: '1px solid #eef2ec', paddingTop: '10px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#5f7165', display: 'block' }}>
                Meta de evolución
              </span>
              {(() => {
                const nextStage = STAGES[realStageIndex + 1]
                if (!nextStage) {
                  return (
                    <div style={{ marginTop: '4px', fontSize: '0.82rem', fontWeight: 800, color: '#166534' }}>
                      ¡Etapa máxima alcanzada!
                    </div>
                  )
                }
                const remaining = Math.max(0, nextStage.reqXp - Number(pandaData.xp || 0))
                return (
                  <>
                    <div style={{ marginTop: '4px', fontSize: '0.82rem', fontWeight: 800, color: '#111d15' }}>
                      {nextStage.shortName} ({nextStage.reqXp} XP)
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700, marginTop: '2px' }}>
                      Faltan {remaining} XP reales
                    </div>
                  </>
                )
              })()}
            </div>

            <div style={{ background: '#f8faf7', borderRadius: '12px', padding: '8px 10px', border: '1px solid #e3e8e2', fontSize: '0.72rem', color: '#5f7165' }}>
              Cada día en el club suma <strong style={{ color: '#111d15' }}>+{pandaData.baseXp || 25} XP</strong> y{' '}
              <strong style={{ color: '#166534' }}>+{pandaData.baseBambus ?? 10} bambús</strong>.
            </div>
          </aside>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TARJETAS DE ESTADO ALINEADAS (PC Y CELULAR)              */}
      {/* ======================================================== */}
      <div className="panda-kpi-grid">
        {/* Nivel y XP */}
        <button
          type="button"
          onClick={() => setShowProgressModal(true)}
          style={{
            background: '#ffffff',
            border: '1px solid #e3e8e2',
            borderRadius: '16px',
            padding: '12px 14px',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '6px',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#5f7165' }}>Nivel</span>
            <i className="bi bi-trophy-fill" style={{ color: '#eab308', fontSize: '1rem' }}></i>
          </div>
          <strong style={{ fontSize: '1.15rem', fontWeight: 900, color: '#111d15' }}>
            N{pandaData.nivel} · {pandaData.xp} XP
          </strong>
          <div style={{ background: '#edf2ec', borderRadius: '999px', height: '6px', overflow: 'hidden', width: '100%' }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', background: '#84cc16', borderRadius: '999px' }} />
          </div>
        </button>

        {/* Racha */}
        <button
          type="button"
          onClick={() => setShowStreakModal(true)}
          style={{
            background: '#ffffff',
            border: '1px solid #e3e8e2',
            borderRadius: '16px',
            padding: '12px 14px',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#5f7165' }}>Racha</span>
            <i className="bi bi-fire" style={{ color: '#ef4444', fontSize: '1rem' }}></i>
          </div>
          <strong style={{ fontSize: '1.15rem', fontWeight: 900, color: '#111d15' }}>
            {pandaData.racha} {pandaData.racha === 1 ? 'día' : 'días'}
          </strong>
          <span style={{ fontSize: '0.72rem', color: '#5f7165', fontWeight: 600 }}>
            {pandaData.asistenciasMes} asist. este mes
          </span>
        </button>

        {/* Bambús */}
        <button
          type="button"
          onClick={() => setShowBambusModal(true)}
          style={{
            background: '#ffffff',
            border: '1px solid #e3e8e2',
            borderRadius: '16px',
            padding: '12px 14px',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#5f7165' }}>Bambús</span>
            <i className="bi bi-gem" style={{ color: '#166534', fontSize: '1rem' }}></i>
          </div>
          <strong style={{ fontSize: '1.15rem', fontWeight: 900, color: '#111d15' }}>
            {pandaData.bambusDisponibles}
          </strong>
          <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700 }}>
            Ver saldo y canjes
          </span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* BOTONES DE ACCIÓN PRINCIPALES ALINEADOS                  */}
      {/* ======================================================== */}
      <div className="panda-actions-row">
        <button
          type="button"
          onClick={handlePandaTap}
          style={{
            background: '#c4f039',
            color: '#111d15',
            border: '1px solid #a3e635',
            borderRadius: '14px',
            padding: '12px 16px',
            fontSize: '0.88rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(196, 240, 57, 0.35)',
          }}
        >
          <i className="bi bi-heart-pulse-fill"></i>
          <span>Animar panda</span>
        </button>

        {canGoRewards && (
          <button
            type="button"
            onClick={() => navigate(rewardsRoute)}
            style={{
              background: '#111d15',
              color: '#ffffff',
              border: '1px solid #111d15',
              borderRadius: '14px',
              padding: '12px 16px',
              fontSize: '0.88rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <i className="bi bi-gift-fill" style={{ color: '#c4f039' }}></i>
            <span>Canjear puntos</span>
          </button>
        )}

        {canGoAttendance && (
          <button
            type="button"
            onClick={() => navigate('/app/asistencias')}
            style={{
              background: '#f8faf7',
              color: '#111d15',
              border: '1px solid #d9e4d7',
              borderRadius: '14px',
              padding: '12px 16px',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              gridColumn: !canGoRewards ? 'auto' : undefined,
            }}
          >
            <i className="bi bi-calendar-check" style={{ color: '#166534' }}></i>
            <span>Mis asistencias</span>
          </button>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: PROGRESO DE NIVEL & XP                         */}
      {/* ======================================================== */}
      {showProgressModal && (
        <div
          className="panda-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowProgressModal(false)}
        >
          <div className="panda-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panda-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="bi bi-trophy-fill" style={{ color: '#eab308', fontSize: '1.2rem' }}></i>
                <h5 style={{ margin: 0, fontWeight: 800, color: '#111d15' }}>Progreso de Nivel</h5>
              </div>
              <button type="button" aria-label="Cerrar modal" className="panda-modal-close" onClick={() => setShowProgressModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div style={{ padding: '16px 0' }}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '2rem', fontWeight: 900, color: '#166534' }}>{pandaData.xp} XP</span>
                <p style={{ margin: '4px 0 0', color: '#5f7165', fontSize: '0.86rem' }}>
                  Nivel {pandaData.nivel} · {pandaData.etapa}
                </p>
              </div>

              <div style={{ background: '#edf2ec', borderRadius: '9999px', height: '12px', overflow: 'hidden', marginBottom: '8px' }}>
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #84cc16 0%, #235833 100%)',
                    borderRadius: '9999px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#5f7165', marginBottom: '16px' }}>
                <span>Nivel {pandaData.nivel} ({pandaData.currentLevelBaseXp} XP)</span>
                <span style={{ fontWeight: 700, color: '#111d15' }}>{progressPercent}%</span>
                <span>Nivel {pandaData.nivel + 1} ({pandaData.nextNivelXp} XP)</span>
              </div>

              <div style={{ background: '#f8faf7', borderRadius: '14px', padding: '12px', border: '1px solid #e3e8e2', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#5f7165' }}>XP faltante para siguiente nivel:</span>
                  <span style={{ fontWeight: 800, color: '#166534' }}>{Math.max(0, pandaData.xpFaltante ?? (pandaData.nextNivelXp - pandaData.xp))} XP</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#5f7165' }}>Visitas estimadas (+{pandaData.baseXp || 25} XP/día):</span>
                  <span style={{ fontWeight: 800, color: '#111d15' }}>{Math.max(1, pandaData.visitasParaSiguiente || 1)} visitas</span>
                </div>
              </div>
            </div>

            <button type="button" onClick={() => setShowProgressModal(false)} className="panda-modal-btn">
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: ETAPAS DE EVOLUCIÓN                             */}
      {/* ======================================================== */}
      {showEvolutionModal && (
        <div
          className="panda-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowEvolutionModal(false)}
        >
          <div className="panda-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panda-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="bi bi-award-fill" style={{ color: '#166534', fontSize: '1.2rem' }}></i>
                <h5 style={{ margin: 0, fontWeight: 800, color: '#111d15' }}>Etapas de Evolución</h5>
              </div>
              <button type="button" aria-label="Cerrar modal" className="panda-modal-close" onClick={() => setShowEvolutionModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px 0' }}>
              {STAGES.map((s, idx) => {
                const isSelected = activeStageIndex === idx
                const unlocked = Number(pandaData.xp || 0) >= s.reqXp
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setActiveStageIndex(idx)
                      setShowEvolutionModal(false)
                    }}
                    style={{
                      background: isSelected ? '#f4fce3' : '#f8faf7',
                      border: `1.5px solid ${isSelected ? '#84cc16' : '#e3e8e2'}`,
                      borderRadius: '14px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: isSelected ? '#c4f039' : '#ffffff',
                        border: '1px solid #d9e4d7',
                        color: '#111d15',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.15rem',
                        flexShrink: 0,
                      }}
                    >
                      <i className={`bi ${s.iconClass}`}></i>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#111d15' }}>{s.name}</span>
                        <span style={{ fontSize: '0.7rem', color: unlocked ? '#166534' : '#64748b', fontWeight: 800 }}>
                          {idx === realStageIndex ? 'Tu etapa' : unlocked ? 'Desbloqueada' : 'Bloqueada'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#166534', fontWeight: 700 }}>{s.levelLabel}</div>
                      <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#5f7165', lineHeight: 1.3 }}>
                        {s.desc}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            <button type="button" onClick={() => setShowEvolutionModal(false)} className="panda-modal-btn">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: RACHA & HÁBITOS                                */}
      {/* ======================================================== */}
      {showStreakModal && (
        <div
          className="panda-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowStreakModal(false)}
        >
          <div className="panda-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panda-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="bi bi-fire" style={{ color: '#ef4444', fontSize: '1.2rem' }}></i>
                <h5 style={{ margin: 0, fontWeight: 800, color: '#111d15' }}>Racha de Entrenamientos</h5>
              </div>
              <button type="button" aria-label="Cerrar modal" className="panda-modal-close" onClick={() => setShowStreakModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: '2.3rem', fontWeight: 900, color: '#dc2626' }}>
                {pandaData.racha} {pandaData.racha === 1 ? 'DÍA' : 'DÍAS'}
              </div>
              <p style={{ color: '#5f7165', fontSize: '0.84rem', margin: '4px 0 16px' }}>
                {pandaData.racha >= 3
                  ? '¡Excelente constancia! Mantienes tu ritmo semanal activo.'
                  : 'Cumple tus días objetivo para fortalecer tu racha.'}
              </p>

              <div style={{ background: '#f8faf7', borderRadius: '14px', padding: '12px', border: '1px solid #e3e8e2', textAlign: 'left', fontSize: '0.84rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#5f7165' }}>Asistencias este mes:</span>
                  <span style={{ fontWeight: 800, color: '#111d15' }}>{pandaData.asistenciasMes} días</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#5f7165' }}>Total histórico:</span>
                  <span style={{ fontWeight: 800, color: '#111d15' }}>{pandaData.totalAsistencias} asistencias</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#5f7165' }}>Etapa actual:</span>
                  <span style={{ fontWeight: 800, color: '#166534' }}>{pandaData.etapa}</span>
                </div>
              </div>
            </div>

            <button type="button" onClick={() => setShowStreakModal(false)} className="panda-modal-btn">
              ¡Seguir Entrenando!
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: BAMBÚS & CANJES                                */}
      {/* ======================================================== */}
      {showBambusModal && (
        <div
          className="panda-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowBambusModal(false)}
        >
          <div className="panda-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panda-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="bi bi-gem" style={{ color: '#166534', fontSize: '1.2rem' }}></i>
                <h5 style={{ margin: 0, fontWeight: 800, color: '#111d15' }}>Bambús Acumulados</h5>
              </div>
              <button type="button" aria-label="Cerrar modal" className="panda-modal-close" onClick={() => setShowBambusModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#166534' }}>
                {pandaData.bambusDisponibles}
              </div>
              <p style={{ color: '#5f7165', fontSize: '0.84rem', margin: '4px 0 14px' }}>
                Puntos canjeables por recompensas del club.
              </p>

              <div style={{ background: '#f8faf7', borderRadius: '14px', padding: '12px', border: '1px solid #e3e8e2', textAlign: 'left', fontSize: '0.84rem', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#5f7165' }}>Bambús ganados:</span>
                  <span style={{ fontWeight: 800, color: '#111d15' }}>{pandaData.bambusGanados}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#5f7165' }}>Bambús canjeados:</span>
                  <span style={{ fontWeight: 800, color: '#111d15' }}>{pandaData.bambusCanjeados}</span>
                </div>
              </div>

              {canGoRewards && (
                <button
                  type="button"
                  onClick={() => {
                    setShowBambusModal(false)
                    navigate(rewardsRoute)
                  }}
                  style={{
                    width: '100%',
                    background: '#111d15',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '10px 18px',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <i className="bi bi-gift-fill" style={{ color: '#c4f039' }}></i>
                  <span>Ir a Canjear Puntos</span>
                </button>
              )}
            </div>

            <button type="button" onClick={() => setShowBambusModal(false)} className="panda-modal-btn">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: GUÍA & REGLAS REALES                            */}
      {/* ======================================================== */}
      {showGuideModal && (
        <div
          className="panda-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowGuideModal(false)}
        >
          <div className="panda-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panda-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="bi bi-question-circle-fill" style={{ color: '#166534', fontSize: '1.2rem' }}></i>
                <h5 style={{ margin: 0, fontWeight: 800, color: '#111d15' }}>¿Cómo Funciona Mi Pandita?</h5>
              </div>
              <button type="button" aria-label="Cerrar modal" className="panda-modal-close" onClick={() => setShowGuideModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px 0', fontSize: '0.84rem', color: '#5f7165' }}>
              <div style={{ background: '#f8faf7', border: '1px solid #e3e8e2', borderRadius: '12px', padding: '12px' }}>
                <span style={{ fontWeight: 800, color: '#111d15', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="bi bi-qr-code-scan" style={{ color: '#166534' }}></i> Asistencia al Gimnasio
                </span>
                <p style={{ margin: '4px 0 0' }}>
                  Cada día con asistencia registrada suma {pandaData.baseXp || 25} XP y {pandaData.baseBambus ?? 10} bambús. Las entradas repetidas el mismo día no duplican puntos.
                </p>
              </div>

              <div style={{ background: '#f8faf7', border: '1px solid #e3e8e2', borderRadius: '12px', padding: '12px' }}>
                <span style={{ fontWeight: 800, color: '#111d15', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="bi bi-award-fill" style={{ color: '#166534' }}></i> Evolución en 3 Etapas
                </span>
                <p style={{ margin: '4px 0 0' }}>
                  Tu pandita 2D evoluciona de Bebé (0 XP) a Intermedio (300 XP) y Musculoso (1,000 XP) conforme acumulas experiencia.
                </p>
              </div>

              <div style={{ background: '#f8faf7', border: '1px solid #e3e8e2', borderRadius: '12px', padding: '12px' }}>
                <span style={{ fontWeight: 800, color: '#111d15', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="bi bi-gift-fill" style={{ color: '#166534' }}></i> Canje de Recompensas
                </span>
                <p style={{ margin: '4px 0 0' }}>
                  Usa tus bambús acumulados desde el botón Canjear puntos para obtener premios y promociones vigentes.
                </p>
              </div>
            </div>

            <button type="button" onClick={() => setShowGuideModal(false)} className="panda-modal-btn">
              ¡Entendido!
            </button>
          </div>
        </div>
      )}

      <style>{`
        .panda-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 2000;
          background: rgba(17, 29, 21, 0.55);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: pandaFadeIn 0.18s ease-out;
        }
        .panda-modal-card {
          background: #ffffff;
          border: 1px solid #e3e8e2;
          border-radius: 22px;
          width: 100%;
          max-width: 430px;
          padding: 20px;
          box-shadow: 0 20px 44px rgba(17, 29, 21, 0.18);
          animation: pandaScaleUp 0.18s ease-out;
        }
        .panda-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #eef2ec;
          padding-bottom: 12px;
        }
        .panda-modal-close {
          background: #f8faf7;
          border: 1px solid #e3e8e2;
          color: #5f7165;
          font-size: 0.95rem;
          cursor: pointer;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .panda-modal-btn {
          width: 100%;
          background: #c4f039;
          color: #111d15;
          border: 1px solid #a3e635;
          border-radius: 12px;
          padding: 11px;
          font-weight: 800;
          font-size: 0.88rem;
          cursor: pointer;
          margin-top: 6px;
        }
        @keyframes pandaFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pandaScaleUp {
          from { transform: scale(0.96); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes floatUp {
          0% { opacity: 0; transform: translate(-50%, -20%) scale(0.85); }
          30% { opacity: 1; transform: translate(-50%, -70%) scale(1.08); }
          100% { opacity: 0; transform: translate(-50%, -125%) scale(0.92); }
        }
      `}</style>
    </div>
  )
}

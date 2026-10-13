import {canAccess} from '../utils/access'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import usePandaAccount from '../hooks/usePandaAccount'
import PandaCharacter3D from '../components/PandaCharacter3D'

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

const STAGES = [
  {
    index: 0,
    key: 'bebe',
    name: '01 · Panda Bebé',
    collectionName: '01 · PANDA BEBÉ',
    levelLabel: 'Niveles 1-2 · 0 a 299 XP',
    desc: 'Cuerpo pequeño y redondeado, etapa inicial de aprendizaje y técnica.',
    reqXp: 0,
    nextThreshold: 300,
    iconClass: 'bi-egg-fill',
    modelUrl: '/models/panda_bebe.glb',
  },
  {
    index: 1,
    key: 'intermedio',
    name: '02 · Panda Intermedio',
    collectionName: '02 · PANDA INTERMEDIO',
    levelLabel: 'Niveles 3-4 · 300 a 999 XP',
    desc: 'Postura atlética, mayor tono muscular en pecho, hombros y brazos.',
    reqXp: 300,
    nextThreshold: 1000,
    iconClass: 'bi-lightning-fill',
    modelUrl: '/models/panda_intermedio.glb',
  },
  {
    index: 2,
    key: 'musculoso',
    name: '03 · Panda Musculoso',
    collectionName: '03 · PANDA MUSCULOSO',
    levelLabel: 'Nivel Avanzado 5+ · 1,000+ XP',
    desc: 'Físico imponente, deltoides hipertrofiados, espalda ancha y fuerza máxima.',
    reqXp: 1000,
    nextThreshold: 2000,
    iconClass: 'bi-shield-shaded',
    modelUrl: '/models/panda_musculoso.glb',
  },
]

export default function MyPandaView({ token, user }) {
  const navigate = useNavigate()
  const modelViewerRef = useRef(null)

  // Datos de evolución y asistencia
  const {data:pandaData,error,refresh}=usePandaAccount(token)

  // Etapa seleccionada en el carrusel (0: bebe, 1: intermedio, 2: musculoso)
  const [activeStageIndex, setActiveStageIndex] = useState(0)

  // Estados interactivos
  const [isTraining, setIsTraining] = useState(false)
  const [repCount, setRepCount] = useState(0)
  const [speechBubble, setSpeechBubble] = useState('¡A entrenar duro hoy! Sin excusas.')
  const [floatingXp, setFloatingXp] = useState([])
  const [autoRotate, setAutoRotate] = useState(false)
  const [notification, setNotification] = useState('')

  // Estados para modales informativos
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [showEvolutionModal, setShowEvolutionModal] = useState(false)
  const [showStreakModal, setShowStreakModal] = useState(false)
  const [showBambusModal, setShowBambusModal] = useState(false)
  const [showGuideModal, setShowGuideModal] = useState(false)

  useEffect(()=>{
    if(pandaData) setActiveStageIndex({bebe:0,intermedio:1,musculoso:2}[pandaData.etapaKey] ?? 0)
  },[pandaData?.etapaKey])

  // Tocar al Panda para entrenar
  function handlePandaTap(e) {
    if (e && e.stopPropagation) e.stopPropagation()
    setIsTraining(true)
    setRepCount((prev) => prev + 1)

    // Cambiar frase aleatoria
    const randomQuote = PANDA_QUOTES[Math.floor(Math.random() * PANDA_QUOTES.length)]
    setSpeechBubble(randomQuote)

    if (navigator?.vibrate) {
      navigator.vibrate(35)
    }

    // Efecto flotante de XP
    const newId = Date.now() + Math.random()
    const offsetX = (Math.random() - 0.5) * 80
    setFloatingXp((prev) => [...prev, { id: newId, text: '¡Vamos!', offsetX }])

    setTimeout(() => {
      setFloatingXp((prev) => prev.filter((item) => item.id !== newId))
    }, 1100)

    setTimeout(() => {
      setIsTraining(false)
    }, 450)
  }

  // Alimentar al Panda

  function handleToggleCheckIn() { navigate('/app/asistencias') }

  // Navegación de etapas
  function handlePrevStage() {
    setActiveStageIndex((prev) => (prev > 0 ? prev - 1 : STAGES.length - 1))
  }

  function handleNextStage() {
    setActiveStageIndex((prev) => (prev < STAGES.length - 1 ? prev + 1 : 0))
  }

  // Recentrar cámara frontal
  function handleResetCamera() {
    const viewer = modelViewerRef.current
    if (viewer) {
      viewer.cameraOrbit = '0deg 82deg auto'
      viewer.jumpCameraToGoal()
    }
  }

  if(!pandaData) return <div className="panda-view-wrapper" style={{display:'grid',placeItems:'center',color:'#dce8cd',minHeight:500}}><div><p role="status">{error || 'Cargando tu pandita…'}</p>{error&&<button className="btn btn-light" onClick={refresh}>Volver a consultar</button>}</div></div>
  const currentStage = STAGES[activeStageIndex]
  const progressPercent = Math.min(
    100,
    Math.round(
      ((pandaData.xp - pandaData.currentLevelBaseXp) /
        Math.max(1, pandaData.nextNivelXp - pandaData.currentLevelBaseXp)) *
        100
    )
  )

  return (
    <div className="panda-view-wrapper">
      {/* Toast de notificación temporal */}
      {notification && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1050,
            background: 'rgba(17, 29, 21, 0.95)',
            border: '1px solid #c4f039',
            color: '#c4f039',
            padding: '8px 20px',
            borderRadius: '9999px',
            fontSize: '0.84rem',
            fontWeight: 800,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeIn 0.25s ease-out',
            whiteSpace: 'nowrap',
          }}
        >
          <i className="bi bi-check-circle-fill"></i>
          <span>{notification}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* HUD SUPERIOR: Selector de Etapa Central                  */}
      {/* ======================================================== */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          right: '12px',
          zIndex: 30,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(11, 20, 14, 0.92)',
            backdropFilter: 'blur(14px)',
            border: '1.5px solid rgba(196, 240, 57, 0.45)',
            borderRadius: '9999px',
            padding: '5px 12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            pointerEvents: 'auto',
          }}
        >
          <button
            type="button"
            onClick={handlePrevStage}
            aria-label="Etapa anterior"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#c4f039',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'all 0.2s',
            }}
          >
            <i className="bi bi-chevron-left"></i>
          </button>

          <div
            onClick={() => setShowEvolutionModal(true)}
            style={{
              padding: '2px 8px',
              fontSize: '0.92rem',
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '-0.01em',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
            title="Ver información de etapas"
          >
            <i className={`bi ${currentStage.iconClass} text-warning`}></i>
            <span>{currentStage.name}</span>
            <i className="bi bi-info-circle text-muted" style={{ fontSize: '0.8rem' }}></i>
          </div>

          <button
            type="button"
            onClick={handleNextStage}
            aria-label="Etapa siguiente"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#c4f039',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'all 0.2s',
            }}
          >
            <i className="bi bi-chevron-right"></i>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* BURBUJA DE DIÁLOGO FLOTANTE CENTRADA SOBRE EL PANDA      */}
      {/* ======================================================== */}
      <div
        style={{
          position: 'absolute',
          top: '54px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 25,
          width: 'calc(100% - 130px)',
          maxWidth: '360px',
          pointerEvents: 'auto',
        }}
      >
        <div
          onClick={handlePandaTap}
          style={{
            background: 'rgba(11, 20, 14, 0.92)',
            backdropFilter: 'blur(12px)',
            border: '1.5px solid rgba(196, 240, 57, 0.45)',
            color: '#c4f039',
            padding: '7px 16px',
            borderRadius: '9999px',
            fontSize: '0.8rem',
            fontWeight: 800,
            lineHeight: 1.25,
            boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            textAlign: 'center',
            animation: 'floatBubble 3s ease-in-out infinite',
          }}
          title="Toca al panda para motivarlo"
        >
          <i className="bi bi-chat-quote-fill" style={{ fontSize: '0.9rem', color: '#c4f039', flexShrink: 0 }}></i>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{speechBubble}</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* COLUMNA IZQUIERDA: BOTONES VERTICALES DE INFORMACIÓN     */}
      {/* ======================================================== */}
      <div
        style={{
          position: 'absolute',
          top: '110px',
          left: '12px',
          zIndex: 35,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {/* Nivel y XP */}
        <button
          type="button"
          onClick={() => setShowProgressModal(true)}
          title="Nivel y Progreso XP"
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '16px',
            background: 'rgba(15, 26, 19, 0.92)',
            backdropFilter: 'blur(12px)',
            border: '1.5px solid rgba(250, 204, 21, 0.55)',
            color: '#facc15',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '1.15rem',
            boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
            transition: 'all 0.2s ease',
          }}
        >
          <i className="bi bi-trophy-fill"></i>
          <span style={{ fontSize: '0.62rem', fontWeight: 900, color: '#f8fafc', marginTop: '-2px' }}>
            N{pandaData.nivel}
          </span>
        </button>

        {/* Racha */}
        <button
          type="button"
          onClick={() => setShowStreakModal(true)}
          title="Racha de Asistencias"
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '16px',
            background: 'rgba(15, 26, 19, 0.92)',
            backdropFilter: 'blur(12px)',
            border: '1.5px solid rgba(248, 113, 113, 0.55)',
            color: '#f87171',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '1.15rem',
            boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
            transition: 'all 0.2s ease',
          }}
        >
          <i className="bi bi-fire"></i>
          <span style={{ fontSize: '0.62rem', fontWeight: 900, color: '#f8fafc', marginTop: '-2px' }}>
            {pandaData.racha}d
          </span>
        </button>

        {/* Bambús */}
        <button
          type="button"
          onClick={() => setShowBambusModal(true)}
          title="Bambús Disponibles"
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '16px',
            background: 'rgba(15, 26, 19, 0.92)',
            backdropFilter: 'blur(12px)',
            border: '1.5px solid rgba(196, 240, 57, 0.55)',
            color: '#c4f039',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '1.15rem',
            boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
            transition: 'all 0.2s ease',
          }}
        >
          <i className="bi bi-gem"></i>
          <span style={{ fontSize: '0.62rem', fontWeight: 900, color: '#c4f039', marginTop: '-2px' }}>
            {pandaData.bambusDisponibles}
          </span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* COLUMNA DERECHA: BOTONES VERTICALES DE CONTROL Y ACCIÓN  */}
      {/* ======================================================== */}
      <div
        style={{
          position: 'absolute',
          top: '110px',
          right: '12px',
          zIndex: 35,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {/* Etapas de evolución */}
        <button
          type="button"
          onClick={() => setShowEvolutionModal(true)}
          title="Etapas de Evolución"
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '16px',
            background: 'rgba(15, 26, 19, 0.92)',
            backdropFilter: 'blur(12px)',
            border: '1.5px solid rgba(196, 240, 57, 0.45)',
            color: '#c4f039',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '1.15rem',
            boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
            transition: 'all 0.2s ease',
          }}
        >
          <i className="bi bi-award-fill"></i>
          <span style={{ fontSize: '0.62rem', fontWeight: 900, color: '#c4f039', marginTop: '-2px' }}>
            Evo
          </span>
        </button>

        {/* Guía informativa */}
        <button
          type="button"
          onClick={() => setShowGuideModal(true)}
          title="Guía de Mi Pandita"
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '16px',
            background: 'rgba(15, 26, 19, 0.92)',
            backdropFilter: 'blur(12px)',
            border: '1.5px solid rgba(255, 255, 255, 0.18)',
            color: '#94a3b8',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '1.15rem',
            boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
            transition: 'all 0.2s ease',
          }}
        >
          <i className="bi bi-question-circle-fill"></i>
          <span style={{ fontSize: '0.62rem', fontWeight: 900, color: '#94a3b8', marginTop: '-2px' }}>
            Guía
          </span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* ESCENARIO 3D HERO PRINCIPAL (OCUPA TODA LA PANTALLA)    */}
      {/* ======================================================== */}
      <div
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          paddingTop: '24px',
        }}
      >
        <PandaCharacter3D
          stage={currentStage.key}
          isTraining={isTraining}
          onPandaTap={handlePandaTap}
          autoRotate={autoRotate}
          modelViewerRef={modelViewerRef}
        />

        {/* Partículas flotantes de XP */}
        {floatingXp.map((item) => (
          <div
            key={item.id}
            style={{
              position: 'absolute',
              top: '45%',
              left: `calc(50% + ${item.offsetX}px)`,
              transform: 'translate(-50%, -50%)',
              background: '#c4f039',
              color: '#111d15',
              padding: '6px 16px',
              borderRadius: '9999px',
              fontSize: '0.9rem',
              fontWeight: 900,
              pointerEvents: 'none',
              animation: 'floatUp 1.1s forwards',
              boxShadow: '0 4px 18px rgba(196, 240, 57, 0.7)',
              zIndex: 30,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <i className="bi bi-lightning-charge-fill"></i>
            <span>{item.text}</span>
          </div>
        ))}
      </div>

      {/* ======================================================== */}
      {/* BARRA INFERIOR DE ACCIÓN ERGONÓMICA PARA CELULAR         */}
      {/* ======================================================== */}
      <div
        style={{
          position: 'relative',
          zIndex: 30,
          padding: '12px 16px 16px 16px',
          background: 'linear-gradient(to top, rgba(7, 13, 9, 0.95) 0%, rgba(7, 13, 9, 0.7) 70%, transparent 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', width: '100%', maxWidth: '420px', gap: '8px' }}>
          {/* Botón Principal: Entrenar */}
          <button
            type="button"
            onClick={handlePandaTap}
            style={{
              flex: 1.2,
              background: '#c4f039',
              color: '#111d15',
              border: 'none',
              borderRadius: '16px',
              padding: '11px 12px',
              fontSize: '0.84rem',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 6px 20px rgba(196, 240, 57, 0.35)',
              transition: 'transform 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            <i className="bi bi-heart-pulse-fill" style={{ fontSize: '1rem' }}></i>
            <span>Animar panda</span>
          </button>

          {/* Botón Nuevo: Canjear Puntos */}
          {canAccess(user,'recompensas') && (<button
            type="button"
            onClick={() => navigate('/app/recompensas')}
            style={{
              flex: 1.1,
              background: 'rgba(196, 240, 57, 0.18)',
              border: '1.5px solid #c4f039',
              color: '#c4f039',
              borderRadius: '16px',
              padding: '11px 10px',
              fontSize: '0.8rem',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 16px rgba(196, 240, 57, 0.2)',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
            title="Ir a Recompensas y Canjes"
          >
            <i className="bi bi-gift-fill" style={{ fontSize: '0.9rem' }}></i>
            <span>Canjear Puntos</span>
          </button>)}
        </div>

        {/* Botón de Asistencia / Simulación */}
        <button
          type="button"
          onClick={handleToggleCheckIn}
          style={{
            background: 'transparent',
            border: 'none',
            color: pandaData.hasCheckedInToday ? '#84cc16' : '#94a3b8',
            fontSize: '0.74rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px',
          }}
        >
          <i className={pandaData.hasCheckedInToday ? 'bi bi-check-circle-fill text-success' : 'bi bi-circle'}></i>
          <span>{pandaData.hasCheckedInToday ? 'Asistencia registrada hoy' : 'Ver mis asistencias'}</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: PROGRESO DE NIVEL & XP                         */}
      {/* ======================================================== */}
      {showProgressModal && (
        <div className="modal-backdrop-custom" onClick={() => setShowProgressModal(false)}>
          <div className="modal-content-custom" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-custom">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="bi bi-trophy-fill text-warning" style={{ fontSize: '1.2rem' }}></i>
                <h5 style={{ margin: 0, fontWeight: 900, color: '#ffffff' }}>Progreso de Nivel</h5>
              </div>
              <button className="btn-close-custom" onClick={() => setShowProgressModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div style={{ padding: '16px 0' }}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '2rem', fontWeight: 900, color: '#c4f039' }}>{pandaData.xp} XP</span>
                <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                  Nivel {pandaData.nivel} · {currentStage.name}
                </p>
              </div>

              {/* Barra de progreso */}
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', height: '14px', overflow: 'hidden', marginBottom: '8px' }}>
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #84cc16 0%, #c4f039 100%)',
                    borderRadius: '9999px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '18px' }}>
                <span>Nivel {pandaData.nivel} ({pandaData.currentLevelBaseXp} XP)</span>
                <span>{progressPercent}%</span>
                <span>Nivel {pandaData.nivel + 1} ({pandaData.nextNivelXp} XP)</span>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '14px', padding: '12px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>XP faltante para siguiente nivel:</span>
                  <span style={{ fontWeight: 800, color: '#c4f039' }}>{Math.max(0, pandaData.nextNivelXp - pandaData.xp)} XP</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Visitas al club estimadas:</span>
                  <span style={{ fontWeight: 800, color: '#ffffff' }}>{Math.max(1, Math.ceil((pandaData.nextNivelXp - pandaData.xp) / 25))} visitas</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowProgressModal(false)}
              className="btn-modal-action"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: ETAPAS DE EVOLUCIÓN (BLENDER)                  */}
      {/* ======================================================== */}
      {showEvolutionModal && (
        <div className="modal-backdrop-custom" onClick={() => setShowEvolutionModal(false)}>
          <div className="modal-content-custom" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-custom">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="bi bi-award-fill text-lime" style={{ fontSize: '1.2rem' }}></i>
                <h5 style={{ margin: 0, fontWeight: 900, color: '#ffffff' }}>Etapas de Evolución</h5>
              </div>
              <button className="btn-close-custom" onClick={() => setShowEvolutionModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px 0' }}>
              {STAGES.map((s, idx) => {
                const isSelected = activeStageIndex === idx
                return (
                  <div
                    key={s.key}
                    onClick={() => {
                      setActiveStageIndex(idx)
                      setShowEvolutionModal(false)
                    }}
                    style={{
                      background: isSelected ? 'rgba(196, 240, 57, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                      border: `1.5px solid ${isSelected ? '#c4f039' : 'rgba(255, 255, 255, 0.1)'}`,
                      borderRadius: '16px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: isSelected ? '#c4f039' : 'rgba(255, 255, 255, 0.08)',
                        color: isSelected ? '#111d15' : '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                        flexShrink: 0,
                      }}
                    >
                      <i className={`bi ${s.iconClass}`}></i>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#ffffff' }}>{s.name}</span>
                        {isSelected && (
                          <span style={{ fontSize: '0.7rem', color: '#c4f039', fontWeight: 800, textTransform: 'uppercase' }}>
                            En Pantalla
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#84cc16', fontWeight: 700 }}>{s.levelLabel}</div>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: '#94a3b8', lineHeight: 1.25 }}>
                        {s.desc}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowEvolutionModal(false)}
              className="btn-modal-action"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: RACHA & HÁBITOS                                */}
      {/* ======================================================== */}
      {showStreakModal && (
        <div className="modal-backdrop-custom" onClick={() => setShowStreakModal(false)}>
          <div className="modal-content-custom" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-custom">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="bi bi-fire text-danger" style={{ fontSize: '1.2rem' }}></i>
                <h5 style={{ margin: 0, fontWeight: 900, color: '#ffffff' }}>Racha de Entrenamientos</h5>
              </div>
              <button className="btn-close-custom" onClick={() => setShowStreakModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f87171' }}>
                {pandaData.racha} DÍAS
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: '4px 0 16px 0' }}>
                {pandaData.racha >= 3
                  ? '¡Excelente constancia! Tu panda mantiene su masa muscular activa.'
                  : 'Entrena 3 o más días consecutivos para alcanzar el estado de máxima energía.'}
              </p>

              <div style={{ background: 'rgba(255, 255, 255, 0.04)', borderRadius: '14px', padding: '12px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Asistencias este mes:</span>
                  <span style={{ fontWeight: 800, color: '#ffffff' }}>{pandaData.asistenciasMes} días</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Estado físico del avatar:</span>
                  <span style={{ fontWeight: 800, color: '#c4f039' }}>{pandaData.etapa}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowStreakModal(false)}
              className="btn-modal-action"
            >
              ¡Seguir Entrenando!
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: BAMBÚS & CANJES                                */}
      {/* ======================================================== */}
      {showBambusModal && (
        <div className="modal-backdrop-custom" onClick={() => setShowBambusModal(false)}>
          <div className="modal-content-custom" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-custom">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="bi bi-gem text-lime" style={{ fontSize: '1.2rem' }}></i>
                <h5 style={{ margin: 0, fontWeight: 900, color: '#ffffff' }}>Bambús Acumulados</h5>
              </div>
              <button className="btn-close-custom" onClick={() => setShowBambusModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#c4f039' }}>
                {pandaData.bambusDisponibles} 
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: '4px 0 16px 0' }}>
                Puntos canjeables por suplementos, bebidas y pases en recepción.
              </p>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                {canAccess(user,'recompensas') && (<button
                  type="button"
                  onClick={() => {
                    setShowBambusModal(false)
                    navigate('/app/recompensas')
                  }}
                  style={{
                    background: '#c4f039',
                    color: '#111d15',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '10px 18px',
                    fontWeight: 900,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <i className="bi bi-gift-fill"></i>
                  <span>Ver Tienda de Canjes</span>
                </button>)}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowBambusModal(false)}
              className="btn-modal-action"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: GUÍA & REGLAS DEL JUEGO                        */}
      {/* ======================================================== */}
      {showGuideModal && (
        <div className="modal-backdrop-custom" onClick={() => setShowGuideModal(false)}>
          <div className="modal-content-custom" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-custom">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="bi bi-question-circle-fill text-warning" style={{ fontSize: '1.2rem' }}></i>
                <h5 style={{ margin: 0, fontWeight: 900, color: '#ffffff' }}>¿Cómo Funciona Mi Pandita?</h5>
              </div>
              <button className="btn-close-custom" onClick={() => setShowGuideModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px 0', fontSize: '0.82rem', color: '#94a3b8' }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '10px 12px' }}>
                <span style={{ fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="bi bi-qr-code-scan text-lime"></i> Asistencia al Gimnasio
                </span>
                <p style={{ margin: '4px 0 0 0' }}>Cada día con asistencia registrada suma 25 XP y 10 bambús. Las entradas repetidas el mismo día no duplican puntos.</p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '10px 12px' }}>
                <span style={{ fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="bi bi-award-fill text-warning"></i> Evolución en 3 Etapas
                </span>
                <p style={{ margin: '4px 0 0 0' }}>El modelo 3D evoluciona de Bebé a Intermedio y Musculoso a medida que acumulas experiencia.</p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '10px 12px' }}>
                <span style={{ fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="bi bi-hand-index-thumb-fill text-lime"></i> Giro 360° en Celular
                </span>
                <p style={{ margin: '4px 0 0 0' }}>Arrastra horizontalmente para girar al modelo hacia la izquierda o derecha en ángulo fijo.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="btn-modal-action"
            >
              ¡Entendido!
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ESTILOS CSS INCRUSTADOS PARA MODALES Y ANIMACIONES       */}
      {/* ======================================================== */}
      <style>{`
        .modal-backdrop-custom {
          position: fixed;
          inset: 0;
          z-index: 2000;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: fadeIn 0.2s ease-out;
        }

        .modal-content-custom {
          background: #111d15;
          border: 1px solid rgba(196, 240, 57, 0.3);
          border-radius: 24px;
          width: 100%;
          max-width: 420px;
          padding: 20px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.6);
          animation: scaleUp 0.2s ease-out;
        }

        .modal-header-custom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 12px;
        }

        .btn-close-custom {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 1.1rem;
          cursor: pointer;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .btn-close-custom:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.1);
        }

        .btn-modal-action {
          width: 100%;
          background: #c4f039;
          color: #111d15;
          border: none;
          border-radius: 14px;
          padding: 12px;
          font-weight: 900;
          font-size: 0.88rem;
          cursor: pointer;
          margin-top: 8px;
          transition: all 0.2s;
        }

        .text-lime {
          color: #c4f039 !important;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        @keyframes floatUp {
          0% { opacity: 0; transform: translate(-50%, -20%) scale(0.8); }
          30% { opacity: 1; transform: translate(-50%, -70%) scale(1.1); }
          100% { opacity: 0; transform: translate(-50%, -130%) scale(0.9); }
        }

        @keyframes floatBubble {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}

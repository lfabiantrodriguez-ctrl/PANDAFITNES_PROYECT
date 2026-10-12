import { useEffect, useRef, useState } from 'react'
import '@google/model-viewer'

/**
 * Mapeo de etapas a los modelos 3D exportados desde Blender (GLB)
 */
const MODEL_MAP = {
  bebe: '/models/panda_bebe.glb',
  '01': '/models/panda_bebe.glb',
  intermedio: '/models/panda_intermedio.glb',
  juvenil: '/models/panda_intermedio.glb',
  '02': '/models/panda_intermedio.glb',
  musculoso: '/models/panda_musculoso.glb',
  adulto: '/models/panda_musculoso.glb',
  '03': '/models/panda_musculoso.glb',
}

const STAGE_LABELS = {
  bebe: '01 · Panda Bebé',
  intermedio: '02 · Panda Intermedio',
  juvenil: '02 · Panda Intermedio',
  musculoso: '03 · Panda Musculoso',
}

/**
 * Componente 3D que renderiza los modelos de Blender a pantalla completa o contenedor abierto.
 * - Zoom desactivado (disable-zoom) para evitar desajustes.
 * - Paneado desactivado (disable-pan).
 * - Ángulo polar bloqueado a 82deg (solo gira horizontalmente 360° hacia la izquierda o derecha).
 * - 100% iconos de Bootstrap (bi-*).
 * - Sin marcos o casilleros verdes encerrando al panda.
 */
export default function PandaCharacter3D({
  stage = 'intermedio',
  isTraining = false,
  onPandaTap = () => {},
  autoRotate = false,
  onToggleRotate = null,
  modelViewerRef: externalRef = null,
}) {
  const localRef = useRef(null)
  const viewerRef = externalRef || localRef

  const [isLoading, setIsLoading] = useState(true)
  const [loadProgress, setLoadProgress] = useState(0)
  const [isTapped, setIsTapped] = useState(false)

  const normalizedStage = String(stage || 'intermedio').toLowerCase()
  const modelSrc = MODEL_MAP[normalizedStage] || MODEL_MAP.intermedio
  const stageLabel = STAGE_LABELS[normalizedStage] || 'Panda 3D'

  useEffect(() => {
    setIsLoading(true)
    setLoadProgress(0)

    const viewer = viewerRef.current
    if (!viewer) return

    const handleProgress = (event) => {
      const progress = Math.round((event.detail.totalProgress || 0) * 100)
      setLoadProgress(progress)
    }

    const handleLoad = () => {
      setIsLoading(false)
      setLoadProgress(100)
    }

    viewer.addEventListener('progress', handleProgress)
    viewer.addEventListener('load', handleLoad)

    return () => {
      viewer.removeEventListener('progress', handleProgress)
      viewer.removeEventListener('load', handleLoad)
    }
  }, [modelSrc, viewerRef])

  const handleTap = (e) => {
    setIsTapped(true)
    setTimeout(() => setIsTapped(false), 450)
    onPandaTap(e)
  }

  return (
    <div
      onClick={handleTap}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '360px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        cursor: 'grab',
        overflow: 'hidden',
      }}
    >
      {/* Resplandor ambiental de suelo (sin bordes ni casilleros) */}
      <div
        style={{
          position: 'absolute',
          bottom: '8%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '75%',
          height: '24%',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(196, 240, 57, 0.18) 0%, rgba(196, 240, 57, 0.05) 45%, transparent 75%)',
          filter: 'blur(20px)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Visor 3D oficial Google Model Viewer con ángulo bloqueado y zoom desactivado */}
      <model-viewer
        ref={viewerRef}
        src={modelSrc}
        alt={`Modelo 3D de ${stageLabel}`}
        camera-controls
        disable-zoom
        disable-pan
        touch-action="none"
        auto-rotate={autoRotate ? '' : null}
        rotation-per-second="18deg"
        auto-rotate-delay="1000"
        camera-orbit="0deg 82deg 126%"
        min-camera-orbit="auto 82deg 126%"
        max-camera-orbit="auto 82deg 126%"
        shadow-intensity="1.35"
        shadow-softness="0.55"
        exposure="1.08"
        environment-image="neutral"
        interaction-prompt="none"
        bounds="tight"
        style={{
          width: '100%',
          height: '100%',
          minHeight: '360px',
          outline: 'none',
          position: 'relative',
          zIndex: 2,
          transform: isTapped || isTraining ? 'scale(1.025)' : 'scale(1)',
          transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      />

      {/* Indicador de carga transparente */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(11, 20, 14, 0.75)',
            backdropFilter: 'blur(8px)',
            color: '#f8fafc',
          }}
        >
          <div
            className="spinner-border text-success"
            role="status"
            style={{
              width: '2.5rem',
              height: '2.5rem',
              borderColor: 'rgba(196, 240, 57, 0.2)',
              borderTopColor: '#c4f039',
              marginBottom: '12px',
            }}
          >
            <span className="visually-hidden">Cargando...</span>
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="bi bi-box-fill text-warning"></i> Cargando Modelo 3D...
          </div>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '4px' }}>
            {loadProgress}% descargado
          </div>
        </div>
      )}
    </div>
  )
}

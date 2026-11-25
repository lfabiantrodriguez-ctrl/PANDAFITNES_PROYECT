import { useState } from 'react'

const STAGE_SPRITES = {
  bebe: {
    src: '/images/panda_bebe_2d.png',
    alt: 'Panda Bebé entrenando con mancuernas',
  },
  intermedio: {
    src: '/images/panda_intermedio_2d.png',
    alt: 'Panda Intermedio entrenando con mancuerna',
  },
  juvenil: {
    src: '/images/panda_intermedio_2d.png',
    alt: 'Panda Intermedio entrenando con mancuerna',
  },
  musculoso: {
    src: '/images/panda_musculoso_2d.png',
    alt: 'Panda Musculoso levantando barra olímpica',
  },
}

/**
 * Personaje Panda 2D interactivo (ilustraciones chibi/kawaii con fondo transparente)
 * con animaciones estilo Pou al respirar, tocar y entrenar.
 */
export default function PandaCharacterSVG({
  stage = 'intermedio',
  isTraining = false,
  onPandaTap = () => {},
  showAura = false,
}) {
  const [isBouncing, setIsBouncing] = useState(false)
  const isMuscular = stage === 'musculoso'
  const sprite = STAGE_SPRITES[stage] || STAGE_SPRITES.intermedio

  function handleTap(e) {
    setIsBouncing(true)
    setTimeout(() => setIsBouncing(false), 540)
    onPandaTap(e)
  }

  return (
    <div
      onClick={handleTap}
      style={{
        width: 'min(74vw, 320px)',
        height: 'min(38vh, 320px)',
        minHeight: '220px',
        margin: '0 auto',
        cursor: 'pointer',
        position: 'relative',
        userSelect: 'none',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      title="¡Toca a tu Pandita!"
    >
      <style>{`
        @keyframes pandaIdleFloat {
          0%, 100% { transform: translateY(0px) scale(1, 1); }
          50% { transform: translateY(-7px) scale(1.018, 0.985); }
        }
        @keyframes pandaTapBounce {
          0% { transform: scale(1, 1) translateY(0); }
          22% { transform: scale(1.12, 0.88) translateY(12px); }
          55% { transform: scale(0.94, 1.08) translateY(-16px); }
          80% { transform: scale(1.04, 0.96) translateY(3px); }
          100% { transform: scale(1, 1) translateY(0); }
        }
        @keyframes pandaTrainPump {
          0%, 100% { transform: translateY(0px) scale(1, 1); }
          35% { transform: translateY(6px) scale(1.06, 0.94); }
          70% { transform: translateY(-14px) scale(0.97, 1.04); }
        }
      `}</style>

      {/* Sombra sutil de piso adaptada a fondo blanco */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: '5%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: isMuscular ? '64%' : '54%',
          height: '22px',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(17, 29, 21, 0.16) 0%, rgba(17, 29, 21, 0) 72%)',
          pointerEvents: 'none',
        }}
      />

      <img
        src={sprite.src}
        alt={sprite.alt}
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          transformOrigin: '50% 85%',
          animation: isBouncing
            ? 'pandaTapBounce 0.54s cubic-bezier(0.34, 1.56, 0.64, 1)'
            : isTraining
              ? 'pandaTrainPump 0.72s ease-in-out infinite'
              : 'pandaIdleFloat 2.8s ease-in-out infinite',
          filter:
            isMuscular || showAura
              ? 'drop-shadow(0 12px 18px rgba(17, 29, 21, 0.16)) drop-shadow(0 0 18px rgba(132, 204, 22, 0.35))'
              : 'drop-shadow(0 12px 18px rgba(17, 29, 21, 0.14))',
        }}
      />
    </div>
  )
}

import { useState } from 'react'

/**
 * Componente de Panda modelado 100% en SVG vectorial interactivo.
 * Evoluciona paramétricamente según la etapa ('bebe' | 'juvenil' | 'musculoso').
 * Reacciona al tacto haciendo repeticiones, animaciones y expresiones.
 */
export default function PandaCharacterSVG({
  stage = 'juvenil', // 'bebe' | 'juvenil' | 'musculoso'
  isTraining = false,
  reps = 0,
  onPandaTap = () => {},
  showAura = false,
}) {
  const [isWinking, setIsWinking] = useState(false)

  const handleTap = (e) => {
    setIsWinking(true)
    setTimeout(() => setIsWinking(false), 900)
    onPandaTap(e)
  }

  // Dimensiones y ajustes según la etapa
  const isBaby = stage === 'bebe'
  const isYouth = stage === 'juvenil'
  const isMuscular = stage === 'musculoso'

  return (
    <div
      onClick={handleTap}
      style={{
        width: '100%',
        maxWidth: '340px',
        margin: '0 auto',
        cursor: 'pointer',
        position: 'relative',
        userSelect: 'none',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      title="¡Toca a tu Pandita para entrenar!"
    >
      {/* Estilos CSS de animación para el modelado SVG */}
      <style>{`
        @keyframes pandaBreathe {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-4px) scale(1.01); }
        }
        @keyframes pandaArmCurl {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-18deg) translateY(-8px); }
        }
        @keyframes pandaArmCurlRight {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(18deg) translateY(-8px); }
        }
        @keyframes sweatDrop {
          0% { opacity: 0; transform: translateY(-6px); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: translateY(12px); }
        }
        @keyframes auraGlow {
          0%, 100% { filter: drop-shadow(0 0 12px rgba(196, 240, 57, 0.45)); }
          50% { filter: drop-shadow(0 0 24px rgba(196, 240, 57, 0.85)); }
        }
        @keyframes starSpin {
          0% { transform: rotate(0deg) scale(0.9); }
          50% { transform: rotate(180deg) scale(1.1); }
          100% { transform: rotate(360deg) scale(0.9); }
        }
      `}</style>

      <svg
        viewBox="0 0 360 360"
        style={{
          width: '100%',
          height: 'auto',
          maxHeight: '310px',
          overflow: 'visible',
          animation: isTraining
            ? 'pandaBreathe 0.5s ease-in-out infinite'
            : 'pandaBreathe 3s ease-in-out infinite',
          filter: isMuscular
            ? 'drop-shadow(0 14px 22px rgba(0,0,0,0.45)) drop-shadow(0 0 16px rgba(196,240,57,0.35))'
            : 'drop-shadow(0 12px 18px rgba(0,0,0,0.35))',
        }}
      >
        <defs>
          {/* Sombras y degradados vectoriales */}
          <radialGradient id="bodyGrad" cx="45%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="85%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </radialGradient>

          <linearGradient id="darkFur" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#27272a" />
            <stop offset="70%" stopColor="#18181b" />
            <stop offset="100%" stopColor="#09090b" />
          </linearGradient>

          <linearGradient id="headbandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>

          <linearGradient id="neonGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#c4f039" />
            <stop offset="100%" stopColor="#84cc16" />
          </linearGradient>

          <linearGradient id="ironPlate" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#52525b" />
            <stop offset="50%" stopColor="#27272a" />
            <stop offset="100%" stopColor="#09090b" />
          </linearGradient>
        </defs>

        {/* Aura de energía para el Panda Musculoso */}
        {isMuscular && (
          <g opacity="0.4">
            <circle cx="180" cy="180" r="145" fill="none" stroke="#c4f039" strokeWidth="3" strokeDasharray="10 8" style={{ animation: 'starSpin 14s linear infinite', transformOrigin: '180px 180px' }} />
            <circle cx="180" cy="180" r="160" fill="none" stroke="#84cc16" strokeWidth="1.5" strokeDasharray="6 12" style={{ animation: 'starSpin 20s linear infinite reverse', transformOrigin: '180px 180px' }} />
          </g>
        )}

        {/* Sombra de suelo */}
        <ellipse cx="180" cy="335" rx={isMuscular ? 95 : isBaby ? 65 : 80} ry="14" fill="rgba(0,0,0,0.35)" />

        {/* ==========================================
            PIERNAS Y PIES
            ========================================== */}
        <g id="legs">
          {/* Pierna Izquierda */}
          <path d={isMuscular ? "M125 240 L115 315 A16 16 0 0 0 145 322 L150 250 Z" : "M130 250 L125 310 A14 14 0 0 0 152 315 L152 260 Z"} fill="url(#darkFur)" />
          {/* Calzado / Pata izquierda */}
          <ellipse cx="132" cy="318" rx={isMuscular ? "22" : "18"} ry="10" fill={isYouth || isMuscular ? "#111d15" : "#18181b"} stroke={isYouth || isMuscular ? "#c4f039" : "none"} strokeWidth="2.5" />

          {/* Pierna Derecha */}
          <path d={isMuscular ? "M235 240 L245 315 A16 16 0 0 1 215 322 L210 250 Z" : "M230 250 L235 310 A14 14 0 0 1 208 315 L208 260 Z"} fill="url(#darkFur)" />
          {/* Calzado / Pata derecha */}
          <ellipse cx="228" cy="318" rx={isMuscular ? "22" : "18"} ry="10" fill={isYouth || isMuscular ? "#111d15" : "#18181b"} stroke={isYouth || isMuscular ? "#c4f039" : "none"} strokeWidth="2.5" />
        </g>

        {/* ==========================================
            CUERPO / TORSO
            ========================================== */}
        <g id="body">
          {/* Hombros oscuros */}
          <ellipse cx="180" cy="230" rx={isMuscular ? "84" : isBaby ? "62" : "72"} ry={isMuscular ? "60" : "55"} fill="url(#darkFur)" />

          {/* Pancita blanca */}
          <ellipse cx="180" cy="245" rx={isMuscular ? "62" : isBaby ? "56" : "58"} ry={isMuscular ? "50" : "48"} fill="url(#bodyGrad)" />

          {/* Si es Muscular: pectoral y líneas de abs discretas */}
          {isMuscular && (
            <g stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" opacity="0.6">
              <path d="M165 228 Q180 234 195 228" />
              <path d="M168 250 Q180 256 192 250" />
            </g>
          )}

          {/* Si es Bebé: babero o pañal tierno */}
          {isBaby && (
            <g>
              <path d="M150 205 Q180 220 210 205 L202 230 Q180 242 158 230 Z" fill="#38bdf8" opacity="0.85" />
              <circle cx="180" cy="222" r="5" fill="#ffffff" />
            </g>
          )}

          {/* Si es Juvenil o Muscular: logotipo o detalle en el pecho */}
          {(isYouth || isMuscular) && (
            <g transform="translate(170, 215)">
              <polygon points="10,0 2,12 8,12 6,20 16,7 10,7" fill="#c4f039" />
            </g>
          )}
        </g>

        {/* ==========================================
            BRAZOS CON MANCUERNAS / BARRA
            ========================================== */}
        <g id="arms">
          {/* BRAZO IZQUIERDO */}
          <g
            style={{
              transformOrigin: '120px 200px',
              animation: isTraining ? 'pandaArmCurl 0.6s ease-in-out infinite' : 'none',
            }}
          >
            {/* Brazo / Bíceps */}
            <path
              d={isMuscular
                ? "M130 190 Q90 170 82 205 Q85 240 120 225 Z"
                : "M130 195 Q100 180 95 210 Q98 235 125 225 Z"}
              fill="url(#darkFur)"
            />

            {/* Muñequera deportiva en Juvenil / Muscular */}
            {(isYouth || isMuscular) && (
              <rect x="85" y="196" width="16" height="12" rx="3" fill="#ef4444" />
            )}

            {/* Mancuerna Izquierda */}
            <g transform="translate(70, 190)">
              {/* Barra central */}
              <rect x="0" y="8" width="38" height="6" rx="2" fill="#94a3b8" />
              {/* Disco interior */}
              <rect x="2" y={isBaby ? "3" : isMuscular ? "-8" : "-3"} width="7" height={isBaby ? "16" : isMuscular ? "38" : "28"} rx="3" fill="url(#ironPlate)" stroke="#18181b" strokeWidth="1" />
              {/* Disco exterior */}
              <rect x="29" y={isBaby ? "3" : isMuscular ? "-8" : "-3"} width="7" height={isBaby ? "16" : isMuscular ? "38" : "28"} rx="3" fill="url(#ironPlate)" stroke="#18181b" strokeWidth="1" />
              {/* Detalle neón en mancuerna */}
              {isMuscular && (
                <circle cx="5" cy="11" r="3" fill="#c4f039" />
              )}
            </g>
          </g>

          {/* BRAZO DERECHO */}
          <g
            style={{
              transformOrigin: '240px 200px',
              animation: isTraining ? 'pandaArmCurlRight 0.6s ease-in-out infinite' : 'none',
            }}
          >
            {/* Brazo / Bíceps */}
            <path
              d={isMuscular
                ? "M230 190 Q270 170 278 205 Q275 240 240 225 Z"
                : "M230 195 Q260 180 265 210 Q262 235 235 225 Z"}
              fill="url(#darkFur)"
            />

            {/* Muñequera deportiva */}
            {(isYouth || isMuscular) && (
              <rect x="259" y="196" width="16" height="12" rx="3" fill="#ef4444" />
            )}

            {/* Mancuerna Derecha */}
            <g transform="translate(252, 190)">
              {/* Barra central */}
              <rect x="0" y="8" width="38" height="6" rx="2" fill="#94a3b8" />
              {/* Disco interior */}
              <rect x="2" y={isBaby ? "3" : isMuscular ? "-8" : "-3"} width="7" height={isBaby ? "16" : isMuscular ? "38" : "28"} rx="3" fill="url(#ironPlate)" stroke="#18181b" strokeWidth="1" />
              {/* Disco exterior */}
              <rect x="29" y={isBaby ? "3" : isMuscular ? "-8" : "-3"} width="7" height={isBaby ? "16" : isMuscular ? "38" : "28"} rx="3" fill="url(#ironPlate)" stroke="#18181b" strokeWidth="1" />
              {/* Detalle neón en mancuerna */}
              {isMuscular && (
                <circle cx="33" cy="11" r="3" fill="#c4f039" />
              )}
            </g>
          </g>
        </g>

        {/* ==========================================
            CABEZA Y OREJAS
            ========================================== */}
        <g id="head">
          {/* Oreja Izquierda */}
          <ellipse cx="120" cy="98" rx="24" ry="22" fill="url(#darkFur)" transform="rotate(-18 120 98)" />
          <ellipse cx="121" cy="98" rx="13" ry="12" fill="#f43f5e" opacity="0.3" transform="rotate(-18 121 98)" />

          {/* Oreja Derecha */}
          <ellipse cx="240" cy="98" rx="24" ry="22" fill="url(#darkFur)" transform="rotate(18 240 98)" />
          <ellipse cx="239" cy="98" rx="13" ry="12" fill="#f43f5e" opacity="0.3" transform="rotate(18 239 98)" />

          {/* Base de la Cabeza (Blanca) */}
          <circle cx="180" cy="142" r="64" fill="url(#bodyGrad)" />

          {/* Mejillas Rosadas */}
          <ellipse cx="138" cy="162" rx="11" ry="6" fill="#fb7185" opacity="0.45" />
          <ellipse cx="222" cy="162" rx="11" ry="6" fill="#fb7185" opacity="0.45" />

          {/* Mancha Ocular Izquierda */}
          <ellipse cx="146" cy="136" rx="19" ry="17" fill="url(#darkFur)" transform="rotate(-16 146 136)" />
          {/* Mancha Ocular Derecha */}
          <ellipse cx="214" cy="136" rx="19" ry="17" fill="url(#darkFur)" transform="rotate(16 214 136)" />

          {/* OJOS */}
          {/* Ojo Izquierdo */}
          <circle cx="148" cy="136" r="8" fill="#ffffff" />
          <circle cx="149" cy="136" r="5.5" fill="#09090b" />
          <circle cx="147" cy="134" r="2.2" fill="#ffffff" />

          {/* Ojo Derecho (o guiño si hace clic) */}
          {isWinking ? (
            <path d="M206 137 Q214 130 222 137" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" />
          ) : (
            <>
              <circle cx="212" cy="136" r="8" fill="#ffffff" />
              <circle cx="211" cy="136" r="5.5" fill="#09090b" />
              <circle cx="213" cy="134" r="2.2" fill="#ffffff" />
            </>
          )}

          {/* Nariz */}
          <path d="M174 150 Q180 146 186 150 Q180 157 174 150 Z" fill="#09090b" />

          {/* Boca Alegre */}
          <path d="M172 159 Q180 167 188 159" stroke="#09090b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M174 160 Q180 173 186 160 Z" fill="#f43f5e" />

          {/* CINTA DE ENTRENAMIENTO ROJA (HEADBAND) - Para Juvenil y Musculoso */}
          {(isYouth || isMuscular) && (
            <g id="headband">
              {/* Banda principal que cruza la frente */}
              <path
                d="M120 114 Q180 102 240 114 L241 126 Q180 114 119 126 Z"
                fill="url(#headbandGrad)"
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
              />
              {/* Nudo de la cinta flameando en el lado derecho */}
              <path
                d="M238 120 Q265 110 272 124 Q255 128 238 123 Z"
                fill="#ef4444"
              />
              <path
                d="M239 123 Q272 134 268 148 Q252 136 238 126 Z"
                fill="#dc2626"
              />
            </g>
          )}

          {/* Si es Bebé: Pelito tierno arriba */}
          {isBaby && (
            <path d="M178 80 Q180 70 184 76 Q186 68 190 75" stroke="#18181b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          )}
        </g>

        {/* Gotas de sudor en entrenamiento */}
        {isTraining && (
          <g>
            <path d="M110 130 C110 126 114 122 116 118 C118 122 122 126 122 130 A6 6 0 0 1 110 130 Z" fill="#38bdf8" opacity="0.9" style={{ animation: 'sweatDrop 0.8s ease-in-out infinite' }} />
            <path d="M250 135 C250 131 254 127 256 123 C258 127 262 131 262 135 A6 6 0 0 1 250 135 Z" fill="#38bdf8" opacity="0.9" style={{ animation: 'sweatDrop 0.8s ease-in-out infinite 0.3s' }} />
          </g>
        )}
      </svg>
    </div>
  )
}

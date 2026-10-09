import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CapacityPanel from '../components/CapacityPanel'
import LoginModal, { ROLE_HOME } from '../components/LoginModal'
import PandaCharacterSVG from '../components/PandaCharacterSVG'
import { ConfigService } from '../services/ConfigService'

// Módulos destacados estilo Google Play Store / App Store
const SYSTEM_FEATURES = [
  {
    id: 'mascota',
    tag: 'GAMIFICACIÓN & RACHA',
    title: 'Tu Pandita Fitness Evoluciona',
    desc: 'Un compañero virtual que crece contigo. De Panda Bebé a Adulto Musculoso, cada entrenamiento que registras suma +100 XP y desbloquea accesorios.',
    icon: '🐼',
    badge: 'NIVEL 1 A 30+',
    color: '#c4f039',
    imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'recompensas',
    tag: 'TIENDA & BENEFICIOS',
    title: 'Gana Bambús y Canjea Premios',
    desc: 'Cada visita suma bambús a tu saldo personal. Cámbialos en recepción por shakes de proteína, bebidas energéticas, toallas o descuentos en tu cuota.',
    icon: '🎋',
    badge: 'CATÁLOGO REAL',
    color: '#84cc16',
    imageUrl: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'convenios',
    tag: 'ALIANZAS COMERCIALES',
    title: 'Descuentos Exclusivos en Marcas',
    desc: 'Tu membresía Panda te da entre 15% y 30% de descuento en suplementos deportivos, fisioterapia muscular, indumentaria y restaurantes saludables.',
    icon: '🤝',
    badge: 'CUPONES ACTIVOS',
    color: '#38bdf8',
    imageUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'aforo',
    tag: 'CONTROL EN TIEMPO REAL',
    title: 'Monitoreo de Aforo en Vivo',
    desc: 'Evita aglomeraciones. Revisa desde tu celular cuántas personas están entrenando ahora mismo antes de salir de casa.',
    icon: '📊',
    badge: 'DATOS EN DIRECTO',
    color: '#facc15',
    imageUrl: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'acceso',
    tag: 'CHECK-IN FLUIDO',
    title: 'Acceso Ágil sin Esperas',
    desc: 'Ingreso directo mediante escaneo QR o huella dactilar. Sin tarjetas físicas ni filas en recepción.',
    icon: '⚡',
    badge: 'INSTANTÁNEO',
    color: '#a855f7',
    imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80',
  },
]

export default function PublicHome({ onLogin, token, user, initialLoginOpen = false }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(initialLoginOpen || searchParams.get('login') === 'true')

  // Datos dinámicos de configuración de empresa y landing
  const [companyConfig, setCompanyConfig] = useState({
    empresa_nombre: 'Panda Fitness',
    empresa_descripcion: 'Centro de Entrenamiento & Fitness Integral',
    empresa_logo: '/logo-panda.png',
    aviso_activo: '0',
    aviso_mensaje: '',
    aviso_titulo: '',
    estado_operativo: 'normal',
    landing_hero_titulo: 'Entrena, Evoluciona y Gana Premios en Panda Fitness',
    landing_hero_subtitulo: 'Tu centro de entrenamiento inteligente con monitoreo de aforo en tiempo real, mascota virtual interactiva que evoluciona con tu esfuerzo y recompensas reales.',
    landing_gym_direccion: 'Av. Principal Los Olivos 450, Centro Deportivo Panda',
    landing_gym_telefono: '+51 987 654 321',
    landing_gym_mapa_url: 'https://maps.google.com',
    landing_redes_instagram: 'pandafitness_oficial',
    landing_redes_tiktok: '@pandafitness_gym',
    landing_redes_facebook: 'pandafitnessclub',
    landing_redes_whatsapp: '+51 987 654 321',
    landing_imagenes_gym: '',
  })

  // Detección de dispositivo móvil vs PC
  const [isMobileDevice, setIsMobileDevice] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [appInstalled, setAppInstalled] = useState(false)

  // Showcase interactivo del Panda en la landing
  const [showcaseStage, setShowcaseStage] = useState('juvenil') // 'bebe' | 'juvenil' | 'musculoso'
  const [pandaReps, setPandaReps] = useState(5)
  const [isPandaTraining, setIsPandaTraining] = useState(false)

  // Tab activo en el carrusel de funcionalidades (estilo Play Store)
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0)

  useEffect(() => {
    // Detección de si es smartphone / tablet
    const checkIsMobile = () => {
      const userAgentCheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      const screenWidthCheck = window.innerWidth <= 768
      setIsMobileDevice(userAgentCheck || screenWidthCheck)
    }

    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)

    // Capturar evento PWA de instalación
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    })

    window.addEventListener('appinstalled', () => {
      setAppInstalled(true)
      setDeferredPrompt(null)
    })

    // Cargar configuración de la empresa y portal
    ConfigService.getConfig()
      .then((data) => {
        if (data) {
          setCompanyConfig((prev) => ({
            ...prev,
            ...data,
          }))
          ConfigService.applyBranding(data)
        }
      })
      .catch(() => {})

    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])

  useEffect(() => {
    if (initialLoginOpen || searchParams.get('login') === 'true') {
      setIsLoginModalOpen(true)
    }
  }, [initialLoginOpen, searchParams])

  // Disparar instalación de PWA
  async function handleInstallApp() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setAppInstalled(true)
      }
      setDeferredPrompt(null)
    } else {
      setShowInstallModal(true)
    }
  }

  function handleOpenLogin() {
    if (token && user) {
      navigate(ROLE_HOME[user.rol] || '/app/perfil')
    } else {
      setIsLoginModalOpen(true)
    }
  }

  // Tocar panda en el showcase interactivo
  function handleShowcasePandaTap() {
    setIsPandaTraining(true)
    setPandaReps((prev) => prev + 1)
    setTimeout(() => setIsPandaTraining(false), 600)
  }

  // Imágenes del gimnasio configuradas o por defecto
  const gymImages = useMemo(() => {
    try {
      if (companyConfig.landing_imagenes_gym) {
        const parsed = JSON.parse(companyConfig.landing_imagenes_gym)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {
      // Ignorar error de parsing
    }
    return [
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=900&q=80',
    ]
  }, [companyConfig.landing_imagenes_gym])

  return (
    <div
      style={{
        background: '#090f0b',
        color: '#ffffff',
        minHeight: '100vh',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflowX: 'hidden',
      }}
    >
      {/* ========================================================
          BANNER INTELIGENTE PARA DISPOSITIVOS MÓVILES (PWA)
          ======================================================== */}
      {isMobileDevice && !appInstalled && (
        <div
          style={{
            background: 'linear-gradient(90deg, #112015 0%, #173020 100%)',
            borderBottom: '2px solid #c4f039',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src={companyConfig.empresa_logo || '/logo-panda.png'}
              alt="Logo"
              style={{ width: '34px', height: '34px', borderRadius: '50%', border: '1.5px solid #c4f039', background: '#ffffff', padding: '2px' }}
            />
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 900, color: '#ffffff', lineHeight: 1.2 }}>
                App Móvil Oficial Panda
              </div>
              <div style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>
                Entrena en pantalla completa con tu Pandita
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleInstallApp}
            style={{
              background: '#c4f039',
              color: '#111d15',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '9999px',
              fontWeight: 900,
              fontSize: '0.78rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 10px rgba(196, 240, 57, 0.4)',
            }}
          >
            📲 Instalar App
          </button>
        </div>
      )}

      {/* ========================================================
          BARRA DE NAVEGACIÓN SUPERIOR (NAVBAR)
          ======================================================== */}
      <header
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        {/* Marca y Logo Oficial */}
        <a
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            textDecoration: 'none',
          }}
        >
          <img
            src={companyConfig.empresa_logo || '/logo-panda.png'}
            alt="Panda Fitness Logo"
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              objectFit: 'contain',
              border: '2px solid #c4f039',
              background: '#ffffff',
              padding: '2px',
              boxShadow: '0 4px 14px rgba(196, 240, 57, 0.4)',
            }}
            onError={(e) => {
              e.target.onerror = null
              e.target.src = '/logo-panda.png'
            }}
          />
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {companyConfig.empresa_nombre?.split(' ')[0] || 'Panda'}{' '}
              <span style={{ color: '#c4f039' }}>
                {companyConfig.empresa_nombre?.split(' ').slice(1).join(' ') || 'Fitness'}
              </span>
            </div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Club Deportivo & Inteligente
            </div>
          </div>
        </a>

        {/* Enlaces Rápidos de Navegación (Visibles en pantallas medianas y grandes) */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
          }}
          className="d-none d-lg-flex"
        >
          <a href="#como-funciona" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 700 }}>
            Cómo Funciona
          </a>
          <a href="#mi-pandita" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 700 }}>
            Mi Pandita 🐼
          </a>
          <a href="#premios" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 700 }}>
            Premios & Convenios
          </a>
          <a href="#aforo" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 700 }}>
            Aforo en Vivo
          </a>
          <a href="#contacto" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 700 }}>
            Ubicación
          </a>
        </nav>

        {/* Botones de Acción (Instalar App + Acceso Grande) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={handleInstallApp}
            style={{
              padding: '10px 18px',
              borderRadius: '12px',
              border: '1.5px solid rgba(196, 240, 57, 0.4)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#c4f039',
              fontWeight: 800,
              fontSize: '0.86rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(196, 240, 57, 0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
          >
            <span>📲</span>
            <span>Instalar App</span>
          </button>

          <button
            type="button"
            onClick={handleOpenLogin}
            id="btn-header-login"
            style={{
              padding: '12px 24px',
              borderRadius: '14px',
              border: 'none',
              background: '#c4f039',
              color: '#111d15',
              fontWeight: 900,
              fontSize: '0.92rem',
              cursor: 'pointer',
              boxShadow: '0 4px 18px rgba(196, 240, 57, 0.35)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(196, 240, 57, 0.5)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 18px rgba(196, 240, 57, 0.35)'
            }}
          >
            {token && user ? 'Ir a mi Panel ➔' : 'Iniciar Sesión'}
          </button>
        </div>
      </header>

      {/* ========================================================
          HERO SECTION PRINCIPAL: TÍTULO, ACCESO GRANDE Y AFORO
          ======================================================== */}
      <section
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '40px 24px 60px',
        }}
      >
        <div className="row g-5 align-items-center">
          {/* Columna Izquierda: Mensaje Potente & Botón Gigante */}
          <div className="col-lg-7">
            {/* Badge Eyebrow */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(196, 240, 57, 0.1)',
                border: '1px solid rgba(196, 240, 57, 0.3)',
                padding: '6px 14px',
                borderRadius: '9999px',
                color: '#c4f039',
                fontSize: '0.78rem',
                fontWeight: 900,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: '20px',
              }}
            >
              <span>🔥</span>
              <span>SISTEMA DE ENTRENAMIENTO & FIDELIZACIÓN</span>
            </div>

            {/* Título Principal */}
            <h1
              style={{
                fontSize: 'clamp(2.2rem, 5vw, 3.8rem)',
                fontWeight: 900,
                color: '#ffffff',
                lineHeight: 1.12,
                letterSpacing: '-0.03em',
                marginBottom: '18px',
              }}
            >
              {companyConfig.landing_hero_titulo || 'Entrena, Evoluciona y Gana Premios en Panda Fitness'}
            </h1>

            {/* Descripción */}
            <p
              style={{
                fontSize: '1.05rem',
                color: '#94a3b8',
                lineHeight: 1.6,
                marginBottom: '32px',
                maxWidth: '620px',
              }}
            >
              {companyConfig.landing_hero_subtitulo ||
                'Tu centro de entrenamiento inteligente con monitoreo de aforo en vivo, mascota virtual interactiva que evoluciona con tu esfuerzo y recompensas reales por cada visita.'}
            </p>

            {/* BOTÓN DE ACCESO GIGANTE (SOLICITADO EN AUDIO) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '480px', marginBottom: '28px' }}>
              <button
                type="button"
                onClick={handleOpenLogin}
                id="btn-hero-login"
                style={{
                  width: '100%',
                  padding: '20px 32px',
                  borderRadius: '18px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #c4f039 0%, #a3e635 100%)',
                  color: '#111d15',
                  fontWeight: 900,
                  fontSize: '1.25rem',
                  letterSpacing: '0.02em',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  boxShadow: '0 10px 32px rgba(196, 240, 57, 0.45)',
                  transition: 'all 0.25s ease',
                  textTransform: 'uppercase',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)'
                  e.currentTarget.style.boxShadow = '0 14px 40px rgba(196, 240, 57, 0.6)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = '0 10px 32px rgba(196, 240, 57, 0.45)'
                }}
              >
                <span>⚡</span>
                <span>{token && user ? 'ENTRAR A MI PANEL' : 'ACCEDER AL SISTEMA'}</span>
                <span>➔</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                  🔒 Acceso exclusivo para socios y administración
                </span>
                <span style={{ fontSize: '0.78rem', color: '#84cc16', fontWeight: 800 }}>
                  ✓ Sin esperas
                </span>
              </div>
            </div>

            {/* Píldoras Rápidas de Confianza */}
            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontSize: '0.84rem', fontWeight: 700 }}>
                <span style={{ color: '#c4f039' }}>✓</span> Aforo en tiempo real
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontSize: '0.84rem', fontWeight: 700 }}>
                <span style={{ color: '#c4f039' }}>✓</span> Mascota evolutiva
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontSize: '0.84rem', fontWeight: 700 }}>
                <span style={{ color: '#c4f039' }}>✓</span> Suplementos y premios
              </div>
            </div>
          </div>

          {/* Columna Derecha: Tarjeta de Aforo en Sala en Vivo */}
          <div className="col-lg-5" id="aforo">
            <div
              style={{
                background: '#111d15',
                borderRadius: '28px',
                border: '1.5px solid #233c2a',
                padding: '24px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
              }}
            >
              <CapacityPanel />
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECCIÓN 2: SHOWCASE INTERACTIVO DE "MI PANDITA"
          (PRUEBA Y EVOLUCIÓN EN VIVO DEL PERSONAJE)
          ======================================================== */}
      <section
        id="mi-pandita"
        style={{
          background: 'linear-gradient(180deg, #090f0b 0%, #111d15 50%, #090f0b 100%)',
          padding: '80px 24px',
          borderTop: '1px solid rgba(196, 240, 57, 0.1)',
          borderBottom: '1px solid rgba(196, 240, 57, 0.1)',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 48px' }}>
            <span
              style={{
                color: '#c4f039',
                fontSize: '0.82rem',
                fontWeight: 900,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: '8px',
              }}
            >
              COMPAÑERO VIRTUAL DE ENTRENAMIENTO
            </span>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em', margin: '0 0 14px' }}>
              Al registrarte, tu esfuerzo hace crecer a tu Pandita
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.98rem', margin: 0, lineHeight: 1.6 }}>
              Cuantos más días entrenas en Panda Fitness, más fuerte y musculoso se pone. ¡Tócalo a continuación para probar cómo entrena y cambia sus etapas!
            </p>
          </div>

          <div className="row g-4 align-items-center">
            {/* Escenario del Panda Interactivo */}
            <div className="col-lg-6 text-center">
              <div
                style={{
                  background: 'radial-gradient(circle at 50% 50%, #192a1e 0%, #0d1510 75%)',
                  borderRadius: '32px',
                  border: '2px solid rgba(196, 240, 57, 0.25)',
                  padding: '36px 20px 28px',
                  position: 'relative',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                  maxWidth: '460px',
                  margin: '0 auto',
                }}
              >
                {/* Selector de Etapa Interactivo */}
                <div
                  style={{
                    display: 'flex',
                    background: '#090f0b',
                    borderRadius: '14px',
                    padding: '4px',
                    border: '1px solid #233c2a',
                    marginBottom: '20px',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowcaseStage('bebe')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: 'none',
                      background: showcaseStage === 'bebe' ? '#c4f039' : 'transparent',
                      color: showcaseStage === 'bebe' ? '#111d15' : '#94a3b8',
                      fontWeight: 800,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    🍼 Bebé (Nvl 1)
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowcaseStage('juvenil')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: 'none',
                      background: showcaseStage === 'juvenil' ? '#c4f039' : 'transparent',
                      color: showcaseStage === 'juvenil' ? '#111d15' : '#94a3b8',
                      fontWeight: 800,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    🥊 Juvenil (Nvl 3)
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowcaseStage('musculoso')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: 'none',
                      background: showcaseStage === 'musculoso' ? '#c4f039' : 'transparent',
                      color: showcaseStage === 'musculoso' ? '#111d15' : '#94a3b8',
                      fontWeight: 800,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    🦍 Musculoso (Nvl 5+)
                  </button>
                </div>

                {/* El Panda en SVG Interactivo */}
                <PandaCharacterSVG
                  stage={showcaseStage}
                  isTraining={isPandaTraining}
                  reps={pandaReps}
                  onPandaTap={handleShowcasePandaTap}
                />

                {/* Contador de Repeticiones y Botón Táctil */}
                <div style={{ marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={handleShowcasePandaTap}
                    style={{
                      background: '#1a2e21',
                      border: '1.5px solid #c4f039',
                      color: '#c4f039',
                      padding: '10px 22px',
                      borderRadius: '14px',
                      fontWeight: 900,
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(196, 240, 57, 0.25)',
                    }}
                  >
                    💪 ¡Toca para que entrene! (Repeticiones: {pandaReps})
                  </button>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Reglas y Motivación del Juego */}
            <div className="col-lg-6">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Tarjeta 1 */}
                <div
                  style={{
                    background: '#111d15',
                    borderRadius: '20px',
                    padding: '22px',
                    border: '1px solid #233c2a',
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ fontSize: '2rem', background: 'rgba(196,240,57,0.1)', padding: '10px', borderRadius: '14px', flexShrink: 0 }}>
                    ⚡
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: '0 0 4px' }}>
                      +100 XP por Asistencia Confirmada
                    </h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: 0, lineHeight: 1.5 }}>
                      Cada check-in con tu código QR o huella dactilar suma experiencia directamente a tu cuenta y hace subir de nivel a tu avatar.
                    </p>
                  </div>
                </div>

                {/* Tarjeta 2 */}
                <div
                  style={{
                    background: '#111d15',
                    borderRadius: '20px',
                    padding: '22px',
                    border: '1px solid #233c2a',
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ fontSize: '2rem', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '14px', flexShrink: 0 }}>
                    🔥
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: '0 0 4px' }}>
                      Multiplicador de Racha (Días Consecutivos)
                    </h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: 0, lineHeight: 1.5 }}>
                      No rompas tu cadena. A partir de 3 días seguidos activas el multiplicador de calor que genera más bambús canjeables por visita.
                    </p>
                  </div>
                </div>

                {/* Tarjeta 3 */}
                <div
                  style={{
                    background: '#111d15',
                    borderRadius: '20px',
                    padding: '22px',
                    border: '1px solid #233c2a',
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ fontSize: '2rem', background: 'rgba(132,204,22,0.1)', padding: '10px', borderRadius: '14px', flexShrink: 0 }}>
                    🎋
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: '0 0 4px' }}>
                      Bambús Canjeables en Recepción
                    </h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: 0, lineHeight: 1.5 }}>
                      Convierte tus visitas al gimnasio en batidos whey, botilitos oficiales, toallas de microfibra o pases de 1 día para invitar a tus amigos.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECCIÓN 3: GALERÍA / CARRUSEL ESTILO PLAY STORE
          (CÓMO FUNCIONA EL SISTEMA PANDA FITNESS)
          ======================================================== */}
      <section
        id="como-funciona"
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '80px 24px',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 48px' }}>
          <span
            style={{
              color: '#c4f039',
              fontSize: '0.82rem',
              fontWeight: 900,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: '8px',
            }}
          >
            EXPERIENCIA MÓVIL Y WEB
          </span>
          <h2 style={{ fontSize: '2.4rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em', margin: '0 0 12px' }}>
            Explora las funcionalidades del sistema
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.98rem', margin: 0 }}>
            Descubre por qué entrenar en Panda Fitness es completamente diferente a cualquier otro gimnasio tradicional.
          </p>
        </div>

        {/* Pestañas de Funcionalidad Estilo App Store */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            overflowX: 'auto',
            paddingBottom: '16px',
            marginBottom: '32px',
            justifyContent: 'flex-start',
          }}
        >
          {SYSTEM_FEATURES.map((feat, idx) => {
            const isActive = idx === activeFeatureIndex
            return (
              <button
                key={feat.id}
                type="button"
                onClick={() => setActiveFeatureIndex(idx)}
                style={{
                  flex: '0 0 auto',
                  padding: '12px 20px',
                  borderRadius: '16px',
                  border: isActive ? `2px solid ${feat.color}` : '1px solid #233c2a',
                  background: isActive ? '#16251b' : '#111d15',
                  color: isActive ? '#ffffff' : '#94a3b8',
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  boxShadow: isActive ? `0 4px 18px ${feat.color}30` : 'none',
                }}
              >
                <span>{feat.icon}</span>
                <span>{feat.title}</span>
              </button>
            )
          })}
        </div>

        {/* Showcase de la funcionalidad seleccionada */}
        {(() => {
          const current = SYSTEM_FEATURES[activeFeatureIndex]
          return (
            <div
              style={{
                background: '#111d15',
                borderRadius: '28px',
                border: `1.5px solid ${current.color}40`,
                padding: '36px',
                boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
              }}
            >
              <div className="row g-4 align-items-center">
                <div className="col-lg-6">
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    <span
                      style={{
                        background: `${current.color}25`,
                        color: current.color,
                        padding: '5px 12px',
                        borderRadius: '9999px',
                        fontSize: '0.74rem',
                        fontWeight: 900,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {current.tag}
                    </span>
                    <span
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        color: '#ffffff',
                        padding: '5px 12px',
                        borderRadius: '9999px',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                      }}
                    >
                      {current.badge}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '2rem', fontWeight: 900, color: '#ffffff', marginBottom: '14px', lineHeight: 1.2 }}>
                    {current.title}
                  </h3>
                  <p style={{ fontSize: '1rem', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '28px' }}>
                    {current.desc}
                  </p>

                  <button
                    type="button"
                    onClick={handleOpenLogin}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '12px',
                      border: 'none',
                      background: current.color,
                      color: '#111d15',
                      fontWeight: 900,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                    }}
                  >
                    Comenzar Ahora ➔
                  </button>
                </div>

                <div className="col-lg-6">
                  <div
                    style={{
                      borderRadius: '20px',
                      overflow: 'hidden',
                      height: '300px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
                    }}
                  >
                    <img
                      src={current.imageUrl}
                      alt={current.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </section>

      {/* ========================================================
          SECCIÓN 4: INSTALACIONES DEL GIMNASIO & FOTOS REALES
          ======================================================== */}
      <section
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '60px 24px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em', margin: '0 0 10px' }}>
            Nuestras Instalaciones
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.94rem', margin: 0 }}>
            Equipamiento de alta gama, zona cardiovascular, peso libre y cafetería deportiva.
          </p>
        </div>

        <div className="row g-3">
          {gymImages.map((imgUrl, i) => (
            <div key={i} className="col-6 col-md-3">
              <div
                style={{
                  borderRadius: '18px',
                  overflow: 'hidden',
                  height: '200px',
                  border: '1px solid #233c2a',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                }}
              >
                <img
                  src={imgUrl}
                  alt={`Instalación ${i + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'transform 0.4s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================
          SECCIÓN 5: UBICACIÓN, HORARIOS Y REDES SOCIALES
          ======================================================== */}
      <section
        id="contacto"
        style={{
          background: '#111d15',
          borderTop: '1px solid #233c2a',
          padding: '70px 24px',
        }}
      >
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div className="row g-5">
            {/* Ubicación y Dirección */}
            <div className="col-md-4">
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#c4f039', marginBottom: '14px' }}>
                📍 DÓNDE ESTAMOS
              </div>
              <p style={{ fontSize: '0.96rem', color: '#ffffff', fontWeight: 700, margin: '0 0 8px' }}>
                {companyConfig.landing_gym_direccion || 'Av. Principal Los Olivos 450, Centro Deportivo Panda'}
              </p>
              <p style={{ fontSize: '0.86rem', color: '#94a3b8', margin: '0 0 16px' }}>
                Zona céntrica de fácil acceso con estacionamiento privado para socios.
              </p>

              {companyConfig.landing_gym_mapa_url && (
                <a
                  href={companyConfig.landing_gym_mapa_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: '#c4f039',
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>Ver en Google Maps</span>
                  <span>↗</span>
                </a>
              )}
            </div>

            {/* Horarios de Atención Oficiales */}
            <div className="col-md-4">
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#c4f039', marginBottom: '14px' }}>
                ⏰ HORARIOS DE ENTRENAMIENTO
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem', color: '#cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed #233c2a', paddingBottom: '6px', gap: '8px' }}>
                  <span>Lunes a Viernes:</span>
                  <strong style={{ color: '#ffffff', textAlign: 'right' }}>
                    {companyConfig.horario_semana_modalidad === 'continuo'
                      ? `${companyConfig.horario_semana_corrido_inicio || '06:30'} - ${companyConfig.horario_semana_corrido_fin || '22:00'}`
                      : `${companyConfig.horario_semana_manana_inicio || '06:30'} - ${companyConfig.horario_semana_manana_fin || '11:00'} / ${companyConfig.horario_semana_tarde_inicio || '16:00'} - ${companyConfig.horario_semana_tarde_fin || '22:00'}`}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed #233c2a', paddingBottom: '6px', gap: '8px' }}>
                  <span>Sábados:</span>
                  <strong style={{ color: '#ffffff', textAlign: 'right' }}>
                    {companyConfig.horario_sabado_estado === '0'
                      ? 'Cerrado'
                      : `${companyConfig.horario_sabado_inicio || '07:00'} - ${companyConfig.horario_sabado_fin || '12:00'}`}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', gap: '8px' }}>
                  <span>Domingos y Feriados:</span>
                  <strong style={{ color: companyConfig.horario_domingo_abierto === '1' ? '#c4f039' : '#94a3b8', textAlign: 'right' }}>
                    {companyConfig.horario_domingo_abierto === '1'
                      ? `${companyConfig.horario_domingo_inicio || '08:00'} - ${companyConfig.horario_domingo_fin || '13:00'}`
                      : 'Cerrado (Descanso)'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Redes Sociales y Contacto Directo */}
            <div className="col-md-4">
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#c4f039', marginBottom: '14px' }}>
                💬 CONTACTO & REDES SOCIALES
              </div>
              <p style={{ fontSize: '0.88rem', color: '#94a3b8', margin: '0 0 16px' }}>
                Síguenos y entérate de nuevas recompensas, promociones y eventos fitness.
              </p>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {companyConfig.landing_redes_whatsapp && (
                  <a
                    href={`https://wa.me/${companyConfig.landing_redes_whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: '#16a34a',
                      color: '#ffffff',
                      padding: '8px 16px',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>💬</span> WhatsApp
                  </a>
                )}

                {companyConfig.landing_redes_instagram && (
                  <a
                    href={`https://instagram.com/${companyConfig.landing_redes_instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: '#e1306c',
                      color: '#ffffff',
                      padding: '8px 16px',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>📸</span> Instagram
                  </a>
                )}

                {companyConfig.landing_redes_tiktok && (
                  <a
                    href={`https://tiktok.com/@${companyConfig.landing_redes_tiktok.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: '#000000',
                      border: '1px solid #334155',
                      color: '#ffffff',
                      padding: '8px 16px',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>🎵</span> TikTok
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          FOOTER ATLETICO
          ======================================================== */}
      <footer
        style={{
          borderTop: '1px solid #1a2e21',
          padding: '30px 24px',
          textAlign: 'center',
          color: '#64748b',
          fontSize: '0.82rem',
        }}
      >
        <p style={{ margin: '0 0 8px' }}>
          © {new Date().getFullYear()} {companyConfig.empresa_nombre || 'Panda Fitness Club Deportivo'}. Todos los derechos reservados.
        </p>
        <p style={{ margin: 0 }}>
          Diseñado para entrenamiento inteligente, fidelización gamificada y control de acceso seguro.
        </p>
      </footer>

      {/* ========================================================
          MODAL DE INSTALACIÓN DE APLICACIÓN (PWA)
          ======================================================== */}
      {showInstallModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(9, 15, 11, 0.85)',
            backdropFilter: 'blur(10px)',
            zIndex: 1050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowInstallModal(false)}
        >
          <div
            style={{
              background: '#111d15',
              borderRadius: '24px',
              border: '2px solid #c4f039',
              padding: '32px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📲</div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffffff', margin: '0 0 8px' }}>
              Instalar App de Panda Fitness
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8', margin: '0 0 24px', lineHeight: 1.5 }}>
              Para la mejor experiencia en celular, añade Panda Fitness a tu pantalla de inicio como una aplicación nativa.
            </p>

            {/* Pasos según tipo de dispositivo */}
            <div
              style={{
                background: '#16251b',
                padding: '18px',
                borderRadius: '16px',
                border: '1px solid #233c2a',
                textAlign: 'left',
                marginBottom: '24px',
                fontSize: '0.84rem',
                color: '#cbd5e1',
                lineHeight: 1.6,
              }}
            >
              {/iPhone|iPad|iPod/i.test(navigator.userAgent) ? (
                <>
                  <strong style={{ color: '#c4f039', display: 'block', marginBottom: '4px' }}>
                    En iPhone / iPad (Safari):
                  </strong>
                  1. Toca el botón <strong>Compartir (⎋)</strong> en la barra inferior de Safari.<br />
                  2. Desliza hacia abajo y presiona <strong>"Añadir a pantalla de inicio" (➕)</strong>.<br />
                  3. Confirma tocando <strong>Añadir</strong> en la esquina superior derecha.
                </>
              ) : isMobileDevice ? (
                <>
                  <strong style={{ color: '#c4f039', display: 'block', marginBottom: '4px' }}>
                    En Android (Chrome / Edge):
                  </strong>
                  1. Presiona el botón verde de abajo <strong>"Añadir a Inicio"</strong>.<br />
                  2. O abre el menú de opciones (⋮) y selecciona <strong>"Instalar aplicación"</strong>.
                </>
              ) : (
                <>
                  <strong style={{ color: '#c4f039', display: 'block', marginBottom: '4px' }}>
                    En Computadora (Escritorio):
                  </strong>
                  Haz clic en el icono de instalación (⊞) en la barra de direcciones de tu navegador para usar Panda Fitness como app de escritorio.
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setShowInstallModal(false)}
                style={{
                  padding: '12px 20px',
                  borderRadius: '12px',
                  border: '1px solid #334155',
                  background: 'transparent',
                  color: '#94a3b8',
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                }}
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowInstallModal(false)
                  if (deferredPrompt) deferredPrompt.prompt()
                }}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#c4f039',
                  color: '#111d15',
                  fontWeight: 900,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                Entendido ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Inicio de Sesión */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLogin={onLogin}
      />
    </div>
  )
}

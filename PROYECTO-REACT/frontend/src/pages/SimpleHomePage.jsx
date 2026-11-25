import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CapacityPanel from '../components/CapacityPanel'
import LoginModal from '../components/LoginModal'
import { ConfigService } from '../services/ConfigService'
import { homeFor } from '../utils/access'
import '../styles/SimpleHome.css'

const ASSETS = '/images/panda-story/'

const STAGES = [
  {
    id: 'bebe',
    name: 'Etapa inicial',
    label: 'Empieza',
    line: 'Tus primeros días en el club.',
    desc: 'Al iniciar tu membresía comienzas con tu compañero en nivel inicial. Cada asistencia suma experiencia para avanzar.',
    note: 'Primeros entrenamientos',
    level: 'Nivel 1 — 2',
  },
  {
    id: 'intermedio',
    name: 'En progreso',
    label: 'Construye',
    line: 'La constancia se refleja en tu perfil.',
    desc: 'A medida que mantienes tu rutina semanal, acumulas experiencia y desbloqueas la etapa intermedia.',
    note: 'Hábito en consolidación',
    level: 'Nivel 3 — 4',
  },
  {
    id: 'musculoso',
    name: 'Nivel avanzado',
    label: 'Supérate',
    line: 'Resultado del esfuerzo sostenido.',
    desc: 'Al alcanzar los niveles superiores, tu perfil refleja todo tu recorrido en el club.',
    note: 'Constancia consolidada',
    level: 'Nivel 5+',
  },
]

const SPACES = [
  {
    image: 'training-strength.jpg',
    tag: 'Fuerza',
    title: 'Peso libre y musculación',
    desc: 'Barras olímpicas, racks, discos calibrados y bancas para entrenamiento progresivo.',
  },
  {
    image: 'training-cardio.jpg',
    tag: 'Cardio',
    title: 'Ciclismo y resistencia',
    desc: 'Bicicletas estacionarias y estaciones dedicadas al trabajo cardiovascular.',
  },
  {
    image: 'training-floor.jpg',
    tag: 'Sala general',
    title: 'Mancuernas y funcional',
    desc: 'Mancuernas, máquinas guiadas y espacio abierto para rutinas completas.',
  },
]

const REWARD_STEPS = [
  {
    number: '01',
    icon: 'bi-qr-code-scan',
    title: 'Registra tu visita',
    desc: 'Marca tu ingreso al llegar mediante código QR o huella dactilar en recepción.',
  },
  {
    number: '02',
    icon: 'bi-lightning-charge',
    title: 'Suma experiencia y bambús',
    desc: 'Cada entrenamiento registrado aporta puntos de avance y bambús a tu saldo.',
  },
  {
    number: '03',
    icon: 'bi-gift',
    title: 'Canjea beneficios',
    desc: 'Consulta las recompensas del club y descuentos con comercios aliados en tu cuenta.',
  },
]

const FAQS = [
  [
    '¿Cómo empiezo a entrenar?',
    'Visítanos o escríbenos para conocer las membresías. Si ya eres socio, ingresa con tu cuenta para consultar tu progreso y servicios.',
  ],
  [
    '¿Cómo evoluciona mi panda?',
    'Tu panda crece con la experiencia que acumulas al registrar tus asistencias. En tu cuenta puedes ver tu etapa actual.',
  ],
  [
    '¿Cómo funcionan las recompensas?',
    'Tus visitas te permiten acumular bambús para canjear premios disponibles en el catálogo de tu panel.',
  ],
  [
    '¿Puedo usarlo desde el celular?',
    'Sí. Abre la web en tu navegador y añade un acceso directo usando el botón Instalar app.',
  ],
]

const NAV_LINKS = [
  ['aforo', 'Aforo'],
  ['experiencia', 'Espacios'],
  ['evolucion', 'Tu progreso'],
  ['premios', 'Beneficios'],
  ['faq', 'Preguntas'],
  ['contacto', 'Horarios y contacto'],
]

function safeLink(value) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

export default function SimpleHomePage({ onLogin, token, user, initialLoginOpen = false }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const routeRequestsLogin = initialLoginOpen || params.get('login') === 'true'
  const [loginOpen, setLoginOpen] = useState(routeRequestsLogin)
  const [prevRouteLogin, setPrevRouteLogin] = useState(routeRequestsLogin)
  if (routeRequestsLogin !== prevRouteLogin) {
    setPrevRouteLogin(routeRequestsLogin)
    if (routeRequestsLogin) {
      setLoginOpen(true)
    }
  }

  const [config, setConfig] = useState({
    empresa_nombre: 'Panda Fitness',
    empresa_descripcion: 'Centro de Entrenamiento & Fitness Integral',
    empresa_logo: '/logo-panda.png',
  })
  const [stage, setStage] = useState(1)
  const [menuOpen, setMenuOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installed, setInstalled] = useState(() =>
    window.matchMedia('(display-mode: standalone)').matches
  )
  const installDialog = useRef(null)
  const headerRef = useRef(null)

  const panda = STAGES[stage]
  const brandName = config.empresa_nombre || 'Panda Fitness'
  const logoSrc = config.empresa_logo || '/logo-panda.png'

  useEffect(() => {
    let active = true
    ConfigService.getConfig()
      .then((data) => {
        if (active && data) {
          setConfig((prev) => ({ ...prev, ...data }))
        }
      })
      .catch(() => {})

    const handleBeforeInstall = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    const handleAppInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
      installDialog.current?.close()
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      active = false
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  function scrollToSection(id) {
    setMenuOpen(false)
    if (id === 'inicio') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const target = document.getElementById(id)
    if (!target) return
    const headerHeight = headerRef.current?.offsetHeight || 79
    const availableHeight = window.innerHeight - headerHeight
    const rect = target.getBoundingClientRect()
    const absoluteTop = window.scrollY + rect.top
    const targetHeight = target.offsetHeight

    let nextTop
    if (targetHeight <= availableHeight - 16) {
      nextTop = absoluteTop - headerHeight - (availableHeight - targetHeight) / 2
    } else {
      nextTop = absoluteTop - headerHeight - 8
    }

    window.scrollTo({
      top: Math.max(0, Math.round(nextTop)),
      behavior: 'smooth',
    })
  }

  function access() {
    setMenuOpen(false)
    if (token && user) {
      navigate(homeFor(user))
    } else {
      setLoginOpen(true)
    }
  }

  async function install() {
    setMenuOpen(false)
    if (installPrompt) {
      try {
        await installPrompt.prompt()
        const choice = await installPrompt.userChoice
        if (choice.outcome === 'accepted') setInstalled(true)
      } catch {
        installDialog.current?.showModal()
      } finally {
        setInstallPrompt(null)
      }
    } else {
      installDialog.current?.showModal()
    }
  }

  const phone = (config.landing_redes_whatsapp || config.landing_gym_telefono || '').replace(/\D/g, '')
  const whatsapp = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent('Hola, quiero conocer Panda Fitness y sus membresías.')}`
    : null

  const map = useMemo(() => {
    const saved = safeLink(config.landing_gym_mapa_url)
    if (saved && !/^https:\/\/maps.google.com\/?$/.test(saved)) return saved
    return config.landing_gym_direccion
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.landing_gym_direccion)}`
      : null
  }, [config.landing_gym_mapa_url, config.landing_gym_direccion])

  const schedule =
    config.horario_semana_modalidad === 'continuo'
      ? `${config.horario_semana_corrido_inicio || '06:30'} — ${config.horario_semana_corrido_fin || '22:00'}`
      : `${config.horario_semana_manana_inicio || '06:30'} — ${config.horario_semana_manana_fin || '11:00'} / ${config.horario_semana_tarde_inicio || '16:00'} — ${config.horario_semana_tarde_fin || '20:00'}`

  const saturdaySchedule =
    config.horario_sabado_estado === '0'
      ? 'Cerrado'
      : config.horario_sabado_modalidad === 'partido'
      ? `${config.horario_sabado_inicio || '07:00'} — ${config.horario_sabado_fin || '12:00'} / ${config.horario_sabado_tarde_inicio || '16:00'} — ${config.horario_sabado_tarde_fin || '20:00'}`
      : `${config.horario_sabado_inicio || '07:00'} — ${config.horario_sabado_fin || '12:00'}`

  const sundaySchedule =
    config.horario_domingo_abierto === '1'
      ? config.horario_domingo_modalidad === 'partido'
        ? `${config.horario_domingo_inicio || '08:00'} — ${config.horario_domingo_fin || '13:00'} / ${config.horario_domingo_tarde_inicio || '16:00'} — ${config.horario_domingo_tarde_fin || '20:00'}`
        : `${config.horario_domingo_inicio || '08:00'} — ${config.horario_domingo_fin || '13:00'}`
      : 'Día de descanso'

  return (
    <div className="simple-home" id="inicio">
      <button
        type="button"
        className="sh-skip-link"
        onClick={() => scrollToSection('contenido-principal')}
      >
        Saltar al contenido
      </button>

      <header className="sh-header" ref={headerRef}>
        <div className="sh-container sh-header-inner">
          <button
            type="button"
            className="sh-brand"
            aria-label={`${brandName}, ir al inicio`}
            onClick={() => scrollToSection('inicio')}
          >
            <img
              src={logoSrc}
              alt=""
              onError={(event) => {
                event.currentTarget.onerror = null
                event.currentTarget.src = '/logo-panda.png'
              }}
            />
            <span className="sh-brand-text">
              <strong>{brandName}</strong>
              <small>Club Deportivo</small>
            </span>
          </button>

          <nav
            id="sh-navigation"
            aria-label="Navegación principal"
            className={`sh-nav ${menuOpen ? 'is-open' : ''}`}
          >
            {NAV_LINKS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="sh-nav-btn"
                onClick={() => scrollToSection(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="sh-header-actions">
            <button type="button" className="sh-btn sh-btn-header-ghost sh-install-btn" onClick={install}>
              <i className="bi bi-download" aria-hidden="true" />
              <span>{installed ? 'Tu app' : 'Instalar app'}</span>
            </button>
            <button type="button" className="sh-btn sh-btn-accent" onClick={access}>
              <span>{token && user ? 'Mi panel' : 'Ingresar'}</span>
              <i className="bi bi-arrow-right" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="sh-menu-toggle"
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-controls="sh-navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <i className={`bi ${menuOpen ? 'bi-x-lg' : 'bi-list'}`} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {String(config.aviso_activo) === '1' && config.aviso_mensaje && (
        <aside className="sh-notice" role="status">
          <div className="sh-container sh-notice-inner">
            <i className="bi bi-info-circle-fill" aria-hidden="true" />
            <div>
              {config.aviso_titulo && <strong>{config.aviso_titulo}: </strong>}
              <span>{config.aviso_mensaje}</span>
            </div>
          </div>
        </aside>
      )}

      <main id="contenido-principal">
        <section className="sh-hero" id="club">
          <div className="sh-container sh-hero-grid">
            <div className="sh-hero-copy">
              <span className="sh-eyebrow">
                {config.empresa_descripcion || 'Centro de Entrenamiento & Fitness Integral'}
              </span>
              <h1>Entrena con orden, constancia y seguimiento real.</h1>
              <p className="sh-lead">
                Gestiona tu membresía, revisa el estado de la sala antes de asistir y lleva un
                control claro de tu entrenamiento desde tu cuenta.
              </p>
              <div className="sh-hero-actions">
                <button type="button" className="sh-btn sh-btn-primary sh-btn-lg" onClick={access}>
                  {token && user ? 'Ir a mi panel' : 'Ingresar a mi cuenta'}
                </button>
                <button
                  type="button"
                  className="sh-btn sh-btn-outline sh-btn-lg"
                  onClick={() => scrollToSection('aforo')}
                >
                  Consultar aforo en vivo
                </button>
              </div>
            </div>

            <div className="sh-hero-media">
              <figure className="sh-photo-frame">
                <img
                  src={`${ASSETS}training-floor.jpg`}
                  alt={`Sala principal de ${brandName}`}
                  width="1000"
                  height="667"
                  fetchPriority="high"
                />
                <figcaption>
                  <span className="sh-dot" aria-hidden="true" />
                  <span>Sala principal · {brandName}</span>
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="sh-section sh-section-dark" id="aforo">
          <div className="sh-container sh-two-col sh-align-center">
            <div className="sh-section-copy">
              <span className="sh-eyebrow sh-eyebrow-light">01 · Disponibilidad de sala</span>
              <h2>Aforo en tiempo real</h2>
              <p>
                Revisa cuántas personas se encuentran entrenando en el club en este momento para
                planificar tu horario con mayor comodidad y evitar horas pico.
              </p>
              <button
                type="button"
                className="sh-light-link-btn"
                onClick={() => scrollToSection('contacto')}
              >
                Ver horarios de atención <i className="bi bi-arrow-right" aria-hidden="true" />
              </button>
            </div>

            <div className="sh-capacity-card">
              <div className="sh-capacity-card-head">
                <span className="sh-live-indicator">
                  <i aria-hidden="true" /> Estado actual del club
                </span>
              </div>
              <CapacityPanel showDemo={false} />
            </div>
          </div>
        </section>

        <section className="sh-section sh-section-stone" id="experiencia">
          <div className="sh-container">
            <div className="sh-section-head">
              <div>
                <span className="sh-eyebrow">02 · Instalaciones</span>
                <h2>Espacios pensados para tu rutina</h2>
              </div>
              <p className="sh-section-subtitle">
                Áreas diferenciadas para trabajo de fuerza, acondicionamiento cardiovascular y
                entrenamiento general.
              </p>
            </div>

            <div className="sh-spaces-grid">
              {SPACES.map((item) => (
                <article className="sh-space-card" key={item.image}>
                  <div className="sh-space-media">
                    <img
                      src={`${ASSETS}${item.image}`}
                      alt={`${item.title} en ${brandName}`}
                      loading="lazy"
                      width="1000"
                      height="667"
                    />
                  </div>
                  <div className="sh-space-body">
                    <span className="sh-tag">{item.tag}</span>
                    <h3>{item.title}</h3>
                    <p>{item.desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="sh-section sh-section-white" id="evolucion" aria-labelledby="evolution-title">
          <div className="sh-container sh-two-col sh-align-center">
            <div className="sh-evolution-panel">
              <span className="sh-eyebrow">03 · Seguimiento del socio</span>
              <h2 id="evolution-title">Tu progreso en el club</h2>
              <p className="sh-section-lead">
                Cada sesión registrada aporta experiencia a tu perfil. Acompaña tu ritmo de
                entrenamiento a través de tres etapas simples.
              </p>

              <div className="sh-stage-tabs" role="group" aria-label="Etapas de evolución">
                {STAGES.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={stage === i}
                    onClick={() => setStage(i)}
                  >
                    <span>0{i + 1}</span>
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="sh-stage-detail" aria-live="polite">
                <h3>{panda.name}</h3>
                <p className="sh-stage-line">{panda.line}</p>
                <p>{panda.desc}</p>
              </div>

              <button type="button" className="sh-btn sh-btn-primary sh-btn-lg" onClick={access}>
                Conocer mi panda
              </button>
            </div>

            <div className="sh-stage-preview">
              <div className="sh-stage-preview-head">
                <span>Etapa 0{stage + 1} / 03</span>
                <span className="sh-stage-level">{panda.level}</span>
              </div>
              <div className="sh-stage-art">
                <img
                  src={`${ASSETS}${panda.id}.webp`}
                  alt={`Ilustración de referencia para la etapa ${panda.label.toLowerCase()}`}
                  loading="lazy"
                  width="640"
                  height="800"
                />
              </div>
              <div className="sh-stage-preview-foot">
                <strong>{panda.name}</strong>
                <span>{panda.note}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="sh-section sh-section-sage" id="premios">
          <div className="sh-container">
            <div className="sh-section-head">
              <div>
                <span className="sh-eyebrow">04 · Programa de fidelidad</span>
                <h2>Constancia con beneficios reales</h2>
              </div>
              <button type="button" className="sh-btn sh-btn-primary sh-btn-lg" onClick={access}>
                Explorar mis beneficios
              </button>
            </div>

            <div className="sh-steps-grid">
              {REWARD_STEPS.map((step) => (
                <article className="sh-step-card" key={step.number}>
                  <div className="sh-step-top">
                    <span className="sh-step-num">{step.number}</span>
                    <span className="sh-step-icon" aria-hidden="true">
                      <i className={`bi ${step.icon}`} />
                    </span>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="sh-section sh-section-white" id="faq">
          <div className="sh-container sh-faq-grid">
            <div>
              <span className="sh-eyebrow">05 · Información útil</span>
              <h2>Preguntas frecuentes</h2>
              <p className="sh-section-subtitle">
                Respuestas rápidas sobre membresías, acceso al sistema y seguimiento de asistencias.
              </p>
            </div>

            <div className="sh-faq-list">
              {FAQS.map(([question, answer], i) => (
                <details key={question}>
                  <summary>
                    <span className="sh-faq-num">0{i + 1}</span>
                    <span>{question}</span>
                    <i className="bi bi-plus-lg sh-faq-plus" aria-hidden="true" />
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="sh-contact" id="contacto">
          <div className="sh-container sh-contact-grid">
            <div className="sh-contact-intro">
              <span className="sh-eyebrow sh-eyebrow-light">06 · Atención y sede</span>
              <h2>Visítanos o consulta tus horarios</h2>
              <p>
                Nuestro equipo en recepción está disponible para orientarte sobre planes, registro
                biométrico y uso de la plataforma de socios.
              </p>
              <div className="sh-contact-cta">
                {whatsapp ? (
                  <a
                    className="sh-btn sh-btn-accent sh-btn-lg"
                    href={whatsapp}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <i className="bi bi-whatsapp" aria-hidden="true" />
                    <span>Hablemos por WhatsApp</span>
                  </a>
                ) : (
                  <button type="button" className="sh-btn sh-btn-accent sh-btn-lg" onClick={access}>
                    Entrar a {brandName}
                  </button>
                )}
              </div>
            </div>

            <div className="sh-contact-cards">
              <div className="sh-contact-block">
                <h3>Dirección</h3>
                <p>{config.landing_gym_direccion || 'Consulta nuestra ubicación en recepción.'}</p>
                {map && (
                  <a href={map} target="_blank" rel="noreferrer" className="sh-light-link">
                    Cómo llegar en Google Maps <i className="bi bi-arrow-up-right" aria-hidden="true" />
                  </a>
                )}
              </div>

              <div className="sh-contact-block">
                <h3>Horarios de atención</h3>
                <dl className="sh-schedule-list">
                  <div>
                    <dt>Lunes a viernes</dt>
                    <dd>{schedule}</dd>
                  </div>
                  <div>
                    <dt>Sábado</dt>
                    <dd>{saturdaySchedule}</dd>
                  </div>
                  <div>
                    <dt>Domingo</dt>
                    <dd>{sundaySchedule}</dd>
                  </div>
                </dl>
              </div>

              {config.landing_gym_telefono && (
                <div className="sh-contact-block">
                  <h3>Teléfono</h3>
                  <a
                    className="sh-phone-link"
                    href={`tel:${config.landing_gym_telefono.replace(/[^+\d]/g, '')}`}
                  >
                    {config.landing_gym_telefono}
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="sh-footer">
        <div className="sh-container sh-footer-grid">
          <div className="sh-footer-brand">
            <div className="sh-footer-logo">
              <img
                src={logoSrc}
                alt=""
                onError={(event) => {
                  event.currentTarget.onerror = null
                  event.currentTarget.src = '/logo-panda.png'
                }}
              />
              <div>
                <strong>{brandName}</strong>
                <span>Plataforma de socios</span>
              </div>
            </div>
            <p>Portal informativo y acceso digital para miembros del club.</p>
          </div>

          <div className="sh-footer-col">
            <h4>Redes sociales</h4>
            <ul>
              {config.landing_redes_instagram && (
                <li>
                  <a
                    href={`https://www.instagram.com/${config.landing_redes_instagram.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <i className="bi bi-instagram" aria-hidden="true" /> Instagram
                  </a>
                </li>
              )}
              {config.landing_redes_tiktok && (
                <li>
                  <a
                    href={`https://www.tiktok.com/@${config.landing_redes_tiktok.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <i className="bi bi-tiktok" aria-hidden="true" /> TikTok
                  </a>
                </li>
              )}
              {whatsapp && (
                <li>
                  <a href={whatsapp} target="_blank" rel="noreferrer">
                    <i className="bi bi-whatsapp" aria-hidden="true" /> WhatsApp
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div className="sh-footer-col">
            <h4>Acceso y aplicación</h4>
            <ul>
              <li>
                <button type="button" className="sh-footer-btn" onClick={access}>
                  <i className="bi bi-box-arrow-in-right" aria-hidden="true" />{' '}
                  {token && user ? 'Ir a mi panel' : 'Ingresar a mi cuenta'}
                </button>
              </li>
              <li>
                <button type="button" className="sh-footer-btn" onClick={install}>
                  <i className="bi bi-phone" aria-hidden="true" />{' '}
                  {installed ? 'Tu app instalada' : 'Instalar app'}
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="sh-footer-bottom">
          <div className="sh-container sh-footer-bottom-inner">
            <span>
              © {new Date().getFullYear()} {brandName}. Todos los derechos reservados.
            </span>
            <button
              type="button"
              className="sh-footer-top-link"
              onClick={() => scrollToSection('inicio')}
            >
              Volver arriba <i className="bi bi-arrow-up" aria-hidden="true" />
            </button>
          </div>
        </div>
      </footer>

      <dialog
        className="sh-install-dialog"
        ref={installDialog}
        aria-labelledby="sh-install-title"
        onCancel={(event) => event.preventDefault()}
        onClick={(event) => {
          if (event.target === installDialog.current) {
            const btn = installDialog.current.querySelector('.sh-dialog-close')
            if (btn) {
              btn.classList.remove('modal-close-jump')
              void btn.offsetWidth
              btn.classList.add('modal-close-jump')
            }
          }
        }}
      >
        <button
          type="button"
          className="sh-dialog-close"
          aria-label="Cerrar instrucciones"
          onClick={() => installDialog.current?.close()}
        >
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
        <span className="sh-eyebrow">Aplicación web</span>
        <h2 id="sh-install-title">Instala {brandName} en tu dispositivo</h2>
        <p>
          {installed
            ? 'Ya tienes la aplicación instalada. Ábrela desde el acceso directo de tu dispositivo.'
            : 'Añade un acceso directo en tu pantalla de inicio para consultar el aforo y tu cuenta más rápido.'}
        </p>
        <ol>
          <li>
            <strong>iPhone o iPad:</strong> abre esta página en Safari, toca Compartir y elige
            «Añadir a pantalla de inicio».
          </li>
          <li>
            <strong>Android:</strong> abre el menú del navegador y elige «Instalar aplicación» o
            «Añadir a pantalla de inicio».
          </li>
          <li>
            <strong>Computadora:</strong> busca el ícono de instalación en la barra de direcciones de
            Chrome o Edge.
          </li>
        </ol>
        <button
          type="button"
          className="sh-btn sh-btn-primary"
          onClick={() => installDialog.current?.close()}
        >
          Entendido
        </button>
      </dialog>

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} onLogin={onLogin} />
    </div>
  )
}

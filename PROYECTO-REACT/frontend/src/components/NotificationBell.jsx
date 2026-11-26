import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NotificationService } from '../services/NotificationService'

function formatRelative(dateStr) {
  if (!dateStr) return ''
  try {
    const dt = new Date(String(dateStr).replace(' ', 'T'))
    const diffMs = Date.now() - dt.getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'Ahora'
    if (mins < 60) return `Hace ${mins} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `Hace ${hrs} h`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `Hace ${days} d`
    return dt.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
  } catch {
    return ''
  }
}

function getTypeStyle(tipo) {
  switch (tipo) {
    case 'renovacion_solicitud':
      return { icon: 'bi-arrow-repeat', bg: '#fef3c7', color: '#b45309' }
    case 'renovacion_aprobada':
      return { icon: 'bi-check-circle-fill', bg: '#dcfce7', color: '#15803d' }
    case 'renovacion_rechazada':
      return { icon: 'bi-x-circle-fill', bg: '#fee2e2', color: '#b91c1c' }
    case 'promocion':
      return { icon: 'bi-gift-fill', bg: '#ecfccb', color: '#3f6212' }
    case 'aviso_club':
      return { icon: 'bi-megaphone-fill', bg: '#fee2e2', color: '#dc2626' }
    case 'horario_club':
      return { icon: 'bi-clock-fill', bg: '#e0f2fe', color: '#0369a1' }
    case 'vencimiento':
      return { icon: 'bi-alarm-fill', bg: '#ffedd5', color: '#c2410c' }
    case 'recompensa':
      return { icon: 'bi-stars', bg: '#f3e8ff', color: '#7e22ce' }
    default:
      return { icon: 'bi-bell-fill', bg: '#f1f5f9', color: '#475569' }
  }
}

export default function NotificationBell({ token, variant = 'desktop' }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef(null)

  const fetchNotifications = useCallback(async () => {
    if (!token) return
    try {
      const data = await NotificationService.getMyNotifications(token, 25)
      setNotifications(data.notifications || [])
      setUnreadCount(Number(data.unreadCount || 0))
    } catch {
      // Silencioso en polling en segundo plano
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    let active = true
    const sync = () => {
      NotificationService.getMyNotifications(token, 25)
        .then((data) => {
          if (!active) return
          setNotifications(data.notifications || [])
          setUnreadCount(Number(data.unreadCount || 0))
        })
        .catch(() => undefined)
    }
    sync()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') sync()
    }, 20000)
    window.addEventListener('panda_notifications_updated', sync)
    window.addEventListener('focus', sync)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('panda_notifications_updated', sync)
      window.removeEventListener('focus', sync)
    }
  }, [token])

  useEffect(() => {
    if (!open) return
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  async function handleToggle() {
    const next = !open
    setOpen(next)
    if (next) {
      setLoading(true)
      await fetchNotifications()
      setLoading(false)
    }
  }

  async function handleNotificationClick(item) {
    if (!item.leida) {
      try {
        await NotificationService.markAsRead(token, item.id)
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, leida: true } : n)),
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      } catch {
        // Ignorar fallo transitorio al marcar lectura
      }
    }
    setOpen(false)
    if (item.enlace) {
      navigate(item.enlace)
    }
  }

  async function handleMarkAll() {
    try {
      await NotificationService.markAllAsRead(token)
      setNotifications((prev) => prev.map((n) => ({ ...n, leida: true })))
      setUnreadCount(0)
    } catch {
      // Ignorar fallo transitorio al marcar todas
    }
  }

  const isMobile = variant === 'mobile'

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notificaciones"
        title="Notificaciones"
        style={
          isMobile
            ? {
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                padding: 0,
              }
            : {
                position: 'relative',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: open ? '#f1f5f9' : '#ffffff',
                border: '1px solid #e3e8e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(18, 31, 23, 0.04)',
                padding: 0,
              }
        }
      >
        <svg
          width={isMobile ? '16' : '17'}
          height={isMobile ? '16' : '17'}
          viewBox="0 0 24 24"
          fill="none"
          stroke={isMobile ? '#ffffff' : '#5f7165'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>

        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: isMobile ? '-3px' : '-4px',
              right: isMobile ? '-3px' : '-4px',
              minWidth: '17px',
              height: '17px',
              padding: '0 4px',
              borderRadius: '999px',
              background: '#c4f039',
              color: '#111d15',
              fontSize: '0.64rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1.5px solid #ffffff',
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={
            isMobile
              ? {
                  position: 'fixed',
                  top: '62px',
                  left: '10px',
                  right: '10px',
                  width: 'auto',
                  maxWidth: '420px',
                  margin: '0 auto',
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 20px 45px rgba(15, 23, 42, 0.24)',
                  zIndex: 1200,
                  overflow: 'hidden',
                }
              : {
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: '0',
                  width: '370px',
                  maxWidth: '94vw',
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 20px 45px rgba(15, 23, 42, 0.18)',
                  zIndex: 1200,
                  overflow: 'hidden',
                }
          }
        >
          <div
            style={{
              padding: '14px 16px',
              background: '#111d15',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '0.92rem' }}>Notificaciones</strong>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: '#c4f039',
                    color: '#111d15',
                    fontWeight: 800,
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '999px',
                  }}
                >
                  {unreadCount} nueva{unreadCount === 1 ? '' : 's'}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  color: '#c4f039',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Marcar leídas
              </button>
            )}
          </div>

          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {loading && notifications.length === 0 ? (
              <div className="p-4 text-center text-muted small">Cargando notificaciones...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-muted small">
                <i className="bi bi-bell-slash fs-4 d-block mb-1" />
                No tienes notificaciones recientes.
              </div>
            ) : (
              notifications.map((n) => {
                const st = getTypeStyle(n.tipo)
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleNotificationClick(n)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: n.leida ? '#ffffff' : '#f7fee7',
                      border: 'none',
                      borderBottom: '1px solid #f1f5f9',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '10px',
                        background: st.bg,
                        color: st.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontSize: '0.95rem',
                      }}
                    >
                      <i className={`bi ${st.icon}`} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#111d15' }}>
                          {n.titulo}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {formatRelative(n.creadoEn)}
                        </span>
                      </div>
                      <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#475569', lineHeight: 1.4 }}>
                        {n.mensaje}
                      </p>
                      <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '0.64rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            color: n.rolDestino === 'admin' ? '#0f766e' : '#4d7c0f',
                          }}
                        >
                          {n.rolDestino === 'admin' ? 'Administración' : 'Portal Socio'}
                        </span>
                        {!n.leida && (
                          <span
                            style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              background: '#84cc16',
                              display: 'inline-block',
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

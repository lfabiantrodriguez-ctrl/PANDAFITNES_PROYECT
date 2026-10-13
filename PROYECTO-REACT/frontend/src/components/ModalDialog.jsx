import { useEffect } from 'react'

export default function ModalDialog({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
  badge,
}) {
  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizeClass = size === 'lg' ? 'modal-lg' : size === 'sm' ? 'modal-sm' : size === 'xl' ? 'modal-xl' : ''

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      role="dialog"
      aria-modal="true"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1060,
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        className={`modal-dialog modal-dialog-centered ${sizeClass}`}
        role="document"
        style={{
          margin: '16px auto',
          maxWidth: size === 'lg' ? '880px' : size === 'sm' ? '420px' : '580px',
          width: 'calc(100% - 32px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="modal-content border-0 shadow-lg"
          style={{
            borderRadius: '20px',
            overflow: 'hidden',
            background: '#ffffff',
            boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.35)',
          }}
        >
          {/* Header con estilo atlético Verde Bosque y Lima */}
          <div
            className="modal-header py-3 px-4 d-flex justify-content-between align-items-center"
            style={{
              background: 'linear-gradient(135deg, #121e17 0%, #16241c 100%)',
              color: '#ffffff',
              borderBottom: '2px solid #c4f039',
            }}
          >
            <div>
              {badge && (
                <span
                  className="badge mb-1 text-uppercase fw-bold"
                  style={{
                    fontSize: '0.68rem',
                    letterSpacing: '0.06em',
                    background: 'rgba(196, 240, 57, 0.15)',
                    color: '#c4f039',
                    border: '1px solid rgba(196, 240, 57, 0.35)',
                    padding: '4px 8px',
                    borderRadius: '6px',
                  }}
                >
                  {badge}
                </span>
              )}
              <h5
                className="modal-title fw-bold m-0 text-white"
                style={{ fontSize: '1.2rem', letterSpacing: '-0.02em' }}
              >
                {title}
              </h5>
              {subtitle && (
                <p className="m-0 text-white-50 small mt-1" style={{ fontSize: '0.85rem' }}>
                  {subtitle}
                </p>
              )}
            </div>

            <button
              type="button"
              className="btn text-white p-1 d-flex align-items-center justify-content-center"
              onClick={onClose}
              aria-label="Cerrar modal"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.12)',
                border: 0,
                cursor: 'pointer',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.22)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div
            className="modal-body p-4"
            style={{
              maxHeight: 'calc(85vh - 130px)',
              overflowY: 'auto',
              overflowX: 'hidden',
              width: '100%',
              color: '#0f172a',
            }}
          >
            {children}
          </div>

          {/* Footer opcional */}
          {footer && (
            <div
              className="modal-footer py-3 px-4 d-flex justify-content-end gap-2"
              style={{
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
              }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

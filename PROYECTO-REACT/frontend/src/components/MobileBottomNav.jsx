import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { menuSections } from '../utils/navigation'
import '../styles/MobileBottomNav.css'

function BottomNavIcon({ name }) {
  if (name?.startsWith('bi-')) {
    return <i className={`bi ${name}`} style={{ fontSize: '19px', lineHeight: 1 }} aria-hidden="true" />
  }

  const iconProps = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.15,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    style: { flexShrink: 0 },
    'aria-hidden': 'true',
  }

  switch (name) {
    case 'grid':
      return (
        <svg {...iconProps}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      )
    case 'socios':
      return (
        <svg {...iconProps}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    case 'guests':
      return (
        <svg {...iconProps}>
          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
          <path d="M12 9v6" />
        </svg>
      )
    case 'rewards':
      return (
        <svg {...iconProps}>
          <polyline points="20 12 20 22 4 22 4 12" />
          <rect x="2" y="7" width="20" height="5" />
          <line x1="12" y1="22" x2="12" y2="7" />
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
        </svg>
      )
    case 'panda':
      return (
        <svg {...iconProps}>
          <circle cx="6.5" cy="6.5" r="3.2" fill="currentColor" />
          <circle cx="17.5" cy="6.5" r="3.2" fill="currentColor" />
          <circle cx="12" cy="13" r="8" />
          <ellipse cx="9" cy="12" rx="1.6" ry="2.2" fill="currentColor" />
          <ellipse cx="15" cy="12" rx="1.6" ry="2.2" fill="currentColor" />
          <circle cx="12" cy="15.5" r="1.1" fill="currentColor" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...iconProps}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <polyline points="9 16 11 18 15 14" />
        </svg>
      )
    case 'membership':
      return (
        <svg {...iconProps}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      )
    default:
      return <i className="bi bi-grid" style={{ fontSize: '19px' }} aria-hidden="true" />
  }
}

export default function MobileBottomNav({ user }) {
  const location = useLocation()
  const trackRef = useRef(null)
  const [scrollState, setScrollState] = useState({ left: false, right: false })

  // Mostrar TODOS los módulos permitidos al usuario excepto Mi perfil (se abre con el avatar superior)
  const items = useMemo(() => {
    if (!user) return []
    const seen = new Set()
    const list = []
    for (const section of menuSections(user)) {
      for (const item of section.items || []) {
        if (item.to === '/app/perfil' || seen.has(item.to)) continue
        seen.add(item.to)
        list.push(item)
      }
    }
    return list
  }, [user])

  const isScrollableList = items.length > 5

  const syncScrollIndicators = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    setScrollState({
      left: el.scrollLeft > 8,
      right: maxScroll - el.scrollLeft > 8,
    })
  }, [])

  useEffect(() => {
    const rafId = requestAnimationFrame(syncScrollIndicators)
    window.addEventListener('resize', syncScrollIndicators)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', syncScrollIndicators)
    }
  }, [items.length, syncScrollIndicators])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const activeLink = el.querySelector('.mbn-item.active')
    if (activeLink) {
      activeLink.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
    const timer = setTimeout(syncScrollIndicators, 260)
    return () => clearTimeout(timer)
  }, [location.pathname, syncScrollIndicators])

  if (!user || items.length === 0) return null

  return (
    <nav className="mobile-bottom-nav" aria-label="Navegación móvil inferior">
      {isScrollableList && scrollState.left && (
        <button
          type="button"
          className="mbn-scroll-btn mbn-scroll-btn--left"
          aria-label="Ver módulos a la izquierda"
          onClick={() => trackRef.current?.scrollBy({ left: -180, behavior: 'smooth' })}
        >
          <i className="bi bi-chevron-left" aria-hidden="true" />
        </button>
      )}

      <div
        ref={trackRef}
        className={`mbn-track ${isScrollableList ? 'mbn-track--scroll' : 'mbn-track--even'}`}
        onScroll={syncScrollIndicators}
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `mbn-item ${isScrollableList ? 'mbn-item--scroll' : 'mbn-item--even'} ${isActive ? 'active' : ''}`
            }
          >
            <BottomNavIcon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      {isScrollableList && scrollState.right && (
        <button
          type="button"
          className="mbn-scroll-btn mbn-scroll-btn--right"
          aria-label="Ver más módulos a la derecha"
          onClick={() => trackRef.current?.scrollBy({ left: 180, behavior: 'smooth' })}
        >
          <i className="bi bi-chevron-right" aria-hidden="true" />
        </button>
      )}
    </nav>
  )
}

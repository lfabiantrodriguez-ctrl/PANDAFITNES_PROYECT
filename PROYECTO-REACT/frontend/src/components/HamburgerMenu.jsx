import UserAvatar from './UserAvatar'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import '../styles/HamburgerMenu.css'

export default function HamburgerMenu({ items, sections, user, onLogout, onNavigate, homeRoute, companyInfo }) {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  const logo = companyInfo?.logo || '/logo-panda.png'
  const name = companyInfo?.nombre || 'Panda Fitness'

  function renderBrand(str) {
    const parts = str.trim().split(/\s+/)
    if (parts.length === 1) return parts[0]
    return (
      <>
        {parts[0]}<span>{parts.slice(1).join(' ')}</span>
      </>
    )
  }

  function handleLogout() {
    setIsOpen(false)
    onLogout()
    navigate('/login', { replace: true })
  }

  function handleNavigation(route) {
    setIsOpen(false)
    navigate(route)
    if (onNavigate) onNavigate()
  }

  function toggleMenu() {
    setIsOpen(!isOpen)
  }

  function closeMenu() {
    setIsOpen(false)
  }

  const userInitials = (user?.nombre || 'PF')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('') || 'PF'

  return (
    <header className="mobile-header">
      {/* Marca / Logo a la izquierda */}
      <button
        className="mobile-brand"
        type="button"
        onClick={() => {
          navigate(homeRoute)
          closeMenu()
        }}
        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <img
          src={logo}
          alt="Logo"
          style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'contain', background: '#fff', border: '1.5px solid #c4f039' }}
          onError={(e) => {
            e.target.onerror = null
            e.target.src = '/logo-panda.png'
          }}
        />
        {renderBrand(name)}
      </button>

      {/* Lado Derecho: Campana + Foto/Avatar del Perfil (Al tocar va directo a /app/perfil) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
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
          }}
          title="Notificaciones"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span style={{ position: 'absolute', top: '6px', right: '6px', width: '6px', height: '6px', borderRadius: '50%', background: '#c4f039' }}></span>
        </div>

        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: '#16241c',
            border: '2px solid #c4f039',
            color: '#c4f039',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '0.78rem',
            cursor: 'pointer',
            boxShadow: '0 0 10px rgba(196, 240, 57, 0.35)',
          }}
          onClick={() => navigate('/app/perfil')}
          title="Mi perfil (Toca para ver tu cuenta)"
        >
          {<UserAvatar user={user} />}
        </div>
      </div>

      {isOpen && <div className="menu-overlay" onClick={closeMenu}></div>}

      <nav className={`mobile-menu ${isOpen ? 'open' : ''}`}>
        <div className="mobile-menu-header">
          <button
            className="close-btn"
            onClick={closeMenu}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {sections && sections.length > 0 ? (
          <div className="mobile-sections-container">
            {sections.map((sec, sIdx) => (
              <div key={sec.category || sIdx} className="mobile-section-block">
                <div className="mobile-section-title">{sec.category}</div>
                <ul className="mobile-nav-list">
                  {sec.items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        className={({ isActive }) => `mobile-nav-link ${isActive ? 'active-page' : ''}`}
                        onClick={closeMenu}
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <ul className="mobile-nav-list">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => `mobile-nav-link ${isActive ? 'active-page' : ''}`}
                  onClick={closeMenu}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        )}

        <div className="mobile-menu-footer">
          <div className="user-info">
            <p>Hola, {user.nombre}</p>
          </div>
          <button className="logout-link-mobile" type="button" onClick={handleLogout}>
            Cerrar Sesion
          </button>
        </div>
      </nav>
    </header>
  )
}

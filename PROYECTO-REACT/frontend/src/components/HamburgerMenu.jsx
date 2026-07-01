import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import '../styles/HamburgerMenu.css'

export default function HamburgerMenu({ items, user, onLogout, onNavigate, homeRoute }) {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

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

  return (
    <div className="mobile-header">
      <button
        className={`hamburger-btn ${isOpen ? 'active' : ''}`}
        onClick={toggleMenu}
        aria-label="Toggle menu"
        aria-expanded={isOpen}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <button
        className="mobile-brand"
        type="button"
        onClick={() => {
          navigate(homeRoute)
          closeMenu()
        }}
      >
        PANDA<span>FITNESS</span>
      </button>

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

        <div className="mobile-menu-footer">
          <div className="user-info">
            <p>Hola, {user.nombre}</p>
          </div>
          <button className="logout-link-mobile" type="button" onClick={handleLogout}>
            Cerrar Sesion
          </button>
        </div>
      </nav>
    </div>
  )
}

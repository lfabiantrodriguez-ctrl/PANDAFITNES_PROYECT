import {staffSections} from '../utils/access'
import { NavLink } from 'react-router-dom'
import '../styles/MobileBottomNav.css'

export default function MobileBottomNav({ user }) {
  if (!user) return null

  if(!['admin','cliente'].includes(user.rol)){
    const items=staffSections(user).flatMap(section=>section.items).filter(item=>item.to!=='/app/perfil').slice(0,4)
    items.push({to:'/app/perfil',label:'Mi perfil',icon:'bi-person-circle'})
    return <nav className="mobile-bottom-nav" aria-label="Navegación móvil inferior">{items.map(item=><NavLink key={item.to} to={item.to} className={({isActive})=>`mbn-item ${isActive?'active':''}`}><i className={`bi ${item.icon.startsWith('bi-')?item.icon:'bi-person-circle'}`} style={{fontSize:22}}/><span>{item.label}</span></NavLink>)}</nav>
  }
  const isAdmin = user.rol === 'admin'

  return (
    <nav className="mobile-bottom-nav" aria-label="Navegación móvil inferior">
      {isAdmin ? (
        <>
          <NavLink
            to="/app/check-in"
            className={({ isActive }) => `mbn-item ${isActive ? 'active' : ''}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            <span>Check-in</span>
          </NavLink>

          <NavLink
            to="/app/socios"
            className={({ isActive }) => `mbn-item ${isActive ? 'active' : ''}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Socios</span>
          </NavLink>

          <NavLink
            to="/app/mi-pandita"
            className={({ isActive }) => `mbn-item ${isActive ? 'active' : ''}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6.5" cy="6.5" r="3.2" fill="currentColor"></circle>
              <circle cx="17.5" cy="6.5" r="3.2" fill="currentColor"></circle>
              <circle cx="12" cy="13" r="8"></circle>
              <ellipse cx="9" cy="12" rx="1.6" ry="2.2" fill="currentColor"></ellipse>
              <ellipse cx="15" cy="12" rx="1.6" ry="2.2" fill="currentColor"></ellipse>
              <circle cx="12" cy="15.5" r="1.1" fill="currentColor"></circle>
            </svg>
            <span>Mi pandita</span>
          </NavLink>

          <NavLink
            to="/app/asistencias"
            className={({ isActive }) => `mbn-item ${isActive ? 'active' : ''}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <polyline points="9 16 11 18 15 14"></polyline>
            </svg>
            <span>Asistencias</span>
          </NavLink>

          <NavLink
            to="/app/configuracion"
            className={({ isActive }) => `mbn-item ${isActive ? 'active' : ''}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Ajustes</span>
          </NavLink>
        </>
      ) : (
        <>
          <NavLink
            to="/app/inicio"
            className={({ isActive }) => `mbn-item ${isActive ? 'active' : ''}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
              <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
              <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
              <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
            </svg>
            <span>Inicio</span>
          </NavLink>

          <NavLink
            to="/app/mi-pandita"
            className={({ isActive }) => `mbn-item ${isActive ? 'active' : ''}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6.5" cy="6.5" r="3.2" fill="currentColor"></circle>
              <circle cx="17.5" cy="6.5" r="3.2" fill="currentColor"></circle>
              <circle cx="12" cy="13" r="8"></circle>
              <ellipse cx="9" cy="12" rx="1.6" ry="2.2" fill="currentColor"></ellipse>
              <ellipse cx="15" cy="12" rx="1.6" ry="2.2" fill="currentColor"></ellipse>
              <circle cx="12" cy="15.5" r="1.1" fill="currentColor"></circle>
            </svg>
            <span>Mi pandita</span>
          </NavLink>

          <NavLink
            to="/app/asistencias"
            className={({ isActive }) => `mbn-item ${isActive ? 'active' : ''}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <polyline points="9 16 11 18 15 14"></polyline>
            </svg>
            <span>Asistencias</span>
          </NavLink>

          <NavLink
            to="/app/recompensas"
            className={({ isActive }) => `mbn-item ${isActive ? 'active' : ''}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 12 20 22 4 22 4 12"></polyline>
              <rect x="2" y="7" width="20" height="5"></rect>
              <line x1="12" y1="22" x2="12" y2="7"></line>
            </svg>
            <span>Premios</span>
          </NavLink>

          <NavLink
            to="/app/aforo"
            className={({ isActive }) => `mbn-item ${isActive ? 'active' : ''}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
            </svg>
            <span>Aforo</span>
          </NavLink>
        </>
      )}
    </nav>
  )
}

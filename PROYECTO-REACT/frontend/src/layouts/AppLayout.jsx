import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import UserAvatar from '../components/UserAvatar'
import UsersRolesView from '../pages/UsersRolesView'
import MemberContext from '../components/MemberContext'
import {canAccess,homeFor,moduleLabel} from '../utils/access'
import {menuSections} from '../utils/navigation'
export {MENU_SECTIONS,MENU_ITEMS} from '../utils/navigation'
import DashboardReservationsView from '../pages/DashboardReservationsView'
import MembersView from '../pages/MembersView'
import GuestsView from '../pages/GuestsView'
import ProfileView from '../pages/ProfileView'
import CompanySettingsView from '../pages/CompanySettingsView'
import MemberAttendanceView from '../pages/MemberAttendanceView'
import MyPandaView from '../pages/MyPandaView'
import RewardsView from '../pages/RewardsView'
import MemberMembershipView from '../pages/MemberMembershipView'
import HamburgerMenu from '../components/HamburgerMenu'
import MobileBottomNav from '../components/MobileBottomNav'
import NotificationBell from '../components/NotificationBell'
import { ConfigService } from '../services/ConfigService'

export const ROLE_HOME = {
  admin: '/app/inicio',
  cliente: '/app/inicio',
}

function MenuIcon({ name }) {
  if(name?.startsWith('bi-'))return <i className={`bi ${name}`} style={{fontSize:18}} aria-hidden="true" />
  const iconProps = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    style: { flexShrink: 0 },
  }

  switch (name) {
    case 'grid':
      return (
        <svg {...iconProps}>
          <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
          <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
          <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
          <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
        </svg>
      )
    case 'checkin':
      return (
        <svg {...iconProps}>
          <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
          <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
          <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
          <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      )
    case 'membership':
      return (
        <svg {...iconProps}>
          <rect x="2" y="5" width="20" height="14" rx="2"></rect>
          <line x1="2" y1="10" x2="22" y2="10"></line>
        </svg>
      )
    case 'socios':
      return (
        <svg {...iconProps}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      )
    case 'guests':
      return (
        <svg {...iconProps}>
          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path>
          <path d="M12 9v6"></path>
        </svg>
      )
    case 'settings':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      )
    case 'profile':
      return (
        <svg {...iconProps}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      )
    case 'aforo':
      return (
        <svg {...iconProps}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
        </svg>
      )
    case 'reservas':
      return (
        <svg {...iconProps}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      )
    case 'panda':
      return (
        <svg {...iconProps}>
          <circle cx="6.5" cy="6.5" r="3.2" fill="currentColor"></circle>
          <circle cx="17.5" cy="6.5" r="3.2" fill="currentColor"></circle>
          <circle cx="12" cy="13" r="8"></circle>
          <ellipse cx="9" cy="12" rx="1.6" ry="2.2" fill="currentColor"></ellipse>
          <ellipse cx="15" cy="12" rx="1.6" ry="2.2" fill="currentColor"></ellipse>
          <circle cx="12" cy="15.5" r="1.1" fill="currentColor"></circle>
        </svg>
      )
    case 'calendar':
      return (
        <svg {...iconProps}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
          <polyline points="9 16 11 18 15 14"></polyline>
        </svg>
      )
    case 'rewards':
      return (
        <svg {...iconProps}>
          <polyline points="20 12 20 22 4 22 4 12"></polyline>
          <rect x="2" y="7" width="20" height="5"></rect>
          <line x1="12" y1="22" x2="12" y2="7"></line>
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
        </svg>
      )
    default:
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10"></circle>
        </svg>
      )
  }
}

export default function AppLayout({ token, user, onLogout, setUser }) {
  const navigate = useNavigate()
  const location = useLocation()
  const sections = menuSections(user)
  const items = sections.flatMap(section=>section.items)
  const [companyInfo, setCompanyInfo] = useState({
    nombre: 'Panda Fitness',
    logo: '/logo-panda.png',
    descripcion: 'CLUB DEPORTIVO',
    aviso_activo: '0',
    aviso_mensaje: '',
    aviso_titulo: '',
  })

  const currentItem = items.find(item => location.pathname.startsWith(item.to)) || items[0]
  const headerModuleTitle = location.pathname.startsWith('/app/perfil')
    ? moduleLabel('perfil', user)
    : (currentItem?.label || 'Inicio')

  useEffect(() => {
    async function loadCompanyData() {
      try {
        const data = await ConfigService.getConfig()
        if (data) {
          setCompanyInfo({
            nombre: data.empresa_nombre || 'Panda Fitness',
            logo: data.empresa_logo || '/logo-panda.png',
            descripcion: data.empresa_descripcion || 'CLUB DEPORTIVO',
            aviso_activo: data.aviso_activo || '0',
            aviso_mensaje: data.aviso_mensaje || '',
            aviso_titulo: data.aviso_titulo || '',
          })
          ConfigService.applyBranding(data)
        }
      } catch {}
    }

    loadCompanyData()

    function handleConfigUpdated(event) {
      if (event.detail) {
        setCompanyInfo({
          nombre: event.detail.empresa_nombre || 'Panda Fitness',
          logo: event.detail.empresa_logo || '/logo-panda.png',
          descripcion: event.detail.empresa_descripcion || 'CLUB DEPORTIVO',
          aviso_activo: event.detail.aviso_activo || '0',
          aviso_mensaje: event.detail.aviso_mensaje || '',
          aviso_titulo: event.detail.aviso_titulo || '',
        })
        ConfigService.applyBranding(event.detail)
      }
    }

    window.addEventListener('panda_config_updated', handleConfigUpdated)
    return () => window.removeEventListener('panda_config_updated', handleConfigUpdated)
  }, [])

  function handleLogout() {
    onLogout()
    navigate('/login', { replace: true })
  }

  const userInitials = (user?.nombre || 'PF')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('') || 'PF'

  const formattedDate = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date())

  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <div>
          {/* Brand header */}
          <button
            className="sidebar-brand"
            type="button"
            onClick={() => navigate(homeFor(user))}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', marginBottom: '14px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: '#ffffff',
                border: '2px solid #c4f039',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(196, 240, 57, 0.3)',
                flexShrink: 0,
                overflow: 'hidden',
                padding: '3px',
              }}
            >
              <img
                src={companyInfo.logo || '/logo-panda.png'}
                alt={companyInfo.nombre || 'Logo'}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
                onError={(e) => {
                  e.target.onerror = null
                  e.target.src = '/logo-panda.png'
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff', lineHeight: 1.1 }}>
                {(() => {
                  const parts = (companyInfo.nombre || 'Panda Fitness').trim().split(/\s+/)
                  if (parts.length === 1) return parts[0]
                  return (
                    <>
                      {parts[0]} <span style={{ color: '#c4f039' }}>{parts.slice(1).join(' ')}</span>
                    </>
                  )
                })()}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#8fa295', letterSpacing: '0.08em', fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.25, whiteSpace: 'normal' }}>
                {companyInfo.descripcion || 'CLUB DEPORTIVO'}
              </span>
            </div>
          </button>

          {/* Navigation links */}
          <nav className="sidebar-nav-sections" aria-label="Navegacion principal">
            {sections.map((section, idx) => (
              <div key={section.category || idx} className="sidebar-category-group">
                <div className="sidebar-category-heading">
                  <span>{section.category}</span>
                </div>
                <div className="nav-list">
                  {section.items.map((item) => {
                    const isActive = location.pathname === item.to
                    return (
                      <button
                        key={item.to}
                        type="button"
                        onClick={() => navigate(item.to)}
                        className={`nav-link${isActive ? ' active-page' : ''}`}
                      >
                        <MenuIcon name={item.icon} />
                        <span>{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>

      <HamburgerMenu 
        items={items} 
        sections={sections}
        user={user} 
        token={token}
        onLogout={onLogout}
        homeRoute={homeFor(user)}
        companyInfo={companyInfo}
      />

      <main className="app-main">
        {/* Top bar with Breadcrumbs, Date, Notifications and Avatar (Desktop only) */}
        <header className="desktop-top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5f7165', fontWeight: 600 }}>
            <span>{user.rol !== 'cliente' ? 'Administración' : 'Mi Portal'}</span>
            <span style={{ color: '#8fa295' }}>/</span>
            <h1 style={{ margin: 0, color: '#111d15', fontWeight: 800, fontSize: '1.12rem', letterSpacing: '-0.01em' }}>
              {headerModuleTitle}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ color: '#5f7165', fontSize: '0.84rem', fontWeight: 600, textTransform: 'capitalize' }}>
              {formattedDate}
            </span>

            {/* Notification Bell */}
            <NotificationBell token={token} variant="desktop" />

            {/* User Avatar, Name, Role & Logout */}
            <div
              onClick={() => navigate('/app/perfil')}
              title={`Perfil: ${user.nombre}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                padding: '4px 8px 4px 4px',
                borderRadius: '999px',
                transition: 'background 0.2s',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#111d15',
                  color: '#c4f039',
                  border: '1.5px solid #c4f039',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  flexShrink: 0,
                }}
              >
                {<UserAvatar user={user} />}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span style={{ color: '#111d15', fontWeight: 700, fontSize: '0.84rem' }}>
                  {user.nombre}
                </span>
                <span style={{ color: '#5f7165', fontSize: '0.72rem', fontWeight: 600 }}>
                  {user.roleLabel || (user.rol === 'admin' ? 'Administrador' : user.rol === 'cliente' ? 'Socio' : user.rol)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              title="Cerrar sesión"
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#ef4444'
                e.currentTarget.style.color = '#ffffff'
                e.currentTarget.style.borderColor = '#ef4444'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fef2f2'
                e.currentTarget.style.color = '#dc2626'
                e.currentTarget.style.borderColor = '#fecaca'
              }}
            >
              <i className="bi bi-box-arrow-right"></i>
            </button>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<RoleRedirect user={user} />} />
          <Route path="inicio" element={<RoleGate user={user} roles={['admin', 'cliente']}><DashboardReservationsView token={token} user={user} /></RoleGate>} />
          <Route path="dashboard-reservas" element={<Navigate to="/app/inicio" replace />} />
          <Route path="reservas" element={<Navigate to="/app/inicio" replace />} />
          <Route path="aforo" element={<Navigate to="/app/inicio" replace />} />
          <Route path="check-in" element={<Navigate to="/app/inicio?tab=clientes" replace />} />
          <Route path="invitados" element={<RoleGate user={user} roles={['admin']}><GuestsView token={token} /></RoleGate>} />
          <Route path="socios" element={<RoleGate user={user} roles={['admin']}><MembersView token={token} user={user} /></RoleGate>} />
          <Route path="membresias" element={<Navigate to="/app/socios" replace />} />
          <Route path="asistencias" element={<PersonalGate user={user}><MemberAttendanceView token={token} user={user} /></PersonalGate>} />
          <Route path="mi-pandita" element={<PersonalGate user={user}><MyPandaView token={token} user={user} /></PersonalGate>} />
          <Route path="recompensas" element={<RoleGate user={user} roles={['admin', 'cliente']}><RewardsView token={token} user={user} /></RoleGate>} />
          <Route path="mi-membresia" element={<PersonalGate user={user}><MemberMembershipView token={token} user={user} /></PersonalGate>} />
          <Route path="mis-recompensas" element={canAccess(user, 'recompensas') ? <Navigate to="/app/recompensas" replace /> : <PersonalGate user={user}><RewardsView token={token} user={user} personal /></PersonalGate>} />
          <Route path="configuracion" element={<RoleGate user={user} roles={['admin']}><CompanySettingsView token={token} /></RoleGate>} />
          <Route path="usuarios" element={<RoleGate user={user} roles={['admin']}><UsersRolesView token={token} user={user} /></RoleGate>} />
          <Route path="perfil" element={<ProfileView user={user} token={token} setUser={setUser} />} />
        </Routes>
      </main>

      <MobileBottomNav user={user} />
    </div>
  )
}

function PersonalGate({user,children}) {
  return <RoleGate user={user}><MemberContext key={user.memberLink?.id||'unlinked'} user={user}>{children}</MemberContext></RoleGate>
}

function RoleRedirect({ user }) {
  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={homeFor(user)} replace />
}

function RoleGate({ user, children }) {
  const location=useLocation()
  const key=location.pathname.split('/')[2]
  if (!canAccess(user,key)) {
    return <Navigate to={homeFor(user)} replace />
  }

  return children
}

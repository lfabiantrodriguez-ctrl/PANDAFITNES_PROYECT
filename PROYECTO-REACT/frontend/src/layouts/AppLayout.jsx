import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import CapacityView from '../pages/CapacityView'
import ReservationsView from '../pages/ReservationsView'
import DashboardReservationsView from '../pages/DashboardReservationsView'
import CheckInView from '../pages/CheckInView'
import MembersView from '../pages/MembersView'
import MembershipsView from '../pages/MembershipsView'
import GuestsView from '../pages/GuestsView'
import ProfileView from '../pages/ProfileView'
import HamburgerMenu from '../components/HamburgerMenu'

export const ROLE_HOME = {
  admin: '/app/check-in',
  cliente: '/app/aforo',
}

export const MENU_ITEMS = {
  admin: [
    { to: '/app/check-in', label: 'Check-in Unico' },
    { to: '/app/invitados', label: 'Clientes diarios' },
    { to: '/app/socios', label: 'Gestion de Socios' },
    { to: '/app/membresias', label: 'Gestion de Membresias' },
    { to: '/app/dashboard-reservas', label: 'Dashboard de Control' },
    { to: '/app/perfil', label: 'Perfil' },
  ],
  cliente: [
    { to: '/app/aforo', label: 'Control de Aforo' },
    { to: '/app/reservas', label: 'Modulo de Reservas' },
    { to: '/app/dashboard-reservas', label: 'Dashboard de Control' },
    { to: '/app/perfil', label: 'Perfil' },
  ],
}

export default function AppLayout({ token, user, onLogout, setUser }) {
  const navigate = useNavigate()
  const items = MENU_ITEMS[user.rol] || []

  function handleLogout() {
    onLogout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <div>
          <button className="sidebar-brand" type="button" onClick={() => navigate(ROLE_HOME[user.rol] || '/app/perfil')}>
            PANDA<span>FITNESS</span>
          </button>
          <nav className="nav-list" aria-label="Navegacion principal">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link${isActive ? ' active-page' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <p>Hola, {user.nombre}</p>
          <button className="logout-link" type="button" onClick={handleLogout}>
            Cerrar Sesion
          </button>
        </div>
      </aside>

      <HamburgerMenu 
        items={items} 
        user={user} 
        onLogout={onLogout}
        homeRoute={ROLE_HOME[user.rol] || '/app/perfil'}
      />

      <main className="app-main">
        <Routes>
          <Route path="/" element={<RoleRedirect user={user} />} />
          <Route path="aforo" element={<RoleGate user={user} roles={['cliente']}><CapacityView /></RoleGate>} />
          <Route path="reservas" element={<RoleGate user={user} roles={['cliente']}><ReservationsView token={token} /></RoleGate>} />
          <Route path="dashboard-reservas" element={<RoleGate user={user} roles={['admin', 'cliente']}><DashboardReservationsView token={token} user={user} /></RoleGate>} />
          <Route path="check-in" element={<RoleGate user={user} roles={['admin']}><CheckInView token={token} /></RoleGate>} />
          <Route path="invitados" element={<RoleGate user={user} roles={['admin']}><GuestsView token={token} /></RoleGate>} />
          <Route path="socios" element={<RoleGate user={user} roles={['admin']}><MembersView token={token} /></RoleGate>} />
          <Route path="membresias" element={<RoleGate user={user} roles={['admin']}><MembershipsView token={token} /></RoleGate>} />
          <Route path="perfil" element={<ProfileView user={user} token={token} setUser={setUser} />} />
        </Routes>
      </main>
    </div>
  )
}

function RoleRedirect({ user }) {
  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={ROLE_HOME[user.rol] || '/app/perfil'} replace />
}

function RoleGate({ user, roles, children }) {
  if (!roles.includes(user?.rol)) {
    return <Navigate to={ROLE_HOME[user?.rol] || '/app/perfil'} replace />
  }

  return children
}

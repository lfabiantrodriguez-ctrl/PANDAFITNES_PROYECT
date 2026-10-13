import {Link} from 'react-router-dom';
import {canManageMemberLink} from '../utils/access';
export default function MemberContext({user,children}) {
  if(user?.rol==='cliente')return children;
  const member=user?.memberLink;
  if(!member||!member.activo)return <section className="card border-0 shadow-sm p-4 p-md-5 rounded-4">
    <span className="text-success fs-1 mb-3"><i className="bi bi-person-vcard"/></span>
    <h2 className="fs-4 fw-bold">{member?'Tu perfil de socio está desactivado':'Activa tu perfil de socio'}</h2>
    <p className="text-secondary mb-4">{member?'Tu cuenta de trabajo conserva sus permisos. Para continuar entrenando, administración debe activar la cuenta del socio vinculado.':'Tu cuenta interna puede tener su propio perfil de entrenamiento o vincularse a un socio existente. Así tendrás pandita, calendario y recompensas con tus registros reales.'}</p>
    {canManageMemberLink(user)?<Link className="btn btn-dark align-self-start" to="/app/usuarios"><i className="bi bi-link-45deg me-2"/>Configurar en Usuarios y roles</Link>:<p className="small text-secondary mb-0">Solicita la vinculación a administración.</p>}
  </section>;
  return <><div className="d-flex align-items-center gap-3 flex-wrap border rounded-3 bg-white px-3 py-3 mb-4">
    <span className="text-success fs-4"><i className="bi bi-person-check"/></span>
    <div><div className="fw-bold small">Entrenando como {member.nombre} {member.apellido}</div><div className="text-secondary small">DNI {member.dni} · Tu rol interno se mantiene</div></div>
    <Link className="btn btn-sm btn-outline-dark ms-auto" to="/app/mi-membresia">Mi membresía<i className="bi bi-arrow-right ms-2"/></Link>
  </div>{children}</>;
}

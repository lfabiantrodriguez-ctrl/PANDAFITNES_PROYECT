import {useCallback,useEffect,useState} from 'react';
import ModalDialog from '../components/ModalDialog';
import UserAvatar from '../components/UserAvatar';
import StaffMemberLinkModal from '../components/StaffMemberLinkModal';
import {StaffService} from '../services/StaffService';
import {STAFF_WINDOWS,canManageMemberLink,moduleLabel} from '../utils/access';
import '../styles/UsersRoles.css';
const emptyUser={dni:'',nombre:'',apellido:'',email:'',telefono:'',rolId:'',password:'',activo:true};
const emptyRole={etiqueta:'',descripcion:'',permissions:[]};
export default function UsersRolesView({token,user}) {
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [tab,setTab]=useState('users'),[search,setSearch]=useState('');
  const [linkTarget,setLinkTarget]=useState(null);
  const [editor,setEditor]=useState(null),[form,setForm]=useState(emptyUser),[role,setRole]=useState(emptyRole),[busy,setBusy]=useState(false),[formError,setFormError]=useState(''),[fieldErrors,setFieldErrors]=useState({}),[showPassword,setShowPassword]=useState(false);
  const load=useCallback(async()=>{setLoading(true);setError('');try{setData(await StaffService.load(token));}catch(e){setError(e.message);}finally{setLoading(false);}},[token]);
  useEffect(()=>{load();},[load]);
  const modules=STAFF_WINDOWS;
  const roles=data?.roles||[],users=data?.users||[];
  const assignable=roles.filter(r=>user.rol==='admin'||(!r.protected&&r.permissions.every(p=>user.permissions?.includes(p))));
  const available=modules.filter(m=>user.rol==='admin'||user.permissions?.includes(m.key));
  const filtered=users.filter(u=>`${u.nombre} ${u.apellido} ${u.dni} ${u.email} ${u.roleLabel}`.toLowerCase().includes(search.toLowerCase()));
  const filteredRoles=roles.filter(r=>`${r.etiqueta} ${r.descripcion} ${r.permissions.map(p=>modules.find(m=>m.key===p)?.label||p).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  function openUser(item){setForm(item?{...item,password:''}:{...emptyUser,rolId:assignable.find(r=>!r.protected)?.id||''});setFormError('');setFieldErrors({});setShowPassword(false);setEditor({type:'user',id:item?.id});}
  function openRole(item){setRole(item?{etiqueta:item.etiqueta,descripcion:item.descripcion,permissions:[...item.permissions]}:{...emptyRole,permissions:[]});setFormError('');setFieldErrors({});setEditor({type:'role',id:item?.id});}
  function close(){if(!busy){setEditor(null);setFieldErrors({});setFormError('');}}
  function clearErr(key){setFieldErrors(prev=>prev[key]?{...prev,[key]:''}:prev);}
  async function save(event){
    event.preventDefault();
    setFormError('');
    const errs={};
    if(editor?.type==='user'){
      if(!/^\d{8}$/.test(String(form.dni||'').trim()))errs.dni='Ingresa 8 dígitos numéricos.';
      if(!String(form.nombre||'').trim())errs.nombre='Ingresa los nombres.';
      if(!String(form.apellido||'').trim())errs.apellido='Ingresa los apellidos.';
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(form.email||'').trim()))errs.email='Ingresa un correo válido.';
      if(form.telefono&&!/^\d{9}$/.test(String(form.telefono).trim()))errs.telefono='Debe tener 9 dígitos.';
      if(!form.rolId)errs.rolId='Selecciona un rol.';
      const pwd=String(form.password||'');
      if(!editor?.id&&!pwd)errs.password='Ingresa una contraseña.';
      else if(pwd&&(pwd.length<8||!/[A-Z]/.test(pwd)||!/[a-z]/.test(pwd)||!/\d/.test(pwd)))errs.password='Mín. 8 caracteres, mayúscula, minúscula y número.';
    }else if(editor?.type==='role'){
      if(String(role.etiqueta||'').trim().length<3)errs.etiqueta='Mínimo 3 caracteres.';
      if(!role.permissions?.length)errs.permissions='Marca al menos un módulo.';
    }
    if(Object.keys(errs).length){setFieldErrors(errs);return;}
    setFieldErrors({});
    setBusy(true);
    try{
      const response=editor.type==='user'?await StaffService.saveUser(token,editor.id,{...form,rolId:Number(form.rolId)}):await StaffService.saveRole(token,editor.id,role);
      setEditor(null);setNotice(response.message);await load();window.dispatchEvent(new Event('panda-access-updated'));
    }catch(e){
      const msg=e.message||'Error al guardar';
      const l=msg.toLowerCase(),mapped={};
      if(editor?.type==='user'){
        if(l.includes('dni'))mapped.dni=msg;
        else if(l.includes('correo')||l.includes('email'))mapped.email=msg;
        else if(l.includes('teléfono')||l.includes('telefono'))mapped.telefono=msg;
        else if(l.includes('nombre'))mapped.nombre=msg;
        else if(l.includes('apellido'))mapped.apellido=msg;
        else if(l.includes('rol'))mapped.rolId=msg;
        else if(l.includes('contraseña')||l.includes('password')||l.includes('clave'))mapped.password=msg;
      }else if(editor?.type==='role'){
        if(l.includes('rol')||l.includes('nombre')||l.includes('etiqueta'))mapped.etiqueta=msg;
        else if(l.includes('permiso')||l.includes('módulo')||l.includes('modulo'))mapped.permissions=msg;
      }
      if(Object.keys(mapped).length)setFieldErrors(mapped);
      else setFormError(msg);
    }finally{setBusy(false);}
  }
  const editingSelf=editor?.type==='user'&&editor.id===user.id;
  const errBox=msg=>msg&&<div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{fontSize:'0.78rem'}}><i className="bi bi-exclamation-circle-fill"/><span>{msg}</span></div>;
  const errStyle=has=>has?{borderColor:'#ef4444',backgroundColor:'#fef2f2'}:undefined;
  return <div className="ur-page">
    <header className="ur-heading">
      <div className="ur-heading-copy"><span className="ur-eyebrow"><span/>GESTIÓN DEL EQUIPO</span><p style={{ marginTop: '12px' }}>Personal y permisos del sistema.</p></div>
      <div className="ur-heading-aside"><div className="ur-hero-symbol" aria-hidden="true"><i className="bi bi-shield-check"/><span className="ur-symbol-dot"><i className="bi bi-check-lg"/></span></div><button type="button" className="btn ur-refresh" onClick={load} disabled={loading}><i className={`bi bi-arrow-clockwise ${loading?'ur-spin':''}`}/>Actualizar</button></div>
    </header>
    <div className="ur-stats row g-3">{[
      ['bi-people','Usuarios del equipo',users.length,'Registrados'],
      ['bi-person-check','Cuentas activas',users.filter(u=>u.activo).length,'Con acceso'],
      ['bi-shield-check','Roles definidos',roles.length,'Configurados'],
    ].map(([icon,label,count,detail])=><div className="col-12 col-sm-4" key={label}><article className="card ur-stat-card h-100"><div><span className="ur-stat-label">{label}</span><strong>{data?count:'—'}</strong><small>{detail}</small></div><span className="ur-stat-icon"><i className={`bi ${icon}`} aria-hidden="true"/></span></article></div>)}</div>
    {notice&&<div role="status" className="alert alert-success d-flex gap-2 align-items-center"><i className="bi bi-check-circle"/>{notice}<button type="button" className="btn-close ms-auto" aria-label="Cerrar aviso" onClick={()=>setNotice('')}/></div>}
    {error&&<div role="alert" className="alert alert-danger d-flex gap-2 align-items-start"><i className="bi bi-exclamation-circle"/>{error}</div>}
    <section className="card ur-panel" aria-label="Usuarios y roles">
      <div className="ur-toolbar"><div className="ur-tabs nav nav-pills" role="tablist" aria-label="Administración de usuarios y roles">
        <button type="button" id="ur-users-tab" role="tab" aria-controls="ur-users-panel" aria-selected={tab==='users'} className={`nav-link ${tab==='users'?'active':''}`} onClick={()=>{setTab('users');setSearch('');}}><i className="bi bi-people"/>Usuarios<span className="ur-tab-count">{data?users.length:'—'}</span></button>
        <button type="button" id="ur-roles-tab" role="tab" aria-controls="ur-roles-panel" aria-selected={tab==='roles'} className={`nav-link ${tab==='roles'?'active':''}`} onClick={()=>{setTab('roles');setSearch('');}}><i className="bi bi-shield-check"/>Roles y accesos<span className="ur-tab-count">{data?roles.length:'—'}</span></button>
      </div><button type="button" className="btn ur-primary" disabled={!data||loading} onClick={()=>tab==='users'?openUser():openRole()}><i className={`bi ${tab==='users'?'bi-person-plus':'bi-plus-lg'}`}/>{tab==='users'?'Nuevo usuario':'Crear rol'}</button></div>
      <div className="ur-section-heading"><div><h2>{tab==='users'?'Cuentas del personal':'Permisos por rol'}</h2></div><span className="ur-staff-only"><i className="bi bi-person-lock"/>Solo personal</span></div>
      <div className="ur-filterbar"><div className="ur-search input-group"><span className="input-group-text"><i className="bi bi-search"/></span><input className="form-control" aria-label={tab==='users'?'Buscar usuarios':'Buscar roles'} placeholder={tab==='users'?'Buscar por nombre, DNI, correo o rol':'Buscar rol o módulo'} value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button className="btn" type="button" aria-label="Limpiar búsqueda" onClick={()=>setSearch('')}><i className="bi bi-x-lg"/></button>}</div><span className="ur-results" aria-live="polite">{data?`${tab==='users'?filtered.length:filteredRoles.length} ${tab==='users'?'usuarios':'roles'}`:'Sin conexión'}</span></div>
      {loading&&!data?<div className="ur-empty" role="status"><span className="spinner-border spinner-border-sm me-2"/>Cargando…</div>:tab==='users'?
        <div id="ur-users-panel" role="tabpanel" aria-labelledby="ur-users-tab"><div className="ur-table-wrap table-responsive"><table className="table ur-table align-middle mb-0"><thead><tr><th>Integrante</th><th>DNI</th><th>Rol asignado</th><th>Estado</th><th className="text-end">Acciones</th></tr></thead><tbody>
          {filtered.map(u=><tr key={u.id}><td data-label="Integrante"><div className="ur-person"><UserAvatar user={u} size={42}/><div><strong>{u.nombre} {u.apellido}{u.id===user.id&&<span className="ur-you">Tú</span>}</strong><span>{u.email}</span><span className={`ur-member-label ${u.memberLink?'linked':''}`}><i className={`bi ${u.memberLink?'bi-person-check':'bi-person-dash'} me-1`}/>{u.memberLink?`${u.memberLink.sameAccount?'Perfil de socio activo':'Socio: '+u.memberLink.nombre+' '+u.memberLink.apellido} · DNI ${u.memberLink.dni}`:'Sin perfil de socio'}{u.memberLink&&!u.memberLink.activo?' (desactivado)':''}</span></div></div></td><td data-label="DNI"><span className="ur-dni">{u.dni}</span></td><td data-label="Rol"><span className="ur-role-pill"><i className="bi bi-shield-check"/>{u.roleLabel}</span></td><td data-label="Estado"><span className={`ur-status ${u.activo?'enabled':'disabled'}`}><span/>{u.activo?'Activo':'Inactivo'}</span></td><td data-label="Acciones" className="text-end"><button type="button" className="btn btn-sm ur-link-member me-2" disabled={loading||!canManageMemberLink(user)||(u.rol==='admin'&&user.rol!=='admin')} onClick={()=>setLinkTarget(u)} aria-label={`Configurar socio de ${u.nombre} ${u.apellido}`}><i className="bi bi-link-45deg"/>{u.memberLink?'Socio vinculado':'Vincular socio'}</button><button type="button" className="btn btn-sm ur-edit-user" disabled={u.rol==='admin'&&user.rol!=='admin'} onClick={()=>openUser(u)} aria-label={`Editar a ${u.nombre} ${u.apellido}`}><i className="bi bi-pencil-square"/>Editar</button></td></tr>)}
        </tbody></table></div>{!filtered.length&&<div className="ur-empty"><i className="bi bi-people"/><h3>Sin resultados</h3><p>{data?'Prueba con otra búsqueda o crea un usuario.':'Sin conexión al servidor.'}</p></div>}</div>:
        <div id="ur-roles-panel" role="tabpanel" aria-labelledby="ur-roles-tab" className="ur-roles">
          {filteredRoles.map(r=>{
            const grouped=r.permissions.reduce((groups,p)=>{const m=modules.find(item=>item.key===p)||{key:p,label:p,group:'Otros accesos'};(groups[m.group]??=[]).push(m);return groups;},{});
            const assigned=users.filter(u=>Number(u.rolId)===Number(r.id));
            const icon=r.protected?'bi-shield-lock':r.nombre==='entrenador'?'bi-activity':r.nombre==='recepcion'?'bi-headset':'bi-person-badge';
            return <article key={r.id} className={`card ur-role-card ${r.protected?'ur-role-protected':''}`}>
              <div className="ur-role-heading"><span className="ur-role-icon"><i className={`bi ${icon}`} aria-hidden="true"/></span><span className="ur-role-kind"><i className={`bi ${r.protected?'bi-lock':'bi-sliders'}`}/>{r.protected?'Rol protegido':'Personalizable'}</span></div>
              <h3>{r.etiqueta}</h3><p className="ur-role-description">{r.descripcion||(r.protected?'Control total del sistema.':'Accesos asignados al rol.')}</p>
              <div className="ur-role-access-title"><span>Acceso al sistema</span><strong>{r.permissions.length}<small> módulos</small></strong></div>
              <div className="ur-access-groups">{Object.entries(grouped).map(([group,items])=><div className="ur-access-group" key={group}><h4>{group}</h4><ul>{items.map(m=><li key={m.key}><i className="bi bi-check2" aria-hidden="true"/><span>{m.label}</span></li>)}</ul></div>)}</div>
              <div className="ur-profile-access"><i className="bi bi-person-circle"/><span>Mi perfil incluido</span><i className="bi bi-check2 ms-auto"/></div>
              <footer><div className="ur-assigned"><div className="ur-avatar-stack">{assigned.slice(0,3).map(person=><UserAvatar key={person.id} user={person} size={28}/>)}{!assigned.length&&<span className="ur-no-avatar"><i className="bi bi-people"/></span>}</div><span><strong>{r.usuarios}</strong> {Number(r.usuarios)===1?'usuario asignado':'usuarios asignados'}</span></div>
                {r.protected?<div className="ur-protected-label"><i className="bi bi-lock"/>Acceso completo</div>:<button type="button" className="btn ur-edit-role" disabled={r.nombre===user.rol&&user.rol!=='admin'} onClick={()=>openRole(r)}><i className="bi bi-sliders"/>Editar accesos<i className="bi bi-arrow-up-right ms-auto"/></button>}
              </footer>
            </article>;
          })}
          {!filteredRoles.length&&<div className="ur-empty"><i className="bi bi-shield"/><h3>Sin resultados</h3><p>{search?'Prueba con otra búsqueda.':'Crea un rol para tu equipo.'}</p></div>}
        </div>}
      <div className="ur-panel-note"><i className="bi bi-info-circle"/><span>Socios: crear en <strong>Gestión de socios & membresías</strong>.</span></div>
    </section>
    <StaffMemberLinkModal target={linkTarget} token={token} onClose={()=>setLinkTarget(null)} onSaved={async message=>{setLinkTarget(null);setNotice(message);await load();window.dispatchEvent(new Event('panda-access-updated'));window.dispatchEvent(new Event('panda-progress-updated'));}}/>
    <ModalDialog isOpen={editor?.type==='user'} onClose={close} title={editor?.id?'Editar usuario':'Nuevo usuario del equipo'} subtitle="Datos y acceso del personal." badge="PERSONAL" size="lg"><form onSubmit={save} noValidate>{formError&&<div className="alert alert-danger" role="alert">{formError}</div>}<div className="ur-form-grid">{[['dni','DNI','8 dígitos'],['nombre','Nombres','Nombres del usuario'],['apellido','Apellidos','Apellidos del usuario'],['email','Correo','nombre@correo.com'],['telefono','Teléfono','Opcional, 9 dígitos']].map(([key,label,placeholder])=><label key={key} className="ur-field">{label}{key!=='telefono'&&' *'}<input className={`form-control ${fieldErrors[key]?'is-invalid':''}`} style={errStyle(fieldErrors[key])} type={key==='email'?'email':'text'} inputMode={['dni','telefono'].includes(key)?'numeric':undefined} maxLength={key==='dni'?8:key==='telefono'?9:100} placeholder={placeholder} autoComplete="off" value={form[key]} onChange={e=>{setForm({...form,[key]:['dni','telefono'].includes(key)?e.target.value.replace(/\D/g,''):e.target.value});clearErr(key);}}/>{errBox(fieldErrors[key])}</label>)}<label className="ur-field">Rol *<select className={`form-select ${fieldErrors.rolId?'is-invalid':''}`} style={errStyle(fieldErrors.rolId)} value={form.rolId} disabled={editingSelf} onChange={e=>{setForm({...form,rolId:e.target.value});clearErr('rolId');}}><option value="">Selecciona un rol</option>{assignable.map(r=><option key={r.id} value={r.id}>{r.etiqueta}</option>)}</select>{errBox(fieldErrors.rolId)}</label><label className="ur-field ur-wide">{editor?.id?'Nueva contraseña (opcional)':'Contraseña inicial *'}<div className="input-group"><input className={`form-control ${fieldErrors.password?'is-invalid':''}`} style={errStyle(fieldErrors.password)} autoComplete="new-password" type={showPassword?'text':'password'} maxLength={72} value={form.password} onChange={e=>{setForm({...form,password:e.target.value});clearErr('password');}}/><button type="button" className="btn btn-outline-secondary" aria-label={showPassword?'Ocultar contraseña':'Mostrar contraseña'} onClick={()=>setShowPassword(!showPassword)}><i className={`bi ${showPassword?'bi-eye-slash':'bi-eye'}`}/></button></div>{errBox(fieldErrors.password)}<small>Mín. 8 caracteres, mayúscula, minúscula y número.{editor?.id?' Vacío = mantener actual.':''}</small></label></div><label className="ur-toggle"><input type="checkbox" checked={form.activo} disabled={editingSelf} onChange={e=>setForm({...form,activo:e.target.checked})}/><span>Usuario activo</span></label><div className="ur-modal-actions"><button className="btn ur-primary" disabled={busy}>{busy?'Guardando…':'Guardar usuario'}</button></div></form></ModalDialog>
    <ModalDialog isOpen={editor?.type==='role'} onClose={close} title={editor?.id?'Editar rol y accesos':'Crear rol'} subtitle="Módulos permitidos para este rol." badge="PERMISOS" size="lg"><form onSubmit={save} noValidate>{formError&&<div className="alert alert-danger" role="alert">{formError}</div>}<label className="ur-field mb-3">Nombre del rol *<input className={`form-control ${fieldErrors.etiqueta?'is-invalid':''}`} style={errStyle(fieldErrors.etiqueta)} value={role.etiqueta} maxLength={50} placeholder="Ej: Recepción" onChange={e=>{setRole({...role,etiqueta:e.target.value});clearErr('etiqueta');}}/>{errBox(fieldErrors.etiqueta)}</label><label className="ur-field mb-4">Descripción<input className="form-control" maxLength={255} placeholder="Responsabilidad del rol" value={role.descripcion} onChange={e=>setRole({...role,descripcion:e.target.value})}/></label><div className="ur-permission-title"><div><strong>Módulos permitidos</strong><span className="ur-selection-count">{role.permissions.length} de {available.length} seleccionados</span></div><button type="button" className="btn btn-sm btn-outline-dark" onClick={()=>{setRole({...role,permissions:role.permissions.length===available.length?[]:available.map(m=>m.key)});clearErr('permissions');}}>{role.permissions.length===available.length?'Desmarcar todas':'Marcar todas'}</button></div><div className={fieldErrors.permissions?'p-2 rounded-3':''} style={fieldErrors.permissions?{border:'1.5px solid #ef4444',backgroundColor:'#fef2f2'}:undefined}>{Object.entries(available.reduce((groups,m)=>{(groups[m.group]??=[]).push(m);return groups;},{})).map(([group,items])=><fieldset className="ur-permission-section" key={group}><legend>{group}<span>{items.length}</span></legend><div className="ur-check-grid">{items.map(m=><label key={m.key} className={`ur-check ${role.permissions.includes(m.key)?'selected':''}`}><i className={`bi ${m.icon}`} aria-hidden="true"/><span>{m.label}</span><input className="form-check-input ms-auto" type="checkbox" checked={role.permissions.includes(m.key)} onChange={e=>{setRole({...role,permissions:e.target.checked?[...role.permissions,m.key]:role.permissions.filter(p=>p!==m.key)});clearErr('permissions');}}/></label>)}</div></fieldset>)}</div>{errBox(fieldErrors.permissions)}<div className="ur-note mt-3"><i className="bi bi-person-circle"/><span>Mi perfil siempre está habilitado.</span></div><div className="ur-modal-actions"><button className="btn ur-primary" disabled={busy}>{busy?'Guardando…':'Guardar rol'}</button></div></form></ModalDialog>
  </div>;
}

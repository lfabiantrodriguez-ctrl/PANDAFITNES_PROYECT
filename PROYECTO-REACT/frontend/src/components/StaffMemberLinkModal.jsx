import {useEffect,useState} from 'react';
import ModalDialog from './ModalDialog';
import {StaffService} from '../services/StaffService';
export default function StaffMemberLinkModal({target,token,onClose,onSaved}) {
  const [mode,setMode]=useState('self'),[memberId,setMemberId]=useState(''),[socios,setSocios]=useState([]);
  const [query,setQuery]=useState(''),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    if(!target)return;
    let current=true;
    setMode(target.memberLink&&!target.memberLink.sameAccount?'existing':'self');
    setMemberId(target.memberLink&&!target.memberLink.sameAccount?String(target.memberLink.id):'');
    setQuery('');setError('');setSocios([]);setLoading(true);
    StaffService.memberCandidates(token,target.id).then(data=>{if(current)setSocios(data.socios||[]);}).catch(e=>{if(current)setError(e.message);}).finally(()=>{if(current)setLoading(false);});
    return()=>{current=false;};
  },[target,token]);
  async function save(unlink=false) {
    setBusy(true);setError('');
    try {const result=await StaffService.linkMember(token,target.id,unlink?null:mode==='self'?target.id:Number(memberId));await onSaved(result.message);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const selected=socios.find(s=>String(s.id)===memberId);
  const filtered=socios.filter(s=>String(s.id)===memberId||`${s.dni} ${s.nombre} ${s.apellido}`.toLowerCase().includes(query.toLowerCase()));
  return <ModalDialog isOpen={Boolean(target)} onClose={()=>{if(!busy)onClose();}} title="Perfil de socio del trabajador" subtitle={target?`${target.nombre} ${target.apellido} · DNI ${target.dni}`:''} badge="VINCULACIÓN OPCIONAL" size="lg">
    {target&&<form className="ur-member-editor" onSubmit={event=>{event.preventDefault();save();}}>
      {error&&<div className="alert alert-danger small" role="alert">{error}</div>}
      <div className="row g-3 mb-4">{[['self','bi-person-vcard','Usar esta misma cuenta','Conserva su DNI, su acceso interno y sus datos.'],['existing','bi-link-45deg','Vincular un socio existente','Usa el historial y la membresía del socio seleccionado.']].map(([value,icon,title,detail])=><div className="col-12 col-md-6" key={value}><label className={`ur-member-option ${mode===value?'selected':''}`}>
        <span className="d-flex align-items-center gap-2 mb-2"><i className={`bi ${icon} fs-5`}/><strong>{title}</strong><input className="form-check-input ms-auto" type="radio" name="member-mode" value={value} checked={mode===value} disabled={busy} onChange={()=>setMode(value)}/></span><small>{detail}</small>
      </label></div>)}</div>
      {mode==='self'?<div className="rounded-3 border bg-light p-3 mb-3"><div className="fw-bold mb-1">{target.nombre} {target.apellido}</div><div className="small text-secondary">DNI {target.dni} · {target.email}</div><p className="small text-secondary mb-0 mt-3">Aparecerá también en Gestión de socios & membresías. Desde ahí podrás asignar su plan y registrar su huella para las entradas y salidas.</p></div>:<div className="mb-3">
        <label className="ur-field mb-2">Buscar socio<input className="form-control" placeholder="Nombre o DNI" value={query} disabled={busy||loading} onChange={event=>setQuery(event.target.value)}/></label>
        <label className="ur-field">Socio a vincular<select className="form-select" required value={memberId} disabled={busy||loading} onChange={event=>setMemberId(event.target.value)}><option value="">{loading?'Cargando socios…':'Selecciona un socio'}</option>{filtered.map(s=><option key={s.id} value={s.id} disabled={!s.activo}>{s.dni} · {s.nombre} {s.apellido}{!s.activo?' (desactivado)':''}</option>)}</select></label>
        {!loading&&!socios.length&&<p className="small text-secondary mt-2">No hay socios disponibles. Puedes registrar uno desde Gestión de socios & membresías o usar la misma cuenta del trabajador.</p>}
      </div>}
      <div className="ur-note"><i className="bi bi-shield-check"/><span>El rol y los permisos internos se conservan. Los puntos se ganan con asistencias reales. Desvincular no elimina registros ni mezcla historiales.</span></div>
      <div className="ur-modal-actions flex-wrap">
        {target.memberLink&&<button type="button" className="btn btn-outline-danger me-auto" disabled={busy} onClick={()=>save(true)}><i className="bi bi-link-45deg me-1"/>Desvincular</button>}
        <button type="button" className="btn btn-outline-dark" disabled={busy} onClick={onClose}>Cancelar</button>
        <button className="btn ur-primary" disabled={busy||loading||(mode==='existing'&&(!memberId||!selected?.activo))}>{busy?'Guardando…':mode==='self'?'Activar perfil de socio':'Vincular socio'}</button>
      </div>
    </form>}
  </ModalDialog>;
}

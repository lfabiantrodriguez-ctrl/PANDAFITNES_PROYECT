import {useEffect,useState} from 'react';
import ModalDialog from './ModalDialog';
import {StaffService} from '../services/StaffService';
export default function StaffMemberLinkModal({target,token,onClose,onSaved}) {
  const [mode,setMode]=useState('self'),[memberId,setMemberId]=useState(''),[socios,setSocios]=useState([]);
  const [query,setQuery]=useState(''),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[selectError,setSelectError]=useState('');
  useEffect(()=>{
    if(!target)return;
    let current=true;
    setMode(target.memberLink&&!target.memberLink.sameAccount?'existing':'self');
    setMemberId(target.memberLink&&!target.memberLink.sameAccount?String(target.memberLink.id):'');
    setQuery('');setError('');setSelectError('');setSocios([]);setLoading(true);
    StaffService.memberCandidates(token,target.id).then(data=>{if(current)setSocios(data.socios||[]);}).catch(e=>{if(current)setError(e.message);}).finally(()=>{if(current)setLoading(false);});
    return()=>{current=false;};
  },[target,token]);
  const selected=socios.find(s=>String(s.id)===memberId);
  async function save(unlink=false) {
    setError('');setSelectError('');
    if(!unlink&&mode==='existing'&&(!memberId||!selected?.activo)){
      setSelectError(!memberId?'Selecciona un socio activo.':'Este socio está desactivado.');
      return;
    }
    setBusy(true);
    try {const result=await StaffService.linkMember(token,target.id,unlink?null:mode==='self'?target.id:Number(memberId));await onSaved(result.message);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const filtered=socios.filter(s=>String(s.id)===memberId||`${s.dni} ${s.nombre} ${s.apellido}`.toLowerCase().includes(query.toLowerCase()));
  return <ModalDialog isOpen={Boolean(target)} onClose={()=>{if(!busy)onClose();}} title="Perfil de socio del trabajador" subtitle={target?`${target.nombre} ${target.apellido} · DNI ${target.dni}`:''} badge="VINCULACIÓN" size="lg">
    {target&&<form className="ur-member-editor" onSubmit={event=>{event.preventDefault();save();}} noValidate>
      {error&&<div className="alert alert-danger small" role="alert">{error}</div>}
      <div className="row g-3 mb-4">{[['self','bi-person-vcard','Usar esta cuenta','Mismo DNI y datos.'],['existing','bi-link-45deg','Vincular socio existente','Usa un socio ya creado.']].map(([value,icon,title,detail])=><div className="col-12 col-md-6" key={value}><label className={`ur-member-option ${mode===value?'selected':''}`}>
        <span className="d-flex align-items-center gap-2 mb-2"><i className={`bi ${icon} fs-5`}/><strong>{title}</strong><input className="form-check-input ms-auto" type="radio" name="member-mode" value={value} checked={mode===value} disabled={busy} onChange={()=>{setMode(value);setSelectError('');}}/></span><small>{detail}</small>
      </label></div>)}</div>
      {mode==='self'?<div className="rounded-3 border bg-light p-3 mb-3"><div className="fw-bold mb-1">{target.nombre} {target.apellido}</div><div className="small text-secondary">DNI {target.dni} · {target.email}</div></div>:<div className="mb-3">
        <label className="ur-field mb-2">Buscar socio<input className="form-control" placeholder="Nombre o DNI" value={query} disabled={busy||loading} onChange={event=>setQuery(event.target.value)}/></label>
        <label className="ur-field">Socio a vincular<select className={`form-select ${selectError?'is-invalid':''}`} style={selectError?{borderColor:'#ef4444',backgroundColor:'#fef2f2'}:undefined} value={memberId} disabled={busy||loading} onChange={event=>{setMemberId(event.target.value);setSelectError('');}}><option value="">{loading?'Cargando socios…':'Selecciona un socio'}</option>{filtered.map(s=><option key={s.id} value={s.id} disabled={!s.activo}>{s.dni} · {s.nombre} {s.apellido}{!s.activo?' (desactivado)':''}</option>)}</select>{selectError&&<div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{fontSize:'0.78rem'}}><i className="bi bi-exclamation-circle-fill"/><span>{selectError}</span></div>}</label>
        {!loading&&!socios.length&&<p className="small text-secondary mt-2">No hay socios disponibles.</p>}
      </div>}
      <div className="ur-modal-actions flex-wrap">
        {target.memberLink&&<button type="button" className="btn btn-outline-danger me-auto" disabled={busy} onClick={()=>save(true)}><i className="bi bi-link-45deg me-1"/>Desvincular</button>}
        <button className="btn ur-primary" disabled={busy||loading}>{busy?'Guardando…':mode==='self'?'Activar perfil':'Vincular socio'}</button>
      </div>
    </form>}
  </ModalDialog>;
}

export const STAFF_WINDOWS = [
  {key:'inicio',label:'Inicio',icon:'bi-grid',group:'ADMINISTRACIÓN & RECEPCIÓN'},
  {key:'check-in',label:'Control de acceso (check-in)',icon:'bi-fingerprint',group:'ADMINISTRACIÓN & RECEPCIÓN'},
  {key:'socios',label:'Gestión de socios & membresías',icon:'bi-people',group:'ADMINISTRACIÓN & RECEPCIÓN'},
  {key:'invitados',label:'Clientes diarios',icon:'bi-ticket-perforated',group:'ADMINISTRACIÓN & RECEPCIÓN'},
  {key:'aforo',label:'Control de aforo',icon:'bi-bar-chart',group:'ADMINISTRACIÓN & RECEPCIÓN'},
  {key:'recompensas',label:'Recompensas y promociones',icon:'bi-gift',group:'GESTIÓN COMERCIAL & BENEFICIOS'},
  {key:'mi-pandita',label:'Mi pandita (Socio)',icon:'bi-stars',group:'EXPERIENCIA DEL SOCIO (VISTA)'},
  {key:'asistencias',label:'Asistencias (Socio)',icon:'bi-calendar-check',group:'EXPERIENCIA DEL SOCIO (VISTA)'},
  {key:'mi-membresia',label:'Mi membresía',icon:'bi-person-vcard',group:'EXPERIENCIA DEL SOCIO (VISTA)'},
  {key:'configuracion',label:'Configuración Empresa',icon:'bi-gear',group:'CONFIGURACIÓN DEL SISTEMA'},
  {key:'usuarios',label:'Usuarios y roles',icon:'bi-person-lock',group:'CONFIGURACIÓN DEL SISTEMA'},
];
const CLIENT=['inicio','aforo','recompensas','mi-pandita','asistencias','mi-membresia'];
const CLIENT_LABELS={inicio:'Dashboard personal','mi-pandita':'Mi pandita',asistencias:'Mis asistencias'};
export function moduleLabel(key,user) {
  if(user?.rol==='cliente'&&CLIENT_LABELS[key])return CLIENT_LABELS[key];
  return STAFF_WINDOWS.find(module=>module.key===key)?.label || ({perfil:'Mi perfil','mis-recompensas':'Mis recompensas'})[key] || key;
}
export const PERSONAL_WINDOWS=['mi-pandita','asistencias','mi-membresia','mis-recompensas'];
export function canManageMemberLink(user) {
  return user?.rol==='admin'||(user?.rol!=='cliente'&&user?.permissions?.includes('usuarios')&&user.permissions.includes('socios'));
}
export function withPersonalTraining(user,sections) {
  if(user?.rol==='cliente'||!user?.memberLink)return sections;
  const result=sections.map(section=>({...section,items:section.items.filter(item=>!PERSONAL_WINDOWS.includes(item.to.split('/').pop()))})).filter(section=>section.items.length);
  const training={category:'EXPERIENCIA DEL SOCIO (VISTA)',items:[
    {to:'/app/mi-pandita',label:moduleLabel('mi-pandita',user),icon:'bi-stars'},
    {to:'/app/asistencias',label:moduleLabel('asistencias',user),icon:'bi-calendar-check'},
    {to:'/app/mi-membresia',label:'Mi membresía',icon:'bi-person-vcard'},
    {to:'/app/mis-recompensas',label:'Mis recompensas',icon:'bi-gift'},
  ]};
  result.splice(Math.max(0,result.length-1),0,training);
  return result;
}
export function canAccess(user,key) {
  if(!user)return false;
  if(key==='perfil')return true;
  if(user.rol!=='cliente'&&user.memberLink&&PERSONAL_WINDOWS.includes(key))return true;
  if(user.rol==='admin')return true;
  if(user.rol==='cliente')return CLIENT.includes(key);
  return Array.isArray(user.permissions)&&user.permissions.includes(key);
}
export function homeFor(user) {
  const first=STAFF_WINDOWS.find(m=>canAccess(user,m.key));
  return first?`/app/${first.key}`:'/app/perfil';
}
export function staffSections(user) {
  const groups=[...new Set(STAFF_WINDOWS.map(m=>m.group))];
  const sections=groups.map(group=>({category:group.toUpperCase(),items:STAFF_WINDOWS.filter(m=>m.group===group&&canAccess(user,m.key)).map(m=>({to:`/app/${m.key}`,label:m.label,icon:m.icon}))})).filter(s=>s.items.length);
  sections.push({category:'MI CUENTA',items:[{to:'/app/perfil',label:'Mi perfil',icon:'profile'}]});
  return withPersonalTraining(user,sections);
}

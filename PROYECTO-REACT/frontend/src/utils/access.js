export const STAFF_WINDOWS = [
  {key:'inicio',label:'Inicio',icon:'bi-grid',group:'Operación'},
  {key:'check-in',label:'Control de acceso',icon:'bi-fingerprint',group:'Operación'},
  {key:'socios',label:'Socios y membresías',icon:'bi-people',group:'Operación'},
  {key:'invitados',label:'Clientes diarios',icon:'bi-ticket-perforated',group:'Operación'},
  {key:'aforo',label:'Aforo',icon:'bi-bar-chart',group:'Operación'},
  {key:'recompensas',label:'Recompensas y promociones',icon:'bi-gift',group:'Beneficios'},
  {key:'mi-pandita',label:'Mi pandita',icon:'bi-stars',group:'Experiencia'},
  {key:'asistencias',label:'Calendario de asistencias',icon:'bi-calendar-check',group:'Experiencia'},
  {key:'mi-membresia',label:'Mi membresía',icon:'bi-person-vcard',group:'Experiencia'},
  {key:'configuracion',label:'Configuración de empresa',icon:'bi-gear',group:'Administración'},
  {key:'usuarios',label:'Usuarios y roles',icon:'bi-person-lock',group:'Administración'},
];
const CLIENT=['inicio','aforo','recompensas','mi-pandita','asistencias','mi-membresia'];
export function canAccess(user,key) {
  if(!user)return false;
  if(key==='perfil')return true;
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
  return sections;
}

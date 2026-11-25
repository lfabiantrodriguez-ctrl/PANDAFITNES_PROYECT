import {moduleLabel,staffSections,withPersonalTraining} from './access.js';

const icons={inicio:'grid',socios:'socios',invitados:'guests',recompensas:'rewards',
  'mi-pandita':'panda',asistencias:'calendar','mi-membresia':'membership',configuracion:'settings',usuarios:'bi-person-lock',perfil:'profile'};
const section=(role,category,keys)=>({category,items:keys.map(key=>({to:`/app/${key}`,label:moduleLabel(key,{rol:role}),icon:icons[key]}))});
export const MENU_SECTIONS={
  admin:[
    section('admin','ADMINISTRACIÓN & RECEPCIÓN',['inicio','socios','invitados']),
    section('admin','GESTIÓN COMERCIAL & BENEFICIOS',['recompensas']),
    section('admin','EXPERIENCIA DEL SOCIO (VISTA)',['mi-pandita','asistencias','mi-membresia']),
    section('admin','CONFIGURACIÓN DEL SISTEMA',['configuracion','usuarios','perfil']),
  ],
  cliente:[
    section('cliente','MI ENTRENAMIENTO',['inicio','mi-pandita','asistencias']),
    section('cliente','BENEFICIOS & MEMBRESÍA',['recompensas','mi-membresia']),
    section('cliente','CONFIGURACIÓN DE CUENTA',['perfil']),
  ],
};
export const MENU_ITEMS={admin:MENU_SECTIONS.admin.flatMap(section=>section.items),cliente:MENU_SECTIONS.cliente.flatMap(section=>section.items)};
export function menuSections(user) {
  return MENU_SECTIONS[user?.rol]?withPersonalTraining(user,MENU_SECTIONS[user.rol]):staffSections(user);
}

async function request(token,path='',method='GET',body) {
  const response=await fetch(`/api/admin/usuarios${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({message:'No se pudo conectar con el módulo de usuarios. Inicia el backend actualizado.'}));
  if(!response.ok)throw new Error(response.status===404?'El servidor abierto todavía no tiene el módulo de Usuarios y roles. Inicia el backend actualizado.':data.message||'No se pudo completar la operación.');
  return data;
}
export const StaffService={load:token=>request(token),saveUser:(token,id,body)=>request(token,id?`/${id}`:'',id?'PUT':'POST',body),saveRole:(token,id,body)=>request(token,id?`/roles/${id}`:'/roles',id?'PUT':'POST',body)};

import {useEffect,useState} from 'react'
import {Navigate,useLocation} from 'react-router-dom'
import {AuthService} from '../services/AuthService'
import {saveStoredSession} from '../utils/session'
import AppLayout from './AppLayout'

export default function ProtectedApp({token,user,onLogout,setUser}) {
  const location=useLocation()
  const [verified,setVerified]=useState(false),[error,setError]=useState('')
  useEffect(()=>{
    if(!token)return
    let active=true,sequence=0
    setVerified(false)
    function apply(nextUser){saveStoredSession(token,nextUser);setUser(nextUser);setVerified(true);setError('')}
    async function refresh(){
      const request=++sequence
      try{const data=await AuthService.getMe(token);if(active&&request===sequence)apply(data.user)}
      catch(e){if(!active||request!==sequence)return;if(e.status===401)onLogout();else setError('No se pudieron verificar tus permisos. Vuelve a consultar en un momento.')}
    }
    function profileUpdated(event){sequence++;if(active&&event.detail)apply(event.detail)}
    const visibleRefresh=()=>{if(document.visibilityState==='visible')refresh()}
    refresh()
    const timer=setInterval(visibleRefresh,15000)
    window.addEventListener('focus',visibleRefresh)
    window.addEventListener('panda-access-updated',refresh)
    window.addEventListener('panda-profile-updated',profileUpdated)
    return ()=>{active=false;sequence++;clearInterval(timer);window.removeEventListener('focus',visibleRefresh);window.removeEventListener('panda-access-updated',refresh);window.removeEventListener('panda-profile-updated',profileUpdated)}
  },[token,onLogout,setUser])
  if(!token||!user)return <Navigate to="/login" state={{from:location}} replace/>
  if(!verified)return <div style={{padding:40}} role="status">{error||'Verificando tu acceso…'}</div>
  return <AppLayout token={token} user={user} onLogout={onLogout} setUser={setUser}/>
}

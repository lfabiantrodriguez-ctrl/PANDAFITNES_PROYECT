import { useCallback, useEffect, useRef, useState } from 'react';
import { AttendanceService } from '../services/AttendanceService';
export default function usePandaAccount(token) {
  const [data,setData] = useState(null), [error,setError] = useState('');
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const result = await AttendanceService.getPandaStatus(token);
      if (request === sequence.current) { setData(result); setError(''); }
    } catch(e) { if(request === sequence.current) { setData(null);setError(e.message || 'No se pudieron cargar tus datos.'); } }
  },[token]);
  useEffect(()=>{
    setData(null); refresh();
    const update=()=>{if(document.visibilityState==='visible') refresh();};
    const timer=setInterval(update,15000);
    window.addEventListener('focus',update); window.addEventListener('panda-progress-updated',update);
    document.addEventListener('visibilitychange',update);
    return ()=>{sequence.current++;clearInterval(timer);window.removeEventListener('focus',update);window.removeEventListener('panda-progress-updated',update);document.removeEventListener('visibilitychange',update);};
  },[refresh]);
  return {data,error,refresh};
}

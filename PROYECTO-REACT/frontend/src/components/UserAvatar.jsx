import {useState} from 'react';
export default function UserAvatar({user,size, className=''}) {
  const [failed,setFailed]=useState('');
  const url=typeof user?.avatar_url==='string'?user.avatar_url:'';
  const initials=[user?.nombre,user?.apellido].filter(Boolean).map(n=>n.trim()[0]).join('').slice(0,2).toUpperCase()||'PF';
  return <span className={`user-avatar-content ${className}`} style={{width:size||'100%',height:size||'100%',borderRadius:'50%',overflow:'hidden',display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
    {url&&failed!==url?<img src={url} alt={`Foto de ${user?.nombre||'usuario'}`} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} onError={()=>setFailed(url)}/>:initials}
  </span>;
}

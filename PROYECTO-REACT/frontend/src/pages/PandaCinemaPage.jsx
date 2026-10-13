import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import LoginModal, { ROLE_HOME } from '../components/LoginModal'
import CapacityPanel from '../components/CapacityPanel'
import { ConfigService } from '../services/ConfigService'
import '../styles/PandaCinema.css'

const ASSETS = '/images/panda-story/'
const STAGES = [
  { id: 'bebe', name: 'El comienzo.', label: 'Empieza', line: 'Toda gran historia empieza con un primer día.', desc: 'Conoce a tu compañero. Tu panda empieza pequeño, con la misma curiosidad y las mismas ganas de ir por más que tú.', word: 'EMPIEZA', note: 'Tu primer paso cuenta.' },
  { id: 'intermedio', name: 'La constancia.', label: 'Construye', line: 'Lo que repites, te transforma.', desc: 'Entrenamiento a entrenamiento, tu esfuerzo se hace visible. Tu panda crece contigo y te acompaña a construir el hábito.', word: 'CRECE', note: 'Un día más. Un paso más.' },
  { id: 'musculoso', name: 'Tu mejor versión.', label: 'Supérate', line: 'Mira todo lo que has construido.', desc: 'Más fuerza, más confianza y un compañero que refleja el camino recorrido. Celebra tu progreso y encuentra tu próxima meta.', word: 'SUPÉRATE', note: 'La evolución se gana.' },
]
const LINKS = [['evolucion','Tu panda'],['experiencia','El club'],['premios','Beneficios'],['aforo','Aforo'],['contacto','Encuéntranos']]
const TRAINING = [
  { image:'training-strength.jpg',name:'FUERZA.',eyebrow:'CONSTRUYE TU BASE',desc:'Cada repetición es una conversación con la persona que quieres ser.' },
  { image:'training-cardio.jpg',name:'ENERGÍA.',eyebrow:'ENCUENTRA TU RITMO',desc:'Muévete, respira y descubre hasta dónde puedes llegar.' },
  { image:'training-floor.jpg',name:'CONSTANCIA.',eyebrow:'HAZLO PARTE DE TI',desc:'No hace falta un día perfecto. Hace falta volver a empezar.' },
]
const clamp = n => Math.max(0,Math.min(1,n))
const smooth = (a,b,n) => { const x=clamp((n-a)/(b-a)); return x*x*(3-2*x) }
const safeLink = value => { try { const u=new URL(value); return ['http:','https:'].includes(u.protocol)?u.href:null } catch {return null} }

function useReducedMotion() {
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setReduced(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change)},[])
  return reduced
}

function ScrollFilm({ onAccess, logo, name, reduced }) {
  const root=useRef(null), frame=useRef(0)
  const [chapter,setChapter]=useState(0)
  useEffect(()=>{
    const el=root.current
    let current=0,target=0,lastChapter=-1,stopped=false
    const paint=()=>{
      if(stopped)return
      current=reduced?0:current+(target-current)*.16
      if(Math.abs(target-current)<.0005)current=target
      el.style.setProperty('--film-progress',current.toFixed(5))
      el.style.setProperty('--press-blend',smooth(.32,.62,current).toFixed(4))
      const weights=[1-smooth(.18,.29,current),smooth(.25,.36,current)*(1-smooth(.56,.68,current)),smooth(.62,.75,current)]
      el.querySelectorAll('[data-film-copy]').forEach((copy,i)=>{copy.style.opacity=weights[i];copy.style.transform=`translateY(${(1-weights[i])*28}px)`;copy.style.visibility=weights[i]<.005?'hidden':'visible'})
      const next=current<.30?0:current<.65?1:2
      if(next!==lastChapter){setChapter(next);lastChapter=next}
      frame.current=Math.abs(target-current)>.0005&&!reduced?requestAnimationFrame(paint):0
    }
    const update=()=>{target=reduced?0:clamp(-el.getBoundingClientRect().top/Math.max(1,el.offsetHeight-window.innerHeight));if(!frame.current)frame.current=requestAnimationFrame(paint)}
    window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);update()
    return()=>{stopped=true;cancelAnimationFrame(frame.current);frame.current=0;window.removeEventListener('scroll',update);window.removeEventListener('resize',update)}
  },[reduced])
  function seek(index) {
    if(reduced){document.getElementById('club').scrollIntoView();return}
    const el=root.current
    window.scrollTo({top:window.scrollY+el.getBoundingClientRect().top+(el.offsetHeight-window.innerHeight)*[0,.45,.88][index],behavior:'smooth'})
  }
  return <section className="pc-film" ref={root} id="inicio" aria-label="La historia de tu esfuerzo">
    <div className="pc-film-sticky">
      <div className="pc-film-images" aria-hidden="true"><img src={`${ASSETS}press-start.webp`} alt="" fetchPriority="high" width="1950" height="807"/><img className="pc-film-finish" src={`${ASSETS}press-finish.webp`} alt="" width="1950" height="807"/></div><div className="pc-film-shade"/>
      <div className="pc-opening-bar"><a className="pc-brand" href="#inicio" aria-label={`${name}, inicio`}><img src={logo} alt=""/><span>PANDA<span>FITNESS</span></span></a><a className="pc-skip" href="#club">Explorar el club <span>↘</span></a></div>
      <div className="pc-film-copy" data-film-copy aria-hidden={chapter!==0}><span className="pc-kicker">01 / EL PRIMER PASO</span><h1>LA FUERZA<br/>EMPIEZA<br/><em>CONTIGO.</em></h1><p>No importa dónde empiezas.<br/>Importa que hoy decides hacerlo.</p></div>
      <div className="pc-film-copy" data-film-copy aria-hidden={chapter!==1} style={{opacity:0,visibility:'hidden'}}><span className="pc-kicker">02 / EL MOMENTO DE SEGUIR</span><h2>UNA REP.<br/><em>MÁS.</em></h2><p>Ese pequeño esfuerzo extra.<br/>Ahí empieza el cambio.</p></div>
      <div className="pc-film-copy" data-film-copy aria-hidden={chapter!==2} style={{opacity:0,visibility:'hidden'}}><span className="pc-kicker">03 / TU SIGUIENTE VERSIÓN</span><h2>NO SOLO<br/>ENTRENAS.<br/><em>EVOLUCIONAS.</em></h2><button className="pc-button" type="button" onClick={onAccess} tabIndex={chapter===2?0:-1}>Empieza tu historia <span>↗</span></button></div>
      <div className="pc-film-bottom"><a href="#club" className="pc-scroll-cue"><span>↓</span><span>BAJA. SIENTE EL CAMBIO.</span></a><div className="pc-chapters" aria-label="Capítulos de la presentación">{['El comienzo','El esfuerzo','La evolución'].map((label,i)=><button key={label} type="button" onClick={()=>seek(i)} aria-current={chapter===i?'step':undefined} aria-label={`Capítulo ${i+1}: ${label}`}><span>0{i+1}</span><i/></button>)}</div><span className="pc-film-credit">PANDA FITNESS / HECHO DE CONSTANCIA</span></div><div className="pc-film-progress"/>
    </div>
  </section>
}

export default function PandaCinemaPage({ onLogin, token, user, initialLoginOpen=false }) {
  const navigate=useNavigate(), [params]=useSearchParams()
  const [loginOpen,setLoginOpen]=useState(initialLoginOpen||params.get('login')==='true')
  const [config,setConfig]=useState({empresa_nombre:'Panda Fitness',empresa_logo:'/logo-panda.png'})
  const [stage,setStage]=useState(1), [training,setTraining]=useState(0), [menuOpen,setMenuOpen]=useState(false)
  const [installPrompt,setInstallPrompt]=useState(null)
  const [installed,setInstalled]=useState(()=>window.matchMedia('(display-mode: standalone)').matches)
  const installDialog=useRef(null), reduced=useReducedMotion(), panda=STAGES[stage]
  useEffect(()=>{
    let active=true
    ConfigService.getConfig().then(data=>{if(active&&data)setConfig(prev=>({...prev,...data}))}).catch(()=>{})
    const before=e=>{e.preventDefault();setInstallPrompt(e)}, after=()=>{setInstalled(true);setInstallPrompt(null);installDialog.current?.close()}, escape=e=>{if(e.key==='Escape')setMenuOpen(false)}
    window.addEventListener('beforeinstallprompt',before);window.addEventListener('appinstalled',after);window.addEventListener('keydown',escape)
    return()=>{active=false;window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',after);window.removeEventListener('keydown',escape)}
  },[])
  useEffect(()=>{if(initialLoginOpen||params.get('login')==='true')setLoginOpen(true)},[initialLoginOpen,params])
  useEffect(()=>{
    const nodes=document.querySelectorAll('.pc-reveal')
    if(reduced){nodes.forEach(n=>n.classList.add('pc-visible'));return}
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('pc-visible');observer.unobserve(entry.target)}}),{threshold:.12})
    nodes.forEach(n=>observer.observe(n));return()=>observer.disconnect()
  },[reduced])
  function access(){setMenuOpen(false);if(token&&user)navigate(ROLE_HOME[user.rol]||'/app/perfil');else setLoginOpen(true)}
  async function install(){setMenuOpen(false);if(installPrompt){try{await installPrompt.prompt();const choice=await installPrompt.userChoice;if(choice.outcome==='accepted')setInstalled(true)}catch{installDialog.current?.showModal()}finally{setInstallPrompt(null)}}else installDialog.current?.showModal()}
  const phone=(config.landing_redes_whatsapp||config.landing_gym_telefono||'').replace(/\D/g,'')
  const whatsapp=phone?`https://wa.me/${phone}?text=${encodeURIComponent('Hola, quiero conocer Panda Fitness y sus membresías.')}`:null
  const map=useMemo(()=>{const saved=safeLink(config.landing_gym_mapa_url);if(saved&&!/^https:\/\/maps.google.com\/?$/.test(saved))return saved;return config.landing_gym_direccion?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.landing_gym_direccion)}`:null},[config.landing_gym_mapa_url,config.landing_gym_direccion])
  const schedule=config.horario_semana_modalidad==='continuo'?`${config.horario_semana_corrido_inicio||'06:30'} — ${config.horario_semana_corrido_fin||'22:00'}`:`${config.horario_semana_manana_inicio||'06:30'} — ${config.horario_semana_manana_fin||'11:00'} / ${config.horario_semana_tarde_inicio||'16:00'} — ${config.horario_semana_tarde_fin||'20:00'}`
  return <main className={`panda-cinema${reduced?' pc-reduced-motion':''}`}>
    <a href="#club" className="pc-accessibility-skip">Saltar presentación</a>
    <ScrollFilm onAccess={access} logo={config.empresa_logo||'/logo-panda.png'} name={config.empresa_nombre} reduced={reduced}/>
    <header className="pc-nav" id="club"><a className="pc-brand" href="#inicio" aria-label="Panda Fitness, volver al inicio"><img src={config.empresa_logo||'/logo-panda.png'} alt=""/><span>PANDA<span>FITNESS</span></span></a><nav id="pc-navigation" aria-label="Navegación principal" className={menuOpen?'pc-menu-open':''}>{LINKS.map(([id,label])=><a href={`#${id}`} key={id} onClick={()=>setMenuOpen(false)}>{label}</a>)}</nav><div className="pc-nav-actions"><button className="pc-install" type="button" onClick={install}>{installed?'Tu app':'Instalar app'} <span>↗</span></button><button type="button" onClick={access} className="pc-button pc-button-small">{token&&user?'Mi panel':'Ingresar'} <span>↗</span></button><button type="button" className="pc-menu-toggle" aria-label={menuOpen?'Cerrar menú':'Abrir menú'} aria-controls="pc-navigation" aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}>{menuOpen?'✕':'☰'}</button></div></header>
    {String(config.aviso_activo)==='1'&&config.aviso_mensaje&&<aside className="pc-notice"><strong>{config.aviso_titulo}</strong> {config.aviso_mensaje}</aside>}
    <section className="pc-manifesto pc-reveal"><span className="pc-kicker">BIENVENIDO A PANDA FITNESS</span><h2>NO BUSCAMOS PERFECCIÓN.<br/>BUSCAMOS <em>GANAS.</em></h2><p>Ven como eres. Entrena a tu ritmo.<br/>Encuentra la fuerza para volver mañana.</p><a className="pc-text-link" href="#evolucion">Aquí empieza tu evolución <span>↓</span></a></section>
    <section className="pc-evolution" id="evolucion" aria-labelledby="evolution-title"><div className="pc-section-top"><span className="pc-kicker">01 / UN COMPAÑERO EN EL CAMINO</span><span className="pc-section-index">EL ESFUERZO SE VE.</span></div><div className="pc-evolution-grid"><div className="pc-evolution-art"><span className="pc-evolution-word" aria-hidden="true">{panda.word}</span><div className="pc-panda-halo"/>{STAGES.map((item,i)=><img key={item.id} src={`${ASSETS}${item.id}.webp`} alt={i===stage?`Panda en su etapa ${item.label.toLowerCase()}`:''} aria-hidden={i!==stage} className={i===stage?'pc-panda-active':''} loading="lazy" width="640" height="800"/>)}<div className="pc-art-note"><span>0{stage+1} / 03</span><p>{panda.note}</p></div></div><div className="pc-evolution-copy pc-reveal"><span className="pc-kicker">TÚ CRECES. ÉL TAMBIÉN.</span><h2 id="evolution-title">TU ESFUERZO.<br/><em>TU PANDA.</em></h2><p className="pc-section-intro">Un compañero que cambia contigo.<br/>De tus primeras ganas a tu mejor versión.</p><div className="pc-stage-tabs" role="group" aria-label="Explorar evolución">{STAGES.map((item,i)=><button key={item.id} type="button" aria-pressed={stage===i} onClick={()=>setStage(i)}><span>0{i+1}</span>{item.label}</button>)}</div><div className="pc-stage-description" aria-live="polite"><h3>{panda.name}</h3><strong>{panda.line}</strong><p>{panda.desc}</p></div><button type="button" className="pc-text-link" onClick={access}>Conocer mi panda <span>↗</span></button></div></div></section>
    <div className="pc-ribbon" aria-hidden="true"><div>{[0,1].map(i=><span key={i}>ESFUERZO REAL <b>✳</b> EVOLUCIÓN VISIBLE <b>✳</b> PANDA FITNESS <b>✳</b> </span>)}</div></div>
    <section className="pc-training" id="experiencia"><div className="pc-training-heading pc-reveal"><div><span className="pc-kicker">02 / ENCUENTRA TU RITMO</span><h2>MENOS EXCUSAS.<br/><em>MÁS TÚ.</em></h2></div><p>El mejor entrenamiento es el que haces.<br/>Dale un lugar en tu día.</p></div><div className="pc-gallery"><div className="pc-gallery-images">{TRAINING.map((item,i)=><img key={item.image} src={ASSETS+item.image} alt={i===training?`Ambiente de entrenamiento: ${item.name.toLowerCase()}`:''} aria-hidden={i!==training} className={i===training?'pc-gallery-active':''} loading="lazy" width="1000" height="667"/>)}</div><div className="pc-gallery-shade"/><div className="pc-gallery-caption" aria-live="polite"><span className="pc-kicker">{TRAINING[training].eyebrow}</span><h3>{TRAINING[training].name}</h3><p>{TRAINING[training].desc}</p></div><div className="pc-gallery-controls"><span>0{training+1} <small>/ 03</small></span><button type="button" aria-label="Ver ambiente anterior" onClick={()=>setTraining(v=>(v+2)%3)}>←</button><button type="button" aria-label="Ver siguiente ambiente" onClick={()=>setTraining(v=>(v+1)%3)}>→</button></div></div></section>
    <section className="pc-rewards" id="premios"><div className="pc-rewards-heading pc-reveal"><span className="pc-kicker">03 / DA MÁS. LLÉVATE MÁS.</span><h2>LA CONSTANCIA<br/>TIENE <em>PREMIO.</em></h2><p>Tu progreso no termina en la última repetición.<br/>También se convierte en beneficios para ti.</p><button type="button" className="pc-button pc-button-dark" onClick={access}>Explorar mis beneficios <span>↗</span></button></div><div className="pc-reward-steps">{[['01','APARECE.','Registra tu visita al club. Cada entrenamiento es parte de tu historia.','bi-qr-code-scan'],['02','ACUMULA.','Suma experiencia y bambús con tus asistencias. Tu constancia tiene valor.','bi-lightning-charge'],['03','DISFRUTA.','Consulta tus recompensas y los beneficios de comercios aliados en tu cuenta.','bi-gift']].map(([number,title,desc,icon])=><article key={number} className="pc-reveal"><span className="pc-step-number">{number}</span><div><h3>{title}</h3><p>{desc}</p></div><i className={`bi ${icon}`} aria-hidden="true"/></article>)}</div></section>
    <section className="pc-capacity-section" id="aforo"><div className="pc-reveal"><span className="pc-kicker">04 / HAZLE ESPACIO A TU ENTRENO</span><h2>TU MOMENTO.<br/><em>TU ESPACIO.</em></h2><p>Consulta el aforo antes de venir.<br/>Organiza tu visita y enfócate en lo que importa.</p><a className="pc-text-link" href="#contacto">Ver horarios del club <span>↗</span></a></div><div className="pc-capacity-frame pc-reveal"><span className="pc-capacity-title"><i/> ASÍ ESTÁ EL CLUB</span><CapacityPanel showDemo={false}/></div></section>
    <section className="pc-faq"><div className="pc-reveal"><span className="pc-kicker">SIN VUELTAS</span><h2>TUS GANAS.<br/><em>CERO DUDAS.</em></h2></div><div className="pc-faq-list">{[
      ['¿Cómo empiezo a entrenar?','Visítanos o escríbenos para conocer las membresías. Si ya eres socio, ingresa con tu cuenta para consultar tu progreso y los servicios del club.'],
      ['¿Cómo evoluciona mi panda?','Tu panda crece con la experiencia que acumulas al registrar tus entrenamientos. En tu cuenta puedes consultar tu etapa actual y el avance hacia la siguiente.'],
      ['¿Cómo funcionan las recompensas?','Tus asistencias te permiten acumular bambús. Consulta el catálogo de tu cuenta para ver las recompensas disponibles y sus condiciones de canje.'],
      ['¿Puedo usarlo desde el celular?','Sí. Puedes abrir Panda Fitness en tu navegador y añadirlo a tu pantalla de inicio. Usa el botón Instalar app para ver las opciones de tu dispositivo.'],
    ].map(([q,a],i)=><details key={q}><summary><span>0{i+1}</span>{q}<i aria-hidden="true"/></summary><p>{a}</p></details>)}</div></section>
    <section className="pc-contact" id="contacto"><div className="pc-contact-heading pc-reveal"><span className="pc-kicker">EL SIGUIENTE PASO ES TUYO</span><h2>NOS VEMOS<br/><em>EN EL CLUB.</em></h2>{whatsapp?<a className="pc-button" href={whatsapp} target="_blank" rel="noreferrer">Hablemos por WhatsApp <span>↗</span></a>:<button type="button" className="pc-button" onClick={access}>Entrar a Panda Fitness <span>↗</span></button>}</div><div className="pc-contact-details"><div><span className="pc-kicker">DÓNDE ENTRENAMOS</span><p>{config.landing_gym_direccion||'Consulta nuestra ubicación en recepción.'}</p>{map&&<a href={map} target="_blank" rel="noreferrer" className="pc-text-link">Cómo llegar <span>↗</span></a>}</div><div><span className="pc-kicker">HAZLO PARTE DE TU DÍA</span><dl><div><dt>Lunes a viernes</dt><dd>{schedule}</dd></div><div><dt>Sábado</dt><dd>{config.horario_sabado_estado==='0'?'Cerrado':`${config.horario_sabado_inicio||'07:00'} — ${config.horario_sabado_fin||'12:00'}`}</dd></div><div><dt>Domingo</dt><dd>{config.horario_domingo_abierto==='1'?`${config.horario_domingo_inicio||'08:00'} — ${config.horario_domingo_fin||'13:00'}`:'Día de descanso'}</dd></div></dl></div>{config.landing_gym_telefono&&<div><span className="pc-kicker">HABLEMOS</span><a className="pc-phone" href={`tel:${config.landing_gym_telefono.replace(/[^+\d]/g,'')}`}>{config.landing_gym_telefono}</a></div>}</div></section>
    <footer className="pc-footer"><div className="pc-footer-word" aria-hidden="true">PANDA FITNESS<span>✳</span></div><div className="pc-footer-bottom"><span>© {new Date().getFullYear()} {config.empresa_nombre}. Hecho de constancia.</span><div>{config.landing_redes_instagram&&<a href={`https://www.instagram.com/${config.landing_redes_instagram.replace(/^@/,'')}`} target="_blank" rel="noreferrer">Instagram ↗</a>}{config.landing_redes_tiktok&&<a href={`https://www.tiktok.com/@${config.landing_redes_tiktok.replace(/^@/,'')}`} target="_blank" rel="noreferrer">TikTok ↗</a>}<button type="button" className="pc-footer-install" onClick={install}>{installed?"Tu app":"Instalar app"} ↗</button><a href="#inicio">Volver arriba ↑</a></div></div></footer>
    <dialog className="pc-install-dialog" ref={installDialog} aria-labelledby="install-title" onClick={e=>{if(e.target===installDialog.current)installDialog.current.close()}}><button type="button" className="pc-dialog-close" aria-label="Cerrar instrucciones" onClick={()=>installDialog.current.close()}>✕</button><span className="pc-kicker">LLEVA EL CLUB CONTIGO</span><h2 id="install-title">TU PANDA.<br/>A UN TOQUE.</h2><p>{installed?'Ya tienes Panda Fitness instalado. Ábrelo desde el acceso de tu dispositivo.':'Añade Panda Fitness a tu pantalla de inicio para entrar cuando quieras.'}</p><ol><li><strong>iPhone o iPad:</strong> abre esta página en Safari, toca Compartir y elige «Añadir a pantalla de inicio».</li><li><strong>Android:</strong> abre el menú del navegador y elige «Instalar aplicación» o «Añadir a pantalla de inicio».</li><li><strong>Computadora:</strong> busca la opción de instalar en la barra de direcciones o en el menú de Chrome o Edge.</li></ol><button type="button" className="pc-button" onClick={()=>installDialog.current.close()}>Entendido <span>✓</span></button></dialog>
    <LoginModal isOpen={loginOpen} onClose={()=>setLoginOpen(false)} onLogin={onLogin}/>
  </main>
}

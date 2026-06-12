import { useNavigate } from 'react-router-dom'
import CapacityPanel from '../components/CapacityPanel'
import InfoCard from '../components/InfoCard'

export default function PublicHome() {
  const navigate = useNavigate()

  return (
    <main className="public-home">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Panda Fitness inicio">
          PANDA<span>FITNESS</span>
        </a>
        <button className="login-button" type="button" onClick={() => navigate('/login')}>
          Iniciar sesion
        </button>
      </header>

      <section className="hero-section" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="eyebrow">Control de aforo y reservas</p>
          <h1 id="home-title">Entrena con cupo confirmado en Panda Fitness</h1>
          <p className="hero-description">
            Consulta la ocupacion actual del gimnasio antes de salir de casa y
            prepara tu reserva de asistencia para ingresar dentro de tu horario.
          </p>

          <div className="hero-actions">
            <button className="primary-action" type="button" onClick={() => navigate('/login')}>
              Acceder al sistema
            </button>
            <span className="quiet-note">Acceso solo para socios con reserva valida</span>
          </div>
        </div>

        <CapacityPanel />
      </section>

      <section className="info-grid" aria-label="Informacion del servicio">
        <InfoCard
          label="Reserva de asistencia"
          title="Agenda tu ingreso y salida"
          text="El sistema usara la hora indicada por el socio para calcular la ocupacion estimada y evitar sobrepasar la capacidad."
        />
        <InfoCard
          label="Tolerancia operativa"
          title="15 minutos para validar"
          text="La reserva permanece valida durante los 15 minutos posteriores a la hora de entrada registrada."
        />
        <InfoCard
          label="Ingreso controlado"
          title="Recepcion vinculada a reserva"
          text="El registro de asistencia se realizara en recepcion para socios con membresia activa y reserva vigente."
        />
      </section>
    </main>
  )
}

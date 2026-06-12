import ViewTitle from '../components/ViewTitle'
import CapacityPanel from '../components/CapacityPanel'

export default function CapacityView() {
  return (
    <>
      <ViewTitle
        title="Monitoreo de Capacidad Instalada"
        text="Metricas predictivas basadas en las reservas y permanencias declaradas por los socios."
      />
      <div className="internal-grid">
        <CapacityPanel />
        <div className="stat-card">
          <p className="stat-label">Siguiente bloque</p>
          <div className="stat-value">09</div>
          <p className="stat-desc">Reservas para las 19:30 hrs</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Accesos hoy</p>
          <div className="stat-value">142</div>
          <p className="stat-desc">Trazabilidad de recepcion</p>
        </div>
      </div>
    </>
  )
}

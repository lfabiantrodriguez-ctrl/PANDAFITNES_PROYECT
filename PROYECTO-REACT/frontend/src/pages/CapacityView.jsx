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
        
      </div>
    </>
  )
}

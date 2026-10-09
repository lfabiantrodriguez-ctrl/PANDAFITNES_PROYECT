import ViewTitle from '../components/ViewTitle'
import CapacityPanel from '../components/CapacityPanel'

export default function CapacityView() {
  return (
    <>
      <ViewTitle
        title="Monitoreo de Capacidad Instalada"
        text="Métricas en tiempo real y permanencias de socios en sala."
      />
      <div className="internal-grid">
        <CapacityPanel />
        
      </div>
    </>
  )
}

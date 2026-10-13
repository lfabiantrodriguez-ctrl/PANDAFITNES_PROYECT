import ViewTitle from '../components/ViewTitle'
import {moduleLabel} from '../utils/access'
import CapacityPanel from '../components/CapacityPanel'

export default function CapacityView() {
  return (
    <>
      <ViewTitle
        title={moduleLabel('aforo')}
        text="Métricas en tiempo real y permanencias de socios en sala."
      />
      <div className="internal-grid">
        <CapacityPanel />
        
      </div>
    </>
  )
}

import { useEffect, useMemo, useState } from 'react'
import Metric from './Metric'
import { CapacityService } from '../services/CapacityService'

export const DEMO_CAPACITY = {
  actual: 38,
  maximo: 50,
  actualizadoEn: '2026-06-12T10:00:00.000Z',
}

export default function CapacityPanel() {
  const [capacity, setCapacity] = useState(DEMO_CAPACITY)
  const [source, setSource] = useState('demo')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadCapacity() {
      try {
        const data = await CapacityService.getCapacity()
        const current = Number(data.actual)
        const maximum = Number(data.maximo)

        if (!Number.isFinite(current) || !Number.isFinite(maximum) || maximum <= 0) {
          throw new Error('Respuesta de aforo invalida')
        }

        if (isMounted) {
          setCapacity({
            actual: Math.max(0, current),
            maximo: maximum,
            actualizadoEn: data.actualizadoEn || new Date().toISOString(),
          })
          setSource('api')
        }
      } catch {
        if (isMounted) {
          setCapacity(DEMO_CAPACITY)
          setSource('demo')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadCapacity()

    return () => {
      isMounted = false
    }
  }, [])

  const availability = useMemo(() => {
    const freeSlots = Math.max(capacity.maximo - capacity.actual, 0)
    const occupancy = Math.min(Math.round((capacity.actual / capacity.maximo) * 100), 100)

    return {
      freeSlots,
      occupancy,
      status: freeSlots === 0 ? 'Aforo completo' : 'Cupos disponibles',
      statusClass: freeSlots === 0 ? 'is-full' : 'is-open',
    }
  }, [capacity])

  const updatedAt = useMemo(() => {
    return new Intl.DateTimeFormat('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    }).format(new Date(capacity.actualizadoEn))
  }, [capacity.actualizadoEn])

  return (
    <section className="capacity-panel" aria-label="Aforo en tiempo real">
      <div className="panel-heading">
        <div>
          <p className="stat-label">Aforo en sala actual</p>
          <h2>{capacity.actual} personas</h2>
        </div>
        <span className={`status-badge ${availability.statusClass}`}>{availability.status}</span>
      </div>

      <div className="capacity-meter" aria-label={`${availability.occupancy}% de ocupacion`}>
        <span style={{ width: `${availability.occupancy}%` }} />
      </div>

      <div className="capacity-summary">
        <Metric value={capacity.maximo} label="Capacidad maxima" />
        <Metric value={availability.freeSlots} label="Cupos libres" />
        <Metric value={`${availability.occupancy}%`} label="Ocupacion" />
      </div>

      <p className="panel-footnote">
        {isLoading
          ? 'Consultando aforo...'
          : `Actualizado ${updatedAt} - ${source === 'api' ? 'datos en vivo' : 'datos demo'}`}
      </p>
    </section>
  )
}

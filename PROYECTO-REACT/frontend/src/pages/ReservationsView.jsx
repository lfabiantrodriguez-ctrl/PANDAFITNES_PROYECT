import { useMemo, useState } from 'react'
import ViewTitle from '../components/ViewTitle'
import FormField from '../components/FormField'
import { ReservationService } from '../services/ReservationService'

export default function ReservationsView({ token }) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [form, setForm] = useState({
    fecha: today,
    horaEntrada: '18:30',
    duracionMinutos: '90',
  })
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus({ loading: true, error: '', success: '' })

    try {
      await ReservationService.createReservation(token, {
        fecha: form.fecha,
        horaEntrada: form.horaEntrada,
        duracionMinutos: form.duracionMinutos,
      })
      setStatus({ loading: false, error: '', success: 'Reserva registrada correctamente.' })
    } catch (error) {
      setStatus({ loading: false, error: error.message || 'No se pudo registrar la reserva', success: '' })
    }
  }

  return (
    <>
      <ViewTitle
        title="Planificacion de Asistencia Obligatoria"
        text="El sistema calcula aforos cruzando hora de llegada con permanencia establecida."
      />
      <section className="content-box-md">
        <div className="system-notice">
          <strong>Regulacion de Capacidad:</strong> al registrar esta informacion, el sistema
          reservara el cupo y considerara 15 minutos de tolerancia para el ingreso.
        </div>
        <form onSubmit={handleSubmit}>
          <FormField
            label="Fecha seleccionada"
            type="date"
            value={form.fecha}
            onChange={(event) => updateField('fecha', event.target.value)}
          />
          <FormField
            label="Hora de llegada planificada"
            type="time"
            value={form.horaEntrada}
            onChange={(event) => updateField('horaEntrada', event.target.value)}
          />
          <div className="form-element">
            <label className="element-label" htmlFor="stay">Tiempo de permanencia declarado</label>
            <select
              id="stay"
              className="input-field"
              value={form.duracionMinutos}
              onChange={(event) => updateField('duracionMinutos', event.target.value)}
            >
              <option value="60">60 minutos</option>
              <option value="90">90 minutos</option>
              <option value="120">120 minutos</option>
            </select>
          </div>

          {status.error && <p className="form-error">{status.error}</p>}
          {status.success && <div className="system-notice success-notice">{status.success}</div>}

          <button className="action-btn btn-emerald btn-full" type="submit" disabled={status.loading}>
            {status.loading ? 'Registrando reserva...' : 'Validar Aforo y Registrar Reserva'}
          </button>
        </form>
      </section>
    </>
  )
}

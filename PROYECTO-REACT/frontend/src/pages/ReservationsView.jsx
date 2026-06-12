import ViewTitle from '../components/ViewTitle'
import FormField from '../components/FormField'

export default function ReservationsView() {
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
        <form>
          <FormField label="Fecha seleccionada" type="date" defaultValue="2026-06-15" />
          <FormField label="Hora de llegada planificada" type="time" defaultValue="18:30" />
          <div className="form-element">
            <label className="element-label" htmlFor="stay">Tiempo de permanencia declarado</label>
            <select id="stay" className="input-field" defaultValue="90">
              <option value="60">60 minutos</option>
              <option value="90">90 minutos</option>
              <option value="120">120 minutos</option>
            </select>
          </div>
          <button className="action-btn btn-emerald btn-full" type="button">
            Validar Aforo y Registrar Reserva
          </button>
        </form>
      </section>
    </>
  )
}

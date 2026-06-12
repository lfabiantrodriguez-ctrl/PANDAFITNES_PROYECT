import ViewTitle from '../components/ViewTitle'

export default function CheckInView() {
  return (
    <>
      <ViewTitle
        title="Modulo de Recepcion y Control de Acceso"
        text="Validacion de credenciales en tiempo real y manifiesto de reservas diarias."
      />
      <div className="two-column">
        <section className="stat-card">
          <label className="element-label" htmlFor="member-search">Escanear codigo de socio o DNI</label>
          <input id="member-search" className="input-field" type="text" defaultValue="73948201" />
          <button className="action-btn btn-dark btn-full" type="button">Consultar Reserva</button>
        </section>
        <section className="stat-card highlighted">
          <div className="member-result-heading">
            <div>
              <h3>Fabian Tongo Rodriguez</h3>
              <span>Socio ID: #PF-9834</span>
            </div>
            <span className="badge-status badge-valid">Membresia Vigente</span>
          </div>
          <div className="system-box">
            <p>Hora programada: <strong>18:30 hrs</strong></p>
            <p>Hora actual: <strong>18:41 hrs</strong></p>
            <p>Estado de tolerancia: <strong className="text-success">Valido (+11 min)</strong></p>
          </div>
          <button className="action-btn btn-emerald btn-full" type="button">
            Confirmar Entrada
          </button>
        </section>
      </div>
    </>
  )
}

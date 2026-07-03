import { useMemo, useState } from 'react'
import ViewTitle from '../components/ViewTitle'
import { CheckInService } from '../services/CheckInService'

export default function CheckInView({ token }) {
  const [code, setCode] = useState('')
  const [reservation, setReservation] = useState(null)
  const [user, setUser] = useState(null)
  const [history, setHistory] = useState([])
  const [checkInStatus, setCheckInStatus] = useState(null)
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })

  const canConfirm = useMemo(() => {
    return checkInStatus?.valid
  }, [checkInStatus])

  async function handleLookup() {
    setStatus({ loading: true, error: '', success: '' })
    setReservation(null)
    setUser(null)

    try {
      const data = await CheckInService.lookupReservation(token, code)
      setReservation(data.reservation)
      setUser(data.user)
      setHistory(data.history || [])
      setCheckInStatus(data.checkInStatus || null)
      setStatus({ loading: false, error: '', success: '' })
    } catch (error) {
      setStatus({ loading: false, error: error.message || 'No se pudo consultar la reserva', success: '' })
    }
  }

  async function handleConfirm() {
    if (!reservation) {
      return
    }

    setStatus({ loading: true, error: '', success: '' })

    try {
      await CheckInService.confirmEntry(token, reservation.id)
      setStatus({ loading: false, error: '', success: 'Entrada confirmada correctamente.' })
      setReservation((current) => ({ ...current, estado: 'confirmada' }))
    } catch (error) {
      setStatus({ loading: false, error: error.message || 'No se pudo confirmar la entrada', success: '' })
    }
  }

  async function handleFinalize() {
    if (!reservation) return
    setStatus({ loading: true, error: '', success: '' })
    try {
      await CheckInService.finalizeReservation(token, reservation.id)
      setStatus({ loading: false, error: '', success: 'Reserva finalizada correctamente.' })
      // Refresh lookup to get updated history and reservation state
      await handleLookup()
    } catch (error) {
      setStatus({ loading: false, error: error.message || 'No se pudo finalizar la reserva', success: '' })
    }
  }

  return (
    <>
      <ViewTitle
        title="Modulo de Recepcion y Control de Acceso"
        text="Validacion de credenciales en tiempo real y manifiesto de reservas diarias."
      />
      <div className="two-column">
        <section className="stat-card">
          <label className="element-label" htmlFor="member-search">Escanear DNI o nombre</label>
          <input
            id="member-search"
            className="input-field"
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="DNI o nombre completo"
          />
          <button className="action-btn btn-dark btn-full" type="button" disabled={status.loading || !code.trim()} onClick={handleLookup}>
            {status.loading ? 'Buscando...' : 'Consultar Reserva'}
          </button>
          {status.error && <p className="form-error">{status.error}</p>}
          {status.success && <div className="system-notice success-notice">{status.success}</div>}
        </section>

        <section className="stat-card highlighted">
          {user ? (
            <>
              <div className="member-result-heading">
                <div>
                  <h3>{user.nombre} {user.apellido}</h3>
                  <span>Socio ID: #{user.id}</span>
                </div>
                {reservation ? (
                  <span className={`badge-status ${checkInStatus?.valid ? 'badge-valid' : 'badge-warning'}`}>
                    {checkInStatus?.label}
                  </span>
                ) : (
                  <span className="badge-status badge-warning">
                    Sin reserva activa
                  </span>
                )}
              </div>

              {reservation ? (
                <>
                  <div className="system-box">
                    <p>Hora programada: <strong>{new Date(reservation.horaEntrada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} hrs</strong></p>
                    <p>Hora actual: <strong>{new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} hrs</strong></p>
                    <p>Estado de tolerancia: <strong className={checkInStatus?.valid ? 'text-success' : 'text-warning'}>{checkInStatus?.detail}</strong></p>
                  </div>
                  <button
                    className="action-btn btn-emerald btn-full"
                    type="button"
                    onClick={handleConfirm}
                    disabled={!canConfirm || status.loading}
                  >
                    Confirmar Entrada
                  </button>
                  <button
                    className="action-btn btn-warning btn-full"
                    type="button"
                    onClick={handleFinalize}
                    disabled={status.loading || reservation.estado !== 'confirmada'}
                    style={{ marginTop: '0.5rem' }}
                  >
                    Finalizar Reserva (Salida temprana)
                  </button>
                </>
              ) : (
                <div className="system-box">
                  <p>No se encontró una reserva activa para este socio.</p>
                  <p>Revisa su historial de reservas o intenta con otro código.</p>
                </div>
              )}

            </>
          ) : (
            <div className="system-box">
              <p>No hay datos de reserva cargados.</p>
              <p>Busca un socio por DNI para ver su reserva.</p>
            </div>
          )}
        </section>
      </div>

      <section className="stat-card table-frame">
        <h3 className="section-title">Historial completo de reservas</h3>
        {history.length > 0 ? (
          <table className="corporate-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora inicio</th>
                <th>Hora fin</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.horaEntrada).toLocaleDateString('es-PE')}</td>
                  <td>{new Date(item.horaEntrada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{new Date(item.horaSalida).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className={item.estado === 'confirmada' ? 'text-success' : item.estado === 'pendiente' ? 'text-warning' : 'text-danger'}>
                    {item.estado}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="system-box">
            <p>No se encontraron reservas para este usuario.</p>
          </div>
        )}
      </section>
    </>
  )
}

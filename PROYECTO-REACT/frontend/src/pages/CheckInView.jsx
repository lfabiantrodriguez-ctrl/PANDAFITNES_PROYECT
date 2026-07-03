import { useEffect, useMemo, useState } from 'react'
import ViewTitle from '../components/ViewTitle'
import { CheckInService } from '../services/CheckInService'

function formatDurationLabel(minutes) {
  if (!minutes) return ''
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}min`
}

function formatEstadoLabel(item) {
  if (item.tipo === 'reintegro_emergencia') {
    if (item.estado === 'pendiente') return 'Reintegro pendiente'
    if (item.estado === 'confirmada') return 'Reintegro activo'
    if (item.estado === 'finalizada') return 'Reintegro finalizado'
  }
  if (item.estado === 'cancelada_emergencia') return 'Cancelada (emergencia)'
  return item.estado
}

export default function CheckInView({ token }) {
  const [code, setCode] = useState('')
  const [reservation, setReservation] = useState(null)
  const [user, setUser] = useState(null)
  const [history, setHistory] = useState([])
  const [checkInStatus, setCheckInStatus] = useState(null)
  const [cancelWindow, setCancelWindow] = useState(null)
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })

  const isReintegro = reservation?.tipo === 'reintegro_emergencia'
  const canConfirm = useMemo(() => checkInStatus?.valid, [checkInStatus])
  const canCancel = useMemo(() => {
    return cancelWindow?.canCancel && reservation?.tipo !== 'reintegro_emergencia'
  }, [cancelWindow, reservation])

  async function handleLookup(silent = false) {
    if (!silent) {
      setStatus({ loading: true, error: '', success: '' })
    }
    if (!silent) {
      setReservation(null)
      setUser(null)
    }

    try {
      const data = await CheckInService.lookupReservation(token, code)
      setReservation(data.reservation)
      setUser(data.user)
      setHistory(data.history || [])
      setCheckInStatus(data.checkInStatus || null)
      setCancelWindow(data.cancelWindow || null)
      if (!silent) {
        setStatus({ loading: false, error: '', success: '' })
      }
    } catch (error) {
      if (!silent) {
        setStatus({ loading: false, error: error.message || 'No se pudo consultar la reserva', success: '' })
      }
    }
  }

  useEffect(() => {
    if (!user || !code.trim()) return undefined

    const timer = setInterval(() => {
      handleLookup(true)
    }, 15000)

    return () => clearInterval(timer)
  }, [user, code, token])

  async function handleConfirm() {
    if (!reservation) return

    setStatus({ loading: true, error: '', success: '' })

    try {
      const result = await CheckInService.confirmEntry(token, reservation.id)
      const successMessage = result.tipo === 'reintegro_emergencia'
        ? 'Reincorporacion registrada correctamente.'
        : 'Entrada confirmada correctamente.'
      setStatus({ loading: false, error: '', success: successMessage })
      await handleLookup(true)
    } catch (error) {
      setStatus({ loading: false, error: error.message || 'No se pudo confirmar la entrada', success: '' })
    }
  }

  async function handleCancelEmergency() {
    if (!reservation || !canCancel) return

    const confirmed = window.confirm(
      '¿Confirmar cancelacion por emergencia? Se generara una reserva de reintegro para el socio.'
    )
    if (!confirmed) return

    setStatus({ loading: true, error: '', success: '' })
    try {
      const result = await CheckInService.cancelEmergency(token, reservation.id)
      setStatus({
        loading: false,
        error: '',
        success: `Reserva cancelada. Reintegro de ${result.refundLabel} generado para el socio.`,
      })
      await handleLookup(true)
    } catch (error) {
      setStatus({ loading: false, error: error.message || 'No se pudo cancelar la reserva', success: '' })
    }
  }

  async function handleFinalize() {
    if (!reservation) return
    setStatus({ loading: true, error: '', success: '' })
    try {
      await CheckInService.finalizeReservation(token, reservation.id)
      setStatus({ loading: false, error: '', success: 'Reserva finalizada correctamente.' })
      await handleLookup(true)
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
          <button className="action-btn btn-dark btn-full" type="button" disabled={status.loading || !code.trim()} onClick={() => handleLookup()}>
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
                  {isReintegro && reservation.estado === 'pendiente' && (
                    <div className="system-notice warning-notice" style={{ marginBottom: '12px' }}>
                      <strong>Reserva de reintegro por emergencia.</strong> El socio puede reincorporarse hoy sin crear una nueva reserva. Tiempo disponible: {formatDurationLabel(reservation.duracionMinutos)}.
                    </div>
                  )}

                  <div className="system-box">
                    {isReintegro ? (
                      <>
                        <p>Tipo: <strong>Reintegro por cancelacion de emergencia</strong></p>
                        <p>Tiempo de reintegro: <strong>{formatDurationLabel(reservation.duracionMinutos)}</strong></p>
                        <p>Estado: <strong>{formatEstadoLabel(reservation)}</strong></p>
                      </>
                    ) : (
                      <>
                        <p>Hora programada: <strong>{new Date(reservation.horaEntrada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} hrs</strong></p>
                        <p>Hora actual: <strong>{new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} hrs</strong></p>
                        <p>Estado de tolerancia: <strong className={checkInStatus?.valid ? 'text-success' : 'text-warning'}>{checkInStatus?.detail}</strong></p>
                        {cancelWindow && (
                          <p>Ventana cancelacion emergencia: <strong className={canCancel ? 'text-success' : 'text-warning'}>{cancelWindow.detail}</strong></p>
                        )}
                      </>
                    )}
                  </div>

                  <button
                    className="action-btn btn-emerald btn-full"
                    type="button"
                    onClick={handleConfirm}
                    disabled={!canConfirm || status.loading || reservation.estado === 'confirmada'}
                  >
                    {isReintegro ? 'Registrar Reincorporacion' : 'Confirmar Entrada'}
                  </button>

                  {canCancel && (
                    <button
                      className="action-btn btn-warning btn-full"
                      type="button"
                      onClick={handleCancelEmergency}
                      disabled={status.loading}
                      style={{ marginTop: '0.5rem' }}
                    >
                      Cancelar Reserva (Emergencia)
                    </button>
                  )}

                  <button
                    className="action-btn btn-dark btn-full"
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
                  <p>No se encontro una reserva activa para este socio.</p>
                  <p>Revisa su historial de reservas o intenta con otro codigo.</p>
                </div>
              )}

            </>
          ) : (
            <div className="system-box">
              <p>No hay datos de reserva cargados.</p>
              <p>Busca un socio por DNI o nombre para ver su reserva.</p>
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
                <th>Tipo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.horaEntrada).toLocaleDateString('es-PE')}</td>
                  <td>{new Date(item.horaEntrada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{new Date(item.horaSalida).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{item.tipo === 'reintegro_emergencia' ? 'Reintegro' : 'Normal'}</td>
                  <td className={item.estado === 'confirmada' ? 'text-success' : item.estado === 'pendiente' ? 'text-warning' : 'text-danger'}>
                    {formatEstadoLabel(item)}
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

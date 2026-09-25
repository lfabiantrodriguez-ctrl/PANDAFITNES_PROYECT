import { useEffect, useMemo, useState } from 'react'
import ViewTitle from '../components/ViewTitle'
import { CheckInService } from '../services/CheckInService'

function formatEstadoLabel(item) {
  return item.estado
}

export default function CheckInView({ token }) {
  const [code, setCode] = useState('')
  const [reservation, setReservation] = useState(null)
  const [user, setUser] = useState(null)
  const [membership, setMembership] = useState(null)
  const [history, setHistory] = useState([])
  const [checkInStatus, setCheckInStatus] = useState(null)
  const [canDirectCheckIn, setCanDirectCheckIn] = useState(false)
  const [directDuration, setDirectDuration] = useState(60)
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })
  const [directError, setDirectError] = useState('')

  const canConfirm = useMemo(() => checkInStatus?.valid, [checkInStatus])

  async function handleLookup(silent = false) {
    if (!silent) {
      setStatus({ loading: true, error: '', success: '' })
    }
    if (!silent) {
      setReservation(null)
      setUser(null)
      setMembership(null)
      setCanDirectCheckIn(false)
    }

    try {
      const data = await CheckInService.lookupReservation(token, code)
      setReservation(data.reservation)
      setUser(data.user)
      setMembership(data.membership)
      setHistory(data.history || [])
      setCheckInStatus(data.checkInStatus || null)
      setCanDirectCheckIn(data.canDirectCheckIn || false)
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
      await CheckInService.confirmEntry(token, reservation.id)
      setStatus({ loading: false, error: '', success: 'Entrada confirmada correctamente.' })
      await handleLookup(true)
    } catch (error) {
      setStatus({ loading: false, error: error.message || 'No se pudo confirmar la entrada', success: '' })
    }
  }

  async function handleDirectCheckIn() {
    if (!user) return

    // Validar horario local antes de intentar registrar (mejora UX)
    const now = new Date()
    const entryMinutes = now.getHours() * 60 + now.getMinutes()
    const exitMinutes = entryMinutes + Number(directDuration || 0)
    const day = now.getDay()

    let allowed = false
    if (day === 0) {
      allowed = false
    } else if (day === 6) {
      // Sabado 7:00 - 12:00
      allowed = entryMinutes >= 420 && exitMinutes <= 720
    } else {
      // Lun-Vie: 6:30-11:00 (390-660) o 16:00-22:00 (960-1320)
      const morning = entryMinutes >= 390 && exitMinutes <= 660
      const evening = entryMinutes >= 960 && exitMinutes <= 1320
      allowed = morning || evening
    }

    if (!allowed) {
      setDirectError('No se puede realizar el registro porque el gimnasio está fuera del horario de atención')
      setStatus({ loading: false, error: '', success: '' })
      return
    }

    setStatus({ loading: true, error: '', success: '' })

    // Clear any previous direct error
    setDirectError('')

    try {
      await CheckInService.confirmDirectEntry(token, user.id, directDuration)
      setStatus({ loading: false, error: '', success: 'Check-in directo registrado correctamente.' })
      await handleLookup(true)
    } catch (error) {
      const msg = error.message || 'No se pudo registrar el check-in directo'
      setDirectError(msg)
      setStatus({ loading: false, error: '', success: '' })
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
                ) : membership ? (
                  <span className="badge-status badge-valid">
                    Check-in directo disponible
                  </span>
                ) : (
                  <span className="badge-status badge-warning">
                    Sin reserva activa
                  </span>
                )}
              </div>

              {reservation ? (
                reservation.tipo === 'checkin_directo' ? (
                  <>
                    <div className="system-box">
                      <p>Hora de entrada: <strong>{new Date(reservation.horaEntrada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} hrs</strong></p>
                      <p>Hora de salida: <strong>{reservation.horaSalida ? new Date(reservation.horaSalida).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '-'}</strong></p>
                      <p>Duración: <strong>{reservation.duracionMinutos ? `${Math.floor(reservation.duracionMinutos/60)}:${String(reservation.duracionMinutos%60).padStart(2,'0')} hrs` : '-'}</strong></p>
                    </div>

                    <button
                      className="action-btn btn-dark btn-full"
                      type="button"
                      onClick={handleFinalize}
                      disabled={status.loading || reservation.estado !== 'confirmada'}
                      style={{ marginTop: '0.5rem' }}
                    >
                      Finalizar Turno (Salida temprana)
                    </button>
                  </>
                ) : (
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
                      disabled={!canConfirm || status.loading || reservation.estado === 'confirmada'}
                    >
                      Confirmar Entrada
                    </button>

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
                )
              ) : membership ? (
                <>
                  <div className="system-box">
                    <p><strong>Membresía activa:</strong> {membership.planNombre}</p>
                    <p><strong>Válida hasta:</strong> {new Date(membership.fechaFin).toLocaleDateString('es-PE')}</p>
                    <p><strong>Días restantes:</strong> {membership.diasRestantes} días</p>
                    <p style={{ marginTop: '1rem', color: '#059669', fontWeight: 'bold' }}>
                      ✓ Puede hacer check-in directo
                    </p>
                  </div>

                  <div style={{ marginTop: '0.5rem' }}>
                    <label className="element-label">Duración estimada</label>
                    <select
                      className="input-field"
                      value={directDuration}
                      onChange={(e) => setDirectDuration(Number(e.target.value))}
                    >
                      <option value={60}>1 hora</option>
                      <option value={90}>1:30 hora</option>
                      <option value={120}>2 horas</option>
                      <option value={150}>2:30 horas</option>
                      <option value={180}>3 horas</option>
                    </select>

                    <button
                      className="action-btn btn-emerald btn-full"
                      type="button"
                      onClick={handleDirectCheckIn}
                      disabled={status.loading}
                      style={{ marginTop: '0.5rem' }}
                    >
                      Registrar Check-in Directo
                    </button>
                    {directError && (
                      <p className="form-error" style={{ marginTop: '8px' }}>{directError}</p>
                    )}
                  </div>
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
        <h3 className="section-title">Historial de Acceso del Cliente</h3>
        {history.length > 0 ? (
          <table className="corporate-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora entrada</th>
                <th>Hora salida</th>
                <th>Tipo de acceso</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => {
                const tipoLabel = item.tipo === 'checkin_directo' ? 'Check-in Directo' : 'Reserva';
                return (
                  <tr key={`${item.tipo}-${item.id}`}>
                    <td>{new Date(item.horaEntrada).toLocaleDateString('es-PE')}</td>
                    <td>{new Date(item.horaEntrada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{item.horaSalida ? new Date(item.horaSalida).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td>{tipoLabel}</td>
                    <td className={item.estado === 'confirmada' || item.estado === 'finalizada' ? 'text-success' : item.estado === 'activo' ? 'text-info' : item.estado === 'pendiente' ? 'text-warning' : 'text-danger'}>
                      {item.estado}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="system-box">
            <p>No se encontraron accesos para este usuario.</p>
          </div>
        )}
      </section>
    </>
  )
}

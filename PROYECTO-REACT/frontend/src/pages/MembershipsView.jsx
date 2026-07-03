import { useCallback, useEffect, useMemo, useState } from 'react'
import ViewTitle from '../components/ViewTitle'
import { MembershipService } from '../services/MembershipService'
import { PlanService } from '../services/PlanService'
import { formatDate } from '../utils/formatters'

export default function MembershipsView({ token }) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [socios, setSocios] = useState([])
  const [plans, setPlans] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [renewForm, setRenewForm] = useState({
    socioId: null,
    socioNombre: '',
    socioApellido: '',
    socioDni: '',
    planId: '',
    fechaInicio: today,
    metodoPago: 'efectivo',
    isReincorporacion: false,
    fechaFinActual: null,
  })
  const [showRenewModal, setShowRenewModal] = useState(false)
  const [renewLoading, setRenewLoading] = useState(false)

  const loadData = useCallback(async (searchTerm) => {
    try {
      const data = await MembershipService.getMembershipsList(token, searchTerm)
      setSocios(data.socios || [])
    } catch (err) {
      setMessage(err.message)
    }
  }, [token])

  useEffect(() => {
    setLoading(true)
    setMessage('')

    async function init() {
      try {
        const [plansData] = await Promise.all([
          PlanService.getPlanes(token),
          MembershipService.getMembershipsList(token, ''),
        ])
        setPlans(plansData.planes || [])
        setSocios(plansData.socios || [])
      } catch (err) {
        setMessage(err.message)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [token])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData(search)
    }, 400)
    return () => clearTimeout(timer)
  }, [search, loadData])

  function openRenewModal(socio) {
    setRenewForm({
      socioId: socio.id,
      socioNombre: socio.nombre,
      socioApellido: socio.apellido,
      socioDni: socio.dni,
      planId: socio.planId ? String(socio.planId) : String(plans[0]?.id || ''),
      fechaInicio: socio.fechaFin && new Date(socio.fechaFin) >= new Date(new Date().toDateString())
        ? socio.fechaFin
        : today,
      metodoPago: 'efectivo',
      isReincorporacion: !socio.fechaFin || new Date(socio.fechaFin) < new Date(new Date().toDateString()),
      fechaFinActual: socio.fechaFin || null,
    })
    setShowRenewModal(true)
  }

  async function handleRenew(e) {
    e.preventDefault()
    setRenewLoading(true)
    setMessage('')

    try {
      await MembershipService.renewMembership(token, {
        userId: renewForm.socioId,
        planId: renewForm.planId,
        fechaInicio: renewForm.fechaInicio,
        metodoPago: renewForm.metodoPago,
      })
      setMessage(`Membresia renovada correctamente para ${renewForm.socioNombre} ${renewForm.socioApellido}. Se ha enviado un correo de notificacion.`)
      setShowRenewModal(false)
      loadData(search)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setRenewLoading(false)
    }
  }

  const selectedPlan = plans.find((p) => String(p.id) === String(renewForm.planId))

  return (
    <>
      <div className="view-header-row">
        <ViewTitle
          title="Gestion de Membresias"
          text="Administra las membresias de los socios, renueva planes y realiza seguimiento."
        />
      </div>

      {message && (
        <div className={`system-notice compact-notice ${message.includes('Error') || message.includes('error') ? 'notice-error' : ''}`}>
          {message}
        </div>
      )}

      <div className="membership-search-bar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: '#9ca3af' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="input-field"
          type="text"
          placeholder="Buscar socio por DNI o nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="table-frame">
        <table className="corporate-table">
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Socio</th>
              <th>DNI</th>
              <th>Plan Actual</th>
              <th>Inicio</th>
              <th>Fin</th>
              <th>Dias Rest.</th>
              <th>Estado</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="9">Cargando socios...</td>
              </tr>
            )}
            {!loading && socios.length === 0 && (
              <tr>
                <td colSpan="9">No se encontraron socios.</td>
              </tr>
            )}
            {!loading && socios.map((socio) => (
              <tr key={socio.id}>
                <td>#PF-{String(socio.id).padStart(4, '0')}</td>
                <td>{socio.nombre} {socio.apellido}</td>
                <td>{socio.dni}</td>
                <td>{socio.planNombre || 'Sin plan'}</td>
                <td>{socio.fechaInicio ? formatDate(socio.fechaInicio) : '--'}</td>
                <td>{socio.fechaFin ? formatDate(socio.fechaFin) : '--'}</td>
                <td>
                  {socio.diasRestantes !== null && socio.diasRestantes !== undefined
                    ? <span className={`days-cell ${socio.diasRestantes <= 5 ? 'days-cell-warning' : ''}`}>{socio.diasRestantes} d.</span>
                    : '--'}
                </td>
                <td>
                  <span className={`badge-status ${socio.estadoMembresia === 'activo' && socio.diasRestantes > 0 ? 'badge-valid' : 'badge-alert'}`}>
                    {socio.estadoMembresia || 'sin membresia'}
                  </span>
                </td>
                <td>
                  <button className="action-btn btn-emerald" type="button" style={{ minHeight: 36, padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => openRenewModal(socio)}>
                    Renovar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showRenewModal && (
        <div className="modal-overlay" onClick={() => !renewLoading && setShowRenewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Renovar Membresia</h2>
              <button className="modal-close" type="button" onClick={() => setShowRenewModal(false)} disabled={renewLoading}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="renew-socio-info">
                <div className="renew-avatar">
                  {renewForm.socioNombre?.charAt(0)}{renewForm.socioApellido?.charAt(0)}
                </div>
                <div>
                  <strong>{renewForm.socioNombre} {renewForm.socioApellido}</strong>
                  <span>DNI: {renewForm.socioDni}</span>
                </div>
              </div>

              <form onSubmit={handleRenew}>
                <div className="form-element">
                  <label className="element-label">Plan de membresia</label>
                  <select
                    className="input-field"
                    value={renewForm.planId}
                    onChange={(e) => setRenewForm((f) => ({ ...f, planId: e.target.value }))}
                    required
                  >
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.nombre} - S/. {Number(plan.precio).toFixed(2)} ({plan.duracionDias} dias)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-element">
                  <label className="element-label">
                    Fecha de inicio
                    {renewForm.isReincorporacion
                      ? <span className="renew-hint"> (Reincorporacion - selecciona la fecha de inicio)</span>
                      : <span className="renew-hint"> (Continuidad - fecha auto-calculada: {formatDate(renewForm.fechaInicio)})</span>
                    }
                  </label>
                  <input
                    className="input-field"
                    type="date"
                    value={renewForm.fechaInicio}
                    onChange={(e) => setRenewForm((f) => ({ ...f, fechaInicio: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-element">
                  <label className="element-label">Metodo de pago</label>
                  <select
                    className="input-field"
                    value={renewForm.metodoPago}
                    onChange={(e) => setRenewForm((f) => ({ ...f, metodoPago: e.target.value }))}
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="yape">Yape</option>
                    <option value="plin">Plin</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                </div>

                {selectedPlan && (
                  <div className="renew-summary">
                    <span className="renew-summary-label">Resumen:</span>
                    <div className="renew-summary-row">
                      <span>Plan:</span>
                      <strong>{selectedPlan.nombre}</strong>
                    </div>
                    <div className="renew-summary-row">
                      <span>Inicio:</span>
                      <strong>{formatDate(renewForm.fechaInicio)}</strong>
                    </div>
                    <div className="renew-summary-row">
                      <span>Duracion:</span>
                      <strong>{selectedPlan.duracionDias} dias</strong>
                    </div>
                    <div className="renew-summary-row">
                      <span>Total a pagar:</span>
                      <strong className="renew-total">S/. {Number(selectedPlan.precio).toFixed(2)}</strong>
                    </div>
                  </div>
                )}

                <div className="form-actions" style={{ marginTop: 16 }}>
                  <button className="action-btn btn-emerald" type="submit" disabled={renewLoading}>
                    {renewLoading ? 'Procesando...' : 'Confirmar Renovacion'}
                  </button>
                  <button className="action-btn btn-light" type="button" onClick={() => setShowRenewModal(false)} disabled={renewLoading}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

import { useEffect, useState } from 'react'
import ModalDialog from './ModalDialog'
import { PlanService } from '../services/PlanService'
import { SocioService } from '../services/SocioService'
import { formatDate } from '../utils/formatters'

export default function PlansAndOffersModal({ isOpen, onClose, token, plans, onPlansUpdated }) {
  const [tab, setTab] = useState('planes') // 'planes' | 'ofertas'
  const [editingPlan, setEditingPlan] = useState(null)
  const [planForm, setPlanForm] = useState({ nombre: '', duracionDias: 30, precio: 80, descripcion: '' })
  const [savingPlan, setSavingPlan] = useState(false)
  const [planFeedback, setPlanFeedback] = useState({ type: '', text: '' })

  const [offers, setOffers] = useState([])
  const [loadingOffers, setLoadingOffers] = useState(false)

  useEffect(() => {
    if (!isOpen || tab !== 'ofertas') return
    let active = true
    Promise.resolve().then(() => {
      if (active) setLoadingOffers(true)
    })
    SocioService.getOffers(token)
      .then((res) => {
        if (active) setOffers(res.ofertas || [])
      })
      .catch(() => {
        if (active) setOffers([])
      })
      .finally(() => {
        if (active) setLoadingOffers(false)
      })
    return () => {
      active = false
    }
  }, [isOpen, tab, token])

  function startEditPlan(p) {
    setEditingPlan(p.id)
    setPlanForm({
      nombre: p.nombre,
      duracionDias: p.duracionDias,
      precio: p.precio,
      descripcion: p.descripcion || '',
    })
    setPlanFeedback({ type: '', text: '' })
  }

  async function handleSavePlan(e) {
    e.preventDefault()
    if (!editingPlan) return
    setSavingPlan(true)
    setPlanFeedback({ type: '', text: '' })
    try {
      const res = await PlanService.updatePlan(token, editingPlan, planForm)
      onPlansUpdated?.(res.planes || [])
      setEditingPlan(null)
      setPlanFeedback({ type: 'success', text: res.message || 'Plan actualizado correctamente' })
    } catch (err) {
      setPlanFeedback({ type: 'error', text: err.message || 'No se pudo actualizar el plan' })
    } finally {
      setSavingPlan(false)
    }
  }

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Planes Tarifarios y Campañas Activas"
      subtitle="Edita los precios o duración de los planes y controla los cupos usados en promociones"
      badge="Administración Comercial"
      size="lg"
    >
      <div className="d-flex gap-2 border-bottom pb-2 mb-3">
        <button
          type="button"
          className={`btn btn-sm fw-bold ${tab === 'planes' ? 'btn-dark' : 'btn-light border text-muted'}`}
          onClick={() => setTab('planes')}
        >
          <i className="bi bi-tags me-1" /> Planes y Precios ({plans.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm fw-bold ${tab === 'ofertas' ? 'btn-dark' : 'btn-light border text-muted'}`}
          onClick={() => setTab('ofertas')}
        >
          <i className="bi bi-gift me-1" /> Promociones y Cupos
        </button>
      </div>

      {tab === 'planes' && (
        <div>
          {planFeedback.text && (
            <div className={`alert ${planFeedback.type === 'error' ? 'alert-danger' : 'alert-success'} py-2 px-3 small mb-3`}>
              {planFeedback.text}
            </div>
          )}

          <div className="table-responsive border rounded-3">
            <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.86rem' }}>
              <thead className="table-light">
                <tr>
                  <th className="py-2 px-3">Plan</th>
                  <th className="py-2 px-3">Duración</th>
                  <th className="py-2 px-3">Precio</th>
                  <th className="py-2 px-3">Descripción</th>
                  <th className="py-2 px-3 text-end">Acción</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 fw-bold text-dark">{p.nombre}</td>
                    <td className="px-3">{p.duracionDias} días</td>
                    <td className="px-3 fw-bold text-success">S/. {Number(p.precio).toFixed(2)}</td>
                    <td className="px-3 text-muted small">{p.descripcion || '-'}</td>
                    <td className="px-3 text-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-dark fw-semibold"
                        onClick={() => startEditPlan(p)}
                      >
                        <i className="bi bi-pencil me-1" /> Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editingPlan && (
            <form onSubmit={handleSavePlan} className="p-3 mt-3 rounded-3 border bg-light">
              <strong className="small d-block mb-2 text-dark">Editar Plan Seleccionado</strong>
              <div className="row g-2">
                <div className="col-12 col-md-4">
                  <label className="form-label small fw-bold mb-1">Nombre</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={planForm.nombre}
                    onChange={(e) => setPlanForm((f) => ({ ...f, nombre: e.target.value }))}
                    required
                  />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label small fw-bold mb-1">Duración (días)</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control form-control-sm"
                    value={planForm.duracionDias}
                    onChange={(e) => setPlanForm((f) => ({ ...f, duracionDias: e.target.value }))}
                    required
                  />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label small fw-bold mb-1">Precio (S/.)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    className="form-control form-control-sm"
                    value={planForm.precio}
                    onChange={(e) => setPlanForm((f) => ({ ...f, precio: e.target.value }))}
                    required
                  />
                </div>
                <div className="col-12">
                  <label className="form-label small fw-bold mb-1">Descripción</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={planForm.descripcion}
                    onChange={(e) => setPlanForm((f) => ({ ...f, descripcion: e.target.value }))}
                  />
                </div>
              </div>
              <div className="d-flex justify-content-end gap-2 mt-3">
                <button type="button" className="btn btn-sm btn-light border" onClick={() => setEditingPlan(null)}>
                  Cancelar
                </button>
                <button type="submit" disabled={savingPlan} className="btn btn-sm fw-bold" style={{ background: '#c4f039', color: '#111d15' }}>
                  {savingPlan ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {tab === 'ofertas' && (
        <div>
          {loadingOffers ? (
            <div className="text-center py-4 text-muted small">Cargando campañas y cupones...</div>
          ) : offers.length === 0 ? (
            <div className="text-center py-4 text-muted small">Aún no se han publicado promociones ni ofertas.</div>
          ) : (
            <div className="table-responsive border rounded-3" style={{ maxHeight: '360px', overflowY: 'auto' }}>
              <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.82rem' }}>
                <thead className="table-light">
                  <tr>
                    <th className="py-2 px-3">Promoción</th>
                    <th className="py-2 px-3">Código</th>
                    <th className="py-2 px-3">Alcance</th>
                    <th className="py-2 px-3">Cupos</th>
                    <th className="py-2 px-3">Vence</th>
                    <th className="py-2 px-3 text-end">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((o) => (
                    <tr key={o.id}>
                      <td className="px-3">
                        <div className="fw-bold text-dark">{o.titulo}</div>
                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>{o.tipo}</div>
                      </td>
                      <td className="px-3">
                        {o.tipo === 'pase_amigo' || !o.codigoCupon ? (
                          <span className="text-muted small">Automático (en recepción)</span>
                        ) : (
                          <span className="fw-bold" style={{ fontFamily: 'monospace' }}>{o.codigoCupon}</span>
                        )}
                      </td>
                      <td className="px-3">
                        {o.usuarioId ? (
                          <span className="badge bg-warning text-dark">
                            {o.usuarioNombre} {o.usuarioApellido}
                          </span>
                        ) : (
                          <span className="badge bg-info text-dark">General</span>
                        )}
                      </td>
                      <td className="px-3 fw-semibold">
                        {o.cuposMaximos ? `${o.cuposUsados} / ${o.cuposMaximos}` : `${o.cuposUsados} / Ilimitado`}
                      </td>
                      <td className="px-3 text-nowrap">{o.fechaFin ? formatDate(o.fechaFin) : 'Sin límite'}</td>
                      <td className="px-3 text-end">
                        <span
                          className={`badge ${
                            o.estado === 'activo' ? 'bg-success' : o.estado === 'canjeado' ? 'bg-secondary' : 'bg-danger'
                          }`}
                        >
                          {o.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </ModalDialog>
  )
}

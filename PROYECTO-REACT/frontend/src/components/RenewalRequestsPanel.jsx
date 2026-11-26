import { useCallback, useEffect, useMemo, useState } from 'react'
import ModalDialog from './ModalDialog'
import TablePagination, { paginateList } from './TablePagination'
import { MembershipService } from '../services/MembershipService'
import { formatDate, formatDateTimePeru, getTodayPeru } from '../utils/formatters'

const PAGE_SIZE = 10

function getStatusBadge(estado) {
  if (estado === 'pendiente') {
    return { bg: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', label: 'PENDIENTE' }
  }
  if (estado === 'aprobada') {
    return { bg: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', label: 'APROBADA' }
  }
  if (estado === 'rechazada') {
    return { bg: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', label: 'RECHAZADA' }
  }
  return { bg: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', label: 'CANCELADA' }
}

export default function RenewalRequestsPanel({ token, onProcessed }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pendiente') // 'pendiente' | 'aprobada' | 'rechazada' | 'todas'
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [feedback, setFeedback] = useState({ type: '', text: '' })
  const [receiptModalUrl, setReceiptModalUrl] = useState(null)

  const [approveTarget, setApproveTarget] = useState(null)
  const [processing, setProcessing] = useState(false)

  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const loadRequests = useCallback(async () => {
    setLoading(true)
    try {
      const res = await MembershipService.getAdminRenewalRequests(token, 'todas')
      setRequests(res.solicitudes || [])
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'No se pudieron cargar las solicitudes' })
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    let active = true
    MembershipService.getAdminRenewalRequests(token, 'todas')
      .then((res) => {
        if (active) setRequests(res.solicitudes || [])
      })
      .catch((err) => {
        if (active) setFeedback({ type: 'error', text: err.message || 'No se pudieron cargar las solicitudes' })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [token])

  useEffect(() => {
    if (!feedback.text) return undefined
    const timer = setTimeout(() => {
      setFeedback({ type: '', text: '' })
    }, 10000)
    return () => clearTimeout(timer)
  }, [feedback.text])

  const counts = useMemo(
    () => ({
      pendiente: requests.filter((r) => r.estado === 'pendiente').length,
      aprobada: requests.filter((r) => r.estado === 'aprobada').length,
      rechazada: requests.filter((r) => r.estado === 'rechazada').length,
      todas: requests.length,
    }),
    [requests],
  )

  const filteredRequests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return requests.filter((r) => {
      if (filter !== 'todas' && r.estado !== filter) return false
      if (!term) return true
      const text = `${r.nombre || ''} ${r.apellido || ''} ${r.dni || ''} ${r.planNombre || ''} ${r.codigoCupon || ''} ${r.metodoPago || ''}`.toLowerCase()
      return text.includes(term)
    })
  }, [requests, filter, searchTerm])

  const paginatedRequests = useMemo(
    () => paginateList(filteredRequests, currentPage, PAGE_SIZE),
    [filteredRequests, currentPage],
  )

  function getEffectiveStartDate(req) {
    const todayStr = getTodayPeru()
    const suggested = req?.fechaInicioSugerida ? String(req.fechaInicioSugerida).slice(0, 10) : todayStr
    return suggested >= todayStr ? suggested : todayStr
  }

  function openApprove(req) {
    setApproveTarget(req)
  }

  async function handleConfirmApprove(e) {
    e.preventDefault()
    if (!approveTarget) return
    setProcessing(true)
    setFeedback({ type: '', text: '' })
    try {
      const res = await MembershipService.approveRenewalRequest(token, approveTarget.id)
      setFeedback({ type: 'success', text: res.message || 'Solicitud aprobada y membresía renovada.' })
      setApproveTarget(null)
      window.dispatchEvent(new Event('panda_notifications_updated'))
      await loadRequests()
      onProcessed?.()
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Error al aprobar solicitud' })
    } finally {
      setProcessing(false)
    }
  }

  async function handleConfirmReject(e) {
    e.preventDefault()
    if (!rejectTarget) return
    if (!rejectReason.trim()) {
      setFeedback({ type: 'error', text: 'Ingresa el motivo del rechazo para avisar al socio.' })
      return
    }
    setProcessing(true)
    setFeedback({ type: '', text: '' })
    try {
      const res = await MembershipService.rejectRenewalRequest(token, rejectTarget.id, rejectReason.trim())
      setFeedback({ type: 'info', text: res.message || 'Solicitud rechazada.' })
      setRejectTarget(null)
      setRejectReason('')
      window.dispatchEvent(new Event('panda_notifications_updated'))
      await loadRequests()
      onProcessed?.()
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Error al rechazar solicitud' })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="d-flex flex-column gap-3">
      {feedback.text && (
        <div
          className={`alert ${
            feedback.type === 'error' ? 'alert-danger' : feedback.type === 'info' ? 'alert-warning' : 'alert-success'
          } d-flex justify-content-between align-items-center py-2 px-3 rounded-3 mb-0`}
        >
          <span className="small fw-semibold">{feedback.text}</span>
          <button type="button" className="btn-close btn-sm" onClick={() => setFeedback({ type: '', text: '' })} />
        </div>
      )}

      {/* Filtros y Buscador */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div className="d-flex flex-wrap gap-2">
          {[
            { id: 'pendiente', label: 'Pendientes' },
            { id: 'aprobada', label: 'Aprobadas' },
            { id: 'rechazada', label: 'Rechazadas' },
            { id: 'todas', label: 'Todas' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setFilter(tab.id)
                setCurrentPage(1)
              }}
              className={`btn btn-sm fw-semibold rounded-pill px-3 py-1 ${
                filter === tab.id ? 'btn-dark' : 'btn-light border text-muted'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className="badge rounded-pill ms-2"
                style={{
                  background: filter === tab.id ? '#c4f039' : '#e2e8f0',
                  color: '#111d15',
                }}
              >
                {counts[tab.id]}
              </span>
            </button>
          ))}
        </div>

        <div className="d-flex align-items-center gap-2 flex-grow-1 flex-sm-grow-0" style={{ minWidth: 0 }}>
          <input
            type="text"
            className="form-control form-control-sm"
            style={{ flex: '1 1 160px', minWidth: 0, maxWidth: '100%', borderRadius: '10px' }}
            placeholder="Buscar socio, DNI o cupón..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
          />
          <button type="button" className="btn btn-sm btn-outline-dark fw-semibold flex-shrink-0" onClick={loadRequests} disabled={loading}>
            <i className="bi bi-arrow-clockwise me-1" /> Actualizar
          </button>
        </div>
      </div>

      {/* TABLA DESKTOP ALINEADA */}
      <div className="card border shadow-sm d-none d-md-block" style={{ borderRadius: '16px', overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table table-hover align-middle m-0" style={{ fontSize: '0.86rem' }}>
            <thead>
              <tr>
                <th className="py-3 px-3">Socio</th>
                <th className="py-3 px-3">Plan Solicitado</th>
                <th className="py-3 px-3">Monto & Cupón</th>
                <th className="py-3 px-3">Método / Op.</th>
                <th className="py-3 px-3 text-center">Comprobante</th>
                <th className="py-3 px-3">Fecha Envío</th>
                <th className="py-3 px-3 text-center">Estado</th>
                <th className="py-3 px-3 text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-muted">
                    <span className="spinner-border spinner-border-sm me-2" />
                    Cargando solicitudes de renovación...
                  </td>
                </tr>
              )}

              {!loading && filteredRequests.length === 0 && (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-muted">
                    No se encontraron solicitudes para este filtro.
                  </td>
                </tr>
              )}

              {!loading &&
                paginatedRequests.items.map((req) => {
                  const st = getStatusBadge(req.estado)
                  return (
                    <tr key={req.id}>
                      <td className="px-3">
                        <div className="d-flex align-items-center gap-2">
                          <div
                            className="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                            style={{
                              width: '34px',
                              height: '34px',
                              background: '#111d15',
                              color: '#c4f039',
                              fontSize: '0.78rem',
                            }}
                          >
                            {req.nombre?.charAt(0)}{req.apellido?.charAt(0)}
                          </div>
                          <div>
                            <div className="fw-bold text-dark">{req.nombre} {req.apellido}</div>
                            <div className="text-muted small">
                              DNI {req.dni}{req.telefonoContacto ? ` · ${req.telefonoContacto}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-3">
                        <div className="fw-bold text-dark">{req.planNombre}</div>
                        <div className="text-muted small">
                          {req.duracionDias} días
                          {Number(req.diasExtra) > 0 && (
                            <span className="text-success fw-semibold ms-1">(+{req.diasExtra} d. gratis)</span>
                          )}
                        </div>
                      </td>

                      <td className="px-3">
                        <div className="fw-bold text-success">S/. {Number(req.montoFinal).toFixed(2)}</div>
                        {Number(req.descuentoAplicado) > 0 && (
                          <div className="text-muted" style={{ fontSize: '0.74rem' }}>
                            Base S/. {Number(req.montoBase).toFixed(2)} (−{Number(req.descuentoAplicado).toFixed(2)})
                          </div>
                        )}
                        {req.codigoCupon && (
                          <span className="badge bg-light text-dark border mt-1" style={{ fontSize: '0.68rem', fontFamily: 'monospace' }}>
                            {req.codigoCupon}
                          </span>
                        )}
                      </td>

                      <td className="px-3">
                        <span className="badge bg-dark text-white text-uppercase" style={{ fontSize: '0.7rem' }}>
                          {req.metodoPago}
                        </span>
                        {req.numeroOperacion && (
                          <div className="text-muted small mt-1">Op: {req.numeroOperacion}</div>
                        )}
                        {req.comentarioSocio && (
                          <div className="text-muted fst-italic text-truncate" style={{ maxWidth: '150px', fontSize: '0.72rem' }} title={req.comentarioSocio}>
                            “{req.comentarioSocio}”
                          </div>
                        )}
                      </td>

                      <td className="px-3 text-center">
                        {req.comprobanteUrl ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-dark d-inline-flex align-items-center gap-2 py-1 px-2"
                            style={{ borderRadius: '8px', fontSize: '0.76rem' }}
                            onClick={() => setReceiptModalUrl(req.comprobanteUrl)}
                          >
                            <img
                              src={req.comprobanteUrl}
                              alt="Captura"
                              style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '4px' }}
                            />
                            <span>Ver</span>
                          </button>
                        ) : (
                          <span className="text-muted small">Sin captura</span>
                        )}
                      </td>

                      <td className="px-3 text-muted small text-nowrap">
                        {formatDateTimePeru(req.creadoEn)}
                      </td>

                      <td className="px-3 text-center">
                        <span
                          className="badge px-2 py-1"
                          style={{ background: st.bg, color: st.color, border: st.border, fontSize: '0.7rem' }}
                        >
                          {st.label}
                        </span>
                        {req.motivoRechazo && req.estado === 'rechazada' && (
                          <div className="text-danger mt-1 text-truncate" style={{ maxWidth: '140px', fontSize: '0.7rem' }} title={req.motivoRechazo}>
                            {req.motivoRechazo}
                          </div>
                        )}
                      </td>

                      <td className="px-3 text-end">
                        {req.estado === 'pendiente' ? (
                          <div className="d-inline-flex gap-1">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger fw-bold px-2 py-1"
                              style={{ borderRadius: '8px', fontSize: '0.76rem' }}
                              onClick={() => {
                                setRejectTarget(req)
                                setRejectReason('')
                              }}
                              title="Rechazar / observar solicitud"
                            >
                              <i className="bi bi-x-lg" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm fw-bold px-3 py-1"
                              style={{ background: '#c4f039', color: '#111d15', borderRadius: '8px', fontSize: '0.78rem' }}
                              onClick={() => openApprove(req)}
                            >
                              <i className="bi bi-check2-circle me-1" /> Aprobar
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted small">
                            {req.revisadoPorNombre ? `Por ${req.revisadoPorNombre}` : 'Procesada'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* VISTA MÓVIL */}
      <div className="d-block d-md-none">
        {loading && (
          <div className="card p-4 text-center text-muted border rounded-4">Cargando solicitudes...</div>
        )}
        {!loading && filteredRequests.length === 0 && (
          <div className="card p-4 text-center text-muted border rounded-4">No se encontraron solicitudes.</div>
        )}
        {!loading && filteredRequests.length > 0 && (
          <div className="mobile-card-list">
            {paginatedRequests.items.map((req) => {
              const st = getStatusBadge(req.estado)
              return (
                <div key={req.id} className="mobile-data-card">
                  <div className="mobile-card-header">
                    <div className="mobile-card-identity">
                      <div className="mobile-card-avatar">
                        {req.nombre?.charAt(0)}{req.apellido?.charAt(0)}
                      </div>
                      <div className="mobile-card-titles">
                        <h4 className="mobile-card-title">{req.nombre} {req.apellido}</h4>
                        <p className="mobile-card-subtitle">DNI {req.dni}</p>
                      </div>
                    </div>
                    <span className="badge" style={{ background: st.bg, color: st.color, border: st.border, fontSize: '0.68rem' }}>
                      {st.label}
                    </span>
                  </div>

                  <div className="mobile-card-body-grid">
                    <div className="mobile-card-field">
                      <div className="mobile-card-label">Plan</div>
                      <div className="mobile-card-value">{req.planNombre}</div>
                    </div>
                    <div className="mobile-card-field">
                      <div className="mobile-card-label">Monto Final</div>
                      <div className="mobile-card-value text-success fw-bold">S/. {Number(req.montoFinal).toFixed(2)}</div>
                    </div>
                    <div className="mobile-card-field">
                      <div className="mobile-card-label">Método / Cupón</div>
                      <div className="mobile-card-value text-uppercase">
                        {req.metodoPago}{req.codigoCupon ? ` · ${req.codigoCupon}` : ''}
                      </div>
                    </div>
                    <div className="mobile-card-field">
                      <div className="mobile-card-label">Fecha</div>
                      <div className="mobile-card-value" style={{ fontSize: '0.76rem' }}>{formatDateTimePeru(req.creadoEn)}</div>
                    </div>
                  </div>

                  <div className="mobile-card-actions">
                    {req.comprobanteUrl && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-dark fw-semibold flex-grow-1"
                        onClick={() => setReceiptModalUrl(req.comprobanteUrl)}
                      >
                        Ver captura
                      </button>
                    )}
                    {req.estado === 'pendiente' && (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger fw-bold"
                          onClick={() => {
                            setRejectTarget(req)
                            setRejectReason('')
                          }}
                        >
                          Rechazar
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm fw-bold flex-grow-1"
                          style={{ background: '#c4f039', color: '#111d15' }}
                          onClick={() => openApprove(req)}
                        >
                          Aprobar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {!loading && filteredRequests.length > 0 && (
        <TablePagination
          totalItems={filteredRequests.length}
          currentPage={paginatedRequests.safePage}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemLabel="solicitudes"
        />
      )}

      {/* MODAL VER COMPROBANTE */}
      <ModalDialog
        isOpen={Boolean(receiptModalUrl)}
        onClose={() => setReceiptModalUrl(null)}
        title="Comprobante de Pago del Socio"
        badge="Validación"
        size="md"
      >
        {receiptModalUrl && (
          <div className="text-center">
            <img
              src={receiptModalUrl}
              alt="Comprobante ampliado"
              style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '12px', border: '1px solid #e2e8f0' }}
            />
          </div>
        )}
      </ModalDialog>

      {/* MODAL APROBAR SOLICITUD (SOLO CONFIRMACIÓN DE DATOS SOLICITADOS) */}
      <ModalDialog
        isOpen={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        title="Validar y Activar Renovación"
        subtitle={approveTarget ? `${approveTarget.nombre} ${approveTarget.apellido} · DNI ${approveTarget.dni}` : ''}
        badge="Aprobación"
        size="md"
      >
        {approveTarget && (() => {
          const effectiveStart = getEffectiveStartDate(approveTarget)
          const hasContinuity = effectiveStart > getTodayPeru()
          return (
            <form onSubmit={handleConfirmApprove}>
              <div className="p-3 rounded-3 bg-light border mb-3 small">
                <div className="row g-2">
                  <div className="col-12 col-sm-6">
                    <div className="text-muted">Plan solicitado</div>
                    <div className="fw-bold text-dark">
                      {approveTarget.planNombre} ({approveTarget.duracionDias} días
                      {Number(approveTarget.diasExtra) > 0 ? ` + ${approveTarget.diasExtra} d. gratis` : ''})
                    </div>
                  </div>
                  <div className="col-12 col-sm-6">
                    <div className="text-muted">Monto validado a registrar</div>
                    <div className="fw-bold text-success">
                      S/. {Number(approveTarget.montoFinal).toFixed(2)}
                      {Number(approveTarget.descuentoAplicado) > 0 && (
                        <span className="text-muted fw-normal ms-1">
                          (Base S/. {Number(approveTarget.montoBase).toFixed(2)} · −S/. {Number(approveTarget.descuentoAplicado).toFixed(2)})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="col-12 col-sm-6">
                    <div className="text-muted">Método y operación</div>
                    <div className="fw-bold text-dark text-uppercase">
                      {approveTarget.metodoPago || 'YAPE'}
                      {approveTarget.numeroOperacion ? ` · Op. ${approveTarget.numeroOperacion}` : ''}
                    </div>
                  </div>
                  <div className="col-12 col-sm-6">
                    <div className="text-muted">Inicio efectivo del plan</div>
                    <div className="fw-bold text-dark">
                      {formatDate(effectiveStart)}{' '}
                      <span className="text-muted fw-normal">
                        ({hasContinuity ? 'continuidad' : 'desde hoy'})
                      </span>
                    </div>
                  </div>
                  {approveTarget.codigoCupon && (
                    <div className="col-12 col-sm-6">
                      <div className="text-muted">Cupón aplicado</div>
                      <span className="badge bg-dark text-white" style={{ fontFamily: 'monospace' }}>
                        {approveTarget.codigoCupon}
                      </span>
                    </div>
                  )}
                  {approveTarget.telefonoContacto && (
                    <div className="col-12 col-sm-6">
                      <div className="text-muted">Teléfono contacto</div>
                      <div className="fw-semibold text-dark">{approveTarget.telefonoContacto}</div>
                    </div>
                  )}
                  {approveTarget.comentarioSocio && (
                    <div className="col-12">
                      <div className="text-muted">Nota del socio</div>
                      <div className="fst-italic text-dark">“{approveTarget.comentarioSocio}”</div>
                    </div>
                  )}
                </div>
              </div>

              {approveTarget.comprobanteUrl && (
                <div className="mb-3 p-2 rounded-3 border bg-white text-center">
                  <div className="d-flex justify-content-between align-items-center px-1 mb-2">
                    <span className="small fw-bold text-dark">Comprobante enviado por el socio</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary py-0 px-2"
                      onClick={() => setReceiptModalUrl(approveTarget.comprobanteUrl)}
                    >
                      <i className="bi bi-arrows-fullscreen me-1" />
                      Ampliar
                    </button>
                  </div>
                  <img
                    src={approveTarget.comprobanteUrl}
                    alt="Comprobante de pago"
                    style={{ maxWidth: '100%', maxHeight: '220px', objectFit: 'contain', borderRadius: '8px' }}
                  />
                </div>
              )}

              <div className="p-2 px-3 rounded-3 border mb-3 small text-muted" style={{ background: '#f8fafc' }}>
                <i className="bi bi-shield-lock me-2 text-success" />
                Los datos del plan y pago están bloqueados según la solicitud del socio. Si algo no coincide con la captura, rechaza la solicitud.
              </div>

              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-3 border-top">
                <button
                  type="button"
                  className="btn btn-outline-danger fw-bold"
                  onClick={() => {
                    const target = approveTarget
                    setApproveTarget(null)
                    setRejectTarget(target)
                    setRejectReason('')
                  }}
                >
                  Rechazar
                </button>
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-light border" onClick={() => setApproveTarget(null)}>
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={processing}
                    className="btn fw-bold px-4"
                    style={{ background: '#c4f039', color: '#111d15' }}
                  >
                    {processing ? 'Activando...' : 'Confirmar Pago y Renovar'}
                  </button>
                </div>
              </div>
            </form>
          )
        })()}
      </ModalDialog>

      {/* MODAL RECHAZAR SOLICITUD */}
      <ModalDialog
        isOpen={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title="Rechazar / Observar Solicitud"
        subtitle={rejectTarget ? `${rejectTarget.nombre} ${rejectTarget.apellido} · Plan ${rejectTarget.planNombre}` : ''}
        badge="Rechazo"
        size="sm"
      >
        <form onSubmit={handleConfirmReject}>
          <div className="mb-3">
            <label className="form-label fw-bold small">Motivo visible para el socio *</label>
            <textarea
              className="form-control"
              rows={3}
              required
              placeholder="Ej. La captura de Yape está borrosa o no coincide el monto."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-light border" onClick={() => setRejectTarget(null)}>
              Cancelar
            </button>
            <button type="submit" disabled={processing} className="btn btn-danger fw-bold">
              {processing ? 'Enviando...' : 'Rechazar y Notificar'}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  )
}

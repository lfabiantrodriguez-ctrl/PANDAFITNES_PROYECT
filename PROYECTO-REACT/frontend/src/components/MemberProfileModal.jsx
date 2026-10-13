import { useEffect, useState } from 'react'
import ModalDialog from './ModalDialog'
import { SocioService } from '../services/SocioService'
import { formatDate, formatTimePeru } from '../utils/formatters'

export default function MemberProfileModal({
  isOpen,
  onClose,
  socioId,
  token,
  onOpenRenew,
  onOpenOffer,
}) {
  const [loading, setLoading] = useState(true)
  const [fichaData, setFichaData] = useState(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('matriculas') // 'matriculas' | 'asistencias' | 'ofertas'

  useEffect(() => {
    if (isOpen && socioId) {
      loadFicha()
    } else {
      setFichaData(null)
      setError('')
    }
  }, [isOpen, socioId])

  async function loadFicha() {
    setLoading(true)
    setError('')
    try {
      const res = await SocioService.getSocioFicha(token, socioId)
      setFichaData(res.ficha)
    } catch (err) {
      setError(err.message || 'Error cargando la ficha del socio')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const socio = fichaData?.socio
  const segmento = fichaData?.segmento
  const estadisticas = fichaData?.estadisticas
  const membresias = fichaData?.membresias || []
  const asistencias = fichaData?.asistencias || []
  const ofertas = fichaData?.ofertas || []

  function getSegmentBadgeStyle(key) {
    if (key === 'vip') return { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }
    if (key === 'nuevo') return { background: '#ecfccb', color: '#15803d', border: '1px solid #d9f99d' }
    if (key === 'por_vencer') return { background: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa' }
    if (key === 'activo') return { background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }
    return { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }
  }

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title={socio ? `${socio.nombre} ${socio.apellido}` : 'Ficha Integral del Socio'}
      subtitle={socio ? `Código: ${socio.codigo} · DNI: ${socio.dni}` : ''}
      badge="Ficha 360°"
      size="lg"
    >
      {loading && (
        <div className="text-center py-5">
          <div className="spinner-border text-success" role="status"></div>
          <p className="text-muted small mt-2">Cargando expediente del socio...</p>
        </div>
      )}

      {error && !loading && (
        <div className="alert alert-danger py-3 px-4 rounded-3 mb-3">
          {error}
        </div>
      )}

      {!loading && fichaData && (
        <div className="d-flex flex-column gap-3">
          {/* HEADER DEL SOCIO CON AVATAR, SEGMENTO Y DATOS */}
          <div
            className="p-3 rounded-3 border d-flex flex-wrap align-items-center justify-content-between gap-3"
            style={{ background: '#f8fafc' }}
          >
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                style={{
                  width: '52px',
                  height: '52px',
                  background: '#111d15',
                  color: '#c4f039',
                  border: '2px solid #c4f039',
                  fontSize: '1.2rem',
                  flexShrink: 0,
                }}
              >
                {socio.nombre?.charAt(0)}{socio.apellido?.charAt(0)}
              </div>
              <div>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <h4 className="m-0 fw-bold text-dark fs-5">{socio.nombre} {socio.apellido}</h4>
                  <span
                    className="badge rounded-pill fw-bold px-2 py-1"
                    style={{ ...getSegmentBadgeStyle(segmento?.key), fontSize: '0.74rem' }}
                  >
                    {segmento?.label}
                  </span>
                </div>
                <div className="text-muted small mt-1">
                  <span>DNI: <strong>{socio.dni}</strong></span>
                  <span className="mx-2">·</span>
                  <span>Email: {socio.email}</span>
                  {socio.telefono && (
                    <>
                      <span className="mx-2">·</span>
                      <span>Tel: {socio.telefono}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="text-end">
              <span className="text-muted small d-block">Antigüedad en el club</span>
              <strong className="text-dark small">
                {estadisticas?.antiguedadDias > 0 ? `${estadisticas.antiguedadDias} días registrado` : 'Nuevo ingreso'}
              </strong>
            </div>
          </div>

          {/* 4 CARDS DE ESTADÍSTICAS RÁPIDAS */}
          <div className="row g-2">
            <div className="col-6 col-md-3">
              <div className="p-2 border rounded-3 bg-white text-center">
                <span className="text-muted small d-block">Plan Actual</span>
                <strong className="text-dark fs-6 text-truncate d-block">
                  {estadisticas?.planActual || 'Sin plan'}
                </strong>
                <span
                  className="badge mt-1"
                  style={{
                    fontSize: '0.68rem',
                    background: estadisticas?.estadoMembresia === 'activo' ? '#ecfccb' : '#fee2e2',
                    color: estadisticas?.estadoMembresia === 'activo' ? '#15803d' : '#b91c1c',
                  }}
                >
                  {estadisticas?.estadoMembresia === 'activo' ? `${estadisticas.diasRestantes} días restantes` : 'Vencido'}
                </span>
              </div>
            </div>

            <div className="col-6 col-md-3">
              <div className="p-2 border rounded-3 bg-white text-center">
                <span className="text-muted small d-block">Matrículas Totales</span>
                <strong className="text-dark fs-5">{estadisticas?.totalMatriculas}</strong>
                <span className="text-muted d-block" style={{ fontSize: '0.68rem' }}>
                  {estadisticas?.totalMatriculas >= 2 ? 'Cliente recurrente' : 'Primer plan'}
                </span>
              </div>
            </div>

            <div className="col-6 col-md-3">
              <div className="p-2 border rounded-3 bg-white text-center">
                <span className="text-muted small d-block">Inversión Acumulada</span>
                <strong className="text-dark fs-5">
                  S/. {Number(estadisticas?.totalInvertido || 0).toFixed(2)}
                </strong>
                <span className="text-muted d-block" style={{ fontSize: '0.68rem' }}>Histórico en pagos</span>
              </div>
            </div>

            <div className="col-6 col-md-3">
              <div className="p-2 border rounded-3 bg-white text-center">
                <span className="text-muted small d-block">Asistencias a Sala</span>
                <strong className="text-dark fs-5">{estadisticas?.totalAsistencias}</strong>
                <span className="text-success d-block" style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                  +{estadisticas?.xpTotal || 0} XP acumulados
                </span>
              </div>
            </div>
          </div>

          {/* NAVEGACIÓN POR PESTAÑAS DENTRO DE LA FICHA */}
          <div className="d-flex border-bottom gap-2 pt-2">
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'matriculas' ? 'btn-dark fw-bold' : 'btn-light text-muted'}`}
              style={{ borderRadius: '8px 8px 0 0', fontSize: '0.82rem' }}
              onClick={() => setActiveTab('matriculas')}
            >
              Historial de Matrículas ({membresias.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'asistencias' ? 'btn-dark fw-bold' : 'btn-light text-muted'}`}
              style={{ borderRadius: '8px 8px 0 0', fontSize: '0.82rem' }}
              onClick={() => setActiveTab('asistencias')}
            >
              Asistencias Reales ({asistencias.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'ofertas' ? 'btn-dark fw-bold' : 'btn-light text-muted'}`}
              style={{ borderRadius: '8px 8px 0 0', fontSize: '0.82rem' }}
              onClick={() => setActiveTab('ofertas')}
            >
              Ofertas Asignadas ({ofertas.length})
            </button>
          </div>

          {/* CONTENIDO TAB 1: MATRÍCULAS / MEMBRESÍAS */}
          {activeTab === 'matriculas' && (
            <div className="border rounded-3 overflow-hidden bg-white" style={{ width: '100%' }}>
              <div style={{ maxHeight: '240px', overflowY: 'auto', overflowX: 'hidden', width: '100%' }}>
                <table className="table table-sm table-hover align-middle m-0" style={{ fontSize: '0.82rem', width: '100%', tableLayout: 'fixed' }}>
                  <thead className="table-light">
                    <tr>
                      <th className="py-2 px-2 text-start" style={{ width: '24%' }}>Plan</th>
                      <th className="py-2 px-2 text-center" style={{ width: '17%' }}>F. Inicio</th>
                      <th className="py-2 px-2 text-center" style={{ width: '17%' }}>F. Fin</th>
                      <th className="py-2 px-2 text-end" style={{ width: '15%' }}>Monto</th>
                      <th className="py-2 px-2 text-center" style={{ width: '13%' }}>Método</th>
                      <th className="py-2 px-2 text-center" style={{ width: '14%' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {membresias.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-4 text-muted">
                          No registra contratos o matrículas anteriores.
                        </td>
                      </tr>
                    ) : (
                      membresias.map((m) => (
                        <tr key={m.id}>
                          <td className="px-2 py-2 fw-bold text-dark text-truncate" title={m.planNombre}>{m.planNombre}</td>
                          <td className="px-2 py-2 text-center text-muted" style={{ fontSize: '0.78rem' }}>{formatDate(m.fechaInicio)}</td>
                          <td className="px-2 py-2 text-center" style={{ fontSize: '0.78rem' }}>{formatDate(m.fechaFin)}</td>
                          <td className="px-2 py-2 text-end fw-semibold">S/. {Number(m.montoPagado || m.planPrecio).toFixed(2)}</td>
                          <td className="px-2 py-2 text-center text-capitalize text-muted" style={{ fontSize: '0.76rem' }}>{m.metodoPago || 'Efectivo'}</td>
                          <td className="px-2 py-2 text-center">
                            <span
                              className={`badge ${
                                m.estado === 'activo'
                                  ? 'bg-success text-white'
                                  : 'bg-light text-secondary border'
                              } text-uppercase`}
                              style={{ fontSize: '0.66rem', padding: '3px 6px', letterSpacing: '0.02em' }}
                            >
                              {m.estado === 'activo' ? 'Vigente' : 'Expirado'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CONTENIDO TAB 2: ASISTENCIAS REALES */}
          {activeTab === 'asistencias' && (
            <div className="border rounded-3 overflow-hidden bg-white" style={{ width: '100%' }}>
              <div style={{ maxHeight: '240px', overflowY: 'auto', overflowX: 'hidden', width: '100%' }}>
                <table className="table table-sm table-hover align-middle m-0" style={{ fontSize: '0.82rem', width: '100%', tableLayout: 'fixed' }}>
                  <thead className="table-light">
                    <tr>
                      <th className="py-2 px-2" style={{ width: '22%' }}>Fecha</th>
                      <th className="py-2 px-2 text-center" style={{ width: '18%' }}>Entrada</th>
                      <th className="py-2 px-2 text-center" style={{ width: '18%' }}>Salida</th>
                      <th className="py-2 px-2 text-center" style={{ width: '24%' }}>Método</th>
                      <th className="py-2 px-2 text-center" style={{ width: '18%' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asistencias.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-4 text-muted">
                          Aún no registra asistencias en recepción.
                        </td>
                      </tr>
                    ) : (
                      asistencias.map((a) => (
                        <tr key={a.id}>
                          <td className="px-2 py-2 fw-semibold text-truncate">{formatDate(a.horaEntrada)}</td>
                          <td className="px-2 py-2 text-center">{formatTimePeru(a.horaEntrada)} hrs</td>
                          <td className="px-2 py-2 text-center text-muted">{a.horaSalida ? `${formatTimePeru(a.horaSalida)} hrs` : 'En curso'}</td>
                          <td className="px-2 py-2 text-center">
                            <span style={{ color: a.metodoRegistro === 'huella' ? '#15803d' : '#475569', fontWeight: 600, fontSize: '0.78rem' }}>
                              <i className={`bi ${a.metodoRegistro === 'huella' ? 'bi-fingerprint text-success' : 'bi-pen'} me-1`}></i>
                              {a.metodoRegistro === 'huella' ? 'Huella' : 'Manual'}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span
                              className={`badge ${a.estado === 'activo' ? 'bg-success text-white' : 'bg-light text-dark border'}`}
                              style={{ fontSize: '0.66rem', padding: '3px 6px' }}
                            >
                              {a.estado === 'activo' ? 'En sala' : 'Completada'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CONTENIDO TAB 3: OFERTAS ASIGNADAS */}
          {activeTab === 'ofertas' && (
            <div className="d-flex flex-column gap-2">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="text-muted small">Promociones vigentes y cupones de descuento:</span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-dark fw-bold px-2 py-1 d-inline-flex align-items-center gap-1"
                  style={{ fontSize: '0.76rem', borderRadius: '8px' }}
                  onClick={() => onOpenOffer?.(socio)}
                >
                  <i className="bi bi-gift text-warning"></i>
                  <span>Asignar Nueva Oferta</span>
                </button>
              </div>

              {ofertas.length === 0 ? (
                <div className="p-3 text-center text-muted border rounded-3 bg-light small">
                  No hay ofertas activas registradas para este socio.
                </div>
              ) : (
                <div className="d-flex flex-column gap-2" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  {ofertas.map((o) => (
                    <div
                      key={o.id}
                      className="p-3 border rounded-3 bg-white d-flex justify-content-between align-items-center"
                    >
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <strong className="text-dark small">{o.titulo}</strong>
                          {o.usuarioId ? (
                            <span className="badge bg-warning text-dark" style={{ fontSize: '0.65rem' }}>Exclusiva</span>
                          ) : (
                            <span className="badge bg-secondary text-white" style={{ fontSize: '0.65rem' }}>General</span>
                          )}
                        </div>
                        <p className="text-muted small m-0 mt-1">{o.descripcion}</p>
                        {o.fechaFin && (
                          <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                            Vence el: {formatDate(o.fechaFin)}
                          </span>
                        )}
                      </div>
                      <div className="text-end">
                        {o.codigoCupon && (
                          <div
                            className="badge bg-dark text-warning px-2 py-1 mb-1 d-block"
                            style={{ fontFamily: 'monospace', letterSpacing: '1px' }}
                          >
                            {o.codigoCupon}
                          </div>
                        )}
                        <span className="fw-bold text-success small">
                          {o.tipo === 'descuento_porcentaje'
                            ? `${o.valor}% OFF`
                            : o.tipo === 'descuento_fijo'
                              ? `S/. ${o.valor} OFF`
                              : o.tipo === 'dias_gratis'
                                ? `+${o.valor} Días gratis`
                                : 'Pase Amigo'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* BOTONES DE ACCIÓN EN EL FOOTER DE LA FICHA */}
          <div className="d-flex justify-content-between align-items-center pt-3 border-top mt-2 flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline-dark fw-bold px-3 py-2 d-inline-flex align-items-center gap-2"
              style={{ fontSize: '0.84rem', borderRadius: '10px' }}
              onClick={() => onOpenOffer?.(socio)}
            >
              <i className="bi bi-gift text-warning fs-6"></i>
              <span>Asignar Oferta Especial</span>
            </button>

            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary px-3 py-2 fw-semibold"
                style={{ fontSize: '0.84rem', borderRadius: '10px' }}
                onClick={onClose}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="btn fw-bold px-4 py-2 d-inline-flex align-items-center gap-2"
                style={{
                  background: '#c4f039',
                  color: '#111d15',
                  fontWeight: 800,
                  border: 'none',
                  borderRadius: '10px',
                  boxShadow: '0 4px 12px rgba(196, 240, 57, 0.4)',
                  fontSize: '0.84rem',
                }}
                onClick={() => onOpenRenew?.(socio)}
              >
                <i className="bi bi-arrow-repeat fs-6"></i>
                <span>Renovar Membresía</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalDialog>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import ViewTitle from '../components/ViewTitle'
import ModalDialog from '../components/ModalDialog'
import MemberProfileModal from '../components/MemberProfileModal'
import OfferModal from '../components/OfferModal'
import { MembershipService } from '../services/MembershipService'
import { PlanService } from '../services/PlanService'
import { formatDate, getTodayPeru } from '../utils/formatters'

export default function MembershipsView({ token }) {
  const today = useMemo(() => getTodayPeru(), [])
  const [socios, setSocios] = useState([])
  const [plans, setPlans] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  // Segmentación inteligente de membresías
  // 'todos' | 'activos' | 'por_vencer' | 'inactivos' | 'vip'
  const [segmentFilter, setSegmentFilter] = useState('todos')

  // Modales interactivos
  const [profileModalSocioId, setProfileModalSocioId] = useState(null)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [targetOfferSocio, setTargetOfferSocio] = useState(null)

  // Modal de Renovación
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
  const [renewErrors, setRenewErrors] = useState({})

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
        const [plansData, sociosData] = await Promise.all([
          PlanService.getPlanes(token),
          MembershipService.getMembershipsList(token, ''),
        ])
        setPlans(plansData.planes || [])
        setSocios(sociosData.socios || [])
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
    const isActivo = (socio.estadoMembresia || socio.estado) === 'activo' && Number(socio.diasRestantes) >= 0
    // Si aún está vigente, la renovación arranca el día que vence la actual para mantener continuidad
    // Si ya venció o no tiene plan, arranca el día de hoy
    const fechaInicioCalc = isActivo && socio.fechaFin
      ? socio.fechaFin.slice(0, 10)
      : today

    setRenewForm({
      socioId: socio.id,
      socioNombre: socio.nombre,
      socioApellido: socio.apellido,
      socioDni: socio.dni,
      planId: socio.planId ? String(socio.planId) : String(plans[0]?.id || ''),
      fechaInicio: fechaInicioCalc,
      metodoPago: 'efectivo',
      isReincorporacion: !isActivo,
      fechaFinActual: socio.fechaFin || null,
    })
    setRenewErrors({})
    setShowRenewModal(true)
  }

  async function handleRenew(e) {
    e.preventDefault()
    const errors = {}
    if (!renewForm.planId) {
      errors.planId = 'Por favor selecciona un plan de membresía'
    }
    if (!renewForm.fechaInicio) {
      errors.fechaInicio = 'Por favor selecciona la fecha de inicio de la membresía'
    }
    if (Object.keys(errors).length > 0) {
      setRenewErrors(errors)
      return
    }

    setRenewErrors({})
    setRenewLoading(true)

    try {
      await MembershipService.renewMembership(token, {
        userId: renewForm.socioId,
        planId: renewForm.planId,
        fechaInicio: renewForm.fechaInicio,
        metodoPago: renewForm.metodoPago,
      })
      setMessage(`Membresía renovada exitosamente para ${renewForm.socioNombre} ${renewForm.socioApellido}.`)
      setShowRenewModal(false)
      loadData(search)
      if (profileModalSocioId) {
        setProfileModalSocioId(renewForm.socioId) // recargar ficha si estaba abierta
      }
    } catch (err) {
      setRenewErrors({ general: err.message || 'Error al renovar membresía. Verifica los datos.' })
    } finally {
      setRenewLoading(false)
    }
  }

  // Conteos para tabs de segmentación
  const segmentCounts = useMemo(() => {
    return {
      todos: socios.length,
      activos: socios.filter((s) => (s.estadoMembresia || s.estado) === 'activo' && Number(s.diasRestantes) >= 0).length,
      por_vencer: socios.filter((s) => s.isPorVencer || s.segmentoKey === 'por_vencer').length,
      inactivos: socios.filter((s) => s.isInactivo || s.segmentoKey === 'inactivo' || s.estado === 'expirado' || s.estado === 'sin_plan').length,
      vip: socios.filter((s) => s.isVip || s.segmentoKey === 'vip').length,
    }
  }, [socios])

  // Filtrado de socios según segmento activo
  const filteredSocios = useMemo(() => {
    return socios.filter((s) => {
      const esActivo = (s.estadoMembresia || s.estado) === 'activo' && Number(s.diasRestantes) >= 0
      if (segmentFilter === 'activos' && !esActivo) return false
      if (segmentFilter === 'por_vencer' && !(s.isPorVencer || s.segmentoKey === 'por_vencer')) return false
      if (segmentFilter === 'inactivos' && esActivo) return false
      if (segmentFilter === 'vip' && !(s.isVip || s.segmentoKey === 'vip')) return false
      return true
    })
  }, [socios, segmentFilter])

  const selectedPlan = plans.find((p) => String(p.id) === String(renewForm.planId))

  return (
    <>
      {/* Header con botón para ofertas generales */}
      <div className="view-header-row d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <ViewTitle
          title="Gestión de Membresías"
          text="Control de renovaciones, seguimiento de vigencias, alertas de vencimiento y fidelización."
        />
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-dark fw-bold px-3 py-2 d-flex align-items-center gap-2 shadow-sm"
            style={{
              borderRadius: '12px',
              border: '1.5px solid #c4f039',
              color: '#c4f039',
              background: '#121e17',
              fontSize: '0.88rem',
            }}
            onClick={() => {
              setTargetOfferSocio(null)
              setShowOfferModal(true)
            }}
          >
            <span>🎁</span>
            <span>Promoción General</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="alert alert-dark d-flex align-items-center gap-2 py-3 px-4 rounded-3 border mb-4">
          <span className="text-success fw-bold">✓</span>
          <span>{message}</span>
        </div>
      )}

      {/* Tabs de Filtro por Segmento y Estado */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          className={`btn btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-semibold ${
            segmentFilter === 'todos' ? 'btn-dark' : 'btn-outline-secondary'
          }`}
          style={{
            borderRadius: '10px',
            background: segmentFilter === 'todos' ? '#121e17' : '#ffffff',
            color: segmentFilter === 'todos' ? '#c4f039' : '#4b5563',
            borderColor: segmentFilter === 'todos' ? '#121e17' : '#e5e7eb',
          }}
          onClick={() => setSegmentFilter('todos')}
        >
          <span>Todos</span>
          <span className="badge rounded-pill bg-light text-dark">{segmentCounts.todos}</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-semibold ${
            segmentFilter === 'activos' ? 'btn-dark' : 'btn-outline-secondary'
          }`}
          style={{
            borderRadius: '10px',
            background: segmentFilter === 'activos' ? '#121e17' : '#ffffff',
            color: segmentFilter === 'activos' ? '#c4f039' : '#166534',
            borderColor: segmentFilter === 'activos' ? '#121e17' : '#bbf7d0',
          }}
          onClick={() => setSegmentFilter('activos')}
        >
          <span>🟢 Vigentes / Activos</span>
          <span className="badge rounded-pill" style={{ background: '#dcfce7', color: '#166534' }}>
            {segmentCounts.activos}
          </span>
        </button>

        <button
          type="button"
          className={`btn btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-semibold ${
            segmentFilter === 'por_vencer' ? 'btn-dark' : 'btn-outline-secondary'
          }`}
          style={{
            borderRadius: '10px',
            background: segmentFilter === 'por_vencer' ? '#121e17' : '#ffffff',
            color: segmentFilter === 'por_vencer' ? '#c4f039' : '#c2410c',
            borderColor: segmentFilter === 'por_vencer' ? '#121e17' : '#fed7aa',
          }}
          onClick={() => setSegmentFilter('por_vencer')}
        >
          <span>⏰ Por Vencer (≤ 7 días)</span>
          <span className="badge rounded-pill" style={{ background: '#ffedd5', color: '#c2410c' }}>
            {segmentCounts.por_vencer}
          </span>
        </button>

        <button
          type="button"
          className={`btn btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-semibold ${
            segmentFilter === 'inactivos' ? 'btn-dark' : 'btn-outline-secondary'
          }`}
          style={{
            borderRadius: '10px',
            background: segmentFilter === 'inactivos' ? '#121e17' : '#ffffff',
            color: segmentFilter === 'inactivos' ? '#c4f039' : '#b91c1c',
            borderColor: segmentFilter === 'inactivos' ? '#121e17' : '#fecaca',
          }}
          onClick={() => setSegmentFilter('inactivos')}
        >
          <span>⚠️ Vencidos / Sin Plan</span>
          <span className="badge rounded-pill" style={{ background: '#fee2e2', color: '#b91c1c' }}>
            {segmentCounts.inactivos}
          </span>
        </button>

        <button
          type="button"
          className={`btn btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-semibold ${
            segmentFilter === 'vip' ? 'btn-dark' : 'btn-outline-secondary'
          }`}
          style={{
            borderRadius: '10px',
            background: segmentFilter === 'vip' ? '#121e17' : '#ffffff',
            color: segmentFilter === 'vip' ? '#c4f039' : '#b45309',
            borderColor: segmentFilter === 'vip' ? '#121e17' : '#fde68a',
          }}
          onClick={() => setSegmentFilter('vip')}
        >
          <span>⭐ Socios VIP</span>
          <span className="badge rounded-pill" style={{ background: '#fef3c7', color: '#b45309' }}>
            {segmentCounts.vip}
          </span>
        </button>
      </div>

      {/* Buscador */}
      <div className="mb-4">
        <input
          type="text"
          className="form-control form-control-lg border shadow-sm"
          placeholder="Buscar por DNI, nombre o apellido..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ borderRadius: '12px', fontSize: '0.95rem' }}
        />
      </div>

      {/* VISTA DESKTOP: TABLA CORPORATIVA CON ENCABEZADOS DE ALTO CONTRASTE */}
      <div className="card border shadow-sm d-none d-md-block" style={{ borderRadius: '16px', overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table table-hover align-middle m-0">
            <thead>
              <tr>
                <th>Socio</th>
                <th>DNI</th>
                <th>Plan Actual</th>
                <th>Fecha Inicio</th>
                <th>Fecha Fin</th>
                <th>Vigencia</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="8" className="text-center py-4 text-muted">
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Cargando membresías...
                  </td>
                </tr>
              )}
              {!loading && filteredSocios.length === 0 && (
                <tr>
                  <td colSpan="8" className="text-center py-4 text-muted">
                    No se encontraron registros de membresías para este filtro.
                  </td>
                </tr>
              )}
              {!loading &&
                filteredSocios.map((socio) => {
                  const diasRest = socio.diasRestantes !== null && socio.diasRestantes !== undefined ? Number(socio.diasRestantes) : null
                  const esActivo = (socio.estadoMembresia || socio.estado) === 'activo' && diasRest !== null && diasRest >= 0
                  const isPorVencer = esActivo && diasRest <= 7

                  return (
                    <tr key={socio.id}>
                      <td className="px-3">
                        <div className="d-flex align-items-center gap-2">
                          <div
                            className="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                            style={{
                              width: '38px',
                              height: '38px',
                              background: '#121e17',
                              color: '#c4f039',
                              border: '1.5px solid #c4f039',
                              fontSize: '0.82rem',
                            }}
                          >
                            {socio.nombre?.charAt(0)}{socio.apellido?.charAt(0)}
                          </div>
                          <div>
                            <div className="d-flex align-items-center gap-2">
                              <span className="fw-bold text-dark">{socio.nombre} {socio.apellido}</span>
                              <span className="badge bg-light text-muted border px-1" style={{ fontSize: '0.68rem' }}>
                                #PF-{String(socio.id).padStart(4, '0')}
                              </span>
                              {socio.isVip && (
                                <span className="badge" style={{ background: '#fef3c7', color: '#b45309', fontSize: '0.68rem' }}>
                                  ⭐ VIP
                                </span>
                              )}
                            </div>
                            <div className="text-muted small">{socio.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 fw-semibold text-secondary">{socio.dni}</td>
                      <td className="px-3 fw-semibold">
                        {socio.planNombre ? (
                          <div>
                            <span className="text-dark">{socio.planNombre}</span>
                            {socio.planPrecio && (
                              <div className="text-muted small">S/. {Number(socio.planPrecio).toFixed(2)}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted fst-italic">Sin plan</span>
                        )}
                      </td>
                      <td className="px-3 text-secondary">{formatDate(socio.fechaInicio)}</td>
                      <td className="px-3 text-secondary">{formatDate(socio.fechaFin)}</td>
                      <td className="px-3">
                        {socio.fechaFin ? (
                          diasRest >= 0 ? (
                            <span className={`fw-bold small ${isPorVencer ? 'text-warning' : 'text-success'}`}>
                              {diasRest === 0 ? 'Vence hoy' : `${diasRest} días rest.`}
                            </span>
                          ) : (
                            <span className="text-danger small fw-bold">
                              Venció hace {Math.abs(diasRest)} d.
                            </span>
                          )
                        ) : (
                          <span className="text-muted small">--</span>
                        )}
                      </td>
                      <td className="px-3">
                        {isPorVencer ? (
                          <span
                            className="badge px-2 py-1 text-uppercase"
                            style={{
                              fontSize: '0.72rem',
                              background: '#ffedd5',
                              color: '#c2410c',
                              border: '1px solid #fed7aa',
                            }}
                          >
                            ⏰ POR VENCER
                          </span>
                        ) : esActivo ? (
                          <span
                            className="badge px-2 py-1 text-uppercase"
                            style={{
                              fontSize: '0.72rem',
                              background: '#ecfccb',
                              color: '#166534',
                              border: '1px solid #bef264',
                            }}
                          >
                            ACTIVO
                          </span>
                        ) : socio.planNombre ? (
                          <span
                            className="badge px-2 py-1 text-uppercase"
                            style={{
                              fontSize: '0.72rem',
                              background: '#fee2e2',
                              color: '#991b1b',
                              border: '1px solid #fecaca',
                            }}
                          >
                            VENCIDO
                          </span>
                        ) : (
                          <span
                            className="badge px-2 py-1 text-uppercase"
                            style={{
                              fontSize: '0.72rem',
                              background: '#f3f4f6',
                              color: '#4b5563',
                              border: '1px solid #e5e7eb',
                            }}
                          >
                            SIN PLAN
                          </span>
                        )}
                      </td>
                      <td className="px-3 text-end">
                        <div className="d-flex justify-content-end align-items-center gap-1">
                          <button
                            className="btn btn-sm btn-outline-dark fw-semibold px-2 py-1"
                            style={{ borderRadius: '8px', fontSize: '0.78rem' }}
                            type="button"
                            title="Ver expediente 360°, historial de matrículas y asistencias"
                            onClick={() => setProfileModalSocioId(socio.id)}
                          >
                            📋 Ficha
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary px-2 py-1"
                            style={{ borderRadius: '8px', fontSize: '0.78rem' }}
                            type="button"
                            title="Ofrecer promoción personalizada"
                            onClick={() => {
                              setTargetOfferSocio(socio)
                              setShowOfferModal(true)
                            }}
                          >
                            🎁
                          </button>
                          <button
                            className="btn btn-sm fw-bold px-3 py-1"
                            style={{
                              borderRadius: '8px',
                              fontSize: '0.8rem',
                              background: '#c4f039',
                              color: '#111d15',
                              fontWeight: 800,
                              border: 'none',
                              boxShadow: '0 2px 8px rgba(196, 240, 57, 0.35)',
                            }}
                            type="button"
                            onClick={() => openRenewModal(socio)}
                          >
                            Renovar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* VISTA MÓVIL: TARJETAS NATIVAS ERGONÓMICAS (OPTIMIZADAS PARA EL PULGAR) */}
      <div className="d-block d-md-none mb-4">
        {loading && (
          <div className="text-center py-4 text-muted bg-white border rounded-3 p-3">
            <span className="spinner-border spinner-border-sm me-2"></span>
            Cargando membresías...
          </div>
        )}
        {!loading && filteredSocios.length === 0 && (
          <div className="text-center py-4 text-muted bg-white border rounded-3 p-3">
            No se encontraron registros de membresías para este filtro.
          </div>
        )}
        {!loading && (
          <div className="mobile-card-list">
            {filteredSocios.map((socio) => {
              const diasRest = socio.diasRestantes !== null && socio.diasRestantes !== undefined ? Number(socio.diasRestantes) : null
              const esActivo = (socio.estadoMembresia || socio.estado) === 'activo' && diasRest !== null && diasRest >= 0
              const isPorVencer = esActivo && diasRest <= 7

              return (
                <div key={socio.id} className="mobile-data-card">
                  {/* Header de la tarjeta */}
                  <div className="mobile-card-header">
                    <div className="mobile-card-identity">
                      <div className="mobile-card-avatar">
                        {socio.nombre?.charAt(0)}{socio.apellido?.charAt(0)}
                      </div>
                      <div className="mobile-card-titles">
                        <div className="d-flex align-items-center gap-1">
                          <h4 className="mobile-card-title">{socio.nombre} {socio.apellido}</h4>
                          {socio.isVip && (
                            <span className="badge" style={{ background: '#fef3c7', color: '#b45309', fontSize: '0.65rem' }}>
                              ⭐ VIP
                            </span>
                          )}
                        </div>
                        <p className="mobile-card-subtitle">
                          <span className="mobile-card-code me-2">#PF-{String(socio.id).padStart(4, '0')}</span>
                          <span>DNI: {socio.dni || 'Sin DNI'}</span>
                        </p>
                      </div>
                    </div>
                    <div>
                      {isPorVencer ? (
                        <span className="badge px-2 py-1 text-uppercase" style={{ fontSize: '0.68rem', background: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa' }}>
                          ⏰ Por Vencer
                        </span>
                      ) : esActivo ? (
                        <span className="badge px-2 py-1 text-uppercase" style={{ fontSize: '0.68rem', background: '#ecfccb', color: '#166534', border: '1px solid #bef264' }}>
                          🟢 Activo
                        </span>
                      ) : socio.planNombre ? (
                        <span className="badge px-2 py-1 text-uppercase" style={{ fontSize: '0.68rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>
                          ⚠️ Vencido
                        </span>
                      ) : (
                        <span className="badge px-2 py-1 text-uppercase" style={{ fontSize: '0.68rem', background: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb' }}>
                          Sin Plan
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cuerpo de la tarjeta en grid */}
                  <div className="mobile-card-body-grid">
                    <div className="mobile-card-field">
                      <div className="mobile-card-label">Plan Actual</div>
                      <div className="mobile-card-value">
                        {socio.planNombre || <span className="text-muted fst-italic">Sin plan</span>}
                      </div>
                    </div>
                    <div className="mobile-card-field">
                      <div className="mobile-card-label">Tarifa</div>
                      <div className="mobile-card-value">
                        {socio.planPrecio ? `S/. ${Number(socio.planPrecio).toFixed(2)}` : '--'}
                      </div>
                    </div>
                    <div className="mobile-card-field">
                      <div className="mobile-card-label">Vigencia</div>
                      <div className="mobile-card-value" style={{ fontSize: '0.78rem' }}>
                        {socio.fechaFin ? `${formatDate(socio.fechaInicio)} al ${formatDate(socio.fechaFin)}` : 'Sin fechas'}
                      </div>
                    </div>
                    <div className="mobile-card-field">
                      <div className="mobile-card-label">Días Restantes</div>
                      <div className="mobile-card-value">
                        {socio.fechaFin ? (
                          diasRest >= 0 ? (
                            <span className={`fw-bold ${isPorVencer ? 'text-warning' : 'text-success'}`}>
                              ⏳ {diasRest === 0 ? 'Vence hoy' : `${diasRest} días`}
                            </span>
                          ) : (
                            <span className="text-danger fw-bold">
                              ⚠️ Venció ({Math.abs(diasRest)}d)
                            </span>
                          )
                        ) : (
                          <span className="text-muted">--</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acciones para el pulgar */}
                  <div className="mobile-card-actions">
                    <button
                      className="btn btn-sm btn-outline-dark fw-bold px-2 py-2 flex-grow-1 d-flex align-items-center justify-content-center gap-1"
                      style={{ borderRadius: '10px', fontSize: '0.8rem' }}
                      type="button"
                      onClick={() => setProfileModalSocioId(socio.id)}
                    >
                      <span>📋</span>
                      <span>Ficha</span>
                    </button>
                    <button
                      className="btn btn-sm btn-outline-secondary px-3 py-2 d-flex align-items-center justify-content-center"
                      style={{ borderRadius: '10px', fontSize: '0.82rem' }}
                      type="button"
                      title="Ofrecer promoción"
                      onClick={() => {
                        setTargetOfferSocio(socio)
                        setShowOfferModal(true)
                      }}
                    >
                      <span>🎁 Promo</span>
                    </button>
                    <button
                      className="btn btn-sm fw-bold px-3 py-2 flex-grow-1 d-flex align-items-center justify-content-center gap-1"
                      style={{
                        borderRadius: '10px',
                        fontSize: '0.82rem',
                        background: '#c4f039',
                        color: '#111d15',
                        border: 'none',
                        boxShadow: '0 2px 6px rgba(196, 240, 57, 0.3)',
                      }}
                      type="button"
                      onClick={() => openRenewModal(socio)}
                    >
                      <span>💳</span>
                      <span>Renovar</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: RENOVAR MEMBRESÍA */}
      <ModalDialog
        isOpen={showRenewModal}
        onClose={() => setShowRenewModal(false)}
        title="Renovar Membresía"
        subtitle={`Socio: ${renewForm.socioNombre} ${renewForm.socioApellido} · DNI: ${renewForm.socioDni}`}
        badge="Renovación de Plan"
        size="md"
      >
        <form onSubmit={handleRenew}>
          {renewErrors.general && (
            <div className="alert alert-danger py-2 px-3 small mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <span>{renewErrors.general}</span>
            </div>
          )}

          <div className="d-flex flex-column gap-3">
            <div>
              <label className="form-label fw-bold small text-dark">Plan de Membresía *</label>
              <select
                className={`form-select ${renewErrors.planId ? 'is-invalid' : ''}`}
                value={renewForm.planId}
                onChange={(e) => {
                  setRenewForm((f) => ({ ...f, planId: e.target.value }))
                  if (renewErrors.planId) setRenewErrors((prev) => ({ ...prev, planId: '' }))
                }}
                style={renewErrors.planId ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.nombre} — S/. {Number(plan.precio).toFixed(2)} ({plan.duracionDias} días)
                  </option>
                ))}
              </select>
              {renewErrors.planId && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{renewErrors.planId}</span>
                </div>
              )}
            </div>

            <div>
              <label className="form-label fw-bold small text-dark">
                Fecha de Inicio *
                {renewForm.isReincorporacion ? (
                  <span className="text-muted fw-normal"> (Reincorporación desde hoy)</span>
                ) : (
                  <span className="text-success fw-normal"> (Continuidad desde el término del plan actual)</span>
                )}
              </label>
              <input
                className={`form-control ${renewErrors.fechaInicio ? 'is-invalid' : ''}`}
                type="date"
                value={renewForm.fechaInicio}
                onChange={(e) => {
                  setRenewForm((f) => ({ ...f, fechaInicio: e.target.value }))
                  if (renewErrors.fechaInicio) setRenewErrors((prev) => ({ ...prev, fechaInicio: '' }))
                }}
                style={renewErrors.fechaInicio ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
              />
              {renewErrors.fechaInicio ? (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{renewErrors.fechaInicio}</span>
                </div>
              ) : (
                <small className="text-muted d-block mt-1">
                  {renewForm.isReincorporacion
                    ? 'El socio no tiene plan activo, por lo que su vigencia iniciará a partir de la fecha elegida.'
                    : `Se mantiene la continuidad sumando los días a su vencimiento actual.`}
                </small>
              )}
            </div>

            <div>
              <label className="form-label fw-bold small text-dark">Método de Pago *</label>
              <select
                className="form-select"
                value={renewForm.metodoPago}
                onChange={(e) => setRenewForm((f) => ({ ...f, metodoPago: e.target.value }))}
              >
                <option value="efectivo">Efectivo</option>
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
                <option value="tarjeta">Tarjeta Débito/Crédito</option>
                <option value="transferencia">Transferencia Bancaria</option>
              </select>
            </div>

            {selectedPlan && (
              <div className="p-3 rounded-3 border bg-light d-flex justify-content-between align-items-center">
                <div>
                  <strong className="text-dark">{selectedPlan.nombre}</strong>
                  <div className="text-muted small">{selectedPlan.duracionDias} días de suscripción (domingos no hábiles)</div>
                </div>
                <span className="badge bg-dark text-white fs-6 px-3 py-2">
                  S/. {Number(selectedPlan.precio).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
            <button
              type="button"
              className="btn btn-outline-dark px-4 py-2 fw-semibold"
              onClick={() => setShowRenewModal(false)}
              disabled={renewLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn px-4 py-2 fw-bold shadow-sm"
              disabled={renewLoading}
              style={{
                background: '#c4f039',
                color: '#111d15',
                fontWeight: 800,
                border: 'none',
                borderRadius: '10px',
                boxShadow: '0 4px 14px rgba(196, 240, 57, 0.35)',
              }}
            >
              {renewLoading ? 'Procesando...' : 'Confirmar Renovación'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* MODAL 2: FICHA INTEGRAL 360° DEL SOCIO */}
      <MemberProfileModal
        isOpen={Boolean(profileModalSocioId)}
        onClose={() => setProfileModalSocioId(null)}
        socioId={profileModalSocioId}
        token={token}
        onOpenRenew={(socioData) => {
          openRenewModal(socioData)
        }}
        onOpenOffer={(socioData) => {
          setTargetOfferSocio(socioData)
          setShowOfferModal(true)
        }}
      />

      {/* MODAL 3: OFERTAS & PROMOCIONES (PERSONALIZADA O GENERAL) */}
      <OfferModal
        isOpen={showOfferModal}
        onClose={() => {
          setShowOfferModal(false)
          setTargetOfferSocio(null)
        }}
        targetSocio={targetOfferSocio}
        token={token}
        onSuccess={() => {
          setMessage('¡Promoción registrada y enviada exitosamente!')
          loadData(search)
        }}
      />
    </>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import DeviceEnrollment from '../components/DeviceEnrollment'
import ViewTitle from '../components/ViewTitle'
import {moduleLabel} from '../utils/access'
import ModalDialog from '../components/ModalDialog'
import MemberProfileModal from '../components/MemberProfileModal'
import OfferModal from '../components/OfferModal'
import { formatDate, getTodayPeru } from '../utils/formatters'
import { SocioService } from '../services/SocioService'
import { PlanService } from '../services/PlanService'
import { DniService } from '../services/DniService'
import { MembershipService } from '../services/MembershipService'

export default function MembersView({ token, user }) {
  const today = useMemo(() => getTodayPeru(), [])
  const [members, setMembers] = useState([])
  const [plans, setPlans] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [changingAccount, setChangingAccount] = useState(null)
  const [formStatus, setFormStatus] = useState({ loading: false, dniLoading: false, error: '' })
  const [searchTerm, setSearchTerm] = useState('')

  // Filtro de segmentación inteligente (CRM Socios)
  // 'todos' | 'vip' | 'nuevos' | 'por_vencer' | 'inactivos' | 'activos'
  const [segmentFilter, setSegmentFilter] = useState('todos')

  // Modales interactivos
  const [profileModalSocioId, setProfileModalSocioId] = useState(null)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [targetOfferSocio, setTargetOfferSocio] = useState(null)

  // Modal de renovación directa
  const [showRenewModal, setShowRenewModal] = useState(false)
  const [renewForm, setRenewForm] = useState({
    socioId: null,
    socioNombre: '',
    socioApellido: '',
    planId: '',
    fechaInicio: today,
    metodoPago: 'efectivo',
  })
  const [renewLoading, setRenewLoading] = useState(false)

  // Formulario de Alta de nuevo socio
  const [form, setForm] = useState({
    dni: '',
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    planId: '',
    fechaInicio: today,
    metodoPago: 'efectivo',
  })

  const selectedNewPlan = plans.find((plan) => String(plan.id) === String(form.planId))
  const selectedRenewPlan = plans.find((plan) => String(plan.id) === String(renewForm.planId))

  const loadData = useCallback(async () => {
    try {
      const [plansData, membersData] = await Promise.all([
        PlanService.getPlanes(token),
        SocioService.getSocios(token),
      ])

      setPlans(plansData.planes || [])
      setMembers(membersData.socios || [])
      setForm((current) => ({
        ...current,
        planId: current.planId || String(plansData.planes?.[0]?.id || ''),
      }))
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    setLoading(true)
    loadData()
  }, [loadData])

  const [fieldErrors, setFieldErrors] = useState({})
  const [renewErrors, setRenewErrors] = useState({})

  function updateField(field, value) {
    let cleanValue = value
    if (field === 'dni') cleanValue = value.replace(/\D/g, '').slice(0, 8)
    if (field === 'telefono') cleanValue = value.replace(/\D/g, '').slice(0, 9)
    if (field === 'nombre' || field === 'apellido') cleanValue = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '')
    setForm((current) => ({ ...current, [field]: cleanValue, ...(field === 'dni' ? {deviceTicket: ''} : {}) }))
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  function resetForm() {
    setEditingId(null)
    setForm({
      dni: '',
      nombre: '',
      apellido: '',
      email: '',
      telefono: '',
      planId: String(plans[0]?.id || ''),
      fechaInicio: today,
      metodoPago: 'efectivo',
    })
    setFieldErrors({})
    setFormStatus({ loading: false, dniLoading: false, error: '' })
  }

  async function handleDniLookup() {
    if (!form.dni || form.dni.length !== 8) {
      setFieldErrors((prev) => ({ ...prev, dni: 'Ingresa un DNI válido de 8 dígitos numéricos' }))
      return
    }

    setFormStatus({ loading: false, dniLoading: true, error: '' })
    setFieldErrors((prev) => ({ ...prev, dni: '' }))
    setMessage('')

    try {
      const data = await DniService.lookupDni(token, form.dni)
      setForm((current) => ({
        ...current,
        nombre: data.nombres || '',
        apellido: `${data.apellidoPaterno || ''} ${data.apellidoMaterno || ''}`.trim(),
      }))
      setFormStatus({ loading: false, dniLoading: false, error: '' })
    } catch (error) {
      setFieldErrors((prev) => ({ ...prev, dni: error.message || 'No se pudo consultar el DNI' }))
      setFormStatus({ loading: false, dniLoading: false, error: '' })
    }
  }

  async function handleCreateMember(e) {
    e.preventDefault()
    setFormStatus({ loading: true, dniLoading: false, error: '' })
    setMessage('')
    const errors = {}

    // Validación DNI
    if (!form.dni || form.dni.length !== 8) {
      errors.dni = 'El DNI debe tener exactamente 8 dígitos numéricos'
    }

    // Validación Nombres
    if (!form.nombre.trim()) {
      errors.nombre = 'El nombre es obligatorio'
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(form.nombre.trim())) {
      errors.nombre = 'El nombre solo debe contener letras'
    }

    // Validación Apellidos
    if (!form.apellido.trim()) {
      errors.apellido = 'Los apellidos son obligatorios'
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(form.apellido.trim())) {
      errors.apellido = 'Los apellidos solo deben contener letras'
    }

    // Validación Correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!form.email.trim()) {
      errors.email = 'El correo electrónico es obligatorio'
    } else if (!emailRegex.test(form.email.trim())) {
      errors.email = 'Ingresa un correo electrónico válido (ej. socio@gmail.com)'
    }

    // Validación Teléfono
    if (form.telefono && !/^\d{9}$/.test(form.telefono.trim())) {
      errors.telefono = 'El teléfono debe contener exactamente 9 dígitos numéricos'
    }

    // Validación Fecha de inicio
    if (!editingId && !form.fechaInicio) {
      errors.fechaInicio = 'Selecciona la fecha de inicio de la membresía'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setFormStatus({ loading: false, dniLoading: false, error: '' })
      return
    }

    setFieldErrors({})

    try {
      if (editingId) await SocioService.updateSocio(token, editingId, form)
      else await SocioService.createSocio(token, form)
      setMessage(editingId ? 'Datos del socio actualizados.' : `Socio ${form.nombre} ${form.apellido} registrado exitosamente.`)
      resetForm()
      setShowForm(false)
      loadData()
    } catch (error) {
      const errMsg = error.message || 'Error registrando socio'
      const lower = errMsg.toLowerCase()
      const mapped = {}
      if (lower.includes('dni')) mapped.dni = errMsg
      if (lower.includes('correo') || lower.includes('email')) mapped.email = errMsg
      if (lower.includes('teléfono') || lower.includes('telefono')) mapped.telefono = errMsg
      if (lower.includes('nombre')) mapped.nombre = errMsg
      if (lower.includes('apellido')) mapped.apellido = errMsg

      if (Object.keys(mapped).length > 0) {
        setFieldErrors((prev) => ({ ...prev, ...mapped }))
        setFormStatus({ loading: false, dniLoading: false, error: '' })
      } else {
        setFormStatus({ loading: false, dniLoading: false, error: errMsg })
      }
    }
  }

  async function changeAccount(socio) {
    if (changingAccount !== null) return
    setChangingAccount(socio.id)
    setMessage('')
    try {
      const activo = Number(socio.activo) !== 1
      const result = await SocioService.setActive(token, socio.id, activo)
      setMembers(current => current.map(member => member.id === socio.id ? { ...member, activo: activo ? 1 : 0 } : member))
      setMessage(result.message)
    } catch (error) {
      setMessage(error.message)
    } finally { setChangingAccount(null) }
  }

  function accountButton(socio) {
    if(socio.rol && socio.rol!=='cliente')return <span className="small text-secondary" title="El acceso del trabajador se gestiona desde Usuarios y roles">Cuenta del personal</span>
    const active = Number(socio.activo) === 1
    return <button type="button"
      className={`btn btn-sm fw-bold ${active ? 'btn-outline-danger' : 'btn-outline-success'}`}
      disabled={changingAccount !== null} onClick={() => changeAccount(socio)}
      aria-label={`${active ? 'Desactivar' : 'Activar'} cuenta de ${socio.nombre} ${socio.apellido}`}
      title={active ? 'Bloquear el ingreso a su cuenta' : 'Permitir el ingreso a su cuenta'}>
      <i className={`bi ${active ? 'bi-person-lock' : 'bi-person-check'} me-1`} />
      {changingAccount === socio.id ? 'Guardando...' : active ? 'Desactivar' : 'Activar'}
    </button>
  }

  function openRenewModal(socio) {
    setRenewErrors({})
    setRenewForm({
      socioId: socio.id,
      socioNombre: socio.nombre,
      socioApellido: socio.apellido,
      planId: socio.planId ? String(socio.planId) : String(plans[0]?.id || ''),
      fechaInicio: socio.fechaFin && new Date(socio.fechaFin) >= new Date(new Date().toDateString())
        ? socio.fechaFin.slice(0, 10)
        : today,
      metodoPago: 'efectivo',
    })
    setShowRenewModal(true)
  }

  async function handleRenew(e) {
    e.preventDefault()
    setRenewErrors({})

    if (!renewForm.fechaInicio) {
      setRenewErrors({ fechaInicio: 'Selecciona una fecha de inicio de vigencia' })
      return
    }

    setRenewLoading(true)
    setMessage('')

    try {
      await MembershipService.renewMembership(token, {
        userId: renewForm.socioId,
        planId: renewForm.planId,
        fechaInicio: renewForm.fechaInicio,
        metodoPago: renewForm.metodoPago,
      })
      setMessage(`Membresía renovada con éxito para ${renewForm.socioNombre} ${renewForm.socioApellido}.`)
      setShowRenewModal(false)
      loadData()
      if (profileModalSocioId) {
        setProfileModalSocioId(renewForm.socioId) // recargar ficha si estaba abierta
      }
    } catch (err) {
      setRenewErrors({ general: err.message || 'Error al renovar membresía' })
    } finally {
      setRenewLoading(false)
    }
  }

  function isMemberActive(m) {
    if (m.estadoMembresia === 'activo') return true
    if (m.diasRestantes !== null && Number(m.diasRestantes) >= 0) return true
    return false
  }

  // Conteos calculados para las pestañas de segmentación
  const segmentCounts = useMemo(() => {
    return {
      todos: members.length,
      activos: members.filter(isMemberActive).length,
      por_vencer: members.filter((m) => m.isPorVencer || m.segmentoKey === 'por_vencer' || (m.diasRestantes !== null && Number(m.diasRestantes) <= 7 && Number(m.diasRestantes) >= 0)).length,
      inactivos: members.filter((m) => !isMemberActive(m) || m.isInactivo || m.segmentoKey === 'inactivo').length,
      vip: members.filter((m) => m.isVip || m.segmentoKey === 'vip').length,
      nuevos: members.filter((m) => m.isNuevo || m.segmentoKey === 'nuevo').length,
    }
  }, [members])

  // Filtrado compuesto (segmento seleccionado + texto de búsqueda)
  const filteredMembers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return members.filter((m) => {
      // 1. Filtro por segmento
      if (segmentFilter === 'activos' && !isMemberActive(m)) return false
      if (segmentFilter === 'por_vencer' && !(m.isPorVencer || m.segmentoKey === 'por_vencer' || (m.diasRestantes !== null && Number(m.diasRestantes) <= 7 && Number(m.diasRestantes) >= 0))) return false
      if (segmentFilter === 'inactivos' && (isMemberActive(m) && !(m.isInactivo || m.segmentoKey === 'inactivo'))) return false
      if (segmentFilter === 'vip' && !(m.isVip || m.segmentoKey === 'vip')) return false
      if (segmentFilter === 'nuevos' && !(m.isNuevo || m.segmentoKey === 'nuevo')) return false

      // 2. Filtro por búsqueda
      if (!term) return true
      const fullText = `${m.dni || ''} ${m.nombre || ''} ${m.apellido || ''} ${m.email || ''} ${m.planNombre || ''}`.toLowerCase()
      return fullText.includes(term)
    })
  }, [members, segmentFilter, searchTerm])

  function getBadgeStyle(segmentoKey) {
    if (segmentoKey === 'vip') return { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }
    if (segmentoKey === 'nuevo') return { background: '#ecfccb', color: '#15803d', border: '1px solid #d9f99d' }
    if (segmentoKey === 'por_vencer') return { background: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa' }
    if (segmentoKey === 'activo') return { background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }
    return { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }
  }

  return (
    <>
      <div className="view-header-row d-flex flex-wrap justify-content-between align-items-center gap-3">
        <ViewTitle
          title={moduleLabel('socios')}
          text="Control integral de socios, vigencias de planes, renovaciones, fidelización y expedientes 360°."
        />

        <div className="d-flex gap-2 flex-wrap">
          <button
            className="btn btn-outline-dark fw-bold d-flex align-items-center gap-2 px-3 py-2"
            type="button"
            onClick={() => {
              setTargetOfferSocio(null)
              setShowOfferModal(true)
            }}
            style={{ borderRadius: '12px', fontSize: '0.9rem' }}
          >
            <i className="bi bi-gift text-warning fs-6"></i>
            <span>Promoción General</span>
          </button>

          <button
            className="btn d-flex align-items-center gap-2 px-4 py-2"
            type="button"
            onClick={() => {
              resetForm()
              setShowForm(true)
            }}
            style={{
              background: '#111d15',
              color: '#c4f039',
              fontWeight: 800,
              border: 'none',
              borderRadius: '12px',
              boxShadow: '0 4px 14px rgba(17, 29, 21, 0.25)',
              fontSize: '0.9rem',
            }}
          >
            <i className="bi bi-person-plus-fill fs-6"></i>
            <span>Nuevo Socio</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="alert alert-dark d-flex align-items-center gap-2 py-3 px-4 rounded-3 border mb-4">
          <i className="bi bi-check-circle-fill text-success fs-5"></i>
          <span>{message}</span>
        </div>
      )}

      {/* PESTAÑAS DE SEGMENTACIÓN ESTRATÉGICA (CRM SOCIOS & MEMBRESÍAS) */}
      <div
        className="d-flex gap-2 overflow-auto pb-2 mb-3"
        style={{ scrollbarWidth: 'none', whiteSpace: 'nowrap' }}
      >
        {[
          { key: 'todos', label: 'Todos los Socios', count: segmentCounts.todos, iconClass: 'bi bi-people-fill' },
          { key: 'activos', label: 'Vigentes / Activos', count: segmentCounts.activos, iconClass: 'bi bi-check-circle-fill text-success' },
          { key: 'por_vencer', label: 'Por Vencer (≤ 7 días)', count: segmentCounts.por_vencer, iconClass: 'bi bi-alarm-fill text-warning' },
          { key: 'inactivos', label: 'Sin Plan / Vencidos', count: segmentCounts.inactivos, iconClass: 'bi bi-exclamation-triangle-fill text-danger' },
          { key: 'vip', label: 'Socios VIP', count: segmentCounts.vip, iconClass: 'bi bi-star-fill text-warning' },
          { key: 'nuevos', label: 'Socios Nuevos', count: segmentCounts.nuevos, iconClass: 'bi bi-patch-check-fill text-success' },
        ].map((tab) => {
          const isActive = segmentFilter === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              className={`btn btn-sm d-flex align-items-center gap-2 px-3 py-2 rounded-pill transition-all ${
                isActive ? 'btn-dark fw-bold shadow-sm' : 'btn-light border text-muted'
              }`}
              style={{
                fontSize: '0.84rem',
                border: isActive ? '1.5px solid #111d15' : '1px solid #e2e8f0',
              }}
              onClick={() => setSegmentFilter(tab.key)}
            >
              <i className={tab.iconClass}></i>
              <span>{tab.label}</span>
              <span
                className="badge rounded-pill"
                style={{
                  background: isActive ? '#c4f039' : '#e2e8f0',
                  color: '#111d15',
                  fontWeight: 800,
                  fontSize: '0.72rem',
                }}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* BUSCADOR */}
      <div className="mb-4">
        <input
          type="text"
          className="form-control form-control-lg border shadow-sm"
          placeholder="Buscar por DNI, nombre, apellido, correo o plan..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ borderRadius: '14px', fontSize: '0.94rem' }}
        />
      </div>

      {/* VISTA DESKTOP: TABLA CORPORATIVA CON ENCABEZADOS DE ALTO CONTRASTE Y CERO SCROLL HORIZONTAL */}
      <div className="card border shadow-sm d-none d-md-block" style={{ borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ width: '100%', overflowX: 'hidden' }}>
          <table className="table table-hover align-middle m-0" style={{ width: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: '9%' }} className="py-3 px-3">Código</th>
                <th style={{ width: '23%' }} className="py-3 px-3">Socio</th>
                <th style={{ width: '11%' }} className="py-3 px-3">DNI</th>
                <th style={{ width: '16%' }} className="py-3 px-3">Plan & Tarifa</th>
                <th style={{ width: '17%' }} className="py-3 px-3">Vigencia</th>
                <th style={{ width: '10%' }} className="py-3 px-3 text-center">Estado</th>
                <th style={{ width: '14%' }} className="py-3 px-3 text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="7" className="text-center py-5 text-muted">
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Cargando expediente de socios y membresías...
                  </td>
                </tr>
              )}

              {!loading && filteredMembers.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center py-5 text-muted">
                    No se encontraron socios para el filtro o búsqueda seleccionada.
                  </td>
                </tr>
              )}

              {!loading &&
                filteredMembers.map((socio) => {
                  const diasRest = socio.diasRestantes !== null ? Number(socio.diasRestantes) : null
                  const esActivo = socio.estadoMembresia === 'activo' || (diasRest !== null && diasRest >= 0)
                  return (
                    <tr key={socio.id}>
                      {/* Código */}
                      <td className="px-3 fw-bold text-muted small" style={{ fontFamily: 'monospace' }}>
                        #PF-{String(socio.id).padStart(4, '0')}
                      </td>

                      {/* Socio Avatar + Nombre */}
                      <td className="px-3">
                        <div className="d-flex align-items-center gap-2">
                          <div
                            className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                            style={{
                              width: '36px',
                              height: '36px',
                              background: '#121e17',
                              color: '#c4f039',
                              border: '1.5px solid #c4f039',
                              fontSize: '0.82rem',
                              flexShrink: 0,
                            }}
                          >
                            {socio.nombre?.charAt(0)}{socio.apellido?.charAt(0)}
                          </div>
                          <div className="overflow-hidden" style={{ maxWidth: 'calc(100% - 44px)' }}>
                            <div className="fw-bold text-dark text-truncate">{socio.nombre} {socio.apellido}</div>
                            <div className="text-muted small text-truncate">{socio.email}</div>
                            {socio.linkedStaffId&&<span className="badge text-bg-light border mt-1"><i className="bi bi-link-45deg me-1"/>{socio.linkedStaffRole==='admin'?'Administrador y socio':'Personal y socio'}</span>}
                          </div>
                        </div>
                      </td>

                      {/* DNI */}
                      <td className="px-3 fw-semibold text-truncate">{socio.dni}</td>

                      {/* Plan Actual & Monto */}
                      <td className="px-3">
                        <div className="fw-bold text-dark small text-truncate">{socio.planNombre || 'Sin plan'}</div>
                        <div className="text-muted" style={{ fontSize: '0.74rem' }}>
                          {socio.planPrecio ? `S/. ${Number(socio.planPrecio).toFixed(2)}` : 'S/. 0.00'}
                        </div>
                      </td>

                      {/* Vigencia & Días Restantes */}
                      <td className="px-3">
                        {socio.fechaFin ? (
                          <>
                            <div className="small text-dark fw-semibold text-truncate">
                              Vence: {formatDate(socio.fechaFin)}
                            </div>
                            <div className="mt-1">
                              {diasRest !== null && diasRest >= 0 ? (
                                <span
                                  className={`badge ${diasRest <= 7 ? 'bg-warning text-dark' : 'bg-success text-white'}`}
                                  style={{ fontSize: '0.68rem', padding: '3px 6px' }}
                                >
                                  {diasRest} días rest.
                                </span>
                              ) : (
                                <span
                                  className="badge bg-danger text-white"
                                  style={{ fontSize: '0.68rem', padding: '3px 6px' }}
                                >
                                  Vencido
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <span className="badge bg-light text-secondary border" style={{ fontSize: '0.68rem' }}>
                            Sin plan activo
                          </span>
                        )}
                      </td>

                      {/* Estado / Segmento */}
                      <td className="px-3 text-center">
                        <div className="mb-1"><span className={`badge ${Number(socio.activo) === 1 ? 'bg-success' : 'bg-danger'}`}>
                          {Number(socio.activo) === 1 ? 'Cuenta activa' : 'Cuenta desactivada'}
                        </span></div>
                        <span
                          className="badge rounded-pill fw-bold px-2 py-1"
                          style={{ ...getBadgeStyle(socio.segmentoKey), fontSize: '0.72rem' }}
                        >
                          {socio.segmentoLabel}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="px-3 text-end">
                        <div className="d-flex justify-content-end gap-1 flex-wrap">
                          {accountButton(socio)}
                          <button type="button" className="btn btn-sm btn-outline-dark fw-bold" disabled={socio.rol!=='cliente'&&user?.rol!=='admin'} onClick={() => {
                            resetForm(); setEditingId(socio.id);
                            setForm({dni:socio.dni,nombre:socio.nombre,apellido:socio.apellido,email:socio.email || '',telefono:socio.telefono || '',deviceTicket:''});
                            setShowForm(true);
                          }}><i className="bi bi-pencil-square me-1" />Editar</button>
                          {/* Botón Ver Ficha 360 */}
                          <button
                            className="btn btn-sm btn-outline-dark fw-bold px-2 py-1 d-inline-flex align-items-center gap-1"
                            style={{ borderRadius: '8px', fontSize: '0.76rem' }}
                            type="button"
                            onClick={() => setProfileModalSocioId(socio.id)}
                            title="Ver Ficha Integral 360°"
                          >
                            <i className="bi bi-person-vcard"></i>
                            <span>Ficha</span>
                          </button>

                          {/* Botón Renovar Plan */}
                          <button
                            className="btn btn-sm fw-bold px-2 py-1 d-inline-flex align-items-center gap-1"
                            style={{
                              borderRadius: '8px',
                              fontSize: '0.76rem',
                              background: '#c4f039',
                              color: '#111d15',
                              border: 'none',
                              boxShadow: '0 2px 6px rgba(196, 240, 57, 0.3)',
                            }}
                            type="button"
                            onClick={() => openRenewModal(socio)}
                            title="Renovar Membresía"
                          >
                            <i className="bi bi-arrow-repeat"></i>
                            <span>Renovar</span>
                          </button>

                          {/* Botón Oferta Individual */}
                          <button
                            className="btn btn-sm btn-outline-secondary px-2 py-1"
                            style={{ borderRadius: '8px', fontSize: '0.76rem' }}
                            type="button"
                            onClick={() => {
                              setTargetOfferSocio(socio)
                              setShowOfferModal(true)
                            }}
                            title="Asignar Oferta Especial"
                          >
                            <i className="bi bi-gift text-warning"></i>
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

      {/* VISTA MÓVIL: TARJETAS NATIVAS ERGONÓMICAS (OPTIMIZADAS PARA EL PULGAR Y CERO SCROLL HORIZONTAL) */}
      <div className="d-block d-md-none mb-4">
        {loading && (
          <div className="text-center py-4 text-muted bg-white border rounded-3 p-3">
            <span className="spinner-border spinner-border-sm me-2"></span>
            Cargando expediente de socios...
          </div>
        )}

        {!loading && filteredMembers.length === 0 && (
          <div className="text-center py-4 text-muted bg-white border rounded-3 p-3">
            No se encontraron socios para el filtro o búsqueda seleccionada.
          </div>
        )}

        {!loading && (
          <div className="mobile-card-list">
            {filteredMembers.map((socio) => {
              const diasRest = socio.diasRestantes !== null ? Number(socio.diasRestantes) : null
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
                        </div>
                        <p className="mobile-card-subtitle">
                          <span className="mobile-card-code me-2">#PF-{String(socio.id).padStart(4, '0')}</span>
                          <span>DNI: {socio.dni || 'Sin DNI'}</span>
                        </p>
                        {socio.linkedStaffId&&<span className="badge text-bg-light border mt-1"><i className="bi bi-link-45deg me-1"/>{socio.linkedStaffRole==='admin'?'Administrador y socio':'Personal y socio'}</span>}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1"><span className={`badge ${Number(socio.activo) === 1 ? 'bg-success' : 'bg-danger'}`}>
                        {Number(socio.activo) === 1 ? 'Cuenta activa' : 'Cuenta desactivada'}
                      </span></div>
                      <span
                        className="badge rounded-pill fw-bold px-2 py-1"
                        style={{ ...getBadgeStyle(socio.segmentoKey), fontSize: '0.68rem' }}
                      >
                        {socio.segmentoLabel}
                      </span>
                    </div>
                  </div>

                  {/* Cuerpo de la tarjeta en grid */}
                  <div className="mobile-card-body-grid">
                    <div className="mobile-card-field">
                      <div className="mobile-card-label">Plan Actual</div>
                      <div className="mobile-card-value">
                        {socio.planNombre || <span className="text-muted fst-italic">Sin plan</span>}
                        {socio.planPrecio && (
                          <span className="text-muted small ms-1">· S/. {Number(socio.planPrecio).toFixed(2)}</span>
                        )}
                      </div>
                    </div>

                    <div className="mobile-card-field">
                      <div className="mobile-card-label">Vigencia</div>
                      <div className="mobile-card-value">
                        {socio.fechaFin ? (
                          diasRest !== null && diasRest >= 0 ? (
                            <span className={diasRest <= 7 ? 'text-warning fw-bold' : 'text-success fw-bold'}>
                              <i className="bi bi-hourglass-split me-1"></i>
                              {diasRest}d rest.
                            </span>
                          ) : (
                            <span className="text-danger fw-bold">
                              <i className="bi bi-exclamation-triangle me-1"></i>
                              Vencido
                            </span>
                          )
                        ) : (
                          <span className="text-muted">Sin plan</span>
                        )}
                      </div>
                    </div>

                    <div className="mobile-card-field full-width">
                      <div className="mobile-card-label">Historial Operativo</div>
                      <div className="mobile-card-value" style={{ fontSize: '0.8rem', color: '#475569' }}>
                        <span><i className="bi bi-file-earmark-person me-1"></i>{socio.totalMatriculas || 1} matrícula{socio.totalMatriculas !== 1 ? 's' : ''}</span>
                        <span className="mx-2">·</span>
                        <span><i className="bi bi-calendar-check me-1"></i>{socio.totalAsistencias || 0} asistencias</span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones para el pulgar */}
                  <div className="mobile-card-actions">
                    {accountButton(socio)}
                    <button type="button" className="btn btn-sm btn-outline-dark fw-bold" disabled={socio.rol!=='cliente'&&user?.rol!=='admin'} onClick={() => {
                      resetForm(); setEditingId(socio.id);
                      setForm({dni:socio.dni,nombre:socio.nombre,apellido:socio.apellido,email:socio.email || '',telefono:socio.telefono || '',deviceTicket:''});
                      setShowForm(true);
                    }}><i className="bi bi-pencil-square me-1" />Editar</button>
                    <button
                      className="btn btn-sm btn-outline-dark fw-bold px-2 py-2 flex-grow-1 d-flex align-items-center justify-content-center gap-1"
                      style={{ borderRadius: '10px', fontSize: '0.8rem' }}
                      type="button"
                      onClick={() => setProfileModalSocioId(socio.id)}
                    >
                      <i className="bi bi-person-vcard"></i>
                      <span>Ficha 360°</span>
                    </button>
                    <button
                      className="btn btn-sm btn-outline-secondary px-3 py-2 d-flex align-items-center justify-content-center"
                      style={{ borderRadius: '10px', fontSize: '0.82rem' }}
                      type="button"
                      title="Asignar Oferta Especial"
                      onClick={() => {
                        setTargetOfferSocio(socio)
                        setShowOfferModal(true)
                      }}
                    >
                      <i className="bi bi-gift text-warning me-1"></i>
                      <span>Promo</span>
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
                      <i className="bi bi-arrow-repeat"></i>
                      <span>Renovar</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL: ALTA DE NUEVO SOCIO */}
      <ModalDialog
        isOpen={showForm}
        onClose={() => { if (!formStatus.loading) { setShowForm(false); resetForm() } }}
        title={editingId ? "Editar socio" : "Registrar Nuevo Socio"}
        subtitle={editingId ? "Actualiza sus datos o vincula otro dispositivo." : "Crea su cuenta de socio con DNI y contraseña, y selecciona su membresía."}
        badge={editingId ? "Datos del socio" : "Alta de Socio"}
        size="lg"
      >
        <form onSubmit={handleCreateMember}>
          {formStatus.error && (
            <div className="alert alert-danger py-2 px-3 small mb-3">{formStatus.error}</div>
          )}

          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label fw-bold small text-dark" htmlFor="new-dni">
                DNI *
              </label>
              <div className="input-group">
                <input
                  id="new-dni"
                  className={`form-control ${fieldErrors.dni ? 'is-invalid' : ''}`}
                  style={{
                    borderRadius: '10px 0 0 10px',
                    borderColor: fieldErrors.dni ? '#ef4444' : '#cbd5e1',
                    backgroundColor: fieldErrors.dni ? '#fef2f2' : '#ffffff',
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength="8"
                  placeholder="8 dígitos"
                  value={form.dni}
                  onChange={(e) => updateField('dni', e.target.value)}
                  required
                />
                <button
                  className="btn"
                  type="button"
                  onClick={handleDniLookup}
                  disabled={formStatus.dniLoading}
                  style={{ background: '#c4f039', color: '#111d15', fontWeight: 800, border: 'none', borderRadius: '0 8px 8px 0' }}
                >
                  {formStatus.dniLoading ? 'Buscando...' : 'Consultar'}
                </button>
              </div>
              {fieldErrors.dni && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{fieldErrors.dni}</span>
                </div>
              )}
            </div>

            {!editingId && <>
            <div className="col-12 col-md-6">
              <label className="form-label fw-bold small text-dark" htmlFor="new-plan">
                Plan de Membresía *
              </label>
              <select
                id="new-plan"
                className="form-select"
                style={{ borderRadius: '10px', borderColor: '#cbd5e1' }}
                value={form.planId}
                onChange={(e) => updateField('planId', e.target.value)}
                required
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} — S/. {Number(p.precio).toFixed(2)} ({p.duracionDias} días)
                  </option>
                ))}
              </select>
            </div>

            </>}
            <div className="col-12 col-md-6">
              <label className="form-label fw-bold small text-dark" htmlFor="new-nombre">
                Nombres *
              </label>
              <input
                id="new-nombre"
                className={`form-control ${fieldErrors.nombre ? 'is-invalid' : ''}`}
                style={{
                  borderRadius: '10px',
                  borderColor: fieldErrors.nombre ? '#ef4444' : '#cbd5e1',
                  backgroundColor: fieldErrors.nombre ? '#fef2f2' : '#ffffff',
                }}
                type="text"
                required
                placeholder="Nombres del socio"
                value={form.nombre}
                onChange={(e) => updateField('nombre', e.target.value)}
              />
              {fieldErrors.nombre && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{fieldErrors.nombre}</span>
                </div>
              )}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label fw-bold small text-dark" htmlFor="new-apellido">
                Apellidos *
              </label>
              <input
                id="new-apellido"
                className={`form-control ${fieldErrors.apellido ? 'is-invalid' : ''}`}
                style={{
                  borderRadius: '10px',
                  borderColor: fieldErrors.apellido ? '#ef4444' : '#cbd5e1',
                  backgroundColor: fieldErrors.apellido ? '#fef2f2' : '#ffffff',
                }}
                type="text"
                required
                placeholder="Apellidos del socio"
                value={form.apellido}
                onChange={(e) => updateField('apellido', e.target.value)}
              />
              {fieldErrors.apellido && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{fieldErrors.apellido}</span>
                </div>
              )}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label fw-bold small text-dark" htmlFor="new-email">
                Correo Electrónico *
              </label>
              <input
                id="new-email"
                className={`form-control ${fieldErrors.email ? 'is-invalid' : ''}`}
                style={{
                  borderRadius: '10px',
                  borderColor: fieldErrors.email ? '#ef4444' : '#cbd5e1',
                  backgroundColor: fieldErrors.email ? '#fef2f2' : '#ffffff',
                }}
                type="email"
                required
                placeholder="ejemplo@gmail.com"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
              />
              {fieldErrors.email && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{fieldErrors.email}</span>
                </div>
              )}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label fw-bold small text-dark" htmlFor="new-tel">
                Teléfono / WhatsApp
              </label>
              <input
                id="new-tel"
                className={`form-control ${fieldErrors.telefono ? 'is-invalid' : ''}`}
                style={{
                  borderRadius: '10px',
                  borderColor: fieldErrors.telefono ? '#ef4444' : '#cbd5e1',
                  backgroundColor: fieldErrors.telefono ? '#fef2f2' : '#ffffff',
                }}
                type="tel"
                placeholder="9 dígitos"
                value={form.telefono}
                onChange={(e) => updateField('telefono', e.target.value)}
              />
              {fieldErrors.telefono && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{fieldErrors.telefono}</span>
                </div>
              )}
            </div>

            {!editingId && <>
            <div className="col-12 col-md-6">
              <label className="form-label fw-bold small text-dark" htmlFor="new-fecha-inicio">
                Fecha Inicio *
              </label>
              <input
                id="new-fecha-inicio"
                className={`form-control ${fieldErrors.fechaInicio ? 'is-invalid' : ''}`}
                style={{
                  borderRadius: '10px',
                  borderColor: fieldErrors.fechaInicio ? '#ef4444' : '#cbd5e1',
                  backgroundColor: fieldErrors.fechaInicio ? '#fef2f2' : '#ffffff',
                }}
                type="date"
                required
                value={form.fechaInicio}
                onChange={(e) => updateField('fechaInicio', e.target.value)}
              />
              {fieldErrors.fechaInicio && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{fieldErrors.fechaInicio}</span>
                </div>
              )}
            </div>

            </>}
            {!editingId && <>
            <div className="col-12 col-md-6">
              <label className="form-label fw-bold small text-dark" htmlFor="new-pago">
                Método de Pago *
              </label>
              <select
                id="new-pago"
                className="form-select"
                value={form.metodoPago}
                onChange={(e) => updateField('metodoPago', e.target.value)}
              >
                <option value="efectivo">Efectivo</option>
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
                <option value="tarjeta">Tarjeta de Débito/Crédito</option>
                <option value="transferencia">Transferencia Bancaria</option>
              </select>
            </div>
            </>}
          </div>

          {!editingId && selectedNewPlan && (
            <div className="p-3 mt-4 rounded-3 border bg-light d-flex justify-content-between align-items-center">
              <div>
                <strong className="text-dark">{selectedNewPlan.nombre}</strong>
                <div className="text-muted small">{selectedNewPlan.duracionDias} días de acceso libre</div>
              </div>
              <span className="badge bg-dark text-white fs-6 px-3 py-2">
                S/. {Number(selectedNewPlan.precio).toFixed(2)}
              </span>
            </div>
          )}

          <DeviceEnrollment key={editingId || 'new'} socioId={editingId} token={token} dni={form.dni} ticket={form.deviceTicket}
            disabled={formStatus.loading} onRegistered={ticket => setForm(current => ({...current, deviceTicket:ticket}))} />

          <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
            <button
              type="button"
              className="btn btn-outline-dark px-4 py-2 fw-semibold"
              onClick={() => { setShowForm(false); resetForm() }}
              disabled={formStatus.loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn px-4 py-2 fw-bold shadow-sm"
              disabled={formStatus.loading}
              style={{ background: '#c4f039', color: '#111d15', fontWeight: 800, border: 'none', borderRadius: '10px' }}
            >
              {formStatus.loading ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Registrar Socio'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* MODAL: RENOVACIÓN DIRECTA DE MEMBRESÍA */}
      <ModalDialog
        isOpen={showRenewModal}
        onClose={() => setShowRenewModal(false)}
        title="Renovar Membresía"
        subtitle={`Socio: ${renewForm.socioNombre} ${renewForm.socioApellido}`}
        badge="Renovación de Plan"
        size="md"
      >
        <form onSubmit={handleRenew}>
          <div className="mb-3">
            <label className="form-label fw-bold small text-dark" htmlFor="renew-plan">
              Selecciona el Nuevo Plan *
            </label>
            <select
              id="renew-plan"
              className="form-select"
              value={renewForm.planId}
              onChange={(e) => setRenewForm({ ...renewForm, planId: e.target.value })}
              required
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — S/. {Number(p.precio).toFixed(2)} ({p.duracionDias} días)
                </option>
              ))}
            </select>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-12 col-md-6">
              <label className="form-label fw-bold small text-dark" htmlFor="renew-inicio">
                Fecha de Inicio de Vigencia *
              </label>
              <input
                id="renew-inicio"
                type="date"
                className={`form-control ${renewErrors.fechaInicio ? 'is-invalid' : ''}`}
                style={{
                  borderRadius: '10px',
                  borderColor: renewErrors.fechaInicio ? '#ef4444' : '#cbd5e1',
                  backgroundColor: renewErrors.fechaInicio ? '#fef2f2' : '#ffffff',
                }}
                value={renewForm.fechaInicio}
                onChange={(e) => {
                  setRenewForm({ ...renewForm, fechaInicio: e.target.value })
                  if (renewErrors.fechaInicio) setRenewErrors((prev) => ({ ...prev, fechaInicio: '' }))
                }}
                required
              />
              {renewErrors.fechaInicio && (
                <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                  <i className="bi bi-exclamation-circle-fill"></i>
                  <span>{renewErrors.fechaInicio}</span>
                </div>
              )}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label fw-bold small text-dark" htmlFor="renew-pago">
                Método de Pago *
              </label>
              <select
                id="renew-pago"
                className="form-select"
                style={{ borderRadius: '10px', borderColor: '#cbd5e1' }}
                value={renewForm.metodoPago}
                onChange={(e) => setRenewForm({ ...renewForm, metodoPago: e.target.value })}
              >
                <option value="efectivo">Efectivo</option>
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
                <option value="tarjeta">Tarjeta de Débito/Crédito</option>
                <option value="transferencia">Transferencia Bancaria</option>
              </select>
            </div>
          </div>

          {renewErrors.general && (
            <div className="alert alert-danger py-2 px-3 small my-2 d-flex align-items-center gap-2">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <span>{renewErrors.general}</span>
            </div>
          )}

          {selectedRenewPlan && (
            <div className="p-3 my-3 rounded-3 border bg-light d-flex justify-content-between align-items-center">
              <div>
                <strong className="text-dark">{selectedRenewPlan.nombre}</strong>
                <div className="text-muted small">Extiende {selectedRenewPlan.duracionDias} días adicionales de acceso</div>
              </div>
              <span className="badge bg-dark text-white fs-6 px-3 py-2">
                S/. {Number(selectedRenewPlan.precio).toFixed(2)}
              </span>
            </div>
          )}

          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button
              type="button"
              className="btn btn-outline-dark px-3 py-2 fw-semibold"
              onClick={() => setShowRenewModal(false)}
              disabled={renewLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn px-4 py-2 fw-bold"
              disabled={renewLoading}
              style={{
                background: '#c4f039',
                color: '#111d15',
                fontWeight: 800,
                border: 'none',
                borderRadius: '10px',
                boxShadow: '0 4px 12px rgba(196, 240, 57, 0.4)',
              }}
            >
              {renewLoading ? 'Procesando...' : 'Confirmar Renovación'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* MODAL 3: FICHA INTEGRAL 360 DEL SOCIO */}
      <MemberProfileModal
        isOpen={Boolean(profileModalSocioId)}
        onClose={() => setProfileModalSocioId(null)}
        socioId={profileModalSocioId}
        token={token}
        onOpenRenew={(socio) => {
          setProfileModalSocioId(null)
          openRenewModal(socio)
        }}
        onOpenOffer={(socio) => {
          setTargetOfferSocio(socio)
          setShowOfferModal(true)
        }}
      />

      {/* MODAL 4: OFERTAS (PERSONALIZADAS O GENERALES) */}
      <OfferModal
        isOpen={showOfferModal}
        onClose={() => {
          setShowOfferModal(false)
          setTargetOfferSocio(null)
        }}
        targetSocio={targetOfferSocio}
        token={token}
        onSuccess={() => {
          loadData()
          setMessage(targetOfferSocio ? `Oferta personalizada asignada a ${targetOfferSocio.nombre} ${targetOfferSocio.apellido}` : 'Promoción general publicada con éxito')
        }}
      />
    </>
  )
}

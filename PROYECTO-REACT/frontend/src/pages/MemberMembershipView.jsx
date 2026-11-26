import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ModalDialog from '../components/ModalDialog'
import { MembershipService } from '../services/MembershipService'
import { ConfigService } from '../services/ConfigService'
import { formatDate, formatDateTimePeru } from '../utils/formatters'

const PLAN_BENEFITS = [
  {
    icon: 'bi-lightning-charge-fill',
    titulo: 'Acceso Total a Instalaciones',
    desc: 'Áreas de pesas libres, máquinas guiadas y cardio sin límite de tiempo.',
  },
  {
    icon: 'bi-fingerprint',
    titulo: 'Check-In Biométrico',
    desc: 'Ingreso rápido y sin colas con huella digital o DNI en recepción.',
  },
  {
    icon: 'bi-stars',
    titulo: 'Programa Mi Pandita',
    desc: 'Suma XP y bambús canjeables en cada visita diaria y mantén tu racha.',
  },
  {
    icon: 'bi-shield-lock-fill',
    titulo: 'Vestuarios y Lockers',
    desc: 'Duchas con agua caliente y casilleros de seguridad durante tu turno.',
  },
  {
    icon: 'bi-ticket-perforated-fill',
    titulo: 'Invitados y Pases Amigo',
    desc: 'Acceso a promociones y códigos para invitar amigos en recepción.',
  },
  {
    icon: 'bi-shop',
    titulo: 'Convenios Comerciales',
    desc: 'Descuentos exclusivos en tiendas aliadas de nutrición, salud y suplementos.',
  },
]

function formatPromoBadge(offer) {
  const val = Number(offer?.valor || 0)
  if (offer?.tipo === 'descuento_porcentaje') return `${val}% OFF`
  if (offer?.tipo === 'descuento_fijo') return `S/. ${val.toFixed(2)} OFF`
  if (offer?.tipo === 'dias_gratis') return `+${Math.round(val)} días gratis`
  if (offer?.tipo === 'pase_amigo') return 'Pase Libre Amigo'
  return 'Beneficio'
}

function buildWhatsappUrl(config, memberInfo, planNombre = '') {
  const rawPhone = String(config?.landing_redes_whatsapp || config?.landing_gym_telefono || '51987654321').replace(/\D/g, '')
  const phone = rawPhone.startsWith('51') ? rawPhone : `51${rawPhone}`
  const name = `${memberInfo?.nombre || ''} ${memberInfo?.apellido || ''}`.trim()
  const text = planNombre
    ? `Hola ${config?.empresa_nombre || 'Panda Fitness'}, soy ${name} (DNI ${memberInfo?.dni || ''}) y deseo consultar/renovar mi membresía al plan ${planNombre}.`
    : `Hola ${config?.empresa_nombre || 'Panda Fitness'}, soy ${name} (DNI ${memberInfo?.dni || ''}) y deseo consultar sobre la renovación de mi membresía.`
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}

function formatReceptionSchedule(config) {
  if (!config) {
    return {
      weekdays: 'Lunes a Viernes: 06:30 - 11:00 / 16:00 - 22:00',
      saturday: 'Sábados: 07:00 - 12:00',
      sunday: 'Domingos: Cerrado',
    }
  }
  const weekdays =
    config.horario_semana_modalidad === 'continuo'
      ? `Lunes a Viernes: ${config.horario_semana_corrido_inicio || '06:30'} - ${config.horario_semana_corrido_fin || '22:00'}`
      : `Lunes a Viernes: ${config.horario_semana_manana_inicio || '06:30'} - ${config.horario_semana_manana_fin || '11:00'} y ${config.horario_semana_tarde_inicio || '16:00'} - ${config.horario_semana_tarde_fin || '22:00'}`

  const saturday =
    config.horario_sabado_estado === '0'
      ? 'Sábados: Cerrado'
      : config.horario_sabado_modalidad === 'partido'
        ? `Sábados: ${config.horario_sabado_inicio || '07:00'} - ${config.horario_sabado_fin || '12:00'} / ${config.horario_sabado_tarde_inicio || '16:00'} - ${config.horario_sabado_tarde_fin || '20:00'}`
        : `Sábados: ${config.horario_sabado_inicio || '07:00'} - ${config.horario_sabado_fin || '12:00'}`

  const sunday =
    config.horario_domingo_abierto === '1'
      ? config.horario_domingo_modalidad === 'partido'
        ? `Domingos: ${config.horario_domingo_inicio || '08:00'} - ${config.horario_domingo_fin || '13:00'} / ${config.horario_domingo_tarde_inicio || '16:00'} - ${config.horario_domingo_tarde_fin || '20:00'}`
        : `Domingos: ${config.horario_domingo_inicio || '08:00'} - ${config.horario_domingo_fin || '13:00'}`
      : 'Domingos: Cerrado'

  return { weekdays, saturday, sunday }
}

export default function MemberMembershipView({ token, user }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState({
    memberInfo: null,
    membership: null,
    history: [],
    offers: [],
    requests: [],
    planes: [],
  })
  const [config, setConfig] = useState(null)
  const [copiedCode, setCopiedCode] = useState('')
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' })

  // Modal de solicitud de renovación
  const [showRenewModal, setShowRenewModal] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [metodoPago, setMetodoPago] = useState('')
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponMessage, setCouponMessage] = useState({ type: '', text: '' })
  const [validatingCoupon, setValidatingCoupon] = useState(false)
  const [numeroOperacion, setNumeroOperacion] = useState('')
  const [comprobanteUrl, setComprobanteUrl] = useState('')
  const [comprobanteName, setComprobanteName] = useState('')
  const [renewPhone, setRenewPhone] = useState('')
  const [comentarioSocio, setComentarioSocio] = useState('')
  const [submittingRenew, setSubmittingRenew] = useState(false)
  const [renewError, setRenewError] = useState('')
  const [renewFieldErrors, setRenewFieldErrors] = useState({ planId: '', method: '', phone: '', proof: '' })
  const [cancelingId, setCancelingId] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(null)
  const receiptInputRef = useRef(null)
  const renewAlertRef = useRef(null)
  const planSectionRef = useRef(null)
  const methodSelectRef = useRef(null)
  const phoneInputRef = useRef(null)
  const proofSectionRef = useRef(null)

  const loadSummary = useCallback(async (background = false) => {
    if (!background) setLoading(true)
    setError('')
    try {
      const [sumData, cfgData] = await Promise.all([
        MembershipService.getMySummary(token),
        ConfigService.getConfig().catch(() => null),
      ])
      setSummary({
        memberInfo: sumData.memberInfo || null,
        membership: sumData.membership || null,
        history: sumData.history || [],
        offers: sumData.offers || [],
        requests: sumData.requests || [],
        planes: sumData.planes || [],
      })
      if (cfgData) setConfig(cfgData)
    } catch (err) {
      if (!background) {
        setError(err.message || 'No se pudo consultar tu membresía.')
      }
    } finally {
      if (!background) setLoading(false)
    }
  }, [token])

  useEffect(() => {
    let active = true
    Promise.all([
      MembershipService.getMySummary(token),
      ConfigService.getConfig().catch(() => null),
    ])
      .then(([sumData, cfgData]) => {
        if (!active) return
        setSummary({
          memberInfo: sumData.memberInfo || null,
          membership: sumData.membership || null,
          history: sumData.history || [],
          offers: sumData.offers || [],
          requests: sumData.requests || [],
          planes: sumData.planes || [],
        })
        if (cfgData) setConfig(cfgData)
        setError('')
      })
      .catch((err) => {
        if (!active) return
        setError(err.message || 'No se pudo consultar tu membresía.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    const onFocus = () => {
      if (document.visibilityState === 'visible') loadSummary(true)
    }
    window.addEventListener('focus', onFocus)
    return () => {
      active = false
      window.removeEventListener('focus', onFocus)
    }
  }, [token, loadSummary])

  useEffect(() => {
    if (!statusMessage.text) return undefined
    const timer = setTimeout(() => {
      setStatusMessage({ type: '', text: '' })
    }, 10000)
    return () => clearTimeout(timer)
  }, [statusMessage.text])

  const { memberInfo, membership, history, offers, requests, planes } = summary

  const discountOffers = useMemo(
    () => offers.filter((o) => o.categoriaUso !== 'pase_amigo'),
    [offers],
  )
  const friendPassOffers = useMemo(
    () => offers.filter((o) => o.categoriaUso === 'pase_amigo'),
    [offers],
  )

  const latestRequest = requests[0] || null
  const pendingRequest = requests.find((r) => r.estado === 'pendiente') || null

  const selectedPlan = useMemo(
    () => planes.find((p) => String(p.id) === String(selectedPlanId)) || null,
    [planes, selectedPlanId],
  )

  const calculatedBreakdown = useMemo(() => {
    const base = Number(selectedPlan?.precio || 0)
    if (!appliedCoupon?.oferta) {
      return { montoBase: base, descuentoAplicado: 0, diasExtra: 0, montoFinal: base }
    }
    const offer = appliedCoupon.oferta
    const val = Number(offer.valor || 0)
    let descuento = 0
    let diasExtra = 0
    if (offer.tipo === 'descuento_porcentaje') {
      descuento = Math.min(base, Math.round(base * (Math.min(100, val) / 100) * 100) / 100)
    } else if (offer.tipo === 'descuento_fijo') {
      descuento = Math.min(base, Math.round(val * 100) / 100)
    } else if (offer.tipo === 'dias_gratis') {
      diasExtra = Math.max(0, Math.round(val))
    }
    return {
      montoBase: base,
      descuentoAplicado: descuento,
      diasExtra,
      montoFinal: Math.max(0, Math.round((base - descuento) * 100) / 100),
    }
  }, [selectedPlan, appliedCoupon])

  function openRenewModal(prefillCode = '') {
    setSelectedPlanId('')
    setMetodoPago('')
    setCouponInput(prefillCode || '')
    setAppliedCoupon(null)
    setCouponMessage({ type: '', text: '' })
    setNumeroOperacion('')
    setComprobanteUrl('')
    setComprobanteName('')
    setRenewPhone('')
    setComentarioSocio('')
    setRenewError('')
    setRenewFieldErrors({ planId: '', method: '', phone: '', proof: '' })
    if (receiptInputRef.current) receiptInputRef.current.value = ''
    setShowRenewModal(true)

    if (prefillCode) {
      handleValidateCoupon(prefillCode, null)
    }
  }

  async function handleValidateCoupon(codeOverride = null, planIdOverride = null) {
    const code = String(codeOverride ?? couponInput).trim().toUpperCase()
    const planId = planIdOverride ?? selectedPlanId
    if (!code) {
      setAppliedCoupon(null)
      setCouponMessage({ type: 'error', text: 'Ingresa un código promocional primero.' })
      return
    }
    setValidatingCoupon(true)
    setCouponMessage({ type: '', text: '' })
    try {
      const res = await MembershipService.validateCoupon(token, { codigoCupon: code, planId })
      setAppliedCoupon(res)
      setCouponInput(res.oferta.codigoCupon)
      setCouponMessage({
        type: 'success',
        text: `Cupón "${res.oferta.titulo}" aplicado (${formatPromoBadge(res.oferta)}).`,
      })
    } catch (err) {
      setAppliedCoupon(null)
      setCouponMessage({ type: 'error', text: err.message || 'Código no válido.' })
    } finally {
      setValidatingCoupon(false)
    }
  }

  function scrollToElement(el, focusEl = null) {
    requestAnimationFrame(() => {
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      focusEl?.focus?.({ preventScroll: true })
    })
  }

  function handleReceiptFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setRenewFieldErrors((prev) => ({ ...prev, proof: 'Selecciona una imagen válida (JPG, PNG o WebP).' }))
      setRenewError('Selecciona una imagen válida (JPG, PNG o WebP).')
      scrollToElement(proofSectionRef.current, receiptInputRef.current)
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setRenewFieldErrors((prev) => ({ ...prev, proof: 'La imagen del comprobante no debe superar 5 MB.' }))
      setRenewError('La imagen del comprobante no debe superar 5 MB.')
      scrollToElement(proofSectionRef.current, receiptInputRef.current)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setComprobanteUrl(String(reader.result || ''))
      setComprobanteName(file.name)
      setRenewFieldErrors((prev) => ({ ...prev, proof: '' }))
      setRenewError('')
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmitRenewal(e) {
    e.preventDefault()
    setRenewError('')

    const fieldErrs = { planId: '', method: '', phone: '', proof: '' }
    let firstTarget = null
    let firstFocus = null

    if (!selectedPlanId) {
      fieldErrs.planId = 'Selecciona el plan que deseas renovar.'
      firstTarget = firstTarget || planSectionRef.current
    }

    if (!metodoPago) {
      fieldErrs.method = 'Selecciona el método de pago.'
      if (!firstTarget) {
        firstTarget = methodSelectRef.current
        firstFocus = methodSelectRef.current
      }
    }

    const cleanPhone = String(renewPhone || '').replace(/\D/g, '')
    if (cleanPhone && !/^9\d{8}$/.test(cleanPhone)) {
      fieldErrs.phone = 'Ingresa 9 dígitos empezando con 9.'
      if (!firstTarget) {
        firstTarget = phoneInputRef.current
        firstFocus = phoneInputRef.current
      }
    }

    if (['yape', 'plin', 'transferencia'].includes(metodoPago) && !comprobanteUrl && !numeroOperacion.trim()) {
      fieldErrs.proof = 'Adjunta el pantallazo de tu pago o ingresa el N° de operación.'
      if (!firstTarget) {
        firstTarget = proofSectionRef.current
        firstFocus = receiptInputRef.current
      }
    }

    if (fieldErrs.planId || fieldErrs.method || fieldErrs.phone || fieldErrs.proof) {
      setRenewFieldErrors(fieldErrs)
      setRenewError(fieldErrs.planId || fieldErrs.method || fieldErrs.phone || fieldErrs.proof)
      scrollToElement(firstTarget, firstFocus)
      return
    }

    setRenewFieldErrors({ planId: '', method: '', phone: '', proof: '' })
    setSubmittingRenew(true)
    try {
      const res = await MembershipService.requestRenewal(token, {
        planId: Number(selectedPlanId),
        metodoPago,
        telefonoContacto: cleanPhone || null,
        codigoCupon: appliedCoupon?.oferta?.codigoCupon || null,
        numeroOperacion: numeroOperacion.trim() || null,
        comprobanteUrl: comprobanteUrl || null,
        comentarioSocio: comentarioSocio.trim() || null,
      })
      setStatusMessage({ type: 'success', text: res.message })
      setShowRenewModal(false)
      window.dispatchEvent(new Event('panda_notifications_updated'))
      await loadSummary(true)
    } catch (err) {
      const msg = err.message || 'No se pudo enviar la solicitud.'
      setRenewError(msg)
      const lower = msg.toLowerCase()
      if (lower.includes('plan')) {
        setRenewFieldErrors((prev) => ({ ...prev, planId: msg }))
        scrollToElement(planSectionRef.current)
      } else if (lower.includes('método') || lower.includes('metodo')) {
        setRenewFieldErrors((prev) => ({ ...prev, method: msg }))
        scrollToElement(methodSelectRef.current, methodSelectRef.current)
      } else if (lower.includes('pantallazo') || lower.includes('comprobante') || lower.includes('operación')) {
        setRenewFieldErrors((prev) => ({ ...prev, proof: msg }))
        scrollToElement(proofSectionRef.current, receiptInputRef.current)
      } else if (lower.includes('teléfono') || lower.includes('telefono')) {
        setRenewFieldErrors((prev) => ({ ...prev, phone: msg }))
        scrollToElement(phoneInputRef.current, phoneInputRef.current)
      } else {
        scrollToElement(renewAlertRef.current)
      }
    } finally {
      setSubmittingRenew(false)
    }
  }

  async function handleCancelRequest(id) {
    setCancelingId(id)
    setStatusMessage({ type: '', text: '' })
    try {
      const res = await MembershipService.cancelRenewalRequest(token, id)
      setStatusMessage({ type: 'info', text: res.message })
      await loadSummary(true)
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message })
    } finally {
      setCancelingId(null)
    }
  }

  function handleCopyCode(code) {
    if (!code) return
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(''), 2000)
  }

  if (loading) {
    return (
      <div className="card p-4 rounded-4 border-0 shadow-sm" role="status">
        <span className="spinner-border spinner-border-sm me-2" />
        Consultando tu membresía, historial y promociones…
      </div>
    )
  }

  if (error) {
    return (
      <div className="alert alert-danger d-flex flex-wrap align-items-center justify-content-between gap-2" role="alert">
        <span>{error}</span>
        <button className="btn btn-sm btn-outline-dark" onClick={() => loadSummary()}>
          Volver a consultar
        </button>
      </div>
    )
  }

  const scheduleInfo = formatReceptionSchedule(config)
  const isStaffViewingMember = Boolean(user?.rol !== 'cliente' && user?.memberLink)
  const diasRestantes = membership ? Number(membership.diasRestantes) : -1
  const isMembershipActive = Boolean(membership && membership.estado === 'activo' && diasRestantes >= 0)
  const isExpiringSoon = Boolean(isMembershipActive && diasRestantes <= 7)

  const estadoBadge = !membership
    ? { text: 'SIN PLAN ACTIVO', bg: '#f1f5f9', color: '#475569' }
    : isExpiringSoon
      ? { text: 'POR VENCER', bg: '#fef3c7', color: '#b45309' }
      : isMembershipActive
        ? { text: 'MEMBRESÍA ACTIVA', bg: '#c4f039', color: '#111d15' }
        : { text: 'MEMBRESÍA VENCIDA', bg: '#fee2e2', color: '#991b1b' }

  const needsDigitalProof = ['yape', 'plin', 'transferencia'].includes(metodoPago)

  return (
    <div className="dashboard-page" style={{ width: '100%', maxWidth: '100%', margin: 0, paddingBottom: '12px' }}>
      {statusMessage.text && (
        <div
          className={`alert ${
            statusMessage.type === 'error'
              ? 'alert-danger'
              : statusMessage.type === 'info'
                ? 'alert-warning'
                : 'alert-success'
          } d-flex align-items-center justify-content-between gap-2 rounded-3 mb-4`}
        >
          <span>{statusMessage.text}</span>
          <button type="button" className="btn-close btn-sm" onClick={() => setStatusMessage({ type: '', text: '' })} />
        </div>
      )}

      {/* BANNER DE ESTADO DE SOLICITUD DE RENOVACIÓN */}
      {latestRequest && (latestRequest.estado === 'pendiente' || latestRequest.estado === 'rechazada' || latestRequest.estado === 'aprobada') && (
        <div
          className="p-3 p-md-4 rounded-4 border mb-4 d-flex flex-wrap justify-content-between align-items-center gap-3"
          style={{
            background:
              latestRequest.estado === 'pendiente'
                ? '#fffbeb'
                : latestRequest.estado === 'aprobada'
                  ? '#f0fdf4'
                  : '#fef2f2',
            borderColor:
              latestRequest.estado === 'pendiente'
                ? '#fde68a'
                : latestRequest.estado === 'aprobada'
                  ? '#bbf7d0'
                  : '#fecaca',
          }}
        >
          <div className="d-flex align-items-start gap-3">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: '44px',
                height: '44px',
                background:
                  latestRequest.estado === 'pendiente'
                    ? '#fef3c7'
                    : latestRequest.estado === 'aprobada'
                      ? '#dcfce7'
                      : '#fee2e2',
                color:
                  latestRequest.estado === 'pendiente'
                    ? '#b45309'
                    : latestRequest.estado === 'aprobada'
                      ? '#15803d'
                      : '#b91c1c',
                fontSize: '1.25rem',
              }}
            >
              <i
                className={`bi ${
                  latestRequest.estado === 'pendiente'
                    ? 'bi-hourglass-split'
                    : latestRequest.estado === 'aprobada'
                      ? 'bi-check-circle-fill'
                      : 'bi-exclamation-triangle-fill'
                }`}
              />
            </div>
            <div>
              <div className="d-flex flex-wrap align-items-center gap-2">
                <strong style={{ color: '#111d15', fontSize: '0.96rem' }}>
                  {latestRequest.estado === 'pendiente'
                    ? 'Solicitud de renovación enviada · Pendiente de validación'
                    : latestRequest.estado === 'aprobada'
                      ? 'Pago aceptado · Renovación aprobada'
                      : 'Solicitud de renovación rechazada'}
                </strong>
                <span className="badge bg-dark text-white" style={{ fontSize: '0.72rem' }}>
                  Plan {latestRequest.planNombre} · S/. {Number(latestRequest.montoFinal).toFixed(2)}
                </span>
                <span className="badge bg-light text-dark border text-uppercase" style={{ fontSize: '0.7rem' }}>
                  {latestRequest.metodoPago}
                </span>
              </div>
              <div className="text-muted small mt-1">
                Enviada el {formatDateTimePeru(latestRequest.creadoEn)}
                {latestRequest.codigoCupon ? ` · Cupón: ${latestRequest.codigoCupon}` : ''}
                {latestRequest.numeroOperacion ? ` · Op: ${latestRequest.numeroOperacion}` : ''}
              </div>
              {latestRequest.estado === 'rechazada' && latestRequest.motivoRechazo && (
                <div className="mt-2 small fw-semibold" style={{ color: '#b91c1c' }}>
                  Motivo: {latestRequest.motivoRechazo}
                </div>
              )}
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            {latestRequest.comprobanteUrl && (
              <button
                type="button"
                className="btn btn-sm btn-outline-dark fw-semibold"
                onClick={() => setReceiptPreview(latestRequest.comprobanteUrl)}
              >
                <i className="bi bi-image me-1" /> Ver comprobante
              </button>
            )}
            {latestRequest.estado === 'pendiente' && (
              <button
                type="button"
                className="btn btn-sm btn-outline-danger fw-semibold"
                disabled={cancelingId === latestRequest.id}
                onClick={() => handleCancelRequest(latestRequest.id)}
              >
                {cancelingId === latestRequest.id ? 'Cancelando...' : 'Cancelar solicitud'}
              </button>
            )}
            {latestRequest.estado === 'rechazada' && (
              <button
                type="button"
                className="btn btn-sm fw-bold"
                style={{ background: '#c4f039', color: '#111d15' }}
                onClick={() => openRenewModal()}
              >
                Enviar nueva solicitud
              </button>
            )}
          </div>
        </div>
      )}

      <div className="row g-3 g-md-4 align-items-stretch">
        {/* FILA 1 IZQUIERDA: CREDENCIAL + HISTORIAL */}
        <div className="col-12 col-xl-8 d-flex flex-column gap-3 gap-md-4" style={{ minWidth: 0 }}>
          {/* 1. FECHA DE REGISTRO + CREDENCIAL DEL PLAN ACTUAL */}
          <div
            className="p-3 p-sm-4"
            style={{
              background: 'linear-gradient(135deg, #111d15 0%, #16241c 100%)',
              borderRadius: '20px',
              color: '#ffffff',
              border: '1px solid #233c2a',
              boxShadow: '0 12px 32px rgba(17, 29, 21, 0.28)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                right: '-18px',
                bottom: '-18px',
                fontSize: '8rem',
                opacity: 0.04,
                userSelect: 'none',
              }}
            >
              <i className="bi bi-shield-check" aria-hidden="true" />
            </div>

            {/* Primero: Fecha de registro del socio en el club */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                paddingBottom: '16px',
                marginBottom: '20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    background: 'rgba(196, 240, 57, 0.14)',
                    color: '#c4f039',
                    padding: '6px 12px',
                    borderRadius: '10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                  }}
                >
                  <i className="bi bi-calendar-check me-2" />
                  Socio registrado desde: {formatDate(memberInfo?.fechaRegistro)}
                </span>
                {memberInfo?.antiguedadDias !== undefined && (
                  <span style={{ fontSize: '0.78rem', color: '#9fb3a5' }}>
                    ({Math.max(0, Number(memberInfo.antiguedadDias) || 0)} días en el club)
                  </span>
                )}
              </div>

              <span style={{ fontSize: '0.76rem', color: '#8fa295', fontFamily: 'monospace' }}>
                Código #PF-{String(memberInfo?.id || user?.id || 0).padStart(4, '0')}
                {!isStaffViewingMember && memberInfo?.dni ? ` · DNI ${memberInfo.dni}` : ''}
              </span>
            </div>

            {/* Segundo: Plan actual */}
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
              <div>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    color: '#84cc16',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    display: 'block',
                    marginBottom: '6px',
                  }}
                >
                  PLAN ACTUAL
                </span>
                <h2 style={{ fontSize: '1.85rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                  {membership ? membership.planNombre : 'Sin membresía asignada'}
                </h2>
              </div>

              <span
                style={{
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  background: estadoBadge.bg,
                  color: estadoBadge.color,
                  padding: '6px 16px',
                  borderRadius: '9999px',
                  letterSpacing: '0.04em',
                }}
              >
                {estadoBadge.text}
              </span>
            </div>

            {membership ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '18px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '18px 20px',
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#8fa295', display: 'block', marginBottom: '4px' }}>
                    FECHA INICIO DEL PLAN
                  </span>
                  <strong style={{ fontSize: '1rem', color: '#ffffff' }}>
                    {formatDate(membership.fechaInicio)}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', color: '#8fa295', display: 'block', marginBottom: '4px' }}>
                    FECHA VENCIMIENTO
                  </span>
                  <strong style={{ fontSize: '1rem', color: '#c4f039' }}>
                    {formatDate(membership.fechaFin)}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', color: '#8fa295', display: 'block', marginBottom: '4px' }}>
                    DÍAS RESTANTES
                  </span>
                  <strong style={{ fontSize: '1rem', color: diasRestantes < 0 ? '#fca5a5' : '#ffffff' }}>
                    {diasRestantes >= 0 ? `${diasRestantes} días` : `Venció hace ${Math.abs(diasRestantes)} d.`}
                  </strong>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  padding: '16px 20px',
                  borderRadius: '14px',
                  fontSize: '0.88rem',
                  color: '#cbd5e1',
                }}
              >
                Aún no cuentas con una membresía vigente. Puedes elegir un plan y enviar tu solicitud de activación con el botón <strong>Renovar Membresía</strong>.
              </div>
            )}
          </div>

          {/* 2. HISTORIAL CRONOLÓGICO DE PLANES */}
          <div
            className="flex-grow-1 p-3 p-sm-4"
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              border: '1px solid #e3e8e2',
              boxShadow: '0 4px 18px rgba(18, 31, 23, 0.04)',
              minWidth: 0,
            }}
          >
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#111d15', margin: 0 }}>
                  Historial de Planes
                </h3>
                <p className="text-muted small mb-0">
                  Detalle cronológico desde tu primera matrícula hasta tu plan vigente.
                </p>
              </div>
              <span className="badge bg-light text-dark border px-3 py-2 flex-shrink-0">
                {history.length} {history.length === 1 ? 'plan registrado' : 'planes registrados'}
              </span>
            </div>

            {history.length === 0 ? (
              <div className="p-3 rounded-3 bg-light text-muted small text-center">
                No tienes planes registrados todavía.
              </div>
            ) : (
              <>
                <div className="table-responsive d-none d-md-block">
                  <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.86rem' }}>
                    <thead className="table-light">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Plan</th>
                        <th className="py-2 px-3">Inicio → Vencimiento</th>
                        <th className="py-2 px-3">Pago</th>
                        <th className="py-2 px-3 text-end">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((item) => {
                        const badge =
                          item.estadoVisual === 'activo'
                            ? { text: 'Vigente', bg: '#dcfce7', color: '#166534' }
                            : item.estadoVisual === 'renovado'
                              ? { text: 'Renovado', bg: '#e0f2fe', color: '#0369a1' }
                              : { text: 'Finalizado', bg: '#f1f5f9', color: '#475569' }
                        return (
                          <tr key={item.id}>
                            <td className="px-3 fw-bold text-muted">Plan {item.numeroPlan}</td>
                            <td className="px-3">
                              <div className="fw-bold text-dark">{item.planNombre}</div>
                              <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                {item.duracionDias} días{item.diasExtra ? ` + ${item.diasExtra} d. gratis` : ''}
                              </div>
                            </td>
                            <td className="px-3 text-nowrap">
                              <span className="fw-semibold text-dark">{formatDate(item.fechaInicio)}</span>
                              <span className="text-muted mx-2">→</span>
                              <span className="fw-semibold text-success">{formatDate(item.fechaFin)}</span>
                            </td>
                            <td className="px-3">
                              <div className="fw-bold text-dark">
                                S/. {Number(item.montoPagado ?? item.planPrecio ?? 0).toFixed(2)}
                              </div>
                              <div className="text-muted text-capitalize" style={{ fontSize: '0.74rem' }}>
                                {item.metodoPago || 'Efectivo'}
                                {item.codigoCupon ? ` · Cupón ${item.codigoCupon}` : ''}
                              </div>
                            </td>
                            <td className="px-3 text-end">
                              <span
                                className="badge rounded-pill px-2 py-1"
                                style={{ background: badge.bg, color: badge.color, fontSize: '0.72rem' }}
                              >
                                {badge.text}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Vista Mobile sin desborde horizontal */}
                <div className="d-flex d-md-none flex-column gap-2">
                  {history.map((item) => {
                    const badge =
                      item.estadoVisual === 'activo'
                        ? { text: 'Vigente', bg: '#dcfce7', color: '#166534' }
                        : item.estadoVisual === 'renovado'
                          ? { text: 'Renovado', bg: '#e0f2fe', color: '#0369a1' }
                          : { text: 'Finalizado', bg: '#f1f5f9', color: '#475569' }
                    return (
                      <div
                        key={`mobile-hist-${item.id}`}
                        className="p-3 rounded-3 border bg-light"
                      >
                        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                          <div>
                            <div className="fw-bold text-dark" style={{ fontSize: '0.92rem' }}>
                              Plan {item.numeroPlan} · {item.planNombre}
                            </div>
                            <div className="text-muted" style={{ fontSize: '0.74rem' }}>
                              {item.duracionDias} días{item.diasExtra ? ` + ${item.diasExtra} d. gratis` : ''}
                            </div>
                          </div>
                          <span
                            className="badge rounded-pill px-2 py-1 flex-shrink-0"
                            style={{ background: badge.bg, color: badge.color, fontSize: '0.7rem' }}
                          >
                            {badge.text}
                          </span>
                        </div>
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-2 border-top small">
                          <div>
                            <span className="text-muted d-block" style={{ fontSize: '0.68rem' }}>Vigencia</span>
                            <strong className="text-dark">{formatDate(item.fechaInicio)}</strong>
                            <span className="text-muted mx-1">→</span>
                            <strong className="text-success">{formatDate(item.fechaFin)}</strong>
                          </div>
                          <div className="text-end">
                            <div className="fw-bold text-dark">
                              S/. {Number(item.montoPagado ?? item.planPrecio ?? 0).toFixed(2)}
                            </div>
                            <div className="text-muted text-capitalize" style={{ fontSize: '0.7rem' }}>
                              {item.metodoPago || 'Efectivo'}
                              {item.codigoCupon ? ` · ${item.codigoCupon}` : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* FILA 1 DERECHA: RENOVACIÓN + SOPORTE EN RECEPCIÓN */}
        <div className="col-12 col-xl-4 d-flex flex-column gap-3 gap-md-4" style={{ minWidth: 0 }}>
          <div
            className="p-3 p-sm-4"
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              border: '1px solid #e3e8e2',
              boxShadow: '0 4px 18px rgba(18, 31, 23, 0.04)',
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#111d15', margin: '0 0 10px 0' }}>
              {isExpiringSoon ? '¿Próximo a Vencer?' : isMembershipActive ? '¿Renovar o Cambiar de Plan?' : 'Activa tu Membresía'}
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#5f7165', lineHeight: 1.5, marginBottom: '16px' }}>
              Elige tu nuevo plan, aplica tu código promocional si tienes uno y sube el pantallazo de tu Yape/Plin para que recepción lo valide rápido, o coordina directo por WhatsApp.
            </p>
            <div className="d-flex flex-column gap-2">
              <button
                type="button"
                disabled={Boolean(pendingRequest)}
                onClick={() => openRenewModal()}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: pendingRequest ? '#e2e8f0' : '#c4f039',
                  color: pendingRequest ? '#64748b' : '#111d15',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: pendingRequest ? 'not-allowed' : 'pointer',
                  boxShadow: pendingRequest ? 'none' : '0 4px 12px rgba(196, 240, 57, 0.3)',
                }}
              >
                <i className="bi bi-credit-card me-2" />
                {pendingRequest ? 'Solicitud pendiente' : 'Solicitar Renovación / Subir Pago'}
              </button>

              <a
                href={buildWhatsappUrl(config, memberInfo, membership?.planNombre)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline-success fw-bold d-flex align-items-center justify-content-center gap-2 py-2"
                style={{ borderRadius: '12px', fontSize: '0.84rem' }}
              >
                <i className="bi bi-whatsapp" />
                <span>Coordinar por WhatsApp</span>
              </a>
            </div>
          </div>

          <div
            className="flex-grow-1 p-3 p-sm-4"
            style={{
              background: '#f8fafc',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#111d15', margin: 0 }}>
                Soporte en Recepción
              </h4>
              <span
                className="badge"
                style={{
                  fontSize: '0.68rem',
                  background:
                    config?.estado_operativo === 'cerrado_emergencia'
                      ? '#fee2e2'
                      : config?.estado_operativo === 'horario_especial'
                        ? '#fef3c7'
                        : '#dcfce7',
                  color:
                    config?.estado_operativo === 'cerrado_emergencia'
                      ? '#b91c1c'
                      : config?.estado_operativo === 'horario_especial'
                        ? '#b45309'
                        : '#166534',
                }}
              >
                {config?.estado_operativo === 'cerrado_emergencia'
                  ? 'Cerrado Temporal'
                  : config?.estado_operativo === 'horario_especial'
                    ? 'Horario Especial'
                    : 'Atención Normal'}
              </span>
            </div>

            {config?.aviso_activo === '1' && config?.aviso_mensaje && (
              <div className="p-2 px-3 rounded-3 mb-3 small" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                <strong>{config.aviso_titulo || 'Aviso'}:</strong> {config.aviso_mensaje}
              </div>
            )}

            <p style={{ fontSize: '0.8rem', color: '#5f7165', lineHeight: 1.45, margin: '0 0 10px 0' }}>
              Horario de atención configurado:
            </p>
            <div className="d-flex flex-column gap-1" style={{ fontSize: '0.82rem', color: '#111d15', fontWeight: 700 }}>
              <span>{scheduleInfo.weekdays}</span>
              <span>{scheduleInfo.saturday}</span>
              <span>{scheduleInfo.sunday}</span>
            </div>

            {(config?.landing_gym_telefono || config?.pago_yape_numero) && (
              <div className="mt-3 pt-3 border-top small text-muted d-flex flex-column gap-1">
                {config?.landing_gym_telefono && (
                  <span>
                    <i className="bi bi-telephone me-1" /> Recepción: <strong className="text-dark">{config.landing_gym_telefono}</strong>
                  </span>
                )}
                {config?.pago_yape_numero && (
                  <span>
                    <i className="bi bi-qr-code me-1" /> Yape oficial: <strong className="text-dark">{config.pago_yape_numero}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FILA 2 EQUILIBRADA (50% IZQUIERDA PROMOCIONES | 50% DERECHA PASES AMIGO) */}
      <div className="row g-3 g-md-4 align-items-stretch mt-1">
        <div className="col-12 col-lg-6" style={{ minWidth: 0 }}>
          <div
            className="h-100 p-3 p-sm-4"
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              border: '1px solid #e3e8e2',
              boxShadow: '0 4px 18px rgba(18, 31, 23, 0.04)',
            }}
          >
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#111d15', margin: 0 }}>
                  Promociones y Cupones para Renovar
                </h3>
                <p className="text-muted small mb-0">
                  Descuentos y días extra listos para aplicar al renovar.
                </p>
              </div>
              <span className="badge rounded-pill px-3 py-2" style={{ background: '#ecfccb', color: '#3f6212' }}>
                {discountOffers.filter((o) => o.disponible).length} disponibles
              </span>
            </div>

            {discountOffers.length === 0 ? (
              <div className="p-3 rounded-3 bg-light text-muted small text-center">
                No hay promociones activas en este momento. Revisa pronto tus notificaciones.
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {discountOffers.map((offer) => (
                  <div
                    key={offer.id}
                    className="p-3 rounded-3 border d-flex flex-column justify-content-between gap-2"
                    style={{
                      background: offer.disponible ? '#f8fafc' : '#f1f5f9',
                      opacity: offer.disponible ? 1 : 0.72,
                    }}
                  >
                    <div>
                      <div className="d-flex flex-wrap justify-content-between align-items-center gap-1 mb-1">
                        <span
                          className="badge"
                          style={{
                            background: offer.alcance === 'personal' ? '#fef3c7' : '#e0f2fe',
                            color: offer.alcance === 'personal' ? '#b45309' : '#0369a1',
                            fontSize: '0.68rem',
                          }}
                        >
                          {offer.alcance === 'personal' ? 'Exclusiva para ti' : 'Promoción General'}
                        </span>
                        <span className="badge bg-dark text-white" style={{ fontSize: '0.7rem' }}>
                          {formatPromoBadge(offer)}
                        </span>
                      </div>
                      <h4 className="fw-bold text-dark mb-1" style={{ fontSize: '0.94rem' }}>
                        {offer.titulo}
                      </h4>
                      <p className="text-muted small mb-2" style={{ fontSize: '0.78rem' }}>
                        {offer.descripcion}
                      </p>
                    </div>

                    <div>
                      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2" style={{ fontSize: '0.74rem' }}>
                        <span className="text-muted">
                          {offer.fechaFin ? `Vence: ${formatDate(offer.fechaFin)}` : 'Vigente'}
                        </span>
                        <span className="fw-semibold" style={{ color: offer.agotada ? '#b91c1c' : '#15803d' }}>
                          {offer.cuposMaximos
                            ? offer.agotada
                              ? 'Cupos agotados'
                              : `Quedan ${offer.cuposRestantes} de ${offer.cuposMaximos} cupos`
                            : 'Disponible para todos'}
                        </span>
                      </div>

                      <div className="d-flex align-items-center justify-content-between gap-2 pt-2 border-top">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-dark fw-bold"
                          style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}
                          onClick={() => handleCopyCode(offer.codigoCupon)}
                        >
                          {copiedCode === offer.codigoCupon ? '✓ Copiado' : offer.codigoCupon}
                        </button>

                        {offer.disponible && !pendingRequest ? (
                          <button
                            type="button"
                            className="btn btn-sm fw-bold"
                            style={{ background: '#c4f039', color: '#111d15', fontSize: '0.78rem' }}
                            onClick={() => openRenewModal(offer.codigoCupon)}
                          >
                            Usar al renovar
                          </button>
                        ) : (
                          <span className="badge bg-secondary text-white" style={{ fontSize: '0.7rem' }}>
                            {offer.yaUsadaPorMi ? 'Ya utilizado' : offer.enSolicitudPendiente ? 'En revisión' : offer.agotada ? 'Agotado' : 'Expirado'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="col-12 col-lg-6" style={{ minWidth: 0 }}>
          <div
            className="h-100 p-3 p-sm-4"
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              border: '1px solid #e3e8e2',
              boxShadow: '0 4px 18px rgba(18, 31, 23, 0.04)',
            }}
          >
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#111d15', margin: 0 }}>
                  Pases Libres para Amigo
                </h3>
                <p className="text-muted small mb-0">
                  Válido solo ingresando acompañado contigo en recepción (Inicio · Control de acceso).
                </p>
              </div>
              <span className="badge bg-light text-dark border px-3 py-2">
                {friendPassOffers.reduce((sum, p) => sum + (p.disponible ? Number(p.pasesRestantesPorMi || 0) : 0), 0)} invitaciones disp.
              </span>
            </div>

            {friendPassOffers.length > 0 && (
              <div className="p-2 px-3 rounded-3 border mb-3" style={{ background: '#f7fee7', borderColor: '#d9f99d', fontSize: '0.76rem' }}>
                <div className="fw-bold text-dark mb-1">
                  <i className="bi bi-people-fill text-success me-1" />
                  ¿Cómo usar este pase? (Solo acompañado)
                </div>
                <div className="text-muted">
                  Preséntate en recepción junto con tu invitado y tu DNI o huella. El sistema detecta tu pase automáticamente para registrar la entrada, el aforo y la salida de ambos juntos.
                </div>
              </div>
            )}

            {friendPassOffers.length === 0 ? (
              <div className="p-3 rounded-3 bg-light text-muted small text-center">
                No tienes pases libres para invitado asignados actualmente.
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {friendPassOffers.map((pass) => (
                  <div key={pass.id} className="p-3 rounded-3 border bg-light d-flex flex-column justify-content-between gap-2">
                    <div>
                      <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
                        <strong className="text-dark" style={{ fontSize: '0.94rem' }}>
                          <i className="bi bi-ticket-perforated-fill text-success me-2" />
                          {pass.titulo}
                        </strong>
                        <span
                          className={`badge ${pass.disponible ? 'bg-success' : 'bg-secondary'}`}
                          style={{ fontSize: '0.68rem' }}
                        >
                          {pass.disponible
                            ? `${pass.pasesRestantesPorMi}/${pass.maxInvitesForPass || 1} disp.`
                            : pass.yaUsadaPorMi
                              ? 'Usado'
                              : pass.agotada
                                ? 'Agotado'
                                : 'Expirado'}
                        </span>
                      </div>
                      <p className="text-muted small mb-2" style={{ fontSize: '0.78rem' }}>
                        {pass.descripcion}
                      </p>
                    </div>
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-2 border-top">
                      <span
                        className="badge d-inline-flex align-items-center gap-1 px-2 py-1"
                        style={{
                          background: '#ecfccb',
                          color: '#166534',
                          border: '1px solid #bef264',
                          fontSize: '0.72rem',
                        }}
                      >
                        <i className="bi bi-people-fill" />
                        <span>Solo acompañado en recepción</span>
                      </span>
                      <span className="text-muted" style={{ fontSize: '0.74rem' }}>
                        Invitados usados: <strong>{pass.usedInvitesByMe || 0}/{pass.maxInvitesForPass || 1}</strong> · {pass.fechaFin ? `Vence ${formatDate(pass.fechaFin)}` : 'Vigente'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FILA 3 ANCHO COMPLETO: BENEFICIOS INCLUIDOS (3x2) */}
      <div
        className="mt-3 mt-md-4 p-3 p-sm-4"
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          border: '1px solid #e3e8e2',
          boxShadow: '0 4px 18px rgba(18, 31, 23, 0.04)',
        }}
      >
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#111d15', margin: '0 0 18px 0' }}>
          Beneficios Incluidos en tu Plan
        </h3>

        <div className="row g-3">
          {PLAN_BENEFITS.map((b, idx) => (
            <div key={idx} className="col-12 col-md-6 col-lg-4">
              <div
                className="h-100 p-3 rounded-3 border d-flex flex-column justify-content-start"
                style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}
              >
                <div
                  className="d-flex align-items-center gap-2 mb-2"
                  style={{ fontWeight: 800, fontSize: '0.88rem', color: '#111d15' }}
                >
                  <span
                    className="d-inline-flex align-items-center justify-content-center rounded-2 flex-shrink-0"
                    style={{ width: '28px', height: '28px', background: '#ecfccb', color: '#3f6212' }}
                  >
                    <i className={`bi ${b.icon}`} />
                  </span>
                  <span>{b.titulo}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#5f7165', lineHeight: 1.45 }}>
                  {b.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL SOLICITAR RENOVACIÓN */}
      <ModalDialog
        isOpen={showRenewModal}
        onClose={() => setShowRenewModal(false)}
        title="Solicitar Renovación"
        subtitle="Completa los campos obligatorios (*) para enviar tu solicitud."
        badge="Renovaciones"
        size="lg"
      >
        <form onSubmit={handleSubmitRenewal} noValidate>
          {renewError && (
            <div ref={renewAlertRef} className="alert alert-danger py-2 px-3 small mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-exclamation-circle-fill" />
              <span>{renewError}</span>
            </div>
          )}

          {/* 1. Elegir Plan */}
          <div
            ref={planSectionRef}
            className="mb-3 rounded-3"
            style={
              renewFieldErrors.planId
                ? { border: '2px solid #ef4444', background: '#fef2f2', padding: '10px 12px' }
                : {}
            }
          >
            <label className="form-label fw-bold small text-dark mb-2">1. Selecciona tu plan *</label>
            <div className="row g-2">
              {planes.map((plan) => {
                const isSelected = String(plan.id) === String(selectedPlanId)
                return (
                  <div key={plan.id} className="col-12 col-sm-6 col-md-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlanId(String(plan.id))
                        if (renewFieldErrors.planId) {
                          setRenewFieldErrors((prev) => ({ ...prev, planId: '' }))
                        }
                        if (appliedCoupon?.oferta?.codigoCupon) {
                          handleValidateCoupon(appliedCoupon.oferta.codigoCupon, plan.id)
                        }
                      }}
                      className="w-100 h-100 text-start p-2 px-3 rounded-3 border d-flex flex-column justify-content-between"
                      style={{
                        background: isSelected ? '#111d15' : '#ffffff',
                        color: isSelected ? '#ffffff' : '#111d15',
                        borderColor: isSelected ? '#c4f039' : renewFieldErrors.planId ? '#ef4444' : '#cbd5e1',
                        boxShadow: isSelected ? '0 0 0 2px #c4f039' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
                        <strong style={{ fontSize: '0.9rem' }}>{plan.nombre}</strong>
                        <span
                          className="badge"
                          style={{
                            background: isSelected ? '#c4f039' : '#f1f5f9',
                            color: '#111d15',
                            fontWeight: 800,
                          }}
                        >
                          S/. {Number(plan.precio).toFixed(2)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: isSelected ? '#9fb3a5' : '#64748b' }}>
                        {plan.duracionDias} días{plan.descripcion ? ` · ${plan.descripcion}` : ''}
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
            {renewFieldErrors.planId && (
              <div className="text-danger small fw-semibold mt-2 d-flex align-items-center gap-1">
                <i className="bi bi-exclamation-circle-fill" />
                <span>{renewFieldErrors.planId}</span>
              </div>
            )}
          </div>

          {/* 2. Cupón o Promoción */}
          <div className="p-2 px-3 rounded-3 border bg-light mb-3">
            <label className="form-label fw-bold small text-dark mb-1">2. Código promocional (opcional)</label>
            <div className="input-group input-group-sm">
              <input
                type="text"
                className="form-control text-uppercase"
                placeholder="Ej. PANDA20"
                value={couponInput}
                onChange={(e) => {
                  setCouponInput(e.target.value.toUpperCase())
                  if (appliedCoupon) setAppliedCoupon(null)
                  setCouponMessage({ type: '', text: '' })
                }}
              />
              <button
                type="button"
                className="btn btn-dark fw-bold px-3"
                disabled={validatingCoupon || !couponInput.trim()}
                onClick={() => handleValidateCoupon()}
              >
                {validatingCoupon ? 'Validando...' : 'Aplicar'}
              </button>
            </div>
            {discountOffers.filter((o) => o.disponible).length > 0 && (
              <div className="d-flex flex-wrap align-items-center gap-1 mt-2">
                <span className="text-muted" style={{ fontSize: '0.72rem' }}>Disponibles:</span>
                {discountOffers
                  .filter((o) => o.disponible)
                  .map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className="badge border-0"
                      style={{ background: '#ecfccb', color: '#3f6212', cursor: 'pointer', fontSize: '0.7rem' }}
                      onClick={() => handleValidateCoupon(o.codigoCupon)}
                    >
                      {o.codigoCupon} · {formatPromoBadge(o)}
                    </button>
                  ))}
              </div>
            )}
            {couponMessage.text && (
              <div
                className="small mt-1 fw-semibold"
                style={{ color: couponMessage.type === 'success' ? '#15803d' : '#dc2626', fontSize: '0.76rem' }}
              >
                {couponMessage.text}
              </div>
            )}
          </div>

          {/* Resumen del monto */}
          <div
            className="py-2 px-3 rounded-3 mb-3 d-flex flex-wrap justify-content-between align-items-center gap-2"
            style={{ background: '#111d15', color: '#ffffff' }}
          >
            <div>
              {selectedPlan ? (
                <>
                  <div style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>
                    Plan <strong>{selectedPlan.nombre}</strong> ({selectedPlan.duracionDias} días
                    {calculatedBreakdown.diasExtra ? ` + ${calculatedBreakdown.diasExtra} d. gratis` : ''})
                  </div>
                  {calculatedBreakdown.descuentoAplicado > 0 && (
                    <div style={{ fontSize: '0.74rem', color: '#c4f039' }}>
                      Base S/. {calculatedBreakdown.montoBase.toFixed(2)} − Desc. S/. {calculatedBreakdown.descuentoAplicado.toFixed(2)}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: '0.8rem', color: '#9fb3a5' }}>Selecciona un plan para ver el total</div>
              )}
            </div>
            <div className="text-end">
              <span style={{ fontSize: '0.68rem', color: '#9fb3a5', display: 'block', lineHeight: 1 }}>TOTAL</span>
              <strong style={{ fontSize: '1.15rem', color: '#c4f039' }}>
                {selectedPlan ? `S/. ${calculatedBreakdown.montoFinal.toFixed(2)}` : '—'}
              </strong>
            </div>
          </div>

          {/* 3. Forma de Pago y Contacto */}
          <div className="row g-3 mb-3">
            <div className="col-12 col-md-6">
              <label className="form-label fw-bold small text-dark mb-1">3. Método de pago *</label>
              <select
                ref={methodSelectRef}
                className={`form-select ${renewFieldErrors.method ? 'is-invalid' : ''}`}
                style={renewFieldErrors.method ? { border: '2px solid #ef4444', backgroundColor: '#fef2f2' } : {}}
                value={metodoPago}
                onChange={(e) => {
                  const nextMethod = e.target.value
                  setMetodoPago(nextMethod)
                  setRenewFieldErrors((prev) => ({
                    ...prev,
                    method: '',
                    proof: ['yape', 'plin', 'transferencia'].includes(nextMethod) ? prev.proof : '',
                  }))
                }}
              >
                <option value="">Selecciona método...</option>
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
                <option value="transferencia">Transferencia Bancaria</option>
                <option value="efectivo">Pagar en Recepción</option>
              </select>
              {renewFieldErrors.method && (
                <div className="text-danger small fw-semibold mt-1 d-flex align-items-center gap-1">
                  <i className="bi bi-exclamation-circle-fill" />
                  <span>{renewFieldErrors.method}</span>
                </div>
              )}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label fw-bold small text-dark mb-1">Teléfono de contacto (opcional)</label>
              <input
                ref={phoneInputRef}
                type="text"
                inputMode="numeric"
                maxLength={9}
                value={renewPhone}
                onChange={(e) => {
                  setRenewPhone(e.target.value.replace(/\D/g, '').slice(0, 9))
                  if (renewFieldErrors.phone) {
                    setRenewFieldErrors((prev) => ({ ...prev, phone: '' }))
                  }
                }}
                className={`form-control ${renewFieldErrors.phone ? 'is-invalid' : ''}`}
                style={renewFieldErrors.phone ? { border: '2px solid #ef4444', backgroundColor: '#fef2f2' } : {}}
                placeholder="Ej. 987654321"
              />
              {renewFieldErrors.phone && (
                <div className="text-danger small fw-semibold mt-1 d-flex align-items-center gap-1">
                  <i className="bi bi-exclamation-circle-fill" />
                  <span>{renewFieldErrors.phone}</span>
                </div>
              )}
            </div>
          </div>

          {needsDigitalProof && (
            <div
              ref={proofSectionRef}
              className="p-3 rounded-3 mb-3"
              style={{
                background: renewFieldErrors.proof ? '#fef2f2' : '#f8fafc',
                border: renewFieldErrors.proof ? '2px solid #ef4444' : '1px solid #dee2e6',
              }}
            >
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                <div className="small text-dark d-flex flex-wrap align-items-center gap-3">
                  <strong className={renewFieldErrors.proof ? 'text-danger' : 'text-success'}>
                    <i className="bi bi-qr-code-scan me-1" />
                    Cuentas:
                  </strong>
                  {config?.pago_yape_numero && <span>Yape <strong>{config.pago_yape_numero}</strong></span>}
                  {config?.pago_plin_numero && <span>Plin <strong>{config.pago_plin_numero}</strong></span>}
                  {config?.pago_transferencia_cuenta && <span>Cuenta <strong>{config.pago_transferencia_cuenta}</strong></span>}
                </div>
                {config?.pago_titular && (
                  <span className="badge bg-dark text-white" style={{ fontSize: '0.7rem' }}>
                    {config.pago_titular}
                  </span>
                )}
              </div>

              <div className="row g-2 align-items-end">
                <div className="col-12 col-md-6">
                  <label className={`form-label fw-bold small mb-1 ${renewFieldErrors.proof ? 'text-danger' : 'text-dark'}`}>
                    Pantallazo del pago *
                  </label>
                  <input
                    ref={receiptInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleReceiptFileChange}
                    className={`form-control form-control-sm ${renewFieldErrors.proof ? 'is-invalid' : ''}`}
                    style={renewFieldErrors.proof ? { border: '1.5px solid #ef4444', backgroundColor: '#ffffff' } : {}}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label fw-bold small text-dark mb-1">N° de operación (opcional)</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Ej. 458912"
                    value={numeroOperacion}
                    onChange={(e) => {
                      setNumeroOperacion(e.target.value)
                      if (renewFieldErrors.proof && e.target.value.trim()) {
                        setRenewFieldErrors((prev) => ({ ...prev, proof: '' }))
                        setRenewError('')
                      }
                    }}
                  />
                </div>
              </div>

              {renewFieldErrors.proof && (
                <div className="text-danger small fw-semibold mt-2 d-flex align-items-center gap-1">
                  <i className="bi bi-exclamation-circle-fill" />
                  <span>{renewFieldErrors.proof}</span>
                </div>
              )}

              {comprobanteUrl && (
                <div className="mt-2 d-flex align-items-center gap-2">
                  <img
                    src={comprobanteUrl}
                    alt="Vista previa comprobante"
                    style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                  <div className="small text-success fw-semibold flex-grow-1 text-truncate">
                    {comprobanteName || 'Pantallazo adjunto'}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger py-0 px-2"
                    onClick={() => {
                      setComprobanteUrl('')
                      setComprobanteName('')
                      if (receiptInputRef.current) receiptInputRef.current.value = ''
                    }}
                  >
                    Quitar
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="mb-3">
            <label className="form-label fw-bold small text-dark mb-1">Comentario adicional (opcional)</label>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Nota opcional..."
              value={comentarioSocio}
              onChange={(e) => setComentarioSocio(e.target.value)}
            />
          </div>

          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-3 border-top">
            <a
              href={buildWhatsappUrl(config, memberInfo, selectedPlan?.nombre)}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline-success fw-bold btn-sm px-3 py-2"
            >
              <i className="bi bi-whatsapp me-1" /> Coordinar por WhatsApp
            </a>

            <button
              type="submit"
              disabled={submittingRenew}
              className="btn px-4 py-2 fw-bold"
              style={{ background: '#c4f039', color: '#111d15', border: 'none', borderRadius: '10px', fontWeight: 800 }}
            >
              {submittingRenew ? 'Enviando...' : 'Enviar Solicitud'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* MODAL PREVIEW DE COMPROBANTE */}
      <ModalDialog
        isOpen={Boolean(receiptPreview)}
        onClose={() => setReceiptPreview(null)}
        title="Comprobante de Pago Enviado"
        badge="Yape / Plin"
        size="md"
      >
        {receiptPreview && (
          <div className="text-center">
            <img
              src={receiptPreview}
              alt="Comprobante"
              style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '12px', border: '1px solid #e2e8f0' }}
            />
          </div>
        )}
      </ModalDialog>
    </div>
  )
}

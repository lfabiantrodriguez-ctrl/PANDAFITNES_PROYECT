import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DeviceService } from '../services/DeviceService'
import ViewTitle from '../components/ViewTitle'
import ModalDialog from '../components/ModalDialog'
import TablePagination, { paginateList } from '../components/TablePagination'
import { CheckInService } from '../services/CheckInService'
import { ZkService } from '../services/ZkService'
import { formatDate, formatTimePeru } from '../utils/formatters'
import BiometricModal from '../components/BiometricModal'

export default function CheckInView({ token, embedded = false }) {
  const minTrainingMinutes = 20

  // Estado para Validación Manual (Modal)
  const [showManualModal, setShowManualModal] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [manualUser, setManualUser] = useState(null)
  const [manualMembership, setManualMembership] = useState(null)
  const [manualActiveAttendance, setManualActiveAttendance] = useState(null)
  const [manualFriendPasses, setManualFriendPasses] = useState(null)
  const [manualGuestsCount, setManualGuestsCount] = useState(0)
  const [manualGuestNames, setManualGuestNames] = useState('')
  const [manualPassOfferId, setManualPassOfferId] = useState('')
  const [manualHistory, setManualHistory] = useState([])
  const [directDuration, setDirectDuration] = useState(60)
  const [manualError, setManualError] = useState('')
  const [manualLoading, setManualLoading] = useState(false)

  // Modal rápido para validar invitado en una asistencia ya en sala
  const [guestModalRow, setGuestModalRow] = useState(null)
  const [guestModalQty, setGuestModalQty] = useState(1)
  const [guestModalOfferId, setGuestModalOfferId] = useState('')
  const [guestModalNames, setGuestModalNames] = useState('')
  const [guestModalBusy, setGuestModalBusy] = useState(false)
  const [guestModalError, setGuestModalError] = useState('')

  // Modo Simulación (oculto por defecto cuando opera con huellero físico; se activa en la esquina)
  const [simulationMode, setSimulationMode] = useState(false)
  const [biometricDni, setBiometricDni] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [biometricResult, setBiometricResult] = useState(null)
  const [showBiometricModal, setShowBiometricModal] = useState(false)

  // Tabla unificada de ingresos y salidas de hoy (incluye validación automática de 4 horas)
  const [records, setRecords] = useState([])
  const [summary, setSummary] = useState({ enSala: 0, salieron: 0, noMarcaronSalida: 0, totalHoy: 0 })
  const [capacity, setCapacity] = useState(null)
  const [filterEstado, setFilterEstado] = useState('todos')
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 10
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })
  const attlogInputRef = useRef(null)
  const [importingAttlog, setImportingAttlog] = useState(false)

  const loadAttendanceData = useCallback(async () => {
    try {
      const [todayData, capRes] = await Promise.all([
        CheckInService.getTodayAttendances(token),
        fetch('/api/aforo', { headers: { Authorization: `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ])
      if (todayData?.records) {
        setRecords(todayData.records)
      }
      if (todayData?.summary) {
        setSummary(todayData.summary)
      }
      if (capRes && typeof capRes.actual === 'number') {
        setCapacity(capRes)
      }
    } catch {
      // Mantener registros actuales si falla la red temporalmente
    }
  }, [token])

  useEffect(() => {
    let active = true
    Promise.all([
      CheckInService.getTodayAttendances(token).catch(() => null),
      fetch('/api/aforo', { headers: { Authorization: `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([todayData, capRes]) => {
      if (!active) return
      if (todayData?.records) setRecords(todayData.records)
      if (todayData?.summary) setSummary(todayData.summary)
      if (capRes && typeof capRes.actual === 'number') setCapacity(capRes)
    })

    const timer = setInterval(loadAttendanceData, 6000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [token, loadAttendanceData])

  function openManualModal() {
    setManualError('')
    setManualCode('')
    setManualUser(null)
    setManualMembership(null)
    setManualActiveAttendance(null)
    setManualFriendPasses(null)
    setManualGuestsCount(0)
    setManualGuestNames('')
    setManualPassOfferId('')
    setManualHistory([])
    setShowManualModal(true)
  }

  function handleFingerprintScan(dniToScan = null) {
    if (isScanning) return
    const rawDni = (dniToScan !== null ? dniToScan : biometricDni).trim()
    setBiometricResult(null)
    setStatus({ loading: false, error: '', success: '' })
    if (rawDni && !/^\d{8}$/.test(rawDni)) {
      setStatus({ loading: false, error: 'El DNI debe tener 8 dígitos numéricos.', success: '' })
      return
    }
    setShowBiometricModal(true)
  }

  async function handleBiometricSuccess(authRes) {
    if (authRes?.usbAlreadyLogged) {
      const msg = authRes.message || 'Marcación por lector USB registrada.'
      setBiometricResult(null)
      setStatus({ loading: false, error: '', success: msg })
      await loadAttendanceData()
      return
    }

    const targetDni = authRes.dni || biometricDni.trim()
    setIsScanning(true)
    setBiometricResult(null)
    setStatus({ loading: false, error: '', success: '' })
    try {
      const res = await CheckInService.biometricCheckIn(token, {
        dni: targetDni,
        deviceProof: authRes.proof,
        durationMinutes: 60,
        minDurationMinutes: minTrainingMinutes,
        forceExit: false,
      })

      setIsScanning(false)
      if (res.tipo === 'en_curso_reciente') {
        setBiometricResult(res)
        setStatus({ loading: false, error: '', success: '' })
      } else {
        setBiometricResult(null)
        setStatus({
          loading: false,
          error: '',
          success: res.message || 'Acceso verificado con éxito.',
        })
      }
      await loadAttendanceData()
    } catch (err) {
      setIsScanning(false)
      setBiometricResult(null)
      const msg = err.message || 'Error al validar la huella digital del socio.'
      setStatus({ loading: false, error: msg, success: '' })
    }
  }

  async function executeBiometricVerification(dni = null, forceExit = false) {
    if (isScanning) return
    setIsScanning(true)
    setBiometricResult(null)
    setStatus({ loading: false, error: '', success: '' })
    try {
      const authRes = await DeviceService.authenticate(token, dni)
      const res = await CheckInService.biometricCheckIn(token, {
        dni: authRes.dni || dni,
        deviceProof: authRes.proof,
        durationMinutes: 60,
        minDurationMinutes: minTrainingMinutes,
        forceExit,
      })
      setIsScanning(false)
      setBiometricResult(null)
      setStatus({
        loading: false,
        error: '',
        success: res.message || 'Acceso verificado con éxito.',
      })
      await loadAttendanceData()
    } catch (err) {
      setIsScanning(false)
      setBiometricResult(null)
      const msg = err.message || 'Error al validar la huella digital del socio.'
      setStatus({ loading: false, error: msg, success: '' })
    }
  }

  async function handleManualLookup(event) {
    if (event) event.preventDefault()
    setManualError('')
    if (!manualCode.trim()) {
      setManualError('Ingresa el DNI o nombre del socio para buscar.')
      return
    }

    setManualLoading(true)
    try {
      const data = await CheckInService.lookupMember(token, manualCode.trim())
      setManualUser(data.user)
      setManualMembership(data.membership)
      setManualActiveAttendance(data.activeAttendance)
      setManualFriendPasses(data.friendPasses || null)
      setManualGuestsCount(0)
      setManualGuestNames('')
      setManualPassOfferId(data.friendPasses?.ofertas?.[0]?.id ? String(data.friendPasses.ofertas[0].id) : '')
      setManualHistory(data.history || [])
    } catch (err) {
      setManualUser(null)
      setManualMembership(null)
      setManualActiveAttendance(null)
      setManualFriendPasses(null)
      setManualGuestsCount(0)
      setManualGuestNames('')
      setManualHistory([])
      setManualError(err.message || 'No se encontró al socio.')
    } finally {
      setManualLoading(false)
    }
  }

  async function handleManualDirectCheckIn() {
    if (!manualUser) return
    setManualLoading(true)
    setManualError('')
    try {
      const res = await CheckInService.confirmDirectEntry(token, manualUser.id, directDuration, {
        invitadosCount: manualGuestsCount,
        invitadoNombres: manualGuestNames,
        paseOfertaId: manualPassOfferId || null,
      })
      setShowManualModal(false)
      setStatus({
        loading: false,
        error: '',
        success: res.message || `Entrada manual autorizada para ${manualUser.nombre} ${manualUser.apellido}.`,
      })
      await loadAttendanceData()
    } catch (err) {
      setManualError(err.message || 'No se pudo autorizar el acceso.')
    } finally {
      setManualLoading(false)
    }
  }

  function openGuestValidateModal(row) {
    setGuestModalRow(row)
    const firstOffer = row.pasesAmigoOfertas?.[0]
    setGuestModalOfferId(firstOffer ? String(firstOffer.id) : '')
    setGuestModalQty(1)
    setGuestModalNames('')
    setGuestModalError('')
  }

  async function handleConfirmAttachGuest(e) {
    e.preventDefault()
    if (!guestModalRow) return
    setGuestModalBusy(true)
    setGuestModalError('')
    try {
      const res = await CheckInService.attachFriendGuest(token, {
        attendanceId: guestModalRow.id,
        cantidad: guestModalQty,
        ofertaId: guestModalOfferId || null,
        invitadoNombres: guestModalNames,
      })
      setGuestModalRow(null)
      setStatus({
        loading: false,
        error: '',
        success: res.message || 'Invitado validado y agregado al aforo.',
      })
      await loadAttendanceData()
    } catch (err) {
      setGuestModalError(err.message || 'No se pudo validar el invitado.')
    } finally {
      setGuestModalBusy(false)
    }
  }

  async function handleManualCheckout(attendanceId, nombre) {
    setManualLoading(true)
    setManualError('')
    try {
      await CheckInService.finalizeDirectEntry(token, attendanceId)
      setShowManualModal(false)
      setStatus({
        loading: false,
        error: '',
        success: `Salida registrada para ${nombre}.`,
      })
      await loadAttendanceData()
    } catch (err) {
      setManualError(err.message || 'No se pudo registrar la salida.')
    } finally {
      setManualLoading(false)
    }
  }

  async function handleQuickCheckout(row) {
    setStatus({ loading: true, error: '', success: '' })
    try {
      if (!row.id) {
        throw new Error('Selecciona una asistencia válida para registrar la salida.')
      }
      await CheckInService.finalizeDirectEntry(token, row.id)
      setStatus({
        loading: false,
        error: '',
        success: `Salida registrada para ${row.nombre} ${row.apellido}. Cupo liberado del aforo.`,
      })
      await loadAttendanceData()
    } catch (err) {
      setStatus({
        loading: false,
        error: err.message || 'No se pudo registrar la salida.',
        success: '',
      })
    }
  }

  async function handleAttlogFileChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setImportingAttlog(true)
    setStatus({ loading: false, error: '', success: '' })
    try {
      const content = await file.text()
      const res = await ZkService.importArchivo(token, { content, filename: file.name })
      setStatus({
        loading: false,
        error: '',
        success: res.message || `Archivo ${file.name} importado correctamente.`,
      })
      await loadAttendanceData()
    } catch (err) {
      setStatus({
        loading: false,
        error: err.message || 'No se pudo importar el archivo attlog.',
        success: '',
      })
    } finally {
      setImportingAttlog(false)
    }
  }

  const canAuthorizeManual =
    Boolean(manualUser) &&
    Boolean(manualMembership && manualMembership.estado === 'activo') &&
    !manualActiveAttendance

  const filteredRecords = useMemo(
    () => (filterEstado === 'todos' ? records : records.filter((row) => row.estado === filterEstado)),
    [records, filterEstado]
  )

  const paginatedRecords = useMemo(
    () => paginateList(filteredRecords, currentPage, PAGE_SIZE),
    [filteredRecords, currentPage]
  )

  function renderStatusBadge(estado) {
    if (estado === 'en_sala') {
      return (
        <span
          className="badge"
          style={{
            background: '#ecfccb',
            color: '#15803d',
            border: '1px solid #d9f99d',
            fontSize: '0.75rem',
            fontWeight: 700,
          }}
        >
          En sala
        </span>
      )
    }
    if (estado === 'no_marco_salida') {
      return (
        <span
          className="badge"
          style={{
            background: '#fef3c7',
            color: '#b45309',
            border: '1px solid #fde68a',
            fontSize: '0.75rem',
            fontWeight: 700,
          }}
        >
          No marcó su salida (+4h)
        </span>
      )
    }
    return (
      <span
        className="badge"
        style={{
          background: '#e0f2fe',
          color: '#0369a1',
          border: '1px solid #bae6fd',
          fontSize: '0.75rem',
          fontWeight: 700,
        }}
      >
        Completó salida
      </span>
    )
  }

  return (
    <div className="dashboard-page" style={{ width: '100%', maxWidth: '100%', margin: 0, paddingBottom: '12px' }}>
      {/* Barra superior: descripción + botón compacto en la esquina (Modo Simulación con huella, Importar USB y Registro Manual) */}
      <div
        className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3"
        style={{ width: '100%' }}
      >
        <div>
          {!embedded ? (
            <ViewTitle text="Control de ingreso y salida en sala." />
          ) : (
            <p className="m-0 text-muted" style={{ fontSize: '0.9rem' }}>
              Monitoreo en tiempo real del huellero. Cierre automático tras 4 horas sin marcar salida (descuento automático de aforo).
            </p>
          )}
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSimulationMode((prev) => !prev)
              setBiometricResult(null)
              setStatus({ loading: false, error: '', success: '' })
            }}
            title="Activar o desactivar modo simulación de huella"
            className="btn d-inline-flex align-items-center gap-2 px-3 py-2 fw-bold"
            style={{
              background: simulationMode ? '#c4f039' : '#ffffff',
              color: '#111d15',
              border: simulationMode ? '1px solid #a3e635' : '1px solid #cbd5e1',
              borderRadius: '10px',
              fontSize: '0.86rem',
            }}
          >
            <i className="bi bi-fingerprint" aria-hidden="true" />
            <span>{simulationMode ? 'Modo Simulación: Activo' : 'Modo Simulación'}</span>
          </button>

          <input
            ref={attlogInputRef}
            type="file"
            accept=".dat,.txt,.csv"
            style={{ display: 'none' }}
            onChange={handleAttlogFileChange}
          />
          <button
            type="button"
            disabled={importingAttlog}
            onClick={() => attlogInputRef.current?.click()}
            className="btn d-inline-flex align-items-center gap-2 px-3 py-2 fw-bold"
            style={{
              background: '#ffffff',
              color: '#111d15',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              fontSize: '0.86rem',
            }}
          >
            <i className="bi bi-usb-drive" aria-hidden="true" />
            <span>{importingAttlog ? 'Importando...' : 'Importar USB (.dat)'}</span>
          </button>

          <button
            type="button"
            onClick={openManualModal}
            className="btn d-inline-flex align-items-center gap-2 px-4 py-2 fw-bold"
            style={{
              background: '#111d15',
              color: '#c4f039',
              border: 'none',
              borderRadius: '10px',
              fontSize: '0.88rem',
            }}
          >
            <i className="bi bi-pencil-square" aria-hidden="true" />
            <span>Registro Manual</span>
          </button>
        </div>
      </div>

      {/* Panel compacto opcional SOLO visible cuando se activa Modo Simulación en la esquina */}
      {simulationMode && (
        <div
          className="mb-3 p-3"
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1.5px solid #c4f039',
            boxShadow: '0 4px 16px rgba(18, 31, 23, 0.06)',
          }}
        >
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div className="d-flex align-items-center gap-2">
              <span
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: '#ecfccb',
                  color: '#15803d',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                }}
              >
                <i className="bi bi-fingerprint" aria-hidden="true" />
              </span>
              <div>
                <div style={{ fontWeight: 800, color: '#111d15', fontSize: '0.94rem' }}>
                  Simulador / Lector Biométrico en Pantalla
                </div>
                <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                  Úsalo para probar ingresos o salidas sin el reloj físico, o conectar el lector USB local.
                </div>
              </div>
            </div>

            <div className="d-flex flex-wrap align-items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder="DNI opcional (8 dígitos)"
                value={biometricDni}
                disabled={isScanning}
                onChange={(e) => setBiometricDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="form-control form-control-sm"
                style={{ width: '190px', borderRadius: '9px' }}
              />
              <button
                type="button"
                disabled={isScanning}
                onClick={() => handleFingerprintScan()}
                className="btn btn-sm px-3 py-2 fw-bold d-inline-flex align-items-center gap-2"
                style={{
                  background: '#c4f039',
                  color: '#111d15',
                  border: 'none',
                  borderRadius: '9px',
                }}
              >
                <i className={`bi ${isScanning ? 'bi-hourglass-split' : 'bi-fingerprint'}`} />
                <span>{isScanning ? 'Validando...' : 'Colocar huella / Simular'}</span>
              </button>
            </div>
          </div>

          {biometricResult && biometricResult.tipo === 'en_curso_reciente' && (
            <div
              className="mt-2 p-2 px-3 rounded-3 d-flex flex-wrap align-items-center justify-content-between gap-2"
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                fontSize: '0.84rem',
              }}
            >
              <div>
                <strong>
                  {biometricResult.user?.nombre} {biometricResult.user?.apellido}
                </strong>{' '}
                — {biometricResult.message}
              </div>
              {biometricResult.canForceExit && (
                <button
                  type="button"
                  onClick={() => executeBiometricVerification(biometricResult.user?.dni, true)}
                  className="btn btn-outline-danger btn-sm fw-bold"
                  style={{ borderRadius: '8px' }}
                >
                  <i className="bi bi-box-arrow-right me-1" />
                  Forzar Salida Anticipada
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Banners de Notificación */}
      {status.success && (
        <div
          className="alert d-flex align-items-center gap-2 py-3 px-4 rounded-3 border mb-3"
          style={{ background: '#ecfccb', borderColor: '#d9f99d', color: '#15803d', fontWeight: 600 }}
        >
          <i className="bi bi-check-circle-fill" aria-hidden="true" />
          <span>{status.success}</span>
        </div>
      )}

      {status.error && (
        <div
          className="alert d-flex align-items-center gap-2 py-3 px-4 rounded-3 border mb-3"
          style={{ background: '#fee2e2', borderColor: '#fecaca', color: '#b91c1c', fontWeight: 600 }}
        >
          <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
          <span>{status.error}</span>
        </div>
      )}

      {/* TABLA PRINCIPAL DE HORA DE INGRESO Y HORA DE SALIDA */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          padding: '22px',
          border: '1px solid #e3e8e2',
          boxShadow: '0 4px 18px rgba(18, 31, 23, 0.04)',
        }}
      >
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
          <div>
            <h3 style={{ fontSize: '1.12rem', fontWeight: 800, color: '#111d15', margin: 0 }}>
              Registro de Ingresos y Salidas de Hoy ({summary.totalHoy})
            </h3>
            <p className="m-0 text-muted" style={{ fontSize: '0.8rem' }}>
              Si un socio no marca su salida después de 4 horas, el sistema lo cierra como{' '}
              <strong>No marcó su salida</strong> y libera su cupo del aforo.
            </p>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2">
            {capacity && (
              <span
                className="badge"
                style={{
                  background: '#111d15',
                  color: '#c4f039',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}
              >
                Aforo actual: {capacity.actual} / {capacity.maximo}
              </span>
            )}
            <button
              type="button"
              onClick={loadAttendanceData}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <i className="bi bi-arrow-clockwise" />
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {/* Filtros rápidos */}
        <div className="d-flex flex-wrap gap-2 mb-3">
          {[
            { id: 'todos', label: `Todos (${summary.totalHoy})` },
            { id: 'en_sala', label: `En sala (${summary.enSala}${summary.invitadosEnSala > 0 ? ` + ${summary.invitadosEnSala} inv.` : ''})` },
            { id: 'finalizada', label: `Con salida (${summary.salieron})` },
            { id: 'no_marco_salida', label: `No marcó salida +4h (${summary.noMarcaronSalida})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setFilterEstado(tab.id)
                setCurrentPage(1)
              }}
              className="btn btn-sm fw-bold"
              style={{
                borderRadius: '9999px',
                padding: '5px 14px',
                fontSize: '0.78rem',
                background: filterEstado === tab.id ? '#111d15' : '#f1f5f9',
                color: filterEstado === tab.id ? '#c4f039' : '#475569',
                border: 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {filteredRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px', color: '#94a3b8', fontSize: '0.9rem' }}>
            No hay registros de ingreso o salida en esta vista.
          </div>
        ) : (
          <>
            <div className="table-responsive d-none d-md-block">
              <table className="table table-hover align-middle m-0">
                <thead>
                  <tr>
                    <th>Socio</th>
                    <th>DNI</th>
                    <th>Hora de Ingreso</th>
                    <th>Hora de Salida</th>
                    <th>Método</th>
                    <th>Invitado (Pase Amigo)</th>
                    <th>Estado</th>
                    <th className="text-end">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.items.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 fw-bold text-dark">
                        {row.nombre} {row.apellido}
                      </td>
                      <td className="px-3 text-muted">{row.dni}</td>
                      <td className="px-3 font-monospace fw-semibold">
                        {formatTimePeru(row.horaEntrada)} hrs
                      </td>
                      <td className="px-3 font-monospace">
                        {row.estado === 'en_sala' ? (
                          <span className="text-muted">En curso</span>
                        ) : row.estado === 'no_marco_salida' ? (
                          <span style={{ color: '#b45309', fontWeight: 700, fontFamily: 'inherit', fontSize: '0.82rem' }}>
                            No marcó salida (cierre {formatTimePeru(row.horaSalida)} hrs)
                          </span>
                        ) : (
                          <span>{formatTimePeru(row.horaSalida)} hrs</span>
                        )}
                      </td>
                      <td className="px-3">
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            background: row.metodoRegistro === 'huella' ? '#ecfccb' : '#f1f5f9',
                            color: row.metodoRegistro === 'huella' ? '#15803d' : '#475569',
                            border: row.metodoRegistro === 'huella' ? '1px solid #d9f99d' : '1px solid #e2e8f0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <i className={row.metodoRegistro === 'huella' ? 'bi bi-fingerprint' : 'bi bi-pencil-square'} />
                          <span>{row.metodoRegistro === 'huella' ? 'Huella' : 'Manual'}</span>
                        </span>
                      </td>
                      <td className="px-3">
                        <div className="d-flex flex-column align-items-start gap-1">
                          {Number(row.invitadosCount) > 0 && (
                            <span
                              className="badge"
                              style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', fontSize: '0.72rem' }}
                            >
                              <i className="bi bi-people-fill me-1" />
                              +{row.invitadosCount} invitado{row.invitadosCount > 1 ? 's' : ''}
                              {row.invitadoNombres ? ` (${row.invitadoNombres})` : ''}
                            </span>
                          )}
                          {row.estado === 'en_sala' && Number(row.pasesAmigoDisponibles) > 0 ? (
                            <span className="text-success fw-semibold" style={{ fontSize: '0.73rem' }}>
                              <i className="bi bi-ticket-perforated me-1" />
                              {row.pasesAmigoDisponibles} pase{row.pasesAmigoDisponibles > 1 ? 's' : ''} disp.
                            </span>
                          ) : Number(row.invitadosCount) === 0 ? (
                            <span className="text-muted small">Sin invitado</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3">{renderStatusBadge(row.estado)}</td>
                      <td className="px-3 text-end">
                        {row.estado === 'en_sala' ? (
                          <div className="d-inline-flex align-items-center gap-1 flex-wrap justify-content-end">
                            {Number(row.pasesAmigoDisponibles) > 0 && (
                              <button
                                type="button"
                                onClick={() => openGuestValidateModal(row)}
                                className="btn btn-sm fw-bold px-2 py-1"
                                style={{
                                  background: '#ecfccb',
                                  color: '#166534',
                                  border: '1px solid #bef264',
                                  borderRadius: '8px',
                                  fontSize: '0.76rem',
                                }}
                                title="Registrar invitado con pase amigo del socio"
                              >
                                <i className="bi bi-person-plus-fill me-1" />
                                + Invitado
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleQuickCheckout(row)}
                              disabled={status.loading}
                              style={{
                                padding: '6px 14px',
                                background: '#ffffff',
                                border: '1px solid #ef4444',
                                color: '#b91c1c',
                                borderRadius: '8px',
                                fontWeight: 700,
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                              }}
                            >
                              Registrar Salida
                            </button>
                          </div>
                        ) : row.estado === 'no_marco_salida' ? (
                          <span className="text-muted" style={{ fontSize: '0.76rem' }}>
                            Descontado del aforo
                          </span>
                        ) : (
                          <span className="text-muted" style={{ fontSize: '0.76rem' }}>
                            Completado
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="d-block d-md-none">
              <div className="mobile-card-list">
                {paginatedRecords.items.map((row) => (
                  <div key={row.id} className="mobile-data-card">
                    <div className="mobile-card-header">
                      <div className="mobile-card-identity">
                        <div className="mobile-card-avatar" style={{ fontSize: '0.8rem' }}>
                          {row.nombre?.charAt(0)}{row.apellido?.charAt(0)}
                        </div>
                        <div className="mobile-card-titles">
                          <h4 className="mobile-card-title">{row.nombre} {row.apellido}</h4>
                          <p className="mobile-card-subtitle">DNI: {row.dni || 'Sin DNI'}</p>
                        </div>
                      </div>
                      {renderStatusBadge(row.estado)}
                    </div>

                    <div className="mobile-card-body-grid">
                      <div className="mobile-card-field">
                        <div className="mobile-card-label">Hora Ingreso</div>
                        <div className="mobile-card-value font-monospace">
                          {formatTimePeru(row.horaEntrada)} hrs
                        </div>
                      </div>
                      <div className="mobile-card-field">
                        <div className="mobile-card-label">Hora Salida</div>
                        <div className="mobile-card-value font-monospace">
                          {row.estado === 'en_sala'
                            ? 'En sala'
                            : row.estado === 'no_marco_salida'
                            ? 'No marcó (+4h)'
                            : `${formatTimePeru(row.horaSalida)} hrs`}
                        </div>
                      </div>
                    </div>

                    {row.estado === 'en_sala' && (
                      <div className="mobile-card-actions d-flex gap-2">
                        {Number(row.pasesAmigoDisponibles) > 0 && (
                          <button
                            type="button"
                            onClick={() => openGuestValidateModal(row)}
                            className="btn fw-bold py-2 px-3"
                            style={{ background: '#ecfccb', color: '#166534', border: '1px solid #bef264', borderRadius: '10px', fontSize: '0.82rem' }}
                          >
                            + Invitado ({row.pasesAmigoDisponibles})
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleQuickCheckout(row)}
                          disabled={status.loading}
                          className="btn btn-outline-danger fw-bold flex-grow-1 py-2 d-flex align-items-center justify-content-center gap-2"
                          style={{ borderRadius: '10px', fontSize: '0.84rem' }}
                        >
                          <i className="bi bi-box-arrow-right" />
                          <span>Registrar Salida</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <TablePagination
              totalItems={filteredRecords.length}
              currentPage={paginatedRecords.safePage}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
              itemLabel="registros"
            />
          </>
        )}
      </div>

      {/* MODAL ÚNICO: REGISTRO MANUAL DE ENTRADA Y SALIDA */}
      <ModalDialog
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        title="Registro Manual de Acceso"
        subtitle="Busca al socio por DNI o nombre para registrar su ingreso o salida."
        badge="Recepción"
        size="md"
        footer={
          manualUser ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
              {manualActiveAttendance ? (
                <button
                  type="button"
                  disabled={manualLoading}
                  className="btn btn-danger px-4 py-2 fw-bold d-inline-flex align-items-center gap-2"
                  onClick={() =>
                    handleManualCheckout(
                      manualActiveAttendance.id,
                      `${manualUser.nombre} ${manualUser.apellido}`
                    )
                  }
                >
                  <i className="bi bi-box-arrow-right" />
                  <span>{manualLoading ? 'Registrando...' : 'Registrar Salida'}</span>
                </button>
              ) : canAuthorizeManual ? (
                <button
                  type="button"
                  disabled={manualLoading}
                  className="btn btn-dark px-4 py-2 fw-bold d-inline-flex align-items-center gap-2"
                  onClick={handleManualDirectCheckIn}
                  style={{ background: '#c4f039', color: '#111d15', border: 'none' }}
                >
                  <i className="bi bi-check-lg" />
                  <span>
                    {manualLoading ? 'Registrando...' : `Autorizar Entrada (${directDuration} min)`}
                  </span>
                </button>
              ) : (
                <button type="button" className="btn btn-secondary px-3 py-2 fw-bold" disabled>
                  Membresía No Válida
                </button>
              )}
            </div>
          ) : null
        }
      >
        <form onSubmit={handleManualLookup} className="mb-3">
          <label htmlFor="manual-lookup-input" className="form-label fw-bold small text-dark">
            DNI o nombre del socio
          </label>
          <div className="d-flex gap-2">
            <input
              id="manual-lookup-input"
              type="text"
              value={manualCode}
              onChange={(e) => {
                setManualCode(e.target.value)
                if (manualError) setManualError('')
              }}
              placeholder="Ej. 72145896 o nombre..."
              className={`form-control ${manualError ? 'is-invalid' : ''}`}
              style={{ borderRadius: '10px' }}
              autoFocus
            />
            <button
              type="submit"
              disabled={manualLoading}
              className="btn fw-bold px-3"
              style={{
                background: '#c4f039',
                color: '#111d15',
                border: 'none',
                borderRadius: '10px',
                whiteSpace: 'nowrap',
              }}
            >
              <i className="bi bi-search me-1" />
              {manualLoading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </form>

        {manualError && (
          <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
            <i className="bi bi-exclamation-circle-fill" />
            <span>{manualError}</span>
          </div>
        )}

        {manualUser && (
          <div>
            <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '12px', marginBottom: '14px', border: '1px solid #e2e8f0' }}>
              <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#111d15' }}>
                    {manualUser.nombre} {manualUser.apellido}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    DNI: {manualUser.dni}{manualUser.email ? ` · ${manualUser.email}` : ''}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    background: manualMembership && manualMembership.estado === 'activo' ? '#ecfccb' : '#fee2e2',
                    color: manualMembership && manualMembership.estado === 'activo' ? '#15803d' : '#b91c1c',
                  }}
                >
                  {manualMembership && manualMembership.estado === 'activo' ? 'ACTIVO' : 'SIN MEMBRESÍA'}
                </span>
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>
                {manualMembership ? manualMembership.planNombre : 'Sin plan contratado'}
              </div>
              {manualMembership && (
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                  Vence el: {formatDate(manualMembership.fechaFin)}
                </div>
              )}
            </div>

            {manualActiveAttendance && (
              <div className="alert alert-warning py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                <i className="bi bi-clock-history" />
                <span>
                  El socio ya se encuentra en sala desde las{' '}
                  <strong>{formatTimePeru(manualActiveAttendance.horaEntrada)} hrs</strong>.
                </span>
              </div>
            )}

            {canAuthorizeManual && (
              <>
                <div className="mb-3">
                  <label htmlFor="manual-duration-select" className="form-label fw-bold small text-dark">
                    Duración estimada de sesión
                  </label>
                  <select
                    id="manual-duration-select"
                    value={directDuration}
                    onChange={(e) => setDirectDuration(Number(e.target.value))}
                    className="form-select"
                    style={{ borderRadius: '10px' }}
                  >
                    <option value={60}>1 hora (60 minutos)</option>
                    <option value={90}>1 hora y media (90 minutos)</option>
                    <option value={120}>2 horas (120 minutos)</option>
                    <option value={180}>3 horas (180 minutos)</option>
                  </select>
                </div>

                {manualFriendPasses && manualFriendPasses.totalDisponibles > 0 && (() => {
                  const selectedManualPass =
                    manualFriendPasses.ofertas?.find((o) => String(o.id) === String(manualPassOfferId)) ||
                    manualFriendPasses.ofertas?.[0]
                  const manualMaxInv = Math.min(5, Number(selectedManualPass?.pasesRestantesPorMi || 1))
                  return (
                    <div className="p-3 rounded-3 border mb-3" style={{ background: '#f7fee7', borderColor: '#bef264' }}>
                      <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                        <strong className="small text-dark">
                          <i className="bi bi-people-fill text-success me-1" />
                          {selectedManualPass?.titulo || 'Pase Amigo disponible'}
                        </strong>
                        <span className="badge bg-success" style={{ fontSize: '0.7rem' }}>
                          {selectedManualPass?.pasesRestantesPorMi ?? manualFriendPasses.totalDisponibles} de{' '}
                          {selectedManualPass?.maxInvitesForPass ?? manualMaxInv} disp.
                        </span>
                      </div>
                      <div className="row g-2 align-items-center">
                        <div className="col-12 col-md-6">
                          <select
                            className="form-select form-select-sm"
                            value={manualGuestsCount}
                            onChange={(e) => setManualGuestsCount(Number(e.target.value))}
                          >
                            <option value={0}>Solo el socio (sin invitado)</option>
                            {Array.from({ length: manualMaxInv }, (_, i) => i + 1).map((n) => (
                              <option key={n} value={n}>
                                +{n} {n === 1 ? 'invitado' : 'invitados'} (acompañado)
                              </option>
                            ))}
                          </select>
                        </div>
                        {manualGuestsCount > 0 && (
                          <div className="col-12 col-md-6">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Nombre del invitado (opcional)"
                              value={manualGuestNames}
                              onChange={(e) => setManualGuestNames(e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </>
            )}

            {manualHistory.length > 0 && (
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                  Últimos accesos:
                </span>
                <div style={{ maxHeight: '130px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                  {manualHistory.slice(0, 3).map((h) => (
                    <div key={h.id} style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span>{formatDate(h.horaEntrada)} ({formatTimePeru(h.horaEntrada)} hrs)</span>
                      <span style={{ fontWeight: 700, color: h.metodoRegistro === 'huella' ? '#15803d' : '#475569' }}>
                        <i className={`bi ${h.metodoRegistro === 'huella' ? 'bi-fingerprint' : 'bi-pencil-square'} me-1`} />
                        {h.metodoRegistro === 'huella' ? 'Huella' : 'Manual'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ModalDialog>

      <ModalDialog
        isOpen={Boolean(guestModalRow)}
        onClose={() => setGuestModalRow(null)}
        title="Validar Invitado"
        subtitle={guestModalRow ? `${guestModalRow.nombre} ${guestModalRow.apellido} · DNI ${guestModalRow.dni}` : ''}
        badge="Pase Amigo"
        size="md"
      >
        {guestModalRow && (() => {
          const activePasses = guestModalRow.pasesAmigoOfertas || []
          const selectedOffer = activePasses.find((o) => String(o.id) === String(guestModalOfferId)) || activePasses[0]
          const passMax = Number(selectedOffer?.maxInvitesForPass || guestModalRow.pasesAmigoDisponibles || 1)
          const passRemaining = Math.max(
            1,
            Math.min(5, Number(selectedOffer?.pasesRestantesPorMi ?? guestModalRow.pasesAmigoDisponibles ?? 1)),
          )

          return (
            <form onSubmit={handleConfirmAttachGuest}>
              {guestModalError && (
                <div className="alert alert-danger py-2 px-3 small mb-3">{guestModalError}</div>
              )}

              <div className="p-3 rounded-3 border mb-3" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
                <div className="d-flex justify-content-between align-items-center gap-3">
                  <div className="min-w-0 flex-grow-1">
                    <div className="text-muted" style={{ fontSize: '0.73rem', fontWeight: 600 }}>
                      Pase asignado
                    </div>
                    {activePasses.length > 1 ? (
                      <select
                        className="form-select form-select-sm mt-1 fw-semibold"
                        value={guestModalOfferId}
                        onChange={(e) => {
                          setGuestModalOfferId(e.target.value)
                          setGuestModalQty(1)
                        }}
                      >
                        {activePasses.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.titulo} ({o.pasesRestantesPorMi}/{o.maxInvitesForPass || o.pasesRestantesPorMi} disp.)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.96rem' }}>
                        {selectedOffer?.titulo || 'Pase Libre para Amigo'}
                      </div>
                    )}
                  </div>
                  <span
                    className="badge rounded-pill px-3 py-2 flex-shrink-0"
                    style={{ background: '#ecfccb', color: '#166534', border: '1px solid #bef264', fontSize: '0.78rem' }}
                  >
                    {selectedOffer?.pasesRestantesPorMi ?? passRemaining} de {passMax} disp.
                  </span>
                </div>
              </div>

              {passRemaining === 1 ? (
                <div
                  className="p-3 rounded-3 border mb-3 d-flex justify-content-between align-items-center"
                  style={{ background: '#f7fee7', borderColor: '#d9f99d' }}
                >
                  <span className="small fw-bold text-dark">Invitados en este ingreso</span>
                  <span className="badge bg-success px-3 py-2" style={{ fontSize: '0.8rem' }}>
                    +1 invitado
                  </span>
                </div>
              ) : (
                <div className="mb-3">
                  <label className="form-label small fw-bold text-dark mb-2">
                    ¿Cuántos invitados ingresan ahora?
                  </label>
                  <div className="d-flex flex-wrap gap-2">
                    {Array.from({ length: passRemaining }, (_, i) => i + 1).map((n) => {
                      const active = Number(guestModalQty) === n
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setGuestModalQty(n)}
                          className="btn btn-sm fw-bold px-3 py-2"
                          style={{
                            borderRadius: '10px',
                            background: active ? '#111d15' : '#ffffff',
                            color: active ? '#c4f039' : '#334155',
                            border: active ? '1px solid #111d15' : '1px solid #cbd5e1',
                          }}
                        >
                          +{n} {n === 1 ? 'invitado' : 'invitados'}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="mb-3">
                <label className="form-label small fw-bold text-dark">Nombre del invitado (opcional)</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ borderRadius: '10px' }}
                  placeholder="Ej. Luis Ramírez"
                  value={guestModalNames}
                  onChange={(e) => setGuestModalNames(e.target.value)}
                />
              </div>

              <div className="d-flex justify-content-between align-items-center gap-2 pt-3 border-top">
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                  <i className="bi bi-arrow-left-right me-1" />
                  Entrada y salida junto con el socio
                </span>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-light border fw-semibold"
                    style={{ borderRadius: '10px' }}
                    onClick={() => setGuestModalRow(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guestModalBusy}
                    className="btn fw-bold px-3"
                    style={{ background: '#c4f039', color: '#111d15', borderRadius: '10px' }}
                  >
                    {guestModalBusy ? 'Confirmando...' : 'Confirmar Ingreso'}
                  </button>
                </div>
              </div>
            </form>
          )
        })()}
      </ModalDialog>

      <BiometricModal
        isOpen={showBiometricModal}
        onClose={() => setShowBiometricModal(false)}
        token={token}
        mode="authenticate"
        dni={biometricDni.trim() || null}
        onSuccess={handleBiometricSuccess}
      />
    </div>
  )
}

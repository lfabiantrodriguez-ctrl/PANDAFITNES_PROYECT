import { useEffect, useMemo, useState } from 'react'
import { DeviceService } from '../services/DeviceService'
import ViewTitle from '../components/ViewTitle'
import ModalDialog from '../components/ModalDialog'
import { CheckInService } from '../services/CheckInService'
import { formatDate, formatTimePeru, getMinutesElapsed } from '../utils/formatters'
import BiometricModal from '../components/BiometricModal'

export default function CheckInView({ token }) {
  // Pestaña activa: 'huella' | 'manual'
  const [activeTab, setActiveTab] = useState('huella')

  // Tiempo mínimo de entrenamiento para permitir salida biométrica (por defecto 20 min)
  const minTrainingMinutes = 20

  // Estado para Validación Manual
  const [manualCode, setManualCode] = useState('')
  const [manualUser, setManualUser] = useState(null)
  const [manualMembership, setManualMembership] = useState(null)
  const [manualActiveAttendance, setManualActiveAttendance] = useState(null)
  const [manualHistory, setManualHistory] = useState([])
  const [directDuration, setDirectDuration] = useState(60)

  // Estado para Validación Biométrica (Huella Digital)
  const [biometricDni, setBiometricDni] = useState('')
  const [showDniFallback, setShowDniFallback] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [biometricResult, setBiometricResult] = useState(null)
  const [biometricError, setBiometricError] = useState('')
  const [showBiometricModal, setShowBiometricModal] = useState(false)

  // Lista de clientes activos en sala en tiempo real
  const [activeClients, setActiveClients] = useState([])
  const [loadingActive, setLoadingActive] = useState(false)

  // Estados generales de alertas y modales
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })
  const [showManualModal, setShowManualModal] = useState(false)
  const [manualError, setManualError] = useState('')

  // Cargar clientes activos en el gimnasio al iniciar
  useEffect(() => {
    loadActiveClients()
    const timer = setInterval(() => {
      loadActiveClients()
    }, 12000)
    return () => clearInterval(timer)
  }, [token])

  async function loadActiveClients() {
    setLoadingActive(true)
    try {
      const data = await CheckInService.getActiveClients(token)
      if (data && data.clients) {
        setActiveClients(data.clients)
      }
    } catch {
      // Mantener lista existente si falla la conexión
    } finally {
      setLoadingActive(false)
    }
  }

  // =========================================================
  // MODO 1: VALIDACIÓN BIOMÉTRICA CON HUELLA DIGITAL (1-TOUCH)
  // =========================================================
  function handleFingerprintScan(dniToScan = null) {
    if (isScanning) return
    const rawDni = (dniToScan !== null ? dniToScan : biometricDni).trim()
    setBiometricError('')
    if (rawDni && !/^\d{8}$/.test(rawDni)) {
      setBiometricError('El DNI debe tener 8 dígitos numéricos.')
      return
    }
    setShowBiometricModal(true)
  }

  async function handleBiometricSuccess(authRes) {
    const targetDni = authRes.dni || biometricDni.trim()
    setIsScanning(true)
    setBiometricResult(null)
    setBiometricError('')
    try {
      const res = await CheckInService.biometricCheckIn(token, {
        dni: targetDni,
        deviceProof: authRes.proof,
        durationMinutes: 60,
        minDurationMinutes: minTrainingMinutes,
        forceExit: false,
      })

      setIsScanning(false)
      setBiometricResult(res)
      if (res.tipo === 'en_curso_reciente') {
        setStatus({
          loading: false,
          error: '',
          success: '',
        })
      } else {
        setStatus({
          loading: false,
          error: '',
          success: res.message || '¡Acceso verificado con éxito!',
        })
      }
      await loadActiveClients()
    } catch (err) {
      setIsScanning(false)
      const msg = err.message || 'Error al validar la huella digital del socio.'
      setBiometricError(msg)
      setStatus({
        loading: false,
        error: msg,
        success: '',
      })
    }
  }

  async function executeBiometricVerification(dni = null, forceExit = false) {
    if (isScanning) return
    setIsScanning(true)
    setBiometricResult(null)
    setBiometricError('')
    try {
      // Autenticación con sensor / celular (sin requerir DNI previo si es null)
      const authRes = await DeviceService.authenticate(token, dni)
      await handleBiometricSuccess(authRes)
    } catch (err) {
      setIsScanning(false)
      const msg = err.message || 'Error al validar la huella digital del socio.'
      setBiometricError(msg)
      setStatus({
        loading: false,
        error: msg,
        success: '',
      })
    }
  }

  // =========================================================
  // MODO 2: VALIDACIÓN MANUAL EN RECEPCIÓN (CHECK-IN RÁPIDO)
  // =========================================================
  async function handleManualLookup() {
    setManualError('')
    if (!manualCode.trim()) {
      setManualError('Ingresa el DNI o nombre del socio para realizar la búsqueda')
      return
    }

    setStatus({ loading: true, error: '', success: '' })
    setManualUser(null)
    setManualMembership(null)
    setManualActiveAttendance(null)

    try {
      const data = await CheckInService.lookupReservation(token, manualCode.trim())
      setManualUser(data.user)
      setManualMembership(data.membership)
      setManualActiveAttendance(data.activeAttendance || null)
      setManualHistory(data.history || [])
      setStatus({ loading: false, error: '', success: '' })
    } catch (err) {
      setManualError(err.message || 'No se encontró ningún socio o membresía con este identificador')
      setStatus({ loading: false, error: '', success: '' })
    }
  }

  async function handleManualDirectCheckIn(targetId = null) {
    const id = targetId || manualUser?.id
    if (!id) return
    setStatus({ loading: true, error: '', success: '' })
    try {
      await CheckInService.confirmDirectEntry(token, id, directDuration)
      setStatus({ loading: false, error: '', success: `¡Ingreso registrado con éxito para ${manualUser?.nombre || 'el socio'}!` })
      setShowManualModal(false)
      setManualCode('')
      setManualUser(null)
      await loadActiveClients()
    } catch (err) {
      setStatus({ loading: false, error: err.message || 'No se pudo registrar el ingreso directo', success: '' })
    }
  }

  async function handleManualCheckout(attendanceId, userName = '') {
    setStatus({ loading: true, error: '', success: '' })
    try {
      await CheckInService.finalizeReservation(token, attendanceId)
      setStatus({ loading: false, error: '', success: `¡Salida registrada con éxito para ${userName || 'el socio'}!` })
      setShowManualModal(false)
      setManualCode('')
      setManualUser(null)
      await loadActiveClients()
    } catch (err) {
      setStatus({ loading: false, error: err.message || 'No se pudo registrar la salida', success: '' })
    }
  }

  // Finalizar salida de cliente activo en la sala
  async function handleQuickCheckout(client) {
    setStatus({ loading: true, error: '', success: '' })
    try {
      if (client.id) {
        await CheckInService.finalizeReservation(token, client.id)
      } else {
        throw new Error('Selecciona una asistencia válida para registrar la salida.')
      }
      setStatus({ loading: false, error: '', success: `¡Salida registrada para ${client.nombre} ${client.apellido}!` })
      await loadActiveClients()
    } catch (err) {
      setStatus({ loading: false, error: err.message || 'No se pudo registrar la salida', success: '' })
    }
  }

  return (
    <div className="dashboard-page" style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Encabezado Principal */}
      <div className="view-header-row d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <ViewTitle
            title="Control de Acceso y Asistencias"
            subtitle=""
          />
        </div>

        {/* Contador rápido de aforo en sala */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e3e8e2',
            borderRadius: '14px',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 4px 14px rgba(18, 31, 23, 0.04)',
          }}
        >
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', animation: 'pulseDot 2s infinite' }}></span>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#5f7165' }}>Socios en el club ahora:</span>
          <strong style={{ fontSize: '1.25rem', fontWeight: 900, color: '#111d15' }}>{activeClients.length}</strong>
        </div>
      </div>

      {/* Banners de Notificación */}
      {status.success && (
        <div
          className="alert d-flex align-items-center gap-2 py-3 px-4 rounded-3 border mb-4"
          style={{ background: '#ecfccb', borderColor: '#d9f99d', color: '#15803d', fontWeight: 600 }}
        >
          <span>✓</span>
          <span>{status.success}</span>
        </div>
      )}

      {status.error && (
        <div
          className="alert d-flex align-items-center gap-2 py-3 px-4 rounded-3 border mb-4"
          style={{ background: '#fee2e2', borderColor: '#fecaca', color: '#b91c1c', fontWeight: 600 }}
        >
          <span>⚠</span>
          <span>{status.error}</span>
        </div>
      )}

      {/* Selector de Pestañas: HUELLA DIGITAL vs MANUAL RECEPCIÓN */}
      <div
        style={{
          display: 'flex',
          background: '#ffffff',
          borderRadius: '16px',
          padding: '6px',
          border: '1px solid #e3e8e2',
          marginBottom: '26px',
          boxShadow: '0 2px 8px rgba(18, 31, 23, 0.04)',
          maxWidth: '520px',
        }}
      >
        <button
          type="button"
          onClick={() => {
            setActiveTab('huella')
            setStatus({ loading: false, error: '', success: '' })
          }}
          style={{
            flex: 1,
            padding: '12px 18px',
            borderRadius: '12px',
            border: 'none',
            background: activeTab === 'huella' ? '#111d15' : 'transparent',
            color: activeTab === 'huella' ? '#c4f039' : '#5f7165',
            fontWeight: 800,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
          }}
        >
          <i className="bi bi-fingerprint"></i>
          <span>Huella Digital (Biométrico)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('manual')
            setStatus({ loading: false, error: '', success: '' })
          }}
          style={{
            flex: 1,
            padding: '12px 18px',
            borderRadius: '12px',
            border: 'none',
            background: activeTab === 'manual' ? '#111d15' : 'transparent',
            color: activeTab === 'manual' ? '#c4f039' : '#5f7165',
            fontWeight: 800,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
          }}
        >
          <i className="bi bi-pencil-square"></i>
          <span>Validación Manual</span>
        </button>
      </div>

      {/* =====================================================
          CONTENIDO PESTAÑA 1: ESCÁNER DE HUELLA DIGITAL
          ===================================================== */}
      {activeTab === 'huella' && (
        <div className="checkin-biometric-grid">
          <div className="checkin-scanner-card">
            <div style={{ maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>
              <div
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  background: isScanning ? '#111d15' : '#f0fdf4',
                  border: isScanning ? '3px solid #c4f039' : '2px dashed #86efac',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 18px',
                  transition: 'all 0.3s ease',
                  boxShadow: isScanning ? '0 0 25px rgba(196, 240, 57, 0.45)' : 'none',
                }}
              >
                <i
                  className={`bi ${isScanning ? 'bi-hourglass-split' : 'bi-fingerprint'}`}
                  style={{
                    fontSize: 52,
                    color: isScanning ? '#c4f039' : '#15803d',
                    transition: 'all 0.3s ease',
                  }}
                  aria-hidden="true"
                />
              </div>

              <h3 className="mt-2 mb-2" style={{ fontWeight: 800, color: '#111d15' }}>
                Control de Acceso Biométrico
              </h3>
              <p className="text-muted small mb-4">
                Coloca tu huella en el lector o confirma en tu celular vinculado para validar tu ingreso o salida automáticamente.
              </p>

              <button
                type="button"
                className="btn w-100 py-3 fw-bold mb-3 shadow-sm"
                style={{
                  background: isScanning ? '#111d15' : '#c4f039',
                  color: isScanning ? '#c4f039' : '#111d15',
                  fontSize: '1.05rem',
                  borderRadius: '14px',
                  border: 'none',
                  transition: 'all 0.2s ease',
                }}
                disabled={isScanning}
                onClick={() => handleFingerprintScan()}
              >
                <i className={`bi ${isScanning ? 'bi-hourglass-split' : 'bi-fingerprint'} me-2`} />
                {isScanning ? 'Leyendo huella… Confirma en el dispositivo' : 'Colocar huella / Validar'}
              </button>

              {/* Opción secundaria: Validar por DNI específico */}
              <div className="text-center mt-2">
                <button
                  type="button"
                  className="btn btn-link text-decoration-none small text-muted p-0"
                  style={{ fontSize: '0.8rem' }}
                  onClick={() => setShowDniFallback(!showDniFallback)}
                >
                  <i className={`bi ${showDniFallback ? 'bi-chevron-up' : 'bi-sliders'} me-1`}></i>
                  {showDniFallback ? 'Ocultar búsqueda por DNI' : '¿Validar por un DNI específico?'}
                </button>
              </div>

              {showDniFallback && (
                <div className="mt-3 p-3 rounded-3 bg-light border text-start" style={{ animation: 'fadeIn 0.2s ease' }}>
                  <label htmlFor="device-checkin-dni" className="form-label small fw-bold text-dark mb-1">
                    DNI específico (Opcional)
                  </label>
                  <div className="d-flex gap-2">
                    <input
                      id="device-checkin-dni"
                      className="form-control form-control-sm"
                      inputMode="numeric"
                      maxLength={8}
                      placeholder="8 dígitos"
                      value={biometricDni}
                      disabled={isScanning}
                      onChange={(e) => setBiometricDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-dark px-3 fw-bold"
                      disabled={isScanning || biometricDni.length !== 8}
                      onClick={() => handleFingerprintScan(biometricDni)}
                    >
                      Validar
                    </button>
                  </div>
                </div>
              )}

              {biometricError && (
                <p role="alert" className="text-danger small mt-3 mb-0">
                  <i className="bi bi-exclamation-triangle-fill me-1"></i>
                  {biometricError}
                </p>
              )}
            </div>
          </div>

          {/* Resultado Biométrico en Pantalla */}
          <div className="checkin-result-card">
            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#111d15', margin: '0 0 18px 0' }}>
              Estado del Acceso Biométrico
            </h4>

            {biometricResult ? (
              <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s ease' }}>
                {/* 1. CASO: ENTRADA AUTORIZADA */}
                {biometricResult.tipo === 'entrada' && (
                  <>
                    <div
                      style={{
                        width: '74px',
                        height: '74px',
                        borderRadius: '50%',
                        background: '#ecfccb',
                        border: '3px solid #84cc16',
                        color: '#15803d',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        margin: '0 auto 16px',
                        boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
                      }}
                    >
                      <i className="bi bi-check-lg"></i>
                    </div>

                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 14px',
                        borderRadius: '9999px',
                        background: '#ecfccb',
                        color: '#15803d',
                        fontWeight: 800,
                        fontSize: '0.76rem',
                        marginBottom: '8px',
                      }}
                    >
                      ACCESO AUTORIZADO
                    </span>

                    <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#111d15', margin: '0 0 4px 0' }}>
                      {biometricResult.user?.nombre} {biometricResult.user?.apellido}
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: '#5f7165', margin: '0 0 16px 0' }}>
                      DNI: {biometricResult.user?.dni}
                    </p>

                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '14px', textAlign: 'left', fontSize: '0.82rem', color: '#334155', lineHeight: 1.6, marginBottom: '16px' }}>
                      <div><strong>Método:</strong> Dispositivo verificado <i className="bi bi-fingerprint text-success ms-1"></i></div>
                      <div><strong>Hora de Ingreso:</strong> {formatTimePeru(biometricResult.horaEntrada || new Date())} hrs (Hora Perú)</div>
                      <div style={{ color: '#166534', fontWeight: 700, marginTop: '4px' }}>
                        <i className="bi bi-lightning-charge-fill text-warning me-1"></i>
                        +{biometricResult.xpSumados ?? 0} XP y +{biometricResult.bambusSumados ?? 0} bambús otorgados a Mi Pandita
                      </div>
                    </div>
                  </>
                )}

                {/* 2. CASO: SALIDA CONFIRMADA */}
                {biometricResult.tipo === 'salida' && (
                  <>
                    <div
                      style={{
                        width: '74px',
                        height: '74px',
                        borderRadius: '50%',
                        background: '#e0f2fe',
                        border: '3px solid #0284c7',
                        color: '#0369a1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        margin: '0 auto 16px',
                        boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
                      }}
                    >
                      <i className="bi bi-box-arrow-right"></i>
                    </div>

                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 14px',
                        borderRadius: '9999px',
                        background: '#e0f2fe',
                        color: '#0369a1',
                        fontWeight: 800,
                        fontSize: '0.76rem',
                        marginBottom: '8px',
                      }}
                    >
                      SALIDA CONFIRMADA
                    </span>

                    <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#111d15', margin: '0 0 4px 0' }}>
                      {biometricResult.user?.nombre} {biometricResult.user?.apellido}
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: '#5f7165', margin: '0 0 16px 0' }}>
                      DNI: {biometricResult.user?.dni}
                    </p>

                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '14px', textAlign: 'left', fontSize: '0.82rem', color: '#334155', lineHeight: 1.6, marginBottom: '16px' }}>
                      <div><strong>Método:</strong> Sensor Biométrico de Huella Digital <i className="bi bi-fingerprint text-primary ms-1"></i></div>
                      <div><strong>Hora de Salida:</strong> {formatTimePeru(biometricResult.horaSalida || new Date())} hrs (Hora Perú)</div>
                      <div style={{ color: '#0369a1', fontWeight: 700, marginTop: '4px' }}>
                        <i className="bi bi-activity text-primary me-1"></i>
                        Sesión completada: {biometricResult.tiempoTexto || 'Entrenamiento finalizado'}
                      </div>
                      <div style={{ color: '#166534', fontSize: '0.78rem', marginTop: '2px' }}>
                        <i className="bi bi-check-circle-fill text-success me-1"></i>
                        Asistencia registrada y puntos consolidados en Mi Pandita
                      </div>
                    </div>
                  </>
                )}

                {/* 3. CASO: ENTRENAMIENTO EN CURSO (RECIENTE INGRESO) */}
                {biometricResult.tipo === 'en_curso_reciente' && (
                  <>
                    <div
                      style={{
                        width: '74px',
                        height: '74px',
                        borderRadius: '50%',
                        background: '#fef3c7',
                        border: '3px solid #f59e0b',
                        color: '#b45309',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        margin: '0 auto 16px',
                        boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
                      }}
                    >
                      <i className="bi bi-hourglass-split"></i>
                    </div>

                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 14px',
                        borderRadius: '9999px',
                        background: '#fef3c7',
                        color: '#b45309',
                        fontWeight: 800,
                        fontSize: '0.76rem',
                        marginBottom: '8px',
                      }}
                    >
                      ENTRENAMIENTO EN CURSO
                    </span>

                    <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#111d15', margin: '0 0 4px 0' }}>
                      {biometricResult.user?.nombre} {biometricResult.user?.apellido}
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: '#5f7165', margin: '0 0 16px 0' }}>
                      DNI: {biometricResult.user?.dni}
                    </p>

                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '14px', borderRadius: '14px', textAlign: 'left', fontSize: '0.82rem', color: '#92400e', lineHeight: 1.6, marginBottom: '16px' }}>
                      <div><strong>Ingreso registrado a las:</strong> {formatTimePeru(biometricResult.horaEntrada)} hrs</div>
                      <div><strong>Tiempo en sala:</strong> {biometricResult.minutosTranscurridos} minutos entrenando</div>
                      <div className="mt-2" style={{ color: '#78350f' }}>
                        <i className="bi bi-info-circle-fill text-warning me-1"></i>
                        Para validar tu salida con huella y asegurar tus puntos de Mi Pandita, debes entrenar un mínimo de <strong>{biometricResult.minutosMinimos} min</strong> (faltan {biometricResult.minutosRestantes} min).
                      </div>
                    </div>

                    {biometricResult.canForceExit && (
                      <button
                        type="button"
                        onClick={() => executeBiometricVerification(biometricResult.user?.dni, true)}
                        className="btn btn-outline-danger btn-sm w-100 py-2 mb-2 fw-bold"
                        style={{ borderRadius: '10px' }}
                      >
                        <i className="bi bi-box-arrow-right me-1"></i>
                        Forzar Salida Anticipada (Recepción)
                      </button>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setBiometricResult(null)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#111d15',
                    color: '#c4f039',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Listo para siguiente socio
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>
                  <i className="bi bi-fingerprint" style={{ fontSize: '2.8rem', color: '#94a3b8' }}></i>
                </div>
                <p style={{ fontSize: '0.86rem', margin: 0 }}>
                  Aún no se ha realizado ninguna lectura biométrica en esta sesión.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================
          CONTENIDO PESTAÑA 2: VALIDACIÓN MANUAL EN RECEPCIÓN
          ===================================================== */}
      {activeTab === 'manual' && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '32px',
            border: '1px solid #e3e8e2',
            boxShadow: '0 6px 24px rgba(18, 31, 23, 0.05)',
            marginBottom: '32px',
          }}
        >
          <div style={{ maxWidth: '680px', margin: '0 auto' }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#111d15', marginBottom: '8px', textAlign: 'center' }}>
              Validación Manual de Entrada en Recepción
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#5f7165', marginBottom: '24px', textAlign: 'center' }}>
              Busca al socio por su número de documento o nombre para comprobar su membresía, turno y autorizar su acceso manualmente.
            </p>

            <div style={{ display: 'flex', gap: '10px', marginBottom: manualError ? '8px' : '20px' }}>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => {
                  setManualCode(e.target.value)
                  if (manualError) setManualError('')
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleManualLookup()}
                placeholder="Ingresa DNI o nombre completo del socio..."
                className={`form-control ${manualError ? 'is-invalid' : ''}`}
                style={{
                  borderRadius: '12px',
                  padding: '14px 18px',
                  fontSize: '1rem',
                  border: manualError ? '1.5px solid #ef4444' : '1.5px solid #cbd5e1',
                  backgroundColor: manualError ? '#fef2f2' : '#ffffff',
                }}
              />
              <button
                type="button"
                disabled={status.loading || !manualCode.trim()}
                onClick={handleManualLookup}
                style={{
                  padding: '14px 28px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#c4f039',
                  color: '#111d15',
                  fontWeight: 800,
                  fontSize: '0.96rem',
                  cursor: status.loading || !manualCode.trim() ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(196, 240, 57, 0.35)',
                  whiteSpace: 'nowrap',
                }}
              >
                {status.loading ? (
                  'Buscando...'
                ) : (
                  <>
                    <i className="bi bi-search me-1"></i> Buscar Socio
                  </>
                )}
              </button>
            </div>
            {manualError && (
              <div className="text-danger small mb-3 d-flex align-items-center gap-1" style={{ fontSize: '0.82rem' }}>
                <i className="bi bi-exclamation-circle-fill"></i>
                <span>{manualError}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================
          TABLA EN VIVO: SOCIOS ACTIVOS EN EL GIMNASIO AHORA
          ===================================================== */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          padding: '28px',
          border: '1px solid #e3e8e2',
          boxShadow: '0 4px 18px rgba(18, 31, 23, 0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#111d15', margin: '0 0 4px 0' }}>
              Socios Entrenando Ahora ({activeClients.length})
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#5f7165', margin: 0 }}>
              Control de asistencias en sala con registro de método (Huella o Recepción Manual).
            </p>
          </div>

          <button
            type="button"
            onClick={loadActiveClients}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="bi bi-arrow-clockwise"></i>
            <span>Actualizar lista</span>
          </button>
        </div>

        {activeClients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px', color: '#94a3b8', fontSize: '0.9rem' }}>
            No hay socios con ingreso activo en este momento.
          </div>
        ) : (
          <>
            {/* VISTA DESKTOP: TABLA CORPORATIVA */}
            <div className="table-responsive d-none d-md-block">
              <table className="table table-hover align-middle m-0">
                <thead>
                  <tr>
                    <th>Socio</th>
                    <th>DNI</th>
                    <th>Hora de Ingreso</th>
                    <th>Método</th>
                    <th>Estado</th>
                    <th className="text-end">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {activeClients.map((client) => (
                    <tr key={client.id}>
                      <td className="px-3 fw-bold text-dark">
                        {client.nombre} {client.apellido}
                      </td>
                      <td className="px-3 text-muted">{client.dni}</td>
                      <td className="px-3 font-monospace">{formatTimePeru(client.horaEntrada)} hrs</td>
                      <td className="px-3">
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            background: client.metodoRegistro === 'huella' ? '#ecfccb' : '#f1f5f9',
                            color: client.metodoRegistro === 'huella' ? '#15803d' : '#475569',
                            border: client.metodoRegistro === 'huella' ? '1px solid #d9f99d' : '1px solid #e2e8f0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <i className={client.metodoRegistro === 'huella' ? 'bi bi-fingerprint' : 'bi bi-pencil-square'}></i>
                          <span>{client.metodoRegistro === 'huella' ? 'Huella Digital' : 'Manual'}</span>
                        </span>
                      </td>
                      <td className="px-3">
                        <span className="badge text-dark" style={{ background: '#ecfccb', border: '1px solid #d9f99d', fontSize: '0.74rem' }}>
                          En Entrenamiento
                        </span>
                      </td>
                      <td className="px-3 text-end">
                        <button
                          type="button"
                          onClick={() => handleQuickCheckout(client)}
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* VISTA MÓVIL: TARJETAS NATIVAS ERGONÓMICAS */}
            <div className="d-block d-md-none p-3">
              <div className="mobile-card-list">
                {activeClients.map((client) => (
                  <div key={client.id} className="mobile-data-card">
                    {/* Header */}
                    <div className="mobile-card-header">
                      <div className="mobile-card-identity">
                        <div className="mobile-card-avatar" style={{ fontSize: '0.8rem' }}>
                          {client.nombre?.charAt(0)}{client.apellido?.charAt(0)}
                        </div>
                        <div className="mobile-card-titles">
                          <h4 className="mobile-card-title">{client.nombre} {client.apellido}</h4>
                          <p className="mobile-card-subtitle">DNI: {client.dni || 'Sin DNI'}</p>
                        </div>
                      </div>
                      <div>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            background: client.metodoRegistro === 'huella' ? '#ecfccb' : '#f1f5f9',
                            color: client.metodoRegistro === 'huella' ? '#15803d' : '#475569',
                            border: client.metodoRegistro === 'huella' ? '1px solid #d9f99d' : '1px solid #e2e8f0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <i className={client.metodoRegistro === 'huella' ? 'bi bi-fingerprint' : 'bi bi-pencil-square'}></i>
                          <span>{client.metodoRegistro === 'huella' ? 'Huella' : 'Manual'}</span>
                        </span>
                      </div>
                    </div>

                    {/* Grid */}
                    <div className="mobile-card-body-grid">
                      <div className="mobile-card-field">
                        <div className="mobile-card-label">Hora Ingreso</div>
                        <div className="mobile-card-value font-monospace">
                          <i className="bi bi-clock me-1 text-muted"></i>
                          {formatTimePeru(client.horaEntrada)} hrs
                        </div>
                      </div>

                      <div className="mobile-card-field">
                        <div className="mobile-card-label">Estado Actual</div>
                        <div className="mobile-card-value" style={{ color: '#166534' }}>
                          <i className="bi bi-circle-fill text-success me-1" style={{ fontSize: '0.65rem' }}></i>
                          En Entrenamiento
                        </div>
                      </div>
                    </div>

                    {/* Acción Salida */}
                    <div className="mobile-card-actions">
                      <button
                        type="button"
                        onClick={() => handleQuickCheckout(client)}
                        className="btn btn-outline-danger fw-bold w-100 py-2 d-flex align-items-center justify-content-center gap-2"
                        style={{
                          borderRadius: '10px',
                          fontSize: '0.84rem',
                        }}
                      >
                        <i className="bi bi-box-arrow-right"></i>
                        <span>Registrar Salida del Club</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* =====================================================
          MODAL: FICHA DE SOCIO PARA VALIDACIÓN MANUAL
          ===================================================== */}
      <ModalDialog
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        title={manualUser ? `${manualUser.nombre} ${manualUser.apellido}` : 'Validación Manual'}
        subtitle={manualUser ? `DNI: ${manualUser.dni} · ${manualUser.email || 'Sin correo'}` : ''}
        badge="Recepción"
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
            <button
              type="button"
              className="btn btn-outline-dark px-3 py-2 fw-semibold"
              onClick={() => setShowManualModal(false)}
            >
              Cancelar
            </button>

            {manualMembership && manualMembership.estado === 'activo' ? (
              <button
                type="button"
                className="btn btn-dark px-4 py-2 fw-bold d-inline-flex align-items-center gap-1"
                onClick={handleManualDirectCheckIn}
                style={{ background: '#c4f039', color: '#111d15', border: 'none' }}
              >
                <i className="bi bi-check-lg"></i>
                <span>Autorizar Entrada a Sala ({directDuration} min)</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary px-3 py-2 fw-bold"
                disabled
              >
                Membresía No Válida
              </button>
            )}
          </div>
        }
      >
        {manualUser && (
          <div>
            {/* Estado de Membresía */}
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '14px', marginBottom: '18px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#64748b' }}>Plan de Membresía:</span>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    background: manualMembership && manualMembership.estado === 'activo' ? '#ecfccb' : '#fee2e2',
                    color: manualMembership && manualMembership.estado === 'activo' ? '#15803d' : '#b91c1c',
                  }}
                >
                  {manualMembership && manualMembership.estado === 'activo' ? 'ACTIVO' : 'SIN MEMBRESÍA VIGENTE'}
                </span>
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#111d15' }}>
                {manualMembership ? manualMembership.planNombre : 'Sin plan contratado'}
              </div>
              {manualMembership && (
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                  Vence el: {formatDate(manualMembership.fechaFin)}
                </div>
              )}
            </div>

            {/* Selector de Duración de Ingreso Directo */}
            {canDirectCheckIn && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Tiempo Estimado de Sesión:
                </label>
                <select
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
            )}

            {/* Resumen de Asistencias Pasadas */}
            {manualHistory && manualHistory.length > 0 && (
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                  Últimos accesos registrados:
                </span>
                <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                  {manualHistory.slice(0, 3).map((h) => (
                    <div key={h.id} style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span>{formatDate(h.horaEntrada)} ({formatTimePeru(h.horaEntrada)} hrs)</span>
                      <span style={{ fontWeight: 700, color: h.metodoRegistro === 'huella' ? '#15803d' : '#475569' }}>
                        {h.metodoRegistro === 'huella' ? '👆 Huella' : '✍️ Manual'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
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

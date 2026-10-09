import { useEffect, useMemo, useState } from 'react'
import ViewTitle from '../components/ViewTitle'
import ModalDialog from '../components/ModalDialog'
import { CheckInService } from '../services/CheckInService'
import { formatDate, formatTimePeru, getMinutesElapsed } from '../utils/formatters'

export default function CheckInView({ token }) {
  // Pestaña activa: 'huella' | 'manual'
  const [activeTab, setActiveTab] = useState('huella')

  // Tiempo mínimo de entrenamiento para permitir salida biométrica (por defecto 20 min)
  const [minTrainingMinutes, setMinTrainingMinutes] = useState(20)

  // Estado para Validación Manual
  const [manualCode, setManualCode] = useState('')
  const [manualUser, setManualUser] = useState(null)
  const [manualMembership, setManualMembership] = useState(null)
  const [manualActiveAttendance, setManualActiveAttendance] = useState(null)
  const [manualHistory, setManualHistory] = useState([])
  const [directDuration, setDirectDuration] = useState(60)

  // Estado para Validación Biométrica (Huella Digital)
  const [biometricDni, setBiometricDni] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [biometricResult, setBiometricResult] = useState(null)
  const [biometricError, setBiometricError] = useState('')

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
  // MODO 1: VALIDACIÓN BIOMÉTRICA CON HUELLA DIGITAL
  // =========================================================
  async function handleFingerprintScan(dniToScan = null) {
    const dni = (dniToScan || biometricDni).trim()
    setBiometricError('')

    if (!dni || dni.length !== 8) {
      setBiometricError('Ingresa un DNI válido de 8 dígitos numéricos para validar huella')
      return
    }

    setStatus({ loading: false, error: '', success: '' })
    setIsScanning(true)
    setScanProgress(0)
    setBiometricResult(null)

    // Simulación de escaneo biométrico con animación realista de lectura
    let current = 0
    const interval = setInterval(() => {
      current += 20
      setScanProgress(current)
      if (current >= 100) {
        clearInterval(interval)
        executeBiometricVerification(dni)
      }
    }, 120)
  }

  async function executeBiometricVerification(dni, forceExit = false) {
    try {
      const res = await CheckInService.biometricCheckIn(token, {
        dni,
        durationMinutes: 60,
        minDurationMinutes: minTrainingMinutes,
        forceExit,
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
          success: res.message || '¡Operación biométrica completada con éxito!',
        })
      }
      await loadActiveClients()
    } catch (err) {
      setIsScanning(false)
      setStatus({
        loading: false,
        error: err.message || 'Error al validar la huella digital del socio.',
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
        await CheckInService.biometricCheckIn(token, { dni: client.dni, forceExit: true })
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
            subtitle="Validación biométrica con huella dactilar y confirmación manual en recepción."
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
          <span>👆</span>
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
          <span>✍️</span>
          <span>Validación Manual</span>
        </button>
      </div>

      {/* =====================================================
          CONTENIDO PESTAÑA 1: ESCÁNER DE HUELLA DIGITAL
          ===================================================== */}
      {activeTab === 'huella' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 380px',
            gap: '24px',
            alignItems: 'start',
            marginBottom: '32px',
          }}
        >
          {/* Card del Lector Biométrico */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              padding: '36px',
              border: '1px solid #e3e8e2',
              boxShadow: '0 6px 24px rgba(18, 31, 23, 0.05)',
              textAlign: 'center',
            }}
          >
            <div style={{ maxWidth: '440px', margin: '0 auto' }}>
              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  background: 'rgba(196, 240, 57, 0.25)',
                  color: '#166534',
                  padding: '4px 14px',
                  borderRadius: '9999px',
                  letterSpacing: '0.06em',
                  display: 'inline-block',
                  marginBottom: '16px',
                }}
              >
                Sensor Biométrico Óptico Activo
              </span>

              <h3 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#111d15', marginBottom: '8px' }}>
                Coloca la huella digital en el lector
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#5f7165', marginBottom: '28px' }}>
                El sensor verificará la membresía del socio en 0.5s y registrará automáticamente la entrada o salida sumando +25 XP a su pandita.
              </p>

              {/* Animación del Sensor de Huella */}
              <div
                onClick={() => !isScanning && handleFingerprintScan()}
                style={{
                  width: '160px',
                  height: '160px',
                  margin: '0 auto 28px',
                  borderRadius: '50%',
                  background: isScanning
                    ? 'radial-gradient(circle, rgba(196, 240, 57, 0.4) 0%, rgba(17, 29, 21, 0.95) 75%)'
                    : 'radial-gradient(circle, #f4f6f3 0%, #ffffff 80%)',
                  border: isScanning ? '3px solid #c4f039' : '3px dashed #cbd5e1',
                  boxShadow: isScanning ? '0 0 35px rgba(196, 240, 57, 0.6)' : '0 4px 16px rgba(0,0,0,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isScanning ? 'wait' : 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                }}
                title="Presiona para escanear huella digital"
              >
                {/* SVG Huella Dactilar */}
                <svg
                  width="78"
                  height="78"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={isScanning ? '#c4f039' : '#111d15'}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transition: 'stroke 0.2s ease' }}
                >
                  <path d="M12 12c0-3 2.5-5.5 5.5-5.5.8 0 1.5.2 2.2.5"></path>
                  <path d="M8.5 7.5A6.5 6.5 0 0 1 12 6.5c4.1 0 7.5 3.4 7.5 7.5 0 2.2-.9 4.3-2.3 5.8"></path>
                  <path d="M5 12c0-3.9 3.1-7 7-7 2.3 0 4.4 1.1 5.7 2.8"></path>
                  <path d="M12 21a9 9 0 0 1-9-9c0-2.5 1-4.7 2.6-6.4"></path>
                  <path d="M12 15a3 3 0 0 1-3-3c0-.8.3-1.6.9-2.1"></path>
                  <path d="M12 18a6 6 0 0 1-6-6"></path>
                  <path d="M12 12v6"></path>
                </svg>

                {/* Línea Láser Escáner */}
                {isScanning && (
                  <div
                    style={{
                      position: 'absolute',
                      top: `${scanProgress}%`,
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: '#c4f039',
                      boxShadow: '0 0 14px 4px #c4f039',
                      transition: 'top 0.1s linear',
                    }}
                  />
                )}
              </div>

              {/* Selector de tiempo mínimo de permanencia para salida */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', background: '#f8fafc', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                  <i className="bi bi-stopwatch me-1 text-success"></i>
                  Tiempo mín. permanencia para salida:
                </span>
                <select
                  value={minTrainingMinutes}
                  onChange={(e) => setMinTrainingMinutes(Number(e.target.value))}
                  className="form-select form-select-sm"
                  style={{ width: 'auto', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700 }}
                >
                  <option value={1}>1 min (modo prueba)</option>
                  <option value={15}>15 minutos</option>
                  <option value={20}>20 minutos (estándar)</option>
                  <option value={30}>30 minutos</option>
                  <option value={45}>45 minutos</option>
                </select>
              </div>

              {/* Selector / Ingreso rápido de DNI para simulación */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  DNI del Socio para Lector Biométrico:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={biometricDni}
                    onChange={(e) => {
                      setBiometricDni(e.target.value.replace(/\D/g, '').slice(0, 8))
                      if (biometricError) setBiometricError('')
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleFingerprintScan()}
                    placeholder="Ingresa DNI (ej: 12345678)..."
                    className={`form-control ${biometricError ? 'is-invalid' : ''}`}
                    style={{
                      borderRadius: '12px',
                      padding: '12px 16px',
                      fontSize: '0.95rem',
                      border: biometricError ? '1.5px solid #ef4444' : '1.5px solid #cbd5e1',
                      backgroundColor: biometricError ? '#fef2f2' : '#ffffff',
                    }}
                  />
                  <button
                    type="button"
                    disabled={isScanning || !biometricDni.trim()}
                    onClick={() => handleFingerprintScan()}
                    style={{
                      padding: '12px 22px',
                      borderRadius: '12px',
                      border: 'none',
                      background: '#c4f039',
                      color: '#111d15',
                      fontWeight: 800,
                      fontSize: '0.92rem',
                      cursor: isScanning || !biometricDni.trim() ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 12px rgba(196, 240, 57, 0.35)',
                    }}
                  >
                    {isScanning ? 'Escaneando...' : '👆 Validar Huella'}
                  </button>
                </div>
                {biometricError && (
                  <div className="text-danger small mt-2 d-flex align-items-center gap-1" style={{ fontSize: '0.8rem' }}>
                    <i className="bi bi-exclamation-circle-fill"></i>
                    <span>{biometricError}</span>
                  </div>
                )}
              </div>

              {/* Socios rápidos para prueba rápida de huella */}
              <div style={{ textAlign: 'left', background: '#f8fafc', padding: '14px 18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  Prueba rápida de huellas enroladas:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    { nombre: 'Brayan García', dni: '12345678' },
                    { nombre: 'Valeria Torres', dni: '71234567' },
                    { nombre: 'Diego Salas', dni: '72345678' },
                    { nombre: 'Camila Ríos', dni: '73456789' },
                    { nombre: 'Jorge Méndez', dni: '74567890' },
                  ].map((s) => (
                    <button
                      key={s.dni}
                      type="button"
                      onClick={() => {
                        setBiometricDni(s.dni)
                        handleFingerprintScan(s.dni)
                      }}
                      style={{
                        padding: '6px 12px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: '#111d15',
                        cursor: 'pointer',
                      }}
                    >
                      {s.nombre} ({s.dni})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Resultado Biométrico en Pantalla */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              padding: '28px',
              border: '1px solid #e3e8e2',
              boxShadow: '0 6px 24px rgba(18, 31, 23, 0.05)',
            }}
          >
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
                      <div><strong>Método:</strong> Sensor Biométrico de Huella Digital 👆</div>
                      <div><strong>Hora de Ingreso:</strong> {formatTimePeru(biometricResult.horaEntrada || new Date())} hrs (Hora Perú)</div>
                      <div style={{ color: '#166534', fontWeight: 700, marginTop: '4px' }}>
                        ⚡ +25 XP y +10 bambús otorgados a Mi Pandita
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
                      <div><strong>Método:</strong> Sensor Biométrico de Huella Digital 👆</div>
                      <div><strong>Hora de Salida:</strong> {formatTimePeru(biometricResult.horaSalida || new Date())} hrs (Hora Perú)</div>
                      <div style={{ color: '#0369a1', fontWeight: 700, marginTop: '4px' }}>
                        🏋️ Sesión completada: {biometricResult.tiempoTexto || 'Entrenamiento finalizado'}
                      </div>
                      <div style={{ color: '#166534', fontSize: '0.78rem', marginTop: '2px' }}>
                        ✓ Asistencia registrada y puntos consolidados en Mi Pandita
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
                        💡 Para validar tu salida con huella y asegurar tus puntos de Mi Pandita, debes entrenar un mínimo de <strong>{biometricResult.minutosMinimos} min</strong> (faltan {biometricResult.minutosRestantes} min).
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
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>👆</div>
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
                {status.loading ? 'Buscando...' : '🔍 Buscar Socio'}
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
            }}
          >
            ↻ Actualizar lista
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
                      <td className="px-3 font-monospace">{client.horaEntrada?.slice(11, 16)} hrs</td>
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
                          }}
                        >
                          {client.metodoRegistro === 'huella' ? '👆 Huella Digital' : '✍️ Manual'}
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
                          }}
                        >
                          {client.metodoRegistro === 'huella' ? '👆 Huella' : '✍️ Manual'}
                        </span>
                      </div>
                    </div>

                    {/* Grid */}
                    <div className="mobile-card-body-grid">
                      <div className="mobile-card-field">
                        <div className="mobile-card-label">Hora Ingreso</div>
                        <div className="mobile-card-value font-monospace">
                          🕒 {client.horaEntrada?.slice(11, 16)} hrs
                        </div>
                      </div>

                      <div className="mobile-card-field">
                        <div className="mobile-card-label">Estado Actual</div>
                        <div className="mobile-card-value" style={{ color: '#166534' }}>
                          🟢 En Entrenamiento
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
                        <span>🚪</span>
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
                className="btn btn-dark px-4 py-2 fw-bold"
                onClick={handleManualDirectCheckIn}
                style={{ background: '#c4f039', color: '#111d15', border: 'none' }}
              >
                ✓ Autorizar Entrada a Sala ({directDuration} min)
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
                  Vence el: {manualMembership.fechaFin?.slice(0, 10)}
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
                      <span>{h.horaEntrada?.slice(0, 10)} ({h.horaEntrada?.slice(11, 16)} hrs)</span>
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
    </div>
  )
}

import { useEffect, useRef, useState } from 'react';
import { DeviceService } from '../services/DeviceService';

export default function BiometricModal({
  isOpen,
  onClose,
  token,
  mode = 'register', // 'register' | 'authenticate'
  dni = null,
  socioNombre = '',
  onSuccess, // (result) => void
}) {
  const [activeMode, setActiveMode] = useState('auto'); // 'auto' | 'phone' | 'local' | 'simulate'
  const [status, setStatus] = useState('idle'); // 'idle' | 'waiting' | 'scanning' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [remoteSessionId, setRemoteSessionId] = useState(null);
  const [hasPlatform, setHasPlatform] = useState(false);
  const pollTimerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      setStatus('idle');
      setErrorMessage('');
      setSuccessMessage('');
      setRemoteSessionId(null);
      return;
    }

    DeviceService.hasPlatformAuthenticator().then((available) => {
      setHasPlatform(available);
      // Si tiene sensor nativo (ej. celular o laptop con lector), por defecto local
      // Si está en laptop común sin sensor, por defecto 'phone' o 'simulate'
      if (available) {
        setActiveMode('local');
      } else {
        setActiveMode('phone');
      }
    });

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen]);

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // 1. ESCÁNER LOCAL (Sensor nativo del dispositivo actual: celular o Windows Hello)
  async function handleLocalScan() {
    setStatus('scanning');
    setErrorMessage('');
    try {
      if (mode === 'register') {
        const res = await DeviceService.register(token, dni, { attachment: 'platform' });
        setStatus('success');
        setSuccessMessage('¡Huella registrada exitosamente!');
        setTimeout(() => {
          onSuccess(res);
          onClose();
        }, 1200);
      } else {
        const res = await DeviceService.authenticate(token, dni, { attachment: 'platform' });
        setStatus('success');
        setSuccessMessage(`¡Huella verificada para ${res.user?.nombre || 'socio'}!`);
        setTimeout(() => {
          onSuccess(res);
          onClose();
        }, 1200);
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Error al leer el sensor biométrico.');
    }
  }

  // 2. ESCÁNER REMOTO (Usar Celular conectado como sensor de la laptop)
  async function handlePhoneScan() {
    setStatus('waiting');
    setErrorMessage('');
    try {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);

      const sessionData = await DeviceService.createRemoteSession(token, {
        action: mode,
        dni,
        socioNombre,
      });

      const sessId = sessionData.session.id;
      setRemoteSessionId(sessId);

      // Polling cada 1.5s esperando confirmación del celular
      pollTimerRef.current = setInterval(async () => {
        try {
          const check = await DeviceService.getRemoteSessionStatus(token, sessId);
          if (check.session?.status === 'completed') {
            clearInterval(pollTimerRef.current);
            setStatus('success');
            setSuccessMessage('¡Huella capturada con éxito desde tu celular!');
            setTimeout(() => {
              onSuccess(check.session.result);
              onClose();
            }, 1200);
          } else if (check.session?.status === 'cancelled') {
            clearInterval(pollTimerRef.current);
            setStatus('idle');
            setErrorMessage('La sesión de escaneo fue cancelada.');
          }
        } catch (_) {}
      }, 1500);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Error al iniciar conexión con el celular.');
    }
  }

  // 3. SIMULADOR DE PRUEBAS EN PANTALLA
  async function handleSimulateScan() {
    setStatus('scanning');
    setErrorMessage('');
    try {
      await new Promise((r) => setTimeout(r, 700)); // Pequeña pausa para animación de escaneo
      if (mode === 'register') {
        const res = await DeviceService.simulateRegister(token, dni);
        setStatus('success');
        setSuccessMessage('¡Huella registrada mediante sensor biométrico simulado!');
        setTimeout(() => {
          onSuccess(res);
          onClose();
        }, 1200);
      } else {
        const res = await DeviceService.simulateAuthenticate(token, dni);
        setStatus('success');
        setSuccessMessage(`¡Acceso validado para ${res.user?.nombre || 'socio'}!`);
        setTimeout(() => {
          onSuccess(res);
          onClose();
        }, 1200);
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Error en la simulación de huella.');
    }
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(10, 15, 12, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: '#111d15',
          borderRadius: '24px',
          border: '1.5px solid rgba(196, 240, 57, 0.3)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 35px rgba(196, 240, 57, 0.15)',
          color: '#ffffff',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <span
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '12px',
                background: 'rgba(196, 240, 57, 0.15)',
                color: '#c4f039',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
              }}
            >
              <i className="bi bi-fingerprint"></i>
            </span>
            <div>
              <h5 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                {mode === 'register' ? 'Registro de Huella Digital' : 'Validación Biométrica'}
              </h5>
              <span style={{ fontSize: '0.78rem', color: '#8fa89b' }}>
                {dni ? `Socio DNI: ${dni}` : 'Control de Acceso Panda Fitness'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8fa89b',
              fontSize: '1.4rem',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            <i className="bi bi-x"></i>
          </button>
        </div>

        {/* Selector de Modo de Escaneo */}
        <div
          style={{
            padding: '12px 20px',
            background: 'rgba(255, 255, 255, 0.03)',
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <button
            type="button"
            className="btn btn-sm flex-fill"
            style={{
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.82rem',
              padding: '9px 12px',
              background: activeMode === 'local' ? '#c4f039' : 'rgba(255, 255, 255, 0.06)',
              color: activeMode === 'local' ? '#111d15' : '#8fa89b',
              border: 'none',
              transition: 'all 0.2s',
            }}
            onClick={() => {
              setActiveMode('local');
              setStatus('idle');
              setErrorMessage('');
            }}
          >
            <i className="bi bi-fingerprint me-1"></i>
            Sensor de Huella
          </button>

          <button
            type="button"
            className="btn btn-sm flex-fill"
            style={{
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.82rem',
              padding: '9px 12px',
              background: activeMode === 'simulate' ? '#c4f039' : 'rgba(255, 255, 255, 0.06)',
              color: activeMode === 'simulate' ? '#111d15' : '#8fa89b',
              border: 'none',
              transition: 'all 0.2s',
            }}
            onClick={() => {
              setActiveMode('simulate');
              setStatus('idle');
              setErrorMessage('');
            }}
          >
            <i className="bi bi-play-circle me-1"></i>
            Simular Huella
          </button>
        </div>

        {/* Área Central: Pad Biométrico Animado */}
        <div style={{ padding: '28px 24px', textAlign: 'center' }}>
          {/* Animación del Pad */}
          <div
            onClick={() => {
              if (activeMode === 'phone') handlePhoneScan();
              else if (activeMode === 'local') handleLocalScan();
              else handleSimulateScan();
            }}
            style={{
              width: '130px',
              height: '130px',
              margin: '0 auto 20px',
              borderRadius: '50%',
              background:
                status === 'success'
                  ? 'radial-gradient(circle, rgba(34, 197, 94, 0.25) 0%, rgba(17, 29, 21, 0.8) 70%)'
                  : status === 'error'
                  ? 'radial-gradient(circle, rgba(239, 68, 68, 0.25) 0%, rgba(17, 29, 21, 0.8) 70%)'
                  : 'radial-gradient(circle, rgba(196, 240, 57, 0.2) 0%, rgba(17, 29, 21, 0.8) 70%)',
              border: `2px solid ${
                status === 'success'
                  ? '#22c55e'
                  : status === 'error'
                  ? '#ef4444'
                  : '#c4f039'
              }`,
              boxShadow: `0 0 30px ${
                status === 'success'
                  ? 'rgba(34, 197, 94, 0.4)'
                  : status === 'error'
                  ? 'rgba(239, 68, 68, 0.4)'
                  : 'rgba(196, 240, 57, 0.35)'
              }`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.3s ease',
            }}
          >
            {/* Ícono central */}
            {status === 'success' ? (
              <i className="bi bi-check-lg" style={{ fontSize: '3.5rem', color: '#22c55e' }}></i>
            ) : status === 'error' ? (
              <i className="bi bi-exclamation-triangle" style={{ fontSize: '3rem', color: '#ef4444' }}></i>
            ) : (
              <i
                className="bi bi-fingerprint"
                style={{
                  fontSize: '4.2rem',
                  color: status === 'scanning' || status === 'waiting' ? '#c4f039' : '#8fa89b',
                  filter: status === 'scanning' ? 'drop-shadow(0 0 10px #c4f039)' : 'none',
                }}
              ></i>
            )}

            {/* Línea de escaneo láser */}
            {status === 'scanning' && (
              <div
                style={{
                  position: 'absolute',
                  width: '90%',
                  height: '3px',
                  background: '#c4f039',
                  boxShadow: '0 0 12px #c4f039',
                  borderRadius: '2px',
                  animation: 'laserScan 1.2s infinite alternate ease-in-out',
                }}
              />
            )}
          </div>

          {/* Estado y Mensajes */}
          {status === 'idle' && (
            <div>
              <h6 style={{ fontWeight: 800, color: '#ffffff', marginBottom: '6px' }}>
                {activeMode === 'phone'
                  ? 'Conecta o abre tu celular para escanear'
                  : activeMode === 'local'
                  ? 'Sensor biométrico listo'
                  : 'Haz clic en la huella para simular lectura'}
              </h6>
              <p style={{ fontSize: '0.82rem', color: '#8fa89b', marginBottom: '16px' }}>
                {activeMode === 'phone'
                  ? 'Al pulsar el botón, tu celular vibrará y te pedirá colocar el dedo en su sensor.'
                  : activeMode === 'local'
                  ? 'Se activará el sensor de huella dactilar de este dispositivo.'
                  : 'Prueba la validación y guardado sin necesidad de lector físico.'}
              </p>
              <button
                type="button"
                className="btn px-4 py-2 fw-bold"
                style={{
                  background: '#c4f039',
                  color: '#111d15',
                  borderRadius: '12px',
                  border: 'none',
                  fontSize: '0.92rem',
                }}
                onClick={() => {
                  if (activeMode === 'phone') handlePhoneScan();
                  else if (activeMode === 'local') handleLocalScan();
                  else handleSimulateScan();
                }}
              >
                <i className="bi bi-fingerprint me-2"></i>
                {activeMode === 'phone'
                  ? 'Solicitar huella al Celular'
                  : activeMode === 'local'
                  ? 'Activar Sensor Local'
                  : 'Simular Huella Dactilar'}
              </button>
            </div>
          )}

          {status === 'waiting' && (
            <div>
              <div className="spinner-border text-light mb-3" style={{ width: '2rem', height: '2rem', color: '#c4f039' }} role="status"></div>
              <h6 style={{ fontWeight: 800, color: '#ffffff', marginBottom: '6px' }}>
                Esperando huella en tu celular vinculado...
              </h6>
              <p style={{ fontSize: '0.82rem', color: '#8fa89b', marginBottom: '12px' }}>
                Abre <strong>/sensor-movil</strong> en tu celular o conecta por cable USB. En tu pantalla móvil saldrá la alerta para poner tu huella.
              </p>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                style={{ borderRadius: '8px' }}
                onClick={() => setStatus('idle')}
              >
                Cancelar espera
              </button>
            </div>
          )}

          {status === 'scanning' && (
            <div>
              <h6 style={{ fontWeight: 800, color: '#c4f039', marginBottom: '6px' }}>
                Leyendo huella digital…
              </h6>
              <p style={{ fontSize: '0.82rem', color: '#8fa89b', margin: 0 }}>
                Coloca tu dedo firmemente sobre el sensor biométrico.
              </p>
            </div>
          )}

          {status === 'success' && (
            <div>
              <h6 style={{ fontWeight: 800, color: '#22c55e', marginBottom: '4px' }}>
                ✓ ¡Lectura Exitosa!
              </h6>
              <p style={{ fontSize: '0.84rem', color: '#bbf7d0', margin: 0 }}>
                {successMessage}
              </p>
            </div>
          )}

          {status === 'error' && (
            <div>
              <h6 style={{ fontWeight: 800, color: '#ef4444', marginBottom: '4px' }}>
                Error en lectura
              </h6>
              <p style={{ fontSize: '0.82rem', color: '#fca5a5', marginBottom: '14px' }}>
                {errorMessage}
              </p>
              {errorMessage.includes('HTTPS o localhost') && (
                <div className="mb-3 p-2 rounded-3 text-start" style={{ background: 'rgba(255, 255, 255, 0.05)', fontSize: '0.78rem', color: '#cbd5e1' }}>
                  <div className="fw-bold text-warning mb-1">
                    <i className="bi bi-shield-exclamation me-1"></i> ¿Por qué ocurre esto?
                  </div>
                  Google Chrome bloquea el sensor de huella físico en direcciones IP sin candado (HTTP 192.168...).
                  <div className="mt-2 d-flex gap-2 flex-wrap">
                    <button
                      type="button"
                      className="btn btn-sm fw-bold w-100"
                      style={{ background: '#c4f039', color: '#111d15', borderRadius: '8px' }}
                      onClick={() => {
                        setActiveMode('simulate');
                        handleSimulateScan();
                      }}
                    >
                      <i className="bi bi-play-circle-fill me-1"></i> Continuar con Simulador de Huella
                    </button>
                  </div>
                </div>
              )}
              <button
                type="button"
                className="btn btn-sm px-3 py-1 fw-bold"
                style={{ background: '#334155', color: '#ffffff', borderRadius: '8px', border: 'none' }}
                onClick={() => setStatus('idle')}
              >
                Reintentar
              </button>
            </div>
          )}
        </div>

        {/* Pie con atajo directo */}
        <div
          style={{
            padding: '12px 20px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            fontSize: '0.76rem',
            color: '#8fa89b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span>
            <i className="bi bi-shield-check text-success me-1"></i>
            Biometría FIDO2 / WebAuthn protegida
          </span>
        </div>
      </div>

      <style>{`
        @keyframes laserScan {
          0% { top: 15%; opacity: 0.3; }
          50% { opacity: 1; }
          100% { top: 85%; opacity: 0.3; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { DeviceService } from '../services/DeviceService';
import BiometricModal from './BiometricModal';

export default function DeviceEnrollment({ token, dni, ticket, onRegistered, disabled = false, socioId }) {
  const [error, setError] = useState('');
  const [registered, setRegistered] = useState(null);
  const [showBiometricModal, setShowBiometricModal] = useState(false);

  useEffect(() => {
    let active = true;
    if (socioId) {
      DeviceService.status(token, socioId)
        .then((data) => {
          if (active) setRegistered(Boolean(data.registered));
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    } else {
      setRegistered(false);
    }
    return () => {
      active = false;
    };
  }, [socioId, token]);

  const isAlreadyRegistered = Boolean(ticket || registered);
  const isDniReady = /^\d{8}$/.test(dni || '');

  function handleOpenScanner() {
    setError('');
    setShowBiometricModal(true);
  }

  function handleScanSuccess(result) {
    if (result?.ticket) {
      onRegistered(result.ticket);
    }
  }

  return (
    <>
      <div
        className="mt-4 p-3 rounded-3 border"
        style={{
          background: isAlreadyRegistered ? '#f7fee7' : '#f8fafc',
          borderColor: isAlreadyRegistered ? '#bef264' : '#e2e8f0',
        }}
      >
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          {/* Caso 1: Huella ya registrada o recién capturada */}
          {isAlreadyRegistered ? (
            <>
              <div className="d-flex align-items-center gap-2">
                <span
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#ecfccb',
                    color: '#15803d',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                  }}
                >
                  <i className="bi bi-fingerprint"></i>
                </span>
                <div>
                  <strong style={{ fontSize: '0.92rem', color: '#166534', display: 'block' }}>
                    <i className="bi bi-check-circle-fill me-1"></i>
                    Huella registrada
                  </strong>
                  <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                    {ticket
                      ? 'Nueva huella capturada (lista para guardar)'
                      : 'Biometría vinculada y activa para check-in'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-sm px-3 py-2 fw-bold"
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  color: '#1e293b',
                  fontSize: '0.84rem',
                }}
                disabled={disabled || !isDniReady}
                onClick={handleOpenScanner}
              >
                <i className="bi bi-arrow-repeat me-1"></i>
                Cambiar
              </button>
            </>
          ) : (
            /* Caso 2: Sin huella aún (Nuevo socio o socio sin huella) */
            <>
              <div className="d-flex align-items-center gap-2">
                <span
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#f1f5f9',
                    color: '#475569',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                  }}
                >
                  <i className="bi bi-fingerprint"></i>
                </span>
                <div>
                  <strong style={{ fontSize: '0.92rem', color: '#1e293b', display: 'block' }}>
                    Huella Digital
                  </strong>
                  <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                    {isDniReady
                      ? 'Sensor biométrico o celular listo para vincular'
                      : 'Ingresa primero el DNI del socio'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="btn px-3 py-2 fw-bold"
                style={{
                  background: isDniReady ? '#c4f039' : '#e2e8f0',
                  color: isDniReady ? '#111d15' : '#94a3b8',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '0.88rem',
                }}
                disabled={disabled || !isDniReady}
                onClick={handleOpenScanner}
              >
                <i className="bi bi-fingerprint me-2"></i>
                Registrar huella
              </button>
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="text-danger small mt-2 mb-0">
            <i className="bi bi-exclamation-triangle-fill me-1"></i>
            {error}
          </p>
        )}
      </div>

      {/* Modal de Escaneo Biométrico */}
      <BiometricModal
        isOpen={showBiometricModal}
        onClose={() => setShowBiometricModal(false)}
        token={token}
        mode="register"
        dni={dni}
        onSuccess={handleScanSuccess}
      />
    </>
  );
}

import { useEffect, useState } from 'react'
import ViewTitle from '../components/ViewTitle'
import ModalDialog from '../components/ModalDialog'
import { MembershipService } from '../services/MembershipService'

export default function MemberMembershipView({ token, user }) {
  const [loading, setLoading] = useState(true)
  const [membership, setMembership] = useState(null)
  const [showRenewModal, setShowRenewModal] = useState(false)
  const [renewFeedback, setRenewFeedback] = useState('')
  const [renewPhone, setRenewPhone] = useState(user?.telefono || '')
  const [renewError, setRenewError] = useState('')

  useEffect(() => {
    loadMembership()
  }, [])

  useEffect(() => {
    if (user?.telefono) {
      setRenewPhone(user.telefono)
    }
  }, [user?.telefono])

  async function loadMembership() {
    setLoading(true)
    try {
      const data = await MembershipService.getClientMembership(token)
      if (data && data.membership) {
        setMembership(data.membership)
      } else {
        // Fallback enriquecido tipo demo
        setMembership({
          id: 1,
          planNombre: 'Plan Impulso Trimestral',
          precio: 240,
          estado: 'activo',
          fechaInicio: '2026-07-01',
          fechaFin: '2026-09-30',
          diasRestantes: 8,
          sede: 'Sede Centro',
        })
      }
    } catch {
      setMembership({
        id: 1,
        planNombre: 'Plan Impulso Trimestral',
        precio: 240,
        estado: 'activo',
        fechaInicio: '2026-07-01',
        fechaFin: '2026-09-30',
        diasRestantes: 8,
        sede: 'Sede Centro',
      })
    } finally {
      setLoading(false)
    }
  }

  function handleRenewRequest(e) {
    e.preventDefault()
    if (!renewPhone.trim()) {
      setRenewError('Por favor ingrese su número de teléfono celular')
      return
    }
    if (!/^9\d{8}$/.test(renewPhone.trim())) {
      setRenewError('El teléfono debe tener exactamente 9 dígitos y empezar con 9')
      return
    }
    setRenewError('')
    setRenewFeedback('¡Tu solicitud de renovación ha sido enviada a recepción! Un asesor se comunicará contigo.')
    setTimeout(() => {
      setShowRenewModal(false)
      setRenewFeedback('')
    }, 2500)
  }

  return (
    <div className="dashboard-page" style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '60px' }}>
      <div className="view-header-row d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <ViewTitle
            title="Mi Membresía Panda Fitness"
            subtitle="Consulta la vigencia de tu plan, beneficios incluidos y estado de tus accesos."
          />
        </div>

        <button
          type="button"
          onClick={() => setShowRenewModal(true)}
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            border: 'none',
            background: '#c4f039',
            color: '#111d15',
            fontWeight: 800,
            fontSize: '0.92rem',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(196, 240, 57, 0.35)',
          }}
        >
          🔄 Renovar Membresía
        </button>
      </div>

      {membership && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '24px', alignItems: 'start' }}>
          {/* Tarjeta Principal de Membresía */}
          <div>
            <div
              style={{
                background: 'linear-gradient(135deg, #111d15 0%, #16241c 100%)',
                borderRadius: '24px',
                padding: '36px',
                color: '#ffffff',
                border: '1px solid #233c2a',
                boxShadow: '0 12px 32px rgba(17, 29, 21, 0.35)',
                marginBottom: '24px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Sello de agua */}
              <div
                style={{
                  position: 'absolute',
                  right: '-20px',
                  bottom: '-20px',
                  fontSize: '9rem',
                  opacity: 0.04,
                  userSelect: 'none',
                }}
              >
                🐼
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
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
                    CREDENCIAL DE SOCIO ACTIVO
                  </span>
                  <h2 style={{ fontSize: '1.9rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                    {membership.planNombre}
                  </h2>
                </div>

                <span
                  style={{
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    background: '#c4f039',
                    color: '#111d15',
                    padding: '6px 16px',
                    borderRadius: '9999px',
                    letterSpacing: '0.04em',
                  }}
                >
                  {membership.estado === 'activo' ? 'MEMBRESÍA ACTIVA' : 'POR VENCER'}
                </span>
              </div>

              {/* Grid de Datos de Vigencia */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '20px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '20px',
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  marginBottom: '20px',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.74rem', color: '#8fa295', display: 'block', marginBottom: '4px' }}>FECHA INICIO</span>
                  <strong style={{ fontSize: '1rem', color: '#ffffff' }}>{membership.fechaInicio}</strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.74rem', color: '#8fa295', display: 'block', marginBottom: '4px' }}>FECHA VENCIMIENTO</span>
                  <strong style={{ fontSize: '1rem', color: '#c4f039' }}>{membership.fechaFin}</strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.74rem', color: '#8fa295', display: 'block', marginBottom: '4px' }}>DÍAS RESTANTES</span>
                  <strong style={{ fontSize: '1rem', color: '#ffffff' }}>{membership.diasRestantes || '8'} días</strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.74rem', color: '#8fa295', display: 'block', marginBottom: '4px' }}>SEDE ASIGNADA</span>
                  <strong style={{ fontSize: '1rem', color: '#ffffff' }}>Sede Centro</strong>
                </div>
              </div>

              <div style={{ fontSize: '0.82rem', color: '#8fa295' }}>
                Titular: <strong style={{ color: '#ffffff' }}>{user?.nombre} {user?.apellido}</strong> · DNI: <strong style={{ color: '#ffffff' }}>{user?.dni}</strong>
              </div>
            </div>

            {/* Beneficios Incluidos */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '20px',
                padding: '28px',
                border: '1px solid #e3e8e2',
                boxShadow: '0 4px 18px rgba(18, 31, 23, 0.04)',
              }}
            >
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#111d15', margin: '0 0 18px 0' }}>
                Beneficios Incluidos en tu Plan
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                {[
                  { titulo: 'Acceso Total a Instalaciones', desc: 'Áreas de pesas libres, máquinas guiadas y cardio sin límite de tiempo.' },
                  { titulo: 'Check-in Biométrico', desc: 'Ingreso rápido con huella digital en recepción.' },
                  { titulo: 'Programa Mi Pandita', desc: '+25 XP y +10 bambús acumulables por cada visita diaria.' },
                  { titulo: 'Vestuarios y Lockers', desc: 'Duchas con agua caliente y casilleros de seguridad.' },
                  { titulo: 'Invitado Mensual', desc: 'Pase libre para invitar a un amigo 1 vez por mes.' },
                  { titulo: 'Convenios Comerciales', desc: 'Descuentos de hasta 30% en tiendas aliadas de nutrición y salud.' },
                ].map((b, idx) => (
                  <div key={idx} style={{ padding: '14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#111d15', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#15803d' }}>✓</span> {b.titulo}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#5f7165', lineHeight: 1.4 }}>{b.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Columna Derecha: Asistencia y Renovación */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div
              style={{
                background: '#ffffff',
                borderRadius: '20px',
                padding: '24px',
                border: '1px solid #e3e8e2',
                boxShadow: '0 4px 18px rgba(18, 31, 23, 0.04)',
              }}
            >
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#111d15', margin: '0 0 12px 0' }}>
                ¿Próximo a Vencer?
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#5f7165', lineHeight: 1.45, marginBottom: '16px' }}>
                Mantén tu constancia y tu racha de nivel en <strong>Mi Pandita</strong> renovando tu membresía a tiempo con beneficios exclusivos.
              </p>
              <button
                type="button"
                onClick={() => setShowRenewModal(true)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#c4f039',
                  color: '#111d15',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(196, 240, 57, 0.3)',
                }}
              >
                Solicitar Renovación
              </button>
            </div>

            <div
              style={{
                background: '#f8fafc',
                borderRadius: '20px',
                padding: '24px',
                border: '1px solid #e2e8f0',
              }}
            >
              <h4 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#111d15', margin: '0 0 8px 0' }}>
                Soporte en Recepción
              </h4>
              <p style={{ fontSize: '0.8rem', color: '#5f7165', lineHeight: 1.45, margin: '0 0 14px 0' }}>
                Horario de atención para trámites, pagos en caja o congelamientos:
              </p>
              <div style={{ fontSize: '0.82rem', color: '#111d15', fontWeight: 700 }}>
                Lunes a Sábado: 06:00 AM - 10:00 PM<br />
                Domingos: 08:00 AM - 02:00 PM
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SOLICITAR RENOVACIÓN */}
      <ModalDialog
        isOpen={showRenewModal}
        onClose={() => setShowRenewModal(false)}
        title="Solicitud de Renovación"
        subtitle="Confirma tus datos para gestionar la renovación con recepción"
        badge="Renovaciones"
        size="sm"
      >
        <form onSubmit={handleRenewRequest}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Plan a Renovar:</label>
            <input type="text" readOnly value={membership?.planNombre || ''} className="form-control" style={{ borderRadius: '10px', background: '#f8fafc' }} />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Teléfono de Contacto:</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={9}
              value={renewPhone}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 9)
                setRenewPhone(val)
                setRenewError('')
              }}
              className={`form-control ${renewError ? 'is-invalid' : ''}`}
              style={{
                borderRadius: '10px',
                ...(renewError ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {})
              }}
              placeholder="Ej: 987654321"
            />
            {renewError && (
              <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.8rem', color: '#dc2626' }}>
                <i className="bi bi-exclamation-circle-fill"></i>
                <span>{renewError}</span>
              </div>
            )}
          </div>

          {renewFeedback && (
            <div style={{ padding: '10px', borderRadius: '10px', background: '#ecfccb', color: '#15803d', fontSize: '0.82rem', marginBottom: '16px' }}>
              {renewFeedback}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" onClick={() => setShowRenewModal(false)} className="btn btn-outline-dark px-3 py-2">Cerrar</button>
            <button type="submit" className="btn btn-dark px-4 py-2" style={{ background: '#c4f039', color: '#111d15', border: 'none', fontWeight: 800 }}>Confirmar Solicitud</button>
          </div>
        </form>
      </ModalDialog>
    </div>
  )
}

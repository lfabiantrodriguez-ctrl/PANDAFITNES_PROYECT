import { useCallback, useEffect, useMemo, useState } from 'react'
import ViewTitle from '../components/ViewTitle'
import FormInput from '../components/FormInput'
import { formatDate } from '../utils/formatters'
import { SocioService } from '../services/SocioService'
import { PlanService } from '../services/PlanService'
import { DniService } from '../services/DniService'

export default function MembersView({ token }) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [members, setMembers] = useState([])
  const [plans, setPlans] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [formStatus, setFormStatus] = useState({ loading: false, dniLoading: false, error: '' })
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

  const selectedPlan = plans.find((plan) => String(plan.id) === String(form.planId))

  const loadMembers = useCallback(async () => {
    try {
      const data = await SocioService.getSocios(token)
      setMembers(data.socios || [])
    } catch (error) {
      throw error
    }
  }, [token])

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true)
      setMessage('')

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
    }

    loadInitialData()
  }, [token])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function resetForm() {
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
    setFormStatus({ loading: false, dniLoading: false, error: '' })
  }

  async function handleDniLookup() {
    setFormStatus({ loading: false, dniLoading: true, error: '' })
    setMessage('')

    try {
      const data = await DniService.lookupDni(token, form.dni)
      setForm((current) => ({
        ...current,
        nombre: data.nombre || current.nombre,
        apellido: data.apellido || current.apellido,
      }))
    } catch (error) {
      setFormStatus({ loading: false, dniLoading: false, error: error.message })
      return
    }

    setFormStatus({ loading: false, dniLoading: false, error: '' })
  }

  async function handleCreateMember(event) {
    event.preventDefault()
    setFormStatus({ loading: true, dniLoading: false, error: '' })
    setMessage('')

    try {
      await SocioService.createSocio(token, form)
      await loadMembers()
      resetForm()
      setShowForm(false)
      setMessage('Socio creado correctamente. La contrasena inicial es su DNI.')
    } catch (error) {
      setFormStatus({ loading: false, dniLoading: false, error: error.message })
      return
    }

    setFormStatus({ loading: false, dniLoading: false, error: '' })
  }

  return (
    <>
      <div className="view-header-row">
        <ViewTitle
          title="Repositorio Centralizado de Socios"
          text="Base de datos unificada para contratos, membresias y estado financiero."
        />
        <button className="action-btn btn-emerald" type="button" onClick={() => setShowForm((value) => !value)}>
          {showForm ? 'Ocultar Formulario' : 'Nuevo Socio'}
        </button>
      </div>

      {message && <div className="system-notice compact-notice">{message}</div>}

      {showForm && (
        <section className="member-form-panel">
          <div className="form-panel-title">
            <div>
              <p className="stat-label">Alta de socio</p>
              <h2>Nuevo Socio</h2>
            </div>
            {selectedPlan && (
              <span className="plan-pill">
                S/. {Number(selectedPlan.precio).toFixed(2)} - {selectedPlan.duracionDias} dias
              </span>
            )}
          </div>

          <form onSubmit={handleCreateMember}>
            <div className="form-grid">
              <div className="form-element with-action">
                <label className="element-label" htmlFor="new-dni">DNI</label>
                <div className="input-action-row">
                  <input
                    id="new-dni"
                    className="input-field"
                    type="text"
                    inputMode="numeric"
                    maxLength="8"
                    value={form.dni}
                    onChange={(event) => updateField('dni', event.target.value)}
                    required
                  />
                  <button
                    className="action-btn btn-dark"
                    type="button"
                    onClick={handleDniLookup}
                    disabled={formStatus.dniLoading}
                  >
                    {formStatus.dniLoading ? 'Consultando...' : 'Consultar DNI'}
                  </button>
                </div>
              </div>

              <FormInput label="Nombres" value={form.nombre} onChange={(value) => updateField('nombre', value)} />
              <FormInput label="Apellidos" value={form.apellido} onChange={(value) => updateField('apellido', value)} />
              <FormInput label="Email" type="email" value={form.email} onChange={(value) => updateField('email', value)} />
              <FormInput label="Telefono" value={form.telefono} onChange={(value) => updateField('telefono', value)} />

              <div className="form-element">
                <label className="element-label" htmlFor="plan">Plan de membresia</label>
                <select
                  id="plan"
                  className="input-field"
                  value={form.planId}
                  onChange={(event) => updateField('planId', event.target.value)}
                  required
                >
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.nombre} - S/. {Number(plan.precio).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-element">
                <label className="element-label" htmlFor="fecha-inicio">Fecha inicio</label>
                <input
                  id="fecha-inicio"
                  className="input-field"
                  type="date"
                  value={form.fechaInicio}
                  onChange={(event) => updateField('fechaInicio', event.target.value)}
                  required
                />
              </div>

              <div className="form-element">
                <label className="element-label" htmlFor="metodo-pago">Metodo de pago</label>
                <select
                  id="metodo-pago"
                  className="input-field"
                  value={form.metodoPago}
                  onChange={(event) => updateField('metodoPago', event.target.value)}
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="yape">Yape</option>
                  <option value="plin">Plin</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>
            </div>

            {formStatus.error && <p className="form-error">{formStatus.error}</p>}

            <div className="form-actions">
              <button className="action-btn btn-emerald" type="submit" disabled={formStatus.loading}>
                {formStatus.loading ? 'Guardando...' : 'Crear Socio'}
              </button>
              <button className="action-btn btn-light" type="button" onClick={resetForm}>
                Limpiar
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="table-frame">
        <table className="corporate-table">
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Socio</th>
              <th>DNI</th>
              <th>Plan</th>
              <th>Fecha Fin</th>
              <th>Ultimo Pago</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="7">Cargando socios...</td>
              </tr>
            )}
            {!loading && members.length === 0 && (
              <tr>
                <td colSpan="7">No hay socios registrados.</td>
              </tr>
            )}
            {!loading && members.map((member) => (
              <tr key={member.id}>
                <td>#PF-{String(member.id).padStart(4, '0')}</td>
                <td>{member.nombre} {member.apellido}</td>
                <td>{member.dni}</td>
                <td>{member.planNombre || 'Sin plan'}</td>
                <td>{formatDate(member.fechaFin)}</td>
                <td>
                  {member.ultimoPagoMonto
                    ? `S/. ${Number(member.ultimoPagoMonto).toFixed(2)} - ${formatDate(member.ultimoPagoFecha)}`
                    : 'Sin pago'}
                </td>
                <td>
                  <span className={`badge-status ${member.estadoMembresia === 'activo' ? 'badge-valid' : 'badge-alert'}`}>
                    {member.estadoMembresia || 'sin membresia'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

import { useState } from 'react'
import ModalDialog from './ModalDialog'
import { SocioService } from '../services/SocioService'

export default function OfferModal({ isOpen, onClose, targetSocio, token, onSuccess }) {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tipo, setTipo] = useState('descuento_porcentaje')
  const [valor, setValor] = useState('15')
  const [codigoCupon, setCodigoCupon] = useState('')
  const [diasVigencia, setDiasVigencia] = useState(30)
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [successMsg, setSuccessMsg] = useState('')

  if (!isOpen) return null

  const isIndividual = Boolean(targetSocio)

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = {}
    if (!titulo.trim()) {
      errors.titulo = 'Por favor ingresa un título descriptivo para la oferta'
    } else if (titulo.trim().length < 4) {
      errors.titulo = 'El título debe tener al menos 4 caracteres'
    }

    const numValor = Number(valor)
    if (!valor || isNaN(numValor) || numValor <= 0) {
      errors.valor = 'El valor del beneficio debe ser mayor a 0'
    } else if (tipo === 'descuento_porcentaje' && numValor > 100) {
      errors.valor = 'El porcentaje no puede ser superior a 100%'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    setFieldErrors({})
    setSuccessMsg('')

    try {
      const generatedCode = codigoCupon.trim()
        ? codigoCupon.trim().toUpperCase()
        : isIndividual
          ? `PROMO${targetSocio.id}-${Math.floor(100 + Math.random() * 900)}`
          : `PANDA${Math.floor(10 + Math.random() * 90)}`

      const payload = {
        usuarioId: isIndividual ? targetSocio.id : null,
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || `Beneficio exclusivo: ${valor}${tipo === 'descuento_porcentaje' ? '%' : tipo === 'descuento_fijo' ? ' soles' : ' días'} aplicable en tu plan.`,
        tipo,
        valor: Number(valor || 0),
        codigoCupon: generatedCode,
        diasVigencia: Number(diasVigencia || 30),
      }

      const res = await SocioService.createOffer(token, payload)
      setSuccessMsg(res.message || 'Oferta creada y enviada con éxito')

      setTimeout(() => {
        onSuccess?.()
        onClose()
        setSuccessMsg('')
        setTitulo('')
        setDescripcion('')
        setCodigoCupon('')
        setFieldErrors({})
      }, 1000)
    } catch (err) {
      setFieldErrors({ general: err.message || 'Error al guardar la oferta' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title={isIndividual ? `Oferta Personalizada para ${targetSocio.nombre} ${targetSocio.apellido}` : 'Lanzar Promoción General para Socios'}
      subtitle={isIndividual ? `DNI: ${targetSocio.dni} · La promoción se notificará y registrará en su ficha` : 'Visible para todos los socios activos en el catálogo de beneficios'}
      badge={isIndividual ? 'Beneficio Individual' : 'Campaña General'}
      size="md"
    >
      <form onSubmit={handleSubmit}>
        {fieldErrors.general && <div className="alert alert-danger py-2 px-3 small mb-3">{fieldErrors.general}</div>}
        {successMsg && <div className="alert alert-success py-2 px-3 small mb-3">{successMsg}</div>}

        <div className="mb-3">
          <label className="form-label fw-bold small text-dark">
            Título de la Oferta / Promoción *
          </label>
          <input
            type="text"
            className={`form-control ${fieldErrors.titulo ? 'is-invalid' : ''}`}
            placeholder={isIndividual ? "Ej. 20% OFF en Renovación VIP para ti" : "Ej. Promo Primavera: 15% Descuento en Plan Trimestral"}
            value={titulo}
            onChange={(e) => {
              setTitulo(e.target.value)
              if (fieldErrors.titulo) setFieldErrors((prev) => ({ ...prev, titulo: '' }))
            }}
            style={fieldErrors.titulo ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
          />
          {fieldErrors.titulo && (
            <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
              <i className="bi bi-exclamation-circle-fill"></i>
              <span>{fieldErrors.titulo}</span>
            </div>
          )}
        </div>

        <div className="row g-3 mb-3">
          <div className="col-12 col-md-6">
            <label className="form-label fw-bold small text-dark">Tipo de Beneficio</label>
            <select
              className="form-select"
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value)
                if (fieldErrors.valor) setFieldErrors((prev) => ({ ...prev, valor: '' }))
              }}
            >
              <option value="descuento_porcentaje">Descuento Porcentual (%)</option>
              <option value="descuento_fijo">Descuento Monto Fijo (S/.)</option>
              <option value="dias_gratis">Días de Entrenamiento Gratis</option>
              <option value="pase_amigo">Pase Libre para Amigo</option>
            </select>
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label fw-bold small text-dark">
              Valor del Beneficio {tipo === 'descuento_porcentaje' ? '(%)' : tipo === 'descuento_fijo' ? '(S/.)' : '(Días)'}
            </label>
            <input
              type="number"
              min="1"
              max={tipo === 'descuento_porcentaje' ? '100' : '500'}
              className={`form-control ${fieldErrors.valor ? 'is-invalid' : ''}`}
              value={valor}
              onChange={(e) => {
                setValor(e.target.value)
                if (fieldErrors.valor) setFieldErrors((prev) => ({ ...prev, valor: '' }))
              }}
              style={fieldErrors.valor ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
            />
            {fieldErrors.valor && (
              <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                <i className="bi bi-exclamation-circle-fill"></i>
                <span>{fieldErrors.valor}</span>
              </div>
            )}
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-12 col-md-6">
            <label className="form-label fw-bold small text-dark">Código de Cupón (Opcional)</label>
            <input
              type="text"
              className="form-control text-uppercase"
              placeholder="Ej. VIP20PANDA"
              value={codigoCupon}
              onChange={(e) => setCodigoCupon(e.target.value)}
            />
            <span className="text-muted" style={{ fontSize: '0.72rem' }}>
              Si lo dejas en blanco, se generará automáticamente.
            </span>
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label fw-bold small text-dark">Vigencia de la Oferta</label>
            <select
              className="form-select"
              value={diasVigencia}
              onChange={(e) => setDiasVigencia(Number(e.target.value))}
            >
              <option value={7}>7 días (1 semana)</option>
              <option value={15}>15 días (2 semanas)</option>
              <option value={30}>30 días (1 mes)</option>
              <option value={60}>60 días (2 meses)</option>
            </select>
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label fw-bold small text-dark">Descripción o Condiciones</label>
          <textarea
            className="form-control"
            rows={2}
            placeholder="Ej. Válido al renovar antes de la fecha de vencimiento. Canjeable en recepción."
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>

        <div className="d-flex justify-content-end gap-2 pt-3 border-top">
          <button
            type="button"
            className="btn btn-outline-dark px-3 py-2 fw-semibold"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn px-4 py-2 fw-bold"
            disabled={loading}
            style={{
              background: '#c4f039',
              color: '#111d15',
              fontWeight: 800,
              border: 'none',
              borderRadius: '10px',
              boxShadow: '0 4px 12px rgba(196, 240, 57, 0.35)',
            }}
          >
            {loading ? 'Guardando...' : isIndividual ? 'Asignar y Notificar Oferta' : 'Publicar Promoción'}
          </button>
        </div>
      </form>
    </ModalDialog>
  )
}

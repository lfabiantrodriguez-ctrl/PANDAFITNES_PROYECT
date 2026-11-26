import { useState } from 'react'
import { SocioService } from '../services/SocioService'

export default function CouponCodeField({
  token,
  plan,
  userId = null,
  context = 'renovacion',
  value,
  onChange,
  appliedCoupon,
  onApplied,
}) {
  const [validating, setValidating] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', text: '' })

  async function handleValidate() {
    const code = String(value || '').trim().toUpperCase()
    if (!code) {
      setFeedback({ type: 'error', text: 'Ingresa un código promocional.' })
      onApplied?.(null)
      return
    }
    setValidating(true)
    setFeedback({ type: '', text: '' })
    try {
      const res = await SocioService.validateCouponAdmin(token, {
        codigoCupon: code,
        planId: plan?.id || null,
        userId,
        context,
      })
      onChange?.(res.oferta.codigoCupon)
      onApplied?.(res)
      const benefitText =
        res.diasExtra > 0
          ? `+${res.diasExtra} días gratis`
          : `Descuento S/. ${Number(res.descuentoAplicado).toFixed(2)}`
      setFeedback({ type: 'success', text: `Cupón válido (${res.oferta.titulo} · ${benefitText}).` })
    } catch (err) {
      onApplied?.(null)
      setFeedback({ type: 'error', text: err.message || 'Código inválido.' })
    } finally {
      setValidating(false)
    }
  }

  return (
    <div className="p-3 rounded-3 border bg-light mt-3">
      <label className="form-label fw-bold small text-dark mb-1">
        Código Promocional / Cupón (Opcional)
      </label>
      <div className="input-group input-group-sm">
        <input
          type="text"
          className="form-control text-uppercase"
          placeholder="Ej. PANDA20"
          value={value}
          onChange={(e) => {
            onChange?.(e.target.value.toUpperCase())
            if (appliedCoupon) onApplied?.(null)
            setFeedback({ type: '', text: '' })
          }}
        />
        <button
          type="button"
          className="btn btn-dark fw-bold"
          disabled={validating || !String(value || '').trim()}
          onClick={handleValidate}
        >
          {validating ? 'Validando...' : 'Validar'}
        </button>
        {appliedCoupon && (
          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={() => {
              onChange?.('')
              onApplied?.(null)
              setFeedback({ type: '', text: '' })
            }}
          >
            Quitar
          </button>
        )}
      </div>
      {feedback.text && (
        <div
          className={`small mt-1 fw-semibold ${feedback.type === 'success' ? 'text-success' : 'text-danger'}`}
        >
          {feedback.text}
        </div>
      )}
    </div>
  )
}

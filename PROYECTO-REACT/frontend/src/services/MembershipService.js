async function parseJsonSafe(res, fallbackMsg) {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    if (!res.ok) {
      throw new Error(fallbackMsg)
    }
    throw new Error('El backend devolvió una respuesta inválida. Reinicia el servidor backend para aplicar los cambios.')
  }
}

export class MembershipService {
  static async getMyMembership(token) {
    const res = await fetch('/api/membresias/mi-membresia', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await parseJsonSafe(res, 'Error al obtener membresia')
    if (!res.ok) throw new Error(data.message || 'Error al obtener membresia')
    return data
  }

  static async getClientMembership(token) {
    return this.getMyMembership(token)
  }

  static async getMySummary(token) {
    const res = await fetch('/api/membresias/mi-resumen', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await parseJsonSafe(res, 'No se pudo consultar tu membresía. Verifica que el backend esté actualizado.')
    if (!res.ok) throw new Error(data.message || 'Error al consultar tu membresía')
    return data
  }

  static async getMemberPlanes(token) {
    const res = await fetch('/api/membresias/planes', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await parseJsonSafe(res, 'Error al cargar planes')
    if (!res.ok) throw new Error(data.message || 'Error al cargar planes')
    return data
  }

  static async getMyOffers(token) {
    const res = await fetch('/api/membresias/mis-ofertas', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await parseJsonSafe(res, 'Error al cargar promociones')
    if (!res.ok) throw new Error(data.message || 'Error al cargar promociones')
    return data
  }

  static async getMyRenewalRequests(token) {
    const res = await fetch('/api/membresias/mis-solicitudes', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await parseJsonSafe(res, 'Error al cargar solicitudes')
    if (!res.ok) throw new Error(data.message || 'Error al cargar solicitudes')
    return data
  }

  static async validateCoupon(token, { codigoCupon, planId }) {
    const res = await fetch('/api/membresias/validar-codigo', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ codigoCupon, planId }),
    })
    const data = await parseJsonSafe(res, 'Código no válido')
    if (!res.ok) throw new Error(data.message || 'Código no válido')
    return data
  }

  static async requestRenewal(token, payload) {
    const res = await fetch('/api/membresias/solicitar-renovacion', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const data = await parseJsonSafe(res, 'No se pudo enviar tu solicitud')
    if (!res.ok) throw new Error(data.message || 'No se pudo enviar tu solicitud')
    return data
  }

  static async cancelRenewalRequest(token, solicitudId) {
    const res = await fetch('/api/membresias/cancelar-solicitud', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ solicitudId }),
    })
    const data = await parseJsonSafe(res, 'No se pudo cancelar la solicitud')
    if (!res.ok) throw new Error(data.message || 'No se pudo cancelar la solicitud')
    return data
  }

  static async getMyPayments(token) {
    const res = await fetch('/api/membresias/mis-pagos', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await parseJsonSafe(res, 'Error al obtener pagos')
    if (!res.ok) throw new Error(data.message || 'Error al obtener pagos')
    return data
  }

  static async getMembershipsList(token, search) {
    const params = search ? `?search=${encodeURIComponent(search)}` : ''
    const res = await fetch(`/api/membresias/admin/membresias${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await parseJsonSafe(res, 'Error al obtener membresias')
    if (!res.ok) throw new Error(data.message || 'Error al obtener membresias')
    return data
  }

  static async getAdminRenewalRequests(token, estado = '') {
    const params = estado ? `?estado=${encodeURIComponent(estado)}` : ''
    const res = await fetch(`/api/membresias/admin/solicitudes${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await parseJsonSafe(res, 'Error al cargar solicitudes')
    if (!res.ok) throw new Error(data.message || 'Error al cargar solicitudes')
    return data
  }

  static async approveRenewalRequest(token, id, payload = {}) {
    const res = await fetch(`/api/membresias/admin/solicitudes/${id}/aprobar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const data = await parseJsonSafe(res, 'No se pudo aprobar la solicitud')
    if (!res.ok) throw new Error(data.message || 'No se pudo aprobar la solicitud')
    return data
  }

  static async rejectRenewalRequest(token, id, motivo) {
    const res = await fetch(`/api/membresias/admin/solicitudes/${id}/rechazar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ motivo }),
    })
    const data = await parseJsonSafe(res, 'No se pudo rechazar la solicitud')
    if (!res.ok) throw new Error(data.message || 'No se pudo rechazar la solicitud')
    return data
  }

  static async renewMembership(token, { userId, planId, fechaInicio, metodoPago, codigoCupon }) {
    const res = await fetch('/api/membresias/admin/renovar', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, planId, fechaInicio, metodoPago, codigoCupon }),
    })
    const data = await parseJsonSafe(res, 'Error al renovar membresia')
    if (!res.ok) throw new Error(data.message || 'Error al renovar membresia')
    return data
  }
}

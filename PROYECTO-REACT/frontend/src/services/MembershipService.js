export class MembershipService {
  static async getMyMembership(token) {
    const res = await fetch('/api/membresias/mi-membresia', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Error al obtener membresia')
    return data
  }

  static async getMyPayments(token) {
    const res = await fetch('/api/membresias/mis-pagos', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Error al obtener pagos')
    return data
  }

  static async getMembershipsList(token, search) {
    const params = search ? `?search=${encodeURIComponent(search)}` : ''
    const res = await fetch(`/api/membresias/admin/membresias${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Error al obtener membresias')
    return data
  }

  static async renewMembership(token, { userId, planId, fechaInicio, metodoPago }) {
    const res = await fetch('/api/membresias/admin/renovar', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, planId, fechaInicio, metodoPago }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Error al renovar membresia')
    return data
  }
}

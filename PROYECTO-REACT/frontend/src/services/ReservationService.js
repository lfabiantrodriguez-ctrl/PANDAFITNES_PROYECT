export class ReservationService {
  static async getMyReservations(token) {
    const response = await fetch('/api/reservas', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo cargar las reservas')
    }
    return data
  }

  static async getReservationDashboard(token, { startDate, endDate } = {}) {
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)

    const queryString = params.toString()
    const response = await fetch(`/api/reservas/dashboard${queryString ? `?${queryString}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo cargar el dashboard de reservas')
    }

    return data
  }

  static async createReservation(token, payload) {
    const response = await fetch('/api/reservas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo registrar la reserva')
    }
    return data
  }

  static async getSocioReservations(token, searchString) {
    const response = await fetch(`/api/reservas/socio?search=${encodeURIComponent(searchString)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudieron buscar las reservas del socio')
    }
    return data
  }

  static async cancelReservation(token, reservationId) {
    const response = await fetch(`/api/reservas/${reservationId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo cancelar la reserva')
    }
    return data
  }
}

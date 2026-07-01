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
}

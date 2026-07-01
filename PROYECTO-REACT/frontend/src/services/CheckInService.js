export class CheckInService {
  static async lookupReservation(token, code) {
    const response = await fetch(`/api/admin/checkin/lookup/${encodeURIComponent(code)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo buscar la reserva')
    }
    return data
  }

  static async confirmEntry(token, reservationId) {
    const response = await fetch('/api/admin/checkin/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reservationId }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo confirmar la entrada')
    }
    return data
  }
}

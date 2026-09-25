export class GuestService {
  static async getGuests(token) {
    const response = await fetch('/api/invitados', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'No se pudieron cargar los clientes diarios')
    }

    return response.json()
  }

  static async createGuest(token, payload) {
    const response = await fetch('/api/invitados', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'No se pudo crear el cliente diario')
    }

    return response.json()
  }
}

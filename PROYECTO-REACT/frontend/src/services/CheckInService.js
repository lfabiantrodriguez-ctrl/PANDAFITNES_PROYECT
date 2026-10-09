export class CheckInService {
  static async lookupMember(token, code) {
    const response = await fetch(`/api/admin/checkin/lookup/${encodeURIComponent(code)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo verificar el socio')
    }
    return data
  }

  // Alias para retrocompatibilidad
  static async lookupReservation(token, code) {
    return this.lookupMember(token, code)
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
      throw new Error(data.message || 'No se pudo confirmar el ingreso')
    }
    return data
  }

  static async confirmDirectEntry(token, userId, durationMinutes = 60) {
    const response = await fetch('/api/admin/checkin/confirm-direct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId, durationMinutes }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo registrar el check-in directo')
    }
    return data
  }

  static async finalizeReservation(token, reservationId) {
    const response = await fetch('/api/admin/checkin/finalize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reservationId }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo registrar la salida')
    }
    return data
  }

  static async finalizeDirectEntry(token, asistenciaId) {
    return this.finalizeReservation(token, asistenciaId)
  }

  static async biometricCheckIn(token, { userId, dni, durationMinutes = 60, minDurationMinutes = 20, forceExit = false }) {
    const response = await fetch('/api/admin/checkin/biometric', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId, dni, durationMinutes, minDurationMinutes, forceExit }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'Validación biométrica no completada')
    }
    return data
  }

  static async getActiveClients(token) {
    const response = await fetch('/api/admin/asistencias/activos', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudieron consultar los clientes activos')
    }
    return data
  }
}

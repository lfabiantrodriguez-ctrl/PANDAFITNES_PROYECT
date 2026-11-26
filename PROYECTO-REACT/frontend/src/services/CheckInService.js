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

  static async confirmDirectEntry(token, userId, durationMinutes = 60, guestOptions = {}) {
    const response = await fetch('/api/admin/checkin/confirm-direct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId,
        durationMinutes,
        invitadosCount: Number(guestOptions?.invitadosCount || 0),
        invitadoNombres: guestOptions?.invitadoNombres || '',
        paseOfertaId: guestOptions?.paseOfertaId || null,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo registrar el check-in directo')
    }
    return data
  }

  static async attachFriendGuest(token, { attendanceId, cantidad = 1, ofertaId = null, invitadoNombres = '' }) {
    const response = await fetch('/api/admin/checkin/validar-invitado', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ attendanceId, cantidad, ofertaId, invitadoNombres }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo validar el invitado')
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
    const response = await fetch('/api/admin/checkin/finalize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ attendanceId: asistenciaId }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo registrar la salida')
    }
    return data
  }

  static async biometricCheckIn(token, { userId, dni, deviceProof, durationMinutes = 60, minDurationMinutes = 20, forceExit = false }) {
    const response = await fetch('/api/admin/checkin/biometric', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId, dni, deviceProof, durationMinutes, minDurationMinutes, forceExit }),
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

  static async getTodayAttendances(token) {
    const response = await fetch('/api/admin/asistencias/hoy', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo consultar el control de ingresos y salidas')
    }
    return data
  }
}

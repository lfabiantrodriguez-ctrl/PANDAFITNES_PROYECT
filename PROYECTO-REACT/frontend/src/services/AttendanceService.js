export class AttendanceService {
  static async getActiveClients(token) {
    const response = await fetch('/api/admin/asistencias/activos', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo cargar clientes activos')
    }
    return data
  }

  static async searchBySocio(token, searchString) {
    const response = await fetch(`/api/admin/asistencias/buscar?search=${encodeURIComponent(searchString)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo buscar las asistencias del socio')
    }
    return data
  }

  static async getUserAttendanceSummary(token) {
    const response = await fetch('/api/asistencias/usuario', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo cargar el resumen de asistencias')
    }
    return data
  }

  static async getMyAttendanceHistory(token) {
    const response = await fetch('/api/asistencias/mi-historial', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo cargar el historial de asistencias')
    }
    return data
  }

  static async updateMyGoals(token, { diasObjetivo, horarioPreferido }) {
    const response = await fetch('/api/asistencias/mi-objetivo', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ diasObjetivo, horarioPreferido }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudieron actualizar los objetivos de entrenamiento')
    }
    return data
  }

  static async getPandaStatus(token) {
    const response = await fetch('/api/asistencias/pandita-estado', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo cargar el estado de Mi Pandita')
    }
    return data
  }

  static async redeemReward(token, { recompensaNombre, costoBambus }) {
    const response = await fetch('/api/asistencias/canjear-recompensa', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recompensaNombre, costoBambus }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo canjear la recompensa')
    }
    return data
  }
}

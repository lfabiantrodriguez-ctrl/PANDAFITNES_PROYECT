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
}

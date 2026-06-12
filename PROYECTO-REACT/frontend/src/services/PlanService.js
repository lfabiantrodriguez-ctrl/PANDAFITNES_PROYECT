export class PlanService {
  static async getPlanes(token) {
    const response = await fetch('/api/admin/planes', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo cargar planes')
    }
    return data
  }
}

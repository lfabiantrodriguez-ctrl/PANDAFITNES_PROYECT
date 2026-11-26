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

  static async updatePlan(token, id, payload) {
    const response = await fetch(`/api/admin/planes/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo actualizar el plan')
    }
    return data
  }
}

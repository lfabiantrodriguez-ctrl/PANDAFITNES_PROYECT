export class RewardService {
  static async getRewards(token) {
    const response = await fetch('/api/recompensas/catalogo', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'No se pudieron cargar las recompensas')
    return data
  }

  static async createReward(token, rewardData) {
    const response = await fetch('/api/recompensas/catalogo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(rewardData),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Error creando recompensa')
    return data
  }

  static async updateReward(token, id, rewardData) {
    const response = await fetch(`/api/recompensas/catalogo/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(rewardData),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Error actualizando recompensa')
    return data
  }

  static async deleteReward(token, id) {
    const response = await fetch(`/api/recompensas/catalogo/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Error eliminando recompensa')
    return data
  }

  static async getPartnerships(token) {
    const response = await fetch('/api/recompensas/convenios', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'No se pudieron cargar los convenios')
    return data
  }

  static async createPartnership(token, partnershipData) {
    const response = await fetch('/api/recompensas/convenios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(partnershipData),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Error creando convenio')
    return data
  }

  static async deletePartnership(token, id) {
    const response = await fetch(`/api/recompensas/convenios/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Error eliminando convenio')
    return data
  }

  static async getMyRedemptions(token) {
    const response = await fetch('/api/recompensas/mis-canjes', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'No se pudieron cargar tus canjes')
    return data
  }

  static async getAllRedemptions(token) {
    const response = await fetch('/api/recompensas/admin/canjes-todos', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'No se pudieron cargar los canjes para administración')
    return data
  }

  static async deliverRedemption(token, id) {
    const response = await fetch(`/api/recompensas/admin/canjes/${id}/entregar`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Error validando entrega')
    return data
  }
}

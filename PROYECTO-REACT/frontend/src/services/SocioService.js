export class SocioService {
  static async getSocios(token) {
    const response = await fetch('/api/admin/socios', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo cargar socios')
    }
    return data
  }

  static async createSocio(token, form) {
    const response = await fetch('/api/admin/socios', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(form),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo crear el socio')
    }
    return data
  }
}

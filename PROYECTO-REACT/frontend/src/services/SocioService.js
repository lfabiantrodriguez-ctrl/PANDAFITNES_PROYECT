export class SocioService {
  static async updateSocio(token, id, form) {
    const response = await fetch(`/api/admin/socios/${id}`, { method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No se pudo actualizar el socio');
    return data;
  }
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

  static async getSocioFicha(token, socioId) {
    const response = await fetch(`/api/admin/socios/${socioId}/ficha`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo obtener la ficha del socio')
    }
    return data
  }

  static async createOffer(token, offerData) {
    const response = await fetch('/api/admin/socios/ofertas', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(offerData),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo crear la oferta')
    }
    return data
  }

  static async getOffers(token) {
    const response = await fetch('/api/admin/socios/ofertas', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudieron consultar las ofertas')
    }
    return data
  }
}

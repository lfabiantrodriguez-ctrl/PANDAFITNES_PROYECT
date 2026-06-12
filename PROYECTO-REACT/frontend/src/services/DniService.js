export class DniService {
  static async lookupDni(token, dni) {
    const response = await fetch(`/api/dni/${dni}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo consultar el DNI')
    }
    return data
  }
}

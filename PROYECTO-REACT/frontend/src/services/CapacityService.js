export class CapacityService {
  static async getCapacity() {
    const response = await fetch('/api/aforo')
    if (!response.ok) {
      throw new Error('No se pudo consultar el aforo')
    }
    const data = await response.json()
    return data
  }
}

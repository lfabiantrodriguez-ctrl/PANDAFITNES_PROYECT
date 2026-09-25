export class CapacityService {
  static async getCapacity() {
    const response = await fetch('/api/aforo')
    if (!response.ok) {
      throw new Error('No se pudo consultar el aforo')
    }
    const data = await response.json()
    return data
  }

  static async getHistoricalCapacity(fecha, hora) {
    const response = await fetch(`/api/aforo/historial?fecha=${fecha}&hora=${hora}`)
    if (!response.ok) {
      throw new Error('No se pudo consultar el aforo histórico')
    }
    const data = await response.json()
    return data
  }

  static async getCapacityRange(startDate, endDate) {
    const response = await fetch(`/api/aforo/rango?startDate=${startDate}&endDate=${endDate}`)
    if (!response.ok) {
      throw new Error('No se pudo consultar el historial de aforo')
    }
    const data = await response.json()
    return data
  }
}

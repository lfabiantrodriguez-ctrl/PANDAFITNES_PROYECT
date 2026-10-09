// Servicio de reservas deprecado (el sistema ahora opera mediante accesos directos por membresía y aforo en sala)
export class ReservationService {
  static async getMyReservations() {
    return { reservas: [] }
  }

  static async getReservationDashboard() {
    return { totalReservations: 0, peakHour: null, peakHours: [], reservas: [] }
  }

  static async createReservation() {
    return { ok: true, message: 'El sistema ya no requiere reservas previas. El acceso es directo.' }
  }

  static async getSocioReservations() {
    return { reservas: [] }
  }

  static async cancelReservation() {
    return { ok: true }
  }
}

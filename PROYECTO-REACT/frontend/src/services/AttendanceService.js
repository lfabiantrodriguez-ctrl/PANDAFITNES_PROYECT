import { progress } from '../utils/pandaProgress';

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

  static async getMyAttendanceHistory(token) {
    const response = await fetch('/api/asistencias/mi-historial', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo cargar el historial de asistencias')
    }
    return data
  }

  static async updateMyGoals(token, { diasObjetivo, horarioPreferido }) {
    const response = await fetch('/api/asistencias/mi-objetivo', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ diasObjetivo, horarioPreferido }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudieron actualizar los objetivos de entrenamiento')
    }
    return data
  }

  static async getPandaStatus(token) {
    const response = await fetch('/api/asistencias/pandita-estado', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo cargar el estado de Mi Pandita')
    }
    if (!Array.isArray(data.asistencias) || !Array.isArray(data.diasAsistidos) || data.baseXp !== 25 || !Number.isFinite(data.bambusDisponibles)) {
      // Older servers expose genuine records even though their Panda totals are demo values.
      // Ignore those totals entirely and derive the display from authenticated records.
      const [history, response] = await Promise.all([
        this.getMyAttendanceHistory(token),
        fetch('/api/recompensas/mis-canjes', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!response.ok) throw new Error('No se pudieron consultar tus canjes registrados.');
      const redemptions = await response.json();
      if (!Array.isArray(history.asistencias) || !history.goals || !Array.isArray(redemptions.redemptions))
        throw new Error('El servidor no entregó los registros necesarios para calcular tu progreso.');
      return { ...progress(history.asistencias, history.goals, redemptions.redemptions), canRedeem: false };
    }
    return { ...data, canRedeem: true }
  }

  static async redeemReward(token, { recompensaId }) {
    const account = await this.getPandaStatus(token);
    if (!account.canRedeem) throw new Error('Los nuevos canjes requieren iniciar la versión actualizada del servidor. Tu saldo e historial ya muestran los registros reales.');
    const response = await fetch('/api/asistencias/canjear-recompensa', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recompensaId }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo canjear la recompensa')
    }
    return data
  }
}

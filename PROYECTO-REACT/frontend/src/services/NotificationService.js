async function parseJsonSafe(res, fallbackMsg) {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    throw new Error(fallbackMsg)
  }
}

export class NotificationService {
  static async getMyNotifications(token, limit = 30) {
    const res = await fetch(`/api/notificaciones?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await parseJsonSafe(res, 'No se pudieron cargar las notificaciones')
    if (!res.ok) throw new Error(data.message || 'No se pudieron cargar las notificaciones')
    return data
  }

  static async markAsRead(token, id) {
    const res = await fetch(`/api/notificaciones/${id}/leer`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await parseJsonSafe(res, 'No se pudo marcar como leída')
    if (!res.ok) throw new Error(data.message || 'No se pudo marcar como leída')
    return data
  }

  static async markAllAsRead(token) {
    const res = await fetch('/api/notificaciones/leer-todas', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await parseJsonSafe(res, 'No se pudieron marcar todas como leídas')
    if (!res.ok) throw new Error(data.message || 'No se pudieron marcar todas como leídas')
    return data
  }
}

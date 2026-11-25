const USB_BRIDGE_DEFAULT_URL = 'http://127.0.0.1:9090'

export class ZkService {
  static async getTokenInfo(token) {
    const response = await fetch('/api/zk/token', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo obtener la configuración del huellero.')
    }
    return data
  }

  static async regenerateToken(token) {
    const response = await fetch('/api/zk/token/regenerar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo regenerar el token del huellero.')
    }
    return data
  }

  static async pingWebhook(zkToken) {
    const response = await fetch('/api/zk/ping', {
      headers: { 'X-ZK-Token': zkToken || '' },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.message || 'Token de huellero inválido o webhook no disponible.')
    }
    return data
  }

  static async importArchivo(token, { content, filename }) {
    const response = await fetch('/api/zk/importar-archivo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content, filename }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo importar el archivo de marcaciones.')
    }
    return data
  }

  static async getRecentMarcaciones(token, limit = 25) {
    const response = await fetch(`/api/zk/marcaciones/recientes?limit=${encodeURIComponent(limit)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo cargar el historial del huellero.')
    }
    return data.marcaciones || []
  }

  static async saveUsbTemplate(token, { dni, template, formato = 'ZKFINGER', dispositivo = 'LECTOR_USB' }) {
    const response = await fetch('/api/zk/usb/huellas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ dni, template, formato, dispositivo }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo guardar la huella USB del socio.')
    }
    return data
  }

  static async checkUsbBridgeHealth(bridgeUrl = USB_BRIDGE_DEFAULT_URL) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 2500)
      const response = await fetch(`${bridgeUrl}/health`, { signal: controller.signal })
      clearTimeout(timer)
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'El agente del lector USB respondió con error.')
      }
      return data
    } catch (err) {
      if (err?.name === 'AbortError' || err instanceof TypeError) {
        throw new Error(
          'No se detecta el puente local del lector USB (http://127.0.0.1:9090). Ejecuta tools/usb-reader-agent/iniciar_lector_usb.bat en esta PC.',
          { cause: err }
        )
      }
      throw err
    }
  }

  static async captureUsbBridge(dni = '', bridgeUrl = USB_BRIDGE_DEFAULT_URL) {
    const response = await fetch(`${bridgeUrl}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.ok) {
      throw new Error(data.message || 'No se pudo capturar la huella desde el lector USB.')
    }
    return data
  }

  static async identifyUsbBridge(dni = '', bridgeUrl = USB_BRIDGE_DEFAULT_URL) {
    const response = await fetch(`${bridgeUrl}/identify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.ok) {
      throw new Error(data.message || 'No se pudo identificar la huella en el lector USB.')
    }
    return data
  }
}

export class ConfigService {
  static async getConfig() {
    const response = await fetch('/api/configuracion')
    if (!response.ok) {
      throw new Error('No se pudo cargar la configuración de la empresa')
    }
    const data = await response.json()
    // Aplicar branding automáticamente (título y favicon del navegador)
    ConfigService.applyBranding(data)
    return data
  }

  static async updateConfig(token, data) {
    const response = await fetch('/api/configuracion', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })

    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.message || 'No se pudo actualizar la configuración')
    }
    if (result.config) {
      ConfigService.applyBranding(result.config)
    }
    return result
  }

  static applyBranding(config) {
    if (!config) return
    const nombre = config.empresa_nombre || 'Panda Fitness'
    const logo = config.empresa_logo || '/logo-panda.png'

    // 1. Actualizar título de pestaña del navegador
    document.title = `${nombre} | Club Deportivo`

    // 2. Actualizar icono (favicon) de la pestaña del navegador
    try {
      let link = document.querySelector("link[rel*='icon']")
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.type = logo.endsWith?.('.svg') ? 'image/svg+xml' : 'image/png'
      link.href = logo
    } catch (e) {
      console.warn('No se pudo actualizar el favicon dinámicamente:', e)
    }
  }
}

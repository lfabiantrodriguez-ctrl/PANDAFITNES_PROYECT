export class AuthService {
  static async login(dniOrEmail, password) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni: dniOrEmail, password }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo iniciar sesión')
    }
    return data
  }

  static async googleLogin(googleData) {
    const response = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(googleData),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo autenticar con Google')
    }
    return data
  }

  static async forgotPassword(identifier) {
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'Error al solicitar recuperación')
    }
    return data
  }

  static async resetPassword(identifier, code, newPassword) {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, code, newPassword }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'Error al restablecer contraseña')
    }
    return data
  }

  static async getMe(token) {
    const response = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'Sesión inválida')
    }
    return data
  }
}

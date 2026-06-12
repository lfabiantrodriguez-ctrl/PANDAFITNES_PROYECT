export class AuthService {
  static async login(dni, password) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni, password }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo iniciar sesion')
    }
    return data
  }

  static async getMe(token) {
    const response = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'Sesion invalida')
    }
    return data
  }
}

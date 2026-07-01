export class ProfileService {
  static async updateProfile(token, data) {
    const res = await fetch('/api/auth/me', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.message || 'No se pudo actualizar el perfil')
    return json
  }

  static async changePassword(token, data) {
    const res = await fetch('/api/auth/me/password', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.message || 'No se pudo cambiar la contrasena')
    return json
  }
}

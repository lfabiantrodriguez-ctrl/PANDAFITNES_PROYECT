export function getStoredSession() {
  try {
    const token = localStorage.getItem('panda_token')
    const user = JSON.parse(localStorage.getItem('panda_user') || 'null')

    if (!token || !user) {
      return { token: null, user: null }
    }

    return { token, user }
  } catch {
    localStorage.removeItem('panda_token')
    localStorage.removeItem('panda_user')
    return { token: null, user: null }
  }
}

export function saveStoredSession(token, user) {
  localStorage.setItem('panda_token', token)
  localStorage.setItem('panda_user', JSON.stringify(user))
}

export function clearStoredSession() {
  localStorage.removeItem('panda_token')
  localStorage.removeItem('panda_user')
}

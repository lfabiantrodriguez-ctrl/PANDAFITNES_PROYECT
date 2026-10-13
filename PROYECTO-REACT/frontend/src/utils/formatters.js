export function parseDatePeru(value) {
  if (!value) return null
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value
  }
  if (typeof value === 'number') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    // Pure date "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const d = new Date(`${trimmed}T12:00:00-05:00`)
      return isNaN(d.getTime()) ? null : d
    }

    // Datetime without timezone offset (e.g. "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DDTHH:mm:ss")
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(trimmed)) {
      const d = new Date(trimmed.replace(' ', 'T') + '-05:00')
      return isNaN(d.getTime()) ? null : d
    }

    const d = new Date(trimmed)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

export function formatDate(value) {
  if (!value) return '--'
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-')
      return `${day}/${month}/${year}`
    }
  }
  const d = parseDatePeru(value)
  if (!d) return '--'
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Lima',
  }).format(d)
}

export function formatDateOnly(value) {
  return formatDate(value)
}

export function formatTimePeru(value) {
  if (!value) return '--:--'
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      return trimmed.slice(0, 5)
    }
  }
  const d = parseDatePeru(value)
  if (!d) {
    if (typeof value === 'string' && value.length >= 16) {
      return value.slice(11, 16)
    }
    return '--:--'
  }
  return new Intl.DateTimeFormat('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Lima',
  }).format(d)
}

export function formatTimeOnly(value) {
  return formatTimePeru(value)
}

export function formatDateTimePeru(value) {
  if (!value) return '--'
  const d = parseDatePeru(value)
  if (!d) return typeof value === 'string' ? value : '--'
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Lima',
  }).format(d)
}

export function formatDateTime(value) {
  return formatDateTimePeru(value)
}

export function getTodayPeru() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function getMinutesElapsed(dateInput) {
  if (!dateInput) return 0
  try {
    const entry = parseDatePeru(dateInput)
    if (!entry) return 0
    const now = new Date()
    return Math.max(0, Math.floor((now.getTime() - entry.getTime()) / 60000))
  } catch {
    return 0
  }
}



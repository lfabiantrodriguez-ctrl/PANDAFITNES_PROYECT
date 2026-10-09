export function formatDate(value) {
  if (!value) {
    return '--'
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split('-')
    return `${day}/${month}/${year}`
  }

  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Lima',
  }).format(new Date(value))
}

export function formatTimePeru(value) {
  if (!value) return '--:--'
  try {
    let dateStr = value
    if (typeof value === 'string' && value.includes(' ') && !value.includes('T')) {
      dateStr = value.replace(' ', 'T')
    }
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) {
      return String(value).slice(11, 16) || '--:--'
    }
    return new Intl.DateTimeFormat('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Lima',
    }).format(d)
  } catch {
    return '--:--'
  }
}

export function formatDateTimePeru(value) {
  if (!value) return '--'
  try {
    let dateStr = value
    if (typeof value === 'string' && value.includes(' ') && !value.includes('T')) {
      dateStr = value.replace(' ', 'T')
    }
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return String(value)
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Lima',
    }).format(d)
  } catch {
    return '--'
  }
}

export function getMinutesElapsed(dateInput) {
  if (!dateInput) return 0
  try {
    let dateStr = dateInput
    if (typeof dateInput === 'string' && dateInput.includes(' ') && !dateInput.includes('T')) {
      dateStr = dateInput.replace(' ', 'T')
    }
    const entry = new Date(dateStr)
    if (isNaN(entry.getTime())) return 0
    const now = new Date()
    return Math.max(0, Math.floor((now.getTime() - entry.getTime()) / 60000))
  } catch {
    return 0
  }
}


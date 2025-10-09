import { format, formatDistanceToNow, parseISO } from 'date-fns'

export const formatDateTime = (value: string | null | undefined, fallback = 'N/A') => {
  if (!value) return fallback
  try {
    return format(parseISO(value), 'PPpp')
  } catch (error) {
    return fallback
  }
}

export const formatRelativeTime = (value: string | null | undefined, fallback = 'N/A') => {
  if (!value) return fallback
  try {
    return formatDistanceToNow(parseISO(value), { addSuffix: true })
  } catch (error) {
    return fallback
  }
}

export const formatFileSize = (bytes: number | null | undefined, fallback = '—') => {
  if (!bytes || bytes <= 0) return fallback
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(value > 10 ? 0 : 1)} ${units[exponent]}`
}

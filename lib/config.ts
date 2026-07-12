export const SITE_NAME = 'Vinted Hub'

export function getBasePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || ''
}

export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || ''
}

export function getFunctionsUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL
  if (explicit) return explicit.replace(/\/$/, '')

  const supabaseUrl = getSupabaseUrl()
  if (!supabaseUrl) return ''
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1`
}

export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  }
  const base = getBasePath()
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${base}`
  }
  return base ? `https://vtw42b22dk-creator.github.io${base}` : ''
}

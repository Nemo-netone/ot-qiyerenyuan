const trimTrailingSlash = value => value.replace(/\/+$/, '')

const trimLeadingSlash = value => value.replace(/^\/+/, '')

const getRuntimeApiBase = () => {
  if (typeof window === 'undefined') {
    return ''
  }

  const queryApiBase = new URLSearchParams(window.location.search).get('apiBase')
  const storageApiBase = window.localStorage && window.localStorage.getItem('HRM_API_BASE_URL')
  const configApiBase = window.HRM_CONFIG && window.HRM_CONFIG.apiBase

  return queryApiBase || storageApiBase || configApiBase || ''
}

export const getApiBaseURL = () => {
  const apiBase = getRuntimeApiBase() || process.env.VUE_APP_BASE_API || '/dev'
  return apiBase === '/' ? '' : trimTrailingSlash(apiBase)
}

export const buildApiUrl = path => {
  if (/^https?:\/\//i.test(path)) {
    return path
  }

  const apiBase = getApiBaseURL()
  const normalizedPath = trimLeadingSlash(path)
  return apiBase ? `${apiBase}/${normalizedPath}` : `/${normalizedPath}`
}

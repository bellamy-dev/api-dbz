const API_BASE = 'https://dragonball-api.com/api'

class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

async function request(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  })
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new ApiError(`Erreur ${res.status}`, res.status)
  return res.json()
}

export const api = {
  listCharacters(page = 1, limit = 12) {
    return request('/characters', { page, limit })
  },
  getCharacter(id) {
    return request(`/characters/${id}`)
  },
  listPlanets(page = 1, limit = 12) {
    return request('/planets', { page, limit })
  },
  listTransformations(limit = 60) {
    return request('/transformations', { limit })
  },
}

export { ApiError }

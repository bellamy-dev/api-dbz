const API_BASE = 'https://dragonball-api.com/api'
const TIMEOUT_MS = 10000

class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

function timeoutFetch(url, init, ms = TIMEOUT_MS) {
  const controller = new AbortController()
  const tId = setTimeout(() => controller.abort(), ms)
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(tId))
}

async function request(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  })
  let res
  try {
    res = await timeoutFetch(url.toString(), { headers: { Accept: 'application/json' } })
  } catch (e) {
    if (e.name === 'AbortError') throw new ApiError('La requête a expiré (délai d’attente dépassé)', 408)
    throw new ApiError('Impossible de joindre l’API Dragon Ball', 0)
  }
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

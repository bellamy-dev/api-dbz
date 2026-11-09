import { api, ApiError } from './api.js'
import './style.css'

const app = document.getElementById('app')
const main = document.getElementById('main')

/* ---------- Helpers ---------- */
const $ = (html) => {
  const t = document.createElement('template')
  t.innerHTML = String(html ?? '').trim()
  return t.content.firstElementChild
}

/* ---------- Global error handling ---------- */
function showJsError(err) {
  console.error(err)
  main.innerHTML = `
    <div class="error">
      <h2>Erreur JavaScript</h2>
      <p>${escapeHtml(err && err.message ? err.message : String(err))}</p>
      <button class="btn btn-primary" onclick="location.reload()">Recharger la page</button>
    </div>`
}

window.addEventListener('error', (e) => {
  if (e.filename && e.filename.includes('localhost') === false && !e.filename.includes('vite')) {
    // éviter le double-affichage si le router gère déjà
    return
  }
  showJsError(new Error(e.message || 'Erreur inconnue'))
})

window.addEventListener('unhandledrejection', (e) => {
  showJsError(new Error(e.reason && e.reason.message ? e.reason.message : String(e.reason)))
})

function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formatKi(k) {
  if (!k) return '-'
  return String(k).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/* ---------- Loading / error states ---------- */
function showLoader() {
  main.innerHTML = `
    <div class="loader">
      <div class="spinner"></div>
      <p>Chargement…</p>
    </div>`
}

function showError(msg, onRetry) {
  main.innerHTML = `
    <div class="error">
      <h2>Erreur</h2>
      <p>${escapeHtml(msg)}</p>
      ${onRetry ? '<button class="btn btn-primary">Réessayer</button>' : ''}
    </div>`
  if (onRetry) {
    main.querySelector('button').onclick = onRetry
  }
}

/* ---------- Views ---------- */

// Home : liste des personnages + recherche
async function renderHome() {
  const params = new URLSearchParams(location.hash.slice(1).split('?')[1] || '')
  let page = parseInt(params.get('page') || '1', 10)
  let q = params.get('q') || ''
  if (!page || page < 1) page = 1

  const searchHtml = `
    <div class="page-header">
      <h1>Personnages</h1>
      <p>Tous les combattants de l'univers Dragon Ball</p>
    </div>
    <div class="controls">
      <input type="search" class="search" id="search" placeholder="Rechercher un personnage…" value="${escapeHtml(q)}" />
      <a href="#/planetes" class="btn btn-outline">Planètes</a>
      <a href="#/transformations" class="btn btn-outline">Transformations</a>
    </div>
    <div class="grid" id="grid"></div>
    <div class="pagination" id="pagination"></div>
  `
  main.innerHTML = searchHtml

  const grid = document.getElementById('grid')
  const pagination = document.getElementById('pagination')
  const searchInput = document.getElementById('search')

  let abort
  async function load() {
    if (abort) abort.abort()
    abort = new AbortController()
    showLoader()
    try {
      // Note: l'API ne filtre pas côté serveur, on charge la page puis on filtre localement
      const data = await api.listCharacters(page, 20)
      renderList(data)
    } catch (e) {
      if (e.name === 'AbortError') return
      showError(e.message || 'Impossible de charger les personnages', load)
    }
  }

  function renderList(data) {
    const items = data.items || []
    const filtered = q ? items.filter(c => c.name.toLowerCase().includes(q.toLowerCase())) : items
    const meta = data.meta || {}

    grid.innerHTML = ''
    if (filtered.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--color-text-muted)">Aucun personnage trouvé.</div>`
    } else {
      filtered.forEach(c => {
        const card = $`
          <article class="card">
            <div class="card-img">
              <img src="${escapeHtml(c.image || '')}" alt="${escapeHtml(c.name)}" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22260%22><rect width=%22200%22 height=%22260%22 fill=%22%231a1a1a%22/><text x=%2250%22 y=%2250%22 fill=%22%23666%22 font-size=%2214%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22>${escapeHtml(c.name)}</text></svg>'" />
            </div>
            <div class="card-body">
              <div class="card-name"><a href="#/character/${c.id}">${escapeHtml(c.name)}</a></div>
              <div class="card-meta">
                <span class="tag">${escapeHtml(c.race || '—')}</span>
                <span class="tag">${escapeHtml(c.gender || '—')}</span>
                <span class="tag ki">${formatKi(c.ki)}</span>
              </div>
            </div>
          </article>
        `
        grid.appendChild(card)
      })
    }

    renderPagination(meta, page, q)
  }

  function renderPagination(meta, page, q) {
    const totalPages = Math.max(1, meta.totalPages || 1)
    const qs = q ? `&q=${encodeURIComponent(q)}` : ''
    pagination.innerHTML = ''
    const prev = $`<button class="page-btn ${page === 1 ? 'disabled' : ''}" ${page === 1 ? 'disabled' : ''}>‹</button>`
    prev.onclick = () => { if (page > 1) navigate(`#/?page=${page - 1}${qs}`) }
    pagination.appendChild(prev)
    for (let i = 1; i <= totalPages; i++) {
      const b = $`<button class="page-btn ${i === page ? 'active' : ''}">${i}</button>`
      b.onclick = () => navigate(`#/?page=${i}${qs}`)
      pagination.appendChild(b)
    }
    const next = $`<button class="page-btn ${page >= totalPages ? 'disabled' : ''}" ${page >= totalPages ? 'disabled' : ''}>›</button>`
    next.onclick = () => { if (page < totalPages) navigate(`#/?page=${page + 1}${qs}`) }
    pagination.appendChild(next)
  }

  searchInput.oninput = (e) => {
    q = e.target.value
    page = 1
    history.replaceState(null, '', `#/?page=1&q=${encodeURIComponent(q)}`)
    load()
  }

  load()
}

function navigate(hash) {
  location.hash = hash
}

// Détail d'un personnage
async function renderCharacter(id) {
  showLoader()
  try {
    const char = await api.getCharacter(id)
    main.innerHTML = ''
    const container = document.createElement('div')
    container.className = 'detail'
    container.innerHTML = `
      <a href="#/" class="btn btn-outline" style="margin-bottom:1rem;display:inline-flex;">← Retour</a>
      <div class="detail-header">
        <div class="detail-img">
          <img src="${escapeHtml(char.image || '')}" alt="${escapeHtml(char.name)}" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22420%22><rect width=%22320%22 height=%22420%22 fill=%22%231a1a1a%22/><text x=%2250%22 y=%2250%22 fill=%22%23666%22 font-size=%2216%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22>${escapeHtml(char.name)}</text></svg>'" />
        </div>
        <div>
          <h1 style="font-size:2rem;font-weight:800;letter-spacing:-0.02em;margin-bottom:0.5rem;">${escapeHtml(char.name)}</h1>
          <div class="detail-meta">
            <div><strong>Race</strong> ${escapeHtml(char.race || '—')}</div>
            <div><strong>Genre</strong> ${escapeHtml(char.gender || '—')}</div>
            <div><strong>Ki</strong> ${formatKi(char.ki)}</div>
            <div><strong>Max Ki</strong> ${escapeHtml(char.maxKi || '—')}</div>
            <div><strong>Affiliation</strong> ${escapeHtml(char.affiliation || '—')}</div>
          </div>
          <div class="detail-desc">${escapeHtml(char.description || 'Aucune description disponible.')}</div>
          ${char.originPlanet ? `<div style="margin-top:1rem;"><strong>Planète d'origine :</strong> <a href="#/planete/${char.originPlanet.id}" style="color:var(--color-gold);text-decoration:underline;text-decoration-thickness:1px;">${escapeHtml(char.originPlanet.name)}</a></div>` : ''}
        </div>
      </div>

      <div class="section">
        <div class="section-title">Transformations</div>
        <div class="detail-card" id="transformations"></div>
      </div>
    `
    main.appendChild(container)

    const tContainer = document.getElementById('transformations')
    const transformations = char.transformations || []
    if (transformations.length === 0) {
      tContainer.innerHTML = `<p style="color:var(--color-text-muted)">Aucune transformation répertoriée.</p>`
    } else {
      transformations.forEach(t => {
        const card = $`
          <article class="card">
            <div class="card-img">
              <img src="${escapeHtml(t.image || '')}" alt="${escapeHtml(t.name)}" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><rect width=%22200%22 height=%22200%22 fill=%22%231a1a1a%22/><text x=%2250%22 y=%2250%22 fill=%22%23666%22 font-size=%2214%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22>${escapeHtml(t.name)}</text></svg>'" />
            </div>
            <div class="card-body">
              <div class="card-name">${escapeHtml(t.name)}</div>
              <div class="ki">${formatKi(t.ki)}</div>
            </div>
          </article>
        `
        tContainer.appendChild(card)
      })
    }
  } catch (e) {
    showError(e.message || 'Personnage introuvable', () => renderCharacter(id))
  }
}

// Planètes
async function renderPlanets() {
  const params = new URLSearchParams(location.hash.slice(1).split('?')[1] || '')
  let page = parseInt(params.get('page') || '1', 10)
  if (!page || page < 1) page = 1

  main.innerHTML = `
    <div class="page-header">
      <h1>Planètes</h1>
      <p>Mondes de l'univers Dragon Ball</p>
    </div>
    <div class="controls">
      <a href="#/" class="btn btn-outline">Personnages</a>
      <a href="#/transformations" class="btn btn-outline">Transformations</a>
    </div>
    <div class="grid" id="grid"></div>
    <div class="pagination" id="pagination"></div>
  `
  const grid = document.getElementById('grid')
  const pagination = document.getElementById('pagination')

  async function load() {
    showLoader()
    try {
      const data = await api.listPlanets(page, 12)
      const items = data.items || []
      const meta = data.meta || {}
      grid.innerHTML = ''
      if (items.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--color-text-muted)">Aucune planète trouvée.</div>`
      } else {
        items.forEach(p => {
          const card = $`
            <article class="card">
              <div class="card-img">
                <img src="${escapeHtml(p.image || '')}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22260%22><rect width=%22200%22 height=%22260%22 fill=%22%231a1a1a%22/><text x=%2250%22 y=%2250%22 fill=%22%23666%22 font-size=%2214%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22>${escapeHtml(p.name)}</text></svg>'" />
              </div>
              <div class="card-body">
                <div class="card-name"><a href="#/planete/${p.id}">${escapeHtml(p.name)}</a></div>
                <div class="card-meta">
                  <span class="tag">${p.isDestroyed ? 'Détruite' : 'Active'}</span>
                </div>
              </div>
            </article>
          `
          grid.appendChild(card)
        })
      }
      renderPagination(meta, page)
    } catch (e) {
      showError(e.message || 'Impossible de charger les planètes', load)
    }
  }

  function renderPagination(meta, page) {
    const totalPages = Math.max(1, meta.totalPages || 1)
    pagination.innerHTML = ''
    const prev = $`<button class="page-btn ${page === 1 ? 'disabled' : ''}" ${page === 1 ? 'disabled' : ''}>‹</button>`
    prev.onclick = () => { if (page > 1) navigate(`#/planetes?page=${page - 1}`) }
    pagination.appendChild(prev)
    for (let i = 1; i <= totalPages; i++) {
      const b = $`<button class="page-btn ${i === page ? 'active' : ''}">${i}</button>`
      b.onclick = () => navigate(`#/planetes?page=${i}`)
      pagination.appendChild(b)
    }
    const next = $`<button class="page-btn ${page >= totalPages ? 'disabled' : ''}" ${page >= totalPages ? 'disabled' : ''}>›</button>`
    next.onclick = () => { if (page < totalPages) navigate(`#/planetes?page=${page + 1}`) }
    pagination.appendChild(next)
  }

  load()
}

// Détail planète
async function renderPlanet(id) {
  showLoader()
  try {
    // Pas d'endpoint détail planète : on récupère la liste et on cherche
    const data = await api.listPlanets(1, 100)
    const p = (data.items || []).find(x => x.id === id)
    if (!p) throw new ApiError('Planète introuvable', 404)
    main.innerHTML = `
      <div class="detail">
        <a href="#/planetes" class="btn btn-outline" style="margin-bottom:1rem;display:inline-flex;">← Retour</a>
        <h1 style="font-size:2rem;font-weight:800;margin-bottom:0.5rem;">${escapeHtml(p.name)}</h1>
        <div class="detail-meta">
          <div><strong>Statut</strong> ${p.isDestroyed ? 'Détruite 💥' : 'Active ✅'}</div>
        </div>
        <div class="detail-desc">${escapeHtml(p.description || 'Aucune description disponible.')}</div>
        ${p.image ? `<div style="margin-top:1.5rem;"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" style="width:100%;max-width:400px;border-radius:var(--radius);border:1px solid var(--color-border);display:block;margin:0 auto;" /></div>` : ''}
      </div>`
  } catch (e) {
    showError(e.message || 'Planète introuvable', () => renderPlanet(id))
  }
}

// Transformations
async function renderTransformations() {
  showLoader()
  try {
    const data = await api.listTransformations(100)
    const items = Array.isArray(data) ? data : (data.items || [])
    main.innerHTML = `
      <div class="page-header">
        <h1>Transformations</h1>
        <p>${items.length} formes et puissances répertoriées</p>
      </div>
      <div class="controls">
        <a href="#/" class="btn btn-outline">Personnages</a>
        <a href="#/planetes" class="btn btn-outline">Planètes</a>
      </div>
      <div class="grid" id="grid"></div>
    `
    const grid = document.getElementById('grid')
    grid.innerHTML = ''
    items.forEach(t => {
      const card = $`
        <article class="card">
          <div class="card-img">
            <img src="${escapeHtml(t.image || '')}" alt="${escapeHtml(t.name)}" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><rect width=%22200%22 height=%22200%22 fill=%22%231a1a1a%22/><text x=%2250%22 y=%2250%22 fill=%22%23666%22 font-size=%2214%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22>${escapeHtml(t.name)}</text></svg>'" />
          </div>
          <div class="card-body">
            <div class="card-name">${escapeHtml(t.name)}</div>
            <div class="ki">${formatKi(t.ki)}</div>
          </div>
        </article>
      `
      grid.appendChild(card)
    })
  } catch (e) {
    showError(e.message || 'Impossible de charger les transformations', renderTransformations)
  }
}

// 404
function renderNotFound() {
  main.innerHTML = `
    <div style="text-align:center;padding:4rem 1rem;">
      <h1 style="font-size:2rem;color:var(--color-gold);">404</h1>
      <p style="color:var(--color-text-muted);margin-top:0.5rem;">Page introuvable dans l'univers Dragon Ball.</p>
      <a href="#/" class="btn btn-primary" style="margin-top:1rem;">Accueil</a>
    </div>`
}

/* ---------- Router ---------- */
const ROUTES = [
  { re: /^#\/\?(.*)$/, handler: renderHome },
  { re: /^#\/$/, handler: renderHome },
  { re: /^#\/character\/(\d+)$/, handler: (m) => renderCharacter(m[1]) },
  { re: /^#\/planetes(\?.*)?$/, handler: renderPlanets },
  { re: /^#\/planete\/(\d+)$/, handler: (m) => renderPlanet(m[1]) },
  { re: /^#\/transformations(\?.*)?$/, handler: renderTransformations },
]

function router() {
  const hash = location.hash || '#/'
  for (const route of ROUTES) {
    const m = hash.match(route.re)
    if (m) {
      route.handler(m)
      return
    }
  }
  renderNotFound()
}

const safeRouter = () => {
  try {
    router()
  } catch (e) {
    showJsError(e)
  }
}

window.addEventListener('hashchange', safeRouter)
window.addEventListener('load', safeRouter)

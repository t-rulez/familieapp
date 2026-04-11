// ─── Konfig ───────────────────────────────────────────────────────────────────

const API_URL = localStorage.getItem('api_url') || 'https://familieapp-backend.up.railway.app';

// ─── Auth ─────────────────────────────────────────────────────────────────────

function getToken() { return localStorage.getItem('auth_token'); }
function getUser()  { return JSON.parse(localStorage.getItem('auth_user') || 'null'); }

function saveAuth(token, user) {
  localStorage.setItem('auth_token', token);
  localStorage.setItem('auth_user', JSON.stringify(user));
}

function logout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  showLogin();
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 401) { logout(); throw new Error('Ikke autentisert'); }
  if (!res.ok) {
const err = await res.json().catch(() => ({}));
throw new Error(err.detail || `Feil: ${res.status}`);
  }
  return res.json();
}

// ─── State ────────────────────────────────────────────────────────────────────

let state = {
  messages: [],
  sourceFilter: 'alle',
  statusFilter: 'unread',
  searchQuery: '',
  stats: { read: 0, skipped: 0 },
  lastSync: null
};

function saveLocalStats() {
  localStorage.setItem('stats', JSON.stringify(state.stats));
}

// ─── Source config ────────────────────────────────────────────────────────────

const SOURCE_CONFIG = {
  spond:{ color: '#185FA5', bg: '#E6F1FB', darkBg: '#0A1E35' },
  skolemelding: { color: '#6B3FA0', bg: '#F0E8FA', darkBg: '#2A1040' },
  showbie:  { color: '#BA7517', bg: '#FAEEDA', darkBg: '#2D1A05' },
  whatsapp: { color: '#8B6340', bg: '#F5EDE3', darkBg: '#2A1A0A' }
};

function getCfg(source) {
  const c = SOURCE_CONFIG[source] || { color: '#888', bg: '#F0F0F0', darkBg: '#222' };
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return { color: c.color, bgColor: dark ? c.darkBg : c.bg };
}

// ─── Visning ──────────────────────────────────────────────────────────────────

function showLogin(){ document.getElementById('screen-login').style.display = 'flex';  document.getElementById('screen-app').style.display = 'none'; }
function showApp()  { document.getElementById('screen-login').style.display = 'none';  document.getElementById('screen-app').style.display = 'flex'; }
function showAuthError(msg) { document.getElementById('auth-error').textContent = msg; }

// ─── Innlogging ───────────────────────────────────────────────────────────────

document.getElementById('btn-login').addEventListener('click', async () => {
  const email= document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) return showAuthError('Fyll inn e-post og passord');
  try {
document.getElementById('btn-login').textContent = 'Logger inn...';
const data = await apiFetch('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
});
saveAuth(data.token, data.user);
showAuthError('');
await initApp();
  } catch (e) {
showAuthError(e.message || 'Innlogging feilet');
  } finally {
document.getElementById('btn-login').textContent = 'Logg inn';
  }
});

document.getElementById('btn-show-register').addEventListener('click', () => {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-form').style.display = 'flex';
  showAuthError('');
});

document.getElementById('btn-show-login').addEventListener('click', () => {
  document.getElementById('register-form').style.display = 'none';
  document.getElementById('login-form').style.display = 'flex';
  showAuthError('');
});

document.getElementById('btn-register').addEventListener('click', async () => {
  const email= document.getElementById('reg-email').value.trim();
  const name = document.getElementById('reg-name').value.trim();
  const password = document.getElementById('reg-password').value;
  if (!email || !name || !password) return showAuthError('Fyll inn alle felt');
  if (password.length < 8) return showAuthError('Passord må være minst 8 tegn');
  try {
document.getElementById('btn-register').textContent = 'Registrerer...';
const data = await apiFetch('/auth/register', {
  method: 'POST',
  body: JSON.stringify({ email, display_name: name, password })
});
saveAuth(data.token, data.user);
showAuthError('');
await initApp();
  } catch (e) {
showAuthError(e.message || 'Registrering feilet');
  } finally {
document.getElementById('btn-register').textContent = 'Registrer';
  }
});

// ─── Feed ─────────────────────────────────────────────────────────────────────

function getFiltered() {
  const q = state.searchQuery.toLowerCase().trim();
  return state.messages.filter(m => {
const statusMatch = state.statusFilter === 'alle' || m.status === state.statusFilter;
const sourceMatch = state.sourceFilter === 'alle' ||
  (m.source || '').toLowerCase() === state.sourceFilter.toLowerCase();
if (!statusMatch || !sourceMatch) return false;
if (!q) return true;
return (
  (m.title  || '').toLowerCase().includes(q) ||
  (m.tldr   || '').toLowerCase().includes(q) ||
  (m.body   || '').toLowerCase().includes(q) ||
  (m.meta?.sender || '').toLowerCase().includes(q) ||
  (m.meta?.group  || '').toLowerCase().includes(q)
);
  });
}

function renderFeed() {
  const feed = document.getElementById('feed');
  const msgs = getFiltered();
  // Oppdater meldingsteller
  const countEl = document.getElementById('feed-count');
  if (countEl) countEl.textContent = msgs.length > 0 ? `${msgs.length} meldinger` : '';
  // Oppdater badge
  updateBadge();
  if (msgs.length === 0) {
feed.innerHTML = `<div class="empty-state"><div class="icon">✓</div><p>Ingen meldinger${state.filter !== 'alle' ? ' i denne kategorien' : ''}.</p></div>`;
return;
  }
  feed.innerHTML = msgs.map(m => renderCard(m)).join('');
  msgs.forEach(m => attachCardEvents(m.id));
  updateBadge();
}

function renderCard(m) {
  const cfg = getCfg(m.source);
  const statusColor = m.status==='read' ? '#2D6A4F' : m.status==='skipped' ? '#A32D2D' : '#E8A800';
  const statusLabel = m.status==='read' ? 'relevant' : m.status==='skipped' ? 'ignorert' : 'ulest';
  const title = m.source === 'whatsapp' && m.meta?.group && m.title.startsWith(m.meta.group + ': ')
    ? m.title.slice(m.meta.group.length + 2) : m.title;
  // Uniformelle sirkel-ikoner
  const checkSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></svg>`;
  const crossSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  const unreadSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  return `
  <div class="card" id="card-${m.id}" data-id="${m.id}">
    <div class="swipe-hint swipe-hint-ok">✓ Relevant</div>
    <div class="swipe-hint swipe-hint-skip">✕ Ignorer</div>
    <div class="card-header">
      <div class="source-tag">
        <div class="source-dot" style="background:${cfg.color}"></div>
        <span class="source-label" style="color:${cfg.color}">${m.sourceLabel} · ${categoryLabel(m)}</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:1px;">
        <span style="display:flex;align-items:center;gap:3px;font-size:10px;font-family:'DM Mono',monospace;font-weight:500;color:${statusColor}">
          <span style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:${statusColor}"></span>${statusLabel}
        </span>
        <span class="card-time">${m.time}</span>
      </div>
    </div>
    <div class="card-title">${title}</div>
    <div class="tldr" style="background:${cfg.bgColor};border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:10px;">
      <div class="tldr-label" style="color:${cfg.color}">TL;DR</div>
      <div class="tldr-text" style="color:${cfg.color}">${m.tldr}</div>
    </div>
    <div class="card-body" id="body-${m.id}">${m.body}</div>
    <button class="expand-btn" id="expand-${m.id}" data-id="${m.id}" style="color:${cfg.color}">Les hele meldingen ↓</button>
    <div class="card-actions">
      ${m.status === 'unread'
        ? `<button class="btn btn-ok" data-action="read" data-id="${m.id}">${checkSvg}Sett til relevant</button>
           <button class="btn btn-skip-red" data-action="skip" data-id="${m.id}">${crossSvg}Sett til ikke relevant</button>`
        : m.status === 'skipped'
        ? `<button class="btn btn-ok" data-action="read" data-id="${m.id}">${checkSvg}Sett til relevant</button>
           <button class="btn btn-skip" data-action="unread" data-id="${m.id}">${unreadSvg}Sett til ulest</button>`
        : `<button class="btn btn-skip-red" data-action="skip" data-id="${m.id}">${crossSvg}Sett til ikke relevant</button>
           <button class="btn btn-skip" data-action="unread" data-id="${m.id}">${unreadSvg}Sett til ulest</button>`
      }
    </div>
  </div>`;
}

function categoryLabel(m) {
  const cat = (m.category || '').toLowerCase();
  // For WhatsApp viser vi gruppenavnet fra meta
  if (m.source === 'whatsapp' && m.meta?.group) return m.meta.group;
  return { skole: 'Skole', aks: 'AKS', idrett: 'Spond', foreldre: 'WhatsApp', whatsapp: 'WhatsApp' }[cat] || m.category || cat;
}

function toggleExpand(id) {
  const body = document.getElementById(`body-${id}`);
  const btn  = document.getElementById(`expand-${id}`);
  const expanded = body.classList.toggle('expanded');
  btn.textContent = expanded ? 'Skjul ↑' : 'Les hele meldingen ↓';
}

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (btn) {
const id = btn.dataset.id, action = btn.dataset.action;
if (action === 'read')   markRead(id);
if (action === 'skip')   markSkipped(id);
if (action === 'unread') markUnread(id);
  }
  const expandBtn = e.target.closest('.expand-btn[data-id]');
  if (expandBtn) toggleExpand(expandBtn.dataset.id);
});

// ─── Actions ──────────────────────────────────────────────────────────────────

async function markRead(id) {
  const msg = state.messages.find(m => m.id === id);
  if (!msg || msg.status === 'read') return;
  animateCard(id, 'right', async () => {
if (msg.status === 'skipped') state.stats.skipped = Math.max(0, state.stats.skipped - 1);
msg.status = 'read';
state.stats.read++;
saveLocalStats();
renderFeed(); updateBadge();
await apiFetch(`/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'read' }) }).catch(console.error);
  });
}

async function markSkipped(id) {
  const msg = state.messages.find(m => m.id === id);
  if (!msg) return;
  animateCard(id, 'left', async () => {
if (msg.status === 'read') state.stats.read = Math.max(0, state.stats.read - 1);
msg.status = 'skipped';
state.stats.skipped++;
saveLocalStats();
renderFeed(); updateBadge();
await apiFetch(`/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'skipped' }) }).catch(console.error);
  });
}

async function markUnread(id) {
  const msg = state.messages.find(m => m.id === id);
  if (!msg) return;
  if (msg.status === 'read')state.stats.read= Math.max(0, state.stats.read - 1);
  if (msg.status === 'skipped') state.stats.skipped = Math.max(0, state.stats.skipped - 1);
  msg.status = 'unread';
  saveLocalStats();
  renderFeed(); updateBadge();
  await apiFetch(`/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'unread' }) }).catch(console.error);
}

function animateCard(id, dir, cb) {
  const card = document.querySelector(`[data-id="${id}"].card`);
  if (!card) return cb();
  card.classList.add(dir === 'right' ? 'dismissed-right' : 'dismissed-left');
  card.style.height = card.offsetHeight + 'px';
  setTimeout(() => { card.style.height = '0'; card.style.marginBottom = '0'; card.style.padding = '0'; card.style.overflow = 'hidden'; }, 280);
  setTimeout(cb, 500);
}

function updateBadge() {
  const unread = state.messages.filter(m => m.status === 'unread').length;
  // Badge på synk-knapp
  const badge = document.getElementById('unread-count');
  if (badge) {
    badge.textContent = unread > 9 ? '9+' : unread;
    badge.style.display = unread > 0 ? 'flex' : 'none';
  }
  // Badge på Ulest og Alle filterknapp
  const filterBadge = document.getElementById('unread-badge');
  if (filterBadge) {
    filterBadge.textContent = unread > 99 ? '99+' : unread;
    filterBadge.style.display = unread > 0 ? 'inline-block' : 'none';
  }
  const alleBadge = document.getElementById('alle-badge');
  if (alleBadge) {
    alleBadge.textContent = unread > 99 ? '99+' : unread;
    alleBadge.style.display = unread > 0 ? 'inline-block' : 'none';
  }
}

function updateBadgeAfterAction() {
  // Kall updateBadge etter enhver statusendring
  updateBadge();
  renderFeed();
}

// ─── Swipe ────────────────────────────────────────────────────────────────────

function attachCardEvents(id) {
  const card = document.querySelector(`[data-id="${id}"].card`);
  if (!card) return;
  let startX = 0, startY = 0, currentX = 0, dragging = false, axis = null;
  card.addEventListener('touchstart', e => {
startX = e.touches[0].clientX; startY = e.touches[0].clientY;
dragging = true; axis = null; card.classList.add('swiping');
  }, { passive: true });
  card.addEventListener('touchmove', e => {
if (!dragging) return;
const dx = e.touches[0].clientX - startX, dy = e.touches[0].clientY - startY;
if (!axis) axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
if (axis === 'x') {
  e.preventDefault(); currentX = dx;
  card.style.transform = `translateX(${dx}px) rotate(${dx * 0.02}deg)`;
  const hintOk = card.querySelector('.swipe-hint-ok'), hintSkip = card.querySelector('.swipe-hint-skip');
  if (dx > 30)   { hintOk.style.opacity = Math.min((dx - 30) / 60, 0.9); hintSkip.style.opacity = 0; }
  else if (dx < -30) { hintSkip.style.opacity = Math.min((-dx - 30) / 60, 0.9); hintOk.style.opacity = 0; }
  else   { hintOk.style.opacity = 0; hintSkip.style.opacity = 0; }
}
  }, { passive: false });
  card.addEventListener('touchend', () => {
if (!dragging) return;
dragging = false; card.classList.remove('swiping');
if (axis === 'x') {
  if (currentX > 80) markRead(id);
  else if (currentX < -80) markSkipped(id);
  else {
card.style.transform = '';
card.querySelector('.swipe-hint-ok').style.opacity = 0;
card.querySelector('.swipe-hint-skip').style.opacity = 0;
  }
} else { card.style.transform = ''; }
currentX = 0; axis = null;
  });
}

// ─── Filter-tabs ──────────────────────────────────────────────────────────────

document.querySelectorAll('#status-filters .filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
document.querySelectorAll('#status-filters .filter-btn').forEach(b => b.classList.remove('active'));
btn.classList.add('active');
state.statusFilter = btn.dataset.status;
renderFeed();
  });
});

document.querySelectorAll('#category-filters .filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
document.querySelectorAll('#category-filters .filter-btn').forEach(b => b.classList.remove('active'));
btn.classList.add('active');
state.sourceFilter = btn.dataset.source;
renderFeed();
  });
});

// ─── Søk ─────────────────────────────────────────────────────────────────────────

let searchDebounce = null;
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');

function clearSearch() {
  if (searchInput) searchInput.value = '';
  if (searchClear) searchClear.style.display = 'none';
  state.searchQuery = '';
  renderFeed();
  if (searchInput) searchInput.focus();
}

if (searchInput) {
  searchInput.addEventListener('input', e => {
clearTimeout(searchDebounce);
if (searchClear) searchClear.style.display = e.target.value ? 'block' : 'none';
searchDebounce = setTimeout(() => {
  state.searchQuery = e.target.value;
  renderFeed();
}, 150);
  });
  searchInput.addEventListener('keydown', e => {
if (e.key === 'Escape') clearSearch();
  });
}

// ─── Navigasjon ───────────────────────────────────────────────────────────────

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Hide all views
    document.getElementById('view-feed').style.display = 'none';
    document.getElementById('view-ai').style.display = 'none';
    document.querySelectorAll('.view').forEach(v => { v.classList.remove('active'); v.style.display = 'none'; });
    if (view === 'feed') {
      document.getElementById('view-feed').style.display = 'flex';
    } else if (view === 'ai') {
      document.getElementById('view-ai').style.display = 'flex';
      renderAiHistory();
    } else {
      const el = document.getElementById(`view-${view}`);
      if (el) { el.style.display = 'block'; el.classList.add('active'); }
    }
    if (view === 'stats') renderStats();
    if (view === 'settings') loadSettings();
  });
});

// ─── Manuell synk ─────────────────────────────────────────────────────────────

async function manualSync() {
  if (!API_URL) return;
  const btn = document.getElementById('sync-btn');
  btn.classList.add('syncing'); btn.disabled = true;
  try {
    // Send since-parameter – henter bare nye meldinger siden sist
    const since = state.lastSync || null;
    await apiFetch('/sync', { method: 'POST', body: JSON.stringify({ since }) });
    // Hent oppdatert meldingsliste fra cache
    const data = await apiFetch('/messages');
    state.messages = data.messages;
    state.lastSync = new Date().toISOString();
    renderFeed(); updateBadge();
    document.getElementById('last-sync').textContent =
      new Date().toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    console.error('Synk feilet:', e);
  } finally {
    btn.classList.remove('syncing'); btn.disabled = false;
  }
}

// Pull-to-refresh henter bare fra cache (ingen API-kall til Spond)
async function refreshFromCache() {
  try {
    const data = await apiFetch('/messages');
    state.messages = data.messages;
    renderFeed(); updateBadge();
  } catch (e) {
    console.error('Cache-oppdatering feilet:', e);
  }
}

// ─── Statistikk ───────────────────────────────────────────────────────────────

function renderStats() {
  const total   = state.messages.length;
  const read    = state.messages.filter(m => m.status === 'read').length;
  const skipped = state.messages.filter(m => m.status === 'skipped').length;
  const unread  = state.messages.filter(m => m.status === 'unread').length;
  document.getElementById('stat-total').textContent   = total;
  document.getElementById('stat-read').textContent    = read;
  document.getElementById('stat-skipped').textContent = skipped;
  document.getElementById('stat-unread').textContent  = unread;

  // Kildefordeling
  const sources = {};
  state.messages.forEach(m => {
    if (!sources[m.source]) sources[m.source] = { label: m.sourceLabel, count: 0 };
    sources[m.source].count++;
  });
  document.getElementById('source-stats').innerHTML = Object.entries(sources).map(([key, val]) => {
    const c = SOURCE_CONFIG[key] || { color: '#888', bg: '#eee', darkBg: '#333' };
    return `<div class="settings-row">
      <div class="settings-row-left">
        <div style="width:12px;height:12px;border-radius:3px;background:${c.color};flex-shrink:0;"></div>
        <span class="settings-row-text">${val.label}</span>
      </div>
      <span style="font-size:13px;color:var(--text2);font-family:'DM Mono',monospace;">${val.count} meldinger</span>
    </div>`;
  }).join('');

  renderDailyChart();
}

function renderDailyChart() {
  const canvas = document.getElementById('daily-chart');
  if (!canvas) return;

  const sourceKeys = ['spond', 'skolemelding', 'showbie', 'whatsapp'];
  const byDay = {};

  state.messages.forEach(m => {
    if (!m.timestamp) return;
    const day = m.timestamp.substring(0, 10);
    if (!byDay[day]) byDay[day] = { spond: 0, skolemelding: 0, showbie: 0, whatsapp: 0 };
    const src = (m.source || '').toLowerCase();
    if (byDay[day][src] !== undefined) byDay[day][src]++;
  });

  const days = Object.keys(byDay).sort().slice(-30);
  if (days.length === 0) return;

  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const textColor = dark ? '#9B9B94' : '#6B6B65';
  const gridColor = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';

  const labels = days.map(d => {
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' });
  });

  const allDatasets = [
    { label: 'Spond',        data: days.map(d => byDay[d].spond || 0),       color: '#185FA5' },
    { label: 'Skole',        data: days.map(d => byDay[d].skolemelding || 0), color: '#6B3FA0' },
    { label: 'Showbie',      data: days.map(d => byDay[d].showbie || 0),      color: '#D4650A' },
    { label: 'WhatsApp',     data: days.map(d => byDay[d].whatsapp || 0),     color: '#8B6340' },
  ].filter(ds => ds.data.some(v => v > 0));

  const containerW = canvas.parentElement.clientWidth - 32;
  const barW = Math.max(6, Math.min(24, containerW / days.length - 3));
  canvas.width = Math.max(containerW, days.length * (barW + 3));
  canvas.height = 200;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const padL = 30, padR = 8, padT = 10, padB = 50;
  const chartW = canvas.width - padL - padR;
  const chartH = canvas.height - padT - padB;

  const maxVal = Math.max(...days.map(d => sourceKeys.reduce((s, k) => s + (byDay[d][k] || 0), 0)));
  if (maxVal === 0) return;

  // Grid
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + chartH - (chartH * i / 4);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + chartW, y); ctx.stroke();
    ctx.fillStyle = textColor;
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal * i / 4), padL - 4, y + 3);
  }

  // Stablede søyler
  const barSlot = chartW / days.length;
  days.forEach((day, i) => {
    const x = padL + i * barSlot + (barSlot - barW) / 2;
    let yBottom = padT + chartH;
    allDatasets.forEach(ds => {
      const val = ds.data[i];
      if (!val) return;
      const h = Math.max(1, val * (chartH / maxVal));
      yBottom -= h;
      ctx.fillStyle = ds.color;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, yBottom, barW, h, [2, 2, 0, 0]);
      else ctx.rect(x, yBottom, barW, h);
      ctx.fill();
    });

    // X-akse labels
    const step = Math.max(1, Math.ceil(days.length / 12));
    if (i % step === 0) {
      ctx.fillStyle = textColor;
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.save();
      ctx.translate(x + barW / 2, padT + chartH + 12);
      ctx.rotate(-Math.PI / 5);
      ctx.fillText(labels[i], 0, 0);
      ctx.restore();
    }
  });

  // Legend
  let lx = padL;
  const ly = canvas.height - 4;
  allDatasets.forEach(ds => {
    ctx.fillStyle = ds.color;
    ctx.fillRect(lx, ly - 8, 9, 9);
    ctx.fillStyle = textColor;
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(ds.label, lx + 12, ly);
    lx += ctx.measureText(ds.label).width + 24;
  });
}

// ─── Innstillinger ────────────────────────────────────────────────────────────

async function loadSettings() {
  try {
const s = await apiFetch('/settings');
// Spond
document.getElementById('set-spond-user').value= s.spond_username || '';
document.getElementById('set-spond-enabled').checked = !!s.spond_enabled;
document.getElementById('spond-pw-status').textContent = s.spond_has_password ? '(passord lagret)' : '(ikke satt)';
// E-post 1
document.getElementById('set-e1-host').value  = s.email_1_host || 'imap.one.com';
document.getElementById('set-e1-user').value  = s.email_1_username || '';
document.getElementById('set-e1-from').value  = s.email_1_from_filter || '';
document.getElementById('set-e1-subject').value   = s.email_1_subject_filter || '';

document.getElementById('set-e1-delete').checked  = !!s.email_1_delete_after;
document.getElementById('set-e1-enabled').checked = !!s.email_1_enabled;
document.getElementById('e1-pw-status').textContent = s.email_1_has_password ? '(passord lagret)' : '(ikke satt)';
// E-post 2
document.getElementById('set-e2-host').value  = s.email_2_host || 'imap.one.com';
document.getElementById('set-e2-user').value  = s.email_2_username || '';
document.getElementById('set-e2-from').value  = s.email_2_from_filter || '';
document.getElementById('set-e2-subject').value   = s.email_2_subject_filter || '';

document.getElementById('set-e2-delete').checked  = !!s.email_2_delete_after;
document.getElementById('set-e2-enabled').checked = !!s.email_2_enabled;
document.getElementById('e2-pw-status').textContent = s.email_2_has_password ? '(passord lagret)' : '(ikke satt)';
// WhatsApp
document.getElementById('set-wa-filter').value   = s.wa_group_filter || '';

document.getElementById('set-wa-enabled').checked = !!s.wa_enabled;
// Brukerinfo
const user = getUser();
document.getElementById('set-user-name').textContent  = user?.display_name || '';
document.getElementById('set-user-email').textContent = user?.email || '';
// Family context
const fc = document.getElementById('set-family-context');
if (fc) fc.value = s.family_context || '';
// Maks 3 måneder tilbake for historisk henting
const historyFrom = document.getElementById('set-history-from');
if (historyFrom) {
  const minDate = new Date();
  minDate.setMonth(minDate.getMonth() - 3);
  historyFrom.min = minDate.toISOString().substring(0, 10);
  historyFrom.max = new Date().toISOString().substring(0, 10);
  if (!historyFrom.value || historyFrom.value < historyFrom.min) {
    historyFrom.value = historyFrom.min;
  }
}
// Update accordion badges
['spond','e1','e2','wa'].forEach(k => updateSourceBadge(k));
initPushSettings();
  } catch (e) {
console.error('Kunne ikke laste innstillinger:', e);
  }
}

async function saveSettings() {
  const btn = document.getElementById('btn-save-settings');
  btn.textContent = 'Lagrer...'; btn.disabled = true;
  try {
const updates = {
  family_context: document.getElementById('set-family-context')?.value || '',
  spond_username: document.getElementById('set-spond-user').value.trim(),
  spond_enabled:  document.getElementById('set-spond-enabled').checked,
  email_1_host:   document.getElementById('set-e1-host').value.trim(),
  email_1_username:   document.getElementById('set-e1-user').value.trim(),
  email_1_from_filter:document.getElementById('set-e1-from').value.trim(),
  email_1_subject_filter: document.getElementById('set-e1-subject').value.trim(),

  email_1_delete_after:   document.getElementById('set-e1-delete').checked,
  email_1_enabled:document.getElementById('set-e1-enabled').checked,
  email_2_host:   document.getElementById('set-e2-host').value.trim(),
  email_2_username:   document.getElementById('set-e2-user').value.trim(),
  email_2_from_filter:document.getElementById('set-e2-from').value.trim(),
  email_2_subject_filter: document.getElementById('set-e2-subject').value.trim(),

  email_2_delete_after:   document.getElementById('set-e2-delete').checked,
  email_2_enabled:document.getElementById('set-e2-enabled').checked,
  wa_group_filter:  document.getElementById('set-wa-filter').value.trim(),

  wa_enabled:   document.getElementById('set-wa-enabled').checked,
};
// Passord – bare send hvis fylt inn
const spondPw = document.getElementById('set-spond-pw').value;
if (spondPw) updates.spond_password = spondPw;
const e1pw = document.getElementById('set-e1-pw').value;
if (e1pw) updates.email_1_password = e1pw;
const e2pw = document.getElementById('set-e2-pw').value;
if (e2pw) updates.email_2_password = e2pw;

await apiFetch('/settings', { method: 'PATCH', body: JSON.stringify(updates) });
btn.textContent = 'Lagret ✓';
setTimeout(() => { btn.textContent = 'Lagre innstillinger'; btn.disabled = false; }, 2000);
await loadSettings();
  } catch (e) {
btn.textContent = 'Feil – prøv igjen';
btn.disabled = false;
console.error(e);
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function initApp() {
  initPullToRefresh();
  const user = getUser();
  if (!user) { showLogin(); return; }
  // Auto-registrer push hvis tillatelse allerede er gitt
  if ('Notification' in window && Notification.permission === 'granted') {
subscribeToPush().catch(() => {});
  }
  const nameEl = document.getElementById('user-display-name');
  if (nameEl) nameEl.textContent = user.display_name;
  // Sett initialer i avatar
  const avatar = document.getElementById('user-avatar');
  if (avatar && user.display_name) {
const parts = user.display_name.trim().split(' ');
const initials = parts.length > 1
  ? parts[0][0] + parts[parts.length-1][0]
  : parts[0].substring(0, 2);
avatar.textContent = initials.toUpperCase();
  }
  showApp();
  loadAiHistory();
  // Sett dato-begrensning for historisk henting
  const historyInput = document.getElementById('set-history-from');
  if (historyInput) {
    const minDate = new Date();
    minDate.setMonth(minDate.getMonth() - 3);
    const minStr = minDate.toISOString().substring(0, 10);
    const todayStr = new Date().toISOString().substring(0, 10);
    historyInput.min = minStr;
    historyInput.max = todayStr;
    if (!historyInput.value || historyInput.value < minStr) {
      historyInput.value = minStr;
    }
    // Hindre verdier utenfor grensen ved input
    historyInput.addEventListener('change', () => {
      if (historyInput.value < minStr) historyInput.value = minStr;
      if (historyInput.value > todayStr) historyInput.value = todayStr;
    });
  }
  try {
const data = await apiFetch('/messages');
state.messages = data.messages;
state.lastSync = data.last_sync;
state.stats = {
  read:data.messages.filter(m => m.status === 'read').length,
  skipped: data.messages.filter(m => m.status === 'skipped').length
};
renderFeed(); updateBadge();
document.getElementById('last-sync').textContent =
  state.lastSync
? new Date(state.lastSync).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
: '–';
  } catch (e) {
console.error('Kunne ikke laste meldinger:', e);
  }
}

// Start
initApp();

// ─── AI Chat ─────────────────────────────────────────────────────────────────

let aiHistory = [];

async function loadAiHistory() {
  try {
    const data = await apiFetch('/ai/history');
    aiHistory = data.history || [];
  } catch (e) {
    aiHistory = [];
  }
  renderAiHistory();
}

async function saveAiHistory() {
  saveAiHistory();
  try {
    await apiFetch('/ai/history', {
      method: 'POST',
      body: JSON.stringify({ history: aiHistory.slice(-50) })
    });
  } catch (e) { /* stille feil */ }
}

function renderAiHistory() {
  const container = document.getElementById('ai-messages');
  if (!container) return;
  if (aiHistory.length === 0) {
container.innerHTML = `
  <div style="text-align:center;padding:20px;color:var(--text3);">
<div style="font-size:32px;margin-bottom:8px;">🤖</div>
<div style="font-size:14px;">Spør meg om noe fra meldingene dine!</div>
<div style="font-size:12px;margin-top:8px;color:var(--text3);">F.eks: "Når er neste fotballtrening?" eller "Hva skjer denne helgen?"</div>
  </div>`;
return;
  }
  container.innerHTML = aiHistory.map(msg => `
<div style="display:flex;flex-direction:column;gap:2px;align-items:${msg.role==='user'?'flex-end':'flex-start'}">
  <div style="max-width:85%;padding:10px 14px;border-radius:${msg.role==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px'};
background:${msg.role==='user'?'#185FA5':'var(--surface)'};
color:${msg.role==='user'?'white':'var(--text)'};
border:${msg.role==='user'?'none':'1px solid var(--border)'};
font-size:14px;line-height:1.6;white-space:pre-wrap;">
${msg.content}
  </div>
  <div style="font-size:10px;color:var(--text3);padding:0 4px;">${msg.role==='user'?'Du':'Brief AI'}</div>
</div>`).join('');
  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function findRelevantMessages(query) {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const scored = state.messages.map(m => {
const text = `${m.title} ${m.tldr} ${m.body} ${m.category} ${m.meta?.group||''} ${m.meta?.sender||''}`.toLowerCase();
const score = words.reduce((s, w) => s + (text.includes(w) ? 1 : 0), 0);
return { ...m, score };
  }).filter(m => m.score > 0).sort((a, b) => b.score - a.score).slice(0, 25);
  return scored;
}

async function sendAiQuestion() {
  const input = document.getElementById('ai-input');
  const sendBtn = document.getElementById('ai-send');
  const question = input?.value?.trim();
  if (!question) return;

  // Add user message
  aiHistory.push({ role: 'user', content: question });
  input.value = '';
  input.style.height = 'auto';
  renderAiHistory();
  sendBtn.disabled = true;
  sendBtn.textContent = '...';

  // Add thinking indicator
  aiHistory.push({ role: 'assistant', content: '⏳ Tenker...' });
  renderAiHistory();

  try {
// Get family context from settings
const settings = await apiFetch('/settings').catch(() => ({}));
const familyContext = settings.family_context || '';
const autoContext = settings.ai_learned_context || '';


    const data = await apiFetch('/ai/chat', {
  method: 'POST',
  body: JSON.stringify({
question,
family_context: familyContext,
auto_context: autoContext,
history: aiHistory.slice(0, -1)
  })
});
const answer = data.answer || 'Beklager, noe gikk galt.';

// Replace thinking with answer
aiHistory[aiHistory.length - 1] = { role: 'assistant', content: answer };
saveAiHistory();
renderAiHistory();

// Auto-learn context from question
learnContextFromQuestion(question, answer);

  } catch (e) {
aiHistory[aiHistory.length - 1] = { role: 'assistant', content: `Feil: ${e.message}` };
renderAiHistory();
  } finally {
sendBtn.disabled = false;
sendBtn.textContent = 'Send';
  }
}

async function learnContextFromQuestion(question, answer) {
  try {
const learnData = await apiFetch('/ai/learn', {
  method: 'POST',
  body: JSON.stringify({ question, answer })
});
const learned = learnData.learned?.trim();
if (learned && learned.length > 3) {
  const settings = await apiFetch('/settings').catch(() => ({}));
  const existing = settings.ai_learned_context || '';
  if (!existing.includes(learned)) {
const updated = existing ? `${existing}
${learned}` : learned;
await apiFetch('/settings', { method: 'PATCH', body: JSON.stringify({ ai_learned_context: updated }) });
  }
}
  } catch (e) { /* stille feil */ }
}

// Enter sender melding (Shift+Enter = ny linje)
document.getElementById('ai-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
e.preventDefault();
sendAiQuestion();
  }
});

// Auto-resize textarea
document.getElementById('ai-input')?.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// ─── Historisk henting ───────────────────────────────────────────────────────

async function fetchHistory() {
  const btn = document.getElementById('btn-fetch-history');
  const statusEl = document.getElementById('history-status');
  const fromDate = document.getElementById('set-history-from')?.value || '2026-01-01';

  btn.disabled = true;
  btn.textContent = 'Henter...';
  statusEl.textContent = '⏳ Henter historiske meldinger – dette kan ta litt tid...';

  try {
    const result = await apiFetch('/fetch-history', {
      method: 'POST',
      body: JSON.stringify({ from_date: fromDate })
    });

    const d = result.details || {};
    const lines = [];
    const icon = n => n > 0 ? '✓' : '○';
    lines.push(`${icon(d.spond)} Spond: ${d.spond || 0} meldinger`);
    lines.push(`${icon(d.email1)} ${d.email1_label || 'Skolemelding'}: ${d.email1 || 0} meldinger`);
    lines.push(`${icon(d.email2)} ${d.email2_label || 'Showbie'}: ${d.email2 || 0} meldinger`);
    lines.push(`${icon(d.whatsapp)} WhatsApp: ${d.whatsapp || 0} meldinger`);
    if (d.errors?.length > 0) d.errors.forEach(e => lines.push(`⚠ ${e}`));

    statusEl.innerHTML = lines.length > 0
      ? `Totalt ${result.total} meldinger hentet:<br>${lines.join('<br>')}`
      : 'Ingen nye meldinger funnet.';

    // Oppdater feed
    if (result.total > 0) {
      const data = await apiFetch('/messages');
      state.messages = data.messages;
      renderFeed(); updateBadge();
    }
  } catch (e) {
    statusEl.textContent = `Feil: ${e.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Hent';
  }
}

// ─── Accordion ────────────────────────────────────────────────────────────────

function toggleAccordion(key) {
  const body  = document.getElementById(`body-${key}`);
  const arrow = document.getElementById(`arrow-${key}`);
  const header = body.previousElementSibling;
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  arrow.classList.toggle('open', !isOpen);
  header.classList.toggle('open', !isOpen);
}

function updateSourceBadge(key) {
  const enabled = document.getElementById(
key === 'spond' ? 'set-spond-enabled' :
key === 'e1'? 'set-e1-enabled' :
key === 'e2'? 'set-e2-enabled' : 'set-wa-enabled'
  )?.checked;
  const badge = document.getElementById(`badge-${key}`);
  if (!badge) return;
  badge.textContent = enabled ? 'På' : 'Av';
  badge.classList.toggle('off', !enabled);
}

// ─── WhatsApp QR i innstillinger ──────────────────────────────────────────────

const WA_URL = localStorage.getItem('wa_url') || 'https://familieapp-whatsapp-service.up.railway.app';

async function loadWaQr() {
  const contentEl = document.getElementById('wa-qr-content');
  const statusEl  = document.getElementById('wa-status-text');
  statusEl.textContent = 'Henter status...';
  contentEl.innerHTML  = '';
  try {
const res  = await fetch(`${WA_URL}/`, { signal: AbortSignal.timeout(8000) });
const data = await res.json();

const btn = document.getElementById('btn-wa-qr');
if (data.ready) {
  statusEl.textContent = '';
  contentEl.innerHTML  = `
<div class="qr-connected">✓ WhatsApp er tilkoblet</div>
<button class="btn-secondary" style="margin-top:10px;color:var(--red);border-color:var(--red)" onclick="logoutWhatsApp()">
  Koble fra WhatsApp
</button>`;
  if (btn) { btn.textContent = 'Oppdater status'; btn.style.display = 'inline-block'; }
} else if (data.hasQr) {
  statusEl.textContent = 'Scan med WhatsApp for å koble til:';
  const qrRes = await fetch(`${WA_URL}/qr`, { signal: AbortSignal.timeout(8000) });
  const html  = await qrRes.text();
  const match = html.match(/src="(data:image\/png;base64,[^"]+)"/);
  if (match) {
contentEl.innerHTML = `
  <div class="qr-container">
<img src="${match[1]}" alt="QR-kode" style="max-width:220px;border-radius:12px;border:6px solid white;display:block;margin:0 auto"/>
<p style="font-size:12px;color:var(--text3);margin-top:8px;text-align:center;">WhatsApp → Innstillinger → Tilkoblede enheter → Koble til enhet</p>
  </div>`;
  }
  if (btn) btn.textContent = 'Last inn QR på nytt';
} else {
  statusEl.textContent = 'Ikke tilkoblet.';
  contentEl.innerHTML = `
<div style="font-size:13px;color:var(--text2);margin-bottom:12px;line-height:1.6;">
  Åpne lenken nedenfor på en PC eller et nettbrett, og scan QR-koden med WhatsApp på telefonen din.
</div>
<a href="${WA_URL}/qr" target="_blank" style="display:block;padding:12px 16px;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius-sm);font-size:13px;color:#185FA5;word-break:break-all;text-decoration:none;margin-bottom:12px;">
  ${WA_URL}/qr
</a>
<button class="btn-secondary" onclick="loadWaQr()">Sjekk status etter scanning</button>`;
  if (btn) btn.style.display = 'none';
}
  } catch (e) {
statusEl.textContent = `Feil: ${e.message}`;
  }
}

// ─── WhatsApp logout ──────────────────────────────────────────────────────────

async function logoutWhatsApp() {
  if (!confirm('Er du sikker på at du vil koble fra WhatsApp? Du må scanne QR-kode på nytt for å koble til igjen.')) return;
  const contentEl = document.getElementById('wa-qr-content');
  const statusEl  = document.getElementById('wa-status-text');
  const btn   = document.getElementById('btn-wa-qr');
  try {
statusEl.textContent = 'Kobler fra...';
contentEl.innerHTML  = '';
await apiFetch('/whatsapp/logout', { method: 'POST' });
// Vis instruksjoner for å koble til på nytt
statusEl.textContent = 'Ikke tilkoblet.';
contentEl.innerHTML = `
  <div style="font-size:13px;color:var(--text2);margin-bottom:12px;line-height:1.6;">
Åpne lenken nedenfor på en PC eller et nettbrett, og scan QR-koden med WhatsApp på telefonen din.
  </div>
  <a href="${WA_URL}/qr" target="_blank" style="display:block;padding:12px 16px;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius-sm);font-size:13px;color:#185FA5;word-break:break-all;text-decoration:none;margin-bottom:12px;">
${WA_URL}/qr
  </a>
  <button class="btn-secondary" onclick="loadWaQr()">Sjekk status etter scanning</button>`;
if (btn) btn.style.display = 'none';
  } catch (e) {
statusEl.textContent = `Feil: ${e.message}`;
  }
}

// ─── Pull-to-refresh ──────────────────────────────────────────────────────────

function initPullToRefresh() {
  const feedView = document.getElementById('view-feed');
  const indicator = document.getElementById('ptr-indicator');
  const spinner   = document.getElementById('ptr-spinner');
  const ptrText   = document.getElementById('ptr-text');
  let startY = 0, pulling = false, triggered = false;
  const THRESHOLD = 80;

  feedView.addEventListener('touchstart', e => {
const feed = document.getElementById('feed');
if (feed.scrollTop > 0) return;
startY = e.touches[0].clientY;
pulling = true;
triggered = false;
  }, { passive: true });

  feedView.addEventListener('touchmove', e => {
if (!pulling) return;
const dy = e.touches[0].clientY - startY;
if (dy <= 0) return;
const progress = Math.min(dy / THRESHOLD, 1);
indicator.classList.add('visible');
indicator.style.height = `${Math.min(dy * 0.4, 44)}px`;
if (dy > THRESHOLD && !triggered) {
  ptrText.textContent = 'Slipp for å oppdatere';
  spinner.style.borderTopColor = 'var(--green)';
} else if (dy <= THRESHOLD) {
  ptrText.textContent = 'Dra ned for å oppdatere';
  spinner.style.borderTopColor = 'var(--text2)';
}
  }, { passive: true });

  feedView.addEventListener('touchend', async e => {
if (!pulling) return;
pulling = false;
const dy = e.changedTouches[0].clientY - startY;
if (dy > THRESHOLD) {
  spinner.classList.add('spinning');
  ptrText.textContent = 'Oppdaterer...';
  await refreshFromCache();
  spinner.classList.remove('spinning');
}
indicator.classList.remove('visible');
indicator.style.height = '0';
ptrText.textContent = 'Dra ned for å oppdatere';
  });
}

// ─── Push-varsler ─────────────────────────────────────────────────────────────

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
const reg = await navigator.serviceWorker.register('/sw.js');
await navigator.serviceWorker.ready;
return reg;
  } catch (e) {
console.error('Service worker feil:', e);
  }
}

async function subscribeToPush() {
  try {
const reg = await registerServiceWorker();
if (!reg) return false;

// Hent VAPID public key fra backend
const { publicKey } = await apiFetch('/push/vapid-key');
if (!publicKey) return false;

// Konverter base64url til Uint8Array
const key = urlBase64ToUint8Array(publicKey);

const sub = await reg.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: key
});

// Lagre abonnement i backend
const subJson = sub.toJSON();
await apiFetch('/push/subscribe', {
  method: 'POST',
  body: JSON.stringify({
endpoint: subJson.endpoint,
keys: subJson.keys
  })
});

return true;
  } catch (e) {
console.error('Push-abonnering feilet:', e);
return false;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function requestPushPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') {
return subscribeToPush();
  }
  if (Notification.permission === 'denied') return false;
  const permission = await Notification.requestPermission();
  if (permission === 'granted') return subscribeToPush();
  return false;
}

// Legg til varsler-knapp i innstillinger (kalles fra loadSettings)
async function initPushSettings() {
  // Fjern eventuell tidligere push-seksjon
  const existing = document.getElementById('push-section');
  if (existing) existing.remove();

  const saveBtn = document.getElementById('btn-save-settings');
  if (!saveBtn) return;

  const pushSection = document.createElement('div');
  pushSection.id = 'push-section';
  pushSection.style.cssText = 'margin-top:16px;padding-top:16px;border-top:1px solid var(--border)';

  const hasNotification = 'Notification' in window;
  const hasSW = 'serviceWorker' in navigator;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
   window.navigator.standalone === true;

  if (!hasNotification || !hasSW) {
pushSection.innerHTML = `
  <div class="field-label" style="margin-bottom:8px;">Push-varsler</div>
  <div style="font-size:13px;color:var(--text2);">
Push-varsler støttes ikke i denne nettleseren. Legg til appen på hjemskjermen i Safari for å aktivere.
  </div>`;
  } else if (!isStandalone) {
pushSection.innerHTML = `
  <div class="field-label" style="margin-bottom:8px;">Push-varsler</div>
  <div style="font-size:13px;color:var(--text2);">
For å aktivere push-varsler må appen legges til på hjemskjermen.<br><br>
Safari → Del-knapp → "Legg til på hjemskjerm"
  </div>`;
  } else {
const perm = Notification.permission;
pushSection.innerHTML = `
  <div class="field-label" style="margin-bottom:8px;">Push-varsler</div>
  <div style="font-size:14px;color:var(--text2);margin-bottom:12px;">
${perm === 'granted' ? '✓ Push-varsler er aktivert' : 'Få varsel når nye meldinger kommer inn'}
  </div>
  ${perm !== 'granted'
? '<button class="btn-secondary" id="btn-enable-push" onclick="enablePush()">Aktiver push-varsler</button>'
: '<button class="btn-secondary" onclick="testPush()">Send testvarsel</button><button class="btn-secondary" onclick="resetPush()" style="margin-top:8px;display:block;width:100%;font-size:13px;color:var(--text3);">Nullstill push-tilkobling</button>'
  }
  <div id="push-status" style="font-size:13px;color:var(--text3);margin-top:8px;"></div>`;
  }

  // Plasser push-seksjonen inne i Annet-accordion
  const placeholder = document.getElementById('push-section-placeholder');
  if (placeholder) {
placeholder.replaceWith(pushSection);
  } else {
saveBtn.parentNode.insertBefore(pushSection, saveBtn);
  }
}

async function enablePush() {
  const statusEl = document.getElementById('push-status');
  statusEl.textContent = 'Aktiverer...';
  // Slett gamle abonnementer først
  await apiFetch('/push/all', { method: 'DELETE' }).catch(() => {});
  const ok = await requestPushPermission();
  if (ok) {
statusEl.textContent = '✓ Push-varsler aktivert!';
document.getElementById('btn-enable-push')?.remove();
  } else {
statusEl.textContent = 'Kunne ikke aktivere push-varsler';
  }
}

async function resetPush() {
  const statusEl = document.getElementById('push-status');
  statusEl.textContent = 'Nullstiller...';
  try {
// Slett alle gamle abonnementer i DB
await apiFetch('/push/all', { method: 'DELETE' });
// Avregistrer service worker subscription
const reg = await navigator.serviceWorker.ready;
const sub = await reg.pushManager.getSubscription();
if (sub) await sub.unsubscribe();
// Re-registrer med nye nøkler
const ok = await subscribeToPush();
statusEl.textContent = ok ? '✓ Push re-aktivert!' : 'Feil ved re-aktivering';
  } catch (e) {
statusEl.textContent = `Feil: ${e.message}`;
  }
}

async function testPush() {
  const statusEl = document.getElementById('push-status');
  statusEl.textContent = 'Sender test...';
  try {
const result = await apiFetch('/push/test', { method: 'POST' });
if (result.sent_to === 0) {
  statusEl.textContent = 'Ingen enheter registrert – prøv å aktivere push på nytt';
  // Prøv å re-registrere
  const ok = await subscribeToPush();
  if (ok) {
statusEl.textContent = 'Registrert! Prøv testvarsel igjen.';
  }
} else {
  statusEl.textContent = `✓ Testvarsel sendt til ${result.sent_to} enhet(er)!`;
}
  } catch (e) {
statusEl.textContent = `Feil: ${e.message}`;
  }
}

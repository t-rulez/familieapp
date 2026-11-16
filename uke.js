// ─── Ukeoversikt – egen, minimal side for iPad-visning ─────────────────────
// Gjenbruker samme innlogging/backend som hovedappen, men viser kun
// AI-genererte ukesdata i tabellform. Ingen av de andre fanene lastes her.

const API_URL = localStorage.getItem('api_url') || 'https://familieapp-backend.up.railway.app';

const PEOPLE = ['Rasmus', 'Gustav', 'Kristin', 'Truls'];

// Enkle, stiliserte avatar-ikoner (ikke bilder av de faktiske personene) –
// farge/kjennetegn gjenkjennelige: Rasmus=bøttehatt, Gustav=caps,
// Kristin=hestehale+solbriller, Truls=skallet+skjegg+solbriller.
const AVATARS = {
  Rasmus: `<svg width="34" height="34" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#E8F1FA"/>
    <circle cx="32" cy="36" r="16" fill="#F4C9A0"/>
    <path d="M14 30 a18 14 0 0 1 36 0 z" fill="#1E3A5F"/>
    <rect x="12" y="28" width="40" height="6" rx="3" fill="#1E3A5F"/>
    <circle cx="26" cy="38" r="2" fill="#2A2A28"/><circle cx="38" cy="38" r="2" fill="#2A2A28"/>
    <path d="M26 46 q6 5 12 0" stroke="#2A2A28" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
  Gustav: `<svg width="34" height="34" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#E9F4EE"/>
    <circle cx="32" cy="37" r="16" fill="#F4C9A0"/>
    <path d="M15 29 Q32 7 49 29 L49 31 Q32 20 15 31 Z" fill="#B33B2E"/>
    <ellipse cx="45" cy="29" rx="9" ry="4" fill="#B33B2E" transform="rotate(-8 45 29)"/>
    <circle cx="32" cy="18" r="3" fill="#F2F2EE"/>
    <circle cx="26" cy="39" r="2" fill="#2A2A28"/><circle cx="38" cy="39" r="2" fill="#2A2A28"/>
    <path d="M26 47 q6 4 12 0" stroke="#2A2A28" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
  Kristin: `<svg width="34" height="34" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#FBEEE8"/>
    <path d="M44 24 q6 10 2 22 l-6 -2 q4 -10 -2 -18 Z" fill="#E8C468"/>
    <circle cx="31" cy="34" r="15" fill="#F6D2A8"/>
    <path d="M16 30 Q31 12 46 28 Q40 20 31 20 Q20 20 16 30Z" fill="#E8C468"/>
    <rect x="18" y="16" width="10" height="6" rx="3" fill="#2A2A28"/>
    <rect x="32" y="16" width="10" height="6" rx="3" fill="#2A2A28"/>
    <rect x="27" y="18" width="6" height="2" fill="#2A2A28"/>
    <circle cx="25" cy="35" r="2" fill="#2A2A28"/><circle cx="36" cy="35" r="2" fill="#2A2A28"/>
    <path d="M24 43 q7 5 14 0" stroke="#2A2A28" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
  Truls: `<svg width="34" height="34" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#F1EAF7"/>
    <circle cx="32" cy="36" r="16" fill="#F2C49B"/>
    <ellipse cx="32" cy="24" rx="15" ry="10" fill="#F2C49B"/>
    <rect x="18" y="35" width="28" height="7" rx="3.5" fill="#2A2A28"/>
    <circle cx="25" cy="38" r="5" fill="none" stroke="#2A2A28" stroke-width="2"/>
    <circle cx="39" cy="38" r="5" fill="none" stroke="#2A2A28" stroke-width="2"/>
    <path d="M24 48 q8 4 16 0 q-2 4 -8 4 q-6 0 -8 -4Z" fill="#C9955E"/>
    <path d="M24 49 q8 3 16 0" stroke="#2A2A28" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`
};

let weekOffset = 0; // 0 = denne uken, 1 = neste uke

function getToken() { return localStorage.getItem('auth_token'); }
function saveAuth(token, user) {
  localStorage.setItem('auth_token', token);
  localStorage.setItem('auth_user', JSON.stringify(user));
}
function logout() {
  localStorage.removeItem('auth_token');
  showLogin();
}

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

function showLogin() {
  document.getElementById('screen-login').style.display = 'flex';
  document.getElementById('screen-app').style.display = 'none';
}
function showApp() {
  document.getElementById('screen-login').style.display = 'none';
  document.getElementById('screen-app').style.display = 'flex';
}

document.getElementById('btn-login').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('auth-error');
  const btn = document.getElementById('btn-login');
  if (!email || !password) { errEl.textContent = 'Fyll inn e-post og passord'; return; }
  try {
    btn.textContent = 'Logger inn...';
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    saveAuth(data.token, data.user);
    errEl.textContent = '';
    await loadWeek();
  } catch (e) {
    errEl.textContent = e.message || 'Innlogging feilet';
  } finally {
    btn.textContent = 'Logg inn';
  }
});

function renderTable(data) {
  const titleEl = document.getElementById('week-title');
  const subEl = document.getElementById('week-sub');

  const start = new Date(data.week_start);
  const end = new Date(data.week_end);
  const fmt = d => d.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' });
  titleEl.textContent = weekOffset === 0 ? 'Denne uken' : 'Neste uke';
  subEl.textContent = `${fmt(start)} – ${fmt(end)}`;

  document.getElementById('btn-prev-week').disabled = (weekOffset <= 0);
  document.getElementById('btn-next-week').disabled = (weekOffset >= 1);

  let html = '<table><thead><tr><th>Dag</th>';
  for (const p of PEOPLE) {
    html += `<th class="col-${p.toLowerCase()}"><div class="person-head">${AVATARS[p]}<span class="name">${p}</span></div></th>`;
  }
  html += '</tr></thead><tbody>';

  for (const day of data.days) {
    const d = new Date(day.date);
    const dateLabel = d.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' });
    html += `<tr class="${day.is_today ? 'today' : ''}">`;
    html += `<td class="day-col">${capitalize(day.day)}<span class="date">${dateLabel}</span></td>`;
    for (const p of PEOPLE) {
      const items = (day.people && day.people[p]) || [];
      html += `<td class="col-${p.toLowerCase()}" data-person="${p}">`;
      if (items.length === 0) {
        html += '<span class="empty-cell">–</span>';
      } else {
        html += items.map(i => `<div class="item">${escapeHtml(i)}</div>`).join('');
      }
      html += '</td>';
    }
    html += '</tr>';
  }
  html += '</tbody></table>';

  document.getElementById('table-wrap').innerHTML = html;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function renderStatus(msg, isError) {
  document.getElementById('table-wrap').innerHTML =
    `<div id="status" class="${isError ? 'error' : ''}">${msg}</div>`;
}

async function loadWeek(forceRefresh = false) {
  showApp();
  renderStatus('Henter ukeoversikt...');
  const btn = document.getElementById('btn-refresh');
  btn.disabled = true;
  btn.textContent = 'Henter...';
  try {
    const params = new URLSearchParams({ week_offset: String(weekOffset) });
    if (forceRefresh) params.set('refresh', 'true');
    const data = await apiFetch(`/ai/week-overview?${params.toString()}`);
    renderTable(data);
  } catch (e) {
    renderStatus(e.message || 'Klarte ikke å hente ukeoversikt', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Oppdater';
  }
}

document.getElementById('btn-refresh').addEventListener('click', () => loadWeek(true));

document.getElementById('btn-prev-week').addEventListener('click', () => {
  if (weekOffset <= 0) return;
  weekOffset -= 1;
  loadWeek();
});
document.getElementById('btn-next-week').addEventListener('click', () => {
  if (weekOffset >= 1) return;
  weekOffset += 1;
  loadWeek();
});

// ─── Start ────────────────────────────────────────────────────────────────

if (getToken()) {
  loadWeek();
} else {
  showLogin();
}

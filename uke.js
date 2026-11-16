// ─── Ukeoversikt – egen, minimal side for iPad-visning ─────────────────────
// Gjenbruker samme innlogging/backend som hovedappen, men viser kun
// AI-genererte ukesdata i tabellform. Ingen av de andre fanene lastes her.

const API_URL = localStorage.getItem('api_url') || 'https://familieapp-backend.up.railway.app';

const PEOPLE = ['Gustav', 'Rasmus', 'Kristin', 'Truls'];

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

// Henter ut klokkeslett (HH:MM) fra et stikkord, f.eks "⚽ 18:00 Fotball" -> "18:00".
// Brukes til sortering og til å justere aktiviteter på samme tidspunkt horisontalt på
// tvers av personer. Formatet skal være "<emoji> <HH:MM> <aktivitet>", så vi leter kun
// i starten av teksten (rett etter emojien) - ellers kan vi plukke opp et tilfeldig
// klokkeslett-lignende tall lenger ute i selve aktivitetsteksten (varighet, resultat
// e.l.), som er roten til at sorteringen innimellom har virket "tilfeldig". Godtar
// både kolon og punktum som skilletegn, samt "kl 19" uten minutter.
function extractTimeKey(text) {
  const head = (text || '').slice(0, 14);
  let m = head.match(/([01]?\d|2[0-3])[:.]([0-5]\d)/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  m = head.match(/\bkl\.?\s*([01]?\d|2[0-3])\b(?!\s*[:.]\d)/i);
  if (m) return `${m[1].padStart(2, '0')}:00`;
  return null;
}

function timeToMinutes(timeKey) {
  if (!timeKey) return null;
  const [h, m] = timeKey.split(':').map(Number);
  return h * 60 + m;
}

const ALIGN_BUCKET_MIN = 30; // "omtrent likt klokkeslett" = samme halvtimes-bøtte

function bucketOf(timeKey) {
  const mins = timeToMinutes(timeKey);
  if (mins === null) return null;
  return Math.floor(mins / ALIGN_BUCKET_MIN) * ALIGN_BUCKET_MIN;
}

// Henter "annet"-listen (fritid/avtaler, ikke skole) for én person/dag - trygt mot
// både ny ({skole,annet}) og eventuell gammel (flat liste) datastruktur fra backend.
function annetOf(day, p) {
  const entry = day.people && day.people[p];
  if (!entry) return [];
  if (Array.isArray(entry)) return entry; // gammelt format
  return Array.isArray(entry.annet) ? entry.annet : [];
}

function skoleOf(day, p) {
  const entry = day.people && day.people[p];
  if (!entry || Array.isArray(entry)) return [];
  return Array.isArray(entry.skole) ? entry.skole : [];
}

// Bygger underrader for én dag: én rad for hver halvtimes-bøtte som faktisk deles av
// 2+ personer (slik at omtrent like klokkeslett - f.eks 17:00 og 17:15 - alignes
// horisontalt), pluss én "rest"-rad til slutt for alt annet (unike tidspunkt og
// stikkord uten kjent tid). Stikkordene er alltid sortert kronologisk i hver celle.
// Merk: kun "annet" (fritid/avtaler) går gjennom denne logikken - "skole" vises for
// seg selv øverst i cellen, uavhengig av rad-oppdelingen her.
function buildDayRows(day) {
  const entries = [];
  for (const p of PEOPLE) {
    const items = annetOf(day, p);
    for (const text of items) entries.push({ person: p, text, timeKey: extractTimeKey(text) });
  }
  if (entries.length === 0) {
    return [{ cells: Object.fromEntries(PEOPLE.map(p => [p, []])) }];
  }

  // Sorter kronologisk (kjente tidspunkt stigende, deretter stikkord uten tid).
  entries.sort((a, b) => {
    const ta = timeToMinutes(a.timeKey), tb = timeToMinutes(b.timeKey);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta - tb;
  });

  const peopleByBucket = {};
  for (const e of entries) {
    const b = bucketOf(e.timeKey);
    if (b === null) continue;
    (peopleByBucket[b] ||= new Set()).add(e.person);
  }
  const sharedBuckets = Object.keys(peopleByBucket)
    .map(Number)
    .filter(b => peopleByBucket[b].size >= 2)
    .sort((a, b) => a - b);

  const rows = [];
  for (const bucket of sharedBuckets) {
    const cells = Object.fromEntries(PEOPLE.map(p => [p, []]));
    for (const e of entries) {
      if (bucketOf(e.timeKey) === bucket) cells[e.person].push(e.text);
    }
    rows.push({ cells });
  }

  const restCells = Object.fromEntries(PEOPLE.map(p => [p, []]));
  let hasRest = false;
  for (const e of entries) {
    const b = bucketOf(e.timeKey);
    if (b !== null && sharedBuckets.includes(b)) continue;
    restCells[e.person].push(e.text);
    hasRest = true;
  }
  if (hasRest || rows.length === 0) {
    rows.push({ cells: restCells });
  }
  return rows;
}

// Sant hvis aktivitetene i DENNE raden/cellen starter kl 16 eller senere - da skal de
// plasseres nederst i cellen i stedet for øverst, som en enkel visuell indikasjon på at
// det er en sen aktivitet (cellen har ledig høyde å spille på pga distributeExtraHeight).
// Går på det tidligste kjente klokkeslettet blant stikkordene i raden - gjelder uansett
// om det er ett eller flere stikkord. Stikkord uten kjent tid teller ikke med i vurderingen;
// hvis INGEN av stikkordene har kjent tid, pushes de ikke (vi vet ikke om det er sent).
function shouldPushBottom(items) {
  if (!items || items.length === 0) return false;
  const mins = items.map(t => timeToMinutes(extractTimeKey(t))).filter(m => m !== null);
  if (mins.length === 0) return false;
  return Math.min(...mins) >= 16 * 60;
}

function renderTable(data) {
  const titleEl = document.getElementById('week-title');
  const subEl = document.getElementById('week-sub');

  const start = new Date(data.week_start);
  const end = new Date(data.week_end);
  const fmt = d => d.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' });
  titleEl.textContent = weekOffset === 0 ? 'Denne uken' : 'Neste uke';
  const weekNrSuffix = data.week_number ? ` (uke ${data.week_number})` : '';
  subEl.textContent = `${fmt(start)} – ${fmt(end)}${weekNrSuffix}`;

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
    const rows = buildDayRows(day);
    rows.forEach((row, idx) => {
      const classes = [day.is_today ? 'today' : '', idx === 0 ? 'day-start' : ''].filter(Boolean).join(' ');
      html += `<tr class="${classes}">`;
      if (idx === 0) {
        html += `<td class="day-col">${shortDay(day.day)}<span class="date">${dateLabel}</span></td>`;
      } else {
        html += `<td class="day-col sub"></td>`;
      }
      for (const p of PEOPLE) {
        const items = row.cells[p];
        // Skole vises kun i dagens FØRSTE rad (ikke gjentatt på hver underrad av dagen),
        // som en egen, liten, grå/kursiv blokk øverst - adskilt fra fritid/avtaler. Resten
        // av cellen (.content) tar all gjenværende plass, slik at push-bottom fortsatt
        // virker riktig selv når det også står et skole-stikkord over.
        const skoleItems = idx === 0 ? skoleOf(day, p) : [];
        const skoleHtml = skoleItems.length
          ? `<div class="skole-items">${skoleItems.map(i => `<div class="skole-item">${escapeHtml(i)}</div>`).join('')}</div>`
          : '';
        const pushBottom = shouldPushBottom(items) ? ' push-bottom' : '';
        const contentHtml = (!items || items.length === 0)
          ? '<span class="empty-cell">–</span>'
          : items.map(i => `<div class="item">${escapeHtml(i)}</div>`).join('');
        html += `<td class="col-${p.toLowerCase()}" data-person="${p}">` +
          `<div class="td-inner">${skoleHtml}<div class="content${pushBottom}">${contentHtml}</div></div>` +
          '</td>';
      }
      html += '</tr>';
    });
  }
  html += '</tbody></table>';

  document.getElementById('table-wrap').innerHTML = html;
  distributeExtraHeight();
}

// Fordeler ledig plass i #table-wrap jevnt per DAG (ikke per rad), slik at hver
// dag utgjør en fast andel (1/7) av skjermen og ukesoversikten til sammen fyller
// 100% av høyden - uansett om en dag har én eller flere underrader. Ekstra plass
// settes som en eksplisitt HØYDE på <tr> (ikke padding), slik at innholdet i hver
// celle (.cell-inner, height:100%) faktisk får den ekstra plassen å jobbe med -
// det er det som gjør at "push-bottom" (kveldsaktivitet nederst i cellen) virker.
// En veldig innholdsrik uke strekkes ikke, men presses heller aldri sammen.
function distributeExtraHeight() {
  const wrap = document.getElementById('table-wrap');
  const table = wrap.querySelector('table');
  if (!table) return;
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  if (!thead || !tbody) return;

  const rows = Array.from(tbody.querySelectorAll('tr'));
  rows.forEach(tr => {
    tr.style.height = '';
    Array.from(tr.children).forEach(td => { td.style.height = ''; });
  }); // nullstill fra forrige måling/visning

  const available = wrap.clientHeight;
  const theadHeight = thead.getBoundingClientRect().height;
  const bodyAvailable = available - theadHeight;
  const naturalBodyHeight = tbody.getBoundingClientRect().height;
  const extra = bodyAvailable - naturalBodyHeight;
  if (extra <= 0) return; // uken er for innholdsrik til å strekkes - la den heller gå marginalt over

  const groups = [];
  let current = null;
  rows.forEach(tr => {
    if (tr.classList.contains('day-start') || !current) {
      current = [];
      groups.push(current);
    }
    current.push(tr);
  });
  if (groups.length === 0) return;

  const extraPerDay = extra / groups.length;
  groups.forEach(groupRows => {
    const extraPerRow = extraPerDay / groupRows.length;
    groupRows.forEach(tr => {
      const natural = tr.getBoundingClientRect().height;
      const h = `${natural + extraPerRow}px`;
      tr.style.height = h;
      // Prosent-høyde (.cell-inner{height:100%}) løses kun hvis høyden står direkte
      // på <td> selv - en høyde satt kun på <tr> regnes ikke som "eksplisitt" av
      // nettleseren for dette formålet, selv om cellen faktisk tegnes like høy.
      Array.from(tr.children).forEach(td => { td.style.height = h; });
    });
  });
}

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(distributeExtraHeight, 150);
});
window.addEventListener('orientationchange', () => setTimeout(distributeExtraHeight, 250));
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => distributeExtraHeight());
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Korte dagnavn (3 bokstaver) - dag-kolonnen er smal, og fulle navn som "Torsdag"
// brytes da stygt midt i ordet uten bindestrek.
const DAY_SHORT = { mandag:'Man', tirsdag:'Tir', onsdag:'Ons', torsdag:'Tor', fredag:'Fre', lørdag:'Lør', søndag:'Søn' };
function shortDay(s) { return DAY_SHORT[(s || '').toLowerCase()] || capitalize(s); }
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

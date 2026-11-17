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
let lastData = null; // siste hentede ukedata - lar oss bytte layout uten ny nettverkskall

const LAYOUT_KEY = 'uke_layout';
function getLayout() {
  const v = localStorage.getItem(LAYOUT_KEY);
  return (v === 'cards' || v === 'agenda') ? v : 'table';
}
function setLayout(v) {
  localStorage.setItem(LAYOUT_KEY, v);
  document.body.classList.remove('layout-table', 'layout-cards', 'layout-agenda');
  document.body.classList.add(`layout-${v}`);
  document.querySelectorAll('#layout-switch button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.layout === v);
  });
}
document.querySelectorAll('#layout-switch button').forEach(btn => {
  btn.addEventListener('click', () => {
    setLayout(btn.dataset.layout);
    if (lastData) renderCurrentLayout(lastData);
  });
});
setLayout(getLayout());

// Fargetema (gjelder først og fremst Tabell-visningen - se egne CSS-blokker i
// uke.html). Rent CSS-drevet: vi bytter bare en klasse på <body>, selve
// render-funksjonene under er helt uendret uansett valgt tema.
const THEME_KEY = 'uke_theme';
const THEMES = ['standard', 'aurora', 'citrus', 'hostglod', 'vinterfrost', 'nexus', 'controlroom'];
function getTheme() {
  const v = localStorage.getItem(THEME_KEY);
  return THEMES.includes(v) ? v : 'standard';
}
function setTheme(v) {
  if (!THEMES.includes(v)) v = 'standard';
  localStorage.setItem(THEME_KEY, v);
  THEMES.forEach(t => document.body.classList.remove(`theme-${t}`));
  if (v !== 'standard') document.body.classList.add(`theme-${v}`);
  const sel = document.getElementById('theme-switch');
  if (sel) sel.value = v;
}
document.getElementById('theme-switch').addEventListener('change', (e) => setTheme(e.target.value));
setTheme(getTheme());

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

  // VIKTIG: én rad PER TIDSBØTTE (uansett om den deles av 2+ personer eller bare
  // har kjent tid for én person) - ikke bare bøtter som faktisk deles, pluss én
  // felles "rest"-rad for alt annet. Den gamle modellen samlet ALLE bøtter med kun
  // 1 person i én enkelt delt "rest"-rad, og ga den raden én sorteringsnøkkel basert
  // på det tidligste tidspunktet BLANT ALLE PERSONER i raden - det førte til at en
  // persons SENE, unike tidspunkt (f.eks. Kristin kl 20:00) kunne "låne" en tidlig
  // plassering i tabellen bare fordi en ANNEN person (f.eks. Truls kl 14:00) også
  // hadde noe unikt i samme rest-rad. Med én rad per bøtte oppstår aldri denne
  // sammenblandingen - hver rads sorteringsnøkkel er alltid bøttens eget tidspunkt.
  const bucketsSeen = new Set();
  for (const e of entries) {
    const b = bucketOf(e.timeKey);
    if (b !== null) bucketsSeen.add(b);
  }
  const sortedBuckets = Array.from(bucketsSeen).sort((a, b) => a - b);

  const rows = [];
  for (const bucket of sortedBuckets) {
    const cells = Object.fromEntries(PEOPLE.map(p => [p, []]));
    for (const e of entries) {
      if (bucketOf(e.timeKey) === bucket) cells[e.person].push(e.text);
    }
    rows.push({ cells });
  }

  // Stikkord helt UTEN kjent tidspunkt har ingenting å sorteres kronologisk etter -
  // disse samles i én felles rad til slutt, etter alle tidfestede rader.
  const noTimeCells = Object.fromEntries(PEOPLE.map(p => [p, []]));
  let hasNoTime = false;
  for (const e of entries) {
    if (bucketOf(e.timeKey) !== null) continue;
    noTimeCells[e.person].push(e.text);
    hasNoTime = true;
  }
  if (hasNoTime || rows.length === 0) {
    rows.push({ cells: noTimeCells });
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

// Oppdaterer uke-tittel/undertittel og frem/tilbake-knappene - felles for alle tre
// layoutene, uavhengig av hvilken som er valgt.
function updateWeekHeader(data) {
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
}

// Velger riktig render-funksjon ut fra valgt layout (lagret i localStorage via
// layout-switch-knappene) - alle tre bruker samme rådata fra backend.
function renderCurrentLayout(data) {
  lastData = data;
  updateWeekHeader(data);
  const layout = getLayout();
  if (layout === 'cards') renderCards(data);
  else if (layout === 'agenda') renderAgenda(data);
  else renderTable(data);
}

function renderTable(data) {
  let html = '<table><thead><tr><th>Dag</th>';
  for (const p of PEOPLE) {
    html += `<th class="col-${p.toLowerCase()}"><div class="person-head">${AVATARS[p]}<span class="name">${p}</span></div></th>`;
  }
  html += '</tr></thead><tbody>';

  const dayList = data.days;
  dayList.forEach((day, dayIdx) => {
    const d = new Date(day.date);
    const dateLabel = d.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' });
    const rows = buildDayRows(day);
    rows.forEach((row, idx) => {
      const isLast = idx === rows.length - 1;
      const classes = [
        day.is_today ? 'today' : '',
        idx === 0 ? 'day-start' : '',
        isLast ? 'day-end' : '',
        (idx === 0 && (day.day || '').toLowerCase() === 'lørdag') ? 'weekend-start' : ''
      ].filter(Boolean).join(' ');
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
          ? `<div class="skole-items">${skoleItems.map(i => `<div class="skole-item">${displayText(i)}</div>`).join('')}</div>`
          : '';
        const pushBottom = shouldPushBottom(items) ? ' push-bottom' : '';
        const contentHtml = (!items || items.length === 0)
          ? ''
          : items.map(i => `<div class="item">${displayText(i)}</div>`).join('');
        html += `<td class="col-${p.toLowerCase()}" data-person="${p}">` +
          `<div class="td-inner">${skoleHtml}<div class="content${pushBottom}">${contentHtml}</div></div>` +
          '</td>';
      }
      html += '</tr>';
    });
    // Luft MELLOM dager (ikke mellom underrader av samme dag) - en egen, tom
    // rad med litt høyde, slik at hver dag framstår som ÉN avrundet blokk selv
    // når den består av flere underrader (se CSS: kun første/siste underrad i
    // en dag får avrundede hjørner, ikke hver enkelt rad).
    if (dayIdx < dayList.length - 1) {
      html += `<tr class="day-gap" aria-hidden="true"><td colspan="${PEOPLE.length + 1}"></td></tr>`;
    }
  });
  html += '</tbody></table>';

  document.getElementById('table-wrap').innerHTML = html;
  distributeExtraHeight();
}

// Henter "annet"-listen for én person/dag, sortert kronologisk (kjente tidspunkt
// først, deretter stikkord uten tid) - samme sorteringsprinsipp som buildDayRows,
// men per person i stedet for samlet, siden kort-layouten ikke trenger å rad-justere
// forskjellige personers tidspunkt mot hverandre.
function sortedAnnet(day, p) {
  const items = annetOf(day, p).map(text => ({ text, timeKey: extractTimeKey(text) }));
  items.sort((a, b) => {
    const ta = timeToMinutes(a.timeKey), tb = timeToMinutes(b.timeKey);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta - tb;
  });
  return items.map(i => i.text);
}

// ─── Layout A: Myke kort - én kortbasert boks per dag, personene som fire mini-
// seksjoner inni kortet i stedet for fargede kolonner. ──────────────────────
function renderCards(data) {
  let html = '';
  for (const day of data.days) {
    const d = new Date(day.date);
    const dateLabel = d.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' });
    const isWeekend = ['lørdag', 'søndag'].includes((day.day || '').toLowerCase());
    const classes = ['day-card', isWeekend ? 'weekend' : '', day.is_today ? 'today' : ''].filter(Boolean).join(' ');
    html += `<div class="${classes}">`;
    html += `<div class="day-card-head"><span class="dname">${shortDay(day.day)}</span><span class="ddate">${dateLabel}</span>`;
    if (isWeekend) html += '<span class="helg-badge">HELG</span>';
    html += '</div><div class="day-card-grid">';
    for (const p of PEOPLE) {
      const pl = p.toLowerCase();
      const skoleItems = skoleOf(day, p);
      const items = sortedAnnet(day, p);
      html += `<div class="card-person"><div class="phead"><span class="pdot p-${pl}-bg"></span><span class="pname p-${pl}-fg">${p.toUpperCase()}</span></div>`;
      for (const s of skoleItems) html += `<div class="card-skole">${displayText(s)}</div>`;
      for (const i of items) html += `<div class="card-chip p-${pl}-tint">${displayText(i)}</div>`;
      html += '</div>';
    }
    html += '</div></div>';
  }
  document.getElementById('table-wrap').innerHTML = html || '<div id="status">Ingen dager å vise.</div>';
}

// Fjerner et ledende klokkeslett (og emoji før det) fra et stikkord, f.eks.
// "🏒 16:00 Trening Lillegutt" -> "🏒 Trening Lillegutt" - brukes i tidslinje-
// layouten, der klokkeslettet allerede vises i sin egen kolonne til venstre.
function stripLeadingTime(text) {
  const head = (text || '').slice(0, 14);
  let m = head.match(/([01]?\d|2[0-3])[:.]([0-5]\d)/);
  if (!m) m = head.match(/\bkl\.?\s*([01]?\d|2[0-3])\b(?!\s*[:.]\d)/i);
  if (!m) return text;
  const idx = head.indexOf(m[0]);
  return (text.slice(0, idx) + text.slice(idx + m[0].length)).replace(/\s{2,}/g, ' ').trim();
}

// Slår sammen "annet"-stikkord fra ALLE personer for én dag til én kronologisk
// liste, der identiske (tidspunkt, tekst)-par fra flere personer (f.eks. "R & G
// gymtøy" som ligger likt hos både Rasmus og Gustav) blir ETT oppføring med to
// avatarer i stedet for to separate linjer.
function buildAgendaEntries(day) {
  const groups = new Map();
  for (const p of PEOPLE) {
    for (const text of annetOf(day, p)) {
      const timeKey = extractTimeKey(text);
      const key = `${timeKey || ''}||${text}`;
      if (!groups.has(key)) groups.set(key, { text, timeKey, people: [] });
      groups.get(key).people.push(p);
    }
  }
  const entries = Array.from(groups.values());
  entries.sort((a, b) => {
    const ta = timeToMinutes(a.timeKey), tb = timeToMinutes(b.timeKey);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta - tb;
  });
  return entries;
}

// ─── Layout B: Tidslinje - alle fire personene samlet i én kronologisk linje per
// dag (som en agenda-/kalender-app), i stedet for fire kolonner. ────────────
function renderAgenda(data) {
  let html = '<div class="agenda-wrap">';
  for (const day of data.days) {
    const d = new Date(day.date);
    const dateLabel = d.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' });
    const isWeekend = ['lørdag', 'søndag'].includes((day.day || '').toLowerCase());
    html += `<div class="agenda-day${day.is_today ? ' today' : ''}">`;
    html += `<div class="agenda-head${isWeekend ? ' weekend' : ''}"><span class="dname">${shortDay(day.day)}</span><span class="ddate">${dateLabel}</span>`;
    if (isWeekend) html += '<span class="helg-badge">HELG</span>';
    html += '</div>';

    // Lekser vises i EGNE kolonner per person (ikke slått sammen til én liste) -
    // ellers er det umulig å se om en lekse gjelder Gustav eller Rasmus når begge
    // har lekser samme dag.
    const skolePeople = PEOPLE.filter(p => skoleOf(day, p).length > 0);
    let skoleCount = 0;
    if (skolePeople.length) {
      html += '<div class="agenda-skole-grid">';
      for (const p of skolePeople) {
        const pl = p.toLowerCase();
        const items = skoleOf(day, p);
        skoleCount += items.length;
        html += `<div class="agenda-skole-col"><div class="agenda-skole-pname p-${pl}-fg">${p.toUpperCase()}</div>`;
        for (const s of items) html += `<div class="agenda-skole-item">${displayText(s)}</div>`;
        html += '</div>';
      }
      html += '</div>';
    }

    const entries = buildAgendaEntries(day);
    if (entries.length === 0 && skoleCount === 0) {
      html += '<div class="agenda-empty">Ingen avtaler</div>';
    } else {
      for (const e of entries) {
        const timeLabel = e.timeKey || '–';
        let avatars = '';
        for (const p of e.people) {
          avatars += `<span class="avatar-dot p-${p.toLowerCase()}-bg">${p.charAt(0)}</span>`;
        }
        html += `<div class="agenda-row"><div class="agenda-time">${timeLabel}</div>` +
          `<div class="agenda-avatars">${avatars}</div>` +
          `<div class="agenda-text">${displayText(stripLeadingTime(e.text))}</div></div>`;
      }
    }
    html += '</div>';
  }
  html += '</div>';
  document.getElementById('table-wrap').innerHTML = html;
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

  // "day-gap"-radene (luften MELLOM dager, se renderTable) skal ha en fast,
  // liten høyde satt i CSS - de skal aldri regnes med i eller selv få noe av den
  // ekstra, utstrakte høyden som fordeles på de virkelige innholdsradene under.
  const rows = Array.from(tbody.querySelectorAll('tr:not(.day-gap)'));

  // Under 620px går tabellen om til en stablet, mobilvennlig kort-liste (se
  // media-query i uke.html) - <thead> skjules og <tr>/<td> blir flex-blokker i
  // stedet for tabell-rader/-celler. Eksplisitte høyder satt her er beregnet for
  // DESKTOP-oppsettet og passer ikke dette layoutet i det hele tatt; satt likevel,
  // ga de et for lite/feil mål som i praksis gjorde alt innhold usynlig på smale
  // skjermer (selve teksten fantes i DOM-en, men ble aldri synlig). Hopper derfor
  // helt over høyde-fordelingen her og lar mobil-CSS-en style seg selv fritt.
  if (window.matchMedia('(max-width: 620px)').matches) {
    rows.forEach(tr => {
      tr.style.height = '';
      Array.from(tr.children).forEach(td => { td.style.height = ''; });
    });
    return;
  }

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
// Forkorter familienavn til forbokstav INNI selve stikkord-teksten (f.eks. "Kristin
// trening" -> "K trening", "Truls innebandy" -> "T innebandy") - ikke i kolonne-/
// kort-overskrifter, der navnet allerede er det eneste som identifiserer hvem raden/
// kortet gjelder. Bruker rett og slett forbokstaven i hvert navn i PEOPLE (ikke noe
// hentet fra familieprofilen) - de fire navnene starter alltid på fire ulike
// bokstaver, så dette er trygt uansett hva slags kallenavn som ellers er definert.
// Kun hele ord byttes ut (ordgrense), slik at f.eks. "Kristins" eller et navn som
// tilfeldigvis inngår i et annet ord ikke treffes feilaktig.
function abbreviateNames(text) {
  let result = text || '';
  for (const p of PEOPLE) {
    result = result.replace(new RegExp(`\\b${p}\\b`, 'g'), p.charAt(0));
  }
  return result;
}

function displayText(s) {
  return escapeHtml(abbreviateNames(s));
}

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
    renderCurrentLayout(data);
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

// ─── Automatisk oppdatering ─────────────────────────────────────────────────
// Oppdaterer ukesoversikten automatisk hver 2. time, forankret til kl 12:00 -
// altså ved hver PARTALLSTIME (00, 02, 04 ... 12, 14 ... 22). iPad-en er ment å
// stå fremme hele tiden, så dette holder visningen fersk uten at noen må trykke
// "Oppdater" manuelt. Gjelder kun mens siden faktisk er åpen i nettleseren/PWA-en
// (ingen bakgrunns-oppdatering når appen er lukket eller iPad-en i dvale).
function msUntilNextEvenHour() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
  if (next.getHours() % 2 !== 0) next.setHours(next.getHours() + 1);
  if (next <= now) next.setHours(next.getHours() + 2);
  return next.getTime() - now.getTime();
}

let autoRefreshTimer = null;
function scheduleAutoRefresh() {
  if (autoRefreshTimer) clearTimeout(autoRefreshTimer);
  autoRefreshTimer = setTimeout(() => {
    if (getToken()) loadWeek(true);
    scheduleAutoRefresh();
  }, msUntilNextEvenHour());
}
scheduleAutoRefresh();

// ─── Start ────────────────────────────────────────────────────────────────

if (getToken()) {
  loadWeek();
} else {
  showLogin();
}

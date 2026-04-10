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
  stats: { read: 0, skipped: 0 },
  lastSync: null
};

function saveLocalStats() {
  localStorage.setItem('stats', JSON.stringify(state.stats));
}

// ─── Source config ────────────────────────────────────────────────────────────

const SOURCE_CONFIG = {
  spond:        { color: '#185FA5', bgVar: '--spond-bg' },
  skolemelding: { color: '#2D6A4F', bgVar: '--skolemelding-bg' },
  showbie:      { color: '#BA7517', bgVar: '--showbie-bg' },
  whatsapp:     { color: '#993556', bgVar: '--whatsapp-bg' }
};

// ─── Visning ──────────────────────────────────────────────────────────────────

function showLogin()    { document.getElementById('screen-login').style.display = 'flex';  document.getElementById('screen-app').style.display = 'none'; }
function showApp()      { document.getElementById('screen-login').style.display = 'none';  document.getElementById('screen-app').style.display = 'flex'; }
function showAuthError(msg) { document.getElementById('auth-error').textContent = msg; }

// ─── Innlogging ───────────────────────────────────────────────────────────────

document.getElementById('btn-login').addEventListener('click', async () => {
  const email    = document.getElementById('login-email').value.trim();
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
  const email    = document.getElementById('reg-email').value.trim();
  const name     = document.getElementById('reg-name').value.trim();
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
  return state.messages.filter(m => {
    const statusMatch = state.statusFilter === 'alle' || m.status === state.statusFilter;
    const sourceMatch = state.sourceFilter === 'alle' ||
      (m.source || '').toLowerCase() === state.sourceFilter.toLowerCase();
    return statusMatch && sourceMatch;
  });
}

function renderFeed() {
  const feed = document.getElementById('feed');
  const msgs = getFiltered();
  if (msgs.length === 0) {
    feed.innerHTML = `<div class="empty-state"><div class="icon">✓</div><p>Ingen meldinger${state.filter !== 'alle' ? ' i denne kategorien' : ''}.</p></div>`;
    return;
  }
  feed.innerHTML = msgs.map(m => renderCard(m)).join('');
  msgs.forEach(m => attachCardEvents(m.id));
  updateBadge();
}

function renderCard(m) {
  const cfg = SOURCE_CONFIG[m.source] || { color: '#888', bgVar: '--surface2' };
  return `
  <div class="card" id="card-${m.id}" data-id="${m.id}">
    <div class="swipe-hint swipe-hint-ok">Lest ✓</div>
    <div class="swipe-hint swipe-hint-skip">Skjul ✕</div>
    <div class="card-header">
      <div class="source-tag">
        <div class="source-dot" style="background:${cfg.color}"></div>
        <span class="source-label" style="color:${cfg.color}">${m.sourceLabel} · ${categoryLabel(m.category)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        ${state.statusFilter !== 'unread' ? `<span style="display:flex;align-items:center;gap:3px;font-size:10px;font-family:'DM Mono',monospace;font-weight:500;color:${m.status==='read'?'var(--green)':m.status==='skipped'?'var(--red)':'#BA7517'}"><span style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:${m.status==='read'?'var(--green)':m.status==='skipped'?'var(--red)':'#BA7517'}"></span>${m.status==='read'?'lest':m.status==='skipped'?'ignorert':'ny'}</span>` : ''}
        <span class="card-time">${m.time}</span>
      </div>
    </div>
    <div class="card-title">${m.title}</div>
    <div class="tldr" style="background:var(${cfg.bgVar})">
      <div class="tldr-label" style="color:${cfg.color}">TL;DR</div>
      <div class="tldr-text" style="color:${cfg.color}">${m.tldr}</div>
    </div>
    <div class="card-body" id="body-${m.id}">${m.body}</div>
    <button class="expand-btn" id="expand-${m.id}" data-id="${m.id}" style="color:${cfg.color}">Les hele meldingen ↓</button>
    <div class="card-actions">
      ${m.status === 'unread'
        ? `<button class="btn btn-ok" data-action="read" data-id="${m.id}">Lest / OK</button>
           <button class="btn btn-skip" data-action="skip" data-id="${m.id}">Ikke relevant</button>`
        : m.status === 'skipped'
        ? `<button class="btn btn-ok" style="flex:1" data-action="read" data-id="${m.id}">Relevant – merk som lest</button>
           <button class="btn btn-skip" data-action="unread" data-id="${m.id}">↩ Ny</button>`
        : `<button class="btn btn-skip" data-action="skip" data-id="${m.id}">Ikke relevant</button>
           <button class="btn btn-skip" style="background:var(--surface2)" data-action="unread" data-id="${m.id}">↩ Ny</button>`
      }
    </div>
  </div>`;
}

function categoryLabel(cat) {
  return { skole: 'Skole', aks: 'AKS', idrett: 'Spond', foreldre: 'WhatsApp', whatsapp: 'WhatsApp' }[(cat||'').toLowerCase()] || cat;
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
  if (msg.status === 'read')    state.stats.read    = Math.max(0, state.stats.read - 1);
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
  const badge = document.getElementById('unread-count');
  badge.textContent = unread > 0 ? `${unread} nye` : 'Alt lest';
  badge.style.background = unread > 0 ? 'var(--text)' : 'var(--green)';
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
      if (dx > 30)       { hintOk.style.opacity = Math.min((dx - 30) / 60, 0.9); hintSkip.style.opacity = 0; }
      else if (dx < -30) { hintSkip.style.opacity = Math.min((-dx - 30) / 60, 0.9); hintOk.style.opacity = 0; }
      else               { hintOk.style.opacity = 0; hintSkip.style.opacity = 0; }
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

// ─── Navigasjon ───────────────────────────────────────────────────────────────

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-feed').style.display = view === 'feed' ? 'flex' : 'none';
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    if (view !== 'feed') document.getElementById(`view-${view}`).classList.add('active');
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
    await apiFetch('/sync', { method: 'POST' });
    const data = await apiFetch('/messages');
    state.messages = data.messages;
    state.lastSync = data.last_sync;
    renderFeed(); updateBadge();
    document.getElementById('last-sync').textContent =
      new Date().toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    console.error('Synk feilet:', e);
  } finally {
    btn.classList.remove('syncing'); btn.disabled = false;
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
  const sources = {};
  state.messages.forEach(m => {
    if (!sources[m.source]) sources[m.source] = { label: m.sourceLabel, count: 0 };
    sources[m.source].count++;
  });
  document.getElementById('source-stats').innerHTML = Object.entries(sources).map(([key, val]) => `
    <div class="settings-row">
      <div class="settings-row-left">
        <div style="width:10px;height:10px;border-radius:50%;background:${SOURCE_CONFIG[key]?.color||'#888'};flex-shrink:0;"></div>
        <span class="settings-row-text">${val.label}</span>
      </div>
      <span style="font-size:13px;color:var(--text2);font-family:'DM Mono',monospace;">${val.count} meldinger</span>
    </div>`).join('');
}

// ─── Innstillinger ────────────────────────────────────────────────────────────

async function loadSettings() {
  try {
    const s = await apiFetch('/settings');
    // Spond
    document.getElementById('set-spond-user').value    = s.spond_username || '';
    document.getElementById('set-spond-enabled').checked = !!s.spond_enabled;
    document.getElementById('spond-pw-status').textContent = s.spond_has_password ? '(passord lagret)' : '(ikke satt)';
    // E-post 1
    document.getElementById('set-e1-host').value      = s.email_1_host || 'imap.one.com';
    document.getElementById('set-e1-user').value      = s.email_1_username || '';
    document.getElementById('set-e1-from').value      = s.email_1_from_filter || '';
    document.getElementById('set-e1-subject').value   = s.email_1_subject_filter || '';

    document.getElementById('set-e1-delete').checked  = !!s.email_1_delete_after;
    document.getElementById('set-e1-enabled').checked = !!s.email_1_enabled;
    document.getElementById('e1-pw-status').textContent = s.email_1_has_password ? '(passord lagret)' : '(ikke satt)';
    // E-post 2
    document.getElementById('set-e2-host').value      = s.email_2_host || 'imap.one.com';
    document.getElementById('set-e2-user').value      = s.email_2_username || '';
    document.getElementById('set-e2-from').value      = s.email_2_from_filter || '';
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
    // Update accordion badges
    ['spond','e1','e2','wa'].forEach(k => updateBadge(k));
    initPushSettings();
    document.getElementById('set-user-email').textContent = user?.email || '';
  } catch (e) {
    console.error('Kunne ikke laste innstillinger:', e);
  }
}

async function saveSettings() {
  const btn = document.getElementById('btn-save-settings');
  btn.textContent = 'Lagrer...'; btn.disabled = true;
  try {
    const updates = {
      spond_username: document.getElementById('set-spond-user').value.trim(),
      spond_enabled:  document.getElementById('set-spond-enabled').checked,
      email_1_host:           document.getElementById('set-e1-host').value.trim(),
      email_1_username:       document.getElementById('set-e1-user').value.trim(),
      email_1_from_filter:    document.getElementById('set-e1-from').value.trim(),
      email_1_subject_filter: document.getElementById('set-e1-subject').value.trim(),

      email_1_delete_after:   document.getElementById('set-e1-delete').checked,
      email_1_enabled:        document.getElementById('set-e1-enabled').checked,
      email_2_host:           document.getElementById('set-e2-host').value.trim(),
      email_2_username:       document.getElementById('set-e2-user').value.trim(),
      email_2_from_filter:    document.getElementById('set-e2-from').value.trim(),
      email_2_subject_filter: document.getElementById('set-e2-subject').value.trim(),

      email_2_delete_after:   document.getElementById('set-e2-delete').checked,
      email_2_enabled:        document.getElementById('set-e2-enabled').checked,
      wa_group_filter:  document.getElementById('set-wa-filter').value.trim(),

      wa_enabled:       document.getElementById('set-wa-enabled').checked,
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
  const nameEl = document.getElementById('user-display-name');
  if (nameEl) nameEl.textContent = user.display_name;
  showApp();
  try {
    const data = await apiFetch('/messages');
    state.messages = data.messages;
    state.lastSync = data.last_sync;
    state.stats = {
      read:    data.messages.filter(m => m.status === 'read').length,
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

function updateBadge(key) {
  const enabled = document.getElementById(
    key === 'spond' ? 'set-spond-enabled' :
    key === 'e1'    ? 'set-e1-enabled' :
    key === 'e2'    ? 'set-e2-enabled' : 'set-wa-enabled'
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
      if (btn) btn.textContent = 'Oppdater status';
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
      statusEl.textContent = 'WhatsApp-tjenesten starter opp, prøv igjen om litt...';
      if (btn) btn.textContent = 'Prøv igjen';
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
  try {
    statusEl.textContent = 'Kobler fra...';
    contentEl.innerHTML  = '';
    await apiFetch('/whatsapp/logout', { method: 'POST' });
    statusEl.textContent = 'Koblet fra. Trykk "Sjekk tilkoblingsstatus" for ny QR-kode.';
    const btn = document.getElementById('btn-wa-qr');
    if (btn) btn.textContent = 'Sjekk tilkoblingsstatus';
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
      await manualSync();
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
        : '<button class="btn-secondary" onclick="testPush()">Send testvarsel</button>'
      }
      <div id="push-status" style="font-size:13px;color:var(--text3);margin-top:8px;"></div>`;
  }

  saveBtn.parentNode.insertBefore(pushSection, saveBtn);
}

async function enablePush() {
  const statusEl = document.getElementById('push-status');
  statusEl.textContent = 'Aktiverer...';
  const ok = await requestPushPermission();
  if (ok) {
    statusEl.textContent = '✓ Push-varsler aktivert!';
    document.getElementById('btn-enable-push')?.remove();
  } else {
    statusEl.textContent = 'Kunne ikke aktivere push-varsler';
  }
}

async function testPush() {
  const statusEl = document.getElementById('push-status');
  statusEl.textContent = 'Sender test...';
  try {
    await apiFetch('/push/test', { method: 'POST' });
    statusEl.textContent = '✓ Testvarsel sendt!';
  } catch (e) {
    statusEl.textContent = `Feil: ${e.message}`;
  }
}

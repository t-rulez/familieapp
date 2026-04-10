// ─── Sample data (will be replaced by API in Phase 2) ───────────────────────

const MESSAGES = [
  {
    id: 1,
    source: 'spond',
    sourceLabel: 'Spond',
    category: 'idrett',
    title: 'Dugnadsdag 19. april',
    tldr: 'Dugnad lørdag 19. april kl. 10–13 på Voldsløkka. Ta med hansker og rake. Obligatorisk for alle familier.',
    body: 'Kjære foreldre, vi minner om årets dugnadsdag som er satt til lørdag 19. april fra kl. 10:00 til 13:00 på Voldsløkka. Det er obligatorisk at en voksen fra hver familie møter opp. Ta gjerne med hanske, rake og eventuelt greinsaks. Det serveres kaffe og brus. Kontakt Kjetil på 99887766 ved spørsmål.',
    time: '10:32',
    priority: 'high',
    status: 'unread'
  },
  {
    id: 2,
    source: 'skolemelding',
    sourceLabel: 'Skolemelding',
    category: 'skole',
    title: 'Foreldremøte 22. april',
    tldr: 'Obligatorisk foreldremøte for 3. trinn onsdag 22. april kl. 18:00 i aulaen. Påmelding ikke nødvendig.',
    body: 'Vi inviterer alle foresatte på 3. trinn til foreldremøte onsdag 22. april kl. 18:00–19:30 i aulaen. Tema er faglig utvikling, sosiale mål og planlegging av våravslutning. Ingen påmelding nødvendig. Enkel servering. Vel møtt! Hilsen Tone Bakken, kontaktlærer 3B.',
    time: '08:14',
    priority: 'high',
    status: 'unread'
  },
  {
    id: 3,
    source: 'showbie',
    sourceLabel: 'Showbie',
    category: 'skole',
    title: 'Lekser uke 16',
    tldr: 'Matematikk s. 42–43 og leselogg. Innlevering fredag.',
    body: 'Hei! Denne uken er leksene: Matematikk side 42–43 (alle oppgaver), leselogg med minst 20 min lesing per dag, og skriveøvelse "Min beste ferie" (minst 10 setninger). Leveres i Showbie innen fredag kl. 23:59.',
    time: 'i går',
    priority: 'medium',
    status: 'unread'
  },
  {
    id: 4,
    source: 'spond',
    sourceLabel: 'Spond',
    category: 'idrett',
    title: 'Trening avlyst fredag',
    tldr: 'Fredagens trening er avlyst pga. hallkonflikt. Neste trening er mandag som normalt.',
    body: 'Beklager kort varsel – fredagens trening 18. april er dessverre avlyst fordi hallen er booket til en skolefunksjon. Neste planlagte trening er mandag 22. april kl. 17:30. Samme oppmøtested. Ha en god helg!',
    time: 'i går',
    priority: 'medium',
    status: 'unread'
  },
  {
    id: 5,
    source: 'skolemelding',
    sourceLabel: 'Skolemelding',
    category: 'aks',
    title: 'AKS stengt 1. mai',
    tldr: 'AKS holder stengt 1. mai (offentlig fridag). Husk å ordne barnepass.',
    body: 'Vi minner om at AKS holder stengt på offentlige fridager, herunder 1. mai. Skolen er åpen, men AKS gir ikke tilbud denne dagen. Har du behov for tilrettelagt dagplass, ta kontakt med kommunen.',
    time: '2 dager siden',
    priority: 'medium',
    status: 'unread'
  },
  {
    id: 6,
    source: 'skolemelding',
    sourceLabel: 'Skolemelding',
    category: 'skole',
    title: 'Påskeferie – skolestart etter ferien',
    tldr: 'Skolen starter igjen mandag 22. april. God påske!',
    body: 'Vi ønsker alle elever og foresatte en riktig god påskeferie. Skolen åpner igjen mandag 22. april kl. 08:15. Husk at SFO/AKS har ordinære åpningstider fra samme dag.',
    time: '3 dager siden',
    priority: 'low',
    status: 'unread'
  }
];

// ─── State ───────────────────────────────────────────────────────────────────

let state = {
  messages: JSON.parse(localStorage.getItem('messages')) || MESSAGES,
  filter: 'alle',
  statusFilter: 'unread',
  stats: JSON.parse(localStorage.getItem('stats')) || { read: 0, skipped: 0 }
};

function saveState() {
  localStorage.setItem('messages', JSON.stringify(state.messages));
  localStorage.setItem('stats', JSON.stringify(state.stats));
}

// ─── Source config ────────────────────────────────────────────────────────────

const SOURCE_CONFIG = {
  spond:       { color: '#185FA5', bgVar: '--spond-bg' },
  skolemelding:{ color: '#2D6A4F', bgVar: '--skolemelding-bg' },
  showbie:     { color: '#BA7517', bgVar: '--showbie-bg' },
  whatsapp:    { color: '#993556', bgVar: '--whatsapp-bg' }
};

// ─── Render feed ──────────────────────────────────────────────────────────────

function getFiltered() {
  return state.messages.filter(m => {
    const statusMatch = state.statusFilter === 'alle' || m.status === state.statusFilter;
    const categoryMatch = state.filter === 'alle' || m.category === state.filter;
    return statusMatch && categoryMatch;
  });
}

function renderFeed() {
  const feed = document.getElementById('feed');
  const msgs = getFiltered();

  if (msgs.length === 0) {
    feed.innerHTML = `
      <div class="empty-state">
        <div class="icon">✓</div>
        <p>Ingen uleste meldinger${state.filter !== 'alle' ? ' i denne kategorien' : ''}.</p>
      </div>`;
    return;
  }

  feed.innerHTML = msgs.map(m => renderCard(m)).join('');

  msgs.forEach(m => attachCardEvents(m.id));
  updateBadge();
}

function renderCard(m) {
  const cfg = SOURCE_CONFIG[m.source] || { color: '#888', bgVar: '--surface2' };
  const tldrStyle = `background: var(${cfg.bgVar});`;
  const tldrLabelColor = cfg.color;

  return `
  <div class="card" id="card-${m.id}" data-id="${m.id}">
    <div class="swipe-hint swipe-hint-ok" id="hint-ok-${m.id}">Lest ✓</div>
    <div class="swipe-hint swipe-hint-skip" id="hint-skip-${m.id}">Skjul ✕</div>

    <div class="card-header">
      <div class="source-tag">
        <div class="source-dot" style="background:${cfg.color}"></div>
        <span class="source-label" style="color:${cfg.color}">${m.sourceLabel} · ${categoryLabel(m.category)}</span>
      </div>
      <span class="card-time">${m.time}</span>
    </div>

    <div class="card-title">${m.title}</div>

    <div class="tldr" style="${tldrStyle}">
      <div class="tldr-label" style="color:${cfg.color}">TL;DR</div>
      <div class="tldr-text" style="color:${cfg.color}">${m.tldr}</div>
    </div>

    <div class="card-body" id="body-${m.id}">${m.body}</div>
    <button class="expand-btn" id="expand-${m.id}" style="color:${cfg.color}" onclick="toggleExpand(${m.id})">Les hele meldingen ↓</button>

    <div class="card-actions">
      ${m.status === 'unread'
        ? `<button class="btn btn-ok" onclick="markRead(${m.id})">Lest / OK</button>
           <button class="btn btn-skip" onclick="markSkipped(${m.id})">Ikke relevant</button>`
        : `<button class="btn btn-skip" style="flex:1" onclick="markUnread(${m.id})">↩ Merk som ny</button>`
      }
    </div>
  </div>`;
}

function categoryLabel(cat) {
  const map = { skole: 'Skole', aks: 'AKS', idrett: 'Idrettslag', foreldre: 'Foreldre' };
  return map[cat] || cat;
}

function toggleExpand(id) {
  const body = document.getElementById(`body-${id}`);
  const btn = document.getElementById(`expand-${id}`);
  const expanded = body.classList.toggle('expanded');
  const cfg = SOURCE_CONFIG[state.messages.find(m => m.id === id)?.source] || {};
  btn.textContent = expanded ? 'Skjul ↑' : 'Les hele meldingen ↓';
}

// ─── Actions ──────────────────────────────────────────────────────────────────

function markUnread(id) {
  const msg = state.messages.find(m => m.id === id);
  if (msg) {
    if (msg.status === 'read') state.stats.read = Math.max(0, state.stats.read - 1);
    if (msg.status === 'skipped') state.stats.skipped = Math.max(0, state.stats.skipped - 1);
    msg.status = 'unread';
    saveState();
  }
  renderFeed();
  updateBadge();
}

function markRead(id) {
  animateCard(id, 'right', () => {
    const msg = state.messages.find(m => m.id === id);
    if (msg && msg.status !== 'read') {
      msg.status = 'read';
      state.stats.read++;
      saveState();
    }
    renderFeed();
    updateBadge();
  });
}

function markSkipped(id) {
  animateCard(id, 'left', () => {
    const msg = state.messages.find(m => m.id === id);
    if (msg) {
      msg.status = 'skipped';
      state.stats.skipped++;
      saveState();
    }
    renderFeed();
    updateBadge();
  });
}

function animateCard(id, dir, cb) {
  const card = document.getElementById(`card-${id}`);
  if (!card) return cb();
  card.classList.add(dir === 'right' ? 'dismissed-right' : 'dismissed-left');
  card.style.height = card.offsetHeight + 'px';
  setTimeout(() => {
    card.style.height = '0';
    card.style.marginBottom = '0';
    card.style.padding = '0';
    card.style.overflow = 'hidden';
  }, 280);
  setTimeout(cb, 500);
}

function updateBadge() {
  const unread = state.messages.filter(m => m.status === 'unread').length;
  const badge = document.getElementById('unread-count');
  badge.textContent = unread > 0 ? `${unread} nye` : 'Alt lest';
  badge.style.background = unread > 0 ? 'var(--text)' : 'var(--green)';
}

// ─── Swipe gesture ────────────────────────────────────────────────────────────

function attachCardEvents(id) {
  const card = document.getElementById(`card-${id}`);
  if (!card) return;

  let startX = 0, startY = 0, currentX = 0, dragging = false, axis = null;

  card.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dragging = true;
    axis = null;
    card.classList.add('swiping');
  }, { passive: true });

  card.addEventListener('touchmove', e => {
    if (!dragging) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    if (!axis) {
      axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }

    if (axis === 'x') {
      e.preventDefault();
      currentX = dx;
      card.style.transform = `translateX(${dx}px) rotate(${dx * 0.02}deg)`;

      const hintOk = document.getElementById(`hint-ok-${id}`);
      const hintSkip = document.getElementById(`hint-skip-${id}`);

      if (dx > 30) {
        hintOk.style.opacity = Math.min((dx - 30) / 60, 0.9);
        hintSkip.style.opacity = 0;
      } else if (dx < -30) {
        hintSkip.style.opacity = Math.min((-dx - 30) / 60, 0.9);
        hintOk.style.opacity = 0;
      } else {
        hintOk.style.opacity = 0;
        hintSkip.style.opacity = 0;
      }
    }
  }, { passive: false });

  card.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    card.classList.remove('swiping');

    if (axis === 'x') {
      if (currentX > 80) {
        markRead(id);
      } else if (currentX < -80) {
        markSkipped(id);
      } else {
        card.style.transform = '';
        document.getElementById(`hint-ok-${id}`).style.opacity = 0;
        document.getElementById(`hint-skip-${id}`).style.opacity = 0;
      }
    } else {
      card.style.transform = '';
    }

    currentX = 0;
    axis = null;
  });
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

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
    state.filter = btn.dataset.filter;
    renderFeed();
  });
});

// ─── Navigation ──────────────────────────────────────────────────────────────

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.getElementById('view-feed').style.display = view === 'feed' ? 'flex' : 'none';
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

    if (view !== 'feed') {
      document.getElementById(`view-${view}`).classList.add('active');
    }

    if (view === 'stats') renderStats();
  });
});

// ─── Stats ────────────────────────────────────────────────────────────────────

function renderStats() {
  const total = state.messages.length;
  const read = state.messages.filter(m => m.status === 'read').length;
  const skipped = state.messages.filter(m => m.status === 'skipped').length;
  const unread = state.messages.filter(m => m.status === 'unread').length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-read').textContent = read;
  document.getElementById('stat-skipped').textContent = skipped;
  document.getElementById('stat-unread').textContent = unread;

  const sources = {};
  state.messages.forEach(m => {
    if (!sources[m.source]) sources[m.source] = { label: m.sourceLabel, count: 0 };
    sources[m.source].count++;
  });

  const cfg = SOURCE_CONFIG;
  document.getElementById('source-stats').innerHTML = Object.entries(sources).map(([key, val]) => `
    <div class="settings-row">
      <div class="settings-row-left">
        <div style="width:10px;height:10px;border-radius:50%;background:${cfg[key]?.color || '#888'};flex-shrink:0;"></div>
        <span class="settings-row-text">${val.label}</span>
      </div>
      <span style="font-size:13px;color:var(--text2);font-family:'DM Mono',monospace;">${val.count} meldinger</span>
    </div>`).join('');
}

// ─── Last sync timestamp ──────────────────────────────────────────────────────

document.getElementById('last-sync').textContent =
  new Date().toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });

// ─── Init ─────────────────────────────────────────────────────────────────────

renderFeed();
updateBadge();

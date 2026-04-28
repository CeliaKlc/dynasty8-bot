// ─── Dynasty 8 Panel — Frontend ──────────────────────────────────────────────

let currentUser = null;
let guildId     = null;
let currentPage = 'dashboard';

// ── Utilitaires ───────────────────────────────────────────────────────────────

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) { location.href = '/login.html'; return null; }
  return res.json();
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ── Navigation ────────────────────────────────────────────────────────────────

document.querySelectorAll('.nav-item').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const page = link.dataset.page;
    currentPage = page;
    document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    link.classList.add('active');
    document.getElementById(`page-${page}`)?.classList.add('active');
    loadPage(page);
  });
});

function loadPage(page) {
  if (page === 'dashboard') loadDashboard();
  if (page === 'agents')    loadAgents();
  if (page === 'annonces')  loadAnnonces();
  if (page === 'sacs')      loadSacs();
  if (page === 'rdv')       loadRdv();
  if (page === 'attente')   loadAttente();
  if (page === 'recap')     loadRecap();
  if (page === 'reprise')   loadReprise();
  if (page === 'biens')     loadBiens();
  if (page === 'logs')      loadLogs();
  if (page === 'config')    loadConfig();
}

// ── Alertes ───────────────────────────────────────────────────────────────────

async function loadAlerts() {
  const data = await api('/alerts');
  if (!data) return;

  const { alerts, urgentCount } = data;

  // ── Badges sidebar ────────────────────────────────────────────────────────
  const badgeDashboard = document.getElementById('nav-badge-dashboard');
  const badgeAttente   = document.getElementById('nav-badge-attente');
  const badgeAnnonces  = document.getElementById('nav-badge-annonces');
  const badgeRdv       = document.getElementById('nav-badge-rdv');

  // Reset
  [badgeDashboard, badgeAttente, badgeAnnonces, badgeRdv].forEach(b => { if (b) b.style.display = 'none'; });

  alerts.forEach(a => {
    if (a.id === 'attente_active' || a.id === 'attente_contacte') {
      const b = document.getElementById('nav-badge-attente');
      if (b) { b.textContent = a.count; b.style.display = ''; }
    }
    if (a.id === 'dossiers_lbc') {
      const b = document.getElementById('nav-badge-annonces');
      if (b) { b.textContent = a.count; b.style.display = ''; }
    }
    if (a.id === 'rdv_today') {
      const b = document.getElementById('nav-badge-rdv');
      if (b) { b.textContent = a.count; b.style.display = ''; }
    }
  });

  if (urgentCount > 0 && badgeDashboard) {
    badgeDashboard.textContent = urgentCount;
    badgeDashboard.style.display = '';
  }

  // ── Section alertes dashboard ─────────────────────────────────────────────
  const section = document.getElementById('alerts-section');
  const list    = document.getElementById('alerts-list');
  if (!section || !list) return;

  if (!alerts.length) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';
  list.innerHTML = '';

  alerts.forEach(a => {
    const card = document.createElement('div');
    card.className = `alert-card alert-${a.level}`;

    // Détail des RDV du jour
    let itemsHtml = '';
    if (a.items?.length) {
      itemsHtml = `<div class="alert-items">${
        a.items.map(r => {
          const heure = new Date(r.datetime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          return `<span class="alert-item-chip">${r.agentEmoji} ${r.agentName} · ${r.description}${r.clientName ? ` — ${r.clientName}` : ''} <strong>${heure}</strong></span>`;
        }).join('')
      }</div>`;
    }

    card.innerHTML = `
      <div class="alert-icon-wrap">${a.icon}</div>
      <div class="alert-body">
        <span class="alert-count">${a.count}</span>
        <span class="alert-label">${a.label}</span>
        ${itemsHtml}
      </div>
      <button class="alert-link btn" onclick="goToPage('${a.page}')">Voir →</button>
    `;
    list.appendChild(card);
  });
}

function goToPage(page) {
  const link = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (link) link.click();
}

// ── Recherche globale ─────────────────────────────────────────────────────────

let searchDebounce  = null;
let searchActiveIdx = -1;

function openSearch() {
  const overlay = document.getElementById('search-overlay');
  const input   = document.getElementById('search-input');
  overlay.style.display = '';
  input.value = '';
  document.getElementById('search-results').innerHTML = '';
  searchActiveIdx = -1;
  requestAnimationFrame(() => input.focus());
}

function closeSearch() {
  document.getElementById('search-overlay').style.display = 'none';
  document.getElementById('search-input').value = '';
  document.getElementById('search-results').innerHTML = '';
  searchActiveIdx = -1;
  clearTimeout(searchDebounce);
}

function onSearchOverlayClick(e) {
  if (e.target === document.getElementById('search-overlay')) closeSearch();
}

// Raccourci clavier global
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    const overlay = document.getElementById('search-overlay');
    overlay.style.display === 'none' ? openSearch() : closeSearch();
    return;
  }
  if (e.key === 'Escape') { closeSearch(); return; }

  // Navigation clavier dans les résultats
  if (document.getElementById('search-overlay').style.display !== 'none') {
    const items = document.querySelectorAll('.search-result-item');
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      searchActiveIdx = Math.min(searchActiveIdx + 1, items.length - 1);
      updateSearchActive(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      searchActiveIdx = Math.max(searchActiveIdx - 1, 0);
      updateSearchActive(items);
    } else if (e.key === 'Enter' && searchActiveIdx >= 0) {
      e.preventDefault();
      items[searchActiveIdx]?.click();
    }
  }
});

function updateSearchActive(items) {
  items.forEach((el, i) => el.classList.toggle('search-active', i === searchActiveIdx));
  items[searchActiveIdx]?.scrollIntoView({ block: 'nearest' });
}

document.getElementById('search-input')?.addEventListener('input', e => {
  clearTimeout(searchDebounce);
  const q = e.target.value.trim();
  if (q.length < 2) {
    document.getElementById('search-results').innerHTML = '';
    searchActiveIdx = -1;
    return;
  }
  searchDebounce = setTimeout(() => doSearch(q), 280);
});

async function doSearch(q) {
  const data = await api(`/search?q=${encodeURIComponent(q)}`);
  if (!data) return;
  renderSearchResults(data);
}

function renderSearchResults(data) {
  const container = document.getElementById('search-results');
  searchActiveIdx = -1;

  const groups = [
    { key: 'agents',   label: '👤 Agents'          },
    { key: 'annonces', label: '🏠 Annonces LBC'     },
    { key: 'attente',  label: '📋 Liste d\'attente' },
    { key: 'rdv',      label: '📅 Rendez-vous'      },
  ];

  const total = groups.reduce((s, g) => s + (data[g.key]?.length || 0), 0);
  if (total === 0) {
    container.innerHTML = '<div class="search-empty">Aucun résultat</div>';
    return;
  }

  container.innerHTML = '';

  for (const group of groups) {
    const items = data[group.key] || [];
    if (!items.length) continue;

    const section = document.createElement('div');
    section.className = 'search-group';
    section.innerHTML = `<div class="search-group-label">${group.label}</div>`;

    for (const item of items) {
      const el = document.createElement('div');
      el.className = 'search-result-item';

      // Icône ou photo (src= n'exécute pas de JS, mais on échappe quand même les guillemets)
      const safePhoto = item.photo ? item.photo.replace(/"/g, '%22') : '';
      const iconHtml = item.photo
        ? `<img class="search-result-photo" src="${safePhoto}" alt="" onerror="this.style.display='none'">`
        : `<span class="search-result-icon">${escHtml(item.emoji || '🔹')}</span>`;

      // Meta à droite (agent name pour annonces/rdv, statut pour attente)
      let metaHtml = '';
      if (item.agentName) metaHtml = `<span class="search-result-meta">${escHtml(item.agentEmoji || '')} ${escHtml(item.agentName)}</span>`;
      if (item.status)    metaHtml = `<span class="search-status search-status-${escHtml(item.status)}">${escHtml(item.status)}</span>`;

      el.innerHTML = `
        ${iconHtml}
        <div class="search-result-body">
          <div class="search-result-title">${escHtml(item.title)}</div>
          ${item.subtitle ? `<div class="search-result-sub">${escHtml(item.subtitle)}</div>` : ''}
        </div>
        ${metaHtml}
      `;

      el.addEventListener('click', () => {
        goToPage(item.page);
        closeSearch();
      });

      section.appendChild(el);
    }

    container.appendChild(section);
  }
}

// ── SSE — mises à jour temps réel ─────────────────────────────────────────────

function initSSE() {
  const indicator = document.getElementById('sse-status');
  const setStatus = (state, title) => {
    if (!indicator) return;
    indicator.className = `sse-dot ${state}`;
    indicator.title     = title;
  };

  const evtSource = new EventSource('/api/events');

  evtSource.addEventListener('connected', () => {
    setStatus('sse-connected', 'Temps réel actif');
  });

  // Heartbeat — rien à faire côté client
  evtSource.addEventListener('ping', () => {});

  evtSource.addEventListener('refresh', e => {
    const { sections } = JSON.parse(e.data);

    // Toujours rafraîchir les alertes si les sections concernées changent
    if (sections.includes('alerts') || sections.includes('rdv') || sections.includes('dashboard')) {
      loadAlerts();
    }

    // Rafraîchir la page courante si elle est concernée
    if (sections.includes(currentPage)) {
      loadPage(currentPage);
    }
  });

  evtSource.onerror = () => {
    setStatus('sse-disconnected', 'Connexion perdue — reconnexion automatique...');
  };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

// Formatte un montant en $, style "175'000$" ou "1'200'000$"
function fmtCA(n) {
  if (!n) return '0$';
  return Math.round(n).toLocaleString('fr-CH').replace(/\s/g, "'") + '$';
}

async function loadDashboard() {
  loadAlerts(); // non bloquant — met à jour les badges et la section alertes
  const data = await api('/stats');
  if (!data) return;

  // ── Indicateurs généraux ──────────────────────────────────────────────────
  document.getElementById('stat-agents').textContent   = data.totalAgents;
  document.getElementById('stat-annonces').textContent = data.totalAnnonces;
  document.getElementById('stat-actives').textContent  = data.annoncesActives;
  document.getElementById('stat-sacs').textContent     = data.totalSacs;

  // Annonces par agent
  const grid = document.getElementById('agent-stats-grid');
  grid.innerHTML = '';
  (data.statsParAgent || []).forEach(s => {
    const card = document.createElement('div');
    card.className = 'agent-stat-card';
    const avatarHtml = s.photo
      ? `<img class="agent-stat-avatar" src="${s.photo}" alt="" onerror="this.style.display='none'">`
      : `<div class="agent-stat-avatar-placeholder">${s.emoji || '👤'}</div>`;
    card.innerHTML = `
      ${avatarHtml}
      <div class="agent-stat-info">
        <div class="agent-stat-name">${s.emoji} ${s.name}</div>
        <div class="agent-stat-numbers">
          <div class="agent-stat-num">Total : <span>${s.total}</span></div>
          <div class="agent-stat-num">En cours : <span>${s.actives}</span></div>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
  if (!data.statsParAgent?.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);font-size:.875rem">Aucune donnée — les annonces publiées via /annonce apparaîtront ici.</p>';
  }

  // ── Activité LBC ──────────────────────────────────────────────────────────
  const lbc = data.lbc;
  if (!lbc) return;

  document.getElementById('lbc-stat-ventes').textContent  = lbc.ventesTotal   ?? 0;
  document.getElementById('lbc-stat-encours').textContent = lbc.ventesEnCours ?? 0;
  document.getElementById('lbc-stat-ca').textContent      = fmtCA(lbc.caTotal);
  document.getElementById('lbc-stat-moyen').textContent   = lbc.prixMoyen ? fmtCA(lbc.prixMoyen) : '—';

  // Top agents LBC
  const agentsList = document.getElementById('lbc-agents-list');
  agentsList.innerHTML = '';
  if (lbc.parAgent?.length) {
    lbc.parAgent.forEach((a, i) => {
      const el = document.createElement('div');
      el.className = 'lbc-agent-row';
      const avatarHtml = a.photo
        ? `<img class="lbc-agent-avatar" src="${a.photo}" alt="" onerror="this.style.display='none'">`
        : `<div class="lbc-agent-avatar-ph">${a.emoji || '👤'}</div>`;
      el.innerHTML = `
        ${avatarHtml}
        <div class="lbc-agent-info">
          <span class="lbc-agent-name">${a.emoji ? a.emoji + ' ' : ''}${a.name}</span>
          <span class="lbc-agent-meta">${a.ventes} vente${a.ventes > 1 ? 's' : ''} · CA : ${fmtCA(a.ca)}</span>
        </div>
        <div class="lbc-agent-rank">#${i + 1}</div>
      `;
      agentsList.appendChild(el);
    });
  } else {
    agentsList.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem">Aucune vente enregistrée pour le moment.</p>';
  }

  // Répartition par type de bien
  const typesList = document.getElementById('lbc-types-list');
  typesList.innerHTML = '';
  if (lbc.parType?.length) {
    const maxCount = Math.max(...lbc.parType.map(t => t.count), 1);
    lbc.parType.forEach(t => {
      const pct = Math.round((t.count / maxCount) * 100);
      const el  = document.createElement('div');
      el.className = 'lbc-type-row';
      el.innerHTML = `
        <div class="lbc-type-name">${t.type}</div>
        <div class="lbc-type-bar-wrap"><div class="lbc-type-bar" style="width:${pct}%"></div></div>
        <div class="lbc-type-count">${t.count}</div>
      `;
      typesList.appendChild(el);
    });
  } else {
    typesList.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem">Aucune donnée.</p>';
  }
}

// ── Agents ────────────────────────────────────────────────────────────────────

let agentsData        = [];
let agentsSacMap      = {};
let showDepartedAgents = false;

async function loadAgents() {
  const [agents, sacsData] = await Promise.all([
    api('/agents'),
    api('/sacs'),
  ]);
  if (!agents || !sacsData) return;

  agentsData        = agents;
  agentsSacMap      = Object.fromEntries(sacsData.agents.map(a => [a.agentId, a]));
  showDepartedAgents = false;

  // Bouton ajouter (admin uniquement)
  const btnAdd = document.getElementById('btn-add-agent');
  if (currentUser?.isAdmin) {
    btnAdd.style.display = 'inline-flex';
    btnAdd.onclick = () => openAgentModal(null);
  } else {
    btnAdd.style.display = 'none';
  }

  renderAgents();
}

function renderAgents() {
  const grid = document.getElementById('agents-grid');
  grid.innerHTML = '';

  const actifs = agentsData.filter(a => (agentsSacMap[a.id]?.statut ?? 'actif') !== 'parti');
  const partis = agentsData.filter(a => agentsSacMap[a.id]?.statut === 'parti');

  // Bouton toggle agents partis
  if (partis.length > 0) {
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'grid-column:1/-1;display:flex;justify-content:flex-end;margin-bottom:4px';
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn';
    toggleBtn.style.cssText = 'background:var(--bg3);color:var(--text-muted);font-size:.8rem;padding:6px 14px';
    toggleBtn.textContent = showDepartedAgents
      ? '▲ Masquer les agents partis'
      : `👋 Agents partis (${partis.length})`;
    toggleBtn.onclick = () => { showDepartedAgents = !showDepartedAgents; renderAgents(); };
    btnRow.appendChild(toggleBtn);
    grid.appendChild(btnRow);
  }

  // Agents actifs
  actifs.forEach(agent => renderAgentCard(grid, agent, false));

  // Section agents partis (visible uniquement si toggle actif)
  if (showDepartedAgents && partis.length > 0) {
    const sep = document.createElement('div');
    sep.style.cssText = 'grid-column:1/-1;border-top:1px solid var(--border);padding-top:16px;margin-top:8px;color:var(--text-muted);font-size:.8rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px';
    sep.textContent = 'Agents partis';
    grid.appendChild(sep);
    partis.forEach(agent => renderAgentCard(grid, agent, true));
  }
}

function renderAgentCard(grid, agent, isParti) {
  const card = document.createElement('div');
  card.className = `agent-card${isParti ? ' parti' : ''}`;
  card.dataset.slug = agent.slug;

  const avatarHtml = agent.photo
    ? `<img class="agent-avatar" src="${agent.photo}" alt="${agent.name}" onerror="this.style.display='none'">`
    : `<div class="agent-avatar-placeholder">${agent.emoji || '👤'}</div>`;

  const badgesHtml = (agent.agre || []).map(a => {
    const isLbc = a.includes('LeBonCoin');
    return `<span class="badge ${isLbc ? 'lbc' : ''}">${isLbc ? 'LBC' : a.split(' ')[0]}</span>`;
  }).join('');

  const partiTag = isParti ? `<span class="badge parti-badge">Parti</span>` : '';

  const actionsHtml = (currentUser?.isAdmin && agent.id) ? `
    <div class="agent-card-actions">
      ${isParti
        ? `<button class="sac-btn sac-btn-retour" onclick="agentDepart('${agent.id}','retour');event.stopPropagation()">✅ Retour</button>`
        : `<button class="sac-btn sac-btn-depart" onclick="agentDepart('${agent.id}','depart');event.stopPropagation()">👋 Partir</button>`
      }
    </div>
  ` : '';

  card.innerHTML = `
    <button class="agent-preview-btn" onclick="openCardPreview(${JSON.stringify(agent).replace(/"/g, '&quot;')});event.stopPropagation()" title="Aperçu carte">👁️</button>
    ${avatarHtml}
    <div class="agent-name">${agent.emoji || ''} ${agent.name}</div>
    <div class="agent-titre">${agent.titre || ''}</div>
    <div class="agent-badges">${badgesHtml}${partiTag}</div>
    ${actionsHtml}
  `;

  if (currentUser?.isAdmin) {
    card.addEventListener('click', e => {
      if (e.target.closest('.agent-card-actions')) return;
      openAgentModal(agent);
    });
  }
  grid.appendChild(card);
}

async function agentDepart(agentId, action) {
  if (action === 'depart' && !confirm('Marquer cet agent comme parti ?')) return;
  const res = await api(`/sacs/${agentId}/${action}`, { method: 'PUT', body: {} });
  if (res?.ok) {
    toast(action === 'depart' ? '👋 Agent marqué comme parti' : '✅ Agent réactivé');
    // Mettre à jour la sacMap localement puis re-render sans recharger depuis le réseau
    if (agentsSacMap[agentId]) {
      agentsSacMap[agentId].statut = action === 'depart' ? 'parti' : 'actif';
    } else if (action === 'depart') {
      agentsSacMap[agentId] = { agentId, statut: 'parti' };
    }
    renderAgents();
  } else {
    toast(res?.error || 'Erreur', 'error');
  }
}

// ── Aperçu carte ─────────────────────────────────────────────────────────────

function openCardPreview(agent) {
  const embed = document.getElementById('carte-embed');

  if (!agent.photo || !agent.numero) {
    embed.innerHTML = `
      <p style="color:var(--text-muted);font-style:italic;font-size:.875rem">
        Carte non disponible — il manque ${!agent.photo ? 'une photo' : ''}${!agent.photo && !agent.numero ? ' et un ' : ''}${!agent.numero ? 'numéro RP' : ''}.
      </p>`;
  } else {
    const agre = agent.agre || [];
    const habHtml = agre.length > 0
      ? `<div style="margin-top:12px">
           <div class="dc-field-name">🗒️ Habilitations :</div>
           <div class="dc-field-value">${agre.map(h => `◆ ${h}`).join('<br>')}</div>
         </div>`
      : '';

    embed.innerHTML = `
      <div style="overflow:hidden">
        <img class="dc-thumbnail" src="${agent.photo}" alt="" onerror="this.style.display='none'">
        <div class="dc-author">✦ &nbsp; AGENT EN SERVICE &nbsp; ✦</div>
        <div class="dc-title">${agent.emoji || ''} ${agent.name}</div>
        <div class="dc-desc"><em>${agent.titre || ''}</em><hr class="dc-hr"></div>
        <div class="dc-fields">
          <div>
            <div class="dc-field-name">☎️ Numéro :</div>
            <div class="dc-field-value dc-mono">${agent.numero}</div>
          </div>
        </div>
        ${habHtml}
        <div class="dc-footer">Dynasty 8</div>
      </div>
    `;
  }

  document.getElementById('carte-preview-overlay').style.display = 'flex';
}

document.getElementById('carte-preview-close').addEventListener('click', () => {
  document.getElementById('carte-preview-overlay').style.display = 'none';
});
document.getElementById('carte-preview-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('carte-preview-overlay'))
    document.getElementById('carte-preview-overlay').style.display = 'none';
});

// ── Modal agent ───────────────────────────────────────────────────────────────

const STANDARD_AGRE = ['Las Venturas', 'Cayo Perico', 'Gestionnaire LeBonCoin'];
let customAgre = [];

function renderCustomAgre() {
  const list = document.getElementById('agre-custom-list');
  list.innerHTML = '';
  customAgre.forEach((h, i) => {
    const tag = document.createElement('span');
    tag.className = 'agre-custom-tag';
    tag.innerHTML = `${h} <button type="button" onclick="removeCustomAgre(${i})" style="background:none;border:none;cursor:pointer;color:inherit;margin-left:4px;font-size:.8rem">×</button>`;
    list.appendChild(tag);
  });
}

function removeCustomAgre(i) {
  customAgre.splice(i, 1);
  renderCustomAgre();
}

document.getElementById('agre-custom-add').addEventListener('click', () => {
  const input = document.getElementById('agre-custom-input');
  const val   = input.value.trim();
  if (!val) return;
  if (!customAgre.includes(val) && !STANDARD_AGRE.includes(val)) customAgre.push(val);
  input.value = '';
  renderCustomAgre();
});

document.getElementById('agre-custom-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('agre-custom-add').click(); }
});

function openAgentModal(agent) {
  const isNew = !agent;
  document.getElementById('modal-title').textContent = isNew ? 'Ajouter un agent' : 'Modifier l\'agent';
  document.getElementById('btn-delete-agent').style.display = isNew ? 'none' : 'inline-flex';

  // Remplissage du formulaire
  document.getElementById('agent-slug-original').value = agent?.slug || '';
  document.getElementById('f-name').value   = agent?.name   || '';
  document.getElementById('f-slug').value   = agent?.slug   || '';
  document.getElementById('f-id').value     = agent?.id     || '';
  document.getElementById('f-emoji').value  = agent?.emoji  || '';
  document.getElementById('f-titre').value  = agent?.titre  || '';
  document.getElementById('f-numero').value = agent?.numero || '';
  document.getElementById('f-photo').value  = agent?.photo  || '';
  document.getElementById('f-bunker').value = agent?.bunker || '';
  document.getElementById('f-feminin').checked = agent?.feminin || false;

  const agre = agent?.agre || [];
  document.getElementById('agre-lv').checked  = agre.includes('Las Venturas');
  document.getElementById('agre-cp').checked  = agre.includes('Cayo Perico');
  document.getElementById('agre-lbc').checked = agre.includes('Gestionnaire LeBonCoin');

  // Habilitations personnalisées (tout ce qui n'est pas standard)
  customAgre = agre.filter(a => !STANDARD_AGRE.includes(a));
  renderCustomAgre();

  // Auto-slug depuis le nom
  document.getElementById('f-name').addEventListener('input', e => {
    if (isNew) {
      document.getElementById('f-slug').value = e.target.value
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    }
  });

  document.getElementById('modal-overlay').style.display = 'flex';
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  document.getElementById('agent-form').reset();
  customAgre = [];
  renderCustomAgre();
}

document.getElementById('agent-form').addEventListener('submit', async e => {
  e.preventDefault();
  const slugOriginal = document.getElementById('agent-slug-original').value;
  const isNew = !slugOriginal;

  const agre = [];
  if (document.getElementById('agre-lv').checked)  agre.push('Las Venturas');
  if (document.getElementById('agre-cp').checked)  agre.push('Cayo Perico');
  if (document.getElementById('agre-lbc').checked) agre.push('Gestionnaire LeBonCoin');
  agre.push(...customAgre);

  const payload = {
    name:    document.getElementById('f-name').value.trim(),
    slug:    document.getElementById('f-slug').value.trim(),
    id:      document.getElementById('f-id').value.trim() || null,
    emoji:   document.getElementById('f-emoji').value.trim(),
    titre:   document.getElementById('f-titre').value.trim(),
    numero:  document.getElementById('f-numero').value.trim(),
    photo:   document.getElementById('f-photo').value.trim() || null,
    bunker:  document.getElementById('f-bunker').value.trim() || null,
    feminin: document.getElementById('f-feminin').checked,
    agre,
  };

  const res = isNew
    ? await api('/agents', { method: 'POST', body: payload })
    : await api(`/agents/${slugOriginal}`, { method: 'PUT', body: payload });

  if (res?.ok) {
    toast(isNew ? '✅ Agent ajouté' : '✅ Agent modifié');
    closeModal();
    loadAgents();
  } else {
    toast(res?.error || 'Erreur', 'error');
  }
});

document.getElementById('btn-delete-agent').addEventListener('click', async () => {
  const slug = document.getElementById('agent-slug-original').value;
  if (!slug) return;
  if (!confirm(`Supprimer l'agent "${slug}" ? Cette action est irréversible.`)) return;

  const res = await api(`/agents/${slug}`, { method: 'DELETE' });
  if (res?.ok) {
    toast('🗑️ Agent supprimé');
    closeModal();
    loadAgents();
  } else {
    toast(res?.error || 'Erreur', 'error');
  }
});

// ── Annonces / Dossiers ───────────────────────────────────────────────────────

let annoncesData   = [];
let annoncesFilter = '';

async function loadAnnonces() {
  annoncesData = await api('/annonces');
  if (!annoncesData) return;
  renderAnnonces();
}

function initAnnoncesFilters() {
  document.getElementById('annonces-filters').addEventListener('click', e => {
    const btn = e.target.closest('.annonce-filter-btn');
    if (!btn) return;
    document.querySelectorAll('.annonce-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    annoncesFilter = btn.dataset.filter;
    renderAnnonces();
  });
}

function renderAnnonces() {
  const grid = document.getElementById('annonces-grid');
  const countEl = document.getElementById('annonces-count');
  grid.innerHTML = '';

  let list = annoncesData;

  // Filtre client-side sur les données déjà chargées
  if (annoncesFilter === 'en_cours') list = list.filter(a => a.statutDossier === 'en_cours' && !a.retard);
  if (annoncesFilter === 'retard')   list = list.filter(a => a.retard);
  if (annoncesFilter === 'vendu')    list = list.filter(a => a.statutDossier === 'vendu');

  // Tri par numéro d'annonce croissant (1396 avant 1401)
  list = [...list].sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0));

  countEl.textContent = `${list.length} dossier${list.length > 1 ? 's' : ''}`;

  if (!list.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);font-size:.875rem;padding:8px 0">Aucun dossier pour ce filtre.</p>';
    return;
  }

  const discordBase = guildId ? `https://discord.com/channels/${guildId}` : null;

  list.forEach(a => {
    const card = document.createElement('div');
    card.className = `annonce-card${a.retard ? ' annonce-retard' : a.statutDossier === 'vendu' ? ' annonce-vendu' : ''}`;

    // Badge statut + délai
    let badgeHtml = '';
    if (a.retard) {
      badgeHtml = `<span class="annonce-badge annonce-badge-retard">⚠️ En retard · ${a.joursOuverts}j</span>`;
    } else if (a.statutDossier === 'en_cours') {
      badgeHtml = `<span class="annonce-badge annonce-badge-encours">En cours${a.joursOuverts != null ? ` · ${a.joursOuverts}j` : ''}</span>`;
    } else if (a.statutDossier === 'vendu') {
      badgeHtml = `<span class="annonce-badge annonce-badge-vendu">✅ Vendu</span>`;
    } else {
      badgeHtml = `<span class="annonce-badge annonce-badge-unknown">Sans dossier</span>`;
    }

    // Agent
    const agentHtml = a.agent
      ? `${a.agent.photo
          ? `<img class="annonce-agent-avatar" src="${a.agent.photo}" alt="" onerror="this.style.display='none'">`
          : `<span class="annonce-agent-emoji">${a.agent.emoji || '👤'}</span>`}
         <span class="annonce-agent-name">${a.agent.name}</span>`
      : `<span style="color:var(--text-muted)">Agent inconnu</span>`;

    // Bien
    const typeHtml    = a.vente?.type    ? `<span class="annonce-type">${a.vente.type}</span>` : '';
    const adresseHtml = a.vente?.adresse
      ? `<span class="annonce-adresse">📍 ${a.vente.adresse}${a.vente.etage ? ` · Étage ${a.vente.etage}` : ''}</span>`
      : '';

    // Prix
    let prixHtml = '';
    if (a.vente?.prixDepart) {
      prixHtml = `<span class="annonce-prix-depart">💰 ${fmtCA(a.vente.prixDepart)}</span>`;
      if (a.vente.prixFinal && a.vente.prixFinal !== a.vente.prixDepart) {
        prixHtml += `<span class="annonce-prix-final">→ ${fmtCA(a.vente.prixFinal)}</span>`;
      }
    }

    // Dates
    const dateOuverture = a.vente?.dateRecap
      ? new Date(a.vente.dateRecap).toLocaleDateString('fr-FR')
      : a.updatedAt ? new Date(a.updatedAt).toLocaleDateString('fr-FR') : null;
    const dateVente = a.vente?.dateVente
      ? new Date(a.vente.dateVente).toLocaleDateString('fr-FR') : null;

    const dateHtml = dateVente
      ? `<span class="annonce-date">Vendu le ${dateVente}</span>`
      : dateOuverture
        ? `<span class="annonce-date">Ouvert le ${dateOuverture}</span>`
        : '';

    // Liens Discord
    const ticketLink  = discordBase && a.ticketChannelId
      ? `<a class="annonce-link" href="${discordBase}/${a.ticketChannelId}" target="_blank">🎫 Ticket</a>`
      : '';
    const annonceLink = discordBase && a.announcementChannelId
      ? `<a class="annonce-link" href="${discordBase}/${a.announcementChannelId}" target="_blank">📢 Salon</a>`
      : '';

    const deleteBtn = currentUser?.isAdmin
      ? `<button class="annonce-delete-btn" onclick="deleteAnnonce('${a.id}','${a.numero || ''}')" title="Supprimer">🗑️</button>`
      : '';

    // Bouton "Marquer vendu" uniquement si la vente est en cours
    const venduBtn = a.vente?.statut === 'en_cours'
      ? `<button class="btn annonce-vendu-btn" onclick="ouvrirModalVendu('${escHtml(a.vente.annonce || a.numero || '')}','${a.vente.prixDepart ?? ''}')" style="font-size:.75rem;padding:4px 10px;background:rgba(46,204,113,.15);color:#2ecc71;border:1px solid rgba(46,204,113,.3)">💰 Marquer vendu</button>`
      : '';

    card.innerHTML = `
      <div class="annonce-card-header">
        <div class="annonce-numero">#${a.numero || '—'}</div>
        ${badgeHtml}
      </div>
      <div class="annonce-bien">
        ${typeHtml}${adresseHtml}
      </div>
      <div class="annonce-card-body">
        <div class="annonce-agent">${agentHtml}</div>
        <div class="annonce-prix">${prixHtml}</div>
      </div>
      <div class="annonce-card-footer">
        <div class="annonce-links">${ticketLink}${annonceLink}</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${venduBtn}
          ${dateHtml}
          ${deleteBtn}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

async function deleteAnnonce(id, numero) {
  const label = numero ? `l'annonce n°${numero}` : 'cette annonce';
  if (!confirm(`Supprimer ${label} ? Cette action est irréversible.`)) return;
  const res = await api(`/annonces/${id}`, { method: 'DELETE' });
  if (res?.ok) {
    toast('🗑️ Annonce supprimée');
    annoncesData = annoncesData.filter(a => a.id !== id);
    renderAnnonces();
  } else {
    toast(res?.error || 'Erreur', 'error');
  }
}

function ouvrirModalVendu(annonce, prixDepart) {
  // Réutilise la modale générique si elle existe, sinon crée une légère inline
  const prixSuggere = prixDepart ? String(prixDepart).replace(/\B(?=(\d{3})+(?!\d))/g, "'") : '';
  const prixSaisi = prompt(
    `Annonce n°${annonce} — Prix de vente final ($)\nLaisser vide pour utiliser le prix de départ${prixSuggere ? ` (${prixSuggere}$)` : ''} :`,
    prixSuggere,
  );
  if (prixSaisi === null) return; // annulé
  marquerVenduPanel(annonce, prixSaisi.trim() || null);
}

async function marquerVenduPanel(annonce, prix) {
  const res = await api('/annonces/vendu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ annonce, prix }),
  });
  if (res?.ok) {
    toast(`✅ Annonce n°${annonce} marquée comme vendue`);
    loadAnnonces(); // rafraîchir la liste
  } else {
    toast(res?.error || 'Erreur', 'error');
  }
}

// ── Sacs ──────────────────────────────────────────────────────────────────────

let sacOptions   = [];
let sacData      = [];
let showDeparted = false;

async function loadSacs() {
  const data = await api('/sacs');
  if (!data) return;
  sacOptions   = data.sacOptions;
  sacData      = data.agents;
  showDeparted = false;
  renderSacs();
}

function renderSacs() {
  const grid = document.getElementById('sacs-grid');
  grid.innerHTML = '';

  const actifs = sacData.filter(a => a.statut !== 'parti').sort((a, b) => a.name.localeCompare(b.name));
  const partis = sacData.filter(a => a.statut === 'parti').sort((a, b) => a.name.localeCompare(b.name));

  // Bouton toggle agents partis
  if (partis.length > 0) {
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'grid-column:1/-1;display:flex;justify-content:flex-end;margin-bottom:4px';
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn';
    toggleBtn.style.cssText = 'background:var(--bg3);color:var(--text-muted);font-size:.8rem;padding:6px 14px';
    toggleBtn.textContent = showDeparted
      ? '▲ Masquer les agents partis'
      : `👋 Agents partis (${partis.length})`;
    toggleBtn.onclick = () => { showDeparted = !showDeparted; renderSacs(); };
    btnRow.appendChild(toggleBtn);
    grid.appendChild(btnRow);
  }

  // Agents actifs
  actifs.forEach(agent => renderSacCard(grid, agent));

  // Section agents partis (visible uniquement si toggle actif)
  if (showDeparted && partis.length > 0) {
    const sep = document.createElement('div');
    sep.style.cssText = 'grid-column:1/-1;border-top:1px solid var(--border);padding-top:16px;margin-top:8px;color:var(--text-muted);font-size:.8rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px';
    sep.textContent = 'Agents partis';
    grid.appendChild(sep);
    partis.forEach(agent => renderSacCard(grid, agent));
  }
}

function renderSacCard(grid, agent) {
  const card = document.createElement('div');
  card.className = `sac-card ${agent.statut === 'parti' ? 'parti' : ''}`;

  const avatarHtml = agent.photo
    ? `<img class="sac-avatar" src="${agent.photo}" alt="" onerror="this.style.display='none'">`
    : `<div class="sac-avatar-placeholder">${agent.emoji || '👤'}</div>`;

  const tagsHtml = agent.statut === 'parti'
    ? `<span class="sac-tag parti-tag">Parti</span>`
    : agent.sacs.length > 0
      ? agent.sacs.map(s => `<span class="sac-tag">${s}</span>`).join('')
      : `<span class="sac-tag vide">Aucun sac</span>`;

  let actionsHtml = '';
  if (currentUser?.isAdmin) {
    actionsHtml = agent.statut === 'parti'
      ? `<div class="sac-actions">
           <button class="sac-btn sac-btn-retour" onclick="sacRetourFromSacs('${agent.agentId}')">✅ Retour</button>
         </div>`
      : `<div class="sac-actions">
           <button class="sac-btn sac-btn-edit" onclick="openSacModal('${agent.agentId}')">✏️ Gérer</button>
         </div>`;
  }

  card.innerHTML = `
    ${avatarHtml}
    <div class="sac-info">
      <div class="sac-name">${agent.emoji} ${agent.name}</div>
      <div class="sac-tags">${tagsHtml}</div>
    </div>
    ${actionsHtml}
  `;
  grid.appendChild(card);
}

async function sacRetourFromSacs(agentId) {
  const res = await api(`/sacs/${agentId}/retour`, { method: 'PUT', body: {} });
  if (res?.ok) {
    toast('✅ Agent réactivé');
    loadSacs();
  } else {
    toast(res?.error || 'Erreur', 'error');
  }
}

function openSacModal(agentId) {
  const agent = sacData.find(a => a.agentId === agentId);
  if (!agent) return;

  document.getElementById('sac-agent-id').value   = agentId;
  document.getElementById('sac-modal-title').textContent = `🎒 ${agent.name}`;
  document.getElementById('sac-agent-name').textContent  = '';

  // Sacs actuels
  document.getElementById('sac-current').innerHTML = agent.sacs.length > 0
    ? agent.sacs.map(s => `<span class="sac-tag" style="margin-right:4px">${s}</span>`).join('')
    : '<span style="color:var(--text-muted)">Aucun sac</span>';

  // Options donner
  document.getElementById('sac-donner-options').innerHTML = sacOptions
    .map(o => `<label><input type="checkbox" name="sac-donner" value="${o.value}"> ${o.label}</label>`)
    .join('');

  // Options retirer (uniquement les sacs déjà possédés)
  const retirerGroup = document.getElementById('sac-retirer-group');
  if (agent.sacs.length > 0) {
    document.getElementById('sac-retirer-options').innerHTML = agent.sacs
      .map(s => {
        const opt = sacOptions.find(o => o.value === s);
        return `<label><input type="checkbox" name="sac-retirer" value="${s}"> ${opt?.label ?? s}</label>`;
      }).join('');
    retirerGroup.style.display = 'block';
  } else {
    retirerGroup.style.display = 'none';
  }

  document.getElementById('sac-modal-overlay').style.display = 'flex';
}

function closeSacModal() {
  document.getElementById('sac-modal-overlay').style.display = 'none';
}
document.getElementById('sac-modal-close').addEventListener('click', closeSacModal);
document.getElementById('sac-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('sac-modal-overlay')) closeSacModal();
});

async function sacAction(agentId, action, sacs) {
  const body = sacs ? { sacs } : {};
  const res  = await api(`/sacs/${agentId}/${action}`, { method: 'PUT', body });
  if (res?.ok) {
    toast(action === 'depart' ? '👋 Agent marqué comme parti' :
          action === 'retour' ? '✅ Agent réactivé' :
          action === 'donner' ? '✅ Sacs attribués' : '✅ Sacs retirés');
    closeSacModal();
    loadSacs();
  } else {
    toast(res?.error || 'Erreur', 'error');
  }
}

document.getElementById('sac-btn-donner').addEventListener('click', async () => {
  const agentId = document.getElementById('sac-agent-id').value;
  const sacs = [...document.querySelectorAll('input[name="sac-donner"]:checked')].map(i => i.value);
  if (!sacs.length) return toast('Sélectionne au moins un sac', 'error');
  await sacAction(agentId, 'donner', sacs);
});

document.getElementById('sac-btn-retirer').addEventListener('click', async () => {
  const agentId = document.getElementById('sac-agent-id').value;
  const sacs = [...document.querySelectorAll('input[name="sac-retirer"]:checked')].map(i => i.value);
  if (!sacs.length) return toast('Sélectionne au moins un sac à retirer', 'error');
  await sacAction(agentId, 'retirer', sacs);
});


// ── Rendez-vous ───────────────────────────────────────────────────────────────

let rdvData        = [];
let rdvParAgent    = [];
let rdvAgentFilter = null;
let rdvShowPasses  = false;
let rdvCalMonth    = new Date(); // mois affiché dans le calendrier
let rdvCalWeek     = getMonday(new Date()); // lundi de la semaine affichée
let rdvCalView     = 'month';   // 'month' | 'week'
let rdvDayFilter   = null;       // 'YYYY-MM-DD' ou null (filtre par jour)

/** Retourne le lundi de la semaine contenant `date`. */
function getMonday(date) {
  const d   = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Formate une Date en 'YYYY-MM-DD'. */
function fmtISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function loadRdv() {
  const mode = rdvShowPasses ? 'passes' : 'avenir';
  const data = await api(`/rdv?mode=${mode}`);
  if (!data) return;
  rdvData      = data.rdvs;
  rdvParAgent  = data.parAgent;
  rdvDayFilter = null; // réinitialise le filtre par jour

  // Bouton créer un RDV
  document.getElementById('btn-new-rdv').style.display = 'inline-flex';

  renderRdvAgents();
  renderRdvCalendar();
  renderRdvList();
}

function renderRdvAgents() {
  const strip = document.getElementById('rdv-agents-strip');
  strip.innerHTML = '';

  if (rdvParAgent.length === 0) return;

  // Carte "Tous"
  const allCard = document.createElement('div');
  allCard.className = `rdv-agent-chip${rdvAgentFilter === null ? ' active' : ''}`;
  allCard.innerHTML = `<span>Tous</span><span class="rdv-chip-count">${rdvData.length}</span>`;
  allCard.onclick = () => { rdvAgentFilter = null; renderRdvAgents(); renderRdvCalendar(); renderRdvList(); };
  strip.appendChild(allCard);

  rdvParAgent.forEach(a => {
    const chip = document.createElement('div');
    chip.className = `rdv-agent-chip${rdvAgentFilter === a.agentId ? ' active' : ''}`;
    const avatarHtml = a.photo
      ? `<img src="${a.photo}" class="rdv-chip-avatar" onerror="this.style.display='none'">`
      : `<span>${a.emoji || '👤'}</span>`;
    chip.innerHTML = `${avatarHtml}<span>${a.name}</span><span class="rdv-chip-count">${a.count}</span>`;
    chip.onclick = () => {
      rdvAgentFilter = rdvAgentFilter === a.agentId ? null : a.agentId;
      renderRdvAgents();
      renderRdvCalendar();
      renderRdvList();
    };
    strip.appendChild(chip);
  });
}

function renderRdvList() {
  const list = document.getElementById('rdv-list');
  list.innerHTML = '';

  let filtered = rdvAgentFilter
    ? rdvData.filter(r => r.agentId === rdvAgentFilter)
    : rdvData;

  // Filtre par jour depuis le calendrier
  if (rdvDayFilter) {
    filtered = filtered.filter(r => {
      const dt   = new Date(r.datetime);
      const dStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      return dStr === rdvDayFilter;
    });
  }

  if (filtered.length === 0) {
    list.innerHTML = `<p class="rdv-empty">${
      rdvDayFilter  ? 'Aucun RDV ce jour.' :
      rdvShowPasses ? 'Aucun RDV passé ou annulé.' :
                      'Aucun rendez-vous à venir. 🎉'
    }</p>`;
    return;
  }

  const todayStr = new Date().toDateString();
  let lastDateLabel = null;

  filtered.forEach(r => {
    const dt         = new Date(r.datetime);
    const dateLabel  = dt.toDateString() === todayStr
      ? "Aujourd'hui"
      : dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    // Séparateur de date
    if (dateLabel !== lastDateLabel) {
      lastDateLabel = dateLabel;
      const sep = document.createElement('div');
      sep.className = 'rdv-date-sep';
      sep.textContent = dateLabel;
      list.appendChild(sep);
    }

    const heureStr = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const clientLabel = r.clientName
      ? r.clientName
      : r.clientId
        ? `Client ···${r.clientId.slice(-4)}`
        : 'Client non renseigné';

    const statutClass = { 'prévu': 'rdv-statut-prevu', 'passé': 'rdv-statut-passe', 'annulé': 'rdv-statut-annule' }[r.statut] ?? '';
    const statutLabel = { 'prévu': '⏳ Prévu', 'passé': '✅ Passé', 'annulé': '❌ Annulé' }[r.statut] ?? r.statut;

    const channelLink = r.guildId && r.channelId
      ? `<a class="rdv-ticket-link" href="https://discord.com/channels/${r.guildId}/${r.channelId}" target="_blank">🔗 Salon</a>`
      : '';

    const agentHtml = (rdvAgentFilter === null)
      ? `<span class="rdv-meta-item">
           ${r.agentPhoto ? `<img src="${r.agentPhoto}" class="rdv-agent-mini-avatar" onerror="this.style.display='none'">` : r.agentEmoji}
           ${r.agentName}
         </span>`
      : '';

    const cancelBtn = (currentUser?.isAdmin && r.statut === 'prévu')
      ? `<button class="rdv-cancel-btn" onclick="cancelRdv('${r.id}')">Annuler</button>`
      : '';

    const card = document.createElement('div');
    card.className = `rdv-card ${r.statut === 'annulé' ? 'rdv-card-annule' : ''}`;
    card.innerHTML = `
      <div class="rdv-time-block">
        <div class="rdv-heure">${heureStr}</div>
      </div>
      <div class="rdv-body">
        <div class="rdv-description">${r.description}</div>
        <div class="rdv-meta">
          <span class="rdv-meta-item">🤝 ${clientLabel}</span>
          ${r.lieu ? `<span class="rdv-meta-item">📍 ${r.lieu}</span>` : ''}
          ${agentHtml}
          ${channelLink}
        </div>
      </div>
      <div class="rdv-right">
        <span class="rdv-statut ${statutClass}">${statutLabel}</span>
        ${cancelBtn}
      </div>
    `;
    list.appendChild(card);
  });
}

async function cancelRdv(id) {
  if (!confirm('Annuler ce rendez-vous ?')) return;
  const res = await api(`/rdv/${id}`, { method: 'DELETE' });
  if (res?.ok) {
    toast('❌ Rendez-vous annulé');
    loadRdv();
  } else {
    toast(res?.error || 'Erreur', 'error');
  }
}

// ── Calendrier RDV ────────────────────────────────────────────────────────────

function renderRdvCalendar() {
  const container = document.getElementById('rdv-calendar');
  if (!container) return;
  if (rdvCalView === 'week') renderWeekView(container);
  else                       renderMonthView(container);
}

/** Construit la barre commune : navigation ◀ ▶ + toggle Mois/Semaine */
function buildCalHeader(label) {
  return `
    <div class="rdv-cal-header">
      <button class="rdv-cal-nav" id="rdv-cal-prev">◀</button>
      <span class="rdv-cal-title">${label}</span>
      <button class="rdv-cal-nav" id="rdv-cal-next">▶</button>
      <div class="rdv-cal-view-toggle">
        <button class="rdv-cal-view-btn${rdvCalView === 'month' ? ' active' : ''}" data-view="month">Mois</button>
        <button class="rdv-cal-view-btn${rdvCalView === 'week'  ? ' active' : ''}" data-view="week">Semaine</button>
      </div>
    </div>`;
}

/** Attache les listeners communs (nav + toggle vue) après inject HTML */
function attachCalListeners(onPrev, onNext) {
  document.getElementById('rdv-cal-prev').addEventListener('click', onPrev);
  document.getElementById('rdv-cal-next').addEventListener('click', onNext);
  document.querySelectorAll('.rdv-cal-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      rdvCalView   = btn.dataset.view;
      rdvDayFilter = null;
      // Sync les deux états de date au changement de vue
      if (rdvCalView === 'week') rdvCalWeek = getMonday(rdvCalMonth);
      else                       rdvCalMonth = new Date(rdvCalWeek.getFullYear(), rdvCalWeek.getMonth(), 1);
      renderRdvCalendar();
      renderRdvList();
    });
  });
}

// ── Vue Mois ──────────────────────────────────────────────────────────────────

function renderMonthView(container) {
  const year    = rdvCalMonth.getFullYear();
  const month   = rdvCalMonth.getMonth();
  const todayStr = fmtISO(new Date());

  const source = rdvAgentFilter ? rdvData.filter(r => r.agentId === rdvAgentFilter) : rdvData;

  // Regrouper par numéro de jour
  const byDay = {};
  source.forEach(r => {
    const dt = new Date(r.datetime);
    if (dt.getFullYear() === year && dt.getMonth() === month) {
      const d = dt.getDate();
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(r);
    }
  });

  const monthLabel    = rdvCalMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const firstDow      = new Date(year, month, 1).getDay();
  const offset        = (firstDow + 6) % 7;
  const daysInMonth   = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  let html = buildCalHeader(monthLabel);
  html += `
    <div class="rdv-cal-grid">
      <div class="rdv-cal-dow">Lu</div><div class="rdv-cal-dow">Ma</div>
      <div class="rdv-cal-dow">Me</div><div class="rdv-cal-dow">Je</div>
      <div class="rdv-cal-dow">Ve</div><div class="rdv-cal-dow">Sa</div>
      <div class="rdv-cal-dow">Di</div>`;

  for (let i = offset - 1; i >= 0; i--)
    html += `<div class="rdv-cal-cell rdv-cal-out"><span class="rdv-cal-day">${prevMonthDays - i}</span></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr    = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday    = dateStr === todayStr;
    const isSelected = rdvDayFilter === dateStr;
    const rdvs       = byDay[d] || [];

    const dotsHtml = rdvs.slice(0, 4).map(r => {
      const cls = r.statut === 'prévu' ? 'prevu' : r.statut === 'passé' ? 'passe' : 'annule';
      return `<span class="rdv-cal-dot ${cls}"></span>`;
    }).join('');

    const countHtml = rdvs.length > 0
      ? `<span class="rdv-cal-count">${rdvs.length}</span>`
      : '';

    html += `<div class="rdv-cal-cell in-month${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}" data-date="${dateStr}">
      <div class="rdv-cal-day-row">
        <span class="rdv-cal-day">${d}</span>${countHtml}
      </div>
      ${dotsHtml ? `<div class="rdv-cal-dots">${dotsHtml}</div>` : ''}
    </div>`;
  }

  const totalCells = offset + daysInMonth;
  const remainder  = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remainder; i++)
    html += `<div class="rdv-cal-cell rdv-cal-out"><span class="rdv-cal-day">${i}</span></div>`;

  html += '</div>';
  container.innerHTML = html;

  attachCalListeners(
    () => { rdvCalMonth = new Date(year, month - 1, 1); rdvDayFilter = null; renderRdvCalendar(); renderRdvList(); },
    () => { rdvCalMonth = new Date(year, month + 1, 1); rdvDayFilter = null; renderRdvCalendar(); renderRdvList(); },
  );

  container.querySelectorAll('.rdv-cal-cell.in-month').forEach(cell => {
    cell.addEventListener('click', () => {
      rdvDayFilter = rdvDayFilter === cell.dataset.date ? null : cell.dataset.date;
      renderRdvCalendar();
      renderRdvList();
    });
  });
}

// ── Vue Semaine ───────────────────────────────────────────────────────────────

function renderWeekView(container) {
  const monday   = new Date(rdvCalWeek);
  const sunday   = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const todayStr = fmtISO(new Date());

  const source = rdvAgentFilter ? rdvData.filter(r => r.agentId === rdvAgentFilter) : rdvData;

  // Regrouper par date ISO
  const byDay = {};
  source.forEach(r => {
    const key = fmtISO(new Date(r.datetime));
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(r);
  });

  const weekLabel = `${monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} – ${sunday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  const DOW_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  let html = buildCalHeader(weekLabel);
  html += '<div class="rdv-week-grid">';

  for (let i = 0; i < 7; i++) {
    const day      = new Date(monday); day.setDate(monday.getDate() + i);
    const dateStr  = fmtISO(day);
    const isToday  = dateStr === todayStr;
    const isSel    = rdvDayFilter === dateStr;
    const rdvs     = byDay[dateStr] || [];
    const MAX      = 4;
    const shown    = rdvs.slice(0, MAX);
    const extra    = rdvs.length - MAX;

    const eventsHtml = shown.map(r => {
      const heure = new Date(r.datetime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const cls   = r.statut === 'passé' ? 'passe' : r.statut === 'annulé' ? 'annule' : '';
      return `<div class="rdv-week-event ${cls}" title="${r.description}">${heure} ${r.description}</div>`;
    }).join('');

    const moreHtml = extra > 0 ? `<div class="rdv-week-event-more">+${extra} autre${extra > 1 ? 's' : ''}</div>` : '';

    html += `
      <div class="rdv-week-col${isToday ? ' today' : ''}${isSel ? ' selected' : ''}" data-date="${dateStr}">
        <div class="rdv-week-col-header">
          <div class="rdv-week-dow">${DOW_LABELS[i]}</div>
          <div class="rdv-week-day">${day.getDate()}</div>
          ${rdvs.length ? `<div class="rdv-week-count">${rdvs.length}</div>` : ''}
        </div>
        <div class="rdv-week-events">${eventsHtml}${moreHtml}</div>
      </div>`;
  }

  html += '</div>';
  container.innerHTML = html;

  attachCalListeners(
    () => { rdvCalWeek = new Date(rdvCalWeek); rdvCalWeek.setDate(rdvCalWeek.getDate() - 7); rdvDayFilter = null; renderRdvCalendar(); renderRdvList(); },
    () => { rdvCalWeek = new Date(rdvCalWeek); rdvCalWeek.setDate(rdvCalWeek.getDate() + 7); rdvDayFilter = null; renderRdvCalendar(); renderRdvList(); },
  );

  container.querySelectorAll('.rdv-week-col').forEach(col => {
    col.addEventListener('click', () => {
      rdvDayFilter = rdvDayFilter === col.dataset.date ? null : col.dataset.date;
      renderRdvCalendar();
      renderRdvList();
    });
  });
}

// ── Créer un RDV ──────────────────────────────────────────────────────────────

async function openCreateRdvModal() {
  // Charger les agents si besoin (si on arrive directement sur la page RDV)
  if (!agentsData.length) {
    const [agents, sacsData] = await Promise.all([api('/agents'), api('/sacs')]);
    if (!agents || !sacsData) return;
    agentsData   = agents;
    agentsSacMap = Object.fromEntries(sacsData.agents.map(a => [a.agentId, a]));
  }

  const activeAgents = agentsData.filter(a => (agentsSacMap[a.id]?.statut ?? 'actif') !== 'parti');
  const sel = document.getElementById('rdv-f-agent');
  sel.innerHTML = `<option value="">— Choisir un agent —</option>` +
    activeAgents.map(a => `<option value="${a.id}">${a.emoji ? a.emoji + ' ' : ''}${a.name}</option>`).join('');

  // Pré-remplir la date avec aujourd'hui
  const today   = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  document.getElementById('rdv-f-date').value        = dateStr;
  document.getElementById('rdv-f-heure').value       = '';
  document.getElementById('rdv-f-description').value = '';
  document.getElementById('rdv-f-client-name').value = '';
  document.getElementById('rdv-f-client-id').value   = '';
  document.getElementById('rdv-f-lieu').value        = '';
  document.getElementById('rdv-f-rappel').value      = '30';
  document.getElementById('rdv-f-channel').value     = '';

  document.getElementById('rdv-create-overlay').style.display = 'flex';
}

function closeCreateRdvModal() {
  document.getElementById('rdv-create-overlay').style.display = 'none';
}

document.getElementById('btn-new-rdv').addEventListener('click', openCreateRdvModal);
document.getElementById('rdv-create-close').addEventListener('click', closeCreateRdvModal);
document.getElementById('rdv-create-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('rdv-create-overlay')) closeCreateRdvModal();
});

// Auto-remplissage du salon depuis le bunker de l'agent sélectionné
document.getElementById('rdv-f-agent').addEventListener('change', function () {
  const agent = agentsData.find(a => a.id === this.value);
  document.getElementById('rdv-f-channel').value = agent?.bunker || '';
});

document.getElementById('rdv-create-form').addEventListener('submit', async e => {
  e.preventDefault();

  const agentId       = document.getElementById('rdv-f-agent').value;
  const date          = document.getElementById('rdv-f-date').value;
  const heure         = document.getElementById('rdv-f-heure').value;
  const description   = document.getElementById('rdv-f-description').value.trim();
  const clientName    = document.getElementById('rdv-f-client-name').value.trim();
  const clientId      = document.getElementById('rdv-f-client-id').value.trim();
  const lieu          = document.getElementById('rdv-f-lieu').value.trim();
  const rappelMinutes = document.getElementById('rdv-f-rappel').value;
  const channelId     = document.getElementById('rdv-f-channel').value.trim();

  if (!agentId)        return toast('Sélectionne un agent', 'error');
  if (!date || !heure) return toast('Date et heure requises', 'error');
  if (!description)    return toast('Description requise', 'error');

  const res = await api('/rdv', {
    method: 'POST',
    body:   { agentId, date, heure, description, clientName, clientId, lieu, rappelMinutes, channelId },
  });

  if (res?.ok) {
    toast('✅ Rendez-vous créé');
    closeCreateRdvModal();
    // Repasser en mode avenir et recharger
    rdvShowPasses = false;
    const toggleBtn = document.getElementById('rdv-toggle-passes');
    toggleBtn.textContent = 'Voir les passés / annulés';
    toggleBtn.style.color = 'var(--text-muted)';
    loadRdv();
  } else {
    toast(res?.error || 'Erreur', 'error');
  }
});

document.getElementById('rdv-toggle-passes').addEventListener('click', function () {
  rdvShowPasses  = !rdvShowPasses;
  rdvAgentFilter = null;
  rdvDayFilter   = null;
  rdvCalMonth    = new Date(); // reset au mois courant
  this.textContent = rdvShowPasses ? '← Voir à venir' : 'Voir les passés / annulés';
  this.style.color = rdvShowPasses ? 'var(--accent)' : 'var(--text-muted)';
  loadRdv();
});

// ── Configuration ─────────────────────────────────────────────────────────────

async function loadConfig() {
  const data = await api('/config');
  if (!data) return;

  renderConfigStats(data.dbStats);
  renderConfigUsers(data.panelUsers);

  // Section ajout visible uniquement pour les admins
  document.getElementById('config-add-user-section').style.display =
    currentUser?.isAdmin ? 'block' : 'none';
}

function renderConfigStats(stats) {
  const grid = document.getElementById('config-stats-grid');
  grid.innerHTML = '';
  const items = [
    { label: 'Agents',           value: stats.agents,        icon: '👤' },
    { label: 'Annonces totales', value: stats.annonces,      icon: '🏠' },
    { label: 'En attente',       value: stats.waitingActifs, icon: '📋' },
    { label: 'Clients (total)',  value: stats.waitingTotal,  icon: '🗂️' },
    { label: 'Sacs attribués',   value: stats.sacs,          icon: '🎒' },
  ];
  items.forEach(({ label, value, icon }) => {
    const card = document.createElement('div');
    card.className = 'config-stat-card';
    card.innerHTML = `
      <div class="config-stat-icon">${icon}</div>
      <div class="config-stat-value">${value}</div>
      <div class="config-stat-label">${label}</div>
    `;
    grid.appendChild(card);
  });
}

function renderConfigUsers(users) {
  const list = document.getElementById('config-users-list');
  list.innerHTML = '';

  users.forEach(u => {
    const isSelf = currentUser?.id === u.discordId;
    const card   = document.createElement('div');
    card.className = 'config-user-card';

    const avatarUrl = `https://cdn.discordapp.com/embed/avatars/${parseInt(u.discordId) % 5}.png`;

    card.innerHTML = `
      <img class="config-user-avatar" src="${avatarUrl}" alt="">
      <div class="config-user-info">
        <div class="config-user-name">${u.name} ${isSelf ? '<span class="config-self-badge">vous</span>' : ''}</div>
        <div class="config-user-id">${u.discordId}</div>
      </div>
      <div class="config-user-role">
        ${currentUser?.isAdmin && !isSelf
          ? `<label class="config-toggle" title="Admin">
               <input type="checkbox" ${u.isAdmin ? 'checked' : ''}
                 onchange="togglePanelUserAdmin('${u.discordId}', this.checked)">
               <span>Admin</span>
             </label>`
          : `<span class="badge ${u.isAdmin ? '' : 'lbc'}" style="${u.isAdmin ? '' : 'background:rgba(255,255,255,.05);color:var(--text-muted);border-color:var(--border)'}">
               ${u.isAdmin ? 'Admin' : 'Lecture'}
             </span>`
        }
      </div>
      ${currentUser?.isAdmin && !isSelf
        ? `<button class="config-user-remove" onclick="removePanelUser('${u.discordId}', '${u.name}')" title="Retirer l'accès">✕</button>`
        : ''}
    `;
    list.appendChild(card);
  });
}

async function togglePanelUserAdmin(discordId, isAdmin) {
  const res = await api(`/config/users/${discordId}`, { method: 'PATCH', body: { isAdmin } });
  if (res?.ok) toast(`✅ Rôle mis à jour`);
  else { toast(res?.error || 'Erreur', 'error'); loadConfig(); }
}

async function removePanelUser(discordId, name) {
  if (!confirm(`Retirer l'accès au panel à "${name}" ?`)) return;
  const res = await api(`/config/users/${discordId}`, { method: 'DELETE' });
  if (res?.ok) { toast('✅ Accès retiré'); loadConfig(); }
  else toast(res?.error || 'Erreur', 'error');
}

// Bouton rafraîchir cache
document.getElementById('btn-refresh-cache').addEventListener('click', async () => {
  const btn = document.getElementById('btn-refresh-cache');
  btn.classList.add('loading');
  const res = await api('/agents/refresh', { method: 'POST' });
  btn.classList.remove('loading');
  if (res?.ok) toast(`✅ Cache rechargé — ${res.count} agent(s)`);
  else toast(res?.error || 'Erreur', 'error');
});

// Bouton ajouter utilisateur
document.getElementById('btn-add-panel-user').addEventListener('click', async () => {
  const discordId = document.getElementById('new-user-id').value.trim();
  const name      = document.getElementById('new-user-name').value.trim();
  const isAdmin   = document.getElementById('new-user-admin').checked;

  if (!discordId || !name) return toast('ID et nom requis', 'error');
  if (!/^\d{17,20}$/.test(discordId)) return toast('ID Discord invalide (17-20 chiffres)', 'error');

  const res = await api('/config/users', { method: 'POST', body: { discordId, name, isAdmin } });
  if (res?.ok) {
    toast('✅ Accès ajouté');
    document.getElementById('new-user-id').value   = '';
    document.getElementById('new-user-name').value = '';
    document.getElementById('new-user-admin').checked = false;
    loadConfig();
  } else {
    toast(res?.error || 'Erreur', 'error');
  }
});

// ── Attente ───────────────────────────────────────────────────────────────────

let attenteData      = [];
let attenteCats      = [];
let attenteCatFilter = null; // null = toutes les catégories

const STATUT_INFO = {
  'active':   { color: 'var(--success)', label: 'Actif'     },
  'contacté': { color: 'var(--accent2)', label: 'Contacté'  },
  'terminé':  { color: 'var(--danger)',  label: 'Terminé'   },
};

async function loadAttente() {
  const data = await api('/attente');
  if (!data) return;
  attenteData      = data.clients;
  attenteCats      = data.categories;
  attenteCatFilter = null;
  renderAttenteCats();
  renderAttenteList();
}

function renderAttenteCats() {
  const grid = document.getElementById('attente-cats-grid');
  grid.innerHTML = '';

  attenteCats.forEach(cat => {
    const card = document.createElement('div');
    card.className = `attente-cat-card${attenteCatFilter === cat.key ? ' active' : ''}${cat.count === 0 ? ' empty' : ''}`;
    card.innerHTML = `
      <div class="attente-cat-emoji">${cat.emoji}</div>
      <div class="attente-cat-count">${cat.count}</div>
      <div class="attente-cat-label">${cat.label}</div>
    `;
    card.onclick = () => {
      attenteCatFilter = attenteCatFilter === cat.key ? null : cat.key;
      renderAttenteCats();
      renderAttenteList();
    };
    grid.appendChild(card);
  });
}

function renderAttenteList() {
  const list  = document.getElementById('attente-list');
  const title = document.getElementById('attente-section-title');
  list.innerHTML = '';

  // Toujours exclure les terminés de la vue principale
  let filtered = attenteData.filter(c => c.status !== 'terminé');

  if (attenteCatFilter) {
    const cat = attenteCats.find(c => c.key === attenteCatFilter);
    if (cat) {
      filtered = filtered.filter(c => c.biens.some(b => cat.types.includes(b.type)));
      title.textContent = `${cat.emoji} ${cat.label} — ${filtered.length} client(s)`;
    }
  } else {
    title.textContent = `Tous les clients actifs — ${filtered.length}`;
  }

  if (filtered.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:.875rem;padding:8px 0">Aucun client en attente pour cette catégorie.</p>';
    return;
  }

  filtered.forEach(c => {
    const card    = document.createElement('div');
    card.className = 'attente-card';
    card.dataset.id = c.id;

    const statut = STATUT_INFO[c.status] ?? { color: 'var(--text-muted)', label: c.status };
    const date   = c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR') : '—';
    const budget = c.budget?.max != null ? c.budget.max.toLocaleString('fr-FR') + ' $' : '—';

    const biensHtml = (c.biens || []).map(b =>
      `<span class="attente-bien">${b.type}<span class="attente-zone"> · 📍 ${b.zone}</span></span>`
    ).join('');

    const notesHtml  = c.notes ? `<div class="attente-notes">📝 ${c.notes}</div>` : '';
    const agentHtml  = c.agentName ? `<span class="attente-meta-item">👤 ${c.agentEmoji} ${c.agentName}</span>` : '';
    const ticketHtml = c.ticketId
      ? `<a class="attente-meta-item attente-ticket" href="https://discord.com/channels/${c.ticketId}" target="_blank">🎫 Ticket</a>`
      : '';

    const statusCtrl = currentUser?.isAdmin
      ? `<select class="attente-status-select" onchange="setAttenteStatus('${c.id}', this.value)">
           <option value="active"   ${c.status === 'active'   ? 'selected' : ''}>🟢 Actif</option>
           <option value="contacté" ${c.status === 'contacté' ? 'selected' : ''}>🟡 Contacté</option>
           <option value="terminé"  ${c.status === 'terminé'  ? 'selected' : ''}>🔴 Terminé</option>
         </select>`
      : `<span class="attente-status-dot" style="color:${statut.color}">${statut.label}</span>`;

    const deleteBtn = currentUser?.isAdmin
      ? `<button class="attente-delete-btn" onclick="deleteAttenteClient('${c.id}')" title="Supprimer">🗑️</button>`
      : '';

    // Nom réel si renseigné, sinon pseudo Discord, sinon fragment d'ID
    const nomReel    = [c.prenom, c.nom].filter(Boolean).join(' ');
    const phoneHtml  = c.telephone
      ? `<span class="attente-phone">📞 ${c.telephone}</span>`
      : '';
    const discordSub = c.clientName && nomReel
      ? `<span class="attente-discord-name">🎮 ${c.clientName}</span>`
      : '';
    const clientLabel = nomReel
      ? `<span class="attente-client-name">${nomReel}</span>${discordSub}${phoneHtml}`
      : c.clientName
        ? `<span class="attente-client-name">${c.clientName}</span>${phoneHtml}`
        : `<span class="attente-client-id" title="${c.clientId}">ID ···${c.clientId.slice(-4)}</span>${phoneHtml}`;

    card.innerHTML = `
      <div class="attente-card-header">
        <div class="attente-client">
          <div class="attente-client-identity">${clientLabel}</div>
          ${statusCtrl}
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="attente-budget">💰 max ${budget}</span>
          ${deleteBtn}
        </div>
      </div>
      <div class="attente-biens">${biensHtml}</div>
      ${notesHtml}
      <div class="attente-meta">
        ${agentHtml}
        <span class="attente-meta-item">📅 ${date}</span>
        ${ticketHtml}
      </div>
    `;
    list.appendChild(card);
  });
}

async function setAttenteStatus(id, status) {
  const res = await api(`/attente/${id}/status`, { method: 'PATCH', body: { status } });
  if (res?.ok) {
    const entry = attenteData.find(c => c.id === id);
    if (entry) entry.status = status;
    // Recalculer les counts
    const actifs = attenteData.filter(c => c.status !== 'terminé');
    attenteCats.forEach(cat => {
      cat.count = actifs.filter(c => c.biens.some(b => cat.types.includes(b.type))).length;
    });
    renderAttenteCats();
    renderAttenteList();
    toast('✅ Statut mis à jour');
  } else {
    toast(res?.error || 'Erreur', 'error');
  }
}

async function deleteAttenteClient(id) {
  if (!confirm('Supprimer ce client de la liste d\'attente ?')) return;
  const res = await api(`/attente/${id}`, { method: 'DELETE' });
  if (res?.ok) {
    attenteData = attenteData.filter(c => c.id !== id);
    const actifs = attenteData.filter(c => c.status !== 'terminé');
    attenteCats.forEach(cat => {
      cat.count = actifs.filter(c => c.biens.some(b => cat.types.includes(b.type))).length;
    });
    renderAttenteCats();
    renderAttenteList();
    toast('🗑️ Client supprimé');
  } else {
    toast(res?.error || 'Erreur', 'error');
  }
}

// ── Récap Semaine ─────────────────────────────────────────────────────────────

const RECAP_GRADES  = ['Agent Débutant', 'Agent', 'Agent Confirmé', 'Agent Senior', 'Responsable', 'Co-Patron', 'Patron'];
const TOP3_MEDALS   = ['🥇', '🥈', '🥉'];
const TOP3_EXAMPLES = ['SUD CDP', 'Contrat de vente', 'SUD LOCATION'];

let recapRolesSup  = [''];                    // IDs de rôles supplémentaires
let recapArrivees  = [{ agent: '', grade: '' }]; // tableau des arrivées

async function loadRecap() {
  // Charger les agents si nécessaire
  if (!agentsData.length) {
    const [agents, sacsData] = await Promise.all([api('/agents'), api('/sacs')]);
    if (!agents || !sacsData) return;
    agentsData   = agents;
    agentsSacMap = Object.fromEntries(sacsData.agents.map(a => [a.agentId, a]));
  }

  const activeAgents = agentsData.filter(a => (agentsSacMap[a.id]?.statut ?? 'actif') !== 'parti');
  const agentOpts = `<option value="">— Aucun —</option>` +
    activeAgents.map(a => `<option value="${a.id}">${a.emoji ? a.emoji + ' ' : ''}${a.name}</option>`).join('');
  const gradeOpts = `<option value="">— Grade —</option>` +
    RECAP_GRADES.map(g => `<option value="${g}">${g}</option>`).join('');

  // Peupler les selects d'agents palmarès
  ['recap-cdp', 'recap-vendeur', 'recap-loueur'].forEach(id => {
    document.getElementById(id).innerHTML = agentOpts;
  });

  // Arrivées dynamiques
  recapArrivees = [{ agent: '', grade: '' }];
  renderRecapArrivees();

  // Félicitations structurées (3 lignes agent + grade)
  renderFelRows(agentOpts, gradeOpts);

  // Top 3
  renderTop3();

  // Rôles supplémentaires
  recapRolesSup = [''];
  renderRecapRoles();

  // Restaurer le canal depuis le localStorage
  document.getElementById('recap-canal').value = localStorage.getItem('recap_canal') || '';

  // Reset champs texte
  ['recap-departs', 'recap-felicitations', 'recap-info', 'recap-nouveau',
   'recap-avert', 'recap-ca', 'recap-primes', 'recap-benef'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('recap-publish-status').textContent = '';

  loadRecapHistory();
}

// ── Arrivées (liste dynamique) ────────────────────────────────────────────────

function renderRecapArrivees() {
  const activeAgents = agentsData.filter(a => (agentsSacMap[a.id]?.statut ?? 'actif') !== 'parti');
  const list = document.getElementById('recap-arrivees-list');
  list.innerHTML = '';
  recapArrivees.forEach((a, i) => {
    const agentHtml = `<option value="">— Aucun —</option>` +
      activeAgents.map(ag =>
        `<option value="${ag.id}"${ag.id === a.agent ? ' selected' : ''}>${ag.emoji ? ag.emoji + ' ' : ''}${ag.name}</option>`,
      ).join('');
    const gradeHtml = `<option value="">— Grade —</option>` +
      RECAP_GRADES.map(g =>
        `<option value="${g}"${g === a.grade ? ' selected' : ''}>${g}</option>`,
      ).join('');
    const row = document.createElement('div');
    row.className = 'recap-arrivee-row';
    row.innerHTML = `
      <select class="recap-select" style="flex:1"
        onchange="recapArrivees[${i}].agent = this.value">${agentHtml}</select>
      <select class="recap-select" style="flex:1"
        onchange="recapArrivees[${i}].grade = this.value">${gradeHtml}</select>
      ${recapArrivees.length > 1
        ? `<button class="recap-role-del" onclick="removeRecapArrivee(${i})" title="Retirer">✕</button>`
        : ''}
    `;
    list.appendChild(row);
  });
}

function removeRecapArrivee(i) {
  recapArrivees.splice(i, 1);
  renderRecapArrivees();
}

document.getElementById('btn-recap-add-arrivee').addEventListener('click', () => {
  if (recapArrivees.length >= 6) return toast('Maximum 6 arrivées', 'error');
  recapArrivees.push({ agent: '', grade: '' });
  renderRecapArrivees();
});

// ── Rôles supplémentaires (liste dynamique) ──────────────────────────────────

function renderRecapRoles() {
  const list = document.getElementById('recap-roles-sup-list');
  list.innerHTML = '';
  recapRolesSup.forEach((val, i) => {
    const row = document.createElement('div');
    row.className = 'recap-role-row';
    row.innerHTML = `
      <input type="text" class="recap-input" value="${val}"
        placeholder="ID du rôle Discord"
        oninput="recapRolesSup[${i}] = this.value">
      ${recapRolesSup.length > 1
        ? `<button class="recap-role-del" onclick="removeRecapRole(${i})" title="Retirer">✕</button>`
        : ''}
    `;
    list.appendChild(row);
  });
}

function removeRecapRole(i) {
  recapRolesSup.splice(i, 1);
  renderRecapRoles();
}

document.getElementById('btn-recap-add-role').addEventListener('click', () => {
  if (recapRolesSup.length >= 6) return toast('Maximum 6 rôles supplémentaires', 'error');
  recapRolesSup.push('');
  renderRecapRoles();
  // Focus sur le nouvel input
  document.getElementById('recap-roles-sup-list')
    .querySelectorAll('input').item(recapRolesSup.length - 1)?.focus();
});

// ── Félicitations structurées ────────────────────────────────────────────────

function renderFelRows(agentOpts, gradeOpts) {
  const list = document.getElementById('recap-fel-list');
  list.innerHTML = '';
  for (let i = 1; i <= 3; i++) {
    const row = document.createElement('div');
    row.className = 'recap-fel-row';
    row.innerHTML = `
      <div class="recap-fel-num">${i}</div>
      <select id="recap-fel-${i}-agent" class="recap-select" style="flex:1">${agentOpts}</select>
      <select id="recap-fel-${i}-grade" class="recap-select" style="flex:1">${gradeOpts}</select>
    `;
    list.appendChild(row);
  }
}

// ── Top 3 ────────────────────────────────────────────────────────────────────

function renderTop3() {
  const list = document.getElementById('recap-top3-list');
  list.innerHTML = '';
  TOP3_MEDALS.forEach((medal, i) => {
    const row = document.createElement('div');
    row.className = 'recap-top3-row';
    row.innerHTML = `
      <span class="recap-top3-medal">${medal}</span>
      <input type="number" id="recap-top3-count-${i}" class="recap-input recap-top3-count"
        min="0" placeholder="0">
      <input type="text" id="recap-top3-service-${i}" class="recap-input recap-top3-service"
        placeholder="${TOP3_EXAMPLES[i]}">
    `;
    list.appendChild(row);
  });
}

// ── Historique ───────────────────────────────────────────────────────────────

async function loadRecapHistory() {
  const recaps = await api('/recap');
  if (!recaps) return;
  const list = document.getElementById('recap-history');

  if (!recaps.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:.78rem">Aucun récap publié.</p>';
    return;
  }

  list.innerHTML = '';
  recaps.forEach(r => {
    const fmtY = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '?';
    const date = fmtY(r.createdAt);

    const [cls, lbl] = ({
      'envoyé':    ['recap-statut-envoye',  '✅ Envoyé'],
      'erreur':    ['recap-statut-erreur',   '❌ Erreur'],
      'a_publier': ['recap-statut-attente',  '⏳ En cours…'],
    })[r.statut] ?? ['recap-statut-brouillon', '📝 Brouillon'];

    const item = document.createElement('div');
    item.className = 'recap-history-item';
    item.innerHTML = `
      <div class="recap-history-period">${date}</div>
      <span class="recap-statut ${cls}">${lbl}</span>
    `;
    list.appendChild(item);
  });
}

// ── Publication ──────────────────────────────────────────────────────────────

document.getElementById('btn-recap-publier').addEventListener('click', async () => {
  const canalId = document.getElementById('recap-canal').value.trim();
  if (!canalId) return toast('Salon Discord requis', 'error');

  const top3Rows = TOP3_MEDALS.map((_, i) => [
    document.getElementById(`recap-top3-count-${i}`)?.value   || '',
    document.getElementById(`recap-top3-service-${i}`)?.value || '',
  ]);

  const body = {
    canalId,
    cdp:           document.getElementById('recap-cdp').value           || null,
    vendeur:       document.getElementById('recap-vendeur').value       || null,
    loueur:        document.getElementById('recap-loueur').value        || null,
    arrivees:      recapArrivees.filter(a => a.agent),
    roles_sup:     recapRolesSup.map(id => id.trim()).filter(Boolean),
    departs:       document.getElementById('recap-departs').value.trim(),
    felicitations: document.getElementById('recap-felicitations').value.trim(),
    info:          document.getElementById('recap-info').value.trim(),
    nouveau:       document.getElementById('recap-nouveau').value.trim(),
    avert:         document.getElementById('recap-avert').value.trim(),
    ca:            document.getElementById('recap-ca').value     || null,
    primes:        document.getElementById('recap-primes').value || null,
    benef:         document.getElementById('recap-benef').value  || null,
    top3Rows,
    fel_1_agent:   document.getElementById('recap-fel-1-agent').value || null,
    fel_1_grade:   document.getElementById('recap-fel-1-grade').value || null,
    fel_2_agent:   document.getElementById('recap-fel-2-agent').value || null,
    fel_2_grade:   document.getElementById('recap-fel-2-grade').value || null,
    fel_3_agent:   document.getElementById('recap-fel-3-agent').value || null,
    fel_3_grade:   document.getElementById('recap-fel-3-grade').value || null,
  };

  const btn      = document.getElementById('btn-recap-publier');
  const statusEl = document.getElementById('recap-publish-status');
  btn.disabled   = true;
  statusEl.textContent = '⏳ Publication en cours…';

  const res = await api('/recap', { method: 'POST', body });

  btn.disabled = false;

  if (res?.ok) {
    localStorage.setItem('recap_canal', canalId);
    toast('📤 Récap envoyé sur Discord !');
    statusEl.textContent = '✅ Publié avec succès';
    loadRecapHistory();
  } else {
    toast(res?.error || 'Erreur', 'error');
    statusEl.textContent = '';
  }
});

// ── Historique des actions ────────────────────────────────────────────────────

let logsAllActors = []; // pour le filtre agents (rempli au premier chargement)
let logsSkip      = 0;  // offset de pagination
let logsTotal     = 0;  // total d'entrées côté serveur
const LOGS_LIMIT  = 50;

// Détails lisibles selon le type d'action
function buildLogDetails(log) {
  const d = log.details ?? {};
  switch (log.type) {
    case 'recap_lbc':
      return [
        d.annonce  ? `Annonce #${d.annonce}` : null,
        d.type     ? `Type : ${d.type}`      : null,
        d.adresse  ? `📍 ${d.adresse}`       : null,
        d.prixDepart != null ? `Prix départ : ${fmtCA(d.prixDepart)}` : null,
      ].filter(Boolean).join(' · ');

    case 'vente_cloture':
      return [
        d.annonce   ? `Annonce #${d.annonce}` : null,
        d.type      ? d.type                   : null,
        d.prixFinal != null ? `→ **${fmtCA(d.prixFinal)}**` : null,
        d.prixDepart != null && d.prixFinal != null && d.prixFinal !== d.prixDepart
          ? `(départ ${fmtCA(d.prixDepart)})`
          : null,
      ].filter(Boolean).join(' · ');

    case 'attente_add':
    case 'attente_update': {
      const nom = [d.prenom, d.nom].filter(Boolean).join(' ') || d.clientName || null;
      return [
        nom          ? `👤 ${nom}`              : null,
        d.telephone  ? `📞 ${d.telephone}`       : null,
        d.budgetMax  ? `💰 max ${fmtCA(d.budgetMax)}` : null,
        d.biens?.length ? d.biens.join(', ')      : null,
      ].filter(Boolean).join(' · ');
    }

    case 'attente_remove': {
      const nom = [d.prenom, d.nom].filter(Boolean).join(' ') || d.clientName || null;
      return nom ? `👤 ${nom}` : null;
    }

    case 'recap_semaine':
      return d.canalId ? `Salon : ${d.canalId}` : null;

    case 'agent_create':
    case 'agent_update':
      return d.name ? d.name : (d.slug ?? null);

    case 'agent_delete':
      return d.slug ?? null;

    case 'sac_donner':
    case 'sac_retirer':
      return [
        d.agentName ? `→ ${d.agentName}` : null,
        d.sacs?.length ? d.sacs.join(', ') : null,
      ].filter(Boolean).join(' · ');

    default:
      return null;
  }
}

// ── Types de biens ────────────────────────────────────────────────────────────

let biensData     = [];    // [{type, base, frigo, caracteristiques, custom, ...}]
let biensSelected = null;  // type string sélectionné

async function loadBiens() {
  biensData = await api('/biens') ?? [];
  renderBiensList();
  if (biensSelected) {
    // Re-rendre l'éditeur si le type existe encore
    if (biensData.find(b => b.type === biensSelected)) renderBiensEditor(biensSelected);
    else { biensSelected = null; document.getElementById('biens-editor-col').innerHTML = '<div class="biens-empty-state"><span style="font-size:2.5rem">🏗️</span><p>Sélectionnez un type de bien à gauche pour l\'éditer.</p></div>'; }
  }
}

function renderBiensList() {
  const col = document.getElementById('biens-list-col');
  col.innerHTML = '';

  // Bouton "+ Nouveau type" en haut
  const newBtn = document.createElement('button');
  newBtn.className = 'biens-new-btn';
  newBtn.innerHTML = '＋ Nouveau type de bien';
  newBtn.addEventListener('click', openBienCreateModal);
  col.appendChild(newBtn);

  biensData.forEach(b => {
    const item = document.createElement('div');
    item.className = 'biens-type-item' + (b.type === biensSelected ? ' active' : '');
    item.dataset.type = b.type;
    item.innerHTML = `<span class="biens-type-dot"></span><span style="flex:1">${b.type}</span>${b.custom ? '<span class="biens-type-badge">custom</span>' : ''}`;
    item.addEventListener('click', () => {
      biensSelected = b.type;
      document.querySelectorAll('.biens-type-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      renderBiensEditor(b.type);
    });
    col.appendChild(item);
  });
}

function renderBiensEditor(type) {
  const col  = document.getElementById('biens-editor-col');
  const bien = biensData.find(b => b.type === type);
  if (!bien) return;

  const caract   = bien.caracteristiques ?? [];
  const isCustom = Boolean(bien.custom);

  col.innerHTML = `
    <div class="biens-editor-title">
      ✏️ ${escHtml(type)}
      ${isCustom ? '<span class="biens-type-badge" style="font-size:.7rem;vertical-align:middle;margin-left:8px">custom</span>' : ''}
    </div>

    <div class="biens-section-label">📦 Stockage</div>
    <div class="biens-storage-row">
      <div class="form-group">
        <label>Unités de base</label>
        <input type="number" id="b-base" class="config-input" value="${bien.base ?? 0}" min="0" style="width:100%">
      </div>
      <div class="form-group">
        <label>Frigo (0 = aucun)</label>
        <input type="number" id="b-frigo" class="config-input" value="${bien.frigo ?? 0}" min="0" style="width:100%">
      </div>
    </div>

    <div class="biens-section-label">🛋️ Caractéristiques intérieur</div>
    <div class="biens-caract-list" id="b-caract-list">
      ${caract.map((c, i) => buildCaractRow(c, i)).join('')}
    </div>
    <button class="btn-biens-add-caract" id="b-add-caract">+ Ajouter une caractéristique</button>

    <div class="biens-section-label">✨ Options</div>
    <div class="biens-options-grid">
      <label class="biens-option-label"><input type="checkbox" id="b-modifiable" ${bien.modifiable ? 'checked' : ''}> 🔧 Intérieur modifiable</label>
      <label class="biens-option-label"><input type="checkbox" id="b-ordinateur" ${bien.ordinateur ? 'checked' : ''}> 💻 Ordinateur</label>
      <label class="biens-option-label"><input type="checkbox" id="b-cafe"       ${bien.cafe       ? 'checked' : ''}> ☕ Machine à café</label>
      <label class="biens-option-label"><input type="checkbox" id="b-entreprise" ${bien.entrepriseOnly ? 'checked' : ''}> 🏭 Entreprises uniquement</label>
    </div>

    <div class="biens-section-label">ℹ️ Informations textuelles</div>
    <div class="form-group" style="margin-bottom:8px">
      <label>Article (utilisé dans les textes de stockage)</label>
      <input type="text" id="b-article" class="config-input" value="${escHtml(bien.article ?? type)}" style="width:100%">
    </div>
    <div class="form-row" style="margin-bottom:0">
      <div class="form-group" style="margin-bottom:0">
        <label>Titre affiché <span style="color:var(--text-muted)">(optionnel)</span></label>
        <input type="text" id="b-titre" class="config-input" value="${escHtml(bien.titre ?? '')}" placeholder="Laisser vide pour utiliser le nom par défaut" style="width:100%">
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label>Couleur intérieure <span style="color:var(--text-muted)">(optionnel)</span></label>
        <input type="text" id="b-couleur" class="config-input" value="${escHtml(bien.couleur ?? '')}" placeholder="ex : ⚪ Intérieur Blanc" style="width:100%">
      </div>
    </div>

    <div class="biens-editor-footer">
      ${isCustom ? '<button class="biens-delete-btn" id="b-delete">🗑️ Supprimer ce type</button>' : ''}
      <button class="btn btn-primary" id="b-save">💾 Enregistrer</button>
    </div>
  `;

  // Ajouter une caractéristique
  document.getElementById('b-add-caract').addEventListener('click', () => {
    const list = document.getElementById('b-caract-list');
    const row  = document.createElement('div');
    row.innerHTML = buildCaractRow('', list.children.length);
    list.appendChild(row.firstElementChild);
    list.lastElementChild.querySelector('input').focus();
    bindCaractDelete(list.lastElementChild);
  });

  // Bind delete sur items existants
  col.querySelectorAll('.biens-caract-item').forEach(el => bindCaractDelete(el));

  // Bouton supprimer (custom seulement)
  if (isCustom) {
    document.getElementById('b-delete').addEventListener('click', () => deleteBien(type));
  }

  // Sauvegarder
  document.getElementById('b-save').addEventListener('click', () => saveBien(type));
}

function buildCaractRow(value) {
  return `<div class="biens-caract-item">
    <input class="biens-caract-input" type="text" value="${escHtml(value)}" placeholder="Ex : Chambre avec dressing">
    <button class="biens-caract-del" title="Supprimer">✕</button>
  </div>`;
}

function bindCaractDelete(el) {
  el.querySelector('.biens-caract-del').addEventListener('click', () => el.remove());
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function saveBien(type) {
  const base    = parseInt(document.getElementById('b-base').value, 10)  || 0;
  const frigo   = parseInt(document.getElementById('b-frigo').value, 10) || 0;
  const article = document.getElementById('b-article').value.trim();
  const titre   = document.getElementById('b-titre').value.trim()   || null;
  const couleur = document.getElementById('b-couleur').value.trim() || null;

  const caracteristiques = Array.from(
    document.getElementById('b-caract-list').querySelectorAll('.biens-caract-input'),
  ).map(i => i.value.trim()).filter(Boolean);

  const payload = {
    base, frigo, article, titre, couleur,
    caracteristiques,
    modifiable:     document.getElementById('b-modifiable').checked,
    ordinateur:     document.getElementById('b-ordinateur').checked,
    cafe:           document.getElementById('b-cafe').checked,
    entrepriseOnly: document.getElementById('b-entreprise').checked,
  };

  const btn = document.getElementById('b-save');
  btn.disabled = true;
  btn.textContent = '⏳ Enregistrement…';

  const res = await api(`/biens/${encodeURIComponent(type)}`, { method: 'PUT', body: payload });
  btn.disabled = false;
  btn.textContent = '💾 Enregistrer';

  if (res?.ok) {
    toast(`✅ Type « ${type} » mis à jour`);
    const idx = biensData.findIndex(b => b.type === type);
    if (idx !== -1) biensData[idx] = { ...biensData[idx], ...payload };
  } else {
    toast(res?.error || 'Erreur lors de la sauvegarde', 'error');
  }
}

async function deleteBien(type) {
  if (!confirm(`Supprimer définitivement le type « ${type} » ?`)) return;

  const res = await api(`/biens/${encodeURIComponent(type)}`, { method: 'DELETE' });
  if (res?.ok) {
    toast(`🗑️ Type « ${type} » supprimé`);
    biensSelected = null;
    await loadBiens();
  } else {
    toast(res?.error || 'Erreur lors de la suppression', 'error');
  }
}

// ── Modal : création d'un nouveau type ───────────────────────────────────────

function openBienCreateModal() {
  // Réinitialiser les champs
  ['bc-type','bc-article','bc-titre','bc-couleur','bc-caract'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('bc-base').value  = '0';
  document.getElementById('bc-frigo').value = '0';
  ['bc-modifiable','bc-ordinateur','bc-cafe','bc-entreprise'].forEach(id => {
    document.getElementById(id).checked = false;
  });
  document.getElementById('bien-create-overlay').style.display = 'flex';
}

function initBienCreateModal() {
  document.getElementById('bien-create-close').addEventListener('click', () => {
    document.getElementById('bien-create-overlay').style.display = 'none';
  });
  document.getElementById('bien-create-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('bien-create-overlay'))
      document.getElementById('bien-create-overlay').style.display = 'none';
  });
  document.getElementById('bc-submit').addEventListener('click', submitBienCreate);
}

async function submitBienCreate() {
  const type    = document.getElementById('bc-type').value.trim();
  const article = document.getElementById('bc-article').value.trim();
  const base    = parseInt(document.getElementById('bc-base').value, 10) || 0;
  const frigo   = parseInt(document.getElementById('bc-frigo').value, 10) || 0;
  const titre   = document.getElementById('bc-titre').value.trim()   || null;
  const couleur = document.getElementById('bc-couleur').value.trim() || null;

  if (!type)    return toast('Nom du type requis', 'error');
  if (!article) return toast('Article requis (ex : Le Penthouse)', 'error');

  // Caractéristiques depuis le textarea (une par ligne)
  const caracteristiques = document.getElementById('bc-caract').value
    .split('\n').map(l => l.trim()).filter(Boolean);

  const payload = {
    type, article, titre, couleur, base, frigo,
    caracteristiques,
    modifiable:     document.getElementById('bc-modifiable').checked,
    ordinateur:     document.getElementById('bc-ordinateur').checked,
    cafe:           document.getElementById('bc-cafe').checked,
    entrepriseOnly: document.getElementById('bc-entreprise').checked,
  };

  const btn = document.getElementById('bc-submit');
  btn.disabled = true;
  btn.textContent = '⏳ Création…';

  const res = await api('/biens', { method: 'POST', body: payload });
  btn.disabled = false;
  btn.textContent = '✅ Créer le type';

  if (res?.ok) {
    document.getElementById('bien-create-overlay').style.display = 'none';
    toast(`✅ Type « ${type} » créé`);
    biensSelected = type;
    await loadBiens();
  } else {
    toast(res?.error || 'Erreur lors de la création', 'error');
  }
}

async function loadLogs(append = false) {
  const typeFilter  = document.getElementById('logs-filter-type').value;
  const actorFilter = document.getElementById('logs-filter-actor').value;

  if (!append) logsSkip = 0; // reset si nouveau filtre ou rafraîchissement

  let url = `/logs?limit=${LOGS_LIMIT}&skip=${logsSkip}`;
  if (typeFilter)  url += `&type=${encodeURIComponent(typeFilter)}`;
  if (actorFilter) url += `&actorId=${encodeURIComponent(actorFilter)}`;

  const res = await api(url);
  if (!res) return;

  const { logs, total } = res;
  logsTotal = total;

  // Remplir le filtre agents (une seule fois, au premier chargement sans filtre)
  if (!logsAllActors.length && !typeFilter && !actorFilter) {
    const seenIds = new Set();
    logs.forEach(l => {
      if (l.actorId && l.actorId !== 'web' && !seenIds.has(l.actorId)) {
        seenIds.add(l.actorId);
        logsAllActors.push({ id: l.actorId, name: l.actorName });
      }
    });
    const sel = document.getElementById('logs-filter-actor');
    sel.innerHTML = '<option value="">Tous les agents</option>';
    logsAllActors.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id; opt.textContent = a.name;
      sel.appendChild(opt);
    });
  }

  renderLogsTimeline(logs, append);
  updateLogsLoadMore();
}

function updateLogsLoadMore() {
  const loaded = logsSkip + LOGS_LIMIT;
  const btn    = document.getElementById('btn-logs-more');
  if (!btn) return;
  if (loaded < logsTotal) {
    btn.style.display = '';
    btn.textContent   = `Charger plus (${Math.min(loaded, logsTotal)} / ${logsTotal})`;
  } else {
    btn.style.display = 'none';
  }
}

function renderLogsTimeline(logs, append = false) {
  const timeline = document.getElementById('logs-timeline');
  const empty    = document.getElementById('logs-empty');
  if (!append) timeline.innerHTML = '';

  if (!logs.length && !append) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  // Regrouper par jour
  const groups = {};
  logs.forEach(l => {
    const day = new Date(l.createdAt).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    if (!groups[day]) groups[day] = [];
    groups[day].push(l);
  });

  Object.entries(groups).forEach(([day, entries]) => {
    // Séparateur de date
    const sep = document.createElement('div');
    sep.className = 'logs-day-sep';
    sep.textContent = day.charAt(0).toUpperCase() + day.slice(1);
    timeline.appendChild(sep);

    entries.forEach(l => {
      const item = document.createElement('div');
      item.className = 'logs-item';

      const time = new Date(l.createdAt).toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit',
      });

      const avatarHtml = l.actorPhoto
        ? `<img class="logs-avatar" src="${l.actorPhoto}" alt="" onerror="this.style.display='none'">`
        : `<div class="logs-avatar-ph">${l.actorEmoji || '👤'}</div>`;

      const details = buildLogDetails(l);

      item.innerHTML = `
        <div class="logs-icon">${l.icon ?? '🔔'}</div>
        <div class="logs-body">
          <div class="logs-header">
            <span class="logs-label">${l.label}</span>
            <span class="logs-time">${time}</span>
          </div>
          <div class="logs-actor">
            ${avatarHtml}
            <span>${l.actorName}</span>
          </div>
          ${details ? `<div class="logs-details">${details}</div>` : ''}
        </div>
      `;
      timeline.appendChild(item);
    });
  });
}

// Filtres et rafraîchissement
document.getElementById('logs-filter-type').addEventListener('change',  () => loadLogs(false));
document.getElementById('logs-filter-actor').addEventListener('change', () => loadLogs(false));
document.getElementById('btn-logs-refresh').addEventListener('click',   () => loadLogs(false));
document.getElementById('btn-logs-more')?.addEventListener('click', () => {
  logsSkip += LOGS_LIMIT;
  loadLogs(true);
});

// ── Reprise de bien ───────────────────────────────────────────────────────────

function fmtReprisePrix(n) {
  if (n == null || n === 0) return '—';
  return Math.round(n).toLocaleString('fr-CH').replace(/ |\s/g, "'") + '$';
}

async function loadReprise() {
  const types = await api('/reprise/types');
  if (!types) return;

  // Remplir le select individuel
  const sel = document.getElementById('reprise-type-select');
  sel.innerHTML = '<option value="">— Choisir un type —</option>';
  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value       = t.type;
    opt.textContent = t.type;
    sel.appendChild(opt);
  });

  // Remplir les selects du lot
  const lotSelIds = ['lot-type1-select', 'lot-type2-select', 'lot-type3-select'];
  const lotDefaults = ['— Choisir —', '— Choisir —', '— Aucun —'];
  lotSelIds.forEach((id, i) => {
    const s = document.getElementById(id);
    s.innerHTML = `<option value="">${lotDefaults[i]}</option>`;
    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value       = t.type;
      opt.textContent = t.type;
      s.appendChild(opt);
    });
  });

  // Remplir le tableau récapitulatif
  renderRepriseTypesTable(types);
}

function renderRepriseTypesTable(types) {
  const tbody = document.getElementById('reprise-types-body');
  tbody.innerHTML = '';

  types.forEach(t => {
    const tr = document.createElement('tr');
    const hasData = t.count > 0;
    const fiabiliteHtml = hasData && !t.fiable
      ? `<span title="Moins de 5 ventes — résultat indicatif" style="margin-left:5px;cursor:default;opacity:.7">⚠️</span>`
      : '';
    tr.innerHTML = `
      <td><strong>${escHtml(t.type)}</strong></td>
      <td>${hasData ? `${t.count}${fiabiliteHtml}` : '<span style="color:var(--text-muted)">0</span>'}</td>
      <td>${hasData && t.median ? fmtReprisePrix(t.median) : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td style="color:var(--text-muted);font-size:.8rem">${hasData ? `${fmtReprisePrix(t.min)} / ${fmtReprisePrix(t.max)}` : '—'}</td>
      <td>
        ${hasData
          ? `<button class="btn reprise-estimate-btn" data-type="${escHtml(t.type)}" style="font-size:.75rem;padding:4px 10px;background:var(--bg3);color:var(--text)">Estimer</button>`
          : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Délégation d'événement sur les boutons Estimer
  document.getElementById('reprise-types-body').addEventListener('click', e => {
    const btn = e.target.closest('.reprise-estimate-btn');
    if (!btn) return;
    const type = btn.dataset.type;
    document.getElementById('reprise-type-select').value = type;
    doCalculerReprise(type);
    document.getElementById('reprise-result-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, { once: true }); // once:true évite l'accumulation de listeners à chaque rechargement
}

async function doCalculerReprise(type) {
  if (!type) { toast('Sélectionnez un type de bien', 'error'); return; }

  const stats = await api(`/reprise?type=${encodeURIComponent(type)}`);
  if (!stats) return;

  const card = document.getElementById('reprise-result-card');
  card.style.display = '';

  document.getElementById('reprise-result-title').textContent = `🏠 Reprise — ${type}`;

  // Badge de fiabilité
  const badge = document.getElementById('reprise-fiabilite-badge');
  if (!stats.count && !stats.bundlesExclus) {
    badge.textContent = 'Aucune donnée';
    badge.className   = 'reprise-badge reprise-badge-none';
  } else if (!stats.count && stats.bundlesExclus) {
    badge.textContent = 'Ventes solo introuvables';
    badge.className   = 'reprise-badge reprise-badge-warn';
  } else if (stats.fiable) {
    badge.textContent = `✅ Données fiables (${stats.count} ventes)`;
    badge.className   = 'reprise-badge reprise-badge-ok';
  } else {
    badge.textContent = `⚠️ Données limitées — ${stats.count} vente${stats.count > 1 ? 's' : ''}`;
    badge.className   = 'reprise-badge reprise-badge-warn';
  }

  // Note lots exclus
  let lotNote = document.getElementById('reprise-lot-note');
  if (!lotNote) {
    lotNote = document.createElement('p');
    lotNote.id = 'reprise-lot-note';
    lotNote.style.cssText = 'font-size:.78rem;color:var(--text-muted);margin-top:6px;font-style:italic';
    document.getElementById('reprise-fiabilite-badge').insertAdjacentElement('afterend', lotNote);
  }
  if (stats.bundlesExclus > 0) {
    const n = stats.bundlesExclus;
    lotNote.textContent = `ℹ️ ${n} vente${n > 1 ? 's' : ''} en lot exclue${n > 1 ? 's' : ''} du calcul (prix de lot ≠ prix individuel)`;
    lotNote.style.display = '';
  } else {
    lotNote.style.display = 'none';
  }

  // Stats générales
  document.getElementById('reprise-count').textContent  = stats.count ?? '0';
  document.getElementById('reprise-median').textContent = fmtReprisePrix(stats.mediane);
  document.getElementById('reprise-min').textContent    = fmtReprisePrix(stats.min);
  document.getElementById('reprise-max').textContent    = fmtReprisePrix(stats.max);

  // Paliers de reprise
  const r = stats.reprises;
  document.getElementById('reprise-prudent').textContent   = r ? `≤ ${fmtReprisePrix(r.prudent)}`   : '—';
  document.getElementById('reprise-standard').textContent  = r ? `≤ ${fmtReprisePrix(r.standard)}`  : '—';
  document.getElementById('reprise-optimiste').textContent = r ? `≤ ${fmtReprisePrix(r.optimiste)}` : '—';
}

document.getElementById('btn-reprise-calculer').addEventListener('click', () => {
  doCalculerReprise(document.getElementById('reprise-type-select').value);
});

async function doCalculerRepriseLot() {
  const t1 = document.getElementById('lot-type1-select').value;
  const t2 = document.getElementById('lot-type2-select').value;
  const t3 = document.getElementById('lot-type3-select').value;

  if (!t1 || !t2) { toast('Sélectionnez au moins 2 biens pour le lot', 'error'); return; }
  if (t1 === t2 && !t3) { toast('Les deux biens doivent être différents (ou ajoutez un 3ème)', 'error'); return; }

  const params = new URLSearchParams({ type1: t1, type2: t2 });
  if (t3) params.append('type3', t3);

  const stats = await api(`/reprise/lot?${params}`);
  if (!stats) return;

  const resultDiv = document.getElementById('lot-result');
  resultDiv.style.display = '';

  // Titre
  const label = [t1, t2, t3].filter(Boolean).join(' + ');
  document.getElementById('lot-result-title').textContent = `📦 Lot — ${label}`;

  // Badge fiabilité
  const badge = document.getElementById('lot-fiabilite-badge');
  if (!stats.count) {
    badge.textContent = 'Aucune donnée pour ce lot';
    badge.className   = 'reprise-badge reprise-badge-none';
  } else if (stats.fiable) {
    badge.textContent = `✅ Données fiables (${stats.count} ventes)`;
    badge.className   = 'reprise-badge reprise-badge-ok';
  } else {
    badge.textContent = `⚠️ Données limitées — ${stats.count} vente${stats.count > 1 ? 's' : ''}`;
    badge.className   = 'reprise-badge reprise-badge-warn';
  }

  // Stats
  document.getElementById('lot-count').textContent  = stats.count ?? '0';
  document.getElementById('lot-median').textContent = fmtReprisePrix(stats.mediane);
  document.getElementById('lot-min').textContent    = fmtReprisePrix(stats.min);
  document.getElementById('lot-max').textContent    = fmtReprisePrix(stats.max);

  // Paliers
  const r = stats.reprises;
  document.getElementById('lot-prudent').textContent   = r ? `≤ ${fmtReprisePrix(r.prudent)}`   : '—';
  document.getElementById('lot-standard').textContent  = r ? `≤ ${fmtReprisePrix(r.standard)}`  : '—';
  document.getElementById('lot-optimiste').textContent = r ? `≤ ${fmtReprisePrix(r.optimiste)}` : '—';
}

document.getElementById('btn-lot-calculer').addEventListener('click', () => {
  doCalculerRepriseLot();
});

// ── Sidebar utilisateur ───────────────────────────────────────────────────────

async function initUser() {
  const res = await fetch('/auth/me');
  if (!res.ok) { location.href = '/login.html'; return; }
  currentUser = await res.json();

  document.getElementById('sidebar-user').innerHTML = `
    <img src="${currentUser.avatar}" alt="">
    <div>
      <div class="username">${currentUser.username}</div>
      <a href="/auth/logout" class="logout-link">Déconnexion</a>
    </div>
  `;
}

// ── Init ──────────────────────────────────────────────────────────────────────

(async () => {
  await initUser();
  // Récupérer le guild ID pour les liens Discord
  const cfg = await api('/config');
  if (cfg?.guildId) guildId = cfg.guildId;
  // Connexion SSE — mises à jour temps réel
  initSSE();
  // Listeners statiques (une seule fois)
  initAnnoncesFilters();
  initBienCreateModal();
  // Charger les alertes dès le départ (met les badges sur tous les items de nav)
  loadAlerts();
  loadDashboard();
})();

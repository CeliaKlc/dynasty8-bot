// ─── Dynasty 8 Panel — Frontend ──────────────────────────────────────────────

let currentUser = null;

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
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

async function loadDashboard() {
  const data = await api('/stats');
  if (!data) return;
  document.getElementById('stat-agents').textContent   = data.totalAgents;
  document.getElementById('stat-annonces').textContent = data.totalAnnonces;
  document.getElementById('stat-actives').textContent  = data.annoncesActives;
  document.getElementById('stat-sacs').textContent     = data.totalSacs;
}

// ── Agents ────────────────────────────────────────────────────────────────────

async function loadAgents() {
  const agents = await api('/agents');
  if (!agents) return;

  const grid = document.getElementById('agents-grid');
  grid.innerHTML = '';

  agents.forEach(agent => {
    const card = document.createElement('div');
    card.className = 'agent-card';
    card.dataset.slug = agent.slug;

    const avatarHtml = agent.photo
      ? `<img class="agent-avatar" src="${agent.photo}" alt="${agent.name}" onerror="this.style.display='none'">`
      : `<div class="agent-avatar-placeholder">${agent.emoji || '👤'}</div>`;

    const badgesHtml = (agent.agre || []).map(a => {
      const isLbc = a.includes('LeBonCoin');
      return `<span class="badge ${isLbc ? 'lbc' : ''}">${isLbc ? 'LBC' : a.split(' ')[0]}</span>`;
    }).join('');

    card.innerHTML = `
      ${avatarHtml}
      <div class="agent-name">${agent.emoji || ''} ${agent.name}</div>
      <div class="agent-titre">${agent.titre || ''}</div>
      <div class="agent-badges">${badgesHtml}</div>
    `;

    if (currentUser?.isAdmin) {
      card.addEventListener('click', () => openAgentModal(agent));
    }
    grid.appendChild(card);
  });

  // Bouton ajouter (admin uniquement)
  const btnAdd = document.getElementById('btn-add-agent');
  if (currentUser?.isAdmin) {
    btnAdd.style.display = 'inline-flex';
    btnAdd.onclick = () => openAgentModal(null);
  } else {
    btnAdd.style.display = 'none';
  }
}

// ── Modal agent ───────────────────────────────────────────────────────────────

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
}

document.getElementById('agent-form').addEventListener('submit', async e => {
  e.preventDefault();
  const slugOriginal = document.getElementById('agent-slug-original').value;
  const isNew = !slugOriginal;

  const agre = [];
  if (document.getElementById('agre-lv').checked)  agre.push('Las Venturas');
  if (document.getElementById('agre-cp').checked)  agre.push('Cayo Perico');
  if (document.getElementById('agre-lbc').checked) agre.push('Gestionnaire LeBonCoin');

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

// ── Annonces ──────────────────────────────────────────────────────────────────

async function loadAnnonces() {
  const annonces = await api('/annonces');
  if (!annonces) return;

  const tbody = document.getElementById('annonces-body');
  tbody.innerHTML = '';

  annonces.forEach(a => {
    const tr = document.createElement('tr');
    const vendu = a.vendu === true;
    const date  = a.updatedAt ? new Date(a.updatedAt).toLocaleDateString('fr-FR') : '—';

    tr.innerHTML = `
      <td><strong>${a.numero || '—'}</strong></td>
      <td>
        <span class="status-dot ${vendu ? 'status-sold' : 'status-active'}"></span>
        ${vendu ? 'Vendu' : 'En cours'}
      </td>
      <td>${a.ticketChannelId
        ? `<a href="https://discord.com/channels/${a.ticketChannelId}" target="_blank" style="color:var(--accent)">Voir</a>`
        : '—'}</td>
      <td>${a.announcementChannelId
        ? `<a href="https://discord.com/channels/${a.announcementChannelId}" target="_blank" style="color:var(--accent)">Voir</a>`
        : '—'}</td>
      <td style="color:var(--text-muted)">${date}</td>
    `;
    tbody.appendChild(tr);
  });

  if (annonces.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:32px">Aucune annonce</td></tr>';
  }
}

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
  loadDashboard();
})();

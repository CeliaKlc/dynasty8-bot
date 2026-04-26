// ─── API REST du panel d'administration ──────────────────────────────────────

const { Router } = require('express');
const { getDB }  = require('../../utils/db');
const agentCache = require('../../utils/agentCache');
const { ObjectId } = require('mongodb');
const { DASHBOARD_CATEGORIES } = require('../../utils/attenteManager');

const router = Router();

// ── Middleware : session requise ──────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Non authentifié' });
  next();
}

// ── Middleware : Direction uniquement ─────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (!req.session.user?.isAdmin) return res.status(403).json({ error: 'Accès refusé' });
  next();
}

// ════════════════════════════════════════════════════════════════════════════
// STATS
// ════════════════════════════════════════════════════════════════════════════

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const [totalAnnonces, annoncesActives, totalSacs, totalAgents, parAgent] = await Promise.all([
      db.collection('annonce_links').countDocuments(),
      db.collection('annonce_links').countDocuments({ vendu: { $ne: true } }),
      db.collection('sac_registry').aggregate([
        { $project: { count: { $size: { $ifNull: ['$sacs', []] } } } },
        { $group: { _id: null, total: { $sum: '$count' } } },
      ]).toArray().then(r => r[0]?.total ?? 0),
      db.collection('agents').countDocuments(),
      // Stats par agent : total et actives
      db.collection('annonce_links').aggregate([
        {
          $group: {
            _id:    '$agentId',
            total:  { $sum: 1 },
            actives: { $sum: { $cond: [{ $ne: ['$vendu', true] }, 1, 0] } },
          },
        },
      ]).toArray(),
    ]);

    // Enrichir avec les infos agent du cache
    const agentMap = Object.fromEntries(agentCache.getAll().map(a => [a.id, a]));
    const statsParAgent = parAgent
      .filter(s => s._id)
      .map(s => ({
        agentId: s._id,
        name:    agentMap[s._id]?.name  ?? 'Inconnu',
        emoji:   agentMap[s._id]?.emoji ?? '',
        photo:   agentMap[s._id]?.photo ?? null,
        total:   s.total,
        actives: s.actives,
      }))
      .sort((a, b) => b.total - a.total);

    res.json({ totalAnnonces, annoncesActives, totalSacs, totalAgents, statsParAgent });
  } catch (err) {
    console.error('[API] /stats :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// AGENTS
// ════════════════════════════════════════════════════════════════════════════

// Liste tous les agents
router.get('/agents', requireAuth, async (req, res) => {
  try {
    const agents = await getDB().collection('agents').find({}, { projection: { _id: 0 } }).toArray();
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un agent (Direction uniquement)
router.post('/agents', requireAdmin, async (req, res) => {
  try {
    const { name, id, slug, emoji, feminin, titre, numero, photo, agre, bunker } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'name et slug sont requis' });

    const doc = {
      name,
      id:      id     || null,
      slug:    slug.toLowerCase().replace(/\s+/g, '-'),
      emoji:   emoji  || '',
      feminin: feminin === true || feminin === 'true',
      titre:   titre  || '',
      numero:  numero || '',
      photo:   photo  || null,
      agre:    Array.isArray(agre) ? agre : [],
      bunker:  bunker || null,
    };

    await getDB().collection('agents').insertOne(doc);
    await agentCache.refresh(getDB());
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('[API] POST /agents :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier un agent (Direction uniquement)
router.put('/agents/:slug', requireAdmin, async (req, res) => {
  try {
    const { slug } = req.params;
    const update   = { ...req.body };
    delete update._id;

    if (update.feminin !== undefined) update.feminin = update.feminin === true || update.feminin === 'true';
    if (update.agre && !Array.isArray(update.agre)) update.agre = [update.agre];

    const result = await getDB().collection('agents').updateOne(
      { slug },
      { $set: update },
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Agent introuvable' });

    await agentCache.refresh(getDB());
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] PUT /agents :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un agent (Direction uniquement)
router.delete('/agents/:slug', requireAdmin, async (req, res) => {
  try {
    const result = await getDB().collection('agents').deleteOne({ slug: req.params.slug });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Agent introuvable' });

    await agentCache.refresh(getDB());
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] DELETE /agents :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Recharger le cache manuellement
router.post('/agents/refresh', requireAdmin, async (req, res) => {
  try {
    await agentCache.refresh(getDB());
    res.json({ ok: true, count: agentCache.getAll().length });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// ANNONCES
// ════════════════════════════════════════════════════════════════════════════

router.get('/annonces', requireAuth, async (req, res) => {
  try {
    const annonces = await getDB()
      .collection('annonce_links')
      .find({})
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();

    // Enrichir avec les infos agent du cache
    const agentMap = Object.fromEntries(agentCache.getAll().map(a => [a.id, a]));
    const enriched = annonces.map(a => ({
      ...a,
      id:    a._id.toString(),
      agent: a.agentId ? {
        name:  agentMap[a.agentId]?.name  ?? 'Inconnu',
        emoji: agentMap[a.agentId]?.emoji ?? '',
        photo: agentMap[a.agentId]?.photo ?? null,
      } : null,
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer une annonce
router.delete('/annonces/:id', requireAdmin, async (req, res) => {
  try {
    const result = await getDB().collection('annonce_links').deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Annonce introuvable' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] DELETE /annonces :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// SACS
// ════════════════════════════════════════════════════════════════════════════

const SAC_OPTIONS = [
  { label: 'Sac V1 — Agent',          value: 'Sac V1'    },
  { label: 'Sac V2 — Agent Confirmé', value: 'Sac V2'    },
  { label: 'Sac à dos — Agent LBC',   value: 'Sac à dos' },
  { label: 'Sac V3 — Direction',      value: 'Sac V3'    },
];

// Liste tous les agents avec leur statut sac
router.get('/sacs', requireAuth, async (req, res) => {
  try {
    const entries  = await getDB().collection('sac_registry').find({}).toArray();
    const entryMap = Object.fromEntries(entries.map(e => [e.agentId, e]));

    // Agents connus du cache
    const cacheIds = new Set(agentCache.getAll().map(a => a.id).filter(Boolean));
    const agents   = agentCache.getAll().filter(a => a.id).map(a => ({
      agentId:  a.id,
      name:     a.name,
      emoji:    a.emoji,
      photo:    a.photo,
      sacs:     entryMap[a.id]?.sacs    ?? [],
      statut:   entryMap[a.id]?.statut  ?? 'actif',
      departAt: entryMap[a.id]?.departAt ?? null,
    }));

    // Entrées orphelines : dans sac_registry mais plus dans la collection agents
    // (anciens agents supprimés mais conservés dans l'historique)
    for (const entry of entries) {
      if (!entry.agentId || cacheIds.has(entry.agentId)) continue;
      agents.push({
        agentId:  entry.agentId,
        name:     entry.agentName ?? 'Agent inconnu',
        emoji:    '',
        photo:    null,
        sacs:     entry.sacs    ?? [],
        statut:   entry.statut  ?? 'parti',
        departAt: entry.departAt ?? null,
      });
    }

    res.json({ agents, sacOptions: SAC_OPTIONS });
  } catch (err) {
    console.error('[API] /sacs :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Donner des sacs à un agent
router.put('/sacs/:agentId/donner', requireAdmin, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { sacs }    = req.body; // tableau de valeurs
    if (!Array.isArray(sacs) || sacs.length === 0)
      return res.status(400).json({ error: 'Sacs manquants' });

    const agent = agentCache.getById(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent introuvable' });

    await getDB().collection('sac_registry').updateOne(
      { agentId },
      {
        $set:      { agentName: agent.name, statut: 'actif', updatedAt: new Date() },
        $addToSet: { sacs: { $each: sacs } },
      },
      { upsert: true },
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] PUT /sacs/donner :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Retirer des sacs à un agent
router.put('/sacs/:agentId/retirer', requireAdmin, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { sacs }    = req.body;
    if (!Array.isArray(sacs) || sacs.length === 0)
      return res.status(400).json({ error: 'Sacs manquants' });

    await getDB().collection('sac_registry').updateOne(
      { agentId },
      { $pull: { sacs: { $in: sacs } }, $set: { updatedAt: new Date() } },
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] PUT /sacs/retirer :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Marquer un agent comme parti
router.put('/sacs/:agentId/depart', requireAdmin, async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = agentCache.getById(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent introuvable' });

    await getDB().collection('sac_registry').updateOne(
      { agentId },
      { $set: { agentName: agent.name, statut: 'parti', departAt: new Date(), updatedAt: new Date() } },
      { upsert: true },
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] PUT /sacs/depart :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Réactiver un agent
router.put('/sacs/:agentId/retour', requireAdmin, async (req, res) => {
  try {
    const { agentId } = req.params;
    await getDB().collection('sac_registry').updateOne(
      { agentId },
      { $set: { statut: 'actif', departAt: null, updatedAt: new Date() } },
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] PUT /sacs/retour :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════

// Récupère la config générale (panel users + stats DB)
router.get('/config', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const [panelDoc, agents, annonces, waitingActifs, waitingTotal, sacs] = await Promise.all([
      db.collection('bot_config').findOne({ key: 'panel_users' }),
      db.collection('agents').countDocuments(),
      db.collection('annonce_links').countDocuments(),
      db.collection('waiting_list').countDocuments({ status: { $ne: 'terminé' } }),
      db.collection('waiting_list').countDocuments(),
      db.collection('sac_registry').aggregate([
        { $project: { count: { $size: { $ifNull: ['$sacs', []] } } } },
        { $group: { _id: null, total: { $sum: '$count' } } },
      ]).toArray().then(r => r[0]?.total ?? 0),
    ]);

    res.json({
      panelUsers: panelDoc?.users ?? [],
      dbStats: { agents, annonces, waitingActifs, waitingTotal, sacs },
      guildId: process.env.GUILD_ID ?? null,
    });
  } catch (err) {
    console.error('[API] /config :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajouter un utilisateur au panel
router.post('/config/users', requireAdmin, async (req, res) => {
  try {
    const { discordId, name, isAdmin = false } = req.body;
    if (!discordId || !name) return res.status(400).json({ error: 'discordId et name sont requis' });

    const db  = getDB();
    const doc = await db.collection('bot_config').findOne({ key: 'panel_users' });
    const users = doc?.users ?? [];

    if (users.find(u => u.discordId === discordId))
      return res.status(409).json({ error: 'Cet utilisateur a déjà accès au panel' });

    users.push({ discordId, name, isAdmin: Boolean(isAdmin) });
    await db.collection('bot_config').updateOne(
      { key: 'panel_users' },
      { $set: { users } },
      { upsert: true },
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] POST /config/users :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier le rôle admin d'un utilisateur
router.patch('/config/users/:discordId', requireAdmin, async (req, res) => {
  try {
    const { discordId } = req.params;
    const { isAdmin }   = req.body;

    const db  = getDB();
    const doc = await db.collection('bot_config').findOne({ key: 'panel_users' });
    const users = (doc?.users ?? []).map(u =>
      u.discordId === discordId ? { ...u, isAdmin: Boolean(isAdmin) } : u,
    );
    await db.collection('bot_config').updateOne({ key: 'panel_users' }, { $set: { users } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] PATCH /config/users :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un utilisateur du panel
router.delete('/config/users/:discordId', requireAdmin, async (req, res) => {
  try {
    const { discordId } = req.params;

    // Sécurité : ne pas se supprimer soi-même
    if (req.session.user?.id === discordId)
      return res.status(400).json({ error: 'Vous ne pouvez pas vous supprimer vous-même' });

    const db  = getDB();
    const doc = await db.collection('bot_config').findOne({ key: 'panel_users' });
    const users = (doc?.users ?? []).filter(u => u.discordId !== discordId);
    await db.collection('bot_config').updateOne({ key: 'panel_users' }, { $set: { users } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] DELETE /config/users :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// RENDEZ-VOUS
// ════════════════════════════════════════════════════════════════════════════

router.get('/rdv', requireAuth, async (req, res) => {
  try {
    const db      = getDB();
    const { mode = 'avenir' } = req.query; // avenir | passes | tous
    const now     = new Date().toISOString();

    let query = {};
    if (mode === 'avenir') query = { statut: 'prévu', datetime: { $gt: now } };
    else if (mode === 'passes') query = { $or: [{ statut: 'passé' }, { statut: 'annulé' }, { datetime: { $lte: now } }] };
    // mode === 'tous' : pas de filtre

    const rdvs = await db.collection('rendez_vous')
      .find(query)
      .sort({ datetime: mode === 'passes' ? -1 : 1 })
      .limit(150)
      .toArray();

    const agentMap = Object.fromEntries(agentCache.getAll().map(a => [a.id, a]));

    const enriched = rdvs.map(r => ({
      id:            r.id,
      agentId:       r.agentId,
      agentName:     agentMap[r.agentId]?.name  ?? 'Inconnu',
      agentEmoji:    agentMap[r.agentId]?.emoji ?? '',
      agentPhoto:    agentMap[r.agentId]?.photo ?? null,
      clientId:      r.clientId,
      clientName:    r.clientName ?? null,
      channelId:     r.channelId,
      guildId:       r.guildId   ?? process.env.GUILD_ID ?? null,
      datetime:      r.datetime,
      description:   r.description,
      lieu:          r.lieu      ?? null,
      rappelMinutes: r.rappelMinutes,
      statut:        r.statut,
      createdAt:     r.createdAt,
    }));

    // Résumé par agent (pour les filtres)
    const agentCounts = {};
    enriched.forEach(r => {
      if (!agentCounts[r.agentId]) {
        agentCounts[r.agentId] = {
          agentId: r.agentId,
          name:    r.agentName,
          emoji:   r.agentEmoji,
          photo:   r.agentPhoto,
          count:   0,
        };
      }
      agentCounts[r.agentId].count++;
    });
    const parAgent = Object.values(agentCounts).sort((a, b) => b.count - a.count);

    res.json({ rdvs: enriched, parAgent });
  } catch (err) {
    console.error('[API] /rdv :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Annuler un RDV (Direction uniquement)
router.delete('/rdv/:id', requireAdmin, async (req, res) => {
  try {
    const result = await getDB().collection('rendez_vous').updateOne(
      { id: req.params.id, statut: 'prévu' },
      { $set: { statut: 'annulé' } },
    );
    if (result.matchedCount === 0)
      return res.status(404).json({ error: 'RDV introuvable ou déjà terminé' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] DELETE /rdv :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un RDV depuis le panel web
router.post('/rdv', requireAuth, async (req, res) => {
  try {
    const {
      agentId, date, heure, description,
      clientName, clientId, lieu, rappelMinutes, channelId,
    } = req.body;

    if (!agentId || !date || !heure || !description?.trim())
      return res.status(400).json({ error: 'agentId, date, heure et description sont requis' });

    const agent = agentCache.getById(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent introuvable' });

    const datetime = new Date(`${date}T${heure}:00`).toISOString();
    if (isNaN(new Date(datetime).getTime()))
      return res.status(400).json({ error: 'Date ou heure invalide' });
    if (new Date(datetime) <= new Date())
      return res.status(400).json({ error: 'La date doit être dans le futur' });

    const rdv = {
      id:            `rdv_${Date.now()}`,
      agentId,
      clientId:      clientId?.trim()    || null,
      clientName:    clientName?.trim()  || null,
      channelId:     channelId?.trim()   || agent.bunker || null,
      guildId:       process.env.GUILD_ID ?? null,
      datetime,
      description:   description.trim(),
      lieu:          lieu?.trim()        || null,
      rappelMinutes: Math.max(0, parseInt(rappelMinutes) || 0),
      statut:        'prévu',
      createdAt:     new Date(),
      createdBy:     req.session.user?.id ?? 'web',
    };

    await getDB().collection('rendez_vous').insertOne(rdv);
    res.status(201).json({ ok: true, id: rdv.id });
  } catch (err) {
    console.error('[API] POST /rdv :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// LISTE D'ATTENTE
// ════════════════════════════════════════════════════════════════════════════

router.get('/attente', requireAuth, async (req, res) => {
  try {
    const db      = getDB();
    const clients = await db.collection('waiting_list')
      .find({})
      .sort({ createdAt: 1 })
      .toArray();

    const agentMap = Object.fromEntries(agentCache.getAll().map(a => [a.id, a]));

    const enriched = clients.map(c => ({
      id:          c._id.toString(),
      clientId:    c.clientId,
      clientName:  c.clientName ?? null,
      ticketId:    c.ticketId,
      agentId:     c.agentId,
      agentName:   agentMap[c.agentId]?.name  ?? null,
      agentEmoji:  agentMap[c.agentId]?.emoji ?? '',
      biens:       c.biens  ?? [],
      budget:      c.budget ?? null,
      notes:       c.notes  ?? null,
      status:      c.status,
      createdAt:   c.createdAt,
    }));

    const actifs = enriched.filter(c => c.status !== 'terminé');
    const categories = DASHBOARD_CATEGORIES.map(cat => ({
      key:   cat.key,
      label: cat.label,
      emoji: cat.emoji,
      types: cat.types,
      count: actifs.filter(c => c.biens.some(b => cat.types.includes(b.type))).length,
    }));

    res.json({ clients: enriched, categories });
  } catch (err) {
    console.error('[API] /attente :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Changer le statut d'un client (Direction uniquement)
router.patch('/attente/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;
    if (!['active', 'contacté', 'terminé'].includes(status))
      return res.status(400).json({ error: 'Statut invalide' });

    const result = await getDB().collection('waiting_list').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status } },
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Client introuvable' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] PATCH /attente/status :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un client de la liste d'attente (Direction uniquement)
router.delete('/attente/:id', requireAdmin, async (req, res) => {
  try {
    const result = await getDB().collection('waiting_list').deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Client introuvable' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] DELETE /attente :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// RÉCAP HEBDOMADAIRE
// ════════════════════════════════════════════════════════════════════════════

// Historique des 10 derniers récaps
router.get('/recap', requireAuth, async (req, res) => {
  try {
    const docs = await getDB().collection('recap_hebdo')
      .find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();
    res.json(docs.map(({ _id, ...r }) => r));
  } catch (err) {
    console.error('[API] GET /recap :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer et publier un récap (format /recapsemaine)
router.post('/recap', requireAdmin, async (req, res) => {
  try {
    const {
      canalId,
      cdp, vendeur, loueur,
      arrivees, roles_sup,
      departs, felicitations,
      info, nouveau, avert,
      ca, primes, benef,
      top3Rows,
      fel_1_agent, fel_1_grade,
      fel_2_agent, fel_2_grade,
      fel_3_agent, fel_3_grade,
    } = req.body;

    if (!canalId?.trim())
      return res.status(400).json({ error: 'Salon Discord requis' });

    // Construire le champ "informations" au format INFO:/NOUVEAU:/AVERT:
    const infoLines = [];
    if (info?.trim())    info.trim().split('\n').forEach(l => l.trim() && infoLines.push(`INFO: ${l.trim()}`));
    if (nouveau?.trim()) nouveau.trim().split('\n').forEach(l => l.trim() && infoLines.push(`NOUVEAU: ${l.trim()}`));
    if (avert?.trim())   avert.trim().split('\n').forEach(l => l.trim() && infoLines.push(`AVERT: ${l.trim()}`));
    const informations = infoLines.join('\n');

    // Chiffres au format "CA | Primes | Bénéfices"
    const chiffres = (ca || primes || benef)
      ? `${ca ?? ''} | ${primes ?? ''} | ${benef ?? ''}`
      : '';

    // Top 3 : "count service\n..."
    const top3 = (Array.isArray(top3Rows) ? top3Rows : [])
      .filter(r => r[0] || r[1])
      .map(r => `${r[0] || ''} ${r[1] || ''}`.trim())
      .join('\n');

    const recap = {
      id:            `recap_${Date.now()}`,
      canalId:       canalId.trim(),
      cdp:           cdp     || null,
      vendeur:       vendeur || null,
      loueur:    loueur  || null,
      // Tableau d'arrivées [{agent, grade}, ...]
      arrivees:  Array.isArray(arrivees) ? arrivees.filter(a => a?.agent) : [],
      roles_sup:     Array.isArray(roles_sup) ? roles_sup.filter(id => id?.trim()) : [],
      departs:       departs?.trim()  || '',
      felicitations: felicitations?.trim() || '',
      informations,
      chiffres,
      top3,
      fel_1_agent:   fel_1_agent || null,
      fel_1_grade:   fel_1_grade || null,
      fel_2_agent:   fel_2_agent || null,
      fel_2_grade:   fel_2_grade || null,
      fel_3_agent:   fel_3_agent || null,
      fel_3_grade:   fel_3_grade || null,
      statut:        'a_publier',
      createdAt:     new Date(),
      createdBy:     req.session.user?.id ?? 'web',
    };

    await getDB().collection('recap_hebdo').insertOne(recap);
    res.json({ ok: true, id: recap.id });
  } catch (err) {
    console.error('[API] POST /recap :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

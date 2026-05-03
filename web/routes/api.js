// ─── API REST du panel d'administration ──────────────────────────────────────

const { Router } = require('express');
const { getDB }  = require('../../utils/db');
const agentCache = require('../../utils/agentCache');
const bienCache  = require('../../utils/bienCache');
const { ObjectId } = require('mongodb');
const { DASHBOARD_CATEGORIES }              = require('../../utils/attenteManager');
const { calculerReprise, calculerRepriseLot, calculerRepriseParZone, getResumeTousTypes, ZONES, SEUIL_FIABILITE } = require('../../utils/repriseManager');
const { BIENS }                              = require('../../utils/annonceBuilder');
const { logAction }                          = require('../../utils/actionLogger');
const { addClient, removeClient }            = require('../utils/sse');

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
    const [
      totalAnnonces, totalSacs, totalAgents,
      parAgent,
      // LBC
      lbcVentesTotal, lbcEnCours, lbcCA, lbcParType, lbcParAgent, lbcCommissionEnCours,
    ] = await Promise.all([
      db.collection('annonce_links').countDocuments(),
      db.collection('sac_registry').aggregate([
        { $project: { count: { $size: { $ifNull: ['$sacs', []] } } } },
        { $group: { _id: null, total: { $sum: '$count' } } },
      ]).toArray().then(r => r[0]?.total ?? 0),
      db.collection('agents').countDocuments(),
      // Stats par agent — $lookup annonce_links → ventes_lbc
      // • Groupe par annonce_links.agentId (qui a publié l'annonce, cohérent avec la page Dossiers)
      // • Prend uniquement le recap le plus récent par annonce (gère les doublons historiques ventes_lbc)
      // • Un agent avec 3 annonces ne peut donc jamais afficher plus de 3 "en cours"
      db.collection('annonce_links').aggregate([
        {
          $lookup: {
            from: 'ventes_lbc',
            let:  { num: '$numero' },
            pipeline: [
              { $match: { $expr: { $eq: ['$annonce', '$$num'] } } },
              { $sort: { dateRecap: -1 } },   // recap le plus récent en premier
              { $limit: 1 },                   // un seul statut par annonce
              { $project: { statut: 1 } },
            ],
            as: 'vente',
          },
        },
        {
          $group: {
            _id:     '$agentId',
            total:   { $sum: 1 },
            actives: {
              $sum: {
                $cond: [
                  { $eq: [{ $arrayElemAt: ['$vente.statut', 0] }, 'en_cours'] },
                  1, 0,
                ],
              },
            },
          },
        },
      ]).toArray(),
      // LBC — ventes confirmées
      db.collection('ventes_lbc').countDocuments({ statut: 'vendu' }),
      // LBC — en cours dédupliqué par numéro d'annonce
      // (évite de compter plusieurs fois une même annonce si doublons historiques ventes_lbc)
      db.collection('ventes_lbc').aggregate([
        { $match: { statut: 'en_cours' } },
        { $group: { _id: '$annonce' } },
        { $count: 'total' },
      ]).toArray().then(r => r[0]?.total ?? 0),
      // LBC — CA total + bénéfice total + prix moyen
      db.collection('ventes_lbc').aggregate([
        { $match: { statut: 'vendu', prixFinal: { $gt: 0 } } },
        {
          $group: {
            _id:      null,
            total:    { $sum: '$prixFinal' },
            avg:      { $avg: '$prixFinal' },
            benefice: {
              $sum: {
                $multiply: [
                  '$prixFinal',
                  { $divide: [{ $ifNull: ['$commission', 10] }, 100] },
                ],
              },
            },
          },
        },
      ]).toArray().then(r => r[0] ?? { total: 0, avg: 0, benefice: 0 }),
      // LBC — répartition par type (top 10)
      db.collection('ventes_lbc').aggregate([
        { $match: { statut: 'vendu' } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]).toArray(),
      // LBC — top agents (par nb de ventes + bénéfice)
      db.collection('ventes_lbc').aggregate([
        { $match: { statut: 'vendu' } },
        {
          $group: {
            _id:      '$agentId',
            ventes:   { $sum: 1 },
            ca:       { $sum: '$prixFinal' },
            benefice: {
              $sum: {
                $multiply: [
                  { $ifNull: ['$prixFinal', 0] },
                  { $divide: [{ $ifNull: ['$commission', 10] }, 100] },
                ],
              },
            },
          },
        },
        { $sort: { ventes: -1 } },
        { $limit: 8 },
      ]).toArray(),
      // LBC — commission moyenne par agent sur les dossiers EN COURS
      db.collection('ventes_lbc').aggregate([
        { $match: { statut: 'en_cours', commission: { $gt: 0 } } },
        {
          $group: {
            _id:           '$agentId',
            count:         { $sum: 1 },
            commissionMoy: { $avg: '$commission' },
            prixMoy:       { $avg: '$prixDepart' },
          },
        },
        { $sort: { commissionMoy: -1 } },
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

    const lbcAgentStats = lbcParAgent
      .filter(s => s._id)
      .map(s => ({
        agentId: s._id,
        name:    agentMap[s._id]?.name  ?? 'Inconnu',
        emoji:   agentMap[s._id]?.emoji ?? '',
        photo:   agentMap[s._id]?.photo ?? null,
        ventes:  s.ventes,
        ca:      s.ca,
        benefice: Math.round(s.benefice ?? 0),
      }));

    res.json({
      totalAnnonces,
      annoncesActives: lbcEnCours, // dossiers réellement en cours (ventes_lbc.statut)
      totalSacs, totalAgents, statsParAgent,
      lbc: {
        ventesTotal:    lbcVentesTotal,
        ventesEnCours:  lbcEnCours,
        caTotal:        lbcCA.total,
        prixMoyen:      lbcCA.avg > 0 ? Math.round(lbcCA.avg) : 0,
        beneficeTotal:  Math.round(lbcCA.benefice ?? 0),
        parType:        lbcParType.map(t => ({ type: t._id, count: t.count })),
        parAgent:       lbcAgentStats,
        commissionEnCours: lbcCommissionEnCours
          .filter(s => s._id)
          .map(s => ({
            agentId:       s._id,
            name:          agentMap[s._id]?.name   ?? 'Inconnu',
            emoji:         agentMap[s._id]?.emoji  ?? '',
            photo:         agentMap[s._id]?.photo  ?? null,
            count:         s.count,
            commissionMoy: Math.round(s.commissionMoy * 10) / 10, // 1 décimale
            prixMoy:       s.prixMoy ? Math.round(s.prixMoy) : null,
          })),
      },
    });
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

    const normalizedSlug = slug.toLowerCase().replace(/\s+/g, '-');

    // Vérifier l'unicité du slug et de l'ID Discord avant insertion
    const orConditions = [{ slug: normalizedSlug }];
    if (id) orConditions.push({ id });
    const existing = await getDB().collection('agents').findOne({ $or: orConditions });
    if (existing) {
      const raison = existing.slug === normalizedSlug ? 'Ce slug est déjà utilisé' : 'Cet ID Discord est déjà utilisé par un autre agent';
      return res.status(409).json({ error: raison });
    }

    const doc = {
      name,
      id:      id     || null,
      slug:    normalizedSlug,
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
    await logAction({
      type:      'agent_create',
      actorId:   req.session.user?.id   ?? 'web',
      actorName: req.session.user?.name ?? req.session.user?.username ?? 'Panel web',
      details:   { name: doc.name, slug: doc.slug },
    });
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
    await logAction({
      type:      'agent_update',
      actorId:   req.session.user?.id   ?? 'web',
      actorName: req.session.user?.name ?? req.session.user?.username ?? 'Panel web',
      details:   { slug },
    });
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
    await logAction({
      type:      'agent_delete',
      actorId:   req.session.user?.id   ?? 'web',
      actorName: req.session.user?.name ?? req.session.user?.username ?? 'Panel web',
      details:   { slug: req.params.slug },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] DELETE /agents :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Fiche détaillée d'un agent (ventes, stats, RDV)
router.get('/agents/:id/profil', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const db     = getDB();

    const agent = agentCache.getById(id);
    if (!agent) return res.status(404).json({ error: 'Agent introuvable' });

    const [ventes, rdvs] = await Promise.all([
      db.collection('ventes_lbc').find({ agentId: id }).sort({ dateRecap: -1 }).toArray(),
      db.collection('rendez_vous').find({ agentId: id }).sort({ datetime: -1 }).limit(20).toArray(),
    ]);

    const ventesConfirmees = ventes.filter(v => v.statut === 'vendu' && v.prixFinal > 0);
    const caTotal       = ventesConfirmees.reduce((s, v) => s + (v.prixFinal ?? 0), 0);
    const beneficeTotal = ventesConfirmees.reduce((s, v) => s + (v.prixFinal ?? 0) * ((v.commission ?? 10) / 100), 0);
    const prixMoyen     = ventesConfirmees.length ? Math.round(caTotal / ventesConfirmees.length) : 0;

    res.json({
      agent,
      stats: {
        ventesTotal:    ventesConfirmees.length,
        dossiersEnCours: ventes.filter(v => v.statut === 'en_cours').length,
        caTotal,
        beneficeTotal:  Math.round(beneficeTotal),
        prixMoyen,
        rdvTotal:       rdvs.length,
      },
      ventes: ventes.map(v => ({
        annonce:    v.annonce,
        type:       v.type,
        adresse:    v.adresse,
        zone:       v.zone,
        prixDepart: v.prixDepart,
        prixFinal:  v.prixFinal,
        commission: v.commission,
        benefice:   (v.prixFinal && v.commission) ? Math.round(v.prixFinal * v.commission / 100) : null,
        statut:     v.statut,
        dateRecap:  v.dateRecap,
        dateVente:  v.dateVente,
      })),
      rdv: rdvs.map(r => ({
        id:          r.id,
        datetime:    r.datetime,
        description: r.description,
        clientName:  r.clientName ?? null,
        lieu:        r.lieu       ?? null,
        statut:      r.statut,
      })),
    });
  } catch (err) {
    console.error('[API] GET /agents/:id/profil :', err);
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
    const db = getDB();

    // Récupère toutes les annonces (augmenté à 100)
    const annonces = await db.collection('annonce_links')
      .find({})
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray();

    // Joint les ventes_lbc par numéro d'annonce (plus fiable que ticketChannelId pour les multi-récaps)
    const numeros = annonces.map(a => a.numero).filter(Boolean);
    const ventes  = await db.collection('ventes_lbc')
      .find({ annonce: { $in: numeros } })
      .sort({ dateRecap: -1 })
      .toArray();

    // numero → vente la plus récente
    const venteMap = {};
    ventes.forEach(v => {
      if (v.annonce && !venteMap[v.annonce]) venteMap[v.annonce] = v;
    });

    const agentMap = Object.fromEntries(agentCache.getAll().map(a => [a.id, a]));
    const now      = new Date();

    const enriched = annonces.map(a => {
      const vente    = a.numero ? (venteMap[a.numero] ?? null) : null;
      // Agent : depuis annonce_links d'abord, sinon depuis ventes_lbc
      const agentId  = a.agentId ?? vente?.agentId ?? null;
      const agent    = agentId ? agentMap[agentId] : null;

      // Statut consolidé
      const statutDossier = vente?.statut ?? (a.vendu === true ? 'vendu' : null);

      // Jours depuis l'ouverture du dossier
      const dateRef    = vente?.dateRecap ? new Date(vente.dateRecap) : (a.updatedAt ? new Date(a.updatedAt) : null);
      const joursOuverts = dateRef ? Math.floor((now - dateRef) / 86_400_000) : null;
      const retard       = statutDossier === 'en_cours' && joursOuverts != null && joursOuverts >= 7;

      return {
        id:                    a._id.toString(),
        numero:                a.numero                ?? null,
        ticketChannelId:       a.ticketChannelId       ?? null,
        announcementChannelId: a.announcementChannelId ?? null,
        updatedAt:             a.updatedAt             ?? null,
        agent: agent ? { id: agent.id, name: agent.name, emoji: agent.emoji, photo: agent.photo } : null,
        vente: vente ? {
          type:       vente.type      ?? null,
          zone:       vente.zone      ?? null,
          adresse:    vente.adresse   ?? null,
          etage:      vente.etage     ?? null,
          prixDepart: vente.prixDepart ?? null,
          prixFinal:  vente.prixFinal  ?? null,
          statut:     vente.statut,
          dateRecap:  vente.dateRecap  ?? null,
          dateVente:  vente.dateVente  ?? null,
        } : null,
        statutDossier,
        joursOuverts,
        retard,
        cles: a.cles ?? false,
      };
    });

    // Tri par numéro d'annonce croissant (1396 avant 1401)
    enriched.sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0));

    res.json(enriched);
  } catch (err) {
    console.error('[API] /annonces :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Changer l'agent d'une annonce (et de la vente associée)
router.patch('/annonces/:id/agent', requireAdmin, async (req, res) => {
  try {
    const { agentId } = req.body;
    if (!agentId) return res.status(400).json({ error: 'agentId requis' });

    const db      = getDB();
    const annonce = await db.collection('annonce_links').findOne({ _id: new ObjectId(req.params.id) });
    if (!annonce) return res.status(404).json({ error: 'Annonce introuvable' });

    // Mettre à jour dans annonce_links ET dans ventes_lbc
    await db.collection('annonce_links').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { agentId, updatedAt: new Date() } },
    );
    if (annonce.numero) {
      await db.collection('ventes_lbc').updateMany(
        { annonce: annonce.numero },
        { $set: { agentId } },
      );
    }

    const agent = agentCache.getById(agentId);
    await logAction({
      type:      'agent_change',
      actorId:   req.session.user?.id   ?? 'web',
      actorName: req.session.user?.name ?? req.session.user?.username ?? 'Panel web',
      details:   { numero: annonce.numero, nouvelAgent: agent?.name ?? agentId },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[API] PATCH /annonces/:id/agent :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour le statut des clés d'une annonce
router.patch('/annonces/:id/cles', requireAuth, async (req, res) => {
  try {
    const { cles } = req.body;
    const result = await getDB().collection('annonce_links').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { cles: !!cles, updatedAt: new Date() } },
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Annonce introuvable' });
    res.json({ ok: true, cles: !!cles });
  } catch (err) {
    console.error('[API] PATCH /annonces/:id/cles :', err);
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

// Marquer une annonce comme vendue depuis le panel (équivalent de /vendu Discord)
router.post('/annonces/vendu', requireAuth, async (req, res) => {
  try {
    const { annonce, prix } = req.body;
    if (!annonce) return res.status(400).json({ error: 'Numéro d\'annonce requis' });

    const db    = getDB();
    const vente = await db.collection('ventes_lbc').findOne({ annonce: String(annonce), statut: 'en_cours' });

    if (!vente) {
      const existante = await db.collection('ventes_lbc').findOne({ annonce: String(annonce) });
      if (existante?.statut === 'vendu') return res.status(409).json({ error: 'Cette annonce est déjà marquée comme vendue' });
      return res.status(404).json({ error: 'Aucune annonce en cours trouvée pour ce numéro' });
    }

    const prixSaisi = prix ? parseInt(String(prix).replace(/[$'\s,.]/g, ''), 10) || null : null;
    const prixFinal = prixSaisi ?? vente.prixDepart;

    await db.collection('ventes_lbc').updateOne(
      { _id: vente._id },
      { $set: { prixFinal, statut: 'vendu', dateVente: new Date() } },
    );

    await logAction({
      type:      'vente_cloture',
      actorId:   req.session.user?.id   ?? 'web',
      actorName: req.session.user?.name ?? req.session.user?.username ?? 'Panel web',
      details:   { annonce: vente.annonce, type: vente.type, adresse: vente.adresse, prixFinal, prixDepart: vente.prixDepart, via: 'panel' },
    });

    res.json({ ok: true, prixFinal });
  } catch (err) {
    console.error('[API] POST /annonces/vendu :', err);
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
    await logAction({
      type:      'sac_donner',
      actorId:   req.session.user?.id   ?? 'web',
      actorName: req.session.user?.name ?? req.session.user?.username ?? 'Panel web',
      details:   { agentId, agentName: agent.name, sacs },
    });
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
    const agent = agentCache.getById(agentId);
    await logAction({
      type:      'sac_retirer',
      actorId:   req.session.user?.id   ?? 'web',
      actorName: req.session.user?.name ?? req.session.user?.username ?? 'Panel web',
      details:   { agentId, agentName: agent?.name ?? 'Inconnu', sacs },
    });
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
      clientName:  c.clientName  ?? null,
      prenom:      c.prenom      ?? null,
      nom:         c.nom         ?? null,
      telephone:   c.telephone   ?? null,
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

// Modifier un récap existant
router.put('/recap/:id', requireAdmin, async (req, res) => {
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

    const infoLines = [];
    if (info?.trim())    info.trim().split('\n').forEach(l => l.trim() && infoLines.push(`INFO: ${l.trim()}`));
    if (nouveau?.trim()) nouveau.trim().split('\n').forEach(l => l.trim() && infoLines.push(`NOUVEAU: ${l.trim()}`));
    if (avert?.trim())   avert.trim().split('\n').forEach(l => l.trim() && infoLines.push(`AVERT: ${l.trim()}`));
    const informations = infoLines.join('\n');

    const chiffres = (ca || primes || benef)
      ? `${ca ?? ''} | ${primes ?? ''} | ${benef ?? ''}`
      : '';

    const top3 = (Array.isArray(top3Rows) ? top3Rows : [])
      .filter(r => r[0] || r[1])
      .map(r => `${r[0] || ''} ${r[1] || ''}`.trim())
      .join('\n');

    const update = {
      canalId:       canalId?.trim() ?? '',
      cdp:           cdp     || null,
      vendeur:       vendeur || null,
      loueur:        loueur  || null,
      arrivees:      Array.isArray(arrivees)  ? arrivees.filter(a => a?.agent) : [],
      roles_sup:     Array.isArray(roles_sup) ? roles_sup.filter(id => id?.trim()) : [],
      departs:       departs?.trim()       || '',
      felicitations: felicitations?.trim() || '',
      informations,
      chiffres,
      top3,
      fel_1_agent: fel_1_agent || null, fel_1_grade: fel_1_grade || null,
      fel_2_agent: fel_2_agent || null, fel_2_grade: fel_2_grade || null,
      fel_3_agent: fel_3_agent || null, fel_3_grade: fel_3_grade || null,
      updatedAt: new Date(),
    };

    const result = await getDB().collection('recap_hebdo').updateOne(
      { id: req.params.id },
      { $set: update },
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Récap introuvable' });

    // Déclencher la mise à jour du message Discord si déjà publié
    const existing = await getDB().collection('recap_hebdo').findOne({ id: req.params.id });
    if (existing?.messageId) {
      await getDB().collection('bot_commands').insertOne({
        type:      'editer_recap',
        recapId:   req.params.id,
        createdAt: new Date(),
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[API] PUT /recap :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un récap
router.delete('/recap/:id', requireAdmin, async (req, res) => {
  try {
    const result = await getDB().collection('recap_hebdo').deleteOne({ id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Récap introuvable' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] DELETE /recap :', err);
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

// ════════════════════════════════════════════════════════════════════════════
// ALERTES
// ════════════════════════════════════════════════════════════════════════════

router.get('/alerts', requireAuth, async (req, res) => {
  try {
    const db  = getDB();
    const now = new Date();

    const cutoff7j  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);

    // Bornes du jour courant (UTC) — les RDV sont stockés en ISO string UTC
    const todayStr  = now.toISOString().slice(0, 10); // "2025-04-26"
    const todayStart = new Date(`${todayStr}T00:00:00.000Z`);
    const todayEnd   = new Date(`${todayStr}T23:59:59.999Z`);

    const [
      dossiersLbcCount,
      rdvAujourdhui,
    ] = await Promise.all([
      // Dossiers LBC en cours depuis +7 jours
      db.collection('ventes_lbc').countDocuments({
        statut:    'en_cours',
        dateRecap: { $exists: true, $lt: cutoff7j },
      }),
      // RDV prévus aujourd'hui (comparaison sur Date objects, pas strings)
      db.collection('rendez_vous')
        .find({ statut: 'prévu', datetime: { $gte: todayStart.toISOString(), $lte: todayEnd.toISOString() } })
        .toArray(),
    ]);

    const agentMap = Object.fromEntries(agentCache.getAll().map(a => [a.id, a]));

    const alerts = [];

    if (dossiersLbcCount > 0) {
      alerts.push({
        id:    'dossiers_lbc',
        level: 'warning',
        icon:  '📋',
        count: dossiersLbcCount,
        label: `dossier${dossiersLbcCount > 1 ? 's' : ''} LBC ouvert${dossiersLbcCount > 1 ? 's' : ''} depuis plus de 7 jours sans clôture`,
        page:  'annonces',
      });
    }

    if (rdvAujourdhui.length > 0) {
      alerts.push({
        id:    'rdv_today',
        level: 'info',
        icon:  '📅',
        count: rdvAujourdhui.length,
        label: `rendez-vous aujourd'hui`,
        page:  'rdv',
        items: rdvAujourdhui.slice(0, 5).map(r => ({
          datetime:    r.datetime,
          description: r.description,
          clientName:  r.clientName ?? null,
          agentName:   agentMap[r.agentId]?.name  ?? 'Inconnu',
          agentEmoji:  agentMap[r.agentId]?.emoji ?? '',
        })),
      });
    }

    res.json({
      alerts,
      urgentCount: alerts
        .filter(a => a.level === 'danger')
        .reduce((s, a) => s + a.count, 0),
    });
  } catch (err) {
    console.error('[API] GET /alerts :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// HISTORIQUE DES ACTIONS
// ════════════════════════════════════════════════════════════════════════════

router.get('/logs', requireAuth, async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit)  || 50, 100);
    const skip   = Math.max(parseInt(req.query.skip)   || 0,   0);
    const { type, actorId } = req.query;

    const query = {};
    if (type)    query.type    = type;
    if (actorId) query.actorId = actorId;

    const db = getDB();
    const [logs, total] = await Promise.all([
      db.collection('action_logs')
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('action_logs').countDocuments(query),
    ]);

    const agentMap = Object.fromEntries(agentCache.getAll().map(a => [a.id, a]));

    const enriched = logs.map(l => ({
      id:         l._id.toString(),
      type:       l.type,
      icon:       l.icon,
      label:      l.label,
      actorId:    l.actorId,
      actorName:  l.actorName,
      actorEmoji: agentMap[l.actorId]?.emoji ?? '',
      actorPhoto: agentMap[l.actorId]?.photo ?? null,
      details:    l.details,
      createdAt:  l.createdAt,
    }));

    res.json({ logs: enriched, total, skip, limit });
  } catch (err) {
    console.error('[API] GET /logs :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// REPRISE DE BIEN
// ════════════════════════════════════════════════════════════════════════════

// Résumé par type (utilise $avg comme approximation de la médiane)
router.get('/reprise/types', requireAuth, async (req, res) => {
  try {
    const types     = Object.keys({ ...BIENS, ...bienCache.getAll() });
    const summaries = await getResumeTousTypes();
    const map       = Object.fromEntries(summaries.map(s => [s._id, s]));

    const result = types.map(type => {
      const s = map[type];
      if (!s) return { type, count: 0, fiable: false, median: null, min: null, max: null };
      return { type, count: s.count, fiable: s.count >= SEUIL_FIABILITE, median: Math.round(s.median), min: s.min, max: s.max };
    });

    res.json(result);
  } catch (err) {
    console.error('[API] GET /reprise/types :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Estimation complète (médiane exacte + 3 paliers) pour un type donné
// Query params : type (requis), zone (optionnel — filtre par zone)
router.get('/reprise', requireAuth, async (req, res) => {
  try {
    const { type, zone } = req.query;
    if (!type) return res.status(400).json({ error: 'Paramètre type requis' });

    const stats = await calculerReprise(type, zone || null);
    if (!stats)  return res.json({ count: 0 });

    res.json(stats);
  } catch (err) {
    console.error('[API] GET /reprise :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Breakdown par zone pour un type donné
// Query params : type (requis)
router.get('/reprise/zones', requireAuth, async (req, res) => {
  try {
    const { type } = req.query;
    if (!type) return res.status(400).json({ error: 'Paramètre type requis' });

    const parZone = await calculerRepriseParZone(type);
    res.json({ zones: ZONES, data: parZone });
  } catch (err) {
    console.error('[API] GET /reprise/zones :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Estimation d'un lot (2 ou 3 biens vendus ensemble)
// Query params : type1, type2, type3 (au moins 2), zone (optionnel)
router.get('/reprise/lot', requireAuth, async (req, res) => {
  try {
    const types = [req.query.type1, req.query.type2, req.query.type3].filter(Boolean);
    if (types.length < 2) return res.status(400).json({ error: 'Au moins 2 types requis' });
    const stats = await calculerRepriseLot(types, req.query.zone || null);
    if (!stats) return res.json({ count: 0 });
    res.json(stats);
  } catch (err) {
    console.error('[API] GET /reprise/lot :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// RECHERCHE GLOBALE
// ════════════════════════════════════════════════════════════════════════════

router.get('/search', requireAuth, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ agents: [], annonces: [], attente: [], rdv: [] });

  try {
    const db      = getDB();
    const regex   = { $regex: q, $options: 'i' };
    const LIMIT   = 5;
    const agentMap = Object.fromEntries(agentCache.getAll().map(a => [a.id, a]));

    // Recherche agents directement dans le cache (plus rapide)
    const agentsRaw = agentCache.getAll().filter(a =>
      [a.name, a.titre].some(v => v && new RegExp(q, 'i').test(v)),
    ).slice(0, LIMIT);

    const [annoncesRaw, attenteRaw, rdvRaw] = await Promise.all([
      db.collection('annonce_links').find({
        $or: [{ numero: regex }, { adresse: regex }, { type: regex }],
      }).limit(LIMIT).toArray(),

      db.collection('waiting_list').find({
        $or: [{ prenom: regex }, { nom: regex }, { telephone: regex }, { clientName: regex }, { notes: regex }],
      }).limit(LIMIT).toArray(),

      db.collection('rendez_vous').find({
        statut: 'prévu',
        $or: [{ description: regex }, { lieu: regex }],
      }).sort({ datetime: 1 }).limit(LIMIT).toArray(),
    ]);

    res.json({
      agents: agentsRaw.map(a => ({
        type:     'agent',
        title:    a.name,
        subtitle: a.titre ?? '',
        emoji:    a.emoji ?? '👤',
        photo:    a.photo ?? null,
        page:     'agents',
      })),

      annonces: annoncesRaw.map(a => ({
        type:      'annonce',
        title:     `#${a.numero} — ${a.type}`,
        subtitle:  a.adresse ?? '',
        agentName: agentMap[a.agentId]?.name ?? null,
        agentEmoji:agentMap[a.agentId]?.emoji ?? '',
        page:      'annonces',
      })),

      attente: attenteRaw.map(c => ({
        type:     'attente',
        title:    [c.prenom, c.nom].filter(Boolean).join(' ') || c.clientName || `Client ${c.clientId}`,
        subtitle: c.biens?.map(b => b.type).slice(0, 2).join(', ') ?? '',
        status:   c.status,
        page:     'attente',
      })),

      rdv: rdvRaw.map(r => ({
        type:      'rdv',
        title:     r.description,
        subtitle:  new Date(r.datetime).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        agentName: agentMap[r.agentId]?.name  ?? '',
        agentEmoji:agentMap[r.agentId]?.emoji ?? '',
        lieu:      r.lieu ?? null,
        page:      'rdv',
      })),
    });
  } catch (err) {
    console.error('[API] GET /search :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// TYPES DE BIENS — édition via panel
// ════════════════════════════════════════════════════════════════════════════

// Liste complète : types prédéfinis (ordre BIENS) + types custom ajoutés depuis le panel
router.get('/biens', requireAuth, (req, res) => {
  const all = bienCache.getAll();
  // Types prédéfinis dans l'ordre hardcodé
  const baseTypes   = Object.keys(BIENS);
  // Types custom présents en base mais absents de BIENS
  const customTypes = Object.keys(all).filter(t => !BIENS[t]);

  const result = [
    ...baseTypes.map(type => ({
      type,
      custom: false,
      ...(all[type] ?? BIENS[type] ?? {}),
    })),
    ...customTypes.map(type => ({
      type,
      custom: true,
      ...all[type],
    })),
  ];
  res.json(result);
});

// Création d'un nouveau type custom
router.post('/biens', requireAdmin, async (req, res) => {
  const { type, article, titre, base, frigo, caracteristiques, modifiable, ordinateur, cafe, entrepriseOnly, couleur } = req.body;

  const typeName = String(type || '').trim();
  if (!typeName) return res.status(400).json({ error: 'Nom du type requis' });
  if (typeof base !== 'number' || base < 0) return res.status(400).json({ error: 'base doit être un entier positif' });

  // Unicité : ni dans les prédéfinis ni déjà en base
  if (BIENS[typeName]) return res.status(409).json({ error: 'Ce nom correspond à un type prédéfini' });
  const existing = await getDB().collection('bien_types').findOne({ type: typeName });
  if (existing) return res.status(409).json({ error: 'Ce type existe déjà' });

  const doc = {
    type:             typeName,
    article:          String(article || '').trim() || typeName,
    titre:            titre ? String(titre).trim() : null,
    base:             Math.round(base),
    frigo:            typeof frigo === 'number' ? Math.round(frigo) : 0,
    caracteristiques: Array.isArray(caracteristiques)
      ? caracteristiques.map(c => String(c).trim()).filter(Boolean)
      : [],
    modifiable:       Boolean(modifiable),
    ordinateur:       Boolean(ordinateur),
    cafe:             Boolean(cafe),
    entrepriseOnly:   Boolean(entrepriseOnly),
    couleur:          couleur ? String(couleur).trim() : null,
    custom:           true,
  };

  try {
    await getDB().collection('bien_types').insertOne(doc);
    await bienCache.refresh(getDB());
    await logAction({ type: 'bien_create', actor: req.session.user.name, details: `Type « ${typeName} » créé` });
    res.json({ ok: true, type: typeName });
  } catch (err) {
    console.error('[API] POST /biens :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mise à jour d'un type (prédéfini ou custom)
router.put('/biens/:type', requireAdmin, async (req, res) => {
  const type      = decodeURIComponent(req.params.type);
  const isBuiltin = Boolean(BIENS[type]);
  const isCustom  = Boolean(bienCache.get(type)?.custom);

  if (!isBuiltin && !isCustom) return res.status(404).json({ error: 'Type de bien inconnu' });

  const { article, titre, base, frigo, caracteristiques, modifiable, ordinateur, cafe, entrepriseOnly, couleur } = req.body;

  if (typeof base !== 'number' || base < 0) return res.status(400).json({ error: 'base doit être un entier positif' });
  if (!Array.isArray(caracteristiques)) return res.status(400).json({ error: 'caracteristiques doit être un tableau' });

  const fallback = BIENS[type] ?? {};
  const update = {
    article:          String(article  || '').trim() || fallback.article || type,
    titre:            titre ? String(titre).trim() : (fallback.titre ?? null),
    base:             Math.round(base),
    frigo:            typeof frigo === 'number' ? Math.round(frigo) : 0,
    caracteristiques: caracteristiques.map(c => String(c).trim()).filter(Boolean),
    modifiable:       Boolean(modifiable),
    ordinateur:       Boolean(ordinateur),
    cafe:             Boolean(cafe),
    entrepriseOnly:   Boolean(entrepriseOnly),
    couleur:          couleur ? String(couleur).trim() : (fallback.couleur ?? null),
    // Conserver le flag custom si présent
    ...(isCustom ? { custom: true } : {}),
  };

  try {
    await getDB().collection('bien_types').updateOne(
      { type },
      { $set: { type, ...update } },
      { upsert: true },
    );
    await bienCache.refresh(getDB());
    await logAction({ type: 'bien_update', actor: req.session.user.name, details: `Type « ${type} » modifié` });
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] PUT /biens/:type :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Suppression d'un type custom uniquement (les prédéfinis sont protégés)
router.delete('/biens/:type', requireAdmin, async (req, res) => {
  const type = decodeURIComponent(req.params.type);

  if (BIENS[type]) return res.status(403).json({ error: 'Impossible de supprimer un type prédéfini' });

  try {
    const result = await getDB().collection('bien_types').deleteOne({ type, custom: true });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Type non trouvé ou non supprimable' });

    await bienCache.refresh(getDB());
    await logAction({ type: 'bien_delete', actor: req.session.user.name, details: `Type « ${type} » supprimé` });
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] DELETE /biens/:type :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// SERVER-SENT EVENTS — mises à jour temps réel
// ════════════════════════════════════════════════════════════════════════════

router.get('/events', requireAuth, (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // désactive le buffering nginx si présent
  res.flushHeaders();

  // Confirmation de connexion
  res.write('event: connected\ndata: {}\n\n');

  addClient(res);

  // Heartbeat toutes les 25s pour maintenir la connexion ouverte
  const heartbeat = setInterval(() => {
    try {
      res.write('event: ping\ndata: {}\n\n');
    } catch {
      clearInterval(heartbeat);
      removeClient(res);
    }
  }, 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(res);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CATALOGUE
// ════════════════════════════════════════════════════════════════════════════

// Récupérer toutes les catégories avec leurs fiches
router.get('/catalogue', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const categories = await db.collection('catalogue_categories')
      .find({}).sort({ ordre: 1 }).toArray();

    const result = await Promise.all(categories.map(async cat => {
      const fiches = await db.collection('catalogue_fiches')
        .find({ categorieId: cat._id }).sort({ ordre: 1 }).toArray();
      return { ...cat, fiches };
    }));

    res.json(result);
  } catch (err) {
    console.error('[API] GET /catalogue :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer une catégorie
router.post('/catalogue/categorie', requireAdmin, async (req, res) => {
  try {
    const { label, type, channelId, intro, ordre } = req.body;
    if (!label || !type || !channelId) return res.status(400).json({ error: 'Champs manquants' });

    const db = getDB();
    const maxOrdre = await db.collection('catalogue_categories')
      .find({ type }).sort({ ordre: -1 }).limit(1).toArray();
    const nextOrdre = ordre ?? ((maxOrdre[0]?.ordre ?? 0) + 1);

    const result = await db.collection('catalogue_categories').insertOne({
      label, type, channelId,
      intro: intro || '',
      ordre: nextOrdre,
      messageId: null,
    });
    res.json({ ok: true, id: result.insertedId });
  } catch (err) {
    console.error('[API] POST /catalogue/categorie :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier une catégorie
router.put('/catalogue/categorie/:id', requireAdmin, async (req, res) => {
  try {
    const { label, channelId, intro, ordre } = req.body;
    const db = getDB();
    const update = {};
    if (label     !== undefined) update.label     = label;
    if (channelId !== undefined) update.channelId = channelId;
    if (intro     !== undefined) update.intro     = intro;
    if (ordre     !== undefined) update.ordre     = Number(ordre);

    await db.collection('catalogue_categories').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: update },
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] PUT /catalogue/categorie :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer une catégorie et ses fiches
router.delete('/catalogue/categorie/:id', requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    const catId = new ObjectId(req.params.id);
    await db.collection('catalogue_fiches').deleteMany({ categorieId: catId });
    await db.collection('catalogue_categories').deleteOne({ _id: catId });
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] DELETE /catalogue/categorie :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer une fiche
router.post('/catalogue/fiche', requireAdmin, async (req, res) => {
  try {
    const { categorieId, nom, imageUrl, prixMin, prixMax, prixLocation, statut } = req.body;
    if (!categorieId || !nom || !imageUrl) return res.status(400).json({ error: 'Champs manquants' });

    const db = getDB();
    const catObjId = new ObjectId(categorieId);
    const maxOrdre = await db.collection('catalogue_fiches')
      .find({ categorieId: catObjId }).sort({ ordre: -1 }).limit(1).toArray();
    const nextOrdre = (maxOrdre[0]?.ordre ?? 0) + 1;

    const result = await db.collection('catalogue_fiches').insertOne({
      categorieId: catObjId,
      nom,
      imageUrl,
      prixMin:      prixMin      ? Number(prixMin)      : null,
      prixMax:      prixMax      ? Number(prixMax)      : null,
      prixLocation: prixLocation ? Number(prixLocation) : null,
      statut:       statut ?? 'disponible',
      ordre:        nextOrdre,
      messageId:    null,
      updatedAt:    new Date(),
    });
    res.json({ ok: true, id: result.insertedId });
  } catch (err) {
    console.error('[API] POST /catalogue/fiche :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier une fiche (statut, prix, etc.)
router.put('/catalogue/fiche/:id', requireAdmin, async (req, res) => {
  try {
    const { nom, imageUrl, prixMin, prixMax, prixLocation, statut, ordre } = req.body;
    const db     = getDB();
    const update = { updatedAt: new Date() };

    if (nom          !== undefined) update.nom          = nom;
    if (imageUrl     !== undefined) update.imageUrl     = imageUrl;
    if (statut       !== undefined) update.statut       = statut;
    if (ordre        !== undefined) update.ordre        = Number(ordre);
    if (prixMin      !== undefined) update.prixMin      = prixMin      ? Number(prixMin)      : null;
    if (prixMax      !== undefined) update.prixMax      = prixMax      ? Number(prixMax)      : null;
    if (prixLocation !== undefined) update.prixLocation = prixLocation ? Number(prixLocation) : null;

    await db.collection('catalogue_fiches').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: update },
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] PUT /catalogue/fiche :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer une fiche
router.delete('/catalogue/fiche/:id', requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    await db.collection('catalogue_fiches').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] DELETE /catalogue/fiche :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Republier une catégorie (envoie une commande au bot via bot_commands)
router.post('/catalogue/categorie/:id/republier', requireAdmin, async (req, res) => {
  try {
    await getDB().collection('bot_commands').insertOne({
      type:        'republier_categorie',
      categorieId: req.params.id,
      createdAt:   new Date(),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] POST /catalogue/categorie/:id/republier :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Republier tout le catalogue
router.post('/catalogue/republier', requireAdmin, async (req, res) => {
  try {
    await getDB().collection('bot_commands').insertOne({
      type:      'republier_tout',
      createdAt: new Date(),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] POST /catalogue/republier :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


module.exports = router;

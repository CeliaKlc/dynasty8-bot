// ─── API REST du panel d'administration ──────────────────────────────────────

const { Router } = require('express');
const { getDB }  = require('../../utils/db');
const agentCache = require('../../utils/agentCache');
const { ObjectId } = require('mongodb');

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
    const [totalAnnonces, annoncesActives, totalSacs, totalAgents] = await Promise.all([
      db.collection('annonce_links').countDocuments(),
      db.collection('annonce_links').countDocuments({ vendu: { $ne: true } }),
      db.collection('sac_registry').countDocuments(),
      db.collection('agents').countDocuments(),
    ]);
    res.json({ totalAnnonces, annoncesActives, totalSacs, totalAgents });
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
    res.json(annonces);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

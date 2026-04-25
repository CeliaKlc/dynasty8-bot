// ─── Cache mémoire des agents ────────────────────────────────────────────────
// Chargé depuis MongoDB au démarrage (seedé depuis annonceBuilder.js si vide).
// Le web panel fait ses CRUD dans MongoDB ; appelez refresh() pour recharger.

const { AGENTS: SEED_AGENTS } = require('./annonceBuilder');

let _cache = [];

/**
 * Initialise le cache : seed MongoDB si vide, puis charge en mémoire.
 * À appeler UNE FOIS au démarrage, après connectDB() et avant loadCommands().
 */
async function init(db) {
  try {
    const col = db.collection('agents');
    const count = await col.countDocuments();

    if (count === 0) {
      // Premier démarrage : on insère les agents hardcodés
      const docs = SEED_AGENTS.map(a => ({ ...a }));
      await col.insertMany(docs);
      console.log(`[AgentCache] Seed : ${docs.length} agents insérés en base`);
    }

    _cache = await col.find({}, { projection: { _id: 0 } }).toArray();
    console.log(`[AgentCache] ${_cache.length} agents chargés`);
  } catch (err) {
    console.error('[AgentCache] Erreur init, fallback sur données locales :', err.message);
    _cache = [...SEED_AGENTS];
  }
}

/** Recharge le cache depuis MongoDB (après modification web panel). */
async function refresh(db) {
  try {
    _cache = await db.collection('agents').find({}, { projection: { _id: 0 } }).toArray();
    console.log(`[AgentCache] Cache rechargé : ${_cache.length} agents`);
  } catch (err) {
    console.error('[AgentCache] Erreur refresh :', err.message);
  }
}

/** Retourne tous les agents (synchrone). */
function getAll() { return _cache; }

/** Retourne un agent par son Discord ID, ou null. */
function getById(id) { return _cache.find(a => a.id === id) ?? null; }

/** Retourne un agent par son slug, ou null. */
function getBySlug(slug) { return _cache.find(a => a.slug === slug) ?? null; }

module.exports = { init, refresh, getAll, getById, getBySlug };

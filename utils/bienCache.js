// ─── Cache mémoire des types de biens (collection bien_types) ─────────────────
// Même pattern qu'agentCache : initialisé au démarrage, rechargé sur changement.
// buildAnnonceContent l'utilise pour que les modifs du panel soient immédiatement
// reflétées sans redémarrage du bot.

let cache  = {};
let _ready = false;

// ── Init + seed automatique ───────────────────────────────────────────────────
// Si la collection est vide et que seedData est fourni (objet BIENS),
// on l'insère comme données de départ.
async function init(db, seedData = null) {
  const count = await db.collection('bien_types').countDocuments();
  if (count === 0 && seedData) {
    const docs = Object.entries(seedData).map(([type, data]) => ({ type, ...data }));
    await db.collection('bien_types').insertMany(docs);
    console.log(`[BienCache] ✅ Collection bien_types initialisée avec ${docs.length} types`);
  }
  await refresh(db);
  _ready = true;
}

// ── Rechargement depuis la base ───────────────────────────────────────────────
async function refresh(db) {
  const docs = await db.collection('bien_types').find({}).toArray();
  const next = {};
  for (const doc of docs) {
    const { _id, type, ...data } = doc;
    next[type] = data;
  }
  cache = next;
}

// ── Accesseurs ────────────────────────────────────────────────────────────────
function get(type) {
  if (!_ready) return null;
  return cache[type] ?? null;
}

function getAll() {
  return { ...cache };
}

module.exports = { init, refresh, get, getAll };

// ─── Reprise de bien — Calcul statistique ─────────────────────────────────────

const { getDB } = require('./db');

// ── Zones de vente ────────────────────────────────────────────────────────────
const ZONES = ['Nord', 'Sud', 'Quartier Prisé', 'Roxwood', 'Las Venturas'];

// Marges appliquées pour calculer le prix de reprise max à partir du prix médian
const MARGES = {
  prudent:   0.20, // 20% — bien atypique ou marché lent
  standard:  0.15, // 15% — cas général
  optimiste: 0.10, // 10% — bien très demandé, rotation rapide
};

// Nombre maximum de ventes récentes prises en compte
const MAX_VENTES = 30;

// Seuil en-dessous duquel on émet un avertissement (données insuffisantes)
const SEUIL_FIABILITE = 5;

/**
 * Calcule la médiane d'un tableau de nombres trié.
 */
function mediane(arr) {
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 !== 0
    ? arr[mid]
    : Math.round((arr[mid - 1] + arr[mid]) / 2);
}

/**
 * Retourne les statistiques de vente + fourchettes de reprise pour un type de bien.
 * @param {string}      type — valeur exacte du type (ex: 'Appartement Simple')
 * @param {string|null} zone — zone filtrée (ex: 'Roxwood'), null = toutes zones
 * @returns {object|null} stats ou null si aucune vente enregistrée
 */
async function calculerReprise(type, zone = null) {
  const db = getDB();

  // Filtre de base : ventes solo uniquement
  // En MongoDB, { field: null } correspond aux documents où le champ est null OU absent.
  const filter = { type, statut: 'vendu', prixFinal: { $gt: 0 }, type2: null, type3: null };
  if (zone) filter.zone = zone;

  const ventes = await db.collection('ventes_lbc')
    .find(filter)
    .sort({ dateVente: -1 })
    .limit(MAX_VENTES)
    .toArray();

  // Compter les ventes en lot qui impliquent ce type
  const bundlesFilter = {
    statut: 'vendu',
    prixFinal: { $gt: 0 },
    $and: [
      { $or: [{ type }, { type2: type }, { type3: type }] },
      { $or: [{ type2: { $ne: null } }, { type3: { $ne: null } }] },
    ],
  };
  if (zone) bundlesFilter.zone = zone;
  const bundlesExclus = await db.collection('ventes_lbc').countDocuments(bundlesFilter);

  // Aucune donnée du tout
  if (!ventes.length && bundlesExclus === 0) return null;

  // Seulement des lots, pas de vente solo
  if (!ventes.length) {
    return { count: 0, bundlesExclus, fiable: false, mediane: null, min: null, max: null, reprises: null };
  }

  const prix = ventes.map(v => v.prixFinal).sort((a, b) => a - b);
  const med  = mediane(prix);

  return {
    count:         prix.length,
    bundlesExclus,
    fiable:        prix.length >= SEUIL_FIABILITE,
    mediane:       med,
    min:           prix[0],
    max:           prix[prix.length - 1],
    reprises: {
      prudent:   Math.floor(med * (1 - MARGES.prudent)),
      standard:  Math.floor(med * (1 - MARGES.standard)),
      optimiste: Math.floor(med * (1 - MARGES.optimiste)),
    },
  };
}

/**
 * Retourne les statistiques par zone pour un type donné.
 * Retourne aussi un résumé global (toutes zones confondues) sous la clé '_global'.
 * @param {string} type
 * @returns {object} { 'Nord': stats|null, 'Sud': stats|null, ..., '_global': stats|null }
 */
async function calculerRepriseParZone(type) {
  const results = {};
  // Calculer en parallèle pour les 5 zones + global
  const [global, ...parZone] = await Promise.all([
    calculerReprise(type, null),
    ...ZONES.map(zone => calculerReprise(type, zone)),
  ]);
  results['_global'] = global;
  ZONES.forEach((zone, i) => { results[zone] = parZone[i]; });
  return results;
}

/**
 * Retourne toutes les ventes enregistrées pour un type donné (usage panel web).
 */
async function getVentesParType(type) {
  return getDB().collection('ventes_lbc')
    .find({ type, statut: 'vendu' })
    .sort({ dateVente: -1 })
    .toArray();
}

/**
 * Retourne un résumé par type de bien (pour le dashboard panel).
 */
async function getResumeTousTypes() {
  return getDB().collection('ventes_lbc').aggregate([
    // Exclure les ventes en lot : le prix d'un lot ne reflète pas le prix d'un seul bien.
    { $match: { statut: 'vendu', prixFinal: { $gt: 0 }, type2: null, type3: null } },
    { $group: {
      _id:    '$type',
      count:  { $sum: 1 },
      median: { $avg: '$prixFinal' }, // approximation — la vraie médiane se calcule côté JS
      min:    { $min: '$prixFinal' },
      max:    { $max: '$prixFinal' },
    }},
    { $sort: { count: -1 } },
  ]).toArray();
}

// ── Utilitaire : toutes les permutations d'un tableau ────────────────────────
function permutations(arr) {
  if (arr.length <= 1) return [[...arr]];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

/**
 * Calcule les statistiques de vente pour un lot de 2 ou 3 biens vendus ensemble.
 * @param {string[]}    types — tableau de 2 ou 3 types
 * @param {string|null} zone  — zone filtrée, null = toutes zones
 */
async function calculerRepriseLot(types, zone = null) {
  if (!Array.isArray(types) || types.length < 2 || types.length > 3) return null;

  const perms = permutations(types);
  const $or   = perms.map(perm => ({
    type:  perm[0],
    type2: perm[1] ?? null,
    type3: perm[2] ?? null,
  }));

  const filter = { statut: 'vendu', prixFinal: { $gt: 0 }, $or };
  if (zone) filter.zone = zone;

  const ventes = await getDB().collection('ventes_lbc')
    .find(filter)
    .sort({ dateVente: -1 })
    .limit(MAX_VENTES)
    .toArray();

  if (!ventes.length) return { count: 0 };

  const prix = ventes.map(v => v.prixFinal).sort((a, b) => a - b);
  const med  = mediane(prix);

  return {
    count:   prix.length,
    fiable:  prix.length >= SEUIL_FIABILITE,
    mediane: med,
    min:     prix[0],
    max:     prix[prix.length - 1],
    reprises: {
      prudent:   Math.floor(med * (1 - MARGES.prudent)),
      standard:  Math.floor(med * (1 - MARGES.standard)),
      optimiste: Math.floor(med * (1 - MARGES.optimiste)),
    },
  };
}

module.exports = {
  calculerReprise,
  calculerRepriseLot,
  calculerRepriseParZone,
  getVentesParType,
  getResumeTousTypes,
  ZONES,
  SEUIL_FIABILITE,
};

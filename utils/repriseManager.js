// ─── Reprise de bien — Calcul statistique ─────────────────────────────────────

const { getDB } = require('./db');

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
 * @param {string} type — valeur exacte du type (ex: 'Appartement Simple')
 * @returns {object|null} stats ou null si aucune vente enregistrée
 */
async function calculerReprise(type) {
  const db = getDB();

  // Ventes SOLO uniquement : exclure les lots (type2 ou type3 non null).
  // En MongoDB, { field: null } correspond aux documents où le champ est null OU absent.
  const ventes = await db.collection('ventes_lbc')
    .find({ type, statut: 'vendu', prixFinal: { $gt: 0 }, type2: null, type3: null })
    .sort({ dateVente: -1 })
    .limit(MAX_VENTES)
    .toArray();

  // Compter les ventes en lot qui impliquent ce type (position 1, 2 ou 3)
  // mais dont le prix reflète un ensemble de biens et non ce type seul.
  const bundlesExclus = await db.collection('ventes_lbc').countDocuments({
    statut: 'vendu',
    prixFinal: { $gt: 0 },
    $and: [
      // Ce type apparaît quelque part dans la vente
      { $or: [{ type }, { type2: type }, { type3: type }] },
      // La vente est un lot (au moins un 2ème bien)
      { $or: [{ type2: { $ne: null } }, { type3: { $ne: null } }] },
    ],
  });

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
 * Cherche toutes les ventes où EXACTEMENT ces types apparaissent (dans n'importe quel ordre).
 * @param {string[]} types — tableau de 2 ou 3 types
 */
async function calculerRepriseLot(types) {
  if (!Array.isArray(types) || types.length < 2 || types.length > 3) return null;

  // Générer toutes les permutations pour matcher l'ordre peu importe l'ordre d'encodage
  const perms = permutations(types);
  const $or   = perms.map(perm => ({
    type:  perm[0],
    type2: perm[1] ?? null,
    type3: perm[2] ?? null,
  }));

  const ventes = await getDB().collection('ventes_lbc')
    .find({ statut: 'vendu', prixFinal: { $gt: 0 }, $or })
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

module.exports = { calculerReprise, calculerRepriseLot, getVentesParType, getResumeTousTypes, SEUIL_FIABILITE };

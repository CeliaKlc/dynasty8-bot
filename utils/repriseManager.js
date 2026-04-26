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
  const ventes = await getDB().collection('ventes_lbc')
    .find({ type, statut: 'vendu', prixFinal: { $gt: 0 } })
    .sort({ dateVente: -1 })
    .limit(MAX_VENTES)
    .toArray();

  if (!ventes.length) return null;

  const prix = ventes.map(v => v.prixFinal).sort((a, b) => a - b);
  const med  = mediane(prix);

  return {
    count:    prix.length,
    fiable:   prix.length >= SEUIL_FIABILITE,
    mediane:  med,
    min:      prix[0],
    max:      prix[prix.length - 1],
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
    { $match: { statut: 'vendu', prixFinal: { $gt: 0 } } },
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

module.exports = { calculerReprise, getVentesParType, getResumeTousTypes, SEUIL_FIABILITE };

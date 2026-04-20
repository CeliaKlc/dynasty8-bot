/**
 * Convertit une chaîne en caractères Unicode Mathematical Sans-Serif Bold.
 * Utilisé pour formater les noms de salons Discord.
 */
function toMathSansBold(str) {
  return str.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90)  return String.fromCodePoint(0x1D5D4 + (code - 65));
    if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D5EE + (code - 97));
    if (code >= 48 && code <= 57)  return String.fromCodePoint(0x1D7EC + (code - 48));
    return char;
  }).join('');
}

function toMathSans(str) {
  return str.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90)  return String.fromCodePoint(0x1D5A0 + (code - 65));
    if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D5BA + (code - 97));
    if (code >= 48 && code <= 57)  return String.fromCodePoint(0x1D7E2 + (code - 48));
    return char;
  }).join('');
}

/**
 * Ajoute le symbole $ uniquement si la valeur contient un chiffre.
 * Ex: "210'000" → "210'000$", "Négociation" → "Négociation"
 */
function avecDollar(val) {
  return /\d/.test(val) ? `${val}$` : val;
}

/**
 * Formate un prix avec des apostrophes comme séparateurs de milliers.
 * Si la valeur contient déjà des apostrophes, elle est d'abord normalisée
 * pour éviter tout doublon.
 * Si la valeur n'est pas un nombre pur (ex : "N/A", texte), elle est
 * retournée telle quelle.
 * Ex : "1600000" → "1'600'000"
 *      "1'600'000" → "1'600'000" (déjà formaté)
 *      "N/A" → "N/A"
 */
function formatPrix(val) {
  if (!val) return val;
  const stripped = val.replace(/'/g, '');
  if (!/^\d+$/.test(stripped)) return val;
  return stripped.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

module.exports = { toMathSansBold, toMathSans, avecDollar, formatPrix };

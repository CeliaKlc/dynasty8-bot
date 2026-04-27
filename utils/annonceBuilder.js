const { toMathSansBold } = require('./formatters');
const bienCache          = require('./bienCache');

// ─── Constantes partagées ─────────────────────────────────────────────────────

const ROLE_NOTIFICATIONS_LBC_ID = '1345415367333380156';

// ─── Liste unifiée des agents ─────────────────────────────────────────────────
// Source de vérité unique pour /annonce, /editannonce, /rename, /carte, /sac.
// Champs :
//   id      — Discord ID de l'agent (null si inconnu)
//   name    — Prénom Nom affiché partout
//   slug    — Identifiant URL utilisé par /rename (ex : 'sacha-rollay')
//   emoji   — Emoji affiché dans les annonces et le nom du ticket
//   feminin — true si l'agent est une femme (accord dans les messages)
//   titre   — Titre affiché sur la carte d'agent
//   numero  — Numéro de téléphone RP affiché sur la carte
//   photo   — URL de la photo de profil (null → pas de carte configurée)
//   agre    — Habilitations affichées sur la carte
//   bunker  — ID Discord du salon bunker (pour les rappels /carte)

const AGENTS = [
  {
    id: '314057285523472394',  name: 'Sacha Rollay',        slug: 'sacha-rollay',
    emoji: '🦊', feminin: true,
    titre: 'Patronne',                  numero: '509360',  photo: 'https://img.draftbot.fr/1776469909640-bc61b1612e0488bb.png',
    agre: ['Las Venturas', 'Cayo Perico', 'Gestionnaire LeBonCoin'], bunker: '1204165862173442098',
  },
  {
    id: '261956403546161152',  name: 'Ely Rollay',           slug: 'ely-rollay',
    emoji: '🦦', feminin: false,
    titre: 'Patron',                    numero: '0640200', photo: 'https://img.draftbot.fr/1766518616384-7f0fe8eeed22fd98.png',
    agre: ['Las Venturas', 'Cayo Perico', 'Gestionnaire LeBonCoin'], bunker: '1204165862173442098',
  },
  {
    id: '1151865005239697449', name: 'Marco Romanov',        slug: 'marco-romanov',
    emoji: '🐻', feminin: false,
    titre: 'Patron',                    numero: '68500',   photo: 'https://img.draftbot.fr/1775907175185-5df7d00ab926fd60.png',
    agre: ['Las Venturas', 'Cayo Perico', 'Gestionnaire LeBonCoin'], bunker: '1362857187118026802',
  },
  {
    id: '922112971793133568',  name: 'John Russet',          slug: 'john-russet',
    emoji: '🦍', feminin: false,
    titre: 'Agent Immobilier Senior',   numero: '4523947', photo: 'https://img.draftbot.fr/1773406483462-1ac7d8a1e35074c6.png',
    agre: ['Las Venturas', 'Cayo Perico', 'Gestionnaire LeBonCoin'], bunker: '1334541413529948180',
  },
  {
    id: '273565768355151874',  name: 'Hain Ergy',            slug: 'hain-ergy',
    emoji: '🐲', feminin: false,
    titre: 'Agent Immobilier Confirmé', numero: '12354',   photo: 'https://img.draftbot.fr/1768517004762-7ca455a27fad5bbf.png',
    agre: ['Las Venturas', 'Cayo Perico', 'Gestionnaire LeBonCoin'], bunker: '1457843137610514452',
  },
  {
    id: '343731754311614465',  name: 'Maksim Anatolyevich',  slug: 'maksim-anatolyevich',
    emoji: '🦁', feminin: false,
    titre: 'Agent Immobilier Senior',   numero: '4343627', photo: 'https://img.draftbot.fr/1765411964408-d43caa09d436ebce.png',
    agre: ['Las Venturas', 'Cayo Perico', 'Gestionnaire LeBonCoin'], bunker: '1439300519901396993',
  },
  {
    id: '394751095932583937',  name: 'John Macafey',         slug: 'john-macafey',
    emoji: '🐳', feminin: false,
    titre: 'Agent Immobilier Confirmé', numero: '353182',  photo: 'https://img.draftbot.fr/1767989376583-c813a51ee47ee341.png',
    agre: ['Las Venturas', 'Cayo Perico', 'Gestionnaire LeBonCoin'], bunker: '1456597599552409677',
  },
  {
    id: '993192428699914240',  name: 'Joe Hutson',        slug: 'joe-hutson',
    emoji: '🦖', feminin: false,
    titre: 'Agent Immobilier Senior',          numero: '0828282',    photo: 'https://i.imgur.com/D8G2aFM.png',
    agre: [], bunker: '1411816032007622656',
  },
  {
    id: '871705632414269491',  name: 'Piper Pipou',          slug: 'piper-pipou',
    emoji: '', feminin: true,
    titre: 'Agente Immobilière',        numero: '323635',  photo: 'https://img.draftbot.fr/1775841304111-8c9693903646e149.png',
    agre: [], bunker: '1480722296321605815',
  },
  {
    id: '1082632036906438757', name: 'Franklin Warner',      slug: 'franklin-warner',
    emoji: '', feminin: false,
    titre: 'Agent Immobilier',          numero: '946430',  photo: 'https://img.draftbot.fr/1774219842061-07aabc1491290c30.png',
    agre: [], bunker: '1480269661038837941',
  },
  {
    id: '976601674976206868',  name: 'Ben Lafayette',        slug: 'ben-lafayette',
    emoji: '', feminin: false,
    titre: 'Agent Immobilier',          numero: '6133',    photo: 'https://img.draftbot.fr/1774826009858-68a9c394d7abbf7d.png',
    agre: [], bunker: '1479528566331936768',
  },
  {
    id: '1165066396770767000',  name: 'Zoé Bell',        slug: 'zoe-bell',
    emoji: '', feminin: true,
    titre: 'Agente Immobilière',          numero: '104148',    photo: 'https://img.draftbot.fr/1777040419292-d759b6dd5bb7b4d5.png',
    agre: [], bunker: '1497239082378592266',
  },
];

const BIENS = {
  'Appartement Simple': {
    article: "L'Appartement Simple",
    base: 400, frigo: 0,
    caracteristiques: [
      'Chambre avec dressing',
      'Salle de bain',
      'Salon avec cuisine ouverte',
      '2 Télévisions',
    ],
  },
  'Appartement Basique': {
    article: "L'Appartement Basique",
    base: 250, frigo: 0,
    caracteristiques: [
      'Chambre avec dressing',
      'Salle de bain',
      'Télévision (fonctionnelle que sur le son)',
    ],
  },
  'Maison Simple': {
    article: 'La Maison Simple',
    base: 500, frigo: 0, cafe: true,
    caracteristiques: [
      'Chambre avec dressing',
      'Salle de bain',
      'Salon avec cuisine ouverte',
      '1 Télévision',
    ],
  },
  'Caravane': {
    article: 'La Caravane',
    base: 200, frigo: 0,
    caracteristiques: [
      'Chambre avec dressing',
      'Salle de bain',
      'Salon avec cuisine ouverte',
      'Télévision',
    ],
  },
  'Appartement Favelas': {
    article: "L'Appartement Favelas",
    base: 300, frigo: 0,
    caracteristiques: [
      '2 Chambres',
      'Dressing',
      'Salon',
      'Cuisine',
      'Salle de bain',
      'Télévision',
    ],
  },
  'Maison Favelas': {
    article: 'La Maison Favelas',
    base: 500, frigo: 0,
    caracteristiques: [
      'Chambre avec dressing',
      'Salon',
      'Cuisine',
      'Salle de bain',
      '2 Télévisions',
    ],
  },
  'Studio de Luxe': {
    article: 'Le Studio de Luxe',
    base: 500, frigo: 100,
    caracteristiques: [
      'Chambre avec dressing',
      'Salon avec cuisine ouverte',
      'Salle de bain',
      'Télévision',
      'Intérieur vivant (store qui ferme, etc.)',
    ],
  },
  'Appartement Moderne': {
    article: "L'Appartement Moderne",
    base: 500, frigo: 0,
    caracteristiques: [
      'Chambre avec dressing',
      'Salle de bain',
      'Salon avec cuisine ouverte',
      'Bureau',
      '2 Télévisions',
    ],
  },
  'Duplex (avec Frigo)': {
    titre: 'Duplex',
    article: 'Le Duplex',
    base: 600, frigo: 100,
    caracteristiques: [
      'Chambre avec dressing',
      'Salle de bain',
      'Salon avec cuisine ouverte',
      'Bureau',
      '2 Étages',
      'Télévision',
    ],
  },
  'Duplex (sans Frigo)': {
    titre: 'Duplex',
    article: 'Le Duplex',
    base: 600, frigo: 0,
    caracteristiques: [
      'Chambre avec dressing',
      'Salle de bain',
      'Salon avec cuisine ouverte',
      'Bureau',
      '2 Étages',
      'Télévision',
    ],
  },
  'Appartement de Luxe Modifiable': {
    article: "L'Appartement de Luxe Modifiable",
    base: 750, frigo: 0, modifiable: true, cafe: true,
    caracteristiques: [
      'Chambre avec dressing',
      'Salle de bain',
      'Salon avec cuisine ouverte',
      'Bureau',
      'Télévision',
    ],
  },
  'Villa Blanche': {
    article: 'La Villa',
    base: 800, frigo: 100, couleur: '⚪ Intérieur Blanc',
    caracteristiques: [
      'Chambre avec dressing',
      'Salle de bain',
      'Salon avec cuisine ouverte',
      'Bureau',
      '3 Étages',
      'Télévision',
    ],
  },
  'Villa Rouge': {
    article: 'La Villa',
    base: 800, frigo: 100, couleur: '🔴 Intérieur Rouge',
    caracteristiques: [
      'Chambre avec dressing',
      'Salle de bain',
      'Salon avec cuisine ouverte',
      'Bureau',
      '3 Étages',
      'Télévision',
    ],
  },
  'Maison de Luxe': {
    article: 'La Maison de Luxe',
    base: 2500, frigo: 0, modifiable: true, ordinateur: true, cafe: true,
    caracteristiques: [
      '2 Chambres avec dressing',
      '2 Salles de bain',
      'Salon avec cuisine ouverte',
      'Bureau',
      'Salle de poker',
      'Salle à vin',
      'Télévisions',
    ],
  },
  'Villa de Luxe': {
    article: 'La Villa de Luxe',
    base: 2500, frigo: 0,
    caracteristiques: [
      '4 Chambres avec dressing',
      '4 Salles de bain',
      'Salon avec cuisine ouverte',
      'Bureau avec salle de réunion',
      'Salle de sport',
      'Studio d\'enregistrement',
      'Piscine intérieure avec jacuzzi',
      '2 Étages',
      'Télévisions',
    ],
  },
  'Bureau': {
    article: 'Le Bureau',
    base: 750, frigo: 0, modifiable: true, ordinateur: true,
    caracteristiques: [
      'Chambre avec dressing',
      'Salle de bain',
      'Bureau',
      'Salle de réunion',
      'Accueil',
      'Télévision',
    ],
  },
  'Agence': {
    article: "L'Agence",
    base: 800, frigo: 0, modifiable: true, ordinateur: true,
    caracteristiques: [
      'Espace personnel, avec salon, dressing et lit',
      'Grande entrée',
      'Salon avec cuisine ouverte',
      '2 Bureaux personnels tout équipés',
      'Grande salle de réunion',
      'Héliport',
      'Accueil',
      '2 Etages',
      'Étage de bureaux',
      'Télévision',
    ],
  },
  'Hangar': {
    article: 'Le Hangar',
    base: 500, frigo: 0, entrepriseOnly: true,
    caracteristiques: [
      'Machine à laver',
    ],
  },
  'Entrepôt': {
    article: "L'Entrepôt",
    base: 600, frigo: 0, modifiable: true, entrepriseOnly: true,
    caracteristiques: [
      'Bureau',
      'Dressing',
      'Des racks',
    ],
  },
  'Garage 2 places': {
    article: 'Le Garage 2 places',
    base: 50, frigo: 0,
    caracteristiques: ['2 places véhicule'],
  },
  'Garage 6 places': {
    article: 'Le Garage 6 places',
    base: 200, frigo: 0,
    caracteristiques: ['6 places véhicules', '2 porte vélo'],
  },
  'Garage 10 places': {
    article: 'Le Garage 10 places',
    base: 400, frigo: 0,
    caracteristiques: ['10 places véhicules', '6 porte vélo'],
  },
  'Garage 26 places': {
    article: 'Le Garage 26 places',
    base: 500, frigo: 0,
    caracteristiques: ['26 places véhicules', '3 étages', 'Intérieur modifiable'],
  },
  'Loft Garage': {
    article: 'Le Loft Garage',
    base: 500, frigo: 0,
    caracteristiques: ['Salon avec Dressing', '4 places véhicules', 'Intérieur modifiable'],
  },
};

// Unités de stockage par taille de garage
const STOCKAGE_GARAGE = { '2': 50, '6': 200, '10': 400, '10l': 500, '26': 500, 'loft': 500 };

// Labels affichés pour chaque valeur de garage
const GARAGE_LABELS = {
  '2':    '2 places',
  '6':    '6 places',
  '10':   '10 places',
  '10l':  '10 places de luxe',
  '26':   '26 places',
  'loft': 'Loft Garage',
};

// Labels inversés (label → valeur) pour le parsing
const GARAGE_LABEL_TO_VALUE = Object.fromEntries(
  Object.entries(GARAGE_LABELS).map(([k, v]) => [v, k]),
);

// Labels affichés pour salle à sac
const SALLE_A_SAC_LABELS = {
  '1': 'Salle à sac',
  '2': 'Salle à sac avec une extension',
  '3': 'Salle à sac avec deux extensions',
};

// Labels inversés pour le parsing
const SALLE_A_SAC_LABEL_TO_VALUE = Object.fromEntries(
  Object.entries(SALLE_A_SAC_LABELS).map(([k, v]) => [v, k]),
);

// Détail du stockage par niveau de salle à sac
const SALLE_A_SAC_STOCKAGE = {
  '1': '32 places · 16 sacs bandoulières · 16 sacs à dos',
  '2': '64 places · 32 sacs bandoulières · 32 sacs à dos',
  '3': '96 places · 48 sacs bandoulières · 48 sacs à dos',
};

// Types de biens qui ne peuvent PAS posséder de salle à sac
const TYPES_SANS_SALLE_A_SAC = new Set([
  'Caravane',
  'Appartement Basique',
  'Appartement Simple',
  'Appartement Favelas',
  'Maison Favelas',
  'Bureau',
  'Loft Garage',
  'Garage 2 places',
  'Garage 6 places',
  'Garage 10 places',
  'Garage 26 places',
  'Entrepôt',
  'Hangar',
]);

const DYNASTY8 = toMathSansBold('DYNASTY 8');

// ─── Construction du contenu d'une annonce ────────────────────────────────────
// Params : { type, transaction, quartier, garage1, garage2, garageLuxe,
//            salleASac, jardin, piscine, terrasse, etageres, description }
function buildAnnonceContent({ type, transaction, quartier, garage1, garage2, garageLuxe, salleASac, jardin, piscine, terrasse, balcon, etageres, description }) {
  // Priorité : données en base (éditables via le panel) > données hardcodées
  const bien           = bienCache.get(type) ?? BIENS[type] ?? { article: 'Le bien', base: 0, frigo: 0, caracteristiques: [] };
  const isTypeLuxe     = type === 'Villa de Luxe' || type === 'Maison de Luxe';
  const transLabel     = transaction === 'vente' ? 'À VENDRE' : 'À LOUER';

  const garageLuxeUnites  = isTypeLuxe && garageLuxe ? garageLuxe * STOCKAGE_GARAGE['10l'] : 0;
  const garage1Unites     = !isTypeLuxe && garage1   ? STOCKAGE_GARAGE[garage1] : 0;
  const garage2Unites     = !isTypeLuxe && garage2   ? STOCKAGE_GARAGE[garage2] : 0;
  const totalGarageUnites = isTypeLuxe ? garageLuxeUnites : garage1Unites + garage2Unites;

  // Regrouper les garages identiques (ex: garage1=2 et garage2=2 → { '2': 2 })
  const garageGroupes = !isTypeLuxe
    ? Object.entries([garage1, garage2].filter(Boolean).reduce((acc, g) => { acc[g] = (acc[g] || 0) + 1; return acc; }, {}))
    : [];

  // ── STOCKAGE ──
  const lignesStockage = [];
  if (type === 'Entrepôt' && etageres) {
    const totalEtageres = etageres * 600;
    const MAX_ENTREPOT  = 25 * 600;
    lignesStockage.push(`> L'Entrepôt dispose de **${etageres} étagère${etageres > 1 ? 's' : ''}**. (25 max)`);
    if (etageres === 25) {
      lignesStockage.push(`> ➡️ Soit un total de **${MAX_ENTREPOT} unités** de stockage disponibles, un vrai atout pour vos besoins de rangement !`);
    } else {
      lignesStockage.push(`> ➡️ Soit un total de **${totalEtageres} unités** de stockage disponibles (jusqu'à **${MAX_ENTREPOT} unités** possible), un vrai atout pour vos besoins de rangement !`);
    }
  } else if (bien.frigo > 0) {
    lignesStockage.push(`> ${bien.article} dispose de **${bien.base} unités** de stockage + **${bien.frigo} unités** dans le frigo, soit **${bien.base + bien.frigo} unités** (HORS RSA) au total.`);
  } else {
    lignesStockage.push(`> ${bien.article} dispose de **${bien.base} unités** (HORS RSA) de stockage.`);
  }
  if (isTypeLuxe && garageLuxe) {
    const label = garageLuxe === 1 ? 'Le Garage 10 places de luxe dispose' : `Les ${garageLuxe} Garages 10 places de luxe disposent`;
    lignesStockage.push(`> ${label} de **${garageLuxeUnites} unités** supplémentaires.`);
    lignesStockage.push(`> ➡️ Soit un total de **${bien.base + bien.frigo + garageLuxeUnites} unités (HORS RSA)** de stockage disponibles, un vrai atout pour vos besoins de rangement !`);
  } else {
    garageGroupes.forEach(([g, n]) => {
      const unites = n * STOCKAGE_GARAGE[g];
      const label  = n > 1
        ? `Les ${n} Garages ${GARAGE_LABELS[g]} disposent de **${STOCKAGE_GARAGE[g]} unités chacun**, soit **${unites} unités** supplémentaires.`
        : `Le Garage ${GARAGE_LABELS[g]} dispose de **${unites} unités** supplémentaires.`;
      lignesStockage.push(`> ${label}`);
    });
    if (garage1 || garage2) {
      lignesStockage.push(`> ➡️ Soit un total de **${bien.base + bien.frigo + totalGarageUnites} unités (HORS RSA)** de stockage disponibles, un vrai atout pour vos besoins de rangement !`);
    }
  }

  // ── INTÉRIEUR ──
  const lignesInterieur = (bien.caracteristiques ?? []).map(c => `> - ${c}`);

  // ── LES + ──
  const lignesPlus = [];
  if (isTypeLuxe && garageLuxe) {
    lignesPlus.push(`> 🚗 ${garageLuxe} × Garage 10 places de luxe`);
  } else {
    garageGroupes.forEach(([g, n]) => {
      lignesPlus.push(`> 🚗 ${n > 1 ? `${n} × Garages ${GARAGE_LABELS[g]}` : `Garage ${GARAGE_LABELS[g]}`}`);
    });
  }
  if (salleASac) {
    lignesPlus.push(`> 🎒 ${SALLE_A_SAC_LABELS[salleASac]}`);
    lignesPlus.push(`> ↳ 🗄️ ${SALLE_A_SAC_STOCKAGE[salleASac]}`);
  }
  if (jardin)          lignesPlus.push(`> 🌿 Jardin`);
  if (terrasse)        lignesPlus.push(`> ☀️ ${terrasse > 1 ? `${terrasse} Terrasses` : 'Terrasse'}`);
  if (balcon)          lignesPlus.push(`> 🌅 ${balcon > 1 ? `${balcon} Balcons` : 'Balcon'}`);
  if (piscine)         lignesPlus.push(`> 🏊 Piscine`);
  if (type === 'Entrepôt') {
    lignesPlus.push(`> 💧 Fontaine à eau`);
    lignesPlus.push(`> 💻 Ordinateur pour gérer son entreprise`);
    lignesPlus.push(`> 👔 Vestiaire pour prise de service`);
  }
  if (bien.ordinateur && type !== 'Entrepôt') lignesPlus.push(`> 💻 Ordinateur pour gérer son entreprise`);
  if (bien.cafe)       lignesPlus.push(`> ☕ Machine à café`);
  if (bien.modifiable) lignesPlus.push(`> 🔧 Intérieur modifiable`);
  if (bien.couleur)    lignesPlus.push(`> ${bien.couleur}`);

  // ── Titre avec garages ──
  let garagesTitre = '';
  if (isTypeLuxe && garageLuxe) {
    garagesTitre = `${garageLuxe} × Garage 10 places de luxe`;
  } else {
    garagesTitre = garageGroupes
      .map(([g, n]) => n > 1 ? `ses ${n} Garages ${GARAGE_LABELS[g]}` : `Garage ${GARAGE_LABELS[g]}`)
      .join(' & ');
  }

  // ── Message final ──
  const lignes = [
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    `        ·         ${DYNASTY8}          ·`,
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    `✨ **${transLabel} : ${bien.titre ?? type}${garagesTitre ? ` avec ${garagesTitre}` : ''}** ✨`,
    ``,
    `Chers <@&${ROLE_NOTIFICATIONS_LBC_ID}>,`,
    ``,
    `📍 **Emplacement :** Situé ${quartier}`,
  ];

  lignes.push(``, `**📦 STOCKAGE**`);
  lignes.push(...lignesStockage);

  if (lignesInterieur.length > 0) {
    lignes.push(``, `**🛋️ INTÉRIEUR**`);
    lignes.push(...lignesInterieur);
  }

  if (lignesPlus.length > 0) {
    lignes.push(``, `**✨ LES +**`);
    lignes.push(...lignesPlus);
  }

  const lignesDetails = [];
  if (!salleASac && !TYPES_SANS_SALLE_A_SAC.has(type)) {
    lignesDetails.push(`> 👜 Peut posséder une salle à sac`);
  }
  if (description) {
    description.split(' , ').forEach(part => {
      const t = part.trim();
      if (t) lignesDetails.push(`> ${t}`);
    });
  }
  if (lignesDetails.length > 0) {
    lignes.push(``, `**📝 DÉTAILS**`);
    lignes.push(...lignesDetails);
  }

  if (bien.entrepriseOnly) {
    lignes.push(``, `## <a:407265yellowsiren:1489238394826522664> Ce bien est disponible uniquement pour les *entreprises*. <a:407265yellowsiren:1489238394826522664>`);
  }

  lignes.push(``);
  lignes.push(``);
  lignes.push(`*Vous souhaitez être notifié pour chaque bien ? N'hésitez pas à activer votre rôle juste ici* → https://discord.com/channels/814919928233721856/915990552745500692`);
  lignes.push(``);
  lignes.push(`*<:Dynasty8:1489223936620236841> Dynasty 8 — Transformons vos projets immobiliers en réalité.*`);

  return lignes.join('\n');
}

module.exports = {
  AGENTS,
  BIENS,
  STOCKAGE_GARAGE,
  GARAGE_LABELS,
  GARAGE_LABEL_TO_VALUE,
  SALLE_A_SAC_LABELS,
  SALLE_A_SAC_LABEL_TO_VALUE,
  TYPES_SANS_SALLE_A_SAC,
  ROLE_NOTIFICATIONS_LBC_ID,
  DYNASTY8,
  buildAnnonceContent,
};

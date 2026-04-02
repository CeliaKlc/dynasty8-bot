const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

// ── Constantes (identiques à annonce.js) ─────────────────────────────────────
const ROLE_NOTIFICATIONS_LBC_ID = '1345415367333380156';

const BIENS = {
  'Appartement Simple':             { article: "L'Appartement Simple",             base: 400,  frigo: 0   },
  'Appartement Basique':            { article: "L'Appartement Basique",            base: 250,  frigo: 0   },
  'Maison Simple':                  { article: 'La Maison Simple',                 base: 500,  frigo: 0   },
  'Caravane':                       { article: 'La Caravane',                      base: 200,  frigo: 0   },
  'Appartement Favelas':            { article: "L'Appartement Favelas",            base: 300,  frigo: 0   },
  'Maison Favelas':                 { article: 'La Maison Favelas',                base: 500,  frigo: 0   },
  'Studio de Luxe':                 { article: 'Le Studio de Luxe',                base: 500,  frigo: 100 },
  'Appartement Moderne':            { article: "L'Appartement Moderne",            base: 500,  frigo: 0   },
  'Duplex':                         { article: 'Le Duplex',                        base: 600,  frigo: 100 },
  'Appartement de Luxe Modifiable': { article: "L'Appartement de Luxe Modifiable", base: 750,  frigo: 0,  modifiable: true },
  'Villa':                          { article: 'La Villa',                         base: 800,  frigo: 100 },
  'Maison de Luxe':                 { article: 'La Maison de Luxe',                base: 2500, frigo: 0,  modifiable: true, ordinateur: true, cafe: true },
  'Villa de Luxe':                  { article: 'La Villa de Luxe',                 base: 2000, frigo: 0   },
  'Bureau':                         { article: 'Le Bureau',                        base: 750,  frigo: 0,  modifiable: true, ordinateur: true },
  'Agence':                         { article: "L'Agence",                         base: 800,  frigo: 0,  modifiable: true, ordinateur: true },
  'Hangar':                         { article: 'Le Hangar',                        base: 500,  frigo: 0,  entrepriseOnly: true },
  'Entrepôt':                       { article: "L'Entrepôt",                       base: 600,  frigo: 0,  modifiable: true, entrepriseOnly: true },
  'Garage 2 places':                { article: 'Le Garage 2 places',               base: 50,   frigo: 0   },
  'Garage 6 places':                { article: 'Le Garage 6 places',               base: 200,  frigo: 0   },
  'Garage 10 places':               { article: 'Le Garage 10 places',              base: 400,  frigo: 0   },
  'Garage 26 places':               { article: 'Le Garage 26 places',              base: 500,  frigo: 0   },
  'Loft Garage':                    { article: 'Le Loft Garage',                   base: 500,  frigo: 0   },
};

const STOCKAGE_GARAGE = { '2': 50, '6': 200, '10': 400, '10l': 500, '26': 500, 'loft': 500 };

const GARAGE_LABELS = {
  '2': '2 places', '6': '6 places', '10': '10 places',
  '10l': '10 places de luxe', '26': '26 places', 'loft': 'Loft Garage',
};

const GARAGE_LABEL_TO_VALUE = Object.fromEntries(
  Object.entries(GARAGE_LABELS).map(([k, v]) => [v, k])
);

const SALLE_A_SAC_LABELS = {
  '1': 'Salle à sac',
  '2': 'Salle à sac avec une extension',
  '3': 'Salle à sac avec deux extensions',
};

const SALLE_A_SAC_LABEL_TO_VALUE = Object.fromEntries(
  Object.entries(SALLE_A_SAC_LABELS).map(([k, v]) => [v, k])
);

function toMathSansBold(str) {
  return str.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90)  return String.fromCodePoint(0x1D5D4 + (code - 65));
    if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D5EE + (code - 97));
    if (code >= 48 && code <= 57)  return String.fromCodePoint(0x1D7EC + (code - 48));
    return char;
  }).join('');
}

const DYNASTY8 = toMathSansBold('DYNASTY 8');

// ── Parse un message annonce existant ────────────────────────────────────────
function parseAnnonceMessage(content, components) {
  // Numero depuis le customId du bouton Acheter
  const btn    = components?.[0]?.components?.[0];
  const numero = btn?.customId?.replace('annonce_acheter_', '') ?? null;

  // Transaction
  const transaction = content.includes('À VENDRE') ? 'vente' : 'location';

  // Type — cherche le nom de bien connu dans la ligne de titre
  const titleMatch = content.match(/✨ \*\*(?:À VENDRE|À LOUER) : (.+?)\*\* ✨/);
  const titlePart  = titleMatch ? titleMatch[1] : '';
  const type       = Object.keys(BIENS).find(t => titlePart.startsWith(t)) ?? null;

  // Quartier
  const quartierMatch = content.match(/📍 \*\*Emplacement :\*\* Situé (.+)/);
  const quartier      = quartierMatch ? quartierMatch[1].trim() : null;

  // Garages depuis LES +
  const isTypeLuxe  = type === 'Villa de Luxe' || type === 'Maison de Luxe';
  const luxeMatch   = content.match(/> 🚗 (\d+) × Garage 10 places de luxe/);
  const garageLuxe  = luxeMatch ? parseInt(luxeMatch[1]) : null;

  const garageLines = [...content.matchAll(/> 🚗 Garage (.+)/g)].map(m => m[1].trim());
  const garage1     = !isTypeLuxe && garageLines[0] ? GARAGE_LABEL_TO_VALUE[garageLines[0]] ?? null : null;
  const garage2     = !isTypeLuxe && garageLines[1] ? GARAGE_LABEL_TO_VALUE[garageLines[1]] ?? null : null;

  // Salle à sac
  const sacMatch  = content.match(/> 🎒 (.+)/);
  const salleASac = sacMatch ? SALLE_A_SAC_LABEL_TO_VALUE[sacMatch[1].trim()] ?? null : null;

  // Booléens
  const jardin   = content.includes('> 🌿 Jardin');
  const piscine  = content.includes('> 🏊 Piscine');
  const terrasse = content.includes('> ☀️ Terrasse');

  // Étagères (Entrepôt)
  const etagMatch = content.match(/dispose de \*\*(\d+) étagère/);
  const etageres  = etagMatch ? parseInt(etagMatch[1]) : null;

  // Description
  const descMatch   = content.match(/\*\*📝 DÉTAILS\*\*\n> (.+)/);
  const description = descMatch ? descMatch[1].trim() : null;

  return { numero, transaction, type, quartier, garage1, garage2, garageLuxe, salleASac, jardin, piscine, terrasse, etageres, description };
}

// ── Reconstruction du contenu (identique à annonce.js) ───────────────────────
function buildAnnonceContent(p) {
  const { type, transaction, quartier, numero, garage1, garage2, garageLuxe, salleASac, jardin, piscine, terrasse, etageres, description } = p;

  const bien        = BIENS[type] ?? { article: 'Le bien', base: 0, frigo: 0, caracteristiques: [] };
  const isTypeLuxe  = type === 'Villa de Luxe' || type === 'Maison de Luxe';
  const transLabel  = transaction === 'vente' ? 'À VENDRE' : 'À LOUER';

  const garageLuxeUnites  = isTypeLuxe && garageLuxe ? garageLuxe * STOCKAGE_GARAGE['10l'] : 0;
  const garage1Unites     = !isTypeLuxe && garage1   ? STOCKAGE_GARAGE[garage1] : 0;
  const garage2Unites     = !isTypeLuxe && garage2   ? STOCKAGE_GARAGE[garage2] : 0;
  const totalGarageUnites = isTypeLuxe ? garageLuxeUnites : garage1Unites + garage2Unites;

  // STOCKAGE
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
    lignesStockage.push(`> ${bien.article} dispose de **${bien.base} unités** de stockage + **${bien.frigo} unités** dans le frigo, soit **${bien.base + bien.frigo} unités** au total.`);
  } else {
    lignesStockage.push(`> ${bien.article} dispose de **${bien.base} unités** de stockage.`);
  }
  if (isTypeLuxe && garageLuxe) {
    const label = garageLuxe === 1 ? 'Le Garage 10 places de luxe dispose' : `Les ${garageLuxe} Garages 10 places de luxe disposent`;
    lignesStockage.push(`> ${label} de **${garageLuxeUnites} unités** supplémentaires.`);
    lignesStockage.push(`> ➡️ Soit un total de **${bien.base + bien.frigo + garageLuxeUnites} unités (HORS RSA)** de stockage disponibles, un vrai atout pour vos besoins de rangement !`);
  } else {
    if (garage1) lignesStockage.push(`> Le Garage ${GARAGE_LABELS[garage1]} dispose de **${garage1Unites} unités** supplémentaires.`);
    if (garage2) lignesStockage.push(`> Le Garage ${GARAGE_LABELS[garage2]} dispose de **${garage2Unites} unités** supplémentaires.`);
    if (garage1 || garage2) {
      lignesStockage.push(`> ➡️ Soit un total de **${bien.base + bien.frigo + totalGarageUnites} unités (HORS RSA)** de stockage disponibles, un vrai atout pour vos besoins de rangement !`);
    }
  }

  // INTÉRIEUR
  const lignesInterieur = (bien.caracteristiques ?? []).map(c => `> - ${c}`);

  // LES +
  const lignesPlus = [];
  if (isTypeLuxe && garageLuxe) {
    lignesPlus.push(`> 🚗 ${garageLuxe} × Garage 10 places de luxe`);
  } else {
    if (garage1) lignesPlus.push(`> 🚗 Garage ${GARAGE_LABELS[garage1]}`);
    if (garage2) lignesPlus.push(`> 🚗 Garage ${GARAGE_LABELS[garage2]}`);
  }
  if (salleASac)       lignesPlus.push(`> 🎒 ${SALLE_A_SAC_LABELS[salleASac]}`);
  if (jardin)          lignesPlus.push(`> 🌿 Jardin`);
  if (terrasse)        lignesPlus.push(`> ☀️ Terrasse`);
  if (piscine)         lignesPlus.push(`> 🏊 Piscine`);
  if (type === 'Entrepôt') {
    lignesPlus.push(`> 💧 Fontaine à eau`);
    lignesPlus.push(`> 💻 Ordinateur pour gérer son entreprise`);
    lignesPlus.push(`> 👔 Vestiaire pour prise de service`);
  }
  if (bien.ordinateur && type !== 'Entrepôt') lignesPlus.push(`> 💻 Ordinateur pour gérer son entreprise`);
  if (bien.cafe)       lignesPlus.push(`> ☕ Machine à café`);
  if (bien.modifiable) lignesPlus.push(`> 🔧 Intérieur modifiable`);

  // Titre avec garages
  let garagesTitre = '';
  if (isTypeLuxe && garageLuxe) {
    garagesTitre = `${garageLuxe} × Garage 10 places de luxe`;
  } else {
    garagesTitre = [garage1, garage2].filter(Boolean).map(g => `Garage ${GARAGE_LABELS[g]}`).join(' & ');
  }

  // Message final
  const lignes = [
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    `        ·         ${DYNASTY8}          ·`,
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    `✨ **${transLabel} : ${type}${garagesTitre ? ` avec ${garagesTitre}` : ''}** ✨`,
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

  if (description) lignes.push(``, `**📝 DÉTAILS**`, `> ${description}`);

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

// ── Commande ──────────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('editannonce')
    .setDescription('✏️ Modifier les options d\'une annonce déjà publiée')
    .addStringOption(opt => opt
      .setName('message_id')
      .setDescription('ID du message à modifier (clic droit → Copier l\'identifiant)')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('garage_1')
      .setDescription('1er garage inclus')
      .setRequired(false)
      .addChoices(
        { name: '🚗 2 places',                       value: '2'    },
        { name: '🚗 6 places',                       value: '6'    },
        { name: '🚗 10 places',                      value: '10'   },
        { name: '🚗 10 places de luxe',              value: '10l'  },
        { name: '🚗 26 places (Agence uniquement)',   value: '26'   },
        { name: '🚗 Loft Garage',                    value: 'loft' },
        { name: '❌ Supprimer',                       value: 'none' },
      ))
    .addStringOption(opt => opt
      .setName('garage_2')
      .setDescription('2ème garage inclus')
      .setRequired(false)
      .addChoices(
        { name: '🚗 2 places',                       value: '2'    },
        { name: '🚗 6 places',                       value: '6'    },
        { name: '🚗 10 places',                      value: '10'   },
        { name: '🚗 10 places de luxe',              value: '10l'  },
        { name: '🚗 26 places (Agence uniquement)',   value: '26'   },
        { name: '🚗 Loft Garage',                    value: 'loft' },
        { name: '❌ Supprimer',                       value: 'none' },
      ))
    .addIntegerOption(opt => opt
      .setName('garage_luxe')
      .setDescription('Garages de luxe (Villa/Maison de Luxe uniquement, 1 à 4)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(4))
    .addStringOption(opt => opt
      .setName('salle_a_sac')
      .setDescription('Salle à sac')
      .setRequired(false)
      .addChoices(
        { name: '🎒 Salle à sac',                value: '1'    },
        { name: '🎒 Salle à sac + 1 extension',  value: '2'    },
        { name: '🎒 Salle à sac + 2 extensions', value: '3'    },
        { name: '❌ Supprimer',                   value: 'none' },
      ))
    .addBooleanOption(opt => opt
      .setName('jardin')
      .setDescription('Jardin inclus ?')
      .setRequired(false))
    .addBooleanOption(opt => opt
      .setName('piscine')
      .setDescription('Piscine incluse ?')
      .setRequired(false))
    .addBooleanOption(opt => opt
      .setName('terrasse')
      .setDescription('Terrasse incluse ?')
      .setRequired(false))
    .addIntegerOption(opt => opt
      .setName('etageres')
      .setDescription('Étagères Entrepôt uniquement (1 à 25)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(25))
    .addStringOption(opt => opt
      .setName('description')
      .setDescription('Description libre')
      .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const messageId = interaction.options.getString('message_id');

    // Récupération du message
    let message;
    try {
      message = await interaction.channel.messages.fetch(messageId);
    } catch {
      return interaction.editReply({ content: '❌ Message introuvable. Utilise la commande dans le même salon que l\'annonce.' });
    }

    if (message.author.id !== interaction.client.user.id) {
      return interaction.editReply({ content: '❌ Ce message n\'a pas été envoyé par le bot.' });
    }

    // Parse les valeurs existantes
    const current = parseAnnonceMessage(message.content, message.components);

    if (!current.type || !current.quartier || !current.numero) {
      return interaction.editReply({ content: '❌ Impossible de lire ce message. Assure-toi que c\'est bien une annonce Dynasty 8.' });
    }

    // Fusion : valeur 'none' = supprimer l'option, null = conserver l'existante
    const resolveStr = (key, currentVal) => {
      const val = interaction.options.getString(key);
      if (val === 'none') return null;
      return val ?? currentVal;
    };

    const merged = {
      numero:      current.numero,
      type:        current.type,
      transaction: current.transaction,
      quartier:    current.quartier,
      garage1:     resolveStr('garage_1',   current.garage1),
      garage2:     resolveStr('garage_2',   current.garage2),
      garageLuxe:  interaction.options.getInteger('garage_luxe') ?? current.garageLuxe,
      salleASac:   resolveStr('salle_a_sac', current.salleASac),
      jardin:      interaction.options.getBoolean('jardin')   ?? current.jardin,
      piscine:     interaction.options.getBoolean('piscine')  ?? current.piscine,
      terrasse:    interaction.options.getBoolean('terrasse') ?? current.terrasse,
      etageres:    interaction.options.getInteger('etageres') ?? current.etageres,
      description: interaction.options.getString('description') ?? current.description,
    };

    const newContent = buildAnnonceContent(merged);

    // Reconstruit les boutons avec le bon numero
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`annonce_acheter_${current.numero}`)
        .setLabel('🏠 Acheter ce bien')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`annonce_visiter_${current.numero}`)
        .setLabel('👁️ Visiter le bien')
        .setStyle(ButtonStyle.Primary),
    );

    await message.edit({ content: newContent, components: [row], allowedMentions: { parse: ['roles'] } });
    await interaction.editReply({ content: '✅ Annonce mise à jour !' });
  },
};

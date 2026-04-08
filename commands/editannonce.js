const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

// ── Constantes partagées (source unique : annonce.js) ─────────────────────────
const ROLE_NOTIFICATIONS_LBC_ID = '1345415367333380156';

const { BIENS, STOCKAGE_GARAGE, GARAGE_LABELS, SALLE_A_SAC_LABELS, TYPES_SANS_SALLE_A_SAC, AGENTS } = require('./annonce');

const GARAGE_LABEL_TO_VALUE = Object.fromEntries(
  Object.entries(GARAGE_LABELS).map(([k, v]) => [v, k])
);

const SALLE_A_SAC_LABEL_TO_VALUE = Object.fromEntries(
  Object.entries(SALLE_A_SAC_LABELS).map(([k, v]) => [v, k])
);

const { toMathSansBold } = require('../utils/formatters');

const DYNASTY8 = toMathSansBold('DYNASTY 8');

// ── Parse un message annonce existant ────────────────────────────────────────
function parseAnnonceMessage(content, components) {
  // Numero depuis le customId du bouton Acheter
  const btn         = components?.[0]?.components?.[0];
  const rawCustomId = btn?.customId ?? '';
  // format: annonce_acheter_${numero}_${agentId}
  const customParts = rawCustomId.replace('annonce_acheter_', '').split('_');
  const agentId     = customParts.length > 1 ? customParts[customParts.length - 1] : null;
  const numero      = customParts.slice(0, customParts.length - 1).join('_') || rawCustomId.replace('annonce_acheter_', '') || null;

  // Transaction
  const transaction = content.includes('À VENDRE') ? 'vente' : 'location';

  // Type — cherche le nom de bien connu dans la ligne de titre (supporte bien.titre)
  const titleMatch = content.match(/✨ \*\*(?:À VENDRE|À LOUER) : (.+?)\*\* ✨/);
  const titlePart  = titleMatch ? titleMatch[1] : '';

  const matchingTypes = Object.keys(BIENS).filter(t => {
    const displayName = BIENS[t].titre ?? t;
    return titlePart === displayName || titlePart.startsWith(displayName + ' ');
  });

  let type = matchingTypes[0] ?? null;

  // Disambiguïser les variantes Duplex selon la présence du frigo dans le stockage
  if (matchingTypes.length > 1) {
    const hasFrigo = content.includes('dans le frigo');
    type = matchingTypes.find(t => (BIENS[t].frigo > 0) === hasFrigo) ?? matchingTypes[0];
  }

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

  // Description (la ligne "Peut posséder une salle à sac" est ignorée)
  // Lookahead négatif pour éviter de capturer la ligne "Peut posséder une salle à sac" comme description
  const descMatch   = content.match(/\*\*📝 DÉTAILS\*\*\n(?:> 👜 Peut posséder une salle à sac\n)?> (?!👜 Peut posséder une salle à sac)(.+)/);
  const description = descMatch ? descMatch[1].trim() : null;

  return { numero, agentId, transaction, type, quartier, garage1, garage2, garageLuxe, salleASac, jardin, piscine, terrasse, etageres, description };
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
    lignesStockage.push(`> ${bien.article} dispose de **${bien.base} unités** de stockage + **${bien.frigo} unités** dans le frigo, soit **${bien.base + bien.frigo} unités** (HORS RSA) au total.`);
  } else {
    lignesStockage.push(`> ${bien.article} dispose de **${bien.base} unités** (HORS RSA) de stockage.`);
  }
  if (isTypeLuxe && garageLuxe) {
    const label = garageLuxe === 1 ? 'Le Garage 10 places de luxe dispose' : `Les ${garageLuxe} Garages 10 places de luxe disposent`;
    lignesStockage.push(`> ${label} de **${garageLuxeUnites} unités** supplémentaires.`);
    lignesStockage.push(`> ➡️ Soit un total de **${bien.base + bien.frigo + garageLuxeUnites} unités (HORS RSA)** de stockage disponibles, un vrai atout pour vos besoins de rangement !`);
  } else {
    if (garage1) lignesStockage.push(`> Le Garage ${GARAGE_LABELS[garage1]} dispose de **${garage1Unites} unités** (HORS RSA) supplémentaires.`);
    if (garage2) lignesStockage.push(`> Le Garage ${GARAGE_LABELS[garage2]} dispose de **${garage2Unites} unités** (HORS RSA) supplémentaires.`);
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
  if (bien.couleur)    lignesPlus.push(`> ${bien.couleur}`);

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

  const lignesDetails = [];
  if (!salleASac && !TYPES_SANS_SALLE_A_SAC.has(type)) {
    lignesDetails.push(`> 👜 Peut posséder une salle à sac`);
  }
  if (description) lignesDetails.push(`> ${description}`);
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

// ── Commande ──────────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('editannonce')
    .setDescription('✏️ Modifier les options d\'une annonce déjà publiée')
    .addStringOption(opt => opt
      .setName('message_id')
      .setDescription('ID du message à modifier (clic droit → Copier l\'identifiant)')
      .setRequired(true))
    .addStringOption(opt => {
      opt.setName('agent').setDescription('Nouvel agent en charge de l\'annonce').setRequired(false);
      AGENTS.forEach(a => opt.addChoices({ name: a.name, value: a.id }));
      return opt;
    })
    .addStringOption(opt => {
      opt.setName('type').setDescription('Type de bien').setRequired(false);
      Object.keys(BIENS).forEach(t => opt.addChoices({ name: t, value: t }));
      return opt;
    })
    .addStringOption(opt => opt
      .setName('image')
      .setDescription('URL de l\'image à afficher sur l\'annonce (laisser vide = conserver)')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('quartier')
      .setDescription('Nouveau quartier / emplacement')
      .setRequired(false))
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

    const newType  = interaction.options.getString('type') ?? current.type;
    const imageUrl = interaction.options.getString('image');

    const merged = {
      numero:      current.numero,
      type:        newType,
      transaction: current.transaction,
      quartier:    interaction.options.getString('quartier') ?? current.quartier,
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

    // Reconstruit les boutons en préservant (ou mettant à jour) le numero et l'agentId
    const newAgentId = interaction.options.getString('agent') ?? current.agentId;
    const suffix = newAgentId ? `${current.numero}_${newAgentId}` : current.numero;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`annonce_acheter_${suffix}`)
        .setLabel('🏠 Acheter ce bien')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`annonce_visiter_${suffix}`)
        .setLabel('👁️ Visiter le bien')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('annonce_notif')
        .setLabel('🔔 Être notifié des prochaines annonces')
        .setStyle(ButtonStyle.Secondary),
    );

    const editPayload = { content: newContent, components: [row], allowedMentions: { parse: ['roles'] } };
    if (imageUrl !== null) {
      editPayload.files       = [imageUrl];
      editPayload.attachments = [];
    }
    await message.edit(editPayload);
    await interaction.editReply({ content: '✅ Annonce mise à jour !' });
  },
};

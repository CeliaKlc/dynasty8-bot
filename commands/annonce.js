const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  OverwriteType,
} = require('discord.js');

const CATEGORIE_TICKETS_ID = '993616675670851659';

const ROLES_AUTORISES = [
  '917744433682849802', // Employé
  '1375930527873368066', // Direction
];

function toMathSansBold(str) {
  return str.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90)  return String.fromCodePoint(0x1D5D4 + (code - 65));
    if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D5EE + (code - 97));
    if (code >= 48 && code <= 57)  return String.fromCodePoint(0x1D7EC + (code - 48));
    return char;
  }).join('');
}

// ── Données par type de bien ───────────────────────────────────────────────────
const BIENS = {
  'Appartement Simple': {
    article: "L'Appartement Simple",
    base: 400, frigo: 0,
    caracteristiques: [
      '🛏️ 1 Chambre avec dressing',
      '🚿 1 Salle de bain',
      '🛋️ 1 Salon avec cuisine ouverte',
      '📺 2 Télévisions',
    ],
  },
  'Appartement Basique': {
    article: "L'Appartement Basique",
    base: 250, frigo: 0,
    caracteristiques: [
      '🛏️ 1 Chambre avec dressing',
      '🚿 1 Salle de bain',
      '📺 1 Télévision (fonctionnelle que sur le son)',
    ],
  },
  'Maison Simple': {
    article: 'La Maison Simple',
    base: 500, frigo: 0,
    caracteristiques: [
      '🛏️ 1 Chambre avec dressing',
      '🚿 1 Salle de bain',
      '🛋️ 1 Salon avec cuisine ouverte',
      '📺 2 Télévisions',
      '☕ 1 Cafetière',
    ],
  },
  'Caravane': {
    article: 'La Caravane',
    base: 200, frigo: 0,
    caracteristiques: [
      '🛏️ 1 Chambre avec dressing',
      '🚿 1 Salle de bain',
      '🛋️ 1 Salon avec cuisine ouverte',
      '📺 1 Télévision',
    ],
  },
  'Appartement Favelas': {
    article: "L'Appartement Favelas",
    base: 300, frigo: 0,
    caracteristiques: [
      '🛏️ 2 Chambres',
      '🪞 1 Dressing',
      '🛋️ 1 Salon',
      '🍳 1 Cuisine',
      '🚿 1 Salle de bain',
      '📺 1 Télévision',
    ],
  },
  'Maison Favelas': {
    article: 'La Maison Favelas',
    base: 500, frigo: 0,
    caracteristiques: [
      '🛏️ 1 Chambre avec dressing',
      '🛋️ 1 Salon',
      '🍳 1 Cuisine',
      '🚿 1 Salle de bain',
      '📺 2 Télévisions',
    ],
  },
  'Studio de Luxe': {
    article: 'Le Studio de Luxe',
    base: 500, frigo: 100,
    caracteristiques: [
      '🛏️ 1 Chambre avec dressing',
      '🛋️ 1 Salon avec cuisine ouverte',
      '🚿 1 Salle de bain',
      '📺 1 Télévision',
      '✨ Intérieur vivant (store qui ferme, etc.)',
    ],
  },
  'Appartement Moderne': {
    article: "L'Appartement Moderne",
    base: 500, frigo: 0,
    caracteristiques: [
      '🛏️ 1 Chambre avec dressing',
      '🚿 1 Salle de bain',
      '🛋️ 1 Salon avec cuisine ouverte',
      '🖥️ 1 Bureau',
      '📺 1 Télévision',
    ],
  },
  'Duplex': {
    article: 'Le Duplex',
    base: 600, frigo: 100,
    caracteristiques: [
      '🛏️ 1 Chambre avec dressing',
      '🚿 1 Salle de bain',
      '🛋️ 1 Salon avec cuisine ouverte',
      '🖥️ 1 Bureau',
      '🏠 2 Étages',
      '📺 1 Télévision',
    ],
  },
  'Appartement de Luxe Modifiable': {
    article: "L'Appartement de Luxe Modifiable",
    base: 750, frigo: 0,
    caracteristiques: [
      '🛏️ 1 Chambre avec dressing',
      '🚿 1 Salle de bain',
      '🛋️ 1 Salon avec cuisine ouverte',
      '🖥️ 1 Bureau',
      '☕ 1 Cafetière',
      '📺 1 Télévision',
      '🔧 Intérieur modifiable',
    ],
  },
  'Villa': {
    article: 'La Villa',
    base: 800, frigo: 100,
    caracteristiques: [
      '🛏️ 1 Chambre avec dressing',
      '🚿 1 Salle de bain',
      '🛋️ 1 Salon avec cuisine ouverte',
      '🖥️ 1 Bureau',
      '🏠 3 Étages',
      '📺 1 Télévision',
    ],
  },
  'Maison de Luxe': {
    article: 'La Maison de Luxe',
    base: 2000, frigo: 0,
    caracteristiques: [
      '🛏️ 2 Chambres avec dressing',
      '🚿 2 Salles de bain',
      '🛋️ 1 Salon avec cuisine ouverte',
      '🖥️ 1 Bureau',
      '🃏 Salle de poker',
      '🍷 Salle à vin',
      '📺 Télévisions',
    ],
  },
  'Villa de Luxe': {
    article: 'La Villa de Luxe',
    base: 2000, frigo: 0,
    caracteristiques: [
      '🛏️ 4 Chambres avec dressing',
      '🚿 4 Salles de bain',
      '🛋️ 1 Salon avec cuisine ouverte',
      '🖥️ 1 Bureau avec salle de réunion',
      '💪 1 Salle de sport',
      '🎙️ Studio d\'enregistrement',
      '🏊 Piscine intérieure avec jacuzzi',
      '🏠 2 Étages',
      '📺 Télévisions',
    ],
  },
  'Bureau': {
    article: 'Le Bureau',
    base: 750, frigo: 0,
    caracteristiques: [
      '🛏️ 1 Chambre avec dressing',
      '🚿 1 Salle de bain',
      '🖥️ 1 Bureau',
      '🤝 1 Salle de réunion',
      '📺 1 Télévision',
      '🔧 Intérieur modifiable',
    ],
  },
  'Agence': {
    article: "L'Agence",
    base: 800, frigo: 0,
    caracteristiques: [
      '🛏️ 1 Chambre avec dressing',
      '🚿 1 Salle de bain',
      '🛋️ 1 Salon avec cuisine ouverte',
      '🖥️ 3 Bureaux',
      '🤝 1 Salle de réunion',
      '🚁 1 Héliport',
      '🛎️ 1 Accueil',
      '📺 1 Télévision',
      '🔧 Intérieur modifiable',
    ],
  },
  'Hangar': {
    article: 'Le Hangar',
    base: 500, frigo: 0,
    caracteristiques: [
      '🧺 Machine à laver',
    ],
  },
  'Entrepôt': {
    article: "L'Entrepôt",
    base: 600, frigo: 0,
    caracteristiques: [
      '🖥️ 1 Bureau',
      '🪞 1 Dressing',
      '🔧 Intérieur modifiable',
      '📦 Des racks',
    ],
  },
};

// Unités de stockage par taille de garage
const STOCKAGE_GARAGE = { '2': 50, '6': 200, '10': 400 };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('annonce')
    .setDescription('📢 Publier une annonce immobilière Dynasty 8')
    .addStringOption(opt => opt
      .setName('numero')
      .setDescription('Numéro de référence de l\'annonce (ex: 1336)')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('type')
      .setDescription('Type de bien')
      .setRequired(true)
      .addChoices(
        { name: 'Appartement Simple',             value: 'Appartement Simple' },
        { name: 'Appartement Basique',            value: 'Appartement Basique' },
        { name: 'Maison Simple',                  value: 'Maison Simple' },
        { name: 'Caravane',                       value: 'Caravane' },
        { name: 'Appartement Favelas',            value: 'Appartement Favelas' },
        { name: 'Maison Favelas',                 value: 'Maison Favelas' },
        { name: 'Studio de Luxe',                 value: 'Studio de Luxe' },
        { name: 'Appartement Moderne',            value: 'Appartement Moderne' },
        { name: 'Duplex',                         value: 'Duplex' },
        { name: 'Appartement de Luxe Modifiable', value: 'Appartement de Luxe Modifiable' },
        { name: 'Villa',                          value: 'Villa' },
        { name: 'Maison de Luxe',                 value: 'Maison de Luxe' },
        { name: 'Villa de Luxe',                  value: 'Villa de Luxe' },
        { name: 'Bureau',                         value: 'Bureau' },
        { name: 'Agence',                         value: 'Agence' },
        { name: 'Hangar',                         value: 'Hangar' },
        { name: 'Entrepôt',                       value: 'Entrepôt' },
      ))
    .addStringOption(opt => opt
      .setName('transaction')
      .setDescription('Type de transaction')
      .setRequired(true)
      .addChoices(
        { name: '🏷️ Vente',   value: 'vente' },
        { name: '🔑 Location', value: 'location' },
      ))
    .addStringOption(opt => opt
      .setName('quartier')
      .setDescription('Quartier / emplacement du bien')
      .setRequired(true))
    .addAttachmentOption(opt => opt
      .setName('image')
      .setDescription('Photo du bien (obligatoire)')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('garage')
      .setDescription('Garage inclus ? Si oui, combien de places ?')
      .setRequired(false)
      .addChoices(
        { name: '🚗 2 places',  value: '2' },
        { name: '🚗 6 places',  value: '6' },
        { name: '🚗 10 places', value: '10' },
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
    .addStringOption(opt => opt
      .setName('description')
      .setDescription('Description libre (détails supplémentaires...)')
      .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const numero      = interaction.options.getString('numero');
    const type        = interaction.options.getString('type');
    const transaction = interaction.options.getString('transaction');
    const quartier    = interaction.options.getString('quartier');
    const image       = interaction.options.getAttachment('image');
    const garage      = interaction.options.getString('garage');
    const jardin      = interaction.options.getBoolean('jardin');
    const piscine     = interaction.options.getBoolean('piscine');
    const terrasse    = interaction.options.getBoolean('terrasse');
    const description = interaction.options.getString('description');

    const isVente          = transaction === 'vente';
    const transactionLabel = isVente ? 'À VENDRE' : 'À LOUER';

    const bien         = BIENS[type] ?? { article: 'Le bien', base: 0, frigo: 0, caracteristiques: [] };
    const garageUnites = garage ? STOCKAGE_GARAGE[garage] : 0;

    // ── STOCKAGE (narratif) ──
    const lignesStockage = [];
    if (bien.frigo > 0) {
      lignesStockage.push(`> ${bien.article} dispose de **${bien.base} unités** de stockage + **${bien.frigo} unités** dans le frigo, soit **${bien.base + bien.frigo} unités** au total.`);
    } else {
      lignesStockage.push(`> ${bien.article} dispose de **${bien.base} unités** de stockage.`);
    }
    if (garage) {
      lignesStockage.push(`> Le Garage ${garage} places dispose de **${garageUnites} unités** supplémentaires.`);
      const total = bien.base + bien.frigo + garageUnites;
      lignesStockage.push(`> ➡️ Soit un total de **${total} unités (HORS RSA)** de stockage disponibles, un vrai atout pour vos besoins de rangement !`);
    }

    // ── CONFORT & ESPACE (auto selon le type) ──
    const lignesConfort = bien.caracteristiques.map(c => `> ${c}`);

    // ── LES + ──
    const lignesPlus = [];
    if (garage)   lignesPlus.push(`> 🚗 Garage ${garage} places`);
    if (jardin)   lignesPlus.push(`> 🌿 Jardin`);
    if (terrasse) lignesPlus.push(`> ☀️ Terrasse`);
    if (piscine)  lignesPlus.push(`> 🏊 Piscine`);

    // ── Construction du message ──
    const lignes = [
      `**━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━**`,
      `✨ **${transactionLabel} : ${type}** ✨`,
      `**━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━**`,
      ``,
      `Chers <@&${process.env.ROLE_NOTIFICATIONS_LBC_ID}>,`,
      ``,
      `**📍 EMPLACEMENT**`,
      `> 📍 ${quartier}`,
    ];

    lignes.push(``, `**📦 STOCKAGE**`);
    lignes.push(...lignesStockage);

    if (lignesConfort.length > 0) {
      lignes.push(``, `**🛋️ CONFORT & ESPACE**`);
      lignes.push(...lignesConfort);
    }

    if (lignesPlus.length > 0) {
      lignes.push(``, `**✨ LES +**`);
      lignes.push(...lignesPlus);
    }

    if (description) {
      lignes.push(``, `**📝 DÉTAILS**`, `> ${description}`);
    }

    lignes.push(``, `*Dynasty 8 — Transformons vos projets immobiliers en réalité. 🏡*`);

    const contenu = lignes.join('\n');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`annonce_acheter_${numero}`)
        .setLabel('🏠 Acheter ce bien')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`annonce_visiter_${numero}`)
        .setLabel('👁️ Visiter le bien')
        .setStyle(ButtonStyle.Primary),
    );

    await interaction.channel.send({ content: contenu, files: [image.url], components: [row] });
    await interaction.editReply({ content: '✅ Annonce publiée !' });
  },
};

// ─── Handler des boutons Acheter / Visiter ────────────────────────────────────
async function handleAnnonceButton(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const parts  = interaction.customId.split('_');
  const action = parts[1]; // 'acheter' ou 'visiter'
  const numero = parts.slice(2).join('_');

  const isAchat     = action === 'acheter';
  const emoji       = isAchat ? '🏠' : '👁️';
  const actionLabel = isAchat ? 'Acheter' : 'Visiter';
  const channelName = `${emoji}${toMathSansBold(numero)}_${toMathSansBold(actionLabel)}`;

  const guild  = interaction.guild;
  const member = interaction.member;

  let ticketChannel;
  try {
    ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: CATEGORIE_TICKETS_ID,
      permissionOverwrites: [
        {
          id: guild.id,
          type: OverwriteType.Role,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: member.id,
          type: OverwriteType.Member,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        },
        ...ROLES_AUTORISES.map(roleId => ({
          id: roleId,
          type: OverwriteType.Role,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
        })),
      ],
    });
  } catch (err) {
    console.error('[ANNONCE] Erreur création ticket :', err.message);
    return interaction.editReply({ content: '❌ Impossible de créer le ticket. Contacte un administrateur.' });
  }

  const embed = new EmbedBuilder()
    .setColor(isAchat ? 0x2ECC71 : 0x3498DB)
    .setTitle(`${emoji} Demande de ${actionLabel.toLowerCase()} — Bien #${numero}`)
    .setDescription(
      `Bonjour ${member} ! 👋\n\n` +
      `Ta demande concernant le bien **#${numero}** a bien été reçue.\n` +
      `Un agent va prendre en charge ta demande très prochainement.\n\n` +
      `N'hésite pas à préciser ta demande ici.`
    )
    .setFooter({ text: 'Dynasty 8 • Baylife RP' })
    .setTimestamp();

  await ticketChannel.send({ content: `${member}`, embeds: [embed] });
  await interaction.editReply({ content: `✅ Ton ticket a été créé : ${ticketChannel}` });
}

module.exports.handleAnnonceButton = handleAnnonceButton;

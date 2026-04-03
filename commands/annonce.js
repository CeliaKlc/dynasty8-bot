const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  OverwriteType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const CATEGORIE_TICKETS_ID = '993616675670851659';
const ROLE_NOTIFICATIONS_LBC_ID = '1345415367333380156';

// ─── Agents (ID Discord → emoji) ─────────────────────────────────────────────
const AGENTS = [
  { name: 'Sacha Rollay',         id: '314057285523472394',  emoji: '🦊', feminin: true  },
  { name: 'Ely Rollay',           id: '261956403546161152',  emoji: '🦦', feminin: false },
  { name: 'Marco Romanov',        id: '1151865005239697449', emoji: '🐻', feminin: false },
  { name: 'John Russet',          id: '922112971793133568',  emoji: '🦍', feminin: false },
  { name: 'Joy Lutz',             id: '342355371941167126',  emoji: '🐍', feminin: true  },
  { name: 'Hain Ergy',            id: '273565768355151874',  emoji: '🐲', feminin: false },
  { name: 'Maksim Anatolyevich',  id: '343731754311614465',  emoji: '🦁', feminin: false },
  { name: 'John Macafey',         id: '394751095932583937',  emoji: '🐳', feminin: false },
];

const AGENT_EMOJIS   = Object.fromEntries(AGENTS.map(a => [a.id, a.emoji]));
const AGENT_FEMININ  = Object.fromEntries(AGENTS.map(a => [a.id, a.feminin]));

const ROLES_AUTORISES = [
  '917744433682849802', // Employé
  '1375930527873368066', // Direction
];

// ─── Rôles ayant accès aux tickets LBC ───────────────────────────────────────
const ROLES_TICKETS_LBC = [
  '1045639426170167358', // Gestionnaire-LBC
  '1373792350991683687', // Responsable-LBC
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
    base: 500, frigo: 0,
    caracteristiques: [
      'Chambre avec dressing',
      'Salle de bain',
      'Salon avec cuisine ouverte',
      '1 Télévision',
      'Cafetière',
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
  'Duplex': {
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
  'Appartement de Luxe Modifiable': {
    article: "L'Appartement de Luxe Modifiable",
    base: 750, frigo: 0, modifiable: true,
    caracteristiques: [
      'Chambre avec dressing',
      'Salle de bain',
      'Salon avec cuisine ouverte',
      'Bureau',
      'Cafetière',
      'Télévision',
    ],
  },
  'Villa': {
    article: 'La Villa',
    base: 800, frigo: 100,
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
    base: 2000, frigo: 0,
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
      "2 Etages",
      "Étage de bureaux",
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
    caracteristiques: [
      '2 places véhicule'
    ],
  },
  'Garage 6 places': {
    article: 'Le Garage 6 places',
    base: 200, frigo: 0,
    caracteristiques: [
      '6 places véhicules',
      '2 porte vélo'
    ],
  },
  'Garage 10 places': {
    article: 'Le Garage 10 places',
    base: 400, frigo: 0,
    caracteristiques: [
      '10 places véhicules',
      '6 porte vélo'
    ],
  },
  'Garage 26 places': {
    article: 'Le Garage 26 places',
    base: 500, frigo: 0,
    caracteristiques: [
      '26 places véhicules',
      '3 étages',
      'Intérieur modifiable'
    ],
  },
  'Loft Garage': {
    article: 'Le Loft Garage',
    base: 500, frigo: 0,
    caracteristiques: [
      'Salon avec Dressing',
      '4 places véhicules',
      'Intérieur modifiable'
    ],
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

// Labels affichés pour salle à sac
const SALLE_A_SAC_LABELS = {
  '1': 'Salle à sac',
  '2': 'Salle à sac avec une extension',
  '3': 'Salle à sac avec deux extensions',
};

const DYNASTY8 = toMathSansBold('DYNASTY 8');

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
        { name: 'Garage 2 places',                value: 'Garage 2 places' },
        { name: 'Garage 6 places',                value: 'Garage 6 places' },
        { name: 'Garage 10 places',               value: 'Garage 10 places' },
        { name: 'Garage 26 places',               value: 'Garage 26 places' },
        { name: 'Loft Garage',                    value: 'Loft Garage' },
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
    .addStringOption(opt => {
      opt.setName('agent')
        .setDescription('Agent en charge de cette annonce')
        .setRequired(true);
      AGENTS.forEach(a => opt.addChoices({ name: `${a.emoji} ${a.name}`, value: a.id }));
      return opt;
    })
    .addStringOption(opt => opt
      .setName('garage_1')
      .setDescription('1er garage inclus ?')
      .setRequired(false)
      .addChoices(
        { name: '🚗 2 places',         value: '2' },
        { name: '🚗 6 places',         value: '6' },
        { name: '🚗 10 places',        value: '10' },
        { name: '🚗 Loft Garage',      value: 'loft' },
        { name: '🚗 26 places (Agence uniquement)', value: '26' },
      ))
    .addStringOption(opt => opt
      .setName('garage_2')
      .setDescription('2ème garage inclus ?')
      .setRequired(false)
      .addChoices(
        { name: '🚗 2 places',         value: '2' },
        { name: '🚗 6 places',         value: '6' },
        { name: '🚗 10 places',        value: '10' },
        { name: '🚗 Loft Garage',      value: 'loft' },
        { name: '🚗 26 places (Agence uniquement)', value: '26' },
      ))
    .addIntegerOption(opt => opt
      .setName('garage_luxe')
      .setDescription('⚠️ Villa de Luxe / Maison de Luxe uniquement — Nombre de Garages 10 places de luxe (1 à 4)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(4))
    .addStringOption(opt => opt
      .setName('salle_a_sac')
      .setDescription('Salle à sac incluse ?')
      .setRequired(false)
      .addChoices(
        { name: '🎒 Salle à sac',                    value: '1' },
        { name: '🎒 Salle à sac + 1 extension',      value: '2' },
        { name: '🎒 Salle à sac + 2 extensions',     value: '3' },
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
      .setDescription('⚠️ Entrepôt uniquement — Nombre d\'étagères (1 à 25, 1 étagère = 600 unités)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(25))
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
    const garage1     = interaction.options.getString('garage_1');
    const garage2     = interaction.options.getString('garage_2');
    const garageLuxe  = interaction.options.getInteger('garage_luxe');
    const salleASac   = interaction.options.getString('salle_a_sac');
    const isTypeLuxe  = type === 'Villa de Luxe' || type === 'Maison de Luxe';

    if (garageLuxe && !isTypeLuxe) {
      return interaction.editReply({ content: `❌ L'option **garage_luxe** est réservée aux types **Villa de Luxe** et **Maison de Luxe**. Pour les autres biens, utilise **garage_1** et **garage_2**.` });
    }

    if ((garage1 === '26' || garage2 === '26') && type !== 'Agence') {
      return interaction.editReply({ content: `❌ Le **Garage 26 places** est réservé au type **Agence**.` });
    }
    const jardin        = interaction.options.getBoolean('jardin');
    const piscine       = interaction.options.getBoolean('piscine');
    const terrasse      = interaction.options.getBoolean('terrasse');
    const etageres      = interaction.options.getInteger('etageres');
    const description   = interaction.options.getString('description');

    if (etageres && type !== 'Entrepôt') {
      return interaction.editReply({ content: `❌ L'option **etageres** est réservée au type **Entrepôt**.` });
    }

    const transactionLabel = transaction === 'vente' ? 'À VENDRE' : 'À LOUER';

    const bien                = BIENS[type] ?? { article: 'Le bien', base: 0, frigo: 0, caracteristiques: [] };
    const garageLuxeUnites    = isTypeLuxe && garageLuxe ? garageLuxe * STOCKAGE_GARAGE['10l'] : 0;
    const garage1Unites       = !isTypeLuxe && garage1 ? STOCKAGE_GARAGE[garage1] : 0;
    const garage2Unites       = !isTypeLuxe && garage2 ? STOCKAGE_GARAGE[garage2] : 0;
    const totalGarageUnites   = isTypeLuxe ? garageLuxeUnites : garage1Unites + garage2Unites;

    // ── STOCKAGE (narratif) ──
    const lignesStockage = [];
    if (type === 'Entrepôt' && etageres) {
      const totalEtageres = etageres * 600;
      const MAX_ENTREPOT  = 25 * 600; // 15000
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
      const total = bien.base + bien.frigo + garageLuxeUnites;
      lignesStockage.push(`> ➡️ Soit un total de **${total} unités (HORS RSA)** de stockage disponibles, un vrai atout pour vos besoins de rangement !`);
    } else {
      if (garage1) lignesStockage.push(`> Le Garage ${GARAGE_LABELS[garage1]} dispose de **${garage1Unites} unités** supplémentaires.`);
      if (garage2) lignesStockage.push(`> Le Garage ${GARAGE_LABELS[garage2]} dispose de **${garage2Unites} unités** supplémentaires.`);
      if (garage1 || garage2) {
        const total = bien.base + bien.frigo + totalGarageUnites;
        lignesStockage.push(`> ➡️ Soit un total de **${total} unités (HORS RSA)** de stockage disponibles, un vrai atout pour vos besoins de rangement !`);
      }
    }

    // ── INTÉRIEUR (auto selon le type) ──
    const lignesInterieur = bien.caracteristiques.map(c => `> - ${c}`);

    // ── LES + ──
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

    // ── Suffixe du titre avec les garages ──
    let garagesTitre = '';
    if (isTypeLuxe && garageLuxe) {
      garagesTitre = `${garageLuxe} × Garage 10 places de luxe`;
    } else {
      garagesTitre = [garage1, garage2]
        .filter(Boolean)
        .map(g => `Garage ${GARAGE_LABELS[g]}`)
        .join(' & ');
    }

    // ── Construction du message ──
    const lignes = [
      `━━━━━━━━━━━━━━━━━━━━━━━`,
      `        ·         ${DYNASTY8}          ·`,
      `━━━━━━━━━━━━━━━━━━━━━━━`,
      `✨ **${transactionLabel} : ${type}${garagesTitre ? ` avec ${garagesTitre}` : ''}** ✨`,
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

    if (description) {
      lignes.push(``, `**📝 DÉTAILS**`, `> ${description}`);
    }

    if (bien.entrepriseOnly) {
      lignes.push(``, `## <a:407265yellowsiren:1489238394826522664> Ce bien est disponible uniquement pour les *entreprises*. <a:407265yellowsiren:1489238394826522664>`);
    }
    lignes.push(``);
    lignes.push(``);
    lignes.push(`*Vous souhaitez être notifié pour chaque bien ? N'hésitez pas à activer votre rôle juste ici* → https://discord.com/channels/814919928233721856/915990552745500692`);
    lignes.push(``);
    lignes.push(`*<:Dynasty8:1489223936620236841> Dynasty 8 — Transformons vos projets immobiliers en réalité.*`);

    const contenu = lignes.join('\n');

    const agentId = interaction.options.getString('agent');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`annonce_acheter_${numero}_${agentId}`)
        .setLabel('🏠 Acheter ce bien')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`annonce_visiter_${numero}_${agentId}`)
        .setLabel('👁️ Visiter le bien')
        .setStyle(ButtonStyle.Primary),
    );

    await interaction.channel.send({ content: contenu, files: [image.url], components: [row], allowedMentions: { parse: ['roles'] } });
    await interaction.editReply({ content: '✅ Annonce publiée !' });
  },
};

// ─── Handler des boutons Acheter / Visiter → affiche le modal ────────────────
async function handleAnnonceButton(interaction) {
  const parts   = interaction.customId.split('_');
  const action  = parts[1]; // 'acheter' ou 'visiter'
  const agentId = parts[parts.length - 1]; // dernier segment = ID agent
  const numero  = parts.slice(2, parts.length - 1).join('_');

  const modal = new ModalBuilder()
    .setCustomId(`annonce_modal_${action}_${numero}_${agentId}`)
    .setTitle(action === 'acheter' ? '🏠 Demande d\'achat' : '👁️ Demande de visite');

  const nomPrenomInput = new TextInputBuilder()
    .setCustomId('nom_prenom')
    .setLabel('Nom Prénom')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex : Jean Dupont')
    .setRequired(true);

  const telephoneInput = new TextInputBuilder()
    .setCustomId('telephone')
    .setLabel('Numéro de téléphone')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex : 555-0123')
    .setRequired(true);

  const disponibilitesInput = new TextInputBuilder()
    .setCustomId('disponibilites')
    .setLabel('Vos disponibilités')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('(le terme « maintenant » ne constitue pas une disponibilité)')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nomPrenomInput),
    new ActionRowBuilder().addComponents(telephoneInput),
    new ActionRowBuilder().addComponents(disponibilitesInput),
  );

  await interaction.showModal(modal);
}

// ─── Handler du modal soumis → crée le ticket ────────────────────────────────
async function handleAnnonceModal(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const parts   = interaction.customId.split('_'); // ['annonce','modal','acheter','1234','agentId']
  const action  = parts[2];
  const agentId = parts[parts.length - 1]; // dernier segment = ID agent
  const numero  = parts.slice(3, parts.length - 1).join('_');

  const nomPrenom       = interaction.fields.getTextInputValue('nom_prenom');
  const telephone       = interaction.fields.getTextInputValue('telephone');
  const disponibilites  = interaction.fields.getTextInputValue('disponibilites');

  const isAchat     = action === 'acheter';
  const emoji       = isAchat ? '🏠' : '👁️';
  const actionLabel = isAchat ? 'Acheter' : 'Visiter';
  const agentEmoji  = AGENT_EMOJIS[agentId] ?? emoji;
  const channelName = `${agentEmoji}⌛${toMathSansBold(numero)}_${toMathSansBold(actionLabel)}`;

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
        ...ROLES_TICKETS_LBC.map(roleId => ({
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
    .setTitle(`${emoji} Demande pour ${actionLabel.toLowerCase()} — Bien #${numero}`)
    .setDescription(
      `Bienvenue ${member} ! 👋\n\n` +
      `Ta demande concernant le bien **#${numero}** a bien été reçue.\n` +
      `Un agent va prendre en charge ta demande très prochainement.\n\n` +
      `**👤 Nom Prénom :** ${nomPrenom}\n` +
      `**📞 Numéro de téléphone :** ${telephone}\n` +
      `**🗓️ Disponibilités :** ${disponibilites}\n\n` +
      `⚠️ Important : Tout ticket ne comportant pas de formule de politesse **sera automatiquement clos**.\n\n` +
      `Vous avez changé d'avis ? Réagissez avec 🔒 pour annuler votre demande et fermer le ticket.`
    )
    .setFooter({ text: 'Dynasty 8' })
    .setTimestamp();

  const clotureRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_fermer')
      .setLabel('🔒 Fermer le ticket')
      .setStyle(ButtonStyle.Danger),
  );

  await ticketChannel.send({ embeds: [embed], components: [clotureRow] });
  await ticketChannel.send({
    content: (() => {
      const heure      = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', hour12: false });
      const salutation = parseInt(heure) >= 18 ? 'une bonne soirée' : 'une bonne journée';
      const pronom     = AGENT_FEMININ[agentId] ? 'elle' : 'il';
      return `Bonjour,\nJe vous assigne l'agent en charge de cette annonce <@${agentId}>, ${pronom} vous répondra quand ${pronom} sera disponible !\n\nEn vous souhaitant ${salutation} !\nCordialement,\n-# Dynasty 8 <:Dynasty8:1489223936620236841>`;
    })(),
    allowedMentions: { users: [agentId] },
  });
  await interaction.editReply({ content: `✅ Ton ticket a été créé : ${ticketChannel}` });
}

module.exports.handleAnnonceButton = handleAnnonceButton;
module.exports.handleAnnonceModal  = handleAnnonceModal;
module.exports.BIENS               = BIENS;
module.exports.STOCKAGE_GARAGE     = STOCKAGE_GARAGE;
module.exports.GARAGE_LABELS       = GARAGE_LABELS;
module.exports.SALLE_A_SAC_LABELS  = SALLE_A_SAC_LABELS;

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

const { AGENTS, buildAnnonceContent } = require('../utils/annonceBuilder');

const AGENT_EMOJIS  = Object.fromEntries(AGENTS.map(a => [a.id, a.emoji]));
const AGENT_FEMININ = Object.fromEntries(AGENTS.map(a => [a.id, a.feminin]));

const ROLES_AUTORISES = [
  '917744433682849802',   // Employé
  '1375930527873368066',  // Direction
];

// ─── Rôles ayant accès aux tickets LBC ───────────────────────────────────────
const ROLES_TICKETS_LBC = [
  '1045639426170167358',  // Gestionnaire-LBC
  '1373792350991683687',  // Responsable-LBC
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
        { name: 'Duplex (avec Frigo)',            value: 'Duplex (avec Frigo)' },
        { name: 'Duplex (sans Frigo)',            value: 'Duplex (sans Frigo)' },
        { name: 'Appartement de Luxe Modifiable', value: 'Appartement de Luxe Modifiable' },
        { name: 'Villa Blanche',                  value: 'Villa Blanche' },
        { name: 'Villa Rouge',                    value: 'Villa Rouge' },
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
      .setDescription('Situé ex : (à ....., proche de ...')
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
      .setName('balcon')
      .setDescription('Balcon inclus ? - Nombre de balcons présents')
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
    const balcon        = interaction.options.getInteger('balcon');
    const etageres      = interaction.options.getInteger('etageres');
    const description   = interaction.options.getString('description');

    if (etageres && type !== 'Entrepôt') {
      return interaction.editReply({ content: `❌ L'option **etageres** est réservée au type **Entrepôt**.` });
    }

    // ── Construction du message (via utilitaire partagé) ──
    const contenu = buildAnnonceContent({ type, transaction, quartier, garage1, garage2, garageLuxe, salleASac, jardin, piscine, terrasse, balcon, etageres, description });

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
      new ButtonBuilder()
        .setCustomId('annonce_notif')
        .setLabel('🔔 Être notifié des prochaines annonces')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.channel.send({ content: contenu, files: [{ attachment: image.url, name: image.name }], components: [row], allowedMentions: { parse: ['roles'] } });
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
    .setPlaceholder('Ex : Sacha Rollay')
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
      const politesse = parseInt(heure) >= 18 ? 'Bonsoir' : 'Bonjour';
      const pronom     = AGENT_FEMININ[agentId] ? 'elle' : 'il';
      return `${politesse},\nJe vous assigne l'agent en charge de cette annonce <@${agentId}>, ${pronom} vous répondra quand ${pronom} sera disponible !\n\nEn vous souhaitant ${salutation} !\nCordialement,\n-# Dynasty 8 <:Dynasty8:1489223936620236841>`;
    })(),
    allowedMentions: { users: [agentId] },
  });
  await interaction.editReply({ content: `✅ Ton ticket a été créé : ${ticketChannel}` });
}

module.exports.handleAnnonceButton = handleAnnonceButton;
module.exports.handleAnnonceModal  = handleAnnonceModal;
// Les constantes (BIENS, AGENTS, etc.) sont exportées depuis utils/annonceBuilder.js

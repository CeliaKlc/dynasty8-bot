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
        { name: 'Appartement Simple',  value: 'Appartement Simple' },
        { name: 'Appartement de Luxe', value: 'Appartement de Luxe' },
        { name: 'Maison',              value: 'Maison' },
        { name: 'Villa',               value: 'Villa' },
        { name: 'Local Commercial',    value: 'Local Commercial' },
        { name: 'Terrain',             value: 'Terrain' },
        { name: 'Garage',              value: 'Garage' },
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
    .addStringOption(opt => opt
      .setName('prix')
      .setDescription('Prix du bien (ex: 160\'000$)')
      .setRequired(true))
    .addAttachmentOption(opt => opt
      .setName('image')
      .setDescription('Photo du bien (obligatoire)')
      .setRequired(true))
    .addIntegerOption(opt => opt
      .setName('chambres')
      .setDescription('Nombre de chambres')
      .setRequired(false))
    .addIntegerOption(opt => opt
      .setName('salons')
      .setDescription('Nombre de salons')
      .setRequired(false))
    .addIntegerOption(opt => opt
      .setName('salles_de_bain')
      .setDescription('Nombre de salles de bain')
      .setRequired(false))
    .addIntegerOption(opt => opt
      .setName('stockage')
      .setDescription('Capacité de stockage (unités)')
      .setRequired(false))
    .addBooleanOption(opt => opt
      .setName('garage')
      .setDescription('Garage inclus ?')
      .setRequired(false))
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
    .addBooleanOption(opt => opt
      .setName('salle_a_manger')
      .setDescription('Salle à manger incluse ?')
      .setRequired(false))
    .addBooleanOption(opt => opt
      .setName('dressing')
      .setDescription('Dressing inclus ?')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('description')
      .setDescription('Description libre (équipements, détails supplémentaires...)')
      .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const numero       = interaction.options.getString('numero');
    const type         = interaction.options.getString('type');
    const transaction  = interaction.options.getString('transaction');
    const quartier     = interaction.options.getString('quartier');
    const prix         = interaction.options.getString('prix');
    const image        = interaction.options.getAttachment('image');
    const description  = interaction.options.getString('description');
    const stockage     = interaction.options.getInteger('stockage');
    const chambres     = interaction.options.getInteger('chambres');
    const salons       = interaction.options.getInteger('salons');
    const sallesDeBain = interaction.options.getInteger('salles_de_bain');
    const garage       = interaction.options.getBoolean('garage');
    const jardin       = interaction.options.getBoolean('jardin');
    const piscine      = interaction.options.getBoolean('piscine');
    const terrasse     = interaction.options.getBoolean('terrasse');
    const salleAManger = interaction.options.getBoolean('salle_a_manger');
    const dressing     = interaction.options.getBoolean('dressing');

    const isVente = transaction === 'vente';
    const transactionLabel = isVente ? 'À VENDRE' : 'À LOUER';
    const couleur = isVente ? 0xC9A84C : 0x2ECC71;

    // Construction des caractéristiques
    const caracteristiques = [];
    if (chambres)     caracteristiques.push(`🛏️ ${chambres} Chambre${chambres > 1 ? 's' : ''}`);
    if (salons)       caracteristiques.push(`🛋️ ${salons} Salon${salons > 1 ? 's' : ''}`);
    if (sallesDeBain) caracteristiques.push(`🚿 ${sallesDeBain} Salle${sallesDeBain > 1 ? 's' : ''} de bain`);
    if (stockage)     caracteristiques.push(`📦 ${stockage} unités de stockage`);
    if (dressing)     caracteristiques.push('🪞 Dressing');
    if (salleAManger) caracteristiques.push('🍽️ Salle à manger');
    if (garage)       caracteristiques.push('🚗 Garage');
    if (jardin)       caracteristiques.push('🌿 Jardin');
    if (terrasse)     caracteristiques.push('☀️ Terrasse');
    if (piscine)      caracteristiques.push('🏊 Piscine');

    const embed = new EmbedBuilder()
      .setColor(couleur)
      .setTitle(`✨ ${transactionLabel} : ${type} ✨`)
      .addFields(
        { name: '📍 Emplacement', value: quartier, inline: false },
        { name: '💰 Prix',        value: prix,      inline: true },
        { name: '🔢 Réf.',        value: `#${numero}`, inline: true },
      );

    if (caracteristiques.length > 0) {
      embed.addFields({ name: '🏠 Caractéristiques', value: caracteristiques.join('\n'), inline: false });
    }

    if (description) {
      embed.addFields({ name: '📝 Détails', value: description, inline: false });
    }

    embed
      .setImage(image.url)
      .setFooter({ text: 'Dynasty 8 — Transformons vos projets immobiliers en réalité. 🏡' })
      .setTimestamp();

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

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.editReply({ content: '✅ Annonce publiée !' });
  },
};

// ─── Handler des boutons Acheter / Visiter ────────────────────────────────────
async function handleAnnonceButton(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const parts  = interaction.customId.split('_');
  const action = parts[1]; // 'acheter' ou 'visiter'
  const numero = parts.slice(2).join('_');

  const isAchat      = action === 'acheter';
  const emoji        = isAchat ? '🏠' : '👁️';
  const actionLabel  = isAchat ? 'Acheter' : 'Visiter';
  const channelName  = `${emoji}${toMathSansBold(numero)}_${toMathSansBold(actionLabel)}`;

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

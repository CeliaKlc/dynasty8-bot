const {
  SlashCommandBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');

// Stockage temporaire des salons cibles entre la commande et le modal
const pendingChannels = new Map(); // userId → channelId[]

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Envoyer un message embed personnalisé')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt => opt
      .setName('salon1')
      .setDescription('Salon de destination n°1 (par défaut : salon actuel)')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false))
    .addChannelOption(opt => opt
      .setName('salon2')
      .setDescription('Salon de destination n°2')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false))
    .addChannelOption(opt => opt
      .setName('salon3')
      .setDescription('Salon de destination n°3')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false))
    .addChannelOption(opt => opt
      .setName('salon4')
      .setDescription('Salon de destination n°4')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false))
    .addChannelOption(opt => opt
      .setName('salon5')
      .setDescription('Salon de destination n°5')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false))
    .addChannelOption(opt => opt
      .setName('salon6')
      .setDescription('Salon de destination n°6')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false))
    .addChannelOption(opt => opt
      .setName('salon7')
      .setDescription('Salon de destination n°7')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false))
    .addChannelOption(opt => opt
      .setName('salon8')
      .setDescription('Salon de destination n°8')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false))
    .addChannelOption(opt => opt
      .setName('salon9')
      .setDescription('Salon de destination n°9')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false))
    .addChannelOption(opt => opt
      .setName('salon10')
      .setDescription('Salon de destination n°10')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false)),

  async execute(interaction) {
    // Récupérer les salons choisis (ou le salon courant par défaut)
    const salon1  = interaction.options.getChannel('salon1');
    const salon2  = interaction.options.getChannel('salon2');
    const salon3  = interaction.options.getChannel('salon3');
    const salon4  = interaction.options.getChannel('salon4');
    const salon5  = interaction.options.getChannel('salon5');
    const salon6  = interaction.options.getChannel('salon6');
    const salon7  = interaction.options.getChannel('salon7');
    const salon8  = interaction.options.getChannel('salon8');
    const salon9  = interaction.options.getChannel('salon9');
    const salon10 = interaction.options.getChannel('salon10');

    const channels = [salon1, salon2, salon3, salon4, salon5, salon6, salon7, salon8, salon9, salon10]
      .filter(Boolean)
      .map(c => c.id);

    // Si aucun salon spécifié, utiliser le salon courant
    if (channels.length === 0) channels.push(interaction.channelId);

    // Stocker pour récupération lors du submit du modal
    pendingChannels.set(interaction.user.id, channels);

    const modal = new ModalBuilder()
      .setCustomId('embed_modal')
      .setTitle('✉️ Message personnalisé');

    const titreInput = new TextInputBuilder()
      .setCustomId('titre')
      .setLabel('Titre')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex : Annonce importante')
      .setRequired(true)
      .setMaxLength(256);

    const descriptionInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Contenu')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Écris ton message ici...')
      .setRequired(true)
      .setMaxLength(4000);

    const couleurInput = new TextInputBuilder()
      .setCustomId('couleur')
      .setLabel('Couleur (optionnel)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex : #2ECC71  —  laisser vide pour la couleur par défaut')
      .setRequired(false)
      .setMaxLength(7);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titreInput),
      new ActionRowBuilder().addComponents(descriptionInput),
      new ActionRowBuilder().addComponents(couleurInput),
    );

    await interaction.showModal(modal);
  },
};

// ─── Handler du modal ─────────────────────────────────────────────────────────
async function handleEmbedModal(interaction) {
  const titre       = interaction.fields.getTextInputValue('titre');
  const description = interaction.fields.getTextInputValue('description');
  const couleurRaw  = interaction.fields.getTextInputValue('couleur').trim();

  let couleur = 0x2B2D31;
  if (couleurRaw) {
    const parsed = parseInt(couleurRaw.replace('#', ''), 16);
    if (isNaN(parsed)) {
      return interaction.reply({ content: '❌ Couleur invalide. Utilise le format `#2ECC71`.', ephemeral: true });
    }
    couleur = parsed;
  }

  const embed = new EmbedBuilder()
    .setColor(couleur)
    .setTitle(titre)
    .setDescription(description)
    .setTimestamp();

  // Récupérer les salons cibles
  const channelIds = pendingChannels.get(interaction.user.id) ?? [interaction.channelId];
  pendingChannels.delete(interaction.user.id);

  const envois = [];
  const erreurs = [];

  for (const channelId of channelIds) {
    try {
      const ch = await interaction.client.channels.fetch(channelId);
      await ch.send({ embeds: [embed] });
      envois.push(`<#${channelId}>`);
    } catch (err) {
      console.error(`❌ Impossible d'envoyer l'embed dans ${channelId} :`, err);
      erreurs.push(`<#${channelId}>`);
    }
  }

  let reponse = '';
  if (envois.length > 0)  reponse += `✅ Message envoyé dans : ${envois.join(', ')}`;
  if (erreurs.length > 0) reponse += `\n❌ Échec pour : ${erreurs.join(', ')}`;

  await interaction.reply({ content: reponse, ephemeral: true });
}

module.exports.handleEmbedModal = handleEmbedModal;

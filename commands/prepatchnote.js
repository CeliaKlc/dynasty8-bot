const {
  SlashCommandBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
} = require('discord.js');

const SALON_PREPATCHNOTE_ID = '1489647875955753200';
const DYNASTY8_COLOR        = 0xF5A623;

const ROLES_AUTORISES = [
  '917744433682849802', // Employé
  '1375930527873368066', // Direction
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('prepatchnote')
    .setDescription('📋 Publier un pré-patchnote dans le salon dédié'),

  async execute(interaction) {
    // Vérification des rôles
    const hasRole = interaction.member.roles.cache.some(r => ROLES_AUTORISES.includes(r.id));
    if (!hasRole) {
      return interaction.reply({ content: '❌ Tu n\'as pas la permission d\'utiliser cette commande.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('prepatchnote_modal')
      .setTitle('📋 Pré-Patchnote');

    const versionInput = new TextInputBuilder()
      .setCustomId('version')
      .setLabel('Version / Titre')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex : v1.3.0 — Cartes de visite & Tickets')
      .setRequired(true)
      .setMaxLength(100);

    const contenuInput = new TextInputBuilder()
      .setCustomId('contenu')
      .setLabel('Contenu du pré-patchnote')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder(
        '✨ Nouveautés\n' +
        '• /cartevisite : carte de visite par agent\n\n' +
        '🔧 Améliorations\n' +
        '• ...\n\n' +
        '🐛 Corrections\n' +
        '• ...'
      )
      .setRequired(true)
      .setMaxLength(4000);

    modal.addComponents(
      new ActionRowBuilder().addComponents(versionInput),
      new ActionRowBuilder().addComponents(contenuInput),
    );

    await interaction.showModal(modal);
  },
};

// ─── Handler du modal ─────────────────────────────────────────────────────────
async function handlePrepatchnoteModal(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const version = interaction.fields.getTextInputValue('version');
  const contenu = interaction.fields.getTextInputValue('contenu');

  const salon = interaction.guild.channels.cache.get(SALON_PREPATCHNOTE_ID);
  if (!salon) {
    return interaction.editReply({ content: '❌ Salon pré-patchnote introuvable. Vérifie l\'ID.' });
  }

  const embed = new EmbedBuilder()
    .setColor(DYNASTY8_COLOR)
    .setAuthor({ name: 'Dynasty 8 — Pré-Patchnote', iconURL: 'https://cdn.discordapp.com/emojis/1489223936620236841.png' })
    .setTitle(`📋  ${version}`)
    .setDescription(contenu)
    .setFooter({ text: `Publié par ${interaction.user.username}` })
    .setTimestamp();

  await salon.send({ embeds: [embed] });
  await interaction.editReply({ content: `✅ Pré-patchnote publié dans <#${SALON_PREPATCHNOTE_ID}> !` });
}

module.exports.handlePrepatchnoteModal = handlePrepatchnoteModal;

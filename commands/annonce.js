const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
require('dotenv').config();

const GOLD = 0xC9A84C;

const data = new SlashCommandBuilder()
  .setName('annonce')
  .setDescription('🏠 Publier une annonce immobilière Dynasty 8')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addStringOption(opt =>
    opt.setName('type')
      .setDescription('Type de bien')
      .setRequired(true)
      .addChoices(
        { name: '🏡 Maison', value: 'Maison' },
        { name: '🏢 Appartement', value: 'Appartement' },
        { name: '🏬 Local commercial', value: 'Local commercial' },
        { name: '🏗️ Terrain', value: 'Terrain' },
        { name: '🏰 Villa', value: 'Villa' },
        { name: '🏠 Autre', value: 'Autre' },
      )
  )
  .addStringOption(opt =>
    opt.setName('transaction')
      .setDescription('Vente ou Location ?')
      .setRequired(true)
      .addChoices(
        { name: '💰 À vendre', value: 'Vente' },
        { name: '🔑 À louer', value: 'Location' },
      )
  )
  .addStringOption(opt =>
    opt.setName('quartier')
      .setDescription('Quartier / Zone du bien')
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('prix')
      .setDescription('Prix (ex: 150 000$ ou 5 000$/mois)')
      .setRequired(true)
  )
  .addIntegerOption(opt =>
    opt.setName('pieces')
      .setDescription('Nombre de pièces')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(20)
  )
  .addStringOption(opt =>
    opt.setName('description')
      .setDescription('Description du bien (équipements, atouts, etc.)')
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('image')
      .setDescription('Lien image du bien (optionnel)')
      .setRequired(false)
  )
  .addStringOption(opt =>
    opt.setName('reference')
      .setDescription('Référence du bien (ex: D8-001) — générée auto si vide')
      .setRequired(false)
  );

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const type        = interaction.options.getString('type');
  const transaction = interaction.options.getString('transaction');
  const quartier    = interaction.options.getString('quartier');
  const prix        = interaction.options.getString('prix');
  const pieces      = interaction.options.getInteger('pieces');
  const description = interaction.options.getString('description');
  const image       = interaction.options.getString('image');
  const refInput    = interaction.options.getString('reference');

  // Générer une référence automatique si non fournie
  const ref = refInput || `D8-${Date.now().toString().slice(-5)}`;

  // Emoji selon transaction
  const transactionEmoji = transaction === 'Vente' ? '💰' : '🔑';
  const transactionColor = transaction === 'Vente' ? GOLD : 0x27AE60;

  // Trouver le canal des annonces
  const annonceChannel = interaction.guild.channels.cache.get(process.env.CHANNEL_ANNONCES_ID);
  if (!annonceChannel) {
    return interaction.editReply({ content: '❌ Canal des annonces introuvable. Vérifie l\'ID dans le .env' });
  }

  const embed = new EmbedBuilder()
    .setColor(transactionColor)
    .setAuthor({
      name: 'Dynasty 8 — Agence Immobilière',
      iconURL: interaction.guild.iconURL(),
    })
    .setTitle(`${transactionEmoji}  ${type} ${transaction === 'Vente' ? 'à vendre' : 'à louer'} — ${quartier}`)
    .setDescription(`> ${description}`)
    .addFields(
      { name: '📍 Quartier',      value: quartier,         inline: true },
      { name: '🏷️ Type',          value: type,             inline: true },
      { name: '🚪 Pièces',        value: `${pieces}`,      inline: true },
      { name: '💵 Prix',          value: `**${prix}**`,    inline: true },
      { name: '📋 Transaction',   value: `${transactionEmoji} ${transaction}`, inline: true },
      { name: '🔖 Référence',     value: `\`${ref}\``,     inline: true },
    )
    .addFields({
      name: '📞 Contact',
      value: '> Ouvre un ticket dans <#' + process.env.CHANNEL_TICKETS_ID + '> pour plus d\'infos !',
    })
    .setFooter({
      text: `Publiée par ${interaction.user.username} • Dynasty 8 Baylife RP`,
      iconURL: interaction.user.displayAvatarURL(),
    })
    .setTimestamp();

  if (image) embed.setImage(image);

  await annonceChannel.send({ embeds: [embed] });

  await interaction.editReply({
    content: `✅ Annonce **${ref}** publiée dans ${annonceChannel} !`,
  });
}

module.exports = { data, execute };

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Envoyer un message embed personnalisé')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt => opt
      .setName('titre')
      .setDescription('Titre de l\'embed')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('description')
      .setDescription('Contenu de l\'embed (supporte le markdown Discord)')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('couleur')
      .setDescription('Couleur de l\'embed en hexadécimal (ex: #2ECC71)')
      .setRequired(false))
    .addAttachmentOption(opt => opt
      .setName('image')
      .setDescription('Image à afficher dans l\'embed')
      .setRequired(false)),

  async execute(interaction) {
    const titre       = interaction.options.getString('titre');
    const description = interaction.options.getString('description');
    const couleurHex  = interaction.options.getString('couleur');
    const image       = interaction.options.getAttachment('image');

    let couleur = 0x2B2D31; // couleur neutre par défaut
    if (couleurHex) {
      const parsed = parseInt(couleurHex.replace('#', ''), 16);
      if (!isNaN(parsed)) couleur = parsed;
      else return interaction.reply({ content: '❌ Couleur invalide. Utilise le format `#2ECC71`.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(couleur)
      .setTitle(titre)
      .setDescription(description.replace(/\\n/g, '\n'))
      .setTimestamp();

    if (image) embed.setImage(image.url);

    await interaction.channel.send({ embeds: [embed] });
    await interaction.reply({ content: '✅ Message envoyé.', ephemeral: true });
  },
};

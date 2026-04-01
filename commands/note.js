const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('📝 Ajouter une note interne visible uniquement par les agents')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(opt => opt
      .setName('contenu')
      .setDescription('Contenu de la note interne')
      .setRequired(true)
    )
    .addUserOption(opt => opt
      .setName('client')
      .setDescription('Le client concerné (optionnel)')
      .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const contenu = interaction.options.getString('contenu');
    const clientUser = interaction.options.getUser('client');

    // Envoyer dans le canal logs (agents uniquement)
    if (process.env.CHANNEL_LOGS_ID) {
      const logChannel = interaction.guild.channels.cache.get(process.env.CHANNEL_LOGS_ID);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor(0xE67E22)
          .setTitle('📝 Note interne')
          .addFields(
            ...(clientUser ? [{ name: '👤 Client', value: `<@${clientUser.id}> (${clientUser.username})`, inline: true }] : []),
            { name: '✍️ Agent', value: `<@${interaction.user.id}>`, inline: true },
            { name: '🔗 Salon', value: `<#${interaction.channelId}>`, inline: true },
            { name: '🗒️ Note', value: contenu, inline: false },
          )
          .setFooter({ text: 'Dynasty 8 • Notes internes' })
          .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
      }
    }

    // Confirmation éphémère (invisible pour les autres)
    const confirmEmbed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('✅ Note enregistrée')
      .addFields(
        ...(clientUser ? [{ name: '👤 Client', value: clientUser.username, inline: true }] : []),
        { name: '🗒️ Note', value: contenu, inline: false },
      )
      .setDescription('*Envoyée dans le canal logs — invisible pour le client.*')
      .setFooter({ text: 'Dynasty 8 • Notes internes' })
      .setTimestamp();

    return interaction.editReply({ embeds: [confirmEmbed] });
  },
};

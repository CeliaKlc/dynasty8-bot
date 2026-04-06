const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDB } = require('../utils/db');
const { scheduleSup } = require('../utils/supScheduler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sup')
    .setDescription('⚠️ Avertir le client : fermeture automatique dans 24h sans réponse')
    .addUserOption(opt => opt
      .setName('client')
      .setDescription('Le client concerné')
      .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const client = interaction.options.getUser('client');

    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setDescription(
        `**Si vous ne réagissez pas dans les 24 heures, votre ticket sera automatiquement fermé.**\n` +
        `${client} 🔴`
      );

    const msg = await interaction.channel.send({ embeds: [embed] });

    // Planifier la fermeture dans 24h (persisté en MongoDB)
    const closeAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const doc = {
      messageId: msg.id,
      channelId: interaction.channel.id,
      clientId:  client.id,
      closeAt,
    };

    await getDB().collection('sup_pending').insertOne(doc);
    scheduleSup(interaction.client, doc);

    await interaction.editReply({ content: '✅ Message envoyé. Le ticket sera fermé dans **24h** si le client ne répond pas.' });
  },
};

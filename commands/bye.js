const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { getDB } = require('../utils/db');
const { scheduleBye } = require('../utils/byeScheduler');

const AVIS_CLIENTS_CHANNEL_ID = '915921133260386335';
const GOODBYE_IMAGE_URL = 'https://i.goopics.net/8t3ju4.png';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bye')
    .setDescription('👋 Envoyer le message de fin de service dans le ticket')
    .addUserOption(opt => opt
      .setName('client')
      .setDescription('Mentionner le client')
      .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const client = interaction.options.getUser('client');

    const embed = new EmbedBuilder()
      .setColor(0xE67E22)
      .setDescription(
        `Cher ${client} ,\n` +
        `Vous avez eu recours aux services du Dynasty 8, et nous vous en exprimons notre gratitude. Nous formulons le vœu que votre expérience en tant que client ait été optimale.\n` +
        `\n` +
        `N'hésitez pas à nous faire un retour sur votre expérience via <#${AVIS_CLIENTS_CHANNEL_ID}>\n` +
        `Ce dernier nous est précieux !\n` +
        `\n` +
        `Si vous n'avez pas d'autres demandes, vous pouvez fermer votre ticket.\n` +
        `\n` +
        `À bientôt !\n` +
        `\n` +
        `Cordialement,\n` +
        `Dynasty 8 <:Dynasty8:1489223936620236841>`
      )
      .setImage(GOODBYE_IMAGE_URL);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('⭐ Avis clients')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${interaction.guildId}/${AVIS_CLIENTS_CHANNEL_ID}`),
      new ButtonBuilder()
        .setCustomId('ticket_fermer')
        .setLabel('🔒 Fermer le ticket')
        .setStyle(ButtonStyle.Danger),
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });

    // Planifier la fermeture automatique dans 24h si le client ne laisse pas d'avis
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const doc = {
      clientId:  client.id,
      channelId: interaction.channel.id,
      expiresAt,
    };

    // Upsert : remplace une éventuelle entrée précédente pour ce client
    await getDB().collection('bye_pending').replaceOne(
      { clientId: client.id },
      doc,
      { upsert: true }
    );
    scheduleBye(interaction.client, doc);

    await interaction.editReply({ content: '✅ Message de fin envoyé. Le ticket sera fermé dans **24h** si le client ne laisse pas d\'avis.' });
  },
};

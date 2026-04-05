const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

const AVIS_CLIENTS_CHANNEL_ID = '915921133260386335';

// URL de la bannière "Good Bye Dynasty 8" — à mettre à jour si elle expire
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

    const contenu = [
      `Cher ${client} ,`,
      `Vous avez eu recours aux services du Dynasty 8, et nous vous en exprimons notre gratitude. Nous formulons le vœu que votre expérience en tant que client ait été optimale.`,
      ``,
      `N'hésitez pas à nous faire un retour sur votre expérience via <#${AVIS_CLIENTS_CHANNEL_ID}>`,
      `Ce dernier nous est précieux !`,
      ``,
      `Si vous n'avez pas d'autres demandes, vous pouvez fermer votre ticket.`,
      ``,
      `À bientôt !`,
      ``,
      `Cordialement,`,
      `Dynasty 8 <:Dynasty8:1489223936620236841>`,
    ].join('\n');

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

    await interaction.channel.send({ content: contenu, components: [row], files: [GOODBYE_IMAGE_URL] });
    await interaction.editReply({ content: '✅ Message de fin envoyé !' });
  },
};

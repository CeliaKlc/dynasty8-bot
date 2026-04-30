// ─── /question — Message de suivi avec fermeture auto 24h ────────────────────
// Comme /bye mais :
//   • ne marque PAS la vente (le dossier reste en cours)
//   • le timer est annulé si le client répond dans le ticket (pas dans #avis)

const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { getDB }             = require('../utils/db');
const { scheduleQuestion }  = require('../utils/questionScheduler');

const AVIS_CLIENTS_CHANNEL_ID = '915921133260386335';
const GOODBYE_IMAGE_URL       = 'https://i.goopics.net/8t3ju4.png';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('question')
    .setDescription('❓ Envoyer un message de suivi et planifier la fermeture du ticket dans 24h')
    .addUserOption(opt => opt
      .setName('client')
      .setDescription('Mentionner le client')
      .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const client = interaction.options.getUser('client');

    // Salutation selon l'heure (Paris)
    const heure     = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', hour12: false });
    const salutation = parseInt(heure) >= 18 ? 'une bonne soirée' : 'une bonne journée';

    const embed = new EmbedBuilder()
      .setColor(0xE67E22)
      .setDescription(
        `Si vous avez d'autres questions, n'hésitez pas. 😀\n` +
        `Dans le cas contraire, nous vous invitons à fermer ce ticket.\n` +
        `\n` +
        `En vous souhaitant ${salutation} ${client}.\n` +
        `\n` +
        `Cordialement,\n` +
        `Dynasty 8 <:Dynasty8:1489223936620236841>`,
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

    // ── Planifier la fermeture automatique dans 24h ───────────────────────────
    // Annulé si le client répond dans ce salon (voir events/messageCreate.js)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const doc = {
      clientId:  client.id,
      channelId: interaction.channel.id,
      expiresAt,
    };

    // replaceOne (upsert) : un seul timer par ticket, reset si /question reappelé
    await getDB().collection('question_pending').replaceOne(
      { channelId: interaction.channel.id },
      doc,
      { upsert: true },
    );
    scheduleQuestion(interaction.client, doc);

    await interaction.editReply({
      content: `✅ Message envoyé. Le ticket sera fermé dans **24h** si ${client.username} ne répond pas dans ce salon.`,
    });
  },
};

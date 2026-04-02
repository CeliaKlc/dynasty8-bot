const { SlashCommandBuilder } = require('discord.js');
const { getDB } = require('../utils/db');
const { scheduleDelete } = require('../utils/reducScheduler');

const ROLE_NOTIFICATIONS_LBC_ID = '1345415367333380156';

const DUREES = {
  '6h':  { label: '6 heures',   ms:  6 * 60 * 60 * 1000 },
  '12h': { label: '12 heures',  ms: 12 * 60 * 60 * 1000 },
  '24h': { label: '24 heures',  ms: 24 * 60 * 60 * 1000 },
  '48h': { label: '48 heures',  ms: 48 * 60 * 60 * 1000 },
  '72h': { label: '72 heures',  ms: 72 * 60 * 60 * 1000 },
  '7j':  { label: '7 jours',    ms:  7 * 24 * 60 * 60 * 1000 },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reduc')
    .setDescription('📢 Annoncer une réduction de prix sur un bien')
    .addStringOption(opt => opt
      .setName('prix')
      .setDescription('Nouveau prix du bien (ex: 3\'800\'000$)')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('duree')
      .setDescription('Durée de la réduction — le message sera supprimé automatiquement')
      .setRequired(false)
      .addChoices(
        { name: '6 heures',  value: '6h'  },
        { name: '12 heures', value: '12h' },
        { name: '24 heures', value: '24h' },
        { name: '48 heures', value: '48h' },
        { name: '72 heures', value: '72h' },
        { name: '7 jours',   value: '7j'  },
      )),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const prix     = interaction.options.getString('prix');
    const dureeKey = interaction.options.getString('duree');
    const duree    = dureeKey ? DUREES[dureeKey] : null;

    const contenu = duree
      ? `# **⚠️ LE PRIX BAISSE ET PASSE À ${prix} PENDANT ${duree.label} ⚠️** <@&${ROLE_NOTIFICATIONS_LBC_ID}>`
      : `# **⚠️ LE PRIX BAISSE ET PASSE À ${prix} ⚠️** <@&${ROLE_NOTIFICATIONS_LBC_ID}>`;

    const message = await interaction.channel.send({
      content: contenu,
      allowedMentions: { parse: ['roles'] },
    });

    if (duree) {
      const deleteAt = new Date(Date.now() + duree.ms).toISOString();

      // Persister en base pour survivre aux redémarrages
      await getDB().collection('reductions').insertOne({
        messageId: message.id,
        channelId: message.channelId,
        deleteAt,
      });

      // Planifier la suppression immédiatement
      scheduleDelete(interaction.client, {
        messageId: message.id,
        channelId: message.channelId,
        deleteAt,
      });

      await interaction.editReply({
        content: `✅ Message publié ! Il sera automatiquement supprimé dans **${duree.label}**.`,
      });
    } else {
      await interaction.editReply({ content: '✅ Message publié !' });
    }
  },
};

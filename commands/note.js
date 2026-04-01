const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'clients.json');

function loadClients() {
  if (!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, '{}');
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}
function saveClients(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('📝 Ajouter une note interne sur le client de ce ticket (agents uniquement)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(opt => opt
      .setName('contenu')
      .setDescription('Contenu de la note interne')
      .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const contenu = interaction.options.getString('contenu');
    const channelId = interaction.channelId;

    // Trouver le dossier correspondant au salon courant
    const clients = loadClients();
    let targetClient = null;
    let targetDossier = null;

    for (const clientData of Object.values(clients)) {
      const dossier = clientData.dossiers.find(d => d.id === channelId);
      if (dossier) {
        targetClient = clientData;
        targetDossier = dossier;
        break;
      }
    }

    if (!targetClient || !targetDossier) {
      return interaction.editReply({
        content: '❌ Cette commande doit être utilisée dans un **salon de ticket** actif.',
      });
    }

    // Ajouter la note dans le tableau de notes du dossier
    if (!targetDossier.notes) targetDossier.notes = [];
    const nouvelleNote = {
      auteur: interaction.user.tag,
      auteurId: interaction.user.id,
      contenu,
      date: new Date().toISOString(),
    };
    targetDossier.notes.push(nouvelleNote);
    saveClients(clients);

    // Envoyer dans le canal logs (agents uniquement)
    if (process.env.CHANNEL_LOGS_ID) {
      const logChannel = interaction.guild.channels.cache.get(process.env.CHANNEL_LOGS_ID);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor(0xE67E22)
          .setTitle('📝 Note interne ajoutée')
          .addFields(
            { name: '👤 Client', value: `${targetClient.username} (<@${targetClient.id}>)`, inline: true },
            { name: '✍️ Agente', value: `<@${interaction.user.id}>`, inline: true },
            { name: '📋 Type de ticket', value: targetDossier.type, inline: true },
            { name: '🗒️ Note', value: contenu, inline: false },
            { name: '🔗 Salon', value: `<#${channelId}>`, inline: true },
            { name: '📅 Date', value: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }), inline: true },
          )
          .setFooter({ text: 'Dynasty 8 • Notes internes' })
          .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
      }
    }

    // Confirmation éphémère (invisible pour le client)
    const confirmEmbed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('✅ Note enregistrée')
      .addFields(
        { name: '👤 Client', value: targetClient.username, inline: true },
        { name: '📋 Dossier', value: targetDossier.type, inline: true },
        { name: '🗒️ Note', value: contenu, inline: false },
      )
      .setDescription('*Cette note est visible uniquement par les agents dans le canal logs.*')
      .setFooter({ text: 'Dynasty 8 • Notes internes' })
      .setTimestamp();

    return interaction.editReply({ embeds: [confirmEmbed] });
  },
};

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const GOLD = 0xC9A84C;
const DATA_PATH = path.join(__dirname, '..', 'data', 'clients.json');

function loadClients() {
  if (!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, '{}');
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}
function saveClients(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

const STATUT_EMOJI = {
  'Ouvert':   '🟡',
  'En cours': '🟢',
  'Fermé':    '🔴',
  'Conclu':   '✅',
};

const data = new SlashCommandBuilder()
  .setName('client')
  .setDescription('👤 Gestion des dossiers clients Dynasty 8')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)

  // Sous-commande : voir dossier d'un client
  .addSubcommand(sub =>
    sub.setName('dossier')
      .setDescription('📋 Voir le dossier d\'un client')
      .addUserOption(opt =>
        opt.setName('membre')
          .setDescription('Le membre Discord du client')
          .setRequired(true)
      )
  )

  // Sous-commande : mettre à jour le statut d'un dossier
  .addSubcommand(sub =>
    sub.setName('statut')
      .setDescription('🔄 Mettre à jour le statut d\'un dossier')
      .addUserOption(opt =>
        opt.setName('membre')
          .setDescription('Le client')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('reference')
          .setDescription('ID du ticket (référence du salon)')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('statut')
          .setDescription('Nouveau statut')
          .setRequired(true)
          .addChoices(
            { name: '🟡 Ouvert',   value: 'Ouvert' },
            { name: '🟢 En cours', value: 'En cours' },
            { name: '🔴 Fermé',    value: 'Fermé' },
            { name: '✅ Conclu',   value: 'Conclu' },
          )
      )
      .addStringOption(opt =>
        opt.setName('note')
          .setDescription('Note interne (optionnel)')
          .setRequired(false)
      )
  )

  // Sous-commande : liste de tous les dossiers ouverts
  .addSubcommand(sub =>
    sub.setName('liste')
      .setDescription('📊 Voir tous les dossiers en cours')
  );

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const sub = interaction.options.getSubcommand();

  // ── Dossier d'un client ──────────────────────────────────────────────────────
  if (sub === 'dossier') {
    const membre = interaction.options.getUser('membre');
    const clients = loadClients();
    const client = clients[membre.id];

    if (!client || !client.dossiers.length) {
      return interaction.editReply({ content: `❌ Aucun dossier trouvé pour **${membre.username}**.` });
    }

    const embed = new EmbedBuilder()
      .setColor(GOLD)
      .setTitle(`📋 Dossier client — ${client.username}`)
      .setThumbnail(membre.displayAvatarURL())
      .setFooter({ text: 'Dynasty 8 • Baylife RP' })
      .setTimestamp();

    client.dossiers.forEach((dossier, i) => {
      const emoji = STATUT_EMOJI[dossier.statut] || '❓';
      const date = new Date(dossier.date).toLocaleDateString('fr-FR');
      embed.addFields({
        name: `${emoji} Dossier #${i + 1} — ${dossier.type}`,
        value:
          `**Statut :** ${dossier.statut}\n` +
          `**Agente :** ${dossier.agente || 'Non assignée'}\n` +
          `**Date :** ${date}\n` +
          (dossier.note ? `**Note :** ${dossier.note}\n` : ''),
      });
    });

    return interaction.editReply({ embeds: [embed] });
  }

  // ── Mise à jour du statut ────────────────────────────────────────────────────
  if (sub === 'statut') {
    const membre  = interaction.options.getUser('membre');
    const ref     = interaction.options.getString('reference');
    const statut  = interaction.options.getString('statut');
    const note    = interaction.options.getString('note');

    const clients = loadClients();
    const client  = clients[membre.id];

    if (!client) return interaction.editReply({ content: `❌ Client **${membre.username}** introuvable.` });

    const dossier = client.dossiers.find(d => d.id === ref);
    if (!dossier) return interaction.editReply({ content: `❌ Dossier \`${ref}\` introuvable pour ce client.` });

    dossier.statut = statut;
    dossier.agente = interaction.user.tag;
    if (note) dossier.note = note;
    saveClients(clients);

    const emoji = STATUT_EMOJI[statut] || '❓';
    const embed = new EmbedBuilder()
      .setColor(GOLD)
      .setTitle('✅ Dossier mis à jour')
      .addFields(
        { name: 'Client', value: membre.username, inline: true },
        { name: 'Statut', value: `${emoji} ${statut}`, inline: true },
        { name: 'Agente', value: interaction.user.username, inline: true },
      )
      .setTimestamp();

    if (note) embed.addFields({ name: '📝 Note', value: note });
    return interaction.editReply({ embeds: [embed] });
  }

  // ── Liste des dossiers en cours ──────────────────────────────────────────────
  if (sub === 'liste') {
    const clients = loadClients();
    const actifs = [];

    for (const id in clients) {
      const c = clients[id];
      c.dossiers
        .filter(d => d.statut === 'Ouvert' || d.statut === 'En cours')
        .forEach(d => actifs.push({ ...d, clientUsername: c.username }));
    }

    if (!actifs.length) {
      return interaction.editReply({ content: '✅ Aucun dossier ouvert ou en cours pour le moment !' });
    }

    const embed = new EmbedBuilder()
      .setColor(GOLD)
      .setTitle(`📊 Dossiers actifs — ${actifs.length} en cours`)
      .setFooter({ text: 'Dynasty 8 • Baylife RP' })
      .setTimestamp();

    actifs.slice(0, 10).forEach(d => {
      const emoji = STATUT_EMOJI[d.statut] || '❓';
      embed.addFields({
        name: `${emoji} ${d.clientUsername} — ${d.type}`,
        value: `**Statut :** ${d.statut} | **Agente :** ${d.agente || 'Non assignée'} | **Date :** ${new Date(d.date).toLocaleDateString('fr-FR')}`,
      });
    });

    if (actifs.length > 10) {
      embed.setDescription(`*Affichage des 10 premiers dossiers sur ${actifs.length}.*`);
    }

    return interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { data, execute };

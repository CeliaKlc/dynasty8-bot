const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDB } = require('../utils/db');
const { scheduleRdv, cancelRdv } = require('../utils/rdvScheduler');

function parseDateTime(dateStr, heureStr) {
  const now = new Date();
  let date;

  const dateLower = dateStr.toLowerCase().trim();
  if (dateLower === "aujourd'hui" || dateLower === 'auj' || dateLower === 'today') {
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (dateLower === 'demain' || dateLower === 'tomorrow') {
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else {
    const parts = dateStr.split('/');
    if (parts.length < 2) return null;
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const year = parts[2] ? parseInt(parts[2]) : now.getFullYear();
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    date = new Date(year, month, day);
  }

  if (isNaN(date.getTime())) return null;

  const heureClean = heureStr.replace(/[hH]/, ':');
  const timeParts = heureClean.split(':');
  const hours = parseInt(timeParts[0]);
  const minutes = timeParts[1] ? parseInt(timeParts[1]) : 0;

  if (isNaN(hours) || hours < 0 || hours > 23) return null;
  if (isNaN(minutes) || minutes < 0 || minutes > 59) return null;

  date.setHours(hours, minutes, 0, 0);
  return date;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rdv')
    .setDescription('Gérer les rendez-vous')
    .addSubcommand(sub => sub
      .setName('créer')
      .setDescription('Planifier un rendez-vous avec un client')
      .addUserOption(opt => opt
        .setName('client')
        .setDescription('Le client concerné par le rendez-vous')
        .setRequired(true))
      .addStringOption(opt => opt
        .setName('date')
        .setDescription('Date du RDV (ex: aujourd\'hui, demain, 01/04/2026)')
        .setRequired(true))
      .addStringOption(opt => opt
        .setName('heure')
        .setDescription('Heure du RDV (ex: 18h40, 18:40)')
        .setRequired(true))
      .addStringOption(opt => opt
        .setName('description')
        .setDescription('Objet du rendez-vous (ex: Visite appartement centre-ville)')
        .setRequired(false))
      .addStringOption(opt => opt
        .setName('lieu')
        .setDescription('Lieu du rendez-vous (ex: Agence Dynasty 8, Rockford Hills)')
        .setRequired(false))
      .addIntegerOption(opt => opt
        .setName('rappel')
        .setDescription('Rappel avant le RDV (défaut : 30 min)')
        .addChoices(
          { name: '15 minutes avant', value: 15 },
          { name: '30 minutes avant', value: 30 },
          { name: '1 heure avant', value: 60 },
          { name: 'À l\'heure pile seulement', value: 0 },
        )
        .setRequired(false))
      .addStringOption(opt => opt
        .setName('lier_a')
        .setDescription('ID d\'un RDV existant à lier (ex: acheteur + vendeur sans se connaître)')
        .setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('lier')
      .setDescription('Lier deux RDV existants (apparaissent comme un seul sur le panel)')
      .addStringOption(opt => opt
        .setName('id1')
        .setDescription('ID du premier RDV')
        .setRequired(true))
      .addStringOption(opt => opt
        .setName('id2')
        .setDescription('ID du second RDV')
        .setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('liste')
      .setDescription('Voir tous les rendez-vous à venir')
      .addUserOption(opt => opt
        .setName('agent')
        .setDescription('Filtrer par agent (laisser vide = tous les agents)')
        .setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('annuler')
      .setDescription('Annuler un rendez-vous planifié')
      .addStringOption(opt => opt
        .setName('id')
        .setDescription('ID du rendez-vous (visible dans le message de confirmation)')
        .setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const col = getDB().collection('rendez_vous');

    // ─── CRÉER ───────────────────────────────────────────────────────────────
    if (sub === 'créer') {
      const clientUser = interaction.options.getUser('client');
      const dateStr = interaction.options.getString('date');
      const heureStr = interaction.options.getString('heure');
      const rappelMinutes = interaction.options.getInteger('rappel') ?? 30;
      const description = interaction.options.getString('description') ?? 'Rendez-vous';
      const lieu = interaction.options.getString('lieu') ?? null;
      const lierA = interaction.options.getString('lier_a') ?? null;

      const datetime = parseDateTime(dateStr, heureStr);
      if (!datetime) {
        return interaction.reply({
          content: '❌ Format invalide.\n**Date :** `aujourd\'hui`, `demain` ou `01/04/2026`\n**Heure :** `18h40` ou `18:40`',
          ephemeral: true,
        });
      }

      if (datetime <= new Date()) {
        return interaction.reply({
          content: '❌ La date/heure du rendez-vous doit être dans le futur.',
          ephemeral: true,
        });
      }

      // Si lier_a est fourni, vérifier que le RDV cible existe
      let groupeId = null;
      if (lierA) {
        const cible = await col.findOne({ id: lierA });
        if (!cible) {
          return interaction.reply({
            content: `❌ Aucun RDV trouvé avec l'ID \`${lierA}\`. Vérifie l'identifiant.`,
            ephemeral: true,
          });
        }
        groupeId = lierA; // on utilise l'ID du premier RDV comme identifiant de groupe
        // Mettre à jour le RDV cible pour lui ajouter le même groupeId
        await col.updateOne({ id: lierA }, { $set: { groupeId } });
      }

      const id = `rdv_${Date.now()}`;
      const rdvEntry = {
        id,
        agentId: interaction.user.id,
        clientId: clientUser.id,
        channelId: interaction.channelId,
        guildId: interaction.guildId,
        datetime: datetime.toISOString(),
        description,
        lieu,
        rappelMinutes,
        statut: 'prévu',
        createdAt: new Date().toISOString(),
        ...(groupeId ? { groupeId } : {}),
      };

      await col.insertOne(rdvEntry);
      scheduleRdv(interaction.client, rdvEntry);

      // Renommer le salon pour indiquer qu'un RDV est planifié
      const chName = interaction.channel.name;
      if (!chName.includes('⏰')) {
        const newName = chName.includes('⌛')
          ? chName.replace('⌛', '⏰')
          : `⏰${chName}`;
        interaction.channel.setName(newName).catch(() => {});
      }

      const dateFormatted = datetime.toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
      const heureFormatted = datetime.toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit',
      });

      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('📅 Rendez-vous enregistré')
        .addFields(
          { name: '👤 Agent', value: `<@${interaction.user.id}>`, inline: true },
          { name: '🤝 Client', value: `<@${clientUser.id}>`, inline: true },
          { name: '\u200B', value: '\u200B', inline: true },
          { name: '📌 Objet', value: description, inline: false },
          { name: '📆 Date', value: dateFormatted, inline: true },
          { name: '🕐 Heure', value: heureFormatted, inline: true },
          { name: '📍 Lieu', value: lieu ?? '*Non précisé*', inline: true },
          {
            name: '⏰ Rappel',
            value: rappelMinutes > 0 ? `${rappelMinutes} min avant + à l'heure pile` : 'À l\'heure pile seulement',
            inline: true,
          },
          { name: '🆔 ID du RDV', value: `\`${id}\``, inline: false },
        )
        .setFooter({ text: 'Dynasty 8 • Gestion des rendez-vous' })
        .setTimestamp();

      return interaction.reply({
        content: `<@${interaction.user.id}> <@${clientUser.id}>`,
        embeds: [embed],
      });
    }

    // ─── LIER ────────────────────────────────────────────────────────────────
    if (sub === 'lier') {
      const id1 = interaction.options.getString('id1');
      const id2 = interaction.options.getString('id2');

      const [rdv1, rdv2] = await Promise.all([
        col.findOne({ id: id1 }),
        col.findOne({ id: id2 }),
      ]);

      if (!rdv1) return interaction.reply({ content: `❌ RDV introuvable : \`${id1}\``, ephemeral: true });
      if (!rdv2) return interaction.reply({ content: `❌ RDV introuvable : \`${id2}\``, ephemeral: true });

      const groupeId = id1; // le premier ID sert d'identifiant de groupe
      await col.updateMany({ id: { $in: [id1, id2] } }, { $set: { groupeId } });

      return interaction.reply({
        content: `✅ RDV \`${id1}\` et \`${id2}\` sont maintenant liés.\nSur le panel, ils apparaîtront comme **un seul rendez-vous** avec deux parties.`,
        ephemeral: true,
      });
    }

    // ─── LISTE ───────────────────────────────────────────────────────────────
    if (sub === 'liste') {
      const agentFilter = interaction.options.getUser('agent');
      const now = new Date();

      const query = {
        statut: 'prévu',
        datetime: { $gt: now.toISOString() },
        ...(agentFilter ? { agentId: agentFilter.id } : {}),
      };

      const upcoming = await col.find(query).sort({ datetime: 1 }).limit(10).toArray();

      if (upcoming.length === 0) {
        const vide = agentFilter
          ? `📅 Aucun rendez-vous à venir pour <@${agentFilter.id}>.`
          : '📅 Aucun rendez-vous à venir.';
        return interaction.reply({ content: vide, ephemeral: true });
      }

      const titre = agentFilter
        ? `📅 Rendez-vous de ${agentFilter.displayName}`
        : '📅 Rendez-vous à venir';

      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle(titre)
        .setFooter({ text: `${upcoming.length} rendez-vous • Dynasty 8` })
        .setTimestamp();

      for (const rdv of upcoming) {
        const dt = new Date(rdv.datetime);
        const dateStr = dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
        const heureStr = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const lignes = [];
        if (!agentFilter) lignes.push(`Agent : <@${rdv.agentId}>`);
        lignes.push(`Client : <@${rdv.clientId}>`);
        if (rdv.lieu) lignes.push(`📍 ${rdv.lieu}`);
        lignes.push(`ID : \`${rdv.id}\``);
        embed.addFields({
          name: `${dateStr} à ${heureStr} — ${rdv.description}`,
          value: lignes.join('\n'),
        });
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── ANNULER ─────────────────────────────────────────────────────────────
    if (sub === 'annuler') {
      const id = interaction.options.getString('id');
      const rdv = await col.findOne({ id });

      if (!rdv) {
        return interaction.reply({ content: '❌ Rendez-vous introuvable. Vérifie l\'ID.', ephemeral: true });
      }

      if (rdv.agentId !== interaction.user.id && !interaction.member.permissions.has('ManageChannels')) {
        return interaction.reply({ content: '❌ Seul l\'agent qui a créé ce RDV peut l\'annuler.', ephemeral: true });
      }

      if (rdv.statut !== 'prévu') {
        return interaction.reply({ content: `❌ Ce rendez-vous est déjà marqué comme **${rdv.statut}**.`, ephemeral: true });
      }

      await col.updateOne({ id }, { $set: { statut: 'annulé' } });
      cancelRdv(id);

      const embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('❌ Rendez-vous annulé')
        .addFields(
          { name: '📌 Objet', value: rdv.description, inline: true },
          { name: '🆔 ID', value: `\`${id}\``, inline: true },
        )
        .setFooter({ text: 'Dynasty 8 • Gestion des rendez-vous' })
        .setTimestamp();

      return interaction.reply({
        content: `<@${rdv.agentId}> <@${rdv.clientId}>`,
        embeds: [embed],
      });
    }
  },
};

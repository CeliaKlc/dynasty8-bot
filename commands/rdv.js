const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { scheduleRdv, cancelRdv } = require('../utils/rdvScheduler');

const rdvPath = path.join(__dirname, '..', 'data', 'rdv.json');

function loadRdv() {
  if (!fs.existsSync(rdvPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(rdvPath, 'utf8'));
  } catch {
    return {};
  }
}

function saveRdv(data) {
  fs.writeFileSync(rdvPath, JSON.stringify(data, null, 2));
}

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
    )
    .addSubcommand(sub => sub
      .setName('liste')
      .setDescription('Voir tous les rendez-vous à venir')
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

    // ─── CRÉER ───────────────────────────────────────────────────────────────
    if (sub === 'créer') {
      const clientUser = interaction.options.getUser('client');
      const dateStr = interaction.options.getString('date');
      const heureStr = interaction.options.getString('heure');
      const rappelMinutes = interaction.options.getInteger('rappel') ?? 30;
      const description = interaction.options.getString('description') ?? 'Rendez-vous';

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

      const id = `rdv_${Date.now()}`;
      const rdvEntry = {
        id,
        agentId: interaction.user.id,
        clientId: clientUser.id,
        channelId: interaction.channelId,
        guildId: interaction.guildId,
        datetime: datetime.toISOString(),
        description,
        rappelMinutes,
        statut: 'prévu',
        createdAt: new Date().toISOString(),
      };

      const rdvData = loadRdv();
      rdvData[id] = rdvEntry;
      saveRdv(rdvData);

      scheduleRdv(interaction.client, rdvEntry);

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

    // ─── LISTE ───────────────────────────────────────────────────────────────
    if (sub === 'liste') {
      const rdvData = loadRdv();
      const now = new Date();

      const upcoming = Object.values(rdvData)
        .filter(r => r.statut === 'prévu' && new Date(r.datetime) > now)
        .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
        .slice(0, 10);

      if (upcoming.length === 0) {
        return interaction.reply({ content: '📅 Aucun rendez-vous à venir.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('📅 Rendez-vous à venir')
        .setFooter({ text: `${upcoming.length} rendez-vous • Dynasty 8` })
        .setTimestamp();

      for (const rdv of upcoming) {
        const dt = new Date(rdv.datetime);
        const dateStr = dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
        const heureStr = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        embed.addFields({
          name: `${dateStr} à ${heureStr} — ${rdv.description}`,
          value: `Agent : <@${rdv.agentId}> | Client : <@${rdv.clientId}>\nID : \`${rdv.id}\``,
        });
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── ANNULER ─────────────────────────────────────────────────────────────
    if (sub === 'annuler') {
      const id = interaction.options.getString('id');
      const rdvData = loadRdv();

      if (!rdvData[id]) {
        return interaction.reply({ content: '❌ Rendez-vous introuvable. Vérifie l\'ID.', ephemeral: true });
      }

      const rdv = rdvData[id];

      if (rdv.agentId !== interaction.user.id && !interaction.member.permissions.has('ManageChannels')) {
        return interaction.reply({ content: '❌ Seul l\'agent qui a créé ce RDV peut l\'annuler.', ephemeral: true });
      }

      if (rdv.statut !== 'prévu') {
        return interaction.reply({ content: `❌ Ce rendez-vous est déjà marqué comme **${rdv.statut}**.`, ephemeral: true });
      }

      rdvData[id].statut = 'annulé';
      saveRdv(rdvData);
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

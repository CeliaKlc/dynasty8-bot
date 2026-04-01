const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const rdvPath = path.join(__dirname, '..', 'data', 'rdv.json');
const timeouts = new Map(); // id -> [timeoutId, ...]

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

async function sendRdvReminder(client, rdv, isPreReminder = false) {
  try {
    const guild = await client.guilds.fetch(rdv.guildId);
    const channel = await guild.channels.fetch(rdv.channelId);
    if (!channel) return;

    const datetime = new Date(rdv.datetime);
    const heureFormatted = datetime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const dateFormatted = datetime.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    const embed = new EmbedBuilder()
      .setColor(isPreReminder ? 0xE67E22 : 0x2ECC71)
      .setTitle(isPreReminder
        ? `⏰ Rappel — RDV dans ${rdv.rappelMinutes} minutes`
        : '📅 C\'est l\'heure du rendez-vous !')
      .addFields(
        { name: '📌 Objet', value: rdv.description, inline: false },
        { name: '📆 Date', value: dateFormatted, inline: true },
        { name: '🕐 Heure', value: heureFormatted, inline: true },
      )
      .setFooter({ text: 'Dynasty 8 • Rappel automatique' })
      .setTimestamp();

    const mentions = `<@${rdv.agentId}> <@${rdv.clientId}>`;
    await channel.send({
      content: mentions,
      embeds: [embed],
      allowedMentions: { users: [rdv.agentId, rdv.clientId] },
    });

    if (!isPreReminder) {
      const rdvData = loadRdv();
      if (rdvData[rdv.id]) {
        rdvData[rdv.id].statut = 'passé';
        saveRdv(rdvData);
      }
    }
  } catch (err) {
    console.error(`[RDV] Erreur lors du rappel ${rdv.id}:`, err.message);
  }
}

function scheduleRdv(client, rdv) {
  const now = Date.now();
  const rdvTime = new Date(rdv.datetime).getTime();
  const ids = [];

  if (rdv.rappelMinutes > 0) {
    const preDelay = rdvTime - rdv.rappelMinutes * 60 * 1000 - now;
    if (preDelay > 0) {
      ids.push(setTimeout(() => sendRdvReminder(client, rdv, true), preDelay));
    }
  }

  const delay = rdvTime - now;
  if (delay > 0) {
    ids.push(setTimeout(() => sendRdvReminder(client, rdv, false), delay));
  }

  if (ids.length > 0) timeouts.set(rdv.id, ids);
}

function cancelRdv(id) {
  const ids = timeouts.get(id);
  if (ids) {
    ids.forEach(t => clearTimeout(t));
    timeouts.delete(id);
  }
}

function initScheduler(client) {
  const rdvData = loadRdv();
  const now = new Date();
  let count = 0;

  for (const rdv of Object.values(rdvData)) {
    if (rdv.statut === 'prévu' && new Date(rdv.datetime) > now) {
      scheduleRdv(client, rdv);
      count++;
    }
  }

  if (count > 0) console.log(`[RDV] ${count} rendez-vous planifié(s) chargé(s).`);
}

module.exports = { scheduleRdv, cancelRdv, initScheduler };

const { EmbedBuilder } = require('discord.js');
const { getDB } = require('./db');

const timeouts         = new Map(); // rdvId -> [timeoutId, ...]
const preReminderMsgIds = new Map(); // rdvId -> messageId du pré-rappel

async function sendRdvReminder(client, rdv, isPreReminder = false) {
  try {
    const channel = await client.channels.fetch(rdv.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      console.error(`[RDV] Salon introuvable ou non-textuel pour le rappel ${rdv.id} (channelId: ${rdv.channelId})`);
      return;
    }

    // Supprimer le message du pré-rappel avant d'envoyer le rappel principal
    if (!isPreReminder) {
      const preId = preReminderMsgIds.get(rdv.id);
      if (preId) {
        await channel.messages.delete(preId).catch(() => {});
        preReminderMsgIds.delete(rdv.id);
        console.log(`[RDV] 🗑️ Pré-rappel supprimé pour ${rdv.id}`);
      }
    }

    const datetime = new Date(rdv.datetime);
    const TZ = { timeZone: 'Europe/Paris' };
    const heureFormatted = datetime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', ...TZ });
    const dateFormatted  = datetime.toLocaleDateString('fr-FR',  { weekday: 'long', day: 'numeric', month: 'long', ...TZ });

    const embed = new EmbedBuilder()
      .setColor(isPreReminder ? 0xE67E22 : 0x2ECC71)
      .setTitle(isPreReminder
        ? `⏰ Rappel — RDV dans ${rdv.rappelMinutes} minutes`
        : '📅 C\'est l\'heure du rendez-vous !')
      .addFields(
        { name: '📌 Objet', value: rdv.description, inline: false },
        { name: '📆 Date', value: dateFormatted, inline: true },
        { name: '🕐 Heure', value: heureFormatted, inline: true },
        ...(rdv.lieu ? [{ name: '📍 Lieu', value: rdv.lieu, inline: true }] : []),
      )
      .setFooter({ text: 'Dynasty 8 • Rappel automatique' })
      .setTimestamp();

    const mentions = `<@${rdv.agentId}> <@${rdv.clientId}>`;
    const message = await channel.send({
      content: mentions,
      embeds: [embed],
      allowedMentions: { users: [rdv.agentId, rdv.clientId] },
    });

    // Mémoriser l'ID du message de pré-rappel pour pouvoir le supprimer au moment H
    if (isPreReminder) {
      preReminderMsgIds.set(rdv.id, message.id);
    }

    console.log(`[RDV] ✅ Rappel envoyé pour ${rdv.id} (${isPreReminder ? 'pré-rappel' : 'à l\'heure'})`);

    if (!isPreReminder) {
      await getDB().collection('rendez_vous').updateOne(
        { id: rdv.id },
        { $set: { statut: 'passé' } }
      );
    }
  } catch (err) {
    console.error(`[RDV] ❌ Erreur rappel ${rdv.id}:`, err.message);
  }
}

function scheduleRdv(client, rdv) {
  // Garde-fou anti-doublon : si le RDV est déjà dans la map (planifié par le bot via /rdv),
  // le change stream ne doit pas le re-planifier une deuxième fois.
  if (timeouts.has(rdv.id)) {
    console.log(`[RDV] ⚠️ RDV ${rdv.id} déjà planifié — doublon ignoré`);
    return;
  }

  const now = Date.now();
  const rdvTime = new Date(rdv.datetime).getTime();
  const ids = [];

  if (rdv.rappelMinutes > 0) {
    const preDelay = rdvTime - rdv.rappelMinutes * 60 * 1000 - now;
    if (preDelay > 0) {
      ids.push(setTimeout(() => sendRdvReminder(client, rdv, true), preDelay));
      console.log(`[RDV] ⏱ Pré-rappel planifié dans ${Math.round(preDelay / 1000)}s pour ${rdv.id}`);
    }
  }

  const delay = rdvTime - now;
  if (delay > 0) {
    ids.push(setTimeout(() => sendRdvReminder(client, rdv, false), delay));
    console.log(`[RDV] ⏱ Rappel principal planifié dans ${Math.round(delay / 1000)}s pour ${rdv.id}`);
  }

  if (ids.length > 0) timeouts.set(rdv.id, ids);
}

function cancelRdv(id) {
  const ids = timeouts.get(id);
  if (ids) {
    ids.forEach(t => clearTimeout(t));
    timeouts.delete(id);
  }
  preReminderMsgIds.delete(id);
}

async function initScheduler(client) {
  const now = new Date();

  const pending = await getDB().collection('rendez_vous').find({
    statut: 'prévu',
    datetime: { $gt: now.toISOString() },
  }).toArray();

  for (const rdv of pending) {
    scheduleRdv(client, rdv);
  }

  if (pending.length > 0) {
    console.log(`[RDV] 📅 ${pending.length} rendez-vous planifié(s) rechargé(s) depuis MongoDB.`);
  } else {
    console.log('[RDV] Aucun rendez-vous en attente.');
  }
}

module.exports = { scheduleRdv, cancelRdv, initScheduler };

// ─── Scheduler pour /question — fermeture auto 24h si pas de réponse ────────
// Identique à byeScheduler, mais :
//   • utilise la collection question_pending
//   • indexé par channelId (pas clientId) — un seul timer par ticket
//   • annulé quand le client envoie un message dans le ticket (pas dans #avis)

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getDB } = require('./db');

const timeouts = new Map(); // channelId → timeoutId

// ── Fermeture effective du ticket ─────────────────────────────────────────────
async function closeTicketAfterQuestion(client, doc, reason) {
  try {
    const channel = await client.channels.fetch(doc.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    await channel.permissionOverwrites.edit(doc.clientId, { ViewChannel: false }).catch(() => {});

    const embedFerme = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setDescription(reason);

    const embedControls = new EmbedBuilder()
      .setColor(0x95A5A6)
      .setTitle('``Support team ticket controls``');

    const controlRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_reouvrir_${doc.clientId}`)
        .setLabel('🔓Ré-ouvrir le ticket')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('ticket_supprimer')
        .setLabel('⛔Supprimer')
        .setStyle(ButtonStyle.Secondary),
    );

    await channel.send({ embeds: [embedFerme, embedControls], components: [controlRow] });
    await channel.setName('closed').catch(() => {});

    console.log(`[QUESTION] 🔒 Ticket ${doc.channelId} fermé : ${reason}`);
  } catch (err) {
    console.error('[QUESTION] ❌ Erreur fermeture ticket :', err.message);
  } finally {
    await getDB().collection('question_pending').deleteOne({ channelId: doc.channelId })
      .catch(e => console.error('[QUESTION] Erreur cleanup question_pending :', e.message));
    timeouts.delete(doc.channelId);
  }
}

// ── Planification de la fermeture à 24h ──────────────────────────────────────
function scheduleQuestion(client, doc) {
  const delay = new Date(doc.expiresAt).getTime() - Date.now();

  if (delay <= 0) {
    closeTicketAfterQuestion(client, doc, '⏰ Ce ticket a été **fermé automatiquement** après 24h sans réponse du client.');
    return;
  }

  const t = setTimeout(() => {
    closeTicketAfterQuestion(client, doc, '⏰ Ce ticket a été **fermé automatiquement** après 24h sans nouveau message du client.');
  }, delay);

  timeouts.set(doc.channelId, t);
  console.log(`[QUESTION] ⏱ Fermeture planifiée dans ${Math.round(delay / 1000 / 60)} min pour le ticket ${doc.channelId}`);
}

// ── Annulation du timer (quand le client répond dans le ticket) ───────────────
function cancelQuestion(channelId) {
  const t = timeouts.get(channelId);
  if (t) {
    clearTimeout(t);
    timeouts.delete(channelId);
  }
}

// ── Rechargement au démarrage ─────────────────────────────────────────────────
async function initQuestionScheduler(client) {
  const pending = await getDB().collection('question_pending').find({
    expiresAt: { $gt: new Date().toISOString() },
  }).toArray();

  for (const doc of pending) scheduleQuestion(client, doc);

  if (pending.length > 0) {
    console.log(`[QUESTION] ❓ ${pending.length} fermeture(s) question rechargée(s) depuis MongoDB.`);
  } else {
    console.log('[QUESTION] Aucune fermeture question en attente.');
  }
}

module.exports = { scheduleQuestion, cancelQuestion, closeTicketAfterQuestion, initQuestionScheduler };

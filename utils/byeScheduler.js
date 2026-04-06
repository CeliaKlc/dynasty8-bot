const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getDB } = require('./db');

const timeouts = new Map(); // clientId → timeoutId

// ── Fermeture effective du ticket ─────────────────────────────────────────────
async function closeTicketAfterBye(client, doc, reason) {
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

    console.log(`[BYE] 🔒 Ticket ${doc.channelId} fermé : ${reason}`);
  } catch (err) {
    console.error('[BYE] ❌ Erreur fermeture ticket :', err.message);
  } finally {
    await getDB().collection('bye_pending').deleteOne({ clientId: doc.clientId });
    timeouts.delete(doc.clientId);
  }
}

// ── Planification de la fermeture à 24h ──────────────────────────────────────
function scheduleBye(client, doc) {
  const delay = new Date(doc.expiresAt).getTime() - Date.now();

  if (delay <= 0) {
    closeTicketAfterBye(client, doc, '⏰ Ce ticket a été **fermé automatiquement** après 24h sans avis du client.');
    return;
  }

  const t = setTimeout(() => {
    closeTicketAfterBye(client, doc, '⏰ Ce ticket a été **fermé automatiquement** après 24h sans avis du client.');
  }, delay);

  timeouts.set(doc.clientId, t);
  console.log(`[BYE] ⏱ Fermeture planifiée dans ${Math.round(delay / 1000 / 60)} min pour le ticket de ${doc.clientId}`);
}

// ── Annulation du timer (quand le client poste son avis) ─────────────────────
function cancelBye(clientId) {
  const t = timeouts.get(clientId);
  if (t) {
    clearTimeout(t);
    timeouts.delete(clientId);
  }
}

// ── Rechargement au démarrage ─────────────────────────────────────────────────
async function initByeScheduler(client) {
  const pending = await getDB().collection('bye_pending').find({
    expiresAt: { $gt: new Date().toISOString() },
  }).toArray();

  for (const doc of pending) scheduleBye(client, doc);

  if (pending.length > 0) {
    console.log(`[BYE] 👋 ${pending.length} fermeture(s) bye rechargée(s) depuis MongoDB.`);
  } else {
    console.log('[BYE] Aucune fermeture bye en attente.');
  }
}

module.exports = { scheduleBye, cancelBye, closeTicketAfterBye, initByeScheduler };

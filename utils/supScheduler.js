const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getDB } = require('./db');

const timeouts = new Map(); // messageId → timeoutId

// ── Fermeture effective du ticket ─────────────────────────────────────────────
async function executeSupClose(client, doc) {
  try {
    const channel = await client.channels.fetch(doc.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      console.warn(`[SUP] Salon introuvable : ${doc.channelId}`);
      return;
    }

    // Vérifier si le client a répondu depuis le message /sup
    const messages = await channel.messages.fetch({ after: doc.messageId, limit: 100 });
    const hasResponse = messages.some(m => !m.author.bot);

    if (hasResponse) {
      console.log(`[SUP] ✅ Client a répondu dans ${doc.channelId} — fermeture annulée.`);
      return;
    }

    // Aucune réponse → retirer l'accès au client
    try {
      await channel.permissionOverwrites.edit(doc.clientId, { ViewChannel: false });
    } catch (err) {
      console.warn(`[SUP] ⚠️ Impossible de retirer la permission client :`, err.message);
    }

    // Embed fermeture automatique
    const embedFerme = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setDescription(`🔴 Ce ticket a été **fermé automatiquement** après 24h sans réponse du client.`);

    // Embed contrôles agents (même structure que fermeture manuelle)
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
    console.log(`[SUP] 🔒 Ticket ${doc.channelId} fermé automatiquement.`);
  } catch (err) {
    console.error(`[SUP] ❌ Erreur fermeture automatique :`, err.message);
  } finally {
    await getDB().collection('sup_pending').deleteOne({ messageId: doc.messageId })
      .catch(e => console.error('[SUP] Erreur cleanup sup_pending :', e.message));
    timeouts.delete(doc.messageId);
  }
}

// ── Planification de la fermeture ─────────────────────────────────────────────
function scheduleSup(client, doc) {
  const delay = new Date(doc.closeAt).getTime() - Date.now();

  if (delay <= 0) {
    // Déjà expiré (ex: bot redémarré après l'échéance) → fermer immédiatement
    executeSupClose(client, doc);
    return;
  }

  const t = setTimeout(() => executeSupClose(client, doc), delay);
  timeouts.set(doc.messageId, t);
  console.log(`[SUP] ⏱ Fermeture planifiée dans ${Math.round(delay / 1000 / 60)} min pour le salon ${doc.channelId}`);
}

// ── Annulation manuelle ───────────────────────────────────────────────────────
function cancelSup(messageId) {
  const t = timeouts.get(messageId);
  if (t) {
    clearTimeout(t);
    timeouts.delete(messageId);
  }
}

// ── Rechargement au démarrage ─────────────────────────────────────────────────
async function initSupScheduler(client) {
  const pending = await getDB().collection('sup_pending').find({
    closeAt: { $gt: new Date().toISOString() },
  }).toArray();

  for (const doc of pending) scheduleSup(client, doc);

  if (pending.length > 0) {
    console.log(`[SUP] 🔴 ${pending.length} fermeture(s) automatique(s) rechargée(s) depuis MongoDB.`);
  } else {
    console.log('[SUP] Aucune fermeture automatique en attente.');
  }
}

module.exports = { scheduleSup, cancelSup, initSupScheduler };

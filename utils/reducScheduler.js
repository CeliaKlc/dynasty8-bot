const { getDB } = require('./db');

const timeouts = new Map(); // messageId -> timeoutId

async function scheduleDelete(client, { messageId, channelId, deleteAt }) {
  const delay = new Date(deleteAt).getTime() - Date.now();

  if (delay <= 0) {
    await executeDelete(client, messageId, channelId);
    return;
  }

  const t = setTimeout(() => executeDelete(client, messageId, channelId), delay);
  timeouts.set(messageId, t);
  console.log(`[REDUC] ⏱ Suppression planifiée dans ${Math.round(delay / 1000 / 60)} min pour message ${messageId}`);
}

async function executeDelete(client, messageId, channelId) {
  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (channel?.isTextBased()) {
      const msg = await channel.messages.fetch(messageId).catch(() => null);
      if (msg) await msg.delete();
    }
  } catch (err) {
    console.error(`[REDUC] ❌ Erreur suppression message ${messageId}:`, err.message);
  } finally {
    timeouts.delete(messageId);
    await getDB().collection('reductions').deleteOne({ messageId }).catch(() => {});
  }
}

async function initReducScheduler(client) {
  const now = new Date();

  const pending = await getDB().collection('reductions').find({
    deleteAt: { $gt: now.toISOString() },
  }).toArray();

  for (const entry of pending) {
    scheduleDelete(client, entry);
  }

  if (pending.length > 0) {
    console.log(`[REDUC] 🗑️ ${pending.length} suppression(s) programmée(s) rechargée(s) depuis MongoDB.`);
  }
}

module.exports = { scheduleDelete, initReducScheduler };

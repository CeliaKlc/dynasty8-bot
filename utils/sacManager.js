const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getDB } = require('./db');
const { AGENTS } = require('./annonceBuilder');

const SAC_CHANNEL_ID    = '1398797852490207262';
const SAC_DASHBOARD_KEY = 'sac_dashboard_message';

// ─── Mise à jour du dashboard ─────────────────────────────────────────────────

async function updateSacDashboard(client) {
  const db = getDB();

  // Toutes les entrées en DB, indexées par agentId
  const entries    = await db.collection('sac_registry').find({}).toArray();
  const entryMap   = Object.fromEntries(entries.map(e => [e.agentId, e]));

  const channel = await client.channels.fetch(SAC_CHANNEL_ID).catch(() => null);
  if (!channel) {
    console.error('[SAC] Salon introuvable :', SAC_CHANNEL_ID);
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('🎒 Registre des Sacs — Dynasty 8')
    .setTimestamp();

  // Un champ inline par agent actif (3 par ligne dans Discord)
  let actifCount = 0;
  for (const agent of AGENTS) {
    const entry = entryMap[agent.id];
    if (entry?.statut === 'parti') continue; // Masquer les agents partis

    actifCount++;
    const agentSacs = entry?.sacs ?? [];
    embed.addFields({
      name:   `${agent.emoji} ${agent.name}`,
      value:  agentSacs.length > 0 ? agentSacs.map(s => `> - ${s}`).join('\n') : '*Aucun sac*',
      inline: true,
    });
  }

  // Spacers pour compléter la dernière rangée (Discord = 3 champs inline par ligne)
  const remainder = actifCount % 3;
  if (remainder !== 0) {
    for (let i = 0; i < 3 - remainder; i++) {
      embed.addFields({ name: '\u200B', value: '\u200B', inline: true });
    }
  }

  embed.setFooter({ text: `${actifCount} agent(s) actif(s)` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('sac_historique')
      .setLabel('📋 Historique')
      .setStyle(ButtonStyle.Secondary),
  );

  // Éditer le message existant ou en créer un nouveau
  const config = await db.collection('bot_config').findOne({ key: SAC_DASHBOARD_KEY });
  if (config?.messageId) {
    try {
      const msg = await channel.messages.fetch(config.messageId);
      await msg.edit({ embeds: [embed], components: [row] });
      return;
    } catch {
      // Message supprimé → on en crée un nouveau
    }
  }

  const msg = await channel.send({ embeds: [embed], components: [row] });
  await db.collection('bot_config').updateOne(
    { key: SAC_DASHBOARD_KEY },
    { $set: { key: SAC_DASHBOARD_KEY, channelId: SAC_CHANNEL_ID, messageId: msg.id } },
    { upsert: true },
  );
}

module.exports = { updateSacDashboard };

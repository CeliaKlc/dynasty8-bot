const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { toMathSans } = require('../utils/formatters');
const { getDB }      = require('../utils/db');
const { AGENTS }     = require('../utils/annonceBuilder');

const DELAI_RAPPEL  = 3 * 60 * 60 * 1000; // 3h
const DELAI_REPONSE = 10 * 60 * 1000;      // 10 min

// Durées disponibles pour le timer prédéfini (en ms)
const TIMERS = {
  '30m':  30 * 60 * 1000,
  '1h':    1 * 60 * 60 * 1000,
  '2h':    2 * 60 * 60 * 1000,
  '3h':    3 * 60 * 60 * 1000,
  '4h':    4 * 60 * 60 * 1000,
  '6h':    6 * 60 * 60 * 1000,
  '8h':    8 * 60 * 60 * 1000,
};

// ─── Index des cartes agents (source : utils/annonceBuilder.js) ───────────────
// Seuls les agents avec un id Discord et une photo configurée ont une carte.
const CARTES = Object.fromEntries(
  AGENTS.filter(a => a.id && a.photo).map(a => [a.id, a]),
);

// ─── Timers en mémoire (référence pour clearTimeout) ──────────────────────────
const timers = new Map(); // userId → { rappelTimeout?, suppressionTimeout? }

function clearTimers(userId) {
  const t = timers.get(userId);
  if (!t) return;
  clearTimeout(t.rappelTimeout);
  clearTimeout(t.suppressionTimeout);
  timers.delete(userId);
}

// ─── MongoDB ───────────────────────────────────────────────────────────────────

async function sauvegarder(session) {
  const db = getDB();
  await db.collection('carte_sessions').replaceOne(
    { userId: session.userId },
    session,
    { upsert: true },
  );
}

async function supprimerSession(userId) {
  const db = getDB();
  await db.collection('carte_sessions').deleteOne({ userId });
}

// ─── Suppression de la carte ───────────────────────────────────────────────────

async function executerSuppression(client, session) {
  console.log(`[CARTE] Suppression de la carte de ${session.userId} (phase: ${session.phase})`);

  try {
    const ch  = await client.channels.fetch(session.cardChannelId);
    const msg = await ch.messages.fetch(session.cardMessageId);
    await msg.delete();
    console.log(`[CARTE] Carte supprimée avec succès (msgId: ${session.cardMessageId})`);
  } catch (err) {
    console.error(`[CARTE] Impossible de supprimer la carte :`, err.message);
  }

  if (session.phase === 'suppression' && session.rappelMessageId) {
    try {
      const bunker    = await client.channels.fetch(session.bunkerChannelId);
      const rappelMsg = await bunker.messages.fetch(session.rappelMessageId);
      await rappelMsg.edit({ content: `<@${session.userId}> ❌ Pas de réponse — ta carte a été supprimée.`, components: [] });
    } catch (err) {
      console.error(`[CARTE] Impossible de modifier le message bunker :`, err.message);
    }
  }

  clearTimers(session.userId);
  await supprimerSession(session.userId);
}

// ─── Rappel dans le bunker (flow sans timer prédéfini) ────────────────────────

async function executerRappel(client, session) {
  if (!session.bunkerChannelId) return;

  try {
    const bunker = await client.channels.fetch(session.bunkerChannelId);
    const row    = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`carte_check_${session.userId}`)
        .setLabel('✅ Toujours en service')
        .setStyle(ButtonStyle.Success),
    );

    const rappelMsg = await bunker.send({
      content: `<@${session.userId}> ⏰ Ta carte est en ligne depuis **3h**. Es-tu toujours en service ?\n> Si tu ne confirmes pas dans **10 minutes**, ta carte sera automatiquement supprimée.`,
      components: [row],
    });

    const updatedSession = {
      ...session,
      phase:           'suppression',
      suppressionAt:   new Date(Date.now() + DELAI_REPONSE),
      rappelMessageId: rappelMsg.id,
    };
    await sauvegarder(updatedSession);

    const suppressionTimeout = setTimeout(() => executerSuppression(client, updatedSession), DELAI_REPONSE);
    timers.set(session.userId, { suppressionTimeout });

  } catch (err) {
    console.error('[CARTE] Erreur rappel :', err);
  }
}

// ─── Restauration au démarrage ─────────────────────────────────────────────────

async function restaurerSessions(client) {
  const db       = getDB();
  const sessions = await db.collection('carte_sessions').find().toArray();
  const now      = Date.now();

  for (const session of sessions) {
    if (session.phase === 'rappel') {
      const delai = Math.max(new Date(session.rappelAt).getTime() - now, 0);
      const t     = setTimeout(() => executerRappel(client, session), delai);
      timers.set(session.userId, { rappelTimeout: t });

    } else if (session.phase === 'suppression' || session.phase === 'timer') {
      const delai = Math.max(new Date(session.suppressionAt).getTime() - now, 0);
      const t     = setTimeout(() => executerSuppression(client, session), delai);
      timers.set(session.userId, { suppressionTimeout: t });
    }
  }

  if (sessions.length > 0) {
    console.log(`[CARTE] ${sessions.length} session(s) restaurée(s) depuis MongoDB`);
  }
}

// ─── Commande ──────────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('carte')
    .setDescription('Afficher sa carte d\'agent Dynasty 8 en service')
    .addStringOption(opt => opt
      .setName('timer')
      .setDescription('Supprimer automatiquement la carte après ce délai (sans rappel de vérification)')
      .setRequired(false)
      .addChoices(
        { name: '30 minutes', value: '30m' },
        { name: '1 heure',    value: '1h'  },
        { name: '2 heures',   value: '2h'  },
        { name: '3 heures',   value: '3h'  },
        { name: '4 heures',   value: '4h'  },
        { name: '6 heures',   value: '6h'  },
        { name: '8 heures',   value: '8h'  },
      )),

  async execute(interaction) {
    const carte      = CARTES[interaction.user.id];
    const timerKey   = interaction.options.getString('timer');

    if (!carte) {
      return interaction.reply({ content: '❌ Tu n\'as pas de carte configurée. Contacte un administrateur.', ephemeral: true });
    }
    if (!carte.numero) {
      return interaction.reply({ content: '❌ Ta carte n\'est pas encore complétée (numéro manquant). Contacte un administrateur.', ephemeral: true });
    }

    // Annuler la session précédente
    clearTimers(interaction.user.id);
    await supprimerSession(interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor(0x117D33)
      .setAuthor({ name: `✦  ${toMathSans('⠀⠀⠀⠀⠀⠀⠀AGENT EN SERVICE⠀⠀⠀⠀⠀⠀⠀')}  ✦`, iconURL: interaction.client.user.displayAvatarURL() })
      .setTitle(carte.name)
      .setDescription(`*${carte.titre}*\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯`)
      .addFields({ name: '☎️ Numéro :', value: `\`\`\`${carte.numero}\`\`\``, inline: true });

    if (timerKey) {
      const finAt = Math.floor((Date.now() + TIMERS[timerKey]) / 1000);
      embed.addFields({ name: '⏱️ Fin de service :', value: `<t:${finAt}:R>`, inline: true });
    }

    if (carte.agre.length > 0) {
      embed.addFields({ name: '🗒️ Habilitations :', value: carte.agre.map(h => `> ◆ ${h}`).join('\n') });
    }

    embed
      .setThumbnail(carte.photo || null)
      .setFooter({ text: 'Dynasty 8', iconURL: interaction.client.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    const cardMsg = await interaction.fetchReply();

    if (timerKey) {
      // ── Mode timer prédéfini : suppression directe, pas de rappel ──
      const delai          = TIMERS[timerKey];
      const suppressionAt  = new Date(Date.now() + delai);
      const session        = {
        userId:          interaction.user.id,
        cardChannelId:   interaction.channelId,
        cardMessageId:   cardMsg.id,
        bunkerChannelId: carte.bunker,
        phase:           'timer',
        suppressionAt,
        rappelAt:        null,
        rappelMessageId: null,
      };
      await sauvegarder(session);

      const suppressionTimeout = setTimeout(() => executerSuppression(interaction.client, session), delai);
      timers.set(interaction.user.id, { suppressionTimeout });

    } else {
      // ── Mode normal : rappel après 3h ──
      const session = {
        userId:          interaction.user.id,
        cardChannelId:   interaction.channelId,
        cardMessageId:   cardMsg.id,
        bunkerChannelId: carte.bunker,
        phase:           'rappel',
        rappelAt:        new Date(Date.now() + DELAI_RAPPEL),
        suppressionAt:   null,
        rappelMessageId: null,
      };
      await sauvegarder(session);

      const rappelTimeout = setTimeout(() => executerRappel(interaction.client, session), DELAI_RAPPEL);
      timers.set(interaction.user.id, { rappelTimeout });
    }
  },

  // ─── Handler bouton confirmation (flow rappel uniquement) ─────────────────

  async handleCarteCheck(interaction) {
    const userId = interaction.customId.replace('carte_check_', '');

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Ce bouton ne te concerne pas.', ephemeral: true });
    }

    const db      = getDB();
    const session = await db.collection('carte_sessions').findOne({ userId });

    if (!session) {
      return interaction.update({ content: '⚠️ Session expirée ou carte déjà supprimée.', components: [] });
    }

    clearTimers(userId);

    // Repartir pour un nouveau cycle de 3h
    const carte          = CARTES[userId];
    const updatedSession = {
      ...session,
      phase:           'rappel',
      rappelAt:        new Date(Date.now() + DELAI_RAPPEL),
      suppressionAt:   null,
      rappelMessageId: null,
    };
    await sauvegarder(updatedSession);

    const rappelTimeout = setTimeout(() => executerRappel(interaction.client, updatedSession), DELAI_RAPPEL);
    timers.set(userId, { rappelTimeout });

    return interaction.update({
      content: `✅ Présence confirmée ! Un nouveau rappel sera envoyé dans **3h**.`,
      components: [],
    });
  },

  restaurerSessions,
  annulerSiCarteSupprimee,
};

// ─── Annulation si la carte est supprimée manuellement ────────────────────────
async function annulerSiCarteSupprimee(messageId) {
  const db = getDB();
  const session = await db.collection('carte_sessions').findOne({ cardMessageId: messageId });
  if (!session) return false;

  console.log(`[CARTE] Message ${messageId} supprimé manuellement — annulation de la session de ${session.userId}`);
  clearTimers(session.userId);
  await supprimerSession(session.userId);
  return true;
}

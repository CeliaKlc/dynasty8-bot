const { lbcPendingMessages } = require('../commands/lbc');
const { SLOT_EMOJIS, buildContent } = require('../commands/entretien');
const { getDB } = require('../utils/db');

const ROLE_GESTIONNAIRE_LBC = '1045639426170167358';

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user) {
    // Ignorer les réactions du bot lui-même
    if (user.bot) return;

    // Compléter les objets partiels (nécessaire pour les messages non cachés)
    if (reaction.partial) {
      try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
      try { await reaction.message.fetch(); } catch { return; }
    }

    // ── LBC : réaction ✅ ────────────────────────────────────────────────────
    if (reaction.emoji.name === '✅' && lbcPendingMessages.has(reaction.message.id)) {
      const channel = reaction.message.channel;
      try {
        await channel.send({
          content: `✅ ${user} a accepté les conditions LBC — <@&${ROLE_GESTIONNAIRE_LBC}>`,
          allowedMentions: { roles: [ROLE_GESTIONNAIRE_LBC], users: [user.id] },
        });
        if (!channel.name.startsWith('⏳')) {
          await channel.setName(`⏳${channel.name}`);
        }
        lbcPendingMessages.delete(reaction.message.id);
      } catch (err) {
        console.error('❌ Erreur messageReactionAdd LBC :', err);
      }
      return;
    }

    // ── Entretien : créneaux numérotés ───────────────────────────────────────
    const slotIndex = SLOT_EMOJIS.indexOf(reaction.emoji.name);
    if (slotIndex === -1) return; // emoji non géré

    let entretien;
    try {
      entretien = await getDB().collection('entretiens').findOne({ messageId: reaction.message.id });
    } catch { return; }
    if (!entretien) return;

    // Emoji hors plage des créneaux définis → supprimer la réaction
    if (slotIndex >= entretien.creneaux.length) {
      await reaction.users.remove(user.id).catch(() => {});
      return;
    }

    const slot = entretien.creneaux[slotIndex];

    // Créneau déjà pris par quelqu'un d'autre → rejeter
    if (slot.userId && slot.userId !== user.id) {
      await reaction.users.remove(user.id).catch(() => {});
      return;
    }

    // Déjà inscrit sur ce créneau → rien à faire
    if (slot.userId === user.id) return;

    // Si l'utilisateur avait déjà un autre créneau → le libérer
    const ancienIndex = entretien.creneaux.findIndex(c => c.userId === user.id);
    if (ancienIndex !== -1 && ancienIndex !== slotIndex) {
      await getDB().collection('entretiens').updateOne(
        { messageId: reaction.message.id },
        { $set: { [`creneaux.${ancienIndex}.userId`]: null } },
      ).catch(() => {});
      // Supprimer l'ancienne réaction de l'utilisateur
      const ancienneReaction = reaction.message.reactions.cache.get(SLOT_EMOJIS[ancienIndex]);
      if (ancienneReaction) await ancienneReaction.users.remove(user.id).catch(() => {});
    }

    // Attribuer le créneau
    await getDB().collection('entretiens').updateOne(
      { messageId: reaction.message.id },
      { $set: { [`creneaux.${slotIndex}.userId`]: user.id } },
    ).catch(() => {});

    // Recharger et mettre à jour le message (sans re-ping)
    const updated = await getDB().collection('entretiens').findOne({ messageId: reaction.message.id }).catch(() => null);
    if (updated) {
      await reaction.message.edit({
        ...buildContent(updated),
        allowedMentions: { parse: [] },
      }).catch(() => {});
    }
  },
};

const { SLOT_EMOJIS, buildContent } = require('../commands/entretien');
const { getDB } = require('../utils/db');

module.exports = {
  name: 'messageReactionRemove',
  async execute(reaction, user) {
    if (user.bot) return;

    // Compléter les objets partiels
    if (reaction.partial) {
      try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
      try { await reaction.message.fetch(); } catch { return; }
    }

    // Vérifier que c'est un emoji de créneau
    const slotIndex = SLOT_EMOJIS.indexOf(reaction.emoji.name);
    if (slotIndex === -1) return;

    let entretien;
    try {
      entretien = await getDB().collection('entretiens').findOne({ messageId: reaction.message.id });
    } catch { return; }
    if (!entretien) return;

    const slot = entretien.creneaux[slotIndex];
    if (!slot) return;

    // Libérer uniquement si c'est bien cet utilisateur qui occupait le créneau
    if (slot.userId !== user.id) return;

    await getDB().collection('entretiens').updateOne(
      { messageId: reaction.message.id },
      { $set: { [`creneaux.${slotIndex}.userId`]: null } },
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

const { lbcPendingMessages } = require('../commands/lbc');

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

    // Vérifier que c'est une réaction ✅ sur un message LBC en attente
    if (reaction.emoji.name !== '✅') return;
    if (!lbcPendingMessages.has(reaction.message.id)) return;

    const channel = reaction.message.channel;

    try {
      await channel.send({
        content: `✅ ${user} a accepté les conditions LBC — <@&${ROLE_GESTIONNAIRE_LBC}>`,
        allowedMentions: { roles: [ROLE_GESTIONNAIRE_LBC], users: [user.id] },
      });

      // Retirer le message de la liste d'attente pour éviter les pings multiples
      lbcPendingMessages.delete(reaction.message.id);
    } catch (err) {
      console.error('❌ Erreur messageReactionAdd LBC :', err);
    }
  },
};

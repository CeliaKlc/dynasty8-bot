const { getDB }                                      = require('../utils/db');
const { cancelBye, closeTicketAfterBye }             = require('../utils/byeScheduler');
const { cancelQuestion }                             = require('../utils/questionScheduler');

const AVIS_CLIENTS_CHANNEL_ID = '915921133260386335';

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;

    // ── Salon #avis-clients → fermeture auto après /bye ──────────────────────
    if (message.channelId === AVIS_CLIENTS_CHANNEL_ID) {
      const doc = await getDB().collection('bye_pending').findOne({ clientId: message.author.id });
      if (!doc) return;

      cancelBye(message.author.id);
      await closeTicketAfterBye(
        message.client,
        doc,
        `⭐ Ce ticket a été **fermé automatiquement** suite à l'avis laissé par le client.`,
      );
      return;
    }

    // ── Ticket channel → annule le timer /question si le bon client répond ────
    // On vérifie que c'est bien le client concerné (pas un agent) qui répond.
    const qDoc = await getDB().collection('question_pending').findOne({
      channelId: message.channelId,
      clientId:  message.author.id,
    });
    if (!qDoc) return;

    cancelQuestion(message.channelId);

    // Nettoyage DB (le timer ne clôturera pas, donc il faut supprimer manuellement)
    await getDB().collection('question_pending').deleteOne({ channelId: message.channelId })
      .catch(e => console.error('[QUESTION] Erreur cleanup après réponse client :', e.message));

    // Notification discrète dans le ticket pour les agents
    await message.channel.send({
      content: `-# ⏰ Timer de fermeture automatique annulé — le client a posté un nouveau message.`,
    }).catch(() => {});
  },
};

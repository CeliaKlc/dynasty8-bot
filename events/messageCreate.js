const { getDB } = require('../utils/db');
const { cancelBye, closeTicketAfterBye } = require('../utils/byeScheduler');

const AVIS_CLIENTS_CHANNEL_ID = '915921133260386335';

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;
    if (message.channelId !== AVIS_CLIENTS_CHANNEL_ID) return;

    // Vérifier si ce client a un ticket en attente de fermeture /bye
    const doc = await getDB().collection('bye_pending').findOne({ clientId: message.author.id });
    if (!doc) return;

    // Le client a posté son avis → annuler le timer et fermer le ticket
    cancelBye(message.author.id);
    await closeTicketAfterBye(
      message.client,
      doc,
      `⭐ Ce ticket a été **fermé automatiquement** suite à l'avis laissé par le client.`
    );
  },
};

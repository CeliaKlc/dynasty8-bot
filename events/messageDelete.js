const { annulerSiCarteSupprimee } = require('../commands/carte');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    try {
      await annulerSiCarteSupprimee(message.id);
    } catch (err) {
      console.error('❌ Erreur messageDelete (carte) :', err);
    }
  },
};

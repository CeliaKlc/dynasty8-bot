const { initScheduler } = require('../utils/rdvScheduler');
const { initReducScheduler } = require('../utils/reducScheduler');
const { initSupScheduler } = require('../utils/supScheduler');
const { initByeScheduler } = require('../utils/byeScheduler');
const { restaurerSessions } = require('../commands/carte');
const { updateGuide } = require('../utils/guideManager');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`
╔═══════════════════════════════════════╗
║   🏠  DYNASTY 8 - BOT EN LIGNE  🏠   ║
║   Connecté en tant que ${client.user.tag.padEnd(15)}║
╚═══════════════════════════════════════╝
    `);
    const activites = [
      { name: 'Votre bien est en cours de recherche',       type: 3 }, // Watching
      { name: 'Regarde des villas hors budget',             type: 3 }, // Watching
      { name: 'Cherche un acheteur sérieux',                type: 2 }, // Listening
      { name: 'Compte les zéros sur les chèques',           type: 3 }, // Watching
      { name: 'En visite avec un client',                   type: 1 }, // Playing
      { name: 'Sélection d’opportunités en cours',          type: 3 }, // Watching
    ];

    let index = 0;
    client.user.setActivity(activites[0].name, { type: activites[0].type });
    setInterval(() => {
      index = (index + 1) % activites.length;
      client.user.setActivity(activites[index].name, { type: activites[index].type });
    }, 50_000); // change toutes les 15 secondes
    restaurerSessions(client).catch(console.error);
    updateGuide(client).catch(console.error);
    initScheduler(client);
    initReducScheduler(client);
    initSupScheduler(client);
    initByeScheduler(client);
  },
};
